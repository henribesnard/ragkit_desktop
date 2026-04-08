import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface EmailImapFormProps {
    config: any;
    onChange: (config: any) => void;
}

export function EmailImapForm({ config, onChange }: EmailImapFormProps) {
    const folders = config.folders || [""];
    const senderFilter = config.sender_filter || [];
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serveur IMAP</label>
                    <input
                        type="text"
                        value={config.server || ""}
                        onChange={(e) => onChange({ ...config, server: e.target.value })}
                        placeholder="imap.gmail.com"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                    <input
                        type="number"
                        value={config.port || 993}
                        onChange={(e) => onChange({ ...config, port: parseInt(e.target.value) || 0 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
                <input
                    type="checkbox"
                    id="imap-ssl"
                    checked={config.use_ssl !== false}
                    onChange={(e) => onChange({ ...config, use_ssl: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="imap-ssl" className="text-sm text-gray-700 dark:text-gray-300">Utiliser SSL</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur</label>
                    <input
                        type="text"
                        value={credential.username || ""}
                        onChange={(e) => updateCredential("username", e.target.value)}
                        placeholder="user@company.com"
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

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dossiers</label>
                <div className="space-y-2">
                    {folders.map((folder: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={folder}
                                onChange={(e) => updateList("folders", index, e.target.value)}
                                placeholder="INBOX"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("folders", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("folders")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un dossier
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date debut</label>
                    <input
                        type="date"
                        value={config.date_from || ""}
                        onChange={(e) => onChange({ ...config, date_from: e.target.value })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sujet contient</label>
                    <input
                        type="text"
                        value={config.subject_filter || ""}
                        onChange={(e) => onChange({ ...config, subject_filter: e.target.value })}
                        placeholder="facture"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expediteurs</label>
                <div className="space-y-2">
                    {senderFilter.map((sender: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="email"
                                value={sender}
                                onChange={(e) => updateList("sender_filter", index, e.target.value)}
                                placeholder="boss@company.com"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("sender_filter", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("sender_filter")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un expediteur
                    </Button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emails maximum</label>
                <input
                    type="number"
                    min="1"
                    value={config.max_emails || 500}
                    onChange={(e) => onChange({ ...config, max_emails: parseInt(e.target.value) || 1 })}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>
        </div>
    );
}
