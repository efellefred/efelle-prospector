// ---------------------------------------------------------------------------
// Changelog / Update Log
// ---------------------------------------------------------------------------

const CHANGELOG = [
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
