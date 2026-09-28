/**
 * timetablePresentationService.js
 * =================================
 *
 * Presentation-only cleanup for Mimosa timetable records.
 *
 * IMPORTANT: this service NEVER mutates the canonical timetable JSON.
 * Mimosa strings are intentionally preserved in data/timetable/timetable.json
 * for auditing/provenance. These helpers only remove scheduling codes,
 * display noise and flattened lecturer identifiers before a record is shown
 * to the LLM/user. Room-capacity suffixes are extracted into a structured
 * display_room_capacity field rather than discarded.
 *
 * Why this exists:
 * - Mimosa course labels contain internal markers such as BUS#2_A, C_TT_SVT,
 *   PT\\DL#40 and trailing scheduling/count markers.
 * - Venue labels use a trailing #number as the human-readable room capacity
 *   (for example, "...BUSINESS BLOCK#192"). This is distinct from the
 *   number sometimes attached to Mimosa's internal room/resource code.
 * - Student pages flatten multiple lecturers into strings such as
 *   "Mr. Kabwe B195 Mrs Lenganji Chela" even though B195 is a lecturer code.
 * - Some tutorial events are prefixed with TT but were historically tagged as
 *   Lecture by the parser. We can safely improve DISPLAY type without changing
 *   the raw source record.
 *
 * Group labels (GROUP A/B/C/...) are deliberately preserved. The live UNILUS
 * Mimosa pages show that a programme cohort row labelled A1 can legitimately
 * contain a course/tutorial labelled Group B/C/D; these are different grouping
 * concepts and must not be filtered as contradictions.
 */

function collapseSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeSchedulingPrefix(token) {
    const t = String(token || "").trim();
    if (!t) return false;

    // Explicit Mimosa/control tokens seen in the UNILUS source data.
    if (/^(?:TT|FT|PT|DL|GRP)$/i.test(t)) return true;
    if (/^PT[\\/]?DL(?:#.*)?$/i.test(t)) return true;
    if (/^PNR[a-z]?(?:[#_].*)?$/i.test(t)) return true;

    // Short machine tokens with underscores/hash/backslashes, e.g.
    // BUS#2_A, A_TT#1, C_TT_SVT, A#200, PT\\DL#40.
    if (t.length <= 24 && /[_#\\*]/.test(t) && /^[A-Za-z0-9_.*#\\/-]+$/.test(t)) {
        return true;
    }

    return false;
}

function stripLeadingSchedulingPrefixes(value) {
    const tokens = collapseSpaces(value).split(" ");
    let removed = 0;
    while (tokens.length && removed < 3 && looksLikeSchedulingPrefix(tokens[0])) {
        tokens.shift();
        removed += 1;
    }
    return tokens.join(" ");
}

function cleanCourseName(courseName, sessionType = null) {
    let value = collapseSpaces(courseName);
    if (!value) return "";

    value = stripLeadingSchedulingPrefixes(value);

    // Capacity / internal count markers such as #50, #100, #250, #12VIRTUAL
    // and variant tails such as #230b. Preserve C# because only hash+digits
    // sequences are removed.
    value = value.replace(/#\s*\d+[A-Za-z]*/g, " ");

    // Common delivery/scheduling suffixes that are already represented by
    // structured fields elsewhere. Covers FT/PT, PT\DL, PT/DL, PT/DIST and
    // source-specific CA markers without touching normal course wording.
    value = value.replace(/[_\s-]*PT[\\/]?(?:DL|DIST|D)?\b/gi, " ");
    value = value.replace(/[_\s-]*FT\b/gi, " ");
    value = value.replace(/[/_]CA\d+(?:\.\d+)?/gi, " ");
    value = value.replace(/\bVIRTUAL\b/gi, " ");

    // If this record is displayed as a tutorial, don't repeat TUTORIAL inside
    // the course title; preserve GROUP A/B/C etc.
    const normalizedSessionType = String(sessionType || "").toLowerCase();
    if (normalizedSessionType === "tutorial") {
        value = value.replace(/\bTUTORIAL\b/gi, " ");
        value = value.replace(/\bTT\b/gi, " ");
    } else if (normalizedSessionType === "lab") {
        value = value.replace(/\bLAB(?:ORATORY)?\b/gi, " ");
    } else if (normalizedSessionType === "practical") {
        value = value.replace(/\bPRACTICAL\b/gi, " ");
    }

    // Cosmetic-only corrections for recurring source typos seen on the live
    // Mimosa pages. Raw timetable data remains untouched.
    value = value
        .replace(/\bQuantitave\b/gi, "Quantitative")
        .replace(/\bSysystems\b/gi, "Systems")
        .replace(/\bFowarding\b/gi, "Forwarding")
        .replace(/\bAdministation\b/gi, "Administration")
        .replace(/\bPurschasing\b/gi, "Purchasing")
        .replace(/\bGROUP\s+([A-Z](?:\d+)?)\b/gi, (_, group) => `Group ${String(group).toUpperCase()}`)
        .replace(/\s+-\s*/g, " - ")
        .replace(/\s+([,;:])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .replace(/[.]+$/g, "")
        .trim();

    return value;
}

function cleanLecturerName(lecturerName) {
    let value = collapseSpaces(lecturerName);
    if (!value) return "";

    // Mimosa student pages flatten a second lecturer as:
    //   Mr. Kabwe B195 Mrs Lenganji Chela
    // Convert the embedded lecturer code into a co-teaching separator.
    value = value.replace(
        /\s+\b[A-Z]{1,5}\d{3,4}\b\s+/g,
        " & "
    );

    // Remove a lecturer code if it appears at the very start of a flattened
    // string (rare, but present in some raw Mimosa views).
    value = value.replace(/^\b[A-Z]{1,5}\d{3,4}\b\s+/i, "");

    return collapseSpaces(value).replace(/\s*&\s*/g, " & ");
}

function extractRoomCapacity(venueName) {
    const value = collapseSpaces(venueName);
    if (!value) return null;

    // UNILUS Mimosa room labels publish the room capacity as the trailing
    // #number in the HUMAN-READABLE venue description, e.g.:
    //   Silverest Lecture Room 05 ... BUSINESS BLOCK#192
    //   Lecture Room 2 Pioneer Campus #99
    //   Computer Room 17 @ Pioneer Campus Capacity #35
    //
    // Do not use the numeric suffix from the internal Mimosa room code.
    // The source can contain both, e.g. SVT_BUS005#242: ... BLOCK#192;
    // #192 is the displayed room capacity while #242 belongs to the internal
    // resource identifier. The canonical raw venue_capacity field is retained
    // untouched for provenance, but presentation uses this explicit label.
    const match = value.match(/#\s*(\d+)\s*$/);
    return match ? Number(match[1]) : null;
}

function cleanVenueName(venueName) {
    let value = collapseSpaces(venueName);
    if (!value) return "";

    // Strip internal venue identifiers only when a human-readable description
    // follows. Examples: SVT07_NB_, SVT_BUS006, PNR_RM02, vt009.
    value = value.replace(
        /^(?:SVT|PNR|VT)[A-Z0-9_#.-]*\s+(?=(?:Silverest|Lecture|Computer|Virtual|Knowledge|Room)\b)/i,
        ""
    );

    // Remove the trailing capacity marker from the visible venue label only
    // after extractRoomCapacity() has preserved its numeric meaning.
    value = value.replace(/\s*(?:Capacity\s*)?#\s*\d+\s*$/i, " ");
    value = value.replace(/Lecture\s*\/\s*Seminar/gi, "Lecture/Seminar");
    value = value.replace(/\bBLOCCK\b/gi, "BLOCK");
    value = value.replace(/\.{2,}/g, ".");

    return collapseSpaces(value);
}


function selectCourseNameForDisplay(entry = {}) {
    const canonical = collapseSpaces(entry.course_name);
    const lecturer = collapseSpaces(entry.lecturer_course_name);
    const student = collapseSpaces(entry.student_course_name);

    // When both source views independently agree, prefer that source wording
    // for presentation. The merge pipeline can normalize away meaningful
    // punctuation (for example the `#` in the language name `C#`).
    // We still pass the selected text through cleanCourseName(), so Mimosa
    // delivery/count markers such as PT#5, TT#25 and trailing #100 are removed.
    if (lecturer && student && lecturer === student) {
        return lecturer;
    }

    return canonical || lecturer || student;
}

function inferSessionType(entry = {}) {
    const rawName = selectCourseNameForDisplay(entry);
    const rawVariant = String(entry.course_variant || "");
    const existing = String(entry.session_type || "").trim();

    if (/\bTUTORIAL\b/i.test(rawName) || /(^|[\s_])TT(?:$|[\s_#*.-])/i.test(rawName) || /(^|[_-])TT(?:$|[_#-])/i.test(rawVariant)) {
        return "Tutorial";
    }
    if (/\bLAB(?:ORATORY)?\b/i.test(rawName) || /(^|[_-])LAB(?:$|[_#-])/i.test(rawVariant)) {
        return "Lab";
    }
    if (/\bPRACTICAL\b/i.test(rawName)) {
        return "Practical";
    }
    return existing || "Lecture";
}


function harmonizeDisplayCourseNames(entries = []) {
    const copied = entries.map((entry) => ({ ...entry }));
    const byCode = new Map();

    for (const entry of copied) {
        const code = collapseSpaces(entry.course_code).toUpperCase();
        const name = collapseSpaces(entry.display_course_name);
        if (!code || !name) continue;
        if (!byCode.has(code)) byCode.set(code, []);
        byCode.get(code).push(entry);
    }

    for (const group of byCode.values()) {
        const equivalence = new Map();
        for (const entry of group) {
            const name = collapseSpaces(entry.display_course_name);
            // Only harmonize variants that differ solely by hash punctuation.
            // This repairs meaningful tokens such as C# without flattening
            // legitimate Group A/Group C or lecture/tutorial title differences.
            const key = name.replace(/#/g, "").toLowerCase();
            if (!equivalence.has(key)) equivalence.set(key, []);
            equivalence.get(key).push(entry);
        }

        for (const variants of equivalence.values()) {
            if (variants.length < 2) continue;
            const preferred = variants
                .map((entry) => collapseSpaces(entry.display_course_name))
                .sort((a, b) => ((b.match(/#/g) || []).length - (a.match(/#/g) || []).length) || b.length - a.length)[0];
            for (const entry of variants) entry.display_course_name = preferred;
        }
    }

    return copied;
}

function toDisplayTimetableEntry(entry = {}) {
    const sessionType = inferSessionType(entry);
    const sourceCourseName = selectCourseNameForDisplay(entry);
    return {
        ...entry,
        display_course_name: cleanCourseName(sourceCourseName, sessionType),
        display_lecturer_name: cleanLecturerName(entry.lecturer_name),
        display_venue_name: cleanVenueName(entry.venue_name),
        display_room_capacity: extractRoomCapacity(entry.venue_name),
        display_session_type: sessionType,
    };
}

module.exports = {
    cleanCourseName,
    cleanLecturerName,
    cleanVenueName,
    extractRoomCapacity,
    inferSessionType,
    selectCourseNameForDisplay,
    harmonizeDisplayCourseNames,
    toDisplayTimetableEntry,
};
