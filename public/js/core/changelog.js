// ---------------------------------------------------------------------------
// Changelog / Update Log
// ---------------------------------------------------------------------------

const CHANGELOG = [
  {
    version: '4.12.0',
    date: '2026-08-13',
    title: 'New Engine: Generate Sales Notes',
    changes: [
      'New home-screen tool: upload discovery files (PDF, TXT, MD, CSV, screenshots — up to 6 files / 15 MB) and/or paste notes, and get a formatted Sales Notes handoff doc in efelle\'s standard format',
      'Strictly source-grounded: the report contains only information found in your material — unknown fields show a dash, nothing is invented',
      'Download as HTML or server-rendered PDF (named "Sales Notes - {Company}") — ready to drop into Basecamp',
      'Reports auto-save to the Library under the new Sales Notes type',
    ]
  },
  {
    version: '4.11.0',
    date: '2026-08-13',
    title: 'Logo Preview & Reliability Fixes',
    changes: [
      'Live logo preview in Client Details: the moment a logo URL is filled (by research or by hand), you see the actual image on both white and dark backgrounds — with a clear warning if the URL doesn\'t load',
      'FIXED: logos were invisible in the Print window, server PDFs, and downloaded HTML files — a security header was silently blocking our hosted logo images on those surfaces (they always worked on the published link)',
      'Click-to-sign now auto-retries if it hits a brief server restart — prospects see "retrying…" instead of a false "Failed"',
      'Fixed: proposals opened from the Library now restore their vertical/type, so Edit → Update Address / Details works instead of erroring',
      'Logo detection hardened for bot-protected sites (fuller browser headers) with a verified Clearbit logo-index fallback — never guessed, only used if the image actually loads',
    ]
  },
  {
    version: '4.10.0',
    date: '2026-08-13',
    title: 'No-Website Research, Email Intro & Cleaner Toolbar',
    changes: [
      'New research toggle: "No website — research online" researches leads without a site via their Google Business Profile, Facebook, Yelp, and directory listings — enter the company name (and city) and click Research Client',
      'New ✉️ Email button: publishes/refreshes the proposal link and opens a pre-written intro email with signing instructions — fully editable before you send',
      'Toolbar streamlined: Edit ▾ menu (Add Logo, Edit with AI, Update Address / Details) and Download ▾ menu (PDF, HTML); Print and Publish Link unchanged',
    ]
  },
  {
    version: '4.9.1',
    date: '2026-08-13',
    title: 'Official Signature Rendering',
    changes: [
      'When a prospect accepts a hosted proposal, their typed name now renders in script on the signature line and the date fills the date line',
      'A verification line appears under the signature: full timestamp (Pacific Time), the signer\'s IP address, and a reference ID',
      'The signed record prints — save the accepted proposal as PDF for your files',
    ]
  },
  {
    version: '4.9.0',
    date: '2026-08-13',
    title: 'Hosted Proposal Links, Open Tracking & Click-to-Sign',
    changes: [
      'New "Publish Link" button hosts the proposal at a shareable, unguessable URL (prospector.efelle.com/p/…) — send prospects a link instead of an attachment',
      'Open tracking: every open of the link is counted with a timestamp — view count and last-opened time show in the app (note: your own opens count too)',
      'Click-to-sign: prospects type their name, confirm authorization, and accept right on the proposal — the acceptance (name, date, IP) is recorded and an ACCEPTED banner appears',
      'Re-publishing after edits updates the live copy at the same URL; acceptance and view history are preserved',
      'Links are private-by-obscurity (long random tokens), hidden from search engines, and rate-limited',
    ]
  },
  {
    version: '4.8.0',
    date: '2026-08-13',
    title: 'Case Study Manager & One-Click PDF',
    changes: [
      'New "RGS Case Studies" manager in Settings — add, remove, reorder, and relabel the case-study graphics on RGS Only proposals without a code change',
      'Case-study changes apply to newly generated proposals immediately (stored on the server, survives deploys)',
      'New "Download PDF" button renders the proposal to PDF on the server — identical pagination every time, no browser print dialog',
      'The old print-dialog flow remains available as "Print / Save as PDF"',
    ]
  },
  {
    version: '4.7.1',
    date: '2026-08-13',
    title: 'WO Agreement Copy Fix',
    changes: [
      'Work Order proposals\' agreement page now matches the payment breakdown: 50% deposit / 50% at the 45-day milestone (it previously showed the new-website "24 months interest-free" plan and a hosting fee that don\'t apply to WOs)',
      'WO agreement copy rewritten for an updates engagement: scope description, client responsibilities, and ownership language ("you retain full ownership of your website and content")',
    ]
  },
  {
    version: '4.7.0',
    date: '2026-08-13',
    title: 'Hosted Logos — No More Base64 Bloat',
    changes: [
      'Client logos are now stored on the Prospector server and referenced by a small URL instead of being embedded as base64 — downloaded proposals drop from ~1 MB to ~100 KB',
      'Applies to both researched logo URLs and manually uploaded logo files',
      'Re-uploading the same logo reuses the same stored file (no duplicates)',
      'If hosting fails, the proposal falls back to the client\'s original logo URL — never a giant embedded blob',
      'Smaller files also mean faster AI Editor turnaround and lighter report library storage',
    ]
  },
  {
    version: '4.6.1',
    date: '2026-08-12',
    title: 'AI Editor Overhaul & Address Fix',
    changes: [
      'Fixed: AI Editor could only see the first part of the proposal (embedded images were crowding out the later pages) — it now sees the whole document, so edits to the agreement/signature page work',
      'AI Editor now replaces every occurrence of a value — "change the price everywhere" actually changes it everywhere',
      'Honest results: the editor reports exactly how many changes landed and warns when one couldn\'t find its target (no more false "✓ applied")',
      'Editor tolerates common mismatches (& vs &amp;, curly vs straight apostrophes) when locating text',
      'Fixed: page-1 address block now appends City, State when the researched address is street-only',
    ]
  },
  {
    version: '4.6.0',
    date: '2026-07-28',
    title: 'Smart Logo Background & PDF Polish',
    changes: [
      'Client logos with substantial white areas automatically get a dark backdrop so they stay visible on the white page',
      'Client logo is now embedded directly into the proposal file (works even when the client\'s site blocks cross-site image loading)',
      'Full-time hire comparison figure updated from $85,000 to $150,000/year',
      'META Ads card renamed to "META Ads [Facebook & Instagram]"',
      'RGS Only print layout: add-ons + ROI band get their own page (no more stranded ROI bar), and the process timeline box now shows a 5-phase program launch strip',
      'Copy fixes: About section handles descriptive service-area text; RGS Only copy drops contractor language ("booked work") when the Other vertical is selected',
      'Fixed empty Scope of Work paragraph and the invisible underline in the signature Company block',
    ]
  },
  {
    version: '4.5.1',
    date: '2026-07-28',
    title: 'Logo URL Hallucination Fix',
    changes: [
      'Fixed: Research Client could fill in an AI-invented logo URL that doesn\'t exist (e.g. a fake /wp-content/ path)',
      'The homepage logo scraper now actually works — the server was stripping all HTML before the scraper could read it',
      'Logo scraper also handles lazy-loaded images (data-src / srcset)',
      'Every logo URL is now verified to load before it\'s filled in; unverifiable AI suggestions are discarded with a clear warning',
      'Status messages now say where the logo came from (homepage source vs. AI research)',
    ]
  },
  {
    version: '4.5.0',
    date: '2026-07-28',
    title: 'RGS Case Study Pages',
    changes: [
      'RGS Only proposals now include two pages of real digital marketing results — SKR, Kryptek, Copendium, and Humble case-study graphics, two per page',
      'Case studies use the same image-card format as the website portfolio and print one page each',
      'Images are embedded directly into the proposal file, so downloads and PDFs are self-contained',
    ]
  },
  {
    version: '4.4.0',
    date: '2026-07-28',
    title: 'Other Vertical & RGS Content Updates',
    changes: [
      'New "Other" industry vertical for companies outside home services — fully neutral proposal copy with no home-services verbiage anywhere',
      'With Other selected, shared copy (RGS cards, add-ons, buyer-journey language) is automatically neutralized too',
      'RGS Only proposals now highlight ongoing website content updates as part of the program (scope of work, offer, RGS card, process steps, agreement)',
      'RGS case-study section scaffolded for RGS Only proposals — will replace the website portfolio once client case-study graphics are added',
    ]
  },
  {
    version: '4.3.0',
    date: '2026-07-28',
    title: 'RGS Only Proposals',
    changes: [
      'New "RGS Only" proposal type is now live — for prospects who already have a solid website and just want leads',
      'Proposal leads with the monthly Revenue Growth Service: marketing-focused scope of work, monthly-price offer, and RGS onboarding process (campaigns live in 2–3 weeks)',
      'Payment breakdown shows the monthly program fee, three-month minimum term, and ad-spend note — no website pricing',
      'Website-build sections (portfolio, feature cards, site architecture, build calendar) are automatically left out',
      'Agreement & signature page copy rewritten for marketing-only engagements',
      'Fixed: proposals using "Optional" RGS mode were dropping the RGS section entirely instead of moving it before the signature page',
    ]
  },
  {
    version: '4.2.0',
    date: '2026-03-29',
    title: 'Searchable Client Dropdowns & User Guide',
    changes: [
      'Added searchable client dropdown to Strategy Builder and Proposal Builder',
      'Type-ahead search by company name across all report types',
      'Added User Guide link in header (opens in new tab)',
      'Added Update Log (this panel)',
      'Login text updated to "prospector" branding',
    ]
  },
  {
    version: '4.1.0',
    date: '2026-03-29',
    title: 'W.A.R. Report Enhancements & Anti-Hallucination',
    changes: [
      'Ground-truth verification: scrapes actual pages to cross-check Gemini claims',
      'Eliminates fabricated addresses, phone numbers, and location data',
      'Homepage screenshots captured with Apple device mockups (MacBook + iPhone)',
      'Screenshots saved as server files (not base64) for smaller library size',
      'Strict scoring rubric with hard caps for each category',
      'Auto-discover sitemaps from standard URLs',
      'Auto-detect company name and industry from website content',
      'One-click full audit: Lookup → Gemini → Claude → Report (no manual steps)',
      'Report eyebrow updated to "Website Audit & Recommendations (W.A.R.) Report"',
      'Executive summary split into assessment + recommendation paragraphs',
    ]
  },
  {
    version: '4.0.0',
    date: '2026-03-28',
    title: 'Modular Web App & Production Deployment',
    changes: [
      'Rebuilt from single HTML file into modular Node.js web app (25+ files)',
      'Server-side API proxy — API keys never touch the browser',
      'Deployed to Railway with custom domain (prospector.efelle.com)',
      'Persistent storage volume for reports library',
      'Three user accounts with report attribution (Fred, Doug, Christian)',
      'Gemini one-click integration on all engines (no more copy/paste)',
      'Google Search grounding enabled for accurate web research',
      'Edit with AI on all 4 engines (find-and-replace approach)',
      'Save as PDF on all engines',
      'Report Library with type/user filters and search',
      'Server-side rate limit handling with auto-retry and staggering',
      'Health check endpoint for zero-downtime deploys',
      'Security hardening: helmet.js, rate limiting, session auth',
    ]
  },
  {
    version: '3.5.0',
    date: '2026-03-27',
    title: 'Original Bug Fixes',
    changes: [
      'Fixed getApiHeaders() not including x-api-key in HTML mode (401 errors)',
      'Fixed artifact mode hanging on API calls',
      'Added retry logic with exponential backoff for 429 rate limits',
      'Staggered parallel report generation to avoid rate limit spikes',
    ]
  },
];

function showChangelog() {
  const overlay = document.getElementById('changelog-overlay');
  const container = document.getElementById('changelog-entries');
  if (!overlay || !container) return;

  container.innerHTML = CHANGELOG.map(entry => `
    <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #1a1f2e;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <span style="color:#f56300;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:0.08em;">v${entry.version}</span>
        <span style="color:#4b5563;font-family:monospace;font-size:11px;">${entry.date}</span>
      </div>
      <h3 style="color:#e2ddd4;font-size:16px;font-weight:700;margin:0 0 10px;">${entry.title}</h3>
      <ul style="margin:0;padding:0 0 0 18px;color:#9ca3af;font-size:13px;line-height:1.8;">
        ${entry.changes.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  overlay.style.display = 'flex';
}

window.showChangelog = showChangelog;
