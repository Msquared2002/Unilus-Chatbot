/**
 * timetableService.js
 * ====================
 *
 * Rewritten to load the NEW pipeline output:
 *   - data/timetable.json     (MergedTimetableEntry[], canonical fields only)
 *   - data/search_index.json  (exact-match maps + token inverted index,
 *                               built by unilus_timetable/index.py)
 *
 * WHY THIS CHANGED FROM THE OLD VERSION
 * --------------------------------------
 * 1. The old file loaded ONLY chatbot_timetable.json, which the old
 *    Python pipeline had already filtered down to source === "student"
 *    records — every lecturer-only class was invisible to the chatbot.
 *    timetable.json has no such filter: lecturer_only, student_only,
 *    and merged entries are all present, distinguished by `provenance`
 *    if a caller ever needs to know.
 *
 * 2. getByCourse/getByLecturer/getByProgramme/getByDay used to
 *    `.filter()` over the ENTIRE array on every single call. They now
 *    do an O(1) lookup into the index built once at load time.
 *
 * 3. `search()` no longer does its own hand-rolled scoring pass over
 *    every record. It intersects the query's tokens against the
 *    inverted index (so cost is proportional to how many records
 *    actually contain a matching word, not the size of the dataset),
 *    then applies the same course-code / exact-name scoring boosts
 *    the old version used, on that much smaller candidate set.
 */

const fs = require("fs");
const path = require("path");

function loadJsonOrEmpty(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        console.warn(`timetableService: ${filePath} not found — run the timetable pipeline first. Using empty data.`);
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const timetable = loadJsonOrEmpty(path.join(__dirname, "../data/timetable/timetable.json"), []);

const searchIndex = loadJsonOrEmpty(path.join(__dirname, "../data/timetable/search_index.json"), {
    by_course_code: {},
    by_lecturer_code: {},
    by_venue_code: {},
    by_programme_code: {},
    by_day: {},
    tokens: {},
});

// Programme codes such as BIT32 encode programme family + year + semester.
// Build this dynamically from the generated index so routing never depends on
// a hand-maintained whitelist of programmes. Codes with unusual schemas
// (e.g. medicine variants) simply remain available through exact programme
// lookups and fuzzy search; the stage resolver only handles codes whose
// structure is unambiguous in the data.
function compactProgrammeCode(code) {
    return String(code || "").toUpperCase().replace(/\s+/g, "");
}

const programmeStageDescriptors = Object.keys(searchIndex.by_programme_code || {})
    .map((code) => {
        const compact = compactProgrammeCode(code);
        const match = compact.match(/^([A-Z][A-Z0-9_]*?)([1-9])([1-9])(?:[-_].*)?$/);
        if (!match) return null;
        const [, family, year, semester] = match;
        const isPartTime = /(?:^|[-_])PT(?:$|[-_])/.test(compact);
        const isFullTime = /(?:^|[-_])FT(?:$|[-_])/.test(compact) || !isPartTime;
        return {
            code,
            compact,
            family,
            year: Number(year),
            semester: Number(semester),
            mode: isPartTime ? "part_time" : isFullTime ? "full_time" : null,
        };
    })
    .filter(Boolean);

const knownProgrammeFamilies = new Set(programmeStageDescriptors.map((d) => d.family));

function normalize(text) {
    if (!text) return "";
    return text.toString().trim().toLowerCase();
}

function stripTitle(text) {
    return normalize(text).replace(/^(mr|mrs|ms|dr|prof|miss|rev)\.?\s+/, "");
}

function idsToRecords(ids) {
    return (ids || []).map((i) => timetable[i]).filter(Boolean);
}

function tokenize(text) {
    return normalize(text)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0);
}

// ------------------------------------------------------------------
// A dynamically-built set of every lecturer surname/first-name token
// actually present in the data. This replaces the old hardcoded
// five-name whitelist in retrievalService.js — any lecturer who is
// actually in the timetable can now be recognized, not just five.
// ------------------------------------------------------------------
const knownLecturerNameTokens = new Set();
for (const entry of timetable) {
    if (entry.lecturer_name) {
        for (const token of tokenize(stripTitle(entry.lecturer_name))) {
            if (token.length > 2) knownLecturerNameTokens.add(token);
        }
    }
}

function isKnownLecturerNameToken(token) {
    const normalized = normalize(token);

    // Ignore common timetable/programme words accidentally extracted
    // from student-only programme names.
    const blockedTokens = new Set([
        "master",
        "arts",
        "science",
        "development",
        "studies",
        "stage",
        "one",
        "two",
        "three",
        "programme",
        "program",
        "bachelor",
        "degree",
        "technology",
        "management",
        "business",
        "administration"
    ]);

    if (blockedTokens.has(normalized)) {
        return false;
    }

    return knownLecturerNameTokens.has(normalized);
}

function isKnownProgrammeFamily(value) {
    return knownProgrammeFamilies.has(String(value || "").toUpperCase());
}

function getProgrammeStageCodes({ family, year, semester, mode = null } = {}) {
    const normalizedFamily = String(family || "").toUpperCase();
    const y = Number(year);
    const sem = Number(semester);
    if (!normalizedFamily || !Number.isInteger(y) || !Number.isInteger(sem)) return [];

    const matches = programmeStageDescriptors.filter((d) =>
        d.family === normalizedFamily && d.year === y && d.semester === sem
    );

    if (!matches.length) return [];

    if (mode === "part_time") {
        return matches.filter((d) => d.mode === "part_time").map((d) => d.code);
    }
    if (mode === "full_time") {
        return matches.filter((d) => d.mode !== "part_time").map((d) => d.code);
    }

    // When mode was not stated, prefer the ordinary/full-time code if one
    // exists. This mirrors how programme codes are published: BIT32 is the
    // normal/full-time cohort, while BIT32-PT is explicitly part-time.
    const standard = matches.filter((d) => d.mode !== "part_time");
    return (standard.length ? standard : matches).map((d) => d.code);
}

function getByProgrammeStage({ family, year, semester, mode = null } = {}) {
    const codes = getProgrammeStageCodes({ family, year, semester, mode });
    const seen = new Set();
    const records = [];
    for (const code of codes) {
        for (const record of getByProgramme(code)) {
            const key = [
                record.programme_code, record.day, record.time, record.course_code,
                record.course_name, record.lecturer_name, record.venue_name,
            ].join("|");
            if (!seen.has(key)) {
                seen.add(key);
                records.push(record);
            }
        }
    }
    return records;
}

function getAll() {
    return timetable;
}

function getByCourse(courseCode) {
    const code = normalize(courseCode).toUpperCase();
    return idsToRecords(searchIndex.by_course_code[code]);
}

function getByProgramme(programmeCode) {
    const code = normalize(programmeCode).toUpperCase();
    return idsToRecords(searchIndex.by_programme_code[code]);
}

function getByVenue(venueCode) {
    const code = normalize(venueCode).toUpperCase();
    return idsToRecords(searchIndex.by_venue_code[code]);
}

function getByLecturerCode(lecturerCode) {
    const code = normalize(lecturerCode).toUpperCase();
    return idsToRecords(searchIndex.by_lecturer_code[code]);
}

function getByLecturer(name) {
    const queryTokens = tokenize(stripTitle(name)).filter((t) => t.length > 2);
    if (queryTokens.length === 0) return [];

    // Intersect token candidate sets, then confirm on the actual
    // lecturer_name field so "joseph mwanza" doesn't match a record
    // whose venue happens to contain "joseph" unrelatedly.
    let candidateIds = null;
    for (const token of queryTokens) {
        const ids = new Set(searchIndex.tokens[token] || []);
        candidateIds = candidateIds === null ? ids : new Set([...candidateIds].filter((id) => ids.has(id)));
    }

    return idsToRecords([...(candidateIds || [])]).filter((record) => {
        const lecturerName = stripTitle(record.lecturer_name);
        return queryTokens.every((token) => lecturerName.includes(token));
    });
}

function getByDay(day) {
    const d = day ? day.charAt(0).toUpperCase() + day.slice(1).toLowerCase() : "";
    return idsToRecords(searchIndex.by_day[d]);
}

function search(query) {
    const queryText = normalize(query);
    const words = tokenize(query).filter((w) => w.length > 2);

    if (words.length === 0) return [];

    // Gather candidates: union of everything any query word touches,
    // via the token index — NOT every record in the dataset.
    const candidateIds = new Set();
    for (const word of words) {
        for (const id of searchIndex.tokens[word] || []) candidateIds.add(id);
    }
    // Also always consider exact course-code index hits, since course
    // codes like "BIT320" are matched as codes, not as free-text tokens.
    for (const word of words) {
        for (const id of searchIndex.by_course_code[word.toUpperCase()] || []) candidateIds.add(id);
    }

    const results = [...candidateIds]
        .map((i) => timetable[i])
        .filter(Boolean)
        .map((record) => {
            const courseName = normalize(record.course_name);
            const searchableText = [
                record.course_code,
                record.course_name,
                record.programme_code,
                record.programme_name,
                record.lecturer_name,
                record.venue_name,
                record.day,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            let score = 0;

            if (courseName === queryText) score += 100;
            else if (queryText.includes(courseName) && courseName) score += 50;
            else if (courseName.includes(queryText) && queryText) score += 40;

            if (record.course_code && queryText.includes(normalize(record.course_code))) {
                score += 10;
            }

            words.forEach((word) => {
                if (searchableText.includes(word)) score += 2;
            });

            const courseWords = courseName.split(/\s+/).filter((w) => w.length > 3);
            const matchedCourseWords = courseWords.filter((w) => queryText.includes(w)).length;

            if (courseWords.length > 0) {
                const ratio = matchedCourseWords / courseWords.length;
                if (ratio === 1) score += 30;
                else if (ratio >= 0.5) score += 10;
            }

            return { ...record, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    return results;
}

module.exports = {
    getAll,
    getByCourse,
    getByProgramme,
    getByVenue,
    getByLecturerCode,
    getByLecturer,
    getByDay,
    getByProgrammeStage,
    getProgrammeStageCodes,
    isKnownProgrammeFamily,
    search,
    isKnownLecturerNameToken,
};
