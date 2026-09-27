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
