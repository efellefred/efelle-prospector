# efelle Prospector — Changelog

This mirrors the in-app Update Log (Updates button in the header).

## 4.6.1 — 2026-08-12 — AI Editor Overhaul & Address Fix

- Fixed: AI Editor could only see the first part of the proposal (embedded images were crowding out the later pages) — it now sees the whole document, so edits to the agreement/signature page work
- AI Editor now replaces every occurrence of a value — "change the price everywhere" actually changes it everywhere
- Honest results: the editor reports exactly how many changes landed and warns when one couldn't find its target (no more false "✓ applied")
- Editor tolerates common mismatches (& vs &amp;, curly vs straight apostrophes) when locating text
- Fixed: page-1 address block now appends City, State when the researched address is street-only

## 4.6.0 — 2026-07-28 — Smart Logo Background & PDF Polish

- Client logos with substantial white areas automatically get a dark backdrop so they stay visible on the white page
- Client logo is now embedded directly into the proposal file (works even when the client's site blocks cross-site image loading)
- Full-time hire comparison figure updated from $85,000 to $150,000/year
- META Ads card renamed to "META Ads [Facebook & Instagram]"
- RGS Only print layout: add-ons + ROI band get their own page (no more stranded ROI bar), and the process timeline box now shows a 5-phase program launch strip
- Copy fixes: About section handles descriptive service-area text; RGS Only copy drops contractor language ("booked work") when the Other vertical is selected
- Fixed empty Scope of Work paragraph and the invisible underline in the signature Company block

## 4.5.1 — 2026-07-28 — Logo URL Hallucination Fix

- Fixed: Research Client could fill in an AI-invented logo URL that doesn't exist (e.g. a fake /wp-content/ path)
- The homepage logo scraper now actually works — the server was stripping all HTML before the scraper could read it
- Logo scraper also handles lazy-loaded images (data-src / srcset)
- Every logo URL is now verified to load before it's filled in; unverifiable AI suggestions are discarded with a clear warning
- Status messages now say where the logo came from (homepage source vs. AI research)

## 4.5.0 — 2026-07-28 — RGS Case Study Pages

- RGS Only proposals now include two pages of real digital marketing results — SKR, Kryptek, Copendium, and Humble case-study graphics, two per page
- Case studies use the same image-card format as the website portfolio and print one page each
- Images are embedded directly into the proposal file, so downloads and PDFs are self-contained

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
