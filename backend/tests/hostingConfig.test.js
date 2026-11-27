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

test('public and student pages omit demonstration disclaimer copy', () => {
  for (const page of ['index.html', 'website.html', 'portal-login.html', 'portal.html', 'offline.html']) {
    const html = fs.readFileSync(path.join(__dirname, '../../dummy-environment', page), 'utf8');
    assert.doesNotMatch(html, /demonstration notice|independent (?:UNILUS AI )?demonstration|never enter (?:a )?(?:real|genuine) university passwords?|never enter a real UNILUS portal password/i, page);
  }
});

test('deployed advisor works without generated ingestion chunks',()=>{
 const script=`const Module=require('module'),original=Module._load;Module._load=function(id,...args){if(/data[\\\\/]documents[\\\\/]chunks\\.json$/.test(id))throw Error('Generated chunks are absent in a clean deployment');return original.call(this,id,...args)};const advisor=require('./services/programmeAdvisorService');const answer=advisor.tryAnswer('Help me choose a university programme','packaging-test');if(!answer?.queryType?.isProgrammeAdvisor||!answer.answer)throw Error('Advisor did not respond');`;
 const run=spawnSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
});
