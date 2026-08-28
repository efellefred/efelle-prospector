# efelle System Flow

**From an unknown business on a map to a published website, across every app in the stack.**

The question this answers: what order things run in, which app owns what, how each stage feeds the next instead of re-collecting, and where the boundaries between systems actually sit.

---

## 1. The problem with the current shape

Every engine today is a self-contained document generator. Each one asks for the client's name, URL and industry again, then researches from scratch, then emits a report. Reports are the source of truth, so the only way to reuse a fact is to read a prior PDF.

That is why the proposal timing feels ambiguous. It is not a sequencing problem, it is a **data ownership problem**. Once facts live in one place, order stops mattering much.

---

---

## 2. The fix: a Client Record, not report-to-report imports

```
data/clients/{clientId}.json
```

One canonical object per client. Every engine **reads what it needs and writes what it learns**. Reports become renderings of that record at a point in time, not the record itself.

```
                    ┌──────────────────────────┐
                    │     CLIENT RECORD        │
                    │  company · site · market │
                    │  competitors · brand     │
                    │  offer · keywords        │
                    └──────────────────────────┘
                       ▲   ▲   ▲   ▲   ▲   ▲
        ┌──────────────┘   │   │   │   │   └──────────────┐
        │          ┌───────┘   │   │   └───────┐          │
      WSR      COMPETITOR    GTM  SEO PLAN   PROPOSAL   ACTION PLAN
```

**What each engine contributes:**

| Engine | Writes to the record | Reads from the record |
| --- | --- | --- |
| `wsr` | `company.*`, `site.*` (stack, speed, schema, conversion gaps) | nothing, it is the entry point |
| `competitor` | `competitors.set`, `competitors.serpHolders` | `company.domain`, `company.city`, `vertical.id` |
| `csp` | `market.*`, `competitors.gaps` | company, competitors |
| **`gtm`** | `positioning.*`, `market.tiers`, `market.census`, `brand.*` | everything above |
| `seo` | `keywords.*`, `contentSilos.*` | vertical, market, competitors, positioning |
| `prop` | `offer.*` | scope implied by gtm and seo |
| `cap` | `plan.*` | all |

**Consequence:** WSR and competitor stop being prerequisites and become **accelerators**. `gtm` checks the record, uses what is there, and only researches the gaps. Run it cold and it does all the work itself. Run it after WSR and competitor and it skips two research stages and starts from evidence.

**Implementation:** add `clientId` to `saveReport()` metadata, plus `GET/PATCH /api/clients/:id`. Engines patch the record on completion. This is a small change with a large payoff and should land before `gtm` phase 2.

---

---

## 3. The full pathway

Six stages. The first four happen before money changes hands, the last two after.

```
   FIND            WARM            EDUCATE          SELL
   ─────           ─────           ────────         ────
   source from     send reports,   strategy and     proposal,
   Places, score   track opens     market work      signature
   the list
        │               │                │              │
        └───────────────┴────────────────┴──────────────┘
                        local record                    │
                                          ┌─────────────┘
                                          │  promoted at qualification
                                          ▼
   ONBOARD                         BUILD
   ───────                         ─────
   Command Center / Onboard        ContentPro: sitemap, content
                                   Invoicing: billing setup
```

| Stage | What happens | Artifacts produced | Record state |
| --- | --- | --- | --- |
| **1 Find** | Source by trade and market from Google Places, score on profile signals | scored queue | local |
| **2 Warm** | Send war report and competitor report as hosted links, track opens | `wsr`, `competitor` | local |
| **3 Educate** | Strategy, and any of the channel reports that earn the conversation | `gtm`, optionally `localseo`, `organicseo`, `paid`, `silo` | local, promoted on reply |
| **4 Sell** | Proposal with scope, samples, terms, online signature | `prop` | CRM |
| **5 Onboard** | Kickoff, access collection, project setup | onboarding record | CRM |
| **6 Build** | Sitemap and content production, billing | ContentPro build, invoices | exported |

**Stage 3 is deliberately elastic.** Some deals need the strategy and nothing else. Some need a local SEO report to make the case. The reports are not a fixed sequence, they are a menu the salesperson draws from, which is only possible because they all read from the same record.

---

## 4. App boundaries

Four systems. One record. The boundaries matter because they decide who can write.

```
┌──────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                          │
│  owns the CLIENT RECORD                                  │
│                                                          │
│  Prospector    find · warm · educate · sell              │
│  Onboard       kickoff, access, project setup            │
│  CRM adapter   promotion, activity push                  │
└───────────────┬──────────────────────┬───────────────────┘
                │ export               │ export
                ▼                      ▼
      ┌──────────────────┐   ┌──────────────────┐
      │  CONTENTPRO      │   │  INVOICING       │
      │  building tool   │   │  billing         │
      │  read-only in    │   │  reads offer,    │
      │  reads the record│   │  writes status   │
      └──────────────────┘   └──────────────────┘
```

| System | Owns | Reads | Writes back |
| --- | --- | --- | --- |
| **Command Center** | The client record, all reports, the CRM link | everything | everything |
| **ContentPro** | Sitemap, page content, content history | An export of the record at onboarding | **Nothing.** It is a building tool, not a source of truth |
| **Invoicing** | Invoices, payment status, schedule | An export of the offer and project scope | Payment status only, back to the record |
| **CRM** | Company, contacts, deals, lifecycle | promoted records | activity and stage |

**The one rule that keeps this from tangling:** only Command Center writes the client record. ContentPro consumes a snapshot and never writes back, because content decisions are not client facts. Invoicing writes exactly one field back, payment status, because that is a client fact the rest of the system needs.

If ContentPro later needs to correct something in the record, the correction goes through Command Center, not around it.

---

## 5. The outbound motion, and what fires the gate

Tier 1 above assumes a prospect exists. In an outbound engine efelle picks them, which changes three things: how the list is built, how the report reaches them, and what counts as qualification.

### 5.1 Google Maps is the filter, not the icebreaker

Sourcing from Google Places gives more than a name and a URL. The profile signals say whether a prospect is **worth the send** before a report is ever generated.

| Signal | Reads as |
| --- | --- |
| Profile unclaimed | Addressable problem, and nobody is already selling them |
| Under 10 photos, no Posts | Nobody is managing it |
| Review count well below the market median | The gap the strategy would close |
| Rating under 4.0 with low volume | Reputation is fixable, and it is the first thing their customers check |
| No website, or a site that fails the war report basics | The largest possible opening |
| Competitors in the same ZIP posting weekly | The contrast that makes the email land |

**Score the list, do not just personalize it.** A prospect where the incumbent is weak and the gap is wide is worth a hand-written note. A prospect already running a well-managed profile against strong competitors is worth skipping. Ranking on these signals is the difference between an engine and a mail merge.

Store the score on the local record so the send queue is sorted, not chronological.

### 5.2 The framing decides the reply, more than the specificity does

"I noticed your website isn't mobile friendly" is the most-used cold SEO opener in existence, and home service owners receive several a week. Accuracy does not rescue an email that pattern-matches to it, because the reader has categorized it by line two.

**Lead with the market, not the deficiency.**

| Do not | Instead |
| --- | --- |
| Your Google profile is unclaimed and you have 12 reviews | Fischer has been on Queen Anne forty years with an unclaimed profile and two photos. Bob Oates posted yesterday and has 767 reviews. Here is the gap that leaves |

Same data. The first diagnoses the reader as deficient. The second hands them intelligence about their own market, which is interesting to an owner in a way self-critique never is, and makes them the reader rather than the subject.

**Rule for the send:** the opening line must be one that could not have been written about any other business. If it survives a find-and-replace of the company name, it is a merge field and it will read as one.

### 5.3 Delivery: reuse the publish and token mechanism

**Do not attach a PDF.** It damages deliverability and is frequently filtered before a human sees it.

Prospector already has the right vehicle, built for proposals: `POST /api/publish` mints a token, `/p/:token` serves the hosted report, and the view is logged. Point it at war and competitor reports and the outbound send becomes a personal note plus a link.

That also means the report is a page rather than a file: it can be updated, it renders on a phone, and it produces the signal in 3.4.

### 5.4 Open events are the qualification trigger

This is what the promotion gate actually keys on, and it is already instrumented.

| Event | State | Action |
| --- | --- | --- |
| Sent, never opened | cold | Nothing. Stays local, no CRM record |
| Opened once | interest | Stays local. Surface in the send queue for a follow-up |
| Opened more than once, or deep-scrolled to the competitor section | **warm** | Surface for outreach. Still local |
| Replied, or booked | **qualified** | **Promote.** Company created in the CRM, `crmId` written back, history follows |

Promotion stops being a judgment call and becomes something the system surfaces. It also keeps the CRM honest: a company only exists there once a human engaged.

Log open and reply events on the local record. On promotion they push to the CRM as activity, which gives the first CRM touch a real history instead of an empty timeline.

### 5.5 Volume, honestly

Good cold email replies at 2 to 5 percent. Forty sends a month is one or two conversations. The hosted report is what could beat that rate, but only while the email reads as written by a person.

**Fewer and sharper beats more.** Twenty a week where the opening line is genuinely specific will outperform a hundred with a merge field, and it will not burn the domain doing it. The engine's job is to make twenty genuinely specific notes take twenty minutes instead of a day. It is not to make a hundred generic ones possible.

**Two compliance items, since this is real outbound:**

- CAN-SPAM requires a physical postal address and a working unsubscribe path on every commercial send.
- Sending reputation does not transfer between platforms. If efelle moves off HubSpot, warm the new sending identity before the first batch, not after the first bounce spike.

---

## 6. The report catalogue, and when each can run

Every report reads the client record, so **none of them is gated by the signature.** The constraint is cost and effort, not permission. Gates here are advisory: the engine warns, the salesperson decides.

| Report | Engine | Typical stage | Can run earlier? | Cost to run early |
| --- | --- | --- | --- | --- |
| War report | `wsr` | Warm | It is the earliest thing | none, it is the opener |
| Competitive analysis | `competitor` | Warm | same | low |
| Brand, positioning and GTM strategy | `gtm` | Educate | yes, but it is the most expensive to produce | high, reserve for real opportunities |
| Local SEO plan | `localseo` | Post-close | **yes, often the thing that closes it** | moderate |
| Organic SEO plan | `organicseo` | Post-close | yes | moderate |
| Paid ads plan | `paid` | Post-close | yes | moderate |
| Content silo plan | `silo` | Post-close | yes, though it depends on positioning | moderate, and it will be rebuilt if positioning changes |
| Proposal | `prop` | Sell | no reason to | n/a |

**Two ordering facts worth respecting even though nothing enforces them:**

- **The silo plan depends on positioning.** Build it before the strategy settles and it gets rebuilt. If a deal needs a silo plan early, run the strategy first even in a reduced form.
- **The strategy is the expensive one.** It is the deepest research and the longest document. Running it on an unqualified prospect is the main way this system wastes money. Warn on it when the record is still `local` and has no reply logged.

**Flag, do not block.** A salesperson who wants a local SEO report for a prospect who has not replied yet may have a reason the system cannot see.

---

**Every GTM engagement ships two documents.** The full strategy, and an owner's brief of 8 to 14 pages
written to the person who signs. Same state, two renders, so they cannot disagree. The brief is what goes
in the email; the strategy sits underneath it and gets used live on the call. Specified in
`docs/gtm/GTM-OWNER-BRIEF.md`. Nothing downstream consumes either rendered document, only `gtmState`.

---

## 7. Scope toggles: not every project is a brand project

Branding and messaging work applies to roughly one project in five. The other four are a website and a growth program for a company whose identity already exists and is not in question. Producing forty pages of brand analysis for those clients is wasted effort and it makes the document read as padded.

**Same mechanism as the industry gates**, driven by engagement scope rather than trade:

```jsonc
"scope": {
  "includesBrand": false,      // brand voice, identity application, naming
  "includesMessaging": false,  // positioning line, taglines, copy library
  "includesStrategy": true,    // market, service area, ICP, channel plan
  "includesChannelPlans": ["localseo"]
}
```

### What each toggle removes

| Toggle off | Sections dropped | Sections reduced |
| --- | --- | --- |
| `includesBrand` | 11 Brand Voice, 12 Applying the Existing Identity | 1 Core Positioning loses the naming argument. Appendix B loses the voice guidance |
| `includesMessaging` | Appendix B Copy Library | 1 keeps the strategic position but drops the tagline work. 13 keeps the architecture but drops hero copy |
| Both off | 11, 12, Appendix B | The document becomes market, service area, ICP, services, trust, operations, channels and measurement. Roughly half the length and still the argument that wins the deal |

**With both off the document is still worth producing.** The competitive audit, the census work, the service area tiering and the channel plan are the parts that demonstrate thinking. Brand is the part that demonstrates taste, and only some clients are buying that.

**Default `includesBrand` and `includesMessaging` to false.** Turn them on deliberately when brand work is actually scoped. The failure mode to avoid is every document arriving with brand sections nobody bought.

**Section numbering must renumber, not leave gaps.** A document that jumps from 10 to 13 tells the client something was removed. Sections are ordered and numbered at render time from the enabled set.

---

## 8. Industry gates

Trade differences are not just content, they change **which analyses run and which sections exist**. A roofer and a landscaper need genuinely different documents, not the same document with different service lists.

Add a `pipeline` block to the vertical pack. The engine reads it and branches, so engine code stays trade-agnostic.

```jsonc
"pipeline": {
  "requiredAnalyses": ["census.housingAge", "competitors.serp", "regulatory.permits"],
  "optionalAnalyses": ["census.heatingFuel"],
  "skipAnalyses": ["weather.stormEvents", "parcel.lotSize"],

  "customerShape": "recurring",      // recurring | episodic | oneAndDone | contract
  "repeatIntervalMonths": 18,
  "emergencyDriven": true,

  "sections": {
    "maintenancePlan": true,
    "financing": true,
    "membershipEconomics": false,
    "stormResponse": false,
    "contractRenewal": false
  },

  "marketFactors": ["buildingAge", "ownerOccupancy", "homeValue"],
  "seasonalityShape": "bimodal"      // flat | bimodal | spiky | contractCycle
}
```

### How the five trades actually differ

| | Plumbing | Electrical | Roofing | HVAC | Landscaping |
| --- | --- | --- | --- | --- | --- |
| **Customer shape** | recurring | episodic | one-and-done | recurring | contract |
| **Repeat interval** | ~18 mo | ~4 yr | ~20 yr | ~12 mo | monthly |
| **Emergency driven** | yes | partly | storm only | yes | no |
| **Market factor** | building age | building age, EV adoption | roof age, storm history | equipment age, fuel type | lot size, home value |
| **Census signal** | B25034/B25035 | B25034, B25040 | B25034 as roof-age proxy | B25040 heating fuel | B25077, parcel data |
| **Seasonality** | bimodal | flat | spiky, weather | bimodal, sharp | contract cycle |
| **Membership economics** | nice to have | no | **no** | **the whole business** | **the whole business** |
| **Financing** | matters above $4k | matters | **essential** | **essential** | rarely |
| **Insurance angle** | rarely | no | **central** | no | no |
| **Referral vs retention** | both | referral | **referral only** | retention | retention |

**What that means concretely:**

- **Roofing** needs a storm-event analysis and an insurance-claim section that no other trade has, and must **not** get a maintenance-plan section, because the customer does not come back for twenty years. Its entire retention budget should go to referral and review velocity instead. Seasonality is event-driven, so the media plan needs a reserve for storm response rather than a flat calendar.
- **HVAC and landscaping** invert that. The maintenance agreement is the business model, so the membership section moves from an afterthought to a core section, and the measurement section should track member count, not just leads.
- **Electrical** is the closest sibling to plumbing, plus a growth category the others do not have: panel upgrades and EV charger installs, which correlate with home value and vehicle data rather than building age.
- **Landscaping** is the one trade where `housingRelevance` should be `low`. Building age says nothing. Lot size and home value say everything, which means a parcel-data source rather than an ACS housing-age pull.

### Section conditionality

The nineteen sections are a **maximum**, not a fixed set. `sections` flags in the pipeline block decide what renders:

| Section | Condition |
| --- | --- |
| Maintenance plan | `customerShape` is recurring or contract |
| Financing | `ticketBands.highValue` above the financing threshold |
| Storm response | `skipAnalyses` does not contain `weather.stormEvents` |
| Membership economics | `sections.membershipEconomics` |
| Insurance claim guidance | roofing and restoration only |

---

---

## 9. Onboarding, and the two exports

Signature is the state change that matters. Everything before it is a sales artifact; everything after is a delivery obligation.

### 9.1 Command Center / Onboard

Onboard is where the record stops being a prospect file and becomes a project file. It collects what delivery needs and sales never asked for:

| Collected at onboarding | Feeds |
| --- | --- |
| Domain and DNS access, registrar | Build |
| Hosting decision, existing host | Build, invoicing |
| Google Business Profile access, or the claim process | Local SEO |
| Analytics and Search Console access | Measurement |
| Existing content, photography, logo files | ContentPro |
| Billing contact, PO or payment method | Invoicing |
| The bracketed items still open from the strategy | Everything |

**That last row is the useful one.** The strategy document ships with client-owned brackets: license number, warranty terms, price book, hours model. Onboarding is where those get filled, and filling them should update the record rather than a PDF. Every downstream artifact then renders correctly without anyone re-editing a document.

### 9.2 Export to Invoicing

Small contract. The invoicing app needs the commercial terms and the project shape, nothing else.

```jsonc
// invoicing-handoff.json
{
  "clientId": "crm-8801234567",
  "client": { "legalName": "…", "billingContact": {}, "billingEmail": "…", "address": {} },
  "project": { "type": "semiCustom", "label": "Semi-custom website", "launchTarget": "…" },
  "oneTime": { "total": 25000, "deposit": 12500,
               "schedule": { "instalments": 24, "amount": 520.83, "interest": 0 },
               "lines": [{ "label": "Strategy", "amount": 5000 }] },
  "recurring": [
    { "label": "Revenue Growth Service", "amount": 550, "cadence": "monthly", "startsOn": "launch" },
    { "label": "Hosting and support", "amount": 145, "cadence": "monthly", "startsOn": "launch" }
  ],
  "terms": { "noticeDays": 30 },
  "signature": { "acceptedBy": "…", "acceptedAt": "…", "ref": "…" }
}
```

**Invoicing writes exactly one thing back:** payment status against the client record, because whether a client is current is a fact the rest of the system needs. Nothing else.

**Note the `startsOn: "launch"` field.** Recurring charges begin when the site goes live, not at signature. Encoding that in the handoff avoids the most common billing argument in this business.

### 9.3 Export to ContentPro

The larger contract, specced in full in Section 10. The short version: ContentPro receives the client profile, the sitemap and the content plan, all of which the strategy already established and none of which anyone should retype.

**The documents themselves travel too.** The strategy, the competitive audit and any channel plans go across as the knowledge base ContentPro writes from. That is the difference between a content tool generating plausible copy and one writing from a researched position.

```jsonc
"knowledgeBase": [
  { "type": "gtm",        "reportId": "…", "url": "/p/…", "summary": "…" },
  { "type": "competitor", "reportId": "…", "url": "/p/…", "summary": "…" },
  { "type": "localseo",   "reportId": "…", "url": "/p/…", "summary": "…" }
]
```

---

## 10. ContentPro: the full export contract

The strategy document is the last artifact of the sale. It is also the **richest client-profile input efelle will ever have**, and ContentPro currently rebuilds most of it by hand at onboarding.

Closing that loop makes the strategy do double duty: it wins the deal, then it seeds delivery.

### The fit is close to exact

ContentPro's `Client` model and `buildClientContext()` want precisely what the strategy document already established.

| ContentPro field | Comes from |
| --- | --- |
| `companyName`, `website` | Company Pack |
| `industry` | Vertical Pack `id` |
| `serviceAreas` | `market.tiers.core` plus `expansion` |
| `differentiators` | Section 1, the defensible-advantage table. Already written as "hard to copy" claims, which is exactly what Isolation Rule 6 wants |
| `proofPoints` | Section 6 trust bar plus Section 9 evidence library |
| `brandVoice` | Section 11, including the do-not-say table |
| `icp` | Section 4. Note this satisfies Isolation Rule 9 directly: the strategy produces a client-specific ICP built from census and competitive evidence, never a generic industry persona |
| `internalLinks` | The sitemap below |

### Sitemap generation

The strategy already contains a complete site architecture. It has simply never been exported as one.

```
Home
├── {navCategories[]}                    Section 13.2, four for plumbing
│   └── {specialty service pages}        Section 5, per specialty
├── Service Areas
│   └── {core tier neighborhoods}        Section 3.2, five at launch
│       └── {expansion tier}             added in phase 2
├── About                                Appendix B.4 copy
├── Reviews
├── FAQ                                  Appendix C tier 1 questions
├── Contact / Book
└── Blog
    └── {contentTiers.tier1[]}           Appendix C, publish-first set
```

Every node arrives with its target query, its tier and its priority, because Appendix C already ranked them.

### Export contract

`gtm` emits a handoff file on completion. ContentPro imports it as a new client rather than starting from a blank form.

```jsonc
// contentpro-handoff.json
{
  "schemaVersion": "1.0",
  "sourceReportId": "gtm_…",
  "generatedAt": "2026-08-28T…",
  "client": {
    "companyName": "…", "website": "…", "industry": "plumbing",
    "serviceAreas": ["Queen Anne", "Magnolia", "Ballard", "Fremont", "Wallingford"],
    "differentiators": ["…"],
    "proofPoints": [{ "stat": "…", "label": "…" }],
    "brandVoice": { "shouldFeel": [], "shouldNotFeel": [], "doNotSay": [], "sayInstead": [] },
    "icp": { "profile": "…", "cares": [], "notFor": [], "confidence": "high" },
    "terminologyTraps": [{ "wrong": "…", "right": "…" }]
  },
  "sitemap": [
    { "path": "/water-heaters", "type": "serviceCategory", "priority": 1,
      "targetQuery": "water heater repair {city}", "children": [] }
  ],
  "contentPlan": [
    { "title": "Do I need a permit to replace a water heater in Seattle?",
      "tier": 1, "silo": "water-heaters", "regulatoryHook": "wh-permit-2026",
      "sourceUrl": "https://…" }
  ]
}
```

### Two things to get right

**Carry the terminology traps across.** The vertical pack's trap list is enforced by the `gtm` QA gate. It has to reach ContentPro too, or generated content will reintroduce the exact errors the strategy was careful to avoid. Backwater valve versus backflow preventer is the plumbing example.

**Respect Isolation Rule 4 at the boundary.** The handoff payload must contain zero efelle content and zero references to any other client. It is client-specific data only, which is what `buildClientContext()` assumes. The export should be validated against that rule before it is written, not after ContentPro reads it.

### Where the segment-overlap warning gets its data

ContentPro Isolation Rule 8 raises a banner when two clients share an industry and an overlapping service area. The `gtm` competitive audit is where that overlap is first visible, since it already enumerates who else works those neighborhoods. Passing the competitor set through as metadata gives that warning real evidence rather than a field comparison.

### Revised full flow

```
TIER 1          TIER 2         TIER 3        TIER 4         TIER 5
evidence        argument       commercial    execution      delivery
─────────       ─────────      ──────────    ─────────      ─────────
wsr        ──►  gtm       ──►  prop     ──►  seo       ──►  ContentPro
competitor ──►                 (signature)   cap            client profile
                                                            sitemap
                                                            content engine
```

One client record from first contact through content production, with each stage adding to it rather than restating it.

---

## 11. What to build in what order

| Step | Why here |
| --- | --- |
| 1. Client record, `local` adapter only | Unblocks everything, needs no CRM |
| 2. `gtm` phase 1, plumbing, scope toggles from day one | The toggles are not a later feature. Four in five documents need them |
| 3. `wsr` and `competitor` write to the record | Turns the warm stage into an accelerator |
| 4. Publish tokens and open logging on both reports | The send vehicle and the qualification signal |
| 5. Promotion gate and CRM adapter | Only useful once something is worth promoting |
| 6. Onboard module, including bracket resolution | The handoff from sales to delivery, and where the record becomes a project |
| 7. Invoicing export | Small, and the weekend app needs a contract to build against |
| 8. Pipeline gates in the pack schema, then the roofing pack | Unblocks every trade that is not plumbing |
| 9. ContentPro export with knowledge base | Closes the loop from first audit to published content |
| 10. Channel report engines: `localseo`, `organicseo`, `paid`, `silo` | Highest value once the record is rich enough to make them cheap to produce |
| 11. Market cache under `data/markets/` | Do this the moment there are two clients in one metro. It is the difference between linear cost and compounding advantage |

**Sequencing note on the invoicing app.** It is being built now, ahead of the record. Give it the Section 9.2 contract as its input shape even if the data arrives by hand at first. Building it against a contract that will exist is cheaper than retrofitting one later.

## 12. The market cache: why the tenth client in a market is nearly free

Every engagement produces research that is **not client-specific**. The census pull for Seattle ZCTAs, the competitor set for plumbing in Queen Anne, the regulatory file for King County water heater permits: none of that belongs to Nic. It belongs to the market.

Right now the architecture treats all of it as per-client work, which means the second plumber in Ballard costs the same to research as the first. That is the single largest efficiency left on the table.

```
data/markets/{metroId}/
  census/{zcta}.json              vintage-stamped, shared by every client
  regulatory/{trade}.json         already specced, extend the pattern
  competitors/{trade}.json        the audited set for that trade in that metro
  serp/{trade}.json               who holds the local terms
```

**What this changes:**

| Client | Research cost |
| --- | --- |
| First plumber in Seattle | Full: census, competitors, SERP, regulatory |
| Second plumber in Seattle | Competitor set refresh only. Census and regulatory are cached |
| First electrician in Seattle | Regulatory and census cached. New competitor and SERP work |
| First plumber in Portland | Full again, but the trade pack carries over |

**The compounding effect is the moat.** After a year in the Seattle home-services market, efelle can produce a credible market section for any trade in any neighborhood in minutes, from data nobody else has assembled. A competitor with the same AI tools still has to do the first pull. That advantage grows with every engagement and cannot be bought.

**Two rules make it safe:**

- **Everything in the cache carries a vintage and a source.** A shared fact with no provenance becomes a liability the moment a client questions it.
- **Client-specific interpretation never enters the cache.** The census table is shared. The argument built from it, "98117 is the strongest fit for this brand," is Nic's and stays in his record.

## 13. Freshness: reports expire

A war report from March is wrong by September. A competitor's review count moves monthly, ACS releases annually, and a permit rule can change between a strategy being written and content being produced from it.

| Data | Half-life | Re-run trigger |
| --- | --- | --- |
| Competitor reviews, ratings, photos | 30 days | Any send after 30 days re-runs first |
| SERP holders | 60 days | Quarterly, or before a channel plan |
| Site audit | 90 days | On re-approach, or if the prospect relaunches |
| Census | Annual, on ACS release | Rebuild the market cache each December |
| Regulatory | Per file `reviewDue` | Already blocking, see Section 8 |

**Stamp every report with the vintage of its inputs.** Then two things become possible: a stale report warns before it is sent, and re-approaching a cold prospect six months later costs one refresh rather than a full rebuild.

**The re-approach is where this pays.** A prospect who ignored a report in March is a warm target in October precisely because the report can be regenerated with what changed: new reviews, a competitor who overtook them, a permit rule that now applies. That is a genuinely different email from the first one.

## 14. The states the happy path is missing

The pathway in Section 3 assumes forward motion. Most prospects do not convert, and the ones that do not convert this quarter are next year's pipeline.

| State | Set when | What happens |
| --- | --- | --- |
| `cold` | Sent, no open after 21 days | Requeue with a refreshed report in 6 months |
| `passed` | Explicit no, or wrong fit | Reason captured. Suppressed from sends. Never deleted |
| `stalled` | Engaged then went quiet for 30 days | Surface once for a human decision, then requeue |
| `lost` | Proposal sent, not signed | **Reason captured.** This is the most valuable data the system produces |
| `churned` | Client left after signing | Offboarding, below |

**Capture the loss reason as a field, not a note.** Price, timing, went with someone else, did it in-house, no longer in business. After fifty deals that field tells efelle which trades, markets and project types actually close, and the scoring in Section 5.1 should learn from it. Nothing else in this system produces that signal.

**Suppression is not deletion.** A `passed` record keeps its research so a re-approach in two years is cheap, and so nobody accidentally emails them again next quarter.

## 15. Offboarding

The monthly program is 30 days notice, so churn is a normal event and needs a defined path rather than an improvisation.

| Question | Decide before the first churn, not during it |
| --- | --- |
| Access | GBP, analytics, ad accounts. Which transfer to the client and which were efelle's? |
| The site | Hosting handover, or does it stop? What is in the agreement? |
| Content | Who owns what ContentPro produced? |
| The record | Archived, not deleted. It is the best re-approach target efelle will ever have |
| Ad accounts | Transfer or close. Historical performance data has value to whoever holds it |

**A churned client is the warmest cold prospect in the database.** They have the reports, they know the work, and something changed. Keep the record intact and requeue it on a longer cycle.

## 16. Measuring the engine, not just the clients

The system produces measurement for clients and none for itself. Instrument it from the start, because these numbers decide whether the outbound motion is worth continuing.

| Metric | Why it matters |
| --- | --- |
| Send to open rate | Tests the subject line and the framing rule in 5.2 |
| Open to reply rate | Tests whether the report itself is compelling |
| Reply to meeting rate | Tests the follow-up |
| Meeting to proposal, proposal to close | The rest of the funnel |
| Cost per closed deal, by trade and market | The number that decides where to point the engine next |
| Research cost per report | API and token spend. Rises with volume, and the market cache is what bends it down |

**Segment everything by trade and by market.** The likely finding is that this works far better for some trades than others, and knowing which is worth more than any single improvement to the emails.

## 17. Smaller things worth deciding early

**Multi-location clients.** The service area model assumes one location. A three-branch HVAC company or a franchise breaks it. Not worth building for now, but worth naming as out of scope so it is a decision rather than a surprise mid-build.

**When the buyer is not the owner.** The strategy document is written to a person, and that voice is much of why it lands. A marketing manager at a larger operator needs a different register and a different set of proof points. Add a `buyerType` field before it becomes an awkward retrofit.

**Hosted reports are public to anyone with the link.** The reports name competitors and state facts about their businesses. Everything in them is accurate and sourced, which is the defense, but tokens should be unguessable and worth expiring after a period. Assume a competitor will eventually read one.

---

## 18. Open questions

1. Does Prospector become a module inside Command Center, or does Command Center wrap it? The record has to live at the Command Center level either way.
2. Who owns the client record when a project ends? An archived state, or does it stay live for retention marketing?
3. Do the channel reports get their own publish tokens and open tracking, the way war and competitor reports do? If they are being used to close deals, they should.
4. Does Onboard push a project record into the CRM as a deal, or is the CRM done contributing once the deal is won?
5. Who owns refreshing the market cache, and on what cadence? It is the highest-leverage asset here and the easiest to let rot.
6. What is the retention play for a churned client, and does it run through this system or somewhere else?
