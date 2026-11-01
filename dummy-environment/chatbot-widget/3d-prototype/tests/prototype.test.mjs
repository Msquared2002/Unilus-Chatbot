import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { clamp,damp,pose,blinkScale } from '../preview/motion.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const binary=fs.readFileSync(path.join(root,'models/unilus-avatar-v1.glb'));
const jsonLength=binary.readUInt32LE(12);
const gltf=JSON.parse(binary.subarray(20,20+jsonLength).toString());
const node=name=>gltf.nodes.find(n=>n.name===name);
const nodeIndex=name=>gltf.nodes.findIndex(n=>n.name===name);
function ancestor(child,parent){const index=nodeIndex(child);return (node(parent)?.children||[]).some(i=>i===index||ancestor(child,gltf.nodes[i].name));}

test('GLB is a complete glTF 2 binary with an embedded buffer',()=>{
  assert.equal(binary.subarray(0,4).toString(),'glTF');assert.equal(binary.readUInt32LE(4),2);
  assert.equal(binary.readUInt32LE(8),binary.length);assert.equal(binary.readUInt32LE(16),0x4e4f534a);
  assert.equal(binary.readUInt32LE(20+jsonLength+4),0x004e4942);
  assert.equal(gltf.asset.version,'2.0');assert.ok(gltf.buffers.every(b=>!b.uri));
  for(const view of gltf.bufferViews)assert.ok((view.byteOffset||0)+view.byteLength<=gltf.buffers[0].byteLength);
});
test('body has three-dimensional sphere extents and adequate real mesh geometry',()=>{
  const mesh=gltf.meshes[node('BodyMesh').mesh],position=gltf.accessors[mesh.primitives[0].attributes.POSITION];
  assert.ok(position.count>500);
  for(let axis=0;axis<3;axis++)assert.ok(position.max[axis]-position.min[axis]>1.98);
});
test('all worn components and future anchors descend from the shared head pivot',()=>{
  for(const name of ['BodyMesh','Eyes','LeftEye','RightEye','GraduationCap','Tassel','LowAfro','BlackSpiritHoodie','HairAnchor','OutfitAnchor','AccessoryAnchor'])assert.ok(ancestor(name,'HeadMotionPivot'),name);
  assert.ok(ancestor('HeadMotionPivot','AvatarRoot'));
});
test('eyes have distinct controls and white 3D meshes independent of head motion',()=>{
  for(const side of ['Left','Right']){
    assert.ok(node(side+'EyePivot'));assert.ok(ancestor(side+'Eye',side+'EyePivot'));
    const p=gltf.meshes[node(side+'Eye').mesh].primitives[0];
    assert.ok(gltf.accessors[p.attributes.POSITION].count>100);
    assert.ok(gltf.materials[p.material].pbrMetallicRoughness.baseColorFactor[0]>.9);
  }
  assert.notDeepEqual(node('LeftEyePivot').translation,node('RightEyePivot').translation);
});
test('hair and outfit are separate removable groups with actual geometry',()=>{
  for(const name of ['LowAfroCurlMesh','LowAfroUnderCap','FittedHoodieShell','ApprovedVarsityFrontPrint'])assert.equal(typeof node(name).mesh,'number');
  assert.ok(ancestor('LowAfro','HairAnchor'));assert.ok(ancestor('BlackSpiritHoodie','OutfitAnchor'));
  assert.ok(ancestor('CapLettering','GraduationCap'));assert.ok(ancestor('GoldTasselFringe','Tassel'));
});
test('approved print texture is embedded rather than relying on an external image',()=>{
  assert.ok(gltf.images.length>0);
  for(const image of gltf.images){assert.equal(image.uri,undefined);assert.equal(typeof image.bufferView,'number');}
  const primitive=gltf.meshes[node('ApprovedVarsityFrontPrint').mesh].primitives[0];
  assert.ok(gltf.materials[primitive.material].pbrMetallicRoughness.baseColorTexture);
});
test('performance budget and Blender reopen verification hold',()=>{
  const stats=JSON.parse(fs.readFileSync(path.join(root,'models/model-stats.json')));
  assert.ok(stats.triangles<100000);assert.ok(stats.glb_bytes<4_000_000);
  assert.equal(fs.readFileSync(path.join(root,'blender/unilus-avatar-v1.blend')).subarray(0,7).toString(),'BLENDER');
  const validation=JSON.parse(fs.readFileSync(path.join(root,'verification/blender-validation.json')));
  assert.equal(validation.blend_reopened,true);assert.equal(validation.glb_reimported,true);
  assert.equal(validation.editable_text,true);assert.equal(validation.packed_textures,true);
});
test('smoothing is frame-rate independent, bounded and never overshoots',()=>{
  let sixty=0,thirty=0;for(let i=0;i<60;i++)sixty=damp(sixty,1,9,1/60);for(let i=0;i<30;i++)thirty=damp(thirty,1,9,1/30);
  assert.ok(Math.abs(sixty-thirty)<1e-12);assert.ok(sixty>0&&sixty<1);
  assert.equal(clamp(-100,-1,1),-1);assert.equal(clamp(100,-1,1),1);
});
test('blink closes and returns to a fully open eye without changing head pose',()=>{
  assert.equal(blinkScale(-1),1);assert.equal(blinkScale(.11),.06);assert.equal(blinkScale(.5),1);
  assert.ok(blinkScale(.02)>.06);assert.ok(blinkScale(.2)>.06);
});
test('idle floats; thinking adds gaze; happy adds bounce; reduced motion stays subtle',()=>{
  assert.notEqual(pose(.5,'idle').float,pose(1,'idle').float);
  assert.notEqual(pose(.5,'thinking').gazeX,0);
  assert.ok(pose(.25,'happy').float>pose(.25,'idle').float);
  assert.ok(Math.abs(pose(.5,'idle',true).float)<Math.abs(pose(.5,'idle').float));
});
test('production reference and host files are byte-identical to the task-start baseline',()=>{
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'verification/production-baseline.json')));
  const repo=path.resolve(root,'../../..');
  for(const [relative,hash] of Object.entries(baseline)){
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(repo,relative))).digest('hex'),hash,relative);
  }
});
