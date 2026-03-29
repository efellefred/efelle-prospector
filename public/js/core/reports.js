import { getApiHeaders } from './api.js';

// ---------------------------------------------------------------------------
// Reports API – save, list, fetch, download, delete reports
// ---------------------------------------------------------------------------

/**
 * Save a report to the server.
 * @param {string} type      – 'cca' | 'cap' | 'prop' | 'wsr'
 * @param {string} clientName
 * @param {object} metadata  – arbitrary metadata (title, date, etc.)
 * @param {object} engineData – engine-specific payload to persist
 * @param {string} html       – rendered HTML to store as downloadable file
 * @returns {Promise<{id: string, saved: boolean}>}
 */
export async function saveReport(type, clientName, metadata, engineData, html) {
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ type, clientName, metadata, engineData, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Save failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    console.log('[reports] saved', data.id);
    return data;
  } catch (err) {
    console.error('[reports] saveReport error:', err);
    throw err;
  }
}

/**
 * List all reports, optionally filtered by type.
 * @param {string} [type] – 'cca' | 'cap' | 'prop' | 'wsr'
 * @returns {Promise<Array>}
 */
export async function listReports(type) {
  try {
    const url = type ? `/api/reports?type=${encodeURIComponent(type)}` : '/api/reports';
    const res = await fetch(url, { headers: getApiHeaders() });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`List failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[reports] listReports error:', err);
    throw err;
  }
}

/**
 * Get a specific report with its engine data.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getReport(id) {
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
      headers: getApiHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Get failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[reports] getReport error:', err);
    throw err;
  }
}

/**
 * Download report HTML – triggers browser file-save dialog.
 * @param {string} id
 * @param {string} filename – suggested filename for the download
 */
export async function downloadReport(id, filename) {
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/html`, {
      headers: getApiHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Download failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `report-${id}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    console.log('[reports] downloaded', filename);
  } catch (err) {
    console.error('[reports] downloadReport error:', err);
    throw err;
  }
}

/**
 * Get unique clients list (for dropdowns / client picker).
 * @returns {Promise<Array<{name: string, reports: Array<{id: string, type: string, date: string}>}>>}
 */
export async function getClients() {
  try {
    const res = await fetch('/api/clients', { headers: getApiHeaders() });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Clients failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[reports] getClients error:', err);
    throw err;
  }
}

/**
 * Delete a report by id.
 * @param {string} id
 */
export async function deleteReport(id) {
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Delete failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    console.log('[reports] deleted', id);
    return await res.json();
  } catch (err) {
    console.error('[reports] deleteReport error:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Searchable Client Dropdown
// ---------------------------------------------------------------------------

/**
 * Initialize a searchable client dropdown.
 * @param {string} inputId       – ID of the search input
 * @param {string} resultsId     – ID of the results dropdown div
 * @param {string|string[]} types – report type(s) to search ('cca', 'prop', etc. or array)
 * @param {function} onSelect    – callback(report) when a client is selected
 */
export async function initSearchableClientDropdown(inputId, resultsId, types, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  // Load all reports of the given type(s)
  let allReports = [];
  try {
    const typeArr = Array.isArray(types) ? types : [types];
    const promises = typeArr.map(t => listReports(t));
    const lists = await Promise.all(promises);
    allReports = lists.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) { console.warn('Failed to load reports for search:', e); }

  // De-duplicate by clientName (keep most recent)
  const seen = new Map();
  const uniqueReports = [];
  for (const r of allReports) {
    const key = (r.clientName || 'Unknown').toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, true);
      uniqueReports.push(r);
    }
  }

  function renderResults(filter) {
    const term = (filter || '').toLowerCase();
    const matches = term
      ? uniqueReports.filter(r => (r.clientName || '').toLowerCase().includes(term))
      : uniqueReports;
    if (matches.length === 0) {
      results.innerHTML = '<div style="padding:10px 14px;color:#4b5563;font-size:13px;">No matching clients</div>';
      results.style.display = 'block';
      return;
    }
    results.innerHTML = matches.map(r => {
      const date = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const typeBadge = r.type === 'cca' ? 'Strategy' : r.type === 'cap' ? 'Action Plan' : r.type === 'prop' ? 'Proposal' : 'W.A.R.';
      return `<div class="search-result-item" data-id="${r.id}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #1a1f2e;display:flex;justify-content:space-between;align-items:center;transition:background 0.15s;">
        <span style="color:#e2ddd4;font-size:14px;">${r.clientName || 'Unknown'}</span>
        <span style="color:#4b5563;font-size:11px;font-family:monospace;">${typeBadge} · ${date}</span>
      </div>`;
    }).join('');
    results.style.display = 'block';

    // Attach click handlers
    results.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('mouseenter', () => { item.style.background = '#1a1f2e'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
      item.addEventListener('click', async () => {
        const reportId = item.dataset.id;
        const clientName = item.querySelector('span').textContent;
        input.value = clientName;
        results.style.display = 'none';
        try {
          const report = await getReport(reportId);
          if (report && onSelect) onSelect(report);
        } catch (e) { console.error('Failed to load report:', e); }
      });
    });
  }

  // Show all on focus
  input.addEventListener('focus', () => renderResults(input.value));

  // Filter on input
  input.addEventListener('input', () => renderResults(input.value));

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.style.display = 'none';
    }
  });
}

// ---------------------------------------------------------------------------
// Attach to window for onclick compatibility
// ---------------------------------------------------------------------------
window.saveReport     = saveReport;
window.listReports    = listReports;
window.getReport      = getReport;
window.downloadReport = downloadReport;
window.getClients     = getClients;
window.deleteReport   = deleteReport;
window.initSearchableClientDropdown = initSearchableClientDropdown;
