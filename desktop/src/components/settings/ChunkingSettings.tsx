import { useMemo, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDocuments } from "@/hooks/useDocuments";
import { ChunkingConfig, useChunkingConfig } from "@/hooks/useChunkingConfig";
import { useChunkingPreview } from "@/hooks/useChunkingPreview";
import { SizeDistributionChart } from "@/components/charts/SizeDistributionChart";

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
    fixed_size: "Découpe en fenêtres fixes de tokens.",
    sentence_based: "Regroupe des phrases entières jusqu'à la taille cible.",
    paragraph_based: "Découpe par paragraphes et regroupe selon la taille cible.",
    semantic: "Découpe basée sur les changements de sujet entre phrases.",
    recursive: "Découpe récursivement avec une liste de séparateurs.",
    markdown_header: "Découpe selon la hiérarchie des titres Markdown.",
};

function ModifiedBadge({ dirty }: { dirty: boolean }) {
    return dirty ? <Badge className="ml-2" variant="default">Modifié</Badge> : null;
}

function isDirty(dirtyKeys: string[], key: keyof ChunkingConfig) {
    return dirtyKeys.includes(key);
}

export function ChunkingSettings() {
    const {
        config,
        loading,
        error,
        validationErrors,
        validationWarnings,
        dirtyKeys,
        isDirty: formDirty,
        updateConfig,
        resetToProfile,
    } = useChunkingConfig();

    const { documents, fetchDocuments } = useDocuments();
    const { preview, loading: previewLoading, error: previewError, runPreviewCustom } = useChunkingPreview();

    const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
    const [chunkPage, setChunkPage] = useState(0);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const moveSeparator = (index: number, direction: -1 | 1) => {
        if (!config) return;
        const target = index + direction;
        if (target < 0 || target >= config.separators.length) return;
        const next = [...config.separators];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        void updateConfig({ separators: next });
    };

    const pagedChunks = useMemo(() => {
        const chunks = preview?.chunks ?? [];
        const start = chunkPage * 2;
        return chunks.slice(start, start + 2);
    }, [preview, chunkPage]);

    if (loading || !config) return <div>Chargement de la configuration de chunking...</div>;
    if (error) return <div className="text-red-500">Erreur: {error}</div>;

    const handlePreview = async () => {
        const documentId = selectedDocumentId || documents?.[0]?.id;
        if (!documentId) return;
        setChunkPage(0);
        await runPreviewCustom(documentId, config);
    };

    return (
        <div className="space-y-6">
            <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Stratégie de découpage</h3>
                <Select
                    value={config.strategy}
                    onChange={(e) => updateConfig({ strategy: e.target.value as any })}
                    options={Object.keys(STRATEGY_DESCRIPTIONS).map((strategy) => ({
                        value: strategy,
                        label: strategy,
                    }))}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">{STRATEGY_DESCRIPTIONS[config.strategy]}</p>
            </section>

            {config.strategy !== "markdown_header" && (
                <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Paramètres de taille</h3>
                    <div>
                        <Slider value={config.chunk_size} min={64} max={4096} onChange={(v) => updateConfig({ chunk_size: v })} label="Taille des chunks" formatValue={(v) => `${v} tokens`} />
                        <ModifiedBadge dirty={isDirty(dirtyKeys, "chunk_size")} />
                    </div>
                    <div>
                        <Slider value={config.chunk_overlap} min={0} max={Math.max(0, Math.floor(config.chunk_size / 2))} onChange={(v) => updateConfig({ chunk_overlap: v })} label="Chevauchement" formatValue={(v) => `${v} tokens`} />
                        {validationErrors.chunk_overlap && <p className="text-sm text-red-500">{validationErrors.chunk_overlap}</p>}
                        <ModifiedBadge dirty={isDirty(dirtyKeys, "chunk_overlap")} />
                    </div>
                    <div>
                        <Slider value={config.min_chunk_size} min={10} max={config.chunk_size} onChange={(v) => updateConfig({ min_chunk_size: v })} label="Taille minimale" formatValue={(v) => `${v} tokens`} />
                        {validationErrors.min_chunk_size && <p className="text-sm text-red-500">{validationErrors.min_chunk_size}</p>}
                    </div>
                    <div>
                        <Slider value={config.max_chunk_size} min={config.chunk_size} max={8192} onChange={(v) => updateConfig({ max_chunk_size: v })} label="Taille maximale" formatValue={(v) => `${v} tokens`} />
                        {validationErrors.max_chunk_size && <p className="text-sm text-red-500">{validationErrors.max_chunk_size}</p>}
                    </div>
                </section>
            )}

            <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Options avancées</h3>
                <Toggle checked={config.preserve_sentences} onChange={(v) => updateConfig({ preserve_sentences: v })} label="Préserver les phrases" />
                <Toggle checked={config.metadata_propagation} onChange={(v) => updateConfig({ metadata_propagation: v })} label="Propager les métadonnées" />
                <Toggle checked={config.add_chunk_index} onChange={(v) => updateConfig({ add_chunk_index: v })} label="Ajouter l'index du chunk" />
                <Toggle checked={config.add_document_title} onChange={(v) => updateConfig({ add_document_title: v })} label="Ajouter le titre du document" />
                <Toggle checked={config.keep_separator} onChange={(v) => updateConfig({ keep_separator: v })} label="Conserver les séparateurs" />
            </section>

            {config.strategy === "recursive" && (
                <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Séparateurs</h3>
                    <div className="space-y-2">
                        {config.separators.map((separator, index) => (
                            <div
                                key={`${separator}-${index}`}
                                draggable
                                onDragStart={() => setDragIndex(index)}
                                onDragEnd={() => setDragIndex(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                    if (dragIndex === null || dragIndex === index || !config) return;
                                    const next = [...config.separators];
                                    const [item] = next.splice(dragIndex, 1);
                                    next.splice(index, 0, item);
                                    setDragIndex(null);
                                    void updateConfig({ separators: next });
                                }}
                                className="flex items-center justify-between gap-2 rounded bg-gray-100 dark:bg-gray-800 px-2 py-1 cursor-move"
                            >
                                <div className="text-xs">{JSON.stringify(separator)}</div>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="outline" onClick={() => moveSeparator(index, -1)} disabled={index === 0}>↑</Button>
                                    <Button size="sm" variant="outline" onClick={() => moveSeparator(index, 1)} disabled={index === config.separators.length - 1}>↓</Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            const next = config.separators.filter((_, i) => i !== index);
                                            if (next.length) {
                                                void updateConfig({ separators: next });
                                            }
                                        }}
                                        disabled={config.separators.length <= 1}
                                    >
                                        Supprimer
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateConfig({ separators: [...config.separators, "---"] })}>+ Ajouter ---</Button>
                        <Button size="sm" variant="outline" onClick={() => updateConfig({ separators: ["\n\n", "\n", ". ", " "] })}>↻ Réinitialiser</Button>
                    </div>
                </section>
            )}

            {config.strategy === "semantic" && (
                <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                    <Slider value={config.similarity_threshold} min={0.1} max={1} step={0.01} onChange={(v) => updateConfig({ similarity_threshold: v })} label="Seuil de similarité" formatValue={(v) => v.toFixed(2)} />
                    <p className="text-xs text-amber-700 dark:text-amber-300">La stratégie sémantique utilise un mode léger pour la prévisualisation.</p>
                </section>
            )}

            {config.strategy === "markdown_header" && (
                <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                    <label className="text-sm font-medium">Niveaux de titres</label>
                    <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5, 6].map((level) => {
                            const active = config.header_levels.includes(level);
                            return (
                                <button
                                    key={level}
                                    className={`px-3 py-1 rounded text-sm border ${active ? "bg-blue-50 border-blue-400 text-blue-700" : "border-gray-300"}`}
                                    onClick={() => {
                                        const next = active
                                            ? config.header_levels.filter((v) => v !== level)
                                            : [...config.header_levels, level];
                                        updateConfig({ header_levels: next.length ? next : [1] });
                                    }}
                                >
                                    H{level}
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <Select
                        className="min-w-64"
                        value={selectedDocumentId || documents?.[0]?.id || ""}
                        onChange={(e) => setSelectedDocumentId(e.target.value)}
                        options={(documents || []).map((doc: any) => ({ value: doc.id, label: doc.filename }))}
                    />
                    <Button variant="outline" size="icon" onClick={fetchDocuments}><RefreshCw className="w-4 h-4" /></Button>
                    <Button onClick={handlePreview} disabled={previewLoading || Object.keys(validationErrors).length > 0}>
                        {previewLoading ? "Prévisualisation..." : "Prévisualiser le chunking"}
                    </Button>
                </div>

                {validationWarnings.map((warning) => <p key={warning} className="text-sm text-amber-600">⚠ {warning}</p>)}
                {previewError && <p className="text-sm text-red-600">{previewError}</p>}
                {!documents?.length && <p className="text-sm text-gray-500">Aucun document disponible. Complétez l'étape 1.</p>}

                {preview && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">Total: <b>{preview.stats.total_chunks}</b></div>
                            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">Moyenne: <b>{preview.stats.avg_size_tokens}</b></div>
                            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">Min: <b>{preview.stats.min_size_tokens}</b></div>
                            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">Max: <b>{preview.stats.max_size_tokens}</b></div>
                        </div>

                        {preview.warnings.map((warning) => <p key={warning} className="text-sm text-amber-600">⚠ {warning}</p>)}

                        <div className="space-y-3">
                            {pagedChunks.map((chunk) => (
                                <article key={chunk.index} className="border rounded-lg p-3">
                                    <div className="text-sm font-medium mb-2">Chunk {chunk.index + 1}/{preview.chunks.length} · {chunk.size_tokens} tokens</div>
                                    {chunk.overlap_before && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded text-xs mb-2">
                                            {chunk.overlap_before}
                                            <div className="mt-1 text-amber-700 dark:text-amber-300">↔ Chevauchement : {chunk.overlap_before_tokens} tokens</div>
                                        </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap">{chunk.content_truncated}</p>
                                    <pre className="text-xs text-gray-500 mt-2 overflow-x-auto">{JSON.stringify(chunk.metadata, null, 2)}</pre>
                                </article>
                            ))}
                        </div>
                        <div className="flex justify-between">
                            <Button variant="outline" disabled={chunkPage === 0} onClick={() => setChunkPage((v) => Math.max(0, v - 1))}>Précédent</Button>
                            <Button variant="outline" disabled={(chunkPage + 1) * 2 >= preview.chunks.length} onClick={() => setChunkPage((v) => v + 1)}>Suivant</Button>
                        </div>

                        <section className="space-y-2">
                            <h4 className="font-medium">Distribution des tailles (bucket=50)</h4>
                            <SizeDistributionChart buckets={preview.stats.size_distribution} />
                        </section>
                    </>
                )}
            </section>

            <div className="flex items-center justify-end">
                <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    disabled={!formDirty}
                    onClick={() => {
                        if (confirm("⚠️ Réinitialiser les paramètres de chunking aux valeurs du profil actif ? Les modifications manuelles seront perdues.")) {
                            resetToProfile();
                        }
                    }}
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Réinitialiser au profil
                </Button>
            </div>
        </div>
    );
}
