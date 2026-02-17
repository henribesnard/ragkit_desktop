"""Best-effort download for NLTK resources used by lexical retrieval."""

from __future__ import annotations


def setup_nltk() -> None:
    try:
        import nltk

        nltk.download("stopwords", quiet=True)
        nltk.download("punkt", quiet=True)
    except Exception:
        # Lexical search still works with built-in fallback lists.
        return


if __name__ == "__main__":
    setup_nltk()
