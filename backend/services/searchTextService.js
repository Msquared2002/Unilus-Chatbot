/**
 * searchTextService.js
 * ====================
 *
 * Builds the text used for retrieval. The user-facing chunk text remains
 * untouched; this enriched representation adds metadata that would otherwise
 * be invisible to the embedding/lexical search (programme, year, currency,
 * filename, section, topic, etc.).
 */

const {
  cleanFilenameLabel,
  extractAcademicYear,
  extractCurrency,
  extractAudience,
  extractFeeScope,
  extractProgramme,
  buildRetrievalTitle,
  classifyDocumentType,
  sourceLooksProgrammeSpecific,
} = require("./documentIngestion/metadata");

function runtimeMetadata(metadata = {}, text = "") {
  const sourceLabel = cleanFilenameLabel(metadata.source_file || metadata.url || "");
  const combined = [
    sourceLabel,
    metadata.title,
    metadata.retrieval_title,
    metadata.section,
    metadata.topic,
    text,
  ].filter(Boolean).join("\n");

  const inferredDocumentType = !metadata.document_type || metadata.document_type === "general"
    ? classifyDocumentType(
        metadata.source_file || metadata.url || "",
        [metadata.retrieval_title, metadata.title].filter(Boolean).join(" ")
      )
    : metadata.document_type;
  const programmeSpecific = sourceLooksProgrammeSpecific(sourceLabel) ||
    sourceLooksProgrammeSpecific(metadata.retrieval_title || "") ||
    sourceLooksProgrammeSpecific(metadata.title || "");
  const programme = metadata.programme || (programmeSpecific ? extractProgramme(combined) : null);
  const academicYear = metadata.academic_year || extractAcademicYear(sourceLabel) || extractAcademicYear(combined);
  const currency = metadata.currency || extractCurrency(combined);
  const sourceAudience = extractAudience([
    sourceLabel,
    metadata.title,
    metadata.retrieval_title,
    metadata.topic,
    metadata.url,
  ].filter(Boolean).join(" "));
  const audience = sourceAudience.length
    ? sourceAudience
    : (Array.isArray(metadata.audience) && metadata.audience.length
      ? metadata.audience
      : extractAudience(combined));

  const feeScope = metadata.fee_scope || extractFeeScope({
    filename: metadata.source_file || "",
    title: metadata.retrieval_title || metadata.title || "",
    documentType: inferredDocumentType,
    programme,
    url: metadata.url || "",
    topic: metadata.topic || "",
    section: metadata.section || "",
  });

  const resolved = {
    ...metadata,
    document_type: inferredDocumentType,
    programme,
    academic_year: academicYear,
    currency,
    audience,
    fee_scope: feeScope,
  };

  if (!resolved.retrieval_title) {
    resolved.retrieval_title = buildRetrievalTitle({
      filename: metadata.source_file || metadata.url || "",
      title: metadata.title || sourceLabel,
      documentType: resolved.document_type,
      programme,
      academicYear,
      audience,
      currency,
    });
  }

  return resolved;
}

function buildSearchText(text, metadata = {}) {
  const meta = runtimeMetadata(metadata, text);
  const lines = [];

  const add = (label, value) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length) lines.push(`${label}: ${value.join(", ")}`);
      return;
    }
    lines.push(`${label}: ${value}`);
  };

  add("Document", meta.retrieval_title || meta.title);
  add("Source", cleanFilenameLabel(meta.source_file || ""));
  add("Document type", meta.document_type);
  add("Programme", meta.programme);
  add("Academic year", meta.academic_year);
  add("Audience", meta.audience);
  add("Currency", meta.currency);
  add("Fee scope", meta.fee_scope);
  add("Topic", meta.topic);
  add("Section", meta.section);
  lines.push(`Content:\n${text}`);

  return lines.join("\n");
}

module.exports = { buildSearchText, runtimeMetadata };
