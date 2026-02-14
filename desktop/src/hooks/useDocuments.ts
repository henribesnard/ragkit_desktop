import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface DocumentInfo {
    id: string;
    filename: string;
    file_path: string;
    file_type: string;
    file_size_bytes: number;
    title?: string;
    author?: string;
    language?: string;
    mime_type?: string;
    ingested_at?: string;
    page_count?: number;
    char_count?: number;
    width?: number;
    height?: number;
    has_tables?: boolean;
    has_images?: boolean;
    has_code?: boolean;
    tags?: string[];
    category?: string;
    parser_engine?: string;
    ocr_applied?: boolean;
    creation_date?: string;
    last_modified?: string;
    word_count?: number;
    description?: string;
    keywords?: string[];
    encoding?: string;
}

export interface AnalysisProgress {
    total: number;
    processed: number;
    current_file: string | null;
    errors: number;
    status: "idle" | "running" | "done" | "error";
    percent: number;
}

export function useDocuments() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState<AnalysisProgress | null>(null);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res: any = await invoke("get_documents");
            setDocuments(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const analyzeDocuments = async () => {
        try {
            await invoke("analyze_documents");
            setAnalyzing(true);
        } catch (err) {
            console.error("Analysis failed to start:", err);
            setAnalyzing(false);
        }
    };

    // Polling effect
    useEffect(() => {
        let interval: any;

        const checkProgress = async () => {
            try {
                const p: AnalysisProgress = await invoke("get_analysis_progress");
                setProgress(p);

                if (p.status === "running") {
                    if (!analyzing) setAnalyzing(true);
                } else if (p.status === "done") {
                    if (analyzing) {
                        setAnalyzing(false);
                        fetchDocuments();
                    }
                } else if (p.status === "error") {
                    if (analyzing) setAnalyzing(false);
                }
            } catch (err) {
                console.error("Progress check failed", err);
            }
        };

        // Check immediately on mount or when analyzing changes
        checkProgress();

        if (analyzing) {
            interval = setInterval(checkProgress, 500);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [analyzing]);

    useEffect(() => {
        fetchDocuments();
    }, []);

    return { documents, loading, analyzing, progress, fetchDocuments, analyzeDocuments };
}
