const crypto=require('node:crypto');
function logUnansweredQuestion(question,{matchedContact=null}={}){console.info(JSON.stringify({event:'unanswered_question',questionHash:crypto.createHash('sha256').update(String(question)).digest('hex'),contact:matchedContact,timestamp:new Date().toISOString()}));}
module.exports={logUnansweredQuestion};
