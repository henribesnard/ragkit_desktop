import { useState, useEffect } from "react";
import { Loader2, CheckSquare, Settings2, Save, FileText } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { useTranslation } from "react-i18next";

interface TargetFileInfo {
    path: string;
    name: string;
    default_title?: string;
    default_author?: string;
}

export function MetadataStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const sourceCfg = state.config?.ingestion?.source || {};

    const overrides = sourceCfg.metadata_overrides || {};

    const [isLoading, setIsLoading] = useState(true);
    const [files, setFiles] = useState<TargetFileInfo[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [searchFilter, setSearchFilter] = useState("");

    const filteredFiles = files.filter(f => searchFilter ? f.name.toLowerCase().includes(searchFilter.toLowerCase()) : true);

    // Bulk edit fields state
    const [bulkForm, setBulkForm] = useState({
        tenant: "",
        domain: "",
        subdomain: "",
        author: "",
        tags: "",
        category: "",
        confidentiality: "",
        status: ""
    });

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            try {
                const data = await ipc.listTargetFiles(sourceCfg);
                setFiles(data);
            } catch (err) {
                console.error("Error fetching files:", err);
                setFiles([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceCfg.path, sourceCfg.recursive, sourceCfg.excluded_dirs, sourceCfg.file_types]);

    const handleSelectAll = () => {
        const allSelected = filteredFiles.length > 0 && filteredFiles.every(f => selectedPaths.has(f.path));
        const next = new Set(selectedPaths);
        if (allSelected) {
            filteredFiles.forEach(f => next.delete(f.path));
        } else {
            filteredFiles.forEach(f => next.add(f.path));
        }
        setSelectedPaths(next);
    };

    const handleToggleSelection = (path: string) => {
        const next = new Set(selectedPaths);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setSelectedPaths(next);
    };

    const handleApplyBulk = () => {
        if (selectedPaths.size === 0) return;

        const newOverrides = { ...overrides };
        selectedPaths.forEach(path => {
            const current = newOverrides[path] || {};
            if (bulkForm.tenant.trim()) current.tenant = bulkForm.tenant.trim();
            if (bulkForm.domain.trim()) current.domain = bulkForm.domain.trim();
            if (bulkForm.subdomain.trim()) current.subdomain = bulkForm.subdomain.trim();
            if (bulkForm.author.trim()) current.author = bulkForm.author.trim();

            // Convert tags from comma string to array if needed (in wizard we keep it as string or array, let's keep array in models)
            if (bulkForm.tags.trim()) {
                current.tags = bulkForm.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
            }
            if (bulkForm.category.trim()) current.category = bulkForm.category.trim();
            if (bulkForm.confidentiality.trim()) current.confidentiality = bulkForm.confidentiality.trim();
            if (bulkForm.status.trim()) current.status = bulkForm.status.trim();

            newOverrides[path] = current;
        });

        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source.metadata_overrides = newOverrides;
            return cfg;
        });

        // Reset bulk form
        setBulkForm({
            tenant: "", domain: "", subdomain: "", author: "", tags: "", category: "", confidentiality: "", status: ""
        });
    };

    const handleIndividualEdit = (path: string, field: string, value: any) => {
        const newOverrides = { ...overrides };
        const current = newOverrides[path] || {};
        current[field] = value;
        newOverrides[path] = current;

        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source.metadata_overrides = newOverrides;
            return cfg;
        });
    };

    const getSingleSelectedFile = () => {
        if (selectedPaths.size !== 1) return null;
        const path = Array.from(selectedPaths)[0];
        return files.find(f => f.path === path) || null;
    };

    const singleFile = getSingleSelectedFile();

    const inputStyle: React.CSSProperties = {
        width: "100%",
        fontSize: 13,
        borderRadius: 8,
        border: "1px solid var(--border)",
        padding: "8px 10px",
        background: "var(--surface)",
        color: "var(--text)",
    };

    const selectStyle: React.CSSProperties = {
        ...inputStyle,
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text)",
        marginBottom: 4,
    };

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 12, textAlign: "center" }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                    {t('wizard.metadata.title')}
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 8 }}>
                    {t('wizard.metadata.subtitle')}
                </p>
            </div>

            <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 16 }}>

                {/* Left side: Table */}
                <div
                    className="loko-panel"
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        transition: "all .3s",
                    }}
                >
                    <div style={{ padding: 12, borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                        <input
                            type="text"
                            placeholder={t('wizard.metadata.filterPlaceholder')}
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            style={{ ...inputStyle, background: "var(--surface)" }}
                        />
                    </div>
                    {isLoading ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 12 }}>
                            <Loader2 className="w-5 h-5 animate-spin" /> {t('wizard.metadata.analyzing')}
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>{t('wizard.metadata.noFiles')}</div>
                    ) : (
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            <table style={{ width: "100%", textAlign: "left", fontSize: 13, whiteSpace: "nowrap" }}>
                                <thead style={{ background: "var(--surface-2)", color: "var(--text-2)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: 12, width: 40 }}>
                                            <button onClick={handleSelectAll} style={{ padding: 4, borderRadius: 4, cursor: "pointer", background: "transparent", border: "none" }} title="Tout selectionner">
                                                <CheckSquare style={{ width: 16, height: 16, color: filteredFiles.length > 0 && filteredFiles.every(f => selectedPaths.has(f.path)) ? "var(--brand)" : "var(--text-3)" }} />
                                            </button>
                                        </th>
                                        <th style={{ padding: 12, fontWeight: 600 }}>{t('wizard.metadata.file')}</th>
                                        <th style={{ padding: 12, fontWeight: 600, width: 192 }}>{t('wizard.metadata.docTitle')}</th>
                                        <th style={{ padding: 12, fontWeight: 600, width: 160 }}>{t('wizard.metadata.author')}</th>
                                        <th style={{ padding: 12, fontWeight: 600, width: 128 }}>{t('wizard.metadata.domain')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFiles.map(f => {
                                        const fileOverrides = overrides[f.path] || {};
                                        const isSelected = selectedPaths.has(f.path);

                                        return (
                                            <tr
                                                key={f.path}
                                                onClick={() => handleToggleSelection(f.path)}
                                                style={{
                                                    cursor: "pointer",
                                                    background: isSelected ? "var(--brand-weak)" : "transparent",
                                                    borderBottom: "1px solid var(--border)",
                                                    transition: "background .1s",
                                                }}
                                            >
                                                <td style={{ padding: 12, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelection(f.path)}
                                                        className="w-4 h-4 text-brand-600 rounded pointer-events-auto"
                                                    />
                                                </td>
                                                <td style={{ padding: 12 }}>
                                                    <div style={{ fontWeight: 500, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                                                        <FileText style={{ width: 14, height: 14, color: "var(--brand)" }} />
                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }} title={f.name}>{f.name}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2, maxWidth: 200 }} title={f.path}>{f.path}</div>
                                                </td>
                                                <td style={{ padding: 12, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150, color: "var(--text-2)" }} title={fileOverrides.title || f.name.replace(/\.[^/.]+$/, "")}>
                                                    {fileOverrides.title || <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>{f.name.replace(/\.[^/.]+$/, "")}</span>}
                                                </td>
                                                <td style={{ padding: 12, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120, color: "var(--text-2)" }}>
                                                    {fileOverrides.author || '-'}
                                                </td>
                                                <td style={{ padding: 12, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100, color: "var(--text-2)" }}>
                                                    {fileOverrides.domain || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right side: Dynamic Edit Panel */}
                {selectedPaths.size > 0 && (
                    <div
                        className="loko-panel animate-in slide-in-from-right-4 duration-300"
                        style={{
                            width: "33%",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            alignSelf: "flex-start",
                            maxHeight: "100%",
                        }}
                    >
                        <div style={{ padding: 16, borderBottom: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
                            <Settings2 style={{ width: 20, height: 20, color: "var(--brand)" }} />
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                                    {selectedPaths.size === 1 ? t('wizard.metadata.editSingle') : t('wizard.metadata.editBulk')}
                                </div>
                                <p style={{ fontSize: 12, color: "var(--text-3)" }}>{t('wizard.metadata.selectedCount', { count: selectedPaths.size })}</p>
                            </div>
                        </div>

                        <div style={{ padding: 20, overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16 }}>

                            {/* Title (Only for single edit) */}
                            {selectedPaths.size === 1 && singleFile && (
                                <div>
                                    <label style={labelStyle}>{t('wizard.metadata.docTitle')}</label>
                                    <input
                                        type="text"
                                        value={(overrides[singleFile.path] || {}).title || ""}
                                        onChange={e => handleIndividualEdit(singleFile.path, 'title', e.target.value)}
                                        placeholder={singleFile.name}
                                        style={inputStyle}
                                    />
                                </div>
                            )}

                            {/* Common Fields */}
                            {[
                                { id: 'author', label: t('wizard.metadata.author'), placeholder: t('wizard.metadata.placeholderAuthor') },
                                { id: 'tenant', label: t('wizard.metadata.tenant'), placeholder: t('wizard.metadata.placeholderTenant') },
                                { id: 'domain', label: t('wizard.metadata.domain'), placeholder: t('wizard.metadata.placeholderDomain') },
                                { id: 'subdomain', label: t('wizard.metadata.subdomain'), placeholder: t('wizard.metadata.placeholderSubdomain') },
                                { id: 'category', label: t('wizard.metadata.category'), placeholder: t('wizard.metadata.placeholderCategory') },
                            ].map(field => (
                                <div key={field.id}>
                                    <label style={labelStyle}>{field.label}</label>
                                    <input
                                        type="text"
                                        value={selectedPaths.size === 1 ? ((overrides[singleFile?.path || ""] || {})[field.id] || "") : (bulkForm as any)[field.id]}
                                        onChange={e => {
                                            if (selectedPaths.size === 1 && singleFile) {
                                                handleIndividualEdit(singleFile.path, field.id, e.target.value);
                                            } else {
                                                setBulkForm({ ...bulkForm, [field.id]: e.target.value });
                                            }
                                        }}
                                        placeholder={field.placeholder}
                                        style={inputStyle}
                                    />
                                </div>
                            ))}

                            <div>
                                <label style={labelStyle}>{t('wizard.metadata.tags')}</label>
                                <input
                                    type="text"
                                    value={selectedPaths.size === 1 ? (((overrides[singleFile?.path || ""] || {}).tags || []).join(', ')) : bulkForm.tags}
                                    onChange={e => {
                                        if (selectedPaths.size === 1 && singleFile) {
                                            const arr = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                                            handleIndividualEdit(singleFile.path, 'tags', arr);
                                        } else {
                                            setBulkForm({ ...bulkForm, tags: e.target.value });
                                        }
                                    }}
                                    placeholder={t('wizard.metadata.placeholderTags') as string}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>{t('wizard.metadata.confidentiality')}</label>
                                    <select
                                        value={selectedPaths.size === 1 ? ((overrides[singleFile?.path || ""] || {}).confidentiality || "") : bulkForm.confidentiality}
                                        onChange={e => {
                                            if (selectedPaths.size === 1 && singleFile) {
                                                handleIndividualEdit(singleFile.path, 'confidentiality', e.target.value);
                                            } else {
                                                setBulkForm({ ...bulkForm, confidentiality: e.target.value });
                                            }
                                        }}
                                        style={selectStyle}
                                    >
                                        <option value="">{t('wizard.metadata.confidentialityNone')}</option>
                                        <option value="public">{t('wizard.metadata.confidentialityPublic')}</option>
                                        <option value="internal">{t('wizard.metadata.confidentialityInternal')}</option>
                                        <option value="confidential">{t('wizard.metadata.confidentialityConfidential')}</option>
                                        <option value="secret">{t('wizard.metadata.confidentialitySecret')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>{t('wizard.metadata.status')}</label>
                                    <select
                                        value={selectedPaths.size === 1 ? ((overrides[singleFile?.path || ""] || {}).status || "") : bulkForm.status}
                                        onChange={e => {
                                            if (selectedPaths.size === 1 && singleFile) {
                                                handleIndividualEdit(singleFile.path, 'status', e.target.value);
                                            } else {
                                                setBulkForm({ ...bulkForm, status: e.target.value });
                                            }
                                        }}
                                        style={selectStyle}
                                    >
                                        <option value="">{t('wizard.metadata.statusNone')}</option>
                                        <option value="draft">{t('wizard.metadata.statusDraft')}</option>
                                        <option value="review">{t('wizard.metadata.statusReview')}</option>
                                        <option value="published">{t('wizard.metadata.statusPublished')}</option>
                                        <option value="archived">{t('wizard.metadata.statusArchived')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Apply / Save Button */}
                        <div style={{ padding: 16, borderTop: "1px solid var(--border)", background: "var(--surface-2)", flexShrink: 0 }}>
                            {selectedPaths.size === 1 ? (
                                <p style={{ fontSize: 12, textAlign: "center", color: "var(--text-3)" }}>{t('wizard.metadata.autoSaved')}</p>
                            ) : (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleApplyBulk}
                                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 500 }}
                                >
                                    <Save style={{ width: 16, height: 16 }} /> {t('wizard.metadata.applyBulk', { count: selectedPaths.size })}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}
