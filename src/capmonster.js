const config = require('./config');
const { sleep } = require('./timing');

function buildRecaptchaTask({ websiteURL, websiteKey, iframeSrc = '', userAgent = '', proxy = null }) {
  const enterprise = /\/recaptcha\/enterprise\//i.test(iframeSrc);
  const task = {
    type: enterprise
      ? (proxy ? 'RecaptchaV2EnterpriseTask' : 'RecaptchaV2EnterpriseTaskProxyless')
      : (proxy ? 'RecaptchaV2Task' : 'RecaptchaV2TaskProxyless'),
    websiteURL,
    websiteKey
  };
  if (userAgent) task.userAgent = userAgent;
  if (proxy) {
    const endpoint = new URL(proxy.server);
    task.proxyType = endpoint.protocol === 'https:' ? 'https' : 'http';
    task.proxyAddress = endpoint.hostname;
    task.proxyPort = Number(endpoint.port);
    if (proxy.username) task.proxyLogin = proxy.username;
    if (proxy.password) task.proxyPassword = proxy.password;
  }
  return task;
}

function summarizeCapMonsterResponse(data = {}) {
  const token = data.solution?.gRecaptchaResponse;
  return {
    errorId: data.errorId ?? '',
    errorCode: data.errorCode || '',
    errorDescription: data.errorDescription || '',
    status: data.status || '',
    taskId: data.taskId || '',
    tokenLength: typeof token === 'string' ? token.length : 0
  };
}

function capMonsterError(data) {
  return data.errorDescription || data.errorCode || 'CapMonster từ chối task';
}

function capmonsterKeyPlan(primary, local) {
  return [...new Set([primary, local].map(value => String(value || '').trim()).filter(Boolean))];
}

function capmonsterKeyLabel(key, source) {
  const from = source === 'whitelist' ? 'whitelist' : 'cài đặt';
  return `CapMonster API key (${from}): ${key}`;
}

function showCapmonsterKey(key, source, root = globalThis) {
  const document = root.document;
  if (!document?.getElementById || !document.createElement) return;
  const id = 'inz-capmonster-key';
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement('div');
    box.id = id;
    box.setAttribute('style', 'position:fixed;z-index:2147483647;top:12px;right:12px;max-width:min(440px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:#111827;color:#fff;font:600 13px/1.45 ui-sans-serif,sans-serif;word-break:break-all;box-shadow:0 8px 24px rgba(0,0,0,.35)');
    (document.body || document.documentElement).appendChild(box);
  }
  const from = source === 'whitelist' ? 'whitelist' : 'cài đặt';
  box.textContent = `CapMonster API key (${from}): ${key}`;
}

function capmonsterKeySource(clientKey) {
  const sheet = String(config.capmonsterApiKey || '').trim();
  const local = String(config.capmonsterApiKeyLocal || '').trim();
  if (config.capmonsterApiKeySource === 'whitelist' && clientKey === sheet) return 'whitelist';
  if (clientKey && clientKey === local) return 'env';
  return config.capmonsterApiKeySource || 'env';
}

function shouldTryNextCapmonsterKey(errorCode, index, planLength) {
  return errorCode === 'ERROR_KEY_DOES_NOT_EXIST' && index < planLength - 1;
}

async function capmonsterPost(method, body, clientKey = config.capmonsterApiKey) {
  const response = await fetch(`https://api.capmonster.cloud/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientKey, ...body })
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`CapMonster HTTP ${response.status}`);
  }
  return data;
}

function injectRecaptchaToken(token, root = globalThis) {
  for (const element of root.document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response')) {
    element.value = token;
  }
  const clients = root.___grecaptcha_cfg?.clients;
  const seen = new Set();
  const visit = (node, depth) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 6) return;
    seen.add(node);
    let callback;
    try {
      callback = node.callback;
    } catch {
      return;
    }
    if (typeof callback === 'function') {
      try { callback(token); } catch { /* callback của widget có thể chạm frame khác origin */ }
    }
    let children;
    try {
      children = Object.values(node);
    } catch {
      return;
    }
    for (const child of children) visit(child, depth + 1);
  };
  visit(clients, 0);
}

async function applyRecaptchaToken(page, token) {
  await page.evaluate(injectRecaptchaToken, token);
}

const CAPMONSTER_POLL_MS = 250;
const CAPMONSTER_DEADLINE_MS = 120000;

async function solveRecaptchaV2({ page, info, proxy = null, isCancelled = () => false, onUpdate = () => {}, post = capmonsterPost, wait = sleep, pollMs = CAPMONSTER_POLL_MS, deadlineMs = CAPMONSTER_DEADLINE_MS, now = Date.now }) {
  if (!config.capmonsterApiKey) {
    onUpdate('skip', { reason: 'missing_api_key' });
    return;
  }
  if (!info.sitekey) throw new Error('Không có sitekey để gửi CapMonster');
  const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => '');
  const task = buildRecaptchaTask({
    websiteURL: info.url,
    websiteKey: info.sitekey,
    iframeSrc: info.iframeSrc,
    userAgent,
    proxy
  });
  const keys = capmonsterKeyPlan(config.capmonsterApiKey, config.capmonsterApiKeyLocal);
  let created;
  let clientKey = keys[0] || '';
  for (let index = 0; index < keys.length; index += 1) {
    clientKey = keys[index];
    onUpdate('key', { source: capmonsterKeySource(clientKey), key: clientKey });
    created = await post('createTask', { task }, clientKey);
    onUpdate('response', { method: 'createTask', type: task.type, ...summarizeCapMonsterResponse(created) });
    if (!created.errorId) break;
    if (!shouldTryNextCapmonsterKey(created.errorCode, index, keys.length)) throw new Error(capMonsterError(created));
    onUpdate('fallback', { reason: 'sheet_key_rejected' });
  }
  if (!created || created.errorId) throw new Error(capMonsterError(created || {}));
  const startedAt = now();
  let lastStatus = '';
  while (!isCancelled() && now() - startedAt < deadlineMs) {
    const result = await post('getTaskResult', { taskId: created.taskId }, clientKey);
    const summary = summarizeCapMonsterResponse(result);
    lastStatus = summary.status;
    onUpdate('response', { method: 'getTaskResult', ...summary });
    if (result.errorId) throw new Error(capMonsterError(result));
    if (result.status === 'ready') {
      const token = result.solution?.gRecaptchaResponse || '';
      if (!token) throw new Error('CapMonster không trả token');
      if (isCancelled()) {
        onUpdate('cancelled', { taskId: created.taskId, status: 'ready' });
        return;
      }
      await applyRecaptchaToken(page, token);
      onUpdate('ready', { taskId: created.taskId, tokenLength: token.length, elapsedMs: now() - startedAt });
      return;
    }
    await wait(pollMs);
  }
  if (!isCancelled()) throw new Error('CapMonster hết 120 giây');
}

module.exports = { buildRecaptchaTask, injectRecaptchaToken, summarizeCapMonsterResponse, capmonsterKeyPlan, capmonsterKeyLabel, showCapmonsterKey, capmonsterKeySource, shouldTryNextCapmonsterKey, solveRecaptchaV2 };
