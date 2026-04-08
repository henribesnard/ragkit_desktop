import { Button } from "@/components/ui/Button";
import { 
    Folder, 
    Globe, 
    Rss, 
    Play, 
    Trash2, 
    Settings2, 
    CheckCircle2, 
    AlertCircle, 
    Clock,
    Pause,
    RefreshCw
} from "lucide-react";
import { formatRelativeTime } from "@/lib/date";
import { cn } from "@/lib/cn";

interface SourceCardProps {
    source: any;
    onEdit: (source: any) => void;
    onDelete: (id: string) => void;
    onSync: (id: string) => void;
    onTest: (id: string) => void;
}

export function SourceCard({ source, onEdit, onDelete, onSync, onTest }: SourceCardProps) {
    const getIcon = () => {
        switch (source.type) {
            case "local_directory": return <Folder className="w-5 h-5" />;
            case "web_url": return <Globe className="w-5 h-5" />;
            case "rss_feed": return <Rss className="w-5 h-5" />;
            default: return <Folder className="w-5 h-5" />;
        }
    };

    const getStatusInfo = () => {
        switch (source.status) {
            case "active": return { color: "text-emerald-500", icon: <CheckCircle2 className="w-3 h-3" />, label: "Actif" };
            case "syncing": return { color: "text-blue-500 animate-pulse", icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: "Synchronisation..." };
            case "error": return { color: "text-red-500", icon: <AlertCircle className="w-3 h-3" />, label: "Erreur" };
            case "paused": return { color: "text-gray-400", icon: <Pause className="w-3 h-3" />, label: "En pause" };
            default: return { color: "text-gray-400", icon: null, label: source.status };
        }
    };

    const status = getStatusInfo();

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-gray-50 dark:bg-gray-900 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 transition-colors", status.color)}>
                        {getIcon()}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">{source.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider", status.color)}>
                                {status.icon}
                                {status.label}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{source.type.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onTest(source.id)} title="Tester la connexion">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(source)} title="Paramètres">
                        <Settings2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Dernière sync
                    </span>
                    <span>
                        {formatRelativeTime(source.last_sync_at)}
                    </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5" />
                        Documents
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{source.document_count || 0}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30"
                    onClick={() => onSync(source.id)}
                    disabled={source.status === "syncing"}
                >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Sync
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-100 dark:border-red-900/30"
                    onClick={() => onDelete(source.id)}
                >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Supprim.
                </Button>
            </div>
        </div>
    );
}
