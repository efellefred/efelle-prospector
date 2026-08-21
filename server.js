// efelle Prospector — Express Server
// Serves static files, proxies API calls, handles auth + Gemini orchestration

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { console.warn('Puppeteer not available — screenshot endpoint disabled'); }

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
let ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
let GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN || '';
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID || '';
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID || '';
const ADMIN_EMAILS = ['fred@efelle.com'];

// Session store (in-memory, resets on restart)
const sessions = new Map();

// Middleware
// Security headers. CSP off for iframe srcdoc. CORP must be cross-origin:
// hosted logos/screenshots are embedded by print windows (about:blank origin),
// the server PDF renderer, and downloaded HTML files — the default same-origin
// policy silently blanks images on all of those surfaces.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '40mb' })); // Sales Notes uploads: up to 15 MB of files as base64
app.use(express.static(path.join(__dirname, 'public')));
app.use('/screenshots', express.static(path.join(__dirname, 'data', 'screenshots')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

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

function requireAdmin(req, res, next) {
  const token = req.headers['x-session-token'];
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiry) {
    return res.status(401).json({ error: 'Session expired' });
  }
  if (!ADMIN_EMAILS.includes(session.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.userEmail = session.email;
  next();
}

// ─── Admin: API Key Management ─────────────────────────────────────

app.get('/api/admin/keys', requireAdmin, (req, res) => {
  res.json({
    anthropic: ANTHROPIC_KEY ? `sk-ant-...${ANTHROPIC_KEY.slice(-6)}` : '',
    gemini: GEMINI_KEY ? `...${GEMINI_KEY.slice(-6)}` : '',
    railwayConfigured: !!(RAILWAY_API_TOKEN && RAILWAY_SERVICE_ID && RAILWAY_ENVIRONMENT_ID),
  });
});

app.post('/api/admin/keys', requireAdmin, async (req, res) => {
  const { anthropic, gemini } = req.body;
  const updated = {};

  if (anthropic) { ANTHROPIC_KEY = anthropic; updated.anthropic = true; }
  if (gemini) { GEMINI_KEY = gemini; updated.gemini = true; }

  // Persist to Railway if configured
  let railwayResult = null;
  if (RAILWAY_API_TOKEN && RAILWAY_SERVICE_ID && RAILWAY_ENVIRONMENT_ID) {
    const vars = {};
    if (anthropic) vars.ANTHROPIC_API_KEY = anthropic;
    if (gemini) vars.GEMINI_API_KEY = gemini;

    try {
      const query = `mutation($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }`;
      const railwayRes = await fetch('https://backboard.railway.com/graphql/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
        },
        body: JSON.stringify({
          query,
          variables: {
            input: {
              serviceId: RAILWAY_SERVICE_ID,
              environmentId: RAILWAY_ENVIRONMENT_ID,
              variables: vars,
            },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const railwayData = await railwayRes.json();
      if (railwayData.errors) {
        railwayResult = { success: false, error: railwayData.errors[0].message };
      } else {
        railwayResult = { success: true };
      }
    } catch (err) {
      railwayResult = { success: false, error: err.message };
    }
  }

  console.log(`  [ADMIN] ${req.userEmail} updated keys:`, Object.keys(updated).join(', '));
  res.json({ updated, railway: railwayResult });
});

app.post('/api/admin/test-key', requireAdmin, async (req, res) => {
  const { type } = req.body;
  if (type === 'anthropic') {
    if (!ANTHROPIC_KEY) return res.json({ ok: false, error: 'No key configured' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': ANTHROPIC_KEY,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      res.json({ ok: r.status === 200, status: r.status });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  } else if (type === 'gemini') {
    if (!GEMINI_KEY) return res.json({ ok: false, error: 'No key configured' });
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say OK' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      res.json({ ok: r.status === 200, status: r.status });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  } else {
    res.status(400).json({ error: 'type must be "anthropic" or "gemini"' });
  }
});

// Health check endpoint for Railway zero-downtime deploys
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Checklist Audit Engine ─────────────────────────────────────────

const auditEngine = require('./lib/audit/engine');
const { mapAuditToWSR } = require('./lib/audit/mapper');
const { generateSummary } = require('./lib/audit/summary');

app.post('/api/audit/start', requireAuth, (req, res) => {
  const { url, clientName, industry, contact } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const auditId = auditEngine.startAudit(url, { clientName, industry, contact });
  auditEngine.runAudit(auditId).catch(err => {
    console.error('[audit] runAudit failed:', err);
    auditEngine.updateAudit(auditId, { status: 'error', error: err.message, completedAt: Date.now() });
  });
  res.json({ auditId, status: 'running' });
});

app.get('/api/audit/:id/status', requireAuth, (req, res) => {
  const record = auditEngine.getAudit(req.params.id);
  if (!record) return res.status(404).json({ error: 'Audit not found' });
  res.json({ status: record.status, progress: record.progress, error: record.error || null });
});

// ─── Competitor Analysis Endpoints ──────────────────────────────────

const { suggestCompetitors, rationalizeCompetitors } = require('./lib/audit/competitors');

function encodeJobId(job) { return Buffer.from(JSON.stringify(job)).toString('base64url'); }
function decodeJobId(jobId) { return JSON.parse(Buffer.from(jobId, 'base64url').toString()); }

app.post('/api/audit/suggest-competitors', requireAuth, async (req, res) => {
  const { clientUrl, excludeUrls } = req.body;
  if (!clientUrl) return res.status(400).json({ error: 'clientUrl is required' });
  try {
    const competitors = await suggestCompetitors(clientUrl, { excludeUrls: excludeUrls || [] });
    res.json({ competitors });
  } catch (err) {
    console.error('[competitors] Suggestion failed:', err.message);
    res.status(502).json({ error: 'Competitor suggestion failed: ' + err.message });
  }
});

app.post('/api/audit/replace-competitor', requireAuth, async (req, res) => {
  const { clientUrl, excludeUrls } = req.body;
  if (!clientUrl) return res.status(400).json({ error: 'clientUrl is required' });
  try {
    const competitors = await suggestCompetitors(clientUrl, { excludeUrls: excludeUrls || [], count: 1 });
    res.json({ competitor: competitors[0] || null });
  } catch (err) {
    console.error('[competitors] Replacement failed:', err.message);
    res.status(502).json({ error: 'Competitor replacement failed: ' + err.message });
  }
});

app.post('/api/audit/run-batch', requireAuth, (req, res) => {
  const { clientUrl, clientName, industry, contact, competitors } = req.body;
  if (!clientUrl) return res.status(400).json({ error: 'clientUrl is required' });
  if (!competitors || !competitors.length) return res.status(400).json({ error: 'competitors array is required' });

  const clientAuditId = auditEngine.startAudit(clientUrl, { clientName, industry, contact });
  auditEngine.runAudit(clientAuditId).catch(err => {
    console.error('[batch] Client audit failed:', err);
    auditEngine.updateAudit(clientAuditId, { status: 'error', error: err.message, completedAt: Date.now() });
  });

  const compAudits = competitors.map(function(comp) {
    const auditId = auditEngine.startAudit(comp.url, { clientName: comp.name || comp.url });
    auditEngine.runAudit(auditId).catch(err => {
      console.error('[batch] Competitor audit failed:', err);
      auditEngine.updateAudit(auditId, { status: 'error', error: err.message, completedAt: Date.now() });
    });
    return { auditId, url: comp.url, name: comp.name || '', rationale: comp.rationale || '' };
  });

  const job = {
    client: { auditId: clientAuditId, url: clientUrl },
    competitors: compAudits,
  };
  const jobId = encodeJobId(job);

  res.json({ jobId, client: { auditId: clientAuditId }, competitors: compAudits });
});

app.get('/api/audit/batch-status/:jobId', requireAuth, (req, res) => {
  try {
    const job = decodeJobId(req.params.jobId);
    const clientRecord = auditEngine.getAudit(job.client.auditId);
    const compStatuses = job.competitors.map(function(c) {
      const r = auditEngine.getAudit(c.auditId);
      return {
        auditId: c.auditId,
        url: c.url,
        name: c.name,
        status: r ? r.status : 'unknown',
        progress: r ? r.progress : '',
        error: r ? r.error : null,
      };
    });
    const allComplete = (clientRecord && clientRecord.status === 'complete') &&
      compStatuses.every(function(c) { return c.status === 'complete'; });
    const anyError = (clientRecord && clientRecord.status === 'error') ||
      compStatuses.some(function(c) { return c.status === 'error'; });

    res.json({
      allComplete,
      anyError,
      client: {
        auditId: job.client.auditId,
        status: clientRecord ? clientRecord.status : 'unknown',
        progress: clientRecord ? clientRecord.progress : '',
        error: clientRecord ? clientRecord.error : null,
      },
      competitors: compStatuses,
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid jobId' });
  }
});

app.get('/api/audit/comparison/:jobId', requireAuth, async (req, res) => {
  try {
    const job = decodeJobId(req.params.jobId);
    const clientRecord = auditEngine.getAudit(job.client.auditId);
    if (!clientRecord || clientRecord.status !== 'complete') {
      return res.status(400).json({ error: 'Client audit not complete' });
    }

    const clientWsr = mapAuditToWSR(clientRecord, {
      clientName: clientRecord.clientName || clientRecord.businessName,
      industry: clientRecord.industry,
      contact: clientRecord.contact,
    });
    await generateSummary(clientWsr, ANTHROPIC_KEY);

    const compResults = [];
    for (const comp of job.competitors) {
      const record = auditEngine.getAudit(comp.auditId);
      if (!record || record.status !== 'complete') {
        compResults.push({ wsrJson: null, name: comp.name, rationale: comp.rationale, url: comp.url, error: 'Audit not complete' });
        continue;
      }
      const wsrJson = mapAuditToWSR(record, { clientName: record.businessName || comp.name || record.domain });
      compResults.push({ wsrJson, name: comp.name || record.businessName || record.domain, rationale: comp.rationale, url: comp.url });
    }

    res.json({ client: clientWsr, competitors: compResults });
  } catch (err) {
    console.error('[comparison] Error:', err);
    res.status(500).json({ error: 'Comparison failed: ' + err.message });
  }
});

app.get('/api/audit/:id', requireAuth, async (req, res) => {
  const record = auditEngine.getAudit(req.params.id);
  if (!record) return res.status(404).json({ error: 'Audit not found' });
  if (record.status !== 'complete') {
    return res.json({ status: record.status, progress: record.progress, error: record.error || null });
  }

  // If already mapped, return cached result
  if (record._wsrJson) return res.json({ status: 'complete', data: record._wsrJson });

  try {
    const wsrJson = mapAuditToWSR(record, {
      clientName: record.clientName,
      industry: record.industry,
      contact: record.contact,
    });
    await generateSummary(wsrJson, ANTHROPIC_KEY);
    record._wsrJson = wsrJson;
    res.json({ status: 'complete', data: wsrJson });
  } catch (err) {
    console.error('[audit] Mapper/summary error:', err);
    res.status(500).json({ error: 'Failed to generate report: ' + err.message });
  }
});

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
  const { url, raw } = req.body;
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch URL: ' + response.status });
    const html = await response.text();
    // Raw mode: return the actual HTML so callers can parse markup (e.g. logo <img> tags)
    if (raw) return res.json({ html: html.slice(0, 500000), length: html.length });
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

// ─── Hosted proposal links (public, unguessable tokens) ──────────────
// data/published/<token>.json = { token, company, html, publishedAt, updatedAt,
// views: [{t, ua}], accepted: {name, t, ip} | null }
const PUBLISHED_DIR = path.join(__dirname, 'data', 'published');

function escapeHtmlText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function readPublished(token) {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token || '')) return null;
  const file = path.join(PUBLISHED_DIR, token + '.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function writePublished(rec) {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLISHED_DIR, rec.token + '.json'), JSON.stringify(rec));
}

// Publish (or republish to the same token → stable URL)
app.post('/api/publish', requireAuth, (req, res) => {
  const { html, company, token, contactEmail } = req.body;
  if (!html || typeof html !== 'string') return res.status(400).json({ error: 'html is required' });
  if (html.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Document too large' });
  const cleanEmail = (typeof contactEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
    ? contactEmail.trim().toLowerCase() : '';
  let rec = token ? readPublished(token) : null;
  if (rec) {
    rec.html = html;
    if (company) rec.company = String(company).slice(0, 120);
    if (cleanEmail) rec.contactEmail = cleanEmail;
    rec.updatedAt = Date.now();
  } else {
    rec = {
      token: crypto.randomBytes(12).toString('base64url'),
      company: String(company || '').slice(0, 120),
      contactEmail: cleanEmail,
      html,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
      views: [],
      accepted: null,
    };
  }
  try {
    writePublished(rec);
    res.json({ token: rec.token, url: '/p/' + rec.token, views: rec.views.length, accepted: rec.accepted, hubspot: (HUBSPOT_TOKEN && rec.contactEmail) ? rec.contactEmail : null });
  } catch (err) {
    console.error('Publish error:', err.message);
    res.status(500).json({ error: 'Publish failed: ' + err.message });
  }
});

// Status for the app UI (views + acceptance)
app.get('/api/publish/:token/status', requireAuth, (req, res) => {
  const rec = readPublished(req.params.token);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json({
    token: rec.token,
    views: rec.views.length,
    lastViewedAt: rec.views.length ? rec.views[rec.views.length - 1].t : null,
    accepted: rec.accepted,
    publishedAt: rec.publishedAt,
    updatedAt: rec.updatedAt,
    hubspot: (HUBSPOT_TOKEN && rec.contactEmail) ? rec.contactEmail : null,
  });
});

// ─── HubSpot sync (opens + acceptances → notes on the contact) ───────
// Fire-and-forget: never blocks or breaks proposal viewing/signing.
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN || '';
const hubspotContactCache = new Map(); // email → { id, at }

async function hubspotFindContact(email) {
  const cached = hubspotContactCache.get(email);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.id;
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HUBSPOT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email'],
      limit: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('contact search ' + res.status);
  const data = await res.json();
  const id = (data.results && data.results[0] && data.results[0].id) || null;
  if (id) hubspotContactCache.set(email, { id, at: Date.now() });
  return id;
}

async function hubspotLogNote(rec, body) {
  if (!HUBSPOT_TOKEN || !rec.contactEmail) return;
  try {
    const contactId = await hubspotFindContact(rec.contactEmail);
    if (!contactId) {
      console.log('[HubSpot] no contact found for ' + rec.contactEmail + ' — note skipped');
      return;
    }
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + HUBSPOT_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { hs_timestamp: Date.now(), hs_note_body: body },
        associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('note create ' + res.status + ' ' + (await res.text()).slice(0, 200));
    console.log('[HubSpot] note logged for ' + rec.contactEmail + ': ' + body.slice(0, 60));
  } catch (err) {
    console.warn('[HubSpot] sync failed (non-blocking): ' + err.message);
  }
}

// After acceptance, render the signature into the proposal's Authorization block:
// typed name in script on the signature line, date on the date line, and a
// verification line (full timestamp, IP, reference ID) underneath. Anchored on
// the proposal template's signature markup — if a future template changes that
// markup, this silently no-ops and the accepted banner still shows.
function injectSignature(html, rec) {
  const a = rec.accepted;
  if (!a) return html;
  const name = escapeHtmlText(a.name);
  const whenFull = new Date(a.t).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PT';
  const dateOnly = new Date(a.t).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
  let out = html;
  // Fill the two empty signature lines (signature + date)
  const lineRe = /<div style="display:grid; grid-template-columns:1fr 0\.5fr; gap:20px; margin-bottom:4px;">\s*<div style="border-bottom:1px solid #1D1D1F;[^"]*"><\/div>\s*<div style="border-bottom:1px solid #1D1D1F;[^"]*"><\/div>\s*<\/div>/;
  if (lineRe.test(out)) {
    out = out.replace(lineRe,
      '<div style="display:grid; grid-template-columns:1fr 0.5fr; gap:20px; margin-bottom:4px;">'
      + '<div style="border-bottom:1px solid #1D1D1F; min-height:26px; display:flex; align-items:flex-end;"><span style="font-family:\'Segoe Script\',\'Brush Script MT\',\'Lucida Handwriting\',cursive; font-size:19px; color:#1D1D1F; line-height:1; padding-bottom:2px;">' + name + '</span></div>'
      + '<div style="border-bottom:1px solid #1D1D1F; min-height:26px; display:flex; align-items:flex-end;"><span style="font-size:12px; color:#1D1D1F; padding-bottom:4px;">' + escapeHtmlText(dateOnly) + '</span></div>'
      + '</div>');
  }
  // Verification line under the Signature/Date labels
  const labelsRe = /(<div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0\.10em; color:var\(--gray-2\);">Date<\/div>\s*<\/div>)/;
  if (labelsRe.test(out)) {
    out = out.replace(labelsRe,
      '$1<div style="margin-top:10px; font-size:9px; color:#636366; line-height:1.6; letter-spacing:0.02em;">'
      + '&#10003; Digitally accepted by ' + name
      + ' &nbsp;&middot;&nbsp; ' + escapeHtmlText(whenFull)
      + ' &nbsp;&middot;&nbsp; IP ' + escapeHtmlText(a.ip || 'unavailable')
      + ' &nbsp;&middot;&nbsp; Ref ' + escapeHtmlText(rec.token.slice(0, 8).toUpperCase())
      + '</div>');
  }
  return out;
}

function acceptUiHtml(rec) {
  const hideOnPrint = '<style>@media print { .pub-ui { display:none !important; } } body { margin-bottom:120px; }</style>';
  if (rec.accepted) {
    return hideOnPrint
      + '<div class="pub-ui" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#065F46;color:#fff;padding:12px 20px;text-align:center;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,0.25);">'
      + '&#10003; Proposal accepted by <strong>' + escapeHtmlText(rec.accepted.name) + '</strong> on '
      + new Date(rec.accepted.t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      + ' &mdash; the efelle team will reach out shortly to schedule your kickoff call.'
      + '</div>';
  }
  return hideOnPrint
    + '<div class="pub-ui" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1D1D1F;padding:14px 20px;box-shadow:0 -4px 20px rgba(0,0,0,0.35);font-family:\'Plus Jakarta Sans\',sans-serif;">'
    + '<div style="max-width:780px;margin:0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center;">'
    + '<div style="color:#fff;font-weight:700;font-size:14px;white-space:nowrap;">Ready to move forward?</div>'
    + '<input id="pub-accept-name" type="text" placeholder="Type your full name" style="flex:1;min-width:180px;max-width:280px;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;font-family:inherit;">'
    + '<label style="color:rgba(255,255,255,0.75);font-size:11px;display:flex;align-items:center;gap:6px;max-width:260px;line-height:1.4;"><input id="pub-accept-check" type="checkbox" style="width:15px;height:15px;flex-shrink:0;"> I am authorized to approve this proposal on behalf of my company</label>'
    + '<button id="pub-accept-btn" style="padding:11px 22px;border:none;border-radius:8px;background:#F56300;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;white-space:nowrap;">Accept &amp; Sign</button>'
    + '</div>'
    + '<div id="pub-accept-status" style="text-align:center;color:#fb923c;font-size:12px;min-height:16px;margin-top:6px;"></div>'
    + '</div>'
    + '<script>document.getElementById("pub-accept-btn").addEventListener("click", async function() {'
    + 'var name = document.getElementById("pub-accept-name").value.trim();'
    + 'var checked = document.getElementById("pub-accept-check").checked;'
    + 'var st = document.getElementById("pub-accept-status");'
    + 'if (name.length < 2) { st.textContent = "Please type your full name."; return; }'
    + 'if (!checked) { st.textContent = "Please confirm you are authorized to approve this proposal."; return; }'
    + 'this.disabled = true; this.textContent = "Recording\\u2026";'
    // Retry on server errors / network blips (e.g. a brief server restart) so a
    // prospect mid-signature never sees a bare "Failed" for a transient condition.
    + 'var lastErr = "";'
    + 'for (var attempt = 1; attempt <= 3; attempt++) {'
    + 'try {'
    + 'var r = await fetch("/api/p/" + ' + JSON.stringify(rec.token) + ' + "/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name }) });'
    + 'var d = null; try { d = await r.json(); } catch (pe) {}'
    + 'if (r.ok) { location.reload(); return; }'
    + 'if (d && d.error && r.status < 500) { lastErr = d.error; break; }'
    + 'lastErr = (d && d.error) || ("Server returned " + r.status);'
    + '} catch (e) { lastErr = "Connection issue"; }'
    + 'if (attempt < 3) { st.textContent = "Server is briefly busy \\u2014 retrying (" + attempt + " of 2)\\u2026"; await new Promise(function(rs) { setTimeout(rs, 3000); }); }'
    + '}'
    + 'st.textContent = lastErr + " \\u2014 please try again in a minute, or call us at 206.384.4909 and we\\u2019ll take care of it.";'
    + 'this.disabled = false; this.textContent = "Accept & Sign";'
    + '});</script>';
}

// Public proposal view — logs the open, injects the accept UI
const publicViewLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.get('/p/:token', publicViewLimiter, (req, res) => {
  const rec = readPublished(req.params.token);
  if (!rec) return res.status(404).send('<div style="font-family:sans-serif;padding:60px;text-align:center;"><h2>Proposal not found</h2><p>This link may have expired — please contact efelle creative at 206.384.4909.</p></div>');
  try {
    rec.views.push({ t: Date.now(), ua: (req.headers['user-agent'] || '').slice(0, 200) });
    if (rec.views.length > 500) rec.views = rec.views.slice(-500);
    // HubSpot: note the first open, then at most one "opened again" note per 6h
    if (HUBSPOT_TOKEN && rec.contactEmail && (!rec.hsLastViewNoteAt || Date.now() - rec.hsLastViewNoteAt > 6 * 60 * 60 * 1000)) {
      rec.hsLastViewNoteAt = Date.now();
      const n = rec.views.length;
      hubspotLogNote(rec, '📄 efelle proposal ' + (n === 1 ? 'opened' : 'opened again (view #' + n + ')')
        + ' — "' + rec.company + '" — https://prospector.efelle.com/p/' + rec.token);
    }
    writePublished(rec);
  } catch (e) { /* tracking must never block viewing */ }
  const ui = acceptUiHtml(rec);
  const signed = rec.accepted ? injectSignature(rec.html, rec) : rec.html;
  const html = signed.includes('</body>') ? signed.replace('</body>', ui + '</body>') : signed + ui;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.send(html);
});

// Public acceptance — first acceptance wins, later attempts return the record
const acceptLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.post('/api/p/:token/accept', acceptLimiter, (req, res) => {
  const rec = readPublished(req.params.token);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  if (rec.accepted) return res.json({ ok: true, accepted: rec.accepted, already: true });
  const name = ((req.body || {}).name || '').toString().trim().slice(0, 120);
  if (name.length < 2) return res.status(400).json({ error: 'Please type your full name' });
  rec.accepted = {
    name,
    t: Date.now(),
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(),
  };
  try {
    writePublished(rec);
    console.log('Proposal ACCEPTED: "' + rec.company + '" by ' + name);
    hubspotLogNote(rec, '✅ efelle proposal ACCEPTED by ' + name + ' — "' + rec.company + '" — signed '
      + new Date(rec.accepted.t).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
      + ' PT — https://prospector.efelle.com/p/' + rec.token);
    res.json({ ok: true, accepted: rec.accepted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record acceptance' });
  }
});

// ─── Render a proposal to PDF server-side ────────────────────────────
// Consistent pagination on every machine — no browser print dialog variance.
app.post('/api/proposal-pdf', requireAuth, async (req, res) => {
  if (!puppeteer) return res.status(501).json({ error: 'PDF rendering not available on this server' });
  const { html, filename } = req.body;
  if (!html || typeof html !== 'string') return res.status(400).json({ error: 'html is required' });
  if (html.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Document too large' });
  const safeName = (filename || 'proposal.pdf').replace(/[^\w.\- ]/g, '').slice(0, 120) || 'proposal.pdf';
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, timeout: 60000 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + safeName + '"');
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('Proposal PDF error:', err.message);
    res.status(500).json({ error: 'PDF render failed: ' + err.message });
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
  }
});

// ─── RGS case studies (shown on RGS Only proposals) ─────────────────
// Stored on the persistent volume so the team can manage them from Settings
// without a code deploy. When no file exists, the client uses its bundled list.
const CASE_STUDIES_FILE = path.join(__dirname, 'data', 'case-studies.json');
app.get('/api/case-studies', requireAuth, (req, res) => {
  try {
    if (fs.existsSync(CASE_STUDIES_FILE)) {
      return res.json({ caseStudies: JSON.parse(fs.readFileSync(CASE_STUDIES_FILE, 'utf8')) });
    }
  } catch (e) { console.error('case-studies read error:', e.message); }
  res.json({ caseStudies: null });
});
app.post('/api/case-studies', requireAdmin, (req, res) => {
  const { caseStudies } = req.body;
  if (!Array.isArray(caseStudies) || caseStudies.length > 20) {
    return res.status(400).json({ error: 'caseStudies must be an array of up to 20 entries' });
  }
  const cleaned = [];
  for (const cs of caseStudies) {
    const img = (cs && typeof cs.img === 'string') ? cs.img.trim() : '';
    if (!/^(https?:\/\/|\/uploads\/)/.test(img)) {
      return res.status(400).json({ error: 'Each entry needs an image URL starting with https:// or /uploads/' });
    }
    cleaned.push({ img, client: (cs.client || '').toString().slice(0, 80) });
  }
  try {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    fs.writeFileSync(CASE_STUDIES_FILE, JSON.stringify(cleaned, null, 2));
    res.json({ ok: true, count: cleaned.length });
  } catch (err) {
    console.error('case-studies write error:', err.message);
    res.status(500).json({ error: 'Failed to save: ' + err.message });
  }
});

// ─── Store an image on the persistent volume (client logos) ─────────
// Content-addressed filenames: re-uploading the same logo reuses the same file.
app.post('/api/upload-image', requireAuth, (req, res) => {
  const { dataUri } = req.body;
  if (!dataUri || typeof dataUri !== 'string') return res.status(400).json({ error: 'dataUri is required' });
  const m = dataUri.match(/^data:(image\/(?:png|jpeg|jpg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) return res.status(415).json({ error: 'dataUri must be a base64-encoded image' });
  let buf;
  try { buf = Buffer.from(m[2], 'base64'); } catch (e) { return res.status(400).json({ error: 'Invalid base64 data' }); }
  if (!buf.length) return res.status(400).json({ error: 'Empty image data' });
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max 5 MB)' });
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[m[1]];
  try {
    const dir = path.join(__dirname, 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const file = 'logo-' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '.' + ext;
    fs.writeFileSync(path.join(dir, file), buf);
    res.json({ url: '/uploads/' + file, bytes: buf.length });
  } catch (err) {
    console.error('Image upload error:', err.message);
    res.status(500).json({ error: 'Failed to store image: ' + err.message });
  }
});

// ─── Fetch an image as a data URI (for logo analysis + embedding) ────
app.post('/api/fetch-image', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  // Block internal/private URLs (SSRF protection) — same rules as /api/fetch-url
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
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch image: ' + response.status });
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'URL is not an image (' + (contentType || 'unknown type') + ')' });
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max 5 MB)' });
    res.json({ dataUri: 'data:' + contentType + ';base64,' + buf.toString('base64'), bytes: buf.length });
  } catch (err) {
    console.error('Image fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch image: ' + err.message });
  }
});

// ─── Discover sitemaps from a website ────────────────────────────────

// ─── Screenshot a website (desktop + mobile) ────────────────────────

app.post('/api/screenshot', requireAuth, async (req, res) => {
  if (!puppeteer) return res.status(501).json({ error: 'Puppeteer not available on this server' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    // Desktop screenshot (1280x800)
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport({ width: 1280, height: 800 });
    await desktopPage.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500)); // let animations settle
    const desktopBuffer = await desktopPage.screenshot({ type: 'jpeg', quality: 75 });
    await desktopPage.close();

    // Mobile screenshot (375x812, iPhone)
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 812, isMobile: true });
    await mobilePage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await mobilePage.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));
    const mobileBuffer = await mobilePage.screenshot({ type: 'jpeg', quality: 75 });
    await mobilePage.close();

    // Save to disk instead of returning base64
    const SCREENSHOTS_DIR = path.join(__dirname, 'data', 'screenshots');
    if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    const slug = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 60);
    const ts = Date.now();
    const desktopFile = `${slug}-desktop-${ts}.jpg`;
    const mobileFile = `${slug}-mobile-${ts}.jpg`;

    fs.writeFileSync(path.join(SCREENSHOTS_DIR, desktopFile), desktopBuffer);
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, mobileFile), mobileBuffer);

    res.json({
      desktop: `/screenshots/${desktopFile}`,
      mobile: `/screenshots/${mobileFile}`,
    });
  } catch (err) {
    console.error('Screenshot error:', err.message);
    res.status(500).json({ error: 'Screenshot failed: ' + err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

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

    // Detect industry from page content
    let industry = '';

    // Check meta description and keywords
    const metaDesc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i) || [])[1] || '';
    const metaKeywords = (html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i) || [])[1] || '';

    // Check schema.org @type for industry hints
    const schemaType = (html.match(/"@type"\s*:\s*"([^"]+)"/g) || []).join(' ');

    // Strip HTML for text analysis
    const pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 10000)
      .toLowerCase();

    // Industry keyword matching (ordered by specificity)
    const industryPatterns = [
      { keywords: ['roofing', 'roof repair', 'shingle', 'roofer'], label: 'Roofing' },
      { keywords: ['plumbing', 'plumber', 'drain', 'water heater'], label: 'Plumbing' },
      { keywords: ['hvac', 'heating', 'air conditioning', 'furnace', 'cooling'], label: 'HVAC' },
      { keywords: ['electrician', 'electrical', 'wiring', 'panel upgrade'], label: 'Electrical' },
      { keywords: ['landscaping', 'lawn care', 'hardscape', 'irrigation'], label: 'Landscaping' },
      { keywords: ['pest control', 'exterminator', 'termite', 'pest management'], label: 'Pest Control' },
      { keywords: ['dental', 'dentist', 'orthodont', 'oral surgery'], label: 'Dental' },
      { keywords: ['veterinar', 'animal hospital', 'pet care', 'vet clinic'], label: 'Veterinary' },
      { keywords: ['real estate', 'realtor', 'property', 'homes for sale', 'mls'], label: 'Real Estate' },
      { keywords: ['construction', 'general contractor', 'remodel', 'renovation', 'builder'], label: 'Construction' },
      { keywords: ['painting', 'painter', 'interior painting', 'exterior painting'], label: 'Painting' },
      { keywords: ['moving', 'movers', 'relocation', 'storage'], label: 'Moving & Storage' },
      { keywords: ['auto repair', 'mechanic', 'auto body', 'car repair'], label: 'Auto Repair' },
      { keywords: ['cleaning', 'janitorial', 'maid service', 'house cleaning'], label: 'Cleaning Services' },
      { keywords: ['law firm', 'attorney', 'lawyer', 'legal'], label: 'Legal' },
      { keywords: ['restaurant', 'dining', 'menu', 'reservations', 'cuisine'], label: 'Restaurant' },
      { keywords: ['salon', 'hair', 'beauty', 'spa', 'skincare'], label: 'Beauty & Wellness' },
      { keywords: ['fitness', 'gym', 'personal training', 'workout'], label: 'Fitness' },
      { keywords: ['insurance', 'coverage', 'policy', 'claims'], label: 'Insurance' },
      { keywords: ['accounting', 'accountant', 'tax', 'bookkeeping', 'cpa'], label: 'Accounting' },
      { keywords: ['ecommerce', 'shop', 'add to cart', 'buy now', 'products'], label: 'E-Commerce' },
      { keywords: ['medical', 'healthcare', 'clinic', 'patient', 'physician'], label: 'Healthcare' },
    ];

    const combinedText = (metaDesc + ' ' + metaKeywords + ' ' + schemaType + ' ' + pageText).toLowerCase();
    let bestMatch = null;
    let bestCount = 0;

    for (const p of industryPatterns) {
      const count = p.keywords.filter(k => combinedText.includes(k)).length;
      if (count > bestCount) {
        bestCount = count;
        bestMatch = p.label;
      }
    }

    if (bestMatch && bestCount >= 1) industry = bestMatch;

    res.json({ name: name || null, industry: industry || null });
  } catch (err) {
    res.json({ name: null, industry: null });
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

  // Auto-cleanup screenshots older than 90 days
  const SCREENSHOTS_DIR = path.join(__dirname, 'data', 'screenshots');
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    const cutoff = Date.now() - 120 * 24 * 60 * 60 * 1000;
    let cleaned = 0;
    fs.readdirSync(SCREENSHOTS_DIR).forEach(f => {
      const fp = path.join(SCREENSHOTS_DIR, f);
      try {
        const stat = fs.statSync(fp);
        if (stat.mtimeMs < cutoff) { fs.unlinkSync(fp); cleaned++; }
      } catch (e) {}
    });
    if (cleaned) console.log('  Cleaned ' + cleaned + ' screenshots older than 120 days');
  }
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
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    pagespeed: !!process.env.GOOGLE_PAGESPEED_KEY,
    places: !!process.env.GOOGLE_PLACES_API_KEY,
    tavily: !!process.env.TAVILY_API_KEY,
    dataforseo: !!(process.env.ENABLE_DATAFORSEO === '1' || process.env.ENABLE_DATAFORSEO === 'true') && !!process.env.DATAFORSEO_LOGIN,
    railway: !!(RAILWAY_API_TOKEN && RAILWAY_SERVICE_ID && RAILWAY_ENVIRONMENT_ID),
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
