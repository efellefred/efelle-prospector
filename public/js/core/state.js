// Global application state
export let API_MODEL = 'claude-sonnet-4-6';
export let CSP_MODEL = 'claude-opus-4-6';
export let currentScreen = 'home';
export let currentEngine = null;
export let _savedApiKey = '';

// Setter functions (modules can't reassign imports directly)
export function setApiModel(m) { API_MODEL = m; }
export function setCspModel(m) { CSP_MODEL = m; }
export function setCurrentScreen(s) { currentScreen = s; }
export function setCurrentEngine(e) { currentEngine = e; }
export function setSavedApiKey(k) { _savedApiKey = k; }
