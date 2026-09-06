# efelle Prospector — Changelog

This mirrors the in-app Update Log (Updates button in the header).

## 4.31.0 — 2026-09-05 — Clean Scraped Addresses, Live Signature-Block Total, $0 Pricing Defaults

- **Scraper address cleanup at the source**: `cleanStreetValue(street, phone, city)` strips leading phone-digit groups (≥6 digits, verified against the phone field) and a trailing duplicated city from the street line; applied when Research Client fills the form (both research branches) and defensively in `propAddressLines` at render time
- **Third RGS price is live**: the Select Your Options RGS row now renders its price as a `.live-rgs-monthly` span, so checked add-ons update it like every other listed price (server + preview scripts pick it up automatically). `syncPricingData` is add-on-aware: it subtracts pre-checked add-on sums to recover the program base, and renders visible amounts as base + checked add-ons
- **Pricing starts at $0**: `selectPropType` and the static form now zero WO hours, WO/website price, hosting, and RGS monthly (hosting at $0 keeps hiding hosting). Library restores still bring back saved prices
- Battery: 35 checks green (13 identity + 14 builder incl. new live-options-row and $0-defaults assertions + 8 on-page editing)

## 4.30.0 — 2026-09-05 — On-Page Editing + Dropdown Menus Un-Clipped

- **Fixed clipped dropdowns**: `.pbx-hero` carried `overflow:hidden` (to contain the orange bloom), which cut the Edit ▾ / Download ▾ menus at the band's bottom edge — only "Add logo" was visible. The bloom now clips itself via an `inset:0` wrapper with an oversized `::before`, and the hero no longer clips descendants
- **Edit Text on Page** (Edit ▾ menu): the preview iframe switches to `designMode`, with a Save / Discard bar above it. Save serializes the edited document, strips editing artifacts, re-runs `syncPricingData` (hand-edited prices get correct data attributes), rewrites the preview, and auto-pushes to the live link
- **Library copy stays current**: new `PUT /api/reports/:id` (auth-required) updates a report's HTML/metadata in place; the auto-republish debounce now also persists the working document to its Library report — AI edits, on-page edits, logo changes, and add-on pre-selection all survive reopening from the Library
- Verified by a new 8-check on-page-editing e2e plus full regression of the publish-identity (13) and builder (12) suites

## 4.29.0 — 2026-09-05 — Every Proposal Gets Its Own Link + Pre-Select Services in the Builder

- **Fixed the shared-link bug**: publishing was keyed per company (localStorage slug), so three Mt Baker proposals overwrote one URL. Identity now lives with the Library report — the server resolves `reportId → token` as the authority, a token belonging to a different report is never reused, and unowned legacy links are claimed by the first report that republishes to them (emailed links keep updating)
- **Builder preview pricing**: add-on checkboxes are live in the preview (same math as the hosted page, bound through the iframe's load event so srcdoc rewrites can't orphan the handler); every toggle is persisted into the document — checked state plus recomputed listed prices — so pre-selected services carry into Publish, PDF, and Download, and the hosted page's sticky totals start from the pre-selection
- **Library restore shows the published panel**: reopening a proposal restores its link, views, and HubSpot status (`publishToken` rides on the report record)
- **Proposal number** (`YYYY-MMDD-XXXX`) minted at generation, kept across regenerations/restores, stamped on the hero cover under the date, and shown in the builder header
- **(e) brand mark** added top-left on the hero cover
- **Address renders as two lines** (street / City, ST ZIP) in the logo and signature blocks, with defensive cleanup of research-autofill junk (leading phone fragments matching the phone field, trailing duplicated city)
- **Signature alignment**: signature/date rules are taller flex boxes (content bottom-aligned) so the lines + captions align with the company text block
- **/mo → /m** on all displayed monthly amounts (doc labels, sticky bar, options rows, verification line, agreement, user guide)

## 4.28.0 — 2026-08-30 — Unpublish a Hosted Proposal

- The published-link panel has an **Unpublish** (trash) button that permanently deletes the hosted `/p/<token>` link and its record (`DELETE /api/publish/:token`) — for cleaning up test proposals and retiring dead links
- Confirms first, and warns explicitly when the proposal is already signed, since deleting the link removes the signed acceptance record too
- Unpublishing also clears the `publishToken` link on any Library report that pointed at it

## 4.27.0 — 2026-08-30 — Signed Proposals Feed Invoicing

- When a client signs a hosted proposal, the signed offer now **publishes automatically to the Command Center's shared client record**: company, signer, contact email, service address, and the exact price, payment structure, hosting and RGS programs they selected
- The signed deal then appears in the Command Center under **A/R > Invoices > Import a signed proposal**, where one click prefills the whole billing form exactly as signed
- Generated proposals embed the client and payment details in the document itself (`efelle-offer-data`), so the handoff always reflects the version the client actually signed, even after AI edits — amounts are read from the same doc-derived checkbox data the acceptance endpoint already trusts
- The handoff is fire-and-forget like the HubSpot sync: if the Command Center is unreachable the acceptance still records exactly as before, and the miss is logged server-side
- Setup: two Railway variables — `COMMAND_CENTER_RECORD_TOKEN` (the shared bearer, same value as the Command Center's `PROSPECTOR_RECORD_TOKEN`) and optionally `COMMAND_CENTER_URL`

## 4.26.0 — 2026-08-24 — Workflow View

- New **Workflow** view on the home screen: a left-to-right flowchart of all 10 programs across the 7 pipeline phases, with branch and converge connectors showing what feeds what
- Hover or tab to any program and the detail band below the diagram fills in with its phase, description, and launch button; clicking a card opens the program exactly as the Table and Cards views do
- New **06 Launch** program added to all three views — in development, with go-live steps running from there once it ships
- The view selector remembers your last choice, so Prospector opens on Table, Cards, or Workflow depending on where you left off
- The Workflow view renders full width at 1:1 (it undoes the global page zoom, the same way the app's overlays do) because the seven-phase diagram needs more room than the 1200px content column; it scrolls sideways below a 1168px window

## 4.25.0 — 2026-08-23 — Library Tracks Sent and Views

- The Library table now shows **Sent** (date plus recipient) and **Views** columns, both sortable; unsent reports always sort last
- Sending a proposal from **Email the proposal** records the send date and recipients on its Library report (`POST /api/reports/:id/sent`)
- Publishing a proposal links the hosted client link to its Library report (`reportId` on `/api/publish`), and the report list joins live open counts from the publish store
- Older reports show Not sent and 0 views until they are published or emailed again from the Proposal Builder

## 4.24.0 — 2026-08-23 — Library and Settings Design Refresh

- Library rebuilt on the efelle design system: dark hero, live company search, type and created-by filter chips, sortable Name and Created columns, color-coded type pills, and per-row **Actions** and gear menus (View, Download, Edit, Delete)
- Settings rebuilt for admins: Railway persistence status band, **Portfolios** and **RGS case studies** accordions, and API key cards with Test the key and one Save the keys button
- New Portfolios manager: image URL + industry rows persist to the server (`/api/portfolios`), and newly generated proposals pull the portfolio matching the selected vertical, falling back to the built-in set
- Library and Settings nav links highlight orange while you are on those screens

## 4.23.2 — 2026-08-23 — Setup Layout Polish

- Vertical cards on the Proposal Builder setup step are compact single-line rows, matching the approved design and cutting scrolling
- New **Misc** vertical (other home services, neutral copy & verbiage) — placeholder that reuses the Other content until Misc-specific verbiage is written

## 4.23.1 — 2026-08-23 — Client Details Cleanup

- Removed the **Select a previous client** search from the Proposal Builder client details step — research the client or fill the fields directly
- Logo preview cleanup: the dashed placeholder box is gone; imported logos now show under Founded year on the left, with the confirmation line on a single line underneath

## 4.23.0 — 2026-08-23 — Address Splits Into CRM-Ready Fields

- Street address, City, State, and Zip are now separate fields on the Proposal Builder client form, matching how they feed into the CRM and QuickBooks
- **Research client** fills all four automatically: full addresses are parsed into components, and the state is always uppercased
- Saved proposals store the atomic values (`street`, `city`, `state`, `zip`) alongside the composed `address`/`location` strings for older tooling
- Loading a previous client still works for old records: composed addresses are parsed into the new fields on the way in
- Generated proposals compose the letterhead address from the four fields, so nothing changes in the document itself

## 4.22.0 — 2026-08-23 — Proposal Builder Design Refresh

- Proposal Builder rebuilt on the efelle design system: each step gets its own hero header with breadcrumbs (Setup, Client details, Preview), light forms, segmented selectors, and selectable vertical cards
- Preview screen: actions live in the header (Edit, Download, Print / save as PDF, Publish link, Email the proposal), a green one-line **Published** band with copy, views, and refresh, a framed scrolling preview window, and the proposal id
- AI editor is now a docked panel at the bottom of the screen with one-click prompt suggestions
- New research option on Client details: **Pull WAR report** — loads the company and website from the newest WAR report and researches the client automatically
- Website updates WO pricing: hours × rate now sets the WO price live; click the `$150/hr` hint to change the rate inline
- Whole app renders at 59.5% scale with a taller nav; Debug moved out of the nav (click the version badge to toggle it); footer now appears on every screen

## 4.21.0 — 2026-08-23 — Every Tool Gets Its Own URL

- Each screen now has its own address: `/war-report`, `/competitor-analysis`, `/growth-strategy`, `/action-plan`, `/proposal`, `/sales-handoff`, `/library`, `/settings`
- Browser **Back** and **Forward** now move between Prospector screens instead of leaving the site
- Deep links work — bookmark or share a tool URL and it opens straight to that tool (after login)
- Back into a half-finished tool never resets its form — only opening it fresh from the home screen does
- No server changes needed: the existing catch-all already serves the app for these paths

## 4.20.0 — 2026-08-23 — Home Screen Design Refresh

- Home screen rebuilt on the efelle design system: dark gradient hero ("Let's sell something **today.**"), light body, Plus Jakarta Sans + JetBrains Mono, whole interface rendered at 70% scale
- Nine services organized into six numbered workflow stages: 00 Prospect → 01 Audit → 02 Pitch → 03 Close → 04 Handoff → 05 Build
- New **Table / Cards** view toggle (Table default; choice remembered per browser)
- Tools renamed to match the workflow: WAR Report, Competitor Analysis, Growth Strategy, Client Action Plan, Proposal Builder, Sales Handoff
- Three upcoming tools on the board — Prospect Finder, Client Onboarding, Site Blueprint — show a coming-soon notice until their engines ship
- New slim nav (white e-logo, prospector wordmark, version pill, plain text links) and a home footer with the active model string

## 4.19.1 — 2026-08-21 — META Ads Returns as an Add-On

- META Ads (Facebook & Instagram) is back as a **$600/mo** option in the Additional Lead Generation add-on group (after Bing PPC Ads), on every proposal type
- Description: campaign setup, audience targeting, creative rotation & ongoing management across Facebook & Instagram; ad spend paid directly to META
- Print compression tuned so the RGS page still fits on one page with seven add-ons

## 4.19.0 — 2026-08-21 — New Default Price Page: Core Program + Grouped Add-Ons

- The RGS price page now leads with **YOUR PROGRAM INCLUDES** — four core services, each with a green pre-selected check the client can't uncheck: Google PPC Ads, Local SEO, AI Search Visibility (GEO), and Reporting, Analytics & Strategy (RGS-only proposals also keep Website Content Updates)
- Optional add-ons split into two groups, same roster on every proposal type — **Additional Lead Generation**: Google Local Services Ads $600/mo, Bing PPC Ads $600/mo, Google Business Profile Management $400/mo · **Customer Engagement**: Reputation Management $350/mo, AI Phone & Appointment Automation $550/mo, Social Media Engagement $250/mo
- All descriptions updated per the new package spec; PPC copy stays vertical-tailored ("urgent plumbing needs", etc.) with the new campaign-strategy/conversion-tracking sentence added across all 9 verticals
- META Ads and the standalone Local SEO/Reputation main cards are out of the defaults — Bing PPC is its own add-on, PPC is Google-focused, and stale META references were cleaned from SOW/agreement/process-step copy (add anything back per-client with Edit with AI)
- Add-on rows realigned: checkbox, service title, and price share one baseline, with tighter spacing on wrapped description lines
- New closing line under the add-ons: "Need more leads? We can scale your program by adding additional advertising channels, service areas and lead-response tools as your business grows."
- Print fit restored: the whole RGS section (price band, core cards, six add-ons, ROI band) shares one page — the ROI band no longer spills onto an orphan page

## 4.18.1 — 2026-08-15 — Pricing Stays In Sync After AI Edits

- Fixed: AI-edited prices could show different amounts in different places (offer panel vs price band vs options card) because the live-total wiring kept the old numbers
- After every AI edit, pricing is automatically re-synced from the visible Select Your Options labels and add-on rows — the single source of truth
- Discount displays work: show a struck-through old price next to the new one and the NEW (last) price is what counts toward totals
- Add-on rows added by the AI editor get proper identities automatically, so their checkboxes and prices behave like the built-in ones

## 4.18.0 — 2026-08-14 — Live Listed Prices & Auto-Updating Links

- The listed RGS price itself now updates in real time as add-ons are checked — in the offer panel, the Payment Breakdown row, and the RGS price band (the separate "Selected monthly total" line is gone; the sticky bar still shows the full selection)
- Published links auto-update: AI edits, logo changes, and regenerations push to the live link automatically — no need to re-publish
- Once the client signs, the published version LOCKS — edits can no longer change the signed record (the app tells you when a link is locked)

## 4.17.1 — 2026-08-14 — Logo Background Control

- New Logo Background toggle (Auto / Light / Dark) next to the logo preview — pick Light for colorful logos with white accents (like Mt. Baker) that were auto-getting the dark backdrop
- Auto still detects white-heavy logos that would vanish on the white page; your choice is saved with the proposal

## 4.17.0 — 2026-08-14 — Clickable Add-Ons, Live Totals & Signature Polish

- Add-on checkboxes are now clickable on the hosted proposal — checked add-ons join the client's recorded selection and are locked in after signing
- New "Selected monthly total" in the options card by the signature: hosting + RGS + chosen add-ons, updating in real time as the client checks boxes
- New sticky bar at the top of the hosted proposal showing the running selection ("$6,600 one-time + $2,885/mo") wherever the client scrolls — frozen at the accepted amounts after signing
- The accepted monthly total is recorded with the signature and shows in the verification line, the publish panel, and the HubSpot note
- Signature block per feedback: COMPANY and SIGNATURE headings on one line, client name aligned with the company name, company-side rule and caption removed
- Add-ons alone can't be signed for — at least one program must be selected (enforced server-side)

## 4.16.0 — 2026-08-14 — Select Your Options, WO Hosting & Signature Alignment

- Proposals with both a website/WO component AND an RGS price now end with "Select Your Options" — checkboxes for each program next to the signature. On the hosted link the client's selection is recorded with their acceptance, locked after signing, and shown in the verification line, publish panel, and HubSpot note
- Signing requires at least one selected option — enforced on the server too, and selections can't be forged (labels always come from the document itself)
- Monthly Hosting now available on Work Orders (for migrating an existing site to efelle hosting): a $ value adds it to the payment table, agreement, and the website option label; $0 hides hosting everywhere on any proposal type
- Custom pricing (including hosting) is now saved with the proposal and restored when you reopen it from the Library — no more values resetting to defaults
- Authorization block rebuilt as a locked grid: company, signature, and date rules sit on one shared baseline with aligned captions, verified in print; the signature area and options card always print together on one page

## 4.15.0 — 2026-08-14 — Add-On Price List & Sturdier AI Editor

- Optional Add-Ons now render as a compact price list (checkbox · name — description · price) instead of cards — everything fits cleanly even with all 5 add-ons on Work Order proposals
- AI Editor auto-retries when the server is briefly busy (e.g. mid-redeploy) and shows the real error message instead of "API 502"
- AI Editor matching is more forgiving: edits that copy large blocks now land even when spacing differs slightly

## 4.14.1 — 2026-08-14 — Multiple Contact Emails

- The Contact Email field now accepts multiple addresses separated by commas — useful when two people at the company can sign
- Proposal opens and the acceptance log as notes on each listed HubSpot contact (up to 5)
- Invalid entries are ignored and duplicates removed automatically

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
