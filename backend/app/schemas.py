"""
Pydantic models for the Clausemap API contract v1.
Source of truth: docs/contract.md — do not drift from it.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


class Evidence(BaseModel):
    page: int  # 1-based
    quote: str


class Node(BaseModel):
    id: str
    label: str
    type: Literal["party", "obligation", "date", "amount", "topic"]
    aliases: list[str] = []
    mentions: int
    evidence: list[Evidence]  # never empty


class Edge(BaseModel):
    id: str
    source: str  # must exist in nodes
    target: str  # must exist in nodes
    relation: str
    evidence: list[Evidence]  # never empty


class Stats(BaseModel):
    pages: int
    nodes_before_merge: int
    nodes: int
    edges: int
    items_dropped_unverified: int
    duration_ms: int


class Step(BaseModel):
    t_ms: int
    message: str


class DocumentInfo(BaseModel):
    title: str
    page_count: int


class MapResult(BaseModel):
    schema_version: Literal["1"]
    document: DocumentInfo
    nodes: list[Node]
    edges: list[Edge]
    stats: Stats
    steps: list[Step]
    warnings: list[str] = []


# ---------------------------------------------------------------------------
# Ask — contract v1.1
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question: Annotated[str, Field(min_length=1, max_length=300)]
    map: MapResult

    @field_validator("question", mode="before")
    @classmethod
    def strip_question(cls, v: str) -> str:
        return v.strip()


class Citation(BaseModel):
    page: int
    quote: str


class AskResponse(BaseModel):
    answer: str
    node_ids: list[str] = []
    edge_ids: list[str] = []
    citations: list[Citation] = []
    dropped_citations: int = 0
