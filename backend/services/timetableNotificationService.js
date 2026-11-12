const db=require('./db'),diff=require('./timetableChangeService');
const definitions=[
 `CREATE TABLE IF NOT EXISTS timetable_publications(id TEXT PRIMARY KEY, revision INTEGER NOT NULL UNIQUE, period TEXT NOT NULL, fingerprint TEXT NOT NULL, snapshot_json TEXT NOT NULL, previous_id TEXT REFERENCES timetable_publications(id), published_at TEXT NOT NULL, source TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS timetable_changes(id TEXT PRIMARY KEY, publication_id TEXT NOT NULL REFERENCES timetable_publications(id), scope TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS idx_timetable_change_scope ON timetable_changes(scope,created_at)`,
 `CREATE TABLE IF NOT EXISTS timetable_subscriptions(owner TEXT PRIMARY KEY, period TEXT NOT NULL, scope TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS timetable_notification_reads(owner TEXT NOT NULL,change_id TEXT NOT NULL REFERENCES timetable_changes(id),PRIMARY KEY(owner,change_id))`];
db.schema({sqlite:definitions});
const owner=user=>{if(user?.role!=='student'||!user.username)throw Object.assign(Error('Student sign-in required'),{status:403});return 'user:'+user.username;};
const latest=()=>db.get('SELECT * FROM timetable_publications ORDER BY revision DESC LIMIT 1');
async function publish(records,options){
 if(options?.complete!==true||options?.sourceValidated!==true||!/^\d{4}-[a-z0-9-]{1,30}$/i.test(options.period||'')||!String(options.source||'').trim()||!Object.hasOwn(options,'expectedPrevious'))throw Error('Explicit complete-source acceptance, period and expected version required');
 const normalized=diff.normalize(records),fingerprint=diff.digest(normalized),id=diff.digest([options.period,fingerprint]);
 return db.transaction(async()=>{
  if(db.dialect==='postgres')await db.get("SELECT pg_advisory_xact_lock(hashtext('unilus-timetable-publication'))");
  const old=await latest();
  if(old?.id===id)return{publicationId:id,duplicate:true,changes:0};
  if((old?.id||null)!==options.expectedPrevious)throw Error('Accepted version changed; review again');
  if(await db.get('SELECT id FROM timetable_publications WHERE id=?',[id]))throw Error('Historical accepted version cannot be republished implicitly');
  let changes=[];
  if(old&&old.period===options.period){const baseline=JSON.parse(old.snapshot_json).normalized;
   if(normalized.length<baseline.length*0.7)throw Error('Incomplete source: excessive timetable shrinkage');
   const scopes=new Set(normalized.filter(r=>r.programme_code).map(diff.scope));if(baseline.some(r=>r.programme_code&&!scopes.has(diff.scope(r))))throw Error('Incomplete source: previously scoped cohort/group missing');
   changes=diff.compare(baseline,normalized);
   if(changes.some(c=>c.kind==='removed')&&!options.reviewedRemovals&&!options.automatic)throw Error('Removed sessions require explicit review');
  }
  const at=new Date().toISOString();
  await db.run('INSERT INTO timetable_publications(id,revision,period,fingerprint,snapshot_json,previous_id,published_at,source) VALUES (?,?,?,?,?,?,?,?)',[id,(old?.revision||0)+1,options.period,fingerprint,JSON.stringify({records,normalized}),old?.id||null,at,String(options.source).slice(0,1000)]);
  for(const [i,c]of changes.entries())await db.run('INSERT INTO timetable_changes(id,publication_id,scope,payload,created_at) VALUES (?,?,?,?,?)',[diff.digest([id,i,c]),id,c.scope,JSON.stringify(c),at]);
  return{publicationId:id,changes:changes.length,baseline:!old||old.period!==options.period,untargetedRecords:normalized.filter(r=>!r.programme_code).length,untargetedReason:'Lecturer-only records without programme association are preserved but never broadcast.'};
 });
}
async function choices(){const p=await latest();if(!p)return{publicationId:null,period:null,choices:[],message:'No accepted timetable is available for subscriptions.'};return{publicationId:p.id,period:p.period,choices:[...new Set(JSON.parse(p.snapshot_json).normalized.filter(r=>r.programme_code).map(diff.scope))].sort().map(s=>{const [programmeCode,group]=JSON.parse(s);return{programmeCode,group,label:programmeCode+(group?' / '+group:' / common or ungrouped sessions')};})};}
async function subscribe(user,input){const who=owner(user),available=await choices();if(!available.period||input?.period!==available.period||typeof input.programmeCode!=='string'||typeof input.group!=='string')throw Object.assign(Error('Select a current published cohort and group'),{status:400});
 const code=input.programmeCode.trim().toUpperCase().replace(/\s/g,''),group=input.group.trim().toUpperCase().replace(/\s/g,'');
 if(!available.choices.some(c=>c.programmeCode===code&&c.group===group))throw Object.assign(Error('Published cohort/group not found'),{status:400});
 await db.run('INSERT INTO timetable_subscriptions(owner,period,scope) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET period=excluded.period,scope=excluded.scope',[who,input.period,JSON.stringify([code,group])]);
 return{period:input.period,programmeCode:code,group,studentSelected:true};}
async function unsubscribe(user){await db.run('DELETE FROM timetable_subscriptions WHERE owner=?',[owner(user)]);}
async function subscription(user){const s=await db.get('SELECT period,scope FROM timetable_subscriptions WHERE owner=?',[owner(user)]);if(!s)return null;const [programmeCode,group]=JSON.parse(s.scope);return{period:s.period,programmeCode,group,studentSelected:true};}
const targeted=` FROM timetable_changes c JOIN timetable_publications p ON p.id=c.publication_id JOIN timetable_subscriptions s ON s.scope=c.scope AND s.period=p.period WHERE s.owner=?`;
async function eligible(user,context){const who=owner(user);const sub=context?null:await subscription(user);const current=await latest();const scope=context?JSON.stringify([context.programme+context.year+context.semester]).slice(0,-1)+',%':JSON.stringify([sub?.programmeCode,sub?.group]);const rows=await db.all('SELECT c.id,c.payload,c.created_at,p.period,p.id AS publication_id FROM timetable_changes c JOIN timetable_publications p ON p.id=c.publication_id WHERE (p.period=? AND c.scope LIKE ?) OR c.payload LIKE ? ORDER BY c.created_at DESC,c.id DESC',[context?current?.period||'':sub?.period||'',scope,'%'+JSON.stringify('targetOwner')+':'+JSON.stringify(who)+'%']);return rows.filter(r=>{const c=JSON.parse(r.payload);if(c.targetOwner)return c.targetOwner===who&&c.profileId===context?.profileId;const session=c.after||c.before;return context?r.period===current?.period&&require('./academicContextService').matches(context,session):sub&&sub.period===r.period&&JSON.stringify([sub.programmeCode,sub.group])===c.scope;});}
async function inbox(user,context){const who=owner(user),rows=await eligible(user,context),reads=new Set((await db.all('SELECT change_id FROM timetable_notification_reads WHERE owner=?',[who])).map(r=>r.change_id));return {unreadCount:rows.filter(r=>!reads.has(r.id)).length,items:rows.slice(0,50).map(r=>{const c=JSON.parse(r.payload),session=c.after||c.before;return {id:'timetable:'+r.id,category:'timetable',read:reads.has(r.id),createdAt:r.created_at,message:c.message||diff.describe(c),change:c,action:{type:'timetable',programmeCode:session.programme_code,group:session.class_group,period:r.period,publicationId:r.publication_id,simulated:!!c.targetOwner},timeZone:'Africa/Lusaka'};})};}
async function markRead(user,id,context){const who=owner(user);if(!/^[a-f0-9]{64}$/.test(id)||!(await eligible(user,context)).some(r=>r.id===id))throw Object.assign(Error('Notification unavailable'),{status:404});await db.run('INSERT INTO timetable_notification_reads(owner,change_id) VALUES (?,?) ON CONFLICT(owner,change_id) DO NOTHING',[who,id]);}
async function hydrate(){const p=await latest();if(p)require('./timetableService').acceptSnapshot(JSON.parse(p.snapshot_json).records);return p?.id||null;}
let checkedAt=0,loadedId=null,refreshing=null;
async function refreshAccepted(force=false){if(refreshing)return refreshing;if(!force&&Date.now()-checkedAt<30000){await require("./timetableOverrideService").refresh();return;}refreshing=(async()=>{const p=await db.get('SELECT id FROM timetable_publications ORDER BY revision DESC LIMIT 1');if(p&&p.id!==loadedId)loadedId=await hydrate();checkedAt=Date.now();await require('./timetableOverrideService').refresh();})().finally(()=>{refreshing=null;});return refreshing;}
module.exports={publish,latest,choices,subscribe,unsubscribe,subscription,inbox,markRead,hydrate,refreshAccepted};
