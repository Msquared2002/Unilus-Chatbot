const router=require('express').Router(),service=require('../services/academicPublicationService');const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Academic information unavailable'});}};
router.get('/admin/academic-publications/:id',run(r=>service.review(r.user,r.params.id)));
router.post('/admin/academic-publications',run(r=>service.draft(r.user,r.body)));
router.post('/admin/academic-publications/:id/publish',run(r=>service.publish(r.user,r.params.id,r.body)));
router.post('/admin/academic-publications/:id/cancel',run(r=>service.cancel(r.user,r.params.id)));
async function context(r){return r.user?.role==='student'?require('../services/academicContextService').resolve(r.user):null;}
router.get('/academic-information/:kind',run(async r=>service.select(r.params.kind,r.user,await context(r),r.query)));
router.get('/announcements/:id',run(async r=>service.detail(r.user,await context(r),r.params.id)));
module.exports=router;
