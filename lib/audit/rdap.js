'use strict';

/**
 * RDAP (Registration Data Access Protocol) lookup for domain age.
 * RDAP is the modern HTTPS replacement for WHOIS -- works from serverless
 * runtimes (port 80/443, no raw sockets) and requires no API key.
 *
 * Endpoint: https://rdap.org/domain/{domain} -> JSON document with an
 * `events` array. We pull out the `registration` event.
 */

async function fetchDomainAge(domain) {
  // Strip any leading www. -- RDAP wants the registered name.
  const cleanDomain = domain.replace(/^www\./, "");
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(cleanDomain)}`, {
      headers: { Accept: "application/rdap+json" },
      cache: "no-store",
    });
    if (!res.ok) return { registrationDate: null, ageYears: null };

    const data = await res.json();
    const event = data.events && data.events.find((e) => e.eventAction === "registration");
    if (!event || !event.eventDate) return { registrationDate: null, ageYears: null };

    const regDate = new Date(event.eventDate);
    if (isNaN(regDate.getTime())) return { registrationDate: null, ageYears: null };

    const ageMs = Date.now() - regDate.getTime();
    const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
    return {
      registrationDate: regDate.toISOString().slice(0, 10),
      ageYears,
    };
  } catch (err) {
    console.warn(`[rdap] lookup failed for ${cleanDomain}:`, err instanceof Error ? err.message : err);
    return { registrationDate: null, ageYears: null };
  }
}

module.exports = { fetchDomainAge };
