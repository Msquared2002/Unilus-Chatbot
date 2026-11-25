const test = require('node:test');
const assert = require('node:assert/strict');
const maps = require('../services/additionalCampusService');

test('Pioneer has exactly the corrected 31 rooms and two floor totals', () => {
    const rooms = maps.campuses.pioneer.directory.filter(row => /^Room \d/.test(row.name));
    assert.deepEqual(rooms.map(row => Number(row.name.match(/\d+/)[0])).sort((a,b) => a-b), Array.from({length:31}, (_,i)=>i+2));
    assert.equal(rooms.filter(row=>row.floor===0).length,14);
    assert.equal(rooms.filter(row=>row.floor===1).length,17);
    assert.equal(maps.search('Computer Lab 17','pioneer',true)[0].id,'pioneer-room-17');
    assert.equal(maps.search('Sick Bay','pioneer',true)[0].id,'pioneer-room-19');
});
test('Leopards Hill buildings do not imply room pins', () => {
    assert.equal(maps.campuses.leopards.footprints.length,12);
    assert.equal(maps.search('Room 1','leopards',true)[0].floor,2);
    assert.equal(maps.answer('Where is Room 18 at Leopards Hill?').navigation,undefined);
    assert.match(maps.answer('Where is Room 18 at Leopards Hill?').answer,/first floor/);
});
test('location lookup scopes aliases and timetable anchors', () => {
    assert.equal(maps.answer('How do I find Accounts at Mass Media?').navigation.campus,'pioneer');
    assert.match(maps.answer('Where is Room 10?').answer,/Which campus/);
    assert.equal(maps.forVenue('PNR_RM10').campus,'pioneer');
    assert.equal(maps.forVenue('LH018'),undefined);
    assert.equal(maps.forVenue('Room 10'),undefined);
    assert.equal(maps.answer('Where is Room 10 at Silverest?'),null);
});
