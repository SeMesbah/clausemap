# DocVerse — Your Documents, Rebuilt as a World

> Turn any PDF into an interactive, explorable knowledge graph. RAG you can walk through.

---

## What it does

Upload a document. DocVerse reads it, extracts entities and relationships using an LLM, builds a knowledge graph, and lets you:

- **Explore** — click any node to see evidence passages from the original document
- **Ask** — chat with your document; answers are grounded in source text with page citations
- **See** — watch the knowledge network reveal itself visually

---

## Project Structure

```
docverse/
├── backend/          # FastAPI Python backend
│   ├── main.py
│   ├── ingestion/    # PDF parsing & chunking
│   ├── extraction/   # LLM entity/relationship extraction
│   ├── graph/        # Knowledge graph management
│   ├── embeddings/   # Sentence-transformer embeddings + ChromaDB
│   └── rag/          # Vector search + LLM answer generation
├── frontend/         # React + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── GraphCanvas/   # Force-directed graph (react-force-graph)
│   │   │   ├── NodePanel/     # Node detail + evidence panel
│   │   │   ├── ChatBox/       # RAG question/answer UI
│   │   │   └── UploadScreen/  # PDF upload + progress
│   │   └── App.tsx
└── REQUIREMENTS.md   # Full requirements analysis
```

---

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add your OPENAI_API_KEY
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Graph | react-force-graph |
| Backend | Python + FastAPI |
| PDF parsing | pymupdf |
| LLM | OpenAI GPT-4o (structured output) |
| Embeddings | sentence-transformers (CPU) |
| Vector store | ChromaDB |
| Graph store | NetworkX |

---

## Requirements

See [`REQUIREMENTS.md`](./REQUIREMENTS.md) for the full requirements analysis.
