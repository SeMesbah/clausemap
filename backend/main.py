from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DocVerse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Routers will be added here
# from ingestion.router import router as ingestion_router
# from graph.router import router as graph_router
# from rag.router import router as rag_router
# app.include_router(ingestion_router, prefix="/api")
# app.include_router(graph_router, prefix="/api")
# app.include_router(rag_router, prefix="/api")
