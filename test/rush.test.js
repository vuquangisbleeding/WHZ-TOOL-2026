const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const { selectSchemeCountry } = require('../src/entry');
const { isHighLoadPage, recoverHighLoad } = require('../src/recovery');
const { solveRecaptchaV2 } = require('../src/capmonster');

function countryPage() {
  const listeners = new Map();
  const page = {
    href: 'https://example.test/list',
    marker: 'country-list',
    body: 'Working Holiday schemes',
    open: false,
    clicks: 0,
    reloads: [],
    release: null,
    mainFrame() { return page; },
    url() { return page.href; },
    on(event, fn) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
    },
    off(event, fn) {
      listeners.set(event, (listeners.get(event) || []).filter(item => item !== fn));
    },
    async evaluate(fn, ...args) {
      const source = Function.prototype.toString.call(fn);
      if (source.includes('countryName')) {
        return page.open
          ? { found: true, open: true, cardText: 'JAPAN OPEN', linkId: 'createLink' }
          : { found: true, open: false, cardText: 'JAPAN CLOSED' };
      }
      if (source.includes('changed')) {
        return { href: page.href, ready: true, changed: page.href !== args[0] || page.marker !== args[1] };
      }
      if (source.includes('readyState')) return true;
      if (source.includes('slice(0, 500)')) return page.marker;
      if (source.includes('captcha') || source.includes('robot')) return false;
      if (source.includes('getElementById')) {
        page.clicks += 1;
        page.href = 'https://example.test/create';
        return undefined;
      }
      if (source.includes('innerText')) return page.body;
      throw new Error(`unexpected evaluate: ${source}`);
    },
    reload(options = {}) {
      page.reloads.push(options.timeout);
      if (page.reloads.length < 5) return Promise.resolve();
      return new Promise(resolve => {
        page.release = () => {
          page.open = true;
          resolve();
        };
      });
    }
  };
  return page;
}

test('a country that stays closed is clicked on the refresh that first shows OPEN, even when that refresh is slow', async () => {
  const previousPoll = config.countryPollMs;
  const previousBackoff = config.highLoadBackoffMs;
  config.countryPollMs = 0;
  config.highLoadBackoffMs = 0;
  const page = countryPage();
  try {
    const pending = selectSchemeCountry(page, 'Japan', 'run');
    const started = Date.now();
    while (!page.release && Date.now() - started < 1000) {
      await Promise.resolve();
    }
    assert.ok(page.release);
    assert.equal(page.clicks, 0);
    assert.ok(page.reloads.every(timeout => timeout === 0));
    let settled = false;
    pending.then(() => { settled = true; });
    for (let step = 0; step < 20; step += 1) await Promise.resolve();
    assert.equal(settled, false);
    page.release();
    const selectedAt = await pending;
    assert.equal(typeof selectedAt, 'number');
    assert.equal(page.clicks, 1);
    assert.ok(Date.now() - selectedAt < 500);
  } finally {
    config.countryPollMs = previousPoll;
    config.highLoadBackoffMs = previousBackoff;
  }
});

test('a slow high-load page is read and refreshed without the old 1s or 8s cutoff', async () => {
  let release;
  const slowPage = {
    evaluate() {
      return new Promise(resolve => { release = resolve; });
    }
  };
  let settled = 'pending';
  const pending = isHighLoadPage(slowPage).then(value => { settled = value; return value; });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(settled, 'pending');
  release('The site is under high load. Please try again later.');
  assert.equal(await pending, true);

  const previousBackoff = config.highLoadBackoffMs;
  const previousCooldown = config.highLoadCooldownMs;
  config.highLoadBackoffMs = 0;
  config.highLoadCooldownMs = 0;
  const page = {
    body: 'site is under high load',
    reloads: [],
    async evaluate() { return page.body; },
    async reload(options = {}) {
      page.reloads.push(options.timeout);
      page.body = 'Working Holiday Japan is listed';
    }
  };
  try {
    assert.equal(await recoverHighLoad(page, 'run'), false);
    assert.deepEqual(page.reloads, [0]);
  } finally {
    config.highLoadBackoffMs = previousBackoff;
    config.highLoadCooldownMs = previousCooldown;
  }
});

test('the first high-load refresh starts at once and the next one waits', async () => {
  const previousBackoff = config.highLoadBackoffMs;
  config.highLoadBackoffMs = 200;
  const started = Date.now();
  const page = {
    body: 'site is under high load',
    reloads: [],
    async evaluate() { return page.body; },
    async reload(options = {}) {
      page.reloads.push({ timeout: options.timeout, at: Date.now() - started });
      if (page.reloads.length >= 2) page.body = 'Working Holiday Japan is listed';
    }
  };
  try {
    assert.equal(await recoverHighLoad(page, 'run'), false);
    assert.equal(page.reloads.length, 2);
    assert.equal(page.reloads[0].timeout, 0);
    assert.ok(page.reloads[0].at < 80);
    assert.ok(page.reloads[1].at >= 180);
  } finally {
    config.highLoadBackoffMs = previousBackoff;
  }
});

test('a captcha that becomes ready at 60 seconds is applied on that response', async () => {
  const previousKey = config.capmonsterApiKey;
  const previousLocal = config.capmonsterApiKeyLocal;
  const previousSource = config.capmonsterApiKeySource;
  config.capmonsterApiKey = 'b'.repeat(32);
  config.capmonsterApiKeyLocal = '';
  config.capmonsterApiKeySource = 'whitelist';
  let now = 0;
  const applied = [];
  const page = {
    async evaluate(fn, token) {
      const source = Function.prototype.toString.call(fn);
      if (source.includes('userAgent')) return 'TestAgent';
      applied.push(token);
    }
  };
  try {
    await solveRecaptchaV2({
      page,
      info: { sitekey: 'site-key', url: 'https://example.test/captcha', iframeSrc: '' },
      post: async method => {
        if (method === 'createTask') return { errorId: 0, taskId: 7 };
        if (now < 60000) return { errorId: 0, status: 'processing' };
        return { errorId: 0, status: 'ready', solution: { gRecaptchaResponse: 'token-value' } };
      },
      wait: async milliseconds => { now += milliseconds; },
      now: () => now,
      onUpdate(status, details) {
        if (status === 'key') applied.push(`key:${details.source}:${details.key}`);
      }
    });
    assert.deepEqual(applied, [`key:whitelist:${'b'.repeat(32)}`, 'token-value']);
    assert.ok(now >= 60000);
    assert.ok(now < 60250);

    now = 0;
    await assert.rejects(() => solveRecaptchaV2({
      page,
      info: { sitekey: 'site-key', url: 'https://example.test/captcha', iframeSrc: '' },
      post: async method => method === 'createTask' ? { errorId: 0, taskId: 8 } : { errorId: 0, status: 'processing' },
      wait: async milliseconds => { now += milliseconds; },
      now: () => now,
      onUpdate() {}
    }), /120 giây/);
    assert.ok(now >= 120000);
  } finally {
    config.capmonsterApiKey = previousKey;
    config.capmonsterApiKeyLocal = previousLocal;
    config.capmonsterApiKeySource = previousSource;
  }
});
