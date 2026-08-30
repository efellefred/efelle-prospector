# Prospector — full UI upgrade (all screens, final approved design)

Rebuild the Prospector internal sales tool UI to match the approved design exactly. Reference markup for every screen is in `reference/` (inline styles are authoritative). Do not change routing or functionality — only presentation, except where interactions are specified below.

## 0. Shared foundation (applies to every screen)

**Fonts:** Plus Jakarta Sans (weights 400–800) for all UI; JetBrains Mono for version badges, dates, IDs, step labels, URLs, and money inputs. Never weights 300/900.

**Tokens:** `--black #1D1D1F`, `--gray-1 #3A3A3C`, `--gray-2 #6E6E73`, `--gray-3 #AEAEB2`, `--gray-4 #D2D2D7` (borders), `--gray-5 #F5F5F7` (fills), `--white #FFFFFF`, `--orange #F56300` (hover `#D65600`), `--green #32D74B`. Orange is emphasis only: eyebrows, one headline line, primary button, icons, links, selection states. Never a large background, never body text.

**Global scale:** the entire app renders at **59.5%** — one `zoom: 0.595` on the root container. Everything below is authored at 100% and scaled by that rule.

**Shell (every screen):**
- Dark band: `linear-gradient(160deg, #0a0a0a 0%, #1D1D1F 55%, #2a1500 100%)`, `overflow: hidden`, bloom = 720px circle `radial-gradient(circle, rgba(245,99,0,0.15) 0%, transparent 70%)` at `top:-160px; right:-120px`.
- Nav (1200px container, bottom hairline `rgba(255,255,255,0.10)`): logo `<img>` `assets/e-logo-white.png` at 30px + "prospector" 15px/700 + version badge (JetBrains Mono 11px, `rgba(255,255,255,0.55)`, pill border `rgba(255,255,255,0.10)`, text `v4.21.0 // 2026-08-23` — double slash). Right: plain text links (Home, Library, Guide, Settings, Log out) 14px/600 `rgba(255,255,255,0.75)`, orange on hover. No boxed nav buttons, no icons in nav, no Debug entry.
- Hero content per screen (below). Eyebrows: 11px/700/0.14em uppercase orange. Breadcrumb link left of eyebrow: 13px/600 `rgba(255,255,255,0.55)`, orange on hover.
- Footer: white, top hairline gray-4, 1200px container: left "efelle creative // prospector // internal sales tools" (13px gray-2), right "claude-sonnet-4-6 // api" (mono 12px).

**Section headers (light area):** orange uppercase eyebrow (11px/700/0.14em) + 1px gray-4 hairline filling the rest, 14px gap, 20px below.

**Segmented option buttons (all screens):** height 52, radius 8, 15px; selected = `border 1px solid var(--orange)` + `inset 0 0 0 1px var(--orange)` (2px ring) + `background rgba(245,99,0,0.06)` + black 700 text; unselected = white bg, gray-4 border, gray-1 600 text. 150ms ease-out color transitions. NOT black-filled.

**Inputs:** height 52, radius 8, gray-4 border, 15px; focus = orange border + `0 0 0 3px rgba(245,99,0,0.12)` ring. Money/number inputs use JetBrains Mono 16px with a gray-3 `$`/`#` prefix inside the box. Hide number spinners.

**Hover rules:** color changes only, 150ms ease-out. No scale, no opacity fades. Honor `prefers-reduced-motion`.

---

## 1. Home screen (`reference/Prospector Home.dc.html`)

Hero: eyebrow `EFELLE CREATIVE // PROSPECTOR`; headline 64px/800/-0.03em, two lines — "Let's sell something" white / "today." orange; subhead 18px `#B0B0B5`: "Prospect, pitch, close & build. Repeat."

View toggle top-right above services: segmented Table / Cards (gray-5 track, 1px gray-4 border, radius 8, 3px padding; active segment white with radius 6, 13px/700, shadow `0 1px 2px rgba(0,0,0,0.04)`). **Table is default.**

**Services — 9 tools, 6 stages, 00-indexed, this exact order and copy:**

- `00 PROSPECT` — **Prospect Finder** · target icon · CTA "Prospect" · "Find potential clients using Google Business data & RB2B visitor intelligence; surface strong opportunities based on location, industry, website quality & buying signals."
- `01 AUDIT` — **WAR Report** · magnifier · "Analyze" · "Complete website audit and recommendations covering SEO, UX, performance, conversion opportunities, and AI search readiness." / **Competitor Analysis** · bar chart · "Compare" · "Analyze three suggested local competitors side by side, including keyword gaps, positioning, visibility, and opportunities to outperform them."
- `02 PITCH` — **Growth Strategy** · trending-up · "Generate" · "Build a pitch-ready growth strategy combining client research, competitive analysis, opportunities, recommendations, and supporting data in one branded document." / **Client Action Plan** · bolt · "Plan" · "Create a standalone 12-month roadmap with prioritized recommendations, the top 10 quick wins, and an updated homepage messaging direction."
- `03 CLOSE` — **Proposal Builder** · file-text · "Build" · "Create a client-specific website proposal using their industry, recommended scope, pricing, RGS options, research, and supporting sales strategy."
- `04 HANDOFF` — **Sales Handoff** · clipboard · "Generate" · "Turn discovery files and sales notes into a clean internal handoff covering client goals, priorities, requirements, opportunities, and key context." / **Client Onboarding** · users · "Onboard" · "Build the kickoff plan from the signed proposal, including scope, timeline, staging schedule, responsibilities, required assets, and first-week action items."
- `05 BUILD` — **Site Blueprint** · sitemap · "Build" · "Build the complete site structure, sitemap, page plan, and content binder directly from the approved scope and project strategy."

Icons: 1.5px-stroke round-capped line glyphs (Lucide-style), 24×24 viewBox. CTAs render `{Label} →`.

**Table view** (stages stacked, 48px gaps): stage header = mono number 12px/700 gray-3 + orange stage name + hairline. Row = ONE `<a>` (whole row clickable): grid `48px 240px minmax(0,1fr) 200px`, gap 24, padding `18px 16px 18px 32px` (the 32px centers the icon under the stage name), bottom hairline gray-5, radius 8; hover bg gray-5. Cells: 36px orange circle w/ white 18px icon; name 18px/800; description 14px/1.6 gray-1; CTA right-aligned orange 14px/700.

**Cards view** — 3 rows × 3 cards, stages combined per row: Prospect+Audit / Pitch+Close / Handoff+Build. Each row's header rule is ITSELF a `repeat(3,1fr)` grid matching the cards, so each stage label starts exactly at its first card's left edge; label-less columns are hairline only (reads continuous). Card = ONE `<a>`: gray-5 fill, radius 12, padding 28, no border/rule; hover `#ECECF0`. Content: bare 20px orange stroke icon + name 20px/800 side by side (14px gap); description and CTA indented 34px (aligned to the name, not the icon); CTA bottom-left.

**CTA hover animation (both views):** inner span around CTA text+arrow slides `translateX(6px)` at 150ms ease-out on hover of the parent row/card; disabled under reduced motion.

---

## 2. Proposal Builder — setup (`reference/Proposal Builder.dc.html`)

Hero: breadcrumb "← Home", eyebrow `03 // CLOSE · PROPOSAL BUILDER`, h1 48px "Build the proposal.", sub "Pick the type, vertical, and pricing. Claude researches the client and writes the document."

Form column: max-width 880, sections 48px apart, all using the section-header pattern.

- **Proposal type** — segmented ×3: New website / Website updates WO / RGS only.
- **Select vertical** — 2-col grid of selectable cards (radius 12, padding 18×20, gray-5 fill; selected = orange border + 2px inset ring + `rgba(245,99,0,0.06)`): grid `20px auto 1fr` = orange stroke icon, bold name 16px/800, description 13px gray-2. Ten verticals: Home services (General contractor / multi-service), Plumbing (Plumbing, drain, water heater), Roofing (Roofing, gutters, siding), HVAC (Heating, cooling, air quality), Landscaping (Landscaping, lawn care, outdoor), Electrical (Electrician, wiring, panels), Construction (General contractor, builds, remodels), eCommerce (Online retail, DTC, product brands), **Misc** (Other home services, neutral copy, & verbiage), **Other** (Any business, no home-services verbiage).
- **Market type** — segmented ×3: Residential / Commercial / Both.
- **RGS mode** — 2 stacked-label cards: "Included — Shown early, after The Offer section" / "Optional — Shown near the end, before signature".
- **Pricing** — fields depend on proposal type; all boxes share one bottom edge (every field reserves a 15px hint line below; hints align on their own row). Mono inputs with prefix. "Next: client details →" primary button sits right of the fields on the same line, top-aligned to the boxes.
  - New website: Website price ($, 7500) / Monthly hosting ($, 85, hint "$0 hides hosting") / RGS monthly ($, 2500).
  - Website updates WO (narrow inputs so the button fits: hours 60px, prices 70px, hosting 50px): WO hours (# prefix, hint = clickable rate) / WO price ($) / Monthly hosting ($, hint "$0 hides hosting") / RGS monthly ($). Changing hours sets price = hours × rate. The rate hint reads `$150/hr` with dotted underline; clicking swaps it for a small inline mono input (orange bottom border) that edits the rate and recalculates price live; collapses back on blur.
  - RGS only: RGS monthly ($) alone.
  - Inputs keep raw typed strings (never snap an emptied field to 0 and append digits); math parses on the fly.

---

## 3. Proposal Builder — client details (`reference/Proposal Builder – Client Details.dc.html`)

Hero: breadcrumb "← Setup", eyebrow `03 // CLOSE · PROPOSAL BUILDER · STEP 2 OF 2`, h1 "Client details.", sub "Research the client or fill the fields by hand. Everything here lands in the proposal."

- **Research client** — segmented ×3: Enter website URL / Pull WAR report / No website, research online.
  - Enter website URL → URL input + orange primary "Research client"; note: "Company name, location, services, address, phone, and logo URL are pulled automatically after Research client runs."
  - Pull WAR report → search input ("Search WAR reports by company name") + primary "Pull the report"; note: "Client details load from the most recent WAR report for the company."
  - No website → note: "Claude researches the business online from the company name and city below."
- **Company** — row 1 (grid `1fr 1fr 1.4fr`): Company name / Contact name / Contact email(s) (hint "Commas separate. Opens & acceptance log to HubSpot."). Row 2 (grid `2.2fr 1.2fr 0.6fr 0.8fr 1.2fr`): Street address / City / State (2-char) / Zip / Phone.
- **Positioning** — Services (full-width, hint "Pipe-separated."), Service area (full-width), Key differentiators (textarea), then row: Founded year (left) | right column = Logo URL (optional) with, below it, an inline row: "LOGO BACKGROUND" label + small segmented Auto/Light/Dark (32px high, radius 6) all vertically centered, then a 44px dashed-border rounded square on the right where the fetched client logo renders.
- Footer actions above page footer, separated by a top hairline: secondary "← Back to setup" left, primary "Build the proposal →" right.

---

## 4. Proposal Builder — preview (`reference/Proposal Builder – Preview.dc.html`)

Hero (slimmer, 44px top padding): breadcrumb "← Client details", eyebrow `03 // CLOSE · PROPOSAL BUILDER · PROPOSAL READY`, h1 40px = client name ("Mt Baker Roofing."). Right side, bottom-aligned action row:
- Four dark-surface buttons (transparent bg, `1px solid rgba(255,255,255,0.22)` border, `rgba(255,255,255,0.85)` text 14px/600, radius 8, 40px high; hover = full white): **Edit ▾**, **Download ▾**, **Print / save as PDF**, **Publish link**.
- One orange primary: **Email the proposal**.
- Edit ▾ dropdown (white panel, radius 8, shadow `0 4px 16px rgba(0,0,0,0.06)`, 6px padding; items 14px/600 gray-1, hover gray-5 bg): Add logo / Edit with AI / Update address & details.
- Download ▾ dropdown: Download PDF / Download HTML.

**Published band** (single line): green success treatment — `border 1px solid rgba(50,215,75,0.35)`, bg `rgba(50,215,75,0.06)`, radius 12; 22px green ✓ circle; then: **Published** (14px/700) · `08/23/26 2:41 pm` (mono 12px gray-2) · report id `r8E2khSQCjqWdYXP` (mono 13px orange link — id only, not the URL) · copy **icon** button (28px, gray-4 border, clipboard glyph) · "2 views" · "Last opened 2 h ago" (both with dotted underline + `cursor: help` and tooltip "Views include your own opens. Edits update the live link until the client signs.") · refresh icon button (28px, circular-arrow glyph) · "HubSpot: info@mtbakerroofing.com". No second line.

**Preview section:** header "PREVIEW" + hairline + mono right label `Proposal // 2026-0231`. **The proposal document scrolls inside its own window** (as in the current production build): the gray-4 bordered, radius-12 wrapper is a fixed-height viewport (~70vh) with `overflow-y: auto`; the full multi-page proposal scrolls within it while the app page itself stays put. The mockup shows only page 1 flattened — do NOT remove the existing scroll container behavior. Inside it: 780px column — letterhead ("EFELLE CREATIVE" caps 11px left, "efelle.com | 206.384.4909" right) → dark cover (same gradient + bloom; client badge pill = `rgba(245,99,0,0.15)` bg, `rgba(245,99,0,0.3)` border, orange caps 11px; date right; h2 26px/800 two-part headline with second sentence orange; lede 14px/1.75 `#B0B0B5`; hairline; 4-stat row 42px/800 — 21 / 150+ / 4.7★ / 223% with only 223% orange) → white two-column (About {client} / Scope of work overview, 13px/1.75 document scale) → centered "Page 1 of 9 · full document continues in the live preview".

**Model section:** header "MODEL" + hairline; mono input `claude-sonnet-4-6` + secondary "Apply model"; caption "API model string used for edits and regeneration on this proposal."

---

## 5. AI editor (`reference/Proposal Builder – AI Editor.dc.html`)

Same screen as §4 with a docked panel fixed to the bottom (opens from Edit ▾ → Edit with AI):

- Bar: `rgba(20,20,22,0.86)` + `backdrop-filter: blur(12px)`, top hairline `rgba(255,255,255,0.10)`; content max-width 1000px.
- Header row: orange eyebrow **AI EDITOR** + mono `claude-sonnet-4-6` (`rgba(255,255,255,0.45)`) + close × button right (32px, `rgba(255,255,255,0.22)` border).
- Input row: prompt field (56px, `rgba(255,255,255,0.06)` bg, `rgba(255,255,255,0.22)` border, white text, placeholder "Tell the AI what to change in the proposal", orange focus ring) + orange primary **Send the edit**.
- Suggestions row: "Try:" (12px `rgba(255,255,255,0.45)`) + pill chips (28px, `rgba(255,255,255,0.16)` border, `rgba(255,255,255,0.65)` text 12px/600; hover orange border+text; click fills the prompt): "Change the price to $8,000" / "Remove the SEO section" / "Make the intro more personal" / "Add a testimonials section".
- The proposal keeps scrolling inside its own preview window behind/above the docked panel (same scroll container as §4); the panel is fixed to the viewport bottom and must never cover the scroll container's bottom edge — give the page enough bottom padding (~200px pre-zoom) that the document window and its scrollbar stay fully reachable while the panel is open.

---

## Voice reminders (apply to any copy you touch)
"efelle" always lowercase; sentence case everywhere except eyebrows; no em/en dashes (use commas/colons or `//` in badges); no emoji; buttons name what happens.
