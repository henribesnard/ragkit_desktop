import { DocumentInfo } from "@/hooks/useDocuments";
import { X, Save, FileText, Image as ImageIcon, Table as TableIcon, Code, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";

interface MetadataDetailPanelProps {
    document: DocumentInfo | null;
    documents: DocumentInfo[];
    currentIndex: number;
    onClose: () => void;
    onSave: (id: string, updates: any) => Promise<void>;
    onNavigate: (index: number) => void;
}

export function MetadataDetailPanel({ document, documents, currentIndex, onClose, onSave, onNavigate }: MetadataDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<'metadata' | 'preview'>('metadata');
    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [description, setDescription] = useState("");
    const [language, setLanguage] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [category, setCategory] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (document) {
            setTitle(document.title || "");
            setAuthor(document.author || "");
            setDescription(document.description || "");
            setLanguage(document.language || "");
            setTags(document.tags || []);
            setKeywords(document.keywords || []);
            setCategory(document.category || "");
            setActiveTab('metadata');
        }
    }, [document]);

    if (!document) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(document.id, {
                title,
                author,
                description,
                language,
                tags,
                category
            });
            // Don't close, user might want to continue navigating
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const val = (e.target as HTMLInputElement).value.trim();
            if (val && !tags.includes(val)) {
                setTags([...tags, val]);
                (e.target as HTMLInputElement).value = "";
            }
        }
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < documents.length - 1;

    return (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
            {/* Header with Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onNavigate(currentIndex - 1)}
                        disabled={!hasPrevious}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Document précédent"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs text-gray-500 font-medium">
                        {currentIndex + 1} / {documents.length}
                    </span>
                    <button
                        onClick={() => onNavigate(currentIndex + 1)}
                        disabled={!hasNext}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Document suivant"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1">
                        <button
                            onClick={() => setActiveTab('metadata')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'metadata' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Métadonnées
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'preview' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Aperçu & Tech
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Global File Info Header */}
                <div className="flex items-start gap-3 mb-6">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
                        <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex gap-2 mb-1">
                            <input
                                type="text"
                                className="block w-full text-lg font-semibold bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-0 py-0 text-gray-900 dark:text-white truncate"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Titre du document"
                                title={title}
                            />
                        </div>
                        <p className="text-xs text-gray-500 truncate" title={document.filename}>{document.filename}</p>
                        <div className="flex gap-2 mt-1 text-xs text-gray-400">
                            <span className="uppercase">{document.file_type}</span>
                            <span>•</span>
                            <span>{document.file_size_bytes ? (document.file_size_bytes / 1024 / 1024).toFixed(2) + " Mo" : "?"}</span>
                        </div>
                    </div>
                </div>

                {/* Features Badges */}
                <div className="flex gap-2 mb-6">
                    {document.has_tables && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"><TableIcon className="w-3 h-3 mr-1" /> Tableaux</span>}
                    {document.has_images && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"><ImageIcon className="w-3 h-3 mr-1" /> Images</span>}
                    {document.has_code && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"><Code className="w-3 h-3 mr-1" /> Code</span>}
                </div>

                {activeTab === 'metadata' ? (
                    <div className="space-y-6">
                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Résumé ou description du document..."
                            />
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auteur</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={author}
                                    onChange={(e) => setAuthor(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Langue</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    list="categories"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="Sélectionner ou saisir..."
                                />
                                <datalist id="categories">
                                    <option value="Rapports" />
                                    <option value="Technique" />
                                    <option value="Juridique" />
                                    <option value="RH" />
                                    <option value="Finance" />
                                    <option value="Marketing" />
                                </datalist>
                            </div>
                        </div>

                        {/* Tags & Keywords */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags (Manuels)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {tags.map(tag => (
                                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="ml-1 text-blue-400 hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ajouter un tag puis Entrée..."
                                    onKeyDown={handleAddTag}
                                />
                            </div>

                            {keywords.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Mots-clés (Auto)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.map(k => (
                                            <span key={k} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs border border-gray-200 dark:border-gray-700">
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Content Stats */}
                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-100 dark:border-gray-800">
                            <div className="text-center">
                                <div className="text-xs text-gray-500">Pages</div>
                                <div className="font-medium">{document.page_count ?? "-"}</div>
                            </div>
                            <div className="text-center border-l border-gray-100 dark:border-gray-800">
                                <div className="text-xs text-gray-500">Mots</div>
                                <div className="font-medium">{document.word_count ?? "-"}</div>
                            </div>
                            <div className="text-center border-l border-gray-100 dark:border-gray-800">
                                <div className="text-xs text-gray-500">Caractères</div>
                                <div className="font-medium">{document.char_count ?? "-"}</div>
                            </div>
                        </div>

                        {/* Text Preview */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aperçu du texte</label>
                            <div className="w-full h-64 p-3 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-y-auto text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {document.text_preview || <span className="italic text-gray-400">Aucun aperçu disponible</span>}
                            </div>
                        </div>

                        {/* Technical Metadata */}
                        <div>
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">Informations techniques</h5>
                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                                <div className="text-gray-500">Créé le</div>
                                <div className="text-right">{document.creation_date ? new Date(document.creation_date).toLocaleDateString() : "-"}</div>

                                <div className="text-gray-500">Modifié le</div>
                                <div className="text-right">{document.last_modified ? new Date(document.last_modified).toLocaleDateString() : "-"}</div>

                                <div className="text-gray-500">Indexé le</div>
                                <div className="text-right">{document.ingested_at ? new Date(document.ingested_at).toLocaleString() : "-"}</div>

                                <div className="text-gray-500">Moteur du parsing</div>
                                <div className="text-right font-mono">{document.parser_engine || "Auto"}</div>

                                <div className="text-gray-500">OCR appliqué</div>
                                <div className="text-right">{document.ocr_applied ? "Oui" : "Non"}</div>

                                <div className="text-gray-500">Images détectées</div>
                                <div className="text-right">{document.has_images ? "Oui" : "Non"}</div>

                                <div className="text-gray-500">Tableaux détectés</div>
                                <div className="text-right">{document.has_tables ? "Oui" : "Non"}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Fermer
                    </Button>
                    <Button className="flex-1" onClick={handleSave} disabled={saving}>
                        {saving ? "Sauvegarde..." : "Sauvegarder"}
                        <Save className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
