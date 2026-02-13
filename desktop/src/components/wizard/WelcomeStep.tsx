import { Button } from "@/components/ui/Button";

interface WelcomeStepProps {
    onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center h-full max-w-2xl mx-auto px-6">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">RAGKIT</h1>
                <p className="text-xl text-gray-500 dark:text-gray-400">Votre assistant documentaire intelligent</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 w-full mb-8">
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                    RAGKIT transforme vos documents en une base de connaissances interrogeable par intelligence artificielle.
                </p>

                <div className="space-y-4 text-left bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl">
                    <p className="font-medium text-gray-900 dark:text-white mb-2">En quelques étapes, nous allons :</p>
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-bold">1</span>
                        Analyser votre type de contenu
                    </div>
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-bold">2</span>
                        Sélectionner vos documents
                    </div>
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-bold">3</span>
                        Configurer le système automatiquement
                    </div>
                </div>
            </div>

            <Button size="lg" onClick={onNext} className="w-full sm:w-auto px-8">
                Commencer la configuration →
            </Button>
        </div>
    );
}
