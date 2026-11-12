// Explicit operator staging/acceptance command. Never invoked by a scraper or student request.
const fs=require('node:fs');
async function main(){
 const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
 if(!args.includes('--accept-complete')||!args.includes('--source-validated')||!get('--file')||!get('--period')||!get('--expected-previous')||!get('--source'))throw Error('Explicit acceptance, source validation, period and expected previous ID (or none) are required');
 const service=require('../services/timetableNotificationService');
 const result=await service.publish(JSON.parse(fs.readFileSync(get('--file'),'utf8')),{complete:true,sourceValidated:true,period:get('--period'),source:get('--source'),expectedPrevious:get('--expected-previous')==='none'?null:get('--expected-previous'),reviewedRemovals:args.includes('--reviewed-removals')});
 console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>require('../services/db').close());
module.exports={main};
