import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChunkingConfig } from "./useChunkingConfig";

export interface ChunkPreviewItem {
    index: number;
    content: string;
    content_truncated: string;
    size_tokens: number;
    overlap_before?: string | null;
    overlap_before_tokens: number;
    overlap_after?: string | null;
    overlap_after_tokens: number;
    metadata: Record<string, any>;
}

export interface ChunkingPreviewResult {
    document_id: string;
    document_title?: string | null;
    config_used: ChunkingConfig;
    stats: {
        total_chunks: number;
        avg_size_tokens: number;
        min_size_tokens: number;
        max_size_tokens: number;
        median_size_tokens: number;
        total_overlap_tokens: number;
        size_distribution: Array<{ range_start: number; range_end: number; count: number }>;
    };
    chunks: ChunkPreviewItem[];
    processing_time_ms: number;
    warnings: string[];
}

export function useChunkingPreview() {
    const [preview, setPreview] = useState<ChunkingPreviewResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runPreview = async (documentId: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await invoke<ChunkingPreviewResult>("preview_chunking", { documentId });
            setPreview(res);
            return res;
        } catch (err: any) {
            setError(err.toString());
            return null;
        } finally {
            setLoading(false);
        }
    };

    const runPreviewCustom = async (documentId: string, config: ChunkingConfig) => {
        setLoading(true);
        setError(null);
        try {
            const res = await invoke<ChunkingPreviewResult>("preview_chunking_custom", { documentId, config });
            setPreview(res);
            return res;
        } catch (err: any) {
            setError(err.toString());
            return null;
        } finally {
            setLoading(false);
        }
    };

    return { preview, loading, error, runPreview, runPreviewCustom };
}
