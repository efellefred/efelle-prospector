# The Client Record, and HubSpot

**Short answer: yes, and you are further along than it looks.** Three of the four pieces already exist in `server.js`. What is missing is one thing, and it is the thing quietly causing problems today.

---

## 1. What is already built

| Piece | Where | State |
| --- | --- | --- |
| A clients endpoint | `GET /api/clients` (server.js ~1709) | **Exists**, but derived not stored. It reads the report index and groups by `clientName` |
| HubSpot connection | `HUBSPOT_TOKEN`, `hubspotFindContact()`, `hubspotLogNote()` | **Exists.** Contact lookup with a six-hour cache, notes posted with association type 202, fire-and-forget so it never blocks |
| Company data extraction | `POST /api/extract-company`, `/api/extract-address` | **Exists** |
| Online acceptance and signature | `/api/publish`, `/p/:token`, `/api/p/:token/accept`, `injectSignature()` | **Exists.** Captures typed name, timestamp, IP, reference id, selected options and monthly total |
| **A stored client record** | nowhere | **Missing.** This is the gap |

The HubSpot sync today is one-directional and narrow: proposal opens and acceptances become notes on a contact. The pipe is proven. It just carries very little.

---

## 2. The one real problem

`clientName` is a **free-text string used as a join key.** Report ids are slugged from it:

```js
const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
```

So "Nic's Plumbing", "Nics Plumbing" and "Nic's Plumbing LLC" are three different clients. Every engine re-types the name, and any variation silently forks the history. `GET /api/clients` inherits the fault, because it groups on that same string.

This is the same class of problem already hit in HubSpot, where POWTEC had to be normalized across contacts by hand.

**Fix it before anything else.** Every later feature compounds on this key.

---

## 3. The CRM is a dependency, not a decision this blocks

efelle is evaluating a move from HubSpot to Seedly CRM. **Do not let that decision gate the Client Record work,** and do not write HubSpot calls into engine code.

Put a thin adapter behind the record. The whole surface the Client Record needs is four methods:

```js
// lib/crm/adapter.js
export const crmAdapter = {
  searchCompanies(q),                 // -> [{ crmId, name, domain, city, state, industry, stage }]
  getCompany(crmId),                  // -> full company + associated contacts
  logActivity(crmId, { type, body, url }),   // report published, proposal opened, accepted
  updateStage(crmId, stage)           // optional, milestone push only
};
```

```
lib/crm/hubspot.js    ~80% already written in server.js, just needs a company-object
                      sibling to the existing contact functions
lib/crm/seedly.js     REST API, written when and if the switch happens
lib/crm/local.js      no CRM, record is standalone. Also the test double
```

Engines never import a CRM. They call the adapter. Swapping CRMs becomes one file and a config flag rather than a refactor.

**Build `local.js` first.** It makes the whole GTM engine testable with no CRM at all, and it is the honest default for prospects who are not in any CRM yet.

## 4. Recommendation: the CRM company id is the client key

Do not invent an id. Use `hubspotCompanyId` as the primary key for the Client Record.

Whichever CRM wins, key the Client Record on **its** company id, stored as `crmId` with a `crmSource` discriminator rather than a HubSpot-specific field name.

```jsonc
{ "id": "crm-8801234567", "crmSource": "hubspot", "crmId": "8801234567", … }
```

**Why key on the CRM at all:**

- It is already canonical, already deduplicated by a system built to deduplicate, and already the id sales works from.
- It removes name normalization permanently. Two spellings resolve to one record.
- It makes the CRM the entry point, which matches how deals actually start.
- Notes, deals and lifecycle stage attach to it natively, so the existing `hubspotLogNote()` graduates from contact-level to company-level with almost no change.

For a prospect not yet in HubSpot, mint a local id and reconcile on first sync. Do not block engine work on CRM presence.

---

## 5. Division of ownership

HubSpot is a poor store for a strategy document's structured inputs. Census tables, palettes, competitor sets and section state do not belong in custom properties, and you will hit rate limits and field limits trying.

**HubSpot owns the relationship. Prospector owns the working record.**

| Data | Master | Direction |
| --- | --- | --- |
| Company name, domain, city, state | HubSpot | **pull** |
| Contacts, emails, roles | HubSpot | **pull** |
| Lifecycle stage, deal stage, amount | HubSpot | pull, and push on acceptance |
| Industry / vertical id | HubSpot if set, else chosen in Prospector | pull, then push back |
| Service area, census, competitors, brand, positioning, sections | **Prospector** | local only |
| Report links, opens, acceptances | Prospector | **push** as notes and, better, as a company property holding the library URL |

**Pull on client select. Push on milestone.** No continuous sync, no webhook infrastructure, no bidirectional conflict resolution. Milestones are: report published, proposal opened, proposal accepted, strategy delivered.

---

## 6. What to build

**Step 1 · Stored record.** `data/clients/{id}.json`, plus `GET/PATCH /api/clients/:id`. Keep the existing derived `GET /api/clients` as the list view; it keeps working.

```jsonc
{
  "id": "crm-8801234567",
  "crmSource": "hubspot",
  "crmId": "8801234567",
  "displayName": "Nic's Plumbing",
  "aliases": ["Nics Plumbing", "Nic's Plumbing LLC"],
  "vertical": "plumbing",
  "company": {}, "market": {}, "competitors": {}, "brand": {}, "offer": {}, "site": {},
  "reports": [{ "id": "…", "type": "gtm", "createdAt": "…" }],
  "crm": { "lastPulledAt": "…", "lastPushedAt": "…", "stage": "…" }
}
```

`aliases` is what makes migration survivable.

**Step 2 · Migrate.** Walk `data/reports/index.json`, group by slugged name, create a record per group, keep every observed spelling as an alias. Emit a review list of near-duplicates rather than auto-merging them. Someone should eyeball that list once.

**Step 3 · Two HubSpot endpoints.**

```
GET  /api/hubspot/companies?q=nic     search, returns id, name, domain, city, lifecycle
POST /api/clients/:id/hubspot/sync    pull identity down, push milestone up
```

Reuse the existing token, fetch pattern, cache and non-blocking error handling. It is already written; it just needs a company-object sibling to the contact functions.

**Step 4 · Engines read and patch.** Replace every "enter the client name" field with a client picker backed by HubSpot search. Each engine patches its slice on completion. This is the change that makes `wsr` and `competitor` feed `gtm` automatically.

---

## 7. Effort

| Step | Size |
| --- | --- |
| Stored record and CRUD | small |
| Migration with alias capture | small, plus one manual review pass |
| HubSpot company search and sync | small. The hard parts, auth, caching, failure handling, are done |
| Engine refactor to read and patch | medium. Six engines, mechanical, do them one at a time |
| Company-level notes instead of contact-level | small |

**Nothing here is architecturally hard.** It is a key change and a data migration, and the migration is only risky because the current key is a name.

---

## 8. Before building

These apply to whichever CRM is in place. They are questions about the adapter, not about HubSpot specifically.

- **Does the CRM store an industry or trade field, and do its values map to the vertical pack ids?** If yes, trade selection defaults from the CRM and the operator skips a step. If no, the operator picks the trade and the engine writes it back.
- **Where do report links live?** A custom field on the company is far more useful than an activity note, because it makes the strategy one click from the company record instead of buried in a timeline.
- **What is the stage value for a won client, and does anything downstream automate off it?** In the current HubSpot portal that is lifecycle stage `234439755`, and there is an existing workflow keying off it. If Prospector starts pushing stage changes it must write the right value or it will silently trip that automation. Any CRM will have an equivalent question.

## 9. CRM entry point and the record lifecycle

**Not every Prospector client should become a CRM record.** Prospector is a prospecting tool. Running a war report on forty roofers should not put forty companies into the CRM.

Two entry paths, one promotion gate:

```
Path A · already a CRM record
  pick from CRM search  ->  pull identity  ->  wsr  ->  competitor  ->  gtm

Path B · cold prospect, the common case
  type name and URL  ->  local record  ->  wsr  ->  competitor
                                            |
                                    [ qualification gate ]
                                            |
                              promote to CRM, gets a crmId
                                            |
                                      gtm  ->  prop
```

**The gate is qualification, not curiosity.** A war report is research. A strategy document is work you only do for a real opportunity. Promote at the point the deal becomes real, which in practice is when someone books the call after seeing the war report.

`crmSource: "local"` until promotion. On promote, the adapter creates the company, writes back the `crmId`, and every prior report follows because they were always keyed to the internal id, not the CRM id.

### The industry dropdown

Yes, extend it to the full home-services list. One rule that saves pain later:

**Make the vertical pack ids the source of truth and mirror them into the CRM dropdown, not the other way round.** The pack registry is the canonical list, the CRM dropdown is a copy of it. Same string values, no lookup table, no mapping layer to maintain.

```
public/js/verticals/*.json  ->  id: "plumbing", "electrical", "roofing", "hvac", "landscaping"
CRM industry dropdown       ->  exactly those values
```

Then selecting a company in Prospector reads `industry`, loads the matching pack, and the trade step disappears from the flow. When a new trade pack ships, add the value to the dropdown in the same commit.

If the CRM's industry field is already populated with other values, put the trade in a dedicated `trade` or `service_type` field rather than fighting the existing one.

## 10. The HubSpot to Seedly decision, revised

Earlier framing assumed an unknown HubSpot bill and a hypothetical purchase. Both are now known: **$2,500 per month against a two-person sales operation doing a few deals a month, and Seedly is already bought.**

That is roughly $30,000 a year for a seat count and deal volume that no longer resembles the five-person team it was sized for. The cost case is no longer marginal, it is the whole argument. And the earlier suggestion to run both in parallel for 60 to 90 days now carries a $5,000 to $7,500 price tag, which is worse advice than it was when the bill was unknown.

**Revised suggestion: set a cutover date rather than a pilot window.** Run the migration audit below first, and if nothing in it is load-bearing, move.

### The migration audit, the only thing that decides this

The question is not what HubSpot does. It is what HubSpot does that is **in the critical path today.** Walk this list and mark each one load-bearing or not:

| Capability | Question |
| --- | --- |
| Marketing email sends | Does efelle send campaigns from HubSpot? This is the single hardest thing to move, because sending reputation does not transfer |
| Forms and tracking on efelle.com | Are HubSpot forms or the tracking script embedded on the live site? Every one is a code change and a lead-routing change |
| Meeting and booking links | Are HubSpot meeting links in signatures, proposals or the site? Seedly's new scheduling module covers this, but every published link breaks |
| Reporting actually looked at | Which dashboards get opened in a normal month? Not which exist |
| Lifecycle and Lead Status automation | The workflow already built. Rebuildable, but it has to be rebuilt deliberately |
| Deal and email history | How far back does it need to be readable, and is a CSV export enough |
| Prospector's own note sync | Already written, ports with the adapter, small |

If marketing email and site forms come back "not load-bearing," this is a short project. If they are load-bearing, they are the project, and the CRM records are the easy part.

### Two risks worth naming

**Fork divergence.** This is the real technical risk of source-available plus heavy Claude Code customization, and it is not obvious up front. Every upstream release has to be merged into a codebase that has been extended. Decide now whether efelle tracks upstream or forks hard and stops taking updates. Both are defensible. Drifting into the second by accident is not.

Keep customizations in clearly separated modules and out of core files wherever the architecture allows it, so merges stay tractable.

**Knowing the founder cuts both ways.** Roadmap influence and real support are genuine advantages for a young product, and they are worth something. It also makes it harder to walk away if the fit turns out to be wrong. Set the same evaluation criteria that would apply to a vendor nobody at efelle knows.

### What this means for the build

If Seedly is the direction, the sequencing changes slightly but the architecture does not:

1. Build the adapter with `local.js` only. It unblocks all GTM work immediately and needs no CRM at all.
2. Run the migration audit in parallel. It is a conversation, not a build.
3. Write `seedly.js` once the cutover is committed. Skip `hubspot.js` entirely if HubSpot is going away, since writing an adapter for a system being retired is wasted work.

The earlier advice to keep HubSpot as the live adapter assumed it was staying. If it is not, do not build it.

### On the existing HubSpot code being nearly done

It is, and that is worth naming honestly: roughly a few hours of remaining work, not a reason to stay. Weighed against $2,500 a month it should carry no weight in the decision at all. The finished-ness of an integration is one of the easiest things to mistake for a reason.

**But it has a second life that is genuinely valuable.** What exists is working, authenticated, rate-aware HubSpot API code with search, caching and failure handling already solved. That is exactly what a clean extraction needs.

Repurpose it as `lib/crm/hubspot-export.js`: pull companies, contacts, deals, notes and associations to JSON, on demand, as many times as the migration needs. A one-off CSV export gives one snapshot and no associations. Scripted extraction gives repeatable runs, which is what makes a migration recoverable when the first pass is wrong.

So the existing code is not wasted, it just changes job. It stops being the way in and becomes the way out.

**The one case where it stays an adapter:** if the migration audit comes back with marketing email or site forms load-bearing, HubSpot survives in a reduced role for a while, and a read-only adapter earns its keep during the overlap. Let the audit decide, not the sunk work.
