const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backend = path.resolve(__dirname, '..');
const media = path.resolve(backend, '../dummy-environment/chatbot-widget/campus-data');
const catalog = require('../data/campus/campus_place_catalog.json').places;
const presentation = require('../../dummy-environment/chatbot-widget/campus-data/presentation.json');
const facilities = require('../data/campus/campus_facilities.json').facilities;
const locationSearch = require('../services/locationSearchService');
const navigation = require('../services/navigationService');
const { ingestFile } = require('../scripts/ingestDocuments');
const knowledge = require('../services/knowledgeService');

test('all curated cover and gallery assets resolve to canonical places', () => {
  const ids = new Set(catalog.map(p => p.id));
  const entries = presentation.silverest.places;
  for (const [id, item] of Object.entries(entries)) {
    if (!item.cover) continue;
    assert.ok(ids.has(id), id);
    for (const basename of [item.cover, ...item.gallery]) {
      assert.ok(fs.existsSync(path.join(media, 'buildings/silverest', id, basename + '.jpg')), `${id}/${basename}`);
    }
  }
  for (const id of ['hostel_school_of_medicine_side', 'life_science_labs']) {
    assert.equal(entries[id].cover, undefined);
    assert.equal(fs.existsSync(path.join(media, 'buildings/silverest', id, 'cover.jpg')), false);
  }
});

test('football and track retain distinct stable IDs and OSM references', () => {
  assert.equal(catalog.find(p => p.id === 'sports_pitch_soccer').osm_ref, 'relation/13319424');
  assert.equal(catalog.find(p => p.id === 'running_track_athletics').osm_ref, 'relation/13319425');
});

test('Botanic Bloom focuses its parent without a new canonical geometry', () => {
  const facility = facilities.find(f => f.id === 'botanic_bloom');
  assert.equal(facility.parent_place_id, 'p_c_school_of_business');
  assert.equal(catalog.some(p => p.id === 'botanic_bloom'), false);
  assert.equal(locationSearch.findBestMatch('Where is Botanic Bloom?').place.id, 'p_c_school_of_business');
  const response = navigation.tryHandleNavigation('Where is Botanic Bloom?');
  assert.match(response.answer, /Botanic Bloom/);
  assert.equal(response.navigation.placeId, 'p_c_school_of_business');
});

test('ingestion retains campus sign provenance and representative facts', async () => {
  const dir = path.join(backend, 'data/documents/campus');
  for (const [file, phrase, placeId] of [
    ['gym-facilities-prices.txt', 'K400 per hour', 'unilus_gym'],
    ['hospital-visiting-hours.txt', '12:45', 'unilus_hospital'],
    ['volleyball-rules.txt', '08:00 until dusk', 'unilus_volleyball_court'],
  ]) {
    const chunks = await ingestFile(path.join(dir, file));
    assert.ok(chunks.some(c => c.text.includes(phrase)));
    assert.equal(chunks[0].metadata.source_type, 'onsite_photo');
    assert.equal(chunks[0].metadata.observed_date, '2026-09-27');
    assert.equal(chunks[0].metadata.place_id, placeId);
    assert.ok(chunks[0].metadata.source_image_filenames.length);
  }
});

test('indexed campus facts are retrieved for representative questions', async () => {
  for (const [question, source] of [
    ['How much is the basketball court?', 'gym-facilities-prices.txt'],
    ['What are hospital visiting hours?', 'hospital-visiting-hours.txt'],
    ['What time does the volleyball court close?', 'volleyball-rules.txt'],
  ]) {
    const hits = await knowledge.searchKnowledge(question, { topK: 5, embedFn: async () => { throw new Error('lexical-only test'); } });
    assert.ok(hits.some(hit => hit.source_file === source), question);
  }
});
