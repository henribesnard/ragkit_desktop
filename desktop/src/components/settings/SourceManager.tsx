import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Database, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { useSources } from "@/hooks/useSources";
import { SourceCard } from "./SourceCard";
import { SourceAddDialog } from "./SourceAddDialog";


export function SourceManager() {
    const { 
        sources, 
        sourceTypes, 
        loading, 
        error, 
        fetchSources,
        addSource, 
        updateSource, 
        deleteSource, 
        testConnection, 
        syncSource 
    } = useSources();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<any>(null);

    const handleAdd = async (source: any) => {
        if (source.id) {
            await updateSource(source.id, source);
        } else {
            await addSource(source);
        }
    };

    const handleEdit = (source: any) => {
        setEditingSource(source);
        setIsAddDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsAddDialogOpen(false);
        setEditingSource(null);
    };

    if (loading && sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Chargement des sources...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sources de connaissances</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Gérez vos documents, liens web et flux de données.</p>
                    </div>
                </div>
                <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 h-10 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle source
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">Erreur de chargement</p>
                        <p className="text-sm text-red-700 dark:text-red-300 opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-900/20 text-center">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4">
                        <Database className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">Aucune source configurée</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6 font-medium">
                        Ajoutez votre première source pour permettre au LOKO de construire sa base de connaissances.
                    </p>
                    <Button 
                        variant="outline" 
                        onClick={() => setIsAddDialogOpen(true)}
                        className="rounded-full px-6 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Choisir une source
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sources.map(source => (
                        <SourceCard 
                            key={source.id} 
                            source={source} 
                            onEdit={handleEdit}
                            onDelete={deleteSource}
                            onSync={syncSource}
                            onTest={testConnection}
                        />
                    ))}
                    
                    {/* Ghost Add card */}
                    <button 
                        onClick={() => setIsAddDialogOpen(true)}
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-100 dark:border-gray-800 hover:border-emerald-400/50 dark:hover:border-emerald-600/50 rounded-xl bg-gray-50/30 dark:bg-gray-900/10 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/5 transition-all group"
                    >
                        <div className="p-2 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-full text-gray-300 dark:text-gray-700 group-hover:text-emerald-400 transition-colors">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-600 mt-2 uppercase tracking-widest">Ajouter une source</span>
                    </button>
                </div>
            )}

            <SourceAddDialog 
                isOpen={isAddDialogOpen} 
                onClose={handleCloseDialog}
                onAdd={handleAdd}
                editingSource={editingSource}
                sourceTypes={sourceTypes}
                onRefresh={fetchSources}
            />
        </div>
    );
}
