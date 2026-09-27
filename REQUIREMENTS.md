# Requirements Analysis — MEMORA (AI Memory Palace / DocVerse)

## 1. Problem Statement

Users working with long-form documents (research papers, reports, contracts, technical specs) struggle to find and connect information. Standard AI summarisation loses structure, and traditional RAG answers questions but doesn't reveal the shape of knowledge. MEMORA turns a document into an interactive, explorable knowledge graph — "RAG you can walk through."

---

## 2. Scope & Constraints

| Dimension | Constraint |
|---|---|
| Time budget | 24-hour hackathon |
| GPU | ❌ No AMD GPU access — embedding acceleration benchmark is OUT |
| Document size | 5–30 page PDFs (MVP) |
| Team | Assumed small (1–3 people) |
| Goal | Working demo, strong visual, traceable evidence |

---

## 3. Functional Requirements

### FR-1 — Document Ingestion
- **FR-1.1** Accept a single PDF upload via the UI
- **FR-1.2** Extract plain text from the PDF (page-aware, preserving page numbers)
- **FR-1.3** Split text into overlapping chunks (e.g. ~300–500 tokens, ~50-token overlap)

### FR-2 — Entity & Relationship Extraction
- **FR-2.1** Send chunks to an LLM and extract structured JSON: entities (id, label, type) + relationships (source, relation, target)
- **FR-2.2** Support at least 4 entity types: **Person**, **Organization**, **Concept**, **Technology** (Events/Locations optional stretch)
- **FR-2.3** Deduplicate entities across chunks (same label → same node)
- **FR-2.4** Record which chunk(s) and page(s) each entity and relationship was found on (provenance)

### FR-3 — Knowledge Graph Storage
- **FR-3.1** Persist graph as nodes + edges (in-memory or lightweight DB is fine for MVP)
- **FR-3.2** Each node stores: id, label, type, mention count, list of evidence passages + page refs
- **FR-3.3** Each edge stores: source id, target id, relation label, evidence passages

### FR-4 — Embedding & Vector Search
- **FR-4.1** Generate embeddings for all document chunks (CPU, via e.g. `sentence-transformers`)
- **FR-4.2** Store embeddings in a vector store (in-memory FAISS or ChromaDB)
- **FR-4.3** Support cosine similarity search by query string

### FR-5 — Interactive Graph Visualisation
- **FR-5.1** Render the knowledge graph as an interactive 2D force-directed network
- **FR-5.2** Node colour/shape encodes entity type (4–5 categories)
- **FR-5.3** Support zoom, pan, drag on the graph canvas
- **FR-5.4** Animate graph construction on first load ("Reveal the Memory" sequence: nodes appear progressively)
- **FR-5.5** Clicking a node opens a detail panel (see FR-6)

### FR-6 — Node Detail Panel
- **FR-6.1** Show entity label, type, mention count
- **FR-6.2** List connected nodes (with clickable links)
- **FR-6.3** Show top 3 evidence passages from the document, each tagged with page number
- **FR-6.4** Clicking a passage navigates to / highlights the source text

### FR-7 — Conversational RAG ("Ask Your Memory Palace")
- **FR-7.1** Accept a natural-language question in a chat input
- **FR-7.2** Perform vector search to retrieve top-K relevant chunks
- **FR-7.3** Pass retrieved chunks + question to LLM, return grounded answer
- **FR-7.4** Response includes inline source citations (page numbers)
- **FR-7.5** Highlight the graph nodes most relevant to the query (visual feedback)

### FR-8 — Processing Progress UI
- **FR-8.1** Show a staged loading sequence during document processing: Reading → Chunking → Extracting → Building Graph
- **FR-8.2** Show summary stats on completion: "X concepts, Y entities, Z relationships"

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Full pipeline for a 20-page PDF completes in < 2 minutes |
| NFR-2 | Reliability | Graceful error if LLM extraction fails for a chunk (skip + log, don't crash) |
| NFR-3 | Usability | No login, no setup — single URL, upload and go |
| NFR-4 | Traceability | Every AI answer and every graph node must be traceable to source text |
| NFR-5 | Portability | Runs locally (no cloud infra required beyond an LLM API key) |
| NFR-6 | Scope control | No multi-document support, no user accounts, no persistent storage across sessions |

---

## 5. Out of Scope (explicitly)

- ❌ GPU acceleration (no hardware access)
- ❌ 3D graph rendering
- ❌ Multiple simultaneous documents
- ❌ Custom fine-tuned models
- ❌ Autonomous multi-agent reasoning
- ❌ Mobile responsiveness (demo on desktop only)
- ❌ Authentication / user management

---

## 6. Proposed Technical Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Fast to scaffold, ecosystem for graph libs |
| Graph rendering | `react-force-graph` or `vis-network` | Force-directed, interactive, well-documented |
| Backend | Python / FastAPI | Quick API, good LLM + NLP ecosystem |
| PDF parsing | `pymupdf` (fitz) or `pdfplumber` | Reliable, page-aware |
| LLM extraction | OpenAI GPT-4o or `ollama` (local) | Structured JSON output via function calling |
| Embeddings | `sentence-transformers` (CPU) | No GPU needed, good quality |
| Vector store | ChromaDB (in-process) | Zero-infrastructure, persistent enough for a session |
| Graph store | Python dict / NetworkX | Lightweight, no DB setup |

---

## 7. User Stories (prioritised)

| Priority | Story |
|---|---|
| P0 | As a user, I can upload a PDF and see a knowledge graph built from it |
| P0 | As a user, I can click a node and see evidence passages from the document |
| P0 | As a user, I can ask a question and get a grounded answer with source citations |
| P1 | As a user, I can see the graph animate into existence ("Reveal the Memory") |
| P1 | As a user, relevant nodes are visually highlighted when I get an answer |
| P2 | As a user, clicking a passage shows me the exact source text in context |
| P2 | As a user, I see summary stats (X entities, Y relationships) after processing |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM extraction returns inconsistent JSON | High | High | Use function calling / structured output; add a JSON repair fallback |
| Entity deduplication is messy | Medium | Medium | Normalise labels to lowercase + lemma; accept imperfect for MVP |
| Graph becomes unreadable with large docs | Medium | Medium | Cap at 30-page docs; cluster or filter node types if needed |
| Vector search quality is poor | Low | Medium | Use a well-tested model (`all-MiniLM-L6-v2`); small docs reduce this risk |
| 24-hour time pressure | High | High | Build FR-1 → FR-5 → FR-6 in order; FR-7 (RAG chat) is the last feature added |

---

## 9. MVP Build Order

```
Hour 0–2   │ Backend scaffold: PDF ingestion, chunking, LLM extraction → JSON
Hour 2–4   │ Graph construction + ChromaDB embeddings
Hour 4–7   │ FastAPI endpoints: /upload, /graph, /node/:id, /ask
Hour 7–11  │ Frontend: file upload, graph visualisation (static data first)
Hour 11–14 │ Node detail panel + evidence linking
Hour 14–17 │ RAG chat endpoint wired to frontend
Hour 17–20 │ "Reveal the Memory" animation + stats summary
Hour 20–22 │ Polish: node colours, loading states, error handling
Hour 22–24 │ Demo rehearsal + README
```

---

## 10. Definition of Done (demo-ready)

- [ ] Upload a 5–20 page PDF → graph renders in under 2 min
- [ ] Every node has at least one evidence passage from the document
- [ ] Ask a question → answer returned with page citations
- [ ] Relevant nodes visually highlight on answer
- [ ] Graph animates on first load
- [ ] No crashes on a clean demo run end-to-end
