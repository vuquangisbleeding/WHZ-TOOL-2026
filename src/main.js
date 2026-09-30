const crypto = require('node:crypto');
const config = require('./config');
const { fs, path, readJson, readProxyList, readCaptchaApiKey } = require('./io');
const { initializeLogger, initializeAccountLogger, state } = require('./logger');
const { launchBrowser, configureProxyAuthentication, maskApiKey } = require('./browser');
const { runApplicant } = require('./account');
const { sendTelegramMessage, buildTelegramSummary, applicantSummary } = require('./notifications');
const { formatDuration } = require('./timing');
const { captchaStats } = require('./captcha');
const { maskUsername } = require('./privacy');
const { isStopRequested } = require('./stop');

function validateAccounts(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error('emails.json phải chứa ít nhất một tài khoản');
  if (accounts.some(account => !account || typeof account !== 'object' || typeof account.username !== 'string' || !account.username.trim() || typeof account.email !== 'string' || !account.email.trim() || typeof account.password !== 'string' || !account.password)) throw new Error('Mỗi phần tử trong emails.json phải có username, password và email');
  if (accounts.some(account => account.proxy !== undefined && typeof account.proxy !== 'boolean')) throw new Error('Trường proxy trong emails.json phải là true hoặc false');
}

function applyProxyList(accounts, proxies) {
  let proxyIndex = 0;
  for (const account of accounts) {
    if (account.proxy !== true) {
      account.proxy = null;
      continue;
    }
    if (!proxies[proxyIndex]) throw new Error(`Thiếu proxy trong proxy-list.txt cho tài khoản ${account.username}`);
    account.proxy = proxies[proxyIndex];
    proxyIndex += 1;
  }
}

function buildApiKeyAudit(apiKey, accounts) {
  const fingerprint = crypto.createHash('sha256').update(apiKey).digest('hex');
  const masked = maskApiKey(apiKey);
  return [
    `created_at=${new Date().toISOString()}`,
    `provider=${config.captchaProvider}`,
    `key_masked=${masked}`,
    `key_length=${apiKey.length}`,
    `key_sha256=${fingerprint}`,
    ...accounts.map((account, index) => `profile=account-${index + 1} username=${maskUsername(account.username)} key_masked=${masked} key_sha256=${fingerprint}`),
    ''
  ].join('\n');
}

async function runAccount(baseApplicant, account, index, args, apiKey) {
  const accountStartedAt = Date.now();
  let browser;
  try {
    await initializeAccountLogger(index, account.username);
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] BROWSER_LAUNCH_START`);
    browser = await launchBrowserWithTimeout(args, index, account.username, account.proxy, apiKey, config.captchaProvider);
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] BROWSER_LAUNCH_READY`);
    await configureProxyAuthentication(browser, account.proxy);
    const result = await runApplicant(browser, baseApplicant, account, index);
    if (!result.runtimeMs) result.runtimeMs = Date.now() - accountStartedAt;
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] ACCOUNT_FINISHED status=${result.status} runtime_ms=${result.runtimeMs}`);
    await sendTelegramMessage(buildTelegramSummary([result], result.runtimeMs)).catch(error => console.error(`[TELEGRAM] ${result.label} lỗi gửi: ${error.message}`));
    return result;
  } catch (error) {
    await browser?.close().catch(() => {}); await initializeAccountLogger(index, account.username);
    console.error(`[account ${index + 1}: ${maskUsername(account.username)}] ACCOUNT_ERROR ${error.stack || error.message}`);
    const runtimeMs = Date.now() - accountStartedAt;
    const result = { label: `account ${index + 1}: ${maskUsername(account.username)}`, status: `ERROR: ${error.message}`, runtimeMs, captchaMs: 0, applicantInfo: applicantSummary(baseApplicant, account) };
    await sendTelegramMessage(buildTelegramSummary([result], runtimeMs)).catch(telegramError => console.error(`[TELEGRAM] ${result.label} lỗi gửi: ${telegramError.message}`));
    return result;
  } finally {
    if (isStopRequested()) browser?.disconnect();
    else await browser?.close().catch(() => {});
  }
}

async function launchBrowserWithTimeout(args, index, username, proxy, apiKey, provider) {
  let timedOut = false;
  const launch = launchBrowser(args, index, proxy, apiKey, provider).then(browser => {
    if (timedOut) browser.close().catch(() => {});
    return browser;
  });
  return Promise.race([launch, new Promise((_, reject) => setTimeout(() => {
    timedOut = true;
    reject(new Error(`Chrome launch timeout: ${maskUsername(username)}`));
  }, 30000))]);
}

async function main() {
  await initializeLogger();
  if (!config.loginUrl) throw new Error('Cần cấu hình LOGIN_URL trong file .env');
  const [baseApplicant, accounts, proxies] = await Promise.all([readJson('applicant.json'), readJson('emails.json'), readProxyList()]); validateAccounts(accounts); applyProxyList(accounts, proxies);
  const extensionPath = config.captchaExtensionPath; const args = ['--start-maximized', '--lang=en-US'];
  let apiKey = '';
  if (extensionPath) {
    const resolved = path.resolve(config.root, extensionPath);
    apiKey = await readCaptchaApiKey(resolved, config.captchaProvider);
    console.log(`${config.captchaProvider} extension path=${resolved} key=${maskApiKey(apiKey)} length=${apiKey.length}`);
    args.push(`--disable-extensions-except=${resolved}`, `--load-extension=${resolved}`);
  }
  console.log(`Chuẩn bị chạy ${accounts.length} Chrome profile độc lập.`);
  const startedAt = Date.now(); await Promise.all(accounts.map((account, index) => runAccount(baseApplicant, account, index, args, apiKey)));
  if (apiKey) {
    const auditFile = path.join(config.logRoot, `captcha-keys-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    await fs.writeFile(auditFile, buildApiKeyAudit(apiKey, accounts), { mode: 0o600 });
    console.log(`CAPSOLVER_KEY_AUDIT ${auditFile}`);
  }
  const runtime = Date.now() - startedAt;
  console.log(`[SUMMARY] RUN_FINISHED total_runtime=${formatDuration(runtime)} total_runtime_ms=${runtime} captcha_count=${captchaStats.count} captcha_total=${formatDuration(captchaStats.totalMs)} captcha_total_ms=${captchaStats.totalMs}`);
  console.log(`LOG_FILE ${state.file}`);
}

module.exports = { main };