const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const catalogue = require('../../js/demo-programmes.js');
const session = require('../../js/demo-session.js');
const wardrobe = require('../avatar-entitlements.js');
const { extractProgrammes } = require('../../scripts/build-demo-programmes.cjs');
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
test('fictional academic profiles initialize existing programme outfits and respect manual choices',()=>{
 for(const [programmeId,expected]of [['bachelor-of-science-in-information-systems-and-technology','tech-hoodie'],['bachelor-of-science-in-nursing','white-nursing-uniform']]){
  const p=catalogue.programmes.find(p=>p.id===programmeId);const student={id:'account-a:'+p.id,programmeId:p.id,programmeName:p.name,academicProfileId:'scenario-a'};
  const entitlement=wardrobe.resolveEntitlements(student);assert.equal(wardrobe.resolveAppearance(entitlement).outfit,expected);
  assert.equal(wardrobe.resolveAppearance(entitlement,{outfit:'default'}).outfit,'default');
  assert.notEqual(wardrobe.preferenceKey('outfit',student),wardrobe.preferenceKey('outfit',{...student,id:'account-b:'+p.id}));
 }
});

test('catalogue reproduces all 85 local prospectus entries without duplicates', () => {
  assert.deepEqual(catalogue.programmes, extractProgrammes(JSON.parse(read('../../../backend/data/documents/chunks.json'))).programmes);
  assert.equal(new Set(catalogue.programmes.map((p) => p.id)).size, 85);
  assert.deepEqual(catalogue.programmes.map((p) => p.name), catalogue.programmes.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'en')));
});

test('specialist mappings contain only real canonical IDs and do not overlap', () => {
  const ids = Object.values(wardrobe.AVATAR_PROGRAMME_GROUPS).flat();
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(catalogue.programmes.some((p) => p.id === id), id);
  assert.deepEqual(Object.keys(wardrobe.AVATAR_PROGRAMME_GROUPS), ['IT', 'Medicine', 'Nursing', 'Business', 'Law']);
});

function loginForm() {
  const nodes = {};
  for (const selector of ['[data-portal-login]', '#portal-username', '#portal-password', '[data-login-error]', '#portal-programme']) {
    nodes[selector] = { value: '', textContent: '', children: [], listeners: {},
      addEventListener(event, handler) { this.listeners[event] = handler; },
      appendChild(child) { this.children.push(child); } };
  }
  const saved = storage();
  const location = { destination: null, replace(value) { this.destination = value; } };
  vm.runInNewContext(read('../../js/portal-demo-login.js'), {
    window: { UnilusDemoSession: session, UnilusDemoProgrammes: catalogue, location }, sessionStorage: saved,
    document: { querySelector: (selector) => nodes[selector], createElement: () => ({}) }
  });
  return { nodes, saved, location, submit() { nodes['[data-portal-login]'].listeners.submit({ preventDefault() {} }); } };
}

test('production login has no programme selector; the legacy local-only fixture retains its catalogue', () => {
  const html = read('../../portal-login.html');
  assert.doesNotMatch(html, /<select[^>]*id="portal-programme"/);
  assert.match(html, /id="portal-username"/); assert.match(html, /id="portal-password"/);
  assert.doesNotMatch(html, /Development Test Student|CS_TEST|NURSING_TEST|BUSINESS_TEST|LAW_TEST|UNMAPPED_TEST|unmapped/i);
  assert.deepEqual(loginForm().nodes['#portal-programme'].children.map((option) => option.value), catalogue.programmes.map((p) => p.id));
});

test('only unchanged demo credentials work and programme selection is required', () => {
  for (const [username, password, id] of [['CS_TEST', 'unilus demo', catalogue.programmes[0].id], ['demo', 'wrong', catalogue.programmes[0].id], ['demo', 'unilus demo', 'invalid'], ['demo', 'unilus demo', '']]) {
    assert.equal(session.authenticate(username, password, id), null);
  }
  const form = loginForm();
  form.nodes['#portal-username'].value = 'demo';
  form.nodes['#portal-password'].value = 'unilus demo';
  form.submit();
  assert.equal(form.location.destination, null);
  assert.match(form.nodes['[data-login-error]'].textContent, /Select a programme/);
});

for (const programme of catalogue.programmes) {
  test(`demo login, wardrobe and logout: ${programme.name}`, () => {
    const form = loginForm();
    form.nodes['#portal-username'].value = 'demo';
    form.nodes['#portal-password'].value = 'unilus demo';
    form.nodes['#portal-programme'].value = programme.id;
    form.submit();
    assert.match(form.location.destination, /^portal\.html/);
    const current = wardrobe.getCurrentStudent(form.saved);
    assert.equal(current.username, 'demo');
    assert.equal(current.programmeName, programme.name);
    const rights = wardrobe.resolveEntitlements(current);
    const group = Object.entries(wardrobe.AVATAR_PROGRAMME_GROUPS).find(([, ids]) => ids.includes(programme.id))?.[0] || null;
    assert.equal(rights.programme, group);
    assert.deepEqual(rights.outfits, ['default', ...wardrobe.GENERAL_STUDENT_OUTFITS, ...(wardrobe.PROGRAMME_AVATAR_CONFIG[group]?.outfits || [])]);
    assert.deepEqual(rights.accessories, group === 'IT' ? ['laptop'] : []);
    assert.equal(wardrobe.resolveAppearance(rights, { glasses: 'round-gold' }).glasses, 'round-gold');
    session.logout(form.saved);
    assert.equal(wardrobe.getCurrentStudent(form.saved), null);
    assert.deepEqual(wardrobe.resolveAppearance(wardrobe.resolveEntitlements(null), {
      outfit: rights.outfits.at(-1), glasses: 'round-gold', laptop: 'true'
    }), { outfit: 'default', glasses: null, laptop: false, laptopPreference: null });
  });
}

test('IT and specialist groups resolve the specified representative programmes', () => {
  const cases = {
    'bachelor-of-science-in-computer-science': 'IT',
    'bachelor-of-science-in-information-systems-and-technology': 'IT',
    'bachelor-of-science-in-cyber-security': 'IT',
    'master-of-science-in-data-science': 'IT',
    'doctor-of-philosophy-in-information-technology': 'IT',
    'bachelor-of-medicine-and-bachelor-surgery': 'Medicine',
    'bachelor-of-science-in-nursing': 'Nursing',
    'diploma-in-nursing-sciences': 'Nursing',
    'bachelor-of-business-administration': 'Business', 'bachelor-of-laws': 'Law',
    'bachelor-of-accountancy': null, 'bachelor-of-science-in-public-health': null
  };
  for (const [id, group] of Object.entries(cases)) {
    assert.equal(wardrobe.resolveEntitlements(session.studentForProgramme(id)).programme, group, id);
  }
  assert.deepEqual(wardrobe.PROGRAMME_AVATAR_CONFIG.Medicine.outfits, ['health-scrub', 'health-coat']);
  assert.deepEqual(wardrobe.PROGRAMME_AVATAR_CONFIG.Nursing.outfits, ['white-nursing-uniform', 'striped-nursing-uniform']);
});

test('exact canonical matching rejects vague and conflicting values', () => {
  assert.equal(wardrobe.resolveProgramme({ programme: 'Computer Science Lecturer' }), null);
  assert.equal(wardrobe.resolveProgramme({ programmeId: 'bachelor-of-laws', programmeName: 'Bachelor of Science in Nursing' }), null);
  assert.equal(wardrobe.resolveProgramme({ programmeName: ' bachelor OF science in COMPUTER science ' }), 'IT');
});

test('preferences stay isolated across programme sessions', () => {
  const saved = storage();
  const it = session.login(saved, 'demo', 'unilus demo', 'bachelor-of-science-in-information-systems-and-technology');
  const key = wardrobe.preferenceKey('unilus-widget-outfit', it);
  saved.setItem(key, 'black-spirit-hoodie');
  session.logout(saved);
  const nursing = session.login(saved, 'demo', 'unilus demo', 'bachelor-of-science-in-nursing');
  const otherKey = wardrobe.preferenceKey('unilus-widget-outfit', nursing);
  assert.notEqual(key, otherKey);
  assert.equal(saved.getItem(otherKey), null);
  saved.setItem(otherKey, 'white-nursing-uniform');
  session.logout(saved);
  const restored = session.login(saved, 'demo', 'unilus demo', it.programmeId);
  assert.equal(saved.getItem(wardrobe.preferenceKey('unilus-widget-outfit', restored)), 'black-spirit-hoodie');
  assert.equal(wardrobe.resolveAppearance(wardrobe.resolveEntitlements(nursing), { outfit: 'tech-hoodie', laptop: 'true' }).laptop, false);
});

test('IT laptop defaults, deliberate OFF and general clothing coexist with glasses', () => {
  const rights = wardrobe.resolveEntitlements(session.studentForProgramme('bachelor-of-science-in-computer-science'));
  assert.equal(wardrobe.resolveAppearance(rights, { outfit: 'tech-hoodie' }).laptop, true);
  assert.equal(wardrobe.resolveAppearance(rights, { outfit: 'tech-circuit', laptop: 'false' }).laptop, false);
  for (const outfit of ['white-varsity-tee', 'black-spirit-hoodie', 'green-polo']) {
    const appearance = wardrobe.resolveAppearance(rights, { outfit, glasses: 'square-black', laptop: 'true' });
    assert.deepEqual([appearance.outfit, appearance.glasses, appearance.laptop], [outfit, 'square-black', true]);
  }
});
