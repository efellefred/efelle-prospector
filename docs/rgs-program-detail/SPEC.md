# SPEC: RGS Program Detail Engine + Service Cards

**Project:** efelle Prospector (`efellefred/efelle-prospector`)
**Feature:** Evolve the proposal builder with (1) toggleable RGS service cards and (2) an on-demand "RGS Program Detail" report generator that extrapolates delivery hours from a locked rate card, with industry-specific language and seasonal planning pulled from the proposal's vertical.

Follow the workflow in CLAUDE.md: `git pull origin main` first, no local preview, verify on https://prospector.efelle.com/ after Railway deploys.

Reference files for this spec live in `docs/rgs-program-detail/`:
- `mt-baker-internal-reference.html` — the frozen internal effort-map template (v4, all services on)
- `mt-baker-client-reference.html` — the frozen client-facing Program Detail template (v4, all services on)
- `mt-baker-v5-meta-off-internal.html` / `mt-baker-v5-meta-off-client.html` — worked example of a card-state override: the same client with META toggled off (his Facebook account is disabled), META's hours reallocated into PPC, and META re-offered as a priced option with a client-specific disclaimer. Use these to see exactly how §4b below should render.

The v4 pair IS the design target: the generator's output must match their structure, styling, and tone exactly, with client/vertical/hours values substituted. The v5 pair shows the target behavior when a core service is toggled off.

---

## 1. Context: what exists today

- `public/js/data/verticals.js` — `VERTICALS` object, 9 verticals (home_services, plumbers, roofers, hvac, electrical, landscape, construction, ecommerce, other). Each already has `rgs_local`, `rgs_ppc`, `rgs_meta`, `rgs_rep` copy fields.
- `public/js/engines/prop.js` — proposal engine. Key functions: `selectVertical()`, `selectRGS(mode)` (optional/included), `selectPropType(type)` (new website / `wo_rgs` / `rgs_only`), `propBuildHTML(clientName)` (~line 555, builds `rgsMainCards` and `rgsAddonCards` as hardcoded HTML with `CHECK` / `EMPTY_BOX` markers), `propGenerate()`.
- `public/js/data/proposal-template.js` — proposal HTML template, `[[RGS_*]]` placeholders, `.rgs-card` styles.
- `public/index.html` — app shell and form UI (`#rgs-optional`, `#rgs-included`, `#price-rgs` defaulting 2500/2800).
- `server.js` — Express, auth, API proxy, Gemini orchestration.
- `tests/smoke-test.js` — existing test harness pattern.

## 2. Deliverable A — Rate card module (single source of truth)

Create `public/js/data/rgs-rate-card.js`. Every number the feature uses lives here and nowhere else. Templates and engines must never hardcode pricing or hours.

```js
export const RGS_RATE_CARD = {
  blendedRate: 165,              // $/hr, internal only — never rendered in client output
  roundDiscountCap: 150,         // max $/mo a "clean" hours number may exceed exact capacity
  ppcSpendPerHour: 1250,         // $ ad spend supported per PPC mgmt hour (6h ↔ $7,500/mo)
  ppcCampaignsPerSixHours: 3,    // campaign ceiling at the 6-hr baseline
  extraCampaignHours: [1, 1.5],  // added hrs/mo per campaign beyond ceiling
  contentHoursPerPiece: [1.2, 1.75],
  hireComparison: { salary: 85000, benefitsNote: "plus benefits" },

  // Monthly allocation engine: floors come off capacity first,
  // remainder splits by weights, every bucket rounds to nearest 0.5.
  floors: {
    reporting:  { base: 1.5, above4k: 2.0 },   // 2.0 when monthly fee >= 4000
    reputation: { base: 1.0 },
    localSeo:   { base: 1.0 },
  },
  remainderWeights: { ppc: 0.52, content: 0.30, meta: 0.18 },

  // Month 1 = setup at the standard monthly total. No setup fee.
  // setupHours = capacity rounded UP to the nearest 0.5 such that
  // (setupHours * blendedRate - monthlyTotal) <= roundDiscountCap,
  // preferring the largest qualifying clean number (e.g. $2,750 -> 17.5).
  setupDistribution: {             // fractions of setupHours, rounded to 0.5
    ppcBuild: 0.343, metaBuild: 0.20, citationCleanup: 0.143,
    reviewSoftware: 0.114, gbpSetup: 0.086, contentSetup: 0.057, dashboards: 0.057,
  },
  // Setup line-item scope definitions (drive the description copy — see §7b
  // for why these boundaries matter):
  // ppcBuild: keyword research, campaign architecture, ad copy & extensions,
  //   Google Tag Manager + GA4 verification with full conversion & call
  //   tracking setup, AND 2.0 hrs of graphic design for retargeting ad
  //   creative (the design hours are called out explicitly in both docs).
  // dashboards: the monthly reporting dashboard, described as CONNECTED TO the
  //   conversion tracking installed in ppcBuild — never as installing tracking
  //   itself (that would double-count ppcBuild's scope).
  setupDesignHours: 2.0,           // retargeting creative, always inside ppcBuild

  services: {   // the core program buckets (always inside the monthly fee)
    ppc:        { label: "Google Ads (PPC) Management" },
    meta:       { label: "META Ads Management" },
    content:    { label: "Ongoing Content Program" },
    localSeo:   { label: "Local SEO & Citations" },
    reputation: { label: "Reputation Management" },
    reporting:  { label: "Monthly Reporting & Optimization" },
  },

  addons: {     // always OUTSIDE the base fee; each has its own hours + price
    gbp:    { label: "Google Business Profile Mgmt", hours: 1.5, price: 250,
              setupHours: 1.5, bundledIntoProgramPrice: true },
    bing:   { label: "Bing / Microsoft Ads", hours: 4.0, price: 650, setupHours: 3.0 },
    lsa:    { label: "Google Local Services Ads", hoursRange: [2, 4], priceRange: [350, 650],
              setupHours: 3.0, adSpendFloor: 1500, adSpendSeparate: true },
    aiPhone:{ label: "AI Phone & Appointment Automation", price: 550, softwareLed: true },
    social: { label: "Social Media Management", hoursRange: [3, 4], priceRange: [500, 650],
              sensitivityFlag: true },   // renders soft "when you're ready" treatment
  },
};
```

## 3. Deliverable B — Allocation engine + tests

Create `lib/rgs-allocator.js` (server-side, also importable by tests) or `public/js/core/rgs-allocator.js` (client-side; pick whichever matches how `propGenerate` composes output — prefer client-side since proposal generation is client-side). Pure functions, no DOM.

```
allocateMonthly(feeMonthly, opts) -> { capacityHrs, buckets: {ppc, meta, content,
  localSeo, reputation, reporting}, totalHrs, effectiveRate, supportedAdSpend,
  supportedCampaigns, contentPieces: [min, max], warnings: [] }

allocateSetup(monthlyTotal) -> { setupHrs, discount, lineItems: {...}, warnings: [] }

priceAddon(key, opts) -> { hours, price, setupHours, notes }
```

The engine MUST reproduce these fixtures exactly (write them as unit tests following the `tests/smoke-test.js` pattern; add `npm test` script if absent):

| Fee/mo | Capacity | PPC | META | Content | LocalSEO | Rep | Reporting | Total |
|---|---|---|---|---|---|---|---|---|
| $2,500 | 15.2 | 6.0 | 2.0 | 3.5 | 1.0 | 1.0 | 1.5 | 15.0 |
| $2,000 | 12.1 | 4.5 | 1.5 | 2.5 | 1.0 | 1.0 | 1.5 | 12.0 |
| $3,500 | 21.2 | 9.0 | 3.0 | 5.5 | 1.0 | 1.0 | 1.5 | 21.0 |

Setup fixture: monthlyTotal $2,750 → 17.5 hrs (discount $137.50), line items 6.0 / 3.5 / 2.5 / 2.0 / 1.5 / 1.0 / 1.0.

Reallocation fixtures (META toggled off — see §4b):
- Monthly at $2,500: PPC 8.0 (absorbs META's 2.0), META 0, all other buckets unchanged, total still 15.0.
- Setup at $2,750: Google Ads build 9.5 (absorbs META build's 3.5, incl. the 2.0 design hours), no META build row, total still 17.5.
- META offered as add-on: 2.0 hrs → $325/mo (at-rate $330, rounded down), +3.0 hrs setup when sold.

Guardrail tests: fee below $1,500 → return a `minimumRetainer` warning instead of a hollow allocation; planned hours exceeding capacity by more than `roundDiscountCap`-equivalent → `marginWarning` with dollar shortfall.

## 4. Deliverable C — Service cards in the proposal builder

Add a service-card panel to the proposal flow in `public/index.html` + `prop.js`, appearing after vertical/type/pricing selection and before generation (i.e., as part of stage 2 or a new stage between `propGoStage2()` and `propGenerate()`).

- One card per core service and per add-on (from the rate card, so the list is data-driven).
- **Three states, cycled by click:** `included` (✓, default for all core services and for GBP), `suggested` (＋ badge — renders in the proposal/program docs as an advised option with price), `off` (excluded from all output).
- Defaults per vertical come from `rgs_addon_defaults` in verticals.js (see Deliverable E) — e.g. LSA defaults to `suggested` for roofers/plumbers/hvac, `off` for ecommerce.
- The existing `CHECK` / `EMPTY_BOX` rendering in `propBuildHTML` (~line 716–733) should be refactored to read card states instead of the current hardcoded `isWO`/`isRGS` branching: `included` → CHECK card, `suggested` → EMPTY_BOX add-on card with price, `off` → omitted.
- Card states persist with the saved report (extend the object handled by `core/storage.js` / `loadPropClient()`), so regenerating a proposal or generating the Program Detail later reuses them.
- `social` card with `sensitivityFlag`: when toggled to `suggested`, show a small inline warning in the builder UI ("renders with soft, no-pressure language") and never default it on.

### 4b. Toggling a CORE service off — reallocation rules (learned from the Mt Baker v5 iteration)

When a core program service (ppc, meta, content, localSeo) is toggled `off`, the program does NOT shrink. Its hours reallocate and the service converts to an offer:

1. **Hours reallocate, totals hold.** The freed monthly hours move to a designated sibling bucket (default: meta → ppc; configurable per toggle in the builder). Base total must still equal the allocator's target (e.g. META off at $2,500: PPC becomes 8.0, total stays 15.0). Same in setup: the service's build hours fold into the sibling's build (META build → Google Ads build, 9.5 of the 17.5) and the setup total is unchanged.
2. **The service auto-converts to a `suggested` add-on**, priced at its hours × blendedRate rounded DOWN to a clean number (META 2.0 hrs → $330 at-rate → $325/mo), with its build billed separately (+3.0 hrs) if later sold.
3. **Per-card status note + re-offer copy.** The builder must support a per-report free-text reason ("client's Facebook account is disabled") which renders in the client doc as an understanding, no-pressure disclaimer (acknowledge the situation, offer an alternative path such as Instagram-only, offer to circle back later) followed by 2–4 vertical-specific "why it's worth revisiting" selling points (for roofers: pre-search homeowner targeting by location/home age/home value, before-and-after visuals, storm-response zip targeting, retargeting site visitors who didn't call).
4. **No stale references anywhere.** Every copy block that names channels must be data-driven from card states, never static. (Real bug caught in review: a scope note still said ad spend goes to "Google & META" after META was toggled off.) Sibling-bucket copy updates too: PPC's description gains a "deeper campaign coverage" line explaining where the extra hours go.

See the `mt-baker-v5-meta-off-*` reference files for the exact rendered result of all four rules.

## 5. Deliverable D — Program Detail generator

New engine `public/js/engines/rgsplan.js` + template module `public/js/data/rgsplan-template.js`, registered in the nav like the other engines (`core/nav.js`, `app.js`).

**Inputs:** client name, vertical, RGS monthly price (from `#price-rgs`), card states, ad spend override (optional), content pace override (optional). When launched from a saved proposal report, all of this pre-fills; standalone mode asks for fee + vertical manually.

**Outputs — always generated as a pair,** downloadable/publishable the same way proposals are (reuse the publish flow in `renderPublishPanel` if practical):

1. **Internal Effort Map** — mirrors `mt-baker-internal-reference.html`: capacity math card, pricing-structure callout, v-change log (populate with generation inputs instead), monthly allocation cards, setup-phase card with discount math, scaling triggers, add-on menu with margins, scope notes.
2. **Client Program Detail** — mirrors `mt-baker-client-reference.html`: cover, Month One build-out (Section 01), Paid Media (02), Content/Local/AI (03), Reputation & Reporting + at-a-glance summary (04), Optional Add-Ons (05). Only cards in `included` state appear in sections 1–4; `suggested` add-ons appear in Section 05; `off` cards appear nowhere.

Convert both reference files into template literals with `[[PLACEHOLDER]]` substitution matching the pattern already used in `proposal-template.js`. Placeholders minimum set: client name, date, program price lines, every hours value, supported ad spend, campaign count, content piece range, hire comparison, vertical language blocks (below), footer.

Both documents end with the standard footer: `efelle creative // 901 5th Ave., Suite 1950 // Seattle, WA 98164 USA // 206.384.4909 // efelle.com` (already present in the reference files).

## 6. Deliverable E — Vertical language & seasonal planning

Extend each vertical in `verticals.js` with an `rgs_program` block. The generator pulls ALL industry-flavored copy from here; nothing industry-specific may be hardcoded in the engine or templates. Draft content below — refine wording per vertical, keep the structure exact.

```js
rgs_program: {
  audienceNoun: "homeowners",          // roofers/plumbers/hvac...; "clients" construction; "customers" ecommerce
  searchExample: '"roofing company near me" or "[city] roofer"',
  contentExamples: "service-area pages, articles, and portfolio items showcasing completed projects",
  seasonal: {
    summary: "…one sentence used in the client doc lede…",
    peaks: [ { months: "Oct–Feb", label: "storm season", driver: "wind and rain damage calls" },
             { months: "May–Aug", label: "replacement season", driver: "planned re-roofs" } ],
    planningNote: "…how the program shifts budget/hours toward the peaks…",
    lsaNote: "…why/when LSA matters for this industry, or null if not applicable…",
  },
  rgs_addon_defaults: { gbp: "included", bing: "off", lsa: "suggested",
                        aiPhone: "suggested", social: "off" },
}
```

Seasonal profiles to draft (adjust as sensible):

| Vertical | Peaks | LSA relevance |
|---|---|---|
| roofers | Oct–Feb storm damage; May–Aug replacements | high — storm surge channel |
| plumbers | Dec–Feb freeze emergencies; steady year-round | high — emergency call channel |
| hvac | Jun–Aug cooling; Nov–Feb heating; shoulder-season tune-ups | high |
| electrical | steady; storm-outage spikes; EV/panel upgrade demand | medium |
| landscape | Feb–May spring ramp; Jun–Aug maintenance; Sep–Oct cleanup | medium |
| construction | Mar–Sep build season; winter = planning/permits content | low |
| home_services | spring/summer general peak | medium |
| ecommerce | Q4 / BFCM; META weight naturally higher | none — default `off` |
| other | neutral copy; builder prompts the user for peaks at generation time | ask |

Where the seasonal block feeds output: the client doc's cover subtitle and Section 02 "Growing together" callout reference the peaks; the LSA add-on card uses `lsaNote`; the internal doc's scaling-trigger card gets a per-peak row (e.g. "storm surge months: LSA to high end, consider surge campaign +1–1.5 hrs").

## 7. Writing rules (hard requirements for client-facing output)

- No em-dashes anywhere in client-doc prose; use commas, periods, colons, or parentheses. (A dash as an empty-cell placeholder in an hours column is fine.)
- The setup callout is titled "Why this approach:" (not "Why this matters").
- Pricing is always framed as base + add-on ("$2,500 base + $250 GBP effort"), never as a raised base price. Bing/LSA/social/AI Phone are always described as outside the program price.
- The internal blended rate, margins, and discount math appear ONLY in the internal doc.
- Social media add-on always renders with the understanding, no-pressure treatment when a client sensitivity flag is set (add a per-report `socialSensitivity` boolean to the builder, default off).

### 7b. Automated ship-check (run before every generation; fail with a visible error listing what failed)

This is the full pre-flight validation, expanded from a real pre-ship review. All checks are computed from the generated HTML, not from the inputs:

1. **Sums:** setup line items sum exactly to the stated setup total, in both docs. Monthly summary rows sum exactly to the stated monthly total. Base total ≤ capacity; total with bundled add-ons ≤ its capacity.
2. **Rate reconciliation:** every add-on price reconciles to hours × blendedRate within the round-number discount pattern (rounded down to a clean number, never up).
3. **Card numbering:** section/card numbers are sequential with no gaps or duplicates (a card inserted or removed mid-list must renumber the rest).
4. **Off-service isolation:** a service toggled `off` appears nowhere in the base program sections of either doc — not in cards, summary rows, callouts, or scope notes.
5. **No double-counted scope:** flag when two setup line items describe the same work (e.g. conversion tracking in both the PPC build and the dashboard row — the dashboard row must reference, not repeat, the tracking work).
6. **Client-doc hygiene:** no em-dash in text nodes; no occurrence of the blended rate, "blended", "margin", or discount math; hire comparison uses the rate-card value; standard efelle footer present; "Why this approach" phrasing used.
7. **Copy freshness:** every channel named in prose matches a card in `included` state (catches the stale "Google & META" class of bug automatically).

## 8. Guardrails

- Fee < $1,500/mo → builder shows "retainer too small for a full program" instead of generating.
- If the user overrides hours manually (stretch goal: editable hour fields in a review step), recompute effective rate live and warn when below `blendedRate` minus the discount cap.
- Ad spend input recomputes supported campaigns and the PPC scope line; never silently keep stale numbers.
- Rounding: all bucket hours to nearest 0.5; totals must re-sum after rounding (adjust the largest weighted bucket by ±0.5 to reconcile, never a floor bucket).

## 9. Suggested build order (separate commits)

1. `rgs-rate-card.js` + allocator + tests (pure logic, no UI). Run tests.
2. Vertical `rgs_program` blocks for all 9 verticals.
3. Service-card panel in the builder + state persistence + refactor of `rgsMainCards`/`rgsAddonCards` to read card states.
4. `rgsplan.js` engine + templates from the reference files; generation from a saved proposal.
5. Standalone mode + publish flow + hygiene check.
6. Update `public/user-guide.html` and CHANGELOG.md (the repo maintains one via `core/changelog.js`).

## 10. Future add-on (do NOT build now): RGS Program Selector

The next evolution after the above ships. Documented here so phases 1–4 make choices that keep it cheap.

**Concept:** instead of one program, the client sees **three side-by-side programs at different price points** (working names: Foundation / Growth / Market Leader) and selects the one they want.

- Each tier is just a fee point + card-state preset run through the same allocator — the engine built in §3 already handles arbitrary fees, so tier generation is configuration, not new math. Add a `tiers` block to the rate card (e.g. base fee ×0.8 / ×1.0 / ×1.5, with add-on presets per tier: Growth = GBP included; Market Leader = GBP + LSA included).
- Builder UX: a "3-program mode" toggle in the Program Detail flow. The middle tier is the recommended one and gets visual emphasis; the user can adjust each tier's fee and cards before generating.
- Client-facing output: a selector page (same design system) with three program cards showing price, hours, included services, and seasonal notes, plus a comparison row. Reuse the publish flow so it's a live link; the client's selection POSTs to a small `server.js` endpoint that stores the choice on the report record and surfaces it in the app (notification/email is a nice-to-have).
- After selection, the full two-document Program Detail generates automatically for the chosen tier.

**Implications for the current build:** keep the allocator pure and fee-agnostic (§3 already requires this); store card states as data rather than DOM state (§4 already requires this); template placeholders should not assume a single program per document.

## 11. Acceptance checklist

- [ ] Mt Baker inputs (roofers, $2,500 + GBP included, LSA/Bing/AI Phone suggested, social suggested w/ sensitivity flag) reproduce the two v4 reference documents in structure, numbers, and tone, with roofing seasonal language.
- [ ] Same inputs with META toggled off (+ per-card reason "Facebook account disabled") reproduce the v5 reference pair: PPC 8.0, setup Google build 9.5, META as a $325/mo suggested add-on with the disclaimer and roofing selling points, and zero META references in base sections.
- [ ] The §7b ship-check passes on every generated pair and demonstrably fails when seeded with a bad total, a stale channel reference, or an em-dash.
- [ ] $2,000 and $3,500 fixtures match the table in §3.
- [ ] Toggling a card to `off` removes it from proposal AND both program docs.
- [ ] `suggested` add-ons appear as unchecked cards with prices in the proposal and in the client doc's Section 05.
- [ ] Client doc passes the hygiene check (no rate, no margins, no em-dashes).
- [ ] Ecommerce vertical: LSA absent, META weighting language present, no "homeowners."
- [ ] All existing proposal flows (new website, wo_rgs, rgs_only) still generate unchanged when cards are left at defaults.
