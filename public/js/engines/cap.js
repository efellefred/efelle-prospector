import { getApiHeaders } from '../core/api.js';
import { API_MODEL } from '../core/state.js';
import { CAP_SYSTEM } from '../data/prompts.js';
import { dbg } from '../core/debug.js';
import { saveReport, listReports, getReport } from '../core/reports.js';

let capReportHtml = '';

// Auto-populate CAP fields from CCA data when the CAP screen becomes visible
const capObserver = new MutationObserver(() => {
  const capScreen = document.getElementById('screen-cap');
  if (capScreen && capScreen.classList.contains('visible')) {
    populateCAPClientSelect();
    if (window.ccaData) {
      const d = window.ccaData;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && !el.value && val) el.value = val; };
      setVal('cap-client-name', d.company_name);
      setVal('cap-industry', d.primary_services || d.industry);
      setVal('cap-market', d.geographic_market);
      setVal('cap-differentiators', d.key_differentiators);
      setVal('cap-notes', d.meeting_notes);
    }
  }
});
const capScreen = document.getElementById('screen-cap');
if (capScreen) capObserver.observe(capScreen, { attributes: true, attributeFilter: ['class'] });

document.getElementById('cap-generate-btn').addEventListener('click', async () => {
  const btn = document.getElementById('cap-generate-btn');
  const errEl = document.getElementById('error-msg-cap');
  const progressEl = document.getElementById('gen-progress-cap');
  const progressFill = document.getElementById('gen-progress-cap-fill');
  const progressMsg = document.getElementById('gen-progress-cap-msg');
  const progressPct = document.getElementById('gen-progress-cap-pct');

  const clientName = document.getElementById('cap-client-name').value.trim();
  if (!clientName) { errEl.textContent = '⚠ Client name is required.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  btn.disabled = true; btn.textContent = '⟳ Generating…';
  progressEl.classList.add('visible');

  const stages = [
    { pct: 15, msg: 'Building roadmap phases…',          delay: 2000  },
    { pct: 40, msg: 'Writing Top 10 Quick Wins…',        delay: 8000  },
    { pct: 65, msg: 'Drafting homepage rewrite…',        delay: 16000 },
    { pct: 85, msg: 'Finalising report layout…',         delay: 24000 },
  ];
  const timers = stages.map(s => setTimeout(() => {
    progressFill.style.width = s.pct + '%';
    progressPct.textContent = s.pct + '%';
    progressMsg.textContent = s.msg;
  }, s.delay));

  const prompt = `Generate the Action & Growth supplement for this client.

CLIENT: ${clientName}
Industry / Services: ${document.getElementById('cap-industry').value || 'not provided'}
Geographic Market: ${document.getElementById('cap-market').value || 'not provided'}
Key Differentiators: ${document.getElementById('cap-differentiators').value || 'not provided'}
Known Weaknesses: ${document.getElementById('cap-weaknesses').value || 'not provided'}
Target Audiences: ${document.getElementById('cap-audiences').value || 'not provided'}
Ad Channels / Budget: ${document.getElementById('cap-ads').value || 'not provided'}
Meeting Notes: ${document.getElementById('cap-notes').value || 'none'}

Generate all 3 sections as a complete self-contained HTML file per the system prompt. Return ONLY the HTML.`;

  try {
    let res, data;
    for (let retry = 0; retry < 3; retry++) {
      if (retry > 0) await new Promise(r => setTimeout(r, retry * 5000));
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 2 minutes.')), 120000)
      );
      try {
        res = await Promise.race([
          fetch('/api/messages', {
            method: 'POST', headers: getApiHeaders(),
            body: JSON.stringify({ model: API_MODEL, max_tokens: 8192, system: CAP_SYSTEM, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: 'user', content: prompt }] })
          }),
          timeout
        ]);
      } catch (e) { if (retry < 2) continue; throw e; }
      if (res.ok) break;
      if (res.status === 429 || res.status === 529) continue;
      throw new Error('API ' + res.status);
    }
    timers.forEach(t => clearTimeout(t));
    if (!res.ok) throw new Error('API rate limited after retries. Please wait a minute and try again.');
    data = await res.json();
    let html = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    html = html.replace(/^\x60{3}html\s*/i, '').replace(/\x60{3}\s*$/, '').trim();
    capReportHtml = html;
    progressFill.style.width = '100%'; progressPct.textContent = '100%';
    setTimeout(() => progressEl.classList.remove('visible'), 800);

    document.getElementById('cap-output').style.display = 'block';
    document.getElementById('cap-report-frame').srcdoc = html;
    document.getElementById('cap-output').scrollIntoView({ behavior: 'smooth' });

    try {
      await saveReport('cap', document.getElementById('cap-client-name').value || 'Unknown', {
        industry: document.getElementById('cap-industry').value || '',
        market: document.getElementById('cap-market').value || '',
      }, null, capReportHtml);
    } catch (e) { console.warn('Auto-save failed:', e.message); }

  } catch(e) {
    timers.forEach(t => clearTimeout(t));
    progressEl.classList.remove('visible');
    errEl.textContent = '⚠ ' + (e.message || 'Generation failed. Please try again.');
    errEl.style.display = 'block';
  }
  btn.disabled = false; btn.textContent = 'Generate Action Plan →';
});

document.getElementById('cap-download-btn').addEventListener('click', () => {
  if (!capReportHtml) return;
  const name = (document.getElementById('cap-client-name').value || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(capReportHtml);
  a.download = name + '-action-plan.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
});

// ─── CAP Save as PDF ───────────────────────────────────────────────
document.getElementById('cap-save-pdf-btn').addEventListener('click', () => {
  if (!capReportHtml) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(capReportHtml);
  printWindow.document.close();
  printWindow.onload = () => { setTimeout(() => printWindow.print(), 500); };
});

// ─── CAP AI Chat Edit Panel ────────────────────────────────────────
document.getElementById('cap-chat-toggle-btn').addEventListener('click', () => {
  const panel = document.getElementById('cap-chat-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') document.getElementById('cap-chat-input').focus();
});

document.getElementById('cap-chat-send').addEventListener('click', async () => {
  const input = document.getElementById('cap-chat-input');
  const instruction = input.value.trim();
  if (!instruction || !capReportHtml) return;

  const messagesEl = document.getElementById('cap-chat-messages');
  const sendBtn = document.getElementById('cap-chat-send');

  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'background:#374151;border-radius:8px;padding:8px 12px;font-size:12px;color:#e2ddd4;align-self:flex-end;max-width:85%;';
  userMsg.textContent = instruction;
  messagesEl.appendChild(userMsg);
  input.value = '';
  sendBtn.disabled = true;
  sendBtn.textContent = '…';

  const thinkMsg = document.createElement('div');
  thinkMsg.style.cssText = 'background:#252d3d;border-radius:8px;padding:8px 12px;font-size:12px;color:#9ca3af;';
  thinkMsg.textContent = 'Editing report…';
  messagesEl.appendChild(thinkMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: 'You are a report editor. The user will give you an HTML report and an edit instruction. Apply the edit and return the COMPLETE modified HTML. Return ONLY the HTML, no explanation, no markdown fences.',
        messages: [{ role: 'user', content: 'Here is the current report HTML:\n\n' + capReportHtml + '\n\nEdit instruction: ' + instruction + '\n\nReturn the complete modified HTML:' }]
      })
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const d = await res.json();
    let newHtml = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    newHtml = newHtml.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    const hStart = newHtml.indexOf('<!DOCTYPE');
    const hEnd = newHtml.lastIndexOf('</html>');
    if (hStart !== -1 && hEnd !== -1) newHtml = newHtml.slice(hStart, hEnd + 7);
    capReportHtml = newHtml;
    document.getElementById('cap-report-frame').srcdoc = capReportHtml;
    thinkMsg.textContent = '✓ Change applied';
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

// Load CCA reports into the CAP client selector dropdown
async function populateCAPClientSelect() {
  const select = document.getElementById('cap-client-select');
  if (!select) return;
  try {
    const reports = await listReports('cca');
    select.innerHTML = '<option value="">— Select a previous client —</option>';
    reports.forEach(r => {
      const date = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.clientName} (${date})`;
      select.appendChild(opt);
    });
  } catch (e) { console.warn('Failed to load clients:', e); }
}

// Handle client selection — auto-populate ALL CAP fields from strategy data
async function loadCAPClient(reportId) {
  if (!reportId) return;
  try {
    const report = await getReport(reportId);
    if (!report) return;
    const d = report.engineData || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

    setVal('cap-client-name', d.company_name || d.name || report.clientName);
    setVal('cap-industry', d.primary_services || d.industry || d.service_types ||
      (Array.isArray(d.services) ? d.services.join(', ') : d.services) || '');
    setVal('cap-market', d.geographic_market || d.market || d.service_area || d.target_markets || '');

    // Differentiators — could be string or array
    const diff = d.key_differentiators || d.differentiators || d.unique_selling_points || '';
    setVal('cap-differentiators', Array.isArray(diff) ? diff.join(', ') : diff);

    // Weaknesses
    const weak = d.weaknesses || d.key_weaknesses || d.digital_weaknesses || '';
    setVal('cap-weaknesses', Array.isArray(weak) ? weak.join(', ') : weak);

    // Audiences
    const aud = d.target_audiences || d.audiences || d.target_market || '';
    setVal('cap-audiences', Array.isArray(aud) ? aud.join(', ') : aud);

    // Current ads
    setVal('cap-ads', d.current_advertising || d.current_ads || d.advertising || '');

    // Meeting notes
    setVal('cap-notes', d.meeting_notes || d.notes || '');

    // Show a status message
    const genBtn = document.getElementById('cap-generate-btn');
    if (genBtn) {
      genBtn.style.boxShadow = '0 4px 16px rgba(251,146,60,0.3)';
      genBtn.style.background = 'linear-gradient(135deg,#7a4a10,#fb923c)';
    }

  } catch (e) { console.warn('Failed to load client data:', e); }
}
window.loadCAPClient = loadCAPClient;
