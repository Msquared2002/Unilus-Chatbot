const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const chatService = require("../services/chatService");


router.post("/", async (req, res) => {

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

        sessionId: result.sessionId

    });

});


module.exports = router;