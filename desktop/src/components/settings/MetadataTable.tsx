import { DocumentInfo } from "@/hooks/useDocuments";

interface MetadataTableProps {
    documents: DocumentInfo[];
}

export function MetadataTable({ documents }: MetadataTableProps) {
    if (!documents || documents.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 italic bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                Aucun document analysé pour le moment.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fichier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Titre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auteur</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Langue</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                    {documents.map((doc) => (
                        <tr key={doc.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{doc.filename}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <input
                                    type="text"
                                    defaultValue={doc.title || ""}
                                    placeholder="-"
                                    className="bg-transparent border-none focus:ring-0 p-0 w-full placeholder-gray-300"
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <input
                                    type="text"
                                    defaultValue={doc.author || ""}
                                    placeholder="-"
                                    className="bg-transparent border-none focus:ring-0 p-0 w-full placeholder-gray-300"
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {doc.language || "N/A"}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
