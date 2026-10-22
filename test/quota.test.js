const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const { detectPage } = require('../src/detect');
const { isQuotaClosedText, refreshUntilSubmit } = require('../src/quota');

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
    'There is no longer a place available for you',
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
    body: 'Submit\nThere is no longer a place available for you',
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

test('a full quota refreshes the same final page and clicks submit only after that reload shows the button', async () => {
  const previousPoll = config.countryPollMs;
  config.countryPollMs = 0;
  const page = {
    href: 'https://example.test/wizard/submit.aspx',
    body: 'There is no longer a place available for you',
    submitReady: false,
    clicks: 0,
    gotos: [],
    reloads: [],
    release: null,
    url() { return page.href; },
    async goto(url) { page.gotos.push(url); },
    async reload(options = {}) {
      page.reloads.push({ timeout: options.timeout, url: page.href });
      if (page.reloads.length < 2) return;
      await new Promise(resolve => {
        page.release = () => {
          page.body = 'Submit your application';
          page.submitReady = true;
          resolve();
        };
      });
    },
    async evaluate(fn, ...args) {
      const source = Function.prototype.toString.call(fn);
      if (source.includes('changed')) return { href: page.href, ready: true, changed: page.href !== args[0] };
      if (source.includes('readyState')) return true;
      if (source.includes('element.click')) {
        page.clicks += 1;
        page.href = 'https://example.test/wizard/submitted';
        return undefined;
      }
      if (source.includes('innerText') || source.includes('location.href')) return `${page.href} ${page.body}`;
      throw new Error(`unexpected evaluate: ${source.slice(0, 160)}`);
    },
    async $(selector) {
      if (!page.submitReady || !String(selector).toLowerCase().includes('submit')) return null;
      return { async evaluate() { return { visible: true, disabled: false, value: 'SUBMIT', id: 'submitButton' }; } };
    }
  };
  try {
    const pending = refreshUntilSubmit(page, 'run', { captchaMs: 0 });
    const started = Date.now();
    while (!page.release && Date.now() - started < 2000) await Promise.resolve();
    assert.ok(page.release, 'the slow reload should still be in flight');
    assert.equal(page.clicks, 0);
    assert.deepEqual(page.gotos, []);
    assert.equal(page.href, 'https://example.test/wizard/submit.aspx');
    assert.ok(page.reloads.length >= 1);
    assert.ok(page.reloads.every(item => item.timeout === 0 && item.url === 'https://example.test/wizard/submit.aspx'));
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    const releasedAt = Date.now();
    page.release();
    assert.equal(await pending, 'submitted');
    assert.equal(page.clicks, 1);
    assert.equal(page.gotos.length, 0);
    assert.ok(Date.now() - releasedAt < 1000);
  } finally {
    config.countryPollMs = previousPoll;
  }
});
