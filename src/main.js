const config = require('./config');
const { readJson, readProxyList } = require('./io');
const { initializeLogger, initializeAccountLogger, state } = require('./logger');
const { launchBrowser, configureProxyAuthentication } = require('./browser');
const { runApplicant } = require('./account');
const { sendTelegramMessage, buildTelegramSummary, applicantSummary } = require('./notifications');
const { captchaStats } = require('./captcha');
const { appendResult, resultRecord } = require('./results');
const { maskUsername } = require('./privacy');
const { isStopRequested, shouldCloseBrowser, registerBrowserCloser } = require('./stop');
const { fetchWhitelist, assertAccountsWhitelisted, applyWhitelistSecrets, missingWhitelistSecrets } = require('./whitelist');

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
    if (!proxies[proxyIndex]) throw new Error(`Thiếu proxy trong danh sách cho tài khoản ${account.username}`);
    account.proxy = proxies[proxyIndex];
    proxyIndex += 1;
  }
}

async function recordOutcome(applicant, account, result) {
  const record = resultRecord({
    account,
    applicant,
    status: result.status,
    paymentUrl: result.paymentUrl,
    note: result.note || result.status
  });
  console.log(`[${result.label}] RESULT status="${record.status}" name="${record.name}" email="${record.email}" payment="${record.payment_link}"`);
  await appendResult(record).catch(error => console.error(`[RESULT] không ghi được file kết quả: ${error.message}`));
}

async function runAccount(baseApplicant, account, index, args) {
  let browser;
  let outcome;
  let unregisterCloser = () => {};
  try {
    await initializeAccountLogger(index, account.username);
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] BROWSER_LAUNCH_START`);
    browser = await launchBrowserWithTimeout(args, index, account.username, account.proxy);
    unregisterCloser = registerBrowserCloser(() => browser.close());
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] BROWSER_LAUNCH_READY`);
    await configureProxyAuthentication(browser, account.proxy);
    const result = await runApplicant(browser, baseApplicant, account, index);
    outcome = result;
    console.log(`[account ${index + 1}: ${maskUsername(account.username)}] ACCOUNT_FINISHED status=${result.status}`);
    await recordOutcome(baseApplicant, account, result);
    await sendTelegramMessage(buildTelegramSummary([result])).catch(error => console.error(`[TELEGRAM] ${result.label} lỗi gửi: ${error.message}`));
    return result;
  } catch (error) {
    if (!outcome?.keepBrowser) await browser?.close().catch(() => {});
    await initializeAccountLogger(index, account.username);
    console.error(`[account ${index + 1}: ${maskUsername(account.username)}] ACCOUNT_ERROR ${error.stack || error.message}`);
    const result = { label: `account ${index + 1}: ${maskUsername(account.username)}`, status: `ERROR: ${error.message}`, captchaMs: 0, applicantInfo: applicantSummary(baseApplicant, account), note: error.message };
    outcome = result;
    await recordOutcome(baseApplicant, account, result);
    await sendTelegramMessage(buildTelegramSummary([result])).catch(telegramError => console.error(`[TELEGRAM] ${result.label} lỗi gửi: ${telegramError.message}`));
    return result;
  } finally {
    unregisterCloser();
    if (outcome?.keepBrowser || (isStopRequested() && !shouldCloseBrowser())) browser?.disconnect();
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
  const [baseApplicant, accounts, proxies] = await Promise.all([readJson('applicant.json'), readJson('emails.json'), readProxyList()]);
  validateAccounts(accounts);
  const whitelist = await fetchWhitelist(config.whitelistUrl);
  try {
    assertAccountsWhitelisted(accounts, whitelist);
  } catch (error) {
    if (whitelist.enabled) {
      for (const [index, account] of accounts.entries()) {
        const name = String(account.username || '').trim().toLowerCase();
        if (!whitelist.allowed.has(name)) {
          const label = `account ${index + 1}: ${maskUsername(account.username)}`;
          console.error(`[${label}] WHITELIST_BLOCKED username không có trong whitelist`);
          await recordOutcome(baseApplicant, account, { label, status: 'WHITELIST_BLOCKED', note: 'Không có trong whitelist' });
        }
      }
    }
    throw error;
  }
  const missingSecrets = missingWhitelistSecrets(whitelist);
  if (missingSecrets.length) throw new Error(missingSecrets.join(' '));
  applyWhitelistSecrets(config, whitelist);
  console.log(whitelist.enabled
    ? `Whitelist bật: ${whitelist.allowed.size} username, ${accounts.length} tài khoản được chạy.`
    : 'Whitelist tắt: mọi username được chạy.');
  console.log('Autocaptcha API key lấy từ whitelist.');
  console.log('Bot token và chat ID lấy từ whitelist.');
  console.log(proxies.length ? `Danh sách proxy có ${proxies.length} dòng.` : 'Danh sách proxy trống.');
  applyProxyList(accounts, proxies);
  const args = ['--start-maximized', '--lang=en-US'];
  console.log(`Chuẩn bị chạy ${accounts.length} Chrome profile độc lập.`);
  await Promise.all(accounts.map((account, index) => runAccount(baseApplicant, account, index, args)));
  console.log(`[SUMMARY] RUN_FINISHED captcha_count=${captchaStats.count}`);
  console.log(`LOG_FILE ${state.file}`);
}

module.exports = { main, validateAccounts, applyProxyList };