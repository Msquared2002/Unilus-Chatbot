// Private contact storage, deliberately separate from academic profiles and RAG.
const db=require('./db'),fs=require('node:fs');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const definitions=[
 'CREATE TABLE IF NOT EXISTS support_contact_profiles(owner TEXT PRIMARY KEY,email TEXT,phone TEXT,updated_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS ticket_support_details(ticket_ref TEXT PRIMARY KEY REFERENCES tickets(ticket_ref),student_username TEXT,student_email TEXT,student_phone TEXT,contact_status TEXT NOT NULL,consented_at TEXT,routing_reason TEXT NOT NULL)'];
db.schema({sqlite:definitions});
function validate(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Invalid contact information');
 const email=input.email==null?'':input.email,raw=input.phone==null?'':input.phone;
 if(typeof email!=='string'||typeof raw!=='string'||email.length>254||raw.length>32||/[\x00-\x1f\x7f<>]/.test(email+raw))throw fail('Invalid contact information');
 const e=email.trim().toLowerCase();if(e&&!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e))throw fail('Enter a valid email address');
 let phone=raw.trim();if(phone&&!/^\+?[\d ()-]+$/.test(phone))throw fail('Enter a valid phone number');phone=phone.replace(/[ ()-]/g,'');
 if(/^0[79]\d{8}$/.test(phone))phone='+260'+phone.slice(1);else if(/^260[79]\d{8}$/.test(phone))phone='+'+phone;
 if(phone&&(!/^\+[1-9]\d{7,14}$/.test(phone)||phone.startsWith('+260')&&!/^\+260[79]\d{8}$/.test(phone)))throw fail('Use a supported Zambian mobile number or international +country format');
 return {email:e||null,phone:phone||null};
}
function owner(user){if(user?.role!=='student'||!user.username)throw fail('Student sign-in required',403);return 'user:'+user.username;}
async function save(user,input){const who=owner(user);if(input?.consent!==true)throw fail('Explicit permission to save support contact information is required');const c=validate(input);await db.run('INSERT INTO support_contact_profiles(owner,email,phone,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET email=excluded.email,phone=excluded.phone,updated_at=excluded.updated_at',[who,c.email,c.phone,new Date().toISOString()]);return c;}
async function get(user){const who=owner(user);let row=await db.get('SELECT email,phone FROM support_contact_profiles WHERE owner=?',[who]);if(!row&&process.env.SUPPORT_CONTACTS_FILE){
  // Only this explicitly purpose-authorized private file may seed contact defaults.
  const config=JSON.parse(fs.readFileSync(process.env.SUPPORT_CONTACTS_FILE,'utf8'));
  if(config.owner===user.username&&config.supportContactAuthorized===true)row=await save(user,{email:config.email,phone:config.phone,consent:true});
 }return row?{email:row.email,phone:row.phone}:{email:null,phone:null};}
function forTicket(input){if(!input||input.omit===true)return {email:null,phone:null,status:'omitted'};const c=validate(input);if((c.email||c.phone)&&input.consent!==true)throw fail('Permission to share contact details with this ticket is required');return {...c,status:c.email||c.phone?'provided':'omitted'};}
function redact(text){return String(text||'').replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,'[contact email omitted]').replace(/\+[1-9](?:[ ()-]?\d){7,14}\b/g,'[contact phone omitted]').replace(/(?:\+?260|0)[ -]?[79](?:[ -]?\d){8}\b/g,'[contact phone omitted]');}
module.exports={definitions,validate,owner,get,save,forTicket,redact};
