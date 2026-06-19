'use strict';

/**
 * Google Places API (New) -- the modern endpoints introduced in 2024.
 *
 * Used as the authoritative source for local presence (rating, review count,
 * address, phone, hours, claim status proxy) when GOOGLE_PLACES_API_KEY is
 * configured; falls back to Tavily + Claude extraction otherwise.
 *
 * Differences from the legacy API:
 * - POST /v1/places:searchText instead of GET /place/textsearch/json
 * - GET  /v1/places/{id}           instead of GET /place/details/json
 * - Auth header X-Goog-Api-Key (not in query string)
 * - Mandatory field mask via X-Goog-FieldMask (controls cost + response size)
 * - Field names changed (camelCase, e.g. userRatingCount, websiteUri)
 */

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

const SEARCH_FIELD_MASK = "places.id,places.displayName,places.websiteUri,places.formattedAddress";
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "rating",
  "userRatingCount",
  "websiteUri",
  "businessStatus",
  "regularOpeningHours",
].join(",");

function normalizeForCompare(s) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function findBusinessOnPlaces(opts) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const normDomain = normalizeForCompare(opts.domain);
  const normName = normalizeForCompare(opts.businessName.split(/[\s,]+/)[0]);

  // Step 1 -- Try multiple text-search queries, prioritizing the cleanest. The
  // first query that produces a result whose website matches our target domain
  // is the winner; otherwise we accumulate all candidates and disambiguate
  // across the union.
  const queries = Array.from(
    new Set([
      opts.businessName,
      `${opts.businessName} ${opts.domain}`,
    ]),
  );

  let allCandidates = [];
  let websiteMatched = null;

  for (const query of queries) {
    const searchRes = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query }),
      cache: "no-store",
    });
    if (!searchRes.ok) {
      const text = await searchRes.text();
      console.warn(`[places] query "${query}" failed (${searchRes.status}): ${text.slice(0, 120)}`);
      continue;
    }
    const data = await searchRes.json();
    const candidates = data.places ?? [];

    console.log(
      `[places] query="${query}" → ${candidates.length} results: ${candidates
        .slice(0, 5)
        .map((c) => `${c.displayName?.text ?? "?"} (${c.websiteUri ?? "no-website"})`)
        .join(" | ")}`,
    );

    allCandidates.push(...candidates);
    websiteMatched = candidates.find((c) =>
      c.websiteUri && normalizeForCompare(c.websiteUri).includes(normDomain),
    ) ?? null;
    if (websiteMatched) break; // First domain-matched candidate wins.
  }

  if (allCandidates.length === 0) return null;

  // Step 2 -- Disambiguate. Strongly prefer website-domain match; fall back
  // through name-based matches of decreasing strictness. If nothing matches
  // confidently, return null rather than pick a wrong listing.
  let chosen = websiteMatched;
  if (!chosen) {
    // 2a -- Exact normalized name match against the first word of the input.
    chosen = allCandidates.find(
      (c) => c.displayName?.text && normalizeForCompare(c.displayName.text) === normName,
    ) ?? null;
  }
  if (!chosen) {
    // 2b -- Prefix match against the first word of the input.
    chosen = allCandidates.find(
      (c) => c.displayName?.text && normalizeForCompare(c.displayName.text).startsWith(normName),
    ) ?? null;
  }
  if (!chosen) {
    // 2c -- Contains match using the FULL normalized business name. Catches
    // variants like "Custom Homes by MGD Builders" where the input
    // "MGD Builders" appears inside a longer candidate name. We only enable
    // this when the full name is at least 6 chars so we don't false-match on
    // generic single words.
    const fullNormName = normalizeForCompare(opts.businessName);
    if (fullNormName.length >= 6) {
      chosen = allCandidates.find(
        (c) =>
          c.displayName?.text &&
          normalizeForCompare(c.displayName.text).includes(fullNormName),
      ) ?? null;
    }
  }
  if (!chosen) {
    console.warn(`[places] no confident match for "${opts.businessName}" / domain "${opts.domain}"`);
    return null;
  }
  const top = { candidate: chosen };

  // Step 3 -- Fetch full details for the chosen candidate.
  console.log(
    `[places] chose place_id=${top.candidate.id} name="${top.candidate.displayName?.text}" website=${top.candidate.websiteUri ?? "—"}`,
  );
  const detailsRes = await fetch(`${DETAILS_URL}/${encodeURIComponent(top.candidate.id)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
    cache: "no-store",
  });
  if (!detailsRes.ok) {
    const text = await detailsRes.text();
    throw new Error(`Places details failed (${detailsRes.status}): ${text.slice(0, 200)}`);
  }
  const details = await detailsRes.json();

  const hasOpeningHours = Boolean(details.regularOpeningHours?.weekdayDescriptions?.length);
  const phone = details.nationalPhoneNumber ?? details.internationalPhoneNumber ?? null;
  const hasPhone = Boolean(phone);
  const hasAddress = Boolean(details.formattedAddress);
  const hasReviews = (details.userRatingCount ?? 0) > 0;
  const isLikelyClaimed = hasPhone && hasAddress && hasOpeningHours;
  const isComplete = isLikelyClaimed && hasReviews;

  return {
    placeId: details.id,
    name: details.displayName?.text ?? top.candidate.displayName?.text ?? opts.businessName,
    rating: details.rating ?? null,
    reviewCount: details.userRatingCount ?? null,
    phone,
    address: details.formattedAddress ?? null,
    hasOpeningHours,
    isOperational: details.businessStatus === "OPERATIONAL",
    websiteUrl: details.websiteUri ?? null,
    isLikelyClaimed,
    isComplete,
  };
}

module.exports = { findBusinessOnPlaces };
