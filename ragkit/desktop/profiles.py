"""Profile referential and calibration logic for the setup wizard."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

CALIBRATION_ALIASES = {
    "q1": "q1_tables_schemas",
    "q2": "q2_multi_document",
    "q3": "q3_long_documents",
    "q4": "q4_precision_needed",
    "q5": "q5_frequent_updates",
    "q6": "q6_citations_needed",
}

CALIBRATION_DEFAULTS = {
    "q1_tables_schemas": False,
    "q2_multi_document": False,
    "q3_long_documents": False,
    "q4_precision_needed": False,
    "q5_frequent_updates": False,
    "q6_citations_needed": False,
}

PROFILE_REFERENTIAL: dict[str, dict[str, Any]] = {
    "technical_documentation": {
        "display_name_fr": "Documentation technique",
        "display_name_en": "Technical documentation",
        "icon": "📘",
        "description_fr": "Manuels, API docs, guides, references techniques.",
        "description_en": "Manuals, API docs, and technical references.",
        "config": {
            "ingestion": {
                "parsing": {
                    "engine": "auto",
                    "ocr_enabled": False,
                    "ocr_language": ["fra", "eng"],
                    "ocr_engine": "tesseract",
                    "table_extraction_strategy": "markdown",
                    "image_captioning_enabled": False,
                    "header_detection": True,
                },
                "preprocessing": {
                    "lowercase": False,
                    "remove_punctuation": False,
                    "normalize_unicode": True,
                    "remove_urls": False,
                    "language_detection": True,
                    "deduplication_strategy": "exact",
                    "deduplication_threshold": 0.95,
                },
            },
            "chunking": {
                "strategy": "recursive",
                "chunk_size": 512,
                "chunk_overlap": 100,
                "min_chunk_size": 50,
                "max_chunk_size": 2000,
                "preserve_sentences": True,
                "metadata_propagation": True,
                "add_chunk_index": True,
                "add_document_title": True,
                "keep_separator": False,
                "separators": ["\n\n", "\n", ". ", " "],
                "similarity_threshold": 0.75,
                "header_levels": [1, 2, 3],
            },
            "embedding": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "batch_size": 100,
                "cache_enabled": True,
                "normalize": True,
            },
            "vector_store": {"provider": "qdrant", "mode": "persistent"},
            "retrieval": {
                "architecture": "hybrid_rerank",
                "semantic": {"top_k": 15, "weight": 0.5, "threshold": 0.0},
                "lexical": {
                    "enabled": True,
                    "top_k": 15,
                    "weight": 0.5,
                    "bm25_k1": 1.5,
                    "bm25_b": 0.75,
                },
                "hybrid": {"alpha": 0.3, "fusion_method": "rrf"},
            },
            "rerank": {
                "enabled": True,
                "provider": "cohere",
                "model": "rerank-v3.5",
                "top_n": 5,
                "candidates": 40,
                "relevance_threshold": 0.0,
            },
            "llm": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.1,
                "max_tokens": 2000,
                "top_p": 0.9,
                "cite_sources": True,
                "citation_format": "inline",
                "admit_uncertainty": True,
                "response_language": "auto",
                "context_max_chunks": 5,
                "context_max_tokens": 4000,
            },
            "agents": {
                "always_retrieve": False,
                "query_rewriting": {"enabled": True, "num_rewrites": 1},
                "detect_intents": ["question", "greeting", "chitchat", "out_of_scope"],
                "max_history_messages": 10,
                "memory_strategy": "sliding_window",
            },
        },
    },
    "faq_support": {
        "display_name_fr": "FAQ / Support",
        "display_name_en": "FAQ / Support",
        "icon": "❓",
        "description_fr": "Questions-reponses courtes et base d'aide.",
        "description_en": "Short Q&A and support knowledge base.",
        "config": {
            "ingestion": {
                "parsing": {
                    "engine": "auto",
                    "ocr_enabled": False,
                    "ocr_language": ["fra", "eng"],
                    "ocr_engine": "tesseract",
                    "table_extraction_strategy": "preserve",
                    "image_captioning_enabled": False,
                    "header_detection": True,
                },
                "preprocessing": {
                    "lowercase": False,
                    "remove_punctuation": False,
                    "normalize_unicode": True,
                    "remove_urls": True,
                    "language_detection": True,
                    "deduplication_strategy": "fuzzy",
                    "deduplication_threshold": 0.85,
                },
            },
            "chunking": {
                "strategy": "paragraph_based",
                "chunk_size": 256,
                "chunk_overlap": 50,
                "min_chunk_size": 30,
                "max_chunk_size": 1000,
                "preserve_sentences": True,
                "metadata_propagation": True,
                "add_chunk_index": False,
                "add_document_title": True,
                "keep_separator": False,
                "separators": ["\n\n", "\n"],
                "similarity_threshold": 0.8,
                "header_levels": [1, 2],
            },
            "embedding": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "batch_size": 100,
                "cache_enabled": True,
                "normalize": True,
            },
            "vector_store": {"provider": "chroma", "mode": "persistent"},
            "retrieval": {
                "architecture": "semantic",
                "semantic": {"top_k": 5, "weight": 1.0, "threshold": 0.3},
                "lexical": {
                    "enabled": False,
                    "top_k": 5,
                    "weight": 0.0,
                    "bm25_k1": 1.2,
                    "bm25_b": 0.75,
                },
                "hybrid": {"alpha": 0.8, "fusion_method": "weighted_sum"},
            },
            "rerank": {
                "enabled": False,
                "provider": "none",
                "model": None,
                "top_n": None,
                "candidates": None,
                "relevance_threshold": None,
            },
            "llm": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.3,
                "max_tokens": 1000,
                "top_p": 0.95,
                "cite_sources": True,
                "citation_format": "inline",
                "admit_uncertainty": True,
                "response_language": "auto",
                "context_max_chunks": 3,
                "context_max_tokens": 2000,
            },
            "agents": {
                "always_retrieve": False,
                "query_rewriting": {"enabled": False, "num_rewrites": 0},
                "detect_intents": ["question", "greeting", "chitchat"],
                "max_history_messages": 15,
                "memory_strategy": "sliding_window",
            },
        },
    },
    "legal_compliance": {
        "display_name_fr": "Juridique / Reglementaire",
        "display_name_en": "Legal / Compliance",
        "icon": "📜",
        "description_fr": "Contrats, lois et documents de conformite.",
        "description_en": "Contracts, laws and compliance content.",
        "config": {
            "ingestion": {
                "parsing": {
                    "engine": "auto",
                    "ocr_enabled": False,
                    "ocr_language": ["fra"],
                    "ocr_engine": "tesseract",
                    "table_extraction_strategy": "preserve",
                    "image_captioning_enabled": False,
                    "header_detection": True,
                },
                "preprocessing": {
                    "lowercase": False,
                    "remove_punctuation": False,
                    "normalize_unicode": True,
                    "remove_urls": False,
                    "language_detection": True,
                    "deduplication_strategy": "exact",
                    "deduplication_threshold": 0.98,
                },
            },
            "chunking": {
                "strategy": "recursive",
                "chunk_size": 1024,
                "chunk_overlap": 200,
                "min_chunk_size": 100,
                "max_chunk_size": 4000,
                "preserve_sentences": True,
                "metadata_propagation": True,
                "add_chunk_index": True,
                "add_document_title": True,
                "keep_separator": True,
                "separators": ["\n\n", "\n", ". "],
                "similarity_threshold": 0.7,
                "header_levels": [1, 2, 3, 4],
            },
            "embedding": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "batch_size": 50,
                "cache_enabled": True,
                "normalize": True,
            },
            "vector_store": {"provider": "qdrant", "mode": "persistent"},
            "retrieval": {
                "architecture": "hybrid_rerank",
                "semantic": {"top_k": 20, "weight": 0.5, "threshold": 0.0},
                "lexical": {
                    "enabled": True,
                    "top_k": 20,
                    "weight": 0.5,
                    "bm25_k1": 1.2,
                    "bm25_b": 0.5,
                },
                "hybrid": {"alpha": 0.4, "fusion_method": "rrf"},
            },
            "rerank": {
                "enabled": True,
                "provider": "cohere",
                "model": "rerank-v3.5",
                "top_n": 5,
                "candidates": 40,
                "relevance_threshold": 0.1,
            },
            "llm": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.0,
                "max_tokens": 3000,
                "top_p": 0.85,
                "cite_sources": True,
                "citation_format": "footnote",
                "admit_uncertainty": True,
                "response_language": "auto",
                "context_max_chunks": 8,
                "context_max_tokens": 8000,
            },
            "agents": {
                "always_retrieve": True,
                "query_rewriting": {"enabled": True, "num_rewrites": 2},
                "detect_intents": ["question", "clarification", "out_of_scope"],
                "max_history_messages": 10,
                "memory_strategy": "sliding_window",
            },
        },
    },
    "reports_analysis": {
        "display_name_fr": "Rapports & Analyses",
        "display_name_en": "Reports & Analysis",
        "icon": "📊",
        "description_fr": "Rapports financiers, etudes et analyses longues.",
        "description_en": "Financial reports and analytical narratives.",
        "config": {
            "ingestion": {
                "parsing": {
                    "engine": "auto",
                    "ocr_enabled": False,
                    "ocr_language": ["fra", "eng"],
                    "ocr_engine": "tesseract",
                    "table_extraction_strategy": "markdown",
                    "image_captioning_enabled": False,
                    "header_detection": True,
                },
                "preprocessing": {
                    "lowercase": False,
                    "remove_punctuation": False,
                    "normalize_unicode": True,
                    "remove_urls": False,
                    "language_detection": True,
                    "deduplication_strategy": "exact",
                    "deduplication_threshold": 0.95,
                },
            },
            "chunking": {
                "strategy": "paragraph_based",
                "chunk_size": 768,
                "chunk_overlap": 100,
                "min_chunk_size": 50,
                "max_chunk_size": 3000,
                "preserve_sentences": True,
                "metadata_propagation": True,
                "add_chunk_index": True,
                "add_document_title": True,
                "keep_separator": False,
                "separators": ["\n\n", "\n", ". ", " "],
                "similarity_threshold": 0.75,
                "header_levels": [1, 2, 3],
            },
            "embedding": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "batch_size": 100,
                "cache_enabled": True,
                "normalize": True,
            },
            "vector_store": {"provider": "qdrant", "mode": "persistent"},
            "retrieval": {
                "architecture": "hybrid",
                "semantic": {"top_k": 15, "weight": 0.6, "threshold": 0.0},
                "lexical": {
                    "enabled": True,
                    "top_k": 15,
                    "weight": 0.4,
                    "bm25_k1": 1.5,
                    "bm25_b": 0.75,
                },
                "hybrid": {"alpha": 0.6, "fusion_method": "rrf"},
            },
            "rerank": {
                "enabled": False,
                "provider": "none",
                "model": None,
                "top_n": None,
                "candidates": None,
                "relevance_threshold": None,
            },
            "llm": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "max_tokens": 2000,
                "top_p": 0.9,
                "cite_sources": True,
                "citation_format": "inline",
                "admit_uncertainty": True,
                "response_language": "auto",
                "context_max_chunks": 5,
                "context_max_tokens": 4000,
            },
            "agents": {
                "always_retrieve": False,
                "query_rewriting": {"enabled": True, "num_rewrites": 1},
                "detect_intents": ["question", "greeting", "out_of_scope"],
                "max_history_messages": 10,
                "memory_strategy": "sliding_window",
            },
        },
    },
    "general": {
        "display_name_fr": "Base generaliste",
        "display_name_en": "General purpose",
        "icon": "📚",
        "description_fr": "Profil equilibre pour contenus mixtes.",
        "description_en": "Balanced defaults for mixed content.",
        "config": {
            "ingestion": {
                "parsing": {
                    "engine": "auto",
                    "ocr_enabled": False,
                    "ocr_language": ["fra", "eng"],
                    "ocr_engine": "tesseract",
                    "table_extraction_strategy": "preserve",
                    "image_captioning_enabled": False,
                    "header_detection": True,
                },
                "preprocessing": {
                    "lowercase": False,
                    "remove_punctuation": False,
                    "normalize_unicode": True,
                    "remove_urls": False,
                    "language_detection": True,
                    "deduplication_strategy": "exact",
                    "deduplication_threshold": 0.9,
                },
            },
            "chunking": {
                "strategy": "fixed_size",
                "chunk_size": 512,
                "chunk_overlap": 50,
                "min_chunk_size": 30,
                "max_chunk_size": 2000,
                "preserve_sentences": True,
                "metadata_propagation": True,
                "add_chunk_index": True,
                "add_document_title": True,
                "keep_separator": False,
                "separators": ["\n\n", "\n", ". ", " "],
                "similarity_threshold": 0.75,
                "header_levels": [1, 2, 3],
            },
            "embedding": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "batch_size": 100,
                "cache_enabled": True,
                "normalize": True,
            },
            "vector_store": {"provider": "qdrant", "mode": "persistent"},
            "retrieval": {
                "architecture": "hybrid",
                "semantic": {"top_k": 10, "weight": 0.5, "threshold": 0.0},
                "lexical": {
                    "enabled": True,
                    "top_k": 10,
                    "weight": 0.5,
                    "bm25_k1": 1.5,
                    "bm25_b": 0.75,
                },
                "hybrid": {"alpha": 0.5, "fusion_method": "rrf"},
            },
            "rerank": {
                "enabled": False,
                "provider": "none",
                "model": None,
                "top_n": None,
                "candidates": None,
                "relevance_threshold": None,
            },
            "llm": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.7,
                "max_tokens": 2000,
                "top_p": 0.95,
                "cite_sources": True,
                "citation_format": "inline",
                "admit_uncertainty": True,
                "response_language": "auto",
                "context_max_chunks": 5,
                "context_max_tokens": 4000,
            },
            "agents": {
                "always_retrieve": False,
                "query_rewriting": {"enabled": True, "num_rewrites": 1},
                "detect_intents": ["question", "greeting", "chitchat", "out_of_scope"],
                "max_history_messages": 10,
                "memory_strategy": "sliding_window",
            },
        },
    },
}


def normalize_calibration_answers(raw_answers: dict[str, bool] | None) -> dict[str, bool]:
    normalized = dict(CALIBRATION_DEFAULTS)
    if not raw_answers:
        return normalized

    for key, value in raw_answers.items():
        canonical = CALIBRATION_ALIASES.get(key, key)
        if canonical in normalized:
            normalized[canonical] = bool(value)
    return normalized


def get_profile_metadata(profile_name: str, language: str = "fr") -> dict[str, str]:
    profile = PROFILE_REFERENTIAL[profile_name]
    if language.lower().startswith("en"):
        display_name = profile["display_name_en"]
        description = profile["description_en"]
    else:
        display_name = profile["display_name_fr"]
        description = profile["description_fr"]
    return {
        "profile_name": profile_name,
        "profile_display_name": display_name,
        "icon": profile["icon"],
        "description": description,
    }


def build_full_config(profile_name: str, calibration: dict[str, bool] | None = None) -> dict[str, Any]:
    full_config = deepcopy(PROFILE_REFERENTIAL[profile_name]["config"])
    calibration_answers = normalize_calibration_answers(calibration)

    parsing = full_config["ingestion"]["parsing"]
    chunking = full_config["chunking"]
    retrieval = full_config["retrieval"]
    rerank = full_config["rerank"]
    llm = full_config["llm"]
    agents = full_config["agents"]

    if calibration_answers["q1_tables_schemas"]:
        parsing["table_extraction_strategy"] = "markdown"
        parsing["ocr_enabled"] = True
        parsing["image_captioning_enabled"] = True

    if calibration_answers["q2_multi_document"]:
        retrieval["semantic"]["top_k"] += 10
        retrieval["lexical"]["top_k"] += 10
        llm["context_max_chunks"] += 3
        llm["context_max_tokens"] += 2000
        agents["query_rewriting"]["enabled"] = True

    if calibration_answers["q3_long_documents"]:
        chunking["chunk_size"] = int(round(chunking["chunk_size"] * 1.5))
        chunking["chunk_overlap"] = int(round(chunking["chunk_overlap"] * 1.5))
        chunking["max_chunk_size"] = int(round(chunking["max_chunk_size"] * 1.5))
        chunking["min_chunk_size"] = int(round(chunking["min_chunk_size"] * 2))

    if calibration_answers["q4_precision_needed"]:
        rerank["enabled"] = True
        if rerank.get("provider") in {None, "none"}:
            rerank["provider"] = "cohere"
            rerank["model"] = "rerank-v3.5"
            rerank["top_n"] = 5
            rerank["candidates"] = 40
            rerank["relevance_threshold"] = 0.0
        llm["temperature"] = min(float(llm["temperature"]), 0.1)
        retrieval["hybrid"]["alpha"] = max(0.1, float(retrieval["hybrid"]["alpha"]) - 0.15)
        retrieval["lexical"]["bm25_k1"] = float(retrieval["lexical"]["bm25_k1"]) + 0.3

    if calibration_answers["q5_frequent_updates"]:
        full_config["ingestion"]["mode"] = "auto"
        full_config["ingestion"]["auto_refresh_interval"] = "24h"
        full_config["ingestion"]["watch_enabled"] = True

    if calibration_answers["q6_citations_needed"]:
        chunking["add_chunk_index"] = True
        chunking["metadata_propagation"] = True
        chunking["add_document_title"] = True
        llm["cite_sources"] = True
        llm["citation_format"] = "footnote"

    return full_config


def build_config_summary(full_config: dict[str, Any]) -> dict[str, str]:
    chunking = full_config["chunking"]
    retrieval = full_config["retrieval"]
    llm = full_config["llm"]
    return {
        "chunking": f"{chunking['strategy']}, {chunking['chunk_size']} tokens",
        "retrieval": retrieval["architecture"],
        "temperature": f"{llm['temperature']}",
        "citations": "enabled" if llm.get("cite_sources") else "disabled",
        "citation_format": llm.get("citation_format", "inline"),
    }
