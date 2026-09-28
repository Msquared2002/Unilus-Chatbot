# UNILUS AI Student Companion — Retrieval Refactor

Date: 26 September 2026

This build keeps the existing deterministic timetable, resource, campus-navigation, and final-answer architecture, but replaces the fragile dense-only knowledge retrieval path with a hybrid retrieval pipeline.

## What changed

### 1. Query understanding (cheap Groq planner)

**New file:** `backend/services/queryUnderstandingService.js`

For ambiguous/unstructured knowledge questions, a small/fast model can now turn natural language into a structured retrieval plan containing:

- normalized query
- up to two additional search rewrites
- intent/topic
- programme
- academic year
- audience
- currency
- document type

The planner never answers the student. It only improves the search request. If the planner is disabled, unavailable, or returns bad JSON, retrieval falls back safely to the original question.

Default planner model:

`openai/gpt-oss-20b`

Environment variables are documented in `backend/.env.example`.

### 2. Hybrid retrieval instead of dense-only top-5

**Changed file:** `backend/services/knowledgeService.js`

Candidate generation now combines:

- dense vector similarity
- BM25-style lexical search
- metadata/entity matching
- reciprocal-rank fusion
- entity boosts and contradiction penalties
- exact-text deduplication
- source diversification
- neighboring chunks when useful

The final context is still intentionally small, but retrieval now searches a much wider candidate pool first.

### 3. Lexical search

**New file:** `backend/services/lexicalSearchService.js`

This is particularly important for exact university terms such as:

- `BIT402`
- programme names
- `ZMW` / `USD`
- years such as `2026`
- bank names
- policy terms
- venue/course codes

Lexical retrieval is also a resilience layer when dense embeddings fail to load.

### 4. Enriched search text

**New file:** `backend/services/searchTextService.js`

The dense embedding input is no longer intended to be raw chunk text only. Search text now includes useful context such as:

- document/retrieval title
- source filename
- document type
- programme
- academic year
- audience
- currency
- topic/section
- original content

This fixes cases where a chunk belongs to a Pharmacy fee schedule but the word `Pharmacy` does not appear inside that individual chunk.

### 5. Better document metadata

**Changed file:** `backend/services/documentIngestion/metadata.js`

Metadata extraction now derives/fixes:

- informative retrieval titles
- programme
- year
- currency
- local/SADC/foreign audience
- document type

It also rejects junk PDF headings such as page markers and generic `UNIVERSITY OF LUSAKA` headings when deriving a useful search title.

### 6. Existing knowledge data migrated

**New script:** `backend/scripts/upgradeKnowledgeMetadata.js`

The current `chunks.json` and vector metadata were migrated at document level, so all chunks from the same fee document consistently inherit programme/year/currency/audience information.

The migrated build works immediately for lexical + metadata retrieval.

### 7. Dense vector rebuild uses enriched text

**Changed file:** `backend/scripts/buildKnowledgeIndex.js`

The next vector rebuild will embed the enriched `search_text` rather than raw `chunk.text`.

A manifest is written to:

`backend/data/vectors/index_manifest.json`

The supplied build currently marks `needs_embedding_rebuild: true` because the original ZIP contains Windows native `node_modules`, while this review environment is Linux. The hybrid retrieval improvements work now, but run the vector rebuild on the normal Windows development machine to upgrade dense retrieval too.

### 8. Oversized chunks fixed for future ingestion

**Changed file:** `backend/services/documentIngestion/chunker.js`

Oversized paragraphs and lists are now split so a large block cannot silently exceed the useful embedding input length.

### 9. Retrieval diagnostics

**New script:** `backend/scripts/inspectRetrieval.js`

Example:

```bash
npm run retrieval:inspect -- "I'm doing pharmacy and I'm local, how much am I supposed to pay this year?"
```

It prints:

- query plan
- source/retrieval title
- programme/year/currency/audience
- hybrid score
- dense score
- lexical score
- matched terms/entities
- snippet

Use this whenever the chatbot claims information is unavailable but you believe it exists in the backend.

### 10. Regression tests added

New tests include real-corpus natural-language retrieval cases, including:

- conversational Pharmacy/local/year wording retrieving the correct ZMW fee source even with dense embeddings disabled
- a Pharmacy payment chunk being recovered from document metadata even though its body does not say `Pharmacy`
- conversational `take a break` wording being recovered through a deferment rewrite
- programme-conflict penalties preventing another programme's fee schedule from outranking the requested programme

Current test result in the review environment:

- 96 tests total
- 95 passed
- 0 failed
- 1 skipped (PDF native-module limitation in the Linux review environment)

## Exact local steps

From `backend/`:

```bash
npm install
```

Copy your private Groq key into a local `.env` (do not commit or distribute this file), then make sure the retrieval settings are present:

```env
QUERY_PLANNER_ENABLED=true
QUERY_PLANNER_MODEL=openai/gpt-oss-20b
```

Upgrade dense embeddings to the new enriched format:

```bash
npm run build-index
```

Then verify:

```bash
npm test
npm run retrieval:inspect -- "I'm doing pharmacy and I'm local, how much am I supposed to pay this year?"
```

Start normally:

```bash
npm start
```

## Important design behavior

Deterministic services still run first. The query planner is for ambiguous/unstructured knowledge retrieval; it is not intended to replace exact timetable, resource-registry, or campus-navigation handlers.

The final Groq answer model remains separate from the retrieval planner. The planner searches; the main model answers using retrieved UNILUS context.
