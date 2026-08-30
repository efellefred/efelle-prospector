# Prospector — batch 2: Library + Settings

Build the two remaining screens to match the approved design exactly. The rest of the app (home, proposal builder flow) is already built from the previous handoff — reuse its shared shell, tokens, and components; do not restyle finished screens. Reference markup is in `reference/` (inline styles are authoritative).

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

## 6. Report library (`reference/Prospector Library.dc.html`)

Hero: eyebrow `EFELLE CREATIVE // PROSPECTOR`, h1 48px "Library.", sub "Every report, proposal, and plan the team has generated, in one place." Library nav link shows active (orange).

**Filter row** (one line, nowrap, 32px below it before the table): company search input first (40px high, 220px wide, standard focus ring), then "TYPE" label + pill chips (32px, radius 999, `white-space: nowrap`; selected = orange border + 2px inset ring + `rgba(245,99,0,0.06)` bg + black 700 text; unselected white/gray-4/gray-1): All / WAR / Strategy / Action plan / Proposal / Competitor. Right-aligned: "CREATED BY" + chips All / Fred / Doug. All filters live-filter the list and stack with sorting.

**Sortable header row** — grid `95px minmax(0,1fr) 100px 240px 60px 150px`, gap 18, padding `0 16px 10px`, bottom border gray-4 (rows MUST use the identical grid tracks so headers align with cell content): TYPE (static label) · NAME · CREATED · SENT · VIEWS (centered) · empty actions column. Sortable headers are 11px/700/0.14em uppercase buttons: inactive gray-3, active black with ↑/↓ arrow, orange on hover; click sets the sort key (name defaults ascending, dates/views default descending), clicking again flips direction. Default sort: Created, newest first. Date sorting parses MM/DD/YY; "Not sent" sorts last.

**Rows** — same grid, padding `14px 16px`, bottom hairline gray-5, radius 8, hover bg gray-5:
- Type pill: 20px high, padding 0 10px, radius 999, JetBrains Mono 9px/700 uppercase, color-coded tints — Proposal `bg rgba(245,99,0,0.12) / #D65600` (orange), WAR `rgba(50,215,75,0.14) / #1D8A38`, Strategy `rgba(50,138,146,0.12) / #328A92`, Action plan `rgba(46,86,101,0.10) / #2E5665`, Competitor `rgba(217,48,37,0.08) / #D93025`. No border.
- Name block: company 17px/800 over meta 13px gray-2 (meta uses `//` separators: "Roofing // new website // by Fred"), both ellipsizing.
- Created: mono 13px date (MM/DD/YY).
- Sent: mono 13px date + recipient email inline to its right (12px gray-2, baseline-aligned, ellipsizing); "Not sent" with no email when unsent.
- Views: mono 13px tabular numeral, centered.
- Actions: **Actions ▾** button (36px, radius 8, gray-4 border, 13px/700; hover black border/text) opening a dropdown (white panel, radius 8, shadow `0 4px 16px rgba(0,0,0,0.06)`, 6px padding; items 14px/600 gray-1, hover gray-5): View / Download / Email. Then a gear icon button (36px square, same border treatment) opening: Edit / Archive. One menu open at a time.
- Empty state: "No reports match. Clear a filter or run a new audit from the home screen."

---

## 7. Settings (`reference/Prospector Settings.dc.html`)

Hero: eyebrow `ADMIN`, h1 48px "Settings.", sub "Keys, portfolios, and case studies. Changes take effect immediately and persist to Railway." Settings nav link shows active (orange). Content column max-width 880, blocks 40px apart, in THIS order:

1. **Railway persistence** — status band, same green success treatment as the Published band (border `rgba(50,215,75,0.35)`, bg `rgba(50,215,75,0.06)`, radius 12, 22px green ✓ circle): "Railway persistence connected" (14px/700) + "Key updates persist across deploys." inline; second line 13px gray-2: "Without Railway, keys reset on the next deploy and must be updated in the Railway dashboard."
2. **Portfolios** — accordion (gray-4 border, radius 12). Header = full-width button (hover gray-5): orange eyebrow "PORTFOLIOS" + description "Portfolio graphics shown on proposals, matched by industry." + right-aligned mono item count ("4 items") + ▾/▴ chevron. Open by default. Body (top hairline, padding 20–24): intro note 13px gray-2 ("Paste image URLs (upload graphics to the web server first). The proposal pulls the portfolio matching the selected vertical. Changes apply to newly generated proposals."), then rows on grid `64px minmax(0,1fr) 170px auto` gap 12: 64×40 dashed thumbnail slot · URL input (44px, mono 13px) · industry input (Plus Jakarta 600: Roofing / HVAC / Plumbing / Electrical) · ↑ ↓ × icon buttons (32px square, gray-4 border; × in red with red hover border). Footer row: secondary "+ Add portfolio" left, dark "Save portfolios" right.
3. **RGS case studies** — identical accordion, collapsed by default. Description "Case-study graphics shown on RGS Only proposals, two per page in order." Rows same grid with a name input instead of industry (SKR / Kryptek / Copendium / Humble). Footer: "+ Add case study" / dark "Save case studies".
4. **API keys** — standard section header (eyebrow + hairline). Two gray-5 cards (radius 12, padding 22–24): title 13px/700 ("Anthropic (Claude)", "Google Gemini") + mono masked current value ("Current: sk-ant-...aC0gAA" / "Current: ...zNRFUw"); below, key input (mono, placeholder "sk-ant-api03-..." / "AIza...") + secondary "Test the key". Below the cards, right-aligned: the page's single orange primary **Save the keys** (52px).

Only one orange primary on the page (Save the keys); accordion saves are dark buttons. Accordions exist to save scrolling — preserve open/closed state per section.

---

## Voice reminders (apply to any copy you touch)
"efelle" always lowercase; sentence case everywhere except eyebrows; no em/en dashes (use commas/colons or `//` in badges); no emoji; buttons name what happens.
