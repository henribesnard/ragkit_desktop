import { useVectorStoreConfig } from "@/hooks/useVectorStoreConfig";

export function VectorStoreSettings() {
  const { config, stats, loading, updateConfig, testConnection, deleteCollection } = useVectorStoreConfig();
  if (loading || !config) return <div>Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold mb-3">Provider</h3>
        <select className="border rounded px-2 py-1" value={config.provider} onChange={(e) => updateConfig({ ...config, provider: e.target.value })}>
          <option value="qdrant">Qdrant</option>
          <option value="chroma">ChromaDB</option>
        </select>
      </div>
      <div className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-2">
        <h3 className="font-semibold">Collection</h3>
        <input className="border rounded px-2 py-1 w-full" value={config.collection_name} onChange={(e) => updateConfig({ ...config, collection_name: e.target.value })} />
        <select className="border rounded px-2 py-1" value={config.mode} onChange={(e) => updateConfig({ ...config, mode: e.target.value })}>
          <option value="persistent">persistent</option>
          <option value="memory">memory</option>
        </select>
        <input className="border rounded px-2 py-1 w-full" value={config.path} onChange={(e) => updateConfig({ ...config, path: e.target.value })} />
        <p className="text-xs text-gray-500">{stats?.vectors_count ?? 0} vecteurs · {stats?.dimensions ?? 0} dimensions · {stats?.size_bytes ?? 0} bytes</p>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => testConnection()}>Tester la connexion</button>
        <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={() => deleteCollection()}>Supprimer la collection</button>
      </div>
    </div>
  );
}
