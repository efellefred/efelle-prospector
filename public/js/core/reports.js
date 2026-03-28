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
// Attach to window for onclick compatibility
// ---------------------------------------------------------------------------
window.saveReport     = saveReport;
window.listReports    = listReports;
window.getReport      = getReport;
window.downloadReport = downloadReport;
window.getClients     = getClients;
window.deleteReport   = deleteReport;
