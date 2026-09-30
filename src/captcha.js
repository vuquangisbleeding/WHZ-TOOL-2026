const config = require('./config');
const { sleep, formatDuration } = require('./timing');
const { firstExisting, firstVisible } = require('./dom');
const selectors = require('./selectors/actions');
const { normalizeProxy } = require('./browser');

const captchaStats = { count: 0, totalMs: 0 };

async function hasCaptcha(page) {
  return page.evaluate(() => Boolean(/\/rs-captcha|\/captcha/i.test(location.href) ||
    document.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], .g-recaptcha') ||
    /captcha|i'm not a robot/i.test(document.body?.innerText || '')));
}

async function isDeclarationUi(page) {
  return Boolean(await firstVisible(page, selectors.submit) && await page.$('input[type="checkbox"], [role="checkbox"]'));
}

async function triggerCaptchaSolver(page, label) {
  await page.waitForSelector('.captcha-solver', { timeout: 10000 }).catch(() => {});
  const button = await page.$('.captcha-solver[data-state="ready"], .captcha-solver:not([data-state])');
  if (button) await page.evaluate(element => element.click(), button).catch(() => {});
  console.log(`[${label}] CAPTCHA_AUTO_MODE extension sẽ tự giải`);
}

async function isRecaptchaV2(page) {
  return page.evaluate(() => Boolean(document.querySelector('.g-recaptcha[data-sitekey], iframe[src*="/recaptcha/api2/anchor"]'))).catch(() => false);
}

async function captchaApiRequest(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.captchaApiTimeoutMs);
  let response;
  try {
    response = await fetch('https://api.2captcha.com/' + payload.method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload.body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`2Captcha API timeout sau ${config.captchaApiTimeoutMs}ms`);
    throw new Error(`2Captcha API network error: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`2Captcha API HTTP ${response.status}`);
  const result = await response.json();
  if (result.errorId) throw new Error(`2Captcha API ${result.errorCode || result.errorDescription || 'error'}`);
  return result;
}

async function solveRecaptchaV2(page, label) {
  const captcha = await page.evaluate(() => {
    const widget = document.querySelector('.g-recaptcha[data-sitekey]');
    const iframe = [...document.querySelectorAll('iframe[src*="/recaptcha/api2/anchor"]')].find(element => element.src);
    let sitekey = widget?.getAttribute('data-sitekey') || '';
    if (!sitekey && iframe) {
      try { sitekey = new URL(iframe.src).searchParams.get('k') || ''; } catch {}
    }
    return { sitekey, websiteURL: location.href };
  });
  if (!captcha.sitekey) throw new Error('Không tìm thấy sitekey reCAPTCHA v2');
  if (!config.twoCaptchaApiKey) throw new Error('TWOCAPTCHA_API_KEY chưa được cấu hình trong file .env');

  const task = { type: 'RecaptchaV2TaskProxyless', websiteURL: captcha.websiteURL, websiteKey: captcha.sitekey };
  const proxy = normalizeProxy(page.captchaProxy);
  if (proxy?.username || proxy?.password) {
    const parsed = new URL(proxy.server);
    task.type = 'RecaptchaV2Task';
    task.proxyType = parsed.protocol === 'https:' ? 'https' : 'http';
    task.proxyAddress = parsed.hostname;
    task.proxyPort = Number(parsed.port);
    task.proxyLogin = proxy.username;
    task.proxyPassword = proxy.password;
  }
  const created = await captchaApiRequest({ method: 'createTask', body: { clientKey: config.twoCaptchaApiKey, task } });
  console.log(`[${label}] 2Captcha task created id=${created.taskId} mode=${task.type}`);
  const deadline = Date.now() + config.captchaTimeoutMs;
  let nextHeartbeatAt = Date.now() + 15000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const result = await captchaApiRequest({ method: 'getTaskResult', body: { clientKey: config.twoCaptchaApiKey, taskId: created.taskId } });
    if (result.status === 'ready' && result.solution?.gRecaptchaResponse) {
      const injected = await page.evaluate(token => {
        const widget = document.querySelector('.g-recaptcha');
        let field = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (!field) {
          field = document.createElement('textarea');
          field.name = 'g-recaptcha-response';
          field.id = 'g-recaptcha-response';
          field.style.display = 'none';
          (widget?.parentElement || document.body).appendChild(field);
        }
        field.value = token;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        const callbackName = widget?.getAttribute('data-callback');
        if (callbackName && typeof window[callbackName] === 'function') window[callbackName](token);
        return Boolean(field.value);
      }, result.solution.gRecaptchaResponse);
      if (!injected) throw new Error('Không thể inject token reCAPTCHA v2 vào trang');
      console.log(`[${label}] 2Captcha API trả token reCAPTCHA v2`);
      return;
    }
    if (result.status !== 'processing') throw new Error(`2Captcha task thất bại: ${result.status || 'unknown'}`);
    if (Date.now() >= nextHeartbeatAt) {
      console.log(`[${label}] 2Captcha task đang processing elapsed=${formatDuration(Date.now() - (deadline - config.captchaTimeoutMs))}`);
      nextHeartbeatAt += 15000;
    }
  }
  throw new Error(`2Captcha chưa trả token sau ${config.captchaTimeoutMs}ms`);
}

async function isCaptchaSolved(page) {
  return page.evaluate(() => {
    const solver = document.querySelector('.captcha-solver');
    if (solver) return solver.dataset.state === 'solved';
    const response = [...document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response')]
      .some(element => element.value.trim().length > 0);
    const checked = Boolean(document.querySelector('.recaptcha-checkbox-checked, [aria-checked="true"]'));
    const captchaUrl = /\/rs-captcha|\/captcha/i.test(location.href);
    return response || checked || (!captchaUrl && !document.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], .g-recaptcha'));
  }).catch(() => false);
}

async function pauseForCaptcha(page, label, stats = null) {
  if (!await hasCaptcha(page)) return;
  const startedAt = Date.now();
  captchaStats.count += 1;
  console.log(`[${label}] CAPTCHA detected, 2Captcha đang xử lý`);
  if (await isRecaptchaV2(page)) {
    await solveRecaptchaV2(page, label);
    const duration = Date.now() - startedAt;
    captchaStats.totalMs += duration;
    if (stats) stats.captchaMs += duration;
    return submitCaptcha(page, label);
  }
  await triggerCaptchaSolver(page, label);
  const deadline = startedAt + config.captchaTimeoutMs;
  let nextHeartbeatAt = startedAt + 5000;
  while (Date.now() < deadline) {
    if (await isCaptchaSolved(page)) {
      const duration = Date.now() - startedAt;
      captchaStats.totalMs += duration;
      if (stats) stats.captchaMs += duration;
      console.log(`[${label}] CAPTCHA solved duration=${formatDuration(duration)}`);
      await submitCaptcha(page, label);
      return;
    }
    if (Date.now() >= nextHeartbeatAt) {
      console.log(`[${label}] CAPTCHA vẫn đang chờ 2Captcha elapsed=${formatDuration(Date.now() - startedAt)}`);
      nextHeartbeatAt += 5000;
    }
    await sleep(config.captchaPollMs);
  }
  const duration = Date.now() - startedAt;
  captchaStats.totalMs += duration;
  if (stats) stats.captchaMs += duration;
  throw new Error(`CAPTCHA chưa được giải sau ${config.captchaTimeoutMs}ms. Kiểm tra API key hoặc reload extension.`);
}

async function submitCaptcha(page, label) {
  const submitSelector = await firstVisible(page, selectors.submit);
  if (!submitSelector) throw new Error('CAPTCHA đã giải nhưng không tìm thấy nút SUBMIT đang hiển thị');
  const submitState = await page.$eval(submitSelector, element => ({ disabled: Boolean(element.disabled), id: element.id || '' }));
  if (submitState.disabled) throw new Error(`Nút SUBMIT đang disabled: ${submitSelector}`);
  console.log(`[${label}] CAPTCHA solved, click SUBMIT selector=${submitSelector} id=${submitState.id}`);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
    page.$eval(submitSelector, element => { element.focus(); element.click(); })
  ]);
}

module.exports = { hasCaptcha, isDeclarationUi, pauseForCaptcha, captchaStats };