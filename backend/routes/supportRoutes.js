/**

 * supportRoutes.js

 * =================

 * Mounted at /api in server.js.

 *

 *   Public:

 *     GET   /api/tickets/:ref        ticket status only (no question text, no history)

 *     POST  /api/feedback            { sessionId, rating: "up"|"down", comment? }

 *

 *   Staff (signed in as role "staff" or "admin", OR header x-admin-key):

 *     GET   /api/admin/tickets       ?status=Open&limit=50

 *     GET   /api/admin/tickets/:ref  full ticket including conversation history

 *     PATCH /api/admin/tickets/:ref  { status: "In Progress" | "Resolved" | ... }

 *     GET   /api/admin/stats         escalation and feedback statistics

 *

 * Staff access works two ways:

 *   1. a sign-in token (Authorization: Bearer ...) for a staff or admin

 *      account, from POST /api/auth/login

 *   2. the shared ADMIN_API_KEY from .env, sent as x-admin-key

 * Both fail closed. Students and anonymous users get 401.

 */



const express = require("express");



const router = express.Router();

const support = require("../services/supportService");

const ownership=require('../services/sessionOwnershipService');

const workflow=require('../services/ticketWorkflowService');

function allowed(req,t){const dir=require('../../dummy-environment/js/support-departments'),d=dir.normalize(req.user?.department),target=dir.normalize(t.department);return !req.user||req.user.role==='admin'||(req.user.role==='staff'&&d&&target&&d.id===target.id);}

const { requireStaff } = require("../middleware/requireStaff");





/* ----------------------------- Public ----------------------------- */



router.get("/tickets/:ref", async (req, res) => {

    try {

        const ticket = await support.getTicketByRef(req.params.ref);



        if (!ticket) {

            return res.status(403).json({ error: "Ticket unavailable" });

        }



        const full=await support.getTicketForAdmin(req.params.ref);

        const sid=req.get('x-chat-session');

        if(req.user?!await ownership.owns(full.session_id,req.user):(!sid||sid!==full.session_id||!await ownership.owns(sid,null)))return res.status(403).json({error:'Ticket unavailable'});

        res.json({...ticket,events:await workflow.list(req.params.ref)});

    } catch (error) {

        console.error("Ticket lookup error:");

        res.status(500).json({ error: "Failed to look up ticket" });

    }

});





router.post("/feedback", async (req, res) => {

    try {

        const result = await require('../services/answerFeedbackService').record({

            sessionId: await ownership.resolveSession(req.body.sessionId, req.user),

            rating: req.body.rating,

            comment: typeof req.body.comment === "string" ? req.body.comment : null,
            reason:req.body.reason, answerRef:req.body.answerRef, category:req.body.category,
            audience:req.user?'signed-in':'visitor'

        });



        res.json({ ok: true, id:result.id });

    } catch (error) {

        if (/rating must be/.test(error.message)) {

            return res.status(400).json({ error: error.message });

        }

        console.error("Feedback error:");

        res.status(error.status || 500).json({ error: "Feedback could not be saved" });

    }

});





/* ------------------------------ Staff ----------------------------- */



router.get("/admin/tickets", requireStaff, async (req, res) => {

    try {

        if(req.user?.role==='staff'&&!require('../../dummy-environment/js/support-departments').normalize(req.user.department))return res.status(403).json({error:'Configured staff department required'});
        const rows=await support.listTickets({
                department:req.user?.role==='staff'?require('../../dummy-environment/js/support-departments').normalize(req.user.department).name:null,

                status: req.query.status || null,

                limit: req.query.limit

            });

        res.json(rows.filter(t=>allowed(req,t)));

    } catch (error) {

        console.error("Admin ticket list error:");

        res.status(500).json({ error: "Failed to list tickets" });

    }

});





router.get("/admin/tickets/:ref", requireStaff, async (req, res) => {

    try {

        const ticket = await support.getTicketForAdmin(req.params.ref);



        if (!ticket) {

            return res.status(404).json({ error: "Ticket not found" });

        }



        if(!allowed(req,ticket))return res.status(403).json({error:"Ticket unavailable"});

        res.json({...ticket,events:await workflow.list(req.params.ref,true),attachments:await require('../services/ticketAttachmentService').list(req.params.ref)});

    } catch (error) {

        console.error("Admin ticket read error:");

        res.status(500).json({ error: "Failed to read ticket" });

    }

});





router.patch("/admin/tickets/:ref", requireStaff, async (req, res) => {

    try {

        if (!support.normalizeStatus(req.body.status)) {

            return res.status(400).json({

                error: `status must be one of: ${support.STATUSES.join(", ")}`

            });

        }



        const current=await support.getTicketForAdmin(req.params.ref);

        if(current&&!allowed(req,current))return res.status(403).json({error:"Ticket unavailable"});

        const updated = await support.updateTicketStatus(req.params.ref, req.body.status, req.user?.username || 'admin-key');



        if (!updated) {

            return res.status(404).json({ error: "Ticket not found" });

        }



        res.json(updated);

    } catch (error) {

        console.error("Admin ticket update error:");

        res.status(error.status || 500).json({ error: error.status === 400 ? "Unsupported status transition" : "Failed to update ticket" });

    }

});





router.get("/admin/stats", requireStaff, async (req, res) => {

    if(req.user?.role==="staff")return res.status(403).json({error:"Administrator required for global reports"});

    try {

        res.json(await support.getStats());

    } catch (error) {

        console.error("Admin stats error:");

        res.status(500).json({ error: "Failed to compute stats" });

    }

});





router.post('/admin/tickets/:ref/events',requireStaff,async(req,res)=>{try{const t=await support.getTicketForAdmin(req.params.ref);if(!t)return res.status(404).json({error:'Ticket not found'});if(!allowed(req,t))return res.status(403).json({error:'Ticket unavailable'});if(!['reply','note'].includes(req.body.kind))return res.status(400).json({error:'Unsupported event kind'});const kind=req.body.kind;await workflow.add(req.params.ref,{kind,body:req.body.body,actor:req.user?.username||'admin-key',visibility:kind==='note'?'staff':'student'});res.json({ok:true});}catch(e){res.status(e.status||500).json({error:'Ticket event could not be saved'});}});

router.post('/admin/tickets/:ref/assignment',requireStaff,async(req,res)=>{if(req.user&&req.user.role!=='admin')return res.status(403).json({error:'Administrator required to reroute'});try{const t=await support.getTicketForAdmin(req.params.ref);if(!t)return res.status(404).json({error:'Ticket not found'});await workflow.assign(req.params.ref,req.body.department,req.body.assignee,req.user?.username||'admin-key');res.json({ok:true});}catch{res.status(400).json({error:'Assignment could not be saved'});}});

router.post('/tickets',async(req,res)=>{try{if(req.body.department||req.body.assignee||req.body.student_username)return res.status(400).json({error:'Assignment and identity are controlled by the server'});const question=typeof req.body.question==='string'?req.body.question.trim():'';if(!question||question.length>2000)return res.status(400).json({error:'A support enquiry of at most 2000 characters is required'});const sessionId=await ownership.resolveSession(req.body.sessionId,req.user);const result=await require('../services/ticketSubmissionService').submit({sessionId,user:req.user,question,consent:req.body.consent,studentContact:req.body.contact});res.status(result.created?201:200).json({ticket:result.ticket,sessionId,prototype:true});}catch(e){res.status(e.status||500).json({error:'Support enquiry could not be saved'});}});
router.use(require('./answerFeedbackRoutes'));
module.exports = router;
