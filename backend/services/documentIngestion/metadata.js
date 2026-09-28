/**
 * documentIngestion/metadata.js
 * ===============================
 *
 * General metadata extraction for documents. Metadata is used twice:
 *   1. for human-facing source attribution/citations;
 *   2. for retrieval, where programme/year/currency/audience/title clues
 *      materially improve both lexical and dense search.
 *
 * The extractor deliberately prefers general patterns over a hardcoded
 * programme catalogue. New degree names therefore work without adding a
 * branch for every programme UNILUS introduces.
 */

const DOCUMENT_TYPE_RULES = [
  { type: "fee_schedule", pattern: /\bfee(s)?\b|\btuition\b/i },
  { type: "form", pattern: /\bform\b|\bexemption\b/i },
  { type: "regulation", pattern: /\bregulation|rules?\b|\bcode.of.conduct\b|\bdisciplinary\b/i },
  { type: "handbook", pattern: /\bhandbook\b/i },
  { type: "prospectus", pattern: /\bprospectus\b/i },
  { type: "notice", pattern: /\bnotice\b|\bnews\s*letter\b|\bannouncement\b/i },
  { type: "guide", pattern: /\bguide\b/i },
];

const GENERIC_HEADINGS = new Set([
  "university of lusaka",
  "the university of lusaka",
  "unilus",
  "contents",
  "table of contents",
]);

function normalizeSeparators(value = "") {
  return String(value)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFilenameLabel(filename) {
  return normalizeSeparators(filename)
    // Upload timestamp/hash suffixes used by some collected files.
    .replace(/\b\d{8}\s+\d{6}\s+[a-f0-9]{8,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulHeading(firstHeading) {
  if (!firstHeading || !firstHeading.trim()) return false;
  const value = firstHeading.trim();
  const lower = value.toLowerCase();

  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  if (GENERIC_HEADINGS.has(lower)) return false;
  if (value.length < 3) return false;
  return true;
}

function classifyDocumentType(filename, firstFewLines = "") {
  const filenameText = String(filename || "").replace(/[_-]+/g, " ");
  const contentText = String(firstFewLines || "").replace(/[_-]+/g, " ");

  // Filename signals are much safer than arbitrary chunk/body words. A
  // handbook can discuss fees and forms without becoming a fee schedule/form.
  for (const rule of DOCUMENT_TYPE_RULES) {
    if (rule.pattern.test(filenameText)) return rule.type;
  }

  // Content fallback is intentionally stricter than the filename rules.
  if (/\bfee schedule\b|\btuition fees?\b/i.test(contentText)) return "fee_schedule";
  if (/\bstudent handbook\b/i.test(contentText)) return "handbook";
  if (/\bprospectus\b/i.test(contentText)) return "prospectus";
  if (/\bcode of conduct\b|\bdisciplinary procedures?\b|\bacademic regulations?\b/i.test(contentText)) return "regulation";

  // Programme-specific currency files are overwhelmingly fee schedules even
  // when the filename omits the literal word "fees" (one current Pharmacy
  // ZMW source has exactly that shape).
  const sourceLabel = cleanFilenameLabel(filenameText);
  if (sourceLooksProgrammeSpecific(sourceLabel) && /\b(?:ZMW|ZMK|USD)\b/i.test(sourceLabel)) {
    return "fee_schedule";
  }

  return "general";
}

function deriveTitle(filename, firstHeading) {
  if (isUsefulHeading(firstHeading)) return firstHeading.trim();
  return cleanFilenameLabel(filename);
}

function extractAcademicYear(text = "") {
  // Accept a single accidental trailing digit (e.g. a source named "20266")
  // but do not mistake long upload timestamps such as 20260828 for a year.
  const matches = String(text).match(/\b20\d{2}(?:\d)?\b/g);
  if (!matches || !matches.length) return null;
  const years = matches.map((value) => Number(value.slice(0, 4)));
  return Math.max(...years);
}

function extractCurrency(text = "") {
  const upper = String(text).toUpperCase();
  if (/\bZMW\b|\bZMK\b/.test(upper)) return "ZMW";
  if (/\bUSD\b|\bUS\s*DOLLARS?\b/.test(upper)) return "USD";
  return null;
}

function extractAudience(text = "") {
  const lower = String(text).toLowerCase();
  const values = [];
  const nonSadc = /\bnon[\s-]?sadc\b/.test(lower);

  if (/\blocal\b/.test(lower)) values.push("local");
  if (!nonSadc && /\bsadc\b/.test(lower)) values.push("SADC");
  if (nonSadc || /\bforeign\b|\binternational\b/.test(lower)) values.push("foreign");
  return [...new Set(values)];
}

function extractFeeScope({
  filename = "",
  title = "",
  documentType = null,
  programme = null,
  url = "",
  topic = "",
  section = "",
} = {}) {
  const source = [filename, title, url, topic, section]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  const feeLike = documentType === "fee_schedule" || /\bfee(?:s)?\b|\btuition\b/.test(source);
  if (!feeLike) return null;

  if (/\baccommodation\b|\baccomodation\b|\bhostel\b|\bresidence\b|\broom(?:s)?\b|\bbed\s*space\b/.test(source)) {
    return "accommodation";
  }
  if (/\bgraduation\b|\bconvocation\b|\bgown\b/.test(source)) return "graduation";
  if (/\bapplication\s+fee(?:s)?\b|\bapplication\s+cost\b|\bapply(?:ing)?\s+fee(?:s)?\b/.test(source)) {
    return "application";
  }
  if (/\bexamination\s+fee(?:s)?\b|\bexam\s+fee(?:s)?\b/.test(source)) return "examination";
  if (/\bregistration\s+fee(?:s)?\b/.test(source)) return "registration";

  if (
    programme ||
    /\bundergraduate\b|\bpostgraduate\b|\bprogramme\b|\bprogram\b|\btuition\b|\bfee\s*schedule\b|\blocal\s*(?:and|&)\s*sadc\b|\bnon\s*sadc\b/.test(source)
  ) {
    return "programme_tuition";
  }

  return "general_fees";
}

function normalizeProgrammeLabel(label) {
  if (!label) return null;
  return label
    .replace(/\bPHAMARCY\b/gi, "PHARMACY")
    .replace(/\bDESEASES\b/gi, "DISEASES")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(?:Usd|Zmw|Unilus)\b.*$/i, "")
    .trim();
}

function extractProgramme(text = "") {
  const normalized = normalizeSeparators(text)
    .replace(/\bPHAMARCY\b/gi, "PHARMACY")
    .replace(/\bDESEASES\b/gi, "DISEASES");

  // Prefer a degree/programme phrase immediately preceding fee/prospectus
  // markers. This is broad enough for Bachelor/Master/Diploma/Doctorate,
  // LLM/MBA/DBA/PhD and future named programmes.
  const degreePattern = /\b((?:BACHELOR|MASTER|DIPLOMA|DOCTOR(?:ATE)?|PHD|PH\.D|LLM|MBA|DBA|EXMBA)\b[\s\S]{0,120}?)(?=\s+(?:20\d{2}|FEE(?:S| SCHEDULE)?|TUITION|USD|ZMW|LOCAL|FOREIGN|SADC|UNILUS)\b|$)/i;
  const match = normalized.match(degreePattern);
  if (!match) return null;

  let programme = match[1]
    .replace(/\b(?:FEES?|FEE SCHEDULE|TUITION)\b.*$/i, "")
    .replace(/\b20\d{2}\b.*$/i, "")
    .trim();

  // Avoid turning generic "POSTGRADUATE FEES" into a fake programme.
  if (!programme || /^POSTGRADUATE$/i.test(programme) || /^UNDERGRADUATE$/i.test(programme)) return null;

  programme = programme
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

  return normalizeProgrammeLabel(programme);
}

function buildRetrievalTitle({ filename, title, documentType, programme, academicYear, audience, currency }) {
  if (programme) {
    const parts = [programme];
    if (academicYear) parts.push(String(academicYear));
    if (documentType === "fee_schedule") parts.push("Fee Schedule");
    if (audience && audience.length) parts.push(audience.join(" and "));
    if (currency) parts.push(currency);
    return parts.join(" — ");
  }

  if (documentType === "fee_schedule") {
    const baseTitle = title || cleanFilenameLabel(filename) || "Fee Schedule";
    const parts = [baseTitle];
    if (academicYear && !baseTitle.includes(String(academicYear))) parts.push(String(academicYear));
    if (!/fee/i.test(baseTitle)) parts.push("Fee Schedule");
    if (audience && audience.length) parts.push(audience.join(" and "));
    if (currency && !new RegExp(`\\b${currency}\\b`, "i").test(baseTitle)) parts.push(currency);
    return parts.join(" — ");
  }

  return title || cleanFilenameLabel(filename);
}

function sourceLooksProgrammeSpecific(sourceLabel = "") {
  const normalized = sourceLabel.trim();
  return /^(?:(?:20\d{2}|\d{2}(?:\.\d+)?)\s+)?(?:BACHELOR|MASTER|DIPLOMA|DOCTOR(?:ATE)?|PHD|PH D|LLM|MBA|DBA|EXMBA)\b/i.test(normalized);
}

function buildDocumentMetadata({
  filename,
  documentType,
  firstHeading,
  firstFewLines = "",
  sourceUrl = null,
}) {
  const sourceLabel = cleanFilenameLabel(filename);
  const combined = `${sourceLabel}\n${firstFewLines}`;
  const resolvedDocumentType = documentType || classifyDocumentType(filename, firstFewLines);
  const title = deriveTitle(filename, firstHeading);
  const programmeSpecific = sourceLooksProgrammeSpecific(sourceLabel) || sourceLooksProgrammeSpecific(title);
  const programme = programmeSpecific ? extractProgramme(combined) : null;
  const academicYear = extractAcademicYear(sourceLabel) || extractAcademicYear(firstFewLines);
  const currency = extractCurrency(combined);
  const sourceAudience = extractAudience(sourceLabel);
  const audience = sourceAudience.length ? sourceAudience : extractAudience(firstFewLines);
  const feeScope = extractFeeScope({
    filename,
    title,
    documentType: resolvedDocumentType,
    programme,
    url: sourceUrl,
  });

  return {
    source_file: filename,
    document_type: resolvedDocumentType,
    title,
    retrieval_title: buildRetrievalTitle({
      filename,
      title,
      documentType: resolvedDocumentType,
      programme,
      academicYear,
      audience,
      currency,
    }),
    programme,
    academic_year: academicYear,
    currency,
    audience,
    fee_scope: feeScope,
    department: null,
    created_date: new Date().toISOString(),
    url: sourceUrl,
  };
}

module.exports = {
  classifyDocumentType,
  deriveTitle,
  buildDocumentMetadata,
  DOCUMENT_TYPE_RULES,
  cleanFilenameLabel,
  isUsefulHeading,
  extractAcademicYear,
  extractCurrency,
  extractAudience,
  extractFeeScope,
  extractProgramme,
  buildRetrievalTitle,
  sourceLooksProgrammeSpecific,
};
