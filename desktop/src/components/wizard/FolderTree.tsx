import { ChevronRight, ChevronDown, Folder, FolderOpen, Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface FolderNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FolderNode[];
    file_count: number;
}

interface FolderTreeProps {
    path: string | null;
    tree: FolderNode | null;
    excludedFolders: string[];
    onToggleExclusion: (path: string) => void;
}

const TreeNode = ({ node, depth, excludedFolders, onToggleExclusion }: { node: FolderNode, depth: number, excludedFolders: string[], onToggleExclusion: (path: string) => void }) => {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const isExcluded = excludedFolders.includes(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "4px 8px",
                    paddingLeft: depth * 16 + 8,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    opacity: isExcluded ? 0.5 : 1,
                    transition: "background .1s",
                }}
                className="folder-tree-row"
            >
                <div
                    style={{ marginRight: 4, padding: 2, borderRadius: 3 }}
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                >
                    {hasChildren ? (
                        isOpen ? <ChevronDown size={14} style={{ color: "var(--text-3)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-3)" }} />
                    ) : <div style={{ width: 14, height: 14 }} />}
                </div>

                <div
                    style={{
                        marginRight: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        border: "1px solid var(--border-strong)",
                        borderRadius: 4,
                        background: "var(--surface)",
                    }}
                    onClick={(e) => { e.stopPropagation(); onToggleExclusion(node.path); }}
                >
                    {!isExcluded && <Check size={12} style={{ color: "var(--brand)" }} />}
                </div>

                <div
                    style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen
                        ? <FolderOpen size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />
                        : <Folder size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />
                    }
                    <span
                        style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textDecoration: isExcluded ? "line-through" : "none",
                            color: isExcluded ? "var(--text-3)" : "var(--text)",
                        }}
                    >
                        {node.name}
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            color: "var(--text-3)",
                            fontFamily: "var(--font-mono)",
                            flexShrink: 0,
                        }}
                    >
                        {node.file_count}
                    </span>
                </div>
            </div>

            {isOpen && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            excludedFolders={excludedFolders}
                            onToggleExclusion={onToggleExclusion}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function FolderTree({ path, tree, excludedFolders, onToggleExclusion }: FolderTreeProps) {
    const { t } = useTranslation();

    if (!path) {
        return (
            <div
                className="loko-panel"
                style={{
                    padding: 32,
                    height: 192,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-3)",
                    fontSize: 13,
                }}
            >
                <Folder size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                <p>{t('wizard.source.selectFolderPrompt', 'Veuillez sélectionner un dossier pour voir son contenu.')}</p>
            </div>
        );
    }

    if (!tree) {
        return (
            <div
                className="loko-panel"
                style={{
                    padding: 32,
                    height: 192,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-3)",
                    fontSize: 13,
                    fontStyle: "italic",
                }}
            >
                {t('wizard.source.analyzingFolder', 'Analyse du dossier en cours...')}
            </div>
        );
    }

    return (
        <div
            className="loko-panel"
            style={{ display: "flex", flexDirection: "column", height: 256, fontSize: 13 }}
        >
            <div
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text-3)",
                    display: "flex",
                    justifyContent: "space-between",
                    borderRadius: "12px 12px 0 0",
                }}
            >
                <span>{t('wizard.source.treeView', 'Arborescence')}</span>
                <span>{excludedFolders.length} {t('wizard.source.excluded', 'exclu(s)')}</span>
            </div>
            <div className="loko-scroll" style={{ flex: 1, overflow: "auto", padding: 8 }}>
                <TreeNode
                    node={tree}
                    depth={0}
                    excludedFolders={excludedFolders}
                    onToggleExclusion={onToggleExclusion}
                />
            </div>
        </div>
    );
}
