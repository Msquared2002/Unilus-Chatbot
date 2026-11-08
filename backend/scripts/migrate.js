// Explicit operator command only; never called by server startup.
const fs=require('node:fs'),path=require('node:path'),{Client}=require('pg');
const {configuration,PROJECT}=require('../services/postgresOperations');
const {verifyBackup,migrate,bundleHash}=require('../services/migrationService');
async function main(){
 const args=process.argv.slice(2),option=k=>args[args.indexOf(k)+1];
 if(process.env.APPROVED_MIGRATION!=='yes'||process.env.APPROVED_PROJECT_REF!==PROJECT||!/^[a-f0-9]{64}$/.test(process.env.APPROVED_MIGRATION_SHA256||'')||!args.includes('--env')||!args.includes('--backup-manifest'))throw Error('EXPLICIT_APPROVAL_AND_BACKUP_REQUIRED');
 const dir=path.join(__dirname,'../migrations');
 const files=fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort().map(name=>({name,sql:fs.readFileSync(path.join(dir,name),'utf8')}));
 if(bundleHash(files)!==process.env.APPROVED_MIGRATION_SHA256)throw Error('MIGRATION_REVIEW_HASH_CHANGED');
 const backup=verifyBackup(option('--backup-manifest'));
 const {options}=configuration(option('--env'),{migration:true});
 const client=new Client(options);
 try{await client.connect();console.log(JSON.stringify({migrated:true,...await migrate(client,{files,backupCounts:backup.tableCounts,backupFingerprints:backup.tableFingerprints})}));}finally{await client.end().catch(()=>{});}
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({event:'migration_refused_or_rolled_back',code:e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'REVIEW_REQUIRED')}));process.exitCode=1;});
module.exports={main};
