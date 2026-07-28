# efelle Prospector — Changelog

This mirrors the in-app Update Log (Updates button in the header).

## 4.4.0 — 2026-07-28 — Other Vertical & RGS Content Updates

- New "Other" industry vertical for companies outside home services — fully neutral proposal copy with no home-services verbiage anywhere
- With Other selected, shared copy (RGS cards, add-ons, buyer-journey language) is automatically neutralized too
- RGS Only proposals now highlight ongoing website content updates as part of the program (scope of work, offer, RGS card, process steps, agreement)
- RGS case-study section scaffolded for RGS Only proposals — will replace the website portfolio once client case-study graphics are added

## 4.3.0 — 2026-07-28 — RGS Only Proposals

- New "RGS Only" proposal type is now live — for prospects who already have a solid website and just want leads
- Proposal leads with the monthly Revenue Growth Service: marketing-focused scope of work, monthly-price offer, and RGS onboarding process (campaigns live in 2–3 weeks)
- Payment breakdown shows the monthly program fee, three-month minimum term, and ad-spend note — no website pricing
- Website-build sections (portfolio, feature cards, site architecture, build calendar) are automatically left out
- Agreement & signature page copy rewritten for marketing-only engagements
- Fixed: proposals using "Optional" RGS mode were dropping the RGS section entirely instead of moving it before the signature page

## 4.2.0 — 2026-03-29 — Searchable Client Dropdowns & User Guide

- Added searchable client dropdown to Strategy Builder and Proposal Builder
- Type-ahead search by company name across all report types
- Added User Guide link in header (opens in new tab)
- Added Update Log panel
- Login text updated to "prospector" branding

## 4.1.0 — 2026-03-29 — W.A.R. Report Enhancements & Anti-Hallucination

- Ground-truth verification: scrapes actual pages to cross-check Gemini claims
- Eliminates fabricated addresses, phone numbers, and location data
- Homepage screenshots captured with Apple device mockups (MacBook + iPhone)
- Screenshots saved as server files (not base64) for smaller library size
- Strict scoring rubric with hard caps for each category
- Auto-discover sitemaps from standard URLs
- Auto-detect company name and industry from website content
- One-click full audit: Lookup → Gemini → Claude → Report (no manual steps)
- Report eyebrow updated to "Website Audit & Recommendations (W.A.R.) Report"
- Executive summary split into assessment + recommendation paragraphs

## 4.0.0 — 2026-03-28 — Modular Web App & Production Deployment

- Rebuilt from single HTML file into modular Node.js web app (25+ files)
- Server-side API proxy — API keys never touch the browser
- Deployed to Railway with custom domain (prospector.efelle.com)
- Persistent storage volume for reports library
- Three user accounts with report attribution (Fred, Doug, Christian)
- Gemini one-click integration on all engines (no more copy/paste)
- Google Search grounding enabled for accurate web research
- Edit with AI on all 4 engines (find-and-replace approach)
- Save as PDF on all engines
- Report Library with type/user filters and search
- Server-side rate limit handling with auto-retry and staggering
- Health check endpoint for zero-downtime deploys
- Security hardening: helmet.js, rate limiting, session auth

## 3.5.0 — 2026-03-27 — Original Bug Fixes

- Fixed getApiHeaders() not including x-api-key in HTML mode (401 errors)
- Fixed artifact mode hanging on API calls
- Added retry logic with exponential backoff for 429 rate limits
- Staggered parallel report generation to avoid rate limit spikes
