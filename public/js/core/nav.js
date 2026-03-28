import { setCurrentScreen, setCurrentEngine } from './state.js';

export const ENGINES = {
  wsr: {
    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    iconBg: '#059669',
    eyebrow: 'Sales Tool &middot; Website Suggestions Report',
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
};

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('visible'));
  const s = document.getElementById('screen-' + id);
  if (s) s.classList.add('visible');
  setCurrentScreen(id);
  const isHome = id === 'home';
  document.getElementById('back-btn').style.display = isHome ? 'none' : 'inline-block';
  document.getElementById('engine-header').style.display = isHome ? 'none' : 'flex';
  if (!isHome && ENGINES[id]) {
    const e = ENGINES[id];
    const iconEl = document.getElementById('eng-header-icon');
    iconEl.innerHTML = e.iconSvg;
    iconEl.style.background = e.iconBg;
    const eyebrowEl = document.getElementById('eng-header-eyebrow');
    eyebrowEl.innerHTML = e.eyebrow;
    eyebrowEl.style.color = e.eyebrowColor;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function showEngine(id) {
  setCurrentEngine(id);
  showScreen(id);
  // Reset proposal form when navigating to it fresh (so old proposals don't linger)
  if (id === 'prop' && typeof window.propReset === 'function') window.propReset();
}

// Attach to window for onclick compatibility
window.showScreen = showScreen;
window.showEngine = showEngine;

// Initialize: ensure home screen is active on load
showScreen('home');

// Navigation event listeners
document.getElementById('logo-btn').addEventListener('click', () => showScreen('home'));
document.getElementById('back-btn').addEventListener('click', () => showScreen('home'));
document.getElementById('eng-back-btn').addEventListener('click', () => showScreen('home'));
