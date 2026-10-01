const crypto = require('node:crypto');
const config = require('./config');
const { sleep, formatDuration } = require('./timing');
const { firstExisting, firstVisible } = require('./dom');
const selectors = require('./selectors/actions');
const { isStopRequested } = require('./stop');
const { noteCaptcha } = require('./browser');

const captchaStats = { count: 0, totalMs: 0 };

async function readCaptchaInfo(page) {
  return page.evaluate(() => {
    const widget = document.querySelector('.g-recaptcha, [data-sitekey]');
    const iframe = [...document.querySelectorAll('iframe[src*="captcha"], iframe[src*="recaptcha"]')].find(element => element.src);
    return {
      type: iframe?.src.includes('recaptcha') || widget?.classList.contains('g-recaptcha') ? 'recaptcha' : 'captcha',
      sitekey: widget?.getAttribute('data-sitekey') || '',
      widgetId: widget?.id || '',
      iframeSrc: iframe?.src || '',
      url: location.href
    };
  }).catch(() => ({ type: 'unknown', sitekey: '', widgetId: '', iframeSrc: '', url: '' }));
}

function getCaptchaId(info) {
  return crypto.createHash('sha1').update(`${info.url}|${info.sitekey}|${info.widgetId}|${info.iframeSrc}`).digest('hex').slice(0, 12);
}

function accountIndexFromLabel(label) {
  const match = String(label).match(/account (\d+)/);
  return match ? Number(match[1]) - 1 : -1;
}

function logCaptcha(label, id, status, details = {}) {
  const values = Object.entries(details).map(([key, value]) => `${key}=${JSON.stringify(String(value))}`).join(' ');
  console.log(`[${label}] CAPTCHA id=${id} status=${status}${values ? ` ${values}` : ''}`);
}

async function hasCaptcha(page) {
  return page.evaluate(() => Boolean(/\/rs-captcha|\/captcha/i.test(location.href) ||
    document.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], .g-recaptcha') ||
    /captcha|i'm not a robot/i.test(document.body?.innerText || '')));
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

async function clickRecaptchaCheckbox(page) {
  if (page.frames().some(frame => isRecaptchaChallenge(frame.url()))) return 'challenge';
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
    const response = [...document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response')]
      .some(element => element.value.trim().length > 0);
    const checked = Boolean(document.querySelector('.recaptcha-checkbox-checked, [aria-checked="true"]'));
    const captchaUrl = /\/rs-captcha|\/captcha/i.test(location.href);
    return response || checked || (!captchaUrl && !document.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], .g-recaptcha'));
  }).catch(() => false);
}

async function pauseForCaptcha(page, label, stats = null) {
  if (!await hasCaptcha(page)) return;
  const info = await readCaptchaInfo(page);
  const id = getCaptchaId(info);
  const startedAt = Date.now();
  logCaptcha(label, id, 'FOUND', { type: info.type, sitekey: info.sitekey, widget_id: info.widgetId, url: info.url });
  noteCaptcha(accountIndexFromLabel(label), id);
  try {
    captchaStats.count += 1;
    let nextClickAt = startedAt;
    while (!isStopRequested()) {
      if (await isCaptchaSolved(page)) {
        const duration = Date.now() - startedAt;
        captchaStats.totalMs += duration;
        if (stats) stats.captchaMs += duration;
        logCaptcha(label, id, 'SOLVED', { elapsed_ms: duration, duration: formatDuration(duration), result: 'solved' });
        const submitSelector = await firstVisible(page, selectors.submit);
        if (!submitSelector) throw new Error('CAPTCHA đã giải nhưng không tìm thấy nút SUBMIT đang hiển thị');
        const submitState = await page.$eval(submitSelector, element => ({
          disabled: Boolean(element.disabled),
          id: element.id || '',
          value: element.value || element.textContent?.trim() || ''
        }));
        if (submitState.disabled) throw new Error(`Nút SUBMIT đang disabled: ${submitSelector}`);
        console.log(`[${label}] CAPTCHA solved, click SUBMIT selector=${submitSelector} id=${submitState.id}`);
        // Chờ navigation thật sự để vòng wizard không click lại trên context cũ.
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
          page.$eval(submitSelector, element => {
            element.focus();
            element.click();
          })
        ]);
        logCaptcha(label, id, 'SUBMIT_SENT', { elapsed_ms: Date.now() - startedAt, result: 'submit_clicked' });
        return;
      }
      if (Date.now() >= nextClickAt) {
        const checkbox = await clickRecaptchaCheckbox(page);
        if (checkbox === 'clicked') logCaptcha(label, id, 'CHECKBOX_CLICKED', { elapsed_ms: Date.now() - startedAt });
        nextClickAt = Date.now() + 2000;
      }
      await sleep(config.captchaPollMs);
    }
    throw new Error('Đã yêu cầu dừng khi đang chờ CAPTCHA');
  } catch (error) {
    logCaptcha(label, id, 'FAILED', { elapsed_ms: Date.now() - startedAt, result: 'failed', message: error.message });
    throw error;
  } finally {
    noteCaptcha(accountIndexFromLabel(label), '');
  }
}

module.exports = { hasCaptcha, isDeclarationUi, isRecaptchaAnchor, pauseForCaptcha, captchaStats };