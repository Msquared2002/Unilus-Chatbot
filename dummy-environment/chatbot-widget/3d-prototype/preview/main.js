import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, damp, pose, blinkScale } from './motion.js';
const $ = id => document.getElementById(id);
const viewport=$('viewport'),canvas=$('avatar-canvas'),status=$('load-status');
let renderer,controls,observer,visibilityObserver,model,disposed=false;
let state='idle',time=0,blinkAt=-10,nextBlink=3.6,previous=0;
let lastBlinkMin=1,blinkCount=0;
let head,cap,hair,outfit,eyes=[],target={x:0,y:0},visible=true,frames=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,50);
const targetPoint=new THREE.Vector3(0,.22,0);
const reference=document.querySelector('iframe');
function syncReference(){reference.contentWindow?.postMessage({hair:$('hair').value,outfit:$('outfit').value,state},location.origin);}
reference.addEventListener('load',syncReference);
function size(){
  if(!renderer)return;
  const r=canvas.getBoundingClientRect(),aspect=r.width/Math.max(1,r.height);
  const height=$('compact').checked?4.2:5.8;camera.left=-height*aspect/2;camera.right=height*aspect/2;
  camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  renderer.setSize(r.width,r.height,false);
}
function appearance(){if(!model)return;hair.visible=$('hair').value==='low-afro';outfit.visible=$('outfit').value==='black-spirit-hoodie';cap.position.y=hair.visible?.18:0;syncReference();}
function followEnabled(){return $('follow').checked&&!$('orbit').checked;}
function resetPointer(){target.x=target.y=0;}
function point(event){if(!followEnabled())return;const r=viewport.getBoundingClientRect();target.x=clamp((event.clientX-r.left-r.width/2)/(r.width/2),-1,1);target.y=clamp(-(event.clientY-r.top-r.height/2)/(r.height/2),-1,1);}
function view(which){
  $('follow').checked=false;$('orbit').checked=false;controls.enabled=false;resetPointer();
  const x=which==='left'?-5:which==='right'?5:0;
  camera.position.set(x,1.55,which==='front'?7:5);controls.target.copy(targetPoint);camera.lookAt(targetPoint);
  $('rotation').value=0;$('rotation-value').value='0°';if(head)head.rotation.set(0,0,0);
}
function animate(timestamp){
  if(disposed)return;const dt=previous?Math.min((timestamp-previous)/1000,.05):0;previous=timestamp;time+=dt;
  if(model){
    const p=pose(time,state,reduced.matches);model.position.y=p.float;
    const manual=THREE.MathUtils.degToRad(Number($('rotation').value));
    head.rotation.y=damp(head.rotation.y,manual+(followEnabled()?target.x*.34:0),9,dt);
    head.rotation.x=damp(head.rotation.x,followEnabled()?-target.y*.20:0,9,dt);
    head.rotation.z=p.roll;
    if(time>nextBlink&&!reduced.matches){blinkAt=time;lastBlinkMin=1;blinkCount++;nextBlink=time+3.7+Math.random()*1.8;}
    for(const eye of eyes){
      eye.pivot.position.x=damp(eye.pivot.position.x,eye.base.x+(followEnabled()?target.x*.052:0)+p.gazeX,13,dt);
      eye.pivot.position.y=damp(eye.pivot.position.y,eye.base.y+(followEnabled()?target.y*.034:0)+p.gazeY,13,dt);
      eye.mesh.scale.y=blinkScale(time-blinkAt)*p.eyeScale;
    }
    canvas.dataset.yaw=head.rotation.y.toFixed(4);
    canvas.dataset.pitch=head.rotation.x.toFixed(4);
    canvas.dataset.eyeOpen=eyes[0].mesh.scale.y.toFixed(3);
    canvas.dataset.gaze=eyes[0].pivot.position.x.toFixed(4);
    canvas.dataset.float=p.float.toFixed(4);
    canvas.dataset.frames=String(frames);
    lastBlinkMin=Math.min(lastBlinkMin,eyes[0].mesh.scale.y);
    canvas.dataset.lastBlinkMin=lastBlinkMin.toFixed(3);
    canvas.dataset.blinkCount=String(blinkCount);
    controls.update();
  }
  renderer.render(scene,camera);
  if(++frames%60===0&&model)$('render-stats').textContent=`${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.calls} draws · DPR ${renderer.getPixelRatio().toFixed(1)}`;
}
function run(){if(!renderer||disposed)return;previous=0;renderer.setAnimationLoop(document.hidden||!visible?null:animate);}
function onVisibility(){run();}
function dispose(){
  if(disposed)return;disposed=true;renderer?.setAnimationLoop(null);observer?.disconnect();visibilityObserver?.disconnect();controls?.dispose();
  window.removeEventListener('pointermove',point);window.removeEventListener('blur',resetPointer);document.removeEventListener('visibilitychange',onVisibility);
  const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer?.dispose();
}
async function init(){
  try{
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    scene.add(new THREE.HemisphereLight(0xf4f6ed,0x667266,2));
    for(const [color,power,position] of [[0xfff3db,3,[-3,5,5]],[0xe6f1ff,2,[4,2,3]],[0xfff6e5,3,[1,3,-4]]]){const l=new THREE.DirectionalLight(color,power);l.position.set(...position);scene.add(l);}
    controls=new OrbitControls(camera,canvas);controls.target.copy(targetPoint);controls.enableDamping=true;controls.enablePan=false;controls.enableZoom=true;controls.minZoom=.65;controls.maxZoom=2;controls.enabled=false;
    camera.position.set(0,1.55,7);camera.lookAt(targetPoint);
    observer=new ResizeObserver(size);observer.observe(viewport);size();
    visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;run();});visibilityObserver.observe(viewport);
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pointermove',point,{passive:true});window.addEventListener('blur',resetPointer);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);status.textContent='The graphics context was lost. Reload this preview to resume.';});
    const gltf=await new GLTFLoader().loadAsync(new URL('../models/unilus-avatar-v1.glb',import.meta.url).href);
    if(disposed)return;model=gltf.scene;scene.add(model);
    for(const name of ['HeadMotionPivot','GraduationCap','LowAfro','BlackSpiritHoodie','LeftEyePivot','RightEyePivot'])if(!model.getObjectByName(name))throw new Error(`Missing model control: ${name}`);
    head=model.getObjectByName('HeadMotionPivot');cap=model.getObjectByName('GraduationCap');hair=model.getObjectByName('LowAfro');outfit=model.getObjectByName('BlackSpiritHoodie');
    eyes=['Left','Right'].map(side=>{const pivot=model.getObjectByName(side+'EyePivot');return {pivot,base:pivot.position.clone(),mesh:model.getObjectByName(side+'Eye')};});
    appearance();status.textContent='';canvas.dataset.loaded='true';
    // Read-only diagnostics for the isolated preview and its verification.
    window.unilus3D={get diagnostics(){return {loaded:true,state,hair:hair.visible,outfit:outfit.visible,head:head.rotation.toArray().slice(0,3),gaze:eyes.map(e=>e.pivot.position.toArray()),blink:eyes[0].mesh.scale.y,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,frames,rendering:!document.hidden&&visible,reducedMotion:reduced.matches};}};
    run();
  }catch(error){status.textContent=`3D preview unavailable: ${error.message}. The original 2D avatar is unaffected.`;console.error(error);dispose();}
}
$('hair').addEventListener('change',appearance);$('outfit').addEventListener('change',appearance);
document.querySelectorAll('[data-state]').forEach(button=>button.addEventListener('click',()=>{state=button.dataset.state;document.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));syncReference();}));
$('blink').addEventListener('click',()=>{blinkAt=time;lastBlinkMin=1;blinkCount++;});
$('follow').addEventListener('change',()=>{if($('follow').checked){$('orbit').checked=false;if(controls)controls.enabled=false;}resetPointer();});
$('orbit').addEventListener('change',()=>{if(controls)controls.enabled=$('orbit').checked;if($('orbit').checked)$('follow').checked=false;resetPointer();});
for(const key of ['front','left','right'])$(key).addEventListener('click',()=>{if(controls)view(key);});
$('reset').addEventListener('click',()=>{if(!controls)return;camera.zoom=1;view('front');$('follow').checked=true;state='idle';document.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state==='idle')));syncReference();size();});
$('rotation').addEventListener('input',()=>{$('follow').checked=false;resetPointer();$('rotation-value').value=$('rotation').value+'°';});
$('compact').addEventListener('change',()=>{viewport.classList.toggle('compact',$('compact').checked);size();});
$('theme').addEventListener('click',()=>{const dark=viewport.classList.toggle('dark');$('theme').textContent=dark?'Light background':'Dark background';});
window.addEventListener('pagehide',dispose,{once:true});
init();
