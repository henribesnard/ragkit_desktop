from __future__ import annotations

from ragkit.config.embedding_schema import EmbeddingProvider, ModelInfo

MODEL_CATALOG: dict[EmbeddingProvider, list[ModelInfo]] = {
    EmbeddingProvider.OPENAI: [
        ModelInfo(provider=EmbeddingProvider.OPENAI, id="text-embedding-3-small", display_name="text-embedding-3-small", dimensions_default=1536, dimensions_supported=[256,512,1024,1536], max_input_tokens=8191, pricing_hint="~$0.02/1M tokens", description="Bon rapport qualité/prix", local=False),
        ModelInfo(provider=EmbeddingProvider.OPENAI, id="text-embedding-3-large", display_name="text-embedding-3-large", dimensions_default=3072, dimensions_supported=[256,1024,3072], max_input_tokens=8191, pricing_hint="~$0.13/1M tokens", description="Précision maximale", local=False),
    ],
    EmbeddingProvider.OLLAMA: [
        ModelInfo(provider=EmbeddingProvider.OLLAMA, id="nomic-embed-text", display_name="nomic-embed-text", dimensions_default=768, description="Embedding local via Ollama", local=True),
    ],
    EmbeddingProvider.HUGGINGFACE: [
        ModelInfo(provider=EmbeddingProvider.HUGGINGFACE, id="sentence-transformers/all-MiniLM-L6-v2", display_name="all-MiniLM-L6-v2", dimensions_default=384, description="Modèle local léger", local=True),
        ModelInfo(provider=EmbeddingProvider.HUGGINGFACE, id="intfloat/multilingual-e5-base", display_name="multilingual-e5-base", dimensions_default=768, description="Bon multilingue", local=True),
    ],
    EmbeddingProvider.COHERE: [
        ModelInfo(provider=EmbeddingProvider.COHERE, id="embed-multilingual-v3.0", display_name="embed-multilingual-v3.0", dimensions_default=1024, description="API Cohere multilingue", local=False),
    ],
    EmbeddingProvider.VOYAGEAI: [
        ModelInfo(provider=EmbeddingProvider.VOYAGEAI, id="voyage-3-large", display_name="voyage-3-large", dimensions_default=1024, description="Haute qualité retrieval", local=False),
    ],
    EmbeddingProvider.MISTRAL: [
        ModelInfo(provider=EmbeddingProvider.MISTRAL, id="mistral-embed", display_name="mistral-embed", dimensions_default=1024, description="Embedding Mistral", local=False),
    ],
}


def get_model_info(provider: EmbeddingProvider, model_id: str) -> ModelInfo | None:
    for model in MODEL_CATALOG.get(provider, []):
        if model.id == model_id:
            return model
    return None
