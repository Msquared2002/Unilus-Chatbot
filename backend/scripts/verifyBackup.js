const fs=require('node:fs'),path=require('node:path');
const {verifyBackup}=require('../services/migrationService');
const {open}=require('../services/logicalBackup');
const args=process.argv.slice(2),option=k=>args[args.indexOf(k)+1];
try{
 if(!args.includes('--manifest'))throw Error('Manifest required');
 // Old backups remain recoverable; only migration authorization requires freshness.
 const file=option('--manifest'),m=verifyBackup(file,{requireFresh:false});
 if(args.includes('--export-private-sql')){
  if(process.env.APPROVED_PRIVATE_RECOVERY_EXPORT!=='yes')throw Error('Explicit private plaintext recovery export approval required');
  const out=path.resolve(option('--export-private-sql')),repo=path.resolve(__dirname,'../..');
  if(!path.relative(repo,out).startsWith('..'))throw Error('Recovery SQL must stay outside repository');
  const recovered=open(JSON.parse(fs.readFileSync(path.join(path.dirname(file),m.encryptedFile),'utf8')));
  fs.writeFileSync(out,recovered.snapshot.restoreSql,{flag:'wx',mode:0o600});
 }
 console.log(JSON.stringify({verified:true,project:m.project,tableCounts:m.tableCounts,plaintextExported:args.includes('--export-private-sql')}));
}catch(e){console.error(JSON.stringify({event:'backup_verification_failed',code:e.code||'VALIDATION_FAILED'}));process.exitCode=1;}
