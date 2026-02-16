"""Token counting utility for chunking."""

from __future__ import annotations

import re


class TokenCounter:
    def __init__(self, encoding_name: str = "cl100k_base"):
        self._encoding_name = encoding_name
        self._encoder = None
        try:
            import tiktoken  # type: ignore

            self._encoder = tiktoken.get_encoding(encoding_name)
        except Exception:
            self._encoder = None

    def tokenize(self, text: str) -> list[str]:
        if self._encoder is not None:
            return [str(token) for token in self._encoder.encode(text)]
        return re.findall(r"\S+", text)

    def count(self, text: str) -> int:
        if not text:
            return 0
        if self._encoder is not None:
            return len(self._encoder.encode(text))
        return len(re.findall(r"\S+", text))

    def truncate(self, text: str, max_tokens: int) -> str:
        if max_tokens <= 0:
            return ""
        if self._encoder is not None:
            tokens = self._encoder.encode(text)
            if len(tokens) <= max_tokens:
                return text
            return self._encoder.decode(tokens[:max_tokens])
        words = re.findall(r"\S+", text)
        if len(words) <= max_tokens:
            return text
        return " ".join(words[:max_tokens])
