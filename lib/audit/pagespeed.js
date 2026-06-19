'use strict';

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/**
 * Number of PageSpeed runs we fire concurrently and median across. Three is
 * the sweet spot: enough to swallow most run-to-run noise from a single
 * Lighthouse lab pass, but small enough that quota stays trivial and the
 * wall-clock budget for the audit doesn't blow up (all three run in parallel
 * so latency is bounded by the slowest single call).
 */
const PAGESPEED_RUNS = 3;

/**
 * Median of an array of numbers, ignoring nulls. Returns null when there are
 * no numeric values.
 */
function median(values) {
  const nums = values.filter((v) => typeof v === "number");
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Public entry point. Runs `PAGESPEED_RUNS` PageSpeed Insights calls in
 * parallel and returns a single Performance result with each field median-ed
 * across the successful runs. This stabilizes the dominant 30-point chunk of
 * the overall audit score, which was previously swinging 20+ points between
 * consecutive runs of the same URL due to Lighthouse's well-documented
 * single-run noisiness.
 *
 * Notes on the median strategy:
 *  - score, lcp, cls, fcp are each median-ed independently. When CrUX field
 *    data is available, all runs return the same value for that field, so the
 *    median equals the single value (lossless). When only lab data is
 *    available, the median washes out single-run jitter.
 *  - webVitalsPass is recomputed from the median lcp/cls so the
 *    pass/fail signal stays internally consistent with the numbers shown.
 */
async function runPageSpeed(url) {
  const apiKey = process.env.GOOGLE_PAGESPEED_KEY;
  if (!apiKey) throw new Error("GOOGLE_PAGESPEED_KEY is not set");

  const settled = await Promise.allSettled(
    Array.from({ length: PAGESPEED_RUNS }, () => runPageSpeedOnce(url, apiKey)),
  );
  const successes = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  if (successes.length === 0) {
    const firstError = settled.find((r) => r.status === "rejected");
    throw new Error(
      `PageSpeed: all ${PAGESPEED_RUNS} attempts failed${
        firstError ? ` (first error: ${firstError.reason})` : ""
      }`,
    );
  }
  if (successes.length === 1) return successes[0];

  const score = Math.round(median(successes.map((r) => r.score)) ?? 0);
  const lcp = median(successes.map((r) => r.lcp));
  const cls = median(successes.map((r) => r.cls));
  const fcp = median(successes.map((r) => r.fcp));
  const webVitalsPass =
    typeof lcp === "number" && typeof cls === "number" ? lcp <= 4.0 && cls <= 0.25 : false;

  return {
    score,
    lcp,
    cls: typeof cls === "number" ? Number(cls.toFixed(3)) : null,
    fcp,
    webVitalsPass,
  };
}

async function runPageSpeedOnce(url, apiKey) {

  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy: "mobile",
    category: "PERFORMANCE",
  });

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const lh = data.lighthouseResult;
  const field = data.loadingExperience?.metrics;

  const score = lh?.categories?.performance?.score;

  // Prefer CrUX field data (real-world 28-day p75) when available. It's much
  // more stable than a single Lighthouse lab run, which is what the user kept
  // seeing oscillate between Pass and Fail on the same site.
  const fieldLcpMs = field?.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
  const fieldClsRaw = field?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile; // raw is CLS * 100
  const fieldFcpMs = field?.FIRST_CONTENTFUL_PAINT_MS?.percentile;
  const overall = data.loadingExperience?.overall_category;

  const labLcpMs = lh?.audits?.["largest-contentful-paint"]?.numericValue;
  const labCls = lh?.audits?.["cumulative-layout-shift"]?.numericValue;
  const labFcpMs = lh?.audits?.["first-contentful-paint"]?.numericValue;

  const lcpMs = typeof fieldLcpMs === "number" ? fieldLcpMs : labLcpMs;
  const cls = typeof fieldClsRaw === "number" ? fieldClsRaw / 100 : labCls;
  const fcpMs = typeof fieldFcpMs === "number" ? fieldFcpMs : labFcpMs;

  const lcpSec = typeof lcpMs === "number" ? lcpMs / 1000 : null;
  const fcpSec = typeof fcpMs === "number" ? fcpMs / 1000 : null;

  // Pass / fail. Prefer Google's "overall_category" from CrUX when present
  // (FAST / AVERAGE / SLOW). Fall back to numeric thresholds: LCP <= 4.0s,
  // CLS <= 0.25 -- the "needs improvement" cutoff, matching industry tools.
  let webVitalsPass;
  if (overall === "FAST" || overall === "AVERAGE") {
    webVitalsPass = true;
  } else if (overall === "SLOW") {
    webVitalsPass = false;
  } else {
    webVitalsPass =
      typeof lcpMs === "number" && typeof cls === "number" ? lcpMs <= 4000 && cls <= 0.25 : false;
  }

  return {
    score: typeof score === "number" ? Math.round(score * 100) : 0,
    lcp: lcpSec,
    cls: typeof cls === "number" ? Number(cls.toFixed(3)) : null,
    fcp: fcpSec,
    webVitalsPass,
  };
}

module.exports = { runPageSpeed };
