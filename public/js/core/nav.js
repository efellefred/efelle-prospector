import { setCurrentScreen, setCurrentEngine, currentEngine } from './state.js';

export const ENGINES = {
  wsr: {
    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    iconBg: '#059669',
    eyebrow: 'Sales Tool &middot; Website Audit &amp; Recommendations',
    eyebrowColor: '#34d399',
    accent: '#34d399'
  },
  csp:  {
    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    iconBg: '#a78bfa',
    eyebrow: 'Sales Tool &middot; Strategy Builder',
    eyebrowColor: '#a78bfa',
    accent: '#a78bfa'
  },
  cap:  {
    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    iconBg: '#2dd4bf',
    eyebrow: 'Sales Tool &middot; Client Action Plan',
    eyebrowColor: '#2dd4bf',
    accent: '#2dd4bf'
  },
  prop: {
    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    iconBg: '#F56300',
    eyebrow: 'Sales Tool &middot; Proposal Builder',
    eyebrowColor: '#F56300',
    accent: '#F56300'
  },
  competitor: {
    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    iconBg: '#ec4899',
    eyebrow: 'Sales Tool &middot; Competitive Analysis',
    eyebrowColor: '#ec4899',
    accent: '#ec4899'
  },
};

// ---------------------------------------------------------------------------
// URL routing — every screen has its own path so browser Back/Forward move
// within the app (server has a catch-all that serves index.html for these).
// ---------------------------------------------------------------------------
const SCREEN_PATHS = {
  home: '/',
  wsr: '/war-report',
  competitor: '/competitor-analysis',
  csp: '/growth-strategy',
  cap: '/action-plan',
  prop: '/proposal',
  notes: '/sales-handoff',
  library: '/library',
  settings: '/settings',
};
const PATH_SCREENS = {};
for (const [id, p] of Object.entries(SCREEN_PATHS)) PATH_SCREENS[p] = id;

function syncUrl(id) {
  const path = SCREEN_PATHS[id];
  if (!path) return; // screens without a route keep the current URL
  if (window.location.pathname !== path) {
    history.pushState({ screen: id }, '', path);
  } else if (!history.state || history.state.screen !== id) {
    history.replaceState({ screen: id }, '', path);
  }
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
  const s = document.getElementById('screen-' + id);
  if (s) s.classList.add('visible');
  setCurrentScreen(id);
  const isHome = id === 'home';
  const isLibrary = id === 'library';
  const isSettings = id === 'settings';
  const hideEngineHeader = isHome || isLibrary || isSettings || id === 'prop';
  document.getElementById('back-btn').style.display = isHome ? 'none' : 'inline-block';
  document.getElementById('engine-header').style.display = hideEngineHeader ? 'none' : 'flex';
  if (!hideEngineHeader && ENGINES[id]) {
    const e = ENGINES[id];
    const iconEl = document.getElementById('eng-header-icon');
    iconEl.innerHTML = e.iconSvg;
    iconEl.style.background = e.iconBg;
    const eyebrowEl = document.getElementById('eng-header-eyebrow');
    eyebrowEl.innerHTML = e.eyebrow;
    eyebrowEl.style.color = e.eyebrowColor;
  }
  syncUrl(id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function showEngine(id) {
  setCurrentEngine(id);
  showScreen(id);
  // Reset proposal form when navigating to it fresh (so old proposals don't linger)
  if (id === 'prop' && typeof window.propReset === 'function') window.propReset();
}

// Show a screen from the URL (initial load or Back/Forward) WITHOUT resetting
// engine state — Back into a half-finished engine must not wipe its form.
function showScreenFromUrl(id) {
  if (ENGINES[id]) setCurrentEngine(id);
  if (id === 'library' && typeof window.showLibrary === 'function') {
    window.showLibrary(); // renders library content, calls showScreen internally
    return;
  }
  showScreen(id);
}

// Reset the current engine to its first step
function resetCurrentEngine() {
  const eng = currentEngine;
  if (eng === 'prop' && typeof window.propReset === 'function') window.propReset();
  if (eng === 'wsr' && typeof window.wsrShowStage === 'function') window.wsrShowStage('1a');
  if (eng === 'cca') {
    const s1a = document.getElementById('cca-stage-1a');
    const s1b = document.getElementById('cca-stage-1b');
    const s2 = document.getElementById('cca-stage-2');
    const s3 = document.getElementById('cca-stage-3');
    if (s1a) s1a.style.display = 'block';
    if (s1b) s1b.style.display = 'none';
    if (s2) s2.style.display = 'none';
    if (s3) s3.style.display = 'none';
  }
  if (eng === 'cap') {
    const output = document.getElementById('cap-output');
    if (output) output.style.display = 'none';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Attach to window for onclick compatibility
window.showScreen = showScreen;
window.showEngine = showEngine;
window.resetCurrentEngine = resetCurrentEngine;

// Browser Back/Forward: route to the screen the URL (or history entry) names.
window.addEventListener('popstate', (e) => {
  const id = (e.state && e.state.screen) || PATH_SCREENS[window.location.pathname] || 'home';
  showScreenFromUrl(id);
});

// Initialize: route from the current URL (deep links work; unknown paths → home).
// Library renders after all modules load, so defer its first paint one tick.
const initialScreen = PATH_SCREENS[window.location.pathname] || 'home';
if (initialScreen === 'library') {
  showScreen('library');
  setTimeout(() => { if (typeof window.showLibrary === 'function') window.showLibrary(); }, 0);
} else {
  showScreenFromUrl(initialScreen);
}
if (!SCREEN_PATHS[initialScreen] || window.location.pathname !== SCREEN_PATHS[initialScreen]) {
  history.replaceState({ screen: initialScreen }, '', SCREEN_PATHS[initialScreen] || '/');
} else {
  history.replaceState({ screen: initialScreen }, '', window.location.pathname);
}

// Navigation event listeners
document.getElementById('logo-btn').addEventListener('click', () => showScreen('home'));
document.getElementById('back-btn').addEventListener('click', () => showScreen('home'));
document.getElementById('eng-back-btn').addEventListener('click', () => showScreen('home'));
