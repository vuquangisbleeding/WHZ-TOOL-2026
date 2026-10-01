const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { startAuthProxy } = require('../src/proxy-forward');
const { normalizeProxy, maskApiKey, summarizeCapSolverBody, capsolverEndpoint, noteCaptchaMode, captchaMode } = require('../src/browser');
const { parseProxyLine, readProxyList } = require('../src/io');
const { applyProxyList, validateAccounts } = require('../src/main');
const { detectPage } = require('../src/detect');
const { isRecaptchaAnchor } = require('../src/captcha');
const { buildRecaptchaTask } = require('../src/capmonster');
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

test('parseProxyLine encodes credentials and keeps proxy server credential-free', () => {
  const proxy = parseProxyLine('proxy.example:8080:proxy-user:p@ss');
  assert.equal(proxy, 'http://proxy-user:p%40ss@proxy.example:8080');
  const normalized = normalizeProxy(proxy);
  assert.equal(normalized.server, 'http://proxy.example:8080');
  assert.equal(normalized.username, 'proxy-user');
  assert.equal(normalized.password, 'p@ss');
});

test('applyProxyList maps only proxy=true accounts in order', () => {
  const accounts = [
    { username: 'one', proxy: true },
    { username: 'two', proxy: false },
    { username: 'three' },
    { username: 'four', proxy: true }
  ];
  applyProxyList(accounts, ['proxy-a', 'proxy-b']);
  assert.deepEqual(accounts.map(account => account.proxy), ['proxy-a', null, null, 'proxy-b']);
});

test('applyProxyList rejects missing proxy and invalid proxy flag', () => {
  assert.throws(() => applyProxyList([{ username: 'missing', proxy: true }], []), /missing/);
  assert.throws(() => validateAccounts([{ username: 'bad', password: 'pass', email: 'bad@example.com', proxy: 'yes' }]), /proxy.*true hoặc false/);
});

test('readProxyList parses the workspace proxy file', async () => {
  const proxies = await readProxyList();
  assert.ok(Array.isArray(proxies));
  assert.ok(proxies.every(proxy => /^http:\/\/[^:]+:[^@]+@[^:]+:\d+$/.test(proxy)));
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

test('CapSolver summary keeps the error message and hides the solution token', () => {
  assert.equal(capsolverEndpoint('https://api.capsolver.com/createTask'), 'createTask');
  assert.equal(capsolverEndpoint('https://www.google.com/recaptcha/api2/anchor'), '');
  const summary = summarizeCapSolverBody(JSON.stringify({
    errorId: 1,
    errorCode: 'ERROR_PROXY_CONNECT_REFUSED',
    errorDescription: 'proxy connect failed',
    status: 'failed',
    taskId: 'task-1',
    solution: { gRecaptchaResponse: 'secret-token-value' }
  }));
  assert.equal(summary.errorDescription, 'proxy connect failed');
  assert.equal(summary.taskId, 'task-1');
  assert.equal(summary.solution, 'gRecaptchaResponse:len18');
  assert.equal(JSON.stringify(summary).includes('secret-token-value'), false);
});

test('detectPage identifies login before generic form states', async () => {
  const page = fakePage({ selectors: ['input[name="username"]'] });
  assert.equal(await detectPage(page), 'login');
});

test('recaptcha anchor matcher ignores the image challenge frame', () => {
  assert.equal(isRecaptchaAnchor('https://www.google.com/recaptcha/api2/anchor?k=site'), true);
  assert.equal(isRecaptchaAnchor('https://www.google.com/recaptcha/enterprise/anchor?k=site'), true);
  assert.equal(isRecaptchaAnchor('https://www.google.com/recaptcha/api2/bframe?k=site'), false);
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

test('CapMonster task uses the account proxy and hides nothing but the request fields', () => {
  const proxyless = buildRecaptchaTask({
    websiteURL: 'https://example.test/rs-captcha',
    websiteKey: 'site-key',
    iframeSrc: 'https://www.google.com/recaptcha/api2/anchor'
  });
  assert.equal(proxyless.type, 'RecaptchaV2TaskProxyless');
  assert.equal(proxyless.proxyPassword, undefined);

  const proxied = buildRecaptchaTask({
    websiteURL: 'https://example.test/rs-captcha',
    websiteKey: 'site-key',
    iframeSrc: 'https://www.google.com/recaptcha/enterprise/anchor',
    userAgent: 'TestAgent',
    proxy: { server: 'http://geo.example:12321', username: 'user', password: 'secret-pass' }
  });
  assert.equal(proxied.type, 'RecaptchaV2EnterpriseTask');
  assert.equal(proxied.proxyAddress, 'geo.example');
  assert.equal(proxied.proxyPort, 12321);
  assert.equal(proxied.proxyLogin, 'user');
  assert.equal(proxied.proxyPassword, 'secret-pass');
  assert.equal(proxied.userAgent, 'TestAgent');
});

test('captcha mode defaults to click and stores token per account', () => {
  assert.equal(captchaMode(7), 'click');
  noteCaptchaMode(7, 'token');
  assert.equal(captchaMode(7), 'token');
  noteCaptchaMode(7, 'click');
});

test('auth proxy adds upstream credentials on CONNECT', async () => {
  const upstream = net.createServer(socket => {
    let pending = Buffer.alloc(0);
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      const headerEnd = pending.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = pending.subarray(0, headerEnd).toString('latin1');
      assert.match(header, /^CONNECT example.test:443 /);
      assert.match(header, /Proxy-Authorization: Basic /);
      const encoded = header.match(/Proxy-Authorization: Basic (\S+)/)[1];
      assert.equal(Buffer.from(encoded, 'base64').toString(), 'proxy-user:p@ss');
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      socket.write('ready');
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const forwarder = await startAuthProxy({
    host: '127.0.0.1',
    port: upstream.address().port,
    username: 'proxy-user',
    password: 'p@ss'
  });
  try {
    const reply = await new Promise((resolve, reject) => {
      const socket = net.connect(forwarder.port, '127.0.0.1', () => {
        socket.write('CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\n\r\n');
      });
      let pending = Buffer.alloc(0);
      socket.on('data', chunk => {
        pending = Buffer.concat([pending, chunk]);
        if (pending.includes('ready')) resolve(pending.toString('latin1'));
      });
      socket.on('error', reject);
    });
    assert.match(reply, /^HTTP\/1\.1 200 Connection Established/);
    assert.match(reply, /ready$/);
  } finally {
    forwarder.close();
    upstream.close();
  }
});

test('detectPage treats a submitted page without checkboxes as pending', async () => {
  const page = fakePage({ url: 'https://example.test/WorkingHoliday/Application/Submit.aspx?ApplicationId=1' });
  assert.equal(await detectPage(page), 'pending');
});

test('detectPage identifies personal2 by URL', async () => {
  const page = fakePage({ url: 'https://example.test/WorkingHoliday/Wizard/Personal2.aspx' });
  assert.equal(await detectPage(page), 'personal2');
});
