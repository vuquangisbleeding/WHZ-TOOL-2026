const puppeteer = require('puppeteer');
const config = require('./config');
const { fs, path } = require('./io');
const { startAuthProxy } = require('./proxy-forward');

function normalizeProxy(proxy) {
  if (!proxy) return null;

  if (typeof proxy === 'string') {
    const raw = proxy.trim();
    const hasScheme = raw.includes('://');

    if (hasScheme) {
      const parsed = new URL(raw);
      const port = parsed.port || (parsed.protocol === 'https:' ? '443' : parsed.protocol === 'http:' ? '80' : '');
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !port) throw new Error(`Proxy không hợp lệ: ${raw}`);
      return {
        server: `${parsed.protocol}//${parsed.hostname}:${port}`,
        username: parsed.username ? decodeURIComponent(parsed.username) : '',
        password: parsed.password ? decodeURIComponent(parsed.password) : ''
      };
    }

    const parts = raw.split(':');
    if (parts.length >= 4) {
      const [host, port, username, ...rest] = parts;
      const passwordWithMeta = rest.join(':');
      const password = passwordWithMeta.split('_')[0];
      if (host && port && username && password) {
        return {
          server: `http://${host}:${port}`,
          username: decodeURIComponent(username),
          password: decodeURIComponent(password)
        };
      }
    }

    const parsed = new URL(`http://${raw}`);
    const port = parsed.port || '80';
    return {
      server: `http://${parsed.hostname}:${port}`,
      username: '',
      password: ''
    };
  }

  if (proxy && typeof proxy === 'object') {
    const input = proxy;
    if (!input.server || typeof input.server !== 'string') throw new Error('proxy phải là chuỗi hoặc object có server');
    const parsed = new URL(input.server.includes('://') ? input.server : `http://${input.server}`);
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : parsed.protocol === 'http:' ? '80' : '');
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !port) throw new Error(`Proxy không hợp lệ: ${input.server}`);
    return {
      server: `${parsed.protocol}//${parsed.hostname}:${port}`,
      username: input.username || (parsed.username ? decodeURIComponent(parsed.username) : ''),
      password: input.password || (parsed.password ? decodeURIComponent(parsed.password) : '')
    };
  }

  throw new Error('proxy không hợp lệ');
}

function maskApiKey(apiKey) {
  const value = String(apiKey || '');
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

const activeCaptchaIds = new Map();
const captchaModes = new Map();
const accountProxies = new Map();

function noteCaptcha(accountIndex, id) {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) return;
  if (id) activeCaptchaIds.set(accountIndex, id);
  else activeCaptchaIds.delete(accountIndex);
}

function noteCaptchaMode(accountIndex, mode) {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) return;
  captchaModes.set(accountIndex, mode === 'token' ? 'token' : 'click');
}

function captchaMode(accountIndex) {
  return captchaModes.get(accountIndex) || 'click';
}

function noteAccountProxy(accountIndex, proxy) {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) return;
  const normalized = normalizeProxy(proxy);
  if (normalized) accountProxies.set(accountIndex, normalized);
  else accountProxies.delete(accountIndex);
}

function accountProxy(accountIndex) {
  return accountProxies.get(accountIndex) || null;
}

function capsolverEndpoint(url) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)capsolver\.com$/i.test(parsed.hostname)) return '';
    return parsed.pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

function summarizeCapSolverBody(body) {
  let data;
  try { data = JSON.parse(body); } catch {
    return { errorId: '', errorCode: '', errorDescription: String(body || '').slice(0, 300), status: '', taskId: '', solution: '' };
  }
  const solution = data.solution && typeof data.solution === 'object'
    ? Object.entries(data.solution).map(([key, value]) => `${key}:${typeof value === 'string' ? `len${value.length}` : typeof value}`).join(',')
    : '';
  return {
    errorId: data.errorId ?? '',
    errorCode: data.errorCode || '',
    errorDescription: data.errorDescription || '',
    status: data.status || '',
    taskId: data.taskId || '',
    solution
  };
}

function logCapSolverResult(accountIndex, endpoint, httpStatus, body) {
  const summary = summarizeCapSolverBody(body);
  const captchaId = activeCaptchaIds.get(accountIndex) || '-';
  console.log(`[account ${accountIndex + 1}] CAPSOLVER_RESULT captcha_id=${captchaId} endpoint=${endpoint} http=${httpStatus} errorId=${JSON.stringify(String(summary.errorId))} errorCode=${JSON.stringify(summary.errorCode)} errorDescription=${JSON.stringify(summary.errorDescription)} status=${JSON.stringify(summary.status)} taskId=${JSON.stringify(summary.taskId)} solution=${JSON.stringify(summary.solution)}`);
}

async function injectCapSolverProxy(session, normalizedProxy, index) {
  const parsed = normalizedProxy ? new URL(normalizedProxy.server) : null;
  const settings = {
    useProxy: Boolean(normalizedProxy),
    proxyType: parsed?.protocol === 'https:' ? 'https' : 'http',
    hostOrIp: parsed?.hostname || '',
    port: parsed?.port ? Number(parsed.port) : '',
    proxyLogin: normalizedProxy?.username || '',
    proxyPassword: normalizedProxy?.password || '',
    reCaptchaMode: 'click',
    manualSolving: false
  };
  noteCaptchaMode(index, settings.reCaptchaMode);
  await session.send('Runtime.evaluate', {
    expression: `(async () => {
      const stored = await chrome.storage.local.get(['defaultConfig', 'config']);
      const settings = ${JSON.stringify(settings)};
      await chrome.storage.local.set({
        defaultConfig: { ...(stored.defaultConfig || {}), ...settings },
        config: { ...(stored.config || {}), ...settings }
      });
    })()`,
    awaitPromise: true
  });
  console.log(`[account ${index + 1}] CAPSOLVER_PROXY useProxy=${settings.useProxy} host=${settings.hostOrIp} port=${settings.port}`);
}

async function watchCapSolver(browser, index, normalizedProxy) {
  const target = await browser.waitForTarget(item => item.type() === 'service_worker' && item.url().startsWith('chrome-extension://'), { timeout: 10000 }).catch(() => null);
  if (!target) {
    console.log(`[account ${index + 1}] CAPSOLVER_WATCH service worker không thấy, không đọc được message CapSolver`);
    return;
  }
  const session = await target.createCDPSession();
  await injectCapSolverProxy(session, normalizedProxy, index);
  await session.send('Network.enable').catch(() => {});
  const responses = new Map();
  session.on('Network.requestWillBeSent', event => {
    const endpoint = capsolverEndpoint(event.request.url);
    if (!endpoint) return;
    responses.set(event.requestId, { endpoint, httpStatus: 0 });
  });
  session.on('Network.responseReceived', event => {
    const endpoint = capsolverEndpoint(event.response.url);
    if (!endpoint) return;
    responses.set(event.requestId, { endpoint, httpStatus: event.response.status });
  });
  session.on('Network.loadingFinished', event => {
    const meta = responses.get(event.requestId);
    if (!meta) return;
    responses.delete(event.requestId);
    session.send('Network.getResponseBody', { requestId: event.requestId }).then(result => {
      const body = result.base64Encoded ? Buffer.from(result.body, 'base64').toString('utf8') : result.body;
      logCapSolverResult(index, meta.endpoint, meta.httpStatus, body);
    }).catch(error => {
      logCapSolverResult(index, meta.endpoint, meta.httpStatus, JSON.stringify({ errorCode: 'RESPONSE_UNREADABLE', errorDescription: error.message }));
    });
  });
  session.on('Network.loadingFailed', event => {
    const meta = responses.get(event.requestId);
    if (!meta) return;
    responses.delete(event.requestId);
    logCapSolverResult(index, meta.endpoint, meta.httpStatus, JSON.stringify({
      errorCode: 'REQUEST_FAILED',
      errorDescription: event.errorText || 'CapSolver request failed'
    }));
  });
  console.log(`[account ${index + 1}] CAPSOLVER_WATCH đang ghi createTask/getTaskResult`);
}

async function launchBrowser(args, index, proxy) {
  noteAccountProxy(index, proxy);
  const profilePath = path.join(config.profileRoot, `account-${index + 1}`);
  await fs.mkdir(profilePath, { recursive: true });
  if (config.capsolverExtensionPath) await clearCapSolverProfileStorage(profilePath);
  const normalizedProxy = normalizeProxy(proxy);
  const launchArgs = [...args];
  const proxyEndpoint = normalizedProxy ? new URL(normalizedProxy.server) : null;
  const forwarder = normalizedProxy?.username
    ? await startAuthProxy({
      host: proxyEndpoint.hostname,
      port: Number(proxyEndpoint.port),
      username: normalizedProxy.username,
      password: normalizedProxy.password
    })
    : null;
  if (forwarder) {
    launchArgs.push(`--proxy-server=http://127.0.0.1:${forwarder.port}`, '--proxy-bypass-list=<-loopback>;api.capsolver.com');
  } else if (normalizedProxy) {
    launchArgs.push(`--proxy-server=${normalizedProxy.server}`, '--proxy-bypass-list=<-loopback>;api.capsolver.com');
  }
  console.log(`[account ${index + 1}] Chrome profile: ${profilePath}`);
  if (normalizedProxy) console.log(`[account ${index + 1}] Proxy: ${normalizedProxy.server}${forwarder ? ` qua cổng nội bộ ${forwarder.port}` : ''}`);
  let browser;
  try {
    browser = await puppeteer.launch({ headless: config.headless, executablePath: config.chromeExecutablePath, userDataDir: profilePath, args: launchArgs, defaultViewport: null });
  } catch (error) {
    forwarder?.close();
    throw error;
  }
  if (forwarder) browser.on('disconnected', () => forwarder.close());
  if (config.capsolverExtensionPath) await watchCapSolver(browser, index, normalizedProxy);
  return browser;
}

async function clearCapSolverProfileStorage(profilePath) {
  const storagePath = path.join(profilePath, 'Default', 'Local Extension Settings');
  await fs.rm(storagePath, { recursive: true, force: true });
  console.log(`[CapSolver] Đã xóa storage local của profile: ${storagePath}`);
}

async function authenticateProxy(page, proxy) {
  const normalizedProxy = normalizeProxy(proxy);
  if (normalizedProxy?.username || normalizedProxy?.password) {
    await page.authenticate({ username: normalizedProxy.username, password: normalizedProxy.password });
  }
}

async function configureProxyAuthentication(browser, proxy) {
  const normalizedProxy = normalizeProxy(proxy);
  if (!normalizedProxy?.username && !normalizedProxy?.password) return;
  const credentials = { username: normalizedProxy.username, password: normalizedProxy.password };
  const applyCredentials = page => page.authenticate(credentials).catch(() => {});
  await Promise.all((await browser.pages()).map(applyCredentials));
  browser.on('targetcreated', target => {
    if (target.type() === 'page') target.page().then(applyCredentials).catch(() => {});
  });
}

async function getSinglePage(browser) {
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  await Promise.all(pages.slice(1).map(extraPage => extraPage.close().catch(() => {})));
  return page;
}

module.exports = { launchBrowser, authenticateProxy, configureProxyAuthentication, getSinglePage, normalizeProxy, maskApiKey, noteCaptcha, noteCaptchaMode, captchaMode, noteAccountProxy, accountProxy, capsolverEndpoint, summarizeCapSolverBody };