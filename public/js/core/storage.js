import { _savedApiKey, setSavedApiKey, API_MODEL, setApiModel, CSP_MODEL } from './state.js';

// ---------- Auth / Login Flow ----------

export async function loginUser(email, password) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Login failed');
  }
  const data = await res.json();
  if (data.token) {
    sessionStorage.setItem('prospector_token', data.token);
  }
  if (data.email) {
    sessionStorage.setItem('prospector_user', data.email);
  }
  return data;
}

export async function checkAuth() {
  const token = sessionStorage.getItem('prospector_token');
  if (!token) return false;
  try {
    const res = await fetch('/auth/check', {
      headers: { 'x-session-token': token }
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// ---------- Key Banner Visibility ----------

export function _updateKeyBannerVisibility() {
  // Server mode: always hide the API key banner (key lives on the server)
  const banner = document.getElementById('api-key-banner');
  if (banner) {
    banner.style.display = 'none';
    document.body.style.paddingBottom = '';
  }
}

// ---------- Init Stored Keys ----------

export async function initStoredKeys() {
  // In server mode, check for an existing session token
  const token = sessionStorage.getItem('prospector_token');
  if (token) {
    const valid = await checkAuth();
    if (!valid) {
      sessionStorage.removeItem('prospector_token');
    }
  }

  // After keys are loaded, update banner visibility
  _updateKeyBannerVisibility();
}

// Run on load
initStoredKeys();

// ---------- Login Overlay Handler ----------

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
  // Also hide the old API key banner in server mode
  const banner = document.getElementById('api-key-banner');
  if (banner) { banner.style.display = 'none'; document.body.style.paddingBottom = ''; }
}

// If already authenticated, hide login overlay immediately
(async () => {
  const token = sessionStorage.getItem('prospector_token');
  if (token) {
    const valid = await checkAuth();
    if (valid) hideLoginOverlay();
  }
})();

// Login button click
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const emailInput = document.getElementById('login-email');
    const pwInput = document.getElementById('login-password');
    const errEl = document.getElementById('login-error');
    const email = (emailInput ? emailInput.value : '').trim();
    const pw = (pwInput ? pwInput.value : '').trim();

    if (!email) {
      if (errEl) { errEl.textContent = 'Enter your email'; errEl.style.display = 'block'; }
      return;
    }
    if (!pw) {
      if (errEl) { errEl.textContent = 'Enter the password'; errEl.style.display = 'block'; }
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';
    if (errEl) errEl.style.display = 'none';

    try {
      await loginUser(email, pw);
      hideLoginOverlay();
      _updateKeyBannerVisibility();
    } catch (err) {
      if (errEl) { errEl.textContent = 'Invalid email or password'; errEl.style.display = 'block'; }
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
}

// ---------- Logout ----------

window.doLogout = async function() {
  const token = sessionStorage.getItem('prospector_token');
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'x-session-token': token }
    });
  } catch (e) {}
  sessionStorage.removeItem('prospector_token');
  location.reload();
};

// ---------- Model Display ----------

export function updateModelDisplay() {
  const el = document.getElementById('model-current');
  if (el) el.textContent = API_MODEL;
  const el2 = document.getElementById('csp-model-current');
  if (el2) el2.textContent = CSP_MODEL;
}

document.getElementById('model-apply-btn').addEventListener('click', () => {
  const val = (document.getElementById('model-input').value || '').trim();
  if (!val) return;
  setApiModel(val);
  updateModelDisplay();
  const btn = document.getElementById('model-apply-btn');
  btn.textContent = '\u2713 Applied';
  setTimeout(() => { btn.textContent = 'Apply Model'; }, 1500);
});

updateModelDisplay();
document.addEventListener('DOMContentLoaded', updateModelDisplay);
