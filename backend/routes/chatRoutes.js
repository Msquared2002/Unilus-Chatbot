const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const chatService = require("../services/chatService");


router.post("/", async (req, res) => {

    try {

        const question = req.body.question;

        const sessionId =
            req.body.sessionId ||
            crypto.randomUUID();


        const result =
            await chatService.answerQuestion(
                question,
                sessionId
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

            sessionId

        });

    } catch (error) {

        console.error("Chat route error:", error);

        res.status(500).json({
            error: "Failed to process question"
        });

    }

});


module.exports = router;
