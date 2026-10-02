/**
 * queryUnderstandingService.js
 * ============================
 *
 * Optional low-cost LLM pass used ONLY to improve retrieval. It never answers
 * the student. Its job is to turn natural phrasing into a small structured
 * search plan (normalized query, alternate search queries, and entities).
 *
 * The service fails open: if the planner model is disabled, unavailable or
 * returns malformed output, retrieval continues with the original query.
 *
 * HISTORY SUPPORT: an optional `history` array (recent conversation turns,
 * oldest first, shape [{role, content}]) can be supplied. When present, the
 * planner is instructed to use it ONLY to resolve vague references in the
 * current message ("the exam", "that course", "what about Wednesday") into
 * whatever was concretely named earlier in the conversation -- e.g. turning
 * "what about the exam?" into "BIT320 exam" for retrieval purposes. History
 * is never treated as a source of new facts and never changes the "does not
 * answer the student" boundary below.
 */

const Groq = require("groq-sdk");

const DEFAULT_MODEL = process.env.QUERY_PLANNER_MODEL || "openai/gpt-oss-20b";
const MAX_SEARCH_QUERIES = 2;
let client = null;

function getClient() {
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

function plannerEnabled() {
  const configured = String(process.env.QUERY_PLANNER_ENABLED ?? "true").toLowerCase();
  return configured !== "false" && Boolean(process.env.GROQ_API_KEY);
}

function uniqueQueries(values, originalQuery) {
  const seen = new Set();
  const result = [];
  for (const value of [originalQuery, ...(values || [])]) {
    if (typeof value !== "string") continue;
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= MAX_SEARCH_QUERIES + 1) break;
  }
  return result;
}

function sanitizeEntities(entities = {}) {
  const allowed = ["programme", "academic_year", "audience", "currency", "topic", "document_type", "fee_scope"];
  const clean = {};
  for (const key of allowed) {
    const value = entities[key];
    if (value == null || value === "") continue;
    if (Array.isArray(value)) clean[key] = value.map(String).filter(Boolean).slice(0, 5);
    else clean[key] = value;
  }
  return clean;
}


function includesAny(value, needles = []) {
  const normalized = String(value || "").toLowerCase();
  return needles.some((needle) => normalized.includes(String(needle).toLowerCase()));
}

function addCanonicalSearchTerminology(plan) {
  const searchable = [
    plan.intent,
    plan.normalizedQuery,
    ...(plan.searchQueries || []),
    plan.entities?.topic,
  ].filter(Boolean).join(" ").toLowerCase();

  let canonical = null;

  // The UNILUS handbook calls programme/course switching "Changes During Course of Study".
  // Students are much more likely to say "switch/change my programme". This is a safe
  // terminology bridge for retrieval only; it does not invent policy facts or answer text.
  const programmeChangeLike =
    /(programme|program|course of study)/i.test(searchable) &&
    /(switch|change|transfer|move)/i.test(searchable);

  if (programmeChangeLike) {
    canonical = "changes during course of study change course of study Board of Studies Dean";
  }

  if (!canonical) return plan;

  const entities = { ...(plan.entities || {}) };
  if (programmeChangeLike && !entities.topic) {
    entities.topic = "changes during course of study";
  }

  const queries = uniqueQueries(
    [canonical, plan.normalizedQuery, ...(plan.searchQueries || [])],
    plan.searchQueries?.[0] || plan.normalizedQuery
  );

  return { ...plan, searchQueries: queries, entities: sanitizeEntities(entities) };
}

function enrichPlannerEntities(plan) {
  const entities = { ...(plan.entities || {}) };
  const searchable = [
    plan.intent,
    plan.normalizedQuery,
    ...(plan.searchQueries || []),
    entities.topic,
    entities.document_type,
  ].filter(Boolean).join(" ");

  const feeLike = includesAny(searchable, [
    "fee", "fees", "tuition", "pay", "payment", "cost", "fee schedule",
  ]);

  if (feeLike && !entities.document_type) entities.document_type = "fee_schedule";
  if (feeLike && !entities.topic) entities.topic = "fees";

  if (feeLike && !entities.fee_scope) {
    if (includesAny(searchable, ["accommodation", "accomodation", "hostel", "residence", "room fee", "bed space", "boarding"])) {
      entities.fee_scope = "accommodation";
    } else if (includesAny(searchable, ["graduation fee", "graduation fees", "convocation fee", "gown fee"])) {
      entities.fee_scope = "graduation";
    } else if (includesAny(searchable, ["application fee", "application fees", "application cost", "cost to apply", "pay to apply"])) {
      entities.fee_scope = "application";
    } else if (includesAny(searchable, ["examination fee", "examination fees", "exam fee", "exam fees"])) {
      entities.fee_scope = "examination";
    } else if (includesAny(searchable, ["registration fee", "registration fees"])) {
      entities.fee_scope = "registration";
    } else if (entities.programme || includesAny(searchable, ["tuition", "programme fee", "program fee", "semester fee", "course fee"])) {
      entities.fee_scope = "programme_tuition";
    }
  }

  const audience = Array.isArray(entities.audience)
    ? entities.audience.join(" ")
    : String(entities.audience || "");

  // Corpus-aware retrieval hints only. These values influence search/ranking;
  // they are not asserted to the student as facts by the planner itself.
  if (feeLike && !entities.currency) {
    if (includesAny(audience, ["local", "zambian", "sadc"])) {
      entities.currency = "ZMW";
    } else if (includesAny(audience, ["foreign", "international", "non-sadc"])) {
      entities.currency = "USD";
    }
  }

  return { ...plan, entities: sanitizeEntities(entities) };
}

function fallbackPlan(query, reason = null) {
  return {
    usedPlanner: false,
    intent: null,
    normalizedQuery: query,
    searchQueries: [query],
    entities: {},
    reason,
  };
}

function parsePlannerResponse(content, originalQuery) {
  if (!content || typeof content !== "string") return fallbackPlan(originalQuery, "empty planner response");

  let parsed;
  try {
    parsed = JSON.parse(content.trim());
  } catch (_) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return fallbackPlan(originalQuery, "planner did not return JSON");
    try {
      parsed = JSON.parse(match[0]);
    } catch (_) {
      return fallbackPlan(originalQuery, "planner returned malformed JSON");
    }
  }

  const normalizedQuery = typeof parsed.normalizedQuery === "string" && parsed.normalizedQuery.trim()
    ? parsed.normalizedQuery.trim()
    : originalQuery;

  const searchQueries = uniqueQueries(
    [normalizedQuery, ...(Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [])],
    originalQuery
  );

  return enrichPlannerEntities(addCanonicalSearchTerminology({
    usedPlanner: true,
    intent: typeof parsed.intent === "string" ? parsed.intent : null,
    normalizedQuery,
    searchQueries,
    entities: sanitizeEntities(parsed.entities),
    reason: null,
  }));
}

async function planQuery(query, { completionFn = null, force = false, history = [] } = {}) {
  if (!force && !plannerEnabled()) return fallbackPlan(query, "planner disabled or GROQ_API_KEY unavailable");

  const currentYear = new Date().getFullYear();

  // Prior turns, oldest first. Used ONLY to resolve vague references in the
  // current message -- never as a source of new facts, and the planner
  // still never answers the student (see system prompt below).
  const historyMessages = (Array.isArray(history) ? history : [])
    .filter((turn) => turn && typeof turn.content === "string" && turn.content.trim())
    .map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.content,
    }));

  const messages = [
    {
      role: "system",
      content: `You are a retrieval query planner for the University of Lusaka (UNILUS) Student Digital Companion.

You do NOT answer the student's question. You only rewrite it for search.

Return JSON only with this exact shape:
{
  "intent": "short retrieval intent",
  "normalizedQuery": "clear search query",
  "searchQueries": ["up to 3 concise alternative searches"],
  "entities": {
    "programme": null,
    "academic_year": null,
    "audience": null,
    "currency": null,
    "topic": null,
    "document_type": null,
    "fee_scope": null
  }
}

Rules:
- Preserve all concrete facts the student supplied.
- Do not invent a programme, fee amount, policy, deadline or requirement.
- Convert natural paraphrases into useful university terminology when safe (for example, taking a break from studies -> deferment; how much I pay -> fees/fee schedule).
- Expand abbreviations only when the meaning is clear from the question.
- Resolve 'this year'/'current year' to ${currentYear}; otherwise do not invent a year.
- Search queries should be short, keyword-rich and meaningfully different, not full answers.
- fee_scope is only for fee questions. Use one of: programme_tuition, accommodation, application, graduation, examination, registration, or null.
- If an entity is not present or safely implied by wording, use null.
- If prior conversation turns are supplied before the student's current message, use them ONLY to resolve vague references in the current message (pronouns like "it", or phrases like "the exam", "that course", "what about Wednesday") into whatever was concretely named earlier (a course code, programme, topic, etc.). Write the resolved concrete reference directly into normalizedQuery and searchQueries. Do not treat anything said in prior turns as a new fact to report, and do not answer the student's question using prior turns.`,
    },
    ...historyMessages,
    { role: "user", content: query },
  ];

  try {
    let content;
    if (completionFn) {
      content = await completionFn({ model: DEFAULT_MODEL, messages });
    } else {
      const response = await getClient().chat.completions.create({
        model: DEFAULT_MODEL,
        temperature: 0,
        max_tokens: 450,
        messages,
      });
      content = response.choices?.[0]?.message?.content || "";
    }

    return parsePlannerResponse(content, query);
  } catch (err) {
    console.warn(`[query-planner] falling back to original query: ${err.message}`);
    return fallbackPlan(query, err.message);
  }
}

module.exports = {
  planQuery,
  parsePlannerResponse,
  fallbackPlan,
  plannerEnabled,
  enrichPlannerEntities,
  addCanonicalSearchTerminology,
  DEFAULT_MODEL,
};
