/**
 * knowledgeService.js
 * ===================
 * Hybrid university-knowledge retrieval.
 *
 * Candidate generation combines:
 *   - dense semantic search (MiniLM vectors), and
 *   - lexical BM25-style search over metadata-enriched search text.
 *
 * The two rankings are fused with Reciprocal Rank Fusion (RRF), then
 * boosted by planner-extracted metadata entities, de-duplicated, and only
 * then trimmed to the small set passed to the answer model.
 *
 * This fixes the old failure mode where one raw query was embedded once,
 * only the top 5 cosine results were considered, and a global 0.35 cutoff
 * could hide correct information that genuinely existed in the corpus.
 */

const path = require("path");
const embeddingService = require("./embeddingService");
const { JsonVectorStore } = require("./vectorStore");
const lexicalSearchService = require("./lexicalSearchService");
const { runtimeMetadata, buildSearchText } = require("./searchTextService");

const DEFAULT_TOP_K = 8;
const DEFAULT_DENSE_TOP_K = 24;
const DEFAULT_LEXICAL_TOP_K = 24;
// Kept as an exported compatibility name. It is now only the minimum dense
// evidence needed when a candidate has no lexical/metadata support; it is no
// longer a hard global "everything below this disappears" gate.
const DEFAULT_MIN_SCORE = 0.22;
const RRF_K = 60;
const DEFAULT_MAX_CONTEXT_CHARS = 2400;

const store = new JsonVectorStore(path.join(__dirname, "../data/vectors/knowledge_vectors.json"));

function uniqueQueries(query, searchQueries = []) {
  const seen = new Set();
  const result = [];
  for (const value of [query, ...searchQueries]) {
    if (typeof value !== "string") continue;
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= 3) break; // original + at most two useful rewrites
  }
  return result;
}

function normalizeComparable(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(normalizeComparable).join(" ");
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entityMatchDetails(metadata, text, entities = {}) {
  if (!entities || !Object.keys(entities).length) {
    return { count: 0, matched: [], conflicts: [] };
  }

  const meta = runtimeMetadata(metadata || {}, text || "");
  // Topic matching normally relies on structured metadata. Some legacy TXT/PDF
  // chunks (notably the handbook) have an empty section even when a numbered
  // heading appears at the start of the chunk, so include a short leading text
  // window as a fallback. This is deliberately bounded to avoid treating every
  // incidental mention deep in a long chunk as its topic.
  const broadSearchable = normalizeComparable([
    meta.retrieval_title,
    meta.title,
    meta.source_file,
    meta.topic,
    meta.section,
    meta.document_type,
    String(text || "").slice(0, 700),
  ].filter(Boolean).join(" "));

  const explicitValues = {
    programme: meta.programme,
    academic_year: meta.academic_year,
    audience: meta.audience,
    currency: meta.currency,
    document_type: meta.document_type,
    fee_scope: meta.fee_scope,
  };

  const matched = [];
  const conflicts = [];

  for (const [key, rawValue] of Object.entries(entities)) {
    if (rawValue == null || rawValue === "") continue;
    const queryValues = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .map(normalizeComparable)
      .filter(Boolean);
    if (!queryValues.length) continue;

    if (key === "topic") {
      const broadTokens = new Set(broadSearchable.split(/\s+/).filter(Boolean));
      const topicHit = queryValues.some((needle) => {
        if (broadSearchable.includes(needle)) return true;
        const tokens = needle.split(/\s+/).filter((token) => token.length > 2);
        if (!tokens.length) return false;
        const hitCount = tokens.filter((token) => broadTokens.has(token)).length;
        return hitCount === tokens.length || (tokens.length >= 3 && hitCount / tokens.length >= 0.67);
      });
      if (topicHit) matched.push(key);
      continue;
    }

    const candidateRaw = explicitValues[key];
    const candidateValues = (Array.isArray(candidateRaw) ? candidateRaw : [candidateRaw])
      .filter((value) => value != null && value !== "")
      .map(normalizeComparable)
      .filter(Boolean);

    if (!candidateValues.length) continue; // unknown is not a contradiction

    const hit = queryValues.some((queryValue) =>
      candidateValues.some((candidateValue) =>
        candidateValue === queryValue ||
        candidateValue.includes(queryValue) ||
        queryValue.includes(candidateValue)
      )
    );

    if (hit) matched.push(key);
    else if (["programme", "academic_year", "audience", "currency", "fee_scope"].includes(key)) {
      conflicts.push(key);
    }
  }

  return { count: matched.length, matched, conflicts };
}

function normalizeTextForDedupe(text = "") {
  return String(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function sourceDescriptor(metadata = {}) {
  return {
    source_file: metadata.source_file || null,
    title: metadata.title || null,
    page_number: metadata.page_number ?? null,
    url: metadata.url || null,
  };
}

function mergeDuplicateCandidates(candidates) {
  const byText = new Map();

  for (const candidate of candidates) {
    const key = normalizeTextForDedupe(candidate.text);
    if (!key) continue;

    if (!byText.has(key)) {
      byText.set(key, { ...candidate, alternate_sources: [] });
      continue;
    }

    const existing = byText.get(key);
    const stronger = candidate.fusedScore > existing.fusedScore ? candidate : existing;
    const weaker = stronger === candidate ? existing : candidate;
    const alternates = [
      ...(existing.alternate_sources || []),
      ...(candidate.alternate_sources || []),
      sourceDescriptor(weaker.metadata),
    ];

    byText.set(key, {
      ...stronger,
      alternate_sources: alternates.filter((value, index, arr) => {
        const serial = JSON.stringify(value);
        return arr.findIndex((x) => JSON.stringify(x) === serial) === index;
      }),
    });
  }

  return [...byText.values()];
}

function candidateHasEvidence(candidate, minDenseScore) {
  if ((candidate.denseScore ?? -1) >= minDenseScore) return true;
  if (candidate.entityMatches > 0) return true;
  if (candidate.lexicalMatchedTerms.length >= 2) return true;
  if (candidate.lexicalCoverage >= 0.6 && candidate.lexicalScore > 0) return true;
  return false;
}

function addRrfCandidate(map, result, {
  rank,
  queryIndex,
  mode,
  queryWeight,
  modeWeight,
}) {
  const existing = map.get(result.id) || {
    id: result.id,
    text: result.text,
    search_text: result.search_text || null,
    metadata: result.metadata || {},
    fusedScore: 0,
    denseScore: null,
    lexicalScore: 0,
    lexicalCoverage: 0,
    lexicalMatchedTerms: [],
    queryHits: new Set(),
  };

  existing.fusedScore += (queryWeight * modeWeight) / (RRF_K + rank);
  existing.queryHits.add(queryIndex);

  if (mode === "dense") {
    existing.denseScore = Math.max(existing.denseScore ?? -Infinity, result.score);
  } else {
    existing.lexicalScore = Math.max(existing.lexicalScore, result.score || 0);
    existing.lexicalCoverage = Math.max(existing.lexicalCoverage, result.coverage || 0);
    existing.lexicalMatchedTerms = [...new Set([
      ...existing.lexicalMatchedTerms,
      ...(result.matchedTerms || []),
    ])];
  }

  map.set(result.id, existing);
}

function attachMetadataBoosts(candidates, entities) {
  const conflictPenalty = {
    programme: 0.055,
    academic_year: 0.028,
    currency: 0.024,
    audience: 0.018,
    fee_scope: 0.045,
  };

  return candidates.map((candidate) => {
    const { count, matched, conflicts } = entityMatchDetails(candidate.metadata, candidate.text, entities);
    const isWebsite = candidate.metadata?.document_type === "website";
    const metadataBoost = Math.min(count, 4) * 0.012;
    const topicBoost = matched.includes("topic") ? 0.018 : 0;
    const lexicalBoost = candidate.lexicalCoverage * 0.006;
    const highCoverageBoost = candidate.lexicalCoverage >= 0.8
      ? 0.010
      : (candidate.lexicalCoverage >= 0.6 ? 0.004 : 0);
    const structuredSourceBoost = isWebsite ? 0 : 0.002;
    const penalty = conflicts.reduce((sum, key) => sum + (conflictPenalty[key] || 0), 0);

    return {
      ...candidate,
      entityMatches: count,
      matchedEntities: matched,
      conflictingEntities: conflicts,
      fusedScore: candidate.fusedScore + metadataBoost + topicBoost + lexicalBoost + highCoverageBoost + structuredSourceBoost - penalty,
    };
  });
}


function suppressConflictingCandidates(candidates, entities = {}, { minCleanCandidates = 3 } = {}) {
  const strictKeys = ["programme", "academic_year", "audience", "currency", "fee_scope"]
    .filter((key) => entities[key] != null && entities[key] !== "");

  if (!strictKeys.length) return candidates;

  const clean = candidates.filter((candidate) => {
    const conflicts = candidate.conflictingEntities || [];
    return !conflicts.some((key) => strictKeys.includes(key));
  });

  // If retrieval already found a healthy set of candidates that do not
  // contradict the planner's explicit entities, do not pollute final LLM
  // context with contradictory audience/currency/programme/year records.
  // When only one or two clean hits exist, keep the ranked fallbacks so the
  // system remains recall-friendly rather than becoming over-filtered.
  if (clean.length >= minCleanCandidates) return clean;
  return candidates;
}

function selectSufficientEvidence(candidates, entities = {}, { minAlignedCandidates = 3, maxAlignedCandidates = 5 } = {}) {
  const discriminatorKeys = ["programme", "academic_year", "audience", "currency", "fee_scope"]
    .filter((key) => entities[key] != null && entities[key] !== "");

  // Be conservative: only trim context when the query contains at least two
  // strong discriminators and retrieval has several candidates that explicitly
  // match every one of them. Otherwise preserve the wider ranked candidate set.
  if (discriminatorKeys.length < 2) return candidates;

  const aligned = candidates.filter((candidate) => {
    const conflicts = new Set(candidate.conflictingEntities || []);
    const matches = new Set(candidate.matchedEntities || []);
    return discriminatorKeys.every((key) => !conflicts.has(key) && matches.has(key));
  });

  if (aligned.length >= minAlignedCandidates) {
    return aligned.slice(0, Math.min(maxAlignedCandidates, aligned.length));
  }

  return candidates;
}

function expandWithNeighbors(selected, allRecords, topK) {
  if (!selected.length || selected.length >= topK) return selected.slice(0, topK);

  const bySourceAndIndex = new Map();
  for (const record of allRecords) {
    const meta = record.metadata || {};
    const source = meta.source_file || meta.url;
    if (!source || !Number.isInteger(meta.chunk_index)) continue;
    bySourceAndIndex.set(`${source}::${meta.chunk_index}`, record);
  }

  const output = [...selected];
  const seenIds = new Set(output.map((r) => r.id));

  // Neighbour expansion is deliberately limited to the strongest three hits.
  for (const candidate of selected.slice(0, 3)) {
    if (output.length >= topK) break;
    const meta = candidate.metadata || {};
    const source = meta.source_file || meta.url;
    if (!source || !Number.isInteger(meta.chunk_index)) continue;

    for (const offset of [-1, 1]) {
      const neighbor = bySourceAndIndex.get(`${source}::${meta.chunk_index + offset}`);
      if (!neighbor || seenIds.has(neighbor.id)) continue;

      output.push({
        id: neighbor.id,
        text: neighbor.text,
        search_text: neighbor.search_text || buildSearchText(neighbor.text || "", neighbor.metadata || {}),
        metadata: neighbor.metadata || {},
        fusedScore: candidate.fusedScore * 0.72,
        denseScore: null,
        lexicalScore: 0,
        lexicalCoverage: 0,
        lexicalMatchedTerms: [],
        queryHits: new Set(),
        entityMatches: 0,
        matchedEntities: [],
        conflictingEntities: [],
        alternate_sources: [],
        neighborOf: candidate.id,
      });
      seenIds.add(neighbor.id);
      if (output.length >= topK) break;
    }
  }

  return output.slice(0, topK);
}

function focusText(text, matchedTerms = [], maxChars = DEFAULT_MAX_CONTEXT_CHARS) {
  const value = String(text || "");
  if (value.length <= maxChars) {
    return { text: value, excerpted: false, originalLength: value.length };
  }

  const lower = value.toLowerCase();
  const usefulTerms = [...matchedTerms]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let anchor = -1;
  for (const term of usefulTerms) {
    anchor = lower.indexOf(String(term).toLowerCase());
    if (anchor !== -1) break;
  }
  if (anchor === -1) anchor = 0;

  let start = Math.max(0, anchor - Math.floor(maxChars * 0.3));
  let end = Math.min(value.length, start + maxChars);
  if (end - start < maxChars) start = Math.max(0, end - maxChars);

  // Avoid cutting in the middle of a word where possible.
  if (start > 0) {
    const nextSpace = value.indexOf(" ", start);
    if (nextSpace !== -1 && nextSpace < start + 80) start = nextSpace + 1;
  }
  if (end < value.length) {
    const previousSpace = value.lastIndexOf(" ", end);
    if (previousSpace > start + Math.floor(maxChars * 0.7)) end = previousSpace;
  }

  const excerpt = `${start > 0 ? "…" : ""}${value.slice(start, end).trim()}${end < value.length ? "…" : ""}`;
  return { text: excerpt, excerpted: true, originalLength: value.length };
}

/**
 * @param {string} query
 * @param {object} options
 * @param {number} options.topK final chunks returned to the answer model
 * @param {number} options.minScore compatibility alias for minimum unsupported dense score
 * @param {string} options.documentType optional exact document-type filter
 * @param {string[]} options.searchQueries planner-produced alternate searches
 * @param {object} options.entities planner-produced retrieval entities
 */
async function searchKnowledge(
  query,
  {
    topK = DEFAULT_TOP_K,
    denseTopK = DEFAULT_DENSE_TOP_K,
    lexicalTopK = DEFAULT_LEXICAL_TOP_K,
    minScore = DEFAULT_MIN_SCORE,
    documentType = null,
    searchQueries = [],
    entities = {},
    embedFn = embeddingService.createEmbedding,
    store: storeOverride = null,
    expandNeighbors = true,
  } = {}
) {
  const activeStore = storeOverride || store;
  const filter = documentType ? (metadata) => metadata.document_type === documentType : null;
  const records = await activeStore.list({ filter });
  if (!records.length) return [];

  const queries = uniqueQueries(query, searchQueries);
  const candidateMap = new Map();

  for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
    const searchQuery = queries[queryIndex];
    // Original wording carries slightly more weight than generated rewrites.
    const queryWeight = queryIndex === 0 ? 1 : 0.9;

    let denseResults = [];
    try {
      const queryEmbedding = await embedFn(searchQuery);
      denseResults = await activeStore.search(queryEmbedding, {
        topK: denseTopK,
        minScore: 0,
        filter,
      });
    } catch (err) {
      // Hybrid retrieval should still work lexically when the embedding model
      // is temporarily unavailable. The caller can log/inspect diagnostics,
      // but a missing local model should not make the entire chatbot blind.
      console.warn(`[knowledge] dense search unavailable for one query: ${err.message}`);
    }

    denseResults.forEach((result, index) => addRrfCandidate(candidateMap, result, {
      rank: index + 1,
      queryIndex,
      mode: "dense",
      queryWeight,
      modeWeight: 1.0,
    }));

    const lexicalResults = lexicalSearchService.searchRecords(searchQuery, records, {
      topK: lexicalTopK,
      filter: null, // records are already filtered above
    });

    lexicalResults.forEach((result, index) => addRrfCandidate(candidateMap, result, {
      rank: index + 1,
      queryIndex,
      mode: "lexical",
      queryWeight,
      modeWeight: 1.12,
    }));
  }

  let candidates = attachMetadataBoosts([...candidateMap.values()], entities)
    .filter((candidate) => candidateHasEvidence(candidate, minScore))
    .sort((a, b) => b.fusedScore - a.fusedScore);

  candidates = mergeDuplicateCandidates(candidates)
    .sort((a, b) => b.fusedScore - a.fusedScore);

  candidates = suppressConflictingCandidates(candidates, entities);
  candidates = selectSufficientEvidence(candidates, entities);

  let selected = candidates.slice(0, topK);
  if (expandNeighbors) selected = expandWithNeighbors(selected, records, topK);

  return selected.map((r) => {
    const meta = runtimeMetadata(r.metadata || {}, r.text || "");
    const focused = focusText(r.text, r.lexicalMatchedTerms || []);
    return {
      id: r.id,
      text: focused.text,
      score: r.fusedScore,
      source_file: meta.source_file || null,
      document_type: meta.document_type || null,
      title: meta.title || null,
      retrieval_title: meta.retrieval_title || null,
      section: meta.section || null,
      page_number: meta.page_number ?? null,
      url: meta.url || null,
      programme: meta.programme || null,
      academic_year: meta.academic_year || null,
      currency: meta.currency || null,
      audience: meta.audience || [],
      fee_scope: meta.fee_scope || null,
      source_type: meta.source_type || null,
      observed_date: meta.observed_date || null,
      source_image_filenames: meta.source_image_filenames || [],
      place_id: meta.place_id || null,
      place_ids: meta.place_ids || [],
      operational_information_may_change: Boolean(meta.operational_information_may_change),
      alternate_sources: r.alternate_sources || [],
      retrieval: {
        denseScore: Number.isFinite(r.denseScore) ? r.denseScore : null,
        lexicalScore: r.lexicalScore || 0,
        lexicalCoverage: r.lexicalCoverage || 0,
        matchedTerms: r.lexicalMatchedTerms || [],
        matchedEntities: r.matchedEntities || [],
        conflictingEntities: r.conflictingEntities || [],
        queryHits: [...(r.queryHits || [])],
        excerpted: focused.excerpted,
        originalTextLength: focused.originalLength,
        neighborOf: r.neighborOf || null,
      },
    };
  });
}

async function knowledgeBaseSize() {
  return store.count();
}

module.exports = {
  searchKnowledge,
  knowledgeBaseSize,
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  DEFAULT_DENSE_TOP_K,
  DEFAULT_LEXICAL_TOP_K,
  uniqueQueries,
  entityMatchDetails,
  suppressConflictingCandidates,
  selectSufficientEvidence,
  focusText,
  DEFAULT_MAX_CONTEXT_CHARS,
};
