const puppeteer = require('puppeteer');
const config = require('./config');
const { fs, path } = require('./io');

function normalizeProxy(proxy) {
  if (!proxy) return null;
  const input = typeof proxy === 'string' ? { server: proxy } : proxy;
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

function maskApiKey(apiKey) {
  const value = String(apiKey || '');
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

async function launchBrowser(args, index, proxy, apiKey = '', provider = 'capsolver') {
  const profilePath = path.join(config.profileRoot, `account-${index + 1}`);
  await fs.mkdir(profilePath, { recursive: true });
  if (config.captchaExtensionPath) await clearCapSolverProfileStorage(profilePath);
  const normalizedProxy = normalizeProxy(proxy);
  const launchArgs = [...args];
  if (normalizedProxy) launchArgs.push(`--proxy-server=${normalizedProxy.server}`);
  console.log(`[account ${index + 1}] Chrome profile: ${profilePath}`);
  if (normalizedProxy) console.log(`[account ${index + 1}] Proxy: ${normalizedProxy.server}`);
  const browser = await puppeteer.launch({ headless: config.headless, executablePath: config.chromeExecutablePath, userDataDir: profilePath, args: launchArgs, defaultViewport: null });
  if (apiKey) await injectCaptchaApiKey(browser, apiKey, provider);
  return browser;
}

async function injectCaptchaApiKey(browser, apiKey, provider = 'capsolver') {
  const target = await browser.waitForTarget(item => item.type() === 'service_worker' && item.url().startsWith('chrome-extension://'), { timeout: 10000 }).catch(() => null);
  if (!target) throw new Error(`Không tìm thấy ${provider} service worker để inject API key`);
  const session = await target.createCDPSession();
  const settings = provider === 'twocaptcha'
    ? { config: { apiKey, autoSolveRecaptchaV2: true, autoSolveInvisibleRecaptchaV2: true, autoSolveRecaptchaV3: true, autoSolveHCaptcha: true, autoSolveTurnstile: true } }
    : { defaultConfig: { apiKey }, config: { apiKey } };
  await session.send('Runtime.evaluate', {
    expression: `(async () => {
      const stored = await chrome.storage.local.get(['defaultConfig', 'config']);
      const settings = ${JSON.stringify(settings)};
      await chrome.storage.local.set({
        ...(settings.defaultConfig ? { defaultConfig: { ...(stored.defaultConfig || {}), ...settings.defaultConfig } } : {}),
        config: { ...(stored.config || {}), ...(settings.config || {}) }
      });
    })()`,
    awaitPromise: true
  });
  console.log(`[${provider}] Đã inject API key vào Chrome profile`);
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

const injectCapSolverApiKey = (browser, apiKey) => injectCaptchaApiKey(browser, apiKey, 'capsolver');

module.exports = { launchBrowser, authenticateProxy, configureProxyAuthentication, getSinglePage, normalizeProxy, maskApiKey, injectCaptchaApiKey, injectCapSolverApiKey };