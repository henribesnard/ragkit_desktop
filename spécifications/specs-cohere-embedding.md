# Plan d'implémentation : Ajouter Cohere comme fournisseur d'embedding dans le Wizard

**Date** : 2026-03-06
**Version cible** : v1.5.x
**Complexité** : Faible (le backend supporte déjà Cohere, seul le frontend wizard doit être modifié)

---

## 1. Contexte

Actuellement, l'étape d'embedding du wizard (étape 7/15) propose trois fournisseurs :
- **HuggingFace** (local, recommandé) — `intfloat/multilingual-e5-large`
- **OpenAI API** (cloud, payant) — `text-embedding-3-small` / `text-embedding-3-large`
- **Ollama** (local, gratuit) — modèles détectés dynamiquement

Cohere est pourtant un fournisseur d'embedding performant et multilingue, et **le backend le supporte déjà entièrement** :
- `EmbeddingProvider.COHERE` existe dans le schéma (`ragkit/config/embedding_schema.py:13`)
- Le moteur d'embedding gère Cohere (`ragkit/embedding/engine.py:95-96`, `_embed_cohere`, `_batch_cohere`)
- Le catalogue contient un modèle Cohere (`ragkit/embedding/catalog.py:18-20`)
- L'API backend gère les clés API Cohere (`ragkit/desktop/api/embedding.py:150-151`)
- La page de paramètres avancés (`EmbeddingSettings.tsx:166`) liste déjà Cohere dans le dropdown

**Il manque uniquement** : le choix Cohere dans le wizard + les clés de traduction associées.

De plus, Cohere propose aussi un service de **reranking** (étape 13 du wizard). Les deux services utilisent des architectures de modèles fondamentalement différentes :
- **Embedding** : modèles encodeurs (bi-encoder) — ex: `embed-multilingual-v3.0`
- **Reranking** : modèles cross-encodeurs — ex: `rerank-v3.5`

Utiliser Cohere pour les deux est **recommandé** (et non déconseillé). Cependant, il est utile d'afficher un rappel informatif dans l'étape de reranking pour indiquer quel fournisseur d'embedding a été choisi, car :
- L'utilisateur pourrait croire qu'il utilise "le même modèle" pour les deux
- Cela améliore la transparence de la configuration

---

## 2. Architecture existante (référence rapide)

### Flux Wizard → Backend

```
EmbeddingStep.tsx
  → invoke("store_secret", { keyName: "loko.embedding.cohere.api_key", value: apiKey })
  → ipc.testEmbeddingConnection(provider, model)
    → invoke("test_embedding_connection", { provider, model })
      → Rust commands.rs:225 → GET /api/embedding/test-connection?provider=cohere&model=...
        → embedding.py:137 → EmbeddingEngine.test_connection()
```

### Fichiers impliqués

| Fichier | Rôle | Action requise |
|---------|------|----------------|
| `desktop/src/components/wizard/steps/EmbeddingStep.tsx` | UI wizard embedding | Ajouter bouton Cohere + sous-formulaire |
| `desktop/src/locales/fr.json` | Traductions FR | Ajouter clés `wizard.embedding.cohere*` |
| `desktop/src/locales/en.json` | Traductions EN | Ajouter clés `wizard.embedding.cohere*` |
| `desktop/src/components/wizard/steps/RerankingStep.tsx` | UI wizard reranking | Ajouter bannière informative embedding provider |
| `ragkit/embedding/catalog.py` | Catalogue de modèles | Ajouter `embed-multilingual-light-v3.0` |
| `ragkit/config/embedding_schema.py` | Schéma Pydantic | Aucune modification (Cohere déjà défini) |
| `ragkit/embedding/engine.py` | Moteur d'embedding | Aucune modification (Cohere déjà implémenté) |
| `ragkit/desktop/api/embedding.py` | API FastAPI | Aucune modification (Cohere déjà géré) |
| `desktop/src-tauri/src/commands.rs` | Commandes Rust | Aucune modification |
| `desktop/src/lib/ipc.ts` | IPC frontend | Aucune modification |

---

## 3. Modifications détaillées

### 3.1. `desktop/src/components/wizard/steps/EmbeddingStep.tsx`

**Objectif** : Ajouter un 4e bouton de choix "Cohere API" et le sous-formulaire correspondant.

#### 3.1.1. Ajouter le bouton Cohere dans la grille de sélection

Le composant utilise une grille de 3 colonnes (`grid-cols-1 md:grid-cols-3`). Il faut passer à **4 colonnes** et ajouter un bouton Cohere.

**Localisation** : après le bouton Ollama (ligne 134), avant la `</div>` fermante de la grille.

```tsx
// Changer la classe de la grille :
// AVANT : "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
// APRES : "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"

// Ajouter le 4e bouton (après le bouton Ollama, avant la </div> ligne 135) :
<button
    onClick={() => updateEmbedding({ provider: "cohere" })}
    className={`p-4 rounded-xl border-2 text-left transition-all ${
        provider === "cohere"
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-200 dark:border-gray-700"
    }`}
>
    <div className="flex items-center gap-3 mb-2">
        <Key className={`w-5 h-5 ${provider === "cohere" ? "text-blue-600" : "text-gray-400"}`} />
        <h3 className="font-semibold text-lg">{t('wizard.embedding.cohereApi')}</h3>
    </div>
    <p className="text-sm text-gray-500">{t('wizard.embedding.cohereApiDesc')}</p>
</button>
```

#### 3.1.2. Ajouter le sous-formulaire Cohere

**Localisation** : après le bloc `{provider === "huggingface" && (...)}` (ligne 201), avant le `<div className="pt-4 border-t ...">` (ligne 203).

```tsx
{provider === "cohere" && (
    <>
        <div>
            <label className="block font-medium mb-1 text-sm">
                {t('wizard.embedding.cohereModel')}
            </label>
            <select
                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                value={model}
                onChange={(e) => updateEmbedding({ model: e.target.value })}
            >
                <option value="embed-multilingual-v3.0">
                    {t('wizard.embedding.cohereMultilingual')}
                </option>
                <option value="embed-multilingual-light-v3.0">
                    {t('wizard.embedding.cohereMultilingualLight')}
                </option>
            </select>
        </div>
        <div>
            <label className="block font-medium mb-1 text-sm">
                {t('wizard.embedding.cohereKey')}
            </label>
            <input
                type="password"
                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                placeholder="API Key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
                {t('wizard.embedding.cohereKeyDesc')}
            </p>
        </div>
    </>
)}
```

#### 3.1.3. Mettre à jour le `useEffect` de synchronisation provider/model

**Localisation** : lignes 62-69 — le `useEffect` qui force le bon modèle quand le provider change.

Ajouter un cas pour Cohere :

```tsx
useEffect(() => {
    if (provider === "openai" && model !== "text-embedding-3-small" && model !== "text-embedding-3-large") {
        updateEmbedding({ model: "text-embedding-3-small" });
    } else if (provider === "huggingface" && model !== "intfloat/multilingual-e5-large") {
        updateEmbedding({ model: "intfloat/multilingual-e5-large" });
    } else if (provider === "cohere" && model !== "embed-multilingual-v3.0" && model !== "embed-multilingual-light-v3.0") {
        updateEmbedding({ model: "embed-multilingual-v3.0" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [provider, model]);
```

#### 3.1.4. Mettre à jour `handleTest` pour sauvegarder la clé API Cohere

**Localisation** : lignes 76-79 — le bloc qui sauvegarde la clé OpenAI avant le test.

Ajouter le cas Cohere :

```tsx
const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
        if (provider === "openai" && apiKey) {
            await invoke("store_secret", {
                keyName: "loko.embedding.openai.api_key", value: apiKey
            });
        }
        // AJOUTER :
        if (provider === "cohere" && apiKey) {
            await invoke("store_secret", {
                keyName: "loko.embedding.cohere.api_key", value: apiKey
            });
        }
        // ... reste inchangé
    }
};
```

#### 3.1.5. Désactiver le bouton Test si Cohere sans clé API

**Localisation** : ligne 204 — la condition `disabled` du bouton "Tester la connexion".

```tsx
// AVANT :
disabled={isTesting || (provider === "openai" && !apiKey)}

// APRES :
disabled={isTesting || ((provider === "openai" || provider === "cohere") && !apiKey)}
```

---

### 3.2. `desktop/src/locales/fr.json` — section `wizard.embedding`

**Localisation** : après la clé `"testFailed"` (ligne 512), ajouter :

```json
"cohereApi": "Cohere API",
"cohereApiDesc": "API multilingue performante. Nécessite une clé API Cohere.",
"cohereModel": "Modèle Cohere",
"cohereMultilingual": "embed-multilingual-v3.0 (Recommandé)",
"cohereMultilingualLight": "embed-multilingual-light-v3.0 (Rapide & Léger)",
"cohereKey": "Clé API Cohere (COHERE_API_KEY)",
"cohereKeyDesc": "La clé sera stockée de manière sécurisée dans le trousseau de votre OS."
```

---

### 3.3. `desktop/src/locales/en.json` — section `wizard.embedding`

**Localisation** : après la clé `"testFailed"` (ligne 512), ajouter :

```json
"cohereApi": "Cohere API",
"cohereApiDesc": "High-performance multilingual API. Requires a Cohere API key.",
"cohereModel": "Cohere Model",
"cohereMultilingual": "embed-multilingual-v3.0 (Recommended)",
"cohereMultilingualLight": "embed-multilingual-light-v3.0 (Fast & Lightweight)",
"cohereKey": "Cohere API Key (COHERE_API_KEY)",
"cohereKeyDesc": "The key will be stored securely in your OS keychain."
```

---

### 3.4. `ragkit/embedding/catalog.py` — Enrichir le catalogue Cohere

**Localisation** : lignes 18-20 — la liste des modèles Cohere ne contient qu'un seul modèle.

Ajouter `embed-multilingual-light-v3.0` (modèle plus léger et rapide de Cohere) :

```python
EmbeddingProvider.COHERE: [
    ModelInfo(
        provider=EmbeddingProvider.COHERE,
        id="embed-multilingual-v3.0",
        display_name="embed-multilingual-v3.0",
        dimensions_default=1024,
        max_input_tokens=512,
        pricing_hint="~$0.10/1M tokens",
        description="API Cohere multilingue (Recommandé)",
        local=False,
    ),
    ModelInfo(
        provider=EmbeddingProvider.COHERE,
        id="embed-multilingual-light-v3.0",
        display_name="embed-multilingual-light-v3.0",
        dimensions_default=384,
        max_input_tokens=512,
        pricing_hint="~$0.10/1M tokens",
        description="API Cohere multilingue léger (rapide)",
        local=False,
    ),
],
```

**Note** : Vérifier les prix exacts sur la page tarification Cohere avant de publier.

---

### 3.5. `desktop/src/components/wizard/steps/RerankingStep.tsx` — Bannière informative

**Objectif** : Quand l'utilisateur arrive à l'étape de reranking (étape 13), afficher le fournisseur d'embedding qu'il a choisi à l'étape 7. Cela aide à la transparence sans décourager une combinaison valide.

**Localisation** : après le paragraphe de sous-titre (ligne 83), avant le bloc principal `<div className="bg-white ...">` (ligne 86).

```tsx
{/* Lire le provider embedding depuis le state wizard */}
{state.config?.embedding?.provider && (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 text-sm text-blue-800 dark:text-blue-200">
        <p>
            {t('wizard.reranking.embeddingProviderInfo', {
                provider: state.config.embedding.provider === "huggingface"
                    ? "HuggingFace (Local)"
                    : state.config.embedding.provider === "ollama"
                    ? "Ollama (Local)"
                    : state.config.embedding.provider.charAt(0).toUpperCase()
                      + state.config.embedding.provider.slice(1) + " (API)"
            })}
        </p>
    </div>
)}
```

#### Clés de traduction à ajouter

**`fr.json`** — section `wizard.reranking` (après `"testFailed"`, ligne 570) :

```json
"embeddingProviderInfo": "Votre modèle d'embedding utilise {{provider}}. Le re-ranking utilise un type de modèle différent (cross-encodeur) — il est tout à fait compatible et recommandé d'utiliser le même fournisseur pour les deux."
```

**`en.json`** — section `wizard.reranking` :

```json
"embeddingProviderInfo": "Your embedding model uses {{provider}}. Re-ranking uses a different model type (cross-encoder) — it is perfectly compatible and recommended to use the same provider for both."
```

---

## 4. Ce qui ne doit PAS être modifié

Les fichiers suivants supportent déjà Cohere et ne nécessitent **aucune modification** :

| Fichier | Raison |
|---------|--------|
| `ragkit/config/embedding_schema.py` | `EmbeddingProvider.COHERE` déjà défini (ligne 13) |
| `ragkit/embedding/engine.py` | `_embed_cohere()` et `_batch_cohere()` déjà implémentés (lignes 214-227) |
| `ragkit/desktop/api/embedding.py` | Le test de connexion gère Cohere (ligne 150-151), les clés API aussi |
| `desktop/src-tauri/src/commands.rs` | `test_embedding_connection` passe provider/model au backend (ligne 225) |
| `desktop/src/lib/ipc.ts` | `testEmbeddingConnection(provider, model)` accepte tout provider (ligne 14) |
| `desktop/src/components/settings/EmbeddingSettings.tsx` | Cohere déjà listé dans le dropdown (ligne 166) |
| `ragkit/desktop/rerank_service.py` | Indépendant de l'embedding |
| `ragkit/desktop/api/rerank.py` | Indépendant de l'embedding |

---

## 5. Convention des clés API (Secret Store)

Les clés API suivent le pattern `loko.{service}.{provider}.api_key` :

| Service | Provider | Nom de la clé |
|---------|----------|---------------|
| embedding | openai | `loko.embedding.openai.api_key` |
| embedding | cohere | `loko.embedding.cohere.api_key` |
| rerank | cohere | `loko.rerank.cohere.api_key` |
| llm | openai | `loko.llm.openai.api_key` |
| llm | anthropic | `loko.llm.anthropic.api_key` |

**Important** : La clé API embedding Cohere et la clé API reranking Cohere sont **la même clé physique** sur le compte Cohere de l'utilisateur, mais elles sont stockées séparément dans le keyring LOKO pour chaque service. Cela simplifie la gestion (chaque service lit sa propre clé) mais l'utilisateur doit saisir la même clé deux fois s'il utilise Cohere pour les deux services.

---

## 6. Vérification et tests

### 6.1. Build
```bash
cd desktop && npm run build
```
Vérifier qu'il n'y a aucune erreur TypeScript.

### 6.2. Tests manuels

| Scénario | Résultat attendu |
|----------|-----------------|
| Wizard étape 7 : sélectionner Cohere | Le bouton s'active, le formulaire modèle + clé API s'affiche |
| Cohere sélectionné sans clé API | Le bouton "Tester la connexion" est désactivé |
| Cohere sélectionné avec clé API | Le test s'exécute, résultat affiché (succès ou erreur) |
| Test réussi → "Continuer" | Le bouton "Continuer" est activé |
| Changer de Cohere à HuggingFace | Le modèle se réinitialise à `intfloat/multilingual-e5-large` |
| Changer de HuggingFace à Cohere | Le modèle se réinitialise à `embed-multilingual-v3.0` |
| Étape 13 (reranking) après choix Cohere embedding | La bannière informative affiche "Cohere (API)" |
| Étape 13 (reranking) après choix HuggingFace embedding | La bannière informative affiche "HuggingFace (Local)" |
| Page Settings > Embedding : Cohere | Fonctionne déjà (pas de modification nécessaire) |

### 6.3. Tests de régression

- Vérifier que les 3 fournisseurs existants (HuggingFace, OpenAI, Ollama) fonctionnent toujours
- Vérifier que le wizard peut être complété de bout en bout avec chaque provider
- Vérifier que la page Settings > Embedding affiche correctement la config Cohere sauvegardée par le wizard

---

## 7. Résumé des modifications (checklist)

- [ ] `EmbeddingStep.tsx` : Grille 4 colonnes + bouton Cohere + sous-formulaire + useEffect + handleTest + disabled
- [ ] `fr.json` : 7 clés `wizard.embedding.cohere*` + 1 clé `wizard.reranking.embeddingProviderInfo`
- [ ] `en.json` : 7 clés `wizard.embedding.cohere*` + 1 clé `wizard.reranking.embeddingProviderInfo`
- [ ] `RerankingStep.tsx` : Bannière informative embedding provider
- [ ] `catalog.py` : Ajouter `embed-multilingual-light-v3.0`
- [ ] Build OK (`npm run build`)
- [ ] Tests manuels passés
