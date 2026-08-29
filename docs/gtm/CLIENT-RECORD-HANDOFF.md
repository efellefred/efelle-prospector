# Handing the Client Record architecture to another session

The Client Record is a contract between four systems, and only one of them is this repo.
This file exists so a Claude Code session opened in **`efelle-command-center`** (or in the
invoicing app, or in ContentPro) can pick up the architecture without anyone re-explaining it.

Both repos sit on the same machine, so the other session reads these files by absolute path.
No copying. A copy in each repo drifts, and a drifted contract is worse than no contract.

---

## Paste this into a fresh Claude Code session opened in `efelle-command-center`

```
We designed a shared Client Record that sits above four apps. The architecture is already
written up, in the Prospector repo, at absolute paths on this machine. Read these first,
in this order, before proposing anything:

  C:\Users\fl\Desktop\AI\apps\efelle-prospector\docs\gtm\GTM-CLIENT-RECORD.md
      the record itself, the CRM adapter, the join-key problem, HubSpot vs Seedly

  C:\Users\fl\Desktop\AI\apps\efelle-prospector\docs\gtm\GTM-PIPELINE.md
      sections 2, 3 and 4 are the ones that matter here: why report-to-report imports
      fail, the six-stage pathway, and the app boundary table

  C:\Users\fl\Desktop\AI\apps\efelle-prospector\docs\design-handoffs\prospecting-engine.html
      the same architecture as diagrams; open it in a browser, it is the fastest read

Then read this repo to see what already exists here and where the record would live.

The four rules that hold the whole thing together, so you can check any proposal against them:

  1. One Client Record, owned by Command Center. Only Command Center writes it.
  2. It is keyed on crmId + crmSource, never on a free-text company name. Prospector's
     current clientName join key is the specific bug this design exists to fix.
  3. ContentPro reads an export at onboarding and writes nothing back. It is a building
     tool, not a source of truth. Corrections go through Command Center, not around it.
  4. Invoicing reads the offer and project scope, and writes exactly one field back:
     payment status. That is a client fact; nothing else it knows is.

The record is promoted into the CRM at qualification, not at first contact. Everything
before qualification is a prospect and stays out of the CRM.

What I want from this session: <say what you actually want here, for example
"tell me what Command Center already has that maps to this record, and what is missing"
or "implement the record store and the CRM adapter interface">

House rules: no em dashes in any output. efelle is always lowercase.
```

---

## Which files to point at, by question

| The other session needs to know | Point it at |
| --- | --- |
| What the record holds and how it is keyed | `GTM-CLIENT-RECORD.md` sections 4 to 6 |
| Who may write what | `GTM-PIPELINE.md` section 4, the boundary table |
| When a prospect becomes a record | `GTM-PIPELINE.md` sections 3 and 5.4 |
| What ContentPro receives | `GTM-PIPELINE.md` sections 9.3 and 10 |
| What invoicing receives | `GTM-PIPELINE.md` section 9.2 |
| Whether to stay on HubSpot | `GTM-CLIENT-RECORD.md` section 10 |
| The whole thing, visually | `docs/design-handoffs/prospecting-engine.html` |

---

## The thing to fix later

**This contract lives in the wrong repo.** It governs Command Center, Prospector, invoicing
and ContentPro, but its history is inside Prospector alone. So a change to the contract shows
up in Prospector's log and nowhere else, and the app that owns the record has no record of the
contract it implements.

That is tolerable with two apps and one person. It stops being tolerable at the point a third
app depends on it, or a second person edits it.

The fix when that happens: a small `efelle-contracts` repo holding the Client Record schema,
the export contracts and the boundary rules, consumed by all four apps as a submodule or a
versioned copy pulled at build. Not worth doing today. Worth knowing is the exit.
