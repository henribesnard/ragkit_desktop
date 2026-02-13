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

    useEffect(() => {
        fetchDocuments();
    }, []);

    return { documents, loading, fetchDocuments };
}
