const fs=require('node:fs'),path=require('node:path');
const {CORE,APPLICATION,PROJECT,ident,inspect}=require('./postgresOperations');
const {sha256,open}=require('./logicalBackup');
const CORE_COLUMNS={conversations:'id session_id role content created_at',feedback:'id session_id rating comment created_at',staff_answers:'id question answer visibility active times_used source_ticket created_at updated_at',tickets:'id ticket_ref session_id question summary history_json category priority department contact_id status created_at updated_at'};
// Existing developer-owned production extensions, verified 2026-11-12. They are
// retained untouched; new private support data continues in ticket_support_details.
const LEGACY_COLUMNS={feedback:{question:'text',answer:'text',reason:'text',audience:'text',reviewed:'integer'},tickets:{student_email:'text',student_phone:'text',contact_status:'text',student_username:'text',resolved_notified_at:'text'}};
function checkCore(report){
 for(const t of CORE){
  const all=report.columns.filter(c=>c.table_name===t),legacy=all.filter(c=>Object.hasOwn(LEGACY_COLUMNS[t]||{},c.name));
  if(legacy.length&&(legacy.length!==Object.keys(LEGACY_COLUMNS[t]).length||report.tables.find(r=>r.name===t)?.owner!=='postgres'||legacy.some(c=>c.type!==LEGACY_COLUMNS[t][c.name]||c.not_null||c.default_expression!==null||c.identity||c.generated)))throw Error('LEGACY_EXTENSION_SCHEMA_DRIFT');
  const columns=all.filter(c=>!legacy.includes(c));
  if(columns.map(c=>c.name).sort().join()!==CORE_COLUMNS[t].split(' ').sort().join())throw Error('CORE_SCHEMA_DRIFT');
  for(const c of columns){const integer=['id','active','times_used'].includes(c.name);const nullable=['ticket_ref','contact_id','source_ticket','comment'].includes(c.name)||t==='feedback'&&c.name==='session_id';if(c.type!==(integer?'integer':'text')||c.not_null===nullable||c.identity||c.generated)throw Error('CORE_SCHEMA_DRIFT');
   const d=c.default_expression;
   if(c.name==='id'?!/^nextval\(/.test(d||''):['created_at','updated_at'].includes(c.name)?!(/to_char/.test(d||'')&&/now\(\)/.test(d||'')&&/utc/.test(d||'')):c.name==='active'?d!=='1':c.name==='times_used'?d!=='0':c.name==='visibility'?!/^'student'::text$/.test(d||''):c.name==='status'?!/^'Open'::text$/.test(d||''):d!==null)throw Error('CORE_DEFAULT_DRIFT');
  }
  if(!report.constraints.some(c=>c.table_name===t&&c.type==='p'&&c.definition==='PRIMARY KEY (id)'))throw Error('CORE_KEY_DRIFT');
  if(report.constraints.some(c=>c.table_name===t&&!['p','u','n'].includes(c.type)))throw Error('UNREVIEWED_CORE_CONSTRAINT');
 }
 if(report.triggers?.some(t=>CORE.includes(t.table_name)))throw Error('UNREVIEWED_CORE_TRIGGER');
 if(!report.constraints.some(c=>c.table_name==='tickets'&&c.type==='u'&&c.definition==='UNIQUE (ticket_ref)'))throw Error('TICKET_KEY_DRIFT');
 if(report.duplicateActiveTicketGroups)throw Error('DUPLICATE_ACTIVE_TICKETS');
 if(report.policies.some(p=>APPLICATION.concat('schema_migrations').includes(p.table_name)&&p.name!=='unilus_backend_access'))throw Error('UNREVIEWED_POLICY');
}
function verifyBackup(file,{now=Date.now(),requireFresh=true,recover=open}={}){
 const m=JSON.parse(fs.readFileSync(file,'utf8')),at=Date.parse(m.capturedAt);
 if(m.project!==PROJECT||m.verified!==true||!Number.isFinite(at)||(requireFresh&&now-at>24*3600000)||at>now)throw Error('FRESH_VERIFIED_BACKUP_REQUIRED');
 if(path.basename(m.encryptedFile)!==m.encryptedFile)throw Error('INVALID_BACKUP_PATH');
 const bytes=fs.readFileSync(path.join(path.dirname(file),m.encryptedFile));
 if(sha256(bytes)!==m.encryptedSha256)throw Error('BACKUP_HASH_MISMATCH');
 const recovered=recover(JSON.parse(bytes));
 if(recovered.payloadSha256!==m.payloadSha256||recovered.snapshot.metadata.project!==PROJECT||CORE.some(t=>m.tableCounts[t]!==recovered.snapshot.metadata.counts[t]||!m.tableFingerprints?.[t]||m.tableFingerprints[t]!==recovered.snapshot.metadata.fingerprints[t]))throw Error('BACKUP_MANIFEST_MISMATCH');
 return m;
}
async function checkSecurity(client){
 const names=APPLICATION.concat('schema_migrations');
 const expected={chat_sessions:'id owner created_at expires_at',ticket_events:'id ticket_ref kind body actor visibility created_at',ticket_assignments:'ticket_ref department assignee',knowledge_records:'id payload',managed_documents:'id source_name object_key access title active created_at',schema_migrations:'version checksum applied_at'};
 const columns=(await client.query("SELECT c.relname AS table_name,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped",[Object.keys(expected)])).rows;
 for(const [t,list]of Object.entries(expected)){
  const actual=columns.filter(c=>c.table_name===t);
  if(actual.map(c=>c.name).sort().join()!==list.split(' ').sort().join()||actual.some(c=>c.type!==(t==='ticket_events'&&c.name==='id'||t==='managed_documents'&&c.name==='active'?'integer':'text')||c.not_null===['assignee','title'].includes(c.name)))throw Error('INTEGRATION_SCHEMA_DRIFT');
  if(t==='ticket_events'&&!/^nextval\(/.test(actual.find(c=>c.name==='id').default_expression||''))throw Error('EVENT_SEQUENCE_DRIFT');
 }
 const keys=(await client.query("SELECT c.relname,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND x.contype='p' AND c.relname=ANY($1)",[Object.keys(expected)])).rows;
 for(const t of Object.keys(expected))if(!keys.some(k=>k.relname===t&&k.definition==='PRIMARY KEY ('+(t==='schema_migrations'?'version':t==='ticket_assignments'?'ticket_ref':'id')+')'))throw Error('INTEGRATION_KEY_DRIFT');
 const rows=(await client.query("SELECT c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) AS owner,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS user_access,has_table_privilege('unilus_backend',c.oid,'SELECT') AS rs,has_table_privilege('unilus_backend',c.oid,'INSERT') AS ri,has_table_privilege('unilus_backend',c.oid,'UPDATE') AS ru,has_table_privilege('unilus_backend',c.oid,'DELETE') AS rd,has_table_privilege('unilus_backend',c.oid,'TRUNCATE') AS rt FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) AND c.relkind='r'",[names])).rows;
 if(rows.length!==names.length||rows.some(r=>!r.relrowsecurity||r.owner==='unilus_backend'||r.anon_access||r.user_access||r.rt||[r.rs,r.ri,r.ru,r.rd].some(v=>v!==(r.relname!=='schema_migrations'))))throw Error('POST_MIGRATION_PERMISSION_CHECK_FAILED');
 if((await client.query("SELECT has_schema_privilege('unilus_backend','public','CREATE') AS allowed")).rows[0].allowed)throw Error('RUNTIME_DDL_NOT_ALLOWED');
 const policies=(await client.query("SELECT tablename,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1)",[names])).rows;
 // pg leaves name[] (OID1003) as text; PGlite returns an array. Accept only the
 // exact single approved role in either representation; never loosen policy checks.
 const approvedRoles=roles=>Array.isArray(roles)?roles.length===1&&roles[0]==='unilus_backend':roles==='{unilus_backend}';
 if(policies.length!==APPLICATION.length||policies.some(p=>p.tablename==='schema_migrations'||!approvedRoles(p.roles)||p.cmd!=='ALL'||!/^\(?true\)?$/.test(p.qual)||!/^\(?true\)?$/.test(p.with_check)))throw Error('RUNTIME_POLICY_DRIFT');
 const sequences=(await client.query("SELECT pg_get_serial_sequence(format('public.%I',c.relname),a.attname) AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND c.relname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped",[APPLICATION])).rows.filter(s=>s.name);
 for(const s of sequences){const grants=(await client.query("SELECT has_sequence_privilege('unilus_backend',$1,'USAGE') AS usage,has_sequence_privilege('unilus_backend',$1,'SELECT,UPDATE') AS excessive,has_sequence_privilege('anon',$1,'USAGE,SELECT,UPDATE') AS anon,has_sequence_privilege('authenticated',$1,'USAGE,SELECT,UPDATE') AS authenticated",[s.name])).rows[0];if(!grants.usage||grants.excessive||grants.anon||grants.authenticated)throw Error('SEQUENCE_PERMISSION_DRIFT');}
 const indexes=(await client.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'")).rows;
 const active=indexes.find(i=>i.indexname==='idx_ticket_active_question');
 if(!active||!/CREATE UNIQUE INDEX/.test(active.indexdef)||!active.indexdef.includes('session_id, lower(question)')||!active.indexdef.includes('In Progress'))throw Error('ACTIVE_TICKET_INDEX_DRIFT');
 const managed=indexes.find(i=>i.indexname==='idx_managed_active_source');if(!managed||!/CREATE UNIQUE INDEX/.test(managed.indexdef)||!managed.indexdef.includes('(source_name)')||!managed.indexdef.includes('active = 1'))throw Error('MANAGED_SOURCE_INDEX_DRIFT');
}
async function migrate(client,{files,backupCounts,backupFingerprints,inspectFn=inspect}={}){
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout='5s'");await client.query("SET LOCAL statement_timeout='60s'");
  await client.query('SET LOCAL search_path=public,pg_catalog');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('unilus-schema-migration'))");
  await client.query('LOCK TABLE '+CORE.map(t=>'public.'+ident(t)).join(',')+' IN SHARE ROW EXCLUSIVE MODE');
  const before=await inspectFn(client);checkCore(before);
  for(const [table,extensions]of Object.entries(LEGACY_COLUMNS))if(before.columns.some(c=>c.table_name===table&&Object.hasOwn(extensions,c.name))){
   const deps=await client.query("SELECT 1 FROM pg_attribute a JOIN pg_depend d ON d.refclassid='pg_class'::regclass AND d.refobjid=a.attrelid AND d.refobjsubid=a.attnum WHERE a.attrelid=$1::regclass AND a.attname=ANY($2)",['public.'+table,Object.keys(extensions)]);
   if(deps.rows.length)throw Error('UNREVIEWED_LEGACY_DEPENDENCY');
  }
  if(backupCounts&&CORE.some(t=>before.counts[t]!==backupCounts[t]))throw Error('DATA_CHANGED_SINCE_BACKUP');
  if(backupFingerprints&&CORE.some(t=>before.fingerprints[t]!==backupFingerprints[t]))throw Error('DATA_CHANGED_SINCE_BACKUP');
  await client.query("SET LOCAL unilus.migration_context='approved-v2'");
  await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)');
  for(const file of files){
   const checksum=sha256(file.sql),old=(await client.query('SELECT checksum FROM public.schema_migrations WHERE version=$1',[file.name])).rows[0];
   if(old&&old.checksum!==checksum)throw Error('MIGRATION_CHECKSUM_CHANGED');
   if(!old){await client.query(file.sql);await client.query('INSERT INTO public.schema_migrations(version,checksum,applied_at) VALUES ($1,$2,$3)',[file.name,checksum,new Date().toISOString()]);}
  }
  await checkSecurity(client);
  if(files.some(f=>f.name==='007_student_companion_enhancements.sql'))await require('./academicPublicationSchemaCheck').check(client);
  if(files.some(f=>f.name==='006_morning_brief.sql'))await require('./morningSchemaCheck').check(client);
  if(files.some(f=>f.name==='005_peer_tutors.sql'))await require('./peerTutorSchemaCheck').check(client);
  if(files.some(f=>f.name==='002_ticket_notification_reads.sql'))await require('./notificationSchemaCheck').check(client);
  if(files.some(f=>f.name==='004_digital_front_desk.sql'))await require('./frontDeskSchemaCheck').check(client);
  if(files.some(f=>f.name==='003_timetable_notifications.sql'))await require('./timetableNotificationSchemaCheck').check(client);
  for(const t of CORE)if(Number((await client.query('SELECT count(*) AS n FROM public.'+ident(t))).rows[0].n)!==before.counts[t])throw Error('ORIGINAL_ROW_COUNT_CHANGED');
  for(const t of CORE)if((await client.query("SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM public."+ident(t)+' t')).rows[0].digest!==before.fingerprints[t])throw Error('ORIGINAL_CONTENT_CHANGED');
  await client.query('COMMIT');return{preservedCounts:Object.fromEntries(CORE.map(t=>[t,before.counts[t]]))};
 }catch(e){await client.query('ROLLBACK');throw e;}
}
const bundleHash=files=>sha256(files.map(f=>f.name+'\0'+f.sql).join('\0'));
module.exports={CORE_COLUMNS,LEGACY_COLUMNS,checkCore,verifyBackup,checkSecurity,migrate,bundleHash};
