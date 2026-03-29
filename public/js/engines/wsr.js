import { callWithWebSearch, repairJSON, getApiHeaders } from '../core/api.js';
import { API_MODEL } from '../core/state.js';
import { WSR_GEMINI_SYSTEM, WSR_VALIDATE_SYSTEM } from '../data/prompts.js';
import { dbg } from '../core/debug.js';
import { writeToFrame } from '../core/utils.js';
import { saveReport } from '../core/reports.js';

let wsrReportHtml = '';

function buildWSRReportHTML(d) {
  const OG = '#F56300', GR = '#059669', GRL = '#34d399';
  const severityColor = { critical: '#ef4444', moderate: '#f59e0b', low: '#6b7280' };
  const impactColor   = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
  const effortLabel   = { 'quick-win': 'Quick Win', medium: 'Medium Effort', major: 'Major Project' };
  const effortColor   = { 'quick-win': '#22c55e', medium: '#f59e0b', major: '#ef4444' };

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const scoreColor = (s) => s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = (s) => s >= 75 ? 'Good' : s >= 50 ? 'Needs Work' : 'Critical';

  const cats = d.categories || [];
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });


  function scoreRing(score, size) {
    size = size || 64;
    const r = size * 0.38, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const col = scoreColor(score);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#F5F5F7" stroke-width="' + (size * 0.08) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + (size * 0.08) + '" stroke-dasharray="' + dash + ' ' + circ + '" stroke-dashoffset="' + (circ / 4) + '" stroke-linecap="round"/>' +
      '<text x="' + cx + '" y="' + (cy + size * 0.065) + '" text-anchor="middle" font-size="' + (size * 0.22) + '" font-weight="700" fill="' + col + '" font-family="Plus Jakarta Sans,sans-serif">' + score + '</text>' +
      '</svg>';
  }


  const cover = '<div style="background:#000;background-image:radial-gradient(ellipse at top right,rgba(5,150,105,0.2) 0%,#000 60%);padding:32px 48px 28px;">' +
    '<div style="margin-bottom:32px;">' +
      '<svg version="1.1" id="efelle_creative" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 551 275" style="width:120px;height:auto;display:block;" xml:space="preserve"><style type="text/css">.st0{fill:#F05128;}.st1{fill:#5A5F63;}</style><g><path class="st0" d="M103.6,88.8c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7H42.5c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3c0-7.3-1.8-14.6-5.3-21.6C119.3,101.8,112.5,94.3,103.6,88.8z"/><path class="st0" d="M293.6,88.8c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7h-75.7c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3c0-7.3-1.8-14.6-5.3-21.6C309.3,101.8,302.5,94.3,293.6,88.8z"/><path class="st0" d="M489,111.2c-4.7-9.4-11.5-16.9-20.4-22.3c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7h-75.7c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3C494.3,125.5,492.5,118.2,489,111.2z"/><path class="st0" d="M154.6,86.6c2.1-5.7,5.7-10.8,10.7-15.3c4-3.6,8.5-6.3,13.1-8.2c5.2-2.1,10.8-3.1,16.8-3.1c3.9,0,5.9-2.8,5.9-5.5c0-3.1-2.3-5.4-5.4-5.4h-1.3c-7.5,0-14.8,1.5-21.4,4.4c-5.9,2.6-11.5,6.3-16.4,11.2c-5.7,5.5-9.9,11.8-12.4,18.6c-2.4,6.7-3.7,14.9-3.7,24.4V252c0,3.3,2.3,5.7,5.4,5.7s5.4-2.4,5.4-5.7V139.6h44.1c3.3,0,5.7-2.3,5.7-5.4s-2.4-5.4-5.7-5.4h-44.1V110C151.4,100.3,152.5,92.4,154.6,86.6z"/><path class="st0" d="M337.5,11.9c-3.2,0-5.5,2.4-5.5,5.7v37.1v7.5V182v0.6c0.5,3.6,3.1,5.2,5.5,5.2c2.7,0,5.4-2,5.4-5.7V62.2v-7.5V17.6C343,13.9,340.2,11.9,337.5,11.9z"/><path class="st0" d="M365.5,11.9c-3.2,0-5.5,2.4-5.5,5.7v37.1v7.5V182v0.6c0.5,3.6,3.1,5.2,5.5,5.2c2.7,0,5.4-2,5.4-5.7V62.2v-7.5V17.6C371,13.9,368.2,11.9,365.5,11.9z"/></g><g><path class="st1" d="M355.5,238.7l-2.3,1.4c-2-2.7-4.8-4-8.2-4c-2.8,0-5.1,0.9-6.9,2.7s-2.8,4-2.8,6.5c0,1.7,0.4,3.2,1.3,4.7c0.8,1.5,2,2.6,3.5,3.4c1.5,0.8,3.1,1.2,5,1.2c3.4,0,6.1-1.3,8.2-4l2.3,1.5c-1.1,1.6-2.6,2.9-4.4,3.8s-3.9,1.4-6.3,1.4c-3.6,0-6.6-1.1-9-3.4c-2.4-2.3-3.6-5.1-3.6-8.4c0-2.2,0.6-4.3,1.7-6.2s2.6-3.4,4.6-4.4c1.9-1.1,4.1-1.6,6.5-1.6c1.5,0,3,0.2,4.4,0.7s2.6,1.1,3.6,1.8C354,236.6,354.8,237.6,355.5,238.7z"/></g><g><path class="st1" d="M365.4,234h3v3.3c0.9-1.3,1.8-2.3,2.8-2.9c1-0.7,2-1,3.1-1c0.8,0,1.7,0.3,2.6,0.8l-1.5,2.5c-0.6-0.3-1.1-0.4-1.6-0.4c-1,0-1.9,0.4-2.8,1.2s-1.6,2.1-2.1,3.7c-0.4,1.3-0.5,3.9-0.5,7.9v7.7h-3V234z"/></g><g><path class="st1" d="M441,234v22.8h-2.9v-3.9c-1.2,1.5-2.6,2.6-4.1,3.4s-3.2,1.1-5,1.1c-3.2,0-6-1.2-8.3-3.5c-2.3-2.3-3.4-5.2-3.4-8.6c0-3.3,1.2-6.1,3.5-8.4c2.3-2.3,5.1-3.5,8.3-3.5c1.9,0,3.6,0.4,5.1,1.2s2.9,2,4,3.6V234H441z M429.3,236.2c-1.6,0-3.1,0.4-4.5,1.2s-2.5,1.9-3.3,3.4s-1.2,3-1.2,4.6s0.4,3.1,1.2,4.6c0.8,1.5,1.9,2.6,3.3,3.4c1.4,0.8,2.9,1.2,4.5,1.2s3.1-0.4,4.6-1.2c1.4-0.8,2.5-1.9,3.3-3.3c0.8-1.4,1.2-2.9,1.2-4.7c0-2.6-0.9-4.9-2.6-6.6C434,237.1,431.8,236.2,429.3,236.2z"/></g><g><path class="st1" d="M455.6,225.5h2.9v8.5h4.7v2.5h-4.7v20.3h-2.9v-20.3h-4V234h4V225.5z"/></g><g><path class="st1" d="M474.1,224.6c0.7,0,1.2,0.2,1.7,0.7s0.7,1,0.7,1.7s-0.2,1.2-0.7,1.7s-1,0.7-1.7,0.7s-1.2-0.2-1.7-0.7s-0.7-1-0.7-1.7s0.2-1.2,0.7-1.7S473.4,224.6,474.1,224.6z M472.6,234h2.9v22.8h-2.9V234z"/></g><g><path class="st1" d="M484.9,234h3.1l7.7,16.7l7.6-16.7h3.1L496,256.8h-0.5L484.9,234z"/></g><path class="st1" d="M536.7,240.1c-1-2.1-2.5-3.8-4.5-5c-1.9-1.2-4.1-1.9-6.4-1.9c-2.2,0-4.2,0.5-6,1.6c-1.9,1.1-3.3,2.6-4.4,4.4c-1.1,1.9-1.6,3.9-1.6,6s0.5,4.2,1.6,6c1.1,1.9,2.6,3.4,4.4,4.4c1.9,1.1,3.9,1.6,6,1.6c2.6,0,5-0.8,7.1-2.3c0.8-0.6,1.4-1.1,1.4-1.8c0-0.8-0.6-1.4-1.4-1.4c-0.4,0-0.8,0.2-1.1,0.5c-0.8,0.7-1.7,1.2-2.8,1.6c-2.9,1-5.5,0.7-7.9-0.6c-1.5-0.8-2.6-2-3.4-3.4c-0.8-1.4-1.3-3-1.3-4.6c0-1.7,0.4-3.2,1.3-4.7c0.8-1.4,2-2.6,3.4-3.4c1.4-0.8,3-1.2,4.6-1.2c2,0,3.7,0.5,5.3,1.7c1.4,1,2.5,2.3,3.2,3.8c0.3,0.6,0.5,1.2,0.6,1.7c0,0.2,0.1,0.4,0.1,0.6h-16.1c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4h17.3c1,0,1.6-0.6,1.6-1.6C537.8,243.3,537.4,241.7,536.7,240.1z"/><path class="st1" d="M407.7,240.1c-1-2.1-2.5-3.8-4.5-5c-1.9-1.2-4.1-1.9-6.4-1.9c-2.2,0-4.2,0.5-6,1.6c-1.9,1.1-3.3,2.6-4.4,4.4c-1.1,1.9-1.6,3.9-1.6,6s0.5,4.2,1.6,6c1.1,1.9,2.6,3.4,4.4,4.4c1.9,1.1,3.9,1.6,6,1.6c2.6,0,5-0.8,7.1-2.3c0.8-0.6,1.4-1.1,1.4-1.8c0-0.8-0.6-1.4-1.4-1.4c-0.4,0-0.8,0.2-1.1,0.5c-0.8,0.7-1.7,1.2-2.8,1.6c-2.9,1-5.5,0.7-7.9-0.6c-1.5-0.8-2.6-2-3.4-3.4s-1.3-3-1.3-4.6c0-1.7,0.4-3.2,1.3-4.7c0.8-1.4,2-2.6,3.4-3.4c1.4-0.8,3-1.2,4.6-1.2c2,0,3.7,0.5,5.3,1.7c1.4,1,2.5,2.3,3.2,3.8c0.3,0.6,0.5,1.2,0.6,1.7c0,0.2,0.1,0.4,0.1,0.6h-16.1c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4h17.3c1,0,1.6-0.6,1.6-1.6C408.8,243.3,408.4,241.7,407.7,240.1z"/></svg>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:' + OG + ';margin-bottom:16px;">Website Audit &amp; Recommendations (W.A.R.) Report</div>' +
      '<div style="font-size:11px;color:#6E6E73;">' + date + '</div>' +
    '</div>' +
    '<div style="font-size:44px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:14px;">' + esc(d.client_name||'Website') + '</div>' +
    '<div style="font-size:14px;color:#AEAEB2;margin-bottom:0;">Custom website audit and digital health assessment &amp; recommendations for your current website' + (d.website ? ' <span style="color:#6E6E73;">' + esc(d.website) + '</span>' : '') + '.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:40px;">' +
      '<div><div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:6px;">Prepared For</div>' +
    '<div style="font-size:14px;color:#fff;line-height:1.8;">' + esc(d.prepared_for||d.client_name||'') + '</div></div>' +
      '<div><div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:6px;">Overall Score</div>' +
    '<div style="display:flex;align-items:center;gap:14px;">' + scoreRing(d.overall_score||0, 56) +
    '<div><div style="font-size:20px;font-weight:800;color:' + scoreColor(d.overall_score||0) + ';">' + scoreLabel(d.overall_score||0) + '</div>' +
    '</div></div></div>' +
    '</div>' +
  '</div>';

  const summary = '<div style="padding:24px 48px 28px;border-bottom:1px solid #D2D2D7;break-after:page;page-break-after:always;">' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Executive Summary</div>' +
    '<h2 style="font-size:22px;font-weight:800;color:#1D1D1F;margin:0 0 16px;">How ' + esc(d.client_name||'This Website') + ' Performs Today</h2>' +
    '<p style="font-size:13px;color:#6E6E73;line-height:1.7;margin-bottom:20px;">' + esc(d.executive_summary||'') + '</p>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
    cats.map(c =>
      '<div style="background:#F5F5F7;border-radius:10px;padding:12px 14px;text-align:center;">' +
        scoreRing(c.score||0, 44) +
    '<div style="font-size:9px;font-weight:700;color:#6E6E73;margin-top:6px;letter-spacing:0.05em;text-transform:uppercase;">' + esc(c.label||'') + '</div>' +
      '</div>'
    ).join('') +
    '</div>' +
  '</div>';


  const catSections = cats.map(function(cat, ci) {
    const issuesHtml = (cat.issues||[]).map(issue =>
      '<div style="border:1px solid #D2D2D7;border-radius:8px;padding:10px 14px;margin-bottom:6px;">' +
    '<div style="display:flex;align-items:flex-start;gap:8px;">' +
    '<div style="width:6px;height:6px;border-radius:50%;background:' + (severityColor[issue.severity]||'#6b7280') + ';flex-shrink:0;margin-top:5px;"></div>' +
    '<div style="flex:1;">' +
    '<div style="font-size:11px;font-weight:700;color:#1D1D1F;margin-bottom:2px;">' + esc(issue.title||'') + '</div>' +
    '<div style="font-size:11px;color:#6E6E73;line-height:1.5;">' + esc(issue.description||'') + '</div>' +
    '</div>' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' + (severityColor[issue.severity]||'#6b7280') + ';white-space:nowrap;flex-shrink:0;">' + (issue.severity||'') + '</div>' +
    '</div>' +
      '</div>'
    ).join('');

    const recsHtml = (cat.recommendations||[]).map(rec =>
      '<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #F5F5F7;">' +
    '<div style="width:18px;height:18px;border-radius:4px;background:' + (impactColor[rec.impact]||'#6b7280') + '20;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">' +
    '<div style="width:5px;height:5px;border-radius:50%;background:' + (impactColor[rec.impact]||'#6b7280') + ';"></div>' +
    '</div>' +
    '<div>' +
    '<div style="font-size:11px;font-weight:700;color:#1D1D1F;margin-bottom:1px;">' + esc(rec.title||'') + '</div>' +
    '<div style="font-size:10px;color:#6E6E73;line-height:1.5;">' + esc(rec.description||'') + '</div>' +
    '</div>' +
    '<div style="margin-left:auto;font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + (impactColor[rec.impact]||'#6b7280') + ';white-space:nowrap;flex-shrink:0;padding-top:2px;">' + (rec.impact||'') + '</div>' +
      '</div>'
    ).join('');

    return '<div style="padding:24px 48px;border-bottom:1px solid #D2D2D7;break-after:page;page-break-after:always;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
    '<div>' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:4px;">Section 0' + (ci+1) + '</div>' +
    '<h2 style="font-size:20px;font-weight:800;color:#1D1D1F;margin:0;">' + esc(cat.label||'') + '</h2>' +
    '</div>' +
        scoreRing(cat.score||0, 48) +
      '</div>' +
      (issuesHtml ? '<div style="margin-bottom:16px;"><div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:8px;">Issues Found</div>' + issuesHtml + '</div>' : '') +
      (recsHtml ? '<div><div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + GR + ';margin-bottom:4px;">Recommendations</div>' + recsHtml + '</div>' : '') +
    '</div>';
  }).join('');

  // Split: AI/GEO section separate for reordering
  const aiCat = d.categories ? d.categories.find(function(c){ return c.id === 'ai'; }) : null;
  const otherCats = d.categories ? d.categories.filter(function(c){ return c.id !== 'ai'; }) : [];

  // Build AI section standalone
  const aiSection = aiCat ? (function(){
    var cat = aiCat;
    var ci = 0;
    var issuesHtml2 = (cat.issues||[]).map(function(issue){
      return '<div style="border:1px solid #D2D2D7;border-radius:10px;padding:16px 20px;margin-bottom:10px;">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:' + (severityColor[issue.severity]||'#6b7280') + ';flex-shrink:0;margin-top:5px;"></div>' +
        '<div style="flex:1;">' +
        '<div style="font-size:13px;font-weight:700;color:#1D1D1F;margin-bottom:3px;">' + esc(issue.title||'') + '</div>' +
        '<div style="font-size:13px;color:#6E6E73;line-height:1.6;">' + esc(issue.description||'') + '</div>' +
        '</div>' +
        '<div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' + (severityColor[issue.severity]||'#6b7280') + ';white-space:nowrap;flex-shrink:0;">' + (issue.severity||'') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var recsHtml2 = (cat.recommendations||[]).map(function(rec){
      return '<div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #F5F5F7;">' +
        '<div style="width:24px;height:24px;border-radius:6px;background:' + (impactColor[rec.impact]||'#6b7280') + '20;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">' +
        '<div style="width:7px;height:7px;border-radius:50%;background:' + (impactColor[rec.impact]||'#6b7280') + ';"></div>' +
        '</div>' +
        '<div>' +
        '<div style="font-size:13px;font-weight:700;color:#1D1D1F;margin-bottom:2px;">' + esc(rec.title||'') + '</div>' +
        '<div style="font-size:12px;color:#6E6E73;line-height:1.6;">' + esc(rec.description||'') + '</div>' +
        '</div>' +
        '<div style="margin-left:auto;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + (impactColor[rec.impact]||'#6b7280') + ';white-space:nowrap;flex-shrink:0;padding-top:2px;">' + (rec.impact||'') + ' impact</div>' +
      '</div>';
    }).join('');
    return '<div style="padding:40px 64px;border-bottom:1px solid #D2D2D7;break-after:page;page-break-after:always;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">' +
      '<div>' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Section 02</div>' +
      '<h2 style="font-size:24px;font-weight:800;color:#1D1D1F;margin:0;">AI &amp; GEO Readiness</h2>' +
      '</div>' +
      scoreRing(cat.score||0, 58) +
      '</div>' +
      (issuesHtml2 ? '<div style="margin-bottom:24px;"><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:12px;">Issues Found</div>' + issuesHtml2 + '</div>' : '') +
      (recsHtml2 ? '<div><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + GR + ';margin-bottom:4px;">Recommendations</div>' + recsHtml2 + '</div>' : '') +
    '</div>';
  })() : '';

  // Rebuild otherCatSections (all non-AI cats, renumbered from 03)
  const otherCatSections = otherCats.map(function(cat, i){
    var ci = i + 2; // starts at index 2 → Section 03
    var issuesHtmlN = (cat.issues||[]).map(function(issue){
      return '<div style="border:1px solid #D2D2D7;border-radius:10px;padding:16px 20px;margin-bottom:10px;">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:' + (severityColor[issue.severity]||'#6b7280') + ';flex-shrink:0;margin-top:5px;"></div>' +
        '<div style="flex:1;">' +
        '<div style="font-size:13px;font-weight:700;color:#1D1D1F;margin-bottom:3px;">' + esc(issue.title||'') + '</div>' +
        '<div style="font-size:13px;color:#6E6E73;line-height:1.6;">' + esc(issue.description||'') + '</div>' +
        '</div>' +
        '<div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' + (severityColor[issue.severity]||'#6b7280') + ';white-space:nowrap;flex-shrink:0;">' + (issue.severity||'') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var recsHtmlN = (cat.recommendations||[]).map(function(rec){
      return '<div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #F5F5F7;">' +
        '<div style="width:24px;height:24px;border-radius:6px;background:' + (impactColor[rec.impact]||'#6b7280') + '20;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">' +
        '<div style="width:7px;height:7px;border-radius:50%;background:' + (impactColor[rec.impact]||'#6b7280') + ';"></div>' +
        '</div>' +
        '<div>' +
        '<div style="font-size:13px;font-weight:700;color:#1D1D1F;margin-bottom:2px;">' + esc(rec.title||'') + '</div>' +
        '<div style="font-size:12px;color:#6E6E73;line-height:1.6;">' + esc(rec.description||'') + '</div>' +
        '</div>' +
        '<div style="margin-left:auto;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + (impactColor[rec.impact]||'#6b7280') + ';white-space:nowrap;flex-shrink:0;padding-top:2px;">' + (rec.impact||'') + ' impact</div>' +
      '</div>';
    }).join('');
    var secNum = String(ci + 1).padStart(2, '0');
    return '<div style="padding:40px 64px;border-bottom:1px solid #D2D2D7;break-after:page;page-break-after:always;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">' +
      '<div>' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Section ' + secNum + '</div>' +
      '<h2 style="font-size:24px;font-weight:800;color:#1D1D1F;margin:0;">' + esc(cat.label||'') + '</h2>' +
      '</div>' +
      scoreRing(cat.score||0, 58) +
      '</div>' +
      (issuesHtmlN ? '<div style="margin-bottom:24px;"><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:12px;">Issues Found</div>' + issuesHtmlN + '</div>' : '') +
      (recsHtmlN ? '<div><div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:' + GR + ';margin-bottom:4px;">Recommendations</div>' + recsHtmlN + '</div>' : '') +
    '</div>';
  }).join('');

  const actions = (d.priority_actions||[]);
  const actionsHtml = actions.map(a =>
    '<div style="display:flex;gap:20px;align-items:flex-start;padding:20px 0;border-top:1px solid #D2D2D7;">' +
      '<div style="font-size:32px;font-weight:800;color:' + OG + ';line-height:1;min-width:32px;flex-shrink:0;">' + (a.rank||'') + '</div>' +
      '<div style="flex:1;min-width:0;">' +
    '<div style="margin-bottom:6px;">' +
    '<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + (effortColor[a.effort]||'#6b7280') + ';background:' + (effortColor[a.effort]||'#6b7280') + '15;padding:3px 10px;border-radius:4px;white-space:nowrap;min-width:100px;text-align:center;">' + (effortLabel[a.effort]||a.effort||'') + '</span>' +
    '</div>' +
    '<div style="font-size:14px;font-weight:700;color:#1D1D1F;margin-bottom:4px;line-height:1.4;">' + esc(a.title||'') + '</div>' +
    '<div style="font-size:13px;color:#6E6E73;line-height:1.6;">' + esc(a.why||'') + '</div>' +
      '</div>' +
    '</div>'
  ).join('');

  const prioritySection = actionsHtml ? '<div style="padding:24px 48px;border-bottom:1px solid #D2D2D7;break-after:page;page-break-after:always;">' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Recommendations</div>' +
    '<h2 style="font-size:22px;font-weight:800;color:#1D1D1F;margin:0 0 6px;">Priority Action Plan</h2>' +
    '<p style="font-size:12px;color:#6E6E73;margin-bottom:4px;">Ranked by impact and effort — start here.</p>' +
    actionsHtml + '</div>' : '';


  // Screenshots section (if available)
  // Screenshots in Apple device mockups
  let screenshotSection = '';
  if (d._screenshots && (d._screenshots.desktop || d._screenshots.mobile)) {
    // MacBook mockup (silver bezel + bottom bar)
    const macbook = '<div style="flex:3;max-width:480px;">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:8px;text-align:center;">MacBook Pro</div>' +
      '<div style="background:#1D1D1F;border-radius:12px 12px 0 0;padding:8px 8px 0;box-shadow:0 4px 20px rgba(0,0,0,0.15);">' +
        '<div style="display:flex;align-items:center;justify-content:center;margin-bottom:6px;">' +
          '<div style="width:6px;height:6px;border-radius:50%;background:#3a3a3c;"></div>' +
        '</div>' +
        '<div style="border-radius:4px;overflow:hidden;">' +
          '<img src="' + (d._screenshots.desktop || '') + '" style="width:100%;display:block;" alt="Desktop homepage">' +
        '</div>' +
      '</div>' +
      '<div style="background:#1D1D1F;height:12px;border-radius:0 0 4px 4px;"></div>' +
      '<div style="background:#2a2a2c;height:6px;width:35%;margin:0 auto;border-radius:0 0 6px 6px;"></div>' +
    '</div>';

    // iPhone mockup (rounded corners + notch)
    const iphone = '<div style="flex:0 0 100px;">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:8px;text-align:center;">iPhone</div>' +
      '<div style="background:#1D1D1F;border-radius:20px;padding:10px 5px;box-shadow:0 4px 20px rgba(0,0,0,0.15);">' +
        '<div style="display:flex;justify-content:center;margin-bottom:4px;">' +
          '<div style="width:30%;height:4px;background:#2a2a2c;border-radius:4px;"></div>' +
        '</div>' +
        '<div style="border-radius:8px;overflow:hidden;">' +
          '<img src="' + (d._screenshots.mobile || '') + '" style="width:100%;display:block;" alt="Mobile homepage">' +
        '</div>' +
        '<div style="display:flex;justify-content:center;margin-top:4px;">' +
          '<div style="width:28%;height:3px;background:#2a2a2c;border-radius:3px;"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

    screenshotSection = '<div style="padding:28px 48px 32px;border-bottom:1px solid #D2D2D7;">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:' + OG + ';margin-bottom:6px;">Current Website</div>' +
      '<h2 style="font-size:22px;font-weight:800;color:#1D1D1F;margin:0 0 6px;">Homepage Screenshots</h2>' +
      '<p style="font-size:12px;color:#6E6E73;margin-bottom:20px;">Captured during this audit — desktop and mobile viewports.</p>' +
      '<div style="display:flex;gap:32px;align-items:flex-start;justify-content:center;">' +
        macbook + iphone +
      '</div>' +
    '</div>';
  }

  const closing = '<div style="background:#000;padding:64px;text-align:center;">' +
    '<div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:12px;line-height:1.2;">Ready to fix these issues?</div>' +
    '<p style="font-size:15px;color:#AEAEB2;margin-bottom:0;line-height:1.7;max-width:460px;margin-left:auto;margin-right:auto;">' + esc(d.closing||"Let's build a plan together. Schedule a strategy session with the efelle team to turn these insights into results.") + '</p>' +
    '<a style="display:inline-block;background:#F56300;color:#fff;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;margin:24px 0 32px;" href="https://meetings-na2.hubspot.com/fred29" target="_blank">Schedule Your Strategy Call</a>' +
    '<div style="border-top:1px solid #333;padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#666;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:22px;height:22px;background:#F56300;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">e</div>' +
        '<span style="color:#aaa;font-size:13px;"><strong style="color:#ddd;">efelle</strong> creative</span>' +
      '</div>' +
      '<span>efelle.com</span><span>206.384.4909</span>' +
    '</div>' +
  '</div>';

  const CSS = '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:"Plus Jakarta Sans",sans-serif;background:#fff;color:#1D1D1F;max-width:780px;margin:0 auto;}' +
    '@media print{div[style*="break-after:page"]{break-after:page;page-break-after:always;}div[style*="border:1px solid #D2D2D7;border-radius:10px"]{break-inside:avoid;page-break-inside:avoid;}div[style*="display:flex;gap:20px;align-items:flex-start;padding:20px 0"]{break-inside:avoid;page-break-inside:avoid;}div[style*="display:flex;gap:12px;padding:14px 0"]{break-inside:avoid;page-break-inside:avoid;}@page{size:letter;margin:0.5in}}';

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(d.client_name||'') + ' — Website Audit & Recommendations — efelle creative</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style></head>' +
    '<body>' + cover + summary + prioritySection + aiSection + otherCatSections + screenshotSection + closing + '</body></html>';
}

function wsrShowStage(stage) {
  document.getElementById('wsr-stage-1a').style.display = stage === '1a' ? 'block' : 'none';
  document.getElementById('wsr-stage-1b').style.display = stage === '1b' ? 'block' : 'none';
  document.getElementById('wsr-stage-2').style.display  = stage === '2'  ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.wsrShowStage = wsrShowStage;

// ── WSR Lookup: auto-detect company name, sitemaps, then auto-start audit ──
document.getElementById('wsr-lookup-btn').addEventListener('click', async () => {
  const url = document.getElementById('wsr-url').value.trim();
  const errEl = document.getElementById('wsr-build-error');
  if (!url) { errEl.textContent = '⚠ Please enter a website URL first.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('wsr-lookup-btn');
  const statusEl = document.getElementById('wsr-lookup-status');
  btn.disabled = true;
  btn.textContent = 'Looking up site…';
  statusEl.style.display = 'block';
  statusEl.textContent = '⏳ Fetching company info and sitemaps…';

  try {
    const [companyRes, sitemapRes] = await Promise.all([
      fetch('/api/extract-company', { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ url }) }),
      fetch('/api/discover-sitemaps', { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ url }) }),
    ]);

    const companyData = await companyRes.json();
    const sitemapData = await sitemapRes.json();

    if (companyData.name) document.getElementById('wsr-client-name').value = companyData.name;
    if (companyData.industry) document.getElementById('wsr-industry').value = companyData.industry;

    const sitemaps = sitemapData.sitemaps || [];
    const sitemapsGroup = document.getElementById('wsr-sitemaps-group');
    const sitemapsEl = document.getElementById('wsr-sitemaps');
    if (sitemaps.length > 0) {
      sitemapsEl.value = sitemaps.join('\n');
      sitemapsGroup.style.display = 'block';
    }

    const parts = [];
    if (companyData.name) parts.push('✓ ' + companyData.name);
    if (companyData.industry) parts.push('✓ ' + companyData.industry);
    parts.push(sitemaps.length + ' sitemap(s)');
    statusEl.innerHTML = '<span style="color:#34d399">' + parts.join(' · ') + ' — starting audit…</span>';

  } catch (err) {
    statusEl.innerHTML = '<span style="color:#f87171">⚠ Lookup failed: ' + err.message + ' — starting audit anyway…</span>';
  }

  // Auto-trigger the full audit
  btn.textContent = 'Running audit…';
  document.getElementById('wsr-run-full-audit-btn').click();
  // The full audit handler will re-enable the button when done
});

// ── WSR Run Full Audit (automated: Lookup→Prompt→Gemini→Claude→Report) ──
document.getElementById('wsr-run-full-audit-btn').addEventListener('click', async () => {
  const url = document.getElementById('wsr-url').value.trim();
  const errEl = document.getElementById('wsr-build-error');
  if (!url) { errEl.textContent = '⚠ Please enter a website URL first.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('wsr-run-full-audit-btn');
  const progress = document.getElementById('wsr-full-audit-progress');
  btn.disabled = true;
  btn.textContent = 'Running audit…';
  progress.style.display = 'block';
  // Hide the manual prompt area if visible
  const promptArea = document.getElementById('wsr-prompt-area');
  if (promptArea) promptArea.style.display = 'none';
  // Scroll to keep progress in view
  progress.scrollIntoView({ behavior: 'smooth', block: 'center' });

  function setStep(n, status, detail) {
    const el = document.getElementById('wsr-step-' + n);
    const icon = el.querySelector('.wsr-step-icon');
    const text = el.querySelector('.wsr-step-text');
    el.classList.remove('wsr-step-active');
    if (status === 'active') { icon.textContent = '◉'; el.style.color = '#34d399'; el.classList.add('wsr-step-active'); }
    else if (status === 'done') { icon.textContent = '✓'; el.style.color = '#6b7a94'; }
    else if (status === 'error') { icon.textContent = '✗'; el.style.color = '#f87171'; }
    if (detail && text) text.textContent = detail;
  }

  try {
    // Step 1: Build prompt (lookup already done by the lookup button)
    setStep(1, 'active', 'Building audit prompt…');

    let client = document.getElementById('wsr-client-name').value.trim();
    // Only run lookup if called directly (not from lookup button) and name is empty
    if (!client && !document.getElementById('wsr-lookup-btn').disabled) {
      try {
        const [companyRes, sitemapRes] = await Promise.all([
          fetch('/api/extract-company', { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ url }) }),
          fetch('/api/discover-sitemaps', { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ url }) }),
        ]);
        const companyData = await companyRes.json();
        const sitemapData = await sitemapRes.json();
        if (companyData.name) document.getElementById('wsr-client-name').value = companyData.name;
        if (companyData.industry) document.getElementById('wsr-industry').value = companyData.industry;
        const sitemaps = sitemapData.sitemaps || [];
        if (sitemaps.length) document.getElementById('wsr-sitemaps').value = sitemaps.join('\n');
        client = companyData.name || '';
      } catch (e) { /* continue without lookup */ }
    }

    // Build prompt inline (same logic as the manual button)
    const sitemaps = document.getElementById('wsr-sitemaps').value.trim();
    const industry = document.getElementById('wsr-industry').value.trim();
    const contact = document.getElementById('wsr-contact').value.trim();
    const context = document.getElementById('wsr-context').value.trim();
    const sitemapLines = sitemaps ? sitemaps.split('\n').map(s => s.trim()).filter(Boolean) : [];

    const promptText =
      'You are a senior SEO and website audit specialist. Perform a comprehensive website audit ' +
      'for the following site using Google Search grounding to access and read the live pages.\n\n' +
      'WEBSITE TO AUDIT: ' + url + '\n' +
      (client   ? 'CLIENT NAME: ' + client + '\n' : '') +
      (industry ? 'INDUSTRY: ' + industry + '\n' : '') +
      (contact  ? 'CONTACT: ' + contact + '\n' : '') +
      (sitemapLines.length ? '\nSITEMAPS TO CHECK (visit each URL listed):\n' + sitemapLines.join('\n') + '\n' : '') +
      (context  ? '\nKNOWN CONTEXT:\n' + context + '\n' : '') +
      '\nAUDIT INSTRUCTIONS:\n' +
      '1. Visit the homepage and at least 5 key pages (services, location pages, about, contact)\n' +
      '2. If sitemaps are provided, review URL patterns and note any issues\n' +
      '3. Check presence or absence of these schema types: LocalBusiness (or industry-specific subtype like RoofingContractor), Service, FAQPage, AggregateRating, BreadcrumbList, ImageObject, Organization\n' +
      '4. For each schema type: state whether it IS present or IS NOT present — do not guess\n' +
      '5. Evaluate: title tags, meta descriptions, H1/H2 structure, keyword usage, NAP consistency\n' +
      '6. Assess mobile-friendliness, page load signals, image optimization\n' +
      '7. Review content quality: is it specific to this business and location, or templated/generic?\n' +
      '8. Check CTAs, contact forms, click-to-call, trust signals, review displays\n' +
      '9. Assess AI/GEO readiness: answer-optimized headers, entity linking via sameAs, E-E-A-T signals, structured data for AI citation\n' +
      '10. Score each of the 6 categories 0-100 based on CURRENT state — not aspirational\n\n' +
      'CATEGORIES TO SCORE:\n' +
      '  - SEO & Local Search\n' +
      '  - User Experience & Design\n' +
      '  - Performance & Technical\n' +
      '  - Content & Messaging\n' +
      '  - Conversion & Lead Generation\n' +
      '  - AI & GEO Readiness\n\n' +
      'SCORING RULES:\n' +
      '  - Missing schema entirely = max 35 in AI & GEO Readiness\n' +
      '  - Templated/generic location pages = max 45 in SEO & Local Search\n' +
      '  - Be honest — do not inflate scores\n\n' +
      'Report findings in detail. Reference actual page content, exact URLs, and specific schema issues found. ' +
      'Identify the top 5 priority actions ranked by business impact. Do not invent findings.';

    if (!promptText) throw new Error('Failed to build prompt');
    // Also save it for manual mode reference
    document.getElementById('wsr-prompt-output').value = promptText;
    setStep(1, 'done', 'Prompt built' + (client ? ' for ' + client : ''));

    // Step 2: Send to Gemini API + capture screenshots in parallel
    setStep(2, 'active', 'Sending to Gemini API & capturing screenshots… (60-90 seconds)');
    progress.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Launch both in parallel — screenshots don't block the audit
    const screenshotPromise = fetch('/api/screenshot', {
      method: 'POST', headers: getApiHeaders(),
      body: JSON.stringify({ url }),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    // Try Gemini with retry + fallback to Flash Lite
    let geminiResult = '';
    const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    for (let attempt = 0; attempt < geminiModels.length; attempt++) {
      if (attempt > 0) {
        setStep(2, 'active', attempt === 2 ? 'Retrying with Gemini 2.0 Flash…' : 'Retrying Gemini… (attempt ' + (attempt + 1) + ')');
        await new Promise(r => setTimeout(r, 3000));
      }
      try {
        const geminiRes = await fetch('/api/gemini', {
          method: 'POST', headers: getApiHeaders(),
          body: JSON.stringify({ prompt: promptText, model: geminiModels[attempt] }),
        });
        if (!geminiRes.ok) continue;
        const geminiData = await geminiRes.json();
        geminiResult = (geminiData.candidates || [{}])[0]?.content?.parts
          ?.map(p => p.text).join('').trim() || '';
        if (geminiResult) break;
      } catch (e) { continue; }
    }
    if (!geminiResult) throw new Error('Gemini returned empty after 3 attempts — please try again');

    // Collect screenshots (may still be loading)
    const screenshots = await screenshotPromise;
    setStep(2, 'done', 'Gemini audit complete' + (screenshots ? ' + screenshots captured' : ''));

    // Step 3: Claude validate & structure
    setStep(3, 'active', 'Claude validating & structuring findings…');
    progress.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const validatePrompt = 'Extract and structure this website audit response into the JSON schema.\n\n' +
      (client   ? 'CLIENT NAME: ' + client + '\n' : '') +
      (url      ? 'WEBSITE: ' + url + '\n' : '') +
      (industry ? 'INDUSTRY: ' + industry + '\n' : '') +
      (contact  ? 'PREPARED FOR: ' + contact + '\n' : '') +
      '\nGEMINI AUDIT RESPONSE:\n' + geminiResult +
      '\n\nExtract all findings into the JSON schema. Score each category based on the severity of issues found. Rank the top 5 priority actions by business impact. Return ONLY the JSON.';

    const claudeRes = await fetch('/api/messages', {
      method: 'POST', headers: getApiHeaders(),
      body: JSON.stringify({ model: API_MODEL, max_tokens: 8192, system: WSR_VALIDATE_SYSTEM, messages: [{ role: 'user', content: validatePrompt }] })
    });
    if (!claudeRes.ok) throw new Error('Claude validation failed: API ' + claudeRes.status);
    const claudeData = await claudeRes.json();
    let raw = (claudeData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    raw = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
    const jStart = raw.indexOf('{'), jEnd = raw.lastIndexOf('}');
    if (jStart === -1) throw new Error('No JSON found in Claude response — try again');
    const parsed = JSON.parse(raw.slice(jStart, jEnd + 1));

    if (!parsed.client_name && client) parsed.client_name = client;
    if (!parsed.website && url) parsed.website = url;
    if (!parsed.industry && industry) parsed.industry = industry;
    if (!parsed.prepared_for && contact) parsed.prepared_for = contact;
    setStep(3, 'done', 'Findings validated');

    // Step 4: Build report
    setStep(4, 'active', 'Generating report…');
    if (screenshots) parsed._screenshots = screenshots;
    wsrReportHtml = buildWSRReportHTML(parsed);
    document.getElementById('wsr-report-frame').srcdoc = wsrReportHtml;

    // Auto-save to library
    try {
      const clientName = parsed.client_name || client || 'Unknown';
      await saveReport('wsr', clientName, { url, industry, contact }, parsed, wsrReportHtml);
    } catch (e) { console.warn('WSR auto-save failed:', e.message); }

    setStep(4, 'done', 'Report ready!');
    await new Promise(r => setTimeout(r, 800));
    wsrShowStage('2');

  } catch (err) {
    errEl.textContent = '⚠ ' + err.message;
    errEl.style.display = 'block';
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById('wsr-step-' + i);
      if (el.querySelector('.wsr-step-icon').textContent === '◉') setStep(i, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Run Full Audit →';
    // Re-enable the lookup button too
    const lookupBtn = document.getElementById('wsr-lookup-btn');
    if (lookupBtn) { lookupBtn.disabled = false; lookupBtn.textContent = '⟳ Lookup & Run Full Audit'; }
  }
});

// ── WSR Stage 1a: Build Gemini Audit Prompt (local, no API call) ──
document.getElementById('wsr-gen-prompt-btn').addEventListener('click', () => {
  const url      = document.getElementById('wsr-url').value.trim();
  const client   = document.getElementById('wsr-client-name').value.trim();
  const sitemaps = document.getElementById('wsr-sitemaps').value.trim();
  const industry = document.getElementById('wsr-industry').value.trim();
  const contact  = document.getElementById('wsr-contact').value.trim();
  const context  = document.getElementById('wsr-context').value.trim();
  const errEl    = document.getElementById('wsr-build-error');
  if (!url) { errEl.textContent = '\u26A0 Please enter a website URL first.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('wsr-gen-prompt-btn');
  btn.disabled = true;

  // Animate the button while building
  const frames = ['Building prompt \u00b7', 'Building prompt \u00b7\u00b7', 'Building prompt \u00b7\u00b7\u00b7'];
  let fi = 0;
  const anim = setInterval(() => { btn.textContent = frames[fi++ % frames.length]; }, 220);

  // Use setTimeout so the animation frame renders before the sync work runs
  setTimeout(() => {
    try {
      const sitemapLines = sitemaps ? sitemaps.split('\n').map(s => s.trim()).filter(Boolean) : [];

      // Build the audit prompt inline
      const promptText =
        'You are a senior SEO and website audit specialist. Perform a comprehensive website audit ' +
        'for the following site using Google Search grounding to access and read the live pages.\n\n' +
        'WEBSITE TO AUDIT: ' + url + '\n' +
        (client   ? 'CLIENT NAME: ' + client + '\n' : '') +
        (industry ? 'INDUSTRY: ' + industry + '\n' : '') +
        (contact  ? 'CONTACT: ' + contact + '\n' : '') +
        (sitemapLines.length ? '\nSITEMAPS TO CHECK (visit each URL listed):\n' + sitemapLines.join('\n') + '\n' : '') +
        (context  ? '\nKNOWN CONTEXT:\n' + context + '\n' : '') +
        '\nAUDIT INSTRUCTIONS:\n' +
        '1. Visit the homepage and at least 5 key pages (services, location pages, about, contact)\n' +
        '2. If sitemaps are provided, review URL patterns and note any issues\n' +
        '3. Check presence or absence of these schema types: LocalBusiness (or industry-specific subtype like RoofingContractor), Service, FAQPage, AggregateRating, BreadcrumbList, ImageObject, Organization\n' +
        '4. For each schema type: state whether it IS present or IS NOT present — do not guess\n' +
        '5. Evaluate: title tags, meta descriptions, H1/H2 structure, keyword usage, NAP consistency\n' +
        '6. Assess mobile-friendliness, page load signals, image optimization\n' +
        '7. Review content quality: is it specific to this business and location, or templated/generic?\n' +
        '8. Check CTAs, contact forms, click-to-call, trust signals, review displays\n' +
        '9. Assess AI/GEO readiness: answer-optimized headers, entity linking via sameAs, E-E-A-T signals, structured data for AI citation\n' +
        '10. Score each of the 6 categories 0-100 based on CURRENT state — not aspirational\n\n' +
        'CATEGORIES TO SCORE:\n' +
        '  - SEO & Local Search\n' +
        '  - User Experience & Design\n' +
        '  - Performance & Technical\n' +
        '  - Content & Messaging\n' +
        '  - Conversion & Lead Generation\n' +
        '  - AI & GEO Readiness\n\n' +
        'SCORING RULES:\n' +
        '  - Missing schema entirely = max 35 in AI & GEO Readiness\n' +
        '  - Templated/generic location pages = max 45 in SEO & Local Search\n' +
        '  - Be honest — do not inflate scores\n\n' +
        'Report findings in detail. Reference actual page content, exact URLs, and specific schema issues found. ' +
        'Identify the top 5 priority actions ranked by business impact. Do not invent findings.';

      document.getElementById('wsr-prompt-output').value = promptText;
      document.getElementById('wsr-prompt-area').style.display = 'block';
      document.getElementById('wsr-prompt-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch(e) {
      errEl.textContent = '\u26A0 ' + (e.message || 'Unknown error building prompt.');
      errEl.style.display = 'block';
    } finally {
      clearInterval(anim);
      btn.disabled = false;
      btn.textContent = 'Regenerate Prompt \u2192';
    }
  }, 80);
});

document.getElementById('wsr-copy-prompt-btn').addEventListener('click', () => {
  const ta = document.getElementById('wsr-prompt-output');
  ta.select();
  try { document.execCommand('copy'); } catch(e) { navigator.clipboard && navigator.clipboard.writeText(ta.value); }
  const btn = document.getElementById('wsr-copy-prompt-btn');
  btn.textContent = '\u2713 Copied'; btn.style.color = '#22c55e';
  setTimeout(() => { btn.textContent = 'Copy Prompt'; btn.style.color = ''; }, 2000);
});

// ─── Run via Gemini API (one-click) ─────────────────────────────────
document.getElementById('wsr-run-gemini-btn').addEventListener('click', async () => {
  const promptText = document.getElementById('wsr-prompt-output').value.trim();
  if (!promptText) return;

  const btn = document.getElementById('wsr-run-gemini-btn');
  const statusEl = document.getElementById('wsr-gemini-auto-status');
  btn.disabled = true;
  btn.textContent = 'Sending to Gemini…';
  statusEl.style.display = 'block';
  statusEl.textContent = '\u23F3 Sending prompt to Gemini API\u2026 this may take 60\u201390 seconds.';

  try {
    const headers = getApiHeaders();
    let geminiResult = '';

    // Retry up to 3 times on empty result (Gemini search grounding can intermittently return empty)
    // Use gemini-2.5-flash-lite on retry as fallback (2.5-flash sometimes returns empty with heavy search)
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-lite'];
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const wait = attempt * 10;
        const modelLabel = models[attempt] === 'gemini-2.5-flash-lite' ? ' (switching to Gemini Flash Lite)' : '';
        statusEl.textContent = '\u26A0 Gemini returned empty — retrying in ' + wait + 's' + modelLabel + ' (attempt ' + (attempt + 1) + '/3)…';
        statusEl.style.color = '#f59e0b';
        await new Promise(r => setTimeout(r, wait * 1000));
        btn.textContent = 'Retrying Gemini… (' + (attempt + 1) + '/3)';
        statusEl.textContent = '\u23F3 Sending prompt to Gemini API… this may take 60\u201390 seconds.';
        statusEl.style.color = '';
      }

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: promptText, model: models[attempt] }),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = typeof err.error === 'string' ? err.error : (err.error?.message || JSON.stringify(err.error) || 'Gemini API error ' + res.status);
        throw new Error(msg);
      }

      const data = await res.json();
      console.log('[WSR Gemini] attempt', attempt, 'finishReason:', data.candidates?.[0]?.finishReason);

      geminiResult = (data.candidates || [{}])[0]?.content?.parts
        ?.filter(p => p.text)
        .map(p => p.text)
        .join('')
        .trim() || '';

      if (geminiResult) break;
      console.warn('[WSR Gemini] attempt', attempt, 'empty result — keys:', JSON.stringify(data).slice(0, 500));
    }

    if (!geminiResult) {
      throw new Error('Gemini returned empty results after 3 attempts — try pasting manually instead');
    }

    statusEl.textContent = '\u2713 Gemini audit complete \u2014 auto-importing results\u2026';
    statusEl.style.color = '#34d399';

    // Switch to paste stage and auto-fill
    wsrShowStage('1b');
    document.getElementById('wsr-gemini-paste').value = geminiResult;

    // Auto-click import
    setTimeout(() => {
      const importBtn = document.getElementById('wsr-import-btn');
      if (importBtn) importBtn.click();
    }, 500);

  } catch (err) {
    statusEl.textContent = '\u26A0 ' + err.message;
    statusEl.style.color = '#f87171';
  } finally {
    btn.disabled = false;
    btn.textContent = '\u26A1 Run via Gemini API';
  }
});

document.getElementById('wsr-skip-to-paste-btn').addEventListener('click', () => wsrShowStage('1b'));
document.getElementById('wsr-go-paste-btn').addEventListener('click', () => wsrShowStage('1b'));
document.getElementById('wsr-back-1a').addEventListener('click', () => wsrShowStage('1a'));

document.getElementById('wsr-import-btn').addEventListener('click', async () => {
  const paste = document.getElementById('wsr-gemini-paste').value.trim();
  const errEl = document.getElementById('wsr-import-error');
  if (!paste) { errEl.textContent = '\u26A0 Please paste Gemini\u2019s response first.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('wsr-import-btn');
  btn.disabled = true; btn.textContent = 'Processing\u2026';
  const statusEl = document.getElementById('wsr-import-status');
  const statusMsg = document.getElementById('wsr-import-msg');
  statusEl.style.display = 'flex';

  const importStages = ['Extracting SEO findings\u2026', 'Scoring categories\u2026', 'Prioritizing recommendations\u2026', 'Structuring report data\u2026'];
  let ii = 0;
  const iTimer = setInterval(() => { ii = (ii+1) % importStages.length; statusMsg.textContent = importStages[ii]; }, 3000);

  const client  = document.getElementById('wsr-client-name').value.trim();
  const url     = document.getElementById('wsr-url').value.trim();
  const industry= document.getElementById('wsr-industry').value.trim();
  const contact = document.getElementById('wsr-contact').value.trim();

  const validatePrompt = 'Extract and structure this website audit response into the JSON schema.\n\n' +
    (client   ? 'CLIENT NAME: ' + client + '\n' : '') +
    (url      ? 'WEBSITE: ' + url + '\n' : '') +
    (industry ? 'INDUSTRY: ' + industry + '\n' : '') +
    (contact  ? 'PREPARED FOR: ' + contact + '\n' : '') +
    '\nGEMINI AUDIT RESPONSE:\n' + paste +
    '\n\nExtract all findings into the JSON schema. Score each category based on the severity of issues found. Rank the top 5 priority actions by business impact. Return ONLY the JSON.';

  try {
    let res, d;
    for (let retry = 0; retry < 3; retry++) {
      if (retry > 0) await new Promise(r => setTimeout(r, retry * 5000));
      res = await fetch('/api/messages', {
        method: 'POST', headers: getApiHeaders(),
        body: JSON.stringify({ model: API_MODEL, max_tokens: 8192, system: WSR_VALIDATE_SYSTEM, messages: [{ role: 'user', content: validatePrompt }] })
      });
      if (res.ok) break;
      if (res.status === 429 || res.status === 529) continue;
      throw new Error('API ' + res.status);
    }
    clearInterval(iTimer);
    if (!res.ok) throw new Error('API rate limited after retries. Please wait a minute and try again.');
    d = await res.json();
    let raw = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    raw = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start === -1) throw new Error('No JSON found in response. Please try again.');
    const parsed = JSON.parse(raw.slice(start, end + 1));


    if (!parsed.client_name && client) parsed.client_name = client;
    if (!parsed.website && url) parsed.website = url;
    if (!parsed.industry && industry) parsed.industry = industry;
    if (!parsed.prepared_for && contact) parsed.prepared_for = contact;

    wsrReportHtml = buildWSRReportHTML(parsed);
    document.getElementById('wsr-report-frame').srcdoc = wsrReportHtml;
    statusEl.style.display = 'none';
    wsrShowStage('2');

    try {
      const clientName = document.getElementById('wsr-client-name').value || 'Unknown';
      await saveReport('wsr', clientName, {
        url: document.getElementById('wsr-url').value || '',
        industry: document.getElementById('wsr-industry').value || '',
        contact: document.getElementById('wsr-contact').value || '',
      }, parsed, wsrReportHtml);
    } catch (e) { console.warn('Auto-save failed:', e.message); }

  } catch(e) {
    clearInterval(iTimer);
    statusEl.style.display = 'none';
    errEl.textContent = '\u26A0 ' + (e.message || 'Unknown error') + ' — check the paste and try again.';
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Validate & Build Report \u2192';
  }
});

document.getElementById('wsr-back-btn').addEventListener('click', () => wsrShowStage('1b'));

document.getElementById('wsr-download-btn').addEventListener('click', () => {
  if (!wsrReportHtml) return;
  const clientName = document.getElementById('wsr-client-name').value.trim();
  const name = (clientName || 'client').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const today = new Date();
  const mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0'), yy = String(today.getFullYear()).slice(-2);
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(wsrReportHtml);
  a.download = 'efelle-website-audit-' + name + '-' + mm + dd + yy + '.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
});

// ─── Save as PDF ───────────────────────────────────────────────────
document.getElementById('wsr-save-pdf-btn').addEventListener('click', () => {
  if (!wsrReportHtml) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(wsrReportHtml);
  printWindow.document.close();
  printWindow.onload = () => { setTimeout(() => printWindow.print(), 500); };
});

// ─── AI Chat Edit Panel ────────────────────────────────────────────
document.getElementById('wsr-chat-toggle-btn').addEventListener('click', () => {
  const panel = document.getElementById('wsr-chat-panel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  if (panel.style.display === 'flex') document.getElementById('wsr-chat-input').focus();
});

document.getElementById('wsr-chat-send').addEventListener('click', async () => {
  const input = document.getElementById('wsr-chat-input');
  const instruction = input.value.trim();
  if (!instruction || !wsrReportHtml) return;

  const messagesEl = document.getElementById('wsr-chat-messages');
  const sendBtn = document.getElementById('wsr-chat-send');

  // Show user message
  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'background:#374151;border-radius:8px;padding:8px 12px;font-size:12px;color:#e2ddd4;align-self:flex-end;max-width:85%;';
  userMsg.textContent = instruction;
  messagesEl.appendChild(userMsg);
  input.value = '';
  sendBtn.disabled = true;
  sendBtn.textContent = '…';

  const thinkMsg = document.createElement('div');
  thinkMsg.style.cssText = 'background:#252d3d;border-radius:8px;padding:8px 12px;font-size:12px;color:#9ca3af;';
  thinkMsg.textContent = 'Editing report…';
  messagesEl.appendChild(thinkMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are a report editor. The user gives you HTML and an edit instruction.\n\nReturn ONLY a JSON array of find-and-replace operations. Each operation has:\n- "find": the exact text/HTML to find in the document (must be unique enough to match only once)\n- "replace": the replacement text/HTML\n\nExample response:\n[{"find":"$4,500/mo","replace":"$2,850/mo"}]\n\nRules:\n- Return ONLY the JSON array, no explanation, no markdown fences\n- Use the minimum number of replacements needed\n- Match the exact HTML including tags and attributes\n- Keep all styling intact unless the user specifically asks to change it`,
        messages: [{ role: 'user', content: `Here is the current report HTML:\n\n${wsrReportHtml}\n\nEdit instruction: ${instruction}` }]
      })
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const d = await res.json();
    let raw = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    raw = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const ops = JSON.parse(raw);
    let updatedHtml = wsrReportHtml;
    let changeCount = 0;
    for (const op of ops) {
      if (updatedHtml.includes(op.find)) {
        updatedHtml = updatedHtml.replace(op.find, op.replace);
        changeCount++;
      }
    }
    if (changeCount === 0) throw new Error('No matching text found to replace — try being more specific');
    wsrReportHtml = updatedHtml;
    document.getElementById('wsr-report-frame').srcdoc = wsrReportHtml;
    thinkMsg.textContent = `✓ ${changeCount} change(s) applied`;
    thinkMsg.style.color = '#34d399';
  } catch (e) {
    thinkMsg.textContent = '⚠ ' + (e.message || 'Failed to edit');
    thinkMsg.style.color = '#f87171';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});
