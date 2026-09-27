# Bob AI Contributions — Docverse / Clausemap

> This document records which parts of the codebase were authored or substantially modified by **Bob (IBM Bob AI assistant)** during the hackathon build session. It is derived from the Bob git-notes attached to commits and from the commit diffs themselves.

---

## Summary

| Commit | Message | Author | Bob involved? |
|---|---|---|---|
| `f012e20` | Initial commit | Human | — |
| `ebd5fff` | Phase 0 and B1 | Human (`setaremsb`) | No |
| `5a9f7e9` | All tasks complete | Human (`setaremsb`) | No |
| `4e48915` | UI changes | **Bob** (`sadrahekmatt`) | ✅ Yes |
| `2f9ab95` | Phase U2 | **Bob** (`sadrahekmatt`) | ✅ Yes |
| `389caf8` | Document fix | **Bob** (`sadrahekmatt`) | ✅ Yes |

Bob authored **three commits** touching **17 distinct files** across backend, frontend, and documentation.

---

## Phase: UI Polish (commit `4e48915` — "UI changes")

### Backend

| File | What Bob did |
|---|---|
| `backend/app/schemas.py` | Extended Pydantic schemas — added new response models and updated field definitions (lines 7–87) |
| `backend/app/extract.py` | Significant expansion of extraction logic (~73 line diff) |
| `backend/app/merge.py` | Major refactor of merge pipeline logic (~260 line diff) |
| `backend/app/pipeline.py` | Pipeline coordination updates |
| `backend/tests/test_merge.py` | Added ~195 lines of new merge test coverage |

### Frontend

| File | What Bob did |
|---|---|
| `frontend/src/theme.ts` | Created from scratch — full design token / theme definition file (42 lines) |
| `frontend/src/index.css` | Rewrote global CSS — custom properties, layout tokens, scrollbar styling |
| `frontend/src/pages/HomePage.tsx` | Full rewrite — redesigned landing/upload page with proper state handling, file drag-drop, step indicators |
| `frontend/src/pages/MapPage.tsx` | Full rewrite — map viewer page with node selection, sidebar panel, filter integration |
| `frontend/src/components/MapGraph/MapGraph.tsx` | Major rewrite — React Flow graph renderer with custom node types, edge routing, layout |
| `frontend/src/components/NodePanel/NodePanel.tsx` | Updated — clause detail side panel, linked reference display |
| `frontend/src/components/StepsLog/StepsLog.tsx` | Minor fix (line 47) |
| `frontend/src/components/TypeFilter/TypeFilter.tsx` | Created from scratch — node type filter chip component (97 lines) |
| `frontend/public/favicon.svg` | Created — custom SVG favicon |
| `docs/development_report.md` | Updated report table entries |
| `plan.md` | Phase U1/U2 plan sections added (~174 lines) |

---

## Phase: "Ask the Map" Chat — U2 (commit `2f9ab95`)

### Backend

| File | What Bob did |
|---|---|
| `backend/app/ask.py` | **Created from scratch** — full RAG-powered Q&A endpoint: query embedding, cosine similarity retrieval over contract nodes, OpenRouter LLM call with citation formatting (183 lines) |
| `backend/app/router.py` | Extended with `/ask` route, request validation, streaming response wiring (77 lines added) |
| `backend/tests/test_ask.py` | **Created from scratch** — comprehensive unit + integration tests for the ask endpoint, mocking LLM and embedding calls (234 lines) |

### Frontend

| File | What Bob did |
|---|---|
| `frontend/src/components/AskBox/AskBox.tsx` | **Created from scratch** — full chat UI component: message history, streaming token rendering, citation chips, loading states (308 lines) |
| `frontend/src/pages/MapPage.tsx` | Integrated AskBox panel into the map page — toggle show/hide, layout adjustment, state wiring |
| `frontend/src/components/MapGraph/MapGraph.tsx` | Added node highlight callback for citation-driven graph highlighting |
| `frontend/lib/api.ts` | Added `askMap()` streaming API function with SSE parsing |
| `frontend/lib/types.ts` | Extended with `AskRequest`, `AskChunk`, `Citation` TypeScript types |
| `docs/contract.md` | Appended the `/ask` endpoint contract specification (59 lines) |

---

## Phase: Document Fix (commit `389caf8`)

| File | What Bob did |
|---|---|
| `README.md` | Fixed project description and live URLs |
| `plan.md` | Corrected phase status markers |
| `frontend/src/components/MapGraph/MapGraph.tsx` | Bug fix — edge label rendering and node position calculation (~61 line diff) |

---

## Files Entirely Authored by Bob

These files did not exist before Bob's commits and were written entirely by Bob:

- [`backend/app/ask.py`](../backend/app/ask.py) — RAG Q&A engine
- [`backend/tests/test_ask.py`](../backend/tests/test_ask.py) — tests for ask endpoint
- [`frontend/src/components/AskBox/AskBox.tsx`](../frontend/src/components/AskBox/AskBox.tsx) — chat UI component
- [`frontend/src/components/TypeFilter/TypeFilter.tsx`](../frontend/src/components/TypeFilter/TypeFilter.tsx) — type filter chips
- [`frontend/src/theme.ts`](../frontend/src/theme.ts) — design token system
- [`frontend/public/favicon.svg`](../frontend/public/favicon.svg) — project favicon

---

## Files Substantially Rewritten by Bob

These files existed before but were largely replaced or heavily extended by Bob:

- [`frontend/src/pages/HomePage.tsx`](../frontend/src/pages/HomePage.tsx)
- [`frontend/src/pages/MapPage.tsx`](../frontend/src/pages/MapPage.tsx)
- [`frontend/src/components/MapGraph/MapGraph.tsx`](../frontend/src/components/MapGraph/MapGraph.tsx)
- [`frontend/src/index.css`](../frontend/src/index.css)
- [`backend/app/merge.py`](../backend/app/merge.py)
- [`backend/app/router.py`](../backend/app/router.py)
- [`backend/app/schemas.py`](../backend/app/schemas.py)

---

## What the Human Developer Built (for context)

The following were built entirely by the human developer (`setaremsb`) and are **not** Bob's work:

- `backend/app/extract.py` (initial version) — PDF clause extraction with LLM
- `backend/app/pdf.py` — PDF text extraction
- `backend/app/verify.py` — clause verification logic
- `backend/app/errors.py` — shared error types
- `backend/app/pipeline.py` (initial version) — extraction pipeline orchestration
- `frontend/src/components/NodePanel/NodePanel.tsx` (initial version)
- `frontend/src/components/StepsLog/StepsLog.tsx` (initial version)
- `frontend/lib/types.ts` (initial version)
- `frontend/lib/api.ts` (initial version)
- `frontend/lib/store.ts`
- `docs/contract.md` (initial version)
- `plan.md` (initial version, via `production-planner` skill)
- `brand-guide.md`
- `REQUIREMENTS.md`
