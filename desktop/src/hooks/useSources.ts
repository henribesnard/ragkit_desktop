import { useState, useEffect, useCallback } from "react";
import { ipc } from "@/lib/ipc";

export interface SourceTypeInfo {
    type: string;
    registered: boolean;
}

export function useSources() {
    const [sources, setSources] = useState<any[]>([]);
    const [sourceTypes, setSourceTypes] = useState<SourceTypeInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSources = useCallback(async () => {
        setLoading(true);
        try {
            const res = await ipc.getSources();
            setSources(res || []);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSourceTypes = useCallback(async () => {
        try {
            const res = await ipc.getSourceTypes();
            setSourceTypes(res || []);
        } catch (err: any) {
            console.error("Failed to fetch source types:", err);
        }
    }, []);

    const addSource = async (source: any) => {
        try {
            const res = await ipc.addSource(source);
            setSources(prev => [...prev, res]);
            return res;
        } catch (err: any) {
            throw new Error(err.toString());
        }
    };

    const updateSource = async (id: string, source: any) => {
        try {
            const res = await ipc.updateSource(id, source);
            setSources(prev => prev.map(s => s.id === id ? res : s));
            return res;
        } catch (err: any) {
            throw new Error(err.toString());
        }
    };

    const deleteSource = async (id: string) => {
        try {
            await ipc.deleteSource(id);
            setSources(prev => prev.filter(s => s.id !== id));
            return true;
        } catch (err: any) {
            throw new Error(err.toString());
        }
    };

    const testConnection = async (id: string) => {
        try {
            return await ipc.testSourceConnection(id);
        } catch (err: any) {
            throw new Error(err.toString());
        }
    };

    const syncSource = async (id: string, incremental: boolean = false) => {
        try {
            return await ipc.syncSource(id, incremental);
        } catch (err: any) {
            throw new Error(err.toString());
        }
    };

    useEffect(() => {
        fetchSources();
        fetchSourceTypes();
    }, [fetchSources, fetchSourceTypes]);

    return {
        sources,
        sourceTypes,
        loading,
        error,
        fetchSources,
        addSource,
        updateSource,
        deleteSource,
        testConnection,
        syncSource
    };
}
