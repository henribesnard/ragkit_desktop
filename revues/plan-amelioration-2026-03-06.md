# Plan d'amelioration - 2026-03-06

Base: revue complete du 2026-03-06.
Chaque observation a ete verifiee dans le code source. Les verdicts et correctifs proposes sont ci-dessous.

---

## Phase 1 - Bloquant fiabilite / tests

### 1.1 Supprimer les effets de bord a l'import dans `main.py`

**Observation confirmee.** Lignes 24-39 de `ragkit/desktop/main.py` executent `ensure_storage_dirs()`, creent un `RotatingFileHandler` et appellent `logging.basicConfig()` au moment de l'import. Cela casse `pytest` avec un `PermissionError` quand le fichier log est verouille.

**Correctif:**
1. Creer une fonction `setup_logging()` dans `main.py` qui encapsule toute l'initialisation I/O (lignes 24-39).
2. Appeler `setup_logging()` uniquement dans `main()` (point d'entree du process), jamais au niveau module.
3. `create_app()` reste pur (pas de side effects globaux).
4. Pour les tests, ajouter une fixture `conftest.py` qui configure un logging minimal en memoire (sans fichier).

**Fichiers concernes:**
- `ragkit/desktop/main.py` (deplacer lignes 24-39 dans `setup_logging()`, appeler depuis `main()`)

**Validation:** `python -m pytest -q` doit passer la collecte sans `PermissionError`.

---

## Phase 2 - Correctifs fonctionnels

### 2.1 Corriger `/api/test-question` (appel provider invalide)

**Observation confirmee.** `ragkit/desktop/api/security.py:224` appelle `provider.generate(prompt)` avec un `str`, alors que `BaseLLMProvider.generate()` attend `messages: list[LLMMessage]`. Ensuite `response.strip()` echoue car `generate()` retourne un `LLMResponse`. L'erreur est masquee par `except Exception: pass`.

**Correctif:**
1. Importer `LLMMessage` depuis `ragkit.llm.base`.
2. Remplacer `provider.generate(prompt)` par:
   ```python
   response = await provider.generate(
       messages=[LLMMessage(role="user", content=prompt)]
   )
   question = response.content.strip().strip('"')
   ```
3. Remplacer le `except Exception: pass` par un `except Exception: logger.warning(...)` pour rendre les erreurs visibles.

**Fichiers concernes:**
- `ragkit/desktop/api/security.py` (lignes 224-229)

**Validation:** Appeler `POST /api/test-question` avec un LLM configure et verifier qu'une question est effectivement generee (pas le fallback silencieux).

### 2.2 Nettoyer le code mort dans la purge all data

**Observation partiellement justifiee.** La ligne 108 de `security.py` tente de supprimer `data_root / "query_logs.db"`, un fichier qui n'existe pas (le vrai chemin est `data_root / "logs" / "queries.db"`). Cependant, le `shutil.rmtree(data_root / "logs")` aux lignes 96-98 supprime deja correctement tout le repertoire `logs/`, y compris `queries.db`. Le risque de donnees residuelles mentionne dans la revue n'est donc pas reel dans le code actuel, mais le code est trompeur.

**Correctif:**
1. Supprimer le bloc `query_logs.db` mort (lignes 107-111) pour eviter toute confusion.
2. Ajouter un commentaire explicite au bloc `rmtree(logs_dir)` indiquant qu'il couvre aussi `queries.db`.

**Fichiers concernes:**
- `ragkit/desktop/api/security.py` (lignes 107-111)

**Validation:** Verifier que `purge_all_data()` ne reference plus de chemins inexistants.

### 2.3 Ajouter `conversation_id` a l'export conversation

**Observation confirmee.** L'endpoint `POST /api/conversation/export` (security.py:172) appelle `_get_conversation_memory()` sans `conversation_id`. Le frontend (`ConversationExportMenu.tsx`, `useConfigExport.ts`, `ipc.ts`) n'envoie pas non plus d'identifiant. En multi-conversations, l'export cible toujours la conversation "default".

**Correctif:**
1. **Backend** (`security.py`): Ajouter `conversation_id` au payload attendu par `export_conversation`:
   ```python
   conversation_id = payload.get("conversation_id")
   memory = _get_conversation_memory(conversation_id)
   ```
2. **IPC Rust** (`commands.rs`): Propager le champ `conversation_id` du payload frontend vers le backend.
3. **Frontend** (`ipc.ts`): Ajouter `conversationId` a l'appel `exportConversation`.
4. **Frontend** (`useConfigExport.ts`): Accepter et transmettre un `conversationId`.
5. **Frontend** (`ConversationExportMenu.tsx`): Recuperer l'ID de la conversation active depuis le contexte/store et le passer au hook.

**Fichiers concernes:**
- `ragkit/desktop/api/security.py` (endpoint `export_conversation`)
- `desktop/src-tauri/src/commands.rs` (commande `export_conversation`)
- `desktop/src/lib/ipc.ts` (signature `exportConversation`)
- `desktop/src/hooks/useConfigExport.ts` (signature `exportConversation`)
- `desktop/src/components/chat/ConversationExportMenu.tsx` (passer l'ID actif)

**Validation:** Ouvrir une conversation non-default, exporter, et verifier que le contenu exporte correspond a la conversation selectionnee.

---

## Phase 3 - Securite et operations

### 3.1 Remplacer le fallback chiffrement XOR par une primitive standard

**Observation confirmee.** `ragkit/security/secrets.py` utilise un XOR stream maison deterministe (meme entree → meme sortie) avec une cle derivee de metadonnees machine, sans nonce aleatoire. Ce n'est pas une primitive AEAD standard.

**Correctif:**
1. Remplacer `_xor_stream` + HMAC par `cryptography.fernet.Fernet` (qui utilise AES-128-CBC + HMAC avec un IV aleatoire a chaque chiffrement).
2. Garder la derivation de cle existante (`pbkdf2_hmac`) mais l'adapter pour produire une cle Fernet (base64 de 32 bytes).
3. Gerer la migration: au dechiffrement, tenter Fernet d'abord, puis fallback sur l'ancien format XOR pour les credentials existants. Rechiffrer en Fernet apres dechiffrement reussi.
4. Ajouter `cryptography` comme dependance (souvent deja presente via d'autres deps).
5. Continuer de preferer le keyring systeme quand disponible.

**Fichiers concernes:**
- `ragkit/security/secrets.py` (remplacer `_xor_stream`, `_encrypt_payload`, `_decrypt_payload`)
- `pyproject.toml` (ajouter `cryptography` si absent)

**Validation:** Stocker un secret, relire, verifier que le blob chiffre est different a chaque ecriture (non deterministe). Verifier que les anciens credentials sont migres transparemment.

### 3.2 Limiter l'arret backend au PID enfant uniquement

**Observation confirmee.** `desktop/src-tauri/src/backend.rs:121-131` utilise `taskkill /IM ragkit-backend.exe` (Windows) et `pkill -f ragkit-backend` (Unix) en dernier recours, ce qui peut tuer une autre instance legitime.

**Correctif:**
1. Sauvegarder le PID du processus enfant au demarrage dans `BackendState` (le PID est deja disponible via `child.id()` sur `std::process::Child`).
2. En dernier recours, utiliser `taskkill /PID <pid> /F` (Windows) ou `kill -9 <pid>` (Unix) au lieu du kill par nom.
3. Supprimer les commandes `taskkill /IM` et `pkill -f`.

**Fichiers concernes:**
- `desktop/src-tauri/src/backend.rs` (struct `BackendState`, `start_backend`, `stop_backend`)

**Validation:** Lancer deux instances de l'application, arreter l'une, verifier que l'autre backend continue de tourner.

---

## Phase 4 - Performance

### 4.1 Optimiser la detection de changements pour l'auto-ingestion

**Observation confirmee.** `ragkit/desktop/ingestion_runtime.py:290` lit le contenu complet de chaque fichier (`read_bytes()`) et calcule un SHA-256 a chaque cycle de 30s, meme si le fichier n'a pas change.

**Correctif:**
1. En premiere passe, comparer `(mtime, size)` de chaque fichier avec le registre precedent.
2. Ne calculer le SHA-256 que pour les fichiers dont `mtime` ou `size` a change.
3. Stocker `(hash, mtime, size)` dans le registre pour la prochaine comparaison.
4. Optionnel (futur): envisager un watcher OS natif (`watchdog` sur Python, `notify` via Tauri/Rust) pour eliminer completement le polling.

**Fichiers concernes:**
- `ragkit/desktop/ingestion_runtime.py` (methode `detect_changes`, structure du registre)

**Validation:** Mesurer le temps de `detect_changes` sur un corpus de ~1000 fichiers avant/apres. Verifier que les fichiers modifies sont toujours detectes correctement.

---

## Phase 5 - Hygiene qualite

### 5.1 Corriger les warnings ruff et clippy

**Observation plausible** (non re-executee mais coherente avec l'experience du projet).

**Correctif:**
1. Executer `ruff check ragkit tests --fix` pour supprimer automatiquement les imports inutilises.
2. Dans `desktop/src-tauri/`:
   - Supprimer l'import inutilise signale par clippy (`backend.rs:2`).
   - Adresser le variant non utilise (`backend.rs:21`) — soit le supprimer si vraiment mort, soit ajouter `#[allow(dead_code)]` avec commentaire justificatif.
3. Ajouter les checks lint au CI (si pas deja fait) pour prevenir les regressions.

**Fichiers concernes:**
- `tests/config/test_config_export.py`
- `tests/retrieval/test_rerankers.py`
- `desktop/src-tauri/src/backend.rs`
- Eventuellement d'autres fichiers signales par ruff

**Validation:** `ruff check ragkit tests` et `cargo clippy --all-targets` sans warnings.

---

## Observations de la revue globale (revue_globale.md)

La revue globale est essentiellement positive et ne releve pas de bugs. Elle mentionne deux pistes:

1. **Risque de sur-rendu frontend sur de longs payloads de chat** — pertinent mais non critique a court terme. A surveiller si des utilisateurs remontent des lenteurs sur de longues conversations.
2. **Remplacer le buffering SSE manuel en Rust par une crate specialisee** — amelioration de maintenabilite, pas un bug. A considerer lors d'une refonte du streaming.

Ces deux points ne necessitent pas d'action immediate mais sont notes pour reference future.

---

## Resume des priorites

| Priorite | Ref | Effort estime | Risque si non corrige |
|----------|-----|---------------|----------------------|
| 1 | 1.1 Import side effects | Faible | Tests bloques |
| 2 | 2.1 test-question | Faible | Feature desactivee silencieusement |
| 3 | 2.2 Purge code mort | Tres faible | Code trompeur |
| 4 | 2.3 Export conversation_id | Moyen | Mauvais export en multi-conv |
| 5 | 3.1 Chiffrement Fernet | Moyen | Securite sous-optimale des cles API |
| 6 | 3.2 Arret PID | Faible | Kill accidentel d'instances |
| 7 | 4.1 Detection mtime | Moyen | Performance degradee sur gros corpus |
| 8 | 5.1 Lint cleanup | Tres faible | Bruit dans les outils qualite |

---

## Note sur une observation corrigee depuis

La note memoire du projet mentionnait que `request()` dans `backend.rs` ne verifiait pas les codes HTTP. **Cela a ete corrige** : le code actuel (lignes 219-227) verifie `status.is_success()` et retourne `Err(...)` sur les erreurs HTTP. Cette observation n'est plus d'actualite.
