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
 *   - When no evidence is found at all, or the model itself reports
 *     it doesn't know, route to the closest UNILUS contact instead
 *     of returning a dead-end message, and log the question for
 *     later review (see unansweredLogger.js).
 *   - Every call now carries a sessionId. If the caller doesn't have
 *     one yet (first message), one is generated and returned so the
 *     frontend can send it back on the next call. Each user question
 *     and assistant answer is persisted via sessionService so a
 *     follow-up question in the same session can reference what was
 *     just discussed (see sessionService.js / aiService.js history
 *     support).
 *   - Bare greetings ("hi", "hey", "hello") are answered with a short
 *     canned intro instead of falling through to the fallback.
 */

const retrievalService = require("./retrievalService");
const aiService = require("./aiService");
const navigationService = require("./navigationService");
const contactService = require("./contactService");
const sessionService = require("./sessionService");
const toneService = require("./toneService");
const supportService = require("./supportService");
const faqService = require("./faqService");
const { logUnansweredQuestion } = require("./unansweredLogger");
const { toDisplayTimetableEntry, harmonizeDisplayCourseNames } = require("./timetablePresentationService");

/*
Changes: Coordinates navigation, retrieval evidence, and final answer composition.
Affects: POST /api/chat response content and supporting metadata.
Purpose: Preserves one place for combining structured results before answer generation.
*/

// Matches a message that is ONLY a greeting (e.g. "hi", "Hey!", "good morning").
// "hello there, when is my exam" will NOT match and goes through the normal pipeline.
const conversation = require('./conversationService');
const supportConversation = require('./supportConversationService');

// Ticket references look like UNI-2026-0042.
const TICKET_REF = /\bUNI-\d{4}-\d{4}\b/i;

function formatTicketStatus(ticket) {
    const opened = String(ticket.created_at || "").slice(0, 10);
    const updated = String(ticket.updated_at || "").slice(0, 10);
    let text = `Ticket ${ticket.ref} is currently **${ticket.status}**. ` +
        `It is with the ${ticket.department} (priority: ${ticket.priority}). ` +
        `Opened ${opened}, last updated ${updated}.`;
    if (ticket.status === "Resolved" || ticket.status === "Closed") {
        text += " This ticket has been marked as finished by the staff handling it.";
    }
    return text;
}

// "status of UNI-2026-0042", or "what's the status of my ticket" (uses the
// most recent ticket opened in this session). Returns null when the message
// isn't about a ticket, so normal handling continues.
async function handleTicketStatusQuestion(question, sessionId) {
    const refMatch = question.match(TICKET_REF);
    if (refMatch) {
        const full = await supportService.getTicketForAdmin(refMatch[0]);
        const ticket = full && full.session_id===sessionId ? await supportService.getTicketByRef(refMatch[0]) : null;
        return ticket
            ? formatTicketStatus(ticket)
            : `I couldn't find a ticket with reference ${refMatch[0].toUpperCase()}. Please check the number and try again.`;
    }

    const asksAboutTicket = /\b(ticket|reference (number|no))\b/i.test(question)
        && /\b(status|update|progress|resolved|follow ?up)\b/i.test(question);
    if (!asksAboutTicket) return null;

    const latest = await supportService.getLatestTicketForSession(sessionId);
    return latest
        ? formatTicketStatus(latest)
        : "Please send me your ticket reference number (it looks like UNI-2026-0001) and I'll check its status.";
}

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

    // Specific entity lookups must stay complete so lecturer and course
    // schedules cannot lose later records to an arbitrary context cap. The
    // retrieval layer applies explicit day filters before this point.
    // Only truly broad searches are capped to protect the model context.
    const hasSpecificEntity = entries.some((e) => e.course_code || e.lecturer_name || e.venue_code);
    const limit = hasSpecificEntity || isSingleCohort ? ordered.length : 8;
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
        omitted > 0 ? `- ${omitted} additional timetable entries were omitted from this broad search. The complete result set should be retained for follow-up requests.` : null,
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

/**
 * Builds the "I don't know, but here's who to ask" response, using
 * the closest matching UNILUS contact when one is found (a loose
 * topic match is enough — see contactService's threshold), or a
 * generic message otherwise. Shape matches answerQuestion's normal
 * return object so callers don't need to special-case it. Logging remains
 * hash-only. Missing evidence is never authorization to create a ticket.
 */
async function buildFallback(question, queryType, timetableMatches = 0, sessionId = null) {
    const fallback = await contactService.findFallbackContact(question);
    const contact = fallback ? fallback.contact : null;

    let answer;
    if (contact) {
        answer = `I don't have that information yet. ${contact.note}`;
        if (contact.phone) answer += ` Call ${contact.phone}.`;
        if (contact.email) answer += ` Email ${contact.email}.`;
    } else {
        answer = "I don't have that information yet. Try rephrasing, or check with the registry directly.";
    }

    logUnansweredQuestion(question, {
        matchedContact: contact ? contact.contact_id : null,
    });

    answer += ' If you would like human assistance, ask me to create a support ticket. I will ask you to confirm the issue before submitting it.';

    answer = await toneService.rephrase(question, answer, { kind: "fallback" });

    return {
        answer,
        queryType,
        sources: [],
        resources: [],
        recommendedResources: [],
        timetableMatches,
        usedFallback: true,
        ticket: null,
    };
}

async function answerQuestionCore(question, sessionId, audience = "public", profile = null) {
    if (!sessionId) {
        sessionId = sessionService.createSessionId();
    }

    await sessionService.appendMessage(sessionId, "user", question);

    const social = conversation.reply(question, profile);
    if (social) {
        const greeting = social;
        await sessionService.appendMessage(sessionId, "assistant", greeting);
        return {
            answer: greeting,
            queryType: { isTimetable: false, isKnowledge: false, isMixed: false, isConversation: true, entities: {} },
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            usedFallback: false,
            sessionId,
        };
    }

    if (conversation.personalResults(question)) {
        const answer = 'I cannot access your real UNILUS CA marks, final results or previous-semester performance. The demonstration is not connected to university academic records. Please check the official student portal. If you cannot access it or need help with missing results, ask me to create a support ticket; I will show the issue for your confirmation first.';
        await sessionService.appendMessage(sessionId, 'assistant', answer);
        return { ...supportConversation.response(answer, 'offered'), queryType: { isAcademicResultsUnavailable: true }, sessionId };
    }

    // Ticket status ("status of UNI-2026-0042", "any update on my ticket").
    const ticketStatusAnswer = await handleTicketStatusQuestion(question, sessionId);
    if (ticketStatusAnswer) {
        await sessionService.appendMessage(sessionId, "assistant", ticketStatusAnswer);
        return {
            answer: ticketStatusAnswer,
            queryType: { isTimetable: false, isKnowledge: false, isMixed: false, entities: {} },
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            usedFallback: false,
            sessionId,
        };
    }

    // Campus navigation ("where is the library", "what's near the
    // gym") is handled entirely from the local campus dataset and
    // never reaches the LLM or the timetable/knowledge retrieval
    // pipeline below. Returns null for anything that isn't a
    // navigation question naming a known place, so every other
    // question falls through unchanged.
    const navigationResult = navigationService.tryHandleNavigation(question);
    if (navigationResult) {
        await sessionService.appendMessage(sessionId, "assistant", navigationResult.answer);
        return { ...navigationResult, sessionId };
    }

    // Answers staff saved from the admin panel for questions the bot used to
    // escalate. "student" answers are only returned to signed-in students.
    const priorHistory = (await sessionService.getRecentHistory(sessionId)).slice(0, -1);
    const specialist = retrievalService.isSpecialistRequest(question, priorHistory);
    const staffAnswer = specialist ? null : await faqService.findStaffAnswer(question, audience);
    if (staffAnswer) {
        await faqService.recordUse(staffAnswer.id);
        const staffReply = await toneService.rephrase(question, staffAnswer.answer, { kind: "staff" });
        await sessionService.appendMessage(sessionId, "assistant", staffReply);
        return {
            answer: staffReply,
            queryType: { isTimetable: false, isKnowledge: false, isMixed: false, entities: {} },
            sources: [{ source_file: null, title: "Confirmed by UNILUS staff", source_type: "staff_answer" }],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            usedFallback: false,
            sessionId,
        };
    }

    const { timetable, knowledge, resources, queryType, needsContextClarification } = await retrievalService.retrieveAnswer(question, priorHistory, audience, profile);
    if (needsContextClarification) {
        const answer = 'Which programme, timetable or university topic are you referring to? Please include the subject so I can look up the right information.';
        await sessionService.appendMessage(sessionId, 'assistant', answer);
        return { ...supportConversation.response(answer, 'none'), queryType, sessionId };
    }

    // Someone who is not signed in asking for something only signed-in students can
    // see (such as "my class timetable") gets a sign-in prompt, not a support ticket.
    if (audience !== "student" && queryType?.isTimetable && knowledge.length === 0 && resources.length === 0) {
        const signInText = "Class timetables are available to signed-in students. Sign in to the student portal and ask me again, and I can show you yours.";
        const signInReply = typeof toneService !== "undefined"
            ? await toneService.rephrase(question, signInText, { kind: "staff" })
            : signInText;
        await sessionService.appendMessage(sessionId, "assistant", signInReply);
        return {
            answer: signInReply,
            queryType,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            usedFallback: false,
            signInRequired: true,
            sessionId,
        };
    }

    if(queryType?.isTimetable && !queryType.isKnowledge && timetable.length){
        const entries=harmonizeDisplayCourseNames(timetable.map(toDisplayTimetableEntry));
        const clean=v=>String(v??'').replace(/\|/g,'/').replace(/\n/g,' ');
        const header='| Day | Time | Course | Lecturer | Venue |\n|---|---|---|---|---|\n';
        const answer=header+entries.map(e=>'| '+[e.day,e.time,e.display_course_name||e.course_name,e.display_lecturer_name||e.lecturer_name,e.display_venue_name||e.venue_name].map(clean).join(' | ')+' |').join('\n');
        await sessionService.appendMessage(sessionId,'assistant',answer);
        return {answer,queryType,sources:[],resources:[],recommendedResources:[],timetableMatches:timetable.length,_actionRecords:timetable,sessionId};
    }

    // Programme/cohort timetable requests are deterministic structured-data
    // lookups. If the user omitted year/semester (or the requested cohort is
    // absent), return a precise clarification instead of asking the LLM to
    // improvise from an empty context.
    const timetableEntities = queryType?.entities || {};
    if (queryType?.isTimetable && timetableEntities.programmeFamily && timetable.length === 0) {
        if (!timetableEntities.year || !timetableEntities.semester) {
            const clarification = `I can look up the ${timetableEntities.programmeFamily} timetable, but I need the study year and semester (for example: "${timetableEntities.programmeFamily} 3rd year 2nd semester" or "${timetableEntities.programmeFamily} 3,2").`;
            await sessionService.appendMessage(sessionId, "assistant", clarification);
            return {
                answer: clarification,
                queryType,
                sources: [],
                resources: [],
                recommendedResources: [],
                timetableMatches: 0,
                sessionId,
            };
        }

        const modeLabel = timetableEntities.studyMode === "part_time"
            ? " part-time"
            : timetableEntities.studyMode === "full_time"
                ? " full-time"
                : "";
        const notFound = `I couldn't find a ${timetableEntities.programmeFamily}${modeLabel} Year ${timetableEntities.year}, Semester ${timetableEntities.semester} cohort in the loaded UNILUS timetable records.`;
        await sessionService.appendMessage(sessionId, "assistant", notFound);
        return {
            answer: notFound,
            queryType,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            sessionId,
        };
    }

    // No evidence of any kind found — redirect to a contact rather
    // than asking the LLM to answer from nothing.
    const hasAnyEvidence = timetable.length > 0 || knowledge.length > 0 || resources.length > 0;
    if (!hasAnyEvidence) {
        console.log("No matching records found. Checking contact fallback...");
        const fallbackResult = await buildFallback(question, queryType, 0, sessionId);
        await sessionService.appendMessage(sessionId, "assistant", fallbackResult.answer);
        return { ...fallbackResult, sessionId };
    }

    const context = formatContext({ timetable, knowledge, resources });

    let answer;
    try {
        answer = await aiService.askAI(question, context, {
        allowedUrls: collectAllowedUrls({ knowledge, resources }),
        groundingText: buildPrimaryGroundingText(knowledge),
        // Recent turns from THIS session, oldest first, so a follow-up
        // like "what about Wednesday?" can be understood in context.
        // Excludes the user message just appended above (it's added
        // separately as the current question, not as history).
        history: priorHistory,
    });
    }catch{
        answer='The AI explanation service is temporarily unavailable. Please use the official sources below or try again shortly.';
        const links=resources.filter(r=>r.url).map(r=>`[${r.title}](${r.url})`);
        if(links.length)answer+='\n\n'+links.join('\n');
    }

    // Evidence existed but was a loose/irrelevant match — the model
    // correctly said so per its system prompt. Redirect to a contact
    // instead of returning that dead-end line as-is.
    if (/i don.t have that information/i.test(answer)) {
        console.log("LLM reported no answer. Checking contact fallback...");
        const fallbackResult = await buildFallback(question, queryType, timetable.length, sessionId);
        await sessionService.appendMessage(sessionId, "assistant", fallbackResult.answer);
        return { ...fallbackResult, sessionId };
    }

    await sessionService.appendMessage(sessionId, "assistant", answer);

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
        _actionRecords: timetable,
        timetableMatches: timetable.length,
        usedFallback: false,
        sessionId,
    };
}

function markAdvisorTopic(sessionId, active) {
    const store = require('./programmeAdvisorState').store;
    const profile = store.get(sessionId);
    if (profile) { profile.topicActive = active; store.set(sessionId, profile); }
}
async function answerQuestion(question, sessionId, audience='public', profile=null, { user = null, academicProfile = null } = {}) {
    // Applicant grades remain in the bounded advisor store, never in persistent chat history or tone rewriting.
    question = conversation.stripGreeting(question);
    const feeReply = require('./tuitionFeeService').tryAnswer(question, sessionId ? await sessionService.getRecentHistory(sessionId) : []);
    if (feeReply) {
        sessionId ||= sessionService.createSessionId();
        supportConversation.reset(sessionId);
        markAdvisorTopic(sessionId, false);
        await sessionService.appendMessage(sessionId, 'user', question);
        await sessionService.appendMessage(sessionId, 'assistant', feeReply.answer);
        return { ...feeReply, sessionId };
    }
    const academicService = require('./demoAcademicChatService');
    let academic = academicService.tryAnswer(question, academicProfile);
    if (!academic && academicProfile && /^(?:yes|yes please|please do|show me)[.!]?$/i.test(question.trim())) {
        const last = (await sessionService.getRecentHistory(sessionId, 1))[0];
        if (last?.role === 'assistant' && last.content.endsWith('Would you like to see which assessments are pending?')) academic = academicService.tryAnswer('Which assessments are pending?', academicProfile);
    }
    if (academic) {
        supportConversation.reset(sessionId);
        markAdvisorTopic(sessionId, false);
        await sessionService.appendMessage(sessionId, 'user', question);
        await sessionService.appendMessage(sessionId, 'assistant', academic.answer);
        return { ...academic, sessionId };
    }
    const supportReply = await supportConversation.tryHandle(question, sessionId, user);
    if (supportReply) {
        markAdvisorTopic(sessionId, false);
        await sessionService.appendMessage(sessionId, 'user', question);
        await sessionService.appendMessage(sessionId, 'assistant', supportReply.answer);
        return { ...supportReply, sessionId };
    }
    const advisor = !conversation.reply(question, profile) && !conversation.personalResults(question)
        ? require('./programmeAdvisorService').tryAnswer(question,sessionId) : null;
    if (advisor) { markAdvisorTopic(sessionId, true); return advisor; }
    if (!conversation.reply(question, profile)) markAdvisorTopic(sessionId, false);
    const parser=require('./applicantResultParser');
    const safeQuestion=parser.extract(question).length?parser.withoutResults(question).trim():question;
    const result=await answerQuestionCore(safeQuestion,sessionId,audience,profile);
    const records=result._actionRecords || [];delete result._actionRecords;
    try{result.suggestedActions=require('./suggestedActionService').selectActions(question,result,records);}catch{result.suggestedActions=[];}
    if (result.support || result.queryType?.isConversation) result.suggestedActions = [];
    return result;
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
    buildFallback,
};
