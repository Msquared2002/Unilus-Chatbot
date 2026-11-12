const router=require('express').Router(),service=require('../services/answerFeedbackService'),{requireStaff}=require('../middleware/requireStaff');
const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Feedback temporarily unavailable'});}};
const admin=(req,res,next)=>req.user?.role==='admin'||!req.user?next():res.status(403).json({error:'Administrator required'});
router.patch('/feedback/:id',run(req=>service.update(req.params.id,req.body,req.user)));
router.get('/admin/feedback',requireStaff,admin,run(req=>service.list(req.query)));
router.patch('/admin/feedback/:id',requireStaff,admin,run(req=>service.review(req.params.id,req.body.reviewed!==false)));
module.exports=router;
