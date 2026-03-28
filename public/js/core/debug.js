let _debugOpen = false;
let _debugLines = [];

export function toggleDebug() {
  _debugOpen = !_debugOpen;
  const panel = document.getElementById('debug-panel');
  const btn = document.getElementById('debug-toggle-btn');
  panel.style.display = _debugOpen ? 'block' : 'none';
  btn.classList.toggle('active', _debugOpen);
  if (_debugOpen) {
    document.getElementById('debug-env').textContent = '\u2B21 server mode';
    renderDebug();
  }
}

export function clearDebug() {
  _debugLines = [];
  renderDebug();
}

export function renderDebug() {
  const log = document.getElementById('debug-log');
  if (!log) return;
  if (_debugLines.length === 0) {
    log.innerHTML = '<span style="color:#374151;">No events yet \u2014 trigger an API call to see logs here.</span>';
    return;
  }
  log.innerHTML = _debugLines.map(l => {
    const color = l.type === 'error' ? '#f87171' : l.type === 'success' ? '#34d399' : l.type === 'warn' ? '#fb923c' : '#6b7a94';
    return `<div><span style="color:#374151;">${l.time}</span> <span style="color:${color};">[${l.type.toUpperCase()}]</span> <span style="color:#9ca3af;">${l.msg}</span></div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
}

export function dbg(type, msg) {
  const now = new Date();
  const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
  _debugLines.push({ time, type, msg: String(msg).slice(0, 200) });
  if (_debugLines.length > 100) _debugLines.shift();
  if (_debugOpen) renderDebug();
}

// Attach to window for onclick compatibility
window.toggleDebug = toggleDebug;
window.clearDebug = clearDebug;
window.renderDebug = renderDebug;
window.dbg = dbg;
