# The Owner's Brief

## A second document, not a second draft

Every GTM engagement ships two documents from one build:

| | Audience | Length | Job |
| --- | --- | --- | --- |
| **The strategy** | efelle, and the client's marketing person if they have one | 40 to 65 pages | The argument, the evidence, the scope, the numbers |
| **The owner's brief** | The person who signs | 8 to 14 pages | What we are doing, what it costs, what we need from them |

The brief exists because the strategy document is written to survive scrutiny, and the owner of a one-truck home services business is not the person scrutinizing it. On the reference engagement the owner read the full document and asked, politely, whether there was a shorter one. There was not. Now there is, and it is part of the deliverable rather than a favor.

**The brief is a projection of the same `gtmState`, not a separate generation pass.** This is the load-bearing decision in this document. Two independent passes over the same brief produce two documents that disagree with each other on a number, a date or a promise, and the client finds the disagreement before we do. One state, two renders.

---

## 1. Where it sits

`scope.includesOwnerBrief`, default **`true`**. It is part of the package.

Turn it off only when the client is an in-house marketing team with no owner in the loop, which in home services is rare.

The brief renders after the full document and after the QA gate has passed on the full document. It cannot be built from a document that has not cleared QA, because a brief built on an unresolved placeholder is a placeholder shown to the owner.

```
sections.js  ->  full document  ->  qa.js (full)  ->  brief.js  ->  qa.js (brief)  ->  render both
```

---

## 2. Section map

Eleven sections and a closing one-page summary. Each one draws from named sections of the full document and from nothing else.

| Brief | Title | Source |
| --- | --- | --- |
| 1 | What we are building | 1 Core Positioning |
| 2 | Why this will work | 2 Competitive Landscape, 3 Service Area, Appendix A Regulatory |
| 3 | Who you are for | 4 Ideal Customer |
| 4 | Where you work first | 3 Service Area Strategy |
| 5 | What your customers get | 7 The Four Promises, 8 Operations Stack |
| 6 | Your brand, applied | 12 Applying the Existing Identity |
| 7 | How people will find you | 14 Go-to-Market |
| 8 | What happens when | 15.2 Phasing and realistic expectations |
| 9 | What this costs | 17 Investment |
| 10 | What we need from you | 18 What We Need From the Client |
| 11 | What happens next | 19 Next Steps |
| - | The whole thing on one page | 19.1 |

**Section 6 is gated by `scope.includesBrand`.** With brand work out of scope the brief has ten sections and renumbers. It does not leave a gap, for the same reason the full document does not.

**Sections 9 and 11 follow `offer.commercialMode`.** In `referred` mode, section 9 is the cost block without a signature block, and section 11 closes with a line saying the proposal is coming separately and carries the signature. In `embedded` mode, section 9 carries the fee summary and section 11 points at the signature block in the full document. **The brief never carries a signature block of its own,** in either mode. A summary that can be signed is a contract, and the client will sign the shorter one.

---

## 3. How each section is produced

Three mechanisms, in order of preference. Use the cheapest one that works.

**Projection.** Read straight from state, no model call. Sections 4, 9, 10 and 11 and the one-page summary are projections: the service area tiers, the cost tables, the blocking-items list and the next-steps tables already exist as structured data. Reformat and relabel them. This is most of the brief, and it is the reason the brief cannot drift.

**Constrained rewrite.** One model call per section, with the rendered text of the source sections as the only input, under the voice rules in section 4 below and one hard instruction: **introduce no fact that is not in the input.** Sections 1, 3, 5, 6 and 8 are rewrites. They are prose that has to change person and drop vocabulary, which a template cannot do.

**Selection.** Section 2 and section 7 pick the strongest three or four items from a longer list and drop the rest. Selection is a ranking prompt over structured findings, not a summarization prompt over prose. Rank competitor gaps by the `worth` field, take the top three, and write one sentence each.

---

## 4. Voice rules

These are the product. A brief that reads like an abridged strategy document has failed even if every fact in it is right.

**Second person, always.** The full document says "Nic's Plumbing should position itself as the plumber for older homes." The brief says "We are going to make you the plumber for older Seattle homes." Every section. No exceptions, including inside tables.

**No unexplained vocabulary.** These terms are blocking in the brief unless the sentence defines them inline:

| Banned | Say instead |
| --- | --- |
| map pack | the box of three businesses with a map at the top of Google |
| GBP | your Google profile, or your free Google listing |
| LSA | the pay-per-lead ads at the very top of Google with the green check |
| NAP | your name, address and phone matching everywhere |
| GEO, SERP, CPL, ZCTA | rewrite the sentence |
| beachhead | where you work first |
| ICP, persona | who you are for |
| tier 1 / tier 2 content | rewrite the sentence |

The rule is not "avoid jargon," it is "the owner never meets a word he has to look up." A term used once with a plain-language gloss in the same sentence is fine. A glossary is not, because a glossary means the document needed one.

**One level of heading.** No 3.2.1. If a section needs subsections it is too long for this document.

**Three columns maximum in any table,** and no table longer than about a dozen rows. The blocking-items table in section 10 is the one place a longer table earns its length, because its length is the point.

**Every section closes with a pointer** to the source sections in the full document, set small and italic. The brief is a companion, and it should be obvious where the evidence lives.

**Keep the cautions.** A summary that removes every warning becomes a sales document, and the owner meets the warning later as an unpleasant surprise. At minimum these survive into the brief, in the owner's own terms:

- Leads do not arrive in month one. Anyone promising otherwise is selling something.
- Set the ad budget from capacity, not ambition. More leads than you can serve well is worse than fewer.
- The day a second technician is hired, the service promises depend on someone other than the owner.
- The promises need software behind them before they are published.

**Target 2,800 to 3,200 words** plus asset plates. Under 2,400 it stops being useful and starts being a brochure. Over 3,600 it stops being short.

---

## 5. The QA gate for the brief

`qa.js` gains a second rule set that runs against the brief with the full document and `gtmState` in scope. Blocking unless noted.

| # | Rule |
| --- | --- |
| B1 | **Every number, price, percentage and date in the brief appears in the full document.** Extract all numeric tokens from both, and fail on any token present in the brief and absent from the full document. This is the rule that makes one-state-two-renders enforceable rather than aspirational |
| B2 | **No `[BRACKET]` placeholder anywhere in the brief.** If a source section still carries one, the brief omits that sentence. An unresolved placeholder is an internal note, and the owner is not the internal audience |
| B3 | Every "Section N" pointer resolves to a section that exists in the full document after scope toggles are applied |
| B4 | Zero hits on the banned vocabulary list, outside a sentence that defines the term inline |
| B5 | **Every client-owned blocking item in full section 18 appears in brief section 10.** The brief may reword the ask. It may not make the ask smaller |
| B6 | The cover date on the brief equals the cover date on the full document, and the brief names the full document's version |
| B7 | At least three of the four named cautions survive. Warning |
| B8 | Word count inside the budget in section 4. Warning |
| B9 | No em dashes. `efelle` lowercase. Second person throughout, checked by flagging any sentence containing the client's company name as a grammatical subject |

B1 and B5 are the two that matter most. B1 catches invention. B5 catches the softening that happens naturally when a document is rewritten to be friendlier, and softening the ask is how a launch slips three weeks.

---

## 6. Render

Same stylesheet, same cover system, same footer as the full document. It has to read as the same package.

**Differences from the full render:**

- Cover badge reads `Owner's Brief`, not `Client Strategy · For Review`
- Cover meta carries `Written for <owner first name>` and `Companion to <document title> v<version>`
- No table of contents. Eleven sections do not need one, and a contents page on a short document reads as padding
- Tighter vertical rhythm: heading top padding drops from 30px to 18px in print, `h2` top margin to 24px
- Asset plates capped: 200px tall for single and paired plates, 270px for the wide brand-system plate, 145px for triples. Uncapped, the brand section alone runs four pages
- Client asset images resized to 1300px wide and re-encoded before embedding. The reference brief went from 17.2MB to 1.5MB with no visible difference at print size
- Fonts embedded rather than linked, so the PDF renders identically without a font CDN

**Both documents save under one report.** `saveReport('gtm', clientName, metadata, gtmState, { full, brief })`, with the library row showing one entry and two download actions. They are one deliverable in two shapes, and filing them separately invites sending the wrong one.

---

## 7. Delivery

The brief is the document that goes in the email body's link. The full strategy is the one underneath it.

The sequence that works: send the brief, let the owner read it in fifteen minutes, take the call, and use the full document live to answer whatever he pushes on. An owner who has read the brief arrives at the call with questions instead of apologies for not having finished.

Nothing downstream consumes the brief. ContentPro, invoicing and onboarding all read `gtmState`, not either rendered document.

---

## 8. Reference implementation

`docs/gtm/fixtures/nics-plumbing.owner-brief.reference.md` is the brief produced by hand for the reference engagement, and it is the regression target in exactly the way the full Nic document is.

Build the brief from `fixtures/nics-plumbing.input.json` and diff against it. Sections that cannot be reproduced indicate a missing projection or a state field the brief needs and the full document never did. Log every gap. Do not close one by hardcoding a sentence.

Known properties of the reference: eleven sections, twelve rendered pages including the cover, eight asset plates, about 2,970 words, zero brackets, zero em dashes.

---

## 9. Open questions

- **Does the brief get its own share link and open tracking, or does it share the full document's token?** Separate links tell us which one the owner actually opened, which is worth knowing. Shared links keep the library simple.
- **Should the one-page summary be extractable on its own** as a leave-behind for a kitchen-table conversation, or is that a third document nobody asked for.
- **Owner first name.** The brief is warmer when it says "Written for Nic" than "Written for the owner", so the Client Record needs a first name distinct from the contact name, and it needs to be the right person. The contact on the record is not always the owner.
