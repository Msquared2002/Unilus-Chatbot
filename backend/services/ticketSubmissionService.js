// All untrusted creation paths share the same consent and ownership checks.
const ownership=require('./sessionOwnershipService'),contacts=require('./supportContactService');
async function submit({sessionId,user,question,consent,studentContact}){
 if(!await ownership.owns(sessionId,user))throw Object.assign(Error('Support request unavailable'),{status:403});
 if(consent!==true)throw Object.assign(Error('Confirm the support issue before submission'),{status:400});
 if(typeof question!=='string'||!question.trim()||question.length>2000)throw Object.assign(Error('A support issue of at most 2000 characters is required'),{status:400});
 const personal=contacts.forTicket(studentContact);
 return require('./supportService').createTicket({sessionId,question:contacts.redact(question.trim()),history:[],studentContact:personal,user,consent:true});
}
module.exports={submit};
