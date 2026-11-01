const test=require('node:test'); const assert=require('node:assert/strict');
const fs=require('node:fs'); const path=require('node:path');
const core=require('../../dummy-environment/campus-survey-core');
const {clean,simplify,processPackages}=require('../services/campusSurveyProcessor');
const {prepare}=require('../scripts/promoteCampusSurvey');
const os=require('node:os');
const data=path.resolve(__dirname,'../data/campus');
const boundary=JSON.parse(fs.readFileSync(path.join(data,'campus_boundary.json')));
const catalog=JSON.parse(fs.readFileSync(path.join(data,'campus_place_catalog.json')));
const base=[28.469,-15.355];
const p=(lng,lat,accuracy_m=5)=>({lng,lat,accuracy_m,timestamp:'2026-10-11T10:00:00Z'});
function pkg(coords=[base,[28.4691,-15.355],[28.4692,-15.355]]){
  const state={session_id:'test',walkways:[{id:'survey_walkway_test',kind:'footway',surveyed_at:'2026-10-11T10:00:00Z',note:'',
    points:coords.map(c=>p(...c)),raw_samples:[{...p(...base,40),decision:'poor_accuracy'}]}],access_points:[]};
  return core.exportPackage(state);
}
const options={boundary,buildings:[],placeIds:new Set(catalog.places.map(x=>x.id))};
test('survey exports valid LineString GeoJSON and retains raw poor readings',()=>{
  const x=pkg();assert.equal(x.walkways.type,'FeatureCollection');assert.equal(x.walkways.features[0].geometry.type,'LineString');
  assert.equal(x.walkways.features[0].properties.raw_samples[0].accuracy_m,40);
  assert.equal(core.accept(p(28.469,-15.355,40),null),'poor_accuracy');
});
test('entrance representative uses best three readings and canonical ID is checked',()=>{
  const fix=core.representative([p(28.469,-15.355,20),p(28.46901,-15.355,5),p(28.46902,-15.355,6),p(28.46903,-15.355,7)]);
  assert.equal(fix.best_accuracy_m,5);assert.equal(fix.sample_count,4);
  const x=pkg();x.access_points=[{id:'entrance_1',place_id:'unknown',lat:fix.lat,lng:fix.lng,accuracy_m:5}];
  assert.match(processPackages([x],options).errors.join(),/Invalid or duplicate access point/);
  x.access_points[0].place_id=catalog.places[0].id;
  assert.equal(processPackages([x],options).access_points.length,1);
});
test('stationary cleanup and conservative simplification preserve bends',()=>{
  const coords=[base,[28.469000001,-15.355],[28.4691,-15.355],[28.4691,-15.35495],[28.4692,-15.35495]];
  assert.equal(clean(coords).length,4);assert.ok(simplify(clean(coords)).length>=4);
});
test('near endpoints snap, boundary exit and building crossing warn',()=>{
  const x=pkg();const y=pkg([[28.469201,-15.355],[28.4693,-15.355]]);
  y.walkways.features[0].properties.id='survey_walkway_2';
  const result=processPackages([x,y],options);
  assert.match(result.warnings.join(),/endpoint snapped/);
  const exit=pkg([[28.469,-15.355],[28.48,-15.355]]);
  assert.match(processPackages([exit],options).warnings.join(),/boundary exit/);
  const building={id:'test',name:'Test building',geometry:{type:'Polygon',coordinates:[[[28.46905,-15.35505],[28.46915,-15.35505],[28.46915,-15.35495],[28.46905,-15.35495],[28.46905,-15.35505]]]}};
  assert.match(processPackages([x],{...options,buildings:[building]}).warnings.join(),/building crossing/);
});
test('overlap flags repeat trace and review never modifies production files',()=>{
  const walks=path.join(data,'campus_walkways.geojson'),access=path.join(data,'campus_access_points.json');
  const before=[fs.readFileSync(walks,'utf8'),fs.readFileSync(access,'utf8')];
  const x=pkg(),y=pkg();y.walkways.features[0].properties.id='survey_walkway_2';
  const result=processPackages([x,y],options);
  assert.match(result.warnings.join(),/overlapping traces/);
  assert.match(result.warnings.join(),/poor GPS readings/);
  assert.deepEqual([fs.readFileSync(walks,'utf8'),fs.readFileSync(access,'utf8')],before);
});
test('production promotion refuses a review without explicit approval',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'campus-survey-test-'));
  try { fs.writeFileSync(path.join(dir,'review.json'),JSON.stringify({status:'pending'}));
    assert.throws(()=>prepare(dir),/status to approved/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
