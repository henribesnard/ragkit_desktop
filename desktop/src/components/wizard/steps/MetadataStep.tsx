import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2, Database, Save, CheckSquare } from "lucide-react";

interface TargetFileInfo {
    path: string;
    name: string;
    extension: string;
}

export function MetadataStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const sourceCfg = state.config?.ingestion?.source || {};

    // Ensure metadata_overrides exists
    const overrides = sourceCfg.metadata_overrides || {};

    const [isLoading, setIsLoading] = useState(true);
    const [files, setFiles] = useState<TargetFileInfo[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

    // Bulk edit fields
    const [bulkAuthor, setBulkAuthor] = useState("");
    const [bulkDomain, setBulkDomain] = useState("");

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            try {
                // Using native fetch for the local python API.
                const resp = await fetch("http://127.0.0.1:8000/api/wizard/list-target-files", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ source: sourceCfg })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    setFiles(data);
                } else {
                    console.error("Failed to fetch target files:", resp.status);
                    setFiles([]);
                }
            } catch (err) {
                console.error("Error fetching files:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFiles();
    }, [sourceCfg.path, sourceCfg.recursive, sourceCfg.excluded_dirs, sourceCfg.file_types]);

    const handleSelectAll = () => {
        if (selectedPaths.size === files.length) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(files.map(f => f.path)));
        }
    };

    const handleToggleSelection = (path: string) => {
        const next = new Set(selectedPaths);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setSelectedPaths(next);
    };

    const handleApplyBulk = () => {
        if (selectedPaths.size === 0) return;

        const newOverrides = { ...overrides };
        selectedPaths.forEach(path => {
            const current = newOverrides[path] || {};
            if (bulkAuthor.trim()) current.author = bulkAuthor.trim();
            if (bulkDomain.trim()) current.domain = bulkDomain.trim();
            newOverrides[path] = current;
        });

        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source.metadata_overrides = newOverrides;
            return cfg;
        });

        setBulkAuthor("");
        setBulkDomain("");
    };

    const handleIndividualEdit = (path: string, field: string, value: string) => {
        const newOverrides = { ...overrides };
        const current = newOverrides[path] || {};
        current[field] = value;
        newOverrides[path] = current;

        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source.metadata_overrides = newOverrides;
            return cfg;
        });
    };

    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <h2 className="text-xl font-bold mb-6 text-center">Configuration des Métadonnées</h2>
                <p className="text-sm text-gray-500 text-center mb-8">
                    Vérifiez et complétez les métadonnées (Auteur, Domaine) des documents qui seront ingérés. Le titre sera par défaut le nom du fichier.
                </p>

                {/* Bulk Action Bar */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold mb-1">Auteur en masse</label>
                        <input
                            type="text"
                            placeholder="ex: Jean Dupont"
                            className="w-full text-sm rounded border border-gray-300 p-2 dark:bg-gray-900"
                            value={bulkAuthor}
                            onChange={e => setBulkAuthor(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold mb-1">Domaine en masse</label>
                        <input
                            type="text"
                            placeholder="ex: Juridique"
                            className="w-full text-sm rounded border border-gray-300 p-2 dark:bg-gray-900"
                            value={bulkDomain}
                            onChange={e => setBulkDomain(e.target.value)}
                        />
                    </div>
                    <Button
                        onClick={handleApplyBulk}
                        disabled={selectedPaths.size === 0 || (!bulkAuthor && !bulkDomain)}
                        className="flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Appliquer ({selectedPaths.size})
                    </Button>
                </div>

                {/* File List */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center text-gray-500 gap-3">
                            <Loader2 className="w-5 h-5 animate-spin" /> Chargement de l'arborescence...
                        </div>
                    ) : files.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Aucun fichier trouvé avec ces critères.</div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="p-3 w-10">
                                        <button onClick={handleSelectAll} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="Tout sélectionner">
                                            <CheckSquare className={`w-4 h-4 ${selectedPaths.size === files.length ? 'text-blue-500' : 'text-gray-400'}`} />
                                        </button>
                                    </th>
                                    <th className="p-3 font-semibold">Fichier</th>
                                    <th className="p-3 font-semibold">Titre Forcé</th>
                                    <th className="p-3 font-semibold w-48">Auteur</th>
                                    <th className="p-3 font-semibold w-48">Domaine</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {files.map(f => {
                                    const fileOverrides = overrides[f.path] || {};
                                    const isSelected = selectedPaths.has(f.path);

                                    return (
                                        <tr key={f.path} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelection(f.path)}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                    <Database className="w-3 h-3 text-gray-400" />
                                                    {f.name}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate mt-0.5" title={f.path}>{f.path}</div>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={fileOverrides.title || ""}
                                                    onChange={e => handleIndividualEdit(f.path, 'title', e.target.value)}
                                                    placeholder={f.name}
                                                    className="w-full px-2 py-1 text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 bg-transparent rounded"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={fileOverrides.author || ""}
                                                    onChange={e => handleIndividualEdit(f.path, 'author', e.target.value)}
                                                    placeholder="Auteur (optionnel)"
                                                    className="w-full px-2 py-1 text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 bg-transparent rounded"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={fileOverrides.domain || ""}
                                                    onChange={e => handleIndividualEdit(f.path, 'domain', e.target.value)}
                                                    placeholder="Domaine"
                                                    className="w-full px-2 py-1 text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 bg-transparent rounded"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800 mt-6">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
