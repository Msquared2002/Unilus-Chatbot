const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {inspect,CORE}=require('../services/postgresOperations');
const {migrate,checkCore,checkSecurity}=require('../services/migrationService');
const backup=require('../services/logicalBackup');
const sql=fs.readFileSync(path.join(__dirname,'../migrations/001_integrated_core.sql'),'utf8');
const roleSql=fs.readFileSync(path.join(__dirname,'../../deployment/provision-runtime-role.sql'),'utf8');
const file={name:'001_integrated_core.sql',sql};
async function fixture(){
 const db=new PGlite();
 const client={query:async(s,p)=>p?db.query(s,p):(await db.exec(s)).at(-1)||{rows:[]}};
 await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;");
 await db.exec(sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS conversations'),sql.indexOf('CREATE TABLE IF NOT EXISTS chat_sessions')));
 for(const t of CORE)await db.exec('ALTER TABLE public.'+t+' ENABLE ROW LEVEL SECURITY');
 await db.exec("INSERT INTO conversations(session_id,role,content)VALUES('synthetic-session','user','Synthetic O''Brien enquiry');INSERT INTO feedback(session_id,rating)VALUES('synthetic-session','up');INSERT INTO staff_answers(question,answer)VALUES('synthetic question','synthetic answer');INSERT INTO tickets(ticket_ref,session_id,question,summary,history_json,category,priority,department)VALUES('UNI-2099-0001','synthetic-session','Synthetic enquiry','Synthetic summary','[]','General','Low','Academic Office');");
 await db.exec(roleSql);return{db,client};
}

test('policy guard supports actual pg name[] text and rejects broader or malformed roles',async()=>{
 const {db,client}=await fixture();try{
  await migrate(client,{files:[file]});
  const policyClient=roles=>({query:async(sql,params)=>{
   const result=await client.query(sql,params);
   if(sql.startsWith('SELECT tablename,roles,cmd,qual,with_check FROM pg_policies'))return{rows:result.rows.map(p=>({...p,roles}))};
   return result;
  }});
  // This is the default pg driver representation confirmed read-only on PG17.11.
  assert.equal(require('pg').types.getTypeParser(1003)('{unilus_backend}'),'{unilus_backend}');
  await checkSecurity(policyClient('{unilus_backend}'));
  for(const roles of ['{public}','{unilus_backend,anon}','{}','unilus_backend',null,['unilus_backend','anon'],['public']])
   await assert.rejects(checkSecurity(policyClient(roles)),/RUNTIME_POLICY_DRIFT/);
 }finally{await db.close();}
});

test('integrated logical recovery preserves all nine tables, ledger, policies and sequence states',async()=>{
 const {db,client}=await fixture();try{
  await migrate(client,{files:[file]});
  await db.exec("INSERT INTO chat_sessions VALUES('synthetic-recovery','user:synthetic','now','later');INSERT INTO knowledge_records VALUES('synthetic-recovery','{}');INSERT INTO ticket_assignments VALUES('synthetic-ref','Academic Office','synthetic-staff')");
  const snapshot=await backup.capture(client,{integrated:true});
  assert.equal(snapshot.tableNames.length,10);
  // Simulate the actual pg name[] representation in a restored snapshot.
  for(const p of snapshot.metadata.policies)p.roles='{unilus_backend}';
  for(const s of snapshot.sequences)for(const k of ['start_value','min_value','max_value','increment_by','cache_size'])s[k]=String(s[k]);
  snapshot.restoreSql=backup.restoreSql(snapshot);
  const envelope=backup.seal(snapshot,b=>b).envelope;
  const recovered=backup.open(envelope,b=>b).snapshot;
  const result=await require('../services/rehearsePortableBackup').rehearseSnapshot(recovered);
  assert.equal(result.tableCounts.schema_migrations,1);
  assert.equal(result.tableCounts.knowledge_records,1);
  assert.equal(result.sequenceDefinitionsAndStateMatched,true);
 }finally{await db.close();}
});
test('coordinated migration preserves original contents, protects ledger and is repeatable',async()=>{
 const {db,client}=await fixture();try{
  const before=await inspect(client);checkCore(before);
  await migrate(client,{files:[file],backupCounts:before.counts,backupFingerprints:before.fingerprints});
  await migrate(client,{files:[file],backupCounts:before.counts,backupFingerprints:before.fingerprints});
  const after=await inspect(client);for(const t of CORE)assert.equal(after.fingerprints[t],before.fingerprints[t]);
  assert.equal(after.counts.schema_migrations,1);assert.equal(after.policies.length,9);assert.equal(after.tables.length,10);
 }finally{await db.close();}
});
test('runtime role performs conversations, tickets, staff events and knowledge CRUD without DDL/ledger access',async()=>{
 const {db,client}=await fixture();try{
  await migrate(client,{files:[file]});await db.exec('SET ROLE unilus_backend');
  await db.exec("INSERT INTO chat_sessions VALUES('synthetic-owner','user:synthetic','now','later');INSERT INTO conversations(session_id,role,content)VALUES('synthetic-owner','user','hello');INSERT INTO feedback(session_id,rating)VALUES('synthetic-owner','up');INSERT INTO tickets(ticket_ref,session_id,question,summary,history_json,category,priority,department)VALUES('UNI-2099-0002','synthetic-owner','second','summary','[]','General','Low','Academic Office');INSERT INTO ticket_events(ticket_ref,kind,body,actor,visibility,created_at)VALUES('UNI-2099-0002','reply','synthetic reply','synthetic-staff','student','now');INSERT INTO ticket_assignments VALUES('UNI-2099-0002','Academic Office','synthetic-staff');UPDATE tickets SET status='In Progress' WHERE ticket_ref='UNI-2099-0002';INSERT INTO staff_answers(question,answer)VALUES('new synthetic question','new synthetic answer');INSERT INTO knowledge_records VALUES('synthetic-vector','{}');UPDATE knowledge_records SET payload='{" + '"synthetic":true' + "}' WHERE id='synthetic-vector';INSERT INTO managed_documents VALUES('synthetic-document','synthetic.txt','version/file','restricted',NULL,1,'now');DELETE FROM knowledge_records WHERE id='synthetic-vector';SELECT count(*) FROM tickets;SELECT count(*) FROM staff_answers;");
  for(const statement of ['SELECT * FROM schema_migrations','CREATE TABLE public.forbidden(id int)','TRUNCATE conversations'])await assert.rejects(db.exec(statement),e=>e.code==='42501');
  await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('anon and authenticated cannot read/write any app table, ledger or serial sequence',async()=>{
 const {db,client}=await fixture();try{
  await migrate(client,{files:[file]});
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   for(const t of [...CORE,'chat_sessions','ticket_events','ticket_assignments','knowledge_records','managed_documents','schema_migrations'])await assert.rejects(db.exec('SELECT * FROM '+t),e=>e.code==='42501');
   await assert.rejects(db.exec("INSERT INTO conversations(session_id,role,content)VALUES('forbidden','user','no')"),e=>e.code==='42501');
   await assert.rejects(db.exec("SELECT nextval('conversations_id_seq')"),e=>e.code==='42501');await db.exec('RESET ROLE');
  }
 }finally{await db.close();}
});
test('duplicate active tickets refuse migration without deleting or merging records',async()=>{
 const {db,client}=await fixture();try{
  await db.exec("INSERT INTO tickets(ticket_ref,session_id,question,summary,history_json,category,priority,department)SELECT 'UNI-2099-0003',session_id,upper(question),summary,history_json,category,priority,department FROM tickets LIMIT 1");
  await assert.rejects(migrate(client,{files:[file]}),/DUPLICATE_ACTIVE_TICKETS/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM tickets')).rows[0].n,2);
  assert.equal((await db.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name,null);
 }finally{await db.close();}
});
test('SQL failure after new table creation rolls back tables, grants, policies and original changes',async()=>{
 const {db,client}=await fixture();try{
  const before=await inspect(client);
  await assert.rejects(migrate(client,{files:[{...file,sql:sql+'\nSELECT missing_column FROM public.tickets;'}]}));
  const after=await inspect(client);assert.deepEqual(after.counts,before.counts);assert.deepEqual(after.grants,before.grants);assert.deepEqual(after.policies,before.policies);
  assert.equal((await db.query("SELECT to_regclass('public.chat_sessions') AS name")).rows[0].name,null);
 }finally{await db.close();}
});
test('backup drift, core drift and changed applied checksum refuse without damaging ledger',async()=>{
 const {db,client}=await fixture();try{
  const before=await inspect(client);
  await assert.rejects(migrate(client,{files:[file],backupFingerprints:{...before.fingerprints,tickets:'changed'}}),/DATA_CHANGED_SINCE_BACKUP/);
  await migrate(client,{files:[file]});await assert.rejects(migrate(client,{files:[{...file,sql:sql+'\n-- changed'}]}),/MIGRATION_CHECKSUM_CHANGED/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,1);
  await db.exec('ALTER TABLE conversations ADD COLUMN unexpected text');await assert.rejects(migrate(client,{files:[file]}),/CORE_SCHEMA_DRIFT/);
 }finally{await db.close();}
});
test('logical backup encryption detects tampering and recovery SQL restores synthetic schema/data/sequences',async()=>{
 const {db,client}=await fixture();let recovery;try{
  const snapshot=await backup.capture(client),sealed=backup.seal(snapshot,b=>Buffer.from(b));
  const opened=backup.open(sealed.envelope,b=>Buffer.from(b));assert.equal(opened.payloadSha256,sealed.payloadSha256);
  const corrupt=structuredClone(sealed.envelope);const bytes=Buffer.from(corrupt.ciphertext,'base64');bytes[0]^=1;corrupt.ciphertext=bytes.toString('base64');assert.throws(()=>backup.open(corrupt,b=>Buffer.from(b)));
  recovery=new PGlite();await recovery.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');await recovery.exec(opened.snapshot.restoreSql);
  for(const t of CORE){const original=(await db.query('SELECT * FROM '+t+' ORDER BY id')).rows;assert.deepEqual((await recovery.query('SELECT * FROM '+t+' ORDER BY id')).rows,original);}
  assert.equal((await recovery.query("SELECT nextval('conversations_id_seq')::int AS n")).rows[0].n,2);
 }finally{if(recovery)await recovery.close();await db.close();}
});

test('same-row-count data mutation in a proposed migration is detected and rolled back',async()=>{
 const {db,client}=await fixture();try{
  await assert.rejects(migrate(client,{files:[{...file,sql:sql+"\nUPDATE conversations SET content='forbidden change';"}]}),/ORIGINAL_CONTENT_CHANGED/);
  assert.equal((await db.query('SELECT content FROM conversations')).rows[0].content,"Synthetic O'Brien enquiry");
  assert.equal((await db.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name,null);
 }finally{await db.close();}
});

test('migration CLI refuses without explicit approval before reading private config or connecting',()=>{
 const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,[path.join(__dirname,'../scripts/migrate.js')],{env:{...process.env,APPROVED_MIGRATION:'',APPROVED_PROJECT_REF:''},encoding:'utf8',windowsHide:true});assert.equal(r.status,1);assert.match(r.stderr,/EXPLICIT_APPROVAL_AND_BACKUP_REQUIRED/);
});

test('an incompatible pre-existing integration table is not silently accepted or destroyed',async()=>{
 const {db,client}=await fixture();try{
  await db.exec('CREATE TABLE knowledge_records(id text PRIMARY KEY,payload integer NOT NULL)');
  await assert.rejects(migrate(client,{files:[file]}),/INTEGRATION_SCHEMA_DRIFT/);
  assert.equal((await db.query("SELECT data_type FROM information_schema.columns WHERE table_name='knowledge_records' AND column_name='payload'")).rows[0].data_type,'integer');
  assert.equal((await db.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name,null);
 }finally{await db.close();}
});

test('old encrypted backups stay recoverable but cannot authorize a fresh migration',async()=>{
 const {db,client}=await fixture();const os=require('node:os');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unilus-backup-test-'));
 try{
  const snapshot=await backup.capture(client);snapshot.metadata.capturedAt=new Date(Date.now()-48*3600000).toISOString();
  const sealed=backup.seal(snapshot,b=>Buffer.from(b)),bytes=Buffer.from(JSON.stringify(sealed.envelope));fs.writeFileSync(path.join(dir,'backup.json'),bytes);
  const m={project:snapshot.metadata.project,verified:true,capturedAt:snapshot.metadata.capturedAt,encryptedFile:'backup.json',encryptedSha256:backup.sha256(bytes),payloadSha256:sealed.payloadSha256,tableCounts:snapshot.metadata.counts,tableFingerprints:snapshot.metadata.fingerprints};const file=path.join(dir,'manifest.json');fs.writeFileSync(file,JSON.stringify(m));
  const {verifyBackup}=require('../services/migrationService');const recover=e=>backup.open(e,b=>Buffer.from(b));
  assert.throws(()=>verifyBackup(file,{recover}),/FRESH_VERIFIED_BACKUP_REQUIRED/);
  assert.deepEqual(verifyBackup(file,{requireFresh:false,recover}).tableCounts,m.tableCounts);
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('production readiness accepts the restricted role and rejects privileged migration identity',async()=>{
 const {db,client}=await fixture();try{
  await migrate(client,{files:[file]});
  const facade={get:async(s,p)=>(await client.query(s,p)).rows[0],all:async(s,p)=>(await client.query(s,p)).rows};
  const {verifyRuntime}=require('../services/runtimePermissionService');await assert.rejects(verifyRuntime(facade),/Dedicated restricted/);
  await db.exec('SET ROLE unilus_backend');await verifyRuntime(facade);await db.exec('RESET ROLE');
 }finally{await db.close();}
});

test('changed review hash refuses before private configuration or backup is read',()=>{
 const {spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,[path.join(__dirname,'../scripts/migrate.js'),'--env','does-not-exist','--backup-manifest','does-not-exist'],{env:{...process.env,APPROVED_MIGRATION:'yes',APPROVED_PROJECT_REF:'qhnspcstqvazxkqshuir',APPROVED_MIGRATION_SHA256:'0'.repeat(64)},encoding:'utf8',windowsHide:true});assert.equal(r.status,1);assert.match(r.stderr,/MIGRATION_REVIEW_HASH_CHANGED/);assert.ok(!r.stderr.includes('ENOENT'));
});

test('reviewed permission-containment rollback preserves all original and new data',async()=>{
 const {db,client}=await fixture();try{
  const before=await inspect(client);await migrate(client,{files:[file]});
  await db.exec("INSERT INTO knowledge_records VALUES('keep-this-new-record','{}')");
  await db.exec(fs.readFileSync(path.join(__dirname,'../../deployment/rollback-permissions.sql'),'utf8'));
  const after=await inspect(client);for(const t of CORE)assert.equal(after.fingerprints[t],before.fingerprints[t]);
  assert.equal(after.counts.knowledge_records,1);assert.equal(after.counts.schema_migrations,1);
  await db.exec('SET ROLE anon');assert.equal((await db.query('SELECT * FROM conversations')).rows.length,0);await db.exec('RESET ROLE');
  await db.exec('SET ROLE unilus_backend');await assert.rejects(db.exec('SELECT * FROM knowledge_records'),e=>e.code==='42501');await db.exec('RESET ROLE');
 }finally{await db.close();}
});

test('exact nullable developer extensions survive all feature migrations and recovery without exposing or rewriting legacy values',async()=>{const {db,client}=await fixture();try{const {LEGACY_COLUMNS}=require('../services/migrationService');for(const [t,cols]of Object.entries(LEGACY_COLUMNS))for(const [n,type]of Object.entries(cols))await db.exec('ALTER TABLE '+t+' ADD COLUMN '+n+' '+type);await db.exec("UPDATE tickets SET student_email='synthetic@example.test',student_phone='+260970000001',student_username='synthetic-owner',contact_status='provided',resolved_notified_at='2099';UPDATE feedback SET question='Synthetic question',answer='Synthetic answer',reason='Synthetic reason',audience='guest',reviewed=1");const before=await inspect(client);checkCore(before);const files=fs.readdirSync(path.join(__dirname,'../migrations')).filter(n=>n.endsWith('.sql')).sort().map(name=>({name,sql:fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8')}));await migrate(client,{files,backupCounts:before.counts,backupFingerprints:before.fingerprints});const after=await inspect(client);for(const t of CORE)assert.equal(after.fingerprints[t],before.fingerprints[t]);assert.equal(after.counts.schema_migrations,7);const snapshot=await backup.capture(client,{integrated:true});assert.equal((await require('../services/rehearsePortableBackup').rehearseSnapshot(snapshot)).verified,true);const clone=()=>structuredClone(before);for(const mutate of [r=>r.columns.find(c=>c.table_name==='tickets'&&c.name==='student_email').type='integer',r=>r.columns.find(c=>c.name==='reviewed').not_null=true,r=>r.columns.find(c=>c.name==='reviewed').default_expression='0',r=>r.columns.find(c=>c.name==='reviewed').identity='a',r=>r.columns.find(c=>c.name==='reviewed').generated='s',r=>r.columns.splice(r.columns.findIndex(c=>c.name==='reviewed'),1),r=>r.columns.push({...r.columns.find(c=>c.name==='reviewed'),name:'unknown_column'}),r=>r.tables.find(t=>t.name==='tickets').owner='unilus_backend',r=>r.triggers.push({table_name:'tickets',name:'unexpected'})]){const r=clone();mutate(r);assert.throws(()=>checkCore(r),/DRIFT|TRIGGER/);}await db.exec('CREATE VIEW unreviewed_contact_dependency AS SELECT student_email FROM tickets');await assert.rejects(migrate(client,{files}),/UNREVIEWED_LEGACY_DEPENDENCY/);assert.equal((await inspect(client)).counts.schema_migrations,7);}finally{await db.close();}});
