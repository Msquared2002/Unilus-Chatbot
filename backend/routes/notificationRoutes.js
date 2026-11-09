const router=require('express').Router();
const notifications=require('../services/ticketNotificationService');
router.use((req,res,next)=>req.user?.role==='student'?next():res.status(403).json({error:'Student sign-in required'}));
router.get('/',async(req,res)=>{try{res.json(await notifications.inbox(req.user));}catch{res.status(503).json({error:'Notifications are temporarily unavailable'});}});
router.post('/:id/read',async(req,res)=>{try{await notifications.markRead(req.user,req.params.id);res.json({ok:true});}catch(e){res.status(e.status||503).json({error:'Notification unavailable'});}});
module.exports=router;
