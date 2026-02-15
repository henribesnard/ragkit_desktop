import { DocumentInfo } from "@/hooks/useDocuments";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, CheckCircle, Clock, FileText } from "lucide-react";
import { MetadataDetailPanel } from "./MetadataDetailPanel";
import { invoke } from "@tauri-apps/api/core";

interface MetadataTableProps {
    documents: DocumentInfo[];
    onRefresh: () => void;
}

type SortField = 'filename' | 'title' | 'author' | 'file_type' | 'file_size_bytes' | 'created' | 'language';
type SortDirection = 'asc' | 'desc';

function getDocumentStatus(doc: DocumentInfo): 'complete' | 'partial' | 'error' {
    // Check for suspicious title (starts with non-alphanumeric or contains "bjbj")
    const isSuspicious = doc.title && (/^[^a-zA-Z0-9À-ÿ"']/.test(doc.title) || /bjbj/i.test(doc.title));

    if (isSuspicious) return 'error';
    if (doc.title && doc.author && doc.language) return 'complete';
    return 'partial';
}

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

    const stats = useMemo(() => {
        const s = { complete: 0, partial: 0, error: 0, total: documents.length };
        documents.forEach(d => {
            s[getDocumentStatus(d)]++;
        });
        return s;
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
            <div className="flex flex-col gap-4 bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
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

                {/* Status Bar */}
                <div className="flex gap-4 text-xs px-2 pb-1 text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="font-medium">{stats.total}</span> documents
                    </div>
                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{stats.complete}</span> complets
                    </div>
                    <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{stats.partial}</span> partiels
                    </div>
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{stats.error}</span> à vérifier
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                                <div className="sr-only">Statut</div>
                            </th>
                            <SortHeader label="Fichier" field="filename" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Titre" field="title" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Langue" field="language" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Date" field="created" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Taille" field="file_size_bytes" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {paginatedDocs.map((doc) => {
                            const status = getDocumentStatus(doc);
                            const isTitleSuspicious = status === 'error'; // Simplified for now, can be more granular

                            return (
                                <tr
                                    key={doc.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                    onClick={() => setSelectedDoc(doc)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                        {status === 'partial' && <Clock className="w-4 h-4 text-orange-500" />}
                                        {status === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={doc.filename}>
                                        <div className="flex flex-col">
                                            <span>{doc.filename}</span>
                                            <span className="text-xs text-gray-400 uppercase">{doc.file_type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        <span className={isTitleSuspicious ? "text-orange-600 dark:text-orange-400 italic" : ""}>
                                            {doc.title || <span className="text-gray-300">-</span>}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {doc.language ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 uppercase">
                                                {doc.language}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {doc.creation_date ? new Date(doc.creation_date).toLocaleDateString() : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {(doc.file_size_bytes / 1024 / 1024).toFixed(2)} Mo
                                    </td>
                                </tr>
                            );
                        })}
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
                documents={filteredDocs}
                currentIndex={selectedDoc ? filteredDocs.indexOf(selectedDoc) : -1}
                onClose={() => setSelectedDoc(null)}
                onSave={handleUpdateMetadata}
                onNavigate={(index) => {
                    if (index >= 0 && index < filteredDocs.length) {
                        setSelectedDoc(filteredDocs[index]);
                    }
                }}
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
