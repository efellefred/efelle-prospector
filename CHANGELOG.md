# efelle Prospector — Changelog

This mirrors the in-app Update Log (Updates button in the header).

## 4.14.0 — 2026-08-14 — HubSpot Sync for Proposal Activity

- New Contact Email field on the proposal client form (auto-filled by Research Client when an email is found on the site or listings — never guessed)
- When a proposal with a contact email is published, opens and acceptances log as notes on that HubSpot contact: first open, re-opens (max one note per 6 hours), and "✅ Proposal ACCEPTED by…" with the signed timestamp
- The publish panel shows the HubSpot sync status; add a Contact Email and re-publish to enable it for an existing link
- Sync is fail-safe: if HubSpot is unreachable or the contact doesn't exist, proposal viewing and signing are never affected

## 4.13.0 — 2026-08-13 — RGS Card Updates & Sales Notes Proposal Linking

- Local SEO cards now include citation building for NAP consistency (all verticals)
- Google Ads (PPC) renamed to "PPC Ads [Google & Bing]" with ad-spend note updated to match
- Optional Add-Ons now a 3-up row with new "Social Media Engagement" ($250/mo) — we answer chats, comments & messages and post regular content
- The whole RGS section — price band, 6 program cards, 3 add-ons, and the 223% band — now fits on a single printed page (tightened print spacing)
- Sales Notes: link an existing proposal from the Library as source material — its content feeds the notes and its published link becomes the Proposal Link; files and pasted notes still welcome alongside

## 4.12.0 — 2026-08-13 — New Engine: Generate Sales Notes

- New home-screen tool: upload discovery files (PDF, TXT, MD, CSV, screenshots — up to 6 files / 15 MB) and/or paste notes, and get a formatted Sales Notes handoff doc in efelle's standard format
- Strictly source-grounded: the report contains only information found in your material — unknown fields show a dash, nothing is invented
- Download as HTML or server-rendered PDF (named "Sales Notes - {Company}") — ready to drop into Basecamp
- Reports auto-save to the Library under the new Sales Notes type

## 4.11.0 — 2026-08-13 — Logo Preview & Reliability Fixes

- Live logo preview in Client Details: the moment a logo URL is filled (by research or by hand), you see the actual image on both white and dark backgrounds — with a clear warning if the URL doesn't load
- FIXED: logos were invisible in the Print window, server PDFs, and downloaded HTML files — a security header was silently blocking our hosted logo images on those surfaces (they always worked on the published link)
- Click-to-sign now auto-retries if it hits a brief server restart — prospects see "retrying…" instead of a false "Failed"
- Fixed: proposals opened from the Library now restore their vertical/type, so Edit → Update Address / Details works instead of erroring
- Logo detection hardened for bot-protected sites (fuller browser headers) with a verified Clearbit logo-index fallback — never guessed, only used if the image actually loads

## 4.10.0 — 2026-08-13 — No-Website Research, Email Intro & Cleaner Toolbar

- New research toggle: "No website — research online" researches leads without a site via their Google Business Profile, Facebook, Yelp, and directory listings — enter the company name (and city) and click Research Client
- New ✉️ Email button: publishes/refreshes the proposal link and opens a pre-written intro email with signing instructions — fully editable before you send
- Toolbar streamlined: Edit ▾ menu (Add Logo, Edit with AI, Update Address / Details) and Download ▾ menu (PDF, HTML); Print and Publish Link unchanged

## 4.9.1 — 2026-08-13 — Official Signature Rendering

- When a prospect accepts a hosted proposal, their typed name now renders in script on the signature line and the date fills the date line
- A verification line appears under the signature: full timestamp (Pacific Time), the signer's IP address, and a reference ID
- The signed record prints — save the accepted proposal as PDF for your files

## 4.9.0 — 2026-08-13 — Hosted Proposal Links, Open Tracking & Click-to-Sign

- New "Publish Link" button hosts the proposal at a shareable, unguessable URL (prospector.efelle.com/p/…) — send prospects a link instead of an attachment
- Open tracking: every open of the link is counted with a timestamp — view count and last-opened time show in the app (note: your own opens count too)
- Click-to-sign: prospects type their name, confirm authorization, and accept right on the proposal — the acceptance (name, date, IP) is recorded and an ACCEPTED banner appears
- Re-publishing after edits updates the live copy at the same URL; acceptance and view history are preserved
- Links are private-by-obscurity (long random tokens), hidden from search engines, and rate-limited

## 4.8.0 — 2026-08-13 — Case Study Manager & One-Click PDF

- New "RGS Case Studies" manager in Settings — add, remove, reorder, and relabel the case-study graphics on RGS Only proposals without a code change
- Case-study changes apply to newly generated proposals immediately (stored on the server, survives deploys)
- New "Download PDF" button renders the proposal to PDF on the server — identical pagination every time, no browser print dialog
- The old print-dialog flow remains available as "Print / Save as PDF"

## 4.7.1 — 2026-08-13 — WO Agreement Copy Fix

- Work Order proposals' agreement page now matches the payment breakdown: 50% deposit / 50% at the 45-day milestone (it previously showed the new-website "24 months interest-free" plan and a hosting fee that don't apply to WOs)
- WO agreement copy rewritten for an updates engagement: scope description, client responsibilities, and ownership language ("you retain full ownership of your website and content")

## 4.7.0 — 2026-08-13 — Hosted Logos — No More Base64 Bloat

- Client logos are now stored on the Prospector server and referenced by a small URL instead of being embedded as base64 — downloaded proposals drop from ~1 MB to ~100 KB
- Applies to both researched logo URLs and manually uploaded logo files
- Re-uploading the same logo reuses the same stored file (no duplicates)
- If hosting fails, the proposal falls back to the client's original logo URL — never a giant embedded blob
- Smaller files also mean faster AI Editor turnaround and lighter report library storage

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
