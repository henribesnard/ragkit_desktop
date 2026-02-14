### DocumentMetadata
### Hiérarchie organisationnelle

tenant — Organisation / client
domain — Domaine métier
subdomain — Sous-domaine

### Identification document

document_id — ID unique généré
title — Extrait du H1 ou nom de fichier
author — Extrait des métadonnées PDF/DOCX
source — Nom du fichier
source_path — Chemin relatif
source_type — pdf, docx, md, txt, html, csv
source_url — URL d'origine si applicable
mime_type — MIME type détecté

### Temporalité

created_at — Date de création du document
modified_at — Dernière modification
ingested_at — Timestamp d'ingestion
version — Version du document

### Contenu (auto-détecté)

language — Langue ISO 639-1
page_count
word_count
char_count
has_tables
has_images
has_code
encoding

### Classification (modifiable par l'utilisateur)

tags — Liste libre
category — Catégorie prédéfinie
confidentiality — public / internal / confidential / secret
status — draft / review / published / archived

### Parsing (système)

parser_engine — Moteur utilisé
ocr_applied — OCR déclenché ou non
parsing_quality — Score 0-1
parsing_warnings — Avertissements

### Extensible

custom — Dictionnaire libre clé/valeur


### ChunkMetadata (hérité + enrichi)
Hérité du document : document_id, tenant, domain, title, source, language, tags
### Spécifique au chunk

chunk_id
chunk_index — Position dans le document
total_chunks
chunk_strategy — fixed / semantic / recursive
chunk_size_tokens
chunk_size_chars

###Contexte structurel

page_number
section_title — Titre de section parent
heading_path — Fil d'Ariane des headings
paragraph_index

### Relations

previous_chunk_id
next_chunk_id
parent_chunk_id — Pour le parent-child chunking