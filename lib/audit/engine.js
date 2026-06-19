'use strict';

const { scrapePage, deriveContent, deriveTechnical, checkRobotsAndSitemap, deriveBusinessName, extractPhoneFromSite, extractEmailFromSite, countSitemapUrls } = require('./firecrawl');
const { runPageSpeed } = require('./pagespeed');
const { fetchLocalPresence } = require('./local-presence');
const { fetchDomainAge } = require('./rdap');
const { calculateReadability } = require('./readability');
const { analyzeGeo } = require('./geo');
const { getBacklinkSummary, getDomainOverview, getTrafficTrend, getTopKeywords } = require('./dataforseo');

const crypto = require('crypto');

// In-memory audit storage (transient — reports are saved to Library after generation)
const audits = new Map();

function generateReportId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function startAudit(url, meta) {
  const reportId = generateReportId();
  const record = {
    reportId,
    url,
    domain: hostnameOf(url),
    clientName: (meta && meta.clientName) || null,
    industry: (meta && meta.industry) || null,
    contact: (meta && meta.contact) || null,
    status: 'running',
    progress: 'Starting audit...',
    startedAt: Date.now(),
    unavailable: [],
  };
  audits.set(reportId, record);
  return reportId;
}

function getAudit(reportId) {
  return audits.get(reportId) || null;
}

function updateAudit(reportId, updates) {
  const record = audits.get(reportId);
  if (!record) return;
  Object.assign(record, updates);
  audits.set(reportId, record);
}

async function runAudit(reportId) {
  const record = audits.get(reportId);
  if (!record) return;

  const unavailable = new Set();

  // Firecrawl is foundational — if it fails, the audit fails
  let scrape;
  try {
    updateAudit(reportId, { progress: 'Scanning website with Firecrawl...' });
    scrape = await scrapePage(record.url);
  } catch (err) {
    updateAudit(reportId, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      completedAt: Date.now(),
    });
    return;
  }

  record.content = deriveContent(scrape);
  record.businessName = deriveBusinessName(scrape) || record.clientName || undefined;
  const techPartial = deriveTechnical(scrape);

  // Extract phone/email from the scraped page
  const scrapedPhone = extractPhoneFromSite(scrape);
  const scrapedEmail = extractEmailFromSite(scrape);

  updateAudit(reportId, { progress: 'Running API checks in parallel...' });

  // Run independent data sources in parallel
  const [
    robotsRes,
    perfRes,
    localRes,
    domainAgeRes,
    backlinkRes,
    overviewRes,
    trendRes,
    keywordsRes,
    readabilityRes,
  ] = await Promise.allSettled([
    checkRobotsAndSitemap(record.url),
    runPageSpeed(record.url),
    fetchLocalPresence({
      url: record.url,
      domain: record.domain,
      businessName: record.businessName || undefined,
    }),
    fetchDomainAge(record.domain),
    getBacklinkSummary(record.domain),
    getDomainOverview(record.domain),
    getTrafficTrend(record.domain),
    getTopKeywords(record.domain),
    Promise.resolve(calculateReadability(scrape.markdown)),
  ]);

  // Robots & sitemap
  const robotsTxtFound = robotsRes.status === 'fulfilled' ? robotsRes.value.robotsTxtFound : false;
  const sitemapValid = robotsRes.status === 'fulfilled' ? robotsRes.value.sitemapValid : false;
  const sitemapUrl = robotsRes.status === 'fulfilled' ? robotsRes.value.sitemapUrl : null;
  const robotsTxtBody = robotsRes.status === 'fulfilled' ? robotsRes.value.robotsTxtBody : '';
  if (robotsRes.status !== 'fulfilled') unavailable.add('robots-and-sitemap');

  // Sitemap page count
  let pageCount = null;
  if (sitemapUrl) {
    try { pageCount = await countSitemapUrls(sitemapUrl); } catch { /* best effort */ }
  }

  record.technical = {
    sslEnabled: techPartial.sslEnabled || record.url.startsWith('https://'),
    sslIssues: techPartial.sslIssues || false,
    sitemapValid,
    sitemapUrl,
    pageCount,
    robotsTxtFound,
    botBlocking: techPartial.botBlocking || false,
    cms: techPartial.cms || null,
    analyticsDetected: techPartial.analyticsDetected || [],
    brokenLinks: techPartial.brokenLinks || 0,
    hasLiveChat: techPartial.hasLiveChat || false,
    hasSearch: techPartial.hasSearch || false,
    contactDetailsPresent: techPartial.contactDetailsPresent || false,
    openGraph: techPartial.openGraph,
    ecommerce: techPartial.ecommerce || null,
    paymentProcessors: techPartial.paymentProcessors || [],
    paidSearchDetected: techPartial.paidSearchDetected || false,
    retargetingDetected: techPartial.retargetingDetected || [],
  };

  // Performance
  if (perfRes.status === 'fulfilled') {
    record.performance = perfRes.value;
  } else {
    unavailable.add('performance');
    console.warn('[audit] PageSpeed failed:', perfRes.reason);
  }

  // Local presence
  if (localRes.status === 'fulfilled') {
    record.local = localRes.value;
    // Enrich contact details with scraped phone/email if local-presence didn't find them
    if (record.local.contact_details) {
      if (!record.local.contact_details.phone_discovered && scrapedPhone) {
        record.local.contact_details.phone_discovered = scrapedPhone;
      }
      if (!record.local.contact_details.email_discovered && scrapedEmail) {
        record.local.contact_details.email_discovered = scrapedEmail;
      }
    }
  } else {
    unavailable.add('local-presence');
    console.warn('[audit] Local presence failed:', localRes.reason);
    // Still provide scraped contact details
    record.local = {
      google_business_profile: { is_complete: false, rating: null, review_count: null, has_opening_hours: false, is_claimed: false },
      directory_consistency: { facebook_found: false, google_maps_found: false, bing_maps_found: false, is_address_consistent: false },
      contact_details: { phone_discovered: scrapedPhone, email_discovered: scrapedEmail },
    };
  }

  // SEO data (DataForSEO + RDAP)
  const backlinks = backlinkRes.status === 'fulfilled' ? backlinkRes.value : null;
  const overview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
  const trend = trendRes.status === 'fulfilled' ? trendRes.value : null;
  const topKeywords = keywordsRes.status === 'fulfilled' ? keywordsRes.value : null;
  const domainAge = domainAgeRes.status === 'fulfilled' ? (domainAgeRes.value.registrationDate || null) : null;

  const organicTrafficMonthly = topKeywords
    ? Math.round(topKeywords.reduce((sum, k) => sum + (k.trafficEstimate || 0), 0))
    : null;

  record.seo = {
    backlinks: backlinks ? backlinks.backlinks : null,
    referringDomains: backlinks ? backlinks.referringDomains : null,
    domainAuthority: backlinks ? backlinks.domainAuthority : null,
    organicKeywordsCount: overview ? overview.organicKeywordsCount : null,
    organicTrafficMonthly,
    estimatedTrafficValue: overview ? overview.estimatedTrafficValue : null,
    trafficTrend: trend,
    topKeywords,
    domainAge,
  };

  if (backlinkRes.status !== 'fulfilled' || !backlinks) unavailable.add('seo-backlinks');
  if (overviewRes.status !== 'fulfilled' || !overview) unavailable.add('seo-overview');
  if (trendRes.status !== 'fulfilled') unavailable.add('seo-trend');
  if (keywordsRes.status !== 'fulfilled') unavailable.add('seo-keywords');

  // Readability
  if (readabilityRes.status === 'fulfilled') {
    record.reading = readabilityRes.value;
  } else {
    record.reading = { age: null, easeScore: null, grammarErrors: null };
  }

  // GEO/AI readiness (pure local analysis using scraped data + robots.txt)
  updateAudit(reportId, { progress: 'Analyzing AI & GEO readiness...' });
  try {
    record.geo = analyzeGeo(scrape, robotsTxtBody);
  } catch (err) {
    console.warn('[audit] GEO analysis failed:', err);
    record.geo = null;
  }

  // Compute overall score
  record.overallScore = computeOverallScore(record);
  record.unavailable = Array.from(unavailable);
  record.status = 'complete';
  record.completedAt = Date.now();
  record.progress = 'Audit complete.';

  audits.set(reportId, record);
}

function computeOverallScore(record) {
  let total = 0;
  let maxPoints = 0;

  // Performance (30 pts)
  if (record.performance) {
    total += (record.performance.score / 100) * 30;
    maxPoints += 30;
  }

  // Content (25 pts)
  if (record.content) {
    let contentScore = 0;
    if (record.content.titleTagOk) contentScore += 5;
    if (record.content.metaDescriptionOk) contentScore += 5;
    if (record.content.headingsWellDefined) contentScore += 5;
    if (record.content.altTextIssues === 0) contentScore += 5;
    if (record.content.wordCount >= 600) contentScore += 5;
    total += contentScore;
    maxPoints += 25;
  }

  // Technical (20 pts)
  if (record.technical) {
    let techScore = 0;
    if (record.technical.sslEnabled) techScore += 5;
    if (record.technical.sitemapValid) techScore += 5;
    if (record.technical.robotsTxtFound) techScore += 5;
    if (record.technical.analyticsDetected.length > 0) techScore += 5;
    total += techScore;
    maxPoints += 20;
  }

  // Local (25 pts)
  if (record.local && record.local.google_business_profile) {
    let localScore = 0;
    const gbp = record.local.google_business_profile;
    if (gbp.is_complete || gbp.is_claimed) localScore += 7;
    if (gbp.rating && gbp.rating >= 4.0) localScore += 6;
    if (gbp.review_count && gbp.review_count >= 20) localScore += 6;
    if (record.local.contact_details && record.local.contact_details.phone_discovered) localScore += 6;
    total += localScore;
    maxPoints += 25;
  }

  if (maxPoints === 0) return 50;
  return Math.round((total / maxPoints) * 100);
}

module.exports = {
  startAudit,
  runAudit,
  getAudit,
  updateAudit,
};
