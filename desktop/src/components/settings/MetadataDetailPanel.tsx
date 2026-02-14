import { DocumentInfo } from "@/hooks/useDocuments";
import { X, Save, FileText, Image as ImageIcon, Table as TableIcon, Code } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";
interface MetadataDetailPanelProps {
    document: DocumentInfo | null;
    onClose: () => void;
    onSave: (id: string, updates: any) => Promise<void>;
}

export function MetadataDetailPanel({ document, onClose, onSave }: MetadataDetailPanelProps) {
    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [language, setLanguage] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [category, setCategory] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (document) {
            setTitle(document.title || "");
            setAuthor(document.author || "");
            setLanguage(document.language || "");
            setTags(document.tags || document.keywords || []);
            setCategory(document.category || "");
        }
    }, [document]);

    if (!document) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(document.id, {
                title,
                author,
                language,
                tags,
                category
            });
            onClose();
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

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Détail du document</h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            <div className="p-6 space-y-6">
                {/* Header Info */}
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate" title={document.filename}>
                            {document.filename}
                        </h4>
                        <p className="text-xs text-gray-500 truncate" title={document.file_path}>
                            {document.file_path}
                        </p>
                        <div className="flex gap-2 mt-1 text-xs text-gray-400">
                            <span className="uppercase">{document.file_type}</span>
                            <span>•</span>
                            <span>{document.file_size_bytes ? (document.file_size_bytes / 1024 / 1024).toFixed(2) + " Mo" : "?"}</span>
                        </div>
                    </div>
                </div>

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

                {/* Features Badges */}
                <div className="flex gap-2">
                    {document.has_tables && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700"><TableIcon className="w-3 h-3 mr-1" /> Tableaux</span>}
                    {document.has_images && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-pink-100 text-pink-700"><ImageIcon className="w-3 h-3 mr-1" /> Images</span>}
                    {document.has_code && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700"><Code className="w-3 h-3 mr-1" /> Code</span>}
                </div>

                {/* Editable Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre</label>
                        <input
                            type="text"
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auteur</label>
                            <input
                                type="text"
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Langue</label>
                            <input
                                type="text"
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
                        <input
                            type="text"
                            list="categories"
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Ex: Finance, Technique..."
                        />
                        <datalist id="categories">
                            <option value="Rapports" />
                            <option value="Technique" />
                            <option value="Juridique" />
                            <option value="RH" />
                        </datalist>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs text-gray-800 dark:text-gray-200">
                                    {tag}
                                    <button onClick={() => removeTag(tag)} className="ml-1 text-gray-400 hover:text-red-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm"
                            placeholder="Ajouter un tag puis Entrée..."
                            onKeyDown={handleAddTag}
                        />
                    </div>
                </div>

                {/* Technical Metadata */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">Informations techniques</h5>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div className="text-gray-500">Créé le</div>
                        <div className="text-right">{document.creation_date ? new Date(document.creation_date).toLocaleDateString() : "-"}</div>

                        <div className="text-gray-500">Modifié le</div>
                        <div className="text-right">{document.last_modified ? new Date(document.last_modified).toLocaleDateString() : "-"}</div>

                        <div className="text-gray-500">Indexé le</div>
                        <div className="text-right">{document.ingested_at ? new Date(document.ingested_at).toLocaleString() : "-"}</div>

                        <div className="text-gray-500">Moteur</div>
                        <div className="text-right">{document.parser_engine || "Auto"}</div>

                        <div className="text-gray-500">OCR appliqué</div>
                        <div className="text-right">{document.ocr_applied ? "Oui" : "Non"}</div>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 sticky bottom-0">
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Annuler
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
