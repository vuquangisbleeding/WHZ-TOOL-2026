const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const { detectPage } = require('../src/detect');
const { isQuotaClosedText } = require('../src/quota');
const { resumeWhenSchemeReopens } = require('../src/entry');

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

test('a full quota is recognised from the final-page messages', () => {
  for (const message of [
    'There are no places available',
    'There are no places left',
    'There are no places for this scheme',
    'The quota has been filled',
    'The quota is closed',
    'Applications are no longer being accepted',
    'The scheme is now closed'
  ]) {
    assert.equal(isQuotaClosedText(message), true, message);
  }
});

test('a country card that only says CLOSED is not treated as a full quota', () => {
  assert.equal(isQuotaClosedText('JAPAN CLOSED'), false);
  assert.equal(isQuotaClosedText('Working Holiday Visa CLOSED'), false);
  assert.equal(isQuotaClosedText('Family name\nGiven name\nSave and continue'), false);
});

test('the final page is quota closed even when the form fields are still on screen', async () => {
  const page = fakePage({
    url: 'https://onlineservices.immigration.govt.nz/WorkingHoliday/Wizard/Submit.aspx',
    body: 'Submit\nThere are no places left for this scheme',
    selectors: ['familyName']
  });
  assert.equal(await detectPage(page), 'quota_closed');
});

test('a normal form page stays a form page', async () => {
  const page = fakePage({
    url: 'https://onlineservices.immigration.govt.nz/WorkingHoliday/Wizard/Personal1.aspx',
    body: 'Family name',
    selectors: ['familyName']
  });
  assert.equal(await detectPage(page), 'personal1');
});

test('a full quota on the last page goes back to the scheme list and clicks only after a slow reload shows OPEN', async () => {
  const previousPoll = config.countryPollMs;
  const previousBackoff = config.highLoadBackoffMs;
  const previousCountry = config.schemeCountry;
  const previousLogin = config.loginUrl;
  config.countryPollMs = 0;
  config.highLoadBackoffMs = 0;
  config.schemeCountry = 'Japan';
  config.loginUrl = 'https://example.test/login?WHS';
  const page = {
    href: 'https://example.test/submit',
    body: 'There are no places left',
    mode: 'quota',
    open: false,
    clicks: 0,
    gotos: [],
    reloads: [],
    release: null,
    url() { return page.href; },
    async goto(url, options = {}) {
      page.gotos.push({ url, timeout: options.timeout });
      page.mode = 'list';
      page.href = url;
      page.body = 'JAPAN CLOSED';
    },
    async reload(options = {}) {
      page.reloads.push(options.timeout);
      if (page.reloads.length < 3) return;
      await new Promise(resolve => {
        page.release = () => {
          page.open = true;
          page.body = 'JAPAN OPEN';
          resolve();
        };
      });
    },
    async waitForFunction() {},
    async evaluate(fn, ...args) {
      const source = Function.prototype.toString.call(fn);
      if (source.includes('countryName')) {
        return page.open
          ? { found: true, open: true, cardText: 'JAPAN OPEN', linkId: 'createLink' }
          : { found: true, open: false, cardText: 'JAPAN CLOSED' };
      }
      if (source.includes('Existing Applications')) return false;
      if (source.includes('changed')) return { href: page.href, ready: true, changed: page.href !== args[0] };
      if (source.includes('readyState')) return true;
      if (source.includes('getElementById')) {
        page.clicks += 1;
        page.href = 'https://example.test/create';
        return undefined;
      }
      if (source.includes('element.click')) {
        page.clicks += 1;
        page.href = 'https://example.test/apply';
        return undefined;
      }
      if (source.includes('innerText') || source.includes('location.href')) return `${page.href} ${page.body}`;
      throw new Error(`unexpected evaluate: ${source.slice(0, 160)}`);
    },
    async $(selector) {
      const text = String(selector);
      if (text.includes('username')) return null;
      if (text.includes('countryName')) return page.mode === 'list' ? {} : null;
      if (text.includes('applyNow') && page.clicks > 0) {
        return { async evaluate() { return { visible: true, disabled: false, value: 'APPLY NOW', id: 'apply' }; } };
      }
      return null;
    }
  };
  try {
    const pending = resumeWhenSchemeReopens(page, { scheme_country: 'Japan' }, 'run', { captchaMs: 0 });
    const started = Date.now();
    while (!page.release && Date.now() - started < 2000) await Promise.resolve();
    assert.ok(page.release, 'the slow reload should still be in flight');
    assert.equal(page.clicks, 0);
    assert.deepEqual(page.gotos, [{ url: 'https://example.test/login?WHS', timeout: 0 }]);
    assert.ok(page.reloads.length >= 1);
    assert.ok(page.reloads.every(timeout => timeout === 0));
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    const releasedAt = Date.now();
    page.release();
    const result = await pending;
    assert.equal(typeof result.startedAt, 'number');
    assert.ok(page.clicks >= 1);
    assert.ok(Date.now() - releasedAt < 1000);
  } finally {
    config.countryPollMs = previousPoll;
    config.highLoadBackoffMs = previousBackoff;
    config.schemeCountry = previousCountry;
    config.loginUrl = previousLogin;
  }
});
