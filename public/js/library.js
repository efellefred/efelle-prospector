import { listReports, downloadReport, getReport, deleteReport } from './core/reports.js';
import { showScreen } from './core/nav.js';
import { writeToFrame } from './core/utils.js';

// ---------------------------------------------------------------------------
// Library – browse & manage saved reports
// ---------------------------------------------------------------------------

const TYPE_LABELS = {
  cca:  { label: 'Strategy Plan',  color: '#a78bfa' },
  cap:  { label: 'Action Plan',    color: '#2dd4bf' },
  prop: { label: 'Proposal',       color: '#F56300' },
  wsr:  { label: 'W.A.R. Report', color: '#34d399' },
  competitor: { label: 'Competitor Report', color: '#ec4899' },
};

const PROP_TYPE_LABELS = {
  new_website: 'New Website',
  wo_rgs: 'Website Updates WO',
  rgs_only: 'RGS Only',
};

/**
 * Navigate to the library screen and render its content.
 */
export async function showLibrary() {
  showScreen('library');
  await renderLibrary();
}
window.showLibrary = showLibrary;

// Track current filters
let currentTypeFilter = '';
let currentUserFilter = '';

const USER_NAMES = {
  'fred@efelle.com': 'Fred',
  'doug@efelle.com': 'Doug',
  'christian@efelle.com': 'Christian',
};

/**
 * Render the report list into #library-list.
 * @param {string} [filterType] – optional type key to filter by
 */
async function renderLibrary(filterType) {
  const container = document.getElementById('library-list');
  if (!container) return;

  container.innerHTML =
    '<p style="color:#666;text-align:center;padding:40px;">Loading\u2026</p>';

  try {
    let reports = await listReports(filterType);

    // Apply user filter client-side
    if (currentUserFilter) {
      reports = reports.filter(r => r.createdBy === currentUserFilter);
    }

    // Apply search filter
    if (currentSearchQuery) {
      reports = reports.filter(r => (r.clientName || '').toLowerCase().includes(currentSearchQuery));
    }

    if (!reports.length) {
      container.innerHTML =
        '<p style="color:#666;text-align:center;padding:40px;">No reports yet. Generate one from any engine to see it here.</p>';
      return;
    }

    container.innerHTML = reports
      .map((r) => {
        const t = TYPE_LABELS[r.type] || { label: r.type, color: '#666' };
        const date = new Date(r.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        // Build detail line with metadata
        const details = [];
        if (r.metadata) {
          if (r.metadata.vertical) details.push(r.metadata.vertical);
          if (r.metadata.type && PROP_TYPE_LABELS[r.metadata.type]) {
            details.push(PROP_TYPE_LABELS[r.metadata.type]);
          }
        }
        // Add creator name
        const creatorName = r.createdBy ? (USER_NAMES[r.createdBy] || r.createdBy) : '';
        if (creatorName) details.push('by ' + creatorName);

        const detailHtml = details.length
          ? `<span style="color:#666;font-size:11px;font-style:italic;">${details.join(' · ')}</span>`
          : '';

        // Escape client name for use in onclick attributes
        const safeName = (r.clientName || 'Unknown').replace(/'/g, "\\'");

        return `<div class="library-row" style="display:flex;align-items:center;gap:16px;padding:16px 20px;background:#1a1f2e;border-radius:10px;margin-bottom:8px;">
        <span onclick="showEngine('${r.type}')" style="background:${t.color}22;color:${t.color};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;font-family:monospace;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;cursor:pointer;" title="Open ${t.label} engine">${t.label}</span>
        <div style="flex:1;display:flex;flex-direction:column;gap:2px;">
          <span style="color:#e2ddd4;font-size:14px;font-weight:600;">${r.clientName || 'Unknown'}</span>
          ${detailHtml}
        </div>
        <span style="color:#666;font-size:12px;font-family:monospace;">${date}</span>
        <button onclick="libraryEditReport('${r.id}','${r.type}')" style="background:none;border:1px solid #fb923c;color:#fb923c;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">✎ Edit</button>
        <button onclick="downloadReport('${r.id}','${r.htmlFile}')" style="background:none;border:1px solid #333;color:#e2ddd4;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">\u2193 Download</button>
      </div>`;
      })
      .join('');
  } catch (err) {
    container.innerHTML =
      '<p style="color:#f87171;text-align:center;padding:40px;">Failed to load reports: ' +
      err.message +
      '</p>';
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
      if (typeof window.loadPropClient === 'function') window.loadPropClient(id);

      const frame = document.getElementById('prop-report-frame');
      await writeToFrame(frame, html);

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
 * Filter the library by report type and update active button state.
 * @param {string} [type] – type key, or falsy to clear filter
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

// Search by client name
let currentSearchQuery = '';

export function openLibrarySearch() {
  const modal = document.getElementById('library-search-modal');
  modal.style.display = 'block';
  const input = document.getElementById('library-search-input');
  input.value = '';
  input.focus();
}
window.openLibrarySearch = openLibrarySearch;

export function closeLibrarySearch() {
  document.getElementById('library-search-modal').style.display = 'none';
  currentSearchQuery = '';
  renderLibrary(currentTypeFilter || undefined);
}
window.closeLibrarySearch = closeLibrarySearch;

export function searchLibrary(query) {
  currentSearchQuery = (query || '').toLowerCase().trim();
  renderLibrary(currentTypeFilter || undefined);
}
window.searchLibrary = searchLibrary;
