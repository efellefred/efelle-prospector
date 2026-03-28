#!/usr/bin/env node
/**
 * efelle Prospector — Automated Smoke Tests
 *
 * Tests all engine API flows without a browser.
 * Run: node tests/smoke-test.js
 *
 * Requires the server to be running on localhost:3000
 */

const BASE = process.env.TEST_URL || 'http://localhost:3000';
const PASSWORD = process.env.TEST_PASSWORD || '83008300';

let token = null;
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

// ─── Helpers ───────────────────────────────────────────────────────

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-session-token'] = token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${BASE}${path}`, opts);
}

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    passed++;
    results.push({ name, status: 'PASS', ms });
    log('✅', `${name} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    failed++;
    results.push({ name, status: 'FAIL', ms, error: err.message });
    log('❌', `${name} — ${err.message} (${ms}ms)`);
  }
}

function skip(name, reason) {
  skipped++;
  results.push({ name, status: 'SKIP', reason });
  log('⏭️', `${name} — ${reason}`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ─── Tests ─────────────────────────────────────────────────────────

async function run() {
  console.log('\n  efelle Prospector — Smoke Tests');
  console.log('  ═══════════════════════════════\n');
  console.log(`  Target: ${BASE}\n`);

  // ── Auth ──────────────────────────────────────────────────────

  console.log('  ── Auth ──');

  await test('Server is reachable', async () => {
    const res = await fetch(BASE);
    assert(res.ok, `Server returned ${res.status}`);
  });

  await test('Login with correct password', async () => {
    const res = await api('POST', '/auth/login', { password: PASSWORD });
    assert(res.ok, `Login returned ${res.status}`);
    const data = await res.json();
    assert(data.token, 'No token returned');
    token = data.token;
  });

  await test('Login rejects wrong password', async () => {
    const res = await api('POST', '/auth/login', { password: 'wrong' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('Auth check with valid token', async () => {
    const res = await api('GET', '/auth/check');
    assert(res.ok, `Auth check returned ${res.status}`);
    const data = await res.json();
    assert(data.valid, 'Token not valid');
  });

  await test('Protected route rejects without token', async () => {
    const saved = token;
    token = null;
    const res = await api('GET', '/api/reports');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    token = saved;
  });

  // ── Anthropic API Proxy ───────────────────────────────────────

  console.log('\n  ── Anthropic API ──');

  await test('Claude API responds (minimal request)', async () => {
    const res = await api('POST', '/api/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 20,
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }]
    });
    assert(res.ok, `API returned ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    assert(text.toLowerCase().includes('hello'), `Expected "hello", got: ${text.slice(0, 100)}`);
  });

  await test('Claude API rate limit staggering works', async () => {
    // Fire 2 quick requests — second should be staggered
    const t1 = Date.now();
    const [r1, r2] = await Promise.all([
      api('POST', '/api/messages', { model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'Say 1' }] }),
      api('POST', '/api/messages', { model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'Say 2' }] })
    ]);
    const elapsed = Date.now() - t1;
    assert(r1.ok && r2.ok, `Requests failed: ${r1.status}, ${r2.status}`);
    // Second request should have been staggered by at least 2 seconds
    assert(elapsed >= 2000, `Expected stagger delay, but both completed in ${elapsed}ms`);
  });

  // ── Gemini API Proxy ──────────────────────────────────────────

  console.log('\n  ── Gemini API ──');

  await test('Gemini API responds (minimal request)', async () => {
    const res = await api('POST', '/api/gemini', {
      prompt: 'Say "hello" and nothing else.',
      model: 'gemini-2.5-flash-lite'
    });
    assert(res.ok, `API returned ${res.status}`);
    const data = await res.json();
    const text = (data.candidates || [{}])[0]?.content?.parts
      ?.filter(p => p.text).map(p => p.text).join('').trim() || '';
    assert(text.length > 0, 'Gemini returned empty text');
    assert(text.toLowerCase().includes('hello'), `Expected "hello", got: ${text.slice(0, 100)}`);
  });

  await test('Gemini API with search grounding', async () => {
    const res = await api('POST', '/api/gemini', {
      prompt: 'What is the website rubicon-construction.com about? Answer in one sentence.',
      model: 'gemini-2.5-flash-lite'
    });
    assert(res.ok, `API returned ${res.status}`);
    const data = await res.json();
    const text = (data.candidates || [{}])[0]?.content?.parts
      ?.filter(p => p.text).map(p => p.text).join('').trim() || '';
    assert(text.length > 10, `Gemini returned too little text: ${text.length} chars`);
  });

  // ── URL Fetch ─────────────────────────────────────────────────

  console.log('\n  ── URL Fetch ──');

  await test('Fetch URL returns page text', async () => {
    const res = await api('POST', '/api/fetch-url', { url: 'https://www.rubicon-construction.com' });
    assert(res.ok, `Fetch returned ${res.status}`);
    const data = await res.json();
    assert(data.text && data.text.length > 100, `Text too short: ${data.text?.length || 0} chars`);
    assert(data.text.toLowerCase().includes('rubicon') || data.text.toLowerCase().includes('construction'),
      'Page text does not mention Rubicon or construction');
  });

  // ── Reports API ───────────────────────────────────────────────

  console.log('\n  ── Reports API ──');

  let testReportId = null;

  await test('Save a test report', async () => {
    const res = await api('POST', '/api/reports', {
      type: 'wsr',
      clientName: 'Smoke Test Client',
      metadata: { url: 'https://example.com', industry: 'Testing' },
      engineData: { company_name: 'Smoke Test Client', website: 'https://example.com' },
      html: '<!DOCTYPE html><html><body><h1>Smoke Test Report</h1></body></html>'
    });
    assert(res.ok, `Save returned ${res.status}`);
    const data = await res.json();
    assert(data.id, 'No report ID returned');
    assert(data.saved, 'Report not saved');
    testReportId = data.id;
  });

  await test('List reports includes test report', async () => {
    const res = await api('GET', '/api/reports');
    assert(res.ok, `List returned ${res.status}`);
    const reports = await res.json();
    assert(Array.isArray(reports), 'Reports not an array');
    const found = reports.find(r => r.id === testReportId);
    assert(found, 'Test report not found in list');
    assert(found.clientName === 'Smoke Test Client', `Wrong name: ${found.clientName}`);
  });

  await test('Filter reports by type', async () => {
    const res = await api('GET', '/api/reports?type=wsr');
    assert(res.ok, `Filter returned ${res.status}`);
    const reports = await res.json();
    assert(reports.every(r => r.type === 'wsr'), 'Filter returned non-WSR reports');
  });

  await test('Get report by ID', async () => {
    const res = await api('GET', `/api/reports/${testReportId}`);
    assert(res.ok, `Get returned ${res.status}`);
    const data = await res.json();
    assert(data.clientName === 'Smoke Test Client', 'Wrong client name');
    assert(data.engineData?.company_name === 'Smoke Test Client', 'Engine data missing');
  });

  await test('Download report HTML', async () => {
    const res = await api('GET', `/api/reports/${testReportId}/html`);
    assert(res.ok, `Download returned ${res.status}`);
    const html = await res.text();
    assert(html.includes('Smoke Test Report'), 'HTML content mismatch');
  });

  await test('Clients endpoint returns data', async () => {
    const res = await api('GET', '/api/clients');
    assert(res.ok, `Clients returned ${res.status}`);
    const clients = await res.json();
    assert(Array.isArray(clients), 'Clients not an array');
  });

  // ── Proposal Builder (Claude + Web Search) ────────────────────

  console.log('\n  ── Proposal Builder ──');

  await test('Research Client via web search', async () => {
    const res = await api('POST', '/api/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'You are a web researcher. Return ONLY valid JSON with fields: company_name, location, services (array), service_area. No preamble.',
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: 'Research this business website: https://www.rubicon-construction.com' }]
    });
    assert(res.ok, `Research returned ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    assert(text.length > 50, `Research returned too little: ${text.length} chars`);
  });

  // ── Strategy Builder (Orchestration) ──────────────────────────

  console.log('\n  ── Strategy Builder ──');

  await test('CCA validation call works (Claude structures data)', async () => {
    const mockGeminiData = `Company: Rubicon Construction LLC
Location: Seattle, WA
Services: Commercial Construction, Tenant Improvements, Medical Interiors
Founded: 2005
Revenue: <$5M estimated
Competitors: ABC Construction, XYZ Builders, Pacific Contractors`;

    const res = await api('POST', '/api/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'Extract business data from the research below. Return ONLY valid JSON with: company_name, geographic_market, primary_services, competitors (array of objects with name field).',
      messages: [{ role: 'user', content: mockGeminiData }]
    });
    assert(res.ok, `Validation returned ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    // Should contain parseable JSON
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    assert(jsonStart !== -1 && jsonEnd > jsonStart, 'No JSON in response');
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    assert(parsed.company_name, 'Missing company_name in parsed JSON');
  });

  // ── Cleanup ───────────────────────────────────────────────────

  console.log('\n  ── Cleanup ──');

  await test('Delete test report', async () => {
    const res = await api('DELETE', `/api/reports/${testReportId}`);
    assert(res.ok, `Delete returned ${res.status}`);
  });

  await test('Deleted report is gone', async () => {
    const res = await api('GET', `/api/reports/${testReportId}`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // ── Summary ───────────────────────────────────────────────────

  console.log('\n  ═══════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('  ═══════════════════════════════\n');

  if (failed > 0) {
    console.log('  Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  // Total time
  const totalMs = results.reduce((sum, r) => sum + (r.ms || 0), 0);
  console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
