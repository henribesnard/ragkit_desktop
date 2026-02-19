# 🧰 RAGKIT Desktop — Spécifications Étape 11 : Monitoring & Évaluation

> **Étape** : 11 — Monitoring & Évaluation  
> **Tag cible** : `v0.12.0`  
> **Date** : 18 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 10 (Agents & Orchestration) implémentée et validée

---

## 1. Objectif

Enrichir le **tableau de bord** avec des métriques de performance, des journaux de requêtes, et des outils de diagnostic pour que l'utilisateur puisse **suivre, comprendre et améliorer** la qualité de son RAG.

Cette étape livre :
- Un **tableau de bord enrichi** avec état des services, statistiques d'ingestion, métriques de requêtes, graphiques d'activité, et requêtes récentes.
- Un **système de journalisation** (query logger) qui enregistre chaque requête avec tous ses détails (intention, chunks, réponse, latence, feedback).
- Un **journal des requêtes** consultable avec filtres et export.
- Un **feedback utilisateur** (👍/👎) sur chaque réponse du chat, avec collecte et agrégation dans le tableau de bord.
- Une section `PARAMÈTRES > Paramètres avancés > MONITORING` pour configurer la granularité de la journalisation et les seuils d'alerte.
- Des **alertes visuelles** quand les métriques dépassent les seuils configurés (latence, taux d'échec, coût).

Le tableau de bord (onglet 3 de l'application) passe de placeholder vide à un outil de monitoring opérationnel.

---

## 2. Spécifications fonctionnelles

### 2.1 Tableau de bord — layout complet

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 TABLEAU DE BORD                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── État des services ──────────────────────────────────────┐  │
│  │                                                            │ │
│  │  🟢 Embedding       🟢 LLM (gpt-4o-mini)                │ │
│  │     OpenAI · ok        OpenAI · ok                        │ │
│  │                                                            │ │
│  │  🟢 Vector DB       ⚪ Reranker                           │ │
│  │     Qdrant · 12K       Désactivé                          │ │
│  │                        vecs                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Ingestion ─────────────┐  ┌── Requêtes (24h) ──────────┐ │
│  │                           │  │                             │ │
│  │  📄 47 documents          │  │  💬 142 requêtes            │ │
│  │  🧩 2 847 chunks          │  │  ✅ 96.5% succès            │ │
│  │  📏 1.2M tokens           │  │  ⏱ 2.4s latence moy.      │ │
│  │  🕐 Mis à jour il y a 2h │  │  ⏱ 4.8s latence p95       │ │
│  │                           │  │  💰 $0.12 coût estimé      │ │
│  └───────────────────────────┘  └─────────────────────────────┘ │
│                                                                 │
│  ┌── Activité (7 derniers jours) ────────────────────────────┐ │
│  │                                                            │ │
│  │  35│         ╭─╮                                          │ │
│  │  30│    ╭────╯ │                                          │ │
│  │  25│    │      ╰─╮        ╭──╮                            │ │
│  │  20│ ╭──╯        ╰──╮  ╭─╯  │                            │ │
│  │  15│ │               ╰──╯    ╰─╮                          │ │
│  │  10│─╯                         ╰──                        │ │
│  │    └──────────────────────────────────                    │ │
│  │     Lun  Mar  Mer  Jeu  Ven  Sam  Dim                    │ │
│  │                                                            │ │
│  │  ── Légende ──                                            │ │
│  │  ━━ Requêtes totales  ━━ Requêtes RAG  ━━ Non-RAG       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Répartition des intentions ─────────────────────────────┐  │
│  │                                                            │ │
│  │  question ███████████████████████████░░░░░░░  78%         │ │
│  │  greeting █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12%         │ │
│  │  chitchat ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   5%         │ │
│  │  out_of_scope █░░░░░░░░░░░░░░░░░░░░░░░░░░░░   3%         │ │
│  │  clarification █░░░░░░░░░░░░░░░░░░░░░░░░░░░   2%         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Feedback utilisateur ───────────────────────────────────┐  │
│  │                                                            │ │
│  │  👍 89 (73%)  👎 33 (27%)  ── Sans feedback : 20         │ │
│  │  ████████████████████░░░░░░░                              │ │
│  │                                                            │ │
│  │  Tendance 7j : 👍 68% → 73% ▲                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Requêtes récentes ──────────────────────────────────────┐  │
│  │                                                            │ │
│  │  🕐 14:23  "conditions résiliation"  question  2.4s  👍  │ │
│  │  🕐 14:21  "Bonjour"                greeting  0.3s  —   │ │
│  │  🕐 14:18  "article 12 du contrat"  question  3.1s  👎  │ │
│  │  🕐 14:15  "capitale du Brésil"     oos       0.4s  —   │ │
│  │  🕐 14:12  "détailler le point 3"   clarif.   2.8s  👍  │ │
│  │                                                            │ │
│  │  [📋 Voir le journal complet]                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Latence par composant (moyenne 24h) ────────────────────┐  │
│  │                                                            │ │
│  │  Analyzer  ██░░░░░░░░░░░░░░░░░░░░░  142 ms               │ │
│  │  Rewriting ██░░░░░░░░░░░░░░░░░░░░░  118 ms               │ │
│  │  Retrieval ████████░░░░░░░░░░░░░░░  542 ms               │ │
│  │  Reranking ████░░░░░░░░░░░░░░░░░░░  255 ms               │ │
│  │  LLM       ████████████████░░░░░░░  1 847 ms             │ │
│  │  ──────────────────────────────────                        │ │
│  │  Total     ████████████████████████  2 904 ms             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 État des services

Chaque composant du pipeline est surveillé avec un indicateur de santé :

| Composant | Détail affiché | Vérification |
|-----------|---------------|--------------|
| **Embedding** | Provider · modèle · statut | Ping du provider (Étape 3) |
| **LLM** | Provider · modèle · statut | Ping du provider (Étape 9) |
| **Vector DB** | Provider · nombre de vecteurs · statut | Ping de la base (Étape 4) |
| **Reranker** | Provider · modèle · statut (ou "Désactivé") | Ping du provider (Étape 8) |

**Codes couleur** :

| Indicateur | Signification | Condition |
|:---:|-------------|-----------|
| 🟢 | OK | Service accessible, dernière vérification < 5 min |
| 🟡 | Chargement | Vérification en cours |
| 🔴 | Erreur | Service inaccessible ou dernière erreur < 10 min |
| ⚪ | Désactivé | Composant non configuré ou désactivé |

**Rafraîchissement** : les indicateurs se mettent à jour automatiquement toutes les **60 secondes** et à chaque modification de configuration.

### 2.3 Statistiques d'ingestion

| Métrique | Source | Description |
|----------|--------|-------------|
| Total documents | `vector_store.count_documents()` | Nombre de documents uniques indexés |
| Total chunks | `vector_store.count_vectors()` | Nombre total de vecteurs dans la base |
| Total tokens | Calculé à l'ingestion, stocké en DB | Somme des tokens de tous les chunks |
| Dernière mise à jour | Timestamp de la dernière ingestion réussie | Date et heure relative |
| Couverture | `(docs indexés / docs dans le répertoire) × 100` | Pourcentage de documents couverts |

### 2.4 Métriques de requêtes (24h)

| Métrique | Calcul | Description |
|----------|--------|-------------|
| Nombre de requêtes | Compteur simple sur les 24 dernières heures | Total des messages utilisateur |
| Taux de réussite | `(requêtes sans erreur / total) × 100` | Pourcentage de requêtes complétées |
| Latence moyenne | Moyenne arithmétique sur 24h | Latence totale pipeline |
| Latence p95 | 95ème percentile sur 24h | Latence au-delà de laquelle 5% des requêtes se trouvent |
| Coût estimé | Somme des coûts LLM (input + output tokens × tarif) | Coût API cumulé |

### 2.5 Graphique d'activité

Le graphique affiche le **volume de requêtes** sur les 7 derniers jours avec trois courbes :
- Requêtes totales
- Requêtes RAG (intent = question/clarification)
- Requêtes non-RAG (greeting, chitchat, out_of_scope)

**Granularité** : par heure (vue jour) ou par jour (vue semaine). Toggle en haut du graphique.

### 2.6 Répartition des intentions

Barre horizontale montrant la proportion de chaque intention sur les 24 dernières heures (ou 7 jours, sélectionnable). Permet à l'utilisateur de comprendre comment son assistant est utilisé.

### 2.7 Feedback utilisateur

#### Dans le chat

Chaque réponse de l'assistant est enrichie de boutons de feedback :

```
🤖 D'après les documents disponibles, les conditions...
   [Source: contrat-service-2024.pdf, p.8]

   [👍] [👎]                          ← Boutons de feedback
```

**Comportement** :
- Un clic sur 👍 ou 👎 enregistre le feedback et le bouton cliqué passe en état "actif" (couleur pleine).
- Le feedback est modifiable (cliquer sur 👎 après avoir cliqué 👍 remplace le feedback).
- Le feedback est associé à l'entrée du journal de requête.

#### Dans le tableau de bord

Le panneau feedback agrège les données :
- Nombre de 👍 et 👎 (avec pourcentage)
- Barre de progression visuelle
- Tendance sur 7 jours (évolution du ratio positif)

### 2.8 Journal des requêtes

Le lien "Voir le journal complet" ouvre une vue détaillée :

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 JOURNAL DES REQUÊTES                           [📥 Export] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filtres :                                                      │
│  [▾ Toutes les intentions ▾] [▾ 7 derniers jours ▾]           │
│  [▾ Tous les feedbacks ▾]   [🔍 Rechercher...            ]    │
│                                                                 │
│  ┌── Résultats (142 requêtes) ───────────────────────────────┐ │
│  │                                                            │ │
│  │  ▸ 14:23 · "conditions résiliation" · question · 2.4s 👍 │ │
│  │  ┌────────────────────────────────────────────────────────┐│ │
│  │  │  Intent : question (0.95)                              ││ │
│  │  │  Requête reformulée : —                                ││ │
│  │  │  Chunks récupérés : 5                                  ││ │
│  │  │  Sources : contrat-service (p.8), CGV (p.3)           ││ │
│  │  │                                                        ││ │
│  │  │  Réponse (extrait) :                                   ││ │
│  │  │  "D'après les documents, les conditions de             ││ │
│  │  │  résiliation sont définies à l'article 12..."          ││ │
│  │  │                                                        ││ │
│  │  │  Latence :                                             ││ │
│  │  │  Analyzer 142ms · Retrieval 542ms · LLM 1716ms        ││ │
│  │  │  Total : 2400ms · Coût : $0.0008                      ││ │
│  │  │                                                        ││ │
│  │  │  Feedback : 👍                                         ││ │
│  │  └────────────────────────────────────────────────────────┘│ │
│  │                                                            │ │
│  │  ▸ 14:21 · "Bonjour" · greeting · 0.3s · —               │ │
│  │  ▸ 14:18 · "article 12 du contrat" · question · 3.1s 👎  │ │
│  │  ▸ 14:15 · "capitale du Brésil" · out_of_scope · 0.4s —  │ │
│  │  ...                                                       │ │
│  │                                                            │ │
│  │  [◀ Précédent] Page 1 / 8 [Suivant ▶]                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Filtres disponibles** :
- Par intention : question, greeting, chitchat, out_of_scope, clarification
- Par période : aujourd'hui, 7 jours, 30 jours, tout
- Par feedback : 👍, 👎, sans feedback
- Par texte : recherche libre dans les requêtes

**Export** : le bouton 📥 Export produit un fichier CSV avec toutes les colonnes.

### 2.9 Latence par composant

Graphique en barres horizontales montrant la latence moyenne de chaque composant du pipeline. Permet de diagnostiquer quel composant est le goulot d'étranglement.

### 2.10 Alertes visuelles

Quand une métrique dépasse le seuil configuré, un badge d'alerte apparaît :

| Métrique | Seuil par défaut | Alerte |
|----------|:---:|--------|
| Latence p95 | 5 000 ms | ⚠️ "Latence élevée : p95 = 6.2s (seuil : 5.0s)" |
| Taux de réussite | < 90% | ⚠️ "Taux de réussite dégradé : 87% (seuil : 90%)" |
| Taux de feedback négatif | > 40% | ⚠️ "Feedback négatif élevé : 42% (seuil : 40%)" |
| Coût journalier | $1.00 | ⚠️ "Coût élevé : $1.24 aujourd'hui (seuil : $1.00)" |

Les alertes sont affichées en haut du tableau de bord dans un bandeau jaune/orange.

---

## 3. Section PARAMÈTRES > Paramètres avancés > MONITORING

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  MONITORING                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Journalisation ─────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  ☑ Journaliser les requêtes                               │ │
│  │  ☑ Journaliser les résultats de recherche                 │ │
│  │  ☑ Journaliser les réponses LLM                           │ │
│  │  ☑ Activer la collecte de feedback                        │ │
│  │                                                            │ │
│  │  ℹ️ La journalisation stocke les données localement dans   │ │
│  │  ~/.ragkit/logs/. Aucune donnée n'est envoyée en ligne.   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Rétention ──────────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  Durée de rétention des logs : [====◆=====] 30 jours      │ │
│  │  Taille max des logs :         [====◆=====] 100 Mo        │ │
│  │                                                            │ │
│  │  [🗑 Purger les logs maintenant]                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Seuils d'alerte ───────────────────────────────────────┐  │
│  │                                                            │ │
│  │  Latence p95 max :         [====◆=====] 5 000 ms          │ │
│  │  Taux de réussite min :    [========◆=] 90%                │ │
│  │  Taux feedback négatif max:[====◆=====] 40%                │ │
│  │  Coût journalier max :     [=◆========] $1.00              │ │
│  │                                                            │ │
│  │  ℹ️ Les alertes apparaissent dans le tableau de bord        │ │
│  │  quand un seuil est dépassé.                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Rafraîchissement ───────────────────────────────────────┐  │
│  │                                                            │ │
│  │  Intervalle de vérification des services :                │ │
│  │  [===◆======] 60 secondes                                  │ │
│  │                                                            │ │
│  │  Intervalle de rafraîchissement du tableau de bord :      │ │
│  │  [===◆======] 30 secondes                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Catalogue complet des paramètres MONITORING

### 4.1 Journalisation

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Journaliser les requêtes | `monitoring.log_queries` | bool | `true` | Enregistrer chaque requête et son intent |
| Journaliser le retrieval | `monitoring.log_retrieval_results` | bool | `true` | Enregistrer les chunks récupérés |
| Journaliser le LLM | `monitoring.log_llm_outputs` | bool | `true` | Enregistrer les réponses générées |
| Collecter le feedback | `monitoring.feedback_collection` | bool | `true` | Activer les boutons 👍/👎 |

### 4.2 Rétention

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Durée rétention | `monitoring.retention_days` | int | 1 | 365 | 30 | Nombre de jours avant suppression auto |
| Taille max logs | `monitoring.max_log_size_mb` | int | 10 | 1000 | 100 | Taille max en Mo avant rotation |

### 4.3 Seuils d'alerte

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Latence p95 max | `monitoring.alert_latency_p95_ms` | int | 1000 | 30000 | 5000 | Seuil d'alerte latence en ms |
| Taux réussite min | `monitoring.alert_success_rate` | float | 0.5 | 1.0 | 0.9 | Seuil min du taux de réussite |
| Feedback négatif max | `monitoring.alert_negative_feedback` | float | 0.1 | 1.0 | 0.4 | Seuil max du ratio feedback négatif |
| Coût journalier max | `monitoring.alert_daily_cost` | float | 0.1 | 100.0 | 1.0 | Seuil d'alerte coût en USD |

### 4.4 Rafraîchissement

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Check services | `monitoring.service_check_interval` | int | 15 | 600 | 60 | Intervalle vérification services (sec) |
| Refresh dashboard | `monitoring.dashboard_refresh_interval` | int | 10 | 300 | 30 | Intervalle rafraîchissement métriques (sec) |

### 4.5 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `log_queries` | Traçabilité complète des interactions | Espace disque (~1 Ko/requête) |
| `log_retrieval_results` | Diagnostic de la qualité du retrieval | Espace disque (~5 Ko/requête avec chunks) |
| `log_llm_outputs` | Traçabilité des réponses générées | Espace disque (~2 Ko/requête) |
| `feedback_collection` | Amélioration continue basée sur le feedback | — |
| `retention_days` | Balance entre historique et espace disque | — |
| Seuils d'alerte | Détection proactive des dégradations | — |

---

## 5. Spécifications techniques

### 5.1 Schéma Pydantic (backend)

```python
# ragkit/config/monitoring_schema.py
"""Pydantic schemas for monitoring configuration."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MonitoringConfig(BaseModel):
    """Monitoring & logging configuration."""

    # Logging
    log_queries: bool = True
    log_retrieval_results: bool = True
    log_llm_outputs: bool = True
    feedback_collection: bool = True

    # Retention
    retention_days: int = Field(default=30, ge=1, le=365)
    max_log_size_mb: int = Field(default=100, ge=10, le=1000)

    # Alert thresholds
    alert_latency_p95_ms: int = Field(default=5000, ge=1000, le=30000)
    alert_success_rate: float = Field(default=0.9, ge=0.5, le=1.0)
    alert_negative_feedback: float = Field(default=0.4, ge=0.1, le=1.0)
    alert_daily_cost: float = Field(default=1.0, ge=0.1, le=100.0)

    # Refresh intervals
    service_check_interval: int = Field(default=60, ge=15, le=600)
    dashboard_refresh_interval: int = Field(default=30, ge=10, le=300)
```

### 5.2 Query Logger (backend)

```python
# ragkit/monitoring/query_logger.py
"""Query Logger — records all interactions for monitoring."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from ragkit.config.monitoring_schema import MonitoringConfig


@dataclass
class QueryLogEntry:
    """A single logged query with all metadata."""
    id: str                            # UUID
    timestamp: str                     # ISO 8601
    query: str
    intent: str
    intent_confidence: float
    needs_rag: bool
    rewritten_query: str | None = None

    # Retrieval
    search_type: str | None = None
    chunks_retrieved: int = 0
    sources: list[dict] = field(default_factory=list)
    retrieval_latency_ms: int = 0

    # Reranking
    reranking_applied: bool = False
    reranking_latency_ms: int = 0

    # Generation
    answer: str | None = None
    model: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    generation_latency_ms: int = 0
    estimated_cost_usd: float = 0.0

    # Total
    total_latency_ms: int = 0
    success: bool = True
    error: str | None = None

    # Feedback
    feedback: str | None = None        # "positive", "negative", None


class QueryLogger:
    """Logs queries to local SQLite database."""

    DB_PATH = Path("~/.ragkit/logs/queries.db").expanduser()

    def __init__(self, config: MonitoringConfig):
        self.config = config
        self._ensure_db()

    def _ensure_db(self):
        """Create the SQLite database and table if needed."""
        import sqlite3
        self.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.DB_PATH))
        conn.execute("""
            CREATE TABLE IF NOT EXISTS query_logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp
            ON query_logs(timestamp)
        """)
        conn.commit()
        conn.close()

    def log(self, entry: QueryLogEntry):
        """Log a query entry."""
        if not self.config.log_queries:
            return
        import sqlite3
        conn = sqlite3.connect(str(self.DB_PATH))
        conn.execute(
            "INSERT INTO query_logs (id, timestamp, data) VALUES (?, ?, ?)",
            (entry.id, entry.timestamp, json.dumps(asdict(entry))),
        )
        conn.commit()
        conn.close()

    def set_feedback(self, query_id: str, feedback: str):
        """Update feedback for a logged query."""
        import sqlite3
        conn = sqlite3.connect(str(self.DB_PATH))
        cursor = conn.execute(
            "SELECT data FROM query_logs WHERE id = ?", (query_id,)
        )
        row = cursor.fetchone()
        if row:
            data = json.loads(row[0])
            data["feedback"] = feedback
            conn.execute(
                "UPDATE query_logs SET data = ? WHERE id = ?",
                (json.dumps(data), query_id),
            )
            conn.commit()
        conn.close()

    def query_logs(
        self,
        intent: str | None = None,
        feedback: str | None = None,
        search_text: str | None = None,
        since_days: int = 7,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QueryLogEntry], int]:
        """Query logs with filters and pagination."""
        # Implementation: SQL query with filters on JSON data
        ...

    def get_metrics(self, hours: int = 24) -> dict:
        """Aggregate metrics for the dashboard."""
        # Returns: total_queries, success_rate, avg_latency,
        # p95_latency, total_cost, intent_distribution,
        # feedback_positive, feedback_negative
        ...

    def get_activity(self, days: int = 7) -> list[dict]:
        """Get activity data for the chart."""
        # Returns: [{date, total, rag, non_rag}]
        ...

    def get_latency_breakdown(self, hours: int = 24) -> dict:
        """Get average latency per component."""
        # Returns: {analyzer, rewriting, retrieval, reranking, llm, total}
        ...

    def purge(self):
        """Purge logs older than retention_days."""
        ...

    def export_csv(self, path: str, **filters):
        """Export filtered logs to CSV."""
        ...
```

### 5.3 Service Health Checker (backend)

```python
# ragkit/monitoring/health_checker.py
"""Health checker for all pipeline services."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ServiceStatus(str, Enum):
    OK = "ok"
    LOADING = "loading"
    ERROR = "error"
    DISABLED = "disabled"


@dataclass
class ServiceHealth:
    name: str
    status: ServiceStatus
    provider: str | None = None
    model: str | None = None
    detail: str | None = None         # e.g. "12K vecs", "gpt-4o-mini"
    last_check: str | None = None
    error: str | None = None


class HealthChecker:
    """Checks health of all pipeline services."""

    def __init__(
        self,
        embedding_provider=None,
        llm_provider=None,
        vector_store=None,
        reranker=None,
    ):
        self.embedding = embedding_provider
        self.llm = llm_provider
        self.vector_store = vector_store
        self.reranker = reranker

    async def check_all(self) -> list[ServiceHealth]:
        """Check all services and return health status."""
        results = []
        results.append(await self._check_embedding())
        results.append(await self._check_llm())
        results.append(await self._check_vector_store())
        results.append(await self._check_reranker())
        return results

    async def _check_embedding(self) -> ServiceHealth:
        if not self.embedding:
            return ServiceHealth("Embedding", ServiceStatus.DISABLED)
        try:
            test = await self.embedding.test_connection()
            return ServiceHealth(
                "Embedding", ServiceStatus.OK,
                provider=test.provider, model=test.model,
            )
        except Exception as e:
            return ServiceHealth(
                "Embedding", ServiceStatus.ERROR, error=str(e)
            )

    # Similar for _check_llm, _check_vector_store, _check_reranker
    ...
```

### 5.4 Alert Evaluator (backend)

```python
# ragkit/monitoring/alerts.py
"""Alert evaluator — checks metrics against thresholds."""

from __future__ import annotations

from dataclasses import dataclass

from ragkit.config.monitoring_schema import MonitoringConfig


@dataclass
class Alert:
    metric: str
    message: str
    current_value: float
    threshold: float
    severity: str          # "warning" | "critical"


class AlertEvaluator:
    """Evaluates metrics against configured thresholds."""

    def __init__(self, config: MonitoringConfig):
        self.config = config

    def evaluate(self, metrics: dict) -> list[Alert]:
        alerts = []

        if metrics.get("latency_p95", 0) > self.config.alert_latency_p95_ms:
            alerts.append(Alert(
                metric="latency_p95",
                message=f"Latence élevée : p95 = {metrics['latency_p95']}ms "
                        f"(seuil : {self.config.alert_latency_p95_ms}ms)",
                current_value=metrics["latency_p95"],
                threshold=self.config.alert_latency_p95_ms,
                severity="warning",
            ))

        success_rate = metrics.get("success_rate", 1.0)
        if success_rate < self.config.alert_success_rate:
            alerts.append(Alert(
                metric="success_rate",
                message=f"Taux de réussite dégradé : {success_rate*100:.0f}% "
                        f"(seuil : {self.config.alert_success_rate*100:.0f}%)",
                current_value=success_rate,
                threshold=self.config.alert_success_rate,
                severity="critical" if success_rate < 0.7 else "warning",
            ))

        # Similar for negative_feedback and daily_cost
        ...

        return alerts
```

### 5.5 API REST (routes backend)

#### 5.5.1 Routes Config monitoring

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/monitoring/config` | GET | Config monitoring courante | — | `MonitoringConfig` |
| `/api/monitoring/config` | PUT | Met à jour la config | `MonitoringConfig` (partiel) | `MonitoringConfig` |
| `/api/monitoring/config/reset` | POST | Réinitialise au profil actif | — | `MonitoringConfig` |

#### 5.5.2 Routes Dashboard

| Endpoint | Méthode | Description | Params | Réponse |
|----------|---------|-------------|--------|---------|
| `/api/dashboard/health` | GET | État des services | — | `ServiceHealth[]` |
| `/api/dashboard/ingestion` | GET | Statistiques d'ingestion | — | `IngestionStats` |
| `/api/dashboard/metrics` | GET | Métriques de requêtes | `?hours=24` | `QueryMetrics` |
| `/api/dashboard/activity` | GET | Données graphique activité | `?days=7` | `ActivityData[]` |
| `/api/dashboard/intents` | GET | Répartition intentions | `?hours=24` | `IntentDistribution` |
| `/api/dashboard/feedback` | GET | Agrégation feedback | `?days=7` | `FeedbackStats` |
| `/api/dashboard/latency` | GET | Latence par composant | `?hours=24` | `LatencyBreakdown` |
| `/api/dashboard/alerts` | GET | Alertes actives | — | `Alert[]` |

#### 5.5.3 Routes Journal

| Endpoint | Méthode | Description | Params | Réponse |
|----------|---------|-------------|--------|---------|
| `/api/logs/queries` | GET | Journal des requêtes | `?intent=&feedback=&since_days=&page=&page_size=&search=` | `PaginatedQueryLogs` |
| `/api/logs/queries/{id}` | GET | Détail d'une requête | — | `QueryLogEntry` |
| `/api/logs/export` | GET | Export CSV | `?intent=&feedback=&since_days=` | `text/csv` |
| `/api/logs/purge` | POST | Purge des logs | — | `{ purged_count }` |

#### 5.5.4 Routes Feedback

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/feedback` | POST | Soumettre un feedback | `{ query_id, feedback: "positive"\|"negative" }` | `{ success }` |

#### 5.5.5 Modèles de réponse

```python
class QueryMetrics(BaseModel):
    total_queries: int
    success_rate: float
    avg_latency_ms: int
    p95_latency_ms: int
    total_cost_usd: float
    period_hours: int

class ActivityDataPoint(BaseModel):
    date: str
    total: int
    rag: int
    non_rag: int

class IntentDistribution(BaseModel):
    intents: list[dict]     # [{intent, count, percentage}]
    period_hours: int

class FeedbackStats(BaseModel):
    positive: int
    negative: int
    without_feedback: int
    positive_rate: float
    trend_7d: float         # Variation du taux positif sur 7j

class LatencyBreakdown(BaseModel):
    analyzer_ms: int
    rewriting_ms: int
    retrieval_ms: int
    reranking_ms: int
    llm_ms: int
    total_ms: int

class IngestionStats(BaseModel):
    total_documents: int
    total_chunks: int
    total_tokens: int
    last_updated: str | None
    coverage_percent: float

class PaginatedQueryLogs(BaseModel):
    entries: list[QueryLogEntry]
    total: int
    page: int
    page_size: int
    has_more: bool
```

### 5.6 Intégration avec l'Orchestrateur

L'orchestrateur (Étape 10) est étendu pour enregistrer chaque requête dans le logger :

```python
# Extension de ragkit/agents/orchestrator.py

class Orchestrator:
    def __init__(self, ..., query_logger: QueryLogger | None = None):
        ...
        self.logger = query_logger

    async def process(self, message, ...):
        entry_id = str(uuid.uuid4())
        t_start = time.perf_counter()

        # ... pipeline normal ...

        # Log l'entrée
        if self.logger:
            self.logger.log(QueryLogEntry(
                id=entry_id,
                timestamp=datetime.utcnow().isoformat(),
                query=message,
                intent=analysis.intent.value,
                intent_confidence=analysis.confidence,
                needs_rag=analysis.needs_rag,
                rewritten_query=rewrite.rewritten_queries[0] if rewrite else None,
                search_type=...,
                chunks_retrieved=...,
                sources=...,
                retrieval_latency_ms=...,
                reranking_applied=...,
                reranking_latency_ms=...,
                answer=response.content,
                model=...,
                prompt_tokens=...,
                completion_tokens=...,
                generation_latency_ms=...,
                estimated_cost_usd=...,
                total_latency_ms=int((time.perf_counter() - t_start) * 1000),
                success=True,
            ))

        # Attacher l'ID au response pour le feedback
        response.query_log_id = entry_id
        return response
```

### 5.7 Commandes Tauri (Rust) — ajouts

```rust
// Monitoring config
#[tauri::command]
pub async fn get_monitoring_config() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn update_monitoring_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn reset_monitoring_config() -> Result<serde_json::Value, String> { ... }

// Dashboard
#[tauri::command]
pub async fn get_dashboard_health() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn get_dashboard_metrics(hours: i32) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn get_dashboard_activity(days: i32) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn get_dashboard_alerts() -> Result<serde_json::Value, String> { ... }

// Query logs
#[tauri::command]
pub async fn get_query_logs(filters: serde_json::Value) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn export_query_logs(filters: serde_json::Value) -> Result<String, String> { ... }
#[tauri::command]
pub async fn purge_logs() -> Result<serde_json::Value, String> { ... }

// Feedback
#[tauri::command]
pub async fn submit_feedback(query_id: String, feedback: String) -> Result<serde_json::Value, String> { ... }
```

### 5.8 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── dashboard/
│   │   ├── DashboardView.tsx              ← REFACTORING MAJEUR (placeholder → complet)
│   │   ├── ServiceHealthPanel.tsx         ← NOUVEAU : état des 4 services
│   │   ├── ServiceHealthCard.tsx          ← NOUVEAU : carte individuelle
│   │   ├── IngestionStatsPanel.tsx        ← NOUVEAU : stats ingestion
│   │   ├── QueryMetricsPanel.tsx          ← NOUVEAU : métriques 24h
│   │   ├── ActivityChart.tsx              ← NOUVEAU : graphique 7j (recharts)
│   │   ├── IntentDistribution.tsx         ← NOUVEAU : barres intentions
│   │   ├── FeedbackPanel.tsx              ← NOUVEAU : agrégation feedback
│   │   ├── LatencyBreakdown.tsx           ← NOUVEAU : barres latence
│   │   ├── AlertsBanner.tsx               ← NOUVEAU : bandeau alertes
│   │   ├── RecentQueries.tsx              ← NOUVEAU : requêtes récentes
│   │   └── QueryLogView.tsx              ← NOUVEAU : journal complet
│   ├── chat/
│   │   ├── FeedbackButtons.tsx            ← NOUVEAU : boutons 👍/👎
│   │   └── ... (existants)
│   ├── settings/
│   │   ├── MonitoringSettings.tsx         ← NOUVEAU : section monitoring
│   │   └── ... (existants)
│   └── ui/
│       └── ... (existants)
├── hooks/
│   ├── useDashboard.ts                    ← NOUVEAU : polling dashboard
│   ├── useQueryLogs.ts                    ← NOUVEAU : requêtes journal
│   ├── useFeedback.ts                     ← NOUVEAU : soumettre feedback
│   ├── useAlerts.ts                       ← NOUVEAU : alertes actives
│   └── ... (existants)
├── lib/
│   └── ipc.ts                             ← MODIFIER
└── locales/
    ├── fr.json                            ← MODIFIER
    └── en.json                            ← MODIFIER
```

### 5.9 Persistance

#### Configuration (`settings.json`)

```json
{
  "monitoring": {
    "log_queries": true,
    "log_retrieval_results": true,
    "log_llm_outputs": true,
    "feedback_collection": true,
    "retention_days": 30,
    "max_log_size_mb": 100,
    "alert_latency_p95_ms": 5000,
    "alert_success_rate": 0.9,
    "alert_negative_feedback": 0.4,
    "alert_daily_cost": 1.0,
    "service_check_interval": 60,
    "dashboard_refresh_interval": 30
  }
}
```

#### Logs des requêtes (`~/.ragkit/logs/queries.db`)

Base SQLite locale avec une table `query_logs` contenant une colonne JSON pour stocker l'intégralité de chaque entrée. Index sur `timestamp` pour les requêtes par période.

### 5.10 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts pour Étape 11
# Aucune nouvelle dépendance.
# sqlite3 est dans la bibliothèque standard Python.
# Les calculs de percentiles utilisent numpy (déjà présent, Étape 3).
```

---

## 6. Valeurs par défaut par profil

Tous les profils partagent la même configuration de monitoring :

| Paramètre | Tous les profils |
|-----------|:---:|
| `log_queries` | `true` |
| `log_retrieval_results` | `true` |
| `log_llm_outputs` | `true` |
| `feedback_collection` | `true` |
| `retention_days` | 30 |
| `max_log_size_mb` | 100 |
| `alert_latency_p95_ms` | 5000 |
| `alert_success_rate` | 0.9 |
| `alert_negative_feedback` | 0.4 |
| `alert_daily_cost` | 1.0 |
| `service_check_interval` | 60 |
| `dashboard_refresh_interval` | 30 |

**Justification** : le monitoring est transversal et ne dépend pas du cas d'usage. Les mêmes seuils par défaut conviennent à tous les profils. L'utilisateur peut les ajuster selon ses besoins (ex : `alert_daily_cost` plus élevé pour un usage intensif, `retention_days` plus long pour un contexte d'audit).

---

## 7. Critères d'acceptation

### 7.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | Le **tableau de bord** affiche l'état des 4 services avec les bons indicateurs de couleur |
| F2 | Les statistiques d'ingestion sont correctes (documents, chunks, tokens, date) |
| F3 | Les métriques de requêtes (24h) sont calculées et affichées |
| F4 | Le graphique d'activité affiche les 7 derniers jours avec les 3 courbes |
| F5 | La répartition des intentions est affichée en barres horizontales |
| F6 | Le panneau feedback affiche les compteurs 👍/👎 et la tendance |
| F7 | La latence par composant est affichée en barres horizontales |
| F8 | Les alertes apparaissent en bandeau quand un seuil est dépassé |
| F9 | La liste des requêtes récentes est affichée avec intent, latence, feedback |
| F10 | Les boutons **👍/👎** apparaissent sous chaque réponse dans le chat |
| F11 | Cliquer sur 👍 ou 👎 enregistre le feedback et met à jour l'état visuel |
| F12 | Le feedback est modifiable (cliquer sur l'autre bouton remplace le feedback) |
| F13 | Le **journal des requêtes** affiche la liste complète avec filtres et pagination |
| F14 | Cliquer sur une requête déploie le détail (intent, chunks, réponse, latence) |
| F15 | Les filtres du journal fonctionnent (intention, période, feedback, texte) |
| F16 | Le bouton **Export CSV** produit un fichier valide |
| F17 | La section `PARAMÈTRES > MONITORING` affiche tous les paramètres |
| F18 | Le bouton **Purger les logs** supprime les entrées et affiche le nombre purgé |
| F19 | Le rafraîchissement automatique du dashboard fonctionne à l'intervalle configuré |
| F20 | Tous les textes sont traduits FR/EN via i18n |

### 7.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/monitoring/config` retourne la config courante |
| T2 | `PUT /api/monitoring/config` valide et persiste les modifications |
| T3 | `POST /api/monitoring/config/reset` restaure les valeurs par défaut |
| T4 | `GET /api/dashboard/health` retourne l'état des 4 services |
| T5 | `GET /api/dashboard/metrics?hours=24` retourne les métriques agrégées |
| T6 | `GET /api/dashboard/activity?days=7` retourne les données du graphique |
| T7 | `GET /api/dashboard/alerts` retourne les alertes actives |
| T8 | L'orchestrateur enregistre chaque requête dans le `QueryLogger` |
| T9 | Le `QueryLogger` stocke les entrées dans SQLite (`~/.ragkit/logs/queries.db`) |
| T10 | `POST /api/feedback` met à jour le feedback d'une requête existante |
| T11 | `GET /api/logs/queries` supporte les filtres, la pagination et la recherche texte |
| T12 | `GET /api/logs/export` produit un CSV valide avec toutes les colonnes |
| T13 | `POST /api/logs/purge` supprime les entrées antérieures à `retention_days` |
| T14 | Le calcul du p95 de latence est correct (vérifié sur un jeu de données connu) |
| T15 | Le calcul du coût est correct (basé sur les tokens × tarif du modèle) |
| T16 | La rotation des logs fonctionne quand `max_log_size_mb` est atteint |
| T17 | Le `HealthChecker` détecte correctement les services OK, erreur, et désactivés |
| T18 | La config monitoring est persistée dans `settings.json` sous `monitoring` |
| T19 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T20 | Le CI passe sur les 4 targets (lint + build) |

---

## 8. Périmètre exclus (Étape 11)

- **Métriques de qualité RAG avancées** (precision@k, recall@k, MRR, NDCG, faithfulness, answer relevance) : amélioration future. Nécessite un jeu de données de test annoté.
- **Tests A/B** (comparer deux configurations côte à côte) : amélioration future.
- **Export automatique** (envoi des métriques vers un service externe : Datadog, Grafana) : amélioration future.
- **Notifications** (email, Slack, webhook quand une alerte est déclenchée) : amélioration future.
- **Dashboard personnalisable** (déplacer/redimensionner les panneaux) : amélioration future.
- **Métriques de throughput** (requêtes/seconde) : non pertinent pour une application desktop mono-utilisateur.
- **Persistance longue durée** de l'historique de conversation entre sessions : sera abordée à l'Étape 12 (Finalisation).
- **Sécurité et chiffrement des logs** : sera finalisée à l'Étape 12.

---

## 9. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `MonitoringConfig` + validation | 0.5 jour |
| `QueryLogger` (SQLite, CRUD, filtres, pagination, agrégation, export CSV) | 2.5 jours |
| `HealthChecker` (vérification 4 services, statuts, détails) | 1 jour |
| `AlertEvaluator` (évaluation seuils, génération alertes) | 0.5 jour |
| Intégration avec l'Orchestrateur (logging automatique) | 0.5 jour |
| Routes API config monitoring (CRUD) | 0.5 jour |
| Routes API dashboard (health, metrics, activity, intents, feedback, latency, alerts) | 2 jours |
| Routes API journal (query logs, export, purge) | 1 jour |
| Route API feedback | 0.5 jour |
| Commandes Tauri (config + dashboard + logs + feedback) | 1 jour |
| Composant `DashboardView.tsx` (refactoring majeur du placeholder) | 1 jour |
| Composant `ServiceHealthPanel.tsx` + `ServiceHealthCard.tsx` | 1 jour |
| Composants `IngestionStatsPanel.tsx`, `QueryMetricsPanel.tsx` | 0.5 jour |
| Composant `ActivityChart.tsx` (graphique recharts) | 1 jour |
| Composants `IntentDistribution.tsx`, `FeedbackPanel.tsx`, `LatencyBreakdown.tsx` | 1 jour |
| Composant `AlertsBanner.tsx` | 0.5 jour |
| Composants `RecentQueries.tsx`, `QueryLogView.tsx` (journal complet avec filtres) | 1.5 jours |
| Composant `FeedbackButtons.tsx` (boutons 👍/👎 dans le chat) | 0.5 jour |
| Composant `MonitoringSettings.tsx` (section paramètres) | 0.5 jour |
| Hooks (`useDashboard`, `useQueryLogs`, `useFeedback`, `useAlerts`) | 1 jour |
| Traductions i18n (FR + EN) | 0.5 jour |
| Tests unitaires `QueryLogger` (CRUD, filtres, agrégation, purge, export) | 1.5 jours |
| Tests unitaires `HealthChecker` (chaque service, mock providers) | 0.5 jour |
| Tests unitaires `AlertEvaluator` (chaque seuil, combinaisons) | 0.5 jour |
| Tests d'intégration (pipeline → logging → dashboard → feedback → journal) | 1.5 jours |
| Tests manuels + corrections | 1.5 jours |
| **Total** | **~23 jours** |
