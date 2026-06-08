"""Best-effort download for NLTK resources used by lexical retrieval."""

from __future__ import annotations


def setup_nltk() -> None:
    try:
        import nltk

        resources = {
            "corpora/stopwords": "stopwords",
            "tokenizers/punkt": "punkt",
        }
        for resource_path, package in resources.items():
            try:
                nltk.data.find(resource_path)
            except LookupError:
                nltk.download(package, quiet=True)
    except Exception:
        # Lexical search still works with built-in fallback lists.
        return


if __name__ == "__main__":
    setup_nltk()
