const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProxy, maskApiKey } = require('../src/browser');
const { readProxyList } = require('../src/io');
const { detectPage } = require('../src/detect');
const { maskUsername } = require('../src/privacy');
const { applicantSummary } = require('../src/notifications');

function fakePage({ url = 'https://example.test/', body = '', selectors = [] } = {}) {
  return {
    async url() { return url; },
    async evaluate(callback) {
      if (callback.toString().includes('document.body?.innerText')) return body;
      return body;
    },
    async $(selector) {
      return selectors.some(item => selector.includes(item)) ? {} : null;
    }
  };
}

test('normalizeProxy accepts authenticated URL and decodes credentials', () => {
  assert.deepEqual(normalizeProxy('http://proxy-user:p%40ss@127.0.0.1:8080'), {
    server: 'http://127.0.0.1:8080',
    username: 'proxy-user',
    password: 'p@ss'
  });
});

test('normalizeProxy supports host:port without protocol', () => {
  assert.deepEqual(normalizeProxy('127.0.0.1:9000'), {
    server: 'http://127.0.0.1:9000',
    username: '',
    password: ''
  });
});

test('normalizeProxy object credentials override URL credentials', () => {
  assert.deepEqual(normalizeProxy({
    server: 'https://old:oldpass@example.test:443',
    username: 'new',
    password: 'newpass'
  }), {
    server: 'https://example.test:443',
    username: 'new',
    password: 'newpass'
  });
});

test('normalizeProxy rejects malformed proxy', () => {
  assert.throws(() => normalizeProxy('ftp://proxy.example:21'), /Proxy không hợp lệ/);
  assert.throws(() => normalizeProxy({}), /proxy phải là chuỗi/);
  assert.equal(normalizeProxy(null), null);
});

test('readProxyList converts host credentials to proxy URLs', async () => {
  const proxies = await readProxyList('proxy-list.txt');
  assert.equal(proxies.length, 6);
  assert.equal(proxies[0], 'http://nzproxy:e6ac91ca3276cefe8ef45857@172.196.34.112:8001');
});

test('readProxyList allows the file to be absent when proxies are disabled', async () => {
  assert.deepEqual(await readProxyList('proxy-list-does-not-exist.txt'), []);
});

test('maskApiKey never returns the full secret', () => {
  const key = 'CAP-1234567890-SECRET';
  const masked = maskApiKey(key);
  assert.equal(masked, 'CAP-1234...ECRET');
  assert.ok(!masked.includes(key));
});

test('maskUsername exposes only the last three characters', () => {
  assert.equal(maskUsername('username-123'), '*********123');
  assert.equal(maskUsername('abc'), 'abc');
});

test('applicant summary omits email and passport', () => {
  const summary = applicantSummary({
    personal: { given_name_1: 'Test', family_name: 'Applicant' },
    identification: { passport_number: 'P1234567' }
  }, { username: 'username-123', email: 'private@example.test' });
  assert.equal(summary, 'Tên: Test Applicant\nTài khoản: *********123');
  assert.ok(!summary.includes('private@example.test'));
  assert.ok(!summary.includes('P1234567'));
});

test('detectPage identifies login before generic form states', async () => {
  const page = fakePage({ selectors: ['input[name="username"]'] });
  assert.equal(await detectPage(page), 'login');
});

test('detectPage identifies captcha by URL', async () => {
  const page = fakePage({ url: 'https://example.test/rs-captcha?redirect=%2Fnext' });
  assert.equal(await detectPage(page), 'captcha');
});

test('detectPage identifies payment before wizard pages', async () => {
  const page = fakePage({
    url: 'https://paystation.example/checkout',
    selectors: ['input[autocomplete="cc-number"]']
  });
  assert.equal(await detectPage(page), 'payment');
});

test('detectPage identifies health page by selector', async () => {
  const page = fakePage({ selectors: ['renalDialysisDropDownList'] });
  assert.equal(await detectPage(page), 'health');
});

test('detectPage identifies personal2 by URL', async () => {
  const page = fakePage({ url: 'https://example.test/WorkingHoliday/Wizard/Personal2.aspx' });
  assert.equal(await detectPage(page), 'personal2');
});
