# Clausemap — API Contract v1

*Frozen: Phase 0. Changing this requires both devs to agree out loud and bumps `schema_version`.*

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/maps` | Upload a PDF (`multipart/form-data`, field `file`). Returns `MapResult` (200) or error (400 / 413 / 422 / 429 / 504). |
| `GET` | `/api/v1/demo/{demo_id}` | `demo_id` is `demo-1` or `demo-2`. Returns cached `MapResult`. |
| `GET` | `/api/v1/health` | Returns `{"status": "ok"}`. |

### Error body (all 4xx / 5xx)

```json
{ "error": { "code": "string", "message": "string" } }
```

---

## MapResult schema

```json
{
  "schema_version": "1",
  "document": { "title": "string", "page_count": 0 },
  "nodes": [
    {
      "id": "n1",
      "label": "Acme Holdings Inc.",
      "type": "party | obligation | date | amount | topic",
      "aliases": ["the Company"],
      "mentions": 0,
      "evidence": [ { "page": 1, "quote": "exact text from the page" } ]
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "relation": "must deliver",
      "evidence": [ { "page": 1, "quote": "exact text from the page" } ]
    }
  ],
  "stats": {
    "pages": 0,
    "nodes_before_merge": 0,
    "nodes": 0,
    "edges": 0,
    "items_dropped_unverified": 0,
    "duration_ms": 0
  },
  "steps": [ { "t_ms": 0, "message": "Read 24 pages" } ],
  "warnings": ["string"]
}
```

---

## Contract rules

1. `page` is 1-based.
2. `evidence` is **never empty** for any node or edge that appears in the output.
3. `type` is exactly one of: `party`, `obligation`, `date`, `amount`, `topic`.
4. Every edge's `source` and `target` must exist in `nodes`.
5. The backend returns the full graph. The frontend decides what the overview shows (UI cap from US-06); the backend is unaware of UI concerns.
6. Changing the contract after 12:10 requires both devs to agree and bumps `schema_version`.

---

## Contract v1.1 — "Ask the map" addition

*Added Phase U2. v1 stays valid; this appends one new endpoint.*

### New endpoint

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/ask` | Ask a question about a MapResult. Body: JSON, max 2 MB. Returns `AskResponse` (200) or error. |

### Request body

```json
{
  "question": "What must the Supplier deliver and by when?",
  "map": { /* MapResult — schema_version 1 */ }
}
```

- `question`: 1–300 characters (stripped of leading/trailing whitespace).
- `map`: a full `MapResult` as returned by `/maps` or `/demo/{id}`.

### AskResponse schema

```json
{
  "answer": "string",
  "node_ids": ["n1", "n2"],
  "edge_ids": ["e1"],
  "citations": [
    { "page": 1, "quote": "exact verbatim text from the document" }
  ],
  "dropped_citations": 0
}
```

- `answer`: a plain-English answer (1–4 sentences). If the map doesn't cover the question, one sentence says so with no citations.
- `node_ids`: ids of nodes the answer draws on (all guaranteed to exist in `map.nodes`).
- `edge_ids`: ids of edges the answer draws on (all guaranteed to exist in `map.edges`).
- `citations`: verbatim quotes from the map's evidence (exact character-for-character match verified server-side).
- `dropped_citations`: count of quotes returned by the LLM that failed verification and were removed.

### Additional error codes (same `{ "error": { code, message } }` envelope)

| Code | HTTP | Meaning |
|---|---|---|
| `question_invalid` | 400 | Question empty or exceeds 300 characters. |
| `map_invalid` | 422 | Body failed `MapResult` validation or exceeds 2 MB. |
| `llm_unavailable` | 503 | LLM not reachable (demos still work). |
| `rate_limited` | 429 | More than 6 questions per 10 minutes from the same IP. |

### Security / privacy notes

- The question text and map content are **never logged** (only lengths and status codes are logged).
- All citations are exact-match verified: the LLM cannot fabricate a quote that isn't already in the map's evidence.
- Prompt injection via document text is mitigated: the system prompt identifies document content as data, and verification ensures only real evidence quotes can appear in the response.
