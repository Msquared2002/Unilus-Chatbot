const test=require('node:test'); const assert=require('node:assert/strict');
const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const core=require('../../dummy-environment/campus-survey-core');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('offline Android bundle lists all survey assets and canonical data',()=>{
  const build=read('android-survey/app/build.gradle');
  for(const name of ['campus-survey.html','campus-survey.js','campus-survey-core.js','campus_boundary.json',
    'campus_buildings.json','campus_places.json','campus_routing_graph.json','campus_place_catalog.json'])
    assert.ok(build.includes(name),`${name} is not bundled`);
  const catalog=JSON.parse(read('backend/data/campus/campus_place_catalog.json'));
  assert.equal(catalog.places.length,23);
  assert.equal(new Set(catalog.places.map(p=>p.id)).size,23);
  const activity=read('android-survey/app/src/main/java/zm/ac/unilus/silverestsurvey/MainActivity.java');
  assert.match(activity,/appassets\.androidplatform\.net/);
  assert.match(activity,/getAssets\(\)\.open/);
  assert.doesNotMatch(read('android-survey/app/src/main/AndroidManifest.xml'),/android\.permission\.INTERNET|ACCESS_BACKGROUND_LOCATION/);
});
test('saved active survey restores paused and export schema remains processor compatible',()=>{
  const memory=new Map(),store={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)};
  const state={session_id:'survey_1',walkways:[],access_points:[],active:{mode:'recording',points:[],raw_samples:[]}};
  core.persist(store,'survey',state); const restored=core.restore(store,'survey');
  assert.equal(restored.active.mode,'paused');
  const output=core.exportPackage({...restored,active:null});
  assert.equal(output.schema_version,1);assert.equal(output.walkways.type,'FeatureCollection');
  assert.ok(Array.isArray(output.access_points));
  assert.equal(core.exportFilename(new Date('2026-10-11T12:00:00Z'),1),'silverest-survey-2026-10-11-01.json');
});
test('Android export bridge uses document picker and foreground-only wake flag',()=>{
  const activity=read('android-survey/app/src/main/java/zm/ac/unilus/silverestsurvey/MainActivity.java');
  const js=read('dummy-environment/campus-survey.js');
  assert.match(activity,/ACTION_CREATE_DOCUMENT/);assert.match(activity,/ACTION_SEND/);
  assert.match(activity,/FLAG_KEEP_SCREEN_ON/);assert.match(activity,/onPause\(\)/);
  assert.match(js,/AndroidSurvey\.exportSurvey\(filename, json\)/);
  assert.match(js,/pauseForBackground/);
});
