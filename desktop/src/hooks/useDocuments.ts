import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface DocumentInfo {
    id: string;
    filename: string;
    title?: string;
    author?: string;
    language?: string;
    // Add other fields as needed
}

export function useDocuments() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

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
        setAnalyzing(true);
        try {
            await invoke("analyze_documents");
            await fetchDocuments();
        } catch (err) {
            console.error("Analysis failed:", err);
        } finally {
            setAnalyzing(false);
        }
    };

    useEffect(() => {
        // Fetch cached documents first; if empty, trigger analysis
        const init = async () => {
            setLoading(true);
            try {
                const res: any = await invoke("get_documents");
                setDocuments(res);
                if (!res || res.length === 0) {
                    // No cached documents - trigger initial analysis
                    setAnalyzing(true);
                    try {
                        await invoke("analyze_documents");
                        const updated: any = await invoke("get_documents");
                        setDocuments(updated);
                    } catch (err) {
                        console.error("Auto-analysis failed:", err);
                    } finally {
                        setAnalyzing(false);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    return { documents, loading, analyzing, fetchDocuments, analyzeDocuments };
}
