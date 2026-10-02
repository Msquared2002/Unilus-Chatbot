/**
 * contactService.js
 * ==================
 *
 * When retrieval finds no timetable, knowledge, or resource evidence
 * at all for a question, this picks the closest matching UNILUS
 * contact/department so the student gets a redirect instead of a
 * dead end. Deliberately NOT a FAISS-style index: only a handful of
 * contact entries exist, so plain in-memory cosine similarity (via
 * embeddingService, the same embedding model used everywhere else in
 * this backend) is all this needs.
 */

const fs = require("fs");
const path = require("path");

const { createEmbedding, cosineSimilarity } = require("./embeddingService");

const contacts = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../data/contacts_seed.json"),
        "utf8"
    )
).contacts;


const CONTACT_FALLBACK_THRESHOLD = 0.25;
// Looser than a normal relevance threshold on purpose: routing someone
// to "who to ask" only needs a rough topic match, not the precision
// required to state a fact as true.


function contactToText(c) {
    const phone = c.phone ? ` Call ${c.phone}.` : "";
    const email = c.email ? ` Email ${c.email}.` : "";
    return `For questions about ${c.topic.toLowerCase()}, contact the ${c.department}. ${c.note}${phone}${email}`;
}


// Embedded once, lazily, and cached in memory. Only 3 entries, so this
// is cheap -- and lazy so it doesn't do embedding work at module load
// time before the model is needed elsewhere.
let contactVectors = null;


async function getContactVectors() {
    if (!contactVectors) {
        contactVectors = [];
        for (const c of contacts) {
            const text = contactToText(c);
            const embedding = await createEmbedding(text);
            contactVectors.push({ ...c, text, embedding });
        }
        console.log("Loaded contact vectors:", contactVectors.length);
    }
    return contactVectors;
}


async function findFallbackContact(question) {
    const vectors = await getContactVectors();
    const queryVector = await createEmbedding(question);

    let best = null;
    let bestScore = -1;

    for (const item of vectors) {
        const score = cosineSimilarity(queryVector, item.embedding);
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }

    if (best && bestScore >= CONTACT_FALLBACK_THRESHOLD) {
        return { contact: best, score: bestScore };
    }

    return null;
}


module.exports = {
    findFallbackContact,
};