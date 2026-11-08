const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('production frontend requires an explicit credential-free HTTPS endpoint and emits only that public value',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unilus-public-config-'));
 try{
  fs.mkdirSync(path.join(dir,'dummy-environment/js'),{recursive:true});
  const script=path.join(__dirname,'../../scripts/configureFrontend.cjs');
  const run=value=>spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,NETLIFY:'true',NODE_ENV:'production',PUBLIC_API_BASE:value,SUPABASE_STORAGE_KEY:'synthetic-server-secret'},stdio:'pipe'});
  for(const value of ['', 'http://synthetic.invalid/api','https://user:password@synthetic.invalid/api','https://synthetic.invalid/api?token=private'])assert.notEqual(run(value).status,0);
  assert.equal(run('https://synthetic.invalid/api').status,0);
  const output=fs.readFileSync(path.join(dir,'dummy-environment/js/runtime-config.js'),'utf8');
  assert.ok(output.includes('https://synthetic.invalid/api'));assert.ok(!output.includes('synthetic-server-secret'));
 }finally{if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unexpected cleanup path');fs.rmSync(dir,{recursive:true,force:true});}
});
