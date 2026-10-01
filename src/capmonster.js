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

async function capmonsterPost(method, body) {
  const response = await fetch(`https://api.capmonster.cloud/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientKey: config.capmonsterApiKey, ...body })
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

async function solveRecaptchaV2({ page, info, proxy = null, isCancelled = () => false, onUpdate = () => {} }) {
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
  const created = await capmonsterPost('createTask', { task });
  onUpdate('response', { method: 'createTask', type: task.type, ...summarizeCapMonsterResponse(created) });
  if (created.errorId) throw new Error(capMonsterError(created));
  const startedAt = Date.now();
  let lastStatus = '';
  while (!isCancelled() && Date.now() - startedAt < 120000) {
    await sleep(1000);
    if (isCancelled()) {
      onUpdate('cancelled', { taskId: created.taskId, status: lastStatus });
      return;
    }
    const result = await capmonsterPost('getTaskResult', { taskId: created.taskId });
    const summary = summarizeCapMonsterResponse(result);
    lastStatus = summary.status;
    onUpdate('response', { method: 'getTaskResult', ...summary });
    if (result.errorId) throw new Error(capMonsterError(result));
    if (result.status !== 'ready') continue;
    const token = result.solution?.gRecaptchaResponse || '';
    if (!token) throw new Error('CapMonster không trả token');
    if (isCancelled()) {
      onUpdate('cancelled', { taskId: created.taskId, status: 'ready' });
      return;
    }
    await applyRecaptchaToken(page, token);
    onUpdate('ready', { taskId: created.taskId, tokenLength: token.length, elapsedMs: Date.now() - startedAt });
    return;
  }
  if (!isCancelled()) throw new Error('CapMonster hết 120 giây');
}

module.exports = { buildRecaptchaTask, injectRecaptchaToken, summarizeCapMonsterResponse, solveRecaptchaV2 };
