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
    const isSuspicious = doc.title && (/^[^a-zA-Z0-9À-ÿ"']/.test(doc.title) || /bjbj/i.test(doc.title));
    if (isSuspicious) return 'error';
    if (doc.title && doc.author && doc.language) return 'complete';
    return 'partial';
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " Ko";
    return (bytes / 1024 / 1024).toFixed(1) + " Mo";
}

export function MetadataTable({ documents, onRefresh }: MetadataTableProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [search, setSearch] = useState("");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [sortField, setSortField] = useState<SortField>('filename');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);

    const fileTypes = useMemo(() => {
        const types = new Set(documents.map(d => d.file_type));
        return Array.from(types).sort();
    }, [documents]);

    const stats = useMemo(() => {
        const s = { complete: 0, partial: 0, error: 0, total: documents.length };
        documents.forEach(d => { s[getDocumentStatus(d)]++; });
        return s;
    }, [documents]);

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
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
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
                    <div className="flex gap-2 w-full sm:w-auto">
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
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs px-1 text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="font-medium">{stats.total}</span> documents
                    </div>
                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{stats.complete}</span> complets
                    </div>
                    <div className="flex items-center gap-1.5 text-orange-500 dark:text-orange-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{stats.partial}</span> partiels
                    </div>
                    <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{stats.error}</span> à vérifier
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                    <colgroup>
                        <col className="w-9" />
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "38%" }} />
                        <col className="w-16" />
                        <col className="w-24" />
                        <col className="w-20" />
                    </colgroup>
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                <span className="sr-only">Statut</span>
                            </th>
                            <SortHeader label="Fichier" field="filename" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Titre" field="title" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Langue" field="language" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Date" field="created" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                            <SortHeader label="Taille" field="file_size_bytes" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                        {paginatedDocs.map((doc) => {
                            const status = getDocumentStatus(doc);
                            return (
                                <tr
                                    key={doc.id}
                                    className="hover:bg-blue-50/50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedDoc(doc)}
                                >
                                    <td className="px-2 py-2 text-center">
                                        {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                                        {status === 'partial' && <Clock className="w-4 h-4 text-orange-400 mx-auto" />}
                                        {status === 'error' && <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />}
                                    </td>
                                    <td className="px-3 py-2 overflow-hidden" title={doc.filename}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
                                                {doc.file_type}
                                            </span>
                                            <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                                {doc.filename}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 overflow-hidden">
                                        <span
                                            className={`text-sm truncate block ${status === 'error'
                                                ? "text-orange-600 dark:text-orange-400 italic"
                                                : "text-gray-600 dark:text-gray-300"
                                                }`}
                                            title={doc.title || ""}
                                        >
                                            {doc.title || <span className="text-gray-300 dark:text-gray-600">—</span>}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        {doc.language ? (
                                            <span className="text-[11px] font-medium uppercase text-gray-600 dark:text-gray-400">
                                                {doc.language}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 dark:text-gray-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 text-right tabular-nums">
                                        {doc.creation_date ? new Date(doc.creation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                    </td>
                                    <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 text-right tabular-nums">
                                        {formatSize(doc.file_size_bytes)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1 text-sm">
                <div className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium">{(page - 1) * pageSize + 1}</span>–<span className="font-medium">{Math.min(page * pageSize, filteredDocs.length)}</span> sur <span className="font-medium">{filteredDocs.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 border rounded-md disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 border rounded-md disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
            className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
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
