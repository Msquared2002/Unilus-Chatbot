/**
 * lexicalSearchService.js
 * =======================
 * Lightweight BM25-style lexical retrieval over the same records used by
 * the vector store. At the current corpus size (~1k chunks), an in-memory
 * scan is fast and gives the RAG system something dense vectors are bad at:
 * exact course/programme names, years, currencies, codes, acronyms and
 * institution-specific terminology.
 */

const { buildSearchText } = require("./searchTextService");

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can",
  "could", "did", "do", "does", "for", "from", "had", "has", "have", "how",
  "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or",
  "our", "should", "that", "the", "their", "them", "there", "these", "they",
  "this", "to", "was", "we", "were", "what", "when", "where", "which", "who",
  "will", "with", "would", "you", "your", "am", "im", "i'm", "please", "tell",
]);

function stemToken(token) {
  if (/^[a-z]+\d+[a-z\d]*$/i.test(token)) return token; // keep BIT402 etc.
  if (token.length > 6 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

function tokenize(text = "", { keepStopWords = false } = {}) {
  const normalized = String(text)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .map(stemToken)
    .filter((token) => token.length > 1 && (keepStopWords || !STOP_WORDS.has(token)));
}

function termCounts(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function searchRecords(query, records, { topK = 20, filter = null, k1 = 1.4, b = 0.75 } = {}) {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length || !records.length) return [];

  const docs = records
    .filter((r) => (filter ? filter(r.metadata || {}) : true))
    .map((record) => {
      const searchText = record.search_text || buildSearchText(record.text || "", record.metadata || {});
      const tokens = tokenize(searchText, { keepStopWords: false });
      return { record, tokens, counts: termCounts(tokens), length: tokens.length };
    });

  if (!docs.length) return [];

  const avgDocLength = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;
  const docFrequency = new Map();
  for (const term of queryTerms) {
    let df = 0;
    for (const doc of docs) if (doc.counts.has(term)) df += 1;
    docFrequency.set(term, df);
  }

  const scored = [];
  for (const doc of docs) {
    let score = 0;
    const matchedTerms = [];

    for (const term of queryTerms) {
      const tf = doc.counts.get(term) || 0;
      if (!tf) continue;
      matchedTerms.push(term);

      const df = docFrequency.get(term) || 0;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      const denominator = tf + k1 * (1 - b + b * (doc.length / avgDocLength));
      score += idf * ((tf * (k1 + 1)) / denominator);
    }

    if (score <= 0) continue;

    const coverage = matchedTerms.length / queryTerms.length;
    scored.push({
      id: doc.record.id,
      text: doc.record.text,
      search_text: doc.record.search_text,
      metadata: doc.record.metadata || {},
      score,
      matchedTerms,
      coverage,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage)
    .slice(0, topK);
}

module.exports = { searchRecords, tokenize, stemToken, STOP_WORDS };
