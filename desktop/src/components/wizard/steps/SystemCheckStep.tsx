import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ipc } from "@/lib/ipc";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function SystemCheckStep({ wizard }: { wizard: any }) {
    const [env, setEnv] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        ipc.detectEnvironment()
            .then(res => setEnv(res))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Vérification du système</h1>
            <p className="text-gray-500 mb-8">Nous analysons votre environnement pour configurer RAGKIT de manière optimale.</p>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="space-y-4 mb-8">
                    <div className="p-4 rounded-lg border flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">Ollama (Modèles locaux)</h3>
                            <p className="text-sm text-gray-500">Permet d'exécuter des modèles d'IA sur votre propre machine de manière sécurisée.</p>
                        </div>
                        {env?.ollama_available ? <CheckCircle2 className="text-green-500 w-6 h-6" /> : <XCircle className="text-gray-400 w-6 h-6" />}
                    </div>

                    <div className="p-4 rounded-lg border flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">Accélération Matérielle (GPU)</h3>
                            <p className="text-sm text-gray-500">Améliore significativement la vitesse d'ingestion et de génération.</p>
                        </div>
                        {env?.gpu_available ? <CheckCircle2 className="text-green-500 w-6 h-6" /> : <XCircle className="text-gray-400 w-6 h-6" />}
                    </div>

                    {env?.ollama_available && env.local_models && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">Modèles détectés</h4>
                            <div className="flex flex-wrap gap-2">
                                {env.local_models.length > 0 ? env.local_models.map((m: string) => (
                                    <span key={m} className="px-2 py-1 bg-white dark:bg-gray-700 border rounded text-xs">{m}</span>
                                )) : <span className="text-sm text-gray-500 italic">Aucun modèle n'est téléchargé.</span>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button onClick={() => wizard.nextStep()} disabled={loading}>
                    Continuer
                </Button>
            </div>
        </div>
    );
}
