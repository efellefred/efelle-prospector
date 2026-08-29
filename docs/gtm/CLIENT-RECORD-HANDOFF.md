# Handing the Client Record architecture to another session

The Client Record is a contract between four systems, and none of them is this repo any more.
It lives in **`efelle-contracts`**. This file exists so a Claude Code session opened in
`efelle-command-center`, the invoicing app, or ContentPro can pick up the architecture
without anyone re-explaining it.

All repos sit on the same machine, so the other session reads by absolute path. No copying.
A copy in each repo drifts, and a drifted contract is worse than no contract.

---

## Paste this into a fresh Claude Code session in a consumer repo

```
We have a shared Client Record that sits above four apps. The contract is already written,
in its own repo, at absolute paths on this machine. Read these first, in this order, before
proposing anything:

  C:\Users\fl\Desktop\AI\apps\efelle-contracts\client-record\BOUNDARIES.md
      who owns, reads and writes, and the four rules. Start here, it is short

  C:\Users\fl\Desktop\AI\apps\efelle-contracts\client-record\CLIENT-RECORD.md
      the record itself, the CRM adapter, the join-key problem, HubSpot vs Seedly

  C:\Users\fl\Desktop\AI\apps\efelle-contracts\client-record\client-record.schema.json
      the machine-readable form. Where prose and schema disagree, the schema wins

  C:\Users\fl\Desktop\AI\apps\efelle-contracts\exports\EXPORTS.md
      the two snapshots that leave the write boundary

Design rationale, useful but not binding, lives in the Prospector repo:

  C:\Users\fl\Desktop\AI\apps\efelle-prospector\docs\gtm\GTM-PIPELINE.md
      sections 2, 3 and 5: why report-to-report imports fail, and the six-stage pathway

  C:\Users\fl\Desktop\AI\apps\efelle-prospector\docs\gtm\prospecting-engine.html
      the same architecture as diagrams; open it in a browser, it is the fastest read

Then read this repo to see what already exists and where it conflicts.

The four rules, so you can check any proposal against them:

  1. One Client Record, owned by Command Center. Only Command Center writes it.
  2. Keyed on crmId + crmSource, never on a free-text company name. Any normalization
     family that joins on a cleaned-up name is that same bug wearing a different hat.
  3. ContentPro reads an export at onboarding and writes nothing back. It is a building
     tool, not a source of truth. Corrections go through Command Center, not around it.
  4. Invoicing reads the offer and project scope and writes exactly one field back:
     billing.status. That is a client fact; nothing else it knows is.

Promotion into the CRM happens at qualification, not first contact. Everything before that
is a prospect with crmSource "local".

Two things that are easy to get wrong:

  - A billing-system id is not a key. QuickBooks and Stripe customer ids are references the
    record holds. So is a proposal id. Billing artifacts key to the client, not to one
    sales document.
  - Do not write a client-record spec in this repo. Document your implementation here:
    tables, migrations, endpoints. The contract stays in efelle-contracts and you
    reference it. A restatement is a copy, and copies drift.

What I want from this session: <say what you actually want here, for example
"tell me what this repo already has that maps to the record, and where it conflicts"
or "implement the record store and the CRM adapter interface">

House rules: no em dashes in any output. efelle is always lowercase.
```

---

## Which file answers which question

| The other session needs to know | Point it at |
| --- | --- |
| Who may write what | `efelle-contracts` `BOUNDARIES.md` |
| What the record holds, exactly | `efelle-contracts` `client-record.schema.json` |
| Why it is keyed the way it is | `efelle-contracts` `CLIENT-RECORD.md` sections 2 and 4 |
| What invoicing and ContentPro receive | `efelle-contracts` `exports/` |
| How to change the contract | `efelle-contracts` `VERSIONING.md` |
| When a prospect becomes a record | `GTM-PIPELINE.md` sections 3 and 5.4 |
| Whether to stay on HubSpot | `CLIENT-RECORD.md` section 10 |
| The whole thing, visually | `docs/gtm/prospecting-engine.html` in this repo |
