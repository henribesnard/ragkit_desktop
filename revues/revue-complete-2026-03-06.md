# Revue complete du code - 2026-03-06

## Perimetre
- Backend Python (`ragkit/`)
- Bridge desktop Rust/Tauri (`desktop/src-tauri/`)
- Frontend React/TypeScript (`desktop/src/`)
- Qualite outillee: tests, lint, checks compilation

## Findings (ordonnes par severite)

### [CRITIQUE] Effets de bord a l'import dans `ragkit.desktop.main` cassent la testabilite
- References:
  - `ragkit/desktop/main.py:24`
  - `ragkit/desktop/main.py:27`
  - `ragkit/desktop/main.py:33`
- Observation:
  - Le module configure le logging fichier au moment de l'import (creation du handler + `basicConfig`), avant `create_app()`/`main()`.
  - En execution `python -m pytest -q`, la collecte echoue avec `PermissionError` sur `C:\Users\henri\.loko\logs\ragkit-backend.log`.
- Impact:
  - Les tests d'integration qui importent `create_app` ne peuvent pas etre collectes.
  - Le code est fragile des qu'un lock fichier existe sur le log.
- Recommandation:
  - Deplacer toute initialisation I/O (logs, dossiers, handlers) dans une fonction appelee explicitement au demarrage du process.
  - Garder `create_app()` pur (sans side effects globaux).

### [HAUT] Endpoint `/api/test-question` non fonctionnel (appel provider invalide)
- References:
  - `ragkit/desktop/api/security.py:224`
  - `ragkit/desktop/api/security.py:225`
  - `ragkit/llm/base.py:50`
- Observation:
  - `provider.generate(prompt)` est appele avec un `str`, alors que l'interface attend `messages: list[LLMMessage]`.
  - Le code fait ensuite `response.strip()` alors que `generate()` retourne un `LLMResponse`.
  - L'exception est avalee (`except Exception: pass`), donc fallback silencieux vers la question par defaut.
- Impact:
  - La generation de question test IA est en pratique desactivee.
  - Le bug est masque en prod.
- Recommandation:
  - Construire `messages=[LLMMessage(role="user", content=prompt)]`.
  - Lire `response.content`.
  - Logger explicitement l'erreur au lieu de la masquer.

### [HAUT] Purge "all data" incomplete: mauvais chemin de base de logs
- References:
  - `ragkit/desktop/api/security.py:108`
  - `ragkit/monitoring/query_logger.py:112`
- Observation:
  - Le purge supprime `~/.loko/query_logs.db`.
  - Le logger reel stocke dans `~/.loko/logs/queries.db`.
- Impact:
  - Les journaux de requetes peuvent rester presents apres "purge all", risque conformite/confidentialite.
- Recommandation:
  - Supprimer explicitement `~/.loko/logs/queries.db` (ou tout `~/.loko/logs/` selon la politique produit).
  - Ajouter un test de non-regression sur purge.

### [MOYEN] Export conversation ne tient pas compte de la conversation active
- References:
  - `ragkit/desktop/api/security.py:172`
  - `ragkit/desktop/api/security.py:182`
  - `desktop/src/components/chat/ConversationExportMenu.tsx:21`
  - `desktop/src/hooks/useConfigExport.ts:61`
- Observation:
  - L'API export utilise `_get_conversation_memory()` sans `conversation_id` (conversation par defaut).
  - Le frontend n'envoie pas d'identifiant de conversation.
- Impact:
  - En multi-conversations, export potentiellement du mauvais contenu.
- Recommandation:
  - Ajouter `conversation_id` au payload export (frontend + backend).
  - Charger depuis SQLite par `conversation_id`.

### [MOYEN] Fallback chiffrement secrets: schema faible (deterministe, non standard)
- References:
  - `ragkit/security/secrets.py:35`
  - `ragkit/security/secrets.py:39`
  - `ragkit/security/secrets.py:48`
  - `ragkit/security/secrets.py:55`
- Observation:
  - Le fallback utilise XOR stream maison + HMAC, cle derivee de metadonnees machine/utilisateur, sans nonce aleatoire.
  - Chiffrement deterministe (meme entree -> meme sortie), sans primitive AEAD standard.
- Impact:
  - Protection inferieure aux attentes pour des cles API au repos.
- Recommandation:
  - Remplacer par une primitive standard (ex: `Fernet`/AES-GCM) avec nonce aleatoire.
  - Continuer de preferer keyring systeme quand disponible.

### [MOYEN] Arret backend trop large: tue des processus hors scope
- References:
  - `desktop/src-tauri/src/backend.rs:121`
  - `desktop/src-tauri/src/backend.rs:128`
- Observation:
  - En dernier recours, `taskkill /IM ragkit-backend.exe` (Windows) et `pkill -f ragkit-backend` (Unix) sont globaux.
- Impact:
  - Peut tuer une autre instance legitime (autre session/projet).
- Recommandation:
  - Tuer uniquement le PID enfant demarre par l'application.
  - Eviter le kill par nom/process pattern global.

### [MOYEN] Auto-ingestion: detection de changements couteuse en I/O
- References:
  - `ragkit/desktop/ingestion_runtime.py:234`
  - `ragkit/desktop/ingestion_runtime.py:290`
  - `ragkit/desktop/ingestion_runtime.py:227`
- Observation:
  - La boucle auto (30s) relit les fichiers et recalcule SHA-256 de tout le corpus pour detecter les changements.
- Impact:
  - Forte charge disque/CPU sur gros jeux documentaires.
- Recommandation:
  - Court-circuiter par `(mtime,size)` puis hasher uniquement les candidats modifies.
  - Eventuellement watcher OS natif.

### [FAIBLE] Dette qualite immediate
- References:
  - `desktop/src-tauri/src/backend.rs:2`
  - `desktop/src-tauri/src/backend.rs:21`
  - `tests/config/test_config_export.py:6`
  - `tests/retrieval/test_rerankers.py:8`
- Observation:
  - `cargo clippy` remonte 2 warnings (import inutilise + variant non utilise).
  - `ruff check ragkit tests` remonte 5 imports inutilises (tests).
- Impact:
  - N'affecte pas directement le runtime, mais degrade la maintainabilite.
- Recommandation:
  - Nettoyer ces warnings pour garder un signal lint exploitable.

## Questions / hypotheses
- Je suppose que "purge all data" doit supprimer les journaux de requetes de monitoring (a confirmer si retention differenciee voulue).
- Je suppose que l'export conversation doit cibler la conversation selectionnee (et non la conversation par defaut), vu la presence d'un systeme multi-conversations.

## Resultats des checks executes
- `python -m pytest -q`
  - Echec collecte: 6 erreurs `PermissionError` sur `~/.loko/logs/ragkit-backend.log` (import de `ragkit.desktop.main`).
- `ruff check ragkit tests`
  - 5 erreurs (imports inutilises), toutes fixables automatiquement.
- `npm run lint` (dans `desktop/`)
  - OK.
- `npx tsc --noEmit` (dans `desktop/`)
  - OK.
- `cargo clippy --all-targets --all-features` (dans `desktop/src-tauri/`)
  - OK avec 2 warnings.
- `cargo test` (dans `desktop/src-tauri/`)
  - 0 tests executes.

## Priorites proposees
1. Bloquants fiabilite/tests: `main.py` import side effects.
2. Correctifs fonctionnels: `/api/test-question`, purge logs path, export conversation ciblee.
3. Risques securite/ops: fallback secrets, arret backend global.
4. Performance ingestion auto: optimisation `detect_changes`.
5. Hygiene qualite: warnings ruff/clippy.
