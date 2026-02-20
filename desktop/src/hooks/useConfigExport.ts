import { useState } from "react";
import { ipc } from "@/lib/ipc";

export interface ImportPreview {
  version: string;
  export_date: string | null;
  profile: string | null;
  metadata: Record<string, any>;
}

export function useConfigExport() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportConfig = async (path: string) => {
    setExporting(true);
    setError(null);
    try {
      const result = await ipc.exportConfig(path) as any;
      return result.path as string;
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setExporting(false);
    }
  };

  const validateImport = async (path: string) => {
    setError(null);
    try {
      const result = await ipc.validateImport(path) as ImportPreview;
      setPreview(result);
      return result;
    } catch (err: any) {
      setError(String(err));
      throw err;
    }
  };

  const importConfig = async (path: string, mode: "replace" | "merge") => {
    setImporting(true);
    setError(null);
    try {
      await ipc.importConfig(path, mode);
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setImporting(false);
      setPreview(null);
    }
  };

  const exportConversation = async (format: "md" | "pdf", path: string) => {
    setExporting(true);
    setError(null);
    try {
      const result = await ipc.exportConversation(format, path) as any;
      return result.path as string;
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    importing,
    preview,
    error,
    exportConfig,
    validateImport,
    importConfig,
    exportConversation,
  };
}
