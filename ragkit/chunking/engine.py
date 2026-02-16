"""Chunking engine — dispatches to strategy implementations."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod

from ragkit.chunking.tokenizer import TokenCounter
from ragkit.config.chunking_schema import Chunk, ChunkingConfig, ChunkingStrategy


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if part.strip()]


def apply_overlap(
    chunks: list[str],
    overlap_tokens: int,
    token_counter: TokenCounter,
    preserve_sentences: bool = False,
) -> list[str]:
    if overlap_tokens <= 0 or len(chunks) < 2:
        return chunks

    merged = [chunks[0]]
    for index in range(1, len(chunks)):
        overlap = ""
        if preserve_sentences:
            previous_sentences = split_sentences(chunks[index - 1])
            selected: list[str] = []
            tokens = 0
            for sentence in reversed(previous_sentences):
                sentence_tokens = token_counter.count(sentence)
                if selected and tokens + sentence_tokens > overlap_tokens:
                    break
                selected.insert(0, sentence)
                tokens += sentence_tokens
            overlap = " ".join(selected).strip()
        else:
            previous_words = chunks[index - 1].split()
            overlap = " ".join(previous_words[-overlap_tokens:]) if previous_words else ""

        current = chunks[index]
        if overlap and not current.startswith(overlap):
            current = f"{overlap} {current}".strip()
        if preserve_sentences and token_counter.count(current) > token_counter.count(chunks[index]) + overlap_tokens:
            # Keep sentence integrity: drop overlap instead of truncating mid-sentence.
            current = chunks[index]
        elif token_counter.count(current) > token_counter.count(chunks[index]) + overlap_tokens:
            current = token_counter.truncate(current, token_counter.count(chunks[index]) + overlap_tokens)
        merged.append(current)
    return merged


class BaseChunker(ABC):
    def __init__(self, config: ChunkingConfig):
        self.config = config
        self.token_counter = TokenCounter()

    @abstractmethod
    def split(self, text: str) -> list[str]:
        ...

    def chunk(self, text: str, metadata: dict) -> list[Chunk]:
        raw_chunks = self.split(text)
        raw_chunks = [chunk.strip() for chunk in raw_chunks if chunk and chunk.strip()]
        raw_chunks = apply_overlap(
            raw_chunks,
            self.config.chunk_overlap,
            self.token_counter,
            preserve_sentences=self.config.preserve_sentences,
        )

        filtered: list[str] = []
        for chunk in raw_chunks:
            token_count = self.token_counter.count(chunk)
            if token_count < self.config.min_chunk_size and filtered:
                filtered[-1] = f"{filtered[-1]} {chunk}".strip()
            else:
                filtered.append(chunk)

        chunks: list[Chunk] = []
        for index, chunk_text in enumerate(filtered):
            token_count = self.token_counter.count(chunk_text)
            chunk_metadata = dict(metadata) if self.config.metadata_propagation else {}
            if self.config.add_chunk_index:
                chunk_metadata["chunk_index"] = index
            chunks.append(Chunk(content=chunk_text, tokens=token_count, metadata=chunk_metadata))
        return chunks


class FixedSizeChunker(BaseChunker):
    def split(self, text: str) -> list[str]:
        if self.config.preserve_sentences:
            sentences = split_sentences(text)
            if sentences:
                chunks: list[str] = []
                current: list[str] = []
                for sentence in sentences:
                    candidate = " ".join(current + [sentence]).strip()
                    if current and self.token_counter.count(candidate) > self.config.chunk_size:
                        chunks.append(" ".join(current).strip())
                        current = [sentence]
                    else:
                        current.append(sentence)
                if current:
                    chunks.append(" ".join(current).strip())
                return chunks

        words = text.split()
        if not words:
            return []

        stride = max(1, self.config.chunk_size - self.config.chunk_overlap)
        chunks: list[str] = []
        start = 0
        while start < len(words):
            end = min(len(words), start + self.config.chunk_size)
            current_words = words[start:end]
            chunk = " ".join(current_words)
            chunks.append(chunk)
            start += stride
        return chunks


class SentenceBasedChunker(BaseChunker):
    def split(self, text: str) -> list[str]:
        sentences = split_sentences(text)
        if not sentences:
            return []

        chunks: list[str] = []
        current: list[str] = []
        for sentence in sentences:
            candidate = " ".join(current + [sentence]).strip()
            if current and self.token_counter.count(candidate) > self.config.chunk_size:
                chunks.append(" ".join(current).strip())
                current = [sentence]
            else:
                current.append(sentence)

        if current:
            chunks.append(" ".join(current).strip())
        return chunks


class ParagraphBasedChunker(BaseChunker):
    def split(self, text: str) -> list[str]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
        if not paragraphs:
            return []

        chunks: list[str] = []
        current: list[str] = []
        for paragraph in paragraphs:
            if self.token_counter.count(paragraph) > self.config.max_chunk_size:
                nested = SentenceBasedChunker(self.config).split(paragraph)
                chunks.extend(nested)
                continue

            candidate = "\n\n".join(current + [paragraph]).strip()
            if current and self.token_counter.count(candidate) > self.config.chunk_size:
                chunks.append("\n\n".join(current).strip())
                current = [paragraph]
            else:
                current.append(paragraph)

        if current:
            chunks.append("\n\n".join(current).strip())
        return chunks


class SemanticChunker(BaseChunker):
    def split(self, text: str) -> list[str]:
        # Lightweight approximation: similarity based on Jaccard overlap of adjacent sentence word-sets.
        sentences = split_sentences(text)
        if not sentences:
            return []

        groups: list[list[str]] = [[sentences[0]]]

        for sentence in sentences[1:]:
            previous_sentence = groups[-1][-1]
            prev_set = {word.lower() for word in re.findall(r"\w+", previous_sentence)}
            curr_set = {word.lower() for word in re.findall(r"\w+", sentence)}
            union = prev_set | curr_set
            similarity = 1.0 if not union else len(prev_set & curr_set) / len(union)

            candidate = " ".join(groups[-1] + [sentence])
            if similarity < self.config.similarity_threshold or self.token_counter.count(candidate) > self.config.max_chunk_size:
                groups.append([sentence])
            else:
                groups[-1].append(sentence)

        return [" ".join(group).strip() for group in groups if group]


class RecursiveChunker(BaseChunker):
    def _split_recursive(self, text: str, separators: list[str]) -> list[str]:
        if self.token_counter.count(text) <= self.config.chunk_size:
            return [text.strip()]
        if not separators:
            return FixedSizeChunker(self.config).split(text)

        separator = separators[0]
        segments = text.split(separator)
        if len(segments) == 1:
            return self._split_recursive(text, separators[1:])

        results: list[str] = []
        for segment in segments:
            piece = segment if not self.config.keep_separator else f"{separator}{segment}" if segment else ""
            piece = piece.strip()
            if not piece:
                continue
            if self.token_counter.count(piece) <= self.config.chunk_size:
                results.append(piece)
            else:
                results.extend(self._split_recursive(piece, separators[1:]))
        return results

    def split(self, text: str) -> list[str]:
        return self._split_recursive(text, self.config.separators)


class MarkdownHeaderChunker(BaseChunker):
    def split(self, text: str) -> list[str]:
        lines = text.splitlines()
        if not lines:
            return []

        chunks: list[str] = []
        current: list[str] = []
        header_pattern = re.compile(r"^(#{1,6})\s+(.+)$")

        for line in lines:
            match = header_pattern.match(line.strip())
            if match and len(match.group(1)) in self.config.header_levels:
                if current:
                    chunks.append("\n".join(current).strip())
                current = [line]
            else:
                current.append(line)

        if current:
            chunks.append("\n".join(current).strip())

        expanded: list[str] = []
        paragraph_chunker = ParagraphBasedChunker(self.config)
        for chunk in chunks:
            if self.token_counter.count(chunk) > self.config.max_chunk_size:
                expanded.extend(paragraph_chunker.split(chunk))
            else:
                expanded.append(chunk)
        return expanded


CHUNKER_REGISTRY: dict[ChunkingStrategy, type[BaseChunker]] = {
    ChunkingStrategy.FIXED_SIZE: FixedSizeChunker,
    ChunkingStrategy.SENTENCE_BASED: SentenceBasedChunker,
    ChunkingStrategy.PARAGRAPH_BASED: ParagraphBasedChunker,
    ChunkingStrategy.SEMANTIC: SemanticChunker,
    ChunkingStrategy.RECURSIVE: RecursiveChunker,
    ChunkingStrategy.MARKDOWN_HEADER: MarkdownHeaderChunker,
}


def create_chunker(config: ChunkingConfig) -> BaseChunker:
    return CHUNKER_REGISTRY[config.strategy](config)
