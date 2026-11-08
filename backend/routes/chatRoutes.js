const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const chatService = require("../services/chatService");

const FRIENDLY_ERROR_ANSWER =
    "I'm having trouble reaching my AI service right now. Please try again in a minute, or contact the Academic Office on 0971263550 / info@unilus.ac.zm.";

async function handleChat(req, res) {

    const question =
        typeof req.body.question === "string"
            ? req.body.question.trim()
            : "";

    let sessionId;
    try {sessionId=await require('../services/sessionOwnershipService').resolveSession(req.body.sessionId,req.user);}
    catch(e){return res.status(e.status||503).json({error:'Conversation unavailable. Start a new conversation.'});}

    // The access level comes from the signed token (see attachUser), never
    // from the request body. A "student" value sent in the body is ignored,
    // so it can't be used to claim access. Anyone without a valid token,
    // including expired or tampered tokens, is treated as public.
    const audience = req.user ? "student" : "public";

    // Who is asking, taken from the signed token: used to personalise
    // ("my timetable") and to greet them by name.
    const profile = req.demoAcademicProfile ? { name:req.demoAcademicProfile.name,programme:req.demoAcademicProfile.programme,year:req.demoAcademicProfile.year,semester:req.demoAcademicProfile.semester } : req.user
        ? { name: req.user.name, programme: req.user.programme, year: req.user.year, semester: req.user.semester }
        : null;

    // Tells the frontend whether the user is signed in, and whether a token
    // it sent was refused ("expired" | "invalid" | "disabled") so it can
    // ask the user to sign in again.
    const authInfo = {
        authenticated: Boolean(req.user),
        authProblem: req.authProblem || null
    };

    if(question.length>4000)return res.status(400).json({error:"Question too long"});
    // Empty or missing question: answer politely instead of crashing
    // somewhere deeper in the pipeline.
    if (!question) {
        return res.status(400).json({
            question,
            answer: "Please type a question and I'll do my best to help.",
            ...authInfo,
            sessionId
        });
    }

    try {

        const result =
            await chatService.answerQuestion(
                question,
                sessionId,
                audience,
                profile,
                { user: req.user, academicProfile: req.demoAcademicProfile }
            );


        res.json({

            question,

            answer: result.answer,

            queryType: result.queryType,

            sources: result.sources,

            resources: result.resources,

            recommendedResources: result.recommendedResources,

            timetableMatches: result.timetableMatches,

            advisor: result.advisor,
            support: result.support,
            academic: result.academic,
            demoProfileId: req.demoAcademicProfile?.id,
            suggestedActions: result.suggestedActions,
            route: result.route,
            routeStatus: result.routeStatus,
            navigation: result.navigation,
            routeIntent: result.routeIntent,

            // Present only when the question was escalated:
            // { ref, status, department, category, priority, ... }
            ticket: result.ticket || null,
            usedFallback: Boolean(result.usedFallback),
            signInRequired: Boolean(result.signInRequired),

            ...authInfo,

            sessionId

        });

    } catch (error) {

        console.error("Chat request failed");

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
            ...authInfo,
            sessionId
        });

    }

}
router.post('/',async(req,res)=>{
    const demo=require('../services/demoAcademicService');
    if(!demo.allowed(req.user))return handleChat(req,res);
    try{return await demo.withChat(req.user,req.body.demoProfileId,req.body.sessionId,async profile=>{req.demoAcademicProfile=profile;req.body.sessionId=profile.sessionId;return handleChat(req,res);});}
    catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Demo academic context unavailable',profileChanged:e.status===409});}
});


module.exports = router;
