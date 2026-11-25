const router=require('express').Router(),service=require('../services/demoAcademicService');
router.use((req,res,next)=>service.allowed(req.user)?next():res.status(403).json({error:'Fictional academic profiles are not enabled for this account'}));
router.get('/profile',async(req,res)=>{try{res.json(await service.get(req.user));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Demo profile unavailable'});}});
router.post('/profile',async(req,res)=>{try{res.json(await service.renew(req.user,{mode:req.body.mode,programme:req.body.programme,expectedProfileId:req.body.expectedProfileId,year:req.body.year,semester:req.body.semester}));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Demo profile unavailable'});}});
router.get('/programmes',(req,res)=>res.json(service.programmeChoices()));
router.use((req,res)=>res.status(404).json({error:'Unknown demo academic endpoint'}));
module.exports=router;
