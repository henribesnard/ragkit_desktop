# Guide Exhaustif des Paramètres RAG
## Configuration Complète pour Systèmes de Retrieval-Augmented Generation

---

## 1. 📝 INGESTION & PREPROCESSING

### 1.1 Document Parsing
- **`document_loader_type`** : Type de loader (PDF, DOCX, HTML, Markdown, etc.)
  - *Impact* : Qualité de l'extraction du contenu selon le format source
  
- **`ocr_enabled`** : Activation de l'OCR pour les PDFs scannés
  - *Impact* : Capacité à extraire du texte depuis des images
  
- **`ocr_language`** : Langue(s) pour l'OCR (ex: fra, eng, multi)
  - *Impact* : Précision de la reconnaissance de caractères
  
- **`table_extraction_strategy`** : Méthode d'extraction des tableaux (preserve, markdown, separate)
  - *Impact* : Qualité de la structure des données tabulaires
  
- **`image_captioning_enabled`** : Génération de descriptions pour les images
  - *Impact* : Capacité à rechercher dans le contenu visuel
  
- **`header_detection`** : Détection automatique des titres et sous-titres
  - *Impact* : Structuration hiérarchique du document

### 1.2 Text Preprocessing
- **`lowercase`** : Conversion en minuscules (booléen)
  - *Impact* : Normalisation pour améliorer le matching (perte de casse)
  
- **`remove_punctuation`** : Suppression de la ponctuation
  - *Impact* : Simplification mais perte d'informations (ex: "M." vs "M")
  
- **`normalize_unicode`** : Normalisation Unicode (NFC, NFD, NFKC, NFKD)
  - *Impact* : Gestion cohérente des caractères accentués
  
- **`remove_urls`** : Suppression des URLs
  - *Impact* : Réduction du bruit pour du contenu web
  
- **`language_detection`** : Détection automatique de la langue
  - *Impact* : Routage vers des modèles spécifiques par langue
  
- **`deduplication_strategy`** : Méthode de dédoublonnage (exact, fuzzy, semantic)
  - *Impact* : Évite l'indexation de contenu redondant
  
- **`deduplication_threshold`** : Seuil de similarité pour déduplication (0-1)
  - *Impact* : Balance entre élimination des doublons et préservation de variations

---

## 2. ✂️ CHUNKING (Découpage)

### 2.1 Stratégie de Découpage
- **`chunking_strategy`** : 
  - `fixed_size` : Découpage à taille fixe
  - `sentence_based` : Par phrases complètes
  - `paragraph_based` : Par paragraphes
  - `semantic` : Découpage sémantique intelligent
  - `markdown_header` : Selon la hiérarchie Markdown
  - `recursive` : Découpage récursif par séparateurs
  - *Impact* : **CRITIQUE** - Détermine la cohérence contextuelle de chaque chunk

### 2.2 Paramètres de Taille
- **`chunk_size`** : Taille du chunk en tokens (ex: 256, 512, 1024)
  - *Impact* : Trop petit = perte de contexte. Trop grand = mélange de sujets multiples
  
- **`chunk_overlap`** : Chevauchement entre chunks (ex: 50, 100, 200 tokens)
  - *Impact* : Évite de couper une information importante en deux. 10-20% est typique
  
- **`min_chunk_size`** : Taille minimale d'un chunk (ex: 50 tokens)
  - *Impact* : Évite les chunks trop courts et peu informatifs
  
- **`max_chunk_size`** : Taille maximale d'un chunk (ex: 2000 tokens)
  - *Impact* : Prévient les dépassements de limites d'embedding

### 2.3 Séparateurs et Délimiteurs
- **`separators`** : Liste ordonnée de séparateurs (ex: ["\n\n", "\n", ". ", " "])
  - *Impact* : Qualité du découpage selon la structure du texte
  
- **`keep_separator`** : Conserver ou supprimer les séparateurs (booléen)
  - *Impact* : Préservation de la structure syntaxique

### 2.4 Chunking Avancé
- **`parent_chunk_size`** : Taille du chunk parent (pour parent-child chunking)
  - *Impact* : Contexte élargi disponible après retrieval
  
- **`child_chunk_size`** : Taille du chunk enfant pour la recherche
  - *Impact* : Granularité de la recherche
  
- **`sentence_window_size`** : Nombre de phrases de contexte autour du chunk
  - *Impact* : Contexte supplémentaire pour améliorer la compréhension

### 2.5 Metadata Enrichment
- **`add_metadata`** : Enrichissement avec métadonnées (source, date, auteur, etc.)
  - *Impact* : Capacité de filtrage et traçabilité
  
- **`add_chunk_index`** : Ajout de l'index du chunk dans le document
  - *Impact* : Reconstruction de l'ordre original
  
- **`add_document_title`** : Inclusion du titre du document dans chaque chunk
  - *Impact* : Contexte supplémentaire pour la recherche

---

## 3. 🧬 EMBEDDING (Vectorisation)

### 3.1 Choix du Modèle
- **`embedding_model`** : Modèle d'embedding
  - OpenAI : `text-embedding-3-small`, `text-embedding-3-large`
  - Cohere : `embed-multilingual-v3.0`, `embed-english-v3.0`
  - HuggingFace : `sentence-transformers/all-MiniLM-L6-v2`, `intfloat/multilingual-e5-large`
  - Modèles spécialisés : juridique, médical, code
  - *Impact* : **FONDAMENTAL** - Qualité de la compréhension sémantique

### 3.2 Dimensions
- **`embedding_dimensions`** : Taille du vecteur (256, 384, 768, 1024, 1536, 3072)
  - *Impact* : Compromis performance/coût/précision
  
- **`dimensionality_reduction`** : Réduction de dimensionnalité (PCA, UMAP, none)
  - *Impact* : Réduction de l'espace de stockage et accélération

### 3.3 Normalisation
- **`normalize_embeddings`** : L2-normalisation des vecteurs (booléen)
  - *Impact* : Nécessaire pour cosine similarity, optimise dot product
  
- **`embedding_dtype`** : Type de données (float32, float16, int8)
  - *Impact* : Compromis précision/mémoire

### 3.4 Batching
- **`embedding_batch_size`** : Nombre de chunks à embedder simultanément (ex: 32, 64, 128)
  - *Impact* : Vitesse d'indexation et utilisation mémoire
  
- **`max_retries`** : Nombre de tentatives en cas d'échec API
  - *Impact* : Robustesse face aux erreurs réseau
  
- **`rate_limit_rpm`** : Limite de requêtes par minute
  - *Impact* : Respect des quotas API

### 3.5 Gestion des Tokens
- **`truncation_strategy`** : Stratégie si dépassement de limite
  - `start` : Garde le début
  - `end` : Garde la fin
  - `middle` : Garde le milieu
  - `split` : Découpe en plusieurs embeddings
  - *Impact* : Préservation des informations importantes
  
- **`pooling_strategy`** : Agrégation pour longs documents (mean, max, cls_token)
  - *Impact* : Représentation des documents dépassant la limite

---

## 4. 🗄️ BASE DE DONNÉES VECTORIELLE

### 4.1 Choix de la DB
- **`vector_db_type`** : Pinecone, Weaviate, Qdrant, Milvus, ChromaDB, FAISS, etc.
  - *Impact* : Fonctionnalités, scalabilité, coûts

### 4.2 Métrique de Distance
- **`distance_metric`** : 
  - `cosine` : Similarité cosinus (standard pour texte)
  - `euclidean` (L2) : Distance euclidienne
  - `dot_product` : Produit scalaire
  - `manhattan` (L1) : Distance de Manhattan
  - *Impact* : **CRITIQUE** - Cosine préférée pour orientation sémantique

### 4.3 Type d'Index
- **`index_type`** :
  - `HNSW` : Hierarchical Navigable Small World (rapide, précis, RAM++)
  - `IVF` : Inverted File Index (équilibré)
  - `FLAT` : Recherche exacte (petit dataset)
  - `LSH` : Locality Sensitive Hashing
  - *Impact* : Compromis vitesse/précision/mémoire

### 4.4 Paramètres HNSW
- **`hnsw_m`** : Nombre de connexions par nœud (8-64, typique: 16)
  - *Impact* : Plus M est grand, meilleur est le recall mais plus de mémoire
  
- **`hnsw_ef_construction`** : Taille de la liste dynamique durant construction (100-500)
  - *Impact* : Qualité de l'index (valeur haute = meilleure qualité mais plus lent)
  
- **`hnsw_ef_search`** : Taille de la liste dynamique durant recherche (10-500)
  - *Impact* : Compromis recall/vitesse de recherche

### 4.5 Paramètres IVF
- **`ivf_nlist`** : Nombre de clusters (ex: sqrt(N) où N = nb de vecteurs)
  - *Impact* : Granularité du partitionnement
  
- **`ivf_nprobe`** : Nombre de clusters à examiner durant recherche (1-nlist)
  - *Impact* : Compromis précision/vitesse

### 4.6 Quantization (Compression)
- **`quantization_type`** :
  - `none` : Pas de compression
  - `scalar` : Quantification scalaire (int8)
  - `product` : Product Quantization (PQ)
  - `binary` : Quantification binaire
  - *Impact* : Réduction drastique de la mémoire (-75% typique) avec légère perte de précision
  
- **`pq_m`** : Nombre de sous-vecteurs pour PQ (8, 16, 32)
  - *Impact* : Taux de compression

### 4.7 Sharding & Réplication
- **`num_shards`** : Nombre de partitions horizontales
  - *Impact* : Scalabilité et parallélisation
  
- **`num_replicas`** : Nombre de réplicas pour haute disponibilité
  - *Impact* : Tolérance aux pannes et lecture parallèle

### 4.8 Filtrage
- **`metadata_index`** : Index sur métadonnées (date, source, catégorie)
  - *Impact* : Performance des filtres pré-recherche
  
- **`filter_strategy`** : `pre_filter` vs `post_filter`
  - *Impact* : Vitesse et pertinence selon le taux de filtrage

---

## 5. 🔍 RECHERCHE SÉMANTIQUE (Dense)

### 5.1 Query Processing
- **`query_preprocessing`** : Normalisation de la requête (même pipeline que docs)
  - *Impact* : Cohérence entre query et corpus
  
- **`query_expansion`** : Expansion de la requête (synonymes, reformulation)
  - *Impact* : Amélioration du recall pour requêtes courtes
  
- **`multi_query_strategy`** : 
  - `single` : Une seule requête
  - `multi_perspective` : Génération de requêtes multiples
  - `hypothetical_document` : HyDE (Hypothetical Document Embeddings)
  - *Impact* : Robustesse face à l'ambiguïté

### 5.2 Retrieval Parameters
- **`top_k`** : Nombre de chunks à récupérer (5-100, typique: 10-20)
  - *Impact* : **CRITIQUE** - Trop peu = miss. Trop = bruit ("lost in the middle")
  
- **`score_threshold`** : Seuil minimum de similarité (0.0-1.0)
  - *Impact* : Filtre anti-bruit. Préférer "Je ne sais pas" à une mauvaise source
  
- **`max_distance`** : Distance maximale acceptable (inverse du score)
  - *Impact* : Même fonction que score_threshold mais pour distances

### 5.3 Diversification
- **`mmr_enabled`** : Maximal Marginal Relevance (booléen)
  - *Impact* : Diversité des résultats vs redondance
  
- **`mmr_lambda`** : Balance pertinence/diversité (0-1, typique: 0.5)
  - *Impact* : 0 = max diversité, 1 = max pertinence
  
- **`diversity_threshold`** : Seuil de similarité entre résultats
  - *Impact* : Évite les doublons sémantiques

### 5.4 Filtres Metadata
- **`filter_conditions`** : Conditions de filtrage (date, source, tags, etc.)
  - *Impact* : Restriction du périmètre de recherche
  
- **`filter_mode`** : `must`, `should`, `must_not`
  - *Impact* : Logique de combinaison des filtres

---

## 6. 📚 RECHERCHE LEXICALE (Sparse / BM25)

### 6.1 Tokenization
- **`tokenizer_type`** : Standard, whitespace, n-gram, WordPiece
  - *Impact* : Granularité du découpage lexical
  
- **`lowercase_tokens`** : Conversion en minuscules (booléen)
  - *Impact* : Normalisation pour matching case-insensitive
  
- **`remove_stopwords`** : Suppression des mots vides (booléen)
  - *Impact* : Réduction du bruit pour mots courants
  
- **`stopwords_language`** : Langue des stopwords (fra, eng, multi)
  - *Impact* : Précision de la liste de stopwords
  
- **`custom_stopwords`** : Liste personnalisée de stopwords
  - *Impact* : Adaptation au domaine métier

### 6.2 Stemming & Lemmatization
- **`stemming_enabled`** : Activation de la racinisation (booléen)
  - *Impact* : "courir", "courant", "coureur" → "cour"
  
- **`stemmer_language`** : Algorithme de stemming (Porter, Snowball)
  - *Impact* : Qualité de la racinisation
  
- **`lemmatization_enabled`** : Lemmatisation (plus précise que stemming)
  - *Impact* : Meilleure qualité mais plus lent

### 6.3 Paramètres BM25
- **`bm25_k1`** : Saturation de la fréquence des termes (0.5-3.0, défaut: 1.2)
  - *Impact* : Poids de la répétition d'un terme. k1 élevé = répétition compte beaucoup
  
- **`bm25_b`** : Normalisation par longueur de document (0-1, défaut: 0.75)
  - *Impact* : Pénalité pour documents longs. b=1 = pénalité maximale (favorise textes courts)
  
- **`bm25_delta`** : Paramètre delta pour BM25+ (0-1, défaut: 0.5)
  - *Impact* : Bonus pour termes présents (variante BM25+)

### 6.4 N-grams
- **`ngram_range`** : Plage de n-grams (ex: (1,2) = unigrams + bigrams)
  - *Impact* : Capture des expressions multi-mots
  
- **`max_features`** : Nombre maximum de termes dans le vocabulaire
  - *Impact* : Taille de l'index sparse

---

## 7. 🔀 RECHERCHE HYBRIDE (Fusion)

### 7.1 Pondération
- **`alpha`** : Balance dense/sparse (0-1)
  - 0 = 100% lexical (BM25)
  - 1 = 100% sémantique (vectoriel)
  - 0.5 = équilibré
  - *Impact* : **PARAMÈTRE CRITIQUE**
    - Documentation technique → alpha ~ 0.2-0.4
    - FAQ généraliste → alpha ~ 0.7-0.9
    - Mixte → alpha ~ 0.5

### 7.2 Méthode de Fusion
- **`fusion_method`** :
  - `rrf` : Reciprocal Rank Fusion (recommandé)
  - `linear` : Combinaison linéaire des scores
  - `weighted_sum` : Somme pondérée
  - `relative_score` : Scores relatifs normalisés
  - *Impact* : RRF évite le calibrage complexe des échelles de scores
  
- **`rrf_k`** : Paramètre de lissage RRF (30-100, défaut: 60)
  - *Impact* : Poids des rangs bas. K élevé = moins de pénalité pour rangs élevés

### 7.3 Normalisation des Scores
- **`normalize_scores`** : Normalisation avant fusion (booléen)
  - *Impact* : Mise à l'échelle cohérente [0,1]
  
- **`normalization_method`** : min-max, z-score, softmax
  - *Impact* : Méthode de normalisation

### 7.4 Stratégies Avancées
- **`dynamic_alpha`** : Ajustement automatique de alpha selon la requête
  - *Impact* : Optimisation par type de query (détection mots-clés vs concepts)
  
- **`query_classifier`** : Classification de la requête pour routage
  - *Impact* : Adaptation de la stratégie selon l'intention

---

## 8. 🎯 RERANKING

### 8.1 Modèle de Reranking
- **`reranker_model`** : 
  - `cross-encoder` : BGE-reranker, Cohere rerank, ms-marco-MiniLM
  - `llm-based` : GPT-4, Claude pour reranking
  - `colbert` : ColBERT (interaction fine)
  - *Impact* : Qualité du réordonnancement final
  
- **`reranker_enabled`** : Activation du reranking (booléen)
  - *Impact* : +20-40% de précision typique mais +latence

### 8.2 Paramètres de Reranking
- **`rerank_top_n`** : Nombre de docs envoyés au reranker (10-100)
  - *Impact* : Plus N est grand, plus précis mais plus lent
  
- **`rerank_batch_size`** : Taille des batchs pour reranking
  - *Impact* : Optimisation GPU/latence
  
- **`rerank_threshold`** : Seuil de score post-rerank
  - *Impact* : Filtrage final des résultats faibles

### 8.3 Output
- **`final_top_k`** : Nombre de résultats finaux après rerank (3-10)
  - *Impact* : Contexte fourni au LLM
  
- **`return_scores`** : Retourner les scores de confiance (booléen)
  - *Impact* : Transparence et debugging

### 8.4 Stratégies Multi-étapes
- **`multi_stage_reranking`** : Cascade de rerankers (rapide puis précis)
  - *Impact* : Optimisation coût/qualité
  
- **`stage_1_model`** : Reranker rapide pour filtrage initial
- **`stage_2_model`** : Reranker précis pour sélection finale

---

## 9. 🤖 LLM / GÉNÉRATION

### 9.1 Choix du Modèle
- **`llm_model`** : GPT-4, Claude, Llama, Mistral, etc.
  - *Impact* : Qualité de la génération et capacité de raisonnement

### 9.2 Paramètres de Génération
- **`temperature`** : Créativité (0-2, RAG typique: 0-0.3)
  - *Impact* : 0 = factuel et déterministe. >0.7 = risque d'hallucination
  
- **`max_tokens`** : Longueur maximale de la réponse (100-4000)
  - *Impact* : Contrôle de la verbosité
  
- **`top_p`** : Nucleus sampling (0-1, typique: 0.9)
  - *Impact* : Diversité lexicale
  
- **`top_k`** : Limitation du vocabulaire (0-100)
  - *Impact* : Contrôle de la variété
  
- **`frequency_penalty`** : Pénalité de répétition (0-2)
  - *Impact* : Évite la redondance
  
- **`presence_penalty`** : Pénalité de présence (0-2)
  - *Impact* : Encourage de nouveaux sujets

### 9.3 Prompt Engineering
- **`system_prompt`** : Instructions système pour le LLM
  - *Impact* : **FONDAMENTAL** - Définit le comportement du bot
  
- **`few_shot_examples`** : Exemples pour few-shot learning
  - *Impact* : Amélioration de la qualité et du format
  
- **`chain_of_thought`** : Raisonnement étape par étape (booléen)
  - *Impact* : Meilleure justification et traçabilité
  
- **`output_format`** : JSON, Markdown, Plain text
  - *Impact* : Structuration de la réponse

### 9.4 Context Management
- **`context_window_strategy`** :
  - `truncate_middle` : Garde début et fin
  - `summarize_overflow` : Résumé du contexte dépassant
  - `sliding_window` : Fenêtre glissante
  - *Impact* : Gestion des longs contextes
  
- **`max_context_tokens`** : Limite du contexte RAG dans le prompt
  - *Impact* : Évite de dépasser la limite du modèle
  
- **`context_compression`** : Compression du contexte (résumé, extraction)
  - *Impact* : Optimisation tokens/pertinence

### 9.5 Citation & Attribution
- **`cite_sources`** : Inclusion des sources dans la réponse (booléen)
  - *Impact* : Traçabilité et vérifiabilité
  
- **`citation_format`** : Format des citations ([1], footnote, inline)
  - *Impact* : Lisibilité
  
- **`include_metadata_in_citation`** : Page, section, date, etc.
  - *Impact* : Précision de la référence

### 9.6 Fallback & Guardrails
- **`enable_fallback`** : Réponse par défaut si pas de réponse trouvée
  - *Impact* : UX vs risque de hallucination
  
- **`confidence_threshold`** : Seuil de confiance pour répondre (0-1)
  - *Impact* : "Je ne sais pas" si confiance trop faible
  
- **`content_filters`** : Filtres de contenu sensible
  - *Impact* : Sécurité et conformité

---

## 10. 💾 CACHE & PERFORMANCE

### 10.1 Cache de Requêtes
- **`query_cache_enabled`** : Cache des résultats de recherche (booléen)
  - *Impact* : Réduction latence et coûts pour requêtes répétées
  
- **`query_cache_ttl`** : Durée de vie du cache (secondes)
  - *Impact* : Fraîcheur vs performance
  
- **`cache_key_strategy`** : exact, fuzzy, semantic
  - *Impact* : Taux de hit du cache

### 10.2 Cache d'Embeddings
- **`embedding_cache_enabled`** : Cache des embeddings calculés
  - *Impact* : Évite recalcul pour requêtes similaires
  
- **`embedding_cache_size`** : Taille max du cache (MB)
  - *Impact* : Mémoire vs hit rate

### 10.3 Batching & Async
- **`async_processing`** : Traitement asynchrone (booléen)
  - *Impact* : Throughput et scalabilité
  
- **`batch_size`** : Taille des batchs de traitement
  - *Impact* : Optimisation GPU/API
  
- **`concurrent_requests`** : Nombre de requêtes parallèles
  - *Impact* : Débit vs charge serveur

### 10.4 Warmup
- **`warmup_queries`** : Requêtes de préchauffage au démarrage
  - *Impact* : Réduction de la latence première requête
  
- **`preload_index`** : Préchargement de l'index en RAM
  - *Impact* : Performance vs mémoire

---

## 11. 📊 MONITORING & EVALUATION

### 11.1 Métriques de Retrieval
- **`precision_at_k`** : Précision des K premiers résultats
  - *Impact* : Mesure de la pertinence
  
- **`recall_at_k`** : Rappel des K premiers résultats
  - *Impact* : Couverture des documents pertinents
  
- **`mrr`** : Mean Reciprocal Rank
  - *Impact* : Position du premier résultat pertinent
  
- **`ndcg_at_k`** : Normalized Discounted Cumulative Gain
  - *Impact* : Qualité du ranking avec importance des positions
  
- **`map`** : Mean Average Precision
  - *Impact* : Précision moyenne sur l'ensemble des requêtes

### 11.2 Métriques de Génération
- **`answer_relevance`** : Pertinence de la réponse
  - *Impact* : Qualité end-to-end
  
- **`faithfulness`** : Fidélité aux sources
  - *Impact* : Détection des hallucinations
  
- **`context_precision`** : Précision du contexte récupéré
  - *Impact* : Qualité du retrieval
  
- **`context_recall`** : Rappel du contexte
  - *Impact* : Complétude du retrieval

### 11.3 Performance
- **`latency_p50`**, **`latency_p95`**, **`latency_p99`** : Percentiles de latence
  - *Impact* : SLA et expérience utilisateur
  
- **`throughput`** : Requêtes par seconde
  - *Impact* : Scalabilité
  
- **`cost_per_query`** : Coût par requête (API calls)
  - *Impact* : ROI

### 11.4 Logging & Observability
- **`log_queries`** : Logging des requêtes (booléen)
  - *Impact* : Analyse et amélioration
  
- **`log_retrieval_results`** : Logging des résultats de recherche
  - *Impact* : Debugging et optimisation
  
- **`log_llm_outputs`** : Logging des réponses LLM
  - *Impact* : Traçabilité complète
  
- **`feedback_collection`** : Collecte du feedback utilisateur (👍👎)
  - *Impact* : Amélioration continue
  
- **`a_b_testing_enabled`** : Tests A/B de configurations
  - *Impact* : Optimisation data-driven

---

## 12. 🔐 SÉCURITÉ & COMPLIANCE

### 12.1 Authentification & Autorisation
- **`access_control_enabled`** : Contrôle d'accès par utilisateur/rôle
  - *Impact* : Sécurité des données sensibles
  
- **`document_level_permissions`** : Permissions granulaires par document
  - *Impact* : Isolation des données

### 12.2 Privacy
- **`pii_detection`** : Détection de données personnelles
  - *Impact* : Conformité RGPD
  
- **`pii_redaction`** : Anonymisation des PII
  - *Impact* : Protection de la vie privée
  
- **`data_retention_policy`** : Durée de rétention des logs/données
  - *Impact* : Conformité légale

### 12.3 Content Moderation
- **`toxicity_filter`** : Filtre de contenu toxique
  - *Impact* : Sécurité des utilisateurs
  
- **`bias_detection`** : Détection de biais dans les réponses
  - *Impact* : Équité et éthique

---

## 13. 🔄 MISE À JOUR & MAINTENANCE

### 13.1 Indexation Incrémentale
- **`incremental_indexing`** : Indexation des nouveaux documents uniquement
  - *Impact* : Réduction du temps de mise à jour
  
- **`update_strategy`** : `append`, `upsert`, `full_reindex`
  - *Impact* : Gestion des modifications

### 13.2 Versioning
- **`document_versioning`** : Suivi des versions de documents
  - *Impact* : Traçabilité des changements
  
- **`index_versioning`** : Versioning de l'index complet
  - *Impact* : Rollback possible

### 13.3 Refresh
- **`auto_refresh_interval`** : Fréquence de rafraîchissement (heures/jours)
  - *Impact* : Fraîcheur des données
  
- **`refresh_strategy`** : `scheduled`, `on_demand`, `webhook-triggered`
  - *Impact* : Réactivité vs charge système

---

## 📋 CHECKLIST D'AUDIT RAG

### Si le RAG ne fonctionne pas bien :

1. **Chunking (60% des problèmes)**
   - [ ] Vérifier la taille des chunks (chunk_size)
   - [ ] Vérifier l'overlap (chunk_overlap)
   - [ ] Vérifier qu'on ne coupe pas les phrases en plein milieu
   - [ ] Vérifier la stratégie de découpage (sentence vs fixed)

2. **Recherche Hybride (20% des problèmes)**
   - [ ] Ajuster alpha selon le cas d'usage
   - [ ] Pour mots-clés exacts → alpha < 0.5
   - [ ] Pour concepts généraux → alpha > 0.7

3. **Top-K (10% des problèmes)**
   - [ ] Vérifier qu'on donne assez de contexte au LLM
   - [ ] 10-20 chunks typiques
   - [ ] Si synthèse multi-documents → augmenter top_k

4. **Embedding Model (5% des problèmes)**
   - [ ] Vérifier la langue du modèle
   - [ ] Vérifier la spécialisation domaine

5. **Score Threshold (5% des problèmes)**
   - [ ] Ajuster le seuil de confiance
   - [ ] Préférer "Je ne sais pas" à une mauvaise réponse

---

## 🎯 CONFIGURATIONS TYPES PAR CAS D'USAGE

### 1. Base Documentaire Technique (Références, SKU, Codes)
```yaml
chunking_strategy: semantic
chunk_size: 512
chunk_overlap: 100
embedding_model: text-embedding-3-small
alpha: 0.3  # Favorise le lexical
bm25_k1: 1.5  # Répétition de codes importante
top_k: 10
reranker_enabled: true
temperature: 0.0  # Factuel uniquement
```

### 2. FAQ / Base de Connaissances Généraliste
```yaml
chunking_strategy: paragraph_based
chunk_size: 256
chunk_overlap: 50
embedding_model: multilingual-e5-large
alpha: 0.8  # Favorise le sémantique
top_k: 5
reranker_enabled: false  # Pas nécessaire
temperature: 0.2
```

### 3. Support Client Multilingue
```yaml
chunking_strategy: sentence_based
chunk_size: 384
chunk_overlap: 75
embedding_model: embed-multilingual-v3.0
alpha: 0.6
language_detection: true
top_k: 15
reranker_model: BGE-reranker-multilingual
temperature: 0.1
```

### 4. Veille Juridique / Conformité
```yaml
chunking_strategy: recursive
chunk_size: 1024  # Contexte juridique long
chunk_overlap: 200
embedding_model: legal-bert-base
alpha: 0.4
top_k: 20  # Besoin de beaucoup de contexte
reranker_enabled: true
citation_format: footnote
cite_sources: true
temperature: 0.0
```

### 5. Code Search
```yaml
chunking_strategy: semantic
chunk_size: 256
chunk_overlap: 50
embedding_model: code-embedding-3
alpha: 0.2  # Recherche exacte de fonctions
bm25_k1: 2.0  # Noms de variables/fonctions
top_k: 8
reranker_enabled: false
temperature: 0.3
```

---

**Version** : 1.0  
**Dernière mise à jour** : 2026-02-10  
**Exhaustivité** : ✅ Complète - 150+ paramètres couverts
