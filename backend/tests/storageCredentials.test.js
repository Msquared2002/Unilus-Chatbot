const test = require('node:test'), assert = require('node:assert/strict');
const { storageHeaders } = require('../services/storageCredentials');
test('new server keys use apikey only; legacy JWT keys keep Bearer', () => {
 assert.deepEqual(storageHeaders('sb_secret_synthetic'), { apikey: 'sb_secret_synthetic' });
 assert.deepEqual(storageHeaders('synthetic-legacy'), { apikey: 'synthetic-legacy', Authorization: 'Bearer synthetic-legacy' });
 assert.throws(() => storageHeaders('sb_publishable_synthetic'));
 assert.throws(() => storageHeaders(''));
});
