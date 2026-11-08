const fs = require('node:fs'), path = require('node:path');
const { storageHeaders } = require('../services/storageCredentials');
const { PROJECT, readOnly } = require('../services/postgresOperations');
async function main() {
 if (process.env.APPROVED_STORAGE_PROJECT !== PROJECT) throw Error('Explicit approval required');
 const repo = path.resolve(__dirname, '../..'), plan = require('../../deployment/storage-plan.json');
 const env = require('dotenv').parse(fs.readFileSync('C:/UNILUS-secrets/runtime.env'));
 if (env.SUPABASE_URL !== 'https://' + PROJECT + '.supabase.co' || env.SUPABASE_DOCUMENT_BUCKET !== 'unilus-private-documents' || !env.SUPABASE_STORAGE_KEY?.startsWith('sb_secret_')) throw Error('Server configuration required');
 if (plan.public !== false || plan.fileSizeLimit !== 26214400 || plan.bucket !== env.SUPABASE_DOCUMENT_BUCKET || plan.allowedMimeTypes.length !== 4) throw Error('Plan changed');
 const policies = await readOnly('C:/UNILUS-secrets/backend.env', async client => (await client.query("SELECT policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects'")).rows);
 // Existing policies need review rather than assuming they exclude the new bucket.
 if (policies.length) throw Error('Existing object policies require review');
 const endpoint = env.SUPABASE_URL + '/storage/v1/bucket', headers = storageHeaders(env.SUPABASE_STORAGE_KEY);
 let response = await fetch(endpoint + '/' + plan.bucket, { headers, signal: AbortSignal.timeout(15000) });
 let created = false;
 if (response.status === 404 || response.status === 400) {
   const list = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
   if (!list.ok) throw Error('Bucket list unavailable');
   if ((await list.json()).some(b => b.name === plan.bucket)) throw Error('Existing bucket could not be verified');
   response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
     body: JSON.stringify({ id: plan.bucket, name: plan.bucket, public: false, file_size_limit: plan.fileSizeLimit, allowed_mime_types: plan.allowedMimeTypes }), signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw Error('Bucket creation rejected');
   created = true;
   response = await fetch(endpoint + '/' + plan.bucket, { headers, signal: AbortSignal.timeout(15000) });
 }
 if (!response.ok) throw Error('Bucket verification unavailable');
 const bucket = await response.json();
 if (bucket.public !== false || Number(bucket.file_size_limit) !== plan.fileSizeLimit || JSON.stringify([...bucket.allowed_mime_types].sort()) !== JSON.stringify([...plan.allowedMimeTypes].sort())) throw Error('Bucket restrictions mismatch');
 const result = { project: PROJECT, created, bucketVerified: true, bucket: plan.bucket, public: false, fileSizeLimit: bucket.file_size_limit,
  allowedMimeTypes: bucket.allowed_mime_types, objectPolicies: policies.length, serverCredentialVerified: true, browserGrantsAdded: false };
 fs.writeFileSync(path.join(repo, 'deployment/storage-creation-2026-11-08.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
main().catch(e => { console.error(JSON.stringify({ event: 'storage_setup_stopped', code: e.code || 'CONFIGURATION_OR_VERIFICATION_FAILED' })); process.exitCode = 1; });
