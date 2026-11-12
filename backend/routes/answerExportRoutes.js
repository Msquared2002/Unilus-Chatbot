// Stateless export of text already displayed to the caller; never reads a transcript.
const router=require('express').Router();
let pending=0;
router.post('/pdf',async(req,res)=>{
  if(req.authProblem)return res.status(401).json({error:'Sign in again before exporting'});
  const {markdown,title,sources,sessionId}=req.body;
  if(typeof markdown!=='string'||!markdown.trim()||markdown.length>20000||
    (title!=null&&(typeof title!=='string'||title.length>160))||
    (sources!=null&&(!Array.isArray(sources)||sources.length>12||sources.some(s=>typeof s!=='string'||s.length>500))))return res.status(400).json({error:'Invalid export'});
  if(sessionId&&!await require('../services/sessionOwnershipService').owns(sessionId,req.user))return res.status(403).json({error:'Conversation unavailable'});
  if(pending>=2)return res.status(429).json({error:'Please retry shortly'});
  pending++;
  try{const pdf=await require('../services/pdfService').renderAnswerPdf({title:title||'UNILUS answer',markdown,sources:sources||[],note:'Exported chatbot guidance. Check the cited official sources for current requirements.'});res.set({'Content-Type':'application/pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(pdf);}
  catch{res.status(503).json({error:'Export temporarily unavailable'});}finally{pending--;}
});
module.exports=router;
