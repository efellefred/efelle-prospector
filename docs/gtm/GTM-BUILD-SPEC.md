# GTM Strategy Builder: Implementation Spec

**Engine id:** `gtm` · **Route:** `/gtm-strategy` · **Report type:** `'gtm'`
**Read `GTM-BRIEFING.md` first** for why this exists and how the packs work. This file is the how.

---

## 0. Before you write code

Repo conventions are in `/CLAUDE.md`. The ones that matter here:

- `git pull origin main` before any edit.
- Vanilla ES modules. No framework, no build step, no TypeScript.
- Do not use local preview. Express caching serves stale files. Verify on the live site after push.
- Push to `main` auto-deploys to Railway in 1 to 2 minutes.

**Existing patterns to copy, not reinvent:**

| Need | Copy from |
| --- | --- |
| Engine registration | `public/js/core/nav.js` -> `ENGINES` and `SCREEN_PATHS` |
| Multi-stage screen markup | `public/index.html` -> `#screen-csp` (stage eyebrow, stage title, stage sub) |
| Client search / prior client select | `#cca-client-search` block in `index.html` |
| Model calls | `public/js/core/api.js` -> `callAPI`, `callWithWebSearch`, `repairJSON` |
| Saving output | `public/js/core/reports.js` -> `saveReport(type, clientName, metadata, engineData, html)` |
| Full-report HTML builder | `public/js/engines/competitor.js` -> `buildComparisonReportHTML()` |
| Window-scoped engine API | `competitor.js` attaches `window.competitorGoStage1` etc. Follow that |

---

## 1. Files

### Create

```
public/js/engines/gtm.js                    engine
public/js/verticals/_schema.json            pack schema (written)
public/js/verticals/plumbing.json           pack (written)
public/js/verticals/index.js                pack loader + validator
public/js/gtm/sections.js                   the 19-section registry and prompts
public/js/gtm/research.js                   census, competitor, regulatory, brand audit
public/js/gtm/qa.js                         the export gate
public/js/gtm/render.js                     HTML document builder
public/js/gtm/brief.js                      owner's brief projection, see GTM-OWNER-BRIEF.md
data/regulatory/seattle-wa/plumbing.json    first regulatory file
docs/gtm/fixtures/nics-plumbing.input.json  regression fixture (written)
docs/gtm/fixtures/nics-plumbing.owner-brief.reference.md   brief regression target (written)
```

### Modify

| File | Change |
| --- | --- |
| `public/js/app.js` | Add `import './engines/gtm.js';` after `competitor.js` |
| `public/js/core/nav.js` | Add `gtm` to `ENGINES`, add `gtm: '/gtm-strategy'` to `SCREEN_PATHS` |
| `public/index.html` | Add `<div class="screen" id="screen-gtm">` with three stage blocks. Add home-screen card and row entries pointing at `showEngine('gtm')` |
| `server.js` | Add `/api/census` proxy (see 3.1). Add `/gtm-strategy` to the catch-all route list |
| `.env` | `CENSUS_API_KEY=` |
| `CHANGELOG.md` | Version bump entry |

**nav.js registration:**

```js
gtm: {
  iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  iconBg: '#0D5560',
  eyebrow: 'Sales Tool &middot; Brand &amp; Go-To-Market Strategy',
  eyebrowColor: '#5eead4',
  accent: '#5eead4'
},
```

---

## 2. State contract

One object, held in `gtm.js`, persisted via `saveReport` as `engineData`. Every field is either user input, imported from a prior report, or research output. Nothing is model-invented.

```js
const gtmState = {
  meta:     { clientName, createdAt, version, engineVersion },

  company:  { legalName, dba, ownerFirstName, entityType, ubi, state,
              phone, domain, domainStatus,          // 'secured' | 'placeholder' | 'undecided'
              addressLine, city, zip, addressIsPublic,
              headcount, hiringPlan, jobsPerDayCapacity, serviceRadiusMiles,
              yearsInTrade, background,
              registrationNumber, certNumber, bondAmount, insuranceCoverage,
              warrantyTerms, hoursModel,            // 'A_24_7' | 'B_extended' | 'C_none'
              hoursDetail, financingAppetite, monthlyBudgetComfort },

  vertical: { id, pack },                            // pack = loaded JSON

  scope:    { includesBrand: false,                  // default OFF, ~1 project in 5
              includesMessaging: false,              // default OFF
              includesStrategy: true,
              includesChannelPlans: [] },            // 'localseo' | 'organicseo' | 'paid' | 'silo'

  market:   { metroId, cityName, stateCode,
              tiers: { core: [...], expansion: [...], secondary: [...] },
              zctas: [...],
              zipNeighborhoodMap: { "98103": ["Fremont","Wallingford",...] },
              census: { rows: [...], cityBenchmark: {...}, vintage: "2019-2023" },
              regulatory: { file, items: [...], stale: false } },

  competitors: { source: 'imported'|'fresh', importedReportId,
                 set: [...], serpHolders: [...], gaps: [...] },

  brand:    { logoUrl, moodBoardUrl, palette: [...], typography: {...},
              existingTaglines: [...], assets: [...], auditFindings: [...] },

  offer:    { commercialMode,                    // 'referred' (default) | 'embedded'
              projectType,                       // see the ladder below
              strategyFee, websiteFee, contentFee, oneTimeTotal,
              rgsMonthly, hostingMonthly, adSpendMin,
              paymentTerms, financeMonths, noticeDays, launchWeeks,
              designRounds, contentTurnaroundDays, contactEmail },

  output:   { sections: {}, placeholders: [...], qa: {...}, html: null }
};
```

**Placeholder record shape.** The QA gate keys off `owner`.

```js
{ token: 'WEBSITE FEE', owner: 'efelle' | 'client', section: '17.1', label: '…' }
```

---

## 3. Research contracts

Stage 02 runs these in order. Each returns real data or throws. **No training-data fallback**, matching the existing rule in `core/api.js`.

Report progress through the `onStatus(msg, kind)` callback already supported by `callWithWebSearch`.

### 3.1 Census (`research.js` -> `pullCensus`)

Proxy through the server so the key never reaches the browser, matching how `/api/messages` works.

```
GET /api/census?vintage=2023&vars=B25035_001E,B25034_001E&geo=zcta&ids=98103,98107
```

Server builds:

```
https://api.census.gov/data/{vintage}/acs/acs5
  ?get=NAME,{vars}
  &for=zip+code+tabulation+area:{ids}
  &key={CENSUS_API_KEY}
```

**Three encoding rules. Getting these wrong costs an hour each.**

1. `zip+code+tabulation+area` with **plus signs**. Percent-encoded spaces return a misleading "A valid key must be included" page rather than a geography error.
2. **Max five variables per request.** Ten-plus against a `place` geography returns HTTP 400. Batch and merge.
3. City benchmark uses `&for=place:{placeFips}&in=state:{stateFips}`. Seattle is `place:63000&in=state:53`.

**Variables by `housingRelevance`:**

| Metric | Table | Fields |
| --- | --- | --- |
| Median year built | B25035 | `_001E` |
| Pre-1940 share | B25034 | `_001E`, `_011E` |
| Owner-occupancy | B25003 | `_001E`, `_002E` |
| Median home value | B25077 | `_001E` |
| Single-family share | B25024 | `_001E`, `_002E`, `_003E` |
| Heating fuel (HVAC packs) | B25040 | `_001E`, `_002E`, `_004E` |

**All percentages computed in JS, never by the model.** The model receives a finished table and writes prose about it.

```js
pre1940Share    = B25034_011E / B25034_001E
ownerOccupancy  = B25003_002E / B25003_001E
singleFamily    = (B25024_002E + B25024_003E) / B25024_001E
```

**Guardrail to encode as a test:** the city benchmark must come from the `place` pull, never from a web-sourced figure. Metro-level housing-age numbers are widely quoted and materially different. Seattle metro reads 9.7% pre-1940; Seattle city reads 23.4%. Using the metro number understates the argument by half and is wrong in the client's own market.

### 3.2 Competitors (`research.js` -> `pullCompetitors`)

If a prior `csp` or `competitor` report exists for this client, import it. `listReports('csp')` then `getReport(id)`.

Otherwise run fresh: DataForSEO Labs for traffic and rankings, Google Places for rating, review count, claimed status, photo count and post recency, Firecrawl for on-page claims (headline offers, pricing presence, emergency claims, trust badges, blog recency).

Output per competitor:

```js
{ name, domain, rating, reviewCount, claimed, photoCount, postRecencyDays,
  monthlyOrganicVisits, sixMonthTrend, yearsInBusiness, auditScore,
  onPageClaims: { pricingShown, emergencyClaim, freeEstimate, trustBadges, blogLastUpdated },
  neighborhoodPosture }
```

Plus `serpHolders`: for each seed keyword, the top three domains. The concentration finding matters. In the reference engagement one national brand held eight of ten.

**Gap detection is mechanical.** Derive, do not ask the model to invent:

| Gap | Rule |
| --- | --- |
| Nobody owns the neighborhood | No competitor has a neighborhood page, or has one with a non-local address |
| Nobody shows pricing | `pricingShown === false` for all |
| Nobody leads on local content | No competitor ranks for `{neighborhood} {trade}` intent |
| Reputation opening | Any competitor with `rating < 3.5` or `reviewCount < 25` |
| No personal accountability | No competitor makes an owner-level claim |

### 3.3 Regulatory (`research.js` -> `loadRegulatory`)

```js
data/regulatory/{metroId}/{verticalId}.json
```

Every item carries `sourceUrl`, `effective`, `authority` and the file carries `reviewedOn` / `reviewDue`.

**If `reviewDue` is past, do not render the section.** Emit a stale-data warning and add a research task to the output. A confidently stated permit rule that has changed is the single most damaging error this engine can make.

### 3.4 Brand audit (`research.js` -> `auditBrand`)

Takes the uploaded mood board and asset images. Extracts palette hex values with a role per color, typography, existing taglines, and the asset inventory.

Then cross-checks every asset against every other. These are mechanical and each was a real finding in the reference engagement:

| Check | Trigger |
| --- | --- |
| Domain mismatch | More than one domain string across assets |
| Phone mismatch | More than one phone string |
| Service scope conflict | Assets claim "commercial" while the strategy is residential |
| Missing registration number | Print assets without the number, where the state requires it |
| Address vs service area | Business address outside the declared core tier |
| Tagline collision | Existing tagline plus proposed positioning line plus name |
| Photography conflict | Asset context contradicts the target customer setting |
| Missing asset | Trade expects a job-site yard sign and none exists |

---

## 4. Section generation

`sections.js` exports an ordered registry. Each entry declares what it needs, so a section with unmet inputs degrades to a flagged stub instead of hallucinating.

```js
{ id: '03', number: 3, title: 'Service Area Strategy',
  requires: ['market.tiers', 'market.census', 'vertical.pack'],
  emitsPlaceholders: [],
  prompt: (s) => `…`,
  postProcess: (text, s) => text }
```

**Rules for every prompt:**

- Pass finished data structures. Never ask the model to compute a percentage, sum a column or divide a payment schedule.
- Any figure that is illustrative must be emitted as a `[BRACKET]` token, never as a plausible number.
- House style: no em dashes, `efelle` always lowercase, one voice per passage.
- Cross-references by number only, and only to sections that exist in the registry.

**The nineteen sections and their inputs:**

| # | Section | Primary inputs |
| --- | --- | --- |
| 1 | Core Positioning | vertical, market, competitors.gaps |
| 2 | Competitive Landscape | competitors (all) |
| 3 | Service Area Strategy | market.tiers, market.census |
| 4 | Ideal Customer | vertical.icp, market.census |
| 5 | Services & Specialties | vertical.specialties (gated by `requires`), market.regulatory |
| 6 | Licensing & Trust | vertical.licensing[state], company credentials |
| 7 | The Four Promises | constant, lightly trade-flavored |
| 8 | Operations Stack | vertical.opsStack, company.hoursModel |
| 9 | Proof / Evidence Library | constant |
| 10 | Options, Financing & Estimates | vertical.ticketBands, competitors.gaps.pricing |
| 11 | Brand Voice & Messages | brand, naming argument |
| 12 | Applying the Existing Identity | brand.palette, brand.assets, brand.auditFindings |
| 13 | Website Architecture | vertical.navCategories, vertical.gbp, company.addressIsPublic |
| 14 | Go-to-Market | vertical.seedKeywords, vertical.seasonality, market |
| 15 | Measurement & Expectations | vertical.cplBenchmarks |
| 16 | Scope of Work | offer. **Mode-dependent**, see below |
| 17 | Investment | offer. **Mode-dependent**, see below |
| 18 | What We Need From the Client | all unresolved client-owned placeholders |
| 19 | Next Steps & Approval | derived from 18 plus efelle tasks |
| A | Regulatory | market.regulatory |
| B | Copy Library | 1, 6, 7, 11 |
| C | Search Content Plan | vertical.contentTiers, market |

### Scope toggles

Brand and messaging work applies to roughly one project in five. **Both default to `false`.** Turn them on when brand work is actually scoped, and the failure mode to avoid is every document shipping with sections nobody bought.

| Toggle off | Sections removed | Sections reduced |
| --- | --- | --- |
| `includesBrand` | 11 Brand Voice, 12 Applying the Existing Identity | 1 loses the naming argument, Appendix B loses voice guidance |
| `includesMessaging` | Appendix B Copy Library | 1 keeps the strategic position, drops tagline work. 13 keeps architecture, drops hero copy |

With both off the document is market, service area, ICP, services, trust, operations, channels and measurement. About half the length, and still the argument that wins the deal.

**Sections renumber, they do not leave gaps.** Build the ordered list from the enabled set and number at render. A document jumping from 10 to 13 tells the client something was removed.

**QA rule 19:** no gap in the rendered section sequence, and no cross-reference pointing at a section the scope removed. A reference to a dropped section is blocking, and the fix is to rewrite the sentence, never to re-enable the section.

**Sections 16, 17 and 19.3 are mode-dependent.** `offer.commercialMode` decides:

| Mode | 16 Scope | 17 Investment | 19.3 |
| --- | --- | --- | --- |
| `referred` | One-paragraph summary of the workstreams, pointing to the proposal | One-page summary: one-time total, monthly total, launch window, pointer to the proposal | Next steps only. **No signature block** |
| `embedded` | Full scope inventory | Full fee tables and monthly cost breakdown | Signature block |

**`referred` is the default.** Set `embedded` only when no proposal will be issued, either because the strategy is the whole sale or because the client has already contracted and this is the delivery plan. Two signature blocks live in one deal is a confusion the client has to resolve, and they resolve it by asking which one counts.

Both modes render from the same `offer` object in the Client Record. Neither engine owns pricing.

### Project type ladder

The build fee is not one number. `offer.projectType` selects the tier, and the strategy recommends one based on what the preceding sections established.

| id | Label | Standard | When |
| --- | --- | --- | --- |
| `workOrder` | Work order against the existing site | Scoped per job | The site is sound and needs targeted work, not a rebuild |
| `template` | Template-based site | $7,500 | Straightforward need, standard structure, speed matters |
| `semiCustom` | **Semi-custom site** | **$12,500** | **The default and the sweet spot.** Assume this unless something argues otherwise |
| `custom` | Fully custom | Quoted | Genuine complexity: integrations, unusual IA, heavy content architecture |

**Standard recurring:**

| Item | Standard | Includes |
| --- | --- | --- |
| Hosting and support | **$145 per month** | CMS updates and upgrades, server maintenance, 24/7 support |
| Revenue Growth Service | **Scoped per client** | Never quoted in the strategy. See the rule below |

The engine should **recommend a project type in Section 16 and justify it from the strategy**, since the preceding sections have just established the page count, the neighborhood pages, the specialty pages and the conversion requirements. That recommendation is what makes the number credible rather than arbitrary.

Values above are defaults. Anything below them on a live deal is a deliberate exception and should be flagged as such in the record, not silently inherited by the next client.

### Referred-mode copy template

Use this shape verbatim so every strategy document points forward the same way. Tokens come from `offer`.

**Section 16, Scope of Work, referred mode**

> efelle will deliver this strategy through three workstreams:
>
> | Workstream | What it covers |
> | --- | --- |
> | 1. Website design and development | {workstream1Summary} |
> | 2. Content production | {workstream2Summary} |
> | 3. Revenue Growth Service | Ongoing local SEO, paid search, Local Services Ads, Google Business Profile management, reputation management and monthly reporting. **Scoped to your needs, see below** |
>
> **Your Revenue Growth Service program will be built out and recommended based on your specific needs.** There is no single package. What you run, and what it costs, depends on your service area, your capacity and where the opportunity is, all of which this document has just established.
>
> **A detailed proposal follows.** It sets out each bucket specifically: the pages and templates being built, relevant examples of our work in {industry}, the recommended Revenue Growth Service program and the options around it, terms, the payment schedule, and a signature block you can execute online.

**Section 17, Investment, referred mode. One page, no fee tables.**

> | | |
> | --- | --- |
> | **Build investment** | {oneTimeTotal} one-time, covering strategy, a {projectTypeLabel} and launch content |
> | **Ongoing program** | Your Revenue Growth Service program will be built out and recommended based on your specific needs. Recommendation and pricing in the proposal |
> | **Hosting and support** | {hostingMonthly} per month, covering CMS updates and upgrades, server maintenance and 24/7 support |
> | **Advertising** | From {adSpendMin} per month, paid directly to Google |
> | **Launch window** | {launchWeeks} weeks from kickoff |
>
> These are the headline numbers. **The proposal that follows carries the detail:** what each workstream includes line by line, the recommended Revenue Growth Service program and its options, payment terms, and the agreement itself.
>
> Advertising spend is always paid by {clientShortName} directly to Google and is never billed through efelle.

**Section 19.3, referred mode.** Replace the approval and signature block with next steps only:

> **Nothing to sign here.** Review this strategy, mark anything that does not match the business, and return the items in Section 18. The proposal follows with the full scope and an online signature block.

**Rules the engine enforces in referred mode:**

- **Never quote a Revenue Growth Service price in the strategy at all**, not even a "from" figure. RGS is scoped per client and priced in the proposal. Any number here becomes the anchor the client measures the proposal against, and every option above it reads as an upsell. `offer.rgsMonthly` is rendered by `prop` only.
- Never render a fee table, a payment schedule or terms. Those belong to the proposal.
- Never render a signature block. QA rule 18 blocks it.

Section 18 is **generated**, not written: it is the client-owned placeholder list rendered as a table. That guarantees it can never drift from the document body, which it did twice by hand.

---

## 5. The QA gate (`qa.js`)

`runQA(gtmState) -> { pass, blocking: [], warnings: [] }`. **Export is disabled while `blocking` is non-empty.**

Every rule below caught a real defect in the reference build. Roughly sixty surfaced across three revision rounds; nearly all were mechanical.

| # | Rule | Severity |
| --- | --- | --- |
| 1 | Every `Section N` and `N.M` reference resolves to a heading that exists | blocking |
| 2 | No reference inserted mid-sentence leaving a doubled noun or lowercase sentence start. Regex for `\b(\w+) \1\b` and for a reference phrase immediately followed by its own trailing noun | blocking |
| 3 | No efelle-owned placeholder remains. Client-owned placeholders are expected and allowed | blocking |
| 4 | Stated counts match actual list length. Scan for `the (ten\|two\|five\|eight) [a-z ]+` and compare to the referenced list | blocking |
| 5 | Same fact, same number everywhere. Build a fact index of review targets, month boundaries, totals, percentages | blocking |
| 6 | Arithmetic: line items sum to stated totals, budget splits sum to 100, payment schedules divide evenly | blocking |
| 7 | No phase or stage claims a month already claimed by the next | blocking |
| 8 | No term means two things. Reserve "Phase" for time and "Workstream" for scope | blocking |
| 9 | One voice per passage. No first-person singular and plural inside one block | blocking |
| 10 | No draft-process language: "this section is new", "the original draft", "to be confirmed", struck-through items | blocking |
| 11 | Terminology traps from the pack are never violated | blocking |
| 12 | Version string agrees across cover, footer and metadata | blocking |
| 13 | Every claim naming a competitor, a statute or a platform policy carries a citation or hedged phrasing | warning |
| 14 | House style: no em dashes, `efelle` lowercase | blocking |
| 15 | Regulatory file is inside its review window | blocking |
| 16 | Every image referenced resolves | blocking |
| 17 | If a `prop` report exists for this client, every shared figure matches the record. Divergent pricing across two live documents is blocking | blocking |
| 18 | `commercialMode` is `referred` and a signature block is present: blocking | blocking |
| 19 | Rendered section numbers are contiguous, and no cross-reference points at a scope-removed section | blocking |

---

## 6. Render (`render.js`)

Single-file HTML, print-to-PDF, matching efelle deliverable standards.

- efelle logo from `https://www.seattlewebdesign.com/uploads/_proposal/e-logo-white.png` inside a `.logo-mark` wrapper. Never inline SVG or base64.
- Client logo alongside it on the cover.
- Footer: `efelle creative // 901 5th Ave., Suite 1950 // Seattle, WA 98164 USA // 206.384.4909 // efelle.com`
- Fonts: Plus Jakarta Sans, JetBrains Mono for codes.
- Tokens: `--black #1D1D1F`, `--orange #F56300`, `--gray-1 #3A3A3C`, `--gray-2 #6E6E73`, `--gray-4 #D2D2D7`, `--gray-5 #F5F5F7`.
- Body max-width 780px, letter page size, page numbers bottom-center, cover excluded from numbering.
- Tables must break across pages (`break-inside: auto` on `table`, `display: table-header-group` on `thead`). Forcing tables whole added twenty-five blank-ish pages in the reference build.
- **Bold inside dark table headers must inherit color.** `.doc thead th strong { color: inherit }`. Without it, bold header text renders black on black.
- Wait for images and fonts before generating the PDF.

**The owner's brief renders here too.** Every engagement ships two documents from one state: the full
strategy and an 8 to 14 page brief written to the person who signs. It is a projection of the same
`gtmState`, never a second generation pass, and it runs after the full document clears QA. The section
map, the voice rules, the nine extra QA rules and the render overrides are specified in full in
**`docs/gtm/GTM-OWNER-BRIEF.md`**. Read it before building `render.js`, because the two renders share a
stylesheet and the brief adds overrides to it.

Save both under one report: `saveReport('gtm', clientName, metadata, gtmState, { full, brief })`.

---

## 7. Definition of done

**Phase 1**

- [ ] `showEngine('gtm')` routes to `/gtm-strategy` and back/forward works
- [ ] Vertical pack loads and validates against `_schema.json`
- [ ] Census returns real data for nine ZCTAs plus a city benchmark, percentages computed in JS
- [ ] All nineteen sections render from the fixture
- [ ] QA gate runs and blocks export on a seeded defect
- [ ] Report saves and reloads from the library, with both documents under one entry
- [ ] Owner's brief renders, passes its own QA rules, and its cover date matches the full document
- [ ] **Regression: build from `fixtures/nics-plumbing.input.json` and diff against the shipped Nic document. Any section the engine cannot reproduce is a missing pack or state field. Log it, do not paper over it**
- [ ] **Regression: diff the generated brief against `fixtures/nics-plumbing.owner-brief.reference.md`**

**Phase 2:** competitor import from `csp`, Firecrawl on-page claims, brand audit from uploaded mood board.

**Phase 3:** regulatory knowledge base with Seattle seeded, stale-file blocking.

**Phase 4:** electrical, roofing, HVAC and landscaping packs, each validated against the schema and smoke-tested end to end.

---

## 8. Do not

- Do not let the model compute arithmetic or invent a figure that looks plausible.
- Do not fall back to training data when a research step fails. Throw, matching `api.js`.
- Do not branch engine code on trade. If you need a conditional, it belongs in the pack.
- Do not publish a regulatory claim without a `sourceUrl`.
- Do not ship an export path that bypasses the QA gate.
