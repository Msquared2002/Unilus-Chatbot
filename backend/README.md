# UNILUS AI Student Digital Companion — Backend

Two knowledge pipelines feed one chatbot:

1. **Timetable pipeline** (Python) — structured, deterministic answers about
   courses, lecturers, venues, and schedules.
2. **Knowledge retrieval pipeline** (this Node backend) — semantic search over
   university documents (handbook, regulations, fees, forms) for policy and
   procedure questions.

A single retrieval entry point, `retrievalService.retrieveAnswer(query)`,
decides which pipeline(s) a question needs and combines the results.

---

## 1. Project architecture

### 1a. Timetable pipeline (separate Python project, `unilus_timetable/`)

```
Scraping (unilus_timetable/scrapers/discovery.py)
    ↓
Parsing (unilus_timetable/parsers/lecturer_parser.py, student_parser.py)
    ↓
Normalization (unilus_timetable/normalize.py)
    ↓
Merging, with provenance (unilus_timetable/merge.py)
    ↓
Validation, produces a report instead of silently dropping records (unilus_timetable/validate.py)
    ↓
Index creation (unilus_timetable/index.py)
    ↓
output/timetable.json + output/search_index.json
    ↓
copied into backend/data/timetable/
```

Run with `python -m unilus_timetable.pipeline` (see that project's own README
for full detail — it's a separate deliverable from an earlier phase of this
work and is not modified by anything in this backend).

### 1b. Knowledge retrieval pipeline (this project)

```
Documents (data/documents/*.pdf, *.docx, *.txt, *.html)
    ↓
Extraction — one reader per format, all producing the same block shape
  (services/documentIngestion/readers/{pdfReader,docxReader,textReader,htmlReader}.js)
    ↓
Cleaning (scripts/ingestDocuments.js::cleanBlockText)
    ↓
Chunking — heading/table/list/page-aware, not fixed-character-count
  (services/documentIngestion/chunker.js)
    ↓
Metadata — deterministic document_type classification, never hardcoded per file
  (services/documentIngestion/metadata.js)
    ↓
data/documents/chunks.json   (npm run ingest stops here)
    ↓
Embeddings — local model, no API key needed (services/embeddingService.js)
    ↓
Vector index — pluggable store, JSON-backed today (services/vectorStore.js)
    ↓
data/vectors/knowledge_vectors.json   (npm run build-index stops here)
    ↓
Retrieval (services/knowledgeService.js, services/retrievalService.js)
```

### 1c. Hybrid retrieval router

`services/retrievalService.js::retrieveAnswer(query)` is the one entry point
`chatService.js` calls:

1. Classifies the query (`classifyQuery`) using generic patterns (course-code
   regex, venue-code regex, day names, keyword lists for each domain) — never
   a hardcoded list of specific names. Lecturer names are recognized because
   they exist in the actual scraped timetable data
   (`timetableService.isKnownLecturerNameToken`), not from a fixed whitelist.
2. Routes to `timetableService` (exact/token-indexed lookups), `knowledgeService`
   (semantic search with a relevance threshold), or both.
3. Returns `{ queryType, timetable: [...], knowledge: [...] }`, which
   `chatService.js` formats into context for the LLM, with every knowledge
   result carrying its source file, title, and page number.

### 1d. Digital front desk: resource registry + website crawler

Two additive pieces turn "answer the question" into "answer, and hand the
student the actual official link":

**Resource registry** (`data/resources/resources.json` +
`services/resourceService.js`) — the single, structured source of truth for
every official UNILUS destination:

```json
{ "topic": "password_reset", "title": "Student Portal Password Recovery",
  "description": "Reset a forgotten Student Portal password.",
  "category": "Password Recovery",
  "keywords": ["forgot password", "reset password", "portal password"],
  "audience": ["all"], "routing_only": true, "crawlable": true, "priority": 2,
  "url": "https://portal.unilus.ac.zm/password/recover" }
```

- `routing_only` — true for login/payment/apply pages where the link matters
  more than the content; false for genuine informational pages.
- `crawlable` — false for resources that aren't UNILUS-hosted content at all
  (a Play Store listing, Eduroam's third-party config tool) and must never
  be fetched, regardless of `routing_only`.
- `priority` (1 = most important, 4 = least) breaks ties when two resources
  match a query with an equal keyword score.
- `category`/`description`/`audience` are for richer link recommendations
  and future UI use; they don't affect matching.

`resourceService.findResources(query)` does deterministic, token-based
keyword matching (not semantic search — "give me the password reset link"
must reliably find the password reset link every time, not whatever a
similarity score ranks first). `retrievalService.retrieveAnswer()` calls it
for every question **except** one where a specific timetable entity (course
code, venue code, or named lecturer) was recognized — "show me the BIT320
timetable" should never come back suggesting the timetable portal website;
the actual timetable answer already is the complete answer. Adding a new
destination is a one-entry JSON edit — no code change, and it becomes
crawlable (if `crawlable` isn't `false`) automatically too (see below).

**Website crawler** (`services/documentIngestion/website/`) — reuses the
exact same `htmlReader.js` and `chunker.js` the document pipeline already
uses, so there's one heading/table/list extractor and one chunker in the
whole project, not a second implementation for web pages:

- `sourcesConfig.js` — **derives its crawl list directly from
  `resources.json`** (no second hand-maintained URL list): `crawlable: false`
  → excluded entirely; `routing_only: true` → crawled but capped to ~400
  characters before chunking; otherwise → crawled and chunked normally.
  Adding a new resource to `resources.json` is the only edit needed to also
  make it crawlable.
- `dedupe.js` — removes navigation/footer/menu blocks that appear verbatim
  on 3+ distinct crawled pages, so the same "Home | Programmes | Contact"
  menu doesn't get embedded dozens of times across the site.
- `scripts/ingestWebsite.js` — orchestrates fetch → extract → dedupe →
  chunk, writing to **`data/website/chunks.json`** — deliberately a
  separate file from `data/documents/chunks.json` so the existing PDF/DOCX/
  TXT pipeline's own output is never touched by this addition.
  `buildKnowledgeIndex.js` reads both files when building the vector index.

**Blended retrieval priority.** `chatService.js` presents context to the LLM
in this order: timetable → structured/PDF-derived knowledge chunks →
website-derived knowledge chunks → resource links → (finally, the LLM's own
reasoning fills any remaining gap). This only reorders *presentation*, not
*retrieval* — semantic search still finds the same chunks; PDF-derived
content is just listed before website-derived content so the model reaches
for the more curated/structured source first when both are relevant.

**Recommended resources with reasons.** `chatService.answerQuestion()`
returns both `resources: [{title, url, topic}]` (unchanged, for existing
consumers) and an additive `recommendedResources: [{title, url, reason}]`,
where `reason` is a short, deterministic explanation (built from the
matched keyword and category, not an extra LLM call) — e.g. *"Matches your
question about 'forgot password' (Password Recovery)."*

---

## 2. Installation

### Python (timetable pipeline — separate project)

```bash
pip install requests beautifulsoup4 lxml pytest --break-system-packages
```

### Node (this backend)

Requires Node 18+ (uses the built-in `node:test` runner — no Jest/Mocha
dependency).

```bash
cd backend
npm install
cp .env.example .env
# edit .env and set GROQ_API_KEY
```

Dependencies installed: `express`, `cors`, `dotenv`, `axios`, `cheerio`
(HTML parsing), `mammoth` (DOCX→HTML), `pdf-parse` (PDF text extraction),
`@xenova/transformers` (local embedding model, no API key needed),
`groq-sdk` (LLM completions). Dev: `nodemon`.

---

## 3. Running the complete system

```bash
# Step 1 — Build timetable knowledge (separate Python project)
cd unilus_timetable
python -m unilus_timetable.pipeline --live --output-dir output
# or, without live network access:
#   python -m unilus_timetable.pipeline --lecturer-html <files> --student-html <files> --output-dir output

# Step 2 — Copy timetable output into the backend
cp output/timetable.json    ../backend/data/timetable/timetable.json
cp output/search_index.json ../backend/data/timetable/search_index.json

# Step 3 — Install backend dependencies
cd ../backend
npm install

# Step 4 — Process university documents (PDF/DOCX/TXT/HTML in data/documents/)
npm run ingest

# Step 5 — Crawl official UNILUS websites (see §7 below for the URL list/config)
npm run ingest:website

# Step 6 — Build embeddings + the knowledge vector index (documents + website combined)
npm run build-index
#   (shortcut for steps 4+5+6 together: npm run knowledge:rebuild)

# Step 7 — Start the backend
npm start
```

### Verifying it's working

```bash
# Health check
curl http://localhost:5000/

# Timetable: exact course lookup
curl http://localhost:5000/api/timetable/course/BIT320

# Timetable: fuzzy search
curl "http://localhost:5000/api/timetable/search?q=systems+development"

# Chatbot: ask a question (needs GROQ_API_KEY set) — this one should
# come back with an official link attached, not just prose
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "I forgot my password"}'

curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Where is BIT320 today?"}'

# Run the test suite (80 tests — chunking, all 4 document readers,
# metadata classification, knowledge search, query routing, context
# formatting, resource registry, website crawling/dedup, blended-retrieval
npm test
```

---

## 4. Project structure

```
backend/
  services/
    timetableService.js         Timetable search: O(1) exact + token-indexed fuzzy
    knowledgeService.js         Semantic search over document chunks, with threshold
    retrievalService.js         Single hybrid retrieveAnswer(query) entry point
    resourceService.js          Structured official-link registry lookup
    embeddingService.js         Local embedding model wrapper (no API key needed)
    vectorStore.js               Pluggable vector store interface (JSON now; same
                                  interface for Supabase Vector/Pinecone/Chroma/pgvector)
    chatService.js               Formats context, calls the LLM (Groq)
    aiService.js                 Groq client wrapper with model fallback
    documentIngestion/
      chunker.js                   Heading/table/list/page-aware chunking
      metadata.js                  Deterministic document_type classification
      readers/
        pdfReader.js, docxReader.js, textReader.js, htmlReader.js
      website/
        sourcesConfig.js            The one file to edit to crawl a new URL
        dedupe.js                   Cross-page navigation/boilerplate removal
  scripts/
    ingestDocuments.js           Read → extract → clean → chunk → metadata (PDF/DOCX/TXT/HTML)
    ingestWebsite.js             Crawl → extract → dedupe → chunk (official websites)
    buildKnowledgeIndex.js       Embeddings → vector store (documents + website combined)
  routes/
    timetableRoutes.js, chatRoutes.js
  data/
    timetable/                  timetable.json, search_index.json (from the Python pipeline)
    documents/                  Source PDFs/DOCX/TXT/HTML to ingest
    website/                    chunks.json (generated by ingestWebsite.js, gitignored)
    resources/                  resources.json — the structured official-link registry
    vectors/                    knowledge_vectors.json (generated, gitignored)
  tests/                        80 tests, node:test (no extra test framework needed)
  server.js
```


---

## 5. Migration guide (from the pre-redesign backend)

If you're replacing an existing `backend/` folder from before this redesign:

**Files this redesign REPLACES (delete the old versions):**
- `services/retrievalService.js` — old version had 3 disagreeing intent
  detectors including a hardcoded 10-course-name whitelist.
- `services/knowledgeService.js` — old version had no relevance threshold and
  returned the "top 5" regardless of actual relevance.
- `services/vectorService.js` — renamed to `services/embeddingService.js`.
- `services/chatService.js` — old version had dead code
  (`detectIntent`/`handleTimetableQuestion`/`formatTimetableResponse`, never
  called) and read a Q&A-pair schema (`topic`/`answer`) that the new pipeline
  doesn't produce.

**Files this redesign makes OBSOLETE (safe to delete):**
- `services/timetableVectorService.js` — its job (fuzzy timetable search) is
  now done by `timetableService.js`'s token index.
- `scripts/extractPDFs.js`, `scripts/buildPDFKnowledge.js`,
  `scripts/extractHandbook.js`, `scripts/processHandbook.js`,
  `scripts/buildKnowledge.js`, `scripts/buildWebsiteKnowledge.js`,
  `scripts/createKnowledgeVectors.js`, `scripts/scrapeWebsite.js`,
  `scripts/createTimetableVectors.js` — replaced by
  `scripts/ingestDocuments.js` + `scripts/buildKnowledgeIndex.js`.
- `scripts/chunkKnowledge.js` — was an empty file.
- Root-level `testChat.js`, `testEmbedding.js`, `testKnowledge.js`,
  `testTimetableVector.js`, `createTimetableVectors.js`, and their
  `scripts/` duplicates — ad hoc debug scripts; replaced by `tests/`.
- `data/knowledge.json`, `data/pdf_knowledge.json`,
  `data/handbook_knowledge.json`, `data/website_knowledge.json`,
  `data/pdf_text.json`, `data/handbook.txt` — the old Q&A-pair knowledge
  files. Re-ingest your source documents with `npm run ingest` instead.
- `models.js` (root) — a one-off Groq model-listing debug script, not part of
  the running server.

**Files UNCHANGED:**
- `services/aiService.js` (only the Groq client is now lazily instantiated,
  so the backend no longer crashes at startup if `GROQ_API_KEY` isn't set yet
  — needed for tests and for `npm run ingest`/`build-index`, which don't need
  an LLM at all).
- `routes/timetableRoutes.js`, `routes/chatRoutes.js`, `server.js` (only the
  port is now configurable via `PORT` in `.env`, defaulting to 5000 as before).

**What to re-point:**
- Put your real PDFs/DOCX/handbook files in `data/documents/`, then run
  `npm run knowledge:rebuild`.
- Copy your Python pipeline's `output/timetable.json` and
  `output/search_index.json` into `data/timetable/`.

---

## 6. Troubleshooting

**Adding a new official website/resource**
One data edit, no code changes: add an entry to `data/resources/resources.json`
(see the schema in §1d). It's picked up automatically both for link
recommendations AND for crawling (unless you set `"crawlable": false`) —
`sourcesConfig.js` derives its list from this file, so there's nothing
else to edit. Then `npm run knowledge:rebuild`.

**`npm run ingest:website` reports pages as `FAILED`**
Printed per-page, doesn't stop the batch. Common causes: the page requires
JavaScript to render (this crawler fetches static HTML only — a login-walled
SPA page may come back nearly empty, which is expected for `routing_only`
pages, not a bug), a timeout (15s default in `ingestWebsite.js`), or the URL
moved. The resource registry entry for that URL still works for linking
even if crawling its content fails.

**"Missing API keys" / Groq errors when asking a chat question**
Set `GROQ_API_KEY` in `.env`. Everything except `POST /api/chat` (timetable
routes, `npm test`, `npm run ingest`, `npm run build-index`) works without it.

**"timetableService: ../data/timetable/timetable.json not found"**
You haven't run the Python pipeline yet, or haven't copied its output into
`data/timetable/`. The server still starts — timetable queries just return
empty results until you do.

**`npm run build-index` fails with "Forbidden access to file...huggingface.co"**
The embedding model downloads its weights from huggingface.co on first use.
If you're behind a firewall/proxy or in a sandboxed CI environment, allow
outbound access to `huggingface.co`, or pre-download the model on a machine
with access and point `HF_HOME` at a shared cache directory. This is a
one-time download per machine; no API key is needed.

**Failed PDF extraction / a specific PDF produces zero chunks**
Check `npm run ingest`'s console output — it prints `FAILED: <message>` per
file instead of crashing the whole batch. If `pdf-parse` itself fails to
load at all (a native-dependency error, not a per-file error), the fix is
almost always `rm -rf node_modules package-lock.json && npm install` — a
stale `pdf-parse`/`pdfjs-dist` pairing is the most common cause, not a bug
in this code.

**Empty indexes / chatbot always says it doesn't know**
- For timetable questions: confirm `data/timetable/timetable.json` has
  entries (`curl http://localhost:5000/api/timetable/`).
- For knowledge questions: confirm `data/vectors/knowledge_vectors.json`
  exists and is non-empty (run `npm run knowledge:rebuild` if not). Also
  check `knowledgeService.js`'s `minScore` (default 0.35) isn't filtering
  out genuinely relevant results for your specific document set — lower it
  temporarily to see raw scores while tuning.

**Backend connection errors from a frontend**
Confirm `PORT` in `.env` matches what the frontend expects (default 5000),
and that CORS is enabled (it is, via the `cors` package, for all origins by
default — restrict this before production deployment).

**`npm audit` reports vulnerabilities in `protobufjs`/`sharp`**
These are transitive dependencies of `@xenova/transformers`'s ONNX runtime,
present in the original project's dependency tree already (not introduced by
this redesign). `npm audit fix --force` would downgrade
`@xenova/transformers` to a breaking older version — evaluate that trade-off
before applying it; it isn't done automatically here.
