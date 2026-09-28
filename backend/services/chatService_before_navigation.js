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

function formatTimetableContext(entries) {
    if (!entries.length) return "";

    const lines = entries.slice(0, 8).map((e) => {
        const parts = [
            e.day,
            e.time,
            e.course_code,
            e.course_name,
            e.lecturer_name ? `taught by ${e.lecturer_name}` : null,
            e.venue_name ? `in ${e.venue_name}` : null,
            e.programme_code ? `(${e.programme_code})` : null,
        ].filter(Boolean);
        return `- ${parts.join(" ")}`;
    });

    return `Timetable information:\n${lines.join("\n")}`;
}

function formatKnowledgeContext(chunks) {
    if (!chunks.length) return "";

    const ordered = orderKnowledgeBySourcePriority(chunks);

    const sections = ordered.map((c, i) => {
        const citation = [c.title, c.page_number ? `p.${c.page_number}` : null]
            .filter(Boolean)
            .join(", ");
        return `[${i + 1}] (${citation || c.source_file}) ${c.text}`;
    });

    return `University knowledge:\n${sections.join("\n\n")}`;
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
    return chunks
        .map((chunk, index) => ({ chunk, index }))
        .sort((a, b) => rank(a.chunk) - rank(b.chunk) || a.index - b.index)
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

async function answerQuestion(question) {
    const { timetable, knowledge, resources, queryType } = await retrievalService.retrieveAnswer(question);

    const context = formatContext({ timetable, knowledge, resources });

    const answer = await aiService.askAI(question, context);

    return {
        answer,
        queryType,
        sources: knowledge.map((k) => ({
            source_file: k.source_file,
            title: k.title,
            page_number: k.page_number,
            section: k.section,
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

module.exports = { answerQuestion, formatContext, orderKnowledgeBySourcePriority, buildRecommendedResources };
