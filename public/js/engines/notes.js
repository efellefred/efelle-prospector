// ─── Generate Sales Notes engine ─────────────────────────────────────
// Upload discovery files (PDF/TXT/MD/CSV/images) + optional pasted notes →
// Claude assembles a formatted Sales Notes handoff doc (efelle standard
// format) using ONLY the provided material. HTML + server-PDF downloads.
import { getApiHeaders } from '../core/api.js';
import { API_MODEL } from '../core/state.js';
import { NOTES_SYSTEM } from '../data/prompts.js';
import { writeToFrame } from '../core/utils.js';
import { saveReport } from '../core/reports.js';

const MAX_FILES = 6;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const TEXT_EXTS = ['txt', 'md', 'csv'];
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

let notesFiles = []; // { name, size, kind: 'pdf'|'image'|'text', mediaType, data }
let notesReportHtml = '';
let notesCompany = '';

function notesErr(msg) {
  const el = document.getElementById('notes-error');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}

function fmtBytes(n) {
  return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
}

function renderFileList() {
  const wrap = document.getElementById('notes-file-list');
  wrap.innerHTML = '';
  notesFiles.forEach((f, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;background:#0c0f16;border:1px solid #252d3d;border-radius:8px;padding:8px 12px;font-size:12px;color:#e2ddd4;';
    const icon = f.kind === 'pdf' ? '📄' : f.kind === 'image' ? '🖼️' : '📝';
    row.innerHTML = '<span>' + icon + '</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + f.name.replace(/</g, '&lt;') + '</span><span style="color:#6b7a94;font-family:monospace;font-size:11px;">' + fmtBytes(f.size) + '</span>';
    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.style.cssText = 'border:none;background:transparent;color:#f87171;cursor:pointer;font-size:13px;padding:2px 4px;';
    rm.addEventListener('click', () => { notesFiles.splice(i, 1); renderFileList(); });
    row.appendChild(rm);
    wrap.appendChild(row);
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read ' + file.name));
    if (TEXT_EXTS.includes(ext)) {
      reader.onload = () => resolve({ name: file.name, size: file.size, kind: 'text', mediaType: 'text/plain', data: reader.result });
      reader.readAsText(file);
    } else if (ext === 'pdf') {
      reader.onload = () => resolve({ name: file.name, size: file.size, kind: 'pdf', mediaType: 'application/pdf', data: reader.result.split(',')[1] });
      reader.readAsDataURL(file);
    } else if (IMAGE_TYPES[ext]) {
      reader.onload = () => resolve({ name: file.name, size: file.size, kind: 'image', mediaType: IMAGE_TYPES[ext], data: reader.result.split(',')[1] });
      reader.readAsDataURL(file);
    } else {
      reject(new Error(file.name + ': unsupported type — use PDF, TXT, MD, CSV, PNG, or JPG'));
    }
  });
}

document.getElementById('notes-files').addEventListener('change', async (e) => {
  notesErr('');
  for (const file of Array.from(e.target.files || [])) {
    if (notesFiles.length >= MAX_FILES) { notesErr('Maximum ' + MAX_FILES + ' files.'); break; }
    const total = notesFiles.reduce((s, f) => s + f.size, 0) + file.size;
    if (total > MAX_TOTAL_BYTES) { notesErr('Total upload limited to 15 MB — "' + file.name + '" would exceed it.'); continue; }
    try { notesFiles.push(await readFile(file)); }
    catch (err) { notesErr(err.message); }
  }
  e.target.value = '';
  renderFileList();
});

function buildContentBlocks() {
  const blocks = [];
  for (const f of notesFiles) {
    if (f.kind === 'pdf') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data }, title: f.name });
    } else if (f.kind === 'image') {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
    } else {
      blocks.push({ type: 'text', text: '=== Uploaded file: ' + f.name + ' ===\n\n' + f.data });
    }
  }
  const pasted = document.getElementById('notes-paste').value.trim();
  if (pasted) blocks.push({ type: 'text', text: '=== Pasted notes ===\n\n' + pasted });
  const company = document.getElementById('notes-company').value.trim();
  blocks.push({
    type: 'text',
    text: 'Generate the Sales Notes document from the material above.'
      + (company ? ' The company is "' + company + '".' : ' Detect the company name from the material.'),
  });
  return blocks;
}

document.getElementById('notes-generate-btn').addEventListener('click', async () => {
  notesErr('');
  const pasted = document.getElementById('notes-paste').value.trim();
  if (!notesFiles.length && !pasted) { notesErr('Add at least one file or paste some notes first.'); return; }

  const btn = document.getElementById('notes-generate-btn');
  const prog = document.getElementById('notes-progress');
  btn.disabled = true; btn.textContent = '⟳ Generating…';
  prog.style.display = 'block';
  const stages = ['Reading source material…', 'Extracting facts and structure…', 'Assembling the Sales Notes document…', 'Formatting for HTML and PDF…', 'Still working — large material takes a minute…'];
  let stageIdx = 0;
  prog.textContent = stages[0];
  const ticker = setInterval(() => { stageIdx = Math.min(stageIdx + 1, stages.length - 1); prog.textContent = stages[stageIdx]; }, 9000);

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        model: API_MODEL,
        max_tokens: 16000,
        system: NOTES_SYSTEM,
        messages: [{ role: 'user', content: buildContentBlocks() }],
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || (d.error && d.error.message) || 'Generation failed (' + res.status + ')');
    let html = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    const docStart = html.search(/<!DOCTYPE|<html/i);
    if (docStart > 0) html = html.slice(docStart);
    if (!/<html/i.test(html)) throw new Error('The AI returned an unexpected format — try again.');

    // Stamp today's date
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    html = html.split('[[DATE]]').join(dateStr);

    // Company: field first, else the document title
    notesCompany = document.getElementById('notes-company').value.trim();
    if (!notesCompany) {
      const t = html.match(/<title>\s*Sales Notes\s*[-–—]\s*([^<]+)<\/title>/i);
      notesCompany = t ? t[1].trim() : 'Client';
    }

    notesReportHtml = html;
    document.getElementById('notes-input-wrap').style.display = 'none';
    document.getElementById('notes-report-wrap').style.display = '';
    await writeToFrame(document.getElementById('notes-report-frame'), html);

    try {
      await saveReport('notes', notesCompany, {}, {
        company: notesCompany,
        files: notesFiles.map(f => f.name),
        pastedChars: pasted.length,
      }, notesReportHtml);
    } catch (e) { console.warn('Sales Notes auto-save failed:', e.message); }
  } catch (e) {
    notesErr(e.message || 'Generation failed — try again.');
  } finally {
    clearInterval(ticker);
    prog.style.display = 'none';
    btn.disabled = false; btn.textContent = 'Generate Sales Notes →';
  }
});

document.getElementById('notes-back-btn').addEventListener('click', () => {
  document.getElementById('notes-report-wrap').style.display = 'none';
  document.getElementById('notes-input-wrap').style.display = '';
});

function notesFilename(ext) {
  return 'Sales Notes - ' + (notesCompany || 'Client').replace(/[^\w\s.\-&']/g, '').trim() + '.' + ext;
}

document.getElementById('notes-dl-html').addEventListener('click', () => {
  if (!notesReportHtml) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([notesReportHtml], { type: 'text/html' }));
  a.download = notesFilename('html');
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});

document.getElementById('notes-dl-pdf').addEventListener('click', async () => {
  if (!notesReportHtml) return;
  const btn = document.getElementById('notes-dl-pdf');
  const orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '⟳ Rendering…';
  try {
    const res = await fetch('/api/proposal-pdf', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ html: notesReportHtml, filename: notesFilename('pdf') }),
    });
    if (!res.ok) {
      let msg = 'PDF render failed (' + res.status + ')';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = notesFilename('pdf');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    btn.innerHTML = '✓ PDF downloaded';
  } catch (e) {
    btn.innerHTML = '⚠ ' + (e.message || 'Failed');
  } finally {
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000);
  }
});

// Library integration: open a saved Sales Notes report in the viewer
window.setNotesReportHtml = function(html, company) {
  notesReportHtml = html || '';
  if (company) notesCompany = company;
  document.getElementById('notes-input-wrap').style.display = 'none';
  document.getElementById('notes-report-wrap').style.display = '';
};
