import { listReports, downloadReport, getReport, deleteReport } from './core/reports.js';
import { showScreen } from './core/nav.js';
import { writeToFrame } from './core/utils.js';

// ---------------------------------------------------------------------------
// Library – browse & manage saved reports (v4.24 design)
// ---------------------------------------------------------------------------

const TYPE_PILLS = {
  prop:       { label: 'Proposal',    bg: 'rgba(245,99,0,0.12)',  color: '#D65600' },
  wsr:        { label: 'WAR',         bg: 'rgba(50,215,75,0.14)', color: '#1D8A38' },
  cca:        { label: 'Strategy',    bg: 'rgba(50,138,146,0.12)',color: '#328A92' },
  cap:        { label: 'Action plan', bg: 'rgba(46,86,101,0.10)', color: '#2E5665' },
  competitor: { label: 'Competitor',  bg: 'rgba(217,48,37,0.08)', color: '#D93025' },
  notes:      { label: 'Handoff',     bg: 'rgba(110,110,115,0.12)', color: '#6E6E73' },
};

const PROP_TYPE_LABELS = {
  new_website: 'new website',
  wo_rgs: 'website updates WO',
  rgs_only: 'RGS only',
};

const VERTICAL_LABELS = {
  home_services: 'Home services', plumbers: 'Plumbing', roofers: 'Roofing', hvac: 'HVAC',
  landscape: 'Landscaping', electrical: 'Electrical', construction: 'Construction',
  ecommerce: 'eCommerce', misc: 'Misc', other: 'Other',
};

const USER_NAMES = {
  'fred@efelle.com': 'Fred',
  'doug@efelle.com': 'Doug',
  'christian@efelle.com': 'Christian',
};

/**
 * Navigate to the library screen and render its content.
 */
export async function showLibrary() {
  showScreen('library');
  await renderLibrary();
}
window.showLibrary = showLibrary;

// Filters + sort state
let currentTypeFilter = '';
let currentUserFilter = '';
let currentSearchQuery = '';
let sortKey = 'created';   // 'name' | 'created'
let sortDir = -1;          // 1 asc, -1 desc
let libraryRows = [];      // last fetched rows (for re-sort without refetch)

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '/' + p(d.getDate()) + '/' + String(d.getFullYear()).slice(-2);
}

window.librarySort = function(key) {
  if (sortKey === key) sortDir = -sortDir;
  else { sortKey = key; sortDir = key === 'name' ? 1 : -1; }
  renderRows();
};

function sortValue(r) {
  if (sortKey === 'name') return (r.clientName || '').toLowerCase();
  if (sortKey === 'sent') return r.sentAt ? new Date(r.sentAt).getTime() : null;
  if (sortKey === 'views') return typeof r.views === 'number' ? r.views : 0;
  return new Date(r.createdAt).getTime() || 0;
}

window.libMenuToggle = function(ev, id) {
  ev.stopPropagation();
  const menu = document.getElementById(id);
  const wasOpen = menu && menu.style.display === 'block';
  document.querySelectorAll('.lbx-menu').forEach(m => { m.style.display = 'none'; });
  if (menu && !wasOpen) menu.style.display = 'block';
};
document.addEventListener('click', () => {
  document.querySelectorAll('.lbx-menu').forEach(m => { m.style.display = 'none'; });
});

window.libraryDeleteReport = async function(id, name) {
  if (!confirm('Delete the ' + (name || 'report') + ' report? This cannot be undone.')) return;
  try {
    await deleteReport(id);
    libraryRows = libraryRows.filter(r => r.id !== id);
    renderRows();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
};

function headHtml() {
  const arrow = (k) => sortKey === k ? (sortDir === 1 ? ' \u2191' : ' \u2193') : '';
  const cls = (k) => 'lbx-th' + (sortKey === k ? ' active' : '');
  return '<div class="lbx-head">'
    + '<span class="lbx-thstatic">Type</span>'
    + '<button class="' + cls('name') + '" onclick="librarySort(\'name\')">Name' + arrow('name') + '</button>'
    + '<button class="' + cls('created') + '" onclick="librarySort(\'created\')">Created' + arrow('created') + '</button>'
    + '<button class="' + cls('sent') + '" onclick="librarySort(\'sent\')">Sent' + arrow('sent') + '</button>'
    + '<button class="' + cls('views') + ' lbx-center" onclick="librarySort(\'views\')">Views' + arrow('views') + '</button>'
    + '<span></span>'
    + '</div>';
}

function renderRows() {
  const container = document.getElementById('library-list');
  if (!container) return;
  let rows = libraryRows.slice();
  rows.sort((a, b) => {
    const va = sortValue(a), vb = sortValue(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;   // "Not sent" always sorts last
    if (vb === null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
  });

  if (!rows.length) {
    container.innerHTML = headHtml()
      + '<div class="lbx-empty">No reports match. Clear a filter or run a new audit from the home screen.</div>';
    return;
  }

  container.innerHTML = headHtml() + rows.map((r, i) => {
    const pill = TYPE_PILLS[r.type] || { label: r.type, bg: 'var(--gray-5)', color: 'var(--gray-2)' };
    const meta = [];
    if (r.metadata) {
      if (r.metadata.vertical) meta.push(VERTICAL_LABELS[r.metadata.vertical] || r.metadata.vertical);
      if (r.metadata.type && PROP_TYPE_LABELS[r.metadata.type]) meta.push(PROP_TYPE_LABELS[r.metadata.type]);
    }
    const creator = r.createdBy ? (USER_NAMES[r.createdBy] || r.createdBy) : '';
    if (creator) meta.push('by ' + creator);
    const safeName = esc(r.clientName || 'Unknown').replace(/'/g, "\\'");
    return '<div class="lbx-row">'
      + '<span><span class="lbx-pill" style="background:' + pill.bg + ';color:' + pill.color + ';">' + esc(pill.label) + '</span></span>'
      + '<div style="min-width:0;">'
      +   '<div class="lbx-company">' + esc(r.clientName || 'Unknown') + '</div>'
      +   '<div class="lbx-meta">' + esc(meta.join(' // ')) + '</div>'
      + '</div>'
      + '<span class="lbx-date">' + fmtDate(r.createdAt) + '</span>'
      + '<div class="lbx-sentcell">'
      +   '<span class="lbx-date">' + (r.sentAt ? fmtDate(r.sentAt) : 'Not sent') + '</span>'
      +   (r.sentAt && r.sentTo ? '<span class="lbx-sentto">' + esc(r.sentTo) + '</span>' : '')
      + '</div>'
      + '<span class="lbx-views">' + (typeof r.views === 'number' ? r.views : 0) + '</span>'
      + '<div class="lbx-actions">'
      +   '<span style="position:relative;display:inline-block;">'
      +     '<button class="lbx-actbtn" onclick="libMenuToggle(event, \'lbx-am-' + i + '\')">Actions \u25BE</button>'
      +     '<div class="lbx-menu" id="lbx-am-' + i + '">'
      +       '<button onclick="libraryEditReport(\'' + r.id + '\',\'' + r.type + '\')">View</button>'
      +       '<button onclick="downloadReport(\'' + r.id + '\',\'' + esc(r.htmlFile || '') + '\')">Download</button>'
      +     '</div>'
      +   '</span>'
      +   '<span style="position:relative;display:inline-block;">'
      +     '<button class="lbx-actbtn lbx-gear" title="More" onclick="libMenuToggle(event, \'lbx-gm-' + i + '\')">'
      +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
      +     '</button>'
      +     '<div class="lbx-menu" id="lbx-gm-' + i + '">'
      +       '<button onclick="libraryEditReport(\'' + r.id + '\',\'' + r.type + '\')">Edit</button>'
      +       '<button class="lbx-danger" onclick="libraryDeleteReport(\'' + r.id + '\',\'' + safeName + '\')">Delete</button>'
      +     '</div>'
      +   '</span>'
      + '</div>'
      + '</div>';
  }).join('');
}

/**
 * Fetch + render the report list into #library-list.
 */
async function renderLibrary(filterType) {
  const container = document.getElementById('library-list');
  if (!container) return;
  container.innerHTML = '<div class="lbx-empty">Loading\u2026</div>';
  try {
    let reports = await listReports(filterType || currentTypeFilter || undefined);
    if (currentUserFilter) reports = reports.filter(r => r.createdBy === currentUserFilter);
    if (currentSearchQuery) reports = reports.filter(r => (r.clientName || '').toLowerCase().includes(currentSearchQuery));
    libraryRows = reports;
    renderRows();
  } catch (err) {
    container.innerHTML = '<div class="lbx-empty" style="color:#D93025;">Failed to load reports: ' + esc(err.message) + '</div>';
  }
}

/**
 * Load a report and open it in the appropriate engine's output/edit stage.
 */
async function libraryEditReport(id, type) {
  try {
    const report = await getReport(id);
    const htmlFile = report.htmlFile;
    const htmlRes = await fetch(`/api/reports/${encodeURIComponent(id)}/html`, {
      headers: { 'x-session-token': sessionStorage.getItem('prospector_token') || '' },
    });
    if (!htmlRes.ok) throw new Error('Could not load report HTML');
    const html = await htmlRes.text();

    if (type === 'prop') {
      // Navigate to Proposal Builder stage 3
      if (typeof showEngine === 'function') showEngine('prop');
      document.querySelectorAll('.prop-stage').forEach(s => s.classList.remove('active'));
      document.getElementById('prop-stage-3').classList.add('active');

      // Set the module-scoped propReportHtml via the global setter
      if (typeof window.setPropReportHtml === 'function') window.setPropReportHtml(html);

      // Restore engine state (vertical/type/market) + client form fields so
      // Edit → Update Address / Details and re-generation work from the Library
      if (typeof window.restorePropState === 'function') window.restorePropState(report);
      if (typeof window.setPropSavedReportId === 'function') window.setPropSavedReportId(id);
      if (typeof window.loadPropClient === 'function') window.loadPropClient(id);

      const frame = document.getElementById('prop-report-frame');
      await writeToFrame(frame, html);

    } else if (type === 'notes') {
      if (typeof showEngine === 'function') showEngine('notes');
      if (typeof window.setNotesReportHtml === 'function') window.setNotesReportHtml(html, report.clientName);
      const frame = document.getElementById('notes-report-frame');
      if (frame) await writeToFrame(frame, html);

    } else if (type === 'cca') {
      if (typeof showEngine === 'function') showEngine('cca');
      // Show the report stage
      const frame = document.getElementById('cca-report-frame');
      if (frame) frame.srcdoc = html;
      // Try to show stage 3
      const stage3 = document.getElementById('cca-stage-3');
      if (stage3) {
        document.querySelectorAll('[id^="cca-stage-"]').forEach(s => s.style.display = 'none');
        stage3.style.display = 'block';
      }

    } else if (type === 'cap') {
      if (typeof showEngine === 'function') showEngine('cap');
      const frame = document.getElementById('cap-report-frame') || document.getElementById('cca-secondary-frame');
      if (frame) frame.srcdoc = html;

    } else if (type === 'wsr') {
      if (typeof showEngine === 'function') showEngine('wsr');
      const frame = document.getElementById('wsr-report-frame');
      if (frame) frame.srcdoc = html;
      // Show the report stage
      if (typeof wsrShowStage === 'function') wsrShowStage('3');
    }

  } catch (err) {
    console.error('Edit report error:', err);
    alert('Failed to load report: ' + err.message);
  }
}
window.libraryEditReport = libraryEditReport;

/**
 * Filter the library by report type and update active chip state.
 */
export function filterLibrary(type) {
  currentTypeFilter = type || '';
  renderLibrary(type || undefined);
  document.querySelectorAll('.library-filter-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === (type || ''));
  });
}
window.filterLibrary = filterLibrary;

export function filterLibraryUser(user) {
  currentUserFilter = user || '';
  renderLibrary(currentTypeFilter || undefined);
  document.querySelectorAll('.library-user-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.user === (user || ''));
  });
}
window.filterLibraryUser = filterLibraryUser;

// Live search by client name (input in the filter row)
export function searchLibrary(query) {
  currentSearchQuery = (query || '').toLowerCase().trim();
  renderLibrary(currentTypeFilter || undefined);
}
window.searchLibrary = searchLibrary;

// Legacy modal search entry points (modal removed; keep the names callable)
export function openLibrarySearch() {
  const el = document.getElementById('library-search-input');
  if (el) el.focus();
}
window.openLibrarySearch = openLibrarySearch;
export function closeLibrarySearch() {
  currentSearchQuery = '';
  renderLibrary(currentTypeFilter || undefined);
}
window.closeLibrarySearch = closeLibrarySearch;
