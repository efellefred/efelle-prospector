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

// Scrape the actual homepage HTML to find the real logo URL
async function scrapeLogoFromHomepage(url) {
  try {
    const res = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const html = data.text || '';

    // Parse the HTML to find logo images
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Strategy 1: Find <img> tags with "logo" in src, alt, class, or id
    const imgs = doc.querySelectorAll('img');
    const baseUrl = new URL(url);
    let bestLogo = null;

    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
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
  document.getElementById('price-website-label').textContent = isWO ? 'WO Price ($)' : 'Website Price ($)';
  document.getElementById('price-website').value = isWO ? 6600 : 7500;
  document.getElementById('price-rgs').value = (isWO || isRGS) ? 2800 : 2500;
  // Field visibility: new site = website + hosting; WO = WO price + hours; RGS only = RGS monthly only
  document.getElementById('price-website-field').style.display = isRGS ? 'none' : '';
  document.getElementById('price-hosting-field').style.display = (isWO || isRGS) ? 'none' : '';
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

function propGoStage1() {
  document.querySelectorAll('.prop-stage').forEach(s => s.classList.remove('active'));
  document.getElementById('prop-stage-1').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Reset form when navigating back to proposal engine from another screen
function propReset() {
  propGoStage1();
  propReportHtml = '';
  propClientData = {};
  propVertical = '';
  propMarketType = 'residential';
  // Clear form fields
  ['prop-client-url','prop-name','prop-contact','prop-address','prop-phone',
   'prop-location','prop-services','prop-area','prop-differentiators',
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

async function propFetchClient() {
  const url = document.getElementById('prop-client-url').value.trim();
  if (!url) return;
  // Server mode: session token handles auth, no API key needed in browser
  const btn = document.getElementById('prop-fetch-btn');
  const status = document.getElementById('prop-url-status');
  btn.disabled = true; btn.textContent = '⟳ Fetching…';
  function setStatus(msg, state) {
    const color = state === 'searching' ? '#a78bfa' : state === 'building' ? '#2dd4bf' : state === 'done' ? '#2dd4bf' : state === 'warn' ? '#fb923c' : state === 'error' ? '#f87171' : '#9ca3af';
    status.innerHTML = '<span class="status-dot"></span><span class="status-dot"></span><span class="status-dot"></span><span style="margin-left:4px;color:' + color + '">' + msg + '</span>';
  }
  setStatus('Connecting to research engine…', 'info');
  try {
    const researchPromise = callWithWebSearch(
      PROP_RESEARCH_SYSTEM,
      'Research this business website and extract their information including their logo image URL: ' + url,
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
    if (data.location)     document.getElementById('prop-location').value = data.location;
    if (data.address)      document.getElementById('prop-address').value = data.address;
    if (data.phone)        document.getElementById('prop-phone').value = data.phone;
    if (data.services && data.services.length) document.getElementById('prop-services').value = data.services.join('|');
    if (data.service_area) document.getElementById('prop-area').value = data.service_area;
    if (data.founded)      document.getElementById('prop-founded').value = data.founded;
    if (data.differentiators) document.getElementById('prop-differentiators').value = data.differentiators;
    // Scrape the ACTUAL homepage for the real logo URL (don't trust Claude's guess)
    setStatus('Scraping homepage for logo and address…', 'searching');
    const [scrapedLogo, scrapedAddress] = await Promise.all([
      scrapeLogoFromHomepage(url),
      scrapeAddressFromSite(url),
    ]);

    // Address: use scraped > Claude's research > Gemini lookup
    let finalAddress = scrapedAddress || data.address || '';
    let addressSource = scrapedAddress ? 'website' : (data.address ? 'research' : '');

    if (!finalAddress) {
      setStatus('Looking up business address via Google…', 'searching');
      const geminiAddress = await lookupAddressViaGemini(
        data.company_name || document.getElementById('prop-name').value,
        url
      );
      if (geminiAddress) {
        finalAddress = geminiAddress;
        addressSource = 'google';
      }
    }

    if (finalAddress) document.getElementById('prop-address').value = finalAddress;

    const logoUrl = scrapedLogo || data.logo_url || '';
    const hasLogo = !!logoUrl;
    const hasAddress = !!finalAddress;
    if (logoUrl) document.getElementById('prop-logo').value = logoUrl;
    let statusParts = ['✓ Client info populated — scroll down to review and generate proposal.'];
    if (!hasAddress) statusParts.push('<span style="color:#fb923c">No address found — paste it in the Address field below.</span>');
    if (hasAddress && addressSource === 'google') statusParts.push('<span style="color:#fb923c">Address found via Google — please verify it\'s correct.</span>');
    if (hasAddress && addressSource === 'website') statusParts.push('<span style="color:#2dd4bf">Address found on website.</span>');
    if (!hasLogo) statusParts.push('<span style="color:#fb923c">No logo found — paste a logo URL in the Logo field below.</span>');
    if (scrapedLogo) statusParts.push('<span style="color:#2dd4bf">Logo found from homepage source code.</span>');
    status.innerHTML = '<span style="color:#2dd4bf">' + statusParts.join(' ') + '</span>';
  } catch(e) {
    console.error('propFetchClient error:', e);
    status.innerHTML = '<span style="color:#f87171">⚠ ' + (e.message || 'Could not auto-fetch') + '. Fill in the fields manually below.</span>';
  }
  btn.disabled = false; btn.textContent = '⟳ Research Client';
}

function propBuildHTML(clientName) {
  const v = VERTICALS[propVertical];
  const isWO = propType === 'wo_rgs';
  const isRGS = propType === 'rgs_only';
  const optional = propType === 'new_website' && propRGS === 'optional';
  const wp = isRGS ? 0 : (parseInt(document.getElementById('price-website').value) || (isWO ? 6600 : 7500));
  const hp = (isWO || isRGS) ? 0 : (parseInt(document.getElementById('price-hosting').value) || 85);
  const rp = parseInt(document.getElementById('price-rgs').value) || ((isWO || isRGS) ? 2800 : 2500);
  const hours = isWO ? (parseInt(document.getElementById('price-hours').value) || 40) : 0;
  const d1 = Math.round(wp * 0.50);  // 50% deposit (both new site and WO)
  const d2 = isWO ? Math.round(wp * 0.50) : 0;  // WO: 50% milestone; new site: no milestone
  const monthlyPay = fmt(Math.round((wp - d1) / 24));
  const m50 = isWO ? 0 : Math.round((wp * 0.50) / 24);  // new site: 50% balance / 24 mo
  const contact  = document.getElementById('prop-contact').value.trim() || '';
  const location = document.getElementById('prop-location').value.trim() || '';
  const founded  = document.getElementById('prop-founded').value.trim() || '';
  const area     = document.getElementById('prop-area').value.trim() || 'the local area';
  const diffs    = document.getElementById('prop-differentiators').value.trim() || '';
  const address  = document.getElementById('prop-address').value.trim() || '';
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
  const vpd = VPD[propVertical] || [];
  const p1 = vpd[0] || GENERIC_P1;
  const p2 = vpd[1] || GENERIC_P2;
  const p3 = vpd[2] || GENERIC_P3;
  const p4 = vpd[3] || null;


  const logoHtml = logo
    ? '<img src="' + logo + '" alt="' + clientName + '" style="max-width:67%;height:auto;display:block;">'
    : '<div style="border:2px dashed #D2D2D7;border-radius:10px;padding:24px 32px;display:inline-flex;flex-direction:column;align-items:center;gap:8px;background:#F5F5F7;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#636366" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#636366;">Client Logo</div></div>';


  const lines = [];
  if (address) lines.push(address);
  if (phone)   lines.push('<a href="tel:' + phone + '" style="color:#636366;text-decoration:none;">' + phone + '</a>');
  if (website) lines.push('<a href="' + website + '" style="color:#F56300;text-decoration:none;" target="_blank">' + website.replace(/https?:\/\//,'').replace(/\/$/, '') + '</a>');
  const addressHtml = lines.length ? '<div style="font-size:11px;color:#636366;line-height:1.8;text-align:center;">' + lines.join('<br>') + '</div>' : '';


  const isOtherVertical = propVertical === 'other';
  let about1 = clientName + (isOtherVertical ? ' is a company based in ' : ' is a ' + v.label.toLowerCase() + ' company based in ') + (location || 'the area');
  const clientsPhrase = isOtherVertical ? 'clients' : 'residential and commercial clients';
  if (area && area !== 'the local area') about1 += ', serving ' + clientsPhrase + ' across ' + area;
  else about1 += ', serving ' + clientsPhrase + ' in the local area';
  if (svc_str) about1 += '. Services include ' + svc_str + '.';

  let about2 = (founded ? 'Founded in ' + founded + ', ' : '') + clientName + ' has built a reputation for quality work and reliable service.';
  if (diffs) about2 += ' ' + diffs;


  let sow1, sow2, sow3, sow4, sow5;
  if (isRGS) {
    sow1 = clientName + ' will engage efelle to run its Revenue Growth Service (RGS), a fully managed digital marketing program built around the company\'s existing website. The program is designed to increase visibility, drive qualified local traffic, and convert that traffic into booked work.';
    sow2 = 'The engagement begins with a kickoff and strategy session to align on goals, service priorities, and target markets. efelle will then configure the campaign infrastructure — Google Ads and META campaigns, conversion tracking, analytics, and lead attribution — so every lead source is measurable from day one.';
    sow3 = 'Ongoing work includes website content updates (new and refreshed pages, landing pages, and on-page SEO improvements to the existing site), Local SEO (service-area targeting, map pack optimization, structured data), AI search visibility (GEO) so the business appears in AI-generated answers, reputation management, and continuous optimization across every channel.';
    sow4 = 'Each month, ' + clientName + ' receives a clear report covering leads, traffic, ad performance, rankings, and ROI. The program runs with a three-month minimum term, then continues month-to-month with 30 days\' notice to cancel. Ad spend is paid directly to Google and META.';
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
    ? ('<strong>Our Revenue Growth Service (RGS)</strong> is a fully managed monthly lead-generation program — Local SEO, ongoing content updates to your existing website, Google Ads, META Ads, reputation management, and AI search visibility (GEO) — run by one team, tracked in one place, and reported to you every month.<br><br>No long-term contract: a three-month minimum term, then month-to-month with 30 days\' notice.')
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
    ? 'Your website already represents your business — our job is to make sure customers actually find it, and that visits turn into booked work. The RGS program drives consistent traffic and converts it into revenue from month one. Every channel is managed, tracked, and reported monthly so you see exactly where your leads are coming from.'
    : isWO
    ? 'We\'ll make website updates to help it convert — built around trust signals, project proof, and CRO strategies that turn visitors into booked appointments. But conversion only matters if people find you. The RGS program is included in this proposal — driving consistent traffic and converting it into revenue from month one. Every channel is managed, tracked, and reported monthly so you see exactly where your leads are coming from.'
    : (optional
        ? 'Your new efelle website is engineered to convert — built around trust signals, project proof, and CRO strategies that turn visitors into booked appointments. But conversion only matters if people find you. Our RGS program drives consistent traffic and converts it into revenue. Every channel is managed, tracked, and reported monthly so you see exactly where your leads are coming from. This program is optional and can be added at any time, using a combination of the elements of our system below:'
        : 'Your new website will be built to convert, using trust signals, project proof &amp; CRO strategies that turn visitors into appointments. Traffic drives results, which is why our RGS program is included — bringing in consistent leads &amp; revenue from month one. Every channel is managed, tracked, and reported so you always know where your leads come from.');

  // RGS main cards — WO removes Local SEO and Reputation Mgmt (moved to add-ons)
  const CHECK = '<div style="width:16px;height:16px;border-radius:3px;background:#32D74B;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:8px;vertical-align:middle;"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  const EMPTY_BOX = '<div style="width:16px;height:16px;border-radius:3px;border:2px solid rgba(255,255,255,0.6);display:inline-flex;flex-shrink:0;margin-right:8px;vertical-align:middle;"></div>';
  const DESC_INDENT = 'padding-left:24px;';
  const addonCard = (title, desc, price) => '<div class="rgs-card" style="border:1px solid rgba(255,255,255,0.08);"><div class="rgs-card-title">' + EMPTY_BOX + title + '</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">' + desc + '</div><div style="font-size:15px;font-weight:700;color:var(--white);margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);' + DESC_INDENT + '">' + price + '</div></div>';

  // RGS-only: the program includes ongoing content updates to the existing site (no design/dev rebuild)
  const contentUpdatesCard = isRGS
    ? '<div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'Website Content Updates</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">Ongoing updates to your existing website — new pages, refreshed content, landing pages, and on-page SEO improvements — handled by our team as part of the program.</div></div>'
    : '';

  const rgsMainCards = isWO
    ? '<div class="rgs-card"><div class="rgs-card-title">Google Ads (PPC)</div><div class="rgs-card-desc">Targeted paid search campaigns that put you in front of homeowners actively searching for your services. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to Google.</span></div></div><div class="rgs-card"><div class="rgs-card-title">META Ads</div><div class="rgs-card-desc">Facebook and Instagram campaigns targeting homeowners by location, home value, and neighborhood. Build awareness year-round and surge during peak seasons. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to META.</span></div></div><div class="rgs-card"><div class="rgs-card-title">AI Search Visibility (GEO)</div><div class="rgs-card-desc">As Google AI Overviews and ChatGPT become how consumers find service providers, we optimize your content to appear in these AI-generated answers before they even search.</div></div><div class="rgs-card"><div class="rgs-card-title">Monthly Reporting &amp; Continuous Optimization</div><div class="rgs-card-desc">Every month you get a clear report — leads, traffic, ad performance, rankings, and ROI. We review what\'s working, adjust what isn\'t, and keep pushing the program forward. No set-it-and-forget-it.</div></div>'
    : ('<div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'Local SEO</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">' + (v.rgs_local || 'Ongoing optimization so you rank when homeowners search for your services near them. Service area pages, map pack ranking, structured data.') + '</div></div>' + contentUpdatesCard + '<div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'Google Ads (PPC)</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">' + (v.rgs_ppc || 'Targeted paid search campaigns that put you in front of homeowners actively searching for your services. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to Google.</span>') + '</div></div><div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'META Ads</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">' + (v.rgs_meta || 'Facebook and Instagram campaigns targeting homeowners by location, home value, and behavior. <span style="color:rgba(255,255,255,0.5); font-style:italic;">Ad spend paid directly to META.</span>') + '</div></div><div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'Reputation Management</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">' + (v.rgs_rep || 'Review requests, response management, and amplification across Google, Facebook, and industry directories.') + '</div></div><div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'AI Search Visibility (GEO)</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">As Google AI Overviews and ChatGPT become how consumers find service providers, we optimize your content to appear in these AI-generated answers before they even search.</div></div><div class="rgs-card"><div class="rgs-card-title">' + CHECK + 'Monthly Reporting &amp; Optimization</div><div class="rgs-card-desc" style="' + DESC_INDENT + '">Every month you get a clear report — leads, traffic, ad performance, rankings, and ROI. We review what\'s working, adjust what isn\'t, and keep pushing the program forward. No set-it-and-forget-it.</div></div>');

  // Add-on cards — WO includes Local SEO + Reputation Mgmt as add-ons
  const rgsAddonCards = isWO
    ? (addonCard('Local SEO', 'Ongoing optimization so you rank when homeowners search for your services near them. Service area pages, map pack ranking, structured data.', '$650<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span>')
      + addonCard('Reputation Management', 'Review requests, response management, and amplification across Google, Facebook, and Angi. Social proof is critical for homeowners making a major investment in their home.', '$350<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span>')
      + addonCard('Google Business Profile Mgt', 'Initial optimization of your GBP, including photos, Q&amp;A, service areas, and continuous content publishing, designed to help rank on the local map pack when clients are searching.', '$400<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span>')
      + addonCard('AI Phone &amp; Appointment Automation', 'Missed calls send your leads to your competitor. Our automated system answers 24/7, qualifies leads &amp; books appointments directly onto your calendar, with reminders &amp; follow-ups!', '$550<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span>'))
    : (addonCard('Google Business Profile Mgt', 'Initial optimization of your GBP, including photos, Q&amp;A, service areas, and continuous content publishing, designed to help rank on the local map pack when clients are searching.', '$400<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span>')
      + addonCard('AI Phone &amp; Appointment Automation', 'Missed calls send your leads to your competitor. Our automated system answers 24/7, qualifies leads &amp; books appointments directly onto your calendar, with reminders &amp; follow-ups!', '$550<span style="font-size:11px; font-weight:400; color:var(--gray-2);">/month</span>'));

  // Offer price block — for RGS-only the monthly program IS the headline price
  const offerHeadlinePrice = isRGS
    ? fmt(rp) + '<span style="font-size:20px; font-weight:400;">/mo</span>'
    : fmt(wp);
  const offerPriceLabel = isRGS ? 'Digital Marketing<br>Program' : isWO ? (hours + ' hours of<br>website updates') : 'One-time website';
  const offerSecondaryBlock = isRGS
    ? ''
    : isWO
    ? '<div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);"><div style="font-size:22px; font-weight:800; color:var(--white); letter-spacing:-0.02em; line-height:1;">' + fmt(rp) + '<span style="font-size:12px; font-weight:400;">/mo</span></div><div class="offer-price-label">Digital Marketing<br>Program</div></div>'
    : '<div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);"><div style="font-size:22px; font-weight:800; color:var(--white); letter-spacing:-0.02em; line-height:1;">' + fmt(hp) + '<span style="font-size:12px; font-weight:400;">/mo</span></div><div class="offer-price-label">Hosting, Support<br>&amp; CMS Maint</div></div>';

  // Payment rows
  const payRow = (label, val, border, orange) => '<div style="display:flex; justify-content:space-between; align-items:center; padding:' + (orange ? '16px' : '10px') + ' 0;' + (border ? ' border-bottom:1px solid rgba(0,0,0,0.06);' : '') + '"><span style="font-size:13px; ' + (orange ? 'font-weight:700; color:var(--orange);' : 'color:var(--gray-1);') + ' display:flex; align-items:center;">' + label + '</span><span style="font-size:13px; font-weight:700; color:' + (orange ? 'var(--orange)' : 'var(--black)') + '; display:flex; align-items:center;">' + val + '</span></div>';
  const paymentRows = isRGS
    ? (payRow('Monthly Digital Marketing Program (RGS)', fmt(rp) + '/mo', true, true)
      + payRow('Three-month minimum term, then month-to-month', '30 days\' notice to cancel', true, false)
      + payRow('Ad spend (Google &amp; META)', 'Paid directly to platforms', false, false))
    : isWO
    ? (payRow('50% Deposit upon project approval', fmt(d1), true, false)
      + payRow('50% Milestone Payment @ 45 days', fmt(d2), true, false)
      + payRow('Monthly Digital Marketing Program (RGS)', fmt(rp) + '/mo', false, true))
    : (payRow('50% project deposit upon approval', fmt(d1), true, false)
      + payRow('50% project balance paid over 24 months, 0% interest', '$' + Math.round(m50).toLocaleString() + '/mo', true, false)
      + payRow('Website Hosting, Support &amp; CMS Maintenance', fmt(hp) + '/mo', true, false)
      + (optional ? '' : payRow('Monthly Digital Marketing Program (RGS)', fmt(rp) + '/mo', false, true)));

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
  const newWebsiteSteps = '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Discovery Call (30 min)</h3><p>We learn about your business, your service area, your service types, and your goals. No fluff — just the information we need to build something that works for your specific market.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-content"><h3>Strategy &amp; Site Architecture</h3><p>We map out your site structure, service pages, and conversion flows before we touch design. Built around how customers search for and evaluate your services, not how agencies think.</p></div></div><div class="step"><div class="step-num">3</div><div class="step-content"><h3>Design &amp; Development</h3><p>Your site is built on our proven semi-custom framework — which means it moves faster than a fully custom build without sacrificing quality. Award-winning UX, your brand, your market.</p></div></div><div class="step"><div class="step-num">4</div><div class="step-content"><h3>Launch &amp; SEO Foundation</h3><p>We launch with Local SEO, schema markup, Google Business Profile optimization, and tracking in place from day one. You\'re not starting from zero.</p></div></div><div class="step"><div class="step-num">5</div><div class="step-content"><h3>RGS Program Kicks In</h3><p>Month one of your digital marketing program starts. Google Ads, META, SEO optimization, and reputation management — all running, all tracked, all reported monthly. Watch the leads come in.</p></div></div>';
  const woSteps = '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Kickoff Call (30 min)</h3><p>We review the audit findings together, confirm priorities, and align on the highest-impact improvements for your market and goals. No fluff — just a clear plan.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-content"><h3>Schema &amp; Structured Data</h3><p>We implement schema markup across key pages so search engines and AI platforms accurately understand your services, service areas, and business details.</p></div></div><div class="step"><div class="step-num">3</div><div class="step-content"><h3>Location &amp; Service Page Updates</h3><p>Priority pages get updated with hyper-specific, locally relevant content — improving geographic targeting, keyword alignment, and semantic clarity across your top markets.</p></div></div><div class="step"><div class="step-num">4</div><div class="step-content"><h3>On-Page SEO Fixes</h3><p>Metadata, page titles, low-content pages, readability issues, and crawlability improvements addressed systematically from the audit findings.</p></div></div><div class="step"><div class="step-num">5</div><div class="step-content"><h3>RGS Program Kicks In</h3><p>Month one of your digital marketing program starts. Google Ads, META, AI visibility optimization — all running, all tracked, all reported monthly. Watch the leads come in.</p></div></div>';
  const rgsOnlySteps = '<div class="step"><div class="step-num">1</div><div class="step-content"><h3>Kickoff &amp; Strategy Call (30 min)</h3><p>We learn your business, your service area, your priority services, and your goals — then align on target markets and where your marketing budget works hardest. No fluff, just a clear plan.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-content"><h3>Tracking &amp; Campaign Setup</h3><p>Conversion tracking, analytics, and lead attribution get configured first — so every lead is measurable from day one. Then we build your Google Ads and META campaigns around your services and service area.</p></div></div><div class="step"><div class="step-num">3</div><div class="step-content"><h3>Local SEO, Content &amp; AI Visibility Foundation</h3><p>Google Business Profile optimization, structured data, service-area targeting, and content updates to your existing site\'s priority pages — plus GEO optimization so your business shows up in Google AI Overviews and ChatGPT answers.</p></div></div><div class="step"><div class="step-num">4</div><div class="step-content"><h3>Campaigns Go Live</h3><p>Ads start running, reputation management kicks in, and leads begin flowing. We monitor closely in the first weeks and tune targeting, budgets, and messaging based on real performance.</p></div></div><div class="step"><div class="step-num">5</div><div class="step-content"><h3>Monthly Reporting &amp; Optimization</h3><p>Every month you get a clear report — leads, traffic, ad performance, rankings, and ROI. We review what\'s working, adjust what isn\'t, and keep pushing the program forward. No set-it-and-forget-it.</p></div></div>';
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

  const summary = isRGS
    ? ('RGS program @ ' + fmt(rp) + '/mo &nbsp;·&nbsp; 3-month minimum, then month-to-month')
    : isWO
    ? (fmt(wp) + ' website updates &nbsp;+&nbsp; RGS program @ ' + fmt(rp) + '/mo')
    : (optional
        ? fmt(wp) + ' website (0% interest plan) &nbsp;+&nbsp; Optional RGS program @ ' + fmt(rp) + '/mo'
        : fmt(wp) + ' website (0% interest plan) &nbsp;+&nbsp; RGS program @ ' + fmt(rp) + '/mo');


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
      + '<p style="margin-bottom:8px;">Ad spend for Google and META campaigns is paid directly to those platforms and is separate from the monthly program fee. If you\'d like to change program scope or budget, we\'ll talk it through with you and align on next steps before moving forward.</p>'
      + '<p>This agreement follows Washington State law and helps set clear expectations so everything stays on track, but you\'ll find us very easy to work with — we share a common goal: getting your digital marketing program running ASAP to help you grow your business!</p>')
    : ('<p style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--black);">We\'re excited to partner with you on your new website and marketing program!</p>'
      + '<p style="margin-bottom:8px;"><strong>The Website Project</strong> component includes design, development, CMS setup &amp; integration, copywriting and site launch services + ongoing mgt, hosting &amp; support. The total website project investment is <strong>[[WEBSITE_PRICE]]</strong>, with a <strong>[[DEP1]]</strong> deposit to get started and the remaining balance spread over 24 months at <strong>[[MONTHLY_PAY]]/mo</strong>, interest-free.</p>'
      + '<p style="margin-bottom:8px;">Ongoing hosting, support &amp; CMS updates + mgt services are <strong>[[HOSTING_PRICE_MO]]</strong>, starting upon site launch.</p>'
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
      ? 'We run fully managed digital marketing programs — Local SEO, website content updates, Google Ads, META, and AI search visibility — backed by 21 years of effective, award-winning work. We handle the complete program so you can focus on running your business.'
      : adjustForMarketType(v.hero_sub),
    '[[ABOUT_P1]]':             about1,
    '[[ABOUT_P2]]':             about2,
    '[[CLIENT_LOGO]]':          logoHtml,
    '[[CLIENT_ADDRESS]]':       address || '',
    '[[CLIENT_PHONE]]':         phone || '',
    '[[CLIENT_WEBSITE]]':       website ? website.replace(/https?:\/\//,'').replace(/\/$/, '') : '',
    '[[ADDRESS]]':              addressHtml,
    '[[SOW_P1]]':               sow1,
    '[[SOW_P2]]':               sow2,
    '[[SOW_P3]]':               sow3,
    '[[SOW_P4]]':               sow4,
    '[[SOW_P5]]':               sow5,
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
    '[[RGS_PRICE]]':            fmt(rp),
    '[[RGS_AGREEMENT_PARA]]':   isRGS
      ? 'This proposal covers our <strong>Revenue Growth Service (RGS)</strong>, a fully managed digital marketing program at <strong>' + fmt(rp) + '/month</strong> focused on increasing visibility, driving qualified traffic, and improving lead generation for your existing website. RGS runs with a three-month minimum term, then continues month-to-month with 30 days\' notice to cancel.'
      : optional
      ? 'As an optional service, this proposal includes our <strong>Revenue Growth Service (RGS)</strong>, a managed digital marketing program at <strong>' + fmt(rp) + '/month</strong> focused on increasing visibility, driving qualified traffic, and improving lead generation. RGS runs month-to-month with a three-month minimum term and 30 days\' notice to cancel.'
      : 'During the project efelle will build out and begin managing its <strong>Revenue Growth Service (RGS)</strong>, a managed digital marketing program at <strong>' + fmt(rp) + '/month</strong> focused on increasing visibility, driving qualified traffic, and improving lead generation. RGS runs as a monthly engagement with a three-month minimum term, then continues month-to-month with 30 days\' notice to cancel.',
    '[[RGS_FROM]]':             (!isWO && optional) ? '<span style="font-size:16px; font-weight:400; color:var(--gray-2);">from </span>' : '',
    '[[WEBSITE_PRICE]]':        offerHeadlinePrice,
    '[[HOSTING_PRICE]]':        fmt(hp),
    '[[HOSTING_PRICE_MO]]':     fmt(hp) + '/mo',
    '[[RGS_PAYMENT_ROW]]':      '',
    '[[DEP1]]':                 fmt(d1),
    '[[MONTHLY_PAY]]':          monthlyPay,
    '[[DEP2]]':                 fmt(d2),
    '[[MONTHLY40]]':            '$' + Math.round(m50).toLocaleString() + '/mo',
    '[[PROGRAM_SUMMARY]]':      summary,
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
    for (let i = 0; i < RGS_CASE_STUDIES.length; i += 2) csPages.push(RGS_CASE_STUDIES.slice(i, i + 2));
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
    const cStart = html.indexOf('<!-- BUILD_CALENDAR_START -->');
    const cEnd   = html.indexOf('<!-- BUILD_CALENDAR_END -->');
    if (cStart >= 0 && cEnd >= 0) html = html.slice(0, cStart) + html.slice(cEnd + '<!-- BUILD_CALENDAR_END -->'.length);
  }
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
      const html = propBuildHTML(clientName);
      propReportHtml = html;
      progress.classList.remove('visible');
      document.querySelectorAll('.prop-stage').forEach(s => s.classList.remove('active'));
      document.getElementById('prop-stage-3').classList.add('active');
      const frame = document.getElementById('prop-report-frame');
      await writeToFrame(frame, html);

      // Populate propClientData from form fields for saving
      propClientData = {
        company_name: clientName,
        url: document.getElementById('prop-client-url').value.trim(),
        contact: document.getElementById('prop-contact').value.trim(),
        location: document.getElementById('prop-location').value.trim(),
        address: document.getElementById('prop-address').value.trim(),
        phone: document.getElementById('prop-phone').value.trim(),
        services: document.getElementById('prop-services').value.trim(),
        area: document.getElementById('prop-area').value.trim(),
        founded: document.getElementById('prop-founded').value.trim(),
        differentiators: document.getElementById('prop-differentiators').value.trim(),
        logo: document.getElementById('prop-logo').value.trim(),
      };
      try {
        await saveReport('prop', clientName, {
          vertical: propVertical,
          type: propType,
          marketType: propMarketType,
        }, propClientData, propReportHtml);
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

window.applyLogoToProposal = function() {
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
    logoSrc = logoFileDataUrl;
  }

  const frame = document.getElementById('prop-report-frame');
  const doc = frame.contentDocument || frame.contentWindow.document;

  const placeholder = doc.querySelector('[style*="dashed"]');
  const existingLogo = doc.querySelector('img[alt][style*="max-width"]');
  const target = placeholder || existingLogo;

  if (target) {
    const img = doc.createElement('img');
    img.src = logoSrc;
    img.alt = 'Client Logo';
    img.style.cssText = 'max-width:67%;height:auto;display:block;';
    target.parentNode.replaceChild(img, target);
  } else {
    statusEl.innerHTML = '<span style="color:#fb923c;">Could not find logo placeholder in the proposal.</span>';
    return;
  }

  propReportHtml = doc.documentElement.outerHTML;

  statusEl.innerHTML = '<span style="color:#34d399;">✓ Logo applied.</span>';
  setTimeout(() => {
    document.getElementById('prop-logo-panel').style.display = 'none';
  }, 1000);
};

document.getElementById('prop-logo').addEventListener('change', async () => {
  if (propReportHtml) {
    const clientName = document.getElementById('prop-name').value.trim();
    if (!clientName) return;
    propReportHtml = propBuildHTML(clientName);
    await writeToFrame(document.getElementById('prop-report-frame'), propReportHtml);
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
    // Use find-and-replace approach so the model doesn't need to reproduce the entire HTML
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        model: API_MODEL,
        max_tokens: 4096,
        system: `You are a proposal editor. The user gives you HTML and an edit instruction.

Return ONLY a JSON array of find-and-replace operations. Each operation has:
- "find": the exact text/HTML to find in the document (must be unique enough to match only once)
- "replace": the replacement text/HTML

Example response:
[{"find":"$4,500/mo","replace":"$2,850/mo"}]

Rules:
- Return ONLY the JSON array, no explanation, no markdown fences
- Use the minimum number of replacements needed
- Match the exact HTML including tags and attributes
- Keep all styling intact unless the user specifically asks to change it`,
        messages: [{
          role: 'user',
          content: `Here is the current proposal HTML (truncated to key content sections):\n\n${propReportHtml.slice(0, 60000)}\n\nEdit instruction: ${instruction}`
        }]
      })
    });

    if (!res.ok) throw new Error('API ' + res.status);
    const d = await res.json();
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

    for (const op of replacements) {
      if (op.find && op.replace !== undefined && updatedHtml.includes(op.find)) {
        updatedHtml = updatedHtml.replace(op.find, op.replace);
        changeCount++;
      }
    }

    if (changeCount === 0) throw new Error('No matching text found to replace — try being more specific');

    // Update the proposal
    propReportHtml = updatedHtml;
    await writeToFrame(document.getElementById('prop-report-frame'), propReportHtml);

    // Show success
    thinkMsg.textContent = '✓ ' + changeCount + ' change' + (changeCount > 1 ? 's' : '') + ' applied';
    thinkMsg.style.color = '#2dd4bf';
  } catch (e) {
    thinkMsg.textContent = '⚠ ' + (e.message || 'Failed to edit');
    thinkMsg.style.color = '#f87171';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
    setVal('prop-location', d.geographic_market || d.location || d.headquarters || '');
    setVal('prop-address', d.address || d.headquarters || '');
    setVal('prop-phone', d.phone || '');
    setVal('prop-founded', d.founded || d.year_founded || '');
    setVal('prop-logo', d.logo || d.logo_url || '');
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
