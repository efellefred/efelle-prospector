export const PROPOSAL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[[PAGE_TITLE]]</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --black:#1D1D1F; --orange:#F56300; --orange-dim:rgba(245,99,0,0.08); --gray-1:#3A3A3C; --gray-2:#636366; --gray-3:#AEAEB2; --gray-4:#D2D2D7; --gray-5:#F5F5F7; --white:#FFFFFF; --green:#32D74B; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Plus Jakarta Sans',sans-serif; background:var(--white); color:var(--black); max-width:780px; margin:0 auto; }
  .hero { background:#000; padding:64px 52px 52px; position:relative; overflow:hidden; }
  .hero::before { content:''; position:absolute; top:-100px; right:-80px; width:500px; height:500px; border-radius:50%; background:radial-gradient(circle,rgba(245,99,0,0.15) 0%,transparent 70%); }
  .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(245,99,0,0.15); border:1px solid rgba(245,99,0,0.3); border-radius:20px; padding:5px 14px; font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--orange); margin-bottom:24px; }
  .hero h1 { font-size:26px; font-weight:800; color:var(--white); line-height:1.08; letter-spacing:-0.02em; margin-bottom:18px; max-width:620px; }
  .hero h1 em { font-style:normal; color:var(--orange); }
  .hero-sub { font-size:15px; color:var(--gray-4); line-height:1.75; max-width:560px; margin-bottom:36px; }
  .hero-proof { display:flex; gap:32px; padding-top:32px; border-top:1px solid rgba(255,255,255,0.1); flex-wrap:wrap; }
  .hero-stat .num { font-size:40px; font-weight:800; color:var(--white); letter-spacing:-0.02em; line-height:1; }
  .hero-stat .num span { color:var(--orange); }
  .hero-stat .lbl { font-size:11px; color:rgba(255,255,255,0.6); margin-top:6px; max-width:120px; line-height:1.5; }
  .section { padding:52px; border-bottom:1px solid var(--gray-4); }
  .section:last-of-type { border-bottom:none; }
  .section-badge { font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--orange); margin-bottom:8px; display:block; }
  .section h2 { font-size:26px; font-weight:800; letter-spacing:-0.01em; margin-bottom:10px; line-height:1.2; }
  .section h2 em { font-style:normal; color:var(--orange); }
  .section .lead { font-size:14px; color:var(--gray-1); line-height:1.75; margin-bottom:28px; }
  #sec-offer .lead { font-size:13px; }
  .offer-callout { background:var(--black); border-radius:14px; padding:32px 36px; display:flex; gap:32px; align-items:center; margin-bottom:28px; }
  .offer-price-block { flex-shrink:0; text-align:center; }
  .offer-price { font-size:44px; font-weight:800; color:var(--orange); letter-spacing:-0.03em; line-height:1; }
  .offer-price-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.55); margin-top:4px; }
  .offer-divider { width:1px; background:rgba(255,255,255,0.1); align-self:stretch; flex-shrink:0; }
  .offer-text { font-size:14px; color:#B0B0B5; line-height:1.8; }
  .offer-text strong { color:var(--white); }
  .include-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:28px; }
  .include-item { display:flex; align-items:flex-start; gap:10px; background:var(--gray-5); border-radius:10px; padding:14px 16px; font-size:12px; color:var(--gray-1); line-height:1.55; }
  .include-dot { width:20px; height:20px; border-radius:50%; background:var(--orange); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .include-dot svg { width:10px; height:10px; }
  .roi-band { background:linear-gradient(135deg,var(--orange-dim),transparent); border:1px solid rgba(245,99,0,0.2); border-radius:14px; padding:28px 32px; display:flex; align-items:center; gap:28px; margin-bottom:0; }
  .roi-big { font-size:52px; font-weight:800; color:var(--orange); letter-spacing:-0.03em; line-height:1; flex-shrink:0; }
  .roi-copy { font-size:14px; color:var(--gray-1); line-height:1.75; }
  .roi-copy strong { color:var(--black); }
  .three-up { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
  .feature-card { background:var(--gray-5); border-radius:12px; padding:22px; border-top:3px solid var(--orange); }
  .feature-card h3 { font-size:13px; font-weight:700; color:var(--black); margin-bottom:7px; }
  .feature-card p { font-size:12px; color:var(--gray-2); line-height:1.65; }
  .rgs-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .rgs-card { background:var(--black); border-radius:12px; padding:20px 22px; display:flex; flex-direction:column; gap:6px; }
  .addon-row:last-child { border-bottom:none !important; }
  .sig-rule { border-bottom:1px solid #1D1D1F; height:36px; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .sig-caption { font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#6E6E73; margin-top:6px; }
  .sig-eyebrow { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:var(--orange); margin-bottom:6px; }
  .rgs-card-title { font-size:12px; font-weight:700; color:var(--white); }
  .rgs-card-desc { font-size:11px; color:#B0B0B5; line-height:1.6; }
  .rgs-price-band { background:var(--gray-5); border-radius:12px; padding:24px 28px; display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:20px; }
  .rgs-price-label { font-size:11px; color:var(--gray-2); text-transform:uppercase; letter-spacing:0.08em; font-weight:600; }
  .rgs-price-val { font-size:32px; font-weight:800; color:var(--black); letter-spacing:-0.02em; }
  .rgs-price-note { font-size:11px; color:var(--gray-2); margin-top:2px; }
  .process-steps { display:flex; flex-direction:column; gap:0; }
  .step { display:flex; gap:20px; padding:14px 0; border-bottom:1px solid var(--gray-5); }
  .step:last-child { border-bottom:none; }
  .step-num { width:36px; height:36px; border-radius:50%; background:var(--orange); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:var(--white); flex-shrink:0; margin-top:2px; }
  .step-content h3 { font-size:14px; font-weight:700; color:var(--black); margin-bottom:5px; }
  .step-content p { font-size:12px; color:var(--gray-2); line-height:1.65; }
  .comp-band { background:var(--black); border-radius:14px; padding:28px 32px; margin-bottom:20px; }
  .comp-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.55); margin-bottom:20px; text-align:center; }
  .comp-row { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .comp-item { text-align:center; }
  .comp-name { font-size:13px; font-weight:700; color:var(--white); margin-bottom:4px; }
  .comp-rev { font-size:28px; font-weight:800; color:var(--orange); letter-spacing:-0.02em; }
  .comp-lbl { font-size:10px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.08em; }
  .awards-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
  .award-badge { background:var(--gray-5); border-radius:8px; padding:18px 16px; font-size:11px; font-weight:700; color:var(--gray-1); text-align:center; flex:1; min-width:120px; }
  .award-badge .award-num { font-size:38px; font-weight:800; color:var(--orange); display:block; margin-bottom:2px; }
  .sm-hdr { font-family:'Plus Jakarta Sans',sans-serif; font-size:7px; font-weight:700; fill:#fff; letter-spacing:0.04em; }
  .sm-node { font-family:'Plus Jakarta Sans',sans-serif; font-size:8px; font-weight:800; fill:#fff; letter-spacing:0.06em; }
  .sm-item { font-family:'Plus Jakarta Sans',sans-serif; font-size:6.5px; fill:#636366; }
  .sm-month { font-family:'Plus Jakarta Sans',sans-serif; font-size:9px; font-weight:700; fill:#3A3A3C; letter-spacing:0.06em; }
  @media print {
    @page {
      size:8.5in 11in;
      margin:0.125in;
      @bottom-center {
        content: "efelle proposal  //  page " counter(page) " of " counter(pages);
        font-family:'Plus Jakarta Sans', sans-serif;
        font-size:8px;
        color:#636366;
        letter-spacing:0.06em;
      }
    }
    body { max-width:100%; }

    /*
       PAGE LAYOUT @ 8.5" × 11" / 0.125" margins — varies by proposal type

       New Website / WO:            RGS Only:
       P1  Hero + About + SOW       P1  Hero + About + SOW
       P2  The Offer                P2  The Offer
       P3  Revenue Growth Service   P3  RGS program cards
       P4  Why efelle               P4  RGS add-ons + ROI band
       P5  Portfolio                P5  Why efelle
       P6  Built For                P6  Case studies (2 graphics)
       P7  Process                  P7  Case studies (2 graphics)
       P8  Authorization            P8  Process
                                    P9  Authorization
    */

    /* ── Forced page breaks before each major section ── */
    /* #sec-about flows with Hero on P1 — no break-before */
    #sec-offer    { break-before:page; page-break-before:always; }
    #sec-rgs      { break-before:page; page-break-before:always; }
    #sec-why      { break-before:page; page-break-before:always; }
    #sec-portfolio { break-before:page; page-break-before:always; }
    .case-study-page { break-before:page; page-break-before:always; }
    .cs-img-card { break-inside:avoid; page-break-inside:avoid; }
    #sec-built    { break-before:page; page-break-before:always; }
    /* sec-built gets its own page so the section stays complete */
    #sec-process  { break-before:page; page-break-before:always; }
    #sec-auth     { break-before:page; page-break-before:always; break-after:avoid; page-break-after:avoid; }

    /* ── Prevent sections from splitting internally ── */
    #sec-auth { break-inside:avoid; page-break-inside:avoid; }

    /* ── Keep atomic elements whole — never split mid-card ── */
    .offer-callout, .roi-band, .comp-band, .rgs-price-band,
    .include-grid, .awards-row, .three-up, .rgs-grid,
    .feature-card, .rgs-card, .include-item, .step, .award-badge,
    .sig-atomic
      { break-inside:avoid; page-break-inside:avoid; }

    /* ── Keep headings attached to their first line of content ── */
    h2, h3, .section-badge { break-after:avoid; page-break-after:avoid; }

    /* ── P8: Agreement + Authorization — compress so the signature block and
           options card share the page with the agreement text ── */
    #sec-auth div[style*="max-width:620px"] p { font-size:11px !important; line-height:1.6 !important; margin-bottom:6px !important; }
    #sec-auth .lead { margin-bottom:12px !important; }
    .sig-rule { height:28px; }
    .sig-atomic > div:first-child { margin-bottom:24px !important; }
    .sig-atomic > div[style*="background:var(--black)"] { margin-top:24px !important; }
    /* The @page counter footer brands every printed page — the HTML footer line
       just orphans a blank final page, so hide it in print */
    .efelle-footer { display:none; }

    /* ════════════════════════════════
       GLOBAL SPACING — compress for print
    ════════════════════════════════ */
    .section    { padding:28px 48px; }
    .section h2 { font-size:22px; margin-bottom:6px; }
    .section .lead { margin-bottom:16px; font-size:13px; }

    /* ── P1: Letterhead + Hero ── */
    /* Letterhead: halve top/bottom padding so hero + about fit on fewer pages */
    #letterhead { padding-top:10px !important; padding-bottom:10px !important; }
    .hero         { padding:36px 48px 28px; }
    .hero h1      { font-size:24px; margin-bottom:14px; }
    .hero-sub     { font-size:13px; margin-bottom:24px; }
    .hero-proof   { gap:24px; padding-top:24px; }
    .hero-stat .num { font-size:34px; }
    .hero-stat .lbl { font-size:10px; }

    /* ── P2: About + SOW ── */
    #sec-about { padding-top:20px; padding-bottom:20px; }
    #sec-about p { font-size:11px !important; line-height:1.65 !important; margin-top:8px !important; }
    #sec-about div[style*="grid-template-columns"] { gap:18px !important; }
    #sec-about div[style*="flex-grow:1"] { padding-top:8px !important; gap:8px !important; }

    /* ── P3: The Offer ── */
    .offer-callout  { padding:20px 24px; margin-bottom:16px; }
    .offer-price    { font-size:36px; }
    .roi-band       { padding:16px 20px; }
    .roi-big        { font-size:40px; }
    .roi-copy       { font-size:13px; }
    .include-grid   { gap:10px; margin-bottom:18px; }
    .include-item   { padding:10px 14px; font-size:11px; }

    /* ── P4: RGS — tight enough that price band + core cards + 7 add-ons + ROI band share one page ── */
    .rgs-grid       { gap:5px; }
    #rgs-included-label { margin-top:6px !important; margin-bottom:4px !important; }
    .rgs-card       { padding:9px 11px; }
    .rgs-card-title { font-size:11px; }
    .rgs-card-desc  { font-size:9.5px; line-height:1.35; }
    .rgs-price-band { padding:8px 14px; margin-top:8px; }
    .rgs-price-val  { font-size:22px; }
    #sec-rgs h2     { font-size:24px; }
    #sec-rgs        { padding-top:12px; padding-bottom:12px; }
    #sec-rgs .lead  { margin-bottom:6px; }
    #rgs-addons     { margin-top:6px !important; }
    #rgs-addons > div:first-child { margin-bottom:4px !important; }
    #rgs-addons > div[style*="background"] { padding:2px 20px !important; }
    .addon-row      { padding:4px 0 !important; }
    .addon-row > div[style*="flex:1"] { line-height:1.22 !important; }
    .addon-row > div[style*="flex:1"] span:last-child { font-size:10px !important; }
    .addon-group-label { padding:4px 0 1px !important; }
    #rgs-scale-note { margin-top:4px !important; font-size:10px !important; }
    #sec-rgs .roi-band { margin-top:8px !important; padding:8px 14px !important; }

    /* ── P5: Why efelle ── */
    .awards-row           { margin-bottom:16px; }
    .award-badge          { padding:14px 12px; }
    .award-badge .award-num { font-size:34px; }
    .comp-band            { padding:18px 22px; margin-bottom:12px; }
    .comp-rev             { font-size:24px; }

    /* ── P6: Portfolio — 3 stacked images, each capped so all fit on one page ── */
    #sec-portfolio { padding-top:24px; padding-bottom:24px; }
    #sec-portfolio div[style*="flex-direction:column"] { gap:12px !important; margin-top:16px !important; }
    /* Container: let it shrink to image size, center it, remove overflow:hidden so no clipping */
    #sec-portfolio div[style*="border-radius:14px"] {
      overflow:visible !important;
      display:flex !important;
      justify-content:center !important;
      background:transparent !important;
      box-shadow:none !important;
      border:none !important;
    }
    #sec-portfolio img {
      width:auto !important;
      max-width:100% !important;
      max-height:260px !important;
      height:auto !important;
      display:block !important;
      border:1px solid var(--gray-4) !important;
      border-radius:10px !important;
      box-shadow:0 1px 4px rgba(0,0,0,0.06) !important;
    }

    /* ── P7: Process + Built For (paired) ── */
    #sec-process { padding-top:24px; padding-bottom:20px; }
    .step         { padding:10px 0; }
    .step-num     { width:28px; height:28px; font-size:11px; }
    .step-content h3 { font-size:13px; }
    .step-content p  { font-size:11px; }
    #sec-built    { padding-top:20px; padding-bottom:20px; }
    .three-up     { gap:10px; }
    .feature-card { padding:16px; }
    .feature-card h3 { font-size:12px; }
    .feature-card p  { font-size:11px; }

    /* ── P8: Authorization ── */
    #sec-auth h2  { font-size:20px; }
    #sec-auth .lead { margin-bottom:20px !important; }
    /* Hide absolute-positioned logo in print — it overlaps the heading */
    /* efelle circle logo visible in print — positioned top-right of auth section */
  }
</style>
</head>
<body>

<!-- LETTERHEAD -->
<div id="letterhead" style="background:var(--white); padding:20px 52px; display:flex; justify-content:space-between; align-items:center;">
  <div style="font-size:12px; font-weight:700; color:var(--gray-2); letter-spacing:0.12em; text-transform:uppercase;">efelle creative</div>
  <div style="font-size:10px; color:var(--gray-2); letter-spacing:0.04em;">efelle.com &nbsp;|&nbsp; 206.384.4909</div>
</div>

<!-- HERO -->
<div class="hero">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
    <div class="hero-badge" style="margin-bottom:0;">[[HERO_ICON]] [[HERO_BADGE_TEXT]]</div>
    <div style="font-size:11px; font-weight:600; color:rgba(255,255,255,0.5); letter-spacing:0.06em;">[[DATE]]</div>
  </div>
  <h1>[[HERO_H1]]</h1>
  <p class="hero-sub">[[HERO_SUB]]</p>
  <div class="hero-proof">
    <div class="hero-stat"><div class="num">21</div><div class="lbl">Years building our<br>clients' revenue</div></div>
    <div class="hero-stat"><div class="num">150+</div><div class="lbl">International UX<br>design awards</div></div>
    <div class="hero-stat"><div class="num">4.7<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" style="width:20px;height:20px;vertical-align:middle;margin-left:1px;margin-bottom:4px;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div><div class="lbl">Rating on Google<br>&amp; 5<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(255,255,255,0.45)" style="width:11px;height:11px;vertical-align:middle;margin-bottom:2px;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg> on Clutch</div></div>
    <div class="hero-stat"><div class="num"><span>223%</span></div><div class="lbl">Avg. client revenue<br>growth over 24 mo.</div></div>
  </div>
</div>

<!-- ABOUT + SOW -->
<div class="section" id="sec-about">
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px;">
    <div style="display:flex; flex-direction:column; padding:0 6%;">
      <div>
        <span class="section-badge">About [[CLIENT_NAME]]</span>
        <p style="font-size:13px; color:var(--gray-1); line-height:1.75; margin-top:8px; font-weight:700;">[[ABOUT_P1]]</p>
        <p style="font-size:13px; color:var(--gray-1); line-height:1.75; margin-top:14px;">[[ABOUT_P2]]</p>
      </div>
      <div style="text-align:center; flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding-top:24px; gap:12px;">
        [[CLIENT_LOGO]]
        [[ADDRESS]]
      </div>
    </div>
    <div style="padding:0 6%;">
      <span class="section-badge">Scope of Work Overview</span>
      <p style="font-size:12px; color:var(--gray-1); line-height:1.75; margin-top:8px;">[[SOW_P1]]</p>
      <p style="font-size:12px; color:var(--gray-1); line-height:1.75; margin-top:14px;">[[SOW_P2]]</p>
      <p style="font-size:12px; color:var(--gray-1); line-height:1.75; margin-top:14px;">[[SOW_P3]]</p>
      <p style="font-size:12px; color:var(--gray-1); line-height:1.75; margin-top:14px;">[[SOW_P4]]</p>
      [[SOW_P5_BLOCK]]
    </div>
  </div>
</div>

<!-- THE OFFER -->
<div class="section" id="sec-offer">
  <span class="section-badge">The Offer</span>
  <h2>[[OFFER_H2]]</h2>
  <p class="lead">[[OFFER_LEAD]]</p>
  <div class="offer-callout">
    <div class="offer-price-block">
      <div class="offer-price">[[WEBSITE_PRICE]]</div>
      <div class="offer-price-label">[[OFFER_PRICE_LABEL]]</div>
      [[OFFER_SECONDARY_BLOCK]]
    </div>
    <div class="offer-divider"></div>
    <div class="offer-text">
      [[OFFER_TEXT]]
    </div>
  </div>
  <div style="background:var(--gray-5); border-radius:12px; padding:24px 28px; margin-bottom:28px;">
    <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--orange); margin-bottom:16px;">Payment Breakdown</div>
    <div style="display:flex; flex-direction:column; gap:0;">
      [[PAYMENT_ROWS]]
    </div>
  </div>
  [[INCLUDES_GRID]]
</div>

<!-- ═══ DIGITAL MARKETING ═══ -->
<div class="section" id="sec-rgs">
  [[RGS_BADGE]]
  <span class="section-badge">Revenue Growth Service (RGS)</span>
  <h2>[[RGS_H2]]</h2>
  <p class="lead">[[RGS_LEAD]]</p>

  <div class="rgs-price-band" style="align-items:flex-start;">
    <div>
      <div class="rgs-price-label">Monthly RGS Program</div>
      <div class="rgs-price-val" style="color:var(--orange);">[[RGS_FROM]][[RGS_PRICE]]<span style="font-size:16px; font-weight:400; color:var(--gray-2);">/month</span></div>
      <div class="rgs-price-note" style="margin-top:6px; font-size:10px; color:rgba(58,58,60,0.7);">+ AdSpend paid to Google</div>
      <div class="rgs-price-note" style="margin-top:8px;">Full lead-generation program team...</div>
    </div>
    <div style="text-align:right;">
      <div class="rgs-price-label" style="text-align:right;">Compare to a full-time hire:</div>
      <div class="rgs-price-val"><span style="position:relative; display:inline-block;">$150,000<span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:1.4em; font-weight:900; color:var(--orange); opacity:0.85; pointer-events:none; line-height:1;">\u2715</span></span><span style="font-size:16px; font-weight:400;">/year</span></div>
      <div class="rgs-price-note" style="text-align:right; margin-top:6px; font-size:10px; color:rgba(58,58,60,0.7);">+ AdSpend paid to Google</div>
      <div class="rgs-price-note" style="text-align:right; margin-top:8px;">...at a fraction of a single marketing hire</div>
    </div>
  </div>

  <div id="rgs-included-label" style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--gray-2); margin-top:20px; margin-bottom:12px;">Your Program Includes</div>
  <div class="rgs-grid">
    [[RGS_MAIN_CARDS]]
  </div>

  <div id="rgs-addons" style="margin-top:24px;">
    <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--gray-2); margin-bottom:12px;">Optional Add-Ons</div>
    <div style="background:var(--black); border-radius:14px; padding:6px 22px;">
      [[RGS_ADDON_CARDS]]
    </div>
    <div id="rgs-scale-note" style="margin-top:10px; font-size:11px; color:var(--gray-2); line-height:1.5;"><strong style="color:var(--black);">Need more leads?</strong> We can scale your program by adding additional advertising channels, service areas and lead-response tools as your business grows.</div>
  </div>

  <div class="roi-band" style="margin-top:24px;">
    <div class="roi-big">223%</div>
    <div class="roi-copy"><strong>Average client revenue growth over 24 months</strong> on our digital marketing program. That's not a claim — it's the result of pairing a great website with a consistent, well-managed marketing program. You see new leads quickly. You see the ROI fast. You stay.</div>
  </div>
</div>

<!-- WHY EFELLE -->
<div class="section" id="sec-why">
  <span class="section-badge">Why efelle</span>
  <h2>Not just another agency.<br><em>Experts with 21 years of success.</em></h2>
  <p class="lead">[[WHY_LEAD]]</p>
  <div class="awards-row">
    <div class="award-badge"><span class="award-num">21</span>Years in Business</div>
    <div class="award-badge"><span class="award-num">150+</span>International UX Awards</div>
    <div class="award-badge"><span class="award-num">1,100+</span>Projects Built</div>
  </div>
  <div class="awards-row" style="margin-top:-10px;">
    <div class="award-badge" style="font-size:11px;"><span class="award-num" style="font-size:38px;">98.4%</span>Client Retention Rate</div>
  </div>
  <p style="font-size:15px; font-weight:500; color:var(--black); line-height:1.75; margin-bottom:20px;">[[WHY_INTRO]]</p>

  <!-- TRUST AWARDS PANEL -->
  <div style="background:var(--gray-5); border-radius:14px; padding:24px 28px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-around; gap:24px; flex-wrap:wrap;">
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; flex:1; min-width:160px;">
      <img src="https://www.seattlewebdesign.com/uploads/_proposal/award1-inc500.png" alt="Inc 5000" style="height:67px; width:auto; display:block;">
      <div>
        <div style="font-size:11px; font-weight:800; color:var(--black); line-height:1.4;">Inc. 5000</div>
        <div style="font-size:10px; color:var(--gray-2); margin-top:2px; line-height:1.4;">2\u00d7 Winner — Fastest Growing<br>Companies in the USA</div>
      </div>
    </div>
    <div style="width:1px; height:48px; background:var(--gray-4);"></div>
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; flex:1; min-width:160px;">
      <img src="https://www.seattlewebdesign.com/uploads/_proposal/award2-psbj.png" alt="PSBJ" style="height:67px; width:auto; display:block;">
      <div>
        <div style="font-size:11px; font-weight:800; color:var(--black); line-height:1.4;">PSBJ</div>
        <div style="font-size:10px; color:var(--gray-2); margin-top:2px; line-height:1.4;">3\u00d7 Winner: Top 100 Fastest Growing<br>Private Companies in WA</div>
      </div>
    </div>
    <div style="width:1px; height:48px; background:var(--gray-4);"></div>
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; flex:1; min-width:160px;">
      <img src="https://www.seattlewebdesign.com/uploads/_proposal/award3-clutch.png" alt="Clutch" style="height:67px; width:auto; display:block;">
      <div>
        <div style="font-size:11px; font-weight:800; color:var(--black); line-height:1.4;">Clutch</div>
        <div style="font-size:10px; color:var(--gray-2); margin-top:2px; line-height:1.4;">Top Digital Marketing Agency<br>65, <span style="color:var(--gray-2);">&#9733;&#9733;&#9733;&#9733;&#9733;</span> reviews</div>
      </div>
    </div>
  </div>

  <div class="comp-band">
    <div class="comp-label">[[STATS_LABEL]]</div>
    <div class="comp-row">
      <div class="comp-item"><div class="comp-rev">62%</div><div class="comp-name" style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:400; line-height:1.5; margin-top:8px;">of [[STATS_INDUSTRY]] say finding new clients is their #1 challenge</div><div class="comp-lbl" style="margin-top:8px;">Source: zipdo</div></div>
      <div class="comp-item"><div class="comp-rev">200%</div><div class="comp-name" style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:400; line-height:1.5; margin-top:8px;">average ROI from paid digital advertising for [[STATS_INDUSTRY]]</div><div class="comp-lbl" style="margin-top:8px;">Source: WordStream / Coalmarch</div></div>
      <div class="comp-item"><div class="comp-rev">86%</div><div class="comp-name" style="color:rgba(255,255,255,0.85); font-size:12px; font-weight:400; line-height:1.5; margin-top:8px;">of consumers read online reviews before choosing a local service business</div><div class="comp-lbl" style="margin-top:8px;">Source: BrightLocal</div></div>
    </div>
  </div>
  <p style="font-size:15px; font-weight:500; color:var(--black); line-height:1.75; margin-top:20px; text-align:center;">[[WHY_CLOSING]]</p>
  <p style="font-size:17px; font-weight:800; color:var(--orange); text-align:center; margin-top:16px; display:flex; align-items:center; justify-content:center; gap:8px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>That's exactly what efelle will build <span style="position:relative; display:inline-block;">you!<svg viewBox="0 0 40 8" xmlns="http://www.w3.org/2000/svg" style="position:absolute; bottom:-5px; left:0; width:80%; height:8px;"><path d="M2 6 Q20 1 38 6" stroke="var(--orange)" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg></span></p>
</div>

<!-- PORTFOLIO -->
<div class="section" id="sec-portfolio">
  <span class="section-badge">Some of Our Work</span>
  <h2>[[PORTFOLIO_H2]]</h2>
  <p class="lead">[[PORTFOLIO_LEAD]]</p>
  <div style="display:flex; flex-direction:column; gap:24px; margin-top:28px;">
    <div style="border:1px solid var(--gray-4); border-radius:14px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);"><img src="[[PORTFOLIO_IMG1]]" alt="[[CLIENT_NAME]] portfolio" style="width:100%; height:auto; display:block;"></div>
    <div style="border:1px solid var(--gray-4); border-radius:14px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);"><img src="[[PORTFOLIO_IMG2]]" alt="[[CLIENT_NAME]] portfolio" style="width:100%; height:auto; display:block;"></div>
    [[PORTFOLIO_IMG3_BLOCK]]
    [[PORTFOLIO_IMG4_BLOCK]]
  </div>
</div>

<!-- BUILT FOR -->
<div class="section" id="sec-built">
  <span class="section-badge">[[BUILT_BADGE]]</span>
  <h2>[[BUILT_H2]]</h2>
  <p class="lead">[[BUILT_LEAD]]</p>
  [[FEATURE_CARDS]]
  [[SITEMAP_HTML]]
</div>

<!-- HOW IT WORKS -->
<div class="section" id="sec-process" style="background:var(--gray-5);">
  <span class="section-badge">The Process</span>
  <h2>[[PROCESS_H2]]</h2>
  <p class="lead">[[PROCESS_LEAD]]</p>
  <div class="process-steps">
    [[PROCESS_STEPS_HTML]]
  </div>
  <!-- COMBINED TIMELINE BOX -->
  <div style="margin-top:28px; background:var(--white); border:1px solid var(--gray-4); border-radius:12px; padding:28px;">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="width:44px; height:44px; border-radius:50%; background:var(--orange); display:flex; align-items:center; justify-content:center; margin:0 auto 12px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
      <div style="font-size:16px; font-weight:800; color:var(--black); letter-spacing:-0.01em;">Estimated Project Timeline: [[PROCESS_TIMELINE]]</div>
      <div style="font-size:12px; color:var(--gray-2); margin-top:4px;">Actual schedule provided during Project Kickoff Meeting</div>
    </div>
    <!-- BUILD_CALENDAR_START -->
    <div style="border-top:1px solid var(--gray-4); padding-top:20px;">
      <div style="font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--orange); margin-bottom:16px; text-align:center;">Project &amp; Launch Timeline — At a Glance</div>
      <svg viewBox="-2 0 684 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
        <defs>
          <style>
            .cal-month { font-family:'Plus Jakarta Sans',sans-serif; font-size:9px; font-weight:700; fill:#3A3A3C; letter-spacing:0.08em; text-transform:uppercase; }
            .cal-wk    { font-family:'Plus Jakarta Sans',sans-serif; font-size:7px; fill:#636366; letter-spacing:0.04em; }
            .cal-sub   { font-family:'Plus Jakarta Sans',sans-serif; font-size:7px; fill:#636366; }
          </style>
        </defs>

        <!-- MONTH HEADERS -->
        <text x="110" y="12" text-anchor="middle" class="cal-month">Month 1</text>
        <text x="340" y="12" text-anchor="middle" class="cal-month">Month 2</text>
        <text x="570" y="12" text-anchor="middle" class="cal-month">Month 3</text>

        <!-- MONTH 1 GRID -->
        <rect x="0"   y="20" width="54" height="44" rx="4" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="0.75"/>
        <rect x="56"  y="20" width="54" height="44" rx="4" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="0.75"/>
        <rect x="112" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <rect x="168" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <text x="27"  y="35" text-anchor="middle" class="cal-wk">WK 1</text>
        <text x="83"  y="35" text-anchor="middle" class="cal-wk">WK 2</text>
        <text x="139" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 3</text>
        <text x="195" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 4</text>
        <text x="27"  y="50" text-anchor="middle" class="cal-sub">Discovery</text>
        <text x="83"  y="50" text-anchor="middle" class="cal-sub">Content</text>
        <text x="83"  y="59" text-anchor="middle" class="cal-sub">Building</text>
        <text x="139" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">Design</text>
        <text x="195" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">Build</text>
        <text x="195" y="59" text-anchor="middle" class="cal-sub" fill="#F56300">Begins</text>

        <!-- MONTH 2 GRID -->
        <rect x="230" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <rect x="286" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <rect x="342" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <rect x="398" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <text x="257" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 1</text>
        <text x="313" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 2</text>
        <text x="369" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 3</text>
        <text x="425" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 4</text>
        <text x="257" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">Dev</text>
        <text x="257" y="59" text-anchor="middle" class="cal-sub" fill="#F56300">Continues</text>
        <text x="313" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">QA &amp;</text>
        <text x="313" y="59" text-anchor="middle" class="cal-sub" fill="#F56300">Testing</text>
        <text x="369" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">Content</text>
        <text x="425" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">Launch</text>
        <text x="425" y="59" text-anchor="middle" class="cal-sub" fill="#F56300">Prep</text>

        <!-- MONTH 3 GRID -->
        <rect x="460" y="20" width="54" height="44" rx="4" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <rect x="516" y="20" width="54" height="44" rx="4" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="0.75"/>
        <rect x="572" y="20" width="54" height="44" rx="4" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="0.75"/>
        <rect x="628" y="20" width="54" height="44" rx="4" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="0.75"/>
        <text x="487" y="35" text-anchor="middle" class="cal-wk" fill="#F56300" font-weight="700">WK 1</text>
        <text x="543" y="35" text-anchor="middle" class="cal-wk">WK 2</text>
        <text x="599" y="35" text-anchor="middle" class="cal-wk">WK 3</text>
        <text x="655" y="35" text-anchor="middle" class="cal-wk">WK 4</text>
        <text x="487" y="50" text-anchor="middle" class="cal-sub" fill="#F56300">Launch</text>
        <text x="487" y="59" text-anchor="middle" class="cal-sub" fill="#F56300">Day</text>
        <text x="543" y="50" text-anchor="middle" class="cal-sub">RGS</text>
        <text x="543" y="59" text-anchor="middle" class="cal-sub">Starts</text>
        <text x="599" y="50" text-anchor="middle" class="cal-sub">Leads</text>
        <text x="655" y="50" text-anchor="middle" class="cal-sub">Growing</text>

        <!-- ARROW 1: M1/WK3 → M1/WK4 (phase transition: discovery/content → design/build) -->
        <line x1="139" y1="72" x2="195" y2="72" stroke="#F56300" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3"/>
        <polygon points="189,69 195,72 189,75" fill="#F56300"/>

        <!-- ARROW 2: M2/WK4 → M3/WK1 -->
        <line x1="425" y1="72" x2="481" y2="72" stroke="#F56300" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3"/>
        <polygon points="475,69 481,72 475,75" fill="#F56300"/>

        <!-- LEGEND -->
        <rect x="140" y="90" width="10" height="10" rx="2" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="0.75"/>
        <text x="154" y="99" class="cal-sub">Planning / QA / Launch</text>
        <rect x="295" y="90" width="10" height="10" rx="2" fill="#FFF4EE" stroke="#F56300" stroke-width="1.5"/>
        <text x="309" y="99" class="cal-sub">Website build phase</text>
        <line x1="440" y1="95" x2="458" y2="95" stroke="#F56300" stroke-width="2" stroke-dasharray="3 2"/>
        <polygon points="458,92 464,95 458,98" fill="#F56300"/>
        <text x="468" y="99" class="cal-sub">Phase transition</text>

        <!-- DISCLAIMER -->
        <text x="340" y="120" text-anchor="middle" class="cal-sub" fill="#9CA3AF">Timeline is estimated. Actual schedule confirmed at kickoff.</text>
      </svg>
    </div>
    <!-- BUILD_CALENDAR_END -->
  </div>
</div>

<!-- PROJECT AGREEMENT + AUTHORIZATION — single section, no page break between -->
<div class="section" id="sec-auth" style="background:var(--white); border-bottom:none; padding-top:48px;">

  <!-- PROJECT AGREEMENT — white, no box -->
  <div style="display:flex; justify-content:space-between; align-items:center;">
    <div style="flex:1;">
      <span class="section-badge">Project Agreement</span>
      <h2>Let's get started!<br><em>Sign below to kick things off:</em></h2>
    </div>
    <div style="flex-shrink:0; margin-left:24px;">
      <img src="https://www.seattlewebdesign.com/uploads/_proposal/portfolio/e-logo-1.png" alt="efelle creative" style="height:63px; width:auto; display:block;">
    </div>
  </div>
  <div style="font-size:12px; color:var(--gray-1); line-height:1.6; margin-bottom:24px; max-width:620px;">
    [[AGREEMENT_BODY]]
  </div>

  <!-- AUTHORIZATION TO PROCEED — gray background, full width, logo inside -->
  <div style="background:var(--gray-5); margin:0 -64px 0 -64px; padding:28px 64px 21px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="flex:1;">
        <span class="section-badge">Authorization to Proceed</span>
        <p class="lead" style="margin-bottom:20px;">[[AUTH_LEAD]]</p>
      </div>
    </div>

    <div style="background:rgba(245,99,0,0.06); border:1px solid rgba(245,99,0,0.2); border-radius:8px; padding:13px 16px; margin-bottom:20px; display:flex; align-items:center; gap:10px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F56300" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <div style="font-size:11px; color:var(--gray-1);"><strong style="color:var(--orange);">Proposal valid through [[EXPIRY]].</strong> Pricing and terms are subject to change after this date.</div>
    </div>

    <!-- Signature grid: columns TOP-aligned so the COMPANY and SIGNATURE eyebrows
         share one line and the client name aligns with the company name; the space
         under the signer's name holds the signature + date rules (one baseline).
         .sig-atomic keeps signature + verification + options card on one printed page. -->
    <div class="sig-atomic">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 48px; align-items:start; margin-bottom:40px;">
      <div>
        <div class="sig-eyebrow">Company</div>
        <div style="font-size:13px; color:var(--gray-1); line-height:1.6;">
          [[CLIENT_NAME]]<br>
          [[CLIENT_ADDRESS]]<br>
          [[CLIENT_WEBSITE]]<br>
          [[CLIENT_PHONE]]
        </div>
      </div>
      <div>
        <div class="sig-eyebrow">Signature</div>
        <div style="font-size:13px; color:var(--gray-1); line-height:1.6;">[[CONTACT_NAME]]</div>
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:0 24px;">
          <div class="sig-rule" id="sig-line-signature"></div>
          <div class="sig-rule" id="sig-line-date"></div>
          <div class="sig-caption">Signature</div>
          <div class="sig-caption">Date</div>
        </div>
      </div>
    </div>
    <div id="sig-verification"></div>

    <div style="background:var(--black); border-radius:12px; padding:16px 24px; margin-top:40px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
      [[PROGRAM_SUMMARY_BLOCK]]
      <div style="text-align:right;">
        <div style="font-size:11px; color:rgba(255,255,255,0.6); margin-bottom:2px;">Questions? Reach us at</div>
        <div style="font-size:13px; font-weight:700; color:var(--orange);">206.384.4909</div>
      </div>
    </div>
    </div>
  </div>
</div>

<div class="efelle-footer" style="padding:3px 52px 10px; text-align:center; font-size:10px; color:var(--gray-2); letter-spacing:0.04em; line-height:1.6;">
  efelle creative &nbsp;//&nbsp; 901 5th Ave., Suite 1950 &nbsp;//&nbsp; Seattle, WA 98164 USA &nbsp;//&nbsp; 206.384.4909 &nbsp;//&nbsp; efelle.com
</div>

</body>
</html>`;

export const FEATURE_ICONS = {
  "monitor": "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"></rect><line x1=\"8\" y1=\"21\" x2=\"16\" y2=\"21\"></line><line x1=\"12\" y1=\"17\" x2=\"12\" y2=\"21\"></line>",
  "image": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"></rect><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"></circle><polyline points=\"21 15 16 10 5 21\"></polyline>",
  "map-pin": "<path d=\"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\"></path><circle cx=\"12\" cy=\"10\" r=\"3\"></circle>",
  "shield": "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"></path>",
  "check-square": "<polyline points=\"9 11 12 14 22 4\"></polyline><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"></path>",
  "smartphone": "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"2\" ry=\"2\"></rect><line x1=\"12\" y1=\"18\" x2=\"12.01\" y2=\"18\"></line>",
  "alert-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"></line><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"></line>",
  "tool": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"></path>",
  "cloud-rain": "<line x1=\"16\" y1=\"13\" x2=\"16\" y2=\"21\"></line><line x1=\"8\" y1=\"13\" x2=\"8\" y2=\"21\"></line><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"23\"></line><path d=\"M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25\"></path>",
  "thermometer": "<path d=\"M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z\"></path>",
  "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"></rect><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"></line><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"></line><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"></line>",
  "layout": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"></rect><line x1=\"3\" y1=\"9\" x2=\"21\" y2=\"9\"></line><line x1=\"9\" y1=\"21\" x2=\"9\" y2=\"9\"></line>",
  "star": "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"></polygon>",
  "trending-up": "<polyline points=\"23 6 13.5 15.5 8.5 10.5 1 18\"></polyline><polyline points=\"17 6 23 6 23 12\"></polyline>",
};
