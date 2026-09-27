"""
Tests for app.ask — _verify_response() and the answer() entry point.

Covers the plan requirements:
  - Verification drops an invented (non-matching) citation quote
  - Verification drops an unknown node id
  - Verification drops an unknown edge id
  - Good citations and ids pass through unchanged
  - Mocked answer() round-trip: verify() is called with the LLM response
"""
import asyncio
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.schemas import (
    AskRequest, AskResponse, Citation,
    DocumentInfo, Edge, Evidence, MapResult, Node, Stats,
)
from app.ask import _verify_response, answer


# ---------------------------------------------------------------------------
# Minimal MapResult fixture
# ---------------------------------------------------------------------------

def _make_map() -> MapResult:
    return MapResult(
        schema_version="1",
        document=DocumentInfo(title="Test Contract", page_count=3),
        nodes=[
            Node(
                id="n1", label="Supplier", type="party", aliases=["the Supplier"],
                mentions=4,
                evidence=[Evidence(page=1, quote="The Supplier shall deliver goods.")],
            ),
            Node(
                id="n2", label="deliver goods", type="obligation", aliases=[],
                mentions=2,
                evidence=[Evidence(page=1, quote="The Supplier shall deliver goods.")],
            ),
            Node(
                id="n3", label="30 June 2025", type="date", aliases=[],
                mentions=1,
                evidence=[Evidence(page=2, quote="Delivery is due by 30 June 2025.")],
            ),
        ],
        edges=[
            Edge(
                id="e1", source="n1", target="n2", relation="must deliver",
                evidence=[Evidence(page=1, quote="The Supplier shall deliver goods.")],
            ),
        ],
        stats=Stats(
            pages=3, nodes_before_merge=3, nodes=3, edges=1,
            items_dropped_unverified=0, duration_ms=100,
        ),
        steps=[],
        warnings=[],
    )


# ---------------------------------------------------------------------------
# _verify_response
# ---------------------------------------------------------------------------

class TestVerifyResponse:

    def test_good_citation_passes_through(self):
        map_result = _make_map()
        raw = {
            "answer": "The Supplier must deliver goods.",
            "node_ids": ["n1", "n2"],
            "edge_ids": ["e1"],
            "citations": [{"page": 1, "quote": "The Supplier shall deliver goods."}],
        }
        result = _verify_response(raw, map_result)

        assert result.answer == "The Supplier must deliver goods."
        assert result.node_ids == ["n1", "n2"]
        assert result.edge_ids == ["e1"]
        assert len(result.citations) == 1
        assert result.citations[0].page == 1
        assert result.citations[0].quote == "The Supplier shall deliver goods."
        assert result.dropped_citations == 0

    def test_invented_quote_is_dropped(self):
        """A citation whose quote doesn't match any evidence verbatim is dropped."""
        map_result = _make_map()
        raw = {
            "answer": "The Supplier must deliver.",
            "node_ids": ["n1"],
            "edge_ids": [],
            "citations": [
                {"page": 1, "quote": "The Supplier shall deliver goods."},  # real
                {"page": 1, "quote": "The Supplier will deliver goods by June."},  # invented
            ],
        }
        result = _verify_response(raw, map_result)

        assert len(result.citations) == 1
        assert result.citations[0].quote == "The Supplier shall deliver goods."
        assert result.dropped_citations == 1

    def test_wrong_page_for_real_quote_is_dropped(self):
        """Same quote on the wrong page is not a match."""
        map_result = _make_map()
        raw = {
            "answer": "...",
            "node_ids": [],
            "edge_ids": [],
            "citations": [{"page": 99, "quote": "The Supplier shall deliver goods."}],
        }
        result = _verify_response(raw, map_result)
        assert result.dropped_citations == 1
        assert result.citations == []

    def test_unknown_node_id_is_dropped(self):
        map_result = _make_map()
        raw = {
            "answer": "Some answer.",
            "node_ids": ["n1", "n_invented"],
            "edge_ids": [],
            "citations": [],
        }
        result = _verify_response(raw, map_result)
        assert result.node_ids == ["n1"]

    def test_unknown_edge_id_is_dropped(self):
        map_result = _make_map()
        raw = {
            "answer": "Some answer.",
            "node_ids": [],
            "edge_ids": ["e1", "e_invented"],
            "citations": [],
        }
        result = _verify_response(raw, map_result)
        assert result.edge_ids == ["e1"]

    def test_empty_llm_response(self):
        """An empty raw dict produces a safe default response."""
        result = _verify_response({}, _make_map())
        assert result.answer == ""
        assert result.node_ids == []
        assert result.edge_ids == []
        assert result.citations == []
        assert result.dropped_citations == 0

    def test_all_citations_dropped_counts_correctly(self):
        map_result = _make_map()
        raw = {
            "answer": "...",
            "node_ids": [],
            "edge_ids": [],
            "citations": [
                {"page": 1, "quote": "INVENTED A"},
                {"page": 2, "quote": "INVENTED B"},
                "not-a-dict",
            ],
        }
        result = _verify_response(raw, map_result)
        assert result.citations == []
        assert result.dropped_citations == 3


# ---------------------------------------------------------------------------
# answer() integration (LLM mocked)
# ---------------------------------------------------------------------------

class TestAnswerFunction:

    def _make_llm_response(self, content: str):
        """Build a minimal mock that looks like an openai ChatCompletion."""
        choice = MagicMock()
        choice.message.content = content
        mock_resp = MagicMock()
        mock_resp.choices = [choice]
        return mock_resp

    def test_answer_calls_verify_and_returns_response(self):
        """answer() passes the LLM output through verification."""
        map_result = _make_map()
        request = AskRequest(question="What must the Supplier deliver?", map=map_result)

        llm_payload = {
            "answer": "The Supplier must deliver goods.",
            "node_ids": ["n1", "n2"],
            "edge_ids": ["e1"],
            "citations": [{"page": 1, "quote": "The Supplier shall deliver goods."}],
        }
        import json
        mock_response = self._make_llm_response(json.dumps(llm_payload))

        with patch("app.ask._build_client") as mock_build:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_build.return_value = mock_client

            result = asyncio.get_event_loop().run_until_complete(answer(request))

        assert isinstance(result, AskResponse)
        assert result.node_ids == ["n1", "n2"]
        assert result.edge_ids == ["e1"]
        assert len(result.citations) == 1
        assert result.dropped_citations == 0

    def test_answer_drops_invented_citation(self):
        """answer() verifies that invented citations are dropped."""
        map_result = _make_map()
        request = AskRequest(question="What is the delivery obligation?", map=map_result)

        llm_payload = {
            "answer": "Some answer.",
            "node_ids": ["n1"],
            "edge_ids": [],
            "citations": [
                {"page": 1, "quote": "The Supplier shall deliver goods."},  # real
                {"page": 1, "quote": "This quote was never in the document."},  # invented
            ],
        }
        import json
        mock_response = self._make_llm_response(json.dumps(llm_payload))

        with patch("app.ask._build_client") as mock_build:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_build.return_value = mock_client

            result = asyncio.get_event_loop().run_until_complete(answer(request))

        assert len(result.citations) == 1
        assert result.dropped_citations == 1
