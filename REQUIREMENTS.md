# Memory Palace — Requirements & Discovery

*IBM Bob 2.0 hackathon · Sun 27 Sep 2026, 11:35 Amsterdam time · pivot from Backstory · submit by 16:30 · deadline 17:00*
*Built from the pasted "AI Memory Palace" plan plus your answers: pivot the Bob entry, analysts/reviewers first, core value "overview in seconds", private documents, business viability judged.*

## The idea

**Memory Palace helps analysts see how a long report or contract is structured before they read it, so they know where to look and can prove every point with the exact passage.**

Upload a PDF. An agent reads it page by page, pulls out the parties, obligations, dates, amounts and topics, links them, and draws a map. Every node and every link carries the quote and page it came from, and a quote that can't be found word for word in the document never appears.

**Stage:** idea, from zero at 11:30. You can reuse Backstory's deployed frontend and backend skeleton, API key handling and cache fallback.

**Proposed angle (confirm or change):** NotebookLM's Mind Maps show *topics*. Memory Palace shows *who owes what to whom, by when*, with the quote on each link and every quote checked against the page. That's the answer to "why not NotebookLM?", and it's still thin, so keep the demo on documents where relations matter (contracts, not essays).

## Problem & users

**Problem, in the user's words:** "I get a 30-page agreement or report and need to know who the parties are, what each one owes, and the key dates and amounts before I start the real review. Reading it front to back takes an hour, a plain summary loses the structure, and I can't cite a summary."

**Primary user:** analysts and reviewers who must understand an unfamiliar document fast and back every finding with a source: due diligence, contract review, compliance, consulting.

**Key stakeholders**

| Stakeholder | What they need from Memory Palace |
|---|---|
| Hackathon judges (lablab, IBM) | A demo that works live, a credible business case (weighs most), visible use of IBM Bob |
| Analysts and reviewers | The document's structure in under a minute, with a quote and page behind every node |
| Buyers: legal ops, due-diligence and consulting teams | Faster first pass per document; confidentiality they can defend to clients |
| Their IT and security teams | Documents not stored, not used for training, a named model provider, ideally EU processing |
| People and companies named in documents | Their details not stored or reused beyond the check |

## Core value & scope

**The one thing it must nail:** a map an analyst can grasp at a glance, where every node and link opens its exact, verified passage.

"In seconds" means the time to understand the map, not processing time: a 30-page PDF takes up to about a minute to build; cached demo documents open instantly.

**In scope for 16:30**
- Web app, deployed: one text-based PDF (up to 30 pages) in, map out.
- Extraction of five node types (Party, Obligation, Date, Amount, Topic) and their links, each with quote and page.
- Quote verification against the page text; duplicate merging; a capped, readable overview.
- Click a node: its links and quotes with page numbers.
- Two public demo documents with cached results.

**Out of scope**
- Question answering over the map, embeddings, the AMD GPU work, the "reveal" animation.
- Scanned PDFs (OCR), multiple documents, comparing versions, exports.
- Accounts, payments, self-hosting (pitched, not built).

## Assumptions & risks

**Assumptions**
- **A1.** The submission needs a video, slides, cover image, demo link and evidence of Bob use (from the Backstory brief; confirm in the dashboard).
- **A2.** Business viability weighs most in judging.
- **A3.** Lead buyer: due-diligence and contract-review teams. You picked analysts/reviewers; the buyer inside that is my assumption.
- **A4.** Demo documents are public (e.g. an agreement filed as an exhibit on SEC EDGAR), never a client's document.
- **A5.** The Bob tracks accept a non-developer product. Backstory carried the same assumption.

**Risks, most urgent first**
1. **Starting from zero with about 2.5 build hours.** If extraction on demo document 1 isn't clean by the checkpoint, there's nothing to film. **Checkpoint 12:45:** if clean, verified JSON for document 1 doesn't exist, go back to Backstory, which still needs about 1.5 hours of wiring. *(US-03, US-05)*
2. **"Why not NotebookLM?"** Google's NotebookLM already turns sources into a clickable mind map with cited answers, for free. Your answer is typed relations with a verified quote on every link. Say it in the first 20 seconds of the video. *(US-03, US-08)*
3. **Invented evidence.** Models paraphrase or invent quotes. An analyst who cites a quote that isn't in the document is worse off than with no tool. Every quote must match the page text; anything that doesn't is dropped. *(US-05)*
4. **The hairball.** Dozens of nodes and hundreds of links is the opposite of "overview in seconds". Cap the overview and let people expand. *(US-06)*
5. **Duplicates.** "Acme Holdings Inc.", "Acme" and "the Company" become three nodes unless merged, and defined terms in contracts make this common. *(US-04)*
6. **Confidential documents.** The buyer's first question is where the document goes. The model provider's API terms must exclude training on inputs, the upload screen names the provider, and nothing is stored. *(US-16, US-17)*
7. **Scanned PDFs.** Many real contracts are scans with no text layer. Reject them clearly today; OCR later. *(US-01, US-22)*
8. **Liability.** A map of a contract can look like legal advice. The screen says it shows what the document says and links to the source. *(US-19)*

## User stories

Labels: **Must** = needed for a credible first version (defines the MVP) · **Should** = valuable, but it can ship without · **Shall** = legal, privacy, security, safety or contractual obligation.

### A. Build the map

**US-01 · Must** · As an analyst, I want to upload a PDF and get a map without any setup, so that I can start a review the moment a document lands.
- Accepts a text-based PDF up to 30 pages and 10 MB.
- A PDF with no text layer is rejected with "This looks like a scan; text-based PDFs only for now."
- Shows progress while it works; the map appears within about a minute for 30 pages.

**US-02 · Must** · As an analyst, I want every piece of text tied to its page, so that every finding can point to where it came from.
- Text is extracted page by page and chunked without crossing page boundaries.

**US-03 · Must** · As an analyst, I want the parties, obligations, dates, amounts and topics pulled out and linked, so that I see who owes what to whom, by when.
- Five node types: Party, Obligation, Date, Amount, Topic.
- Each link has a short relation ("pays", "must deliver by", "may terminate if") plus a quote and page.
- Output is structured JSON; malformed output is retried once, then skipped for that chunk and noted.

**US-04 · Must** · As an analyst, I want one node per real thing, so that the map isn't cluttered with the same party under three names.
- Merges on normalized names and on defined terms ("Acme Holdings Inc. (the 'Company')").
- A merged node lists the names it covers.

**US-05 · Must** · As an analyst, I want every quote checked against the page it cites, so that I never cite a sentence the document doesn't contain.
- A quote is kept only if it appears on the cited page after normalizing whitespace and quote marks.
- Nodes and links left with no verified quote are dropped.
- The map shows how many items were dropped for failing the check.

**US-06 · Must** · As an analyst, I want the overview to show only the most important items first, so that I grasp the document's structure at a glance.
- Shows at most about 30 nodes, chosen by how often they're mentioned and how many links they have; parties are always shown.
- Says how many more exist; one click expands.
- Node types are distinguished by colour and a label, not colour alone.

### B. Explore

**US-07 · Must** · As an analyst, I want to click a node and see what it's linked to and the passages behind it, so that I can check a finding in seconds.
- Side panel: node name and type, linked nodes with their relations, and each quote with its page number.
- Quotes are shown exactly as found in the document.

**US-08 · Should** · As an analyst, I want to click a link and see its relation and quote, so that I can check one specific obligation.

**US-09 · Should** · As an analyst, I want to open the page with the quote highlighted, so that I can read the surrounding context.

**US-10 · Should** · As an analyst, I want to filter the map by type (e.g. only dates and amounts), so that I can pull out what my checklist asks for.

**US-11 · Should** · As an analyst, I want to ask a question and see the answer as a highlighted path with sources, so that I can explore beyond the overview.

**US-12 · Should** · As a judge or first-time user, I want to see the steps the agent took, so that I can see an agent doing the work.
- A short log: pages read, items found, duplicates merged, quotes verified or dropped.

### C. Demo and submission

**US-13 · Must** · As the presenter, I want the two demo documents to open from cached results, so that the demo can't fail on stage.
- Cached maps for both documents, used automatically on timeout or error.
- Tested on the deployed URL.

**US-14 · Shall** · As the organizers (lablab and IBM), we require a complete submission before the deadline, so that the entry is eligible.
- Every item on the dashboard checklist (per the Backstory brief: video, slides, cover image, demo link).
- Submitted by 16:30; the demo link opens without a login.

**US-15 · Shall** · As the IBM judges, we want to see how IBM Bob was used to build the product, so that we can score it against the event's theme.
- Screenshots of Bob sessions for the extraction pipeline, verification, merging and the map UI.
- A "Built with Bob" section in the README and about 15 seconds of the video.

### D. Obligations

**US-16 · Shall** · As an analyst uploading a client document, I want it deleted after the map is built and to know which services see it, so that I don't breach my confidentiality duties.
- Uploads are processed in memory and discarded; no document text in logs or storage, apart from the public demo documents.
- The upload screen names the model provider that receives the text.

**US-17 · Shall** · As the buyer's security team, we need the model provider's terms to exclude training on our documents, so that confidential text can't leak into a model.
- The model is called through an API whose terms exclude training on inputs by default; the README names the provider and links its terms.
- Where the provider offers EU data processing, use it and say so (buyers under GDPR will ask).

**US-18 · Shall** · As the team paying for the APIs, we need keys kept on the server and usage capped, so that a leaked key or a flood of requests can't drain credits before judging.
- All model calls go through the backend; no keys in the frontend bundle, the repo or its git history (scan before the repo goes public).
- A per-visitor rate limit; upload size and page limits (US-01).

**US-19 · Shall** · As the team, we must not present the map as legal advice or as complete, so that a reviewer doesn't rely on it in place of the document.
- A one-line notice: "A map of what this document says, not legal advice. Check every item against the source."
- The map never claims to have found "all" obligations.

### E. After the hackathon

**US-20 · Should** · As an analyst, I want to export the map and its quotes into a review memo, so that my first pass becomes part of my deliverable.

**US-21 · Should** · As a reviewer, I want to compare two versions of a contract as maps, so that I see which obligations, dates or amounts changed.

**US-22 · Should** · As an analyst, I want scanned PDFs to work, so that I can use it on the documents I actually receive.

**US-23 · Should** · As a buyer in a regulated industry, I want an EU-hosted or self-hosted option, so that client documents never leave our control.

## Priority summary

Sorted by criticality. **For 16:30** says what to do today.

| ID | Story | Label | Quadrant | For 16:30 |
|---|---|---|---|---|
| US-14 | Complete submission before the deadline | Shall | Critical | Today; confirm the checklist now |
| US-15 | Show how Bob built it | Shall | Critical | Today; screenshot while building |
| US-03 | Extract and link parties, obligations, dates, amounts | Must | Critical | Build first; checkpoint 12:45 |
| US-07 | Click a node, see links and quotes | Must | Critical | Build |
| US-06 | Capped, readable overview | Must | Critical | Build |
| US-01 | Upload a PDF | Must | Critical | Reuse Backstory's upload |
| US-13 | Demo falls back to cache | Must | Critical | By 14:30 |
| US-05 | Every quote verified against its page | Must | Hidden essential | Build with US-03 |
| US-02 | Text tied to pages | Must | Hidden essential | Build first |
| US-04 | Merge duplicates | Must | Hidden essential | Build (name + defined terms) |
| US-16 | Uploads not stored; provider named | Shall | Hidden essential | Today |
| US-17 | No training on documents | Shall | Hidden essential | Today (check terms, README line) |
| US-18 | Keys on the server, usage capped | Shall | Hidden essential | Today, before the repo goes public |
| US-19 | Not legal advice, never "complete" | Shall | Hidden essential | Today (one line) |
| US-12 | Agent steps visible | Should | Visible win | If time |
| US-08 | Click a link, see its quote | Should | Visible win | If time |
| US-10 | Filter by type | Should | Visible win | If time |
| US-21 | Compare contract versions | Should | Visible win | Pitch only |
| US-23 | EU or self-hosted option | Should | Visible win | Pitch only |
| US-20 | Export to a review memo | Should | Visible win | Pitch only |
| US-09 | Page view with highlight | Should | Low priority | Cut |
| US-11 | Question answering on the map | Should | Low priority | Cut |
| US-22 | Scanned PDFs | Should | Low priority | Later |

## Criticality matrix

x = stakeholder importance (how much key stakeholders value and notice it) · y = impact of missing it (how bad things get if it's absent or broken). Scores run from 1 to 10.

| ↑ Impact of missing · Stakeholder importance → | **Low importance** | **High importance** |
|---|---|---|
| **High impact** | **Hidden essentials:** US-05 verified quotes · US-02 pages · US-04 merging · US-16 no storage · US-17 no training · US-18 keys · US-19 not advice | **Critical:** US-14 submission · US-15 Bob · US-03 extraction · US-07 node panel · US-06 overview · US-01 upload · US-13 demo cache |
| **Low impact** | **Low priority:** US-09 page view · US-11 Q&A · US-22 OCR | **Visible wins:** US-12 agent log · US-08 link quotes · US-10 filter · US-21 compare versions · US-23 EU hosting · US-20 export |

**Critical: do first**
- US-14 (10, 10): miss the deadline or a checklist item and nothing else counts.
- US-15 (9, 9): the event's theme; judges look for Bob.
- US-03 (9, 10): the product; without clean extraction there's no map.
- US-07 (9, 9): the evidence panel is what separates this from a pretty picture.
- US-06 (8, 8): your chosen core value; an unreadable graph fails it.
- US-01 (7, 9): the way in; cheap because Backstory already has it.
- US-13 (7, 9): a live demo that stalls sinks a working product.

**Hidden essentials: protect these**
- US-05 (4, 10): nobody asks for it, but one invented quote destroys an analyst's trust and the pitch.
- US-02 (2, 9): without page numbers, nothing can be cited.
- US-04 (4, 8): unmerged duplicates make the overview unreadable.
- US-16 (5, 8): confidential documents are the buyer's first question.
- US-17 (4, 8): the security team's deal-breaker.
- US-18 (2, 9): one leaked key drains credits before judging.
- US-19 (3, 7): a contract map read as advice is a liability.

**Visible wins: ship when affordable**
- US-12 (7, 4): makes the agent visible to judges.
- US-08 (6, 4): nice, but the node panel already shows link quotes.
- US-10 (6, 3): matches how analysts work from checklists.
- US-21 (8, 3): the strongest "why pay" feature; a slide today.
- US-23 (7, 3): answers the security objection on a slide.
- US-20 (7, 3): turns the map into billable work.

**Low priority: defer**
- US-09 (5, 2): the quote and page number are enough for today.
- US-11 (5, 2): the pasted plan's showpiece, but it's NotebookLM's home turf and adds retrieval work.
- US-22 (6, 2): important for real use, out of reach today.

**Label vs. matrix: worth a second look**
- **US-05 is a Must nobody will ask for.** It's what makes "every node has a verified source" true; build it with extraction, not after.
- **US-11 was the pasted plan's demo highlight.** It's cut because it competes head-on with NotebookLM and doesn't serve "overview in seconds".
- **US-21 is a Should but your best business answer.** Comparing contract versions is what a due-diligence team would pay for; put it on the business slide.
- **US-22 is low today but high for real customers.** Many contracts arrive as scans; it becomes a Must before any pilot.

## Timeline (Amsterdam time)

| When | What |
|---|---|
| 11:35–11:50 | Confirm the checklist; pick two public demo PDFs; fork Backstory's scaffolding in Bob |
| 11:50–12:45 | Page-aware text extraction, extraction prompt and JSON schema, quote verification on document 1 |
| **12:45** | **Checkpoint:** clean, verified JSON for document 1? If not, return to Backstory |
| 12:45–13:45 | Merging, overview cap, graph UI, node panel |
| 13:45–14:30 | Document 2, cache both, deploy, test on the deployed URL; feature freeze |
| 14:30–16:15 | Video, slides, cover image, README with "Built with Bob" |
| 16:15–16:30 | Submit |

## Concept brief

*For the brand-identity step.*

- **What it is:** an AI agent that turns a long report or contract into a map of who owes what to whom, by when, where every node and link opens the exact, verified passage it came from.
- **Who it's for:** analysts and reviewers in due diligence, contract review, compliance and consulting. Buyers: legal-ops, due-diligence and consulting teams, with their security teams as gatekeepers.
- **The one thing:** an overview an analyst grasps at a glance, with a verified source behind every item.
- **Must-haves:** upload a text-based PDF; page-aware extraction of parties, obligations, dates, amounts and topics with their links; merged duplicates; every quote verified against its page; a capped, readable overview; a node panel with links and quotes; cached demo documents; complete submission with Bob evidence; no stored documents and a named provider; no training on documents; keys on the server; a not-legal-advice notice.
- **What shapes the feel:** precise, sober and trustworthy, never flashy; evidence over summary; comfortable showing what it dropped. "Memory Palace" is a working title; the pasted names (MEMORA, Mindscape, DocVerse) lean playful for a buyer who cares about confidentiality.