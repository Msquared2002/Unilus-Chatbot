/**
 * unansweredLogger.js
 * ====================
 *
 * Every time the chatbot has no evidence for a question, or the LLM
 * itself reports it doesn't know, that question gets appended here.
 * This is NOT a self-learning mechanism -- an LLM should never treat
 * "asked twice" as license to answer more confidently the second
 * time without new evidence. It's a review queue: a human (you or
 * your teammate) periodically reads this file, confirms what's
 * actually missing, and adds verified facts to data/documents/ the
 * same way the exam timetable was added. That keeps every future
 * answer grounded in checked information, not repetition.
 */

const fs = require("fs");
const path = require("path");

const LOG_PATH = path.join(__dirname, "../data/unanswered-questions-log.jsonl");


function logUnansweredQuestion(question, { matchedContact = null } = {}) {

    const entry = {
        question,
        matched_contact: matchedContact,
        timestamp: new Date().toISOString(),
    };

    // Append-only, one JSON object per line (JSONL) -- easy to skim,
    // easy to grep, easy to load into a spreadsheet later if useful.
    fs.appendFile(
        LOG_PATH,
        JSON.stringify(entry) + "\n",
        (err) => {
            if (err) {
                // Logging failure should never break the actual chat
                // response -- just note it and move on.
                console.log("Failed to log unanswered question:", err.message);
            }
        }
    );

}


module.exports = {
    logUnansweredQuestion,
};