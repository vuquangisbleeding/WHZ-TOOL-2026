const config = require('./config');
const { readJson, readProxyList } = require('./io');
const { initializeLogger, initializeAccountLogger, state } = require('./logger');
const { launchBrowser, configureProxyAuthentication } = require('./browser');
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

async function runAccount(baseApplicant, account, index, args) {
  const accountStartedAt = Date.now();
  let browser;
  try {
    await initializeAccountLogger(index, account.username);
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] BROWSER_LAUNCH_START`);
    browser = await launchBrowserWithTimeout(args, index, account.username, account.proxy);
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

async function launchBrowserWithTimeout(args, index, username, proxy) {
  let timedOut = false;
  const launch = launchBrowser(args, index, proxy).then(browser => {
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
  const args = ['--start-maximized', '--lang=en-US'];
  console.log(`Chuẩn bị chạy ${accounts.length} Chrome profile độc lập.`);
  const startedAt = Date.now(); await Promise.all(accounts.map((account, index) => runAccount(baseApplicant, account, index, args)));
  const runtime = Date.now() - startedAt;
  console.log(`[SUMMARY] RUN_FINISHED total_runtime=${formatDuration(runtime)} total_runtime_ms=${runtime} captcha_count=${captchaStats.count} captcha_total=${formatDuration(captchaStats.totalMs)} captcha_total_ms=${captchaStats.totalMs}`);
  console.log(`LOG_FILE ${state.file}`);
}

module.exports = { main, validateAccounts, applyProxyList };