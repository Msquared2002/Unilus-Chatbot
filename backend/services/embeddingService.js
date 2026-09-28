/**
 * embeddingService.js
 * ===================
 *
 * This is vectorService.js, renamed and given a slightly wider
 * interface, so that swapping the embedding model or provider later
 * (e.g. moving to an API-based embedding model) only ever touches
 * this one file. Nothing else in the codebase should import
 * '@xenova/transformers' directly.
 */

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSIONS = 384;

let extractor = null;
let loadingPromise = null;

async function loadModel() {
  if (extractor) return extractor;
  if (!loadingPromise) {
    // Lazily required: this pulls in @xenova/transformers, which is
    // only actually needed once real embeddings are generated. Code
    // paths that inject a fake embedFn (tests) never hit this.
    const { pipeline } = require("@xenova/transformers");
    loadingPromise = pipeline("feature-extraction", MODEL_NAME).then((model) => {
      extractor = model;
      console.log(`Embedding model loaded: ${MODEL_NAME}`);
      return model;
    });
  }
  return loadingPromise;
}

async function createEmbedding(text) {
  const model = await loadModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

async function createEmbeddings(texts) {
  // Sequential on purpose: the underlying transformers.js pipeline is
  // not safe to call concurrently on a single model instance.
  const results = [];
  for (const text of texts) {
    results.push(await createEmbedding(text));
  }
  return results;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

module.exports = {
  createEmbedding,
  createEmbeddings,
  cosineSimilarity,
  EMBEDDING_DIMENSIONS,
  MODEL_NAME,
};
