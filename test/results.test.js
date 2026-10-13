const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { parseResultsCsv, resultRecord, appendResult, readResults } = require('../src/results');

test('a payment stop is success and every other stop is failure', () => {
  const applicant = { personal: { given_name_1: 'An', family_name: 'Nguyen' }, contact: { email: 'ignored@example.com' } };
  const account = { username: 'an.nguyen', email: 'an@example.com' };
  assert.deepEqual(resultRecord({ account, applicant, status: 'STOP_PAYMENT', paymentUrl: 'https://pay.example/1' }), {
    username: 'an.nguyen',
    name: 'An Nguyen',
    email: 'an@example.com',
    status: 'thành công',
    payment_link: 'https://pay.example/1',
    note: ''
  });
  assert.equal(resultRecord({ account, applicant, status: 'ERROR: Chrome đóng', note: 'Chrome đóng' }).status, 'thất bại');
  assert.equal(resultRecord({ account, applicant, status: 'ERROR: Chrome đóng' }).note, 'Chrome đóng');
});

test('results.csv keeps commas and quotes inside a payment link', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inz-results-'));
  const record = resultRecord({
    account: { username: 'a,b', email: 'a@example.com' },
    applicant: { personal: { given_name_1: 'An', family_name: 'Ng"uyen' } },
    status: 'STOP_PAYMENT',
    paymentUrl: 'https://pay.example/a,b'
  });
  await appendResult(record, root);
  await appendResult(resultRecord({
    account: { username: 'c', email: 'c@example.com' },
    applicant: {},
    status: 'WHITELIST_BLOCKED',
    note: 'Không có trong whitelist'
  }), root);
  const rows = await readResults(root);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].username, 'a,b');
  assert.equal(rows[0].name, 'An Ng"uyen');
  assert.equal(rows[0].payment_link, 'https://pay.example/a,b');
  assert.equal(rows[1].status, 'thất bại');
  assert.equal(rows[1].note, 'Không có trong whitelist');
  const raw = await fs.readFile(path.join(root, 'results.csv'), 'utf8');
  assert.equal(parseResultsCsv(raw).length, 2);
});
