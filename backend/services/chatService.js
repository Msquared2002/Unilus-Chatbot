/**
 * chatService.js
 * ================
 *
 * REWRITTEN. Fixes from the review:
 *   - detectIntent / handleTimetableQuestion / formatTimetableResponse
 *     were dead code (never called from the live path) — removed.
 *   - retrievalService.retrieve() -> retrievalRouter.retrieveAnswer(),
 *     the single hybrid entry point.
 *   - formatContext now reads the NEW schemas: timetable entries have
 *     canonical fields (course_name, lecturer_name, venue_name, day,
 *     time, programme_code); knowledge chunks have (text, title,
 *     source_file, page_number) instead of the old (topic, answer).
 *   - Every answer's context now includes its source, so the model
 *     can (and is instructed to) cite where information came from.
 */

const retrievalService = require("./retrievalService");
const aiService = require("./aiService");
const navigationService = require("./navigationService");
const { toDisplayTimetableEntry, harmonizeDisplayCourseNames } = require("./timetablePresentationService");


function isExplicitlyRevisedStructuredChunk(chunk = {}) {
    const label = [chunk.retrieval_title, chunk.title, chunk.source_file].filter(Boolean).join(" ");
    return chunk.document_type !== "website" && /\brevised\b/i.test(label);
}

function valuesConflict(a, b) {
    if (a == null || a === "" || b == null || b === "") return false;
    return String(a).trim().toLowerCase() !== String(b).trim().toLowerCase();
}

function audiencesOverlap(a = [], b = []) {
    if (!Array.isArray(a) || !a.length || !Array.isArray(b) || !b.length) return true;
    const left = new Set(a.map((v) => String(v).toLowerCase()));
    return b.some((v) => left.has(String(v).toLowerCase()));
}

function sameEvidenceScope(primary = {}, candidate = {}) {
    if (!primary.fee_scope || primary.fee_scope !== candidate.fee_scope) return false;
    if (valuesConflict(primary.academic_year, candidate.academic_year)) return false;
    if (valuesConflict(primary.programme, candidate.programme)) return false;
    if (valuesConflict(primary.currency, candidate.currency)) return false;
    if (!audiencesOverlap(primary.audience, candidate.audience)) return false;
    return true;
}

/**
 * Marks explicitly revised structured records as PRIMARY evidence and
 * same-scope website records as SUPPORTING. This lets the answer layer
 * resolve conflicting duplicated values (e.g. an updated PDF vs a stale
 * copied webpage table) without discarding useful website procedures/URLs.
 */
function annotateKnowledgeEvidence(chunks = []) {
    const revised = chunks.filter(isExplicitlyRevisedStructuredChunk);

    return chunks.map((chunk) => {
        let evidence_role = "normal";
        const controlling = revised.find((primary) => sameEvidenceScope(primary, chunk));
        if (controlling) {
            evidence_role = isExplicitlyRevisedStructuredChunk(chunk)
                ? "primary"
                : chunk.document_type === "website"
                    ? "supporting"
                    : "normal";
        }
        return { ...chunk, evidence_role };
    });
}

function buildPrimaryGroundingText(chunks = []) {
    const annotated = annotateKnowledgeEvidence(chunks);
    const primary = annotated.filter((c) => c.evidence_role === "primary");
    const selected = primary.length ? primary : annotated;
    return selected.map((c) => c.text || "").filter(Boolean).join("\n\n");
}

function formatTimetableContext(entries) {
    if (!entries.length) return "";

    const dayOrder = new Map([
        ["Monday", 1], ["Tuesday", 2], ["Wednesday", 3], ["Thursday", 4],
        ["Friday", 5], ["Saturday", 6], ["Sunday", 7],
    ]);

    const ordered = [...entries].sort((a, b) => {
        const dayDiff = (dayOrder.get(a.day) || 99) - (dayOrder.get(b.day) || 99);
        if (dayDiff) return dayDiff;
        return String(a.time || "").localeCompare(String(b.time || ""));
    });

    const programmeCodes = new Set(ordered.map((e) => e.programme_code).filter(Boolean));
    const years = new Set(ordered.map((e) => e.year).filter((v) => v != null));
    const semesters = new Set(ordered.map((e) => e.semester).filter((v) => v != null));
    const isSingleCohort = programmeCodes.size === 1 && years.size <= 1 && semesters.size <= 1;

    // A programme/cohort timetable is usually around 10–15 sessions and must
    // be complete. Broad searches (e.g. all Monday classes) stay capped so we
    // do not flood the LLM with hundreds of unrelated records.
    const limit = isSingleCohort ? 24 : 8;
    const selected = ordered.slice(0, limit);

    const cohort = isSingleCohort ? selected[0] : null;
    const cohortLabel = cohort
        ? [
            cohort.programme_name || cohort.programme_code,
            cohort.programme_code ? `code ${cohort.programme_code}` : null,
            cohort.year ? `year ${cohort.year}` : null,
            cohort.semester ? `semester ${cohort.semester}` : null,
        ].filter(Boolean).join(" | ")
        : null;

    const displayEntries = harmonizeDisplayCourseNames(selected.map((rawEntry) => toDisplayTimetableEntry(rawEntry)));

    const lines = displayEntries.map((e) => {
        const parts = [
            e.day,
            e.time,
            e.course_code,
            e.display_course_name || e.course_name,
            e.display_session_type ? `[${e.display_session_type}]` : null,
            e.display_lecturer_name ? `taught by ${e.display_lecturer_name}` : null,
            e.display_venue_name ? `in ${e.display_venue_name}` : null,
            e.display_room_capacity != null ? `(room capacity ${e.display_room_capacity})` : null,
            !isSingleCohort && e.programme_code ? `(${e.programme_code})` : null,
        ].filter(Boolean);
        return `- ${parts.join(" ")}`;
    });

    const omitted = ordered.length - selected.length;
    return [
        "Timetable information:",
        "Timetable display note: internal Mimosa scheduling/resource codes have been removed for readability. A trailing #number on the human-readable room name is preserved as room capacity. Course-level Group A/B/C/D labels are official class-group labels and may legitimately differ from the programme cohort row label; preserve them as published.",
        cohortLabel ? `Cohort: ${cohortLabel}` : null,
        ...lines,
        omitted > 0 ? `- ${omitted} additional timetable entries were omitted from this broad search.` : null,
    ].filter(Boolean).join("\n");
}

function formatKnowledgeContext(chunks) {
    if (!chunks.length) return "";

    const annotated = annotateKnowledgeEvidence(chunks);
    const ordered = orderKnowledgeBySourcePriority(annotated);
    const hasPrimaryEvidence = ordered.some((c) => c.evidence_role === "primary");

    const sections = ordered.map((c, i) => {
        const citation = [
            c.retrieval_title || c.title,
            c.page_number ? `p.${c.page_number}` : null,
        ].filter(Boolean).join(", ");

        const metadata = [
            c.evidence_role === "primary" ? "Evidence role: PRIMARY (controls overlapping facts)" : null,
            c.evidence_role === "supporting" ? "Evidence role: SUPPORTING (may not override PRIMARY facts)" : null,
            c.programme ? `Programme: ${c.programme}` : null,
            c.academic_year ? `Academic year: ${c.academic_year}` : null,
            c.audience?.length ? `Audience: ${c.audience.join(", ")}` : null,
            c.currency ? `Currency: ${c.currency}` : null,
            c.document_type ? `Document type: ${c.document_type}` : null,
            c.fee_scope ? `Fee scope: ${c.fee_scope}` : null,
            c.section ? `Section: ${c.section}` : null,
            c.source_type ? `Source type: ${c.source_type}` : null,
            c.observed_date ? `Observed: ${c.observed_date}` : null,
            c.source_image_filenames?.length ? `Photo: ${c.source_image_filenames.join(', ')}` : null,
            c.operational_information_may_change ? 'Operational information may have changed; advise confirming current details.' : null,
        ].filter(Boolean).join(" | ");

        const sourceLine = c.source_file ? `Source: ${c.source_file}` : null;
        return `[${i + 1}] (${citation || c.source_file})${sourceLine ? `\n${sourceLine}` : ""}${metadata ? `\n${metadata}` : ""}\n${c.text}`;
    });

    const policy = hasPrimaryEvidence
        ? "Evidence policy: PRIMARY evidence controls overlapping amounts, dates, and rules. SUPPORTING evidence may add procedures or official links but must not override a conflicting PRIMARY value.\n\n"
        : "";

    return `University knowledge:\n${policy}${sections.join("\n\n")}`;
}

/**
 * Preferred source order within the "knowledge" tier: PDF/structured
 * document content (handbooks, regulations, fee schedules — anything
 * NOT tagged document_type "website") before website-crawled content.
 * This doesn't change WHICH chunks were retrieved (that's still pure
 * semantic similarity from knowledgeService) — it only orders how
 * they're presented to the LLM, per the requested priority:
 * timetable > structured knowledge > website embeddings > resources >
 * free LLM reasoning. A stable sort, so relevance order within each
 * group is untouched.
 */
function orderKnowledgeBySourcePriority(chunks) {
    const rank = (chunk) => (chunk.document_type === "website" ? 1 : 0);
    const CLOSE_SCORE_MARGIN = 0.004;

    return chunks
        .map((chunk, index) => ({ chunk, index }))
        .sort((a, b) => {
            const aScore = Number.isFinite(a.chunk.score) ? a.chunk.score : null;
            const bScore = Number.isFinite(b.chunk.score) ? b.chunk.score : null;

            // Hybrid relevance is primary when the difference is meaningful.
            if (aScore != null && bScore != null && Math.abs(aScore - bScore) > CLOSE_SCORE_MARGIN) {
                return bScore - aScore;
            }

            // When relevance is effectively tied (or legacy callers have no
            // scores), prefer structured institutional documents over a web
            // crawl result, then preserve original order.
            return rank(a.chunk) - rank(b.chunk) || a.index - b.index;
        })
        .map(({ chunk }) => chunk);
}

function formatResourceContext(resources) {
    if (!resources.length) return "";

    const lines = resources.map((r) => `- ${r.title}: ${r.url}`);
    return `Official resources relevant to this question (include the link naturally in your answer when you mention it):\n${lines.join("\n")}`;
}

function formatContext({ timetable, knowledge, resources = [] }) {
    const parts = [
        formatTimetableContext(timetable),
        formatKnowledgeContext(knowledge),
        formatResourceContext(resources),
    ].filter(Boolean);
    return parts.join("\n\n");
}

/**
 * Turns a matched resource into a `{title, url, reason}` recommendation
 * — a short, deterministic explanation of WHY it's relevant, built
 * from its category and which keyword(s) matched, never LLM-generated
 * (so it's stable and doesn't cost an extra model call).
 */
function buildRecommendedResources(resources) {
    return resources.map((r) => {
        const matched = (r.matchedKeywords || [])[0];
        const reason = matched
            ? `Matches your question about "${matched}"${r.category ? ` (${r.category})` : ""}.`
            : r.category
                ? `Official ${r.category} resource.`
                : "Official UNILUS resource relevant to your question.";

        return { title: r.title, url: r.url, reason };
    });
}

function collectAllowedUrls({ knowledge = [], resources = [] }) {
    const urls = [];
    for (const chunk of knowledge) {
        if (typeof chunk.source_file === "string" && /^https?:\/\//i.test(chunk.source_file)) {
            urls.push(chunk.source_file);
        }
        if (typeof chunk.url === "string" && /^https?:\/\//i.test(chunk.url)) {
            urls.push(chunk.url);
        }
    }
    for (const resource of resources) {
        if (typeof resource.url === "string" && /^https?:\/\//i.test(resource.url)) {
            urls.push(resource.url);
        }
    }
    return [...new Set(urls)];
}

async function answerQuestion(question) {
    // Campus navigation ("where is the library", "what's near the
    // gym") is handled entirely from the local campus dataset and
    // never reaches the LLM or the timetable/knowledge retrieval
    // pipeline below. Returns null for anything that isn't a
    // navigation question naming a known place, so every other
    // question falls through unchanged.
    const navigationResult = navigationService.tryHandleNavigation(question);
    if (navigationResult) return navigationResult;

    const { timetable, knowledge, resources, queryType } = await retrievalService.retrieveAnswer(question);

    // Programme/cohort timetable requests are deterministic structured-data
    // lookups. If the user omitted year/semester (or the requested cohort is
    // absent), return a precise clarification instead of asking the LLM to
    // improvise from an empty context.
    const timetableEntities = queryType?.entities || {};
    if (queryType?.isTimetable && timetableEntities.programmeFamily && timetable.length === 0) {
        if (!timetableEntities.year || !timetableEntities.semester) {
            return {
                answer: `I can look up the ${timetableEntities.programmeFamily} timetable, but I need the study year and semester (for example: "${timetableEntities.programmeFamily} 3rd year 2nd semester" or "${timetableEntities.programmeFamily} 3,2").`,
                queryType,
                sources: [],
                resources: [],
                recommendedResources: [],
                timetableMatches: 0,
            };
        }

        const modeLabel = timetableEntities.studyMode === "part_time"
            ? " part-time"
            : timetableEntities.studyMode === "full_time"
                ? " full-time"
                : "";
        return {
            answer: `I couldn't find a ${timetableEntities.programmeFamily}${modeLabel} Year ${timetableEntities.year}, Semester ${timetableEntities.semester} cohort in the loaded UNILUS timetable records.`,
            queryType,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
        };
    }

    const context = formatContext({ timetable, knowledge, resources });

    const answer = await aiService.askAI(question, context, {
        allowedUrls: collectAllowedUrls({ knowledge, resources }),
        groundingText: buildPrimaryGroundingText(knowledge),
    });

    return {
        answer,
        queryType,
        sources: knowledge.map((k) => ({
            source_file: k.source_file,
            title: k.retrieval_title || k.title,
            page_number: k.page_number,
            section: k.section,
            source_type: k.source_type,
            observed_date: k.observed_date,
            source_image_filenames: k.source_image_filenames,
            place_id: k.place_id,
        })),
        // Structured, always-present resource links — kept separate
        // from `sources` (which are RAG document citations) so a
        // frontend can render "Official links" distinctly even if the
        // model's prose forgets to mention one.
        resources: resources.map((r) => ({ title: r.title, url: r.url, topic: r.topic })),
        // Richer form of the same data, matching the requested
        // { title, url, reason } shape. Additive: `resources` above is
        // unchanged for any existing consumer.
        recommendedResources: buildRecommendedResources(resources),
        timetableMatches: timetable.length,
    };
}

module.exports = {
    answerQuestion,
    formatContext,
    orderKnowledgeBySourcePriority,
    buildRecommendedResources,
    collectAllowedUrls,
    annotateKnowledgeEvidence,
    buildPrimaryGroundingText,
    isExplicitlyRevisedStructuredChunk,
    sameEvidenceScope,
};
