import { callAPI, callWithWebSearch, repairJSON, getApiHeaders } from '../core/api.js';
import { API_MODEL, CSP_MODEL } from '../core/state.js';
import { GEMINI_PROMPT_SYSTEM, VALIDATE_SYSTEM, CCA_RESEARCH_SYSTEM, CCA_SECONDARY_SYSTEM, CCA_REVIEWS_SYSTEM, CCA_REPORT_SYSTEM_A, CCA_REPORT_SYSTEM_B, CCA_REPORT_SYSTEM_C, CCA_REPORT_SYSTEM } from '../data/prompts.js';
import { dbg } from '../core/debug.js';
import { writeToFrame } from '../core/utils.js';
import { saveReport } from '../core/reports.js';

function buildCCAReportHTML(d) {
  var P = ['#6366f1','#06b6d4','#8b5cf6','#10b981','#f59e0b','#ec4899'];
  var OG = '#F56300';
  var ci = d.chart_data;
  var meta = d.meta;
  var date = new Date().toLocaleDateString('en-US', {month:'long', year:'numeric'});

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function col(i, isClient) { return isClient ? OG : P[i % P.length]; }

  var revColors = (ci.revenue_bar.labels||[]).map(function(_,i){ return i===ci.revenue_bar.client_index?OG:P[i%P.length]; });
  var traColors = (ci.traffic_bar.labels||[]).map(function(_,i){ return i===ci.traffic_bar.client_index?OG:P[i%P.length]; });
  var budColors = (ci.budget_donut.labels||[]).map(function(_,i){ return i===ci.budget_donut.primary_index?OG:P[i%P.length]; });

  var CSS = '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:"Plus Jakarta Sans",sans-serif;background:#fff;color:#1D1D1F}:root{--black:#1D1D1F;--gray-1:#3A3A3C;--gray-2:#6E6E73;--gray-3:#AEAEB2;--gray-4:#D2D2D7;--gray-5:#F5F5F7;--orange:#F56300}.wrap{max-width:780px;margin:0 auto;background:#fff}.cover{background:#000;background-image:radial-gradient(ellipse at top right,rgba(245,99,0,.25) 0%,#000 60%);padding:36px 64px 32px;display:block;break-after:avoid;page-break-after:avoid}.efelle-logo{display:flex;align-items:center;gap:10px}.logo-mark{width:32px;height:32px;background:#F56300;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0}.logo-word{font-size:15px;color:#fff;font-weight:300}.logo-word strong{font-weight:700}.cover-eyebrow{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#F56300;margin-bottom:16px}.cover-headline{font-size:48px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:16px}.cover-sub{font-size:15px;color:#AEAEB2;margin-bottom:0}.cover-date{font-size:12px;color:#AEAEB2}.cover-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:32px}.cover-info-block h3{font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6E6E73;margin-bottom:8px}.cover-info-block p{font-size:14px;color:#fff;line-height:1.8;margin:0}.section{padding:52px 64px;border-bottom:1px solid var(--gray-4);break-after:page;page-break-after:always}.section:last-of-type{border-bottom:none}.sec-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--orange);margin-bottom:8px}.sec-title{font-size:28px;font-weight:800;color:var(--black);margin:0 0 8px}.sec-intro{font-size:15px;color:var(--gray-2);line-height:1.7;margin-bottom:32px}.card-light{background:var(--gray-5);border-radius:16px;padding:20px 24px;break-inside:avoid;page-break-inside:avoid}.card-dark{background:var(--black);border-radius:16px;padding:20px 24px;color:var(--gray-3);break-inside:avoid;page-break-inside:avoid}.cl{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--orange);margin-bottom:8px;display:block}.ct{font-size:16px;font-weight:700;color:#fff;margin-bottom:8px}.card-dark p{font-size:14px;line-height:1.6}.card-light .cl{color:var(--orange)}.card-light .ct{color:var(--black)}.card-light p{font-size:14px;color:var(--gray-1);line-height:1.6}.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}table{width:100%;border-collapse:collapse;margin:24px 0;font-size:13px}th{background:var(--gray-5);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-2);padding:10px 14px;text-align:left}td{padding:12px 14px;border-bottom:1px solid var(--gray-4);color:var(--gray-1);line-height:1.5}tr.hl td{background:#fff8f4}tr.hl td:first-child{border-left:3px solid var(--orange)}.swot-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sq{background:var(--gray-5);border-radius:12px;padding:18px 20px;break-inside:avoid;page-break-inside:avoid}.sq.s{border-left:4px solid #22c55e}.sq.w{border-left:4px solid #ef4444}.sq.o{border-left:4px solid #3b82f6}.sq.t{border-left:4px solid #f59e0b}.sq-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px}.sq.s .sq-label{color:#22c55e}.sq.w .sq-label{color:#ef4444}.sq.o .sq-label{color:#3b82f6}.sq.t .sq-label{color:#f59e0b}.sq ul{list-style:none}.sq ul li{font-size:13px;color:var(--gray-1);padding:4px 0;border-bottom:1px solid var(--gray-4);line-height:1.5}.sq ul li:last-child{border-bottom:none}.sq ul li::before{content:"\u00b7 ";color:var(--gray-3)}.dig-card{background:var(--gray-5);border-radius:12px;padding:18px 22px;break-inside:avoid;page-break-inside:avoid}.dig-card.client{border:2px solid var(--orange)}.dig-name{font-size:14px;font-weight:700;color:var(--black);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--gray-4)}.dig-row{display:flex;gap:8px;margin-bottom:7px;font-size:13px}.dig-lbl{font-weight:700;color:var(--gray-2);min-width:90px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0}.dig-val{color:var(--gray-1);line-height:1.5}.chart-wrap{margin:24px 0}.c2col{display:grid;grid-template-columns:1fr 1fr;gap:20px}.chart-lbl{font-size:11px;font-weight:700;color:var(--gray-2);text-align:center;margin-bottom:6px;letter-spacing:.06em;text-transform:uppercase}.callout-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:24px 0}.cwin{border-left:4px solid var(--orange);background:#fff8f4;border-radius:0 10px 10px 0;padding:14px 18px}.cwin .cl{color:var(--orange)}.crisk{background:var(--gray-5);border-radius:10px;padding:14px 18px}.crisk .cl{color:var(--gray-2)}.cwin p,.crisk p{font-size:14px;color:var(--gray-1);line-height:1.6}.mini-card{background:var(--gray-5);border-radius:10px;padding:12px 16px}.mini-name{font-size:13px;font-weight:700;color:var(--black);margin-bottom:4px}.mini-sum{font-size:12px;color:var(--gray-2);line-height:1.5}.facts-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 24px}.fact-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--orange);margin-bottom:4px}.fact-val{font-size:14px;color:var(--black);font-weight:500}.kw-section-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gray-2);margin-bottom:10px}.kw-item{background:var(--gray-5);border-radius:10px;padding:12px 14px;margin-bottom:8px;break-inside:avoid;page-break-inside:avoid}.kw-term{font-size:14px;font-weight:700;color:var(--black);margin-bottom:3px}.kw-reason{font-size:12px;color:var(--gray-2);line-height:1.5}.adv-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}.pri-list{list-style:none;margin-bottom:24px}.pri-list li{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-top:1px solid var(--gray-4);font-size:14px;color:var(--gray-1);line-height:1.6;break-inside:avoid;page-break-inside:avoid}.pri-list li:last-child{border-bottom:1px solid var(--gray-4)}.pri-num{font-size:22px;font-weight:800;color:var(--orange);line-height:1;min-width:28px;flex-shrink:0}.closing-para{font-size:15px;color:var(--gray-2);line-height:1.8;margin-top:24px;break-inside:avoid;page-break-inside:avoid}.closing-panel{background:#000;padding:64px;text-align:center;break-inside:avoid;page-break-inside:avoid;break-before:page;page-break-before:always}.closing-panel .efelle-logo{justify-content:center;margin-bottom:28px}.cl-headline{font-size:32px;font-weight:800;color:#fff;margin-bottom:14px;line-height:1.2}.cl-body{font-size:15px;color:#AEAEB2;margin-bottom:0;line-height:1.7;max-width:480px;margin-left:auto;margin-right:auto}.cl-cta{display:inline-block;background:#F56300;color:#fff;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;margin:20px 0 32px}.cl-footer{border-top:1px solid #333;padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#666}@media print{@page{size:letter;margin:0.5in}.cover{break-inside:avoid;page-break-inside:avoid}.section{break-after:page;page-break-after:always}table{break-inside:avoid;page-break-inside:avoid}.chart-wrap{break-inside:avoid;page-break-inside:avoid}.swot-grid{break-inside:avoid;page-break-inside:avoid}.g2{break-inside:avoid;page-break-inside:avoid}.callout-row{break-inside:avoid;page-break-inside:avoid}.adv-cards{break-inside:avoid;page-break-inside:avoid}}';

  function para(text, style) {
    return (text||'').split('\n').filter(Boolean).map(function(p){
      return '<p style="font-size:15px;color:var(--gray-1);line-height:1.8;margin-bottom:14px'+(style?';'+style:'')+'">' + esc(p) + '</p>';
    }).join('');
  }

  function coverPage() {
    var name = esc(meta.company_name||'');
    var geo  = esc((d.cover_info && d.cover_info.geographic_market) || meta.geographic_market || '');
    var ind  = esc((d.cover_info && d.cover_info.industry) || meta.industry || '');
    var svcs = esc((d.cover_info && d.cover_info.primary_services) || '');
    var site = esc((d.cover_info && d.cover_info.website) || '');

    // Build condensed 2-line market summary
    var line1 = [ind, geo].filter(Boolean).join(' \u2013 ');
    var svcParts = svcs ? svcs.split(/[,;]/).map(function(s){ return s.trim(); }).filter(Boolean) : [];
    var line2 = svcParts.length > 1 ? svcParts.slice(0,2).join(' & ') : (svcParts[0] || '');
    var rightCol = line2 ? (line1 + '<br><span style="font-size:12px;color:#AEAEB2;">' + line2 + '</span>') : line1;

    var leftLines = [name, site].filter(Boolean).join('<br>');
    return '<div class="cover">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
    '<div style="margin-bottom:4px;"><svg version="1.1" id="efelle_creative_cca" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 551 275" style="width:110px;height:auto;display:block;" xml:space="preserve"><style type="text/css">.cc0{fill:#F05128;}.cc1{fill:#5A5F63;}</style><g><path class="cc0" d="M103.6,88.8c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7H42.5c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3c0-7.3-1.8-14.6-5.3-21.6C119.3,101.8,112.5,94.3,103.6,88.8z"/><path class="cc0" d="M293.6,88.8c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7h-75.7c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3c0-7.3-1.8-14.6-5.3-21.6C309.3,101.8,302.5,94.3,293.6,88.8z"/><path class="cc0" d="M489,111.2c-4.7-9.4-11.5-16.9-20.4-22.3c-8.8-5.5-18.7-8.2-29.2-8.2c-9.8,0-19,2.4-27.5,7.2c-8.5,4.8-15.3,11.3-20.2,19.6c-4.9,8.2-7.4,17.2-7.4,26.7s2.5,18.5,7.5,26.8c4.9,8.3,11.7,14.9,20.2,19.6c8.4,4.7,17.6,7.1,27.3,7.1c11.9,0,22.8-3.4,32.4-10.2c4.2-3,6.1-4.8,6.1-7.3c0-3.1-2.3-5.4-5.4-5.4c-2.2,0-3.7,1.4-4.3,1.9c-3.6,3.1-8,5.5-13.3,7.4s-10.6,2.8-15.5,2.8c-7.7,0-15-1.9-21.9-5.8c-6.8-3.8-12.3-9.2-16.3-15.8s-6-13.7-6-21.1c0-7.6,2-14.7,6-21.3c4-6.6,9.5-11.9,16.2-15.7c6.7-3.8,14.1-5.7,22-5.7c9.2,0,17.7,2.6,25.3,7.7c6.7,4.5,11.7,10.3,15,17.5c1.3,2.7,2.2,5.3,2.9,7.9c0.3,1.2,0.5,2.4,0.7,3.7h-75.7c-3.7,0-5.7,2.7-5.7,5.4c0,3.2,2.4,5.5,5.7,5.5h80.2c3.9,0,6.6-2.6,6.6-6.3C494.3,125.5,492.5,118.2,489,111.2z"/><path class="cc0" d="M154.6,86.6c2.1-5.7,5.7-10.8,10.7-15.3c4-3.6,8.5-6.3,13.1-8.2c5.2-2.1,10.8-3.1,16.8-3.1c3.9,0,5.9-2.8,5.9-5.5c0-3.1-2.3-5.4-5.4-5.4h-1.3c-7.5,0-14.8,1.5-21.4,4.4c-5.9,2.6-11.5,6.3-16.4,11.2c-5.7,5.5-9.9,11.8-12.4,18.6c-2.4,6.7-3.7,14.9-3.7,24.4V252c0,3.3,2.3,5.7,5.4,5.7s5.4-2.4,5.4-5.7V139.6h44.1c3.3,0,5.7-2.3,5.7-5.4s-2.4-5.4-5.7-5.4h-44.1V110C151.4,100.3,152.5,92.4,154.6,86.6z"/><path class="cc0" d="M337.5,11.9c-3.2,0-5.5,2.4-5.5,5.7v37.1v7.5V182v0.6c0.5,3.6,3.1,5.2,5.5,5.2c2.7,0,5.4-2,5.4-5.7V62.2v-7.5V17.6C343,13.9,340.2,11.9,337.5,11.9z"/><path class="cc0" d="M365.5,11.9c-3.2,0-5.5,2.4-5.5,5.7v37.1v7.5V182v0.6c0.5,3.6,3.1,5.2,5.5,5.2c2.7,0,5.4-2,5.4-5.7V62.2v-7.5V17.6C371,13.9,368.2,11.9,365.5,11.9z"/></g><g><path class="cc1" d="M355.5,238.7l-2.3,1.4c-2-2.7-4.8-4-8.2-4c-2.8,0-5.1,0.9-6.9,2.7s-2.8,4-2.8,6.5c0,1.7,0.4,3.2,1.3,4.7c0.8,1.5,2,2.6,3.5,3.4c1.5,0.8,3.1,1.2,5,1.2c3.4,0,6.1-1.3,8.2-4l2.3,1.5c-1.1,1.6-2.6,2.9-4.4,3.8s-3.9,1.4-6.3,1.4c-3.6,0-6.6-1.1-9-3.4c-2.4-2.3-3.6-5.1-3.6-8.4c0-2.2,0.6-4.3,1.7-6.2s2.6-3.4,4.6-4.4c1.9-1.1,4.1-1.6,6.5-1.6c1.5,0,3,0.2,4.4,0.7s2.6,1.1,3.6,1.8C354,236.6,354.8,237.6,355.5,238.7z"/></g><g><path class="cc1" d="M365.4,234h3v3.3c0.9-1.3,1.8-2.3,2.8-2.9c1-0.7,2-1,3.1-1c0.8,0,1.7,0.3,2.6,0.8l-1.5,2.5c-0.6-0.3-1.1-0.4-1.6-0.4c-1,0-1.9,0.4-2.8,1.2s-1.6,2.1-2.1,3.7c-0.4,1.3-0.5,3.9-0.5,7.9v7.7h-3V234z"/></g><g><path class="cc1" d="M441,234v22.8h-2.9v-3.9c-1.2,1.5-2.6,2.6-4.1,3.4s-3.2,1.1-5,1.1c-3.2,0-6-1.2-8.3-3.5c-2.3-2.3-3.4-5.2-3.4-8.6c0-3.3,1.2-6.1,3.5-8.4c2.3-2.3,5.1-3.5,8.3-3.5c1.9,0,3.6,0.4,5.1,1.2s2.9,2,4,3.6V234H441z M429.3,236.2c-1.6,0-3.1,0.4-4.5,1.2s-2.5,1.9-3.3,3.4s-1.2,3-1.2,4.6s0.4,3.1,1.2,4.6c0.8,1.5,1.9,2.6,3.3,3.4c1.4,0.8,2.9,1.2,4.5,1.2s3.1-0.4,4.6-1.2c1.4-0.8,2.5-1.9,3.3-3.3c0.8-1.4,1.2-2.9,1.2-4.7c0-2.6-0.9-4.9-2.6-6.6C434,237.1,431.8,236.2,429.3,236.2z"/></g><g><path class="cc1" d="M455.6,225.5h2.9v8.5h4.7v2.5h-4.7v20.3h-2.9v-20.3h-4V234h4V225.5z"/></g><g><path class="cc1" d="M474.1,224.6c0.7,0,1.2,0.2,1.7,0.7s0.7,1,0.7,1.7s-0.2,1.2-0.7,1.7s-1,0.7-1.7,0.7s-1.2-0.2-1.7-0.7s-0.7-1-0.7-1.7s0.2-1.2,0.7-1.7S473.4,224.6,474.1,224.6z M472.6,234h2.9v22.8h-2.9V234z"/></g><g><path class="cc1" d="M484.9,234h3.1l7.7,16.7l7.6-16.7h3.1L496,256.8h-0.5L484.9,234z"/></g><path class="cc1" d="M536.7,240.1c-1-2.1-2.5-3.8-4.5-5c-1.9-1.2-4.1-1.9-6.4-1.9c-2.2,0-4.2,0.5-6,1.6c-1.9,1.1-3.3,2.6-4.4,4.4c-1.1,1.9-1.6,3.9-1.6,6s0.5,4.2,1.6,6c1.1,1.9,2.6,3.4,4.4,4.4c1.9,1.1,3.9,1.6,6,1.6c2.6,0,5-0.8,7.1-2.3c0.8-0.6,1.4-1.1,1.4-1.8c0-0.8-0.6-1.4-1.4-1.4c-0.4,0-0.8,0.2-1.1,0.5c-0.8,0.7-1.7,1.2-2.8,1.6c-2.9,1-5.5,0.7-7.9-0.6c-1.5-0.8-2.6-2-3.4-3.4c-0.8-1.4-1.3-3-1.3-4.6c0-1.7,0.4-3.2,1.3-4.7c0.8-1.4,2-2.6,3.4-3.4c1.4-0.8,3-1.2,4.6-1.2c2,0,3.7,0.5,5.3,1.7c1.4,1,2.5,2.3,3.2,3.8c0.3,0.6,0.5,1.2,0.6,1.7c0,0.2,0.1,0.4,0.1,0.6h-16.1c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4h17.3c1,0,1.6-0.6,1.6-1.6C537.8,243.3,537.4,241.7,536.7,240.1z"/><path class="cc1" d="M407.7,240.1c-1-2.1-2.5-3.8-4.5-5c-1.9-1.2-4.1-1.9-6.4-1.9c-2.2,0-4.2,0.5-6,1.6c-1.9,1.1-3.3,2.6-4.4,4.4c-1.1,1.9-1.6,3.9-1.6,6s0.5,4.2,1.6,6c1.1,1.9,2.6,3.4,4.4,4.4c1.9,1.1,3.9,1.6,6,1.6c2.6,0,5-0.8,7.1-2.3c0.8-0.6,1.4-1.1,1.4-1.8c0-0.8-0.6-1.4-1.4-1.4c-0.4,0-0.8,0.2-1.1,0.5c-0.8,0.7-1.7,1.2-2.8,1.6c-2.9,1-5.5,0.7-7.9-0.6c-1.5-0.8-2.6-2-3.4-3.4s-1.3-3-1.3-4.6c0-1.7,0.4-3.2,1.3-4.7c0.8-1.4,2-2.6,3.4-3.4c1.4-0.8,3-1.2,4.6-1.2c2,0,3.7,0.5,5.3,1.7c1.4,1,2.5,2.3,3.2,3.8c0.3,0.6,0.5,1.2,0.6,1.7c0,0.2,0.1,0.4,0.1,0.6h-16.1c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4h17.3c1,0,1.6-0.6,1.6-1.6C408.8,243.3,408.4,241.7,407.7,240.1z"/></svg></div>' +
    '<div class="cover-date" style="font-family:monospace">' + date + '</div>' +
      '</div>' +
      '<div>' +
    '<div class="cover-eyebrow" style="margin-top:50px;">Competitive Analysis &amp; Strategic Marketing Plan</div>' +
    '<div class="cover-headline">' + name + '</div>' +
    '<div class="cover-sub">Strategic market positioning and digital growth roadmap' + (geo ? ' for<br>' + geo : '') + '</div>' +
    '<div class="cover-info-grid">' +
    '<div class="cover-info-block"><h3>Client</h3><p>' + leftLines + '</p></div>' +
          (rightCol ? '<div class="cover-info-block"><h3>Market</h3><p>' + rightCol + '</p></div>' : '') +
    '</div>' +
      '</div>' +
    '</div>';
  }


  d.s1  = d.s1  || { cards: [], narrative: '' };
  d.s2  = d.s2  || { facts: [], narrative: '' };
  d.s3  = d.s3  || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  d.s4  = d.s4  || { intro: '', rows: [] };
  d.s5  = d.s5  || { entities: [] };
  d.s6  = d.s6  || { intro: '', win: '', risk: '', mini_cards: [] };
  d.s7  = d.s7  || { avoid: [], own: [], gaps: [] };
  d.s8  = d.s8  || { intro: '', services: [], lead_gen: '' };
  d.s9  = d.s9  || { channels: [], funnel: [] };
  d.s10 = d.s10 || { rows: [], funnel: [] };
  d.s11 = d.s11 || { advantages: [], priorities: [], closing: '' };

  function section1() {
    var cards = (d.s1.cards||[]).map(function(c){
      return '<div class="card-dark"><span class="cl">'+esc(c.label)+'</span><p>'+esc(c.body)+'</p></div>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 01</div><h2 class="sec-title">Strategic Overview</h2>' +
      '<div class="g2" style="margin-bottom:28px">' + cards + '</div>' + para(d.s1.narrative) + '</div>';
  }

  function section2(noBreak) {
    var facts = (d.s2.facts||[]).map(function(f){
      return '<div><div class="fact-lbl">'+esc(f.label)+'</div><div class="fact-val">'+esc(f.value)+'</div></div>';
    }).join('');
    var disclaimer = '<div style="margin-top:28px;padding:16px 20px;border:1px solid var(--gray-4);border-radius:10px;background:var(--gray-5)">' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-2);margin-bottom:10px">Data Methodology &amp; Disclaimer</div>' +
      '<p style="font-size:12px;color:var(--gray-2);line-height:1.7;margin-bottom:8px"><strong style="color:var(--gray-1)">Revenue Estimates:</strong> Calculated via Headcount Triangulation using a 2026 industry benchmark of $324,000 per employee, adjusted by a digital weighting factor (review velocity and ad spend activity).</p>' +
      '<p style="font-size:12px;color:var(--gray-2);line-height:1.7;margin-bottom:8px"><strong style="color:var(--gray-1)">Traffic Estimates:</strong> Modeled using the Local Search Visibility (LSV) Model \u2014 localized search volumes weighted against Google Map Pack and organic ranking positions, cross-verified with a Review-to-Visit ratio (~400 visitors per review in home services).</p>' +
      '<p style="font-size:12px;color:var(--gray-2);line-height:1.7;margin-bottom:0"><strong style="color:var(--gray-1)">Note:</strong> All figures are informed estimates based on public digital footprints and should be used for strategic benchmarking rather than financial auditing.</p>' +
    '</div>';
    return '<div class="section" style="break-before:avoid;page-break-before:avoid;"><div class="sec-label">Section 02</div><h2 class="sec-title">Company Background</h2>' +
      '<div class="card-light" style="margin-bottom:24px;padding:28px 28px"><div class="facts-grid">' + facts + '</div></div>' +
      para(d.s2.narrative) + disclaimer + '</div>';
  }

  function section3() {
    function quad(cls, label, items) {
      return '<div class="sq '+cls+'"><div class="sq-label">'+label+'</div><ul>'+
        (items||[]).map(function(i){return '<li>'+esc(i)+'</li>';}).join('') +
      '</ul></div>';
    }
    return '<div class="section"><div class="sec-label">Section 03</div><h2 class="sec-title">Visual SWOT Analysis</h2>' +
      '<p class="sec-intro">Internal strengths and weaknesses against external market opportunities and threats.</p>' +
      '<div class="swot-grid">' +
        quad('s','Strengths',d.s3.strengths) + quad('w','Weaknesses',d.s3.weaknesses) +
        quad('o','Opportunities',d.s3.opportunities) + quad('t','Threats',d.s3.threats) +
      '</div></div>';
  }

  function section4() {
    var rows = (d.s4.rows||[]).map(function(r){
      var ncell = r.website
        ? '<a href="'+esc(r.website)+'" target="_blank" style="color:#F56300;text-decoration:none;font-weight:600">'+esc(r.name)+'</a>'
        : esc(r.name);
      return '<tr'+(r.is_client?' class="hl"':'')+'>'+
    '<td>'+ncell+'</td><td>'+esc(r.revenue)+'</td><td>'+esc(r.traffic)+'</td>'+
    '<td style="font-size:11px;vertical-align:top;line-height:1.5;">'+esc(r.strength)+'</td>'+
    '<td style="font-size:11px;vertical-align:top;line-height:1.5;">'+esc(r.weakness)+'</td></tr>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 04</div><h2 class="sec-title">Competitor Landscape</h2>' +
      '<p class="sec-intro">'+esc(d.s4.intro||'')+'</p>' +
      '<table style="font-size:12px;table-layout:fixed;width:100%;"><thead><tr><th style="width:22%">Company</th><th style="width:11%">Est. Revenue</th><th style="width:11%">Monthly Traffic</th><th style="width:28%">Key Strength</th><th style="width:28%">Key Weakness</th></tr></thead>' +
      '<tbody>'+rows+'</tbody></table>' +
      svgHBar('Estimated Annual Revenue', ci.revenue_bar.labels||[], ci.revenue_bar.values||[], ci.revenue_bar.client_index||0, 'rev') +
    '</div>';
  }

  function section5() {
    var dims = [
      {label:'SEO', key:'seo'},
      {label:'UX', key:'ux'},
      {label:'Conversion', key:'conversion'},
      {label:'Content', key:'content'},
      {label:'Advertising', key:'advertising'}
    ];
    var entities = d.s5.entities || [];
    var tables = dims.map(function(dim) {
      var rows = entities.map(function(e) {
        var isClient = e.is_client;
        var nameCell = '<td style="font-weight:700;font-size:12px;white-space:nowrap;width:130px;color:'+(isClient?'var(--orange)':'var(--black)')+'">'+esc(e.name)+'</td>';
        return '<tr'+(isClient?' class="hl"':'')+'>'+nameCell+'<td style="font-size:12px;line-height:1.5;">'+esc(e[dim.key]||'')+'</td></tr>';
      }).join('');
      return '<div style="margin-bottom:20px;break-inside:avoid;page-break-inside:avoid;">'+
        '<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--orange);margin-bottom:6px;">'+dim.label+'</div>'+
        '<table style="margin:0;"><thead><tr><th style="width:130px;">Company</th><th>Assessment</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '</div>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 05</div><h2 class="sec-title">Competitive Digital Analysis</h2>' +
      '<p class="sec-intro">Per-entity breakdown across the five key digital performance dimensions.</p>' +
      tables+'</div>';
  }

  function section6() {
    var minis = (d.s6.mini_cards||[]).map(function(c){
      return '<div class="mini-card"><div class="mini-name">'+esc(c.name)+'</div><div class="mini-sum">'+esc(c.summary)+'</div></div>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 06</div><h2 class="sec-title">Competitive Positioning</h2>' +
      '<p class="sec-intro">'+esc(d.s6.intro||'')+'</p>' +
      '<div class="c2col">' +
    '<div><div class="chart-lbl">Brand Strength vs. Differentiation</div>' + svgBubble('Brand Strength (0-10)', 'Differentiation (0-10)', (ci.positioning_bubble||[]).filter(function(p){return p.label;}).map(function(p){return Object.assign({},p,{x:p.x||1,y:p.y||1});})) + '</div>' +
    '<div><div class="chart-lbl">Online Visibility vs. Reputation</div>' + svgBubble('Online Visibility (0-10)', 'Local Reputation (0-10)', (ci.market_bubble||[]).filter(function(p){return p.label;}).map(function(p){return Object.assign({},p,{x:p.x||1,y:p.y||1});})) + '</div>' +
      '</div>' +
      '<div class="callout-row">' +
    '<div class="cwin"><span class="cl">Where '+esc(meta.company_name)+' Can Win</span><p>'+esc(d.s6.win||'')+'</p></div>' +
    '<div class="crisk"><span class="cl">Risk to Avoid</span><p>'+esc(d.s6.risk||'')+'</p></div>' +
      '</div>' +
      '<div class="g2">'+minis+'</div>' +
    '</div>';
  }

  function section7() {
    var avoidH = (d.s7.avoid||[]).map(function(k){
      return '<div class="kw-item"><div class="kw-term">'+esc(k.term)+'</div><div class="kw-reason">'+esc(k.reason)+'</div></div>';
    }).join('');
    var ownH = (d.s7.own||[]).map(function(k){
      return '<div class="kw-item"><div class="kw-term">'+esc(k.term)+'</div><div class="kw-reason">'+esc(k.reason)+'</div></div>';
    }).join('');
    var gapH = (d.s7.gaps||[]).map(function(g){
      // Split "Keyword: description" or "**Keyword**: description" into headline + body
      var gStr = String(g).replace(/\*\*/g,'');
      var colonIdx = gStr.indexOf(':');
      if (colonIdx > 0 && colonIdx < 60) {
        var hd = gStr.slice(0, colonIdx).trim();
        var bd = gStr.slice(colonIdx + 1).trim();
        return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-4);align-items:flex-start">' +
    '<div style="width:6px;height:6px;border-radius:50%;background:var(--orange);flex-shrink:0;margin-top:6px;"></div>' +
    '<div><div style="font-size:14px;font-weight:700;color:var(--black);margin-bottom:2px">'+esc(hd)+'</div>' +
    '<div style="font-size:13px;color:var(--gray-2);line-height:1.6">'+esc(bd)+'</div></div></div>';
      }
      return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-4);align-items:flex-start">' +
    '<div style="width:6px;height:6px;border-radius:50%;background:var(--orange);flex-shrink:0;margin-top:6px;"></div>' +
    '<div style="font-size:14px;color:var(--gray-1);line-height:1.6">'+esc(g)+'</div></div>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 07</div><h2 class="sec-title">SEO &amp; Keyword Gap Analysis</h2>' +
      svgHBar('Estimated Monthly Website Traffic', ci.traffic_bar.labels||[], ci.traffic_bar.values||[], ci.traffic_bar.client_index||0, '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px">' +
    '<div><div class="kw-section-lbl">High-Competition \u2014 Avoid Near-Term</div>'+avoidH+'</div>' +
    '<div><div class="kw-section-lbl">Strategic Wins \u2014 Own These</div>'+ownH+'</div>' +
      '</div>' +
      (gapH ? '<div style="margin-top:28px"><div class="kw-section-lbl" style="margin-bottom:4px">Content Gap Opportunities</div><div style="border-top:1px solid var(--gray-4)">'+gapH+'</div></div>' : '') +
    '</div>';
  }

  function section8() {
    var svH = (d.s8.services||[]).map(function(s){
      return '<div class="card-light"><span class="cl">'+esc(s.label)+'</span><div class="ct" style="color:var(--black);margin-bottom:6px">'+esc(s.title)+'</div><p>'+esc(s.body)+'</p></div>';
    }).join('');
    var cleanLeadGen = (d.s8.lead_gen || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
    var lgH = cleanLeadGen
      ? '<div class="cwin" style="margin-top:20px"><span class="cl">Lead Generation Tactic</span><p>'+esc(cleanLeadGen)+'</p></div>'
      : '';
    return '<div class="section"><div class="sec-label">Section 08</div><h2 class="sec-title">Service Strategy</h2>' +
      '<p class="sec-intro">'+esc(d.s8.intro||'')+'</p>' +
      '<div class="g2" style="margin-bottom:16px">'+svH+'</div>' +
      lgH +
    '</div>';
  }

  function section9() {
    var chH = (d.s9.channels||[]).map(function(c){
      return '<div class="card-dark"><span class="cl">'+esc(c.name)+'</span>'+
    '<div class="ct" style="font-size:14px;margin-bottom:8px">'+esc(c.campaign_type)+'</div>'+
    '<p style="margin-bottom:8px">'+esc(c.purpose)+'</p>'+
    '<p style="color:var(--orange);font-size:13px">'+esc(c.outcome)+'</p>'+
        (c.budget_note?'<p style="font-size:12px;color:var(--gray-3);margin-top:6px">'+esc(c.budget_note)+'</p>':'')+
      '</div>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 09</div><h2 class="sec-title">Advertising Strategy</h2>' +
      '<p class="sec-intro">Channel-by-channel breakdown of recommended approach, campaign types, and expected outcomes.</p>' +
      '<div class="g2">'+chH+'</div></div>';
  }

  function section10() {

    var _dLabels = ci.budget_donut.labels || [];
    var _dValues = ci.budget_donut.values || [];
    var _dPcts   = ci.budget_donut.pcts   || [];
    var _dTotal  = ci.budget_donut.total  || _dValues.reduce(function(a,b){return a+b;},0) || 1;


    var s10rows = d.s10 && d.s10.rows && d.s10.rows.length ? d.s10.rows : [];
    var trH = _dLabels.map(function(lbl, i) {
      var monthly = '$' + Number(_dValues[i]||0).toLocaleString();
      var pctStr  = (_dPcts[i] !== undefined ? _dPcts[i] : Math.round((_dValues[i]||0) / _dTotal * 100)) + '%';
      var goal    = (s10rows[i]||{}).goal    || '';
      var outcome = (s10rows[i]||{}).outcome || '';
      return '<tr><td><strong>'+esc(lbl)+'</strong></td><td>'+esc(monthly)+'</td><td>'+esc(pctStr)+'</td><td>'+esc(goal)+'</td><td>'+esc(outcome)+'</td></tr>';
    }).join('');
    var fnH = (d.s9.funnel||[]).map(function(f){
      return '<div class="card-dark"><span class="cl">'+esc(f.stage)+'</span>'+
    '<div style="font-size:13px;color:#fff;font-weight:600;margin-bottom:4px">'+esc(f.channels)+'</div>'+
    '<div style="font-size:13px">'+esc(f.budget)+'</div></div>';
    }).join('');
    var totalBudget = (ci.budget_donut.values||[]).reduce(function(a,b){return a+b;},0);
    var totalBudgetStr = totalBudget ? '$' + Number(totalBudget).toLocaleString() + '/mo suggested total' : '';
    return '<div class="section"><div class="sec-label">Section 10</div><h2 class="sec-title">Budget Allocation Model</h2>' +
      (totalBudgetStr ? '<div style="display:inline-block;background:#fff8f4;border:1px solid rgba(245,99,0,0.25);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;color:var(--orange);margin-bottom:4px">' + esc(totalBudgetStr) + '</div>' : '') +
      svgDonut(ci.budget_donut.labels||[], ci.budget_donut.values||[], budColors, ci.budget_donut) +
      '<table><thead><tr><th>Channel</th><th>Monthly</th><th>% of Total</th><th>Primary Goal</th><th>Expected Outcome</th></tr></thead>' +
      '<tbody>'+trH+'</tbody></table>' +
      '<div class="g4" style="margin-top:24px">'+fnH+'</div>' +
    '</div>';
  }

  function section11() {
    var advH = (d.s11.advantages||[]).map(function(a){
      return '<div class="card-light"><span class="cl">'+esc(a.label)+'</span><div class="ct" style="color:var(--black);margin-bottom:6px">'+esc(a.title)+'</div><p>'+esc(a.body)+'</p></div>';
    }).join('');
    var priH = (d.s11.priorities||[]).map(function(p,i){
      return '<li><span class="pri-num">0'+(i+1)+'</span><span>'+esc(p)+'</span></li>';
    }).join('');
    return '<div class="section"><div class="sec-label">Section 11</div><h2 class="sec-title">Key Advantages</h2>' +
      '<div class="adv-cards">'+advH+'</div>' +
      (priH ? '<h3 style="font-size:20px;font-weight:800;color:var(--black);margin:36px 0 16px;padding-top:32px;border-top:1px solid var(--gray-4)">Next Steps</h3>' +
      '<ul class="pri-list">'+priH+'</ul>' : '') +
      '<p class="closing-para">'+esc(d.s11.closing||'')+'</p>' +
    '</div>';
  }

  function closingPanel() {
    var hu = esc(meta.hubspot_url||'https://meetings-na2.hubspot.com/fred29');
    return '<div class="closing-panel">' +
      '<div class="cl-headline">Ready to outpace<br>your competitors?</div>' +
      '<p class="cl-body">Let\'s build a plan together. Schedule a strategy session with the efelle team to turn these insights into results.</p>' +
      '<a class="cl-cta" href="'+hu+'" target="_blank">Schedule Your Strategy Call</a>' +
      '<div class="cl-footer">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:22px;height:22px;background:#F56300;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">e</div>' +
        '<span style="color:#aaa;font-size:13px;"><strong style="color:#ddd;">efelle</strong> creative</span>' +
      '</div>' +
      '<span>efelle.com</span><span>206.384.4909</span>' +
      '</div></div>';
  }


  function svgHBar(title, labels, values, clientIdx, prefix) {
    prefix = prefix || '';
    var maxVal = Math.max.apply(null, values.map(function(v){ return Math.abs(v) || 0; })) || 1;
    var barMaxW = 380;
    var labelW = 160;
    var rowH = 36;
    var pad = 16;
    var svgH = labels.length * rowH + pad * 2;
    var rows = labels.map(function(lbl, i) {
      var isClient = i === clientIdx;
      var color = isClient ? OG : P[i % P.length];
      var w = Math.round((Math.abs(values[i] || 0) / maxVal) * barMaxW);
      w = Math.max(w, 4);
      var y = pad + i * rowH;
      var cy = y + rowH / 2;
      var v = values[i];
      var displayVal;
      if (v === 0 || v === undefined) {
        displayVal = '\u2014';
      } else if (prefix === 'rev') {

        var dollars = Math.round(v * 1000000);
        displayVal = '$' + dollars.toLocaleString();
      } else {
        displayVal = (prefix||'') + (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, {maximumFractionDigits:1}));
      }
      return '<text x="' + (labelW - 8) + '" y="' + (cy + 4) + '" font-size="12" fill="' + (isClient ? OG : '#3A3A3C') + '" font-weight="' + (isClient ? '700' : '600') + '" text-anchor="end" font-family="Plus Jakarta Sans, sans-serif">' + esc(lbl) + '</text>' +
    '<rect x="' + labelW + '" y="' + (cy - 10) + '" width="' + w + '" height="20" fill="' + color + '" rx="3"/>' +
    '<text x="' + (labelW + w + 6) + '" y="' + (cy + 4) + '" font-size="12" fill="' + (isClient ? OG : '#6E6E73') + '" font-weight="' + (isClient ? '700' : '400') + '" font-family="Plus Jakarta Sans, sans-serif">' + displayVal + '</text>';
    }).join('');
    var svgW = labelW + barMaxW + 80;
    return '<div style="margin:28px 0;background:var(--gray-5);border-radius:12px;padding:20px 24px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray-2);margin-bottom:16px">' + esc(title) + '</div>' +
      '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;height:auto">' + rows + '</svg>' +
      '</div>';
  }


  function svgBubble(xLabel, yLabel, points) {
    var W = 500, H = 380, lm = 50, rm = 30, tm = 30, bm = 50;
    var pw = W - lm - rm, ph = H - tm - bm;
    function px(v) { return lm + (v / 10) * pw; }
    function py(v) { return tm + ph - (v / 10) * ph; }

    var grid = '';
    for (var g = 0; g <= 10; g += 2) {
      grid += '<line x1="' + px(g) + '" y1="' + tm + '" x2="' + px(g) + '" y2="' + (tm+ph) + '" stroke="#D2D2D7" stroke-width="1"/>';
      grid += '<line x1="' + lm + '" y1="' + py(g) + '" x2="' + (lm+pw) + '" y2="' + py(g) + '" stroke="#D2D2D7" stroke-width="1"/>';
    }

    grid += '<line x1="' + px(5) + '" y1="' + tm + '" x2="' + px(5) + '" y2="' + (tm+ph) + '" stroke="#AEAEB2" stroke-width="1" stroke-dasharray="4 4"/>';
    grid += '<line x1="' + lm + '" y1="' + py(5) + '" x2="' + (lm+pw) + '" y2="' + py(5) + '" stroke="#AEAEB2" stroke-width="1" stroke-dasharray="4 4"/>';

    grid += '<line x1="' + lm + '" y1="' + (tm+ph) + '" x2="' + (lm+pw) + '" y2="' + (tm+ph) + '" stroke="#D2D2D7" stroke-width="1"/>';
    grid += '<line x1="' + lm + '" y1="' + tm + '" x2="' + lm + '" y2="' + (tm+ph) + '" stroke="#D2D2D7" stroke-width="1"/>';

    grid += '<text x="' + (W/2) + '" y="' + (H-8) + '" font-size="12" fill="#3A3A3C" font-weight="700" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif">' + esc(xLabel) + '</text>';
    grid += '<text x="14" y="' + (H/2) + '" font-size="12" fill="#3A3A3C" font-weight="700" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" transform="rotate(-90 14 ' + (H/2) + ')">' + esc(yLabel) + '</text>';

    var dots = points.map(function(pt, i) {
      var color = pt.is_client ? OG : P[i % P.length];
      var r = Math.max(14, Math.min(28, pt.r || 18));
      var cx2 = px(pt.x || 5), cy2 = py(pt.y || 5);
      var shortLbl = (pt.label || '').split(' ')[0];
      return '<circle cx="' + cx2 + '" cy="' + cy2 + '" r="' + r + '" fill="' + color + '" opacity="0.88"/>' +
    '<text x="' + cx2 + '" y="' + (cy2 + 4) + '" font-size="10" fill="#fff" font-weight="700" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif">' + esc(shortLbl) + '</text>';
    }).join('');

    var legend = '<div style="display:flex;flex-wrap:wrap;gap:12px 20px;margin-top:12px;">' +
      points.map(function(pt, i) {
        var color = pt.is_client ? OG : P[i % P.length];
        return '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gray-1);font-family:Plus Jakarta Sans,sans-serif">' +
    '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';flex-shrink:0;"></div>' + esc(pt.label) + '</div>';
      }).join('') + '</div>';
    return '<div style="margin:28px 0;background:var(--gray-5);border-radius:12px;padding:20px 24px">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;border:1px solid var(--gray-4);border-radius:8px;background:#fff">' +
        grid + dots +
      '</svg>' + legend + '</div>';
  }


  function svgDonut(labels, values, colors, params) {
    var total = values.reduce(function(a,b){ return a+(b||0); }, 0) || 1;
    var R = 80, cx2 = 130, cy2 = 110, iR = 50;
    var slices = '';
    var angle = -Math.PI / 2;
    values.forEach(function(v, i) {
      var sweep = (v / total) * 2 * Math.PI;
      var x1 = cx2 + R * Math.cos(angle), y1 = cy2 + R * Math.sin(angle);
      var x2 = cx2 + R * Math.cos(angle + sweep), y2 = cy2 + R * Math.sin(angle + sweep);
      var ix1 = cx2 + iR * Math.cos(angle), iy1 = cy2 + iR * Math.sin(angle);
      var ix2 = cx2 + iR * Math.cos(angle + sweep), iy2 = cy2 + iR * Math.sin(angle + sweep);
      var large = sweep > Math.PI ? 1 : 0;
      slices += '<path d="M ' + ix1 + ' ' + iy1 + ' L ' + x1 + ' ' + y1 + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' L ' + ix2 + ' ' + iy2 + ' A ' + iR + ' ' + iR + ' 0 ' + large + ' 0 ' + ix1 + ' ' + iy1 + ' Z" fill="' + colors[i % colors.length] + '" stroke="#fff" stroke-width="2"/>';
      angle += sweep;
    });

    var legendItems = labels.map(function(lbl, i) {

      var pct = (params && params.pcts && params.pcts[i] !== undefined)
        ? params.pcts[i]
        : Math.round((values[i] || 0) / total * 100);
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;font-family:Plus Jakarta Sans,sans-serif;color:var(--gray-1)">' +
    '<div style="width:12px;height:12px;border-radius:3px;background:' + colors[i % colors.length] + ';flex-shrink:0;"></div>' +
    '<span>' + esc(lbl) + '</span>' +
    '<span style="margin-left:auto;font-weight:700;color:var(--black)">' + pct + '%</span>' +
    '</div>';
    }).join('');
    return '<div style="margin:28px 0;background:var(--gray-5);border-radius:12px;padding:20px 24px">' +
      '<div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap">' +
    '<svg viewBox="0 0 260 220" style="width:220px;height:auto;flex-shrink:0"><rect width="260" height="220" fill="none"/>' + slices + '</svg>' +
    '<div style="flex:1;min-width:160px">' + legendItems + '</div>' +
      '</div></div>';
  }

  function chartScript() { return ''; }

  return '<!DOCTYPE html><html lang="en"><head>'+
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(meta.company_name||'')+' \u2014 Client Strategy Builder \u2014 efelle creative</title>'+
    '<link rel="preconnect" href="https://fonts.googleapis.com">'+
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">'+
    '<style>'+CSS+'</style>'+
    '</head><body><div class="wrap">'+
    coverPage()+section2(true)+section1()+section3()+section4()+section5()+
    section6()+section7()+section8()+section10()+section9()+section11()+closingPanel()+
    '</div>'+chartScript()+'</body></html>';
}

let ccaData = {
  company_name:'', industry:'', primary_services:'', geographic_market:'',
  positioning_summary:'', key_differentiators:'', target_audiences:'',
  estimated_revenue:'', estimated_traffic:'', ad_spend:'', ad_channels:'',
  known_weaknesses:'', meeting_notes:'',
  competitors:[]
};

// Expose ccaData globally so CAP engine can read it
window.ccaData = ccaData;

let ccaReportHtml = '';

async function callCCAResearch(url, suppliedCompetitorUrls) {
  const hasSupplied = suppliedCompetitorUrls && suppliedCompetitorUrls.length > 0;
  const competitorInstruction = hasSupplied
    ? `3. Research THESE specific competitor URLs (provided by the client) \u2014 do not search for additional competitors:\n${suppliedCompetitorUrls.map((u,i) => `   ${i+1}. ${u}`).join('\n')}`
    : `3. Find 3 direct competitors in the same geographic market and service category`;
  const prompt = `Research this company and return competitor data for URL: ${url}

Search for:
1. What this company sells or does (based on their domain/URL)
2. Their main products or services and target market
${competitorInstruction}

Do NOT look up review counts \u2014 that happens separately. Return ONLY valid JSON as specified in the system prompt. No preamble, no markdown fences.`;
  return await callWithWebSearch(CCA_RESEARCH_SYSTEM, prompt, 4000, (msg, state) => addCCAStatus(msg, state));
}

let _ccaHeartbeat = null;
let _ccaStartTime = null;

function setCCALoading(on, msg) {

  const dots = document.getElementById('cca-dots');
  if (dots) dots.style.display = on ? 'flex' : 'none';
  const log = document.getElementById('cca-status-log');
  if (log) {
    if (on) {
      log.innerHTML = '';
      log.style.display = 'block';
      if (msg) addCCAStatus(msg, 'info');
      _ccaStartTime = Date.now();
      const hbRow = document.createElement('div');
      hbRow.id = 'cca-heartbeat';
      hbRow.style.cssText = 'font-size:10px; font-family:monospace; color:#1f2535; margin-top:8px; padding-top:8px; border-top:1px solid #1a1f2e;';
      hbRow.textContent = 'elapsed: 0s';
      log.appendChild(hbRow);
      _ccaHeartbeat = setInterval(() => {
        const el = document.getElementById('cca-heartbeat');
        if (el) el.textContent = 'elapsed: ' + Math.round((Date.now() - _ccaStartTime) / 1000) + 's';
      }, 1000);
    } else {
      if (_ccaHeartbeat) { clearInterval(_ccaHeartbeat); _ccaHeartbeat = null; }
      log.style.display = 'none';
      log.innerHTML = '';
    }
  } else {
    if (!on && _ccaHeartbeat) { clearInterval(_ccaHeartbeat); _ccaHeartbeat = null; }
  }
  const researchBtn = document.getElementById('cca-research-btn');
  if (researchBtn) researchBtn.disabled = on;
}

function addCCAStatus(msg, state) {
  // state: 'info' | 'searching' | 'done' | 'building'
  const log = document.getElementById('cca-status-log');
  if (!log) return;
  // Mark any current 'searching' row as done
  if (state === 'searching') {
    log.querySelectorAll('[data-state="searching"]').forEach(el => {
      el.dataset.state = 'done';
      const icon = el.querySelector('.cca-status-icon');
      if (icon) { icon.textContent = '\u2713'; icon.style.color = '#a78bfa'; }
      el.style.opacity = '0.55';
    });
  }
  const row = document.createElement('div');
  row.dataset.state = state;
  row.style.cssText = 'display:flex; align-items:flex-start; gap:8px; padding:5px 0; font-size:11px; font-family:monospace; transition:opacity 0.3s;';

  const iconMap = { info: '\u00b7', searching: '\u203a', done: '\u2713', building: '\u00b7' };
  const colorMap = { info: '#374151', searching: '#a78bfa', done: '#a78bfa', building: '#374151' };

  const icon = document.createElement('span');
  icon.className = 'cca-status-icon';
  icon.textContent = iconMap[state] || '\u00b7';
  icon.style.cssText = `color:${colorMap[state]}; font-size:13px; line-height:1.4; flex-shrink:0; font-weight:700;`;

  const text = document.createElement('span');
  text.textContent = msg;
  text.style.cssText = `color:${state === 'searching' ? '#9ca3af' : '#374151'}; line-height:1.4;`;

  row.appendChild(icon);
  row.appendChild(text);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

function populateStage2() {
  const fields = ['company_name','industry','primary_services','geographic_market',
    'positioning_summary','key_differentiators','target_audiences','estimated_revenue',
    'estimated_traffic','ad_spend','ad_channels','known_weaknesses','platform'];
  fields.forEach(k => {
    const el = document.getElementById('cd-' + k);
    if (el) el.value = ccaData[k] || '';
  });
  const s2titleEl = document.getElementById('cca-s2-company-name');
  if (s2titleEl) s2titleEl.textContent = ccaData.company_name || 'Review & Enrich';
  renderCompetitors();
}

function renderCompetitors() {
  const list = document.getElementById('cca-competitors-list');
  list.innerHTML = '';
  ccaData.competitors.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'cca-comp-card';
    card.innerHTML = `
      <div class="cca-comp-header">
        <span class="cca-comp-label">Competitor ${i+1}</span>
        <button class="cca-comp-remove" data-i="${i}">\u00d7</button>
      </div>
      <div class="form-grid-2">
        <div class="field"><label class="field-label">Name</label><input type="text" data-key="name" data-i="${i}" value="${c.name||''}" /></div>
        <div class="field"><label class="field-label">Website</label><input type="text" data-key="website" data-i="${i}" value="${c.website||''}" /></div>
        <div class="field"><label class="field-label">Est. Revenue</label><input type="text" data-key="est_revenue" data-i="${i}" value="${c.est_revenue||''}" /></div>
        <div class="field"><label class="field-label">Est. Traffic</label><input type="text" data-key="est_traffic" data-i="${i}" value="${c.est_traffic||''}" /></div>
        <div class="field"><label class="field-label">Review Count</label><input type="text" data-key="review_count" data-i="${i}" value="${c.review_count||''}" placeholder="e.g. 74 (Birdeye/Google)" /></div>
        <div class="field"><label class="field-label">Review Source</label><input type="text" data-key="review_source" data-i="${i}" value="${c.review_source||''}" placeholder="e.g. Birdeye, Yelp, company site" /></div>
        <div class="field"><label class="field-label">Key Strength</label><input type="text" data-key="key_strength" data-i="${i}" value="${c.key_strength||''}" /></div>
        <div class="field"><label class="field-label">Key Weakness</label><input type="text" data-key="key_weakness" data-i="${i}" value="${c.key_weakness||''}" /></div>
        <div class="field"><label class="field-label">Status / Notes</label><input type="text" data-key="status" data-i="${i}" value="${c.status||''}" placeholder="e.g. active, potentially out of business" /></div>
        <div class="field"><label class="field-label">Positioning</label><input type="text" data-key="positioning" data-i="${i}" value="${c.positioning||''}" /></div>
        <div class="field col-span-2"><label class="field-label">Serves Same Market</label><input type="text" data-key="serves_same_market" data-i="${i}" value="${c.serves_same_market||''}" placeholder="true/false \u2014 with explanation" /></div>
      </div>`;

    card.querySelector('.cca-comp-remove').addEventListener('click', () => {
      ccaData.competitors.splice(i, 1);
      renderCompetitors();
    });

    card.querySelectorAll('input[data-key]').forEach(inp => {
      inp.addEventListener('input', () => {
        ccaData.competitors[+inp.dataset.i][inp.dataset.key] = inp.value;
      });
    });
    list.appendChild(card);
  });
}

function collectStage2() {
  const fields = ['company_name','industry','primary_services','geographic_market',
    'positioning_summary','key_differentiators','target_audiences','estimated_revenue',
    'estimated_traffic','ad_spend','ad_channels','known_weaknesses','platform'];
  fields.forEach(k => {
    const el = document.getElementById('cd-' + k);
    if (el) ccaData[k] = el.value;
  });
  ccaData.meeting_notes = document.getElementById('cd-meeting_notes').value || '';
}

function showCCAStage(n) {
  const s1a = document.getElementById('cca-stage-1a');
  const s1b = document.getElementById('cca-stage-1b');
  if (s1a) s1a.style.display = n === 1 ? 'block' : 'none';
  if (s1b) s1b.style.display = 'none';
  document.getElementById('cca-stage-2').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('cca-stage-3').style.display = n === 3 ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function callCCAReviews(competitors) {
  const list = competitors.map((c, i) => `${i+1}. ${c.name} (${c.website})`).join('\n');
  const prompt = `Find Google/Yelp review counts for these competitors:\n${list}\n\nReturn ONLY the JSON array as specified in the system prompt.`;
  const raw = await callWithWebSearch(CCA_REVIEWS_SYSTEM, prompt, 1000, (msg, state) => {
    const el = document.getElementById('cca-reviews-status');
    if (!el) return;
    if (state === 'searching') {
      el.textContent = '\u27F3 ' + msg;
    } else if (state === 'building') {
      el.textContent = '\u2713 Review data fetched \u2014 updating fields\u2026';
      el.style.color = '#a78bfa';
    }
  });
  let clean = raw.replace(/\x60{3}json|\x60{3}/g, '').trim();
  const arrStart = clean.indexOf('[');
  const arrEnd = clean.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1) clean = clean.slice(arrStart, arrEnd + 1);
  return JSON.parse(clean);
}

function setCCACompMode(mode) {}

// Attach to window
window.showCCAStage = showCCAStage;
window.setCCACompMode = setCCACompMode;
window.renderCompetitors = renderCompetitors;
window.populateStage2 = populateStage2;
window.collectStage2 = collectStage2;

// ── CCA Loading HTML builder (hoisted for use by both generate and secondary listeners) ──
const statusStages = [
  { label: 'Company profile',         detail: 'Reading market position, services, and differentiators\u2026' },
  { label: 'Competitive landscape',   detail: 'Mapping competitors, strengths, and positioning gaps\u2026' },
  { label: 'SWOT analysis',           detail: 'Identifying key opportunities and threats\u2026' },
  { label: 'Digital presence audit',  detail: 'Running SEO, UX, and conversion gap analysis\u2026' },
  { label: 'Advertising strategy',    detail: 'Modeling ad channels, budget, and keyword gaps\u2026' },
  { label: 'Growth plan',             detail: 'Building service strategy and lead generation roadmap\u2026' },
  { label: 'Assembling report',       detail: 'Compiling all sections into final JSON\u2026' },
];

function makeCCALoadingHTML(activeIdx) {
  const stepsHtml = statusStages.map((s, i) => {
    const done = i < activeIdx;
    const active = i === activeIdx;
    const color = done ? '#34d399' : active ? '#a78bfa' : '#1f2535';
    const textColor = done ? '#34d399' : active ? '#e2ddd4' : '#374151';
    const detailColor = active ? '#a78bfa' : '#1f2535';
    let iconEl;
    if (done) {
      iconEl = '<div style="width:18px;height:18px;border-radius:50%;background:rgba(52,211,153,0.15);border:1px solid #34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;font-size:10px;color:#6b7a94;">\u2713</div>';
    } else if (active) {
      iconEl = '<div style="width:18px;height:18px;border-radius:50%;background:rgba(167,139,250,0.15);border-top:2px solid #a78bfa;border-right:2px solid transparent;border-bottom:2px solid transparent;border-left:2px solid transparent;flex-shrink:0;margin-top:1px;animation:cca-spin 0.8s linear infinite;"></div>';
    } else {
      iconEl = '<div style="width:18px;height:18px;border-radius:50%;background:#141820;border:1px solid #1f2535;flex-shrink:0;margin-top:1px;"></div>';
    }
    return '<div style="display:flex;align-items:flex-start;gap:12px;padding:5px 0;">' + iconEl +
  '<div>' +
  '<div style="font-size:12px;font-weight:600;color:' + textColor + ';font-family:monospace;letter-spacing:0.04em;">' + s.label + '</div>' +
      (active ? '<div style="font-size:11px;color:' + detailColor + ';font-family:monospace;margin-top:2px;">' + s.detail + '</div>' : '') +
  '</div></div>';
  }).join('');

  return '<!DOCTYPE html><html><head><style>' +
    '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap");' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{background:#0c0f16;display:flex;align-items:flex-start;justify-content:center;padding-top:80px;min-height:100vh;font-family:"Plus Jakarta Sans",monospace;}' +
    '.wrap{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:380px;text-align:left;padding:0 24px 24px;width:100%}' +
    '.logo{display:flex;align-items:center;gap:10px;margin-bottom:4px;align-self:center}' +
    '.logo-mark{width:32px;height:32px;background:#F56300;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}' +
    '.logo-word{font-size:14px;color:#9ca3af;font-weight:300}.logo-word strong{font-weight:700;color:#e2ddd4}' +
    '.headline{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#F56300;align-self:center;font-family:monospace;margin-bottom:4px;}' +
    '.steps{width:100%;border:1px solid #1a1f2e;border-radius:10px;padding:12px 16px;background:#0e1118;margin-top:25px}' +
    '.sub{font-size:11px;color:#374151;line-height:1.6;align-self:center;font-family:monospace}' +
    '@keyframes cca-spin{to{transform:rotate(360deg)}}' +
  '</style></head><body>' +
  '<div class="wrap">' +
    '<div class="headline">Creating Strategy &amp; Building Report</div>' +
    '<div class="steps">' + stepsHtml + '</div>' +
    '<div class="sub">This typically takes 45\u201390 seconds.</div>' +
  '</div></body></html>';
}

// ── Event Listeners ──

document.getElementById('cca-add-comp-url-btn').addEventListener('click', () => {
  const fields = document.getElementById('cca-comp-url-fields');
  const inputs = fields.querySelectorAll('.cca-comp-url-input');
  if (inputs.length >= 4) return;
  const div = document.createElement('div');
  div.className = 'field';
  div.innerHTML = '<input type="url" class="cca-comp-url-input" placeholder="https://www.competitor' + (inputs.length + 1) + '.com" />';
  fields.appendChild(div);
  if (inputs.length + 1 >= 4) document.getElementById('cca-add-comp-url-btn').style.display = 'none';
});

document.getElementById('cca-build-prompt-btn').addEventListener('click', async () => {
  const url = document.getElementById('cca-url-input').value.trim();
  const clientNameVal = document.getElementById('cca-client-name').value.trim();
  const errEl = document.getElementById('cca-build-error');
  if (!url) { errEl.textContent = '\u26A0 Please enter a prospect URL.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('cca-build-prompt-btn');
  btn.disabled = true; btn.textContent = 'Building\u2026';
  const buildStatus = document.getElementById('cca-build-status');
  const buildStatusMsg = document.getElementById('cca-build-status-msg');
  const buildFill = document.getElementById('cca-build-progress-fill');
  buildStatus.style.display = 'block';
  buildStatusMsg.textContent = 'Building research prompt\u2026';
  buildFill.style.width = '60%';
  // Small delay so the progress bar renders before the sync work
  await new Promise(r => setTimeout(r, 50));

  const compUrls = Array.from(document.querySelectorAll('.cca-comp-url-input')).map(i => i.value.trim()).filter(Boolean);
  const known = document.getElementById('cca-known-context').value.trim();

  try {
    // Fetch the actual website content so Gemini has ground truth
    buildStatusMsg.textContent = 'Fetching prospect website\u2026';
    let siteContent = '';
    try {
      const headers = getApiHeaders();
      const fetchRes = await fetch('/api/fetch-url', {
        method: 'POST', headers,
        body: JSON.stringify({ url }),
      });
      if (fetchRes.ok) {
        const fetchData = await fetchRes.json();
        siteContent = fetchData.text || '';
      }
    } catch (e) { console.warn('Could not fetch prospect site:', e.message); }
    buildStatusMsg.textContent = 'Building research prompt\u2026';
    buildFill.style.width = '80%';

    // Build the Gemini research prompt
    const compSection = compUrls.length
      ? compUrls.map((u, i) => `${i+1}. Visit ${u} \u2014 confirm they operate in the same city/region as the prospect, then collect all data fields below.`).join('\n')
      : '\u2014 Find 3 direct local competitors operating in the same city/metro as the prospect. Search "[service] [client city]". Reject national chains, franchises, or companies based in other states with no verified local office.';

    const domain = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/, '');
    const promptText = `RESEARCH TASK \u2014 efelle creative prospect analysis
${clientNameVal ? 'CLIENT: ' + clientNameVal : ''}
PROSPECT URL: ${url}
${known ? 'CONTEXT: ' + known : ''}

${siteContent ? `=== ACTUAL WEBSITE CONTENT FROM ${url} ===
The following is the actual extracted text from the prospect's website. Use this as your PRIMARY source of truth for company name, location, services, and positioning. Do NOT override this with data from other companies.

${siteContent.slice(0, 8000)}
=== END WEBSITE CONTENT ===

` : ''}CRITICAL: This research is about the SPECIFIC company at ${url} (domain: ${domain}). There may be multiple companies with similar names in different states \u2014 you MUST use the website content above as ground truth for company identity, location, and services. If Google search results return data about a different company with a similar name in a different city/state, DISCARD that data entirely. When searching for revenue, reviews, or employee data, always include "${domain}" in your search queries to disambiguate.

Follow every step in order. Do not skip steps. Cite every data point with its source.

STEP 1 \u2014 GEO LOCK (do this first):
Visit ${url} directly. From the ACTUAL PAGE CONTENT of ${url} only \u2014 not from Google search results about similarly-named companies \u2014 identify the exact city, state, and service area. Look for: physical address in footer or contact page, phone area code, city mentions in body copy, service area pages. Record this as MARKET: [city, state]. If the website mentions multiple states or regions, record ALL of them. Do not proceed until MARKET is confirmed from the actual website content.

STEP 2 \u2014 PROSPECT DEEP DIVE:
Visit ${url} and collect:
- Primary services offered
- Key differentiators and positioning
- Google Business Profile: review count, star rating, reviews in last 12 months
- Employee count (check LinkedIn and About/Team page)
- Year founded
- Ad activity: check Meta Ad Library and Google Ads Transparency Center
- Website platform/CMS if detectable
- Known weaknesses or gaps

STEP 3 \u2014 REVENUE ESTIMATE (search for real data first):
a. Search Google for "${url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/, '')} annual revenue" and "${clientNameVal || '[company name]'} annual revenue ${url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/, '')}"
b. Check business data sources: ZoomInfo, RocketReach, Glassdoor, Owler, LinkedIn, Dun & Bradstreet, BBB, and state contractor license databases. IMPORTANT: verify the ZoomInfo/RocketReach listing matches THIS company's website domain, not a different company with a similar name.
c. If a trusted source provides a revenue figure or range (e.g. ZoomInfo "<$5M", Glassdoor "$10M-$50M"), use that as the primary estimate and cite the source URL
d. ONLY if no online source is found: fall back to employee headcount formula: [Headcount] \u00d7 $324,000 = Base Revenue Estimate. Clearly label this as "formula-based estimate" with low confidence
e. Record the source and method used, e.g. "ZoomInfo: <$5M (source: zoominfo.com/c/company)" or "Formula: 6 employees \u00d7 $324K = ~$1.9M (no online revenue data found)"

STEP 4 \u2014 TRAFFIC ESTIMATE (use this model):
a. Baseline: 2,500 monthly searches for "[primary service] [city]"
b. Check Google Maps for Map Pack position. Search "[company] [service] [city]" for organic rank.
c. Apply CTR: Map Pack #1=17.6%, #2=15.4%, #3=10.1% | Organic #1=24%, #2\u20133=10% | Not ranking=50\u2013150/mo
d. Cross-check: ([Annual Google Reviews] \u00d7 400) / 12. If within 30% of CTR estimate = high confidence. If diverges, use lower number.
e. Record full math.

STEP 5 \u2014 COMPETITOR RESEARCH:
${compSection}

For each competitor, collect the same data fields as the prospect (services, reviews, revenue estimate via online sources like ZoomInfo/RocketReach/Glassdoor first then employee formula as fallback, traffic estimate, ad activity, employee count, weaknesses).

STEP 6 \u2014 RETURN JSON:
Return all findings as a single valid JSON object. Include source_math for revenue and traffic. Every field must cite its source. Use "" for any field you cannot verify \u2014 never guess or fabricate.

JSON schema:
{
  "company_name": "", "industry": "", "primary_services": "", "geographic_market": "",
  "city": "", "state": "", "physical_address": "", "phone": "",
  "positioning_summary": "", "key_differentiators": "", "target_audiences": "",
  "employee_count": "", "founded_year": "",
  "estimated_revenue": { "value": "", "source_math": "", "confidence": "high|medium|low" },
  "estimated_traffic": { "value": "", "source_math": "", "confidence": "high|medium|low" },
  "ad_spend": { "value": "", "source": "", "confidence": "high|medium|low" },
  "ad_channels": "", "ad_active": "", "known_weaknesses": "", "platform": "",
  "google_review_count": "", "google_review_rating": "", "google_reviews_last_12mo": "",
  "data_confidence": "high|medium|low",
  "competitors": [
    {
      "name": "", "website": "", "city": "", "state": "", "physical_address": "",
      "serves_same_market": "", "serves_same_market_evidence": "",
      "positioning": "", "key_strength": "", "key_weakness": "",
      "employee_count": "",
      "est_revenue": { "value": "", "source_math": "", "confidence": "high|medium|low" },
      "est_traffic": { "value": "", "source_math": "", "confidence": "high|medium|low" },
      "ad_active": "", "ad_channels": "",
      "google_review_count": "", "google_review_rating": "",
      "data_confidence": "high|medium|low"
    }
  ]
}`;

    buildFill.style.width = '100%';
    buildFill.style.background = 'linear-gradient(90deg,#34d399,#059669)';
    setTimeout(() => { buildStatus.style.display = 'none'; buildFill.style.width = '5%'; buildFill.style.background = ''; }, 400);
    document.getElementById('cca-gemini-prompt-output').value = promptText;
    document.getElementById('cca-gemini-prompt-area').style.display = 'block';
    btn.disabled = false; btn.textContent = 'Rebuild Prompt \u2192';
  } catch(err) {
    buildStatus.style.display = 'none';
    errEl.textContent = '\u26A0 ' + (err.message || 'Unknown error');
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Build Gemini Prompt \u2192';
  }
});

document.getElementById('cca-copy-prompt-btn').addEventListener('click', () => {
  const ta = document.getElementById('cca-gemini-prompt-output');
  ta.select();
  try { document.execCommand('copy'); } catch(e) { navigator.clipboard && navigator.clipboard.writeText(ta.value); }
  const btn = document.getElementById('cca-copy-prompt-btn');
  btn.textContent = '\u2713 Copied'; btn.style.color = '#34d399'; btn.style.borderColor = 'rgba(52,211,153,0.4)';
  setTimeout(() => { btn.textContent = 'Copy Prompt'; btn.style.color = ''; btn.style.borderColor = ''; }, 2000);
});

// ─── Run via Gemini API (one-click orchestration) ───────────────────
document.getElementById('cca-run-gemini-btn').addEventListener('click', async () => {
  const promptText = document.getElementById('cca-gemini-prompt-output').value.trim();
  if (!promptText) return;

  const btn = document.getElementById('cca-run-gemini-btn');
  const statusEl = document.getElementById('cca-gemini-auto-status');
  btn.disabled = true;
  btn.textContent = 'Sending to Gemini…';
  statusEl.style.display = 'block';
  statusEl.textContent = '⏳ Sending prompt to Gemini API… this may take 60–90 seconds.';

  try {
    const headers = getApiHeaders();
    let geminiResult = '';

    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-lite'];
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const wait = attempt * 10;
        const modelLabel = models[attempt] === 'gemini-2.5-flash-lite' ? ' (switching to Gemini Flash Lite)' : '';
        statusEl.textContent = '\u26A0 Gemini returned empty — retrying in ' + wait + 's' + modelLabel + ' (attempt ' + (attempt + 1) + '/3)…';
        statusEl.style.color = '#f59e0b';
        await new Promise(r => setTimeout(r, wait * 1000));
        btn.textContent = 'Retrying Gemini… (' + (attempt + 1) + '/3)';
        statusEl.textContent = '⏳ Sending prompt to Gemini API… this may take 60–90 seconds.';
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
      geminiResult = (data.candidates || [{}])[0]?.content?.parts
        ?.filter(p => p.text)
        .map(p => p.text)
        .join('')
        .trim() || '';

      if (geminiResult) break;
      console.warn('[CCA Gemini] attempt', attempt, 'empty result');
    }

    if (!geminiResult) throw new Error('Gemini returned empty results after 3 attempts — try pasting manually instead');

    statusEl.textContent = '✓ Gemini research complete — auto-importing results…';
    statusEl.style.color = '#34d399';

    // Auto-paste into the import textarea and switch to stage 1b
    document.getElementById('cca-stage-1a').style.display = 'none';
    document.getElementById('cca-stage-1b').style.display = 'block';
    document.getElementById('cca-gemini-paste').value = geminiResult;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-click the import button after a brief delay
    setTimeout(() => {
      const importBtn = document.getElementById('cca-import-btn');
      if (importBtn) importBtn.click();
    }, 500);

  } catch (err) {
    statusEl.textContent = '⚠ ' + err.message;
    statusEl.style.color = '#f87171';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Run via Gemini API';
  }
});

document.getElementById('cca-go-to-paste-btn').addEventListener('click', () => {
  document.getElementById('cca-stage-1a').style.display = 'none';
  document.getElementById('cca-stage-1b').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('cca-skip-to-paste-btn').addEventListener('click', () => {
  document.getElementById('cca-stage-1a').style.display = 'none';
  document.getElementById('cca-stage-1b').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('cca-back-to-1a').addEventListener('click', () => {
  document.getElementById('cca-stage-1b').style.display = 'none';
  document.getElementById('cca-stage-1a').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('cca-import-btn').addEventListener('click', async () => {
  const paste = document.getElementById('cca-gemini-paste').value.trim();
  const errEl = document.getElementById('cca-import-error');
  if (!paste) { errEl.textContent = '\u26A0 Please paste Gemini response first.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('cca-import-btn');
  btn.disabled = true; btn.textContent = 'Validating\u2026';
  const importStatus = document.getElementById('cca-import-status');
  const importStatusMsg = document.getElementById('cca-import-status-msg');
  importStatus.style.display = 'flex';
  importStatusMsg.textContent = 'Parsing and validating research\u2026';

  const clientNameVal = document.getElementById('cca-client-name').value.trim();
  const known = document.getElementById('cca-known-context').value.trim();
  const validatePrompt = 'Validate and extract this Gemini research response into structured JSON.\n'
    + (clientNameVal ? 'CLIENT NAME PROVIDED: ' + clientNameVal + '\n' : '')
    + (known ? '\nWHAT WE ALREADY KNOW (use to cross-check):\n' + known + '\n' : '')
    + '\nGEMINI RESPONSE:\n' + paste
    + '\n\nExtract all data into the JSON schema. Flag any field that looks estimated without a source, or inconsistent with what we already know.';

  try {
    let d;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        const wait = attempt * 15;
        if (importStatusMsg) importStatusMsg.textContent = 'Rate limited \u2014 retrying in ' + wait + 's\u2026';
        await new Promise(r => setTimeout(r, wait * 1000));
        if (importStatusMsg) importStatusMsg.textContent = 'Retrying validation (attempt ' + (attempt + 1) + ')\u2026';
      }
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ model: API_MODEL, max_tokens: 8192, system: VALIDATE_SYSTEM, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: 'user', content: validatePrompt }] })
      });
      if (res.ok) { d = await res.json(); break; }
      if (res.status === 429 || res.status === 529) continue;
      throw new Error('API ' + res.status);
    }
    if (!d) throw new Error('API rate limited after retries. Please wait a minute and try again.');
    let raw = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    let parsed;
    try {
      const clean = raw.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      const s = raw.indexOf('{'), en = raw.lastIndexOf('}');
      if (s !== -1 && en !== -1) parsed = JSON.parse(raw.slice(s, en+1));
      else throw new Error('Could not parse validated data. Please try again.');
    }


    function flattenVal(obj) {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      return obj.value || '';
    }
    function flattenMath(obj) {
      if (!obj || typeof obj === 'string') return '';
      return obj.source_math || obj.source || '';
    }
    const flatRevenue = flattenVal(parsed.estimated_revenue);
    const flatTraffic = flattenVal(parsed.estimated_traffic);
    const flatAdSpend = flattenVal(parsed.ad_spend);

    const revMath = flattenMath(parsed.estimated_revenue);
    const traMath = flattenMath(parsed.estimated_traffic);

    ccaData = {
      ...ccaData,
      ...parsed,
      estimated_revenue: flatRevenue,
      estimated_traffic: flatTraffic,
      ad_spend: flatAdSpend,
      company_name: parsed.company_name || clientNameVal || '',
      prospect_url: document.getElementById('cca-url-input').value.trim()
    };
    window.ccaData = ccaData;

    const revMathEl = document.getElementById('cd-revenue-math');
    const traMathEl = document.getElementById('cd-traffic-math');
    if (revMathEl && revMath) revMathEl.textContent = '\u21B3 ' + revMath;
    if (traMathEl && traMath) traMathEl.textContent = '\u21B3 ' + traMath;
    if (parsed.competitors) {
      ccaData.competitors = parsed.competitors.map(c => ({
        ...c,
        est_revenue: (c.est_revenue && typeof c.est_revenue === 'object') ? c.est_revenue.value || '' : (c.est_revenue || ''),
        est_traffic: (c.est_traffic && typeof c.est_traffic === 'object') ? c.est_traffic.value || '' : (c.est_traffic || ''),
        _rev_math:   (c.est_revenue && typeof c.est_revenue === 'object') ? (c.est_revenue.source_math || '') : '',
        _tra_math:   (c.est_traffic && typeof c.est_traffic === 'object') ? (c.est_traffic.source_math || '') : '',
      }));
    }

    importStatus.style.display = 'none';
    populateStage2();


    if (parsed.flags && parsed.flags.length > 0) {
      showCCAValidationFlags(parsed.flags);
    }

    showCCAStage(2);
    btn.disabled = false; btn.textContent = 'Validate & Import \u2192';

    // Auto-fetch review counts for competitors
    const compsWithNames = ccaData.competitors.filter(c => c.name);
    if (compsWithNames.length > 0) {
      const reviewBtn = document.getElementById('cca-fetch-reviews-btn');
      if (reviewBtn) {
        reviewBtn.disabled = true; reviewBtn.textContent = '\u23F3 Fetching reviews\u2026';
        try {
          const results = await callCCAReviews(compsWithNames);
          results.forEach(r => {
            const idx = ccaData.competitors.findIndex(c => c.name.toLowerCase().includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(c.name.toLowerCase()));
            if (idx !== -1) {
              ccaData.competitors[idx].review_count = r.review_count || '';
              ccaData.competitors[idx].review_source = r.review_source || '';
            }
          });
          renderCompetitors();
          reviewBtn.textContent = '\u2713 Reviews fetched';
          setTimeout(() => { reviewBtn.textContent = '\u21BB Refresh Reviews'; reviewBtn.disabled = false; }, 2000);
        } catch (e) {
          console.warn('Auto-fetch reviews failed:', e.message);
          reviewBtn.textContent = '\u21BB Fetch Reviews';
          reviewBtn.disabled = false;
        }
      }
    }
  } catch(err) {
    importStatus.style.display = 'none';
    errEl.textContent = '\u26A0 Validation failed: ' + (err.message || 'Unknown error');
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Validate & Import \u2192';
  }
});

function showCCAValidationFlags(flags) {
  const existing = document.getElementById('cca-validation-flags');
  if (existing) existing.remove();
  if (!flags || !flags.length) return;
  const div = document.createElement('div');
  div.id = 'cca-validation-flags';
  div.style.cssText = 'background:rgba(251,146,60,0.06);border:1px solid rgba(251,146,60,0.25);border-radius:10px;padding:16px 20px;margin-bottom:20px';
  div.innerHTML = '<div style="font-size:10px;font-family:monospace;color:#fb923c;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">\u26A0 Validation Flags \u2014 Review Before Generating</div>'
    + flags.map(f => '<div style="font-size:12px;font-family:monospace;color:#9ca3af;margin-bottom:6px;line-height:1.5;">\u00b7 ' + f + '</div>').join('');
  const stage2 = document.getElementById('cca-stage-2');
  if (stage2) stage2.insertBefore(div, stage2.firstChild);
}

document.getElementById('cca-fetch-reviews-btn').addEventListener('click', async () => {
  const btn = document.getElementById('cca-fetch-reviews-btn');
  const statusEl = document.getElementById('cca-reviews-status');
  const names = ccaData.competitors.filter(c => c.name).map(c => c.name).join(', ');
  if (!names) { statusEl.textContent = 'Add competitor names first.'; return; }
  btn.disabled = true;
  btn.textContent = '\u27F3 FETCHING\u2026';
  statusEl.style.color = '#4b5563';
  statusEl.textContent = 'Searching for review counts\u2026';
  try {
    const results = await callCCAReviews(ccaData.competitors.filter(c => c.name));
    results.forEach(r => {
      const idx = ccaData.competitors.findIndex(c => c.name.toLowerCase().includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(c.name.toLowerCase()));
      if (idx !== -1) {
        ccaData.competitors[idx].review_count = r.review_count || '';
        ccaData.competitors[idx].review_source = r.review_source || '';
      }
    });
    renderCompetitors();
    statusEl.textContent = '\u2713 Review counts updated \u2014 check fields above.';
    statusEl.style.color = '#a78bfa';
  } catch(e) {
    statusEl.textContent = '\u26A0 Could not fetch reviews: ' + (e.message || 'unknown error');
    statusEl.style.color = '#ef4444';
  } finally {
    btn.disabled = false;
    btn.textContent = '\u27F3 FETCH REVIEWS';
  }
});

document.getElementById('cca-add-comp').addEventListener('click', () => {
  ccaData.competitors.push({ name:'', website:'', positioning:'', key_strength:'', key_weakness:'', est_revenue:'', est_traffic:'', review_count:'', review_source:'', status:'' });
  renderCompetitors();
});

document.getElementById('cca-generate-btn').addEventListener('click', async () => {
  collectStage2();
  const btn = document.getElementById('cca-generate-btn');
  const errEl = document.getElementById('cca-stage2-error');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = '\u27F3 Generating report\u2026';
  showCCAStage(3);

  let stageIdx = 0;

  const frame = document.getElementById('cca-report-frame');
  frame.srcdoc = makeCCALoadingHTML(0);
  const statusTimer = setInterval(() => {
    stageIdx = Math.min(stageIdx + 1, statusStages.length - 1);
    frame.srcdoc = makeCCALoadingHTML(stageIdx);
  }, 12000);

  try {
    const compText = ccaData.competitors.map((c,i) =>
      `Competitor ${i+1}: ${c.name} | Website: ${c.website} | Revenue: ${c.est_revenue} | Traffic: ${c.est_traffic} | Strength: ${c.key_strength} | Weakness: ${c.key_weakness} | Positioning: ${c.positioning}`
    ).join('\n');

    const prompt = `Generate the competitive analysis report data now.

CLIENT: ${ccaData.company_name}
Industry: ${ccaData.industry}
Website: ${ccaData.website || 'not provided'}
Geographic Market: ${ccaData.geographic_market}
Est. Annual Revenue: ${ccaData.estimated_revenue}
Est. Monthly Traffic: ${ccaData.estimated_traffic}
Monthly Ad Spend: ${ccaData.ad_spend}
Active Ad Channels: ${ccaData.ad_channels}
Primary Services / Products: ${ccaData.primary_services}
Positioning Summary: ${ccaData.positioning_summary}
Key Differentiators: ${ccaData.key_differentiators}
Target Audiences: ${ccaData.target_audiences}
Known Weaknesses / Challenges: ${ccaData.known_weaknesses}
HubSpot Scheduling URL: https://meetings-na2.hubspot.com/fred29

COMPETITORS:
${compText || 'Not provided \u2014 infer from research'}

MEETING NOTES:
${ccaData.meeting_notes || 'None provided'}

Return ONLY the JSON object. No preamble, no explanation, no markdown fences.
Be concise \u2014 keep all string values tight (1-2 sentences). Stop generating as soon as each field is complete. Do not pad.`;


    async function fetchReportPart(systemPrompt, partLabel, stageNum) {
      stageIdx = stageNum; frame.srcdoc = makeCCALoadingHTML(stageIdx);
      const tout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error(partLabel + ' timed out after 4 min.')), 240000)
      );
      const res = await Promise.race([
        fetch('/api/messages', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            model: API_MODEL,
            max_tokens: 4500,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
          })
        }),
        tout
      ]);
      if (!res.ok) throw new Error(partLabel + ` API ${res.status}`);
      const d = await res.json();
      let raw = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      let rep = repairJSON(raw);
      try { return JSON.parse(rep); }
      catch(e) {
        const s = rep.indexOf('{'), en = rep.lastIndexOf('}');
        if (s !== -1 && en > s) {
          try { return JSON.parse(rep.slice(s, en + 1)); } catch(_) {}
        }
        console.error(partLabel + ' parse fail. Last 300:', raw.slice(-300));
        throw new Error(partLabel + ' JSON malformed: ' + e.message);
      }
    }

    const partA = await fetchReportPart(CCA_REPORT_SYSTEM_A, 'Part A (sections 1-4)', 1);
    await new Promise(r => setTimeout(r, 5000));
    const partB = await fetchReportPart(CCA_REPORT_SYSTEM_B, 'Part B (sections 5-8)', 3);
    await new Promise(r => setTimeout(r, 5000));
    const partC = await fetchReportPart(CCA_REPORT_SYSTEM_C, 'Part C (sections 9-11)', 5);
    stageIdx = 6; frame.srcdoc = makeCCALoadingHTML(stageIdx);

    const reportData = Object.assign({}, partA, partB, partC);

    reportData.cover_info = {
      website: ccaData.website || ccaData.prospect_url || '',
      geographic_market: ccaData.geographic_market || '',
      industry: ccaData.industry || '',
      primary_services: ccaData.primary_services || ''
    };


    function parseRevenue(s) {
      if (!s) return 0;
      s = String(s).trim().replace(/\s*[\u2014\u2013].*$/, '').replace(/\s*\(.*$/, '').trim();
      const rangeMM = s.match(/([\d.,]+)\s*[Mm]\s*[-\u2013]\s*\$?([\d.,]+)\s*[Mm]/);
      if (rangeMM) return Math.round((parseFloat(rangeMM[1].replace(/,/g,'')) + parseFloat(rangeMM[2].replace(/,/g,''))) / 2 * 10) / 10;
      const mMatch = s.match(/([\d.,]+)\s*[Mm]/);
      if (mMatch) return Math.round(parseFloat(mMatch[1].replace(/,/g,'')) * 10) / 10;
      const kMatch = s.match(/([\d.,]+)\s*[Kk]/);
      if (kMatch) return Math.round(parseFloat(kMatch[1].replace(/,/g,'')) / 1000 * 10) / 10;
      const rangeMatch = s.match(/([\d.,]+)\s*[-\u2013]\s*([\d.,]+)/);
      if (rangeMatch) {
        let a = parseFloat(rangeMatch[1].replace(/,/g,'')), b = parseFloat(rangeMatch[2].replace(/,/g,''));
        if (a > 1000) a /= 1000000;
        if (b > 1000) b /= 1000000;
        return Math.round((a + b) / 2 * 10) / 10;
      }
      const raw = parseFloat(s.replace(/[^0-9.]/g, ''));
      if (isNaN(raw)) return 0;
      return raw > 1000 ? Math.round(raw / 1000000 * 10) / 10 : Math.round(raw * 10) / 10;
    }

    function parseTraffic(s) {
      if (!s) return 0;
      s = String(s).trim().replace(/\s*[\u2014\u2013].*$/, '').replace(/\s*\(.*$/, '').trim();
      const kMatch = s.match(/([\d.]+)\s*[Kk]/);
      if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
      const rangeMatch = s.match(/([\d.,]+)\s*[-\u2013]\s*([\d.,]+)/);
      if (rangeMatch) return Math.round((parseFloat(rangeMatch[1].replace(/,/g,'')) + parseFloat(rangeMatch[2].replace(/,/g,''))) / 2);
      const raw = parseFloat(s.replace(/[^0-9.]/g, ''));
      return isNaN(raw) ? 0 : Math.round(raw);
    }

    function parseNum(s) {
      if (!s) return 0;
      s = String(s).trim().replace(/\s*[\u2014\u2013].*$/, '').replace(/\s*\(.*$/, '').trim();

      const mMatch = s.match(/([\d.,]+)\s*[Mm]/);
      if (mMatch) return Math.round(parseFloat(mMatch[1].replace(/,/g,'')) * 1000000);

      const kMatch = s.match(/([\d.,]+)\s*[Kk]/);
      if (kMatch) return Math.round(parseFloat(kMatch[1].replace(/,/g,'')) * 1000);

      const rangeMatch = s.match(/([\d.,]+)\s*[-\u2013]\s*([\d.,]+)/);
      if (rangeMatch) return Math.round((parseFloat(rangeMatch[1].replace(/,/g,'')) + parseFloat(rangeMatch[2].replace(/,/g,''))) / 2);
      const raw = parseFloat(s.replace(/[^0-9.]/g,''));
      return isNaN(raw) ? 0 : Math.round(raw);
    }
    const allEntities = [
      { name: ccaData.company_name, rev: parseRevenue(ccaData.estimated_revenue), tra: parseTraffic(ccaData.estimated_traffic), adSpend: parseRevenue(ccaData.ad_spend), channels: ccaData.ad_channels || '', isClient: true },
      ...(ccaData.competitors || []).map(c => ({ name: c.name, rev: parseRevenue(c.est_revenue), tra: parseTraffic(c.est_traffic), adSpend: 0, channels: c.ad_channels || '', isClient: false }))
    ].filter(e => e.name);

    const clientIdx = 0;
    reportData.chart_data = reportData.chart_data || {};

    function roundTo500K(v) { return Math.ceil(v * 2) / 2; }
    reportData.chart_data.revenue_bar = {
      labels: allEntities.map(e => e.name),
      values: allEntities.map(e => roundTo500K(e.rev)),
      client_index: clientIdx
    };
    reportData.chart_data.traffic_bar = {
      labels: allEntities.map(e => e.name),
      values: allEntities.map(e => e.tra),
      client_index: clientIdx
    };

    function parseDollars(s) {
      if (!s) return 0;
      s = String(s).trim().replace(/\s*[\u2014\u2013].*$/, '').replace(/\s*\(.*$/, '').trim();
      const mMatch = s.match(/([\d.,]+)\s*[Mm]/);
      if (mMatch) return Math.round(parseFloat(mMatch[1].replace(/,/g,'')) * 1000000);
      const kMatch = s.match(/([\d.,]+)\s*[Kk]/);
      if (kMatch) return Math.round(parseFloat(kMatch[1].replace(/,/g,'')) * 1000);
      const raw = parseFloat(s.replace(/[^0-9.]/g, ''));
      return isNaN(raw) ? 0 : Math.round(raw);
    }

    // Total budget is ALWAYS from the user's Monthly Ad Budget field
    const totalSpend = parseDollars(ccaData.ad_spend) || 5000;

    // Build channel list from Stage 2 ad_channels (filter out "none" variants)
    const _rawChans = (ccaData.ad_channels || '').split(/[,|+&]/).map(s => s.trim()).filter(Boolean);
    const _noneWords = /^(none|not active|none active|none detected|no active|n\/a|not applicable|0|\$0)$/i;
    const chanList = _rawChans.filter(s => !_noneWords.test(s));


    let donutLabels, rawWeights;
    if (chanList.length) {
      donutLabels = chanList;
      rawWeights = chanList.map(ch => {
        const n = ch.toLowerCase();
        if (n.includes('lsa') || n.includes('local services')) return 15;
        if (n.includes('google ads') || n.includes('search')) return 45;
        if (n.includes('meta') || n.includes('facebook')) return 25;
        if (n.includes('bing')) return 10;
        if (n.includes('podium') || n.includes('review') || n.includes('crm')) return 5;
        return Math.round(100 / chanList.length);
      });
    } else if (reportData.s10 && (reportData.s10.rows||[]).length) {
      donutLabels = reportData.s10.rows.map(r => r.channel).filter(Boolean);
      rawWeights = reportData.s10.rows.map(r => {
        return parseFloat((r.pct||'').replace(/[^0-9.]/g,'')) || (100 / donutLabels.length);
      });
    } else {
      donutLabels = ['Digital Marketing'];
      rawWeights = [100];
    }


    // Use "largest remainder" method so values always sum to exactly totalSpend
    const weightSum = rawWeights.reduce((a,b) => a+b, 0) || 100;
    const normalizedPcts = rawWeights.map(w => w / weightSum * 100);
    const floatValues = normalizedPcts.map(p => p / 100 * totalSpend);
    const floorValues = floatValues.map(v => Math.floor(v));
    const remainder = totalSpend - floorValues.reduce((a,b) => a+b, 0);

    const fractions = floatValues.map((v, i) => ({ i, frac: v - Math.floor(v) }));
    fractions.sort((a,b) => b.frac - a.frac);
    const donutValues = [...floorValues];
    for (let i = 0; i < remainder; i++) donutValues[fractions[i].i]++;


    const donutPcts = normalizedPcts.map((p, i) => {

      return Math.round(donutValues[i] / totalSpend * 100);
    });

    const pctSum = donutPcts.reduce((a,b) => a+b, 0);
    if (pctSum !== 100) {
      const pctFracs = normalizedPcts.map((p,i) => ({i, frac: p - Math.floor(p)}));
      pctFracs.sort((a,b) => b.frac - a.frac);
      const floorPcts = normalizedPcts.map(p => Math.floor(p));
      const pctRemainder = 100 - floorPcts.reduce((a,b) => a+b, 0);
      for (let i = 0; i < pctRemainder; i++) floorPcts[pctFracs[i].i]++;
      donutPcts.splice(0, donutPcts.length, ...floorPcts);
    }

    reportData.chart_data.budget_donut = {
      labels: donutLabels,
      values: donutValues,
      pcts: donutPcts,
      total: totalSpend,
      primary_index: 0
    };


    frame.srcdoc = makeCCALoadingHTML('Rendering report\u2026');
    clearInterval(statusTimer);
    const reportHtml = buildCCAReportHTML(reportData);
    ccaReportHtml = reportHtml;
    frame.srcdoc = reportHtml;
    document.getElementById('cca-download-btn').style.display = 'inline-block';
    document.getElementById('cca-chat-toggle-btn').style.display = 'inline-block';
    document.getElementById('cca-save-pdf-btn').style.display = 'inline-block';

    document.getElementById('cca-regen-panel').style.display = 'block';
    document.getElementById('cca-mod-toggle').style.display = 'block';
    document.getElementById('cca-secondary-btn').style.display = 'inline-block';

    // Auto-save to server
    try {
      await saveReport('cca', ccaData.company_name || 'Unknown', {
        industry: ccaData.industry || ccaData.primary_services || '',
        market: ccaData.geographic_market || '',
        url: ccaData.prospect_url || '',
      }, ccaData, ccaReportHtml);
    } catch (e) { console.warn('Auto-save failed:', e.message); }

  } catch(e) {
    clearInterval(statusTimer);
    errEl.textContent = '\u26A0 Report generation failed: ' + (e.message || 'unknown error') + '. Please try again.';
    errEl.style.display = 'block';
    showCCAStage(2);
  }
  btn.disabled = false; btn.textContent = 'Generate Report \u2192';
});

document.getElementById('cca-back-to-1').addEventListener('click', () => {
  document.getElementById('cca-stage-2').style.display = 'none';
  const s1b = document.getElementById('cca-stage-1b');
  const s1a = document.getElementById('cca-stage-1a');
  if (s1b && s1b.style.display === 'none' && document.getElementById('cca-gemini-paste') && !document.getElementById('cca-gemini-paste').value) {
    if (s1a) s1a.style.display = 'block';
  } else {
    if (s1b) s1b.style.display = 'block';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.getElementById('cca-back-to-2').addEventListener('click', () => { showCCAStage(2); showScreen('csp'); });

document.getElementById('cca-mod-toggle').addEventListener('click', () => {
  const panel = document.getElementById('cca-regen-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  document.getElementById('cca-mod-toggle').textContent = isOpen ? '\u270F Modify' : '\u2715 Close';
  if (!isOpen) document.getElementById('cca-mod-notes').focus();
});

document.getElementById('cca-regen-btn').addEventListener('click', async () => {
  const mods = document.getElementById('cca-mod-notes').value.trim();
  if (!mods) {
    document.getElementById('cca-mod-notes').placeholder = '\u26A0 Please describe what to change before regenerating.';
    document.getElementById('cca-mod-notes').focus();
    return;
  }

  const originalNotes = ccaData.meeting_notes || '';
  ccaData.meeting_notes = originalNotes
    ? originalNotes + '\n\nMODIFICATION REQUEST:\n' + mods
    : 'MODIFICATION REQUEST:\n' + mods;


  document.getElementById('cca-regen-panel').style.display = 'none';
  document.getElementById('cca-mod-toggle').textContent = '\u270F Modify';
  document.getElementById('cca-generate-btn').click();

  setTimeout(() => { ccaData.meeting_notes = originalNotes; }, 500);
});

document.getElementById('cca-download-btn').addEventListener('click', () => {
  if (!ccaReportHtml) return;
  const name = (ccaData.company_name || 'prospect').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const today = new Date();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const yy = String(today.getFullYear()).slice(-2);
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(ccaReportHtml);
  a.download = 'efelle-strategymap-' + name + '-' + mm + dd + yy + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

});

let ccaSecondaryHtml = '';

document.getElementById('cca-secondary-btn').addEventListener('click', async () => {
  const btn = document.getElementById('cca-secondary-btn');
  btn.disabled = true;
  btn.textContent = 'Generating\u2026';

  const frame = document.getElementById('cca-report-frame');
  const secondaryStages = [
    'Building 12-Month Growth Roadmap\u2026',
    'Writing Top 10 Quick Wins\u2026',
    'Drafting Homepage Messaging Rewrite\u2026',
    'Finalizing Action Plan\u2026'
  ];
  let stageIdx = 0;
  const statusTimer = setInterval(() => {
    stageIdx = (stageIdx + 1) % secondaryStages.length;
    frame.srcdoc = makeCCALoadingHTML(secondaryStages[stageIdx]);
  }, 4000);
  frame.srcdoc = makeCCALoadingHTML(secondaryStages[0]);

  try {
    const dataStr = JSON.stringify(ccaData, null, 2);
    const prompt = `Generate the Action & Growth Supplement report for this client.

CLIENT & COMPETITOR DATA:
${dataStr}

Generate all 3 sections (12-Month Roadmap, Top 10 Quick Wins, Homepage Messaging Rewrite) as a complete self-contained HTML file per the system prompt.`;

    let res, d;
    for (let retry = 0; retry < 4; retry++) {
      if (retry > 0) {
        const wait = retry * 15;
        frame.srcdoc = makeCCALoadingHTML('Rate limited \u2014 retrying in ' + wait + 's\u2026');
        await new Promise(r => setTimeout(r, wait * 1000));
        frame.srcdoc = makeCCALoadingHTML(secondaryStages[0]);
      }
      const timeout2 = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 5 minutes. Please try again.')), 300000)
      );
      res = await Promise.race([
        fetch('/api/messages', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            model: API_MODEL,
            max_tokens: 8192,
            system: CCA_SECONDARY_SYSTEM,
            messages: [{ role: 'user', content: prompt }]
          })
        }),
        timeout2
      ]);
      if (res.ok) break;
      if (res.status === 429 || res.status === 529) continue;
      throw new Error('API ' + res.status);
    }
    clearInterval(statusTimer);
    if (!res.ok) throw new Error('API rate limited after retries. Please wait a minute and try again.');
    d = await res.json();
    let html = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const hStart = html.indexOf('<!DOCTYPE');
    const hEnd = html.lastIndexOf('</html>');
    if (hStart !== -1 && hEnd !== -1) html = html.slice(hStart, hEnd + 7);
    ccaSecondaryHtml = html;
    frame.srcdoc = html;


    const dlBtn = document.getElementById('cca-download-btn');
    dlBtn.textContent = '\u2193 Download Action Plan';
    dlBtn.onclick = () => {
      const name = (ccaData.company_name || 'prospect').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      const a = document.createElement('a');
      a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(ccaSecondaryHtml);
      a.download = name + '-action-plan.html';
      a.click();
    };
    btn.textContent = '\u2713 Action Plan Ready';
    btn.disabled = false;

    try {
      await saveReport('cca-secondary', ccaData.company_name || 'Unknown', {
        industry: ccaData.industry || '',
        market: ccaData.geographic_market || '',
      }, ccaData, ccaSecondaryHtml);
    } catch (e) { console.warn('Auto-save failed:', e.message); }

  } catch(e) {
    clearInterval(statusTimer);
    frame.srcdoc = '<p style="color:red;padding:20px;">Generation failed: ' + (e.message||'unknown') + '</p>';
    btn.disabled = false;
    btn.textContent = '+ Generate Action Plan \u2192';
  }
});

// ─── CCA Save as PDF ───────────────────────────────────────────────
document.getElementById('cca-save-pdf-btn').addEventListener('click', () => {
  if (!ccaReportHtml) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(ccaReportHtml);
  printWindow.document.close();
  printWindow.onload = () => { setTimeout(() => printWindow.print(), 500); };
});

// ─── CCA AI Chat Edit Panel ────────────────────────────────────────
document.getElementById('cca-chat-toggle-btn').addEventListener('click', () => {
  const panel = document.getElementById('cca-chat-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') document.getElementById('cca-chat-input').focus();
});

document.getElementById('cca-chat-send').addEventListener('click', async () => {
  const input = document.getElementById('cca-chat-input');
  const instruction = input.value.trim();
  if (!instruction || !ccaReportHtml) return;

  const messagesEl = document.getElementById('cca-chat-messages');
  const sendBtn = document.getElementById('cca-chat-send');

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
        messages: [{ role: 'user', content: `Here is the current report HTML:\n\n${ccaReportHtml}\n\nEdit instruction: ${instruction}` }]
      })
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const d = await res.json();
    let raw = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    raw = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const ops = JSON.parse(raw);
    let updatedHtml = ccaReportHtml;
    let changeCount = 0;
    for (const op of ops) {
      if (updatedHtml.includes(op.find)) {
        updatedHtml = updatedHtml.replace(op.find, op.replace);
        changeCount++;
      }
    }
    if (changeCount === 0) throw new Error('No matching text found to replace — try being more specific');
    ccaReportHtml = updatedHtml;
    document.getElementById('cca-report-frame').srcdoc = ccaReportHtml;
    thinkMsg.textContent = `✓ ${changeCount} change(s) applied`;
    thinkMsg.style.color = '#a78bfa';
  } catch (e) {
    thinkMsg.textContent = '⚠ ' + (e.message || 'Failed to edit');
    thinkMsg.style.color = '#f87171';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});
