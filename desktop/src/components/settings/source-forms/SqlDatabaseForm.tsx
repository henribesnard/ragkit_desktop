import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface SqlDatabaseFormProps {
    config: any;
    onChange: (config: any) => void;
}

export function SqlDatabaseForm({ config, onChange }: SqlDatabaseFormProps) {
    const dbType = config.db_type || "sqlite";
    const metadataColumns = config.metadata_columns || [];
    const credential = config.credential || {};

    const setCredential = (next: Record<string, any>) => {
        const hasValue = Object.values(next).some((value) => String(value || "").trim());
        if (hasValue) {
            onChange({ ...config, credential: next });
        } else {
            const { credential: _removed, ...rest } = config;
            onChange(rest);
        }
    };

    const updateCredential = (key: string, value: string) => {
        setCredential({ ...credential, [key]: value });
    };

    const updateList = (key: string, index: number, value: string) => {
        const current = [...(config[key] || [])];
        current[index] = value;
        onChange({ ...config, [key]: current });
    };

    const addListItem = (key: string) => {
        const current = [...(config[key] || [])];
        current.push("");
        onChange({ ...config, [key]: current });
    };

    const removeListItem = (key: string, index: number) => {
        const current = [...(config[key] || [])];
        current.splice(index, 1);
        onChange({ ...config, [key]: current });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de base</label>
                <select
                    value={dbType}
                    onChange={(e) => onChange({ ...config, db_type: e.target.value })}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                    <option value="sqlite">SQLite</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                </select>
            </div>

            {dbType === "sqlite" ? (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chemin SQLite</label>
                    <input
                        type="text"
                        value={config.sqlite_path || ""}
                        onChange={(e) => onChange({ ...config, sqlite_path: e.target.value })}
                        placeholder="C:\\data\\database.db"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host</label>
                        <input
                            type="text"
                            value={config.host || ""}
                            onChange={(e) => onChange({ ...config, host: e.target.value })}
                            placeholder="localhost"
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                        <input
                            type="number"
                            value={config.port || (dbType === "mysql" ? 3306 : 5432)}
                            onChange={(e) => onChange({ ...config, port: parseInt(e.target.value) || 0 })}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database</label>
                        <input
                            type="text"
                            value={config.database || ""}
                            onChange={(e) => onChange({ ...config, database: e.target.value })}
                            placeholder="mydb"
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur</label>
                        <input
                            type="text"
                            value={credential.username || ""}
                            onChange={(e) => updateCredential("username", e.target.value)}
                            placeholder="user"
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
                        <input
                            type="password"
                            value={credential.password || ""}
                            onChange={(e) => updateCredential("password", e.target.value)}
                            placeholder="••••••"
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requete SQL (SELECT)</label>
                <textarea
                    value={config.query || ""}
                    onChange={(e) => onChange({ ...config, query: e.target.value })}
                    rows={4}
                    placeholder="SELECT id, content, title FROM articles"
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colonne ID</label>
                    <input
                        type="text"
                        value={config.id_column || ""}
                        onChange={(e) => onChange({ ...config, id_column: e.target.value })}
                        placeholder="id"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colonne contenu</label>
                    <input
                        type="text"
                        value={config.content_column || ""}
                        onChange={(e) => onChange({ ...config, content_column: e.target.value })}
                        placeholder="content"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colonne titre</label>
                    <input
                        type="text"
                        value={config.title_column || ""}
                        onChange={(e) => onChange({ ...config, title_column: e.target.value })}
                        placeholder="title"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colonne incremental</label>
                    <input
                        type="text"
                        value={config.incremental_column || ""}
                        onChange={(e) => onChange({ ...config, incremental_column: e.target.value })}
                        placeholder="updated_at"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colonnes metadata</label>
                <div className="space-y-2">
                    {metadataColumns.map((col: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={col}
                                onChange={(e) => updateList("metadata_columns", index, e.target.value)}
                                placeholder="category"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("metadata_columns", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("metadata_columns")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter une colonne
                    </Button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre max de lignes</label>
                <input
                    type="number"
                    min="1"
                    value={config.max_rows || 10000}
                    onChange={(e) => onChange({ ...config, max_rows: parseInt(e.target.value) || 1 })}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>
        </div>
    );
}
