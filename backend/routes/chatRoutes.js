const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const chatService = require("../services/chatService");

const FRIENDLY_ERROR_ANSWER =
    "I'm having trouble reaching my AI service right now. Please try again in a minute, or contact the Academic Office on 0971263550 / info@unilus.ac.zm.";

router.post("/", async (req, res) => {

    const question =
        typeof req.body.question === "string"
            ? req.body.question.trim()
            : "";

    const sessionId =
        req.body.sessionId ||
        crypto.randomUUID();

    // Empty or missing question: answer politely instead of crashing
    // somewhere deeper in the pipeline.
    if (!question) {
        return res.status(400).json({
            question,
            answer: "Please type a question and I'll do my best to help.",
            sessionId
        });
    }

    try {

        // Fail closed: anything other than exactly "student" is treated
        // as "public". A request with no audience field at all (a raw
        // curl call, an older client) gets the more restrictive tier,
        // never the more permissive one.
        const audience =
            req.body.audience === "student" ? "student" : "public";


        const result =
            await chatService.answerQuestion(
                question,
                sessionId,
                audience
            );


        res.json({

            question,

            answer: result.answer,

            queryType: result.queryType,

            sources: result.sources,

            resources: result.resources,

            recommendedResources: result.recommendedResources,

            timetableMatches: result.timetableMatches,

            navigation: result.navigation,
            routeIntent: result.routeIntent,

            // Present only when the question was escalated:
            // { ref, status, department, category, priority, ... }
            ticket: result.ticket || null,
            usedFallback: Boolean(result.usedFallback),

            sessionId

        });

    } catch (error) {

        console.error("Chat route error:", error);

        // Return a normal-looking reply (HTTP 200) with a friendly
        // message so the widget displays it instead of falling back to
        // its own canned error text. `error: true` lets the frontend
        // style it differently if it ever wants to.
        res.json({
            question,
            answer: FRIENDLY_ERROR_ANSWER,
            error: true,
            queryType: null,
            sources: [],
            resources: [],
            recommendedResources: [],
            timetableMatches: 0,
            ticket: null,
            usedFallback: false,
            sessionId
        });

    }

});


module.exports = router;
