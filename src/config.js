const path = require('node:path');

const ROOT = process.env.INZ_DATA_ROOT || path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(process.env.INZ_DATA_ROOT || ROOT, '.env') });
const config = {
  root: ROOT,
  loginUrl: process.env.LOGIN_URL,
  profileRoot: path.join(ROOT, 'chrome-profiles'),
  logRoot: path.join(ROOT, 'logs'),
  maxHighLoadRetries: Number(process.env.MAX_HIGH_LOAD_RETRIES || 10),
  highLoadBackoffMs: Number(process.env.HIGH_LOAD_BACKOFF_MS || 750),
  highLoadCooldownMs: Number(process.env.HIGH_LOAD_COOLDOWN_MS || 5000),
  schemeCountry: process.env.SCHEME_COUNTRY || '',
  countryPollMs: Number(process.env.COUNTRY_POLL_MS || 500),
  captchaPollMs: Number(process.env.CAPTCHA_POLL_MS || 50),
  manualRecoveryPollMs: Number(process.env.MANUAL_RECOVERY_POLL_MS || 1000),
  clickWaitTimeoutMs: Number(process.env.CLICK_WAIT_TIMEOUT_MS || 1500),
  capmonsterApiKey: process.env.CAPMONSTER_API_KEY || '',
  capmonsterApiKeyLocal: process.env.CAPMONSTER_API_KEY || '',
  capmonsterApiKeySource: process.env.CAPMONSTER_API_KEY ? 'env' : '',
  chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
  headless: process.env.HEADLESS === 'true',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_KEY || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  whitelistUrl: (process.env.WHITELIST_URL || '').trim()
};

module.exports = config;