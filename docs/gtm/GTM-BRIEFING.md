# GTM Strategy Builder: Build Spec
## efelle Prospector · new engine `gtm`

**Working title:** Brand, Positioning & Go-To-Market Strategy Builder
**Status:** Spec for review. Derived from the Nic's Plumbing engagement, August 2026, which produced the reference output.

---

## 1. What this engine is

It takes a home-service prospect and produces the deliverable efelle just hand-built for Nic's Plumbing: a 60-page, co-branded, client-ready brand and go-to-market strategy with a scope of work and pricing attached.

**The insight that makes it productizable:** the document skeleton is constant across every home-service trade. What changes is four swappable input packs. Plumbing, electrical, roofing, HVAC and landscaping all need the same nineteen sections; they differ in services taxonomy, seasonality, regulation and ticket size.

```
CONSTANT                        SWAPPABLE
19-section skeleton      ←      Vertical Pack   (trade)
Section logic and prose  ←      Market Pack     (geography + competitors + census)
Brand application rules  ←      Brand Pack      (logo, palette, assets)
Scope and pricing model  ←      Company Pack    (client facts, capacity, credentials)
```

---

## 2. Where it fits in Prospector

### Existing engines and the gap

| Engine | Path | Produces |
| --- | --- | --- |
| `wsr` | `/war-report` | Website audit and recommendations |
| `competitor` | `/competitor-analysis` | Competitive comparison |
| `csp` | `/growth-strategy` | Market entry / growth strategy (drives `cca.js`) |
| `cap` | `/action-plan` | Client action plan |
| `prop` | `/proposal` | Proposal |
| `notes` | `/sales-handoff` | Sales handoff |

`csp` produces the **market entry report** that became Section 2 of the Nic document. `prop` produces the **proposal** that became Sections 16 and 17. Nothing produces the strategy that sits between them, which is exactly the artifact that closed this deal.

### Recommendation: new engine, chained not duplicated

```
public/js/engines/gtm.js          ← new engine
public/js/verticals/*.json        ← new: vertical packs
data/regulatory/<metro>/<trade>.json  ← new: regulatory knowledge base
```

Register in `public/js/core/nav.js`:

```js
gtm: {
  iconSvg: '<svg …compass or map-pin…>',
  iconBg: '#0D5560',
  eyebrow: 'Sales Tool &middot; Brand &amp; Go-To-Market Strategy',
  eyebrowColor: '#5eead4',
  accent: '#5eead4'
},
```

```js
const SCREEN_PATHS = { …, gtm: '/gtm-strategy' };
```

Screen `<div class="screen" id="screen-gtm">` in `public/index.html`, following the `screen-csp` stage pattern. Report type `'gtm'` for `saveReport()`.

**Use `CSP_MODEL` (opus), not `API_MODEL`.** This engine writes 17,000 words of argued prose. It is the second engine after `csp` that justifies the larger model, and `state.js` already carries the setter.

### Chain from prior reports, do not re-collect

The single biggest efficiency: if `csp`, `competitor` or `wsr` has already run for this client, `gtm` should offer to import it. `listReports()` already filters by type, and the `csp` screen already has a "Select a previous client" search. Reuse that component.

```
Stage 0: Client select  →  found prior reports?  →  import competitors,
                                                     site audit, services
```

For Nic, that import alone would have supplied all of Section 2.

---

## 3. The four input packs

### 3.1 Vertical Pack (ships with the app, one JSON per trade)

This is the reusable asset. Everything trade-specific lives here so the engine code never branches on trade.

```jsonc
{
  "id": "plumbing",
  "label": "Plumbing",
  "everydayServices": ["Leak detection and repair", "Faucet repair", "…"],
  "specialties": [
    { "id": "older-home", "label": "Older-Home Plumbing",
      "services": ["Galvanized pipe replacement", "Copper repiping", "…"],
      "positioningLine": "Modern solutions without unnecessary damage to the character of the home." },
    { "id": "drain-sewer", "label": "Drain & Sewer", "services": ["…"] },
    { "id": "water-heaters", "label": "Water Heaters", "services": ["…"] }
  ],
  "navCategories": ["Plumbing Repair", "Water Heaters", "Drain & Sewer", "Repiping"],
  "highValueServices": ["Whole-home repiping", "Sewer repair", "Trenchless replacement"],
  "ticketBands": { "everyday": [150, 900], "midtier": [900, 4000], "highValue": [4000, 20000] },
  "seasonality": [
    { "months": "Sep-Nov", "driver": "Fall rains, root intrusion, sewer backups",
      "push": "Sewer camera inspections, backwater valves", "publishLead": "August" },
    { "months": "Dec-Feb", "driver": "Cold snaps, burst pipes, water heater failures",
      "push": "Emergency spend peak", "publishLead": "November" }
  ],
  "licensing": {
    "state": "WA",
    "bodies": ["WA Dept of Labor & Industries"],
    "credentials": ["Contractor registration", "Journey-level plumber certification"],
    "advertisingRule": "RCW 18.27.100: registration number required in advertising"
  },
  "terminologyTraps": [
    { "wrong": "backflow preventer", "right": "backwater valve",
      "context": "homeowner-facing sewer backup marketing" }
  ],
  "adjacentRevenue": ["Backflow assembly testing (BAT certification)"],
  "seedKeywords": { "everyday": ["drain cleaning", "water heater repair"],
                    "specialty": ["repiping", "trenchless sewer replacement"] },
  "contentTiers": { "tier1": ["Do I need a permit to replace a water heater in {city}?"] },
  "icpAxes": ["home age", "owner-occupancy", "home value", "single-family share"],
  "housingRelevance": "high"
}
```

**`housingRelevance` is the switch that makes this work across trades.** Plumbing and electrical care enormously about housing age. Landscaping cares about lot size and home value, not build year. Roofing cares about roof age, which correlates with build year but on a different curve. The Market Pack reads this field to decide which census variables matter and how to argue from them.

**Ship five packs at launch:** plumbing, electrical, roofing, HVAC, landscaping. The plumbing pack is already written, it is the Nic document.

### 3.2 Market Pack (generated at runtime)

| Input | Source | Notes |
| --- | --- | --- |
| Target geography | User enters city + neighborhoods, or a radius | |
| ZIP / ZCTA list | Derived | Must warn where one ZIP spans several neighborhoods |
| Housing and ownership data | **Census ACS API** | See §4.1. Fully automatable |
| Competitor set and metrics | DataForSEO + Google Places | Already wired for the market entry report |
| Competitor site claims | **Firecrawl** | Already a dependency in `package.json` |
| SERP holders | DataForSEO Labs | |
| Regulatory hooks | `data/regulatory/` | See §4.2. The hard one |

### 3.3 Brand Pack (uploaded)

Accept a mood board or style tile image plus asset mockups, and extract:

- Palette with hex values and a role assigned to each
- Typography
- Existing taglines and marks
- Assets in market: vehicle, signage, apparel, print

Then run the **brand audit** that made Section 12 valuable: cross-check every asset against every other for domain mismatches, phone mismatches, service-claim conflicts (residential vs commercial), missing license numbers, and photography that contradicts the positioning. Those findings are mechanical and repeatable.

### 3.4 Company Pack (form + prior reports)

Name, owner, entity, credentials, service radius, capacity, headcount, hours model, pricing posture, domain status. Every field maps to a `[BRACKET]` in the output if unanswered.

---

## 4. Data integrations

### 4.1 Census ACS: build this first

The highest-value automation in the whole engine, and it is straightforward. efelle now holds an API key.

**Endpoint pattern**

```
https://api.census.gov/data/{YEAR}/acs/acs5
  ?get=NAME,{VARS}
  &for=zip+code+tabulation+area:{ZCTA_LIST}
  &key={KEY}
```

**Gotchas found the hard way, encode these:**

1. **Use `+` not `%20`** in `zip+code+tabulation+area`. Percent-encoding returns a misleading "valid key required" error, not a geography error.
2. **Cap variables per request.** Ten-plus variables against a `place` geography returned a 400. Split into calls of four or five.
3. **City is not metro.** Widely quoted housing-age figures are metro-level. For Seattle the metro reads 9.7% pre-1940 and the city reads 23.4%. Using the metro figure would have understated the argument by a factor of two and been wrong in the client's own market. Always pull `place` for the city benchmark, never a press citation.

**Variables** (housing-relevance: high)

| Metric | Table | Fields |
| --- | --- | --- |
| Median year structure built | B25035 | `_001E` |
| Built 1939 or earlier | B25034 | `_001E` total, `_011E` pre-1940 |
| Owner-occupancy | B25003 | `_001E` occupied, `_002E` owner |
| Median home value | B25077 | `_001E` |
| Single-family share | B25024 | `_001E` total, `_002E` detached, `_003E` attached |

Add `B25040` (heating fuel) for HVAC packs and `B25004` (vacancy) where relevant.

**Output contract:** every derived percentage computed in code, never by the model. The model receives a finished table and writes prose about it.

### 4.2 Regulatory knowledge base: the real moat

What made the Nic document distinctive was two Seattle-specific facts no competitor had published: the July 2026 King County water heater permit change and the 2025 side sewer transfer to SPU. That is not automatable from a model. It needs a maintained file.

```
data/regulatory/seattle-wa/plumbing.json
{
  "metro": "seattle-wa",
  "trade": "plumbing",
  "reviewedOn": "2026-08-21",
  "reviewDue": "2027-02-21",
  "items": [{
    "id": "wh-permit-2026",
    "headline": "Replacement water heater permits required",
    "effective": "2026-07-01",
    "authority": "Public Health: Seattle & King County",
    "detail": "…",
    "escalation": "2027-01-01: Already Built Construction fees at double rate",
    "sourceUrl": "https://…",
    "marketingAngle": "\"We pull the permit\" becomes a checkable claim",
    "contentHook": "Do I need a permit to replace a water heater in Seattle?"
  }]
}
```

**Rules:** every item carries a `sourceUrl` and a `reviewDue`. The engine refuses to render a regulatory section from a file past its review date, and surfaces a stale-data warning instead. Start with Seattle, Portland, Tacoma, Spokane and Bellevue for the trades efelle actually sells.

This is the piece that cannot be copied by a competitor with the same AI tools, because it is maintained knowledge rather than generated text.

---

## 5. Stage flow

Follow the `screen-csp` three-stage convention.

**Stage 01: Intake**
Client select or new. Trade selection loads the Vertical Pack. Geography entry builds the ZIP list. Brand Pack upload. Company Pack form. Import prior reports if found.

**Stage 02: Research**
Runs in sequence with live status via the `onStatus` callback already in `callWithWebSearch`:
census pull → competitor audit → SERP check → site scrape → regulatory lookup → brand audit.
Every step either returns real data or fails loudly. **No training-data fallback**, consistent with the existing rule in `core/api.js`.

**Stage 03: Generate and review**
Section-by-section generation against the skeleton, then the QA gate in §7, then render.

---

## 6. Output

Single-file HTML rendered to PDF, per efelle deliverable standards. Co-branded: client logo on the cover next to the efelle mark, efelle standard footer.

**Nineteen sections plus three appendices**, as shipped for Nic:

```
 1 Core Positioning            11 Brand Voice & Messages
 2 Competitive Landscape       12 Applying the Existing Identity
 3 Service Area Strategy       13 Website Architecture & Conversion
 4 Ideal Customer              14 Go-to-Market
 5 Services & Specialties      15 Measurement & Expectations
 6 Licensing & Trust           16 Scope of Work
 7 The Four Promises           17 Investment
 8 Operations Stack            18 What We Need From the Client
 9 Proof / Evidence Library    19 Next Steps & Approval
10 Options, Financing & Estimates
   Appendix A Regulatory  ·  B Copy Library  ·  C Search Content Plan
```

Sections 16 and 17 pull from the same pricing model `prop.js` uses. One source of truth for fees.

---

### The second document

The engine outputs two documents, not one. The full strategy is written to survive scrutiny. The owner's
brief, 8 to 14 pages, is written to the person who signs, in second person, with no vocabulary he has to
look up. It is a projection of the same state rather than a second pass, which is what keeps the two from
contradicting each other. `scope.includesOwnerBrief` defaults to true. See `GTM-OWNER-BRIEF.md`.

---

## 7. The QA gate: build this, it is where three revision rounds went

Every one of these was a real defect caught late in the Nic build. All are mechanically checkable and should block export.

| Check | Rule |
| --- | --- |
| **Cross-reference integrity** | Every "Section N" and "N.M" resolves to a heading that exists. An automated renumber pass broke thirty of these in one edit |
| **Reference grammar** | No doubled words, no reference inserted mid-sentence leaving "the personality rules in Section 11 personality" |
| **Placeholder split** | Brackets tagged by owner. **Export blocks while any efelle-side placeholder remains.** Client-side brackets are expected and allowed |
| **Count assertions** | "the ten blocking items", "the two rows in bold": verify the stated count matches the actual list |
| **Numeric consistency** | Same fact, same number everywhere. Review targets, month boundaries, totals |
| **Arithmetic** | One-time fees sum to the stated total. Budget splits sum to 100%. Payment schedules divide correctly |
| **Timeline overlap** | No phase claiming the same month as the next |
| **Term collisions** | "Phase" cannot mean both a time period and a workstream |
| **Voice** | First person and first person plural not mixed inside one passage |
| **Draft-process language** | No "this section is new", "the original draft", "to be confirmed", struck-through to-dos |
| **Sourcing coverage** | Any claim about a named competitor, a law or a platform policy either carries a citation or is softened |
| **House style** | No em dashes. "efelle" always lowercase |
| **Version** | Cover, footer and metadata agree |

Roughly 60 defects surfaced in the Nic build. Nearly all of them would have been caught by this list.

---

## 8. Build order

| Phase | Scope |
| --- | --- |
| **1** | Engine scaffold, nav registration, screen, Stage 01 intake, plumbing Vertical Pack, Census integration, skeleton renderer. Reproduces the Nic document from form input |
| **2** | Competitor audit chained from `csp`, Firecrawl site claims, brand audit from uploaded mood board |
| **3** | QA gate, regulatory knowledge base, Seattle metro seeded |
| **4** | Electrical, roofing, HVAC, landscaping packs. Additional metros |

**Phase 1 test:** feed Nic's inputs and diff against the shipped document. Anything the engine cannot reproduce is a missing pack field.

---

## 9. Open questions

1. Does `gtm` chain off `csp` output, or absorb `csp` entirely? Chaining is less disruptive; absorbing removes a duplicate research step.
2. Is the strategy fee always $5,000, or does it band by market size?
3. Who owns regulatory file maintenance and on what cadence?
4. Does the client-facing output ever ship without pricing, as a strategy-only deliverable?
