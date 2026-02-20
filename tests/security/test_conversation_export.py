"""Tests for conversation exporter."""

from __future__ import annotations

from ragkit.export.conversation_export import ConversationExporter


def test_to_markdown_empty() -> None:
    exporter = ConversationExporter()
    result = exporter.to_markdown([], "general")
    assert "Conversation RAGKIT" in result
    assert "general" in result


def test_to_markdown_single_exchange() -> None:
    messages = [
        {"role": "user", "content": "What is RAG?"},
        {"role": "assistant", "content": "RAG stands for Retrieval-Augmented Generation.", "sources": None},
    ]
    exporter = ConversationExporter()
    result = exporter.to_markdown(messages, "technical_documentation")
    assert "Question 1" in result
    assert "What is RAG?" in result
    assert "Retrieval-Augmented Generation" in result
    assert "technical_documentation" in result


def test_to_markdown_with_sources() -> None:
    messages = [
        {"role": "user", "content": "How to configure?"},
        {
            "role": "assistant",
            "content": "See the documentation.",
            "sources": [
                {"title": "Guide.pdf", "page": 5},
                {"title": "README.md", "page": 1},
            ],
        },
    ]
    exporter = ConversationExporter()
    result = exporter.to_markdown(messages, "general")
    assert "Guide.pdf (p.5)" in result
    assert "README.md (p.1)" in result


def test_to_markdown_multiple_questions() -> None:
    messages = [
        {"role": "user", "content": "Q1"},
        {"role": "assistant", "content": "A1"},
        {"role": "user", "content": "Q2"},
        {"role": "assistant", "content": "A2"},
    ]
    exporter = ConversationExporter()
    result = exporter.to_markdown(messages, "general")
    assert "Question 1" in result
    assert "Question 2" in result


def test_to_pdf_creates_file(tmp_path) -> None:
    messages = [
        {"role": "user", "content": "Test question"},
        {"role": "assistant", "content": "Test answer"},
    ]
    exporter = ConversationExporter()
    output = str(tmp_path / "conversation.pdf")
    result = exporter.to_pdf(messages, "general", output)
    # PDF fallback creates .md file
    assert result.endswith(".md")
    with open(result, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Test question" in content
