'use strict';

const FirecrawlApp = require('@mendable/firecrawl-js').default || require('@mendable/firecrawl-js');

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');
  _client = new FirecrawlApp({ apiKey });
  return _client;
}

async function scrapePage(url) {
  const client = getClient();
  const result = await client.scrape(url, {
    formats: ['markdown', 'html', 'rawHtml', 'links'],
    onlyMainContent: false,
    waitFor: 4000,
  });

  const doc =
    (result && typeof result === 'object' && 'data' in result
      ? result.data
      : result) || {};

  const metadata = doc.metadata || {};

  const rawHtml = doc.rawHtml || doc.html || '';
  return {
    url,
    title: metadata.title || null,
    description: metadata.description || metadata.ogDescription || null,
    html: doc.html || '',
    rawHtml,
    markdown: doc.markdown || '',
    links: doc.links || [],
    status: metadata.statusCode || null,
    metadata,
  };
}

function extractPhoneFromSite(scrape) {
  const text = scrape.markdown;
  const telMatch = scrape.html.match(/tel:([+0-9().\-\s]{7,})/i);
  if (telMatch) {
    const cleaned = telMatch[1].replace(/[^\d+]/g, '');
    if (cleaned.length >= 10) return formatPhone(cleaned);
  }
  const naMatch = text.match(/(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/);
  if (naMatch) return `${naMatch[1]}.${naMatch[2]}.${naMatch[3]}`;
  return null;
}

function formatPhone(digits) {
  const d = digits.replace(/^\+?1/, '');
  if (d.length === 10) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return digits;
}

function extractEmailFromSite(scrape) {
  const mailtoMatch = scrape.html.match(/mailto:([^"'\s?&]+@[^"'\s?&]+)/i);
  if (mailtoMatch) return mailtoMatch[1].trim();
  const matches = scrape.markdown.match(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g) || [];
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (lower.includes('@example') || lower.includes('@sentry.io') || lower.includes('@wixpress')) continue;
    return m;
  }
  return null;
}

function stripLocationSuffix(name) {
  return name
    .replace(/[,–-]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*,\s*[A-Z]{2})?\s*$/, '')
    .trim();
}

function deriveBusinessName(scrape) {
  const meta = scrape.metadata;
  const ogSite = meta.ogSiteName || meta['og:site_name'];
  const appName = meta.applicationName || meta['application-name'];

  for (const raw of [ogSite, appName]) {
    if (raw && raw.trim().length > 0) {
      const cleaned = pickBrandSegment(raw.trim());
      if (cleaned) return stripLocationSuffix(cleaned);
    }
  }

  if (!scrape.title) return null;
  const cleaned = pickBrandSegment(scrape.title);
  return cleaned ? stripLocationSuffix(cleaned) : null;
}

function pickBrandSegment(text) {
  const trimmed = text.trim();
  const separators = [/ : /, / \| /, / – /, / — /, / - /];
  const hasSeparator = separators.some((s) => s.test(trimmed));

  if (!hasSeparator) {
    return trimmed.length > 0 && trimmed.length <= 80 ? trimmed : null;
  }

  for (const sep of separators) {
    const parts = trimmed.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts
        .filter((p) => p.length >= 3 && p.length <= 60)
        .sort((a, b) => a.length - b.length)[0];
      if (candidate) return candidate;
    }
  }
  return trimmed.length <= 60 ? trimmed : null;
}

function deriveContent(scrape, additionalPagesScraped) {
  additionalPagesScraped = additionalPagesScraped || 0;
  const text = scrape.markdown.replace(/[#*_`>\-+]/g, ' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const lines = scrape.markdown.split('\n');
  const headings = { h1: 0, h2: 0, h3: 0, h4: 0 };
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+\S/);
    if (!m) continue;
    const level = m[1].length;
    if (level === 1) headings.h1++;
    else if (level === 2) headings.h2++;
    else if (level === 3) headings.h3++;
    else if (level === 4) headings.h4++;
  }

  const headingsWellDefined =
    headings.h1 === 1 && headings.h2 >= 1 && headings.h2 + headings.h3 + headings.h4 >= 2;

  const imgTags = scrape.html.match(/<img\b[^>]*>/gi) || [];
  const altTextIssues = imgTags.filter((tag) => !/\salt\s*=\s*"[^"]+"/i.test(tag)).length;

  const title = scrape.title;
  const description = scrape.description;
  const titleTagOk = !!title && title.length >= 20 && title.length <= 65;
  const metaDescriptionOk = !!description && description.length >= 60 && description.length <= 165;

  return {
    wordCount,
    pageCount: 1 + additionalPagesScraped,
    pagesWithLowContent: wordCount < 300 ? 1 : 0,
    headings,
    headingsWellDefined,
    altTextIssues,
    titleTagOk,
    metaDescriptionOk,
    title: title || null,
    description: description || null,
  };
}

function deriveTechnical(scrape) {
  const html = scrape.rawHtml || scrape.html;
  const lcHtml = html.toLowerCase();

  // CMS detection
  let cms = null;
  if (/wp-content|wp-includes|wp-json|wordpress/.test(lcHtml)) cms = 'WordPress';
  else if (/cdn-cgi\/scripts\/.*?webflow/.test(lcHtml) || /webflow\.com\/static/.test(lcHtml)) cms = 'Webflow';
  else if (/squarespace\.com|squarespace-cdn|static\.squarespace/.test(lcHtml)) cms = 'Squarespace';
  else if (/shopify|cdn\.shopify\.com/.test(lcHtml)) cms = 'Shopify';
  else if (/wix\.com|wixsite\.com|wix-code/.test(lcHtml)) cms = 'Wix';
  else if (/joomla/.test(lcHtml)) cms = 'Joomla';
  else if (/drupal-settings-json|drupal\.js/.test(lcHtml)) cms = 'Drupal';
  else if (/godaddy|secureserver\.net/.test(lcHtml)) cms = 'GoDaddy Website Builder';
  else if (/_next\/static|__next/.test(lcHtml)) cms = 'Next.js';
  else if (/_nuxt\/|__nuxt/.test(lcHtml)) cms = 'Nuxt';
  else if (/<meta[^>]+name="generator"[^>]+content="([^"]+)"/i.test(html)) {
    const m = html.match(/<meta[^>]+name="generator"[^>]+content="([^"]+)"/i);
    if (m && m[1]) cms = m[1];
  }

  // Analytics detection
  const analyticsDetected = [];
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/.test(html)) {
    analyticsDetected.push('Google Tag Manager');
  }
  if (
    /google-analytics\.com\/(g\/collect|analytics\.js|ga\.js)/.test(lcHtml) ||
    /googletagmanager\.com\/gtag\/js/.test(lcHtml) ||
    /\bgtag\(['"]config['"]\s*,\s*['"](G|UA)-[A-Z0-9-]+/i.test(html) ||
    /\bG-[A-Z0-9]{6,}\b/.test(html) ||
    /\bUA-\d{4,}/.test(html)
  ) {
    analyticsDetected.push('Google Analytics');
  }
  if (/static\.hotjar\.com|hj\(['"]event/.test(lcHtml)) analyticsDetected.push('Hotjar');
  if (/segment\.com\/analytics|cdn\.segment\.com/.test(lcHtml)) analyticsDetected.push('Segment');
  if (/connect\.facebook\.net|fbq\(['"]init/.test(lcHtml)) analyticsDetected.push('Meta Pixel');
  if (/plausible\.io\/js/.test(lcHtml)) analyticsDetected.push('Plausible');
  if (/cdn\.usefathom\.com/.test(lcHtml)) analyticsDetected.push('Fathom');
  if (/cdn\.heapanalytics\.com/.test(lcHtml)) analyticsDetected.push('Heap');
  if (/cdn\.amplitude\.com/.test(lcHtml)) analyticsDetected.push('Amplitude');
  if (/cdn\.mixpanel\.com/.test(lcHtml)) analyticsDetected.push('Mixpanel');
  if (/js\.hs-scripts\.com|js\.hsforms\.net|js\.hsadspixel\.net|js\.hs-analytics\.net|_hsq\.push/.test(html)) {
    analyticsDetected.push('HubSpot');
  }
  if (/snap\.licdn\.com\/li\.lms-analytics/.test(lcHtml) || /_linkedin_partner_id/.test(html)) {
    analyticsDetected.push('LinkedIn Insight');
  }
  if (/bat\.bing\.com\/bat\.js|UET-[a-z0-9]+/i.test(html)) {
    analyticsDetected.push('Bing UET');
  }
  const hasConsentManager =
    /onetrust|cookielaw\.org|cookieyes|cookiebot|usercentrics|trustarc/i.test(html);
  if (hasConsentManager && !analyticsDetected.includes('Google Analytics')) {
    analyticsDetected.push('Analytics (consent-gated)');
  }

  // Ecommerce platform detection
  let ecommerce = null;
  if (/shopify\.com|cdn\.shopify\.com/i.test(lcHtml)) ecommerce = 'Shopify';
  else if (/woocommerce|wc-ajax|wc_add_to_cart_params/i.test(lcHtml)) ecommerce = 'WooCommerce';
  else if (/bigcommerce/i.test(lcHtml)) ecommerce = 'BigCommerce';
  else if (/magento|mage\/cookies|x-magento/i.test(lcHtml)) ecommerce = 'Magento';
  else if (/squarespace.*commerce|sqs-commerce/i.test(lcHtml)) ecommerce = 'Squarespace Commerce';
  else if (/cdn\.snipcart\.com/i.test(lcHtml)) ecommerce = 'Snipcart';
  else if (/<form[^>]+action=["'][^"']*(?:cart|checkout)/i.test(html)) ecommerce = 'Custom cart';

  // Payment processor detection
  const paymentProcessors = [];
  if (/js\.stripe\.com|stripe-js|m\.stripe\.network/i.test(html)) paymentProcessors.push('Stripe');
  if (/paypal\.com\/sdk|paypalobjects\.com/i.test(html)) paymentProcessors.push('PayPal');
  if (/squarecdn\.com|connect\.squareup\.com/i.test(html)) paymentProcessors.push('Square');
  if (/klarna\.com\/sdk|klarnacdn/i.test(html)) paymentProcessors.push('Klarna');
  if (/cdn\.affirm\.com/i.test(html)) paymentProcessors.push('Affirm');
  if (/cdn\.shopifycdn\.com\/.*shop_pay/i.test(html)) paymentProcessors.push('Shop Pay');
  if (/braintree-api\.com|braintreepayments\.com/i.test(html)) paymentProcessors.push('Braintree');

  // Paid search detection
  const paidSearchDetected =
    /googleadservices\.com\/pagead\/conversion|google-analytics\.com\/r\/collect|googleads-conversion|aw-\d{6,}/i.test(html);

  // Retargeting platform detection
  const retargetingDetected = [];
  if (/connect\.facebook\.net.*fbevents|fbq\(['"]init/i.test(html)) retargetingDetected.push('Meta Pixel');
  if (/snap\.licdn\.com\/li\.lms-analytics|_linkedin_partner_id/i.test(html)) retargetingDetected.push('LinkedIn Insight');
  if (/bat\.bing\.com\/bat\.js|UET-[a-z0-9]+/i.test(html)) retargetingDetected.push('Bing UET');
  if (/static\.ads-twitter\.com|twq\(['"]init/i.test(html)) retargetingDetected.push('X (Twitter) Pixel');
  if (/analytics\.tiktok\.com|ttq\.load/i.test(html)) retargetingDetected.push('TikTok Pixel');
  if (/googletagmanager\.com\/gtag.*remarketing|googleadservices\.com\/pagead\/conversion/i.test(html)) retargetingDetected.push('Google Ads Remarketing');

  // Live chat detection
  const hasLiveChat =
    /intercom\.io|intercomcdn\.com|drift\.com|tawk\.to|crisp\.chat|hubspot\.com\/chat|js\.usemessages\.com|zendesk|tidio|livechat|widget\.kustomerapp/i.test(lcHtml);

  // Search detection
  const hasSearch =
    /<input[^>]*type=["']search["']/i.test(html) ||
    /<form[^>]*role=["']search["']/i.test(html) ||
    /href=["'][^"']*\/search(?:[/?"']|$)/i.test(html) ||
    /aria-label=["'][^"']*search/i.test(html) ||
    /class=["'][^"']*(?:search-(?:toggle|button|trigger|icon)|site-search|nav-search)/i.test(html);

  // Contact details
  const hasPhone = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(scrape.markdown);
  const hasEmail = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(scrape.markdown);

  const sslEnabled = scrape.url.startsWith('https://');

  const og = deriveOpenGraph(scrape);

  return {
    sslEnabled,
    sslIssues: false,
    sitemapValid: false,
    robotsTxtFound: false,
    botBlocking: false,
    cms,
    analyticsDetected,
    brokenLinks: 0,
    hasLiveChat,
    hasSearch,
    contactDetailsPresent: hasPhone || hasEmail,
    openGraph: og,
    ecommerce,
    paymentProcessors,
    paidSearchDetected,
    retargetingDetected,
  };
}

async function countSitemapUrls(sitemapUrl) {
  try {
    const res = await fetch(sitemapUrl, {
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/xml,application/xml,*/*',
      },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const urlMatches = xml.match(/<url\s|<url>/g) || [];
    if (urlMatches.length > 0) return urlMatches.length;
    const sitemapMatches = xml.match(/<sitemap\s|<sitemap>/g) || [];
    return sitemapMatches.length > 0 ? sitemapMatches.length : null;
  } catch {
    return null;
  }
}

function deriveOpenGraph(scrape) {
  const meta = scrape.metadata;
  const get = (k) => meta[k] || meta[`og:${k}`];

  const ogTitle = meta.ogTitle || get('title');
  const ogDescription = meta.ogDescription || get('description');
  const ogImage = meta.ogImage || get('image');
  const ogType = meta.ogType || get('type');

  const html = scrape.html;
  const hasMeta = (prop) =>
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["'][^"']+["']`, 'i').test(html);

  return {
    hasTitle: Boolean(ogTitle) || hasMeta('title'),
    hasDescription: Boolean(ogDescription) || hasMeta('description'),
    hasImage: Boolean(ogImage) || hasMeta('image'),
    hasType: Boolean(ogType) || hasMeta('type'),
  };
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/xml,application/xml,application/xhtml+xml,text/html,*/*;q=0.8',
};

async function checkRobotsAndSitemap(url) {
  const parsed = new URL(url);
  const origins = new Set([parsed.origin]);
  const wwwAlt = parsed.hostname.startsWith('www.')
    ? `${parsed.protocol}//${parsed.hostname.replace(/^www\./, '')}`
    : `${parsed.protocol}//www.${parsed.hostname}`;
  origins.add(wwwAlt);

  try {
    const probe = await fetch(url, { redirect: 'follow', cache: 'no-store', headers: FETCH_HEADERS });
    if (probe.url) {
      const finalOrigin = new URL(probe.url).origin;
      if (!origins.has(finalOrigin)) origins.add(finalOrigin);
    }
  } catch (err) {
    console.warn('[redirect] homepage probe failed:', err instanceof Error ? err.message : err);
  }

  let robotsTxtFound = false;
  let robotsBody = '';
  for (const o of origins) {
    try {
      const res = await fetch(`${o}/robots.txt`, { redirect: 'follow', cache: 'no-store', headers: FETCH_HEADERS });
      if (res.ok) {
        robotsTxtFound = true;
        robotsBody = await res.text();
        break;
      }
    } catch { /* try next origin */ }
  }

  const sitemapHints = [];
  for (const line of robotsBody.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
    if (m && m[1]) sitemapHints.push(m[1].trim());
  }

  const paths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/sitemaps.xml'];
  const candidates = [
    ...sitemapHints,
    ...Array.from(origins).flatMap((o) => paths.map((p) => `${o}${p}`)),
  ];

  let sitemapValid = false;
  let sitemapUrl = null;
  for (const candidate of Array.from(new Set(candidates))) {
    try {
      const res = await fetch(candidate, { redirect: 'follow', cache: 'no-store', headers: FETCH_HEADERS });
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) continue;

      if (contentType.includes('xml')) {
        sitemapValid = true;
        sitemapUrl = res.url || candidate;
        break;
      }

      const text = (await res.text()).slice(0, 2000).toLowerCase();
      if (text.includes('<urlset') || text.includes('<sitemapindex') || text.includes('<?xml')) {
        sitemapValid = true;
        sitemapUrl = res.url || candidate;
        break;
      }
    } catch { /* try next candidate */ }
  }

  return { robotsTxtFound, sitemapValid, sitemapUrl, robotsTxtBody: robotsBody };
}

module.exports = {
  scrapePage,
  extractPhoneFromSite,
  extractEmailFromSite,
  stripLocationSuffix,
  deriveBusinessName,
  deriveContent,
  deriveTechnical,
  countSitemapUrls,
  deriveOpenGraph,
  checkRobotsAndSitemap,
};
