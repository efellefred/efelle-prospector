# The Client Record

**This contract moved.** It now lives in its own repo, because it governs four apps and its
history should not sit inside one of them.

```
efelle-contracts/client-record/CLIENT-RECORD.md            the record, keying, lifecycle
efelle-contracts/client-record/client-record.schema.json   the machine-readable form
efelle-contracts/client-record/BOUNDARIES.md               who owns, reads and writes
efelle-contracts/exports/                                  the two export contracts
```

On this machine: `C:\Users\fl\Desktop\AI\apps\efelle-contracts`

## Why it moved

Command Center, Prospector, invoicing and ContentPro all implement against it. Kept here, a
change to the contract appeared in Prospector's log and nowhere else, and the app that owns
the record had no record of the contract it implements. Moved 2026-08-26, at the point
Command Center started implementing against it.

## What stayed here

The design rationale, which is not contract:

- `GTM-PIPELINE.md` sections 2, 3 and 5, why report-to-report imports fail and how the
  pathway is staged
- `prospecting-engine.html`, the same architecture as diagrams
- `GTM-BRIEFING.md`, `GTM-BUILD-SPEC.md`, `GTM-OWNER-BRIEF.md`, the engine itself

**Do not restate the contract in this repo.** Implementation specs reference it. A
restatement is a copy, and copies drift. That is the whole reason for the move.

## The four rules, for quick reference only

1. One Client Record, owned by Command Center. Only Command Center writes it.
2. Keyed on `crmId` + `crmSource`, never on a free-text company name.
3. ContentPro reads an export and writes nothing back.
4. Invoicing writes exactly one field back: `billing.status`.

The authoritative statement of these is `BOUNDARIES.md` in the contracts repo.
