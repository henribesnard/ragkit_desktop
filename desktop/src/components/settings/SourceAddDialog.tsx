import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { 
    X, 
    Folder, 
    Globe, 
    Rss, 
    Cloud, 
    Database, 
    Mail, 
    Github, 
    ArrowLeft,
    RefreshCw,
    CreditCard,
    AlertCircle
} from "lucide-react";
import { LocalDirectoryForm } from "./source-forms/LocalDirectoryForm";
import { WebUrlForm } from "./source-forms/WebUrlForm";
import { RssFeedForm } from "./source-forms/RssFeedForm";
import { GoogleDriveForm } from "./source-forms/GoogleDriveForm";
import { OneDriveForm } from "./source-forms/OneDriveForm";
import { DropboxForm } from "./source-forms/DropboxForm";
import { ConfluenceForm } from "./source-forms/ConfluenceForm";
import { NotionForm } from "./source-forms/NotionForm";
import { SqlDatabaseForm } from "./source-forms/SqlDatabaseForm";
import { RestApiForm } from "./source-forms/RestApiForm";
import { S3BucketForm } from "./source-forms/S3BucketForm";
import { EmailImapForm } from "./source-forms/EmailImapForm";
import { GitRepoForm } from "./source-forms/GitRepoForm";
import { cn } from "@/lib/cn";

interface SourceAddDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (source: any) => Promise<any>;
    editingSource?: any;
    sourceTypes: any[];
    onRefresh?: () => void;
}

const TYPE_ICONS: Record<string, any> = {
    local_directory: <Folder className="w-5 h-5" />,
    web_url: <Globe className="w-5 h-5" />,
    rss_feed: <Rss className="w-5 h-5" />,
    google_drive: <Cloud className="w-5 h-5" />,
    onedrive: <Cloud className="w-5 h-5" />,
    dropbox: <Cloud className="w-5 h-5" />,
    confluence: <Database className="w-5 h-5" />,
    notion: <Database className="w-5 h-5" />,
    sql_database: <Database className="w-5 h-5" />,
    rest_api: <Globe className="w-5 h-5" />,
    s3_bucket: <Cloud className="w-5 h-5" />,
    email_imap: <Mail className="w-5 h-5" />,
    git_repo: <Github className="w-5 h-5" />,
};

export function SourceAddDialog({ isOpen, onClose, onAdd, editingSource, sourceTypes, onRefresh }: SourceAddDialogProps) {
    const [step, setStep] = useState<"type" | "config">(editingSource ? "config" : "type");
    const [selectedType, setSelectedType] = useState<string | null>(editingSource?.type || null);
    const [name, setName] = useState(editingSource?.name || "");
    const [config, setConfig] = useState<any>(editingSource?.config || {});
    const [syncFrequency, setSyncFrequency] = useState(editingSource?.sync_frequency || "manual");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const defaultConfigForType = (type: string) => {
        switch (type) {
            case "web_url":
                return {
                    urls: [""],
                    crawl_depth: 0,
                    crawl_same_domain_only: true,
                    include_patterns: [],
                    exclude_patterns: [],
                    max_pages: 100,
                    extract_mode: "text",
                    respect_robots_txt: true,
                    user_agent: "LOKO-RAG/1.0",
                    request_delay_ms: 0,
                    timeout_seconds: 30,
                };
            case "rss_feed":
                return {
                    feed_urls: [""],
                    max_articles: 50,
                    fetch_full_content: false,
                    content_selectors: [],
                    max_age_days: null,
                };
            case "google_drive":
                return {
                    folder_ids: [],
                    include_shared: false,
                    file_types: [],
                    recursive: true,
                    max_file_size_mb: 50,
                };
            case "onedrive":
                return {
                    drive_id: null,
                    site_id: null,
                    folder_paths: [],
                    file_types: [],
                    recursive: true,
                    max_file_size_mb: 50,
                };
            case "dropbox":
                return {
                    folder_paths: [],
                    file_types: [],
                    recursive: true,
                    max_file_size_mb: 50,
                };
            case "confluence":
                return {
                    base_url: "",
                    space_keys: [""],
                    label_filter: [],
                    include_attachments: false,
                    include_comments: false,
                    exclude_archived: true,
                    page_limit: 500,
                    expand_macros: true,
                    auth_type: "api_token",
                };
            case "notion":
                return {
                    database_ids: [""],
                    page_ids: [],
                    include_subpages: false,
                    property_filters: {},
                    max_pages: 200,
                };
            case "sql_database":
                return {
                    db_type: "sqlite",
                    sqlite_path: "",
                    host: "",
                    port: 5432,
                    database: "",
                    query: "",
                    id_column: "id",
                    content_column: "content",
                    title_column: "title",
                    metadata_columns: [],
                    incremental_column: "",
                    max_rows: 10000,
                };
            case "rest_api":
                return {
                    base_url: "",
                    endpoint: "",
                    method: "GET",
                    headers: {},
                    query_params: {},
                    pagination_type: "none",
                    pagination_param: "offset",
                    pagination_size_param: "limit",
                    page_size: 50,
                    response_items_path: "",
                    response_id_path: "",
                    response_content_path: "",
                    response_title_path: "",
                    response_date_path: "",
                    max_items: 1000,
                    timeout_seconds: 30,
                };
            case "s3_bucket":
                return {
                    bucket: "",
                    prefix: "",
                    region: "",
                    endpoint_url: "",
                    file_types: [],
                    recursive: true,
                    max_file_size_mb: 50,
                };
            case "email_imap":
                return {
                    server: "",
                    port: 993,
                    use_ssl: true,
                    folders: [""],
                    include_attachments: false,
                    max_emails: 500,
                    date_from: "",
                    subject_filter: "",
                    sender_filter: [],
                };
            case "git_repo":
                return {
                    repo_url: "",
                    branch: "main",
                    file_types: [],
                    excluded_dirs: [],
                    include_readme_only: false,
                    max_file_size_mb: 5,
                    clone_depth: 1,
                };
            default:
                return {};
        }
    };

    useEffect(() => {
        if (editingSource) {
            setStep("config");
            setSelectedType(editingSource.type);
            setName(editingSource.name);
            setConfig(editingSource.config);
            setSyncFrequency(editingSource.sync_frequency || "manual");
        } else {
            setStep("type");
            setSelectedType(null);
            setName("");
            setConfig({});
            setSyncFrequency("manual");
        }
        setError(null);
    }, [editingSource, isOpen]);

    if (!isOpen) return null;

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        setStep("config");
        if (!name) {
            setName(`Ma source ${type.replace('_', ' ')}`);
        }
        setConfig(defaultConfigForType(type));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedType || !name) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await onAdd({
                id: editingSource?.id,
                name,
                type: selectedType,
                config,
                sync_frequency: syncFrequency,
                enabled: editingSource ? editingSource.enabled : true,
            });
            onClose();
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderTypeSelection = () => (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sourceTypes.map((st) => (
                <button
                    key={st.type}
                    disabled={!st.registered}
                    onClick={() => handleSelectType(st.type)}
                    className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all",
                        st.registered 
                            ? "hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" 
                            : "opacity-40 grayscale cursor-not-allowed border-dashed border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
                    )}
                >
                    <div className={cn("p-2.5 rounded-full mb-3", st.registered ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-gray-200 dark:bg-gray-800 text-gray-400")}>
                        {TYPE_ICONS[st.type] || <Folder className="w-5 h-5" />}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">{st.type.replace('_', ' ')}</span>
                    {!st.registered && <span className="text-[10px] text-gray-500 mt-1 italic">Prochainement</span>}
                </button>
            ))}
        </div>
    );

    const renderConfigForm = () => {
        switch (selectedType) {
            case "local_directory":
                return <LocalDirectoryForm config={config} onChange={setConfig} />;
            case "web_url":
                return <WebUrlForm config={config} onChange={setConfig} />;
            case "rss_feed":
                return <RssFeedForm config={config} onChange={setConfig} />;
            case "google_drive":
                return (
                    <GoogleDriveForm
                        config={config}
                        onChange={setConfig}
                        sourceId={editingSource?.id}
                        connected={Boolean(editingSource?.credential_key)}
                        onConnected={onRefresh}
                    />
                );
            case "onedrive":
                return (
                    <OneDriveForm
                        config={config}
                        onChange={setConfig}
                        sourceId={editingSource?.id}
                        connected={Boolean(editingSource?.credential_key)}
                        onConnected={onRefresh}
                    />
                );
            case "dropbox":
                return (
                    <DropboxForm
                        config={config}
                        onChange={setConfig}
                        sourceId={editingSource?.id}
                        connected={Boolean(editingSource?.credential_key)}
                        onConnected={onRefresh}
                    />
                );
            case "confluence":
                return <ConfluenceForm config={config} onChange={setConfig} />;
            case "notion":
                return <NotionForm config={config} onChange={setConfig} />;
            case "sql_database":
                return <SqlDatabaseForm config={config} onChange={setConfig} />;
            case "rest_api":
                return <RestApiForm config={config} onChange={setConfig} />;
            case "s3_bucket":
                return <S3BucketForm config={config} onChange={setConfig} />;
            case "email_imap":
                return <EmailImapForm config={config} onChange={setConfig} />;
            case "git_repo":
                return <GitRepoForm config={config} onChange={setConfig} />;
            default:
                return (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                        <CreditCard className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">La configuration pour {selectedType} n'est pas encore disponible.</p>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center gap-3">
                        {step === "config" && !editingSource && (
                            <button onClick={() => setStep("type")} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <ArrowLeft className="w-5 h-5 text-gray-500" />
                            </button>
                        )}
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            {editingSource ? `Modifier ${editingSource.name}` : "Ajouter une source de connaissance"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="px-6 py-6 overflow-y-auto max-h-[70vh]">
                    {step === "type" ? renderTypeSelection() : (
                        <div className="space-y-6">
                            {/* Common fields */}
                            <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">Nom de la source</label>
                                <input
                                    type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: Documentation Client"
                                        className="block w-full px-4 py-2.5 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">Frequence de synchronisation</label>
                                    <select
                                        value={syncFrequency}
                                        onChange={(e) => setSyncFrequency(e.target.value)}
                                        className="block w-full px-4 py-2.5 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                                    >
                                        <option value="manual">Manuelle</option>
                                        <option value="15min">Toutes les 15 min</option>
                                        <option value="1h">Toutes les heures</option>
                                        <option value="6h">Toutes les 6 heures</option>
                                        <option value="24h">Quotidienne</option>
                                        <option value="7d">Hebdomadaire</option>
                                    </select>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />
                                {renderConfigForm()}
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                                </div>
                            )}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/30">
                    <Button variant="ghost" onClick={onClose}>Annuler</Button>
                    {step === "config" && (
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 rounded-full h-11 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !name}
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                editingSource ? "Mettre à jour" : "Ajouter la source"
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
