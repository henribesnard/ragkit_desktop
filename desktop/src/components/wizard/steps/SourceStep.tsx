import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { FolderOpen, Loader2, Database, Globe, FileText, Mail, ChevronDown, Cloud, Rss, Github } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderTree } from "../FolderTree";
import { useTranslation } from "react-i18next";

// Source form components from settings
import { WebUrlForm } from "@/components/settings/source-forms/WebUrlForm";
import { RssFeedForm } from "@/components/settings/source-forms/RssFeedForm";
import { SqlDatabaseForm } from "@/components/settings/source-forms/SqlDatabaseForm";
import { EmailImapForm } from "@/components/settings/source-forms/EmailImapForm";
import { RestApiForm } from "@/components/settings/source-forms/RestApiForm";
import { GoogleDriveForm } from "@/components/settings/source-forms/GoogleDriveForm";
import { OneDriveForm } from "@/components/settings/source-forms/OneDriveForm";
import { DropboxForm } from "@/components/settings/source-forms/DropboxForm";
import { ConfluenceForm } from "@/components/settings/source-forms/ConfluenceForm";
import { NotionForm } from "@/components/settings/source-forms/NotionForm";
import { S3BucketForm } from "@/components/settings/source-forms/S3BucketForm";
import { GitRepoForm } from "@/components/settings/source-forms/GitRepoForm";

type SourceCategory = "local_folder" | "database" | "website" | "email" | "api";

type BackendSourceType =
    | "local_directory"
    | "web_url" | "rss_feed"
    | "sql_database"
    | "email_imap"
    | "rest_api" | "google_drive" | "onedrive" | "dropbox"
    | "confluence" | "notion" | "s3_bucket" | "git_repo";

const SOURCE_CATEGORIES: { id: SourceCategory; iconEl: typeof FolderOpen; available: boolean }[] = [
    { id: "local_folder", iconEl: FolderOpen, available: true },
    { id: "database", iconEl: Database, available: true },
    { id: "website", iconEl: Globe, available: true },
    { id: "email", iconEl: Mail, available: true },
    { id: "api", iconEl: FileText, available: true },
];

const CATEGORY_SUBTYPES: Record<SourceCategory, { type: BackendSourceType; icon: typeof Globe }[]> = {
    local_folder: [],
    database: [
        { type: "sql_database", icon: Database },
    ],
    website: [
        { type: "web_url", icon: Globe },
        { type: "rss_feed", icon: Rss },
    ],
    email: [
        { type: "email_imap", icon: Mail },
    ],
    api: [
        { type: "rest_api", icon: Globe },
        { type: "google_drive", icon: Cloud },
        { type: "onedrive", icon: Cloud },
        { type: "dropbox", icon: Cloud },
        { type: "confluence", icon: Database },
        { type: "notion", icon: Database },
        { type: "s3_bucket", icon: Cloud },
        { type: "git_repo", icon: Github },
    ],
};

const DEFAULT_CONFIGS: Record<string, () => any> = {
    web_url: () => ({
        urls: [""], crawl_depth: 0, crawl_same_domain_only: true,
        include_patterns: [], exclude_patterns: [], max_pages: 100,
        extract_mode: "text", respect_robots_txt: true, user_agent: "LOKO-RAG/1.0",
        request_delay_ms: 0, timeout_seconds: 30,
    }),
    rss_feed: () => ({
        feed_urls: [""], max_articles: 50, fetch_full_content: false,
        content_selectors: [], max_age_days: null,
    }),
    sql_database: () => ({
        db_type: "sqlite", sqlite_path: "", host: "", port: 5432, database: "",
        query: "", id_column: "id", content_column: "content", title_column: "title",
        metadata_columns: [], incremental_column: "", max_rows: 10000,
    }),
    email_imap: () => ({
        server: "", port: 993, use_ssl: true, folders: [""],
        include_attachments: false, max_emails: 500, date_from: "",
        subject_filter: "", sender_filter: [],
    }),
    rest_api: () => ({
        base_url: "", endpoint: "", method: "GET", headers: {}, query_params: {},
        pagination_type: "none", pagination_param: "offset", pagination_size_param: "limit",
        page_size: 50, response_items_path: "", response_id_path: "",
        response_content_path: "", response_title_path: "", response_date_path: "",
        max_items: 1000, timeout_seconds: 30,
    }),
    google_drive: () => ({ folder_ids: [], include_shared: false, file_types: [], recursive: true, max_file_size_mb: 50 }),
    onedrive: () => ({ drive_id: null, site_id: null, folder_paths: [], file_types: [], recursive: true, max_file_size_mb: 50 }),
    dropbox: () => ({ folder_paths: [], file_types: [], recursive: true, max_file_size_mb: 50 }),
    confluence: () => ({
        base_url: "", space_keys: [""], label_filter: [], include_attachments: false,
        include_comments: false, exclude_archived: true, page_limit: 500, expand_macros: true, auth_type: "api_token",
    }),
    notion: () => ({ database_ids: [""], page_ids: [], include_subpages: false, property_filters: {}, max_pages: 200 }),
    s3_bucket: () => ({ bucket: "", prefix: "", region: "", endpoint_url: "", file_types: [], recursive: true, max_file_size_mb: 50 }),
    git_repo: () => ({ repo_url: "", branch: "main", file_types: [], excluded_dirs: [], include_readme_only: false, max_file_size_mb: 5, clone_depth: 1 }),
};

export function SourceStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const sourceCfg = state.config?.ingestion?.source || {
        path: "",
        recursive: true,
        excluded_dirs: [],
        file_types: ["pdf", "docx", "doc", "md", "txt"]
    };

    const [sourceCategory, setSourceCategory] = useState<SourceCategory>("local_folder");
    const [selectedSubType, setSelectedSubType] = useState<BackendSourceType | null>(null);
    const [sourceConfig, setSourceConfig] = useState<any>({});
    const [sourceName, setSourceName] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [folderTree, setFolderTree] = useState<any>(null);
    const [scanResult, setScanResult] = useState<any>(null);

    const subtypes = CATEGORY_SUBTYPES[sourceCategory];
    const hasSubTypes = subtypes.length > 1;

    // Auto-select single subtype when category changes
    useEffect(() => {
        if (subtypes.length === 1) {
            setSelectedSubType(subtypes[0].type);
            setSourceConfig(DEFAULT_CONFIGS[subtypes[0].type]());
        } else if (subtypes.length === 0) {
            setSelectedSubType(null);
        } else {
            setSelectedSubType(null);
            setSourceConfig({});
        }
        setSourceName("");
    }, [sourceCategory]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectSubType = (type: BackendSourceType) => {
        setSelectedSubType(type);
        setSourceConfig(DEFAULT_CONFIGS[type]?.() || {});
        setSourceName("");
    };

    const updateSource = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source = { ...cfg.ingestion.source, ...patch };
            return cfg;
        });
    };

    // Save non-local source config to wizard state
    useEffect(() => {
        if (sourceCategory !== "local_folder" && selectedSubType) {
            updateConfig((cfg: any) => {
                if (!cfg.ingestion) cfg.ingestion = {};
                cfg.ingestion.wizard_source = {
                    type: selectedSubType,
                    name: sourceName || t(`wizard.source.subtype.${selectedSubType}`),
                    config: sourceConfig,
                };
                return cfg;
            });
        }
    }, [selectedSubType, sourceConfig, sourceName]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                recursive: true,
            });
            if (selected && typeof selected === "string") {
                updateSource({ path: selected, excluded_dirs: [] });
            }
        } catch (err) {
            console.error(err);
            setError(t('wizard.source.errorSelect'));
        }
    };

    // 1. Validate tree structure (local folder only)
    useEffect(() => {
        if (sourceCategory !== "local_folder" || !sourceCfg.path) return;
        const validate = async () => {
            setIsValidating(true);
            try {
                const res: any = await invoke("validate_folder", {
                    path: sourceCfg.path,
                    recursive: sourceCfg.recursive,
                });
                if (res.valid) {
                    setFolderTree(res.tree);
                    setError(null);
                } else {
                    setError(res.error || t('wizard.source.invalid'));
                    setFolderTree(null);
                }
            } catch (err) {
                setError(t('wizard.source.validationError') + ": " + err);
            } finally {
                setIsValidating(false);
            }
        };
        validate();
    }, [sourceCfg.path, sourceCfg.recursive, sourceCategory, t]);

    // 2. Scan file types based on exclusions (local folder only)
    useEffect(() => {
        if (sourceCategory !== "local_folder" || !sourceCfg.path || isValidating || !!error) return;
        const scan = async () => {
            setIsScanning(true);
            try {
                const res: any = await invoke("scan_folder", {
                    params: {
                        folder_path: sourceCfg.path,
                        recursive: sourceCfg.recursive,
                        excluded_dirs: sourceCfg.excluded_dirs,
                    }
                });
                setScanResult(res);

                if (res.supported_types?.length > 0) {
                    const allSupported = res.supported_types.map((st: any) => st.extension.replace(".", ""));
                    updateSource({ file_types: allSupported });
                }
            } catch (err) {
                console.error("Scan error:", err);
            } finally {
                setIsScanning(false);
            }
        };
        const timer = setTimeout(scan, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceCfg.path, sourceCfg.recursive, sourceCfg.excluded_dirs, isValidating, error, sourceCategory]);

    const toggleExclusion = (path: string) => {
        const current = [...(sourceCfg.excluded_dirs || [])];
        const idx = current.indexOf(path);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(path);
        }
        updateSource({ excluded_dirs: current });
    };

    const handleToggleType = (ext: string) => {
        const cleanExt = ext.replace(".", "");
        const current = [...(sourceCfg.file_types || [])];
        const idx = current.indexOf(cleanExt);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(cleanExt);
        }
        updateSource({ file_types: current });
    };

    const isIncluded = (ext: string) => {
        return (sourceCfg.file_types || []).includes(ext.replace(".", ""));
    };

    const selectedCategoryDef = SOURCE_CATEGORIES.find(s => s.id === sourceCategory)!;
    const SelectedIcon = selectedCategoryDef.iconEl;

    const renderSourceForm = () => {
        if (!selectedSubType) return null;

        switch (selectedSubType) {
            case "web_url":
                return <WebUrlForm config={sourceConfig} onChange={setSourceConfig} />;
            case "rss_feed":
                return <RssFeedForm config={sourceConfig} onChange={setSourceConfig} />;
            case "sql_database":
                return <SqlDatabaseForm config={sourceConfig} onChange={setSourceConfig} />;
            case "email_imap":
                return <EmailImapForm config={sourceConfig} onChange={setSourceConfig} />;
            case "rest_api":
                return <RestApiForm config={sourceConfig} onChange={setSourceConfig} />;
            case "google_drive":
                return <GoogleDriveForm config={sourceConfig} onChange={setSourceConfig} />;
            case "onedrive":
                return <OneDriveForm config={sourceConfig} onChange={setSourceConfig} />;
            case "dropbox":
                return <DropboxForm config={sourceConfig} onChange={setSourceConfig} />;
            case "confluence":
                return <ConfluenceForm config={sourceConfig} onChange={setSourceConfig} />;
            case "notion":
                return <NotionForm config={sourceConfig} onChange={setSourceConfig} />;
            case "s3_bucket":
                return <S3BucketForm config={sourceConfig} onChange={setSourceConfig} />;
            case "git_repo":
                return <GitRepoForm config={sourceConfig} onChange={setSourceConfig} />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <h2 className="text-lg font-bold mb-3 text-center">{t('wizard.source.title')}</h2>

                {/* Source category dropdown */}
                <div className="relative mb-3">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <SelectedIcon className="w-5 h-5 text-brand-500" />
                            <span className="font-medium text-sm">{t(`wizard.source.type.${sourceCategory}`)}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                            {SOURCE_CATEGORIES.map((src) => {
                                const Icon = src.iconEl;
                                return (
                                    <button
                                        key={src.id}
                                        onClick={() => {
                                            if (src.available) {
                                                setSourceCategory(src.id);
                                                setSelectedSubType(null);
                                                setSourceConfig({});
                                                setDropdownOpen(false);
                                            }
                                        }}
                                        disabled={!src.available}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                                            src.available
                                                ? "hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                                : "opacity-50 cursor-not-allowed"
                                        } ${src.id === sourceCategory ? "bg-brand-50 dark:bg-brand-900/20" : ""}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-5 h-5 ${src.id === sourceCategory ? "text-brand-500" : "text-gray-400"}`} />
                                            <span className="text-sm font-medium">{t(`wizard.source.type.${src.id}`)}</span>
                                        </div>
                                        {!src.available && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                {t('wizard.source.comingSoon')}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sub-type selector (for categories with multiple backend types) */}
                {sourceCategory !== "local_folder" && hasSubTypes && (
                    <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('wizard.source.selectSubType')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {subtypes.map(({ type, icon: SubIcon }) => (
                                <button
                                    key={type}
                                    onClick={() => handleSelectSubType(type)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                                        selectedSubType === type
                                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500"
                                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                                    }`}
                                >
                                    <SubIcon className={`w-4 h-4 flex-shrink-0 ${selectedSubType === type ? "text-brand-500" : "text-gray-400"}`} />
                                    <span className="font-medium truncate">{t(`wizard.source.subtype.${type}`)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Source name (for non-local sources) */}
                {sourceCategory !== "local_folder" && selectedSubType && (
                    <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('wizard.source.sourceName')}
                        </label>
                        <input
                            type="text"
                            value={sourceName}
                            onChange={(e) => setSourceName(e.target.value)}
                            placeholder={t('wizard.source.sourceNamePlaceholder')}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                        />
                    </div>
                )}

                {/* Non-local source configuration form */}
                {sourceCategory !== "local_folder" && selectedSubType && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3">
                        {renderSourceForm()}
                    </div>
                )}

                {/* Local folder config */}
                {sourceCategory === "local_folder" && (
                    <>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3">
                            <div className="flex gap-4 mb-4">
                                <div className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono truncate flex items-center">
                                    {sourceCfg.path || t('wizard.source.noFolder')}
                                </div>
                                <Button onClick={handleSelectFolder} variant="outline" className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4" />
                                    {t('wizard.source.browse')}
                                </Button>
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-900">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={sourceCfg.recursive}
                                        onChange={(e) => updateSource({ recursive: e.target.checked })}
                                    />
                                    {t('wizard.source.includeSubfolders')}
                                </label>

                                {sourceCfg.recursive && folderTree && (
                                    <FolderTree
                                        path={sourceCfg.path}
                                        tree={folderTree}
                                        excludedFolders={sourceCfg.excluded_dirs}
                                        onToggleExclusion={toggleExclusion}
                                    />
                                )}
                            </div>
                        </div>

                        {/* File Types */}
                        {(isScanning || scanResult) && !error && (
                            <div className="bg-white dark:bg-gray-800 p-4 flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3">
                                <h3 className="font-semibold flex items-center gap-2">
                                    {t('wizard.source.detectedTypes')}
                                    {isScanning && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
                                </h3>

                                {!isScanning && scanResult?.supported_types && (
                                    <div className="space-y-2">
                                        {scanResult.supported_types.map((type: any) => (
                                            <div key={type.extension} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors cursor-pointer" onClick={() => handleToggleType(type.extension)}>
                                                <input
                                                    type="checkbox"
                                                    checked={isIncluded(type.extension)}
                                                    onChange={() => { }}
                                                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                                                />
                                                <span className="font-mono text-sm bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded uppercase w-16 text-center">
                                                    {type.display_name}
                                                </span>
                                                <div className="flex-1 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                                    <span>{type.count} {t('wizard.source.files')}</span>
                                                    <span>{type.size_mb.toFixed(2)} Mo</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!isScanning && scanResult?.supported_types?.length === 0 && (
                                    <p className="text-sm text-gray-500 italic">{t('wizard.source.noSupportedFiles')}</p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
