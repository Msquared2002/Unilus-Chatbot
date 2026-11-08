const {storageHeaders}=require('../services/storageCredentials');
// GET-only configuration verification. No app import, bucket creation or object operations.
const fs=require('node:fs'),{PROJECT}=require('../services/postgresOperations');
const args=process.argv.slice(2),option=k=>args[args.indexOf(k)+1];
(async()=>{
 if(!args.includes('--env'))throw Error('Private environment required');
 const env=require('dotenv').parse(fs.readFileSync(option('--env')));
 if(!env.SUPABASE_URL||!env.SUPABASE_STORAGE_KEY||!env.SUPABASE_DOCUMENT_BUCKET){console.log(JSON.stringify({configured:false,missing:['SUPABASE_URL','SUPABASE_STORAGE_KEY','SUPABASE_DOCUMENT_BUCKET'].filter(k=>!env[k]),remoteWrite:false}));return;}
 if(env.SUPABASE_URL.replace(/\/$/,'')!=='https://'+PROJECT+'.supabase.co')throw Error('Wrong Storage project');
 const response=await fetch(env.SUPABASE_URL+'/storage/v1/bucket/'+encodeURIComponent(env.SUPABASE_DOCUMENT_BUCKET),{method:'GET',headers:storageHeaders(env.SUPABASE_STORAGE_KEY),signal:AbortSignal.timeout(10000)});
 if(!response.ok){console.log(JSON.stringify({configured:true,bucketVerified:false,httpStatus:response.status,remoteWrite:false}));return;}
 const bucket=await response.json();console.log(JSON.stringify({configured:true,bucketVerified:bucket.public===false,private:bucket.public===false,fileSizeLimit:bucket.file_size_limit,allowedMimeTypes:bucket.allowed_mime_types,remoteWrite:false}));
})().catch(e=>{console.error(JSON.stringify({event:'storage_preflight_failed',code:e.code||'CONFIGURATION_OR_HTTP_ERROR'}));process.exitCode=1;});
