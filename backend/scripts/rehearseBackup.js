// Recovery rehearsal ONLY in PGlite memory. No URL argument, pg Client, app or network connection.
// Private records remain in memory; output contains counts/verification flags only.
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {verifyBackup}=require('../services/migrationService');
const {open}=require('../services/logicalBackup');
const {CORE,ident}=require('../services/postgresOperations');
async function main(){
 const args=process.argv.slice(2);if(!args.includes('--manifest'))throw Error('Manifest required');
 const file=args[args.indexOf('--manifest')+1],m=verifyBackup(file,{requireFresh:false});
 const {snapshot}=open(JSON.parse(fs.readFileSync(path.join(path.dirname(file),m.encryptedFile),'utf8')));
 const db=new PGlite();
 try{
  const roleNames=new Set(snapshot.metadata.grants.filter(g=>CORE.includes(g.table_name)).map(g=>g.grantee));
  for(const r of roleNames)if(!['PUBLIC','postgres'].includes(r))await db.exec('CREATE ROLE '+ident(r)+' NOLOGIN');
  await db.exec(snapshot.restoreSql);
  for(const t of CORE){
   const row=(await db.query("SELECT count(*)::int AS n,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM public."+ident(t)+' t')).rows[0];
   if(row.n!==m.tableCounts[t]||row.digest!==m.tableFingerprints[t])throw Error('Recovery data mismatch');
   const columns=(await db.query("SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum",[t])).rows;
   const expected=snapshot.metadata.columns.filter(c=>c.table_name===t).map(({name,type,not_null})=>({name,type,not_null}));
   if(JSON.stringify(columns)!==JSON.stringify(expected))throw Error('Recovery schema mismatch');
  }
  console.log(JSON.stringify({rehearsed:true,engine:'local in-memory PGlite PostgreSQL 18',remoteConnectionOpened:false,tableCounts:m.tableCounts,allCoreContentFingerprintsMatched:true,columnTypesAndNullabilityMatched:true,plaintextFilesWritten:false}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'private_recovery_rehearsal_failed',code:e.code||'VALIDATION_FAILED'}));process.exitCode=1;});
