#!/usr/bin/env node
const fs=require('node:fs'); const path=require('node:path');
const {processPackages}=require('../services/campusSurveyProcessor');
const data=path.resolve(__dirname,'../data/campus');
function read(name){return JSON.parse(fs.readFileSync(path.join(data,name),'utf8'));}
function main(args=process.argv.slice(2)){
  if(!args.length) throw Error('Usage: node scripts/processCampusSurvey.js <survey1.json> [survey2.json ...]');
  const packages=args.map(file=>JSON.parse(fs.readFileSync(file,'utf8')));
  const result=processPackages(packages,{boundary:read('campus_boundary.json'),buildings:read('campus_buildings.json').buildings,
    placeIds:new Set(read('campus_place_catalog.json').places.map(p=>p.id))});
  if(result.errors.length) throw Error(result.errors.join('\n'));
  const output=path.join(data,'source','surveys',`review-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  fs.mkdirSync(output,{recursive:true});
  packages.forEach((pkg,i)=>fs.writeFileSync(path.join(output,`raw_${i+1}.json`),JSON.stringify(pkg,null,2)+'\n'));
  fs.writeFileSync(path.join(output,'processed_walkways.geojson'),JSON.stringify(result.walkways,null,2)+'\n');
  fs.writeFileSync(path.join(output,'processed_access_points.json'),JSON.stringify({access_points:result.access_points},null,2)+'\n');
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({status:'pending',input_count:packages.length,
    walkway_count:result.walkways.features.length,access_point_count:result.access_points.length,
    warnings:result.warnings,errors:result.errors,approval_note:'Review every warning and geometry; promotion requires status approved plus --approve.'},null,2)+'\n');
  console.log(output); console.log(`${result.warnings.length} review warnings`); return output;
}
if(require.main===module)main(); module.exports={main};
