import { getApiHeaders } from '../core/api.js';
import { saveReport } from '../core/reports.js';
import { writeToFrame } from '../core/utils.js';
import { dbg } from '../core/debug.js';

let competitorReportHtml = '';

// ─── Logo SVG (inline, same as WSR/CCA) ────────────────────────────────────
const EFELLE_LOGO_SVG = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 551 275" style="width:120px;height:auto;display:block;" xml:space="preserve"><style type="text/css">.st0{fill:#F05128;}.st1{fill:#5A5F63;}</style><g><path class="st0" d="M103.6,88.8c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7H42.5c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3c0-7.3-1.8-14.6-5.3-21.6C119.3,101.8,112.5,94.3,103.6,88.8z"/><path class="st0" d="M293.6,88.8c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7h-75.7c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3c0-7.3-1.8-14.6-5.3-21.6C309.3,101.8,302.5,94.3,293.6,88.8z"/><path class="st0" d="M489,111.2c-4.7-9.4-11.5-16.9-20.4-22.3c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7h-75.7c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3C494.3,125.5,492.5,118.2,489,111.2z"/><path class="st0" d="M154.6,86.6c2.1-5.7,5.7-10.8,10.7-15.3c4-3.6,8.5-6.3,13.1-8.2c5.2-2.1,10.8-3.1,16.8-3.1c3.9,0,5.9-2.8,5.9-5.5c0-3.1-2.3-5.4-5.4-5.4h-1.3c-7.5,0-14.8,1.5-21.4,4.4c-5.9,2.6-11.5,6.3-16.4,11.2c-5.7,5.5-9.9,11.8-12.4,18.6c-2.4,6.7-3.7,14.9-3.7,24.4V252c0,3.3,2.3,5.7,5.4,5.7s5.4-2.4,5.4-5.7V139.6h44.1c3.3,0,5.7-2.3,5.7-5.4s-2.4-5.4-5.7-5.4h-44.1V110C151.4,100.3,152.5,92.4,154.6,86.6z"/><path class="st0" d="M337.5,11.9c-3.2,0-5.5,2.4-5.5,5.7v37.1v7.5V182v0.6c0.5,3.6,3.1,5.2,5.5,5.2c2.7,0,5.4-2,5.4-5.7V62.2v-7.5V17.6C343,13.9,340.2,11.9,337.5,11.9z"/><path class="st0" d="M365.5,11.9c-3.2,0-5.5,2.4-5.5,5.7v37.1v7.5V182v0.6c0.5,3.6,3.1,5.2,5.5,5.2c2.7,0,5.4-2,5.4-5.7V62.2v-7.5V17.6C371,13.9,368.2,11.9,365.5,11.9z"/></g><g><path class="st1" d="M355.5,238.7l-2.3,1.4c-2-2.7-4.8-4-8.2-4c-2.8,0-5.1,0.9-6.9,2.7s-2.8,4-2.8,6.5c0,1.7,0.4,3.2,1.3,4.7c0.8,1.5,2,2.6,3.5,3.4c1.5,0.8,3.1,1.2,5,1.2c3.4,0,6.1-1.3,8.2-4l2.3,1.5c-1.1,1.6-2.6,2.9-4.4,3.8s-3.9,1.4-6.3,1.4c-3.6,0-6.6-1.1-9-3.4c-2.4-2.3-3.6-5.1-3.6-8.4c0-2.2,0.6-4.3,1.7-6.2s2.6-3.4,4.6-4.4c1.9-1.1,4.1-1.6,6.5-1.6c1.5,0,3,0.2,4.4,0.7s2.6,1.1,3.6,1.8C354,236.6,354.8,237.6,355.5,238.7z"/></g><g><path class="st1" d="M365.4,234h3v3.3c0.9-1.3,1.8-2.3,2.8-2.9c1-0.7,2-1,3.1-1c0.8,0,1.7,0.3,2.6,0.8l-1.5,2.5c-0.6-0.3-1.1-0.4-1.6-0.4c-1,0-1.9,0.4-2.8,1.2s-1.6,2.1-2.1,3.7c-0.4,1.3-0.5,3.9-0.5,7.9v7.7h-3V234z"/></g><g><path class="st1" d="M441,234v22.8h-2.9v-3.9c-1.2,1.5-2.6,2.6-4.1,3.4s-3.2,1.1-5,1.1c-3.2,0-6-1.2-8.3-3.5c-2.3-2.3-3.4-5.2-3.4-8.6c0-3.3,1.2-6.1,3.5-8.4c2.3-2.3,5.1-3.5,8.3-3.5c1.9,0,3.6,0.4,5.1,1.2s2.9,2,4,3.6V234H441z M429.3,236.2c-1.6,0-3.1,0.4-4.5,1.2s-2.5,1.9-3.3,3.4s-1.2,3-1.2,4.6s0.4,3.1,1.2,4.6c0.8,1.5,1.9,2.6,3.3,3.4c1.4,0.8,2.9,1.2,4.5,1.2s3.1-0.4,4.6-1.2c1.4-0.8,2.5-1.9,3.3-3.3c0.8-1.4,1.2-2.9,1.2-4.7c0-2.6-0.9-4.9-2.6-6.6C434,237.1,431.8,236.2,429.3,236.2z"/></g><g><path class="st1" d="M455.6,225.5h2.9v8.5h4.7v2.5h-4.7v20.3h-2.9v-20.3h-4V234h4V225.5z"/></g><g><path class="st1" d="M474.1,224.6c0.7,0,1.2,0.2,1.7,0.7s0.7,1,0.7,1.7s-0.2,1.2-0.7,1.7s-1,0.7-1.7,0.7s-1.2-0.2-1.7-0.7s-0.7-1-0.7-1.7s0.2-1.2,0.7-1.7S473.4,224.6,474.1,224.6z M472.6,234h2.9v22.8h-2.9V234z"/></g><g><path class="st1" d="M484.9,234h3.1l7.7,16.7l7.6-16.7h3.1L496,256.8h-0.5L484.9,234z"/></g><path class="st1" d="M536.7,240.1c-1-2.1-2.5-3.8-4.5-5c-1.9-1.2-4.1-1.9-6.4-1.9c-2.2,0-4.2,0.5-6,1.6c-1.9,1.1-3.3,2.6-4.4,4.4c-1.1,1.9-1.6,3.9-1.6,6s0.5,4.2,1.6,6c1.1,1.9,2.6,3.4,4.4,4.4c1.9,1.1,3.9,1.6,6,1.6c2.6,0,5-0.8,7.1-2.3c0.8-0.6,1.4-1.1,1.4-1.8c0-0.8-0.6-1.4-1.4-1.4c-0.4,0-0.8,0.2-1.1,0.5c-0.8,0.7-1.7,1.2-2.8,1.6c-2.9,1-5.5,0.7-7.9-0.6c-1.5-0.8-2.6-2-3.4-3.4c-0.8-1.4-1.3-3-1.3-4.6c0-1.7,0.4-3.2,1.3-4.7c0.8-1.4,2-2.6,3.4-3.4c1.4-0.8,3-1.2,4.6-1.2c2,0,3.7,0.5,5.3,1.7c1.4,1,2.5,2.3,3.2,3.8c0.3,0.6,0.5,1.2,0.6,1.7c0,0.2,0.1,0.4,0.1,0.6h-16.1c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4h17.3c1,0,1.6-0.6,1.6-1.6C537.8,243.3,537.4,241.7,536.7,240.1z"/><path class="st1" d="M407.7,240.1c-1-2.1-2.5-3.8-4.5-5c-1.9-1.2-4.1-1.9-6.4-1.9c-2.2,0-4.2,0.5-6,1.6c-1.9,1.1-3.3,2.6-4.4,4.4c-1.1,1.9-1.6,3.9-1.6,6s0.5,4.2,1.6,6c1.1,1.9,2.6,3.4,4.4,4.4c1.9,1.1,3.9,1.6,6,1.6c2.6,0,5-0.8,7.1-2.3c0.8-0.6,1.4-1.1,1.4-1.8c0-0.8-0.6-1.4-1.4-1.4c-0.4,0-0.8,0.2-1.1,0.5c-0.8,0.7-1.7,1.2-2.8,1.6c-2.9,1-5.5,0.7-7.9-0.6c-1.5-0.8-2.6-2-3.4-3.4s-1.3-3-1.3-4.6c0-1.7,0.4-3.2,1.3-4.7c0.8-1.4,2-2.6,3.4-3.4c1.4-0.8,3-1.2,4.6-1.2c2,0,3.7,0.5,5.3,1.7c1.4,1,2.5,2.3,3.2,3.8c0.3,0.6,0.5,1.2,0.6,1.7c0,0.2,0.1,0.4,0.1,0.6h-16.1c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4h17.3c1,0,1.6-0.6,1.6-1.6C408.8,243.3,408.4,241.7,407.7,240.1z"/></svg>';

// ─── Comparison Report Builder ──────────────────────────────────────────────

function buildComparisonReportHTML(client, competitors) {
  var OG = '#F56300';

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  var scoreColor = function(s) { return s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'; };

  var date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // All entries: client + up to 3 competitors
  var all = [{ wsrJson: client, name: client.client_name || 'Client', rationale: '' }];
  (competitors || []).forEach(function(c) { all.push(c); });
  var colCount = all.length;

  // ─── Score Ring SVG ──────────────────────────────────────────────────

  function scoreRing(score, size) {
    size = size || 64;
    var r = size * 0.38, cx = size / 2, cy = size / 2;
    var circ = 2 * Math.PI * r;
    var dash = (score / 100) * circ;
    var col = scoreColor(score);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#F5F5F7" stroke-width="' + (size * 0.08) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + (size * 0.08) + '" stroke-dasharray="' + dash + ' ' + circ + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="round"/>' +
      '<text x="' + cx + '" y="' + (cy + size * 0.065) + '" text-anchor="middle" font-size="' + (size * 0.22) + '" font-weight="700" fill="' + col + '" font-family="Plus Jakarta Sans,sans-serif">' + score + '</text>' +
      '</svg>';
  }

  // ─── Helper: safe nested access ──────────────────────────────────────

  function dig(obj) {
    var val = obj;
    for (var i = 1; i < arguments.length; i++) {
      if (val == null) return undefined;
      val = val[arguments[i]];
    }
    return val;
  }

  // ─── Helper: format cell values ──────────────────────────────────────

  function fmtBool(v) {
    if (v === true) return '<span style="color:#22c55e;font-weight:700;font-size:14px;">✓</span>';
    if (v === false) return '<span style="color:#ef4444;font-weight:700;font-size:14px;">✗</span>';
    return '<span style="color:#AEAEB2;">—</span>';
  }

  function fmtNum(v) {
    if (v == null || v === '') return '<span style="color:#AEAEB2;">—</span>';
    if (typeof v === 'number') return String(Math.round(v * 100) / 100);
    return esc(String(v));
  }

  function fmtStr(v) {
    if (v == null || v === '') return '<span style="color:#AEAEB2;">—</span>';
    if (Array.isArray(v)) return v.length > 0 ? esc(v.join(', ')) : '<span style="color:#AEAEB2;">—</span>';
    return esc(String(v));
  }

  // ─── Helper: row color coding ────────────────────────────────────────

  // For numeric rows: find best/worst, apply background colors
  function numericRowBg(values, higherIsBetter) {
    var nums = [];
    values.forEach(function(v, i) {
      if (v != null && typeof v === 'number' && !isNaN(v)) nums.push({ val: v, idx: i });
    });
    if (nums.length < 2) return values.map(function() { return ''; });
    nums.sort(function(a, b) { return a.val - b.val; });
    var bestIdx = higherIsBetter ? nums[nums.length - 1].idx : nums[0].idx;
    var worstIdx = higherIsBetter ? nums[0].idx : nums[nums.length - 1].idx;
    return values.map(function(v, i) {
      if (i === bestIdx) return 'background:rgba(34,197,94,0.10);';
      if (i === worstIdx) return 'background:rgba(239,68,68,0.10);';
      return 'background:rgba(245,158,11,0.10);';
    });
  }

  // ─── Helper: build a table row ───────────────────────────────────────

  function buildRow(label, extractor, type, higherIsBetter) {
    var values = all.map(function(entry) {
      var m = (entry.wsrJson || {})._metrics;
      return extractor(m);
    });

    var bgColors;
    if (type === 'num') {
      bgColors = numericRowBg(values, higherIsBetter !== false);
    } else {
      bgColors = values.map(function() { return ''; });
    }

    var cells = values.map(function(v, i) {
      var cellBg = bgColors[i] || '';
      var clientHighlight = i === 0 ? 'background:rgba(245,99,0,0.04);' : '';
      var style = cellBg || clientHighlight;
      var content;
      if (type === 'bool') content = fmtBool(v);
      else if (type === 'str') content = fmtStr(v);
      else content = fmtNum(v);
      return '<td style="padding:8px 10px;font-size:12px;text-align:center;border-bottom:1px solid #E5E5EA;' + style + '">' + content + '</td>';
    });

    return '<tr>' +
      '<td style="padding:8px 10px;font-size:12px;font-weight:600;color:#1D1D1F;border-bottom:1px solid #E5E5EA;white-space:nowrap;">' + esc(label) + '</td>' +
      cells.join('') +
      '</tr>';
  }

  // ─── Helper: category header row ─────────────────────────────────────

  function categoryRow(label) {
    return '<tr><td colspan="' + (colCount + 1) + '" style="padding:12px 10px 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + OG + ';background:#F5F5F7;border-bottom:1px solid #D2D2D7;">' + esc(label) + '</td></tr>';
  }

  // ─── 1. Cover Page ───────────────────────────────────────────────────

  var scoreCards = all.map(function(entry, i) {
    var score = (entry.wsrJson || {}).overall_score || 0;
    var isClient = i === 0;
    var borderStyle = isClient ? 'border:2px solid ' + OG + ';' : 'border:1px solid #333;';
    var labelText = isClient ? 'Your Site' : 'Competitor ' + i;
    return '<div style="background:#111;border-radius:12px;padding:20px 16px;text-align:center;' + borderStyle + '">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + (isClient ? OG : '#6E6E73') + ';margin-bottom:8px;">' + labelText + '</div>' +
      scoreRing(score, 64) +
      '<div style="font-size:13px;font-weight:700;color:#fff;margin-top:8px;line-height:1.3;">' + esc(entry.name || '') + '</div>' +
    '</div>';
  });

  var cover = '<div style="background:#000;background-image:radial-gradient(ellipse at top right,rgba(245,99,0,0.15) 0%,#000 60%);padding:32px 48px 40px;">' +
    '<div style="margin-bottom:32px;">' + EFELLE_LOGO_SVG + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:' + OG + ';margin-bottom:16px;">Competitor Analysis Report</div>' +
      '<div style="font-size:11px;color:#6E6E73;">' + date + '</div>' +
    '</div>' +
    '<div style="font-size:40px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:10px;">' + esc(client.client_name || 'Website') + '</div>' +
    '<div style="font-size:16px;font-weight:300;color:#AEAEB2;margin-bottom:6px;">Competitor Report</div>' +
    '<div style="font-size:13px;color:#6E6E73;margin-bottom:36px;">Competitive analysis by efelle creative</div>' +
    '<div style="display:grid;grid-template-columns:repeat(' + colCount + ',1fr);gap:12px;">' +
      scoreCards.join('') +
    '</div>' +
  '</div>';

  // ─── 2. Why These Competitors ────────────────────────────────────────

  var compCards = competitors.map(function(comp) {
    var url = (comp.wsrJson || {}).website || '';
    return '<div style="background:#F5F5F7;border-radius:10px;padding:20px 24px;break-inside:avoid;page-break-inside:avoid;">' +
      '<div style="font-size:15px;font-weight:700;color:#1D1D1F;margin-bottom:4px;">' + esc(comp.name || '') + '</div>' +
      (url ? '<div style="font-size:12px;color:#6E6E73;margin-bottom:8px;">' + esc(url) + '</div>' : '') +
      '<div style="font-size:13px;color:#6E6E73;line-height:1.6;font-style:italic;">' + esc(comp.rationale || '') + '</div>' +
    '</div>';
  });

  var whySection = '<div style="padding:40px 48px;break-after:page;page-break-after:always;">' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Section 01</div>' +
    '<h2 style="font-size:22px;font-weight:800;color:#1D1D1F;margin:0 0 20px;">Why These Competitors</h2>' +
    '<div style="display:grid;grid-template-columns:1fr;gap:12px;">' +
      compCards.join('') +
    '</div>' +
  '</div>';

  // ─── 3. Side-by-Side Comparison Matrix ───────────────────────────────

  var headerCells = all.map(function(entry, i) {
    var isClient = i === 0;
    var bg = isClient ? 'background:rgba(245,99,0,0.08);' : '';
    return '<th style="padding:10px;font-size:12px;font-weight:700;color:#1D1D1F;text-align:center;border-bottom:2px solid #D2D2D7;' + bg + '">' + esc(entry.name || '') + '</th>';
  });

  var tableStart = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr>' +
      '<th style="padding:10px;font-size:12px;font-weight:700;color:#6E6E73;text-align:left;border-bottom:2px solid #D2D2D7;">Metric</th>' +
      headerCells.join('') +
    '</tr></thead><tbody>';

  var tableEnd = '</tbody></table>';

  // Speed & Performance
  var perfRows = categoryRow('Speed & Performance') +
    buildRow('PageSpeed Score', function(m) { return dig(m, 'performance', 'score'); }, 'num', true) +
    buildRow('LCP (seconds)', function(m) { return dig(m, 'performance', 'lcp'); }, 'num', false) +
    buildRow('CLS', function(m) { return dig(m, 'performance', 'cls'); }, 'num', false) +
    buildRow('Core Web Vitals', function(m) { return dig(m, 'performance', 'webVitalsPass'); }, 'bool');

  // Content & Messaging
  var contentRows = categoryRow('Content & Messaging') +
    buildRow('Word Count', function(m) { return dig(m, 'content', 'wordCount'); }, 'num', true) +
    buildRow('Title Tag OK', function(m) { return dig(m, 'content', 'titleTagOk'); }, 'bool') +
    buildRow('Meta Description OK', function(m) { return dig(m, 'content', 'metaDescriptionOk'); }, 'bool') +
    buildRow('Alt Text Issues', function(m) { return dig(m, 'content', 'altTextIssues'); }, 'num', false) +
    buildRow('Heading Structure', function(m) { return dig(m, 'content', 'headingsWellDefined'); }, 'bool');

  // AI & GEO Readiness
  var geoRows = categoryRow('AI & GEO Readiness') +
    buildRow('GEO Score', function(m) { return dig(m, 'geo', 'recommendationScore'); }, 'num', true) +
    buildRow('AI Crawler Access', function(m) { return dig(m, 'geo', 'aiCrawlerAccess'); }, 'bool') +
    buildRow('LocalBusiness Schema', function(m) { return dig(m, 'geo', 'schemaIntegrity', 'hasLocalBusiness'); }, 'bool') +
    buildRow('FAQ Schema', function(m) { return dig(m, 'geo', 'schemaIntegrity', 'hasFaqPage'); }, 'bool') +
    buildRow('Answer-First Format', function(m) { return dig(m, 'geo', 'answerFirstFormatting'); }, 'bool');

  // Readability
  var readRows = categoryRow('Readability') +
    buildRow('Flesch Ease Score', function(m) { return dig(m, 'reading', 'easeScore'); }, 'num', true) +
    buildRow('Reading Age', function(m) { return dig(m, 'reading', 'age'); }, 'str');

  // Technical
  var techRows = categoryRow('Technical') +
    buildRow('SSL Enabled', function(m) { return dig(m, 'technical', 'sslEnabled'); }, 'bool') +
    buildRow('Sitemap Valid', function(m) { return dig(m, 'technical', 'sitemapValid'); }, 'bool') +
    buildRow('CMS', function(m) { return dig(m, 'technical', 'cms'); }, 'str') +
    buildRow('Analytics', function(m) {
      var v = dig(m, 'technical', 'analyticsDetected');
      if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : null;
      return v;
    }, 'str') +
    buildRow('Open Graph Complete', function(m) { return dig(m, 'technical', 'openGraph'); }, 'bool');

  // Authority & Backlinks (conditional)
  var hasSeoData = all.some(function(entry) {
    var m = (entry.wsrJson || {})._metrics;
    return m && m.seo && (m.seo.domainAuthority != null || m.seo.referringDomains != null);
  });

  var seoRows = '';
  if (hasSeoData) {
    seoRows = categoryRow('Authority & Backlinks') +
      buildRow('Domain Authority', function(m) { return dig(m, 'seo', 'domainAuthority'); }, 'num', true) +
      buildRow('Referring Domains', function(m) { return dig(m, 'seo', 'referringDomains'); }, 'num', true) +
      buildRow('Backlinks', function(m) { return dig(m, 'seo', 'backlinks'); }, 'num', true) +
      buildRow('Organic Traffic', function(m) { return dig(m, 'seo', 'organicTrafficMonthly'); }, 'num', true);
  }

  // Local Presence
  var localRows = categoryRow('Local Presence') +
    buildRow('GBP Complete', function(m) { return dig(m, 'local', 'google_business_profile', 'is_complete'); }, 'bool') +
    buildRow('Rating', function(m) { return dig(m, 'local', 'google_business_profile', 'rating'); }, 'num', true) +
    buildRow('Review Count', function(m) { return dig(m, 'local', 'google_business_profile', 'review_count'); }, 'num', true) +
    buildRow('Address Consistent', function(m) { return dig(m, 'local', 'directory_consistency', 'is_address_consistent'); }, 'bool');

  var matrixSection = '<div style="padding:40px 48px;break-after:page;page-break-after:always;">' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Section 02</div>' +
    '<h2 style="font-size:22px;font-weight:800;color:#1D1D1F;margin:0 0 20px;">Side-by-Side Comparison</h2>' +
    '<div style="overflow-x:auto;">' +
      tableStart +
      perfRows +
      contentRows +
      geoRows +
      readRows +
      techRows +
      seoRows +
      localRows +
      tableEnd +
    '</div>' +
  '</div>';

  // ─── 4. Keyword Gap Analysis ──────────────────────────────────────────
  var keywordGapHtml = '';
  var clientKws = (client._metrics && client._metrics.seo && client._metrics.seo.topKeywords) || [];
  var clientKwSet = new Set(clientKws.map(function(k) { return k.keyword.toLowerCase().trim(); }));

  // Build branded terms to filter out (competitor names, domains, project names)
  var brandedTerms = [];
  for (var bi = 0; bi < competitors.length; bi++) {
    var cn = (competitors[bi].name || '').toLowerCase();
    var cd = ((competitors[bi].wsrJson && competitors[bi].wsrJson.website) || '').replace(/https?:\/\/(www\.)?/, '').replace(/\/.*/, '').toLowerCase();
    if (cn) brandedTerms.push(cn);
    if (cd) brandedTerms.push(cd.replace(/\.\w+$/, ''));
    // Also add individual words from company name (>3 chars, not generic)
    var genericWords = new Set(['construction','company','inc','llc','corp','group','services','contractors','general']);
    cn.split(/\s+/).forEach(function(w) { if (w.length > 3 && !genericWords.has(w)) brandedTerms.push(w); });
  }
  // Also add client branded terms
  var clientName = (client.client_name || '').toLowerCase();
  var clientDomain = ((client._metrics && client._metrics.domain) || '').toLowerCase();
  if (clientName) brandedTerms.push(clientName);
  if (clientDomain) brandedTerms.push(clientDomain.replace(/\.\w+$/, ''));
  clientName.split(/\s+/).forEach(function(w) {
    var genericWords = new Set(['construction','company','inc','llc','corp','group','services','contractors','general']);
    if (w.length > 3 && !genericWords.has(w)) brandedTerms.push(w);
  });

  function isBrandedKeyword(kw) {
    var lower = kw.toLowerCase();
    return brandedTerms.some(function(bt) { return bt.length > 2 && lower.includes(bt); });
  }

  // Collect gap keywords from competitors
  var gapMap = {};
  for (var gi = 0; gi < competitors.length; gi++) {
    var compKws = (competitors[gi].wsrJson && competitors[gi].wsrJson._metrics && competitors[gi].wsrJson._metrics.seo && competitors[gi].wsrJson._metrics.seo.topKeywords) || [];
    var compDomain = (competitors[gi].wsrJson && competitors[gi].wsrJson._metrics && competitors[gi].wsrJson._metrics.domain) || competitors[gi].name || '';
    compKws.forEach(function(k) {
      var norm = k.keyword.toLowerCase().trim();
      if (clientKwSet.has(norm)) return;
      if (k.position > 20) return;
      if (isBrandedKeyword(k.keyword)) return;
      if (!gapMap[norm] || k.searchVolume > gapMap[norm].searchVolume) {
        gapMap[norm] = { keyword: k.keyword, searchVolume: k.searchVolume, rankingCompetitor: compDomain, position: k.position };
      }
    });
  }

  var gapList = Object.values(gapMap).sort(function(a, b) { return b.searchVolume - a.searchVolume; }).slice(0, 10);

  if (gapList.length > 0) {
    var gapRows = gapList.map(function(g, i) {
      var bg = i % 2 === 0 ? '#fff' : '#F5F5F7';
      return '<tr style="background:' + bg + ';">' +
        '<td style="padding:10px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #F5F5F7;">' + esc(g.keyword) + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;font-family:monospace;font-weight:600;text-align:right;border-bottom:1px solid #F5F5F7;">' + (g.searchVolume || 0).toLocaleString() + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;color:#6E6E73;border-bottom:1px solid #F5F5F7;">' + esc(g.rankingCompetitor) + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;font-family:monospace;font-weight:600;text-align:right;border-bottom:1px solid #F5F5F7;">#' + g.position + '</td>' +
      '</tr>';
    }).join('');

    keywordGapHtml = '<div style="padding:40px 48px;border-bottom:1px solid #D2D2D7;break-after:page;page-break-after:always;">' +
      '<h2 style="font-size:22px;font-weight:800;color:#1D1D1F;margin:0 0 8px;">Keyword Gap</h2>' +
      '<p style="font-size:13px;color:#6E6E73;line-height:1.6;margin-bottom:20px;">The top 10 industry keywords — topically related to your business — that a competitor ranks in the top 20 for but <strong>' + esc(client.client_name || '') + '</strong> doesn\'t. Branded competitor terms are excluded. Each is a validated content opportunity.</p>' +
      '<div style="border-top:2px solid #1D1D1F;"></div>' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr>' +
          '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #D2D2D7;">Keyword</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #D2D2D7;">Search Volume</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #D2D2D7;">Ranking Competitor</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #D2D2D7;">Position</th>' +
        '</tr></thead>' +
        '<tbody>' + gapRows + '</tbody>' +
      '</table>' +
      '<p style="font-size:11px;color:#AEAEB2;margin-top:12px;line-height:1.5;">Listed competitor is whichever ranks <em>highest</em> on each keyword. Branded competitor names and project-specific terms are filtered out. Keywords filtered for topical relevance and competitor positions of 20 or better.</p>' +
    '</div>';
  }

  // ─── 5. Closing Page ─────────────────────────────────────────────────

  var closing = '<div style="background:#000;padding:64px;text-align:center;">' +
    '<div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:12px;line-height:1.2;">Ready to outperform the competition?</div>' +
    '<p style="font-size:15px;color:#AEAEB2;margin-bottom:0;line-height:1.7;max-width:460px;margin-left:auto;margin-right:auto;">Let\'s build a winning strategy together. Schedule a session with the efelle team to turn these competitive insights into actionable growth.</p>' +
    '<a style="display:inline-block;background:#F56300;color:#fff;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;margin:24px 0 32px;" href="https://meetings-na2.hubspot.com/fred29" target="_blank">Schedule Your Strategy Call</a>' +
    '<div style="border-top:1px solid #333;padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#666;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:22px;height:22px;background:#F56300;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">e</div>' +
        '<span style="color:#aaa;font-size:13px;"><strong style="color:#ddd;">efelle</strong> creative</span>' +
      '</div>' +
      '<span>efelle.com</span><span>206.384.4909</span>' +
    '</div>' +
  '</div>';

  // ─── CSS ─────────────────────────────────────────────────────────────

  var CSS = '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:"Plus Jakarta Sans",sans-serif;background:#fff;color:#1D1D1F;max-width:780px;margin:0 auto;}' +
    'table{border-spacing:0;}' +
    '@media print{' +
      'div[style*="break-after:page"]{break-after:page;page-break-after:always;}' +
      'div[style*="break-inside:avoid"]{break-inside:avoid;page-break-inside:avoid;}' +
      'tr{break-inside:avoid;page-break-inside:avoid;}' +
      '@page{size:letter;margin:0.5in}' +
    '}';

  // ─── Assemble document ───────────────────────────────────────────────

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(client.client_name || '') + ' — Competitor Analysis — efelle creative</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style></head>' +
    '<body>' + cover + whySection + matrixSection + keywordGapHtml + closing + '</body></html>';
}


// ─── UI Logic — Competitor Screen ───────────────────────────────────────────

window.showCompetitorScreen = function() {
  // Navigate to the competitor screen
  if (typeof window.showScreen === 'function') {
    window.showScreen('competitor');
  }
};

window.startCompetitorSuggestion = async function(clientUrl) {
  if (!clientUrl) { alert('Please enter a client URL first.'); return; }
  dbg('competitor', 'Requesting competitor suggestions for', clientUrl);

  var statusEl = document.getElementById('comp-status');
  var suggestBtn = document.getElementById('comp-suggest-btn');

  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Claude is researching local competitors via web search... (~10-30 seconds)'; }
  if (suggestBtn) { suggestBtn.disabled = true; suggestBtn.textContent = 'Researching...'; }

  try {
    var res = await fetch('/api/audit/suggest-competitors', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ clientUrl: clientUrl })
    });

    if (!res.ok) throw new Error('Suggestion request failed: ' + res.status);
    var data = await res.json();
    var comps = data.competitors || [];

    // Populate the form fields
    for (var i = 0; i < 3; i++) {
      var urlEl = document.getElementById('comp-url-' + i);
      var ratEl = document.getElementById('comp-rationale-' + i);
      if (urlEl && comps[i]) urlEl.value = comps[i].url || '';
      if (ratEl && comps[i]) ratEl.textContent = comps[i].name + ': ' + comps[i].rationale;
    }

    if (statusEl) { statusEl.textContent = 'Found ' + comps.length + ' competitors. Review and edit below, then click Run All Audits.'; }

    return data;
  } catch (err) {
    dbg('competitor', 'Suggestion error:', err);
    if (statusEl) { statusEl.textContent = 'Error: ' + err.message; }
    throw err;
  } finally {
    if (suggestBtn) { suggestBtn.disabled = false; suggestBtn.textContent = '⟳ Auto-Suggest'; }
  }
};

window.runCompetitorBatch = async function(clientUrl, clientName, industry, contact, competitors) {
  dbg('competitor', 'Starting competitor batch audit', { clientUrl, clientName, competitors });

  var statusEl = document.getElementById('comp-status');
  var progressEl = document.getElementById('comp-progress');
  var frameEl = document.getElementById('comp-report-frame');

  if (statusEl) statusEl.textContent = 'Starting parallel audits...';

  try {
    // 1. Call run-batch endpoint
    var res = await fetch('/api/audit/run-batch', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        clientUrl: clientUrl,
        clientName: clientName,
        industry: industry,
        contact: contact,
        competitors: competitors
      })
    });

    if (!res.ok) throw new Error('Batch audit request failed: ' + res.status);
    var batch = await res.json();
    var jobId = batch.jobId;

    dbg('competitor', 'Batch started, jobId:', jobId);

    // Show progress stage
    var stage1 = document.getElementById('competitor-stage-1');
    var stage2 = document.getElementById('competitor-stage-2');
    var stage3 = document.getElementById('competitor-stage-3');
    if (stage1) stage1.style.display = 'none';
    if (stage2) stage2.style.display = 'block';

    // Set URLs in progress cards
    var clientUrlEl = document.getElementById('comp-progress-client-url');
    if (clientUrlEl) clientUrlEl.textContent = clientUrl;
    for (var ci = 0; ci < competitors.length; ci++) {
      var urlEl = document.getElementById('comp-progress-' + (ci + 1) + '-url');
      if (urlEl) urlEl.textContent = competitors[ci].url || '';
    }

    // 2. Poll batch-status every 3s
    var completed = false;
    while (!completed) {
      await new Promise(function(resolve) { setTimeout(resolve, 3000); });

      var statusRes = await fetch('/api/audit/batch-status/' + encodeURIComponent(jobId), {
        headers: getApiHeaders()
      });

      if (!statusRes.ok) throw new Error('Status check failed: ' + statusRes.status);
      var statusData = await statusRes.json();

      // Update progress badges
      var clientBadge = document.getElementById('comp-progress-client-badge');
      if (clientBadge) {
        clientBadge.textContent = statusData.client.status === 'complete' ? 'Complete' : statusData.client.status === 'error' ? 'Error' : 'Running...';
        clientBadge.style.background = statusData.client.status === 'complete' ? 'rgba(34,197,94,0.15)' : statusData.client.status === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(236,72,153,0.15)';
        clientBadge.style.color = statusData.client.status === 'complete' ? '#22c55e' : statusData.client.status === 'error' ? '#ef4444' : '#ec4899';
      }
      for (var pi = 0; pi < statusData.competitors.length; pi++) {
        var badge = document.getElementById('comp-progress-' + (pi + 1) + '-badge');
        if (badge) {
          var cs = statusData.competitors[pi].status;
          badge.textContent = cs === 'complete' ? 'Complete' : cs === 'error' ? 'Error' : 'Running...';
          badge.style.background = cs === 'complete' ? 'rgba(34,197,94,0.15)' : cs === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(107,122,148,0.15)';
          badge.style.color = cs === 'complete' ? '#22c55e' : cs === 'error' ? '#ef4444' : '#6b7a94';
        }
      }

      if (statusData.allComplete) completed = true;
      if (statusData.anyError && statusData.allComplete) break;
    }

    // 3. Fetch comparison data
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Audits complete. Generating comparison report...'; }

    var compRes = await fetch('/api/audit/comparison/' + encodeURIComponent(jobId), {
      headers: getApiHeaders()
    });

    if (!compRes.ok) throw new Error('Failed to fetch comparison: ' + compRes.status);
    var compData = await compRes.json();

    // 4. Build the comparison report
    var clientWsr = compData.client;
    var compWsrs = (compData.competitors || []).map(function(c, i) {
      return {
        wsrJson: c.wsrJson,
        name: c.name || competitors[i].name || ('Competitor ' + (i + 1)),
        rationale: c.rationale || competitors[i].rationale || ''
      };
    });

    competitorReportHtml = buildComparisonReportHTML(clientWsr, compWsrs);

    // 5. Render the report
    if (frameEl) {
      await writeToFrame(frameEl, competitorReportHtml);
      frameEl.style.display = 'block';
    }

    // Show stage 3 (report ready)
    if (stage2) stage2.style.display = 'none';
    if (stage3) stage3.style.display = 'block';
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Competitor report generated successfully.'; }

    // 6. Auto-save both reports to library
    try {
      await saveReport('competitor', clientName, {
        url: clientUrl,
        industry: industry,
        contact: contact,
        competitorCount: compWsrs.length
      }, {
        client: clientWsr,
        competitors: compWsrs
      }, competitorReportHtml);
      dbg('competitor', 'Competitor report saved to library');
    } catch (saveErr) {
      console.warn('Auto-save competitor report failed:', saveErr);
    }

    // Also save individual WSR reports for each competitor
    for (var i = 0; i < compWsrs.length; i++) {
      try {
        if (compData.competitors[i] && compData.competitors[i].reportHtml) {
          await saveReport('wsr', compWsrs[i].name, {
            url: (compWsrs[i].wsrJson || {}).website || '',
            industry: industry,
            contact: '',
            source: 'competitor-batch'
          }, compWsrs[i].wsrJson, compData.competitors[i].reportHtml);
        }
      } catch (saveErr) {
        console.warn('Auto-save competitor WSR failed:', saveErr);
      }
    }

    return { client: clientWsr, competitors: compWsrs, html: competitorReportHtml };

  } catch (err) {
    dbg('competitor', 'Batch audit error:', err);
    if (statusEl) statusEl.textContent = 'Error: ' + err.message;
    throw err;
  }
};

window.competitorGoStage1 = function() {
  document.getElementById('competitor-stage-1').style.display = 'block';
  document.getElementById('competitor-stage-2').style.display = 'none';
  document.getElementById('competitor-stage-3').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Expose the report builder for external use
window.buildComparisonReportHTML = buildComparisonReportHTML;
