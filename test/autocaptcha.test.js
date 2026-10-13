const test = require('node:test');
const assert = require('node:assert/strict');
const {
  recaptchaTokenPayload,
  recaptchaImageRequestBody,
  captchaRequestBody,
  classifyCaptcha,
  formatAutocaptchaProxy,
  injectCaptchaAnswer,
  parseTileAnswer,
  solveRecaptchaOnPage,
  solveCaptchaOnPage,
  solveRecaptchaToken,
  CAPTCHA_SLOW_MS
} = require('../src/autocaptcha');

test('recaptcha v2 token request uses the site key and page url', () => {
  const body = recaptchaTokenPayload('sheet-key', {
    sitekey: '6LeSrCAgAAAAAJfZTH_T47uoIvabVp05FX1grYmD',
    url: 'https://onlineservices.immigration.govt.nz/rs-captcha',
    iframeSrc: 'https://www.google.com/recaptcha/api2/anchor'
  });
  assert.deepEqual(body, {
    key: 'sheet-key',
    type: 'recaptchav2',
    googlesitekey: '6LeSrCAgAAAAAJfZTH_T47uoIvabVp05FX1grYmD',
    pageurl: 'https://onlineservices.immigration.govt.nz/rs-captcha'
  });
});

test('enterprise and invisible recaptcha use the matching request', () => {
  const enterprise = recaptchaTokenPayload('sheet-key', {
    sitekey: 'site',
    url: 'https://example.test/captcha',
    iframeSrc: 'https://www.google.com/recaptcha/enterprise/anchor'
  });
  assert.equal(enterprise.type, 'recaptchav2enterpire');
  const invisible = recaptchaTokenPayload('sheet-key', {
    sitekey: 'site',
    url: 'https://example.test/captcha',
    invisible: true
  });
  assert.equal(invisible.invi, '1');
  const both = recaptchaTokenPayload('sheet-key', {
    sitekey: 'site',
    url: 'https://example.test/captcha',
    iframeSrc: 'https://www.google.com/recaptcha/enterprise/anchor',
    invisible: true
  });
  assert.equal(both.type, 'recaptchav2enterpire');
  assert.equal(both.invi, '1');
});

test('each documented captcha type builds the matching request', () => {
  const pageurl = 'https://example.test/form';
  const cases = [
    ['recaptcha_v3', { sitekey: 'site', url: pageurl, action: 'submit', proxy: '1.2.3.4:80:user:pass' }, 'recaptchav3'],
    ['hcaptcha', { sitekey: 'hc-key', url: pageurl }, 'hcaptcha'],
    ['turnstile', { sitekey: '0x4AAAA', url: pageurl }, 'cloudflare'],
    ['funcaptcha', { sitekey: 'pk', url: pageurl, blob: 'blob-data' }, 'funcaptcha'],
    ['funcaptcha_image', { image: 'abc', url: pageurl }, 'compleximagetask'],
    ['geetest', { gt: 'gt-value', challenge: 'ch-value', url: pageurl }, 'geetest'],
    ['geetest_v4', { captchaId: 'cap-id', url: pageurl }, 'geetestv4'],
    ['mtcaptcha', { sitekey: 'MTPublic-key', url: pageurl, proxy: '1.2.3.4:80:user:pass' }, 'mtcaptcha'],
    ['imagetotext', { image: 'abc', colors: 'rgb(255,0,0)' }, 'imagetotext'],
    ['getcode', { image: '<svg></svg>' }, 'getcode'],
    ['speech', { audio: 'audio-base64' }, 'speechtotext']
  ];
  for (const [kind, info, type] of cases) {
    const body = captchaRequestBody('sheet-key', { kind, ...info });
    assert.equal(body.type, type, kind);
    assert.equal(body.key, 'sheet-key');
  }
  const v3 = captchaRequestBody('sheet-key', { kind: 'recaptcha_v3', sitekey: 'site', url: pageurl, action: 'submit', proxy: '1.2.3.4:80:user:pass' });
  assert.equal(v3.score, 0.9);
  assert.equal(v3.actionv3, 'submit');
  assert.equal(v3.proxy, '1.2.3.4:80:user:pass');
  const image = captchaRequestBody('sheet-key', { kind: 'funcaptcha_image', image: 'abc' });
  assert.equal(image.class, 'funcaptcha');
  assert.deepEqual(image.imagesBase64, ['abc']);
  const svg = captchaRequestBody('sheet-key', { kind: 'getcode', image: '<svg></svg>' });
  assert.equal(svg.img.startsWith('data:image/svg+xml;base64,'), true);
});

test('the visible widget decides the captcha kind', () => {
  assert.equal(classifyCaptcha({
    url: 'https://example.test/form',
    turnstile: { sitekey: 'turn' },
    recaptcha: { sitekey: 're', version: 'v2' }
  }).kind, 'turnstile');
  assert.equal(classifyCaptcha({
    url: 'https://example.test/form',
    hcaptcha: { sitekey: 'hc' }
  }).kind, 'hcaptcha');
  assert.equal(classifyCaptcha({
    url: 'https://example.test/rs-captcha',
    recaptcha: { sitekey: 're', version: 'v2', invisible: true, iframeSrc: 'https://www.google.com/recaptcha/enterprise/anchor' }
  }).kind, 'recaptcha_v2');
  assert.equal(classifyCaptcha({
    url: 'https://example.test/form',
    recaptcha: { sitekey: 're', version: 'v3', action: 'submit' }
  }).kind, 'recaptcha_v3');
  assert.equal(classifyCaptcha({
    url: 'https://example.test/form',
    geetest4: { captchaId: 'cap' }
  }).captchaId, 'cap');
  assert.equal(classifyCaptcha({
    url: 'https://example.test/form',
    image: { src: 'https://example.test/captcha.png', codes: true }
  }).kind, 'getcode');
  assert.equal(classifyCaptcha({
    url: 'https://example.test/form',
    audio: { src: 'https://example.test/a.mp3' }
  }).kind, 'speech');
});

test('proxy for autocaptcha is host:port:user:pass', () => {
  assert.equal(formatAutocaptchaProxy({ server: 'http://1.2.3.4:8080', username: 'user', password: 'pass' }), '1.2.3.4:8080:user:pass');
  assert.equal(formatAutocaptchaProxy(''), '');
});

test('hcaptcha token is written into the widget response', async () => {
  const textarea = { value: '', setAttribute() {}, dispatchEvent() {} };
  let callback = '';
  const root = {
    document: {
      querySelector(selector) {
        return selector === '.h-captcha' ? { getAttribute(name) { return name === 'data-callback' ? 'done' : ''; } } : null;
      },
      querySelectorAll(selector) {
        return selector.includes('h-captcha-response') ? [textarea] : [];
      }
    },
    done(token) { callback = token; }
  };
  const posts = [];
  await solveCaptchaOnPage({
    page: { async evaluate(fn, ...args) { return fn(...args, root); } },
    info: { kind: 'hcaptcha', sitekey: 'hc-key', url: 'https://example.test/form' },
    apiKey: 'sheet-key',
    isSolved: async () => false,
    wait: async () => {},
    post: async ({ payload }) => {
      posts.push(payload);
      return { captcha: 'h-token' };
    }
  });
  assert.equal(posts[0].type, 'hcaptcha');
  assert.equal(posts[0].websitekey, 'hc-key');
  assert.equal(textarea.value, 'h-token');
  assert.equal(callback, 'h-token');
});

test('recaptcha v3 uses the high-score request and the recaptcha callback', async () => {
  const calls = [];
  await solveCaptchaOnPage({
    page: { async evaluate(fn, ...args) { calls.push([fn.name, ...args]); } },
    info: { kind: 'recaptcha_v3', sitekey: 'site', url: 'https://example.test/form', action: 'submit' },
    apiKey: 'sheet-key',
    isSolved: async () => false,
    wait: async () => {},
    post: async ({ payload }) => {
      calls.push(['post', payload.type, payload.score, payload.actionv3]);
      return { captcha: 'v3-token' };
    }
  });
  assert.deepEqual(calls[0], ['post', 'recaptchav3', 0.9, 'submit']);
  assert.equal(calls[1][0], 'injectRecaptchaToken');
  assert.equal(calls[1][1], 'v3-token');
});

test('cloudflare turnstile keeps the token and clearance', () => {
  const input = { value: '', setAttribute() {}, dispatchEvent() {} };
  let callback = '';
  const root = {
    document: {
      cookie: '',
      querySelector(selector) {
        return selector === '.cf-turnstile' ? { getAttribute() { return 'onTurn'; } } : null;
      },
      querySelectorAll(selector) {
        return selector.includes('cf-turnstile-response') ? [input] : [];
      }
    },
    onTurn(token) { callback = token; }
  };
  injectCaptchaAnswer('turnstile', { token: 'cf-token', clearance: 'clear-value' }, root);
  assert.equal(input.value, 'cf-token');
  assert.equal(callback, 'cf-token');
  assert.equal(root.document.cookie.includes('cf_clearance=clear-value'), true);
});

test('image request sends one grid and the instruction', () => {
  const body = recaptchaImageRequestBody('sheet-key', {
    image: 'abc',
    task: 'Select all images with cars',
    grid: '3x3'
  });
  assert.equal(body.type, 'compleximagetask');
  assert.equal(body.class, 'recaptcha');
  assert.deepEqual(body.imagesBase64, ['abc']);
  assert.deepEqual(body.metadata, { Task: 'Select all images with cars', Grid: '3x3' });
});

test('tile answers accept a boolean array or the same array as text', () => {
  assert.deepEqual(parseTileAnswer([false, true, 'true']), [false, true, true]);
  assert.deepEqual(parseTileAnswer('[false,true]'), [false, true]);
  assert.equal(parseTileAnswer('03AFcWeA-token'), null);
});

test('an image grid is solved without waiting for a slow token', async () => {
  let releaseToken;
  const tokenGate = new Promise(resolve => { releaseToken = resolve; });
  const calls = [];
  const clicks = [];
  const tile = { async click() { clicks.push('tile'); } };
  const verify = { async click() { clicks.push('verify'); } };
  const frame = {
    url() { return 'https://www.google.com/recaptcha/api2/bframe?k=site'; },
    async evaluate(_fn, element) {
      if (element) return false;
      return { task: 'Select all images with cars', grid: '4x4', tileCount: 1, selected: [false] };
    },
    async $(selector) {
      if (String(selector).includes('verify')) return verify;
      return { async screenshot() { return 'grid-image'; } };
    },
    async $$() { return [tile]; }
  };
  await solveRecaptchaOnPage({
    page: { frames() { return [frame]; }, async evaluate() {} },
    info: { sitekey: 'site', url: 'https://example.test/captcha', iframeSrc: '' },
    apiKey: 'sheet-key',
    isSolved: async () => false,
    wait: async () => {},
    post: async ({ payload }) => {
      calls.push(payload.type);
      if (payload.type === 'recaptchav2') {
        await tokenGate;
        return { captcha: 'late-token' };
      }
      return { captcha: '[true]' };
    }
  });
  assert.deepEqual(clicks, ['tile', 'verify']);
  assert.equal(calls.includes('compleximagetask'), true);
  releaseToken();
});

test('a recaptcha token is applied before any image request', async () => {
  const calls = [];
  let solved = false;
  const page = {
    frames() { return []; },
    async evaluate(_fn, token) {
      calls.push(token);
      solved = true;
    }
  };
  await solveRecaptchaOnPage({
    page,
    info: { sitekey: 'site', url: 'https://example.test/captcha', iframeSrc: '' },
    apiKey: 'sheet-key',
    isSolved: async () => solved,
    wait: async () => {},
    post: async ({ payload }) => {
      calls.push(payload.type);
      return { captcha: 'token-value' };
    }
  });
  assert.deepEqual(calls, ['recaptchav2', 'token-value']);
});

test('an unsolved token falls back to clicking the image grid', async () => {
  const calls = [];
  const clicks = [];
  const tile = { async click() { clicks.push('tile'); } };
  const verify = { async click() { clicks.push('verify'); } };
  const frame = {
    url() { return 'https://www.google.com/recaptcha/api2/bframe?k=site'; },
    async evaluate(_fn, element) {
      if (element) return false;
      return { task: 'Select all images with cars', grid: '4x4', tileCount: 2, selected: [false, false] };
    },
    async $(selector) {
      if (String(selector).includes('verify')) return verify;
      return { async screenshot() { return 'grid-image'; } };
    },
    async $$() { return [tile, { async click() { clicks.push('other'); } }]; }
  };
  const page = {
    frames() { return [frame]; },
    async evaluate() {}
  };
  await solveRecaptchaOnPage({
    page,
    info: { sitekey: 'site', url: 'https://example.test/captcha', iframeSrc: '' },
    apiKey: 'sheet-key',
    isSolved: async () => false,
    wait: async () => {},
    post: async ({ payload }) => {
      calls.push(payload.type);
      if (payload.type === 'recaptchav2') throw new Error('token rejected');
      assert.equal(payload.metadata.Grid, '4x4');
      assert.equal(payload.imagesBase64[0], 'grid-image');
      return { captcha: '[true,false]' };
    }
  });
  assert.deepEqual(calls, ['recaptchav2', 'compleximagetask']);
  assert.deepEqual(clicks, ['tile', 'verify']);
});

test('an image that appears after 15s is solved while the token request is still pending', async () => {
  let now = 0;
  let imageVisible = false;
  const calls = [];
  const clicks = [];
  const tile = { async click() { clicks.push('tile'); } };
  const verify = { async click() { clicks.push('verify'); } };
  const frame = {
    url() { return 'https://www.google.com/recaptcha/api2/bframe?k=site'; },
    async evaluate(_fn, element) {
      if (element) return false;
      return { task: 'Select all images with cars', grid: '4x4', tileCount: 1, selected: [false] };
    },
    async $(selector) {
      if (String(selector).includes('verify')) return verify;
      return { async screenshot() { return 'grid-image'; } };
    },
    async $$() { return [tile]; }
  };
  await solveRecaptchaOnPage({
    page: { frames() { return imageVisible ? [frame] : []; }, async evaluate() {} },
    info: { sitekey: 'site', url: 'https://example.test/captcha', iframeSrc: '' },
    apiKey: 'sheet-key',
    isSolved: async () => false,
    now: () => now,
    wait: async milliseconds => {
      now += milliseconds;
      imageVisible = now >= 15000;
    },
    post: async ({ payload }) => {
      calls.push(payload.type);
      if (payload.type === 'recaptchav2') return new Promise(() => {});
      return { captcha: '[true]' };
    }
  });
  assert.ok(now >= 15000);
  assert.ok(now < CAPTCHA_SLOW_MS);
  assert.equal(calls.includes('compleximagetask'), true);
  assert.deepEqual(clicks, ['tile', 'verify']);
});

test('a token that arrives at 20s is used without waiting out the image deadline', async () => {
  let now = 0;
  let solved = false;
  await solveRecaptchaOnPage({
    page: {
      frames() { return []; },
      async evaluate() { solved = true; }
    },
    info: { sitekey: 'site', url: 'https://example.test/captcha', iframeSrc: '' },
    apiKey: 'sheet-key',
    isSolved: async () => solved,
    now: () => now,
    wait: async milliseconds => { now += milliseconds; },
    post: async () => {
      now += 20000;
      return { captcha: 'slow-token' };
    }
  });
  assert.ok(now >= 20000);
  assert.ok(now < 30000);
});

test('a captcha solver response at 150s is kept and a silent solver is cut at 180s', async t => {
  t.mock.timers.enable(['setTimeout']);
  let finish;
  const pending = solveRecaptchaToken({
    key: 'sheet-key',
    sitekey: 'site',
    pageurl: 'https://example.test/captcha',
    fetchImpl: (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
      finish = () => resolve({
        status: 200,
        async text() { return JSON.stringify({ success: true, captcha: 'late-token' }); }
      });
    })
  });
  t.mock.timers.tick(150000);
  finish();
  assert.equal((await pending).captcha, 'late-token');

  let aborted = false;
  const hung = solveRecaptchaToken({
    key: 'sheet-key',
    sitekey: 'site',
    pageurl: 'https://example.test/captcha',
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted = true;
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    })
  });
  t.mock.timers.tick(179000);
  await Promise.resolve();
  assert.equal(aborted, false);
  t.mock.timers.tick(1000);
  await assert.rejects(hung, /hết thời gian chờ/);
  assert.equal(aborted, true);
  assert.equal(CAPTCHA_SLOW_MS, 180000);
});
