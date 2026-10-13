const crypto = require('node:crypto');
const config = require('./config');
const { sleep, waitForNextDocument, isContextGone } = require('./timing');
const { firstExisting, firstVisible } = require('./dom');
const selectors = require('./selectors/actions');
const { isStopRequested, waitIfPaused } = require('./stop');
const { accountProxy } = require('./browser');
const { solveCaptchaOnPage, showCaptchaKey, collectCaptchaSnapshot, classifyCaptcha, formatAutocaptchaProxy } = require('./autocaptcha');

const captchaStats = { count: 0 };

function accountIndexFromLabel(label) {
  const match = String(label || '').match(/account\s+(\d+)/i);
  return match ? Number(match[1]) - 1 : -1;
}

async function readCaptchaInfo(page) {
  const snapshot = await page.evaluate(collectCaptchaSnapshot).catch(() => null);
  if (!snapshot) return { type: 'unknown', kind: '', sitekey: '', widgetId: '', iframeSrc: '', url: '' };
  return classifyCaptcha(snapshot);
}

function getCaptchaId(info) {
  return crypto.createHash('sha1').update(`${info.url}|${info.sitekey}|${info.widgetId}|${info.iframeSrc}`).digest('hex').slice(0, 12);
}

function logCaptcha(label, id, status, details = {}) {
  const values = Object.entries(details).map(([key, value]) => `${key}=${JSON.stringify(String(value))}`).join(' ');
  console.log(`[${label}] CAPTCHA id=${id} status=${status}${values ? ` ${values}` : ''}`);
}

async function hasCaptcha(page) {
  const snapshot = await page.evaluate(collectCaptchaSnapshot).catch(() => null);
  if (!snapshot) return false;
  if (classifyCaptcha(snapshot).kind) return true;
  return /\/rs-captcha|\/captcha/i.test(snapshot.url || '') || /captcha|i'm not a robot/i.test(snapshot.text || '');
}

async function isDeclarationUi(page) {
  return Boolean(await firstVisible(page, selectors.submit) && await page.$('input[type="checkbox"], [role="checkbox"]'));
}

function isRecaptchaAnchor(url) {
  return /\/recaptcha\/(?:api2|enterprise)\/anchor/i.test(url || '');
}

function isRecaptchaChallenge(url) {
  return /\/recaptcha\/(?:api2|enterprise)\/bframe/i.test(url || '');
}

async function challengeImagesVisible(page) {
  for (const frame of page.frames()) {
    if (!isRecaptchaChallenge(frame.url())) continue;
    const image = await frame.$('.rc-imageselect-tile img').catch(() => null);
    if (image) return true;
  }
  return false;
}

async function clickRecaptchaCheckbox(page) {
  if (await challengeImagesVisible(page)) return 'challenge';
  for (const frame of page.frames()) {
    if (!isRecaptchaAnchor(frame.url())) continue;
    const anchor = await frame.$('#recaptcha-anchor').catch(() => null);
    if (!anchor) continue;
    const checked = await frame.evaluate(element => element.getAttribute('aria-checked') === 'true', anchor).catch(() => false);
    if (checked) return 'checked';
    const box = await anchor.boundingBox().catch(() => null);
    if (!box || box.width < 2 || box.height < 2) continue;
    await anchor.click({ delay: 40 });
    return 'clicked';
  }
  return 'not_found';
}

async function isCaptchaSolved(page) {
  return page.evaluate(() => {
    const filled = selector => [...document.querySelectorAll(selector)].some(element => String(element.value || '').trim().length > 0);
    const response = filled('textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response, textarea[name="h-captcha-response"], [name="cf-turnstile-response"], #FunCaptcha-Token, input[name="fc-token"], input[name="verification-token"], [name="mtcaptcha-verifiedtoken"], [name="pass_token"], [name="geetest_validate"], [name="geetest_seccode"]');
    const typed = Boolean(document.querySelector('[data-inz-captcha-answer="1"]'));
    const checked = Boolean(document.querySelector('.recaptcha-checkbox-checked, [aria-checked="true"]'));
    const captchaUrl = /\/rs-captcha|\/captcha/i.test(location.href);
    const widget = document.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"], iframe[src*="arkoselabs"], iframe[src*="funcaptcha"], .g-recaptcha, .h-captcha, .cf-turnstile');
    return response || typed || checked || (!captchaUrl && !widget);
  }).catch(() => false);
}

async function pauseForCaptcha(page, label, stats = null) {
  if (!await hasCaptcha(page)) return;
  const info = await readCaptchaInfo(page);
  info.proxy = formatAutocaptchaProxy(accountProxy(accountIndexFromLabel(label)));
  const id = getCaptchaId(info);
  logCaptcha(label, id, 'FOUND', { type: info.kind || info.type, sitekey: info.sitekey, widget_id: info.widgetId, url: info.url });
  const captchaJob = { cancelled: false };
  const solver = solveCaptchaOnPage({
    page,
    info,
    apiKey: config.capmonsterApiKey,
    source: config.capmonsterApiKeySource || 'whitelist',
    isCancelled: () => captchaJob.cancelled,
    isSolved: () => isCaptchaSolved(page),
    onUpdate: (status, details) => {
      logCaptcha(label, id, `AUTOCAPTCHA_${status.toUpperCase()}`, details);
      if (status === 'key' && details.key) page.evaluate(showCaptchaKey, details.key, details.source || '').catch(() => {});
    }
  }).catch(error => {
    if (!captchaJob.cancelled) logCaptcha(label, id, 'AUTOCAPTCHA_FAILED', { message: error.message });
  });
  try {
    captchaStats.count += 1;
    let opened = false;
    while (!isStopRequested()) {
      await waitIfPaused();
      if (isStopRequested()) break;
      if (await isCaptchaSolved(page)) {
        logCaptcha(label, id, 'SOLVED', { result: 'solved' });
        const submitSelector = await firstVisible(page, selectors.submit);
        if (!submitSelector) throw new Error('CAPTCHA đã giải nhưng không tìm thấy nút SUBMIT đang hiển thị');
        const submitState = await page.$eval(submitSelector, element => ({
          disabled: Boolean(element.disabled),
          id: element.id || '',
          value: element.value || element.textContent?.trim() || ''
        }));
        if (submitState.disabled) throw new Error(`Nút SUBMIT đang disabled: ${submitSelector}`);
        console.log(`[${label}] CAPTCHA solved, click SUBMIT selector=${submitSelector} id=${submitState.id}`);
        const previousUrl = await page.url();
        const nextDocument = waitForNextDocument(page, previousUrl);
        try {
          await page.$eval(submitSelector, element => {
            element.focus();
            element.click();
          });
        } catch (error) {
          if (!isContextGone(error)) {
            nextDocument.cancel();
            await nextDocument;
            throw error;
          }
        }
        if (!await nextDocument) return;
        logCaptcha(label, id, 'SUBMIT_SENT', { result: 'submit_clicked' });
        return;
      }
      if (!opened && info.kind && info.kind !== 'recaptcha_v2' && info.kind !== 'recaptcha') opened = true;
      if (!opened) {
        const checkbox = await clickRecaptchaCheckbox(page);
        if (checkbox === 'clicked' || checkbox === 'checked' || checkbox === 'challenge') opened = true;
        if (checkbox === 'clicked') logCaptcha(label, id, 'CHECKBOX_CLICKED');
      }
      await sleep(config.captchaPollMs);
    }
    throw new Error('Đã yêu cầu dừng khi đang chờ CAPTCHA');
  } catch (error) {
    if (!isStopRequested()) logCaptcha(label, id, 'FAILED', { result: 'failed', message: error.message });
    throw error;
  } finally {
    captchaJob.cancelled = true;
    solver.catch(() => {});
  }
}

module.exports = { hasCaptcha, isDeclarationUi, isRecaptchaAnchor, pauseForCaptcha, captchaStats };