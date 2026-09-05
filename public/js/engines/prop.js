import { callWithWebSearch, getApiHeaders } from '../core/api.js';
import { API_MODEL } from '../core/state.js';
import { PROP_RESEARCH_SYSTEM } from '../data/prompts.js';
import { VERTICALS, VERTICAL_PORTFOLIO_DEFAULTS, GENERIC_P1, GENERIC_P2, GENERIC_P3 } from '../data/verticals.js';
import { PROPOSAL_TEMPLATE, FEATURE_ICONS } from '../data/proposal-template.js';
import { RGS_CASE_STUDIES } from '../data/case-studies.js';
import { dbg } from '../core/debug.js';
import { fmt, fetchImageAsDataURI, inlineImages, writeToFrame } from '../core/utils.js';
import { saveReport, listReports, getReport, initSearchableClientDropdown } from '../core/reports.js';

const TYPE_LABELS = {
  cca: { label: 'Strategy Plan' },
  cap: { label: 'Action Plan' },
  prop: { label: 'Proposal' },
  wsr: { label: 'Website Report' },
};

// Verify an image URL actually loads — works cross-origin (no CORS needed for a render test)
function imageExists(url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(false); }, 8000);
    img.onload = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

// Fetch an image through the server proxy as a data URI (avoids CORS taint for pixel analysis)
async function fetchLogoDataUri(url) {
  try {
    const res = await fetch('/api/fetch-image', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.dataUri || null;
  } catch (e) { return null; }
}

// Store a logo on our server and get back a small hosted URL — keeps proposals free
// of multi-hundred-KB base64 blobs. Returns an absolute URL, or null on failure.
async function uploadLogoToServer(dataUri) {
  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ dataUri }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ? new URL(data.url, window.location.origin).href : null;
  } catch (e) { return null; }
}

// Fraction of the logo's visible (non-transparent) pixels that are near-white.
// Used to decide whether the logo needs a dark backdrop on the white proposal page.
function analyzeLogoWhiteness(dataUri) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.min(img.naturalWidth || 300, 300);
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * (w / Math.max(1, img.naturalWidth || 1))));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        let opaque = 0, white = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 32) continue; // skip transparent pixels
          opaque++;
          if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) white++;
        }
        resolve(opaque ? white / opaque : 0);
      } catch (e) { resolve(0); }
    };
    img.onerror = () => resolve(0);
    img.src = dataUri;
  });
}

// Set by propGenerate before each build: { src, dark } for the client logo
let propLogoInfo = null;

// Logo backdrop mode: 'auto' (white-pixel detection), 'light' (never), 'dark' (always)
let propLogoBg = 'auto';
window.selectLogoBg = function(mode) {
  propLogoBg = mode;
  ['auto', 'light', 'dark'].forEach(m => {
    const btn = document.getElementById('logo-bg-' + m);
    if (btn) btn.classList.toggle('selected', m === mode);
  });
};

// Case studies for the current build: the server-managed list (Settings → RGS Case
// Studies) when one exists, otherwise the bundled defaults from case-studies.js.
let activeCaseStudies = RGS_CASE_STUDIES;
// Server-managed portfolio graphics (Settings -> Portfolios). Entries are
// {img, industry}; the industry label maps loosely onto vertical keys.
let activePortfolios = null;
async function loadActivePortfolios() {
  try {
    const res = await fetch('/api/portfolios', { headers: getApiHeaders() });
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d.portfolios) && d.portfolios.length) return d.portfolios;
    }
  } catch (e) { /* fall through to bundled defaults */ }
  return null;
}
function portfolioVerticalKey(label) {
  const s = (label || '').toLowerCase();
  const map = [['roof', 'roofers'], ['hvac', 'hvac'], ['heat', 'hvac'], ['plumb', 'plumbers'],
    ['electr', 'electrical'], ['landscap', 'landscape'], ['lawn', 'landscape'],
    ['construct', 'construction'], ['ecom', 'ecommerce'], ['e-com', 'ecommerce'], ['retail', 'ecommerce'],
    ['home', 'home_services'], ['misc', 'misc'], ['other', 'other']];
  for (const [k, v] of map) if (s.includes(k)) return v;
  return '';
}

async function loadActiveCaseStudies() {
  try {
    const res = await fetch('/api/case-studies', { headers: getApiHeaders() });
    if (!res.ok) return RGS_CASE_STUDIES;
    const d = await res.json();
    return Array.isArray(d.caseStudies) ? d.caseStudies : RGS_CASE_STUDIES;
  } catch (e) { return RGS_CASE_STUDIES; }
}

// Scrape the actual homepage HTML to find the real logo URL
async function scrapeLogoFromHomepage(url) {
  try {
    const res = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ url, raw: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const html = data.html || '';

    // Parse the HTML to find logo images
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Strategy 1: Find <img> tags with "logo" in src, alt, class, or id
    const imgs = doc.querySelectorAll('img');
    const baseUrl = new URL(url);
    let bestLogo = null;

    for (const img of imgs) {
      // Lazy-loaded sites put the real URL in data-src/data-lazy-src/srcset instead of src
      const src = img.getAttribute('src')
        || img.getAttribute('data-src')
        || img.getAttribute('data-lazy-src')
        || (img.getAttribute('srcset') || '').split(',')[0].trim().split(/\s+/)[0]
        || '';
      const alt = (img.getAttribute('alt') || '').toLowerCase();
      const cls = (img.getAttribute('class') || '').toLowerCase();
      const id  = (img.getAttribute('id') || '').toLowerCase();
      const parent = img.parentElement;
      const parentCls = parent ? (parent.getAttribute('class') || '').toLowerCase() : '';
      const parentId  = parent ? (parent.getAttribute('id') || '').toLowerCase() : '';

      const isLogo = src.toLowerCase().includes('logo')
        || alt.includes('logo')
        || cls.includes('logo')
        || id.includes('logo')
        || parentCls.includes('logo')
        || parentId.includes('logo');

      if (isLogo && src) {
        try {
          bestLogo = new URL(src, baseUrl).href;
          break;
        } catch (_) {}
      }
    }

    // Strategy 2: Check <link rel="icon"> or Open Graph image as fallback
    if (!bestLogo) {
      const ogImg = doc.querySelector('meta[property="og:image"]');
      if (ogImg) {
        const content = ogImg.getAttribute('content');
        if (content) {
          try { bestLogo = new URL(content, baseUrl).href; } catch (_) {}
        }
      }
    }

    return bestLogo;
  } catch (e) {
    console.warn('Logo scrape failed:', e.message);
    return null;
  }
}

// Scrape the homepage and contact page for a street address
async function scrapeAddressFromSite(url) {
  try {
    // Try homepage first, then /contact, /contact-us, /about
    const baseUrl = new URL(url);
    const pagesToTry = [
      url,
      new URL('/contact', baseUrl).href,
      new URL('/contact-us', baseUrl).href,
      new URL('/about', baseUrl).href,
    ];

    for (const pageUrl of pagesToTry) {
      try {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({ url: pageUrl }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const text = data.text || '';

        // Look for US address patterns: number + street + city + state + zip
        const addressPatterns = [
          // "123 Main St, City, ST 12345" or "123 Main St City ST 12345"
          /\d{1,6}\s+[\w\s.]{2,40}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Ln|Lane|Ct|Court|Pl|Place|Pkwy|Parkway|Cir|Circle|Hwy|Highway)\.?\s*,?\s*(?:Suite|Ste|#|Apt|Unit)?\s*\d{0,5}\s*,?\s*[\w\s]{2,30},?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/i,
          // Broader: any line with a 5-digit zip preceded by a 2-letter state
          /\d{1,6}\s+[^<\n]{5,60}[A-Z]{2}\s+\d{5}/i,
        ];

        for (const pattern of addressPatterns) {
          const match = text.match(pattern);
          if (match) {
            const addr = match[0].replace(/\s+/g, ' ').trim();
            // Sanity check: must have at least 15 chars and a zip code
            if (addr.length >= 15 && /\d{5}/.test(addr)) {
              return addr;
            }
          }
        }
      } catch (e) { /* skip this page */ }
    }
    return null;
  } catch (e) {
    console.warn('Address scrape failed:', e.message);
    return null;
  }
}

// Fallback: use Gemini with search grounding to find the business address
async function lookupAddressViaGemini(companyName, url) {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        prompt: `What is the street address of "${companyName}" (website: ${url})? Look up their Google Business Profile or any business directory listing. Return ONLY the full street address including street number, city, state, and zip code. If you cannot find a verified address, return "NOT FOUND". Do not guess or make up an address.`,
        model: 'gemini-2.5-flash-lite'
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.candidates || [{}])[0]?.content?.parts
      ?.filter(p => p.text).map(p => p.text).join('').trim() || '';
    if (!text || text.includes('NOT FOUND') || text.length < 10 || text.length > 200) return null;
    // Clean up — remove any surrounding quotes or extra text
    const cleaned = text.replace(/^["']|["']$/g, '').trim();
    // Verify it looks like an address (has a number and a zip)
    if (/\d/.test(cleaned) && /\d{5}/.test(cleaned)) return cleaned;
    return null;
  } catch (e) {
    console.warn('Gemini address lookup failed:', e.message);
    return null;
  }
}

let propVertical = null;
let propRGS = 'included';
let propType = 'new_website';
let propMarketType = 'residential';
let propClientData = {};
let propReportHtml = '';

function adjustForMarketType(text) {
  if (!text) return text;
  // "Other" vertical: strip home-services verbiage from shared copy regardless of market type
  if (propVertical === 'other') {
    const neutral = [
      [/a homeowner evaluating contractors/g, 'a customer evaluating your business'],
      [/by location, home value, and neighborhood/g, 'by location, interests, and behavior'],
      [/making a major investment in their home/g, 'making a major purchase decision'],
      [/home services companies/g, 'businesses'],
      [/Homeowners/g, 'Customers'],
      [/homeowners/g, 'customers'],
      [/Homeowner/g, 'Customer'],
      [/homeowner/g, 'customer'],
    ];
    for (const [pattern, replacement] of neutral) {
      text = text.replace(pattern, replacement);
    }
  }
  if (propMarketType === 'residential') return text;
  const c = propMarketType === 'commercial';
  const replacements = [
    [/Homeowners are searching/g, c ? 'Businesses are searching' : 'Property owners are searching'],
    [/homeowners are searching/g, c ? 'businesses are searching' : 'property owners are searching'],
    [/homeowners/g, c ? 'business decision-makers' : 'property owners'],
    [/Homeowners/g, c ? 'Business decision-makers' : 'Property owners'],
    [/homeowner/g, c ? 'business owner' : 'property owner'],
    [/Homeowner/g, c ? 'Business owner' : 'Property owner'],
    [/a homeowner/g, c ? 'a business owner' : 'a property owner'],
    [/the home/g, c ? 'the property' : 'the property'],
    [/their home/g, c ? 'their facility' : 'their property'],
    [/your home/g, c ? 'your facility' : 'your property'],
    [/into their home/g, c ? 'into their facility' : 'into their property'],
    [/home value/g, c ? 'property value' : 'property value'],
    [/home age/g, c ? 'building age' : 'property age'],
    [/booked appointments/g, c ? 'qualified project inquiries' : 'booked appointments'],
    [/booked service calls/g, c ? 'qualified project inquiries' : 'booked service calls'],
    [/booked call/g, c ? 'project inquiry' : 'booked call'],
    [/booked estimate/g, c ? 'project inquiry' : 'booked estimate'],
    [/service calls/g, c ? 'project inquiries' : 'service calls'],
    [/estimate requests/g, c ? 'bid requests' : 'estimate requests'],
    [/quote requests/g, c ? 'RFQ submissions' : 'quote requests'],
    [/quote request/g, c ? 'RFQ submission' : 'quote request'],
    [/Quote request/g, c ? 'RFQ submission' : 'Quote request'],
    [/home services companies/g, c ? 'commercial service contractors' : 'residential and commercial service contractors'],
    [/home services/g, c ? 'commercial services' : 'residential and commercial services'],
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

// ─── Address components (street / city / state / zip are separate fields so
// they can feed the CRM and QuickBooks as atomic values) ─────────────────────
function propAddrVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function propSetIf(id, val, overwrite) {
  const el = document.getElementById(id);
  if (!el || !val) return;
  if (overwrite || !el.value.trim()) el.value = val;
}
// Parse "Everett, WA 98201" / "Everett, WA" / "Everett WA" → {city, state, zip}
function propParseCityState(loc) {
  const out = { city: '', state: '', zip: '' };
  let s = (loc || '').trim().replace(/\s+/g, ' ');
  if (!s) return out;
  const zipM = s.match(/(\d{5}(?:-\d{4})?)\s*$/);
  if (zipM) { out.zip = zipM[1]; s = s.slice(0, zipM.index).trim().replace(/,$/, ''); }
  const stM = s.match(/(?:,|\s)\s*([A-Za-z]{2})\.?$/);
  if (stM && stM[1] === stM[1].toUpperCase()) { out.state = stM[1]; s = s.slice(0, stM.index).trim().replace(/,$/, ''); }
  out.city = s.replace(/,$/, '').trim();
  return out;
}
// Parse a full mailing address ("1234 Main St, Everett, WA 98201") → components.
// Without commas the city can't be split reliably; it stays in street and the
// city/state usually arrive separately from research.
function propParseFullAddress(raw) {
  const out = { street: '', city: '', state: '', zip: '' };
  let s = (raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return out;
  const zipM = s.match(/(\d{5}(?:-\d{4})?)\s*$/);
  if (zipM) { out.zip = zipM[1]; s = s.slice(0, zipM.index).trim().replace(/,$/, ''); }
  const stM = s.match(/(?:,|\s)\s*([A-Za-z]{2})\.?$/);
  if (stM && stM[1] === stM[1].toUpperCase()) { out.state = stM[1]; s = s.slice(0, stM.index).trim().replace(/,$/, ''); }
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) { out.city = parts.pop(); out.street = parts.join(', '); }
  else out.street = s;
  return out;
}
// Write parsed components into the form. overwrite=true replaces existing values.
function propApplyAddress(a, overwrite) {
  if (!a) return;
  propSetIf('prop-address', a.street, overwrite);
  propSetIf('prop-city', a.city, overwrite);
  propSetIf('prop-state', (a.state || '').toUpperCase(), overwrite);
  propSetIf('prop-zip', a.zip, overwrite);
}
// "City, ST" for generation and research prompts
function propCityState() {
  const city = propAddrVal('prop-city'), st = propAddrVal('prop-state').toUpperCase();
  return city && st ? city + ', ' + st : (city || st);
}
// Full mailing address composed from the four fields
function propFullAddress() {
  const street = propAddrVal('prop-address');
  const cs = propCityState();
  const zip = propAddrVal('prop-zip');
  let out = street;
  if (cs) out = out ? out + ', ' + cs : cs;
  if (zip) out = out ? out + ' ' + zip : zip;
  return out;
}

// Display form of the address: street on its own line, then "City, ST ZIP" —
// used by the logo block and the signature block (single-line reads as a run-on)
function propAddressLines() {
  let street = propAddrVal('prop-address');
  const city = propAddrVal('prop-city');
  const cs = propCityState();
  const zip = propAddrVal('prop-zip');
  // Research autofill sometimes jams phone fragments and the city into the
  // street field ("733 0191 928 Thomas Road Bellingham") — clean both ends.
  const phoneDigits = (document.getElementById('prop-phone') ? document.getElementById('prop-phone').value : '').replace(/\D/g, '');
  const lead = street.match(/^((?:\d{3,4}[\s.\-]+){1,3})(?=\d)/);
  if (lead && phoneDigits && lead[1].replace(/\D/g, '').length >= 6 && phoneDigits.includes(lead[1].replace(/\D/g, ''))) {
    street = street.slice(lead[1].length).trim();
  }
  if (street && city && street.toLowerCase().endsWith(city.toLowerCase()) && street.length > city.length) {
    street = street.slice(0, street.length - city.length).replace(/[,\s]+$/, '');
  }
  const line2 = cs ? (zip ? cs + ' ' + zip : cs) : zip;
  return [street, line2].filter(Boolean);
}

function selectVertical(el) {
  document.querySelectorAll('.vertical-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  propVertical = el.dataset.v;
}

function selectRGS(mode) {
  propRGS = mode;
  document.getElementById('rgs-optional').classList.toggle('selected', mode === 'optional');
  document.getElementById('rgs-included').classList.toggle('selected', mode === 'included');
}

function selectPropType(type) {
  propType = type;
  document.getElementById('prop-type-new').classList.toggle('selected', type === 'new_website');
  document.getElementById('prop-type-wo').classList.toggle('selected', type === 'wo_rgs');
  document.getElementById('prop-type-rgs').classList.toggle('selected', type === 'rgs_only');
  const isWO = type === 'wo_rgs';
  const isRGS = type === 'rgs_only';
  document.getElementById('price-website-label').textContent = isWO ? 'WO price ($)' : 'Website price ($)';
  document.getElementById('price-website').value = isWO ? 6600 : 7500;
  document.getElementById('price-rgs').value = (isWO || isRGS) ? 2800 : 2500;
  // Field visibility: new site = website + hosting; WO = WO price + hosting + hours
  // (hosting on WOs covers migrating an existing site to efelle hosting — it only
  // appears in the proposal when > $0); RGS only = RGS monthly only
  document.getElementById('price-website-field').style.display = isRGS ? 'none' : '';
  document.getElementById('price-hosting-field').style.display = isRGS ? 'none' : '';
  document.getElementById('price-hosting').value = isWO ? 0 : 85;
  document.getElementById('price-hours-field').style.display = isWO ? '' : 'none';
  // RGS Mode (included vs optional) only applies when there's a website project to attach it to
  document.getElementById('rgs-mode-divider').style.display = isRGS ? 'none' : '';
  document.getElementById('rgs-mode-toggle').style.display = isRGS ? 'none' : '';
  if (isRGS) selectRGS('included');
}

function selectMarketType(type) {
  propMarketType = type;
  document.getElementById('market-residential').classList.toggle('selected', type === 'residential');
  document.getElementById('market-commercial').classList.toggle('selected', type === 'commercial');
  document.getElementById('market-both').classList.toggle('selected', type === 'both');
}

// Restore engine state when a saved proposal is opened from the Library —
// without this, navigating back to Client Details trips the vertical guard.
window.restorePropState = function(report) {
  const m = (report && report.metadata) || {};
  if (m.vertical && VERTICALS[m.vertical]) {
    const card = document.querySelector('.vertical-card[data-v="' + m.vertical + '"]');
    if (card) selectVertical(card);
    else propVertical = m.vertical;
  }
  if (m.type) selectPropType(m.type);
  if (m.marketType) selectMarketType(m.marketType);
  if (m.rgs) selectRGS(m.rgs);
  // Restore saved pricing AFTER selectPropType (which resets fields to defaults) —
  // without this, custom values like WO hosting are silently lost on Library restore
  if (m.prices) {
    const setPrice = (id, v) => { if (v !== undefined && v !== null && v !== '') document.getElementById(id).value = v; };
    setPrice('price-website', m.prices.website);
    setPrice('price-hosting', m.prices.hosting);
    setPrice('price-hours', m.prices.hours);
    setPrice('price-rgs', m.prices.rgs);
  }
  // Restore this proposal's number so the label and any regeneration keep it
  if (m.number) {
    propNumber = m.number;
    window.propProposalNumber = m.number;
    const lbl = document.getElementById('prop-preview-label');
    if (lbl) lbl.textContent = 'Proposal // ' + m.number;
  }
};

function propGoStage1() {
  document.querySelectorAll('.prop-stage').forEach(s => s.classList.remove('active'));
  document.getElementById('prop-stage-1').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Reset form when navigating back to proposal engine from another screen
function propReset() {
  propGoStage1();
  propReportHtml = '';
  propSavedReportId = null;
  propNumber = null;
  window.propProposalNumber = null;
  propPubToken = null;
  propClientData = {};
  propLogoInfo = null;
  propVertical = '';
  propMarketType = 'residential';
  // Clear form fields
  ['prop-client-url','prop-name','prop-contact','prop-contact-email','prop-address','prop-phone',
   'prop-city','prop-state','prop-zip','prop-war-search','prop-services','prop-area','prop-differentiators',
   'prop-founded','prop-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Reset vertical selection
  document.querySelectorAll('.vertical-card').forEach(c => c.classList.remove('selected'));
  // Reset previous-report dropdown
  const prevSelect = document.getElementById('prop-prev-report');
  if (prevSelect) prevSelect.selectedIndex = 0;
  // Reset RGS toggle
  document.querySelectorAll('.rgs-opt').forEach(o => o.classList.remove('selected'));
  const rgsDefault = document.querySelector('.rgs-opt[data-val="yes"]');
  if (rgsDefault) rgsDefault.classList.add('selected');
  // Reset price fields
  ['prop-price-website','prop-price-monthly','prop-price-rgs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const statusEl = document.getElementById('prop-url-status');
  if (statusEl) statusEl.innerHTML = '';
  const chatPanel = document.getElementById('prop-chat-panel');
  if (chatPanel) chatPanel.style.display = 'none';
  const pubPanel = document.getElementById('prop-publish-panel');
  if (pubPanel) pubPanel.style.display = 'none';
  // Reset research mode to URL
  if (document.getElementById('research-mode-url')) window.selectResearchMode('url');
  if (document.getElementById('logo-bg-auto')) window.selectLogoBg('auto');
  if (typeof updateLogoPreview === 'function') updateLogoPreview();
  const chatMessages = document.getElementById('prop-chat-messages');
  if (chatMessages) chatMessages.innerHTML = '';
  // Reset report frame
  const frame = document.getElementById('prop-report-frame');
  if (frame) frame.srcdoc = '';
}
window.propReset = propReset;

function propGoStage2() {
  if (!propVertical) {
    alert('Please select an industry vertical first.');
    return;
  }
  document.querySelectorAll('.prop-stage').forEach(s => s.classList.remove('active'));
  document.getElementById('prop-stage-2').classList.add('active');
  populatePropClientSelect();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Research mode: 'url' scrapes the client's website; 'name' researches businesses
// with no website via their Google Business Profile / Facebook / directory listings.
let propResearchMode = 'url';
window.selectResearchMode = function(mode) {
  const isWar = mode === 'war';
  propResearchMode = isWar ? 'url' : mode;
  document.getElementById('research-mode-url').classList.toggle('selected', mode === 'url');
  const warBtn = document.getElementById('research-mode-war');
  if (warBtn) warBtn.classList.toggle('selected', isWar);
  document.getElementById('research-mode-name').classList.toggle('selected', mode === 'name');
  const urlRow = document.getElementById('prop-url-row');
  const warRow = document.getElementById('prop-war-row');
  if (urlRow) urlRow.style.display = isWar ? 'none' : 'flex';
  if (warRow) warRow.style.display = isWar ? 'flex' : 'none';
  document.getElementById('prop-client-url').style.display = mode === 'name' ? 'none' : '';
  document.getElementById('research-hint').textContent = mode === 'url'
    ? 'Company name, location, services, address, phone, and logo URL are pulled automatically after Research client runs.'
    : isWar
      ? 'Client details load from the most recent WAR report for the company.'
      : 'Claude researches the business online from the company name and city below. Fill in Company name (and City, State if you know it), then run Research client.';
};

// Pull WAR report: prefill client name + URL from the newest matching WAR report,
// then run the normal research flow against that URL.
window.propPullWar = async function() {
  const q = (document.getElementById('prop-war-search').value || '').trim().toLowerCase();
  const btn = document.getElementById('prop-war-pull-btn');
  const status = document.getElementById('prop-url-status');
  if (!q) { status.innerHTML = '<span style="color:#D65600">Type the company name to find its WAR report.</span>'; return; }
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Searching\u2026';
  try {
    const reports = await listReports('wsr');
    const matches = (reports || []).filter(r => (r.clientName || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
    if (!matches.length) {
      status.innerHTML = '<span style="color:#D65600">No WAR report found for that name. Run one from the home screen first, or research by URL instead.</span>';
      return;
    }
    const rec = matches[0];
    if (rec.clientName) document.getElementById('prop-name').value = rec.clientName;
    const recUrl = (rec.metadata && rec.metadata.url) || rec.url || '';
    if (recUrl) document.getElementById('prop-client-url').value = recUrl;
    window.selectResearchMode('url');
    if (recUrl) {
      status.innerHTML = '<span style="color:#1d9a34">Loaded "' + (rec.clientName || 'report') + '" from the WAR library, researching the client now\u2026</span>';
      propFetchClient();
    } else {
      status.innerHTML = '<span style="color:#1d9a34">Loaded "' + (rec.clientName || 'report') + '". Add the website URL and run Research client.</span>';
    }
  } catch (e) {
    status.innerHTML = '<span style="color:#dc2626">Could not load WAR reports: ' + String(e.message || e).replace(/</g, '&lt;') + '</span>';
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
};

async function propFetchClient() {
  const url = document.getElementById('prop-client-url').value.trim();
  const isNameMode = propResearchMode === 'name';
  const bizName = document.getElementById('prop-name').value.trim();
  const bizLoc = propCityState();
  // Server mode: session token handles auth, no API key needed in browser
  const btn = document.getElementById('prop-fetch-btn');
  const status = document.getElementById('prop-url-status');
  if (isNameMode && !bizName) {
    status.innerHTML = '<span style="color:#fb923c">Enter the Company Name below first (City, State helps too), then click Research Client.</span>';
    return;
  }
  if (!isNameMode && !url) {
    status.innerHTML = '<span style="color:#fb923c">Paste the client\'s website URL first — or switch to "No website — research online".</span>';
    return;
  }
  btn.disabled = true; btn.textContent = 'Researching…';
  function setStatus(msg, state) {
    const color = state === 'searching' ? '#a78bfa' : state === 'building' ? '#2dd4bf' : state === 'done' ? '#2dd4bf' : state === 'warn' ? '#fb923c' : state === 'error' ? '#f87171' : '#9ca3af';
    status.innerHTML = '<span class="status-dot"></span><span class="status-dot"></span><span class="status-dot"></span><span style="margin-left:4px;color:' + color + '">' + msg + '</span>';
  }
  setStatus('Connecting to research engine…', 'info');
  try {
    const researchPromise = callWithWebSearch(
      PROP_RESEARCH_SYSTEM,
      isNameMode
        ? 'This business has no website. Research the business "' + bizName + '"' + (bizLoc ? ' located in ' + bizLoc : '') + ' using their Google Business Profile, Facebook page, Yelp, Angi, BBB, and other business directory listings. Extract their information. Include only facts you actually found in those listings — leave any field empty rather than guessing.'
        : 'Research this business website and extract their information including their logo image URL: ' + url,
      2000,
      (msg, state) => { setStatus(msg, state); }
    );
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Research timed out — fill in the fields manually below.')), 45000)
    );
    const raw = await Promise.race([researchPromise, timeout]);
    let clean = raw.replace(/\x60{3}json|\x60{3}/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);
    const data = JSON.parse(clean);

    if (data.company_name) document.getElementById('prop-name').value = data.company_name;
    if (data.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) document.getElementById('prop-contact-email').value = data.contact_email.trim().toLowerCase();
    if (data.location)     propApplyAddress(propParseCityState(data.location), true);
    if (data.address) {
      const a = propParseFullAddress(data.address);
      document.getElementById('prop-address').value = a.street;
      propApplyAddress({ city: a.city, state: a.state, zip: a.zip }, false);
    }
    if (data.phone)        document.getElementById('prop-phone').value = data.phone;
    if (data.services && data.services.length) document.getElementById('prop-services').value = data.services.join('|');
    if (data.service_area) document.getElementById('prop-area').value = data.service_area;
    if (data.founded)      document.getElementById('prop-founded').value = data.founded;
    if (data.differentiators) document.getElementById('prop-differentiators').value = data.differentiators;
    // Scrape the ACTUAL homepage for the real logo URL (don't trust Claude's guess).
    // Name mode has no site to scrape — rely on verified research + Gemini fallback.
    let scrapedLogo = null, scrapedAddress = null;
    if (!isNameMode) {
      setStatus('Scraping homepage for logo and address…', 'searching');
      [scrapedLogo, scrapedAddress] = await Promise.all([
        scrapeLogoFromHomepage(url),
        scrapeAddressFromSite(url),
      ]);
    }

    // Address: use scraped > Claude's research > Gemini lookup
    let finalAddress = scrapedAddress || data.address || '';
    let addressSource = scrapedAddress ? 'website' : (data.address ? 'research' : '');

    if (!finalAddress) {
      setStatus('Looking up business address via Google…', 'searching');
      const geminiAddress = await lookupAddressViaGemini(
        data.company_name || document.getElementById('prop-name').value,
        url || ('no website — business located in ' + (bizLoc || 'unknown city'))
      );
      if (geminiAddress) {
        finalAddress = geminiAddress;
        addressSource = 'google';
      }
    }

    if (finalAddress) {
      const a = propParseFullAddress(finalAddress);
      document.getElementById('prop-address').value = a.street;
      propApplyAddress({ city: a.city, state: a.state, zip: a.zip }, true);
    }

    // Logo: real homepage markup first, then the AI's URL only if it verifiably loads.
    // Never populate an unverified AI-guessed URL — they're frequently hallucinated.
    setStatus('Verifying logo URL…', 'searching');
    let logoUrl = '';
    let logoSource = '';
    let aiLogoRejected = false;
    if (scrapedLogo && await imageExists(scrapedLogo)) {
      logoUrl = scrapedLogo; logoSource = 'website';
    } else if (data.logo_url) {
      if (await imageExists(data.logo_url)) { logoUrl = data.logo_url; logoSource = 'research'; }
      else aiLogoRejected = true;
    }
    // Tertiary fallback: Clearbit's logo index (real crawled logos, not guesses) —
    // covers sites whose bot protection blocks our server-side scrape. Only used
    // if the image verifiably loads.
    if (!logoUrl && !isNameMode && url) {
      try {
        const host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\./, '');
        const clearbitUrl = 'https://logo.clearbit.com/' + host;
        if (await imageExists(clearbitUrl)) { logoUrl = clearbitUrl; logoSource = 'clearbit'; }
      } catch (e) { /* bad URL — skip */ }
    }
    const hasLogo = !!logoUrl;
    const hasAddress = !!finalAddress;
    if (logoUrl) document.getElementById('prop-logo').value = logoUrl;
    updateLogoPreview();
    let statusParts = ['✓ Client info populated — scroll down to review and generate proposal.'];
    if (!hasAddress) statusParts.push('<span style="color:#fb923c">No address found — paste it in the Address field below.</span>');
    if (hasAddress && addressSource === 'google') statusParts.push('<span style="color:#fb923c">Address found via Google — please verify it\'s correct.</span>');
    if (hasAddress && addressSource === 'website') statusParts.push('<span style="color:#2dd4bf">Address found on website.</span>');
    if (!hasLogo && aiLogoRejected) statusParts.push('<span style="color:#fb923c">AI-suggested logo URL didn\'t exist and was discarded — paste the real logo URL below.</span>');
    else if (!hasLogo) statusParts.push('<span style="color:#fb923c">No logo found — paste a logo URL in the Logo field below.</span>');
    if (logoSource === 'website') statusParts.push('<span style="color:#2dd4bf">Logo found in homepage source code.</span>');
    if (logoSource === 'research') statusParts.push('<span style="color:#fb923c">Logo URL came from AI research (verified it loads) — confirm it\'s the right image.</span>');
    if (logoSource === 'clearbit') statusParts.push('<span style="color:#fb923c">Logo pulled from Clearbit\'s logo index — verify it\'s their current logo.</span>');
    status.innerHTML = '<span style="color:#2dd4bf">' + statusParts.join(' ') + '</span>';
  } catch(e) {
    console.error('propFetchClient error:', e);
    status.innerHTML = '<span style="color:#f87171">⚠ ' + (e.message || 'Could not auto-fetch') + '. Fill in the fields manually below.</span>';
  }
  btn.disabled = false; btn.textContent = 'Research client';
}

function propBuildHTML(clientName) {
  const v = VERTICALS[propVertical];
  const isWO = propType === 'wo_rgs';
  const isRGS = propType === 'rgs_only';
  const optional = propType === 'new_website' && propRGS === 'optional';
  const wp = isRGS ? 0 : (parseInt(document.getElementById('price-website').value) || (isWO ? 6600 : 7500));
  // Hosting applies to any proposal with a site (new build OR a WO where we migrate
  // their existing site to efelle hosting). $0 = omit from the proposal entirely.
  const hpRaw = parseInt(document.getElementById('price-hosting').value);
  const hp = isRGS ? 0 : (Number.isFinite(hpRaw) ? Math.max(0, hpRaw) : (isWO ? 0 : 85));
  const rp = parseInt(document.getElementById('price-rgs').value) || ((isWO || isRGS) ? 2800 : 2500);
  const hours = isWO ? (parseInt(document.getElementById('price-hours').value) || 40) : 0;
  // The displayed RGS program price — on the hosted page these listed figures
  // update in place as add-ons are checked (base program + selected add-ons)
  const liveRgs = '<span class="live-rgs-monthly" data-base="' + rp + '">' + fmt(rp) + '</span>';
  const d1 = Math.round(wp * 0.50);  // 50% deposit (both new site and WO)
  const d2 = isWO ? Math.round(wp * 0.50) : 0;  // WO: 50% milestone; new site: no milestone
  const monthlyPay = fmt(Math.round((wp - d1) / 24));
  const m50 = isWO ? 0 : Math.round((wp * 0.50) / 24);  // new site: 50% balance / 24 mo
  const contact  = document.getElementById('prop-contact').value.trim() || '';
  const location = propCityState() || '';
  const founded  = document.getElementById('prop-founded').value.trim() || '';
  const area     = document.getElementById('prop-area').value.trim() || 'the local area';
  const diffs    = document.getElementById('prop-differentiators').value.trim() || '';
  const address  = propFullAddress() || '';
  const phone    = document.getElementById('prop-phone').value.trim() || '';
  const website  = document.getElementById('prop-client-url').value.trim() || '';
  const logo     = document.getElementById('prop-logo').value.trim() || '';
  const servicesRaw = document.getElementById('prop-services').value.trim();
  const services = servicesRaw ? servicesRaw.split('|').map(s => s.trim()).filter(Boolean) : [];
  const svc_str  = services.length ? services.join(', ') : '';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const expDate = new Date(today); expDate.setDate(expDate.getDate() + 14);
  const expiry  = expDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Proposal number: minted once per proposal (kept across regenerations and
  // Library restores), stamped on the hero cover and shown in the builder
  if (!propNumber) {
    const mmN = String(today.getMonth() + 1).padStart(2, '0');
    const ddN = String(today.getDate()).padStart(2, '0');
    propNumber = today.getFullYear() + '-' + mmN + ddN + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  window.propProposalNumber = propNumber;


  const VPD = {
    landscape:  ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-2.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-3.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-4.jpg'],
    ecommerce:  ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-ecom-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-ecom-2.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-ecom-3.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-ecom-4.jpg'],

    home_services: ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-3.jpg', null],
    plumbers:      ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-3.jpg', null],
    roofers:       ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-roofing-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-roofing-2.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-roofing-3.jpg', null],
    hvac:          ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-3.jpg', null],
    electrical:    ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-3.jpg', null],
    construction:  ['https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-landscape-1.jpg', 'https://www.seattlewebdesign.com/uploads/_proposal/portfolio/portfolio-homeservices-3.jpg', null],
  };
  const serverVpd = (activePortfolios || [])
    .filter(pf => portfolioVerticalKey(pf.industry) === propVertical)
    .map(pf => pf.img);
  const vpd = serverVpd.length ? serverVpd : (VPD[propVertical] || []);
  const p1 = vpd[0] || GENERIC_P1;
  const p2 = vpd[1] || GENERIC_P2;
  const p3 = vpd[2] || GENERIC_P3;
  const p4 = vpd[3] || null;


  // Prefer our server-hosted copy of the logo (small URL, no base64 bloat), falling back
  // to the client's original URL; add a dark backdrop when the logo is white-heavy.
  const logoSrc = (propLogoInfo && propLogoInfo.src) || logo;
  const logoImgTag = '<img src="' + logoSrc + '" alt="' + clientName + '" style="width:100%;height:auto;display:block;">';
  const logoHtml = logo
    ? (propLogoInfo && propLogoInfo.dark
        ? '<div id="client-logo-block" style="max-width:67%;background:#1D1D1F;border-radius:12px;padding:22px 28px;">' + logoImgTag + '</div>'
        : '<div id="client-logo-block" style="max-width:67%;">' + logoImgTag + '</div>')
    : '<div id="client-logo-block" style="border:2px dashed #D2D2D7;border-radius:10px;padding:24px 32px;display:inline-flex;flex-direction:column;align-items:center;gap:8px;background:#F5F5F7;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#636366" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#636366;">Client Logo</div></div>';


  // If the address is street-only (research often misses city/state/zip), append the
  // City, State field so the letterhead block is complete. An address counts as complete
  // only if it already has a state code (", WA") or a zip — checking for the city name is
  // unreliable because street names often contain it ("227 Bellevue Way").
  const addressComplete = /,\s*[A-Z]{2}\b/.test(address) || /\b\d{5}(?:-\d{4})?\b/.test(address);
  const fullAddress = (address && !addressComplete && location) ? address + ', ' + location : address;

  // Street on one line, "City, ST ZIP" on the next — a joined single line
  // reads as a run-on in the logo block and the signature block
  const addrLines = propAddressLines();
  const addressTwoLine = addrLines.length ? addrLines.join('<br>') : (fullAddress || location || '');

  const lines = [];
  if (addressTwoLine) lines.push(addressTwoLine);
  if (phone)   lines.push('<a href="tel:' + phone + '" style="color:#636366;text-decoration:none;">' + phone + '</a>');
  if (website) lines.push('<a href="' + website + '" style="color:#F56300;text-decoration:none;" target="_blank">' + website.replace(/https?:\/\//,'').replace(/\/$/, '') + '</a>');
  const addressHtml = lines.length ? '<div style="font-size:11px;color:#636366;line-height:1.8;text-align:center;">' + lines.join('<br>') + '</div>' : '';


  const isOtherVertical = propVertical === 'other';
  let about1 = clientName + (isOtherVertical ? ' is a company based in ' : ' is a ' + v.label.toLowerCase() + ' company based in ') + (location || 'the area');
  const clientsPhrase = isOtherVertical ? 'clients' : 'residential and commercial clients';
  // The service-area field sometimes holds a descriptive sentence ("Nationwide franchise
  // with 40 locations across…") rather than a region list — grafting that onto "serving
  // clients across" produces a broken sentence, so let long/descriptive text stand alone.
  const areaIsDescription = area && (area.length > 70 || /^(a|an|the|nationwide|national|regional|multi|family|locally)\b/i.test(area.trim()));
  if (area && area !== 'the local area' && areaIsDescription) {
    about1 += '. ' + area.trim().charAt(0).toUpperCase() + area.trim().slice(1);
  } else if (area && area !== 'the local area') {
    about1 += ', serving ' + clientsPhrase + ' across ' + area;
  } else {
    about1 += ', serving ' + clientsPhrase + ' in the local area';
  }
  if (svc_str) about1 += '. Services include ' + svc_str + '.';

  let about2 = (founded ? 'Founded in ' + founded + ', ' : '') + clientName + ' has built a reputation for quality work and reliable service.';
  if (diffs) about2 += ' ' + diffs;


  // "Other" vertical: swap contractor phrasing for business-neutral language
  const intoWork = isOtherVertical ? 'new customers' : 'booked work';
  const qualTraffic = isOtherVertical ? 'qualified traffic' : 'qualified local traffic';
  const svcAreaTargeting = isOtherVertical ? 'location targeting' : 'service-area targeting';

  let sow1, sow2, sow3, sow4, sow5;
  if (isRGS) {
    sow1 = clientName + ' will engage efelle to run its Revenue Growth Service (RGS), a fully managed digital marketing program built around the company\'s existing website. The program is designed to increase visibility, drive ' + qualTraffic + ', and convert that traffic into ' + intoWork + '.';
    sow2 = 'The engagement begins with a kickoff and strategy session to align on goals, service priorities, and target markets. efelle will then configure the campaign infrastructure — Google Ads campaigns, conversion tracking, analytics, and lead attribution — so every lead source is measurable from day one.';
    sow3 = 'Ongoing work includes website content updates (new and refreshed pages, landing pages, and on-page SEO improvements to the existing site), Local SEO (' + svcAreaTargeting + ', map pack optimization, structured data), AI search visibility (GEO) so the business appears in AI-generated answers, reputation management, and continuous optimization across every channel.';
    sow4 = 'Each month, ' + clientName + ' receives a clear report covering leads, traffic, ad performance, rankings, and ROI. The program runs with a three-month minimum term, then continues month-to-month with 30 days\' notice to cancel. Ad spend is paid directly to Google.';
    sow5 = '';
  } else if (isWO) {
    sow1 = 'This engagement focuses on improving the website\'s local search visibility, AI discoverability (GEO), and conversion performance through targeted updates based on the recent audit. Rather than addressing every issue, the work prioritizes high-impact improvements that strengthen how search engines and AI systems understand and rank the site.';
    sow2 = 'We will implement structured data (schema markup) across key pages to improve search visibility and help AI platforms better interpret services, service areas, and business details. This supports stronger local SEO performance and improved presence in AI-driven results.';
    sow3 = 'We will also update approximately 10 priority location and service pages with hyper-specific, locally relevant content. These updates will improve geographic targeting, keyword alignment, and semantic clarity. The audit identified gaps in keyword usage, content depth, and metadata, which will be addressed within this scope.';
    sow4 = 'In addition, we will complete targeted fixes from the audit, including improving page titles and meta descriptions, enhancing low-content pages, correcting grammar and readability issues, and addressing select on-page SEO gaps. This scope is focused on delivering measurable gains in local SEO, AI visibility, and conversions within a ' + hours + '-hour engagement. A full technical overhaul is outside the scope of this phase.';
    sow5 = '';
  } else {
    sow1 = clientName + ' will engage efelle to design and develop a new website that modernizes the brand, improves usability, and supports marketing performance. The project begins with discovery to define goals, messaging, and target audiences.';
    sow2 = 'efelle will review analytics, content, and SEO, analyze competitors, and develop a sitemap, user journey framework, and feature recommendations — resulting in a clear site architecture and content roadmap. Design will deliver a modern, mobile-responsive website aligned with ' + clientName + '\'s brand across all devices.';
    sow3 = 'Development includes FusionCMS setup, responsive front-end build, lead capture forms, and performance optimization. efelle will assist with content population, including page formatting, image optimization, and content organization. ' + clientName + ' will provide brand assets and assist with portfolio content. The site will undergo cross-browser and device testing prior to launch.';
    sow4 = 'The website will follow SEO best practices, including optimized structure, metadata, XML sitemap, analytics setup, and URL redirects.';
    sow5 = optional
      ? 'As an optional service, efelle offers its Revenue Growth Service (RGS), a digital marketing program focused on increasing visibility, driving qualified traffic, and improving lead generation through SEO, content, and ongoing optimization.'
      : 'During this project, efelle will build and configure its Revenue Growth Service (RGS), an ongoing digital marketing program focused on increasing visibility, driving qualified traffic, and improving lead generation through SEO, content, and performance optimization.';
  }


  const offerLead = isRGS
    ? (clientName + ' already has a website — what\'s missing is a consistent, managed program that puts it in front of the right local customers. Our RGS program handles exactly that: traffic, leads, and reporting, all managed by one team.')
    : isWO
    ? (clientName + ' has a solid foundation — this engagement is about making it perform. We\'ll make high-impact updates that improve local search rankings, AI visibility, and lead conversion without the cost or timeline of a full rebuild.')
    : adjustForMarketType(v.offer_lead.replace('__CLIENT_NAME__', clientName));

  const offerFull = isRGS
    ? ('<strong>Our Revenue Growth Service (RGS)</strong> is a fully managed monthly lead-generation program — Google PPC Ads, Local SEO, AI search visibility (GEO), ongoing content updates to your existing website, and monthly reporting, analytics &amp; strategy — run by one team, tracked in one place, and reported to you every month.<br><br>No long-term contract: a three-month minimum term, then month-to-month with 30 days\' notice.')
    : isWO
    ? ('<strong>A focused, ' + hours + '-hour website update engagement</strong> targeting the highest-impact improvements identified in the recent audit — schema markup, location and service page content, metadata, and on-page SEO fixes. Not a full rebuild. Targeted work that moves the needle.<br><br>This proposal also includes our <strong>Revenue Growth Service (RGS)</strong>, a monthly lead generation program that drives traffic, generates leads, and grows your online presence — starting month one.')
    : (v.offer_text.replace('[[CLIENT_NAME]]', clientName) + '<br><br>' + (
        optional
        ? 'We also offer an optional <strong>Revenue Growth Service (RGS)</strong>, a monthly lead generation program that drives traffic, generates leads, and grows your online presence. Details later in this proposal.'
        : 'We\'re also including our <strong>Revenue Growth Services (RGS)</strong>, a monthly managed lead-generation program that drives traffic, generates leads, and grows your online presence — starting month one.'
      ));

  const rgsBadge = (!isWO && optional) ? '<div style="display:inline-block;background:rgba(50,215,75,0.15);border:1px solid rgba(50,215,75,0.3);border-radius:20px;padding:4px 12px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#32D74B;margin-bottom:16px;">Optional — Monthly Marketing Program</div>' : '';

  const rgsH2 = isRGS
    ? 'Your website is the engine.<br><em>We\'ll fuel it with digital marketing.</em>'
    : isWO
    ? 'We\'ll improve your website.<br><em>And add digital marketing to fuel the engine.</em>'
    : 'We\'ll build your lead-machine,<br><em>And fuel the engine with digital marketing.</em>';

  const rgsLead = isRGS
    ? 'Your website already represents your business — our job is to make sure customers actually find it, and that visits turn into ' + intoWork + '. The RGS program drives consistent traffic and converts it into revenue from month one. Every channel is managed, tracked, and reported monthly so you see exactly where your leads are coming from.'
    : isWO
    ? 'We\'ll make website updates to help it convert — built around trust signals, project proof, and CRO strategies that turn visitors into booked appointments. But conversion only matters if people find you. The RGS program is included in this proposal — driving consistent traffic and converting it into revenue from month one. Every channel is managed, tracked, and reported monthly so you see exactly where your leads are coming from.'
    : (optional
        ? 'Your new efelle website is engineered to convert — built around trust signals, project proof, and CRO strategies that turn visitors into booked appointments. But conversion only matters if people find you. Our RGS program drives consistent traffic and converts it into revenue. Every channel is managed, tracked, and reported monthly so you see exactly where your leads are coming from. This program is optional and can be added at any time, using a combination of the elements of our system below:'
        : 'Your new website will be built to convert, using trust signals, project proof &amp; CRO strategies that turn visitors into appointments. Traffic drives results, which is why our RGS program is included — bringing in consistent leads &amp; revenue from month one. Every channel is managed, tracked, and reported so you always know where your leads come from.');

  // RGS core program — four included services, shown with a green pre-selected
  // check (display-only: clients can't uncheck them). Same core for every type.
  const CHECK = '<div style="width:16px;height:16px;border-radius:3px;background:#32D74B;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:8px;vertical-align:middle;"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  const DESC_INDENT = 'padding-left:24px;';
  // Add-ons render as a compact price list (not cards) so any number of rows fits.
  // The checkbox is a real, clickable input: on the hosted page it feeds the live
  // totals and is recorded (and locked) with the acceptance. The first line is a
  // fixed 16px line box so checkbox, title, and price align; wrapped description
  // lines stay tight underneath.
  const addonCard = (key, title, desc, priceNum) => '<label class="addon-row" style="display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.08); cursor:pointer;">'
    + '<input type="checkbox" class="prog-opt-check" data-opt="addon_' + key + '" data-label="' + ('Add-on: ' + title.replace(/&amp;/g, '&') + ' — $' + priceNum + '/m').replace(/"/g, '&quot;') + '" data-mprice="' + priceNum + '" style="width:16px; height:16px; accent-color:#F56300; flex-shrink:0; margin-top:0;">'
    + '<div style="flex:1; line-height:1.35;"><span style="font-size:12px; font-weight:700; color:var(--white); line-height:16px;">' + title + '</span><span style="font-size:10.5px; color:rgba(255,255,255,0.65);"> — ' + desc + '</span></div>'
    + '<div style="font-size:13px; font-weight:800; color:var(--white); white-space:nowrap; line-height:16px;">$' + priceNum + '<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span></div>'
    + '</label>';
  const addonGroupLabel = (t) => '<div class="addon-group-label" style="font-size:9.5px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.45); padding:12px 0 4px;">' + t + '</div>';

  // RGS-only: the program includes ongoing content updates to the existing site (no design/dev rebuild)
  const contentUpdatesCard = isRGS
    ? '<div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'Website Content Updates</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">Ongoing updates to your existing website — new pages, refreshed content, landing pages, and on-page SEO improvements — handled by our team as part of the program.</div></div>'
    : '';

  const coreCard = (title, desc) => '<div class="rgs-card"><div class="rgs-card-title">' + CHECK + title + '</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">' + desc + '</div></div>';
  const rgsMainCards =
      coreCard('Google PPC Ads', v.rgs_ppc || 'Targeted Google Search campaigns that put you in front of homeowners actively searching for your services. Campaign strategy, optimization, conversion tracking &amp; ongoing management. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to Google.</span>')
    + coreCard('Local SEO', 'Ongoing optimization to improve your visibility in local search and Google Maps, including service-area content, map ranking, structured data &amp; citation building.')
    + coreCard('AI Search Visibility (GEO)', 'As Google AI Overviews and ChatGPT change how homeowners find service providers, we optimize your content to appear in AI-generated answers before they ever reach traditional search results.')
    + coreCard('Reporting, Analytics &amp; Strategy', 'Every month you get clear reporting on leads, traffic, ad performance, rankings and ROI. We review the data, identify opportunities and adjust your program based on what\'s working.')
    + contentUpdatesCard;

  // Optional add-ons — two groups, same roster for every proposal type
  const rgsAddonCards =
      addonGroupLabel('Additional Lead Generation')
    + addonCard('lsa', 'Google Local Services Ads', 'Campaign setup, optimization, lead management &amp; ongoing monitoring to help generate qualified local leads directly from Google. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to Google.</span>', 600)
    + addonCard('bing_ppc', 'Bing PPC Ads', 'Campaign setup, optimization, conversion tracking &amp; ongoing management across Microsoft Ads to generate qualified leads through Bing, Yahoo and Microsoft\'s search network. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to Microsoft.</span>', 600)
    + addonCard('meta', 'META Ads (Facebook &amp; Instagram)', 'Campaign setup, audience targeting, creative rotation &amp; ongoing management across Facebook &amp; Instagram to build awareness and drive direct inquiries. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to META.</span>', 600)
    + addonCard('gbp', 'Google Business Profile Management', 'GBP optimization including photos, Q&amp;A, services, service areas &amp; ongoing updates to improve your visibility in Google Maps and local search.', 400)
    + addonGroupLabel('Customer Engagement')
    + addonCard('reputation', 'Reputation Management', 'Review requests, response management, and amplification across Google, Facebook &amp; industry directories.', 350)
    + addonCard('ai_phone', 'AI Phone &amp; Appointment Automation', 'Missed calls cost leads. Our AI phone system answers 24/7, qualifies prospects, books appointments and handles reminders &amp; follow-ups.', 550)
    + addonCard('social', 'Social Media Engagement', 'We monitor and respond to comments &amp; messages and publish regular content that keeps your brand active and responsive.', 250);

  // Offer price block — for RGS-only the monthly program IS the headline price
  const offerHeadlinePrice = isRGS
    ? fmt(rp) + '<span style="font-size:20px; font-weight:400;">/m</span>'
    : fmt(wp);
  const offerPriceLabel = isRGS ? 'Digital Marketing<br>Program' : isWO ? (hours + ' hours of<br>website updates') : 'One-time website';
  const offerSecondaryBlock = isRGS
    ? ''
    : isWO
    ? '<div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);"><div style="font-size:22px; font-weight:800; color:var(--white); letter-spacing:-0.02em; line-height:1;">' + liveRgs + '<span style="font-size:12px; font-weight:400;">/m</span></div><div class="offer-price-label">Digital Marketing<br>Program</div></div>'
    : (hp > 0
      ? '<div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);"><div style="font-size:22px; font-weight:800; color:var(--white); letter-spacing:-0.02em; line-height:1;">' + fmt(hp) + '<span style="font-size:12px; font-weight:400;">/m</span></div><div class="offer-price-label">Hosting, Support<br>&amp; CMS Maint</div></div>'
      : '');

  // Payment rows
  const payRow = (label, val, border, orange) => '<div style="display:flex; justify-content:space-between; align-items:center; padding:' + (orange ? '16px' : '10px') + ' 0;' + (border ? ' border-bottom:1px solid rgba(0,0,0,0.06);' : '') + '"><span style="font-size:13px; ' + (orange ? 'font-weight:700; color:var(--orange);' : 'color:var(--gray-1);') + ' display:flex; align-items:center;">' + label + '</span><span style="font-size:13px; font-weight:700; color:' + (orange ? 'var(--orange)' : 'var(--black)') + '; display:flex; align-items:center;">' + val + '</span></div>';
  const hostingRow = hp > 0 ? payRow('Website Hosting, Support &amp; CMS Maintenance', fmt(hp) + '/m', true, false) : '';
  const paymentRows = isRGS
    ? (payRow('Monthly Digital Marketing Program (RGS)', liveRgs + '/m', true, true)
      + payRow('Three-month minimum term, then month-to-month', '30 days\' notice to cancel', true, false)
      + payRow('Ad spend (Google)', 'Paid directly to platform', false, false))
    : isWO
    ? (payRow('50% Deposit upon project approval', fmt(d1), true, false)
      + payRow('50% Milestone Payment @ 45 days', fmt(d2), true, false)
      + hostingRow
      + payRow('Monthly Digital Marketing Program (RGS)', liveRgs + '/m', false, true))
    : (payRow('50% project deposit upon approval', fmt(d1), true, false)
      + payRow('50% project balance paid over 24 months, 0% interest', '$' + Math.round(m50).toLocaleString() + '/m', true, false)
      + hostingRow
      + (optional ? '' : payRow('Monthly Digital Marketing Program (RGS)', liveRgs + '/m', false, true)));

  // ── SITE ARCHITECTURE DIAGRAM ──────────────────────────────────────
  // ── SITE ARCHITECTURE WIREFRAME DIAGRAM ─────────────────────────────
  var smSvcList = services.length > 0 ? services.slice(0, 4) : ['Emergency Service', 'Drain Cleaning', 'Water Heaters', 'Pipe Repair'];
  var smCityName = location ? location.split(',')[0].trim() : 'Your City';

  function smWF(cx, yt, w, h, accent) {
    var x = cx - Math.floor(w / 2);
    var lx = x + 8; var lw = w - 16;
    var bg = accent ? 'rgba(245,99,0,0.06)' : '#FFFFFF';
    var bd = accent ? '#F56300' : '#D2D2D7';
    var hd = accent ? '#F56300' : '#9CA3AF';
    var o = '';
    // Outer frame
    o += '<rect x="' + x + '" y="' + yt + '" width="' + w + '" height="' + h + '" rx="6" fill="' + bg + '" stroke="' + bd + '" stroke-width="1.25"/>';
    // Header: rounded top (rx=6), then square-bottom overlay to flatten the lower curves
    o += '<rect x="' + x + '" y="' + yt + '" width="' + w + '" height="14" rx="6" fill="' + hd + '" stroke="none"/>';
    o += '<rect x="' + x + '" y="' + (yt + 8) + '" width="' + w + '" height="6" rx="0" fill="' + hd + '" stroke="none"/>';
    // Content
    o += '<rect x="' + lx + '" y="' + (yt + 18) + '" width="' + lw + '" height="3" rx="1" fill="#EBEBEB"/>';
    o += '<rect x="' + lx + '" y="' + (yt + 24) + '" width="' + lw + '" height="22" rx="3" fill="' + (accent ? 'rgba(245,99,0,0.08)' : '#F5F5F7') + '"/>';
    o += '<rect x="' + lx + '" y="' + (yt + 50) + '" width="' + Math.floor(lw * 0.85) + '" height="3" rx="1" fill="#EBEBEB"/>';
    o += '<rect x="' + lx + '" y="' + (yt + 57) + '" width="' + Math.floor(lw * 0.65) + '" height="3" rx="1" fill="#EBEBEB"/>';
    o += '<rect x="' + (cx - 18) + '" y="' + (yt + 65) + '" width="36" height="10" rx="5" fill="' + (accent ? 'rgba(245,99,0,0.18)' : 'rgba(0,0,0,0.06)') + '" stroke="' + (accent ? '#F56300' : '#D2D2D7') + '" stroke-width="0.75"/>';
    return o;
  }

  var sp = [];
  sp.push('<defs><marker id="sm-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 6,3 0,6" fill="#D2D2D7"/></marker><marker id="sm-arr-o" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 6,3 0,6" fill="#F56300"/></marker></defs>');

  // TRAFFIC SOURCES — 5 circles, updated label
  var tSrcs = [
    {x: 110,  ltr: 'G', lbl: 'GOOGLE',     col: '#4285F4'},
    {x: 255,  ltr: 'A', lbl: 'GOOGLE ADS', col: '#F56300'},
    {x: 400,  ltr: 'M', lbl: 'META ADS',   col: '#1877F2'},
    {x: 545,  ltr: 'L', lbl: 'LOCAL MAPS', col: '#34A853'},
    {x: 690,  ltr: 'R', lbl: 'GOOGLE LCS', col: '#9CA3AF'},
  ];
  sp.push('<text x="400" y="-8" text-anchor="middle" style="font-family:Plus Jakarta Sans,sans-serif;font-size:8px;font-weight:700;fill:#9CA3AF;letter-spacing:0.12em;">TRAFFIC SOURCES</text>');
  tSrcs.forEach(function(t) {
    sp.push('<circle cx="' + t.x + '" cy="26" r="16" fill="' + t.col + '"/>');
    sp.push('<text x="' + t.x + '" y="31" text-anchor="middle" style="font-family:Plus Jakarta Sans,sans-serif;font-size:11px;font-weight:800;fill:#fff;">' + t.ltr + '</text>');
    sp.push('<text x="' + t.x + '" y="52" text-anchor="middle" style="font-family:Plus Jakarta Sans,sans-serif;font-size:7px;fill:#9CA3AF;letter-spacing:0.06em;">' + t.lbl + '</text>');
    // Each source drops a short line down to the traffic bar at y=60
    sp.push('<line x1="' + t.x + '" y1="42" x2="' + t.x + '" y2="60" stroke="#E0E0E0" stroke-width="1"/>');
  });

  // TRAFFIC BAR — horizontal line connecting all source drops
  sp.push('<line x1="110" y1="60" x2="690" y2="60" stroke="#D2D2D7" stroke-width="1.5"/>');
  // Single arrow from bar center down to HOME
  sp.push('<line x1="400" y1="60" x2="400" y2="73" stroke="#9CA3AF" stroke-width="1.5" marker-end="url(#sm-arr)"/>');

  // HOME wireframe (large, centered, orange accent) — y=75
  sp.push(smWF(400, 75, 80, 96, true));
  sp.push('<text x="400" y="182" text-anchor="middle" style="font-family:Plus Jakarta Sans,sans-serif;font-size:10px;font-weight:800;fill:#1D1D1F;">Home Page</text>');

  // Branch wireframes — same top-y as HOME (y=75), spread wide
  var branches = [
    {cx: 110,  items: smSvcList,                                                                           lbl: 'Service Pages',      accent: false},
    {cx: 255,  items: [smCityName + ' (Main)', 'Surrounding Cities', 'Service Areas', 'County Pages'],    lbl: 'Location Pages',     accent: false},
    {cx: 545,  items: ['All Projects', (smSvcList[0]||'Service') + ' Gallery', (smSvcList[1]||'Service') + ' Gallery', 'Before &amp; After'], lbl: 'Portfolio', accent: false},
    {cx: 690,  items: ['Contact Us', 'Quote Request', 'Emergency Line', 'Book Online'],                    lbl: 'Contact &amp; Convert', accent: true},
  ];
  branches.forEach(function(b) {
    sp.push(smWF(b.cx, 75, 70, 96, b.accent));
    sp.push('<text x="' + b.cx + '" y="182" text-anchor="middle" style="font-family:Plus Jakarta Sans,sans-serif;font-size:9.5px;font-weight:800;fill:' + (b.accent ? '#F56300' : '#1D1D1F') + ';">' + b.lbl + '</text>');
    b.items.slice(0, 4).forEach(function(item, j) {
      var txt = (item + '').length > 20 ? (item + '').substring(0, 19) + '\u2026' : item + '';
      sp.push('<circle cx="' + (b.cx - 18) + '" cy="' + (191 + j * 11) + '" r="2" fill="' + (b.accent ? '#F56300' : '#9CA3AF') + '"/>');
      sp.push('<text x="' + (b.cx - 13) + '" y="' + (194.5 + j * 11) + '" style="font-family:Plus Jakarta Sans,sans-serif;font-size:7.5px;fill:#636366;">' + txt + '</text>');
    });
    sp.push('<circle cx="' + (b.cx - 18) + '" cy="233" r="2" fill="#CCCCCC"/>');
    sp.push('<text x="' + (b.cx - 13) + '" y="236.5" style="font-family:Plus Jakarta Sans,sans-serif;font-size:7px;fill:#BBBBBB;font-style:italic;">* etc., etc.</text>');
  });

  // Connecting arrows HOME → branches
  sp.push('<line x1="360" y1="115" x2="145" y2="115" stroke="#D2D2D7" stroke-width="1.25" marker-end="url(#sm-arr)"/>');
  sp.push('<line x1="360" y1="127" x2="290" y2="127" stroke="#D2D2D7" stroke-width="1.25" marker-end="url(#sm-arr)"/>');
  sp.push('<line x1="440" y1="127" x2="510" y2="127" stroke="#D2D2D7" stroke-width="1.25" marker-end="url(#sm-arr)"/>');
  sp.push('<line x1="440" y1="115" x2="655" y2="115" stroke="#D2D2D7" stroke-width="1.25" marker-end="url(#sm-arr)"/>');

  // Cross-section orange lines — drawn in GAPS between wireframes only (not through them)
  // Wireframe X ranges: Service(75-145), Location(220-290), HOME(360-440), Portfolio(510-580), Contact(655-725)
  // Gap segments: 145→220, 290→360, 440→510, 580→654(with arrow)
  var spBack = [];
  // Service Pages → Contact (y=138): 3 gap segments + final segment with arrow
  spBack.push('<line x1="145" y1="138" x2="220" y2="138" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2"/>');
  spBack.push('<line x1="290" y1="138" x2="360" y2="138" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2"/>');
  spBack.push('<line x1="440" y1="138" x2="510" y2="138" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2"/>');
  spBack.push('<line x1="580" y1="138" x2="649" y2="138" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2" marker-end="url(#sm-arr-o)"/>');
  // Location Pages → Contact (y=148): 2 gap segments + final
  spBack.push('<line x1="290" y1="148" x2="360" y2="148" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2"/>');
  spBack.push('<line x1="440" y1="148" x2="510" y2="148" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2"/>');
  spBack.push('<line x1="580" y1="148" x2="649" y2="148" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2" marker-end="url(#sm-arr-o)"/>');
  // Portfolio → Contact (y=158): 1 gap segment + final
  spBack.push('<line x1="580" y1="158" x2="649" y2="158" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2" marker-end="url(#sm-arr-o)"/>');
  // About/Trust L-path: runs at x=710 (outside all wireframes) so no masking needed
  spBack.push('<path d="M400,328 L400,348 L710,348 L710,172" fill="none" stroke="#F56300" stroke-width="0.75" stroke-dasharray="3 2" marker-end="url(#sm-arr-o)"/>');

  // ABOUT / TRUST — single wireframe, arrow from HOME bottom, label + bullets to the right
  var aY = 232;
  var aRX = 441;
  sp.push('<line x1="400" y1="171" x2="400" y2="' + aY + '" stroke="#D2D2D7" stroke-width="1.25" stroke-dasharray="4 3" marker-end="url(#sm-arr)"/>');
  sp.push(smWF(400, aY, 70, 96, false));
  sp.push('<text x="' + aRX + '" y="' + (aY + 14) + '" style="font-family:Plus Jakarta Sans,sans-serif;font-size:9.5px;font-weight:800;fill:#1D1D1F;">About / Trust</text>');
  ['History', 'Reviews &amp; Testimonials', 'Licensing &amp; Certifications', 'Team', 'Warranties / Guarantees'].forEach(function(item, j) {
    sp.push('<circle cx="' + (aRX + 6) + '" cy="' + (aY + 25 + j * 11) + '" r="2" fill="#9CA3AF"/>');
    sp.push('<text x="' + (aRX + 12) + '" y="' + (aY + 28.5 + j * 11) + '" style="font-family:Plus Jakarta Sans,sans-serif;font-size:7.5px;fill:#636366;">' + item + '</text>');
  });
  sp.push('<circle cx="' + (aRX + 6) + '" cy="' + (aY + 25 + 5 * 11) + '" r="2" fill="#CCCCCC"/>');
  sp.push('<text x="' + (aRX + 12) + '" y="' + (aY + 28.5 + 5 * 11) + '" style="font-family:Plus Jakarta Sans,sans-serif;font-size:7px;fill:#BBBBBB;font-style:italic;">* etc., etc.</text>');

  const sitemapHtml = '<div style="margin-top:24px;background:var(--gray-5);border-radius:12px;padding:20px 24px;">'
    + '<div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--orange);margin-bottom:14px;">Your Site Architecture — At a Glance</div>'
    + '<svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;background:#fff;border-radius:8px 8px 0 0;padding:12px 16px;">'
    + '<g transform="translate(0,20)">'
    + spBack.join('')
    + sp.join('')
    + '</g>'
    + '</svg>'
    + '<div style="background:#fff;border-radius:0 0 8px 8px;padding:10px 16px;text-align:center;border-top:1px solid #F5F5F7;">'
    + '<span style="font-size:9px;color:#9CA3AF;font-style:italic;">Sample architecture only — final sitemap confirmed during kickoff</span>'
    + '</div>'
    + '</div>';


  // Offer H2
  const offerH2 = isRGS
    ? 'A complete marketing program.<br><em>One monthly price.</em>'
    : isWO
    ? 'Targeted improvements.<br><em>Real business gains.</em>'
    : 'A complete digital presence.<br><em>One clear price.</em>';

  // Process steps + timeline
  const newWebsiteSteps = '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Discovery Call (30 min)</h3><p>We learn about your business, your service area, your service types, and your goals. No fluff — just the information we need to build something that works for your specific market.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-content"><h3>Strategy &amp; Site Architecture</h3><p>We map out your site structure, service pages, and conversion flows before we touch design. Built around how customers search for and evaluate your services, not how agencies think.</p></div></div><div class="step"><div class="step-num">3</div><div class="step-content"><h3>Design &amp; Development</h3><p>Your site is built on our proven semi-custom framework — which means it moves faster than a fully custom build without sacrificing quality. Award-winning UX, your brand, your market.</p></div></div><div class="step"><div class="step-num">4</div><div class="step-content"><h3>Launch &amp; SEO Foundation</h3><p>We launch with Local SEO, schema markup, Google Business Profile optimization, and tracking in place from day one. You\'re not starting from zero.</p></div></div><div class="step"><div class="step-num">5</div><div class="step-content"><h3>RGS Program Kicks In</h3><p>Month one of your digital marketing program starts. Google Ads, Local SEO, and AI search visibility — all running, all tracked, all reported monthly. Watch the leads come in.</p></div></div>';
  const woSteps = '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Kickoff Call (30 min)</h3><p>We review the audit findings together, confirm priorities, and align on the highest-impact improvements for your market and goals. No fluff — just a clear plan.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-content"><h3>Schema &amp; Structured Data</h3><p>We implement schema markup across key pages so search engines and AI platforms accurately understand your services, service areas, and business details.</p></div></div><div class="step"><div class="step-num">3</div><div class="step-content"><h3>Location &amp; Service Page Updates</h3><p>Priority pages get updated with hyper-specific, locally relevant content — improving geographic targeting, keyword alignment, and semantic clarity across your top markets.</p></div></div><div class="step"><div class="step-num">4</div><div class="step-content"><h3>On-Page SEO Fixes</h3><p>Metadata, page titles, low-content pages, readability issues, and crawlability improvements addressed systematically from the audit findings.</p></div></div><div class="step"><div class="step-num">5</div><div class="step-content"><h3>RGS Program Kicks In</h3><p>Month one of your digital marketing program starts. Google Ads, Local SEO, AI visibility optimization — all running, all tracked, all reported monthly. Watch the leads come in.</p></div></div>';
  let rgsOnlySteps = '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Kickoff &amp; Strategy Call (30 min)</h3><p>We learn your business, your service area, your priority services, and your goals — then align on target markets and where your marketing budget works hardest. No fluff, just a clear plan.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-content"><h3>Tracking &amp; Campaign Setup</h3><p>Conversion tracking, analytics, and lead attribution get configured first — so every lead is measurable from day one. Then we build your Google Ads campaigns around your services and service area.</p></div></div><div class="step"><div class="step-num">3</div><div class="step-content"><h3>Local SEO, Content &amp; AI Visibility Foundation</h3><p>Google Business Profile optimization, structured data, service-area targeting, and content updates to your existing site\'s priority pages — plus GEO optimization so your business shows up in Google AI Overviews and ChatGPT answers.</p></div></div><div class="step"><div class="step-num">4</div><div class="step-content"><h3>Campaigns Go Live</h3><p>Ads start running, local visibility climbs, and leads begin flowing. We monitor closely in the first weeks and tune targeting, budgets, and messaging based on real performance.</p></div></div><div class="step"><div class="step-num">5</div><div class="step-content"><h3>Monthly Reporting &amp; Optimization</h3><p>Every month you get a clear report — leads, traffic, ad performance, rankings, and ROI. We review what\'s working, adjust what isn\'t, and keep pushing the program forward. No set-it-and-forget-it.</p></div></div>';
  if (isOtherVertical) {
    rgsOnlySteps = rgsOnlySteps
      .replace('your service area, your priority services', 'your markets, your priority offerings')
      .replace('around your services and service area', 'around your offerings and target markets')
      .replace('service-area targeting', 'geographic targeting');
  }
  const processStepsHtml = isRGS ? rgsOnlySteps : isWO ? woSteps : newWebsiteSteps;
  const processTimeline = isRGS ? '2–3 Weeks to Launch' : isWO ? '2–4 Weeks' : '6-10 Weeks';
  const processH2 = isRGS
    ? 'From kickoff call to<br><em>leads — fast.</em>'
    : 'From discovery call to<br><em>next project — fast.</em>';
  const processLead = isRGS
    ? 'No drawn-out onboarding. Your program gets configured, tracked, and live in weeks — and you see exactly what it\'s doing every single month.'
    : adjustForMarketType(v.process_lead);

  // WO built_lead override
  const builtLead = isWO
    ? adjustForMarketType('Your website content should evolve with your long term digital marketing program. We offer content enhancements to grow with the specific buyer journey of a homeowner evaluating contractors — and every element is built to convert that search into a booked estimate:')
    : v.built_lead;

  // Program summary block: single-program proposals keep a plain summary line;
  // multi-program proposals become "Select Your Options" with client-checkable
  // boxes (live on the hosted page and recorded with the acceptance; printable
  // as tick-boxes on paper). Hosting rides with the website option.
  const hostingNote = hp > 0 ? ' + ' + fmt(hp) + '/m hosting' : '';
  const progOptRow = (key, label, checked, mprice, oprice) =>
    '<label class="prog-opt" title="You can select one or both programs" style="display:flex; align-items:center; gap:10px; cursor:pointer; margin-top:8px;">'
    + '<input type="checkbox" class="prog-opt-check" data-opt="' + key + '" data-label="' + label.replace(/"/g, '&quot;') + '" data-mprice="' + (mprice || 0) + '" data-oprice="' + (oprice || 0) + '"' + (checked ? ' checked' : '') + ' style="width:15px; height:15px; accent-color:#F56300; flex-shrink:0;">'
    + '<span style="font-size:13px; color:var(--white); font-weight:500;">' + label + '</span>'
    + '</label>';
  // Live monthly total: programs' recurring portions (hosting rides with the website
  // option; the 0% build financing is NOT monthly-recurring) + any checked add-ons.
  // The server-injected script on hosted pages re-computes this as boxes change.
  const monthlyTotalLine = (initial, base) =>
    '<span id="monthly-total" data-base="' + (base || 0) + '" style="display:none;"></span>';
  let programSummaryBlock;
  if (isRGS) {
    programSummaryBlock = '<div style="flex:1; min-width:280px;">'
      + '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.6); margin-bottom:4px;">Program Summary</div>'
      + '<div style="font-size:13px; color:var(--white); font-weight:500;">RGS program @ ' + fmt(rp) + '/m &nbsp;·&nbsp; 3-month minimum, then month-to-month</div>'
      + monthlyTotalLine(rp, rp)
      + '</div>';
  } else {
    const websiteLabel = isWO
      ? fmt(wp) + ' — Website Updates (Work Order)' + hostingNote
      : fmt(wp) + ' — New Website Project (0% interest plan)' + hostingNote;
    const rgsLabel = fmt(rp) + '/m — RGS Marketing Program' + (optional ? ' (optional)' : '');
    const initialMonthly = hp + (optional ? 0 : rp); // website checked by default; add-ons start unchecked
    programSummaryBlock = '<div style="flex:1; min-width:280px;">'
      + '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.6); margin-bottom:2px;">Select Your Options</div>'
      + '<div style="font-size:10px; color:rgba(255,255,255,0.45);">Check one or both — your signature authorizes the selected options.</div>'
      + progOptRow('website', websiteLabel, true, hp, wp)
      + progOptRow('rgs', rgsLabel, !optional, rp, 0)
      + monthlyTotalLine(initialMonthly, 0)
      + '</div>';
  }


  const DOT = '<div class="include-dot"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>';
  const includesHtml = '<div class="include-grid">' + v.includes.map(item => '<div class="include-item">' + DOT + '<div>' + adjustForMarketType(item) + '</div>' + '</div>').join('') + '</div>';

  const featureCardsHtml = '<div class="three-up">' + v.feature_cards.map(([icon, title, body]) => {
    var iconPaths = FEATURE_ICONS[icon] || '';
    return '<div class="feature-card"><div style="width:36px;height:36px;border-radius:50%;background:var(--orange);display:flex;align-items:center;justify-content:center;margin-bottom:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' + iconPaths + '</svg></div><h3 style="margin:0 0 8px;font-size:13px;">' + adjustForMarketType(title) + '</h3><p>' + adjustForMarketType(body) + '</p></div>';
  }).join('') + '</div>';


  // Agreement body — website-project copy for site builds; program copy for RGS-only
  const agreementBody = isRGS
    ? ('<p style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--black);">We\'re excited to partner with you on your digital marketing program!</p>'
      + '<p style="margin-bottom:8px;">[[RGS_AGREEMENT_PARA]]</p>'
      + '<p style="margin-bottom:8px;">We\'ll manage everything outlined in the approved scope — campaign setup, tracking, website content updates, and ongoing optimization — and report results to you every month. You\'re responsible for providing access to your website, Google Business Profile, and ad accounts (or authorizing us to set them up), plus brand assets and key company information as needed.</p>'
      + '<p style="margin-bottom:8px;">Ad spend for Google, Microsoft, and other advertising campaigns is paid directly to those platforms and is separate from the monthly program fee. If you\'d like to change program scope or budget, we\'ll talk it through with you and align on next steps before moving forward.</p>'
      + '<p>This agreement follows Washington State law and helps set clear expectations so everything stays on track, but you\'ll find us very easy to work with — we share a common goal: getting your digital marketing program running ASAP to help you grow your business!</p>')
    : isWO
    ? ('<p style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--black);">We\'re excited to partner with you on your website updates and marketing program!</p>'
      + '<p style="margin-bottom:8px;"><strong>The Website Updates (Work Order)</strong> engagement includes a focused, ' + hours + '-hour scope of targeted improvements — schema markup, location and service page content, metadata, and on-page SEO fixes. The total work order investment is <strong>[[WEBSITE_PRICE]]</strong>, with a <strong>[[DEP1]]</strong> deposit (50%) to get started and the remaining <strong>[[DEP2]]</strong> (50%) due at the 45-day milestone.</p>'
      + (hp > 0 ? '<p style="margin-bottom:8px;">We\'ll also migrate your existing website to efelle\'s hosting platform — ongoing hosting, support &amp; CMS updates + mgt services are <strong>' + fmt(hp) + '/m</strong>, starting upon migration.</p>' : '')
      + '<p style="margin-bottom:8px;">[[RGS_AGREEMENT_PARA]]</p>'
      + '<p style="margin-bottom:8px;">We\'ll deliver everything outlined in the approved scope and keep the work moving forward with clear milestones. You\'re responsible for providing access to your website and the info we need to complete the updates — including brand assets, photos, and key company information — and for having the rights to use any photos provided.</p>'
      + '<p style="margin-bottom:8px;">If you change the scope (like adding new work, shifting direction after approvals, or pausing the engagement) it will affect the timeline &amp; potentially the cost. It\'s rare, but if that happens, we\'ll talk it through with you and align on next steps before moving forward.</p>'
      + '<p style="margin-bottom:8px;">You retain full ownership of your website and content.</p>'
      + '<p>This agreement follows Washington State law and helps set clear expectations so everything stays on track, but you\'ll find us very easy to work with — we share a common goal, getting your website updates completed &amp; digital marketing program running ASAP to help you grow your business!</p>')
    : ('<p style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--black);">We\'re excited to partner with you on your new website and marketing program!</p>'
      + '<p style="margin-bottom:8px;"><strong>The Website Project</strong> component includes design, development, CMS setup &amp; integration, copywriting and site launch services + ongoing mgt, hosting &amp; support. The total website project investment is <strong>[[WEBSITE_PRICE]]</strong>, with a <strong>[[DEP1]]</strong> deposit to get started and the remaining balance spread over 24 months at <strong>[[MONTHLY_PAY]]/m</strong>, interest-free.</p>'
      + (hp > 0 ? '<p style="margin-bottom:8px;">Ongoing hosting, support &amp; CMS updates + mgt services are <strong>[[HOSTING_PRICE_MO]]</strong>, starting upon site launch.</p>' : '')
      + '<p style="margin-bottom:8px;">[[RGS_AGREEMENT_PARA]]</p>'
      + '<p style="margin-bottom:8px;">We\'ll deliver everything outlined in the approved scope and keep the project moving forward with clear milestones and review rounds. We will create most of the website copywriting and imagery, but you\'re responsible for providing info we need to build your site — including your logo, brand assets, photos, and key company information — and for having the rights to use any photos provided.</p>'
      + '<p style="margin-bottom:8px;">If you change project scope (like adding new features, shifting direction after approvals, reorganizing content, requesting extra revisions, or pausing the project) it will affect the timeline &amp; potentially the cost. It\'s rare, but if that happens, we\'ll talk it through with you and align on next steps before moving forward.</p>'
      + '<p style="margin-bottom:8px;">Once your project is fully paid you will own the website and content.</p>'
      + '<p>This agreement follows Washington State law and helps set clear expectations so everything stays on track, but you\'ll find us very easy to work with — we share a common goal, getting your new website built &amp; digital marketing program setup ASAP to help you grow your business!</p>');

  const tokens = {
    '[[PAGE_TITLE]]':           clientName + (isRGS ? ' | Digital Marketing Proposal | ' : ' | Website Proposal | ') + 'efelle creative',
    '[[CLIENT_NAME]]':          clientName,
    '[[CONTACT_NAME]]':         contact,
    '[[HERO_BADGE_TEXT]]':      clientName && contact ? clientName + ' // ' + contact : (clientName || contact || ''),
    '[[DATE]]':                 dateStr,
    '[[HERO_H1]]':              adjustForMarketType(v.hero_h1),
    '[[HERO_ICON]]':            v.hero_icon || '',
    '[[HERO_SUB]]':             isRGS
      ? 'We run fully managed digital marketing programs — Google PPC Ads, Local SEO, AI search visibility, and website content updates — backed by 21 years of effective, award-winning work. We handle the complete program so you can focus on running your business.'
      : adjustForMarketType(v.hero_sub),
    '[[ABOUT_P1]]':             about1,
    '[[ABOUT_P2]]':             about2,
    '[[CLIENT_LOGO]]':          logoHtml,
    '[[CLIENT_ADDRESS]]':       addressTwoLine || '',
    '[[PROPOSAL_NO]]':          propNumber,
    '[[CLIENT_PHONE]]':         phone || '',
    '[[CLIENT_WEBSITE]]':       website ? website.replace(/https?:\/\//,'').replace(/\/$/, '') : '',
    '[[ADDRESS]]':              addressHtml,
    '[[SOW_P1]]':               sow1,
    '[[SOW_P2]]':               sow2,
    '[[SOW_P3]]':               sow3,
    '[[SOW_P4]]':               sow4,
    '[[SOW_P5_BLOCK]]':         sow5 ? '<p style="font-size:12px; color:var(--gray-1); line-height:1.75; margin-top:14px;">' + sow5 + '</p>' : '',
    '[[OFFER_H2]]':             offerH2,
    '[[OFFER_LEAD]]':           offerLead,
    '[[OFFER_TEXT]]':           adjustForMarketType(offerFull),
    '[[OFFER_PRICE_LABEL]]':    offerPriceLabel,
    '[[OFFER_SECONDARY_BLOCK]]':offerSecondaryBlock,
    '[[PAYMENT_ROWS]]':         paymentRows,
    '[[AGREEMENT_BODY]]':       agreementBody,
    '[[INCLUDES_GRID]]':        (isWO || isRGS) ? '' : includesHtml,
    '[[RGS_BADGE]]':            rgsBadge,
    '[[RGS_H2]]':               rgsH2,
    '[[RGS_LEAD]]':             adjustForMarketType(rgsLead),
    '[[RGS_MAIN_CARDS]]':       adjustForMarketType(rgsMainCards),
    '[[RGS_ADDON_CARDS]]':      adjustForMarketType(rgsAddonCards),
    '[[RGS_PRICE]]':            liveRgs,
    '[[RGS_AGREEMENT_PARA]]':   isRGS
      ? 'This proposal covers our <strong>Revenue Growth Service (RGS)</strong>, a fully managed digital marketing program at <strong>' + fmt(rp) + '/month</strong> focused on increasing visibility, driving qualified traffic, and improving lead generation for your existing website. RGS runs with a three-month minimum term, then continues month-to-month with 30 days\' notice to cancel.'
      : optional
      ? 'As an optional service, this proposal includes our <strong>Revenue Growth Service (RGS)</strong>, a managed digital marketing program at <strong>' + fmt(rp) + '/month</strong> focused on increasing visibility, driving qualified traffic, and improving lead generation. RGS runs month-to-month with a three-month minimum term and 30 days\' notice to cancel.'
      : 'During the project efelle will build out and begin managing its <strong>Revenue Growth Service (RGS)</strong>, a managed digital marketing program at <strong>' + fmt(rp) + '/month</strong> focused on increasing visibility, driving qualified traffic, and improving lead generation. RGS runs as a monthly engagement with a three-month minimum term, then continues month-to-month with 30 days\' notice to cancel.',
    '[[RGS_FROM]]':             (!isWO && optional) ? '<span style="font-size:16px; font-weight:400; color:var(--gray-2);">from </span>' : '',
    '[[WEBSITE_PRICE]]':        offerHeadlinePrice,
    '[[HOSTING_PRICE]]':        fmt(hp),
    '[[HOSTING_PRICE_MO]]':     fmt(hp) + '/m',
    '[[RGS_PAYMENT_ROW]]':      '',
    '[[DEP1]]':                 fmt(d1),
    '[[MONTHLY_PAY]]':          monthlyPay,
    '[[DEP2]]':                 fmt(d2),
    '[[MONTHLY40]]':            '$' + Math.round(m50).toLocaleString() + '/m',
    '[[PROGRAM_SUMMARY_BLOCK]]': programSummaryBlock,
    '[[AUTH_LEAD]]':            isRGS
      ? 'By signing below, you authorize efelle creative to begin work as outlined above. Our team will reach out ASAP to schedule your kickoff call and go to work for you!'
      : 'By signing below, you authorize efelle creative to begin work on the program options selected below. Our team will reach out ASAP to schedule your kickoff call and go to work for you!',
    '[[WHY_LEAD]]':             adjustForMarketType(v.why_lead),
    '[[WHY_INTRO]]':            adjustForMarketType(v.why_intro),
    '[[STATS_LABEL]]':          adjustForMarketType(v.stats_label),
    '[[STATS_INDUSTRY]]':       adjustForMarketType(v.stats_industry),
    '[[WHY_CLOSING]]':          adjustForMarketType(v.why_closing),
    '[[PORTFOLIO_H2]]':         adjustForMarketType(v.portfolio_h2),
    '[[PORTFOLIO_LEAD]]':       adjustForMarketType(v.portfolio_lead),
    '[[PORTFOLIO_IMG1]]':       p1,
    '[[PORTFOLIO_IMG2]]':       p2,
    '[[PORTFOLIO_IMG3_BLOCK]]': p3 ? '<div style="border:1px solid var(--gray-4);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><img src="' + p3 + '" alt="' + clientName + ' portfolio" style="width:100%;height:auto;display:block;"></div>' : '',
    '[[PORTFOLIO_IMG4_BLOCK]]': p4 ? '<div style="border:1px solid var(--gray-4);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><img src="' + p4 + '" alt="' + clientName + ' portfolio" style="width:100%;height:auto;display:block;"></div>' : '',
    '[[PROCESS_H2]]':           processH2,
    '[[PROCESS_LEAD]]':         processLead,
    '[[PROCESS_STEPS_HTML]]':   processStepsHtml,
    '[[PROCESS_TIMELINE]]':     processTimeline,
    '[[BUILT_BADGE]]':          adjustForMarketType(v.built_badge),
    '[[BUILT_H2]]':             adjustForMarketType(v.built_h2),
    '[[BUILT_LEAD]]':           adjustForMarketType(builtLead),
    '[[FEATURE_CARDS]]':        featureCardsHtml,
    '[[SITEMAP_HTML]]':         sitemapHtml,
    '[[EXPIRY]]':               expiry,
  };

  let html = PROPOSAL_TEMPLATE;
  for (const [token, value] of Object.entries(tokens)) {
    html = html.split(token).join(value);
  }


  if (optional) {
    const rgsStart = html.indexOf('<!-- ═══ DIGITAL MARKETING ═══ -->');
    const rgsEnd   = html.indexOf('\n\n<!-- WHY EFELLE -->');
    if (rgsStart >= 0 && rgsEnd >= 0) {
      const rgsBlock = html.slice(rgsStart, rgsEnd);
      html = html.slice(0, rgsStart) + html.slice(rgsEnd);
      const authPos = html.indexOf('<!-- PROJECT AGREEMENT + AUTHORIZATION');
      if (authPos >= 0) html = html.slice(0, authPos) + rgsBlock + '\n\n' + html.slice(authPos);
    }
  }

  if (isRGS) {
    // No website build in scope: drop the website portfolio + "Built For" (feature cards & site
    // architecture) sections, and the 3-month build calendar inside the process timeline box.
    // If RGS case studies are configured, they take the portfolio's place — same
    // image-card format as the website portfolio, two graphics per printed page.
    const csPages = [];
    for (let i = 0; i < activeCaseStudies.length; i += 2) csPages.push(activeCaseStudies.slice(i, i + 2));
    const csCard = cs => '<div class="cs-img-card" style="border:1px solid var(--gray-4); border-radius:14px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);"><img src="' + cs.img + '" alt="' + (cs.client || 'efelle RGS case study') + '" style="width:100%; height:auto; display:block;"></div>';
    const caseSection = csPages.length
      ? csPages.map((page, idx) =>
          '<div class="section case-study-page" id="sec-case-' + (idx + 1) + '">'
          + '<span class="section-badge">Digital Marketing Results</span>'
          + (idx === 0
            ? '<h2>Real programs.<br><em>Real growth.</em></h2><p class="lead">A few of the businesses running our Revenue Growth Service — and the results the program has generated for them.</p>'
            : '')
          + '<div style="display:flex; flex-direction:column; gap:24px; margin-top:' + (idx === 0 ? '28px' : '16px') + ';">'
          + page.map(csCard).join('')
          + '</div></div>').join('\n\n') + '\n\n'
      : '';
    const pStart = html.indexOf('<!-- PORTFOLIO -->');
    const pEnd   = html.indexOf('<!-- HOW IT WORKS -->');
    if (pStart >= 0 && pEnd >= 0) html = html.slice(0, pStart) + caseSection + html.slice(pEnd);
    // Swap the website build calendar for an RGS program launch strip
    const rgsPhases = [
      ['WK 1', 'Kickoff &amp; Strategy', false],
      ['WK 1–2', 'Tracking &amp; Campaign Build', false],
      ['WK 2–3', 'SEO, Content &amp; GEO Foundation', false],
      ['WK 3', 'Campaigns Go Live', true],
      ['ONGOING', 'Optimize &amp; Report Monthly', true],
    ];
    const phaseStrip = '<div style="border-top:1px solid var(--gray-4); padding-top:20px;">'
      + '<div style="font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--orange); margin-bottom:16px; text-align:center;">Program Launch Timeline — At a Glance</div>'
      + '<div style="display:flex; gap:10px; align-items:stretch;">'
      + rgsPhases.map(p =>
          '<div style="flex:1; border-radius:8px; padding:12px 10px; text-align:center; '
          + (p[2] ? 'background:#FFF4EE; border:1.5px solid #F56300;' : 'background:#F5F5F7; border:1px solid #D2D2D7;')
          + '"><div style="font-size:8px; font-weight:700; letter-spacing:0.08em; color:' + (p[2] ? '#F56300' : '#636366') + ';">' + p[0] + '</div>'
          + '<div style="font-size:9.5px; font-weight:600; color:' + (p[2] ? '#F56300' : '#3A3A3C') + '; margin-top:6px; line-height:1.4;">' + p[1] + '</div></div>').join('')
      + '</div></div>';
    const cStart = html.indexOf('<!-- BUILD_CALENDAR_START -->');
    const cEnd   = html.indexOf('<!-- BUILD_CALENDAR_END -->');
    if (cStart >= 0 && cEnd >= 0) html = html.slice(0, cStart) + phaseStrip + html.slice(cEnd + '<!-- BUILD_CALENDAR_END -->'.length);
    // The RGS-only card grid (7 cards) fills a full printed page — push the
    // add-ons + ROI band to the next page so the ROI band isn't stranded alone.
    html = html.replace('</style>', '@media print { #rgs-addons { break-before:page; page-break-before:always; } }\n</style>');
  }

  // ── Structured client + payment terms for the Command Center handoff ──
  // Dollar amounts are NOT stored here — the server reads them from the
  // signed doc's own option checkboxes at accept time (data-oprice /
  // data-mprice, which syncPricingData keeps true through AI edits). This
  // marker carries only what the doc lacks in structured form: who the
  // client is and the payment structure of the build.
  const ccOffer = {
    v: 1,
    type: propType,
    depositPct: 50,
    installments: (isWO || isRGS) ? 0 : 24,
    hours: hours,
    contact: contact,
    email: (document.getElementById('prop-contact-email').value.split(/[,;\s]+/)[0] || '').trim().toLowerCase(),
    street: propAddrVal('prop-address'),
    city: propAddrVal('prop-city'),
    state: propAddrVal('prop-state').toUpperCase(),
    zip: propAddrVal('prop-zip'),
    phone: phone,
    website: website,
  };
  const ccMarker = '<div id="efelle-offer-data" style="display:none" data-offer="'
    + JSON.stringify(ccOffer).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></div>';
  html = html.includes('</body>') ? html.replace('</body>', () => ccMarker + '</body>') : html + ccMarker;
  return html;
}

async function propGenerate() {
  if (!propVertical || !VERTICALS[propVertical]) {
    const errEl = document.getElementById('error-msg-prop');
    errEl.textContent = '⚠ Please go back and select an industry vertical first.'; errEl.style.display = 'block'; return;
  }
  const clientName = document.getElementById('prop-name').value.trim();
  if (!clientName) {
    const errEl = document.getElementById('error-msg-prop');
    errEl.textContent = '⚠ Company name is required.'; errEl.style.display = 'block'; return;
  }
  document.getElementById('error-msg-prop').style.display = 'none';
  document.getElementById('prop-generate-btn').disabled = true;
  document.getElementById('prop-generate-btn').textContent = '⟳ Building…';

  const progress = document.getElementById('prop-gen-progress');
  const fill = document.getElementById('prop-gen-fill');
  const msg  = document.getElementById('prop-gen-msg');
  const pct  = document.getElementById('prop-gen-pct');
  progress.classList.add('visible');

  const stages = [
    { p: 20, m: 'Assembling proposal structure…', d: 400 },
    { p: 55, m: 'Filling in client content…',     d: 900 },
    { p: 85, m: 'Applying vertical template…',    d: 1400 },
    { p: 100, m: 'Proposal ready.',                d: 1800 },
  ];
  stages.forEach(s => setTimeout(() => { fill.style.width = s.p + '%'; pct.textContent = s.p + '%'; msg.textContent = s.m; }, s.d));

  setTimeout(async () => {
    try {
      // Pick up the server-managed case-study list (falls back to bundled defaults)
      activeCaseStudies = await loadActiveCaseStudies();
      activePortfolios = await loadActivePortfolios();
      // Analyze the client logo (white-heavy logos get a dark backdrop) and host it
      // on our server — a small URL in the file instead of an embedded base64 blob.
      propLogoInfo = null;
      const logoFieldUrl = document.getElementById('prop-logo').value.trim();
      if (logoFieldUrl) {
        const dataUri = logoFieldUrl.startsWith('data:') ? logoFieldUrl : await fetchLogoDataUri(logoFieldUrl);
        if (dataUri) {
          const whiteRatio = await analyzeLogoWhiteness(dataUri);
          const hostedUrl = await uploadLogoToServer(dataUri);
          // Fallback order: our hosted copy > the client's original URL (never base64,
          // unless a data URI was pasted directly and hosting it failed)
          const src = hostedUrl || (logoFieldUrl.startsWith('data:') ? dataUri : null);
          // Manual Logo Background choice overrides the white-pixel auto-detection
          const dark = propLogoBg === 'dark' ? true : propLogoBg === 'light' ? false : whiteRatio >= 0.25;
          propLogoInfo = { src, dark };
        }
      }
      const html = propBuildHTML(clientName);
      propReportHtml = html;
      progress.classList.remove('visible');
      document.querySelectorAll('.prop-stage').forEach(s => s.classList.remove('active'));
      document.getElementById('prop-stage-3').classList.add('active');
      const frame = document.getElementById('prop-report-frame');
      await writeToFrame(frame, html);
      bindPreviewPricing();
      const lblEl = document.getElementById('prop-preview-label');
      if (lblEl && propNumber) lblEl.textContent = 'Proposal // ' + propNumber;

      // If this company already has a published link, surface its status and
      // push the freshly generated version to it (no-op if signed/locked)
      document.getElementById('prop-publish-panel').style.display = 'none';
      refreshPublishStatus();
      autoRepublish();

      // Populate propClientData from form fields for saving
      propClientData = {
        company_name: clientName,
        url: document.getElementById('prop-client-url').value.trim(),
        contact: document.getElementById('prop-contact').value.trim(),
        contact_email: document.getElementById('prop-contact-email').value.trim().toLowerCase(),
        location: propCityState(),
        address: propFullAddress(),
        street: propAddrVal('prop-address'),
        city: propAddrVal('prop-city'),
        state: propAddrVal('prop-state').toUpperCase(),
        zip: propAddrVal('prop-zip'),
        phone: document.getElementById('prop-phone').value.trim(),
        services: document.getElementById('prop-services').value.trim(),
        area: document.getElementById('prop-area').value.trim(),
        founded: document.getElementById('prop-founded').value.trim(),
        differentiators: document.getElementById('prop-differentiators').value.trim(),
        logo: document.getElementById('prop-logo').value.trim(),
        logo_bg: propLogoBg,
      };
      try {
        await saveReport('prop', clientName, {
          vertical: propVertical,
          type: propType,
          marketType: propMarketType,
          rgs: propRGS,
          number: propNumber,
          prices: {
            website: document.getElementById('price-website').value,
            hosting: document.getElementById('price-hosting').value,
            hours: document.getElementById('price-hours').value,
            rgs: document.getElementById('price-rgs').value,
          },
        }, propClientData, propReportHtml).then(saved => {
          if (saved && saved.id) propSavedReportId = saved.id;
        });
      } catch (e) { console.warn('Auto-save failed:', e.message); }

    } catch(e) {
      progress.classList.remove('visible');
      const errEl = document.getElementById('error-msg-prop');
      errEl.textContent = '⚠ ' + (e.message || 'Build failed. Please try again.');
      errEl.style.display = 'block';
    }
    document.getElementById('prop-generate-btn').disabled = false;
    document.getElementById('prop-generate-btn').textContent = 'Build Proposal →';
  }, 2000);
}

document.getElementById('prop-download-btn').addEventListener('click', () => {
  if (!propReportHtml) return;
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yy = String(today.getFullYear()).slice(-2);
  const co = (document.getElementById('prop-name').value || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = 'efelle-proposal-' + co + '-' + mm + dd + yy + '.html';
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(propReportHtml);
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
});


document.getElementById('prop-logo-btn').addEventListener('click', () => {
  const panel = document.getElementById('prop-logo-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    document.getElementById('prop-logo-url-input').value = '';
    document.getElementById('prop-logo-file-input').value = '';
    document.getElementById('prop-logo-file-name').textContent = '';
    document.getElementById('prop-logo-status').innerHTML = '';
  }
});

let logoFileDataUrl = null;

window.toggleLogoMode = function(mode) {
  document.getElementById('logo-mode-url').classList.toggle('selected', mode === 'url');
  document.getElementById('logo-mode-upload').classList.toggle('selected', mode === 'upload');
  document.getElementById('logo-url-input-wrap').style.display = mode === 'url' ? '' : 'none';
  document.getElementById('logo-upload-input-wrap').style.display = mode === 'upload' ? '' : 'none';
};

document.getElementById('prop-logo-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('prop-logo-file-name').textContent = file.name;
  const reader = new FileReader();
  reader.onload = () => { logoFileDataUrl = reader.result; };
  reader.readAsDataURL(file);
});

window.applyLogoToProposal = async function() {
  const statusEl = document.getElementById('prop-logo-status');
  const urlMode = document.getElementById('logo-url-input-wrap').style.display !== 'none';
  let logoSrc = '';

  if (urlMode) {
    logoSrc = document.getElementById('prop-logo-url-input').value.trim();
    if (!logoSrc) {
      statusEl.innerHTML = '<span style="color:#fb923c;">Paste a logo URL first.</span>';
      return;
    }
  } else {
    if (!logoFileDataUrl) {
      statusEl.innerHTML = '<span style="color:#fb923c;">Choose an image file first.</span>';
      return;
    }
    // Host the uploaded file on our server so the proposal stays small; only
    // fall back to embedding the file directly if the upload fails.
    statusEl.innerHTML = '<span style="color:#9ca3af;">Uploading logo…</span>';
    const hosted = await uploadLogoToServer(logoFileDataUrl);
    logoSrc = hosted || logoFileDataUrl;
  }

  const frame = document.getElementById('prop-report-frame');
  const doc = frame.contentDocument || frame.contentWindow.document;

  const logoBlock = doc.getElementById('client-logo-block');
  const placeholder = doc.querySelector('[style*="dashed"]');
  const existingLogo = doc.querySelector('img[alt][style*="max-width"]');
  const target = logoBlock || placeholder || existingLogo;

  if (target) {
    const wrap = doc.createElement('div');
    wrap.id = 'client-logo-block';
    wrap.style.cssText = 'max-width:67%;';
    const img = doc.createElement('img');
    img.src = logoSrc;
    img.alt = 'Client Logo';
    img.style.cssText = 'width:100%;height:auto;display:block;';
    wrap.appendChild(img);
    target.parentNode.replaceChild(wrap, target);
  } else {
    statusEl.innerHTML = '<span style="color:#fb923c;">Could not find logo placeholder in the proposal.</span>';
    return;
  }

  propReportHtml = doc.documentElement.outerHTML;
  autoRepublish();

  statusEl.innerHTML = '<span style="color:#34d399;">✓ Logo applied.</span>';
  setTimeout(() => {
    document.getElementById('prop-logo-panel').style.display = 'none';
  }, 1000);
};

// ─── Live logo preview in the form — see exactly what the URL loads ──
// Shown on both white and dark backgrounds so white-heavy logos are visible.
let logoPreviewTimer = null;
function updateLogoPreview() {
  const wrap = document.getElementById('prop-logo-preview');
  const img = document.getElementById('prop-logo-preview-img');
  const imgDark = document.getElementById('prop-logo-preview-img-dark');
  const note = document.getElementById('prop-logo-preview-note');
  const val = document.getElementById('prop-logo').value.trim();
  if (!val) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  note.textContent = 'Loading…'; note.style.color = '#6b7a94';
  img.style.display = 'none';
  const probe = new Image();
  probe.onload = () => {
    img.src = val; imgDark.src = val; img.style.display = 'block';
    note.textContent = '✓ This is the logo that will appear in the proposal.';
    note.style.color = '#34d399';
  };
  probe.onerror = () => {
    img.style.display = 'none'; imgDark.src = '';
    note.textContent = '⚠ This URL doesn\'t load an image — fix it, or generate with the placeholder and use Edit → Add Logo.';
    note.style.color = '#fb923c';
  };
  probe.src = val;
}
window.updateLogoPreview = updateLogoPreview;
document.getElementById('prop-logo').addEventListener('input', () => {
  clearTimeout(logoPreviewTimer);
  logoPreviewTimer = setTimeout(updateLogoPreview, 600);
});

document.getElementById('prop-logo').addEventListener('change', async () => {
  if (propReportHtml) {
    const clientName = document.getElementById('prop-name').value.trim();
    if (!clientName) return;
    propReportHtml = propBuildHTML(clientName);
    await writeToFrame(document.getElementById('prop-report-frame'), propReportHtml);
    bindPreviewPricing();
  }
});

// ─── AI Chat Edit Panel ────────────────────────────────────────────
document.getElementById('prop-chat-toggle-btn').addEventListener('click', () => {
  const panel = document.getElementById('prop-chat-panel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  if (panel.style.display === 'flex') {
    document.getElementById('prop-chat-input').focus();
  }
});

document.getElementById('prop-chat-send').addEventListener('click', async () => {
  const input = document.getElementById('prop-chat-input');
  const instruction = input.value.trim();
  if (!instruction || !propReportHtml) return;

  const messagesEl = document.getElementById('prop-chat-messages');
  const sendBtn = document.getElementById('prop-chat-send');

  // Show user message
  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'background:#374151;border-radius:8px;padding:8px 12px;font-size:12px;color:#e2ddd4;align-self:flex-end;max-width:85%;';
  userMsg.textContent = instruction;
  messagesEl.appendChild(userMsg);
  input.value = '';
  sendBtn.disabled = true;
  sendBtn.textContent = '…';

  // Show thinking indicator
  const thinkMsg = document.createElement('div');
  thinkMsg.style.cssText = 'background:#252d3d;border-radius:8px;padding:8px 12px;font-size:12px;color:#9ca3af;';
  thinkMsg.textContent = 'Editing proposal…';
  messagesEl.appendChild(thinkMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    // Use find-and-replace approach so the model doesn't need to reproduce the entire HTML.
    // Strip embedded base64 images from what the model sees — they're huge and were pushing
    // everything after the About section out of the old 60K window (the model literally
    // couldn't see the agreement page). Finds never target image data, so this is safe.
    const modelView = propReportHtml.replace(/src="data:[^"]*"/g, 'src="[embedded-image]"').slice(0, 300000);
    const editorPayload = JSON.stringify({
        model: API_MODEL,
        max_tokens: 8192,
        system: `You are a proposal editor. The user gives you HTML and an edit instruction.

Return ONLY a JSON array of find-and-replace operations. Each operation has:
- "find": the exact text/HTML to find in the document, copied character-for-character
- "replace": the replacement text/HTML

Example response:
[{"find":"$4,500/m","replace":"$2,850/m"}]

Rules:
- Return ONLY the JSON array, no explanation, no markdown fences
- Every occurrence of "find" is replaced, so to change a value everywhere (e.g. a price), ONE op with the exact old text is enough
- To ADD new content, use a short exact anchor: put an existing snippet in "find" and return it in "replace" with the new content appended before/after it
- Copy "find" strings EXACTLY from the document above — including tags, attributes, entities like &amp;, and apostrophes — or they will not match
- img src values shown as "[embedded-image]" are placeholders; never include them in a "find"
- Keep all styling intact unless the user specifically asks to change it

PRICING (important): live totals are driven by data attributes (data-mprice/data-oprice/data-label on the checkbox inputs, data-base on .live-rgs-monthly spans). When the user changes a price, update it in EVERY visible location it appears — the offer panel, the payment breakdown, the RGS price band, the "Select Your Options" row labels near the signature, and the add-on rows. The app re-derives the data attributes from the visible "Select Your Options" labels and add-on row prices after your edit, so those two places are the source of truth — never leave them showing an old price. When adding a new add-on, copy an existing complete addon-row <label> element and change its title, description, price, data-opt (new unique addon_* key), data-label, and data-mprice together. A discounted display (struck-through old price next to the new price) is fine — the LAST dollar amount in the row's price cell is treated as the real price.`,
        messages: [{
          role: 'user',
          content: `Here is the current proposal HTML:\n\n${modelView}\n\nEdit instruction: ${instruction}`
        }]
      });

    // Retry on 5xx/network (e.g. a brief server redeploy) and surface the real
    // server error instead of a bare status code.
    let d = null, lastErr = '';
    for (let attempt = 1; attempt <= 3 && !d; attempt++) {
      try {
        const res = await fetch('/api/messages', { method: 'POST', headers: getApiHeaders(), body: editorPayload });
        const body = await res.json().catch(() => null);
        if (res.ok && body) { d = body; break; }
        lastErr = (body && (typeof body.error === 'string' ? body.error : (body.error && body.error.message))) || ('API error ' + (res ? res.status : '?'));
        if (res.status < 500) break; // not retryable
      } catch (e) { lastErr = 'Connection issue'; }
      if (attempt < 3) {
        thinkMsg.textContent = '⟳ Server briefly busy — retrying (' + attempt + ' of 2)…';
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!d) throw new Error(lastErr + ' — if the app just redeployed this clears in about a minute.');
    let responseText = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();

    // Clean up markdown fences and any preamble/postamble
    responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    // Extract JSON array if wrapped in extra text
    const arrStart = responseText.indexOf('[');
    const arrEnd = responseText.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      responseText = responseText.slice(arrStart, arrEnd + 1);
    }

    let replacements;
    try {
      replacements = JSON.parse(responseText);
    } catch (parseErr) {
      // Try repairing common issues: trailing commas, single quotes
      let fixed = responseText.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
      try { replacements = JSON.parse(fixed); }
      catch { throw new Error('Could not parse AI response — try a simpler edit instruction'); }
    }
    if (!Array.isArray(replacements)) throw new Error('AI returned unexpected format — try again');
    let updatedHtml = propReportHtml;
    let changeCount = 0;
    let failedCount = 0;

    // Exact match first; then retry with common entity/quote variants the model gets wrong
    const findVariant = (html, find) => {
      if (html.includes(find)) return find;
      const variants = [
        find.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;'),
        find.replace(/&amp;/g, '&'),
        find.replace(/'/g, '’'),
        find.replace(/’/g, "'"),
        find.replace(/"/g, '&quot;'),
      ];
      for (const v of variants) { if (v !== find && html.includes(v)) return v; }
      // Whitespace-flexible fallback: models sometimes normalize spacing when
      // copying long HTML blocks — match with any-whitespace-run equivalence.
      try {
        const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g');
        if (re.test(html)) return re;
      } catch (e) { /* pattern too large/invalid — give up */ }
      return null;
    };

    for (const op of replacements) {
      if (!op.find || op.replace === undefined) continue;
      const match = findVariant(updatedHtml, op.find);
      if (match) {
        // Replace EVERY occurrence — "change the price everywhere" must mean everywhere.
        // (Function replacement avoids $-pattern interpretation in the new text.)
        updatedHtml = (match instanceof RegExp)
          ? updatedHtml.replace(match, () => op.replace)
          : updatedHtml.split(match).join(op.replace);
        changeCount++;
      } else {
        failedCount++;
      }
    }

    if (changeCount === 0) throw new Error('No matching text found to replace — try quoting the exact text you see in the proposal');

    // Re-sync machine pricing attributes from the (possibly edited) visible
    // prices, then update the proposal and the live published link
    propReportHtml = syncPricingData(updatedHtml);
    await writeToFrame(document.getElementById('prop-report-frame'), propReportHtml);
    bindPreviewPricing();
    autoRepublish();

    // Honest reporting: only claim what actually landed, and flag what didn't
    if (failedCount === 0) {
      thinkMsg.textContent = '✓ ' + changeCount + ' change' + (changeCount > 1 ? 's' : '') + ' applied';
      thinkMsg.style.color = '#2dd4bf';
    } else {
      thinkMsg.textContent = '⚠ ' + changeCount + ' of ' + (changeCount + failedCount) + ' changes applied — ' + failedCount + ' couldn\'t find matching text. Try again, quoting the exact text you see in the proposal.';
      thinkMsg.style.color = '#fb923c';
    }
  } catch (e) {
    thinkMsg.textContent = '⚠ ' + (e.message || 'Failed to edit');
    thinkMsg.style.color = '#f87171';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});

// ─── Pricing sync: visible prices are the source of truth ────────────
// The AI editor changes visible text but not the machine attributes that drive
// live totals (data-mprice / data-oprice / data-label / data-base). This pass
// re-derives every attribute from the rendered rows so all three displays —
// offer panel, payment breakdown, price band — plus the sticky bar and the
// recorded acceptance always agree. The LAST dollar amount in a price cell wins,
// so discount displays (struck-through old price next to the new one) work.
function syncPricingData(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const money = (s) => {
      const m = String(s).replace(/,/g, '').match(/\$\s*(\d+)(?!(.|\n)*\$)/);
      return m ? parseInt(m[1], 10) : null;
    };
    // Add-on rows: displayed price → data-mprice; title → data-label; unique keys
    const usedKeys = new Set();
    doc.querySelectorAll('.addon-row').forEach(row => {
      const cb = row.querySelector('.prog-opt-check');
      if (!cb) return;
      const priceCell = row.querySelector('div:last-child');
      const titleEl = row.querySelector('div span');
      const p = priceCell ? money(priceCell.textContent) : null;
      if (p !== null) cb.setAttribute('data-mprice', String(p));
      const title = titleEl ? titleEl.textContent.trim() : '';
      let key = cb.getAttribute('data-opt') || '';
      if (!/^addon_[a-z0-9_]+$/.test(key) || usedKeys.has(key)) {
        key = ('addon_' + title.toLowerCase().replace(/[^a-z0-9]+/g, '_')).slice(0, 28) || 'addon_x';
        let n = 2; const base = key;
        while (usedKeys.has(key)) key = base + '_' + (n++);
        cb.setAttribute('data-opt', key);
      }
      usedKeys.add(key);
      if (title) cb.setAttribute('data-label', 'Add-on: ' + title + ' — $' + (p !== null ? p : (cb.getAttribute('data-mprice') || '0')) + '/m');
    });
    // Program rows: label text → data-label; website $X → data-oprice and
    // "+$Y/m hosting" → data-mprice; rgs $X/m → data-mprice
    doc.querySelectorAll('.prog-opt').forEach(rowLabel => {
      const cb = rowLabel.querySelector('.prog-opt-check');
      if (!cb) return;
      const span = rowLabel.querySelector('span:last-child');
      const text = (span ? span.textContent : rowLabel.textContent).trim();
      if (text) cb.setAttribute('data-label', text.slice(0, 150));
      const clean = text.replace(/,/g, '');
      if (cb.getAttribute('data-opt') === 'website') {
        const first = clean.match(/\$\s*(\d+)/);
        if (first) cb.setAttribute('data-oprice', first[1]);
        const host = clean.match(/\+\s*\$\s*(\d+)\s*\/m/);
        cb.setAttribute('data-mprice', host ? host[1] : '0');
      } else if (cb.getAttribute('data-opt') === 'rgs') {
        const first = clean.match(/\$\s*(\d+)/);
        if (first) cb.setAttribute('data-mprice', first[1]);
      }
    });
    // RGS base for the listed-price spans: the Select Your Options row is the
    // contract line and wins; RGS-only docs (no rgs row) follow the price band
    const rgsCb = doc.querySelector('.prog-opt-check[data-opt="rgs"]');
    const marker = doc.querySelector('#monthly-total');
    let rgsBase = null;
    if (rgsCb) rgsBase = parseInt(rgsCb.getAttribute('data-mprice') || '0', 10) || 0;
    else {
      const s0 = doc.querySelector('.live-rgs-monthly');
      if (s0) rgsBase = money(s0.textContent);
      if (rgsBase === null && marker) rgsBase = parseInt(marker.getAttribute('data-base') || '0', 10) || 0;
      if (marker && rgsBase !== null) marker.setAttribute('data-base', String(rgsBase));
    }
    if (rgsBase !== null) {
      doc.querySelectorAll('.live-rgs-monthly').forEach(s => {
        s.setAttribute('data-base', String(rgsBase));
        s.textContent = '$' + rgsBase.toLocaleString('en-US');
      });
    }
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  } catch (e) {
    console.warn('Pricing sync skipped:', e.message);
    return html;
  }
}
window.syncPricingData = syncPricingData;

// ─── Live pricing inside the builder preview ─────────────────────────
// The hosted /p/ page gets its pricing script from the server; the builder
// preview iframe gets the same behavior here, so add-ons can be pre-selected
// (with live price updates) BEFORE publishing. Every toggle is persisted into
// propReportHtml, so the selection carries into Publish, PDF, and Download.
function applySelectionToHtml(html, key, on) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cb = doc.querySelector('.prog-opt-check[data-opt="' + key + '"]');
    if (!cb) return html;
    if (on) cb.setAttribute('checked', ''); else cb.removeAttribute('checked');
    let addonSum = 0;
    doc.querySelectorAll('.prog-opt-check').forEach(c => {
      if ((c.getAttribute('data-opt') || '').indexOf('addon_') === 0 && c.hasAttribute('checked')) {
        addonSum += parseInt(c.getAttribute('data-mprice') || '0', 10) || 0;
      }
    });
    doc.querySelectorAll('.live-rgs-monthly').forEach(s => {
      const base = parseInt(s.getAttribute('data-base') || '0', 10) || 0;
      s.textContent = '$' + (base + addonSum).toLocaleString('en-US');
    });
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  } catch (e) { return html; }
}

function bindPreviewPricing() {
  const frame = document.getElementById('prop-report-frame');
  if (!frame) return;
  // srcdoc loads replace the iframe's document AFTER writeToFrame resolves, so
  // a one-time bind can land on the document that's about to be thrown away.
  // Hook the frame's load event once — every fresh document gets re-bound.
  if (!frame.__pricingLoadHook) {
    frame.__pricingLoadHook = true;
    frame.addEventListener('load', () => { bindPreviewDoc(frame); });
  }
  bindPreviewDoc(frame);
}

function bindPreviewDoc(frame) {
  const fdoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
  if (!fdoc || !fdoc.documentElement || !fdoc.querySelector('.prog-opt-check')) return;
  if (fdoc.documentElement.getAttribute('data-pricing-bound')) return;
  fdoc.documentElement.setAttribute('data-pricing-bound', '1');
  fdoc.addEventListener('change', (ev) => {
    const cb = ev.target;
    if (!cb || !cb.classList || !cb.classList.contains('prog-opt-check')) return;
    let addonSum = 0;
    fdoc.querySelectorAll('.prog-opt-check').forEach(c => {
      if ((c.getAttribute('data-opt') || '').indexOf('addon_') === 0 && c.checked) {
        addonSum += parseInt(c.getAttribute('data-mprice') || '0', 10) || 0;
      }
    });
    fdoc.querySelectorAll('.live-rgs-monthly').forEach(s => {
      const base = parseInt(s.getAttribute('data-base') || '0', 10) || 0;
      s.textContent = '$' + (base + addonSum).toLocaleString('en-US');
    });
    if (propReportHtml) {
      propReportHtml = applySelectionToHtml(propReportHtml, cb.getAttribute('data-opt') || '', cb.checked);
      autoRepublish();
    }
  });
}
window.bindPreviewPricing = bindPreviewPricing;

// ─── Toolbar dropdown menus (Edit ▾ / Download ▾) ────────────────────
function setupToolbarMenu(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = menu.style.display === 'block';
    document.querySelectorAll('.dl-menu').forEach(m => { m.style.display = 'none'; });
    menu.style.display = wasOpen ? 'none' : 'block';
  });
}
setupToolbarMenu('prop-edit-menu-btn', 'prop-edit-menu');
setupToolbarMenu('prop-download-menu-btn', 'prop-download-menu');
document.addEventListener('click', () => {
  document.querySelectorAll('.dl-menu').forEach(m => { m.style.display = 'none'; });
});

// ─── Email intro (opens the user's mail client — fully editable) ─────
document.getElementById('prop-email-btn').addEventListener('click', async () => {
  if (!propReportHtml) return;
  const btn = document.getElementById('prop-email-btn');
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '⟳ Preparing…';
  const company = document.getElementById('prop-name').value.trim() || 'your company';
  const contact = document.getElementById('prop-contact').value.trim();
  const firstName = contact ? contact.split(/\s+/)[0] : 'there';
  // The email's signing instructions need the hosted link — publish (or refresh
  // the existing link) first so the email always points at the current version.
  let link = '';
  try {
    const existingToken = propPubToken || localStorage.getItem('prospector_pub_' + pubSlug()) || undefined;
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ html: propReportHtml, company, contactEmails: pubContactEmails(), token: existingToken, reportId: propSavedReportId || undefined }),
    });
    const d = await res.json();
    if (res.ok) {
      propPubToken = d.token;
      renderPublishPanel(d.token, d);
      link = window.location.origin + '/p/' + d.token;
    } else if (res.status === 409 && existingToken) {
      // Signed and locked — the existing link is still the right one to send
      link = window.location.origin + '/p/' + existingToken;
    }
  } catch (e) { /* fall through — email still opens without a link */ }
  const subject = 'Your proposal from efelle creative — ' + company;
  const body = 'Hi ' + firstName + ',\n\n'
    + 'Thank you for the opportunity! Your proposal for ' + company + ' is ready to view here:\n\n'
    + (link || '[paste proposal link here]') + '\n\n'
    + 'When you\'re ready to move forward, it takes about ten seconds: open the link, type your name in the "Ready to move forward?" bar at the bottom of the page, and click Accept & Sign. No printing or scanning needed — your acceptance is recorded instantly and we\'ll reach out right away to schedule your kickoff call.\n\n'
    + 'Questions? Just reply to this email or call us at 206.384.4909.\n\n'
    + 'Best,\n'
    + 'efelle creative\n'
    + 'efelle.com | 206.384.4909';
  window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  // Record the send on the Library report (date + recipients power the Sent column)
  if (propSavedReportId) {
    try {
      await fetch('/api/reports/' + encodeURIComponent(propSavedReportId) + '/sent', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ sentTo: pubContactEmails().join(', ') }),
      });
    } catch (e) { /* non-fatal */ }
  }
  btn.innerHTML = orig; btn.disabled = false;
});

// ─── Publish Link (hosted proposal with open tracking + click-to-sign) ─
function pubSlug() {
  return (document.getElementById('prop-name').value || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Contact Email(s) field → validated array (comma/semicolon/space separated)
function pubContactEmails() {
  return document.getElementById('prop-contact-email').value
    .split(/[,;\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

// Auto-republish: once a link exists for this company, every edit (AI editor,
// logo changes, regeneration) silently updates the live copy — until the client
// signs, at which point the server locks the published version (409).
// The Library report backing this proposal (set on save / library load) so
// publishes link the hosted copy to it and sends get recorded on it.
let propSavedReportId = null;
window.setPropSavedReportId = function(id) { propSavedReportId = id || null; };

// The published token for THE PROPOSAL CURRENTLY OPEN. Identity is per
// proposal (Library report), never per company — three proposals for one
// company get three links. The server resolves reportId → token as the
// authority; localStorage's old per-company key remains only as a one-time
// legacy claim so links emailed before this fix keep updating.
let propPubToken = null;
let propNumber = null;

let autoRepubTimer = null;
function autoRepublish() {
  const token = propPubToken;
  if (!token || !propReportHtml) return;
  clearTimeout(autoRepubTimer);
  autoRepubTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          html: propReportHtml,
          company: document.getElementById('prop-name').value.trim(),
          contactEmails: pubContactEmails(),
          token,
          reportId: propSavedReportId || undefined,
        }),
      });
      const d = await res.json();
      if (res.status === 409) { renderPublishPanel(token, { views: null, accepted: d.accepted, locked: true }); return; }
      if (res.ok) { propPubToken = d.token; renderPublishPanel(d.token, d, 'live link updated with your latest edits'); }
    } catch (e) { /* silent — manual Publish Link still available */ }
  }, 1200);
}

function renderPublishPanel(token, status, flash) {
  const panel = document.getElementById('prop-publish-panel');
  const fullUrl = window.location.origin + '/p/' + token;
  const views = (status && typeof status.views === 'number') ? status.views : 0;
  let last = null;
  if (status && status.lastViewedAt) {
    const ago = Date.now() - new Date(status.lastViewedAt).getTime();
    const mins = Math.max(1, Math.round(ago / 60000));
    last = mins < 60 ? mins + ' min ago'
      : mins < 1440 ? Math.round(mins / 60) + ' h ago'
      : new Date(status.lastViewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const accepted = status && status.accepted;
  const pubAt = status && (status.publishedAt || status.createdAt || status.updatedAt);
  const dateStr = new Date(pubAt || Date.now()).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit' }).replace(',', '').replace(' AM', ' am').replace(' PM', ' pm');
  const tip = 'Views include your own opens. Edits update the live link until the client signs.';
  panel.style.display = 'flex';
  panel.innerHTML =
    '<span class="pbx-pub-check">\u2713</span>'
    + '<span class="pbx-pub-row">'
    + '<span class="pbx-pub-title">Published</span>'
    + '<span class="pbx-pub-date">' + dateStr + '</span>'
    + '<a class="pbx-pub-id" href="' + fullUrl + '" target="_blank" title="' + fullUrl + '">' + token + '</a>'
    + '<button class="pbx-iconbtn" title="Copy link" onclick="navigator.clipboard.writeText(\'' + fullUrl + '\');this.style.borderColor=\'#32D74B\';setTimeout(() => { this.style.borderColor = \'\'; }, 1200);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9h11v11H9z M5 15H4V4h11v1"/></svg></button>'
    + '<span class="pbx-pub-stat" title="' + tip + '">' + views + ' view' + (views === 1 ? '' : 's') + '</span>'
    + (last ? '<span class="pbx-pub-stat" title="' + tip + '">Last opened ' + last + '</span>' : '')
    + '<button class="pbx-iconbtn" title="Refresh views and acceptance" onclick="refreshPublishStatus()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36 M21 3v6h-6"/></svg></button>'
    + '<button class="pbx-iconbtn" title="Unpublish — permanently delete this link" onclick="unpublishProposal(\'' + token + '\',' + (accepted ? 'true' : 'false') + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6"/></svg></button>'
    + (accepted
        ? '<span class="pbx-pub-accept">\u2713 Accepted by ' + accepted.name.replace(/</g, '&lt;') + ' on ' + new Date(accepted.t).toLocaleDateString()
          + ((accepted.options && accepted.options.length) ? ' (' + accepted.options.map(o => (o.label || o.key)).join(' + ').replace(/</g, '&lt;') + (accepted.monthlyTotal > 0 ? ', $' + Number(accepted.monthlyTotal).toLocaleString('en-US') + '/m' : '') + ')' : '')
          + '</span>'
        : '')
    + (status && status.locked ? '<span class="pbx-pub-lock">Signed: published version locked, edits no longer update the link</span>' : '')
    + (status && status.hubspot ? '<span class="pbx-pub-plain" title="Opens and acceptance log as notes on this HubSpot contact">HubSpot: ' + String(status.hubspot).replace(/</g, '&lt;') + '</span>' : '')
    + ((status && status.hubspot) ? '' : '<span class="pbx-pub-plain" title="Add a Contact email on the client form and re-publish to log activity to HubSpot">HubSpot: not linked</span>')
    + (flash ? '<span class="pbx-pub-plain" style="color:#1d9a34">' + flash + '</span>' : '')
    + '</span>';
}

window.refreshPublishStatus = async function() {
  const token = propPubToken || localStorage.getItem('prospector_pub_' + pubSlug());
  if (!token) return;
  try {
    const res = await fetch('/api/publish/' + token + '/status', { headers: getApiHeaders() });
    if (!res.ok) return;
    renderPublishPanel(token, await res.json());
  } catch (e) { /* panel keeps last state */ }
};

// Called on Library restore: shows the proposal's own published-link panel (or
// hides a stale one from the previously open proposal)
window.restorePublishPanel = async function(token) {
  propPubToken = token || null;
  const panel = document.getElementById('prop-publish-panel');
  if (!token) {
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    return;
  }
  try {
    const res = await fetch('/api/publish/' + token + '/status', { headers: getApiHeaders() });
    if (res.ok) { renderPublishPanel(token, await res.json()); return; }
    if (res.status === 404) propPubToken = null;
  } catch (e) { /* leave panel as-is */ }
  if (panel && !propPubToken) { panel.style.display = 'none'; panel.innerHTML = ''; }
};

// Unpublish — permanently deletes the hosted /p/<token> link and its record.
window.unpublishProposal = async function(token, signed) {
  const warn = signed
    ? 'This proposal is SIGNED. Deleting the link also removes the signed acceptance record. '
    : '';
  if (!confirm(warn + 'Permanently delete the hosted link /p/' + token + '? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/publish/' + token, { method: 'DELETE', headers: getApiHeaders() });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert('Could not unpublish: ' + (d.error || res.status));
      return;
    }
    if (propPubToken === token) propPubToken = null;
    if (localStorage.getItem('prospector_pub_' + pubSlug()) === token) localStorage.removeItem('prospector_pub_' + pubSlug());
    const panel = document.getElementById('prop-publish-panel');
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  } catch (e) {
    alert('Could not unpublish: ' + e.message);
  }
};

document.getElementById('prop-publish-btn').addEventListener('click', async () => {
  if (!propReportHtml) return;
  const btn = document.getElementById('prop-publish-btn');
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '⟳ Publishing…';
  try {
    const existingToken = propPubToken || localStorage.getItem('prospector_pub_' + pubSlug()) || undefined;
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        html: propReportHtml,
        company: document.getElementById('prop-name').value.trim(),
        contactEmails: pubContactEmails(),
        token: existingToken,
        reportId: propSavedReportId || undefined,
      }),
    });
    const d = await res.json();
    if (res.status === 409) {
      renderPublishPanel(existingToken, { views: null, accepted: d.accepted, locked: true });
      btn.innerHTML = '🔒 Signed — locked';
      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000);
      return;
    }
    if (!res.ok) throw new Error(d.error || 'Publish failed');
    propPubToken = d.token;
    renderPublishPanel(d.token, d);
    btn.innerHTML = '✓ Published';
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2500);
  } catch (e) {
    btn.innerHTML = '⚠ ' + (e.message || 'Failed');
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 4000);
  }
});

// ─── Download PDF (server-rendered — consistent pagination) ─────────
document.getElementById('prop-pdf-btn').addEventListener('click', async () => {
  if (!propReportHtml) return;
  // The menu item hides when the menu closes — show progress on the menu button
  const btn = document.getElementById('prop-download-menu-btn');
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '⟳ Rendering PDF…';
  try {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    const co = (document.getElementById('prop-name').value || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = 'efelle-proposal-' + co + '-' + mm + dd + yy + '.pdf';
    const res = await fetch('/api/proposal-pdf', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ html: propReportHtml, filename }),
    });
    if (!res.ok) {
      let msg = 'PDF render failed (' + res.status + ')';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    btn.innerHTML = '✓ PDF downloaded';
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000);
  } catch (e) {
    btn.innerHTML = '⚠ ' + (e.message || 'Failed');
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 4000);
  }
});

// ─── Save as PDF ───────────────────────────────────────────────────
document.getElementById('prop-save-pdf-btn').addEventListener('click', () => {
  if (!propReportHtml) return;
  // Open proposal in a new window and trigger print (Save as PDF)
  const printWindow = window.open('', '_blank');
  printWindow.document.write(propReportHtml);
  printWindow.document.close();
  // Add print-on-load script
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
  const btn = document.getElementById('prop-save-pdf-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '✓ Print dialog opened';
  btn.style.color = '#2dd4bf';
  setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 3000);
});

// Allow library to set the module-scoped propReportHtml
window.setPropReportHtml = function(html) { propReportHtml = html; };

// Attach to window for onclick compatibility
window.selectVertical = selectVertical;
window.selectRGS = selectRGS;
window.selectPropType = selectPropType;
window.selectMarketType = selectMarketType;
window.propGoStage1 = propGoStage1;
window.propGoStage2 = propGoStage2;
window.propFetchClient = propFetchClient;
window.propGenerate = propGenerate;

function populatePropClientSelect() {
  // Now uses searchable dropdown instead of basic select
  initSearchableClientDropdown(
    'prop-client-search',
    'prop-client-search-results',
    ['cca', 'cap'],  // Only strategy plans and action plans
    (report) => loadPropClient(report.id)
  );
}

window.loadPropClient = loadPropClient;
async function loadPropClient(reportId) {
  if (!reportId) return;
  try {
    const report = await getReport(reportId);
    if (!report) return;
    const d = report.engineData || {};
    const m = report.metadata || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

    // Debug: log what fields are available
    console.log('[loadPropClient] engineData keys:', Object.keys(d));
    console.log('[loadPropClient] engineData:', d);

    // Map fields from CCA/CAP engine data to proposal form
    // CCA uses: company_name, prospect_url, geographic_market, primary_services,
    //           key_differentiators, target_audiences, known_weaknesses, etc.
    setVal('prop-name', d.company_name || d.name || report.clientName);
    setVal('prop-client-url', d.prospect_url || d.website || d.url || m.url || '');
    setVal('prop-contact', d.contact || d.prepared_for || m.contact || '');
    setVal('prop-contact-email', d.contact_email || d.email || '');
    if (d.city || d.state || d.zip || d.street) {
      setVal('prop-address', d.street || '');
      setVal('prop-city', d.city || '');
      setVal('prop-state', (d.state || '').toUpperCase());
      setVal('prop-zip', d.zip || '');
    } else {
      const locParsed = propParseCityState(d.geographic_market || d.location || d.headquarters || '');
      const addrParsed = propParseFullAddress(d.address || d.headquarters || '');
      setVal('prop-address', addrParsed.street);
      setVal('prop-city', addrParsed.city || locParsed.city);
      setVal('prop-state', (addrParsed.state || locParsed.state || '').toUpperCase());
      setVal('prop-zip', addrParsed.zip || locParsed.zip);
    }
    setVal('prop-phone', d.phone || '');
    setVal('prop-founded', d.founded || d.year_founded || '');
    setVal('prop-logo', d.logo || d.logo_url || '');
    if (d.logo_bg) window.selectLogoBg(d.logo_bg);
    if (typeof updateLogoPreview === 'function') updateLogoPreview();
    setVal('prop-differentiators', d.key_differentiators || d.differentiators || d.unique_selling_points || '');

    // Services — CCA uses primary_services (string), could also be array
    const services = d.primary_services || d.services || d.service_types || d.key_services || '';
    if (Array.isArray(services) && services.length) {
      setVal('prop-services', services.join('|'));
    } else if (typeof services === 'string' && services) {
      // Convert comma-separated to pipe-separated
      setVal('prop-services', services.replace(/\s*,\s*/g, '|'));
    }

    // Service area — CCA uses geographic_market
    setVal('prop-area', d.geographic_market || d.service_area || d.target_markets || d.market || '');

    // Show the client fields section and update status
    const fieldsEl = document.getElementById('prop-client-fields');
    if (fieldsEl) fieldsEl.style.display = 'block';
    const statusEl = document.getElementById('prop-url-status');
    if (statusEl) {
      statusEl.innerHTML = '<span style="color:#2dd4bf">✓ Client data loaded from ' +
        (TYPE_LABELS[report.type] || { label: report.type }).label +
        ' — review fields below and build your proposal.</span>';
    }
  } catch (e) { console.warn('Failed to load client data:', e); }
}
window.loadPropClient = loadPropClient;
