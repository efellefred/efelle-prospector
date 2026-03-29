// efelle Prospector — Express Server
// Serves static files, proxies API calls, handles auth + Gemini orchestration

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load .env manually (no dotenv dependency)
const fs = require('fs');
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
} catch (e) { /* .env not found, use system env */ }

const app = express();
const PORT = process.env.PORT || 3000;
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || 'prospector2026';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// Session store (in-memory, resets on restart)
const sessions = new Map();

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // Security headers (CSP off for iframe srcdoc)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit on login — 5 attempts per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts — try again in 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Auth ───────────────────────────────────────────────────────────

// Authorized users (email → display name)
const AUTHORIZED_USERS = {
  'fred@efelle.com': 'Fred',
  'doug@efelle.com': 'Doug',
  'christian@efelle.com': 'Christian',
};

app.post('/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const emailLower = (email || '').toLowerCase().trim();

  if (!AUTHORIZED_USERS[emailLower]) {
    return res.status(401).json({ error: 'Email not authorized' });
  }
  if (password !== TEAM_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = crypto.randomUUID();
  sessions.set(token, {
    expiry: Date.now() + 24 * 60 * 60 * 1000, // 24h
    email: emailLower,
    name: AUTHORIZED_USERS[emailLower],
  });
  console.log(`  [AUTH] ${emailLower} logged in`);
  res.json({ token, email: emailLower, name: AUTHORIZED_USERS[emailLower] });
});

app.get('/auth/check', (req, res) => {
  const token = req.headers['x-session-token'];
  const session = sessions.get(token);
  if (session && Date.now() < session.expiry) {
    res.json({ valid: true, email: session.email, name: session.name });
  } else {
    res.status(401).json({ valid: false });
  }
});

app.post('/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) sessions.delete(token);
  res.json({ loggedOut: true });
});

function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiry) {
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
  // Attach user info to request for downstream use
  req.userEmail = session.email;
  req.userName = session.name;
  next();
}

// Health check endpoint for Railway zero-downtime deploys
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Anthropic API Proxy ────────────────────────────────────────────

// Rate limit staggering — minimum gap between API calls
let lastRequestTime = 0;
const MIN_REQUEST_GAP_MS = 3000; // minimum 3 seconds between API calls

async function throttledAnthropicCall(body) {
  // Wait for minimum gap between requests
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_GAP_MS) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_GAP_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();

  // Make the call with automatic retry on 429
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const backoff = attempt * 15000; // 15s, 30s, 45s
      console.log(`  ↻ Rate limited, retrying in ${backoff/1000}s (attempt ${attempt + 1}/4)`);
      await new Promise(r => setTimeout(r, backoff));
      lastRequestTime = Date.now();
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': ANTHROPIC_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000), // 3-minute timeout per request
    });

    if (response.status === 429 || response.status === 529) {
      if (attempt < 3) continue;
      // Final attempt still rate limited
      return { status: 429, data: { error: { message: 'Rate limited after 4 attempts. Please wait a minute and try again.' } } };
    }

    const data = await response.json();
    return { status: response.status, data };
  }
}

app.post('/api/messages', requireAuth, async (req, res) => {
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }
  try {
    const result = await throttledAnthropicCall(req.body);
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('Anthropic proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach Anthropic API: ' + err.message });
  }
});

// ─── Gemini API Proxy ───────────────────────────────────────────────

// ─── Fetch & extract text from a URL ────────────────────────────────

app.post('/api/fetch-url', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  // Block internal/private URLs (SSRF protection)
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
        host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.') ||
        host.endsWith('.local') || host.includes('metadata.google') || host.includes('169.254.')) {
      return res.status(403).json({ error: 'Internal URLs are not allowed' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(403).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
    }
  } catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch URL: ' + response.status });
    const html = await response.text();
    // Strip tags, scripts, styles to get clean text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Cap at 15K chars to fit in prompt
    res.json({ text, length: text.length });
  } catch (err) {
    console.error('URL fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch URL: ' + err.message });
  }
});

// ─── Discover sitemaps from a website ────────────────────────────────

app.post('/api/discover-sitemaps', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const baseUrl = url.replace(/\/$/, '');
  const commonPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/page-sitemap.xml',
    '/post-sitemap.xml',
    '/location-sitemap.xml',
    '/service-sitemap.xml',
    '/wp-sitemap.xml',
    '/robots.txt',
  ];

  const found = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/xml,application/xml,text/plain,text/html',
  };

  // Check robots.txt first for sitemap references
  try {
    const robotsRes = await fetch(baseUrl + '/robots.txt', {
      headers, redirect: 'follow', signal: AbortSignal.timeout(8000),
    });
    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text();
      const sitemapMatches = robotsTxt.match(/Sitemap:\s*(.+)/gi) || [];
      sitemapMatches.forEach(m => {
        const sitemapUrl = m.replace(/Sitemap:\s*/i, '').trim();
        if (sitemapUrl && !found.includes(sitemapUrl)) found.push(sitemapUrl);
      });
    }
  } catch (e) { /* skip */ }

  // Check common sitemap URLs
  for (const p of commonPaths) {
    if (p === '/robots.txt') continue; // already checked
    const sitemapUrl = baseUrl + p;
    if (found.some(f => f.toLowerCase() === sitemapUrl.toLowerCase())) continue;
    try {
      const r = await fetch(sitemapUrl, {
        method: 'HEAD', headers, redirect: 'follow', signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('xml') || ct.includes('text') || p.endsWith('.xml')) {
          found.push(sitemapUrl);
        }
      }
    } catch (e) { /* skip */ }
  }

  res.json({ sitemaps: found });
});

// ─── Extract company name from homepage ─────────────────────────────

app.post('/api/extract-company', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.json({ name: null });
    const html = await response.text();

    // Try <title> tag first
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let name = titleMatch ? titleMatch[1].trim() : '';
    // Clean up common title patterns
    name = name.split('|')[0].split('–')[0].split('-')[0].split('—')[0].trim();
    // Remove common suffixes
    name = name.replace(/\s*(Home|Homepage|Welcome|Official Site|Official Website)$/i, '').trim();

    // Try og:site_name as backup
    if (!name || name.length < 2) {
      const ogMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
      if (ogMatch) name = ogMatch[1].trim();
    }

    // Try schema.org name
    if (!name || name.length < 2) {
      const schemaMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
      if (schemaMatch) name = schemaMatch[1].trim();
    }

    res.json({ name: name || null });
  } catch (err) {
    res.json({ name: null });
  }
});

// ─── Extract address from a website ──────────────────────────────────

app.post('/api/extract-address', requireAuth, async (req, res) => {
  const { url, companyName } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    // Try homepage and /contact page
    const pagesToTry = [url];
    const contactUrl = url.replace(/\/$/, '') + '/contact';
    const contactUsUrl = url.replace(/\/$/, '') + '/contact-us';
    pagesToTry.push(contactUrl, contactUsUrl);

    let allText = '';
    let rawHtml = '';

    for (const pageUrl of pagesToTry) {
      try {
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const html = await response.text();
          if (pageUrl === url) rawHtml = html; // save homepage HTML for schema check
          else rawHtml += html;
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          allText += ' ' + text;
        }
      } catch (e) { /* skip failed pages */ }
    }

    // Check for schema.org LocalBusiness address
    let schemaAddress = null;
    const schemaMatch = rawHtml.match(/"streetAddress"\s*:\s*"([^"]+)"/);
    const schemaCity = rawHtml.match(/"addressLocality"\s*:\s*"([^"]+)"/);
    const schemaState = rawHtml.match(/"addressRegion"\s*:\s*"([^"]+)"/);
    const schemaZip = rawHtml.match(/"postalCode"\s*:\s*"([^"]+)"/);
    if (schemaMatch) {
      schemaAddress = {
        street: schemaMatch[1],
        city: schemaCity ? schemaCity[1] : '',
        state: schemaState ? schemaState[1] : '',
        zip: schemaZip ? schemaZip[1] : '',
        source: 'schema.org'
      };
    }

    // Regex for US street addresses
    const addressRegex = /(\d{1,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-z]+\s*){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway|Cir|Circle)\.?(?:\s*#?\s*\d+)?)\s*[,\s]+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[,\s]+\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/g;
    let regexMatch = addressRegex.exec(allText);
    let regexAddress = null;
    if (regexMatch) {
      regexAddress = {
        street: regexMatch[1].trim(),
        city: regexMatch[2].trim(),
        state: regexMatch[3].trim(),
        zip: regexMatch[4].trim(),
        source: 'page-text'
      };
    }

    // Use schema address first, then regex, then try Gemini
    let address = schemaAddress || regexAddress;

    if (!address && GEMINI_KEY && companyName) {
      // Fall back to Gemini with search grounding
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `What is the physical street address of "${companyName}"? Website: ${url}. Return ONLY the address in this format: street|city|state|zip. Example: 123 Main St|Seattle|WA|98101. If unknown, return: UNKNOWN` }] }],
              tools: [{ google_search: {} }],
            }),
            signal: AbortSignal.timeout(30000),
          }
        );
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const geminiText = (geminiData.candidates || [{}])[0]?.content?.parts?.map(p => p.text).join('').trim() || '';
          if (geminiText && !geminiText.includes('UNKNOWN')) {
            const parts = geminiText.split('|').map(s => s.trim());
            if (parts.length >= 4) {
              address = { street: parts[0], city: parts[1], state: parts[2], zip: parts[3], source: 'gemini-search' };
            }
          }
        }
      } catch (e) { console.error('Gemini address lookup error:', e.message); }
    }

    res.json({ address: address || null });
  } catch (err) {
    console.error('Address extraction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gemini', requireAuth, async (req, res) => {
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }
  try {
    const { prompt, model } = req.body;
    const geminiModel = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          maxOutputTokens: 65536,
          temperature: 0.7,
        },
      }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Gemini proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach Gemini API: ' + err.message });
  }
});

// ─── Orchestration: Claude → Gemini → Claude ────────────────────────
// One-click research: generates prompt via Claude, runs it through Gemini,
// then validates/imports the result back through Claude.

app.post('/api/orchestrate', requireAuth, async (req, res) => {
  if (!ANTHROPIC_KEY || !GEMINI_KEY) {
    return res.status(500).json({ error: 'Both ANTHROPIC_API_KEY and GEMINI_API_KEY must be configured' });
  }

  const { promptSystem, promptUser, validateSystem, validateMaxTokens, geminiModel } = req.body;

  try {
    // Step 1: Claude generates the Gemini prompt
    const step1Result = await throttledAnthropicCall({
      model: req.body.claudeModel || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: promptSystem,
      messages: [{ role: 'user', content: promptUser }],
    });
    if (step1Result.status !== 200) {
      return res.status(step1Result.status).json({ error: 'Step 1 (Claude prompt gen) failed', detail: step1Result.data });
    }
    const step1Data = step1Result.data;
    const generatedPrompt = (step1Data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!generatedPrompt) {
      return res.status(500).json({ error: 'Claude returned empty prompt in step 1' });
    }

    // Step 2: Send the prompt to Gemini
    const gModel = geminiModel || 'gemini-2.5-flash';
    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${GEMINI_KEY}`;
    const step2 = await fetch(gUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: generatedPrompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 65536, temperature: 0.7 },
      }),
    });
    if (!step2.ok) {
      const err = await step2.json();
      return res.status(step2.status).json({ error: 'Step 2 (Gemini research) failed', detail: err });
    }
    const step2Data = await step2.json();
    const geminiResult = (step2Data.candidates || [{}])[0]?.content?.parts
      ?.map(p => p.text)
      .join('')
      .trim() || '';

    if (!geminiResult) {
      return res.status(500).json({ error: 'Gemini returned empty result in step 2' });
    }

    // Step 3: Claude validates/imports the Gemini output
    if (validateSystem) {
      const step3Result = await throttledAnthropicCall({
        model: req.body.claudeModel || 'claude-sonnet-4-6',
        max_tokens: validateMaxTokens || 8192,
        system: validateSystem,
        messages: [{ role: 'user', content: geminiResult }],
      });
      if (step3Result.status !== 200) {
        return res.status(step3Result.status).json({ error: 'Step 3 (Claude validation) failed', detail: step3Result.data });
      }
      const step3Data = step3Result.data;
      const validatedResult = (step3Data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();

      res.json({
        generatedPrompt,
        geminiResult,
        validatedResult,
        steps: 3,
      });
    } else {
      // No validation step — return Gemini result directly
      res.json({
        generatedPrompt,
        geminiResult,
        steps: 2,
      });
    }
  } catch (err) {
    console.error('Orchestration error:', err.message);
    res.status(502).json({ error: 'Orchestration failed: ' + err.message });
  }
});

// ─── Report Storage ─────────────────────────────────────────────────

const REPORTS_DIR = path.join(__dirname, 'data', 'reports');
const INDEX_FILE = path.join(REPORTS_DIR, 'index.json');

// Ensure reports directory exists on startup
try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  console.log('  Reports dir:', REPORTS_DIR, '(exists:', fs.existsSync(REPORTS_DIR), ')');
} catch (e) {
  console.error('  Failed to create reports directory:', e.message);
}

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch (e) { return []; }
}

function writeIndex(data) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
}

// Save a report
app.post('/api/reports', requireAuth, (req, res) => {
  try {
    const { type, clientName, metadata, engineData, html } = req.body;
    if (!type || !clientName) {
      return res.status(400).json({ error: 'type and clientName are required' });
    }

    const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const ts = new Date().toISOString().slice(0, 10);
    const rand = crypto.randomBytes(3).toString('hex');
    const id = `${type}-${slug}-${ts}-${rand}`;

    const record = {
      id,
      type,
      clientName,
      createdAt: new Date().toISOString(),
      createdBy: req.userEmail || 'unknown',
      metadata: metadata || {},
      htmlFile: `${id}.html`,
    };

    // Save HTML file
    if (html) {
      fs.writeFileSync(path.join(REPORTS_DIR, `${id}.html`), html);
    }

    // Save engine data as separate JSON
    if (engineData) {
      fs.writeFileSync(path.join(REPORTS_DIR, `${id}.json`), JSON.stringify(engineData, null, 2));
    }

    // Update index
    const index = readIndex();
    index.unshift(record);
    writeIndex(index);

    res.json({ id, saved: true });
  } catch (err) {
    console.error('Report save error:', err.message);
    res.status(500).json({ error: 'Failed to save report: ' + err.message });
  }
});

// List all reports (optional ?type= filter)
app.get('/api/reports', requireAuth, (req, res) => {
  try {
    // Ensure directory exists (volume may have been reattached)
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    const index = readIndex();
    const type = req.query.type;
    const filtered = type ? index.filter(r => r.type === type) : index;
    res.json(filtered);
  } catch (err) {
    console.error('Report list error:', err.message);
    res.json([]); // Return empty array instead of crashing
  }
});

// Get report engine data
app.get('/api/reports/:id', requireAuth, (req, res) => {
  const index = readIndex();
  const record = index.find(r => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Report not found' });

  let engineData = null;
  const dataFile = path.join(REPORTS_DIR, `${req.params.id}.json`);
  try { engineData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (e) {}

  res.json({ ...record, engineData });
});

// Download report HTML
app.get('/api/reports/:id/html', requireAuth, (req, res) => {
  const index = readIndex();
  const record = index.find(r => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Report not found' });

  const htmlFile = path.join(REPORTS_DIR, record.htmlFile);
  if (!fs.existsSync(htmlFile)) return res.status(404).json({ error: 'HTML file not found' });

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="${record.htmlFile}"`);
  res.sendFile(htmlFile);
});

// Delete a report
app.delete('/api/reports/:id', requireAuth, (req, res) => {
  const index = readIndex();
  const idx = index.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Report not found' });

  const record = index[idx];
  // Remove files
  try { fs.unlinkSync(path.join(REPORTS_DIR, `${record.id}.html`)); } catch (e) {}
  try { fs.unlinkSync(path.join(REPORTS_DIR, `${record.id}.json`)); } catch (e) {}

  index.splice(idx, 1);
  writeIndex(index);
  res.json({ deleted: true });
});

// Unique clients list (for dropdowns)
app.get('/api/clients', requireAuth, (req, res) => {
  const index = readIndex();
  const clientMap = {};
  index.forEach(r => {
    if (!clientMap[r.clientName]) {
      clientMap[r.clientName] = { name: r.clientName, reports: [] };
    }
    clientMap[r.clientName].reports.push({ id: r.id, type: r.type, date: r.createdAt });
  });
  res.json(Object.values(clientMap));
});

// ─── Status ─────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({
    anthropic: !!ANTHROPIC_KEY,
    gemini: !!GEMINI_KEY,
    version: '4.0.0',
  });
});

// ─── Fallback to index.html ─────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  efelle Prospector v4.0.0`);
  console.log(`  ───────────────────────`);
  console.log(`  Server:    http://localhost:${PORT}`);
  console.log(`  Anthropic: ${ANTHROPIC_KEY ? '✓ configured' : '✗ missing — set ANTHROPIC_API_KEY in .env'}`);
  console.log(`  Gemini:    ${GEMINI_KEY ? '✓ configured' : '✗ missing — set GEMINI_API_KEY in .env'}`);
  console.log(`  Auth:      team password\n`);
});
