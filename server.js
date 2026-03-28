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

app.post('/auth/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  console.log('[AUTH] Expected pw length:', TEAM_PASSWORD.length, '| Received pw length:', (password || '').length, '| Match:', password === TEAM_PASSWORD);
  if (password === TEAM_PASSWORD) {
    const token = crypto.randomUUID();
    sessions.set(token, Date.now() + 24 * 60 * 60 * 1000); // 24h
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/auth/check', (req, res) => {
  const token = req.headers['x-session-token'];
  const expiry = sessions.get(token);
  if (expiry && Date.now() < expiry) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  const expiry = sessions.get(token);
  if (!expiry || Date.now() > expiry) {
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
  next();
}

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
  const index = readIndex();
  const type = req.query.type;
  const filtered = type ? index.filter(r => r.type === type) : index;
  res.json(filtered);
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
