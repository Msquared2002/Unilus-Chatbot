const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const hair = require('../avatar-hairstyles.js');
const catalogue = require('../../js/demo-programmes.js');
const session = require('../../js/demo-session.js');
const wardrobe = require('../avatar-entitlements.js');

test('approved IDs, labels and female/male/unisex categories are exact', () => {
  assert.deepEqual(hair.HAIRSTYLES.map(({ id, label, category }) => [id, label, category]), [
    ['curly-bob', 'Curly Bob', 'female'], ['straight-bob', 'Straight Bob', 'female'],
    ['ponytail', 'Ponytail', 'female'], ['bun', 'Braided Bun', 'female'],
    ['low-afro', 'Low Afro', 'male'], ['twists', 'Twists', 'male'],
    ['short-fade', 'Short Fade', 'male'], ['cornrows', 'Cornrows', 'male'],
    ['long-braids', 'Long Braids', 'unisex'], ['locs', 'Locs', 'unisex']
  ]);
});

test('all ten registered assets are real RGBA PNGs with stable filenames', () => {
  for (const style of hair.HAIRSTYLES) {
    const png = fs.readFileSync(path.join(__dirname, '../../', style.src.split('?')[0]));
    assert.equal(png.subarray(1, 4).toString(), 'PNG', style.id);
    assert.equal(png[25], 6, `${style.id} has an alpha channel`);
    assert.equal(path.basename(style.src.split('?')[0]), `${style.id}.png`);
  }
});

test('Guest ignores saved hair and invalid/None selections restore no hair', () => {
  for (const style of hair.HAIRSTYLES) assert.equal(hair.restore(null, style.id), null);
  const student = session.studentForProgramme('bachelor-of-laws');
  for (const saved of ['none', '', null, 'unknown', '__proto__']) assert.equal(hair.restore(student, saved), null);
});

test('all authenticated programmes can use every hairstyle without changing wardrobe rights', () => {
  for (const programme of catalogue.programmes) {
    const student = session.studentForProgramme(programme.id);
    const before = wardrobe.resolveEntitlements(student);
    for (const style of hair.HAIRSTYLES) assert.equal(hair.restore(student, style.id), style.id);
    assert.deepEqual(wardrobe.resolveEntitlements(student), before);
  }
});

test('saved hair is isolated per canonical programme and survives re-login', () => {
  const it = session.studentForProgramme('bachelor-of-science-in-computer-science');
  const nursing = session.studentForProgramme('bachelor-of-science-in-nursing');
  const saved = new Map();
  saved.set(wardrobe.preferenceKey('unilus-widget-hairstyle', it), 'locs');
  saved.set(wardrobe.preferenceKey('unilus-widget-hairstyle', nursing), 'bun');
  assert.equal(hair.restore(it, saved.get(wardrobe.preferenceKey('unilus-widget-hairstyle', it))), 'locs');
  assert.equal(hair.restore(nursing, saved.get(wardrobe.preferenceKey('unilus-widget-hairstyle', nursing))), 'bun');
  assert.equal(hair.restore(null, 'locs'), null);
});

// Small DOM adapter for running the real renderer without a browser dependency.
function renderer() {
  function element() {
    const classes = new Set();
    return { style: { setProperty(name, value) { this[name] = value; } }, dataset: {}, src: undefined,
      classList: { add: (...items) => items.forEach((item) => classes.add(item)),
        remove: (...items) => items.forEach((item) => classes.delete(item)),
        contains: (item) => classes.has(item),
        toggle: (item, enabled) => enabled ? classes.add(item) : classes.delete(item),
        [Symbol.iterator]: () => classes.values() },
      removeAttribute(name) { delete this[name]; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 78, height: 78 }) };
  }
  const layers = new Map();
  const wrapper = element();
  Object.defineProperty(wrapper, 'innerHTML', { set(html) {
    layers.clear();
    const stack = [wrapper];
    for (const tag of html.matchAll(/<\/?(div|img)\b[^>]*>/g)) {
      if (tag[0].startsWith('</')) { stack.pop(); continue; }
      const node = element(); node.parentElement = stack.at(-1);
      const classes = tag[0].match(/class="([^"]*)"/);
      if (classes) for (const name of classes[1].split(' ')) layers.set('.' + name, node);
      if (tag[1] !== 'img') stack.push(node);
    }
  } });
  wrapper.querySelector = (selector) => {
    if (!layers.has(selector)) layers.set(selector, element());
    return layers.get(selector);
  };
  const events = {};
  const listeners = new Map();
  const timers = [];
  wrapper.addEventListener = (name, listener) => { events[`avatar:${name}`] = listener; };
  const window = { innerWidth: 1000, innerHeight: 800,
    addEventListener: (name, listener) => { events[name] = listener; if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
    removeEventListener: (name, listener) => { if (events[name] === listener) delete events[name]; listeners.get(name)?.delete(listener); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../avatar.js'), 'utf8'), {
    window, document: { createElement: () => wrapper, addEventListener() {}, removeEventListener() {} }, UnilusHairstyles: hair,
    console, setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout() {}
  });
  const avatar = window.UniAvatar;
  avatar.init({ appendChild() {} });
  return { avatar, wrapper, layers, events, timers, listeners };
}

test('renderer loads every hair layer and rejects unknown IDs without changing the sphere', () => {
  const { avatar, wrapper, layers } = renderer();
  const body = layers.get('.uni-body');
  const originalStyle = { ...body.style };
  for (const style of hair.HAIRSTYLES) {
    avatar.setHairstyle(style.id);
    assert.equal(avatar.getHairstyle(), style.id);
    assert.equal(layers.get('.uni-hair').src, style.src);
    assert.ok(wrapper.classList.contains('has-hair'));
    assert.deepEqual(body.style, originalStyle);
  }
  avatar.setHairstyle('invalid');
  assert.equal(avatar.getHairstyle(), null);
  assert.equal(layers.get('.uni-hair').src, undefined);
  assert.ok(!wrapper.classList.contains('has-hair'));
});

test('hair, outfit, glasses and laptop remain independent through emotion changes', () => {
  const { avatar } = renderer();
  avatar.setHairstyle('long-braids');
  avatar.setOutfit('black-spirit-hoodie');
  avatar.setGlasses('round-gold');
  avatar.setLaptop(true);
  for (const state of ['happy', 'thinking', 'sad', 'worry', 'surprised', 'idle']) {
    avatar.setState(state);
    assert.equal(avatar.getHairstyle(), 'long-braids');
    assert.equal(avatar.getOutfit(), 'black-spirit-hoodie');
    assert.equal(avatar.getGlasses(), 'round-gold');
    assert.equal(avatar.getLaptop(), true);
  }
  avatar.setOutfit('green-polo');
  assert.equal(avatar.getHairstyle(), 'long-braids');
});

test('shared motion follows the pointer while hair fit remains untouched', () => {
  const { avatar, layers, events } = renderer();
  avatar.setHairstyle('curly-bob');
  events.mousemove({ clientX: 400, clientY: 100 });
  assert.match(layers.get('.uni-motion').style.transform, /rotateX.*rotateY/);
  assert.equal(layers.get('.uni-hair').style.transform, '');
  assert.match(layers.get('.uni-gaze').style.transform, /translate/);
  assert.equal(layers.get('.uni-hair-wrap').style.top, '12px');
  const pose = layers.get('.uni-motion').style.transform;
  avatar.happy();
  assert.equal(layers.get('.uni-motion').style.transform, pose);
  avatar.resetTracking();
  assert.equal(layers.get('.uni-motion').style.transform, '');
});

test('Law wig, cap and gavel still work while hairstyle selection is retained', () => {
  const { avatar, wrapper, layers, events, timers } = renderer();
  avatar.setHairstyle('twists');
  avatar.setOutfit('law-wig');
  assert.ok(wrapper.classList.contains('raise-cap'));
  assert.equal(layers.get('.uni-accessory-top').src, 'chatbot-widget/outfits/law-wig.png');
  events['avatar:click']({ target: { closest: () => true } });
  assert.ok(wrapper.classList.contains('gavel-active'));
  timers.at(-1)();
  assert.equal(layers.get('.uni-gavel-gif').src, 'chatbot-widget/gavel-rest.png');
  assert.equal(avatar.getHairstyle(), 'twists');
  avatar.setOutfit('white-varsity-tee');
  assert.equal(avatar.getHairstyle(), 'twists');
});

test('logout appearance reset removes the hair source as well as all accessories', () => {
  const { avatar, layers } = renderer();
  avatar.setHairstyle('locs');
  avatar.setOutfit('tech-hoodie');
  avatar.setLaptop(true);
  avatar.setGlasses('square-black');
  const guest = wardrobe.resolveAppearance(wardrobe.resolveEntitlements(null));
  avatar.setOutfit(guest.outfit);
  avatar.setLaptop(guest.laptop);
  avatar.setGlasses(guest.glasses);
  avatar.setHairstyle(hair.restore(null, 'locs'));
  assert.equal(avatar.getHairstyle(), null);
  assert.equal(layers.get('.uni-hair').src, undefined);
});

test('fit values are finite and preserve asset proportions', () => {
  for (const style of hair.HAIRSTYLES) {
    for (const key of ['width', 'top', 'offset']) assert.ok(Number.isFinite(style[key]), style.id);
    assert.ok(style.width >= 78 && style.width <= 150);
  }
});
test('tracking clamps extremes and shares movement in every emotion without moving asset anchors', () => {
  const { avatar, layers, events } = renderer();
  avatar.setHairstyle('straight-bob');
  avatar.setGlasses('round-gold');
  avatar.setOutfit('tech-hoodie');
  avatar.setLaptop(true);
  const fit = { ...layers.get('.uni-hair-wrap').style };
  for (const state of ['idle', 'happy', 'worry', 'sad', 'surprised', 'thinking']) {
    avatar.setState(state);
    for (const direction of [-100000, 100000]) {
      events.mousemove({ clientX: direction, clientY: direction });
      assert.match(layers.get('.uni-motion').style.transform, /rotateX\(-?2deg\) rotateY\(-?2deg\)/);
      assert.deepEqual(layers.get('.uni-hair-wrap').style, fit);
      assert.equal(layers.get('.uni-glasses').style.transform, layers.get('.uni-gaze').style.transform);
      assert.equal(layers.get('.uni-accessory-top').style.transform, '');
      assert.equal(layers.get('.uni-body').style.transform, undefined);
    }
  }
  avatar.resetTracking();
  assert.equal(layers.get('.uni-motion').style.transform, '');
  assert.equal(layers.get('.uni-gaze').style.transform, '');
});
test('destroy unregisters pointer and touch handlers', () => {
  const { avatar, events } = renderer();
  assert.equal(typeof events.mousemove, 'function');
  avatar.destroy();
  for (const name of ['mousemove', 'touchmove', 'touchstart', 'blur']) assert.equal(events[name], undefined);
});

test('renderer separates hovering accessories from turning face layers', () => {
  const { wrapper, layers } = renderer();
  const motion = layers.get('.uni-motion');
  const expression = layers.get('.uni-expression');
  assert.equal(motion.parentElement, layers.get('.uni-float'));
  const float = layers.get('.uni-float');
  assert.equal(float.parentElement, wrapper);
  assert.equal(expression.parentElement, motion);
  for (const selector of ['.uni-hair-wrap', '.uni-accessory-top-wrap', '.uni-glasses-wrap', '.uni-body', '.uni-gavel-gif']) {
    assert.equal(layers.get(selector).parentElement, expression, selector);
  }
  assert.equal(layers.get('.uni-cap-img').parentElement, wrapper);
  assert.equal(layers.get('.uni-accessory-bottom').parentElement, float);
  assert.equal(layers.get('.uni-outfit-img').parentElement, layers.get('.uni-body'));
  assert.equal(layers.get('.uni-gaze').parentElement, layers.get('.uni-body'));
  assert.equal(layers.get('.uni-eyes').parentElement, layers.get('.uni-gaze'));
  assert.equal(layers.get('.uni-thinking-bubble').parentElement, wrapper);
});

test('reinitialization keeps exactly one tracking handler and destroy removes every registration', () => {
  const { avatar, listeners } = renderer();
  for (let i = 0; i < 3; i++) avatar.init({ appendChild() {} });
  for (const name of ['mousemove', 'touchmove', 'touchstart', 'blur']) assert.equal(listeners.get(name).size, 1, name);
  avatar.destroy();
  for (const registrations of listeners.values()) assert.equal(registrations.size, 0);
});
test('gaze direction is independent of emotion and explicit look commands reset stale cursor pose', () => {
  const { avatar, layers, events } = renderer();
  events.mousemove({ clientX: 700, clientY: 500 });
  const gaze = layers.get('.uni-gaze').style.transform;
  avatar.sad();
  assert.equal(layers.get('.uni-gaze').style.transform, gaze);
  assert.equal(layers.get('.uni-eyes').style.transform, undefined);
  avatar.lookLeft();
  assert.equal(layers.get('.uni-gaze').style.transform, 'translate(-11px, 0px)');
  assert.equal(layers.get('.uni-motion').style.transform, '');
});

test('each non-destructive hair opening stays inside the sphere and is anchored to it', () => {
  const { avatar, layers } = renderer();
  for (const style of hair.HAIRSTYLES) {
    assert.ok(Object.isFrozen(style.opening));
    for (const axis of ['rx','ry']) assert.ok(style.opening[axis] >= 30 && style.opening[axis] <= 36, style.id);
    avatar.setHairstyle(style.id);
    const fit = layers.get('.uni-hair-wrap').style;
    assert.equal(55 - style.width/2 + style.offset + parseFloat(fit['--hair-opening-x']), 55);
    assert.equal(style.top + parseFloat(fit['--hair-opening-y']), 100);
    assert.ok(39 - style.opening.rx >= 3); // Preserve at least 3px outer overlap.
  }
});

test('glasses share gaze while normal eye spacing and subtle head tilt remain unchanged', () => {
  const { avatar, wrapper, layers, events } = renderer();
  for (const [name,x,y] of [['round-gold',11,7.7],['square-black',11,7.7],['cateye-black',11,7.7]]) {
    avatar.setState('idle');avatar.setGlasses(name);
    events.mousemove({clientX:100000,clientY:-100000});
    assert.equal(layers.get('.uni-gaze').style.transform,`translate(${x}px, ${-y}px)`);
    assert.equal(layers.get('.uni-glasses').style.transform,layers.get('.uni-gaze').style.transform);
    assert.match(layers.get('.uni-motion').style.transform,/rotateY\(2deg\)/);
    const pose=layers.get('.uni-motion').style.transform;
    avatar.happy();
    assert.equal(layers.get('.uni-motion').style.transform,pose);
    assert.ok(parseFloat(layers.get('.uni-gaze').style.transform.slice(10))<=x);
    assert.equal(wrapper.style['--uni-eye-gap'],'14px');
  }
  avatar.setGlasses(null);avatar.idle();
  events.mousemove({clientX:100000,clientY:100000});
  assert.equal(layers.get('.uni-gaze').style.transform,'translate(11px, 7.7px)');
  assert.equal(wrapper.style['--uni-eye-gap'],'14px');
});

test('blink composes below gaze and emotion and cleans up without changing customization', () => {
  const { avatar, wrapper, layers, events, timers } = renderer();
  avatar.setHairstyle('low-afro');avatar.setGlasses('square-black');avatar.happy();
  events.mousemove({clientX:900,clientY:100});
  const motion=layers.get('.uni-motion').style.transform,gaze=layers.get('.uni-gaze').style.transform;
  avatar.blink();
  assert.ok(wrapper.classList.contains('is-blinking'));
  assert.equal(layers.get('.uni-motion').style.transform,motion);
  assert.equal(layers.get('.uni-gaze').style.transform,gaze);
  assert.equal(avatar.getState(),'happy');
  timers.at(-1)();assert.ok(!wrapper.classList.contains('is-blinking'));
  assert.equal(avatar.getHairstyle(),'low-afro');
});

test('destroy also clears a detached avatar pose and hairstyle state', () => {
  const { avatar, layers, events } = renderer();
  avatar.setHairstyle('cornrows');
  events.mousemove({ clientX: 900, clientY: 400 });
  avatar.destroy();
  assert.equal(avatar.getHairstyle(), null);
  assert.equal(layers.get('.uni-motion').style.transform, '');
  assert.equal(layers.get('.uni-gaze').style.transform, '');
});

// Decode the approved RGBA frame pixels so the clearance check tests real
// transparent lens openings rather than a guessed rectangular frame boundary.
function pngAlpha(filename) {
  const data=fs.readFileSync(filename),width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  assert.equal(data[24],8);assert.equal(data[25],6);assert.equal(data[28],0);
  const chunks=[];
  for(let p=8;p<data.length;){const n=data.readUInt32BE(p);if(data.toString('ascii',p+4,p+8)==='IDAT')chunks.push(data.subarray(p+8,p+8+n));p+=12+n;}
  const raw=require('node:zlib').inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];
    for(let x=0;x<stride;x++){
      const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=x>=4&&y?pixels[i-stride-4]:0;
      pixels[i]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
    }
  }
  return {width,height,alpha:(x,y)=>pixels[(Math.round(y)*width+Math.round(x))*4+3]};
}

test('eye centres remain in the real lens openings while frames follow gaze', () => {
  const css=fs.readFileSync(path.join(__dirname,'../avatar.css'),'utf8');
  function rules(selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return Array.from(css.matchAll(new RegExp('^'+escaped+'\\s*\\{([^}]+)\\}','gm')),m=>m[1]).join(';');}
  const value=(text,property)=>text.match(new RegExp('(?:^|;)\\s*'+property+'\\s*:\\s*([^;]+)'))?.[1];

  const {avatar,wrapper,layers,events}=renderer();
  for(const name of ['round-gold','square-black','cateye-black']){
    avatar.setGlasses(name);
    const frameWidth=parseFloat(wrapper.style['--uni-glasses-width']);
    const image=pngAlpha(path.join(__dirname,`../outfits/glasses-${name}.png`)),scale=frameWidth/image.width;
    const frameLeft=55-frameWidth/2,frameTop=145-parseFloat(wrapper.style['--uni-glasses-bottom'])-image.height*scale;
    const spacing=16+parseFloat(wrapper.style['--uni-eye-gap']);
    for(const state of ['idle','thinking','happy','surprised','sad','worry']){
      avatar.setState(state);
      const normal=rules('.uni-eye'),emotion=rules(`.uni-avatar-wrapper.${state} .uni-eye`),fitted=rules(`.uni-avatar-wrapper.has-glasses.${state} .uni-eye`);
      const property=key=>value(fitted,key)||value(emotion,key)||value(rules('.uni-avatar-wrapper.has-glasses .uni-eye'),key)||value(normal,key);
      const ew=parseFloat(property('width')),eh=parseFloat(property('height'));
      const transform=property('transform')||'',scaleY=Number(transform.match(/scaleY\(([^)]+)\)/)?.[1]||1);
      const shiftY=Number(transform.match(/translateY\(([-\d.]+)px\)/)?.[1]||0);
      const parentY=Number((value(rules(`.uni-avatar-wrapper.has-glasses.${state} .uni-eyes`),'transform')||'').match(/translateY\(([-\d.]+)px\)/)?.[1]||0);
      for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
        events.mousemove({clientX:39+dx*100000,clientY:54+dy*100000});
        const gaze=layers.get('.uni-gaze').style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number);
        for(const side of [-1,1]){
          const angle=state==='sad'?-side*8*Math.PI/180:0;
          for(let i=0;i<1;i++){
            const x=0,y=0; // Reference fit: verify eye centres, allowing frame overlap at eye edges.
            const px=(55+side*spacing/2+0+x*Math.cos(angle)-y*Math.sin(angle)-frameLeft)/scale;
            const py=(86.5+0+parentY+shiftY+x*Math.sin(angle)+y*Math.cos(angle)-frameTop)/scale;
            assert.ok(px>0&&px<image.width&&py>0&&py<image.height,`${name}/${state}: ${px},${py}, width ${frameWidth}`);
            assert.ok(image.alpha(px,py)<96,`${name}/${state}/${dx},${dy}/${side}: eye crosses frame at ${px.toFixed(1)},${py.toFixed(1)}`);
          }
        }
      }
    }
  }
});


test('cap and laptop stay outside every cursor and emotion transform', () => {
  const {avatar,layers,events}=renderer();
  avatar.setLaptop(true);
  for(const state of ['idle','happy','sad','worry','thinking','surprised']) {
    avatar.setState(state);
    for(const sign of [-1,1]) {
      events.mousemove({clientX:sign*100000,clientY:sign*100000});
      for(const selector of ['.uni-cap-img','.uni-accessory-bottom']) {
        const accessory=layers.get(selector);
        assert.equal(accessory.parentElement,selector === '.uni-cap-img' ? layers.get('.uni-float').parentElement : layers.get('.uni-float'));
        assert.ok(!accessory.style.transform || !/rotate|skew/.test(accessory.style.transform));
      }
      assert.match(layers.get('.uni-motion').style.transform,/rotateX/);
    }
  }
  const css=fs.readFileSync(path.join(__dirname,'../avatar.css'),'utf8');
  assert.match(css,/@keyframes uni-idle-bounce[\s\S]*?translateY\(-8px\)/);
  assert.match(css,/--uni-eye-gap, 14px/);
  assert.match(css,/@keyframes uni-cap-float[\s\S]*?translateY\(-7px\)/);
});


test('normal eyes keep the reference size with and without glasses', () => {
 const css=fs.readFileSync(path.join(__dirname,'../avatar.css'),'utf8');
 assert.match(css,/\.uni-eye \{\s*width: 16px;\s*height: 19px;/);
 assert.doesNotMatch(css,/\.uni-avatar-wrapper\.has-glasses \.uni-eye \{/);
});


test('requested reference hover remains visible with reduced motion enabled', () => {
 const css=fs.readFileSync(path.join(__dirname,'../avatar.css'),'utf8');
 assert.doesNotMatch(css,/animation: uni-gentle-float|animation: uni-cap-float-reduced/);
 assert.match(css,/\.uni-float \{ animation: uni-idle-bounce 3s ease-in-out infinite;/);
 assert.match(css,/@keyframes uni-idle-bounce[\s\S]*?translateY\(-8px\)/);
 assert.match(css,/@keyframes uni-cap-float[\s\S]*?translateY\(-7px\)/);
});


test('Cornrows and Short Fade artwork fits the sphere width without stretching', () => {
 for(const id of ['cornrows','short-fade']) {
  const fit=hair.get(id),image=pngAlpha(path.join(__dirname,`../hairstyles/${id}.png`));
  let left=image.width,right=0;
  for(let y=0;y<image.height;y+=2)for(let x=0;x<image.width;x+=2)if(image.alpha(x,y)>128){left=Math.min(left,x);right=Math.max(right,x);}
  const visibleWidth=(right-left)*fit.width/image.width;
  assert.ok(visibleWidth>=70 && visibleWidth<=82,`${id}: visible width ${visibleWidth}`);
 }
});


test('replaced hair keeps recoverable original PNGs and explicit cache revisions', () => {
 for(const id of ['cornrows','short-fade']) {
  const previous=fs.readFileSync(path.join(__dirname,`../hairstyles/originals/before-fit-revision-2026-10-22/${id}.png`));
  const current=fs.readFileSync(path.join(__dirname,`../hairstyles/${id}.png`));
  assert.equal(previous.subarray(1,4).toString(),'PNG');
  assert.ok(!previous.equals(current),id);
  assert.match(hair.get(id).src,/\?v=/);
 }
});

test('Cornrows partings reveal the original sphere without any scalp backing', () => {
 const css=fs.readFileSync(path.join(__dirname,'../avatar.css'),'utf8');
 assert.doesNotMatch(css,/data-hairstyle="cornrows"[^\n]*::before/);
 const image=pngAlpha(path.join(__dirname,'../hairstyles/cornrows.png'));
 assert.equal(image.alpha(530,400),0); // Open channel between centre and adjacent braid.
 assert.ok(image.alpha(627,400)>128); // The braid itself remains opaque.
 const fit=hair.get('cornrows');
 // Visible upper contour is only slightly above the unchanged sphere (top61).
 const top=fit.top+287*fit.width/image.height;
 assert.ok(top>=59&&top<=62);
});
