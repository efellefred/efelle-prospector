import { getApiHeaders } from './api.js';

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
      rs.innerHTML = data.railwayConfigured
        ? '<span style="color:#34d399;">✓ Connected</span> — key updates will persist across deploys.'
        : '<span style="color:#fb923c;">⚠ Not configured</span> — keys update in-memory only (reset on deploy). Add RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, and RAILWAY_ENVIRONMENT_ID to your Railway env vars.';
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
  btn.textContent = 'Test';
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
      btn.textContent = 'Save Keys';
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
  btn.textContent = 'Save Keys';
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

// Load keys when settings screen becomes visible
const settingsScreen = document.getElementById('screen-settings');
if (settingsScreen) {
  const screenObserver = new MutationObserver(() => {
    if (settingsScreen.classList.contains('visible')) loadCurrentKeys();
  });
  screenObserver.observe(settingsScreen, { attributes: true, attributeFilter: ['class'] });
}
