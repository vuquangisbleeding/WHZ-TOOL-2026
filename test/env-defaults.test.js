const test = require('node:test');
const assert = require('node:assert/strict');
const { fillEmptyKey } = require('../desktop/env-defaults');

test('fillEmptyKey keeps a whitelist URL the user already saved', () => {
  const current = 'SCHEME_COUNTRY=Japan\nWHITELIST_URL=https://example.com/saved\n';
  const template = 'WHITELIST_URL=https://example.com/baked\n';
  assert.equal(fillEmptyKey(current, template, 'WHITELIST_URL'), current);
});

test('fillEmptyKey copies the packaged whitelist URL when the saved line is empty', () => {
  const current = 'SCHEME_COUNTRY=Japan\nWHITELIST_URL=\nCAPMONSTER_API_KEY=local\n';
  const template = 'WHITELIST_URL=https://example.com/baked\nCAPMONSTER_API_KEY=\n';
  const next = fillEmptyKey(current, template, 'WHITELIST_URL');
  assert.match(next, /^WHITELIST_URL=https:\/\/example.com\/baked$/m);
  assert.match(next, /^CAPMONSTER_API_KEY=local$/m);
  assert.match(next, /^SCHEME_COUNTRY=Japan$/m);
});
