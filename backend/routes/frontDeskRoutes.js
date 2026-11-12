const express=require('express'),router=express.Router();
const contacts=require('../services/supportContactService'),attachments=require('../services/ticketAttachmentService');
const support=require('../services/supportService'),ownership=require('../services/sessionOwnershipService');
const directory=require('../../dummy-environment/js/support-departments');
const {requireStaff}=require('../middleware/requireStaff');
const error=(res,e)=>res.status(e.status||503).json({error:e.status===400||e.status===409?e.message:'Support resource unavailable'});
router.get('/support/departments',(req,res)=>res.json(directory.departments.map(({id,name,category})=>({id,name,category}))));
router.get('/support/contact-profile',async(req,res)=>{try{res.json(await contacts.get(req.user));}catch(e){error(res,e);}});
router.put('/support/contact-profile',async(req,res)=>{try{res.json(await contacts.save(req.user,req.body));}catch(e){error(res,e);}});
router.put('/support/draft/contact',async(req,res)=>{try{res.json(await require('../services/supportConversationService').setContact(req.body.sessionId,req.user,req.body.contact,req.body.draftId));}catch(e){error(res,e);}});
async function access(req,res,next,staff=false){try{
 const ticket=await support.getTicketForAdmin(req.params.ref);if(!ticket)return res.status(404).json({error:'Ticket unavailable'});
 if(staff){const actual=directory.normalize(ticket.department),assigned=directory.normalize(req.user?.department);if(req.user&&req.user.role!=='admin'&&!(req.user.role==='staff'&&actual&&assigned&&actual.id===assigned.id))return res.status(403).json({error:'Ticket unavailable'});}
 else {const sid=req.get('x-chat-session');if(req.user?!await ownership.owns(ticket.session_id,req.user):(!sid||sid!==ticket.session_id||!await ownership.owns(sid,null)))return res.status(403).json({error:'Ticket unavailable'});}
 req.supportTicket=ticket;next();
 }catch(e){error(res,e);}}
const own=(req,res,next)=>access(req,res,next),staff=(req,res,next)=>access(req,res,next,true);
const raw=express.raw({type:()=>true,limit:Math.min(5*1024*1024,attachments.maxBytes())});
async function download(req,res){try{const {row,bytes}=await attachments.get(req.params.ref,req.params.id);let permitted=false;await access(req,res,()=>{permitted=true;},req.path.startsWith('/admin/'));if(!permitted)return;res.set({'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(row.display_name),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'no-store'}).send(bytes);}catch(e){error(res,e);}}
router.get('/tickets/:ref/attachments',own,async(req,res)=>{try{res.json(await attachments.list(req.params.ref));}catch(e){error(res,e);}});
router.post('/tickets/:ref/attachments',own,raw,async(req,res)=>{try{const owner=req.user?'user:'+req.user.username:'guest:'+req.supportTicket.session_id;const saved=await attachments.upload({ticket:req.supportTicket,owner,name:decodeURIComponent(req.get('x-file-name')||''),mime:req.get('content-type')?.split(';')[0],bytes:req.body,operationId:req.get('idempotency-key')});res.status(saved.duplicate?200:201).json(saved);}catch(e){error(res,e);}});
router.get('/tickets/:ref/attachments/:id',own,download);
router.delete('/tickets/:ref/attachments/:id',own,async(req,res)=>{try{res.json(await attachments.remove(req.params.ref,req.params.id));}catch(e){error(res,e);}});
router.get('/admin/tickets/:ref/attachments',requireStaff,staff,async(req,res)=>{try{res.json(await attachments.list(req.params.ref));}catch(e){error(res,e);}});
router.get('/admin/tickets/:ref/attachments/:id',requireStaff,staff,download);
module.exports=router;
