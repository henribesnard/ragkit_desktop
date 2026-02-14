import { DocumentInfo } from "@/hooks/useDocuments";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { MetadataDetailPanel } from "./MetadataDetailPanel";
import { invoke } from "@tauri-apps/api/core";

interface MetadataTableProps {
    documents: DocumentInfo[];
    onRefresh: () => void;
}

type SortField = 'filename' | 'title' | 'author' | 'file_type' | 'file_size_bytes' | 'created';
type SortDirection = 'asc' | 'desc';

export function MetadataTable({ documents, onRefresh }: MetadataTableProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [search, setSearch] = useState("");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [sortField, setSortField] = useState<SortField>('filename');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);

    // Derive unique file types
    const fileTypes = useMemo(() => {
        const types = new Set(documents.map(d => d.file_type));
        return Array.from(types).sort();
    }, [documents]);

    // Filter and Sort
    const filteredDocs = useMemo(() => {
        let result = documents;

        if (search) {
            const lower = search.toLowerCase();
            result = result.filter(d =>
                d.filename.toLowerCase().includes(lower) ||
                (d.title && d.title.toLowerCase().includes(lower)) ||
                (d.author && d.author.toLowerCase().includes(lower))
            );
        }

        if (selectedType !== "all") {
            result = result.filter(d => d.file_type === selectedType);
        }

        return result.sort((a, b) => {
            let valA: any = a[sortField as keyof DocumentInfo];
            let valB: any = b[sortField as keyof DocumentInfo];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [documents, search, selectedType, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(filteredDocs.length / pageSize);
    const paginatedDocs = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredDocs.slice(start, start + pageSize);
    }, [filteredDocs, page, pageSize]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleUpdateMetadata = async (id: string, updates: any) => {
        await invoke("update_document_metadata", { id, metadata: updates });
        onRefresh();
    };

    if (!documents || documents.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 italic bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                Aucun document analysé pour le moment.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full text-sm border-gray-200 dark:border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="text-sm border-gray-200 dark:border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 py-2 px-3"
                    >
                        <option value="all">Tous les types</option>
                        {fileTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>

                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="text-sm border-gray-200 dark:border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 py-2 px-3"
                    >
                        <option value="20">20 / page</option>
                        <option value="50">50 / page</option>
                        <option value="100">100 / page</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <SortHeader label="Fichier" field="filename" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Type" field="file_type" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Titre" field="title" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Auteur" field="author" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Taille" field="file_size_bytes" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Tags
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {paginatedDocs.map((doc) => (
                            <tr
                                key={doc.id}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                onClick={() => setSelectedDoc(doc)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={doc.filename}>
                                    {doc.filename}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 uppercase">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`}>
                                        {doc.file_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                    {doc.title || <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {doc.author || <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {(doc.file_size_bytes / 1024 / 1024).toFixed(2)} Mo
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex gap-1 overflow-hidden max-w-[200px]">
                                        {(doc.tags || doc.keywords || []).slice(0, 2).map(tag => (
                                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {tag}
                                            </span>
                                        ))}
                                        {(doc.tags || doc.keywords || []).length > 2 && (
                                            <span className="text-xs text-gray-400 self-center">+{(doc.tags || doc.keywords || []).length - 2}</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Affichage de <span className="font-medium">{(page - 1) * pageSize + 1}</span> à <span className="font-medium">{Math.min(page * pageSize, filteredDocs.length)}</span> sur <span className="font-medium">{filteredDocs.length}</span> résultats
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 border rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 border rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <MetadataDetailPanel
                document={selectedDoc}
                onClose={() => setSelectedDoc(null)}
                onSave={handleUpdateMetadata}
            />
        </div>
    );
}

function SortHeader({ label, field, currentSort, direction, onSort }: any) {
    return (
        <th
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {currentSort === field ? (
                    direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                )}
            </div>
        </th>
    );
}
