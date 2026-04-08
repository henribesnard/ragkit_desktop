import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface S3BucketFormProps {
    config: any;
    onChange: (config: any) => void;
}

export function S3BucketForm({ config, onChange }: S3BucketFormProps) {
    const fileTypes = config.file_types || [];
    const credential = config.credential || {};

    const setCredential = (next: Record<string, any>) => {
        const hasValue = Object.values(next).some((value) => String(value || "").trim());
        if (hasValue) {
            onChange({ ...config, credential: next });
        } else {
            const { credential: _removed, ...rest } = config;
            onChange(rest);
        }
    };

    const updateCredential = (key: string, value: string) => {
        setCredential({ ...credential, [key]: value });
    };

    const updateList = (key: string, index: number, value: string) => {
        const current = [...(config[key] || [])];
        current[index] = value;
        onChange({ ...config, [key]: current });
    };

    const addListItem = (key: string) => {
        const current = [...(config[key] || [])];
        current.push("");
        onChange({ ...config, [key]: current });
    };

    const removeListItem = (key: string, index: number) => {
        const current = [...(config[key] || [])];
        current.splice(index, 1);
        onChange({ ...config, [key]: current });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bucket</label>
                    <input
                        type="text"
                        value={config.bucket || ""}
                        onChange={(e) => onChange({ ...config, bucket: e.target.value })}
                        placeholder="my-bucket"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                    <input
                        type="text"
                        value={config.region || ""}
                        onChange={(e) => onChange({ ...config, region: e.target.value })}
                        placeholder="eu-west-1"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prefix</label>
                    <input
                        type="text"
                        value={config.prefix || ""}
                        onChange={(e) => onChange({ ...config, prefix: e.target.value })}
                        placeholder="documents/"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint (MinIO)</label>
                    <input
                        type="text"
                        value={config.endpoint_url || ""}
                        onChange={(e) => onChange({ ...config, endpoint_url: e.target.value })}
                        placeholder="https://minio.local"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access key</label>
                    <input
                        type="text"
                        value={credential.aws_access_key_id || ""}
                        onChange={(e) => updateCredential("aws_access_key_id", e.target.value)}
                        placeholder="AKIA..."
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secret key</label>
                    <input
                        type="password"
                        value={credential.aws_secret_access_key || ""}
                        onChange={(e) => updateCredential("aws_secret_access_key", e.target.value)}
                        placeholder="••••••"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Types de fichiers</label>
                <div className="space-y-2">
                    {fileTypes.map((ft: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={ft}
                                onChange={(e) => updateList("file_types", index, e.target.value)}
                                placeholder="pdf"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("file_types", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("file_types")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un type
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="s3-recursive"
                        checked={config.recursive !== false}
                        onChange={(e) => onChange({ ...config, recursive: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="s3-recursive" className="text-sm text-gray-700 dark:text-gray-300">Scanner recursif</label>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taille max (Mo)</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_file_size_mb || 50}
                        onChange={(e) => onChange({ ...config, max_file_size_mb: parseInt(e.target.value) || 50 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>
        </div>
    );
}
