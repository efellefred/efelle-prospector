'use strict';

/**
 * DataForSEO client — server-only.
 *
 * Endpoints used (Phase 1):
 *   1. Backlinks summary           POST /backlinks/summary/live
 *   2. Labs domain rank overview   POST /dataforseo_labs/google/domain_rank_overview/live
 *   3. Labs historical rank        POST /dataforseo_labs/google/historical_rank_overview/live
 *   4. Labs ranked keywords        POST /dataforseo_labs/google/ranked_keywords/live (limit 100)
 *
 * Behavior:
 *   - Every function returns null on missing config, API error, or unexpected
 *     response shape. Never throws. Callers can pass results into
 *     Promise.allSettled without special handling.
 *   - 30-day in-memory cache keyed by `${endpoint}:${target}`. Vercel cold
 *     starts clear the cache; that's fine — competitor domains still repeat
 *     within a single warm lambda for the duration of a WAR job.
 *   - Feature flag: ENABLE_DATAFORSEO must be "1" or "true". When off, every
 *     function returns null without making a network call.
 */

const BASE = "https://api.dataforseo.com/v3";
const LOCATION_CODE = 2840; // United States (Google location code)
const LANGUAGE_CODE = "en";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TRAFFIC_TREND_MONTHS = 12;
const TOP_KEYWORDS_LIMIT = 100;

const cache = new Map();

function isEnabled() {
  const flag = process.env.ENABLE_DATAFORSEO;
  if (flag !== "1" && flag !== "true") return false;
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

async function dfsCall(endpoint, body) {
  if (!isEnabled()) return null;
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");
  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[dataforseo] ${endpoint} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.status_code !== 20000) {
      console.warn(
        `[dataforseo] ${endpoint} envelope ${data.status_code}: ${data.status_message}`,
      );
      return null;
    }
    const task = data.tasks && data.tasks[0];
    if (!task || task.status_code !== 20000) {
      console.warn(
        `[dataforseo] ${endpoint} task ${task ? task.status_code : undefined}: ${task ? task.status_message : undefined}`,
      );
      return null;
    }
    return (task.result && task.result[0]) ?? null;
  } catch (err) {
    console.warn(`[dataforseo] ${endpoint} threw:`, err);
    return null;
  }
}

async function memo(key, fetcher) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await fetcher();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

// ───────────────────────────────────────────────────────────────────
// 1. Backlinks summary  →  backlinks, referring domains, DR equivalent
// ───────────────────────────────────────────────────────────────────

async function getBacklinkSummary(target) {
  return memo(`backlinks:${target}`, async () => {
    const raw = await dfsCall(
      "/backlinks/summary/live",
      [{ target, internal_list_limit: 1, backlinks_status_type: "live" }],
    );
    if (!raw) return null;
    return {
      backlinks: typeof raw.backlinks === "number" ? raw.backlinks : null,
      referringDomains:
        typeof raw.referring_domains === "number" ? raw.referring_domains : null,
      domainAuthority: typeof raw.rank === "number" ? raw.rank : null,
    };
  });
}

// ───────────────────────────────────────────────────────────────────
// 2. Domain rank overview  →  organic keyword count + ETV
// ───────────────────────────────────────────────────────────────────

async function getDomainOverview(target) {
  return memo(`overview:${target}`, async () => {
    const raw = await dfsCall(
      "/dataforseo_labs/google/domain_rank_overview/live",
      [{ target, location_code: LOCATION_CODE, language_code: LANGUAGE_CODE }],
    );
    const organic = raw && raw.metrics && raw.metrics.organic;
    if (!organic) return null;
    return {
      organicKeywordsCount: typeof organic.count === "number" ? organic.count : null,
      estimatedTrafficValue: typeof organic.etv === "number" ? organic.etv : null,
    };
  });
}

// ───────────────────────────────────────────────────────────────────
// 3. Historical rank overview  →  12-month traffic + keyword trend
// ───────────────────────────────────────────────────────────────────

async function getTrafficTrend(target) {
  return memo(`trend:${target}`, async () => {
    const raw = await dfsCall(
      "/dataforseo_labs/google/historical_rank_overview/live",
      [{ target, location_code: LOCATION_CODE, language_code: LANGUAGE_CODE }],
    );
    if (!raw || !raw.items || !raw.items.length) return null;
    const points = raw.items
      .filter(
        (i) =>
          typeof i.year === "number" &&
          typeof i.month === "number" &&
          i.metrics && i.metrics.organic,
      )
      .map((i) => ({
        month: `${i.year}-${String(i.month).padStart(2, "0")}`,
        organicTraffic: Math.round((i.metrics && i.metrics.organic && i.metrics.organic.etv) ?? 0),
        organicKeywords: (i.metrics && i.metrics.organic && i.metrics.organic.count) ?? 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-TRAFFIC_TREND_MONTHS);
    return points.length > 0 ? points : null;
  });
}

// ───────────────────────────────────────────────────────────────────
// 4. Ranked keywords  →  top 100 by search volume (for gap analysis)
// ───────────────────────────────────────────────────────────────────

async function getTopKeywords(target) {
  return memo(`keywords:${target}`, async () => {
    const raw = await dfsCall(
      "/dataforseo_labs/google/ranked_keywords/live",
      [
        {
          target,
          location_code: LOCATION_CODE,
          language_code: LANGUAGE_CODE,
          limit: TOP_KEYWORDS_LIMIT,
          order_by: ["keyword_data.keyword_info.search_volume,desc"],
        },
      ],
    );
    if (!raw || !raw.items || !raw.items.length) return null;
    const keywords = raw.items
      .map((i) => {
        const k = i.keyword_data && i.keyword_data.keyword;
        const pos = i.ranked_serp_element && i.ranked_serp_element.serp_item && i.ranked_serp_element.serp_item.rank_group;
        const vol = i.keyword_data && i.keyword_data.keyword_info && i.keyword_data.keyword_info.search_volume;
        const etv = i.ranked_serp_element && i.ranked_serp_element.serp_item && i.ranked_serp_element.serp_item.etv;
        if (!k || typeof pos !== "number" || typeof vol !== "number") return null;
        return {
          keyword: k,
          position: pos,
          searchVolume: vol,
          trafficEstimate: typeof etv === "number" ? etv : 0,
        };
      })
      .filter((k) => k !== null);
    return keywords.length > 0 ? keywords : null;
  });
}

module.exports = {
  getBacklinkSummary,
  getDomainOverview,
  getTrafficTrend,
  getTopKeywords,
};
