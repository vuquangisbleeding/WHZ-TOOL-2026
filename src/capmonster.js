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
  if (data.errorId) throw new Error(data.errorDescription || data.errorCode || 'CapMonster từ chối task');
  return data;
}

async function applyRecaptchaToken(page, token) {
  await page.evaluate(value => {
    for (const element of document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response')) {
      element.value = value;
    }
    const clients = window.___grecaptcha_cfg?.clients;
    const seen = new Set();
    const visit = (node, depth) => {
      if (!node || typeof node !== 'object' || seen.has(node) || depth > 6) return;
      seen.add(node);
      if (typeof node.callback === 'function') node.callback(value);
      for (const child of Object.values(node)) visit(child, depth + 1);
    };
    visit(clients, 0);
  }, token);
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
  onUpdate('task', { taskId: created.taskId, type: task.type });
  const startedAt = Date.now();
  while (!isCancelled() && Date.now() - startedAt < 120000) {
    await sleep(1000);
    if (isCancelled()) return;
    const result = await capmonsterPost('getTaskResult', { taskId: created.taskId });
    if (result.status !== 'ready') continue;
    const token = result.solution?.gRecaptchaResponse || '';
    if (!token) throw new Error('CapMonster không trả token');
    if (isCancelled()) return;
    await applyRecaptchaToken(page, token);
    onUpdate('ready', { taskId: created.taskId, tokenLength: token.length, elapsedMs: Date.now() - startedAt });
    return;
  }
  if (!isCancelled()) throw new Error('CapMonster hết 120 giây');
}

module.exports = { buildRecaptchaTask, solveRecaptchaV2 };
