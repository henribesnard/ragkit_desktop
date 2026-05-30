import { useState, useEffect } from "react";
import { FolderOpen, Loader2, Database, Globe, FileText, Mail, ChevronDown, Cloud, Rss, Github } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderTree } from "../FolderTree";
import { useTranslation } from "react-i18next";

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
    database: [{ type: "sql_database", icon: Database }],
    website: [{ type: "web_url", icon: Globe }, { type: "rss_feed", icon: Rss }],
    email: [{ type: "email_imap", icon: Mail }],
    api: [
        { type: "rest_api", icon: Globe }, { type: "google_drive", icon: Cloud },
        { type: "onedrive", icon: Cloud }, { type: "dropbox", icon: Cloud },
        { type: "confluence", icon: Database }, { type: "notion", icon: Database },
        { type: "s3_bucket", icon: Cloud }, { type: "git_repo", icon: Github },
    ],
};

const DEFAULT_CONFIGS: Record<string, () => any> = {
    web_url: () => ({ urls: [""], crawl_depth: 0, crawl_same_domain_only: true, include_patterns: [], exclude_patterns: [], max_pages: 100, extract_mode: "text", respect_robots_txt: true, user_agent: "LOKO-RAG/1.0", request_delay_ms: 0, timeout_seconds: 30 }),
    rss_feed: () => ({ feed_urls: [""], max_articles: 50, fetch_full_content: false, content_selectors: [], max_age_days: null }),
    sql_database: () => ({ db_type: "sqlite", sqlite_path: "", host: "", port: 5432, database: "", query: "", id_column: "id", content_column: "content", title_column: "title", metadata_columns: [], incremental_column: "", max_rows: 10000 }),
    email_imap: () => ({ server: "", port: 993, use_ssl: true, folders: [""], include_attachments: false, max_emails: 500, date_from: "", subject_filter: "", sender_filter: [] }),
    rest_api: () => ({ base_url: "", endpoint: "", method: "GET", headers: {}, query_params: {}, pagination_type: "none", pagination_param: "offset", pagination_size_param: "limit", page_size: 50, response_items_path: "", response_id_path: "", response_content_path: "", response_title_path: "", response_date_path: "", max_items: 1000, timeout_seconds: 30 }),
    google_drive: () => ({ folder_ids: [], include_shared: false, file_types: [], recursive: true, max_file_size_mb: 50 }),
    onedrive: () => ({ drive_id: null, site_id: null, folder_paths: [], file_types: [], recursive: true, max_file_size_mb: 50 }),
    dropbox: () => ({ folder_paths: [], file_types: [], recursive: true, max_file_size_mb: 50 }),
    confluence: () => ({ base_url: "", space_keys: [""], label_filter: [], include_attachments: false, include_comments: false, exclude_archived: true, page_limit: 500, expand_macros: true, auth_type: "api_token" }),
    notion: () => ({ database_ids: [""], page_ids: [], include_subpages: false, property_filters: {}, max_pages: 200 }),
    s3_bucket: () => ({ bucket: "", prefix: "", region: "", endpoint_url: "", file_types: [], recursive: true, max_file_size_mb: 50 }),
    git_repo: () => ({ repo_url: "", branch: "main", file_types: [], excluded_dirs: [], include_readme_only: false, max_file_size_mb: 5, clone_depth: 1 }),
};

export function SourceStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const sourceCfg = state.config?.ingestion?.source || { path: "", recursive: true, excluded_dirs: [], file_types: ["pdf", "docx", "doc", "md", "txt"] };

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

    useEffect(() => {
        if (subtypes.length === 1) { setSelectedSubType(subtypes[0].type); setSourceConfig(DEFAULT_CONFIGS[subtypes[0].type]()); }
        else if (subtypes.length === 0) { setSelectedSubType(null); }
        else { setSelectedSubType(null); setSourceConfig({}); }
        setSourceName("");
    }, [sourceCategory]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectSubType = (type: BackendSourceType) => { setSelectedSubType(type); setSourceConfig(DEFAULT_CONFIGS[type]?.() || {}); setSourceName(""); };

    const updateSource = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source = { ...cfg.ingestion.source, ...patch };
            return cfg;
        });
    };

    useEffect(() => {
        if (sourceCategory !== "local_folder" && selectedSubType) {
            updateConfig((cfg: any) => {
                if (!cfg.ingestion) cfg.ingestion = {};
                cfg.ingestion.wizard_source = { type: selectedSubType, name: sourceName || t(`wizard.source.subtype.${selectedSubType}`), config: sourceConfig };
                return cfg;
            });
        }
    }, [selectedSubType, sourceConfig, sourceName]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectFolder = async () => {
        try {
            const selected = await open({ directory: true, multiple: false, recursive: true });
            if (selected && typeof selected === "string") { updateSource({ path: selected, excluded_dirs: [] }); }
        } catch (err) { console.error(err); setError(t('wizard.source.errorSelect')); }
    };

    useEffect(() => {
        if (sourceCategory !== "local_folder" || !sourceCfg.path) return;
        const validate = async () => {
            setIsValidating(true);
            try {
                const res: any = await invoke("validate_folder", { path: sourceCfg.path, recursive: sourceCfg.recursive });
                if (res.valid) { setFolderTree(res.tree); setError(null); }
                else { setError(res.error || t('wizard.source.invalid')); setFolderTree(null); }
            } catch (err) { setError(t('wizard.source.validationError') + ": " + err); }
            finally { setIsValidating(false); }
        };
        validate();
    }, [sourceCfg.path, sourceCfg.recursive, sourceCategory, t]);

    useEffect(() => {
        if (sourceCategory !== "local_folder" || !sourceCfg.path || isValidating || !!error) return;
        const scan = async () => {
            setIsScanning(true);
            try {
                const res: any = await invoke("scan_folder", { params: { folder_path: sourceCfg.path, recursive: sourceCfg.recursive, excluded_dirs: sourceCfg.excluded_dirs } });
                setScanResult(res);
                if (res.supported_types?.length > 0) { const allSupported = res.supported_types.map((st: any) => st.extension.replace(".", "")); updateSource({ file_types: allSupported }); }
            } catch (err) { console.error("Scan error:", err); }
            finally { setIsScanning(false); }
        };
        const timer = setTimeout(scan, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceCfg.path, sourceCfg.recursive, sourceCfg.excluded_dirs, isValidating, error, sourceCategory]);

    const toggleExclusion = (path: string) => {
        const current = [...(sourceCfg.excluded_dirs || [])];
        const idx = current.indexOf(path);
        if (idx >= 0) current.splice(idx, 1); else current.push(path);
        updateSource({ excluded_dirs: current });
    };

    const handleToggleType = (ext: string) => {
        const cleanExt = ext.replace(".", "");
        const current = [...(sourceCfg.file_types || [])];
        const idx = current.indexOf(cleanExt);
        if (idx >= 0) current.splice(idx, 1); else current.push(cleanExt);
        updateSource({ file_types: current });
    };

    const isIncluded = (ext: string) => (sourceCfg.file_types || []).includes(ext.replace(".", ""));
    const selectedCategoryDef = SOURCE_CATEGORIES.find(s => s.id === sourceCategory)!;
    const SelectedIcon = selectedCategoryDef.iconEl;

    const renderSourceForm = () => {
        if (!selectedSubType) return null;
        switch (selectedSubType) {
            case "web_url": return <WebUrlForm config={sourceConfig} onChange={setSourceConfig} />;
            case "rss_feed": return <RssFeedForm config={sourceConfig} onChange={setSourceConfig} />;
            case "sql_database": return <SqlDatabaseForm config={sourceConfig} onChange={setSourceConfig} />;
            case "email_imap": return <EmailImapForm config={sourceConfig} onChange={setSourceConfig} />;
            case "rest_api": return <RestApiForm config={sourceConfig} onChange={setSourceConfig} />;
            case "google_drive": return <GoogleDriveForm config={sourceConfig} onChange={setSourceConfig} />;
            case "onedrive": return <OneDriveForm config={sourceConfig} onChange={setSourceConfig} />;
            case "dropbox": return <DropboxForm config={sourceConfig} onChange={setSourceConfig} />;
            case "confluence": return <ConfluenceForm config={sourceConfig} onChange={setSourceConfig} />;
            case "notion": return <NotionForm config={sourceConfig} onChange={setSourceConfig} />;
            case "s3_bucket": return <S3BucketForm config={sourceConfig} onChange={setSourceConfig} />;
            case "git_repo": return <GitRepoForm config={sourceConfig} onChange={setSourceConfig} />;
            default: return null;
        }
    };

    return (
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "100%" }}>
            <div className="flex-1 overflow-y-auto loko-scroll" style={{ paddingRight: 4 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6, textAlign: "center" }}>
                    {t('wizard.source.title')}
                </h1>

                {/* Source category dropdown */}
                <div style={{ position: "relative", marginBottom: 14 }}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            background: "var(--surface)",
                            border: "1px solid var(--border-strong)",
                            borderRadius: 12,
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 500,
                            color: "var(--text)",
                        }}
                    >
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <SelectedIcon size={18} style={{ color: "var(--brand)" }} />
                            {t(`wizard.source.type.${sourceCategory}`)}
                        </span>
                        <ChevronDown size={16} style={{ color: "var(--text-3)", transition: "transform .14s", transform: dropdownOpen ? "rotate(180deg)" : "none" }} />
                    </button>

                    {dropdownOpen && (
                        <div style={{
                            position: "absolute", zIndex: 20, marginTop: 4, width: "100%",
                            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                            boxShadow: "var(--shadow-pop)", overflow: "hidden",
                        }}>
                            {SOURCE_CATEGORIES.map((src) => {
                                const Icon = src.iconEl;
                                return (
                                    <button
                                        key={src.id}
                                        onClick={() => { if (src.available) { setSourceCategory(src.id); setSelectedSubType(null); setSourceConfig({}); setDropdownOpen(false); } }}
                                        disabled={!src.available}
                                        style={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "10px 16px",
                                            background: src.id === sourceCategory ? "var(--brand-weak)" : "transparent",
                                            border: "none",
                                            cursor: src.available ? "pointer" : "not-allowed",
                                            opacity: src.available ? 1 : 0.5,
                                            fontSize: 13.5,
                                            fontWeight: 500,
                                            color: "var(--text)",
                                            textAlign: "left",
                                        }}
                                    >
                                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <Icon size={16} style={{ color: src.id === sourceCategory ? "var(--brand)" : "var(--text-3)" }} />
                                            {t(`wizard.source.type.${src.id}`)}
                                        </span>
                                        {!src.available && <span className="loko-badge loko-badge-neutral">{t('wizard.source.comingSoon')}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sub-type selector */}
                {sourceCategory !== "local_folder" && hasSubTypes && (
                    <div style={{ marginBottom: 14 }}>
                        <label className="field-label">{t('wizard.source.selectSubType')}</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {subtypes.map(({ type, icon: SubIcon }) => (
                                <button
                                    key={type}
                                    onClick={() => handleSelectSubType(type)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8,
                                        padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                                        border: selectedSubType === type ? "2px solid var(--brand)" : "1px solid var(--border)",
                                        background: selectedSubType === type ? "var(--brand-weak)" : "var(--surface)",
                                        color: "var(--text)", cursor: "pointer", textAlign: "left",
                                    }}
                                >
                                    <SubIcon size={15} style={{ color: selectedSubType === type ? "var(--brand)" : "var(--text-3)", flexShrink: 0 }} />
                                    {t(`wizard.source.subtype.${type}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Source name */}
                {sourceCategory !== "local_folder" && selectedSubType && (
                    <div style={{ marginBottom: 14 }}>
                        <label className="field-label">{t('wizard.source.sourceName')}</label>
                        <input className="input" type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder={t('wizard.source.sourceNamePlaceholder')} />
                    </div>
                )}

                {/* Non-local source form */}
                {sourceCategory !== "local_folder" && selectedSubType && (
                    <div className="loko-panel" style={{ padding: 20, marginBottom: 14 }}>
                        {renderSourceForm()}
                    </div>
                )}

                {/* Local folder config */}
                {sourceCategory === "local_folder" && (
                    <>
                        <div className="loko-panel" style={{ padding: 20, marginBottom: 14 }}>
                            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                                <div style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "0 12px",
                                    height: 40,
                                    background: "var(--surface-2)",
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: 10,
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 13,
                                    color: "var(--text-2)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {sourceCfg.path || t('wizard.source.noFolder')}
                                </div>
                                <button className="btn btn-secondary" onClick={handleSelectFolder}>
                                    <FolderOpen size={16} />
                                    {t('wizard.source.browse')}
                                </button>
                            </div>

                            {error && (
                                <div style={{
                                    padding: 12, borderRadius: 8, marginBottom: 14,
                                    background: "var(--danger-bg)", color: "var(--danger)",
                                    border: "1px solid var(--danger)", fontSize: 13,
                                }}>
                                    {error}
                                </div>
                            )}

                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={sourceCfg.recursive}
                                    onChange={(e) => updateSource({ recursive: e.target.checked })}
                                    style={{ accentColor: "var(--brand)" }}
                                />
                                {t('wizard.source.includeSubfolders')}
                            </label>

                            {sourceCfg.recursive && folderTree && (
                                <div style={{ marginTop: 14 }}>
                                    <FolderTree
                                        path={sourceCfg.path}
                                        tree={folderTree}
                                        excludedFolders={sourceCfg.excluded_dirs}
                                        onToggleExclusion={toggleExclusion}
                                    />
                                </div>
                            )}
                        </div>

                        {/* File Types */}
                        {(isScanning || scanResult) && !error && (
                            <div className="loko-panel" style={{ padding: 20, marginBottom: 14 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                    {t('wizard.source.detectedTypes')}
                                    {isScanning && <Loader2 size={15} className="animate-spin" style={{ color: "var(--brand)" }} />}
                                </h3>

                                {!isScanning && scanResult?.supported_types && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {scanResult.supported_types.map((type: any) => (
                                            <div
                                                key={type.extension}
                                                onClick={() => handleToggleType(type.extension)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 12,
                                                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                                    transition: "background .1s",
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isIncluded(type.extension)}
                                                    readOnly
                                                    style={{ accentColor: "var(--brand)", width: 16, height: 16, cursor: "pointer" }}
                                                />
                                                <span className="loko-badge loko-badge-brand loko-badge-mono" style={{ width: 56, textAlign: "center", textTransform: "uppercase" }}>
                                                    {type.display_name}
                                                </span>
                                                <span style={{ flex: 1, fontSize: 13, color: "var(--text-2)" }}>
                                                    {type.count} {t('wizard.source.files')}
                                                </span>
                                                <span className="mono-tag">{type.size_mb.toFixed(2)} Mo</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!isScanning && scanResult?.supported_types?.length === 0 && (
                                    <p style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>
                                        {t('wizard.source.noSupportedFiles')}
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
