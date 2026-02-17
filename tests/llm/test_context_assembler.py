from __future__ import annotations

from ragkit.config.llm_schema import LLMConfig
from ragkit.config.retrieval_schema import UnifiedSearchResultItem
from ragkit.llm.context_assembler import ContextAssembler


def _result(chunk_id: str, text: str, score: float) -> UnifiedSearchResultItem:
    return UnifiedSearchResultItem(
        chunk_id=chunk_id,
        score=score,
        text=text,
        text_preview=text[:100],
        doc_title=f"Doc {chunk_id}",
        doc_path=f"/tmp/{chunk_id}.txt",
        page_number=1,
        keywords=[],
    )


def test_context_assembler_respects_chunk_limit() -> None:
    config = LLMConfig.model_validate({"context_max_chunks": 2, "context_max_tokens": 500})
    assembler = ContextAssembler(config)

    context = assembler.assemble([
        _result("a", "alpha " * 50, 0.9),
        _result("b", "beta " * 50, 0.8),
        _result("c", "gamma " * 50, 0.7),
    ])

    assert context.chunks_available == 3
    assert context.chunks_included == 2
    assert len(context.chunks_used) == 2
    assert "<context>" in context.formatted_text
    assert "</context>" in context.formatted_text


def test_context_assembler_truncates_when_token_budget_exceeded() -> None:
    config = LLMConfig.model_validate({"context_max_chunks": 3, "context_max_tokens": 500})
    assembler = ContextAssembler(config)

    long_text = "mot " * 600
    context = assembler.assemble([
        _result("a", long_text, 0.9),
        _result("b", long_text, 0.8),
    ])

    assert context.total_tokens <= 500
    assert context.truncated is True
    assert context.chunks_included >= 1
