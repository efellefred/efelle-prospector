# GTM Strategy Builder: Session Kickoff

Paste the block below into a fresh Claude Code session opened in the `efelle-prospector` repo.

---

```
Build the GTM Strategy Builder engine in this repo.

Read these first, in order:
  1. CLAUDE.md                       repo conventions and deploy workflow
  2. docs/gtm/GTM-BRIEFING.md        what the engine is and why
  3. docs/gtm/GTM-PIPELINE.md        how it fits with the other engines
  4. docs/gtm/GTM-BUILD-SPEC.md      the implementation spec, files, contracts, QA gate
  5. docs/gtm/GTM-OWNER-BRIEF.md     the second deliverable, and how it stays in sync
  6. docs/gtm/GTM-CLIENT-RECORD.md   the shared client record and CRM boundary
  7. public/js/verticals/_schema.json and plumbing.json   the trade pack format

For the visual version of the whole pathway, open docs/gtm/prospecting-engine.html
in a browser. It diagrams every stage from prospect discovery through ContentPro
handoff and is the fastest way to load the architecture.

Then read these existing files to match the house patterns before writing anything:
  public/js/core/nav.js        engine registration and routing
  public/js/core/api.js        callAPI, callWithWebSearch, repairJSON
  public/js/core/reports.js    saveReport and the report library
  public/js/app.js             module bootstrap
  public/js/engines/competitor.js   engine structure and report HTML builder
  public/index.html            the #screen-csp block, copy its stage markup

Build Phase 1 only, as defined in section 7 of the build spec:
  - engine scaffold, nav registration, /gtm-strategy route, three-stage screen
  - vertical pack loader with schema validation
  - Census ACS integration through a new /api/census server proxy
  - all 19 sections rendering from the fixture
  - the owner's brief rendering from the same state, with its own QA rules
  - the QA gate from section 5 of the build spec, blocking export
  - saveReport with type 'gtm'

Regression test, this is the acceptance criterion:
  Build from docs/gtm/fixtures/nics-plumbing.input.json and compare against the
  reference document that engagement produced. Any section the engine cannot
  reproduce indicates a missing field in the vertical pack or the state contract.
  Log every gap. Do not paper over one by hardcoding.

Hard rules, all four are already conventions in this codebase:
  - No training-data fallback. If a research step fails, throw. See core/api.js.
  - The model never computes arithmetic. Percentages, sums and payment schedules
    are calculated in JS and passed in finished.
  - Engine code never branches on trade. Trade differences live in the vertical
    pack's pipeline block.
  - No em dashes in any generated output. efelle is always lowercase.

Do not push to main until I have reviewed. Push triggers a production deploy.
```

---

## What is already written and committed

| Path | Status |
| --- | --- |
| `docs/gtm/GTM-BRIEFING.md` | Architecture and rationale |
| `docs/gtm/GTM-PIPELINE.md` | System flow, industry gates, ContentPro handoff |
| `docs/gtm/GTM-BUILD-SPEC.md` | Implementation spec |
| `docs/gtm/GTM-CLIENT-RECORD.md` | Client record, CRM adapter, HubSpot to Seedly assessment |
| `docs/gtm/GTM-OWNER-BRIEF.md` | The owner's brief: section map, voice rules, QA rules, render |
| `docs/gtm/prospecting-engine.html` | Visual walkthrough of the full pathway, 8 diagrams |
| `docs/gtm/GTM-KICKOFF.md` | This file |
| `docs/gtm/fixtures/nics-plumbing.input.json` | Regression fixture |
| `docs/gtm/fixtures/nics-plumbing.owner-brief.reference.md` | Brief regression target |
| `public/js/verticals/_schema.json` | Vertical pack schema |
| `public/js/verticals/plumbing.json` | First trade pack |

## What the session needs from you before it starts

| Item | Why |
| --- | --- |
| `CENSUS_API_KEY` in `.env` | Section 3.1 of the build spec. Free key from api.census.gov |
| Confirmation on the pricing model | Whether the strategy fee is flat or bands by market |
| Design review rounds | The one efelle-owned placeholder still open in the reference document |

## Suggested commit sequence

```
git pull origin main
git checkout -b gtm-engine
# work
git add docs/gtm public/js/verticals
git commit -m "GTM Strategy Builder: spec, vertical pack schema, plumbing pack"
# review, then merge to main when ready to deploy
```
