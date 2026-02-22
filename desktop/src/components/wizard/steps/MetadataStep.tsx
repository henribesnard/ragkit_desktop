import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2, CheckSquare, Settings2, Save, FileText } from "lucide-react";
import { ipc } from "@/lib/ipc";

interface TargetFileInfo {
    path: string;
    name: string;
    default_title?: string;
    default_author?: string;
}

export function MetadataStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const sourceCfg = state.config?.ingestion?.source || {};

    const overrides = sourceCfg.metadata_overrides || {};

    const [isLoading, setIsLoading] = useState(true);
    const [files, setFiles] = useState<TargetFileInfo[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [searchFilter, setSearchFilter] = useState("");

    const filteredFiles = files.filter(f => searchFilter ? f.name.toLowerCase().includes(searchFilter.toLowerCase()) : true);

    // Bulk edit fields state
    const [bulkForm, setBulkForm] = useState({
        tenant: "",
        domain: "",
        subdomain: "",
        author: "",
        tags: "",
        category: "",
        confidentiality: "",
        status: ""
    });

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            try {
                const data = await ipc.listTargetFiles(sourceCfg);
                setFiles(data);
            } catch (err) {
                console.error("Error fetching files:", err);
                setFiles([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceCfg.path, sourceCfg.recursive, sourceCfg.excluded_dirs, sourceCfg.file_types]);

    const handleSelectAll = () => {
        const allSelected = filteredFiles.length > 0 && filteredFiles.every(f => selectedPaths.has(f.path));
        const next = new Set(selectedPaths);
        if (allSelected) {
            filteredFiles.forEach(f => next.delete(f.path));
        } else {
            filteredFiles.forEach(f => next.add(f.path));
        }
        setSelectedPaths(next);
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
            if (bulkForm.tenant.trim()) current.tenant = bulkForm.tenant.trim();
            if (bulkForm.domain.trim()) current.domain = bulkForm.domain.trim();
            if (bulkForm.subdomain.trim()) current.subdomain = bulkForm.subdomain.trim();
            if (bulkForm.author.trim()) current.author = bulkForm.author.trim();

            // Convert tags from comma string to array if needed (in wizard we keep it as string or array, let's keep array in models)
            if (bulkForm.tags.trim()) {
                current.tags = bulkForm.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
            }
            if (bulkForm.category.trim()) current.category = bulkForm.category.trim();
            if (bulkForm.confidentiality.trim()) current.confidentiality = bulkForm.confidentiality.trim();
            if (bulkForm.status.trim()) current.status = bulkForm.status.trim();

            newOverrides[path] = current;
        });

        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source.metadata_overrides = newOverrides;
            return cfg;
        });

        // Reset bulk form
        setBulkForm({
            tenant: "", domain: "", subdomain: "", author: "", tags: "", category: "", confidentiality: "", status: ""
        });
    };

    const handleIndividualEdit = (path: string, field: string, value: any) => {
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

    const getSingleSelectedFile = () => {
        if (selectedPaths.size !== 1) return null;
        const path = Array.from(selectedPaths)[0];
        return files.find(f => f.path === path) || null;
    };

    const singleFile = getSingleSelectedFile();

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col">
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold">Configuration des Métadonnées</h2>
                <p className="text-sm text-gray-500 mt-2">
                    Vos métadonnées structurent votre base RAG. Sélectionnez un document pour modifier ses attributs individuels, ou plusieurs pour une édition en masse.
                </p>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">

                {/* Left side: Table */}
                <div className={`flex-1 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${selectedPaths.size > 0 ? 'lg:w-2/3' : 'w-full'}`}>
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <input
                            type="text"
                            placeholder="Filtrer par nom de fichier..."
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 gap-3">
                            <Loader2 className="w-5 h-5 animate-spin" /> Analyse des documents...
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">Aucun fichier trouvé avec ces critères.</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 w-10">
                                            <button onClick={handleSelectAll} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="Tout sélectionner">
                                                <CheckSquare className={`w-4 h-4 ${filteredFiles.length > 0 && filteredFiles.every(f => selectedPaths.has(f.path)) ? 'text-blue-500' : 'text-gray-400'}`} />
                                            </button>
                                        </th>
                                        <th className="p-3 font-semibold">Fichier</th>
                                        <th className="p-3 font-semibold w-48">Titre</th>
                                        <th className="p-3 font-semibold w-40">Auteur</th>
                                        <th className="p-3 font-semibold w-32">Domaine</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredFiles.map(f => {
                                        const fileOverrides = overrides[f.path] || {};
                                        const isSelected = selectedPaths.has(f.path);

                                        return (
                                            <tr
                                                key={f.path}
                                                onClick={() => handleToggleSelection(f.path)}
                                                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                            >
                                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelection(f.path)}
                                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 pointer-events-auto"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                                                        <span className="truncate max-w-[200px]" title={f.name}>{f.name}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate mt-0.5 max-w-[200px]" title={f.path}>{f.path}</div>
                                                </td>
                                                <td className="p-3 truncate max-w-[150px] text-gray-600 dark:text-gray-300" title={fileOverrides.title || f.name.replace(/\.[^/.]+$/, "")}>
                                                    {fileOverrides.title || <span className="text-gray-500 italic">{f.name.replace(/\.[^/.]+$/, "")}</span>}
                                                </td>
                                                <td className="p-3 truncate max-w-[120px] text-gray-600 dark:text-gray-300">
                                                    {fileOverrides.author || '-'}
                                                </td>
                                                <td className="p-3 truncate max-w-[100px] text-gray-600 dark:text-gray-300">
                                                    {fileOverrides.domain || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right side: Dynamic Edit Panel */}
                {selectedPaths.size > 0 && (
                    <div className="w-full lg:w-1/3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300 lg:sticky lg:top-6 self-start max-h-[calc(100vh-12rem)]">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-3">
                            <Settings2 className="w-5 h-5 text-blue-500" />
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {selectedPaths.size === 1 ? "Modifier le document" : "Édition en masse"}
                                </h3>
                                <p className="text-xs text-gray-500">{selectedPaths.size} élément(s) sélectionné(s)</p>
                            </div>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-4">

                            {/* Title (Only for single edit) */}
                            {selectedPaths.size === 1 && singleFile && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Titre</label>
                                    <input
                                        type="text"
                                        value={(overrides[singleFile.path] || {}).title || ""}
                                        onChange={e => handleIndividualEdit(singleFile.path, 'title', e.target.value)}
                                        placeholder={singleFile.name}
                                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}

                            {/* Common Fields */}
                            {[
                                { id: 'author', label: 'Auteur', placeholder: 'Ex: Jean Dupont' },
                                { id: 'tenant', label: 'Tenant (Organisation)', placeholder: 'Ex: Client A' },
                                { id: 'domain', label: 'Domaine', placeholder: 'Ex: Juridique' },
                                { id: 'subdomain', label: 'Sous-domaine', placeholder: 'Ex: Contrats' },
                                { id: 'category', label: 'Catégorie', placeholder: 'Ex: Factures' },
                            ].map(field => (
                                <div key={field.id}>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                                    <input
                                        type="text"
                                        value={selectedPaths.size === 1 ? ((overrides[singleFile?.path || ""] || {})[field.id] || "") : (bulkForm as any)[field.id]}
                                        onChange={e => {
                                            if (selectedPaths.size === 1 && singleFile) {
                                                handleIndividualEdit(singleFile.path, field.id, e.target.value);
                                            } else {
                                                setBulkForm({ ...bulkForm, [field.id]: e.target.value });
                                            }
                                        }}
                                        placeholder={field.placeholder}
                                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tags (séparés par des virgules)</label>
                                <input
                                    type="text"
                                    value={selectedPaths.size === 1 ? (((overrides[singleFile?.path || ""] || {}).tags || []).join(', ')) : bulkForm.tags}
                                    onChange={e => {
                                        if (selectedPaths.size === 1 && singleFile) {
                                            const arr = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                                            handleIndividualEdit(singleFile.path, 'tags', arr);
                                        } else {
                                            setBulkForm({ ...bulkForm, tags: e.target.value });
                                        }
                                    }}
                                    placeholder="important, Q3, finance"
                                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Confidentialité</label>
                                    <select
                                        value={selectedPaths.size === 1 ? ((overrides[singleFile?.path || ""] || {}).confidentiality || "") : bulkForm.confidentiality}
                                        onChange={e => {
                                            if (selectedPaths.size === 1 && singleFile) {
                                                handleIndividualEdit(singleFile.path, 'confidentiality', e.target.value);
                                            } else {
                                                setBulkForm({ ...bulkForm, confidentiality: e.target.value });
                                            }
                                        }}
                                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">- Non défini -</option>
                                        <option value="public">Publique</option>
                                        <option value="internal">Interne</option>
                                        <option value="confidential">Confidentiel</option>
                                        <option value="secret">Secret</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                    <select
                                        value={selectedPaths.size === 1 ? ((overrides[singleFile?.path || ""] || {}).status || "") : bulkForm.status}
                                        onChange={e => {
                                            if (selectedPaths.size === 1 && singleFile) {
                                                handleIndividualEdit(singleFile.path, 'status', e.target.value);
                                            } else {
                                                setBulkForm({ ...bulkForm, status: e.target.value });
                                            }
                                        }}
                                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">- Non défini -</option>
                                        <option value="draft">Brouillon</option>
                                        <option value="review">En relecture</option>
                                        <option value="published">Publié</option>
                                        <option value="archived">Archivé</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Bulk Apply Button - Form Action */}
                        {selectedPaths.size > 1 && (
                            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
                                <Button
                                    onClick={handleApplyBulk}
                                    className="w-full flex items-center justify-center gap-2 font-medium"
                                >
                                    <Save className="w-4 h-4" /> Appliquer à {selectedPaths.size} fichiers
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800 mt-6">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}

