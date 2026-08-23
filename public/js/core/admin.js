import { getApiHeaders } from './api.js';
import { RGS_CASE_STUDIES } from '../data/case-studies.js';

const ADMIN_EMAILS = ['fred@efelle.com'];

function isAdmin() {
  return ADMIN_EMAILS.includes(sessionStorage.getItem('prospector_user') || '');
}

function showAdminButton() {
  const btn = document.getElementById('admin-settings-btn');
  if (btn && isAdmin()) btn.style.display = '';
}

async function loadCurrentKeys() {
  if (!isAdmin()) return;
  try {
    const res = await fetch('/api/admin/keys', { headers: getApiHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const ac = document.getElementById('admin-anthropic-current');
    const gc = document.getElementById('admin-gemini-current');
    const rs = document.getElementById('admin-railway-status');
    if (ac) ac.textContent = data.anthropic || '(not set)';
    if (gc) gc.textContent = data.gemini || '(not set)';
    if (rs) {
      const band = document.getElementById('admin-railway-band');
      if (data.railwayConfigured) {
        if (band) band.classList.remove('warn');
        rs.innerHTML = '<span class="stx-band-title">Railway persistence connected</span>'
          + '<span class="stx-band-sub">Key updates persist across deploys.</span>';
      } else {
        if (band) band.classList.add('warn');
        rs.innerHTML = '<span class="stx-band-title">Railway persistence not configured</span>'
          + '<span class="stx-band-sub">Keys update in-memory only and reset on deploy. Add RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, and RAILWAY_ENVIRONMENT_ID to your Railway env vars.</span>';
      }
    }
  } catch (e) {
    console.error('Failed to load admin keys:', e);
  }
}

window.adminTestKey = async function(type) {
  const statusEl = document.getElementById(`admin-${type}-status`);
  const btn = document.getElementById(`admin-test-${type}`);
  if (!statusEl || !btn) return;
  btn.disabled = true;
  btn.textContent = 'Testing…';
  statusEl.innerHTML = '<span style="color:#6b7a94;">Sending test request…</span>';
  try {
    const res = await fetch('/api/admin/test-key', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (data.ok) {
      statusEl.innerHTML = '<span style="color:#34d399;">✓ Key is valid</span>';
    } else {
      statusEl.innerHTML = `<span style="color:#f87171;">✗ Failed (${data.status || data.error || 'unknown'})</span>`;
    }
  } catch (e) {
    statusEl.innerHTML = `<span style="color:#f87171;">✗ ${e.message}</span>`;
  }
  btn.disabled = false;
  btn.textContent = 'Test the key';
};

window.adminSaveKeys = async function() {
  const anthropic = document.getElementById('admin-anthropic-input').value.trim();
  const gemini = document.getElementById('admin-gemini-input').value.trim();
  const statusEl = document.getElementById('admin-save-status');
  const btn = document.getElementById('admin-save-btn');

  if (!anthropic && !gemini) {
    statusEl.innerHTML = '<span style="color:#fb923c;">Enter at least one key to update.</span>';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  statusEl.innerHTML = '<span style="color:#6b7a94;">Updating keys…</span>';

  try {
    const body = {};
    if (anthropic) body.anthropic = anthropic;
    if (gemini) body.gemini = gemini;

    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.innerHTML = `<span style="color:#f87171;">✗ Server error: ${data.error || res.status}</span>`;
      btn.disabled = false;
      btn.textContent = 'Save the keys';
      return;
    }

    const parts = [];
    if (data.updated && data.updated.anthropic) parts.push('Anthropic');
    if (data.updated && data.updated.gemini) parts.push('Gemini');

    let msg = `<span style="color:#34d399;">✓ ${parts.join(' + ')} key${parts.length > 1 ? 's' : ''} updated in-memory.</span>`;
    if (data.railway) {
      if (data.railway.success) {
        msg += ' <span style="color:#34d399;">Railway env vars updated — will persist on next deploy.</span>';
      } else {
        msg += ` <span style="color:#fb923c;">Railway update failed: ${data.railway.error}</span>`;
      }
    }
    statusEl.innerHTML = msg;

    document.getElementById('admin-anthropic-input').value = '';
    document.getElementById('admin-gemini-input').value = '';
    await loadCurrentKeys();
  } catch (e) {
    statusEl.innerHTML = `<span style="color:#f87171;">✗ ${e.message}</span>`;
  }
  btn.disabled = false;
  btn.textContent = 'Save the keys';
};

// Show admin button after login
// Poll briefly since login overlay hide can race with module init
function checkAndShowAdmin() {
  const overlay = document.getElementById('login-overlay');
  if (overlay && overlay.style.display === 'none') {
    showAdminButton();
    return true;
  }
  return false;
}

// Immediate check
if (!checkAndShowAdmin()) {
  // Watch for overlay being hidden
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    const observer = new MutationObserver(() => {
      if (checkAndShowAdmin()) observer.disconnect();
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['style'] });
  }
  // Fallback: also listen for any fetch to /auth/login completing
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    const result = origFetch.apply(this, args);
    if (typeof args[0] === 'string' && args[0].includes('/auth/login')) {
      result.then(() => setTimeout(checkAndShowAdmin, 100));
    }
    return result;
  };
}

// ─── RGS Case Study manager ─────────────────────────────────────────
let csList = null; // working copy shown in the settings panel

function stRowHtml(prefix, i, url, nameVal, namePlaceholder) {
  const eu = (v) => (v || '').replace(/"/g, '&quot;');
  return '<div class="stx-row">'
    + '<span class="stx-thumb">' + (url ? '<img src="' + eu(url) + '" alt="" onerror="this.remove()">' : 'img') + '</span>'
    + '<input class="st-input" type="text" data-' + prefix + '-field="img" data-' + prefix + '-i="' + i + '" value="' + eu(url) + '" placeholder="https://…/image.png">'
    + '<input class="st-input stx-nameinput" type="text" data-' + prefix + '-field="name" data-' + prefix + '-i="' + i + '" value="' + eu(nameVal) + '" placeholder="' + namePlaceholder + '">'
    + '<span class="stx-rowbtns">'
    + '<button class="stx-iconbtn" title="Move up" onclick="' + prefix + 'Move(' + i + ',-1)">↑</button>'
    + '<button class="stx-iconbtn" title="Move down" onclick="' + prefix + 'Move(' + i + ',1)">↓</button>'
    + '<button class="stx-iconbtn stx-x" title="Remove" onclick="' + prefix + 'Remove(' + i + ')">×</button>'
    + '</span>'
    + '</div>';
}

function csRender() {
  const wrap = document.getElementById('cs-manager-rows');
  if (!wrap || !csList) return;
  wrap.innerHTML = csList.map((cs, i) => stRowHtml('cs', i, cs.img, cs.client, 'Client')).join('');
  const count = document.getElementById('st-cs-count');
  if (count) count.textContent = csList.length + ' item' + (csList.length === 1 ? '' : 's');
  wrap.querySelectorAll('input[data-cs-field]').forEach(inp => {
    inp.addEventListener('change', () => {
      const key = inp.dataset.csField === 'name' ? 'client' : 'img';
      csList[parseInt(inp.dataset.csI)][key] = inp.value.trim();
      if (key === 'img') csRender();
    });
  });
}

async function loadCaseStudiesAdmin() {
  if (!isAdmin()) return;
  try {
    const res = await fetch('/api/case-studies', { headers: getApiHeaders() });
    const d = res.ok ? await res.json() : {};
    csList = Array.isArray(d.caseStudies) ? d.caseStudies.map(c => ({ img: c.img || '', client: c.client || '' })) : RGS_CASE_STUDIES.map(c => ({ img: c.img, client: c.client || '' }));
  } catch (e) {
    csList = RGS_CASE_STUDIES.map(c => ({ img: c.img, client: c.client || '' }));
  }
  csRender();
}

window.csAddRow = function() {
  if (!csList) csList = [];
  csList.push({ img: '', client: '' });
  csRender();
};

window.csMove = function(i, dir) {
  const j = i + dir;
  if (!csList || j < 0 || j >= csList.length) return;
  [csList[i], csList[j]] = [csList[j], csList[i]];
  csRender();
};

window.csRemove = function(i) {
  if (!csList) return;
  csList.splice(i, 1);
  csRender();
};

window.csSave = async function() {
  const statusEl = document.getElementById('cs-save-status');
  const toSave = (csList || []).filter(c => c.img);
  statusEl.textContent = 'Saving…'; statusEl.style.color = '#6b7a94';
  try {
    const res = await fetch('/api/case-studies', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ caseStudies: toSave }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Save failed');
    csList = toSave;
    csRender();
    statusEl.textContent = '✓ Saved ' + d.count + ' case stud' + (d.count === 1 ? 'y' : 'ies') + ', applies to newly generated proposals.';
    statusEl.style.color = '#34d399';
  } catch (e) {
    statusEl.textContent = '⚠ ' + e.message;
    statusEl.style.color = '#f87171';
  }
};


// ─── Portfolio manager (server-managed portfolio graphics per industry) ───
let pfList = null;

function pfRender() {
  const wrap = document.getElementById('pf-manager-rows');
  if (!wrap || !pfList) return;
  wrap.innerHTML = pfList.map((p, i) => stRowHtml('pf', i, p.img, p.industry, 'Industry')).join('');
  const count = document.getElementById('st-pf-count');
  if (count) count.textContent = pfList.length + ' item' + (pfList.length === 1 ? '' : 's');
  wrap.querySelectorAll('input[data-pf-field]').forEach(inp => {
    inp.addEventListener('change', () => {
      const key = inp.dataset.pfField === 'name' ? 'industry' : 'img';
      pfList[parseInt(inp.dataset.pfI)][key] = inp.value.trim();
      if (key === 'img') pfRender();
    });
  });
}

async function loadPortfoliosAdmin() {
  if (!isAdmin()) return;
  try {
    const res = await fetch('/api/portfolios', { headers: getApiHeaders() });
    const d = res.ok ? await res.json() : {};
    pfList = Array.isArray(d.portfolios) ? d.portfolios.map(p => ({ img: p.img || '', industry: p.industry || '' })) : [];
  } catch (e) {
    pfList = [];
  }
  pfRender();
}

window.pfAddRow = function() {
  if (!pfList) pfList = [];
  pfList.push({ img: '', industry: '' });
  pfRender();
};
window.pfMove = function(i, dir) {
  const j = i + dir;
  if (!pfList || j < 0 || j >= pfList.length) return;
  [pfList[i], pfList[j]] = [pfList[j], pfList[i]];
  pfRender();
};
window.pfRemove = function(i) {
  if (!pfList) return;
  pfList.splice(i, 1);
  pfRender();
};
window.pfSave = async function() {
  const statusEl = document.getElementById('pf-save-status');
  const toSave = (pfList || []).filter(p => p.img);
  statusEl.textContent = 'Saving…'; statusEl.style.color = 'var(--gray-2)';
  try {
    const res = await fetch('/api/portfolios', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ portfolios: toSave }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Save failed');
    pfList = toSave;
    pfRender();
    statusEl.textContent = '✓ Saved ' + d.count + ' portfolio' + (d.count === 1 ? '' : 's') + ', applies to newly generated proposals.';
    statusEl.style.color = '#1D8A38';
  } catch (e) {
    statusEl.textContent = '⚠ ' + e.message;
    statusEl.style.color = '#D93025';
  }
};

// Load keys + case studies when settings screen becomes visible
const settingsScreen = document.getElementById('screen-settings');
if (settingsScreen) {
  const screenObserver = new MutationObserver(() => {
    if (settingsScreen.classList.contains('visible')) { loadCurrentKeys(); loadCaseStudiesAdmin(); loadPortfoliosAdmin(); }
  });
  screenObserver.observe(settingsScreen, { attributes: true, attributeFilter: ['class'] });
}
