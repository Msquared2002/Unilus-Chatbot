const { distance, inside, intersection, projectOnSegment } = require('./campusGraphBuilder');
const VALID_KINDS = new Set(['footway','path','steps','crossing']);
function pointSegmentDistance(p,a,b) { return projectOnSegment(p,a,b).distance_m; }
function simplify(coords, tolerance = 1.5) {
  if (coords.length <= 2) return coords;
  let max = -1, index = 0;
  for (let i=1;i<coords.length-1;i++) { const d=pointSegmentDistance(coords[i],coords[0],coords.at(-1)); if(d>max){max=d;index=i;} }
  if(max<=tolerance) return [coords[0],coords.at(-1)];
  return [...simplify(coords.slice(0,index+1),tolerance).slice(0,-1),...simplify(coords.slice(index),tolerance)];
}
function clean(coords) { return coords.filter((p,i) => !i || distance(p,coords[i-1]) >= 0.6); }
function crossesPolygon(coords, ring) {
  for(let i=0;i<coords.length-1;i++) {
    const a=coords[i],b=coords[i+1];
    if(inside(a,ring)||inside(b,ring)||ring.slice(0,-1).some((p,j)=>intersection(a,b,p,ring[j+1]))) return true;
  }
  return false;
}
function endpointSnap(features, warnings) {
  const all = features.map(f => f.geometry.coordinates);
  for(let i=0;i<all.length;i++) for(const end of [0,all[i].length-1]) {
    const p=all[i][end]; let best=null;
    for(let j=0;j<all.length;j++) if(i!==j) for(const candidate of [all[j][0],all[j].at(-1)]) {
      const d=distance(p,candidate); if(d>0.05&&d<=2&&(!best||d<best.d)) best={candidate,d,j};
    }
    if(best) { warnings.push(`${features[i].properties.id}: endpoint snapped ${best.d.toFixed(1)} m to ${features[best.j].properties.id}`); all[i][end]=[...best.candidate]; }
  }
}
function overlap(a,b) {
  const near = line => line.filter(p=>b.slice(0,-1).some((q,i)=>pointSegmentDistance(p,q,b[i+1])<=3)).length;
  return a.length>=2 && b.length>=2 && near(a)/a.length>=0.7 && near([...a].reverse())/a.length>=0.7 &&
    b.filter(p=>a.slice(0,-1).some((q,i)=>pointSegmentDistance(p,q,a[i+1])<=3)).length/b.length>=0.7;
}
function processPackages(packages, { boundary, buildings, placeIds }) {
  const features=[], access_points=[], warnings=[], errors=[], seen=new Set(), accessIds=new Set();
  const ring=boundary.geometry.coordinates[0];
  for(const pkg of packages) {
    if(pkg.schema_version!==1||pkg.walkways?.type!=='FeatureCollection'||!Array.isArray(pkg.walkways.features)||!Array.isArray(pkg.access_points)) {
      errors.push('Invalid survey package schema'); continue;
    }
    for(const f of pkg.walkways.features) {
      const id=f?.properties?.id, coords=f?.geometry?.coordinates;
      if(!id||seen.has(id)||!VALID_KINDS.has(f.properties.kind)||f.geometry?.type!=='LineString'||!Array.isArray(coords)||coords.length<2||
        coords.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))) { errors.push(`Invalid or duplicate walkway: ${id}`); continue; }
      seen.add(id);
      const cleaned=clean(coords), simplified=simplify(cleaned);
      if(simplified.length<2||distance(simplified[0],simplified.at(-1))<0.3) { warnings.push(`${id}: stationary or too short; excluded`); continue; }
      if(coords.some(p=>!inside(p,ring))) warnings.push(`${id}: campus boundary exit`);
      for(const b of buildings) if(b.geometry?.type==='Polygon'&&crossesPolygon(simplified,b.geometry.coordinates[0]))
        warnings.push(`${id}: building crossing near ${b.name||b.id}`);
      const raw=f.properties.raw_samples||[];
      if(raw.some(p=>p.accuracy_m>25)) warnings.push(`${id}: poor GPS readings in raw trace`);
      if(raw.some(p=>p.decision==='poor_accuracy')) warnings.push(`${id}: readings above 25 m excluded from geometry`);
      const copy=JSON.parse(JSON.stringify(f)); copy.geometry.coordinates=simplified;
      copy.properties={...copy.properties,review_status:'pending',raw_point_count:coords.length,processed_point_count:simplified.length};
      features.push(copy);
    }
    for(const a of pkg.access_points) {
      if(!a.id||accessIds.has(a.id)||!placeIds.has(a.place_id)||!Number.isFinite(a.lat)||!Number.isFinite(a.lng)) {
        errors.push(`Invalid or duplicate access point: ${a.id}`); continue;
      }
      accessIds.add(a.id); access_points.push({...a,review_status:'pending'});
      if(!inside([a.lng,a.lat],ring)) warnings.push(`${a.id}: outside campus boundary`);
      if(a.accuracy_m>15) warnings.push(`${a.id}: poor entrance/gate accuracy ±${a.accuracy_m} m`);
    }
  }
  endpointSnap(features,warnings);
  for(let i=0;i<features.length;i++) for(let j=i+1;j<features.length;j++) {
    const a=features[i],b=features[j]; if(overlap(a.geometry.coordinates,b.geometry.coordinates)) {
      const qa=a.properties.accuracy_summary?.best_m??Infinity,qb=b.properties.accuracy_summary?.best_m??Infinity;
      warnings.push(`${a.properties.id} and ${b.properties.id}: overlapping traces; ${qa<=qb?a.properties.id:b.properties.id} has better reported best accuracy; review before retaining both`);
    }
    for(const p of [a.geometry.coordinates[0],a.geometry.coordinates.at(-1)])
      if(b.geometry.coordinates.slice(0,-1).some((q,k)=>pointSegmentDistance(p,q,b.geometry.coordinates[k+1])<=3))
        warnings.push(`${a.properties.id}: endpoint near ${b.properties.id}; inspect junction`);
  }
  return { walkways:{type:'FeatureCollection',features},access_points,warnings:[...new Set(warnings)],errors };
}
module.exports={clean,simplify,processPackages};
