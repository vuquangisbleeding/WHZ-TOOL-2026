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

const accountProxies = new Map();

function noteAccountProxy(accountIndex, proxy) {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) return;
  const normalized = normalizeProxy(proxy);
  if (normalized) accountProxies.set(accountIndex, normalized);
  else accountProxies.delete(accountIndex);
}

function accountProxy(accountIndex) {
  return accountProxies.get(accountIndex) || null;
}

async function launchBrowser(args, index, proxy) {
  noteAccountProxy(index, proxy);
  const profilePath = path.join(config.profileRoot, `account-${index + 1}`);
  await fs.mkdir(profilePath, { recursive: true });
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
    launchArgs.push(`--proxy-server=http://127.0.0.1:${forwarder.port}`, '--proxy-bypass-list=<-loopback>');
  } else if (normalizedProxy) {
    launchArgs.push(`--proxy-server=${normalizedProxy.server}`, '--proxy-bypass-list=<-loopback>');
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
  return browser;
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

module.exports = { launchBrowser, authenticateProxy, configureProxyAuthentication, getSinglePage, normalizeProxy, noteAccountProxy, accountProxy };