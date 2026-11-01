#!/usr/bin/env node
const fs=require('node:fs'); const path=require('node:path');
const {validateSources}=require('../services/campusRoutingValidator');
const data=path.resolve(__dirname,'../data/campus');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function prepare(reviewDir){
  const review=read(path.join(reviewDir,'review.json'));
  if(review.status!=='approved')throw Error('Set review.json status to approved after inspecting geometry and warnings');
  const incoming=read(path.join(reviewDir,'processed_walkways.geojson'));
  const incomingAccess=read(path.join(reviewDir,'processed_access_points.json')).access_points;
  const existing=read(path.join(data,'campus_walkways.geojson'));
  const existingAccess=read(path.join(data,'campus_access_points.json')).access_points;
  const walkways={type:'FeatureCollection',features:[...existing.features,...incoming.features.map(f=>{
    const x=JSON.parse(JSON.stringify(f)); delete x.properties.raw_samples; delete x.properties.review_status; return x;
  })]};
  const access_points=[...existingAccess,...incomingAccess.map(a=>{const x={...a};delete x.raw_samples;delete x.review_status;return x;})];
  const boundary=read(path.join(data,'campus_boundary.json'));
  const buildings=read(path.join(data,'campus_buildings.json')).buildings;
  const placeIds=new Set(read(path.join(data,'campus_place_catalog.json')).places.map(p=>p.id));
  const report=validateSources({walkwayGeojson:walkways,accessPoints:access_points,boundary,buildings,placeIds});
  if(report.errors.length)throw Error(report.errors.join('\n'));
  return {walkways,access_points,warnings:report.warnings};
}
function main(args=process.argv.slice(2)){
  const dir=args[0]; if(!dir||!args.includes('--approve')) throw Error('Usage: node scripts/promoteCampusSurvey.js <review-directory> --approve');
  const result=prepare(path.resolve(dir));
  const walkwayFile=path.join(data,'campus_walkways.geojson'), accessFile=path.join(data,'campus_access_points.json');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  fs.copyFileSync(walkwayFile,walkwayFile+`.before-survey-${stamp}`);
  fs.copyFileSync(accessFile,accessFile+`.before-survey-${stamp}`);
  fs.writeFileSync(walkwayFile,JSON.stringify(result.walkways,null,2)+'\n');
  fs.writeFileSync(accessFile,JSON.stringify({access_points:result.access_points},null,2)+'\n');
  console.log(`Promoted ${result.walkways.features.length} total walkways and ${result.access_points.length} total access points.`);
  console.log('Run: npm run campus:routing:build');
}
if(require.main===module)main(); module.exports={prepare,main};
