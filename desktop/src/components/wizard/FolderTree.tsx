import { ChevronRight, ChevronDown, Folder, FolderOpen, Check } from "lucide-react";
import { useState } from "react";

function cn(...inputs: (string | undefined | null | false)[]) {
    return inputs.filter(Boolean).join(" ");
}

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
    const [isOpen, setIsOpen] = useState(depth < 1); // Expand first level by default
    const isExcluded = excludedFolders.includes(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center py-1 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm",
                    isExcluded && "opacity-50"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                <div
                    className="mr-1 p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                >
                    {hasChildren ? (
                        isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : <div className="w-4 h-4" />}
                </div>

                <div
                    className="mr-2 cursor-pointer flex items-center justify-center w-4 h-4 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExclusion(node.path);
                    }}
                >
                    {!isExcluded && <Check className="w-3 h-3 text-blue-500" />}
                </div>

                <div className="flex items-center gap-2 flex-1" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <FolderOpen className="w-4 h-4 text-blue-500" /> : <Folder className="w-4 h-4 text-blue-500" />}
                    <span className={cn("truncate", isExcluded && "line-through text-gray-400")}>{node.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{node.file_count} fichiers</span>
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
    if (!path) {
        return (
            <div className="border rounded-md p-8 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-48 flex flex-col items-center justify-center text-gray-400">
                <Folder className="w-8 h-8 mb-2 opacity-50" />
                <p>Veuillez sélectionner un dossier pour voir son contenu.</p>
            </div>
        );
    }

    if (!tree) {
        return (
            <div className="border rounded-md p-8 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-48 flex items-center justify-center text-gray-500 italic">
                Analyse du dossier en cours...
            </div>
        );
    }

    return (
        <div className="border rounded-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-64 flex flex-col">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 flex justify-between">
                <span>Arborescence</span>
                <span>{excludedFolders.length} dossier(s) exclu(s)</span>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
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
