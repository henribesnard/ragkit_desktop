import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type ChunkingStrategy = "fixed_size" | "sentence_based" | "paragraph_based" | "semantic" | "recursive" | "markdown_header";

export interface ChunkingConfig {
    strategy: ChunkingStrategy;
    chunk_size: number;
    chunk_overlap: number;
    min_chunk_size: number;
    max_chunk_size: number;
    preserve_sentences: boolean;
    metadata_propagation: boolean;
    add_chunk_index: boolean;
    add_document_title: boolean;
    keep_separator: boolean;
    separators: string[];
    similarity_threshold: number;
    header_levels: number[];
}

const EMPTY_ERRORS: Record<string, string> = {};

export function useChunkingConfig() {
    const [config, setConfig] = useState<ChunkingConfig | null>(null);
    const [baselineConfig, setBaselineConfig] = useState<ChunkingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>(EMPTY_ERRORS);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await invoke<ChunkingConfig>("get_chunking_config");
            setConfig(res);
            setBaselineConfig(res);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const validateConfig = async (candidate: ChunkingConfig) => {
        try {
            const result: any = await invoke("validate_chunking_config", { config: candidate });
            setValidationWarnings(result.warnings || []);
            setValidationErrors(EMPTY_ERRORS);
            return true;
        } catch (err: any) {
            const message = String(err);
            const nextErrors: Record<string, string> = {};
            if (message.includes("chunk_overlap")) nextErrors.chunk_overlap = "Le chevauchement doit être inférieur à la taille des chunks.";
            if (message.includes("min_chunk_size")) nextErrors.min_chunk_size = "La taille minimale doit être ≤ taille des chunks.";
            if (message.includes("max_chunk_size")) nextErrors.max_chunk_size = "La taille maximale doit être ≥ taille des chunks.";
            setValidationErrors(nextErrors);
            return false;
        }
    };

    const updateConfig = async (patch: Partial<ChunkingConfig>) => {
        if (!config) return false;
        const merged = { ...config, ...patch };
        const valid = await validateConfig(merged);
        setConfig(merged);
        if (!valid) return false;

        try {
            const saved = await invoke<ChunkingConfig>("update_chunking_config", { config: merged });
            setConfig(saved);
            return true;
        } catch (err: any) {
            setError(err.toString());
            return false;
        }
    };

    const resetToProfile = async () => {
        const res = await invoke<ChunkingConfig>("reset_chunking_config");
        setConfig(res);
        setBaselineConfig(res);
        setValidationErrors(EMPTY_ERRORS);
        setValidationWarnings([]);
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const dirtyKeys = useMemo(() => {
        if (!config || !baselineConfig) return [] as string[];
        return Object.keys(config).filter((key) => JSON.stringify((config as any)[key]) !== JSON.stringify((baselineConfig as any)[key]));
    }, [config, baselineConfig]);

    return {
        config,
        loading,
        error,
        validationErrors,
        validationWarnings,
        dirtyKeys,
        isDirty: dirtyKeys.length > 0,
        fetchConfig,
        updateConfig,
        resetToProfile,
    };
}
