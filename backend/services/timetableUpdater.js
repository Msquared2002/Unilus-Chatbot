/**
 * timetableUpdater.js
 * ====================
 * Lets staff (or a scheduled job) replace the timetable without touching
 * code, running Python, or restarting the server.
 *
 * Give it a new timetable.json (the same format the scraper pipeline
 * produces). It then:
 *   1. checks the file is sane (see "Checks" below),
 *   2. rebuilds search_index.json itself, in the exact format the Python
 *      pipeline produced (verified identical on the current data),
 *   3. compares it with the live timetable and reports what changed,
 *   4. backs up the current files,
 *   5. swaps the new data in and reloads it into the running server,
 *   6. rolls everything back if any step fails.
 *
 * Checks (the file is refused if any hard check fails):
 *   - valid JSON, a non-empty list of sessions
 *   - every session has a real weekday, a time like "09:00-11:00" that ends
 *     after it starts, and a course code. A handful of bad sessions are left
 *     out and reported; more than 1% bad means the file is refused.
 *   - the new timetable must not be much smaller than the live one (under 70%
 *     is refused unless force=true is passed, e.g. at a semester change).
 *
 * dry_run=true runs every check and reports the result without changing anything.
 */

const fs = require("fs");
const path = require("path");

const timetableService = require("./timetableService");

const TIMETABLE_DIR = path.dirname(timetableService.TIMETABLE_PATH);
const BACKUP_DIR = path.join(TIMETABLE_DIR, "backups");
const REPORT_PATH = path.join(TIMETABLE_DIR, "validation_report.json");
const LOG_PATH = path.join(TIMETABLE_DIR, "import_log.json");

const MAX_BACKUPS = 5;
const MAX_INVALID_SHARE = 0.01;
const MIN_SIZE_RATIO = 0.7;
const MAX_RECORDS = 200000;
const MAX_LOG_EVENTS = 50;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_RE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;


class TimetableError extends Error {
    constructor(status, message, details = null) {
        super(message);
        this.status = status;
        this.details = details;
        this.userFacing = true; // safe to show to staff as-is
    }
}


/* ------------------------- one change at a time ------------------------- */

let queue = Promise.resolve();

function enqueue(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
}


/* ------------------------------ search index ---------------------------- */

function words(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function codeKey(value) {
    return value === null || value === undefined ? "" : String(value).trim().toUpperCase();
}

/**
 * Builds the same lookup structure the Python pipeline wrote to
 * search_index.json: exact-match maps (course, lecturer, venue and programme
 * codes, uppercased, plus weekday) and a word index over course name,
 * lecturer name, venue name and campus. Values are positions in the list.
 */
function buildSearchIndex(records) {
    const index = {
        by_course_code: {},
        by_lecturer_code: {},
        by_venue_code: {},
        by_programme_code: {},
        by_day: {},
        tokens: {},
    };

    const push = (map, key, id) => {
        if (!key) return;
        if (!Object.prototype.hasOwnProperty.call(map, key)) map[key] = [];
        map[key].push(id);
    };

    records.forEach((record, id) => {
        push(index.by_course_code, codeKey(record.course_code), id);
        push(index.by_lecturer_code, codeKey(record.lecturer_code), id);
        push(index.by_venue_code, codeKey(record.venue_code), id);
        push(index.by_programme_code, codeKey(record.programme_code), id);
        push(index.by_day, record.day, id);

        const seen = new Set();
        for (const field of ["course_name", "lecturer_name", "venue_name", "campus"]) {
            if (record[field]) for (const word of words(record[field])) seen.add(word);
        }
        for (const word of seen) push(index.tokens, word, id);
    });

    return index;
}


/* ------------------------------- validation ----------------------------- */

function minutes(h, m) {
    return Number(h) * 60 + Number(m);
}

function problemsFor(record) {
    if (record === null || typeof record !== "object" || Array.isArray(record)) return ["not a session object"];

    const problems = [];
    if (!WEEKDAYS.includes(record.day)) problems.push("invalid day");

    const time = TIME_RE.exec(String(record.time || ""));
    if (!time) {
        problems.push("invalid time");
    } else if (minutes(time[3], time[4]) <= minutes(time[1], time[2])) {
        problems.push("time ends before it starts");
    }

    if (!record.course_code || !String(record.course_code).trim()) problems.push("missing course code");
    return problems;
}

function sourceYears(records) {
    const years = new Set();
    for (const record of records) {
        const pages = (record && record.source_pages) || {};
        for (const list of Object.values(pages)) {
            for (const url of Array.isArray(list) ? list : []) {
                const match = /\/Timetable\/(\d{4})\//i.exec(String(url));
                if (match) years.add(match[1]);
            }
        }
    }
    return [...years].sort();
}

function provenanceCounts(records) {
    const counts = {};
    for (const record of records) {
        const key = (record && record.provenance) || "unknown";
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

function validateRecords(records) {
    const valid = [];
    const excluded = [];
    const issueCounts = {};

    records.forEach((record, position) => {
        const problems = problemsFor(record);
        if (problems.length === 0) {
            valid.push(record);
            return;
        }
        for (const problem of problems) issueCounts[problem] = (issueCounts[problem] || 0) + 1;
        if (excluded.length < 20) {
            excluded.push({
                position,
                course_code: record && record.course_code ? record.course_code : null,
                problems,
            });
        }
    });

    return { valid, excludedCount: records.length - valid.length, excluded, issueCounts };
}


/* ---------------------------------- diff -------------------------------- */

function sessionKey(r) {
    return [r.programme_code, r.day, r.time, r.course_code, r.venue_name, r.lecturer_name]
        .map((value) => (value === null || value === undefined ? "" : String(value)))
        .join("|");
}

function countByKey(records) {
    const counts = new Map();
    for (const record of records) {
        const key = sessionKey(record);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

function diffSessions(oldRecords, newRecords) {
    const before = countByKey(oldRecords);
    const after = countByKey(newRecords);

    let added = 0;
    let removed = 0;
    const addedCourses = new Set();
    const removedCourses = new Set();

    for (const [key, count] of after) {
        const delta = count - (before.get(key) || 0);
        if (delta > 0) {
            added += delta;
            addedCourses.add(key.split("|")[3]);
        }
    }
    for (const [key, count] of before) {
        const delta = count - (after.get(key) || 0);
        if (delta > 0) {
            removed += delta;
            removedCourses.add(key.split("|")[3]);
        }
    }

    return {
        added_sessions: added,
        removed_sessions: removed,
        example_courses_with_new_sessions: [...addedCourses].slice(0, 8),
        example_courses_with_removed_sessions: [...removedCourses].slice(0, 8),
    };
}


/* --------------------------- files, backups, log ------------------------ */

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        return fallback;
    }
}

function writeAtomic(filePath, contents) {
    const temp = `${filePath}.tmp`;
    fs.writeFileSync(temp, contents);
    return temp;
}

function backupCurrentFiles() {
    const files = [timetableService.TIMETABLE_PATH, timetableService.SEARCH_INDEX_PATH, REPORT_PATH]
        .filter((file) => fs.existsSync(file));
    if (files.length === 0) return null;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = path.join(BACKUP_DIR, stamp);
    fs.mkdirSync(folder, { recursive: true });
    for (const file of files) fs.copyFileSync(file, path.join(folder, path.basename(file)));
    return stamp;
}

function restoreBackup(stamp) {
    if (!stamp) return;
    const folder = path.join(BACKUP_DIR, stamp);
    for (const file of [timetableService.TIMETABLE_PATH, timetableService.SEARCH_INDEX_PATH, REPORT_PATH]) {
        const saved = path.join(folder, path.basename(file));
        if (fs.existsSync(saved)) fs.copyFileSync(saved, file);
    }
}

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

function pruneBackups() {
    const backups = listBackups();
    for (const old of backups.slice(0, Math.max(backups.length - MAX_BACKUPS, 0))) {
        fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
    }
}

function recordImport(event) {
    try {
        const log = readJson(LOG_PATH, { events: [] });
        log.events = [{ at: new Date().toISOString(), ...event }, ...(log.events || [])].slice(0, MAX_LOG_EVENTS);
        fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    } catch (err) {
        console.log("[timetable] could not write the import log:", err.message);
    }
}


/* ---------------------------------- import ------------------------------ */

/**
 * @param {object} options
 * @param {Buffer}  options.buffer       the new timetable.json contents
 * @param {boolean} [options.force]      allow a much smaller timetable
 * @param {boolean} [options.dryRun]     check and report only, change nothing
 * @param {string}  [options.importedBy]
 */
function importTimetable({ buffer, force = false, dryRun = false, importedBy = "unknown", manifest = null }) {
    if(manifest&&!dryRun)return require("./timetableIngestionService").ingest(buffer,manifest);
    if(!dryRun)throw new TimetableError(409,'Authoritative complete-import manifest required. Use timetableIngestionService; raw file imports cannot replace the accepted timetable.');
    return enqueue(async () => {
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            throw new TimetableError(400, "No file received. Send the contents of timetable.json as the request body.");
        }

        let records;
        try {
            records = JSON.parse(buffer.toString("utf8"));
        } catch (err) {
            throw new TimetableError(400, "The file is not valid JSON.");
        }
        if (!Array.isArray(records)) {
            throw new TimetableError(400, "timetable.json must be a list of sessions.");
        }
        if (records.length === 0) {
            throw new TimetableError(400, "The file contains no sessions.");
        }
        if (records.length > MAX_RECORDS) {
            throw new TimetableError(400, `The file has more than ${MAX_RECORDS} sessions, which looks wrong.`);
        }

        const { valid, excludedCount, excluded, issueCounts } = validateRecords(records);

        if (excludedCount / records.length > MAX_INVALID_SHARE) {
            throw new TimetableError(
                422,
                `${excludedCount} of ${records.length} sessions are invalid (more than ${MAX_INVALID_SHARE * 100}% allowed), so the file was refused and nothing changed.`,
                { issue_counts: issueCounts, examples: excluded }
            );
        }

        const current = timetableService.getAll();
        const warnings = [];

        if (!force && current.length > 0 && valid.length < current.length * MIN_SIZE_RATIO) {
            throw new TimetableError(
                409,
                `The new timetable has ${valid.length} sessions against ${current.length} live. That is a drop of more than ${Math.round((1 - MIN_SIZE_RATIO) * 100)}%, so nothing was changed. If this is intended (for example a new semester), send it again with force=true.`
            );
        }

        const newYears = sourceYears(valid);
        const oldYears = sourceYears(current);
        if (oldYears.length && newYears.length && newYears.join() !== oldYears.join()) {
            warnings.push(`The source pages are from academic-year folder(s) ${newYears.join(", ")}; the live data used ${oldYears.join(", ")}.`);
        }
        if (excludedCount > 0) {
            warnings.push(`${excludedCount} invalid session(s) were left out.`);
        }

        const summary = {
            records: valid.length,
            previous_records: current.length,
            excluded_records: excludedCount,
            ...diffSessions(current, valid),
            source_years: newYears,
            previous_source_years: oldYears,
            provenance: provenanceCounts(valid),
            warnings,
        };

        if (dryRun) {
            return { applied: false, dry_run: true, ...summary };
        }

        const index = buildSearchIndex(valid);
        const report = {
            total_records: valid.length,
            excluded_records: excludedCount,
            issue_counts_by_category: issueCounts,
            issues: excluded,
            generated_at: new Date().toISOString(),
            imported_by: importedBy,
            source_years: newYears,
            provenance: summary.provenance,
        };

        fs.mkdirSync(TIMETABLE_DIR, { recursive: true });
        const backup = backupCurrentFiles();

        const tempFiles = [];
        try {
            tempFiles.push(writeAtomic(timetableService.TIMETABLE_PATH, JSON.stringify(valid, null, 2)));
            tempFiles.push(writeAtomic(timetableService.SEARCH_INDEX_PATH, JSON.stringify(index)));
            tempFiles.push(writeAtomic(REPORT_PATH, JSON.stringify(report, null, 2)));

            fs.renameSync(tempFiles[0], timetableService.TIMETABLE_PATH);
            fs.renameSync(tempFiles[1], timetableService.SEARCH_INDEX_PATH);
            fs.renameSync(tempFiles[2], REPORT_PATH);

            timetableService.reload();
        } catch (err) {
            for (const temp of tempFiles) {
                if (fs.existsSync(temp)) fs.unlinkSync(temp);
            }
            restoreBackup(backup);
            try {
                timetableService.reload();
            } catch (reloadError) {
                console.log("[timetable] could not reload after rollback:", reloadError.message);
            }
            recordImport({ type: "import_failed", by: importedBy, error: err.message });
            throw new TimetableError(500, `The import failed and the previous timetable was restored (${err.message}).`);
        }

        pruneBackups();
        recordImport({
            type: "import",
            by: importedBy,
            records: summary.records,
            previous_records: summary.previous_records,
            added_sessions: summary.added_sessions,
            removed_sessions: summary.removed_sessions,
            excluded_records: excludedCount,
            backup,
            forced: Boolean(force),
        });

        return { applied: true, dry_run: false, backup, ...summary };
    });
}


/* --------------------------------- status ------------------------------- */

function getTimetableStatus() {
    const records = timetableService.getAll();
    const log = readJson(LOG_PATH, { events: [] });

    const modified = (file) => {
        try {
            return fs.statSync(file).mtime.toISOString();
        } catch (err) {
            return null;
        }
    };

    return {
        records: records.length,
        provenance: provenanceCounts(records),
        source_years: sourceYears(records),
        timetable_file_updated_at: modified(timetableService.TIMETABLE_PATH),
        search_index_updated_at: modified(timetableService.SEARCH_INDEX_PATH),
        last_import: (log.events || [])[0] || null,
        recent_imports: (log.events || []).slice(0, 5),
        backups: listBackups(),
    };
}


module.exports = {
    TimetableError,
    importTimetable,
    getTimetableStatus,
    buildSearchIndex,
    validateRecords,
    diffSessions,
};
