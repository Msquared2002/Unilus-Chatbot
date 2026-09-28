/**
 * vectorStore.js
 * ==============
 *
 * A minimal, provider-agnostic interface over "a place vectors live".
 * Everything in this codebase talks to a VectorStore through this
 * interface — never directly to a JSON file, a Postgres table, or a
 * Pinecone index. That's the whole point: swapping the backing store
 * later (Supabase Vector / Pinecone / Chroma / pgvector) means writing
 * one new class here and changing one line at startup, not touching
 * knowledgeService.js or the ingestion scripts.
 *
 * Every chunk stored here MUST carry full metadata (see
 * documentIngestion/chunker.js for the shape) — this store never
 * accepts an anonymous vector. That's what makes every answer
 * traceable back to a source file, page, and section.
 */

const fs = require("fs");
const path = require("path");
const { cosineSimilarity } = require("./embeddingService");

class VectorStore {
  // eslint-disable-next-line no-unused-vars
  async upsert(records) {
    throw new Error("upsert() not implemented");
  }

  // eslint-disable-next-line no-unused-vars
  async search(queryEmbedding, { topK = 5, filter = null } = {}) {
    throw new Error("search() not implemented");
  }

  // Returns records for provider-independent lexical/hybrid retrieval.
  // A future DB-backed store can implement this as an indexed lexical
  // query instead; the JSON implementation simply returns its in-memory
  // records because the corpus is small.
  // eslint-disable-next-line no-unused-vars
  async list({ filter = null } = {}) {
    throw new Error("list() not implemented");
  }

  async count() {
    throw new Error("count() not implemented");
  }

  async clear() {
    throw new Error("clear() not implemented");
  }
}

/**
 * JSON-file-backed implementation. Fine for a few thousand chunks;
 * swap for a real vector database (see class doc above) once the
 * corpus grows past what a single JSON file + brute-force cosine scan
 * can serve interactively.
 */
class JsonVectorStore extends VectorStore {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this._records = null;
  }

  _load() {
    if (this._records) return this._records;
    if (!fs.existsSync(this.filePath)) {
      this._records = [];
      return this._records;
    }
    this._records = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    return this._records;
  }

  _persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this._records, null, 2));
  }

  async upsert(records) {
    for (const record of records) {
      if (!record.id) throw new Error("VectorStore.upsert: every record needs an id");
      if (!record.embedding) throw new Error(`VectorStore.upsert: record ${record.id} has no embedding`);
      if (!record.metadata) throw new Error(`VectorStore.upsert: record ${record.id} has no metadata — refusing to store an anonymous vector`);
    }

    const existing = this._load();
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const record of records) byId.set(record.id, record);
    this._records = [...byId.values()];
    this._persist();
  }

  async search(queryEmbedding, { topK = 5, filter = null, minScore = 0 } = {}) {
    const records = this._load();

    const scored = records
      .filter((r) => (filter ? filter(r.metadata) : true))
      .map((r) => ({
        id: r.id,
        text: r.text,
        search_text: r.search_text || null,
        metadata: r.metadata,
        score: cosineSimilarity(queryEmbedding, r.embedding),
      }))
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  async list({ filter = null } = {}) {
    const records = this._load();
    return filter ? records.filter((r) => filter(r.metadata || {})) : records.slice();
  }

  async count() {
    return this._load().length;
  }

  async clear() {
    this._records = [];
    this._persist();
  }
}

module.exports = { VectorStore, JsonVectorStore };
