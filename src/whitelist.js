function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(item => item.some(value => String(value).trim()));
}

function headerKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const secretColumns = {
  capmonsterApiKey: ['apikey', 'autocaptchaapikey', 'autocaptchakey', 'capmonsterapikey', 'cloudapikey', 'capmonstercloudapikey'],
  botToken: ['bottoken', 'telegrambottoken'],
  chatId: ['chatid', 'telegramchatid']
};

function firstFilled(rows, column) {
  if (column === -1) return '';
  for (const row of rows) {
    const value = String(row[column] || '').trim();
    if (value) return value;
  }
  return '';
}

function parseWhitelistCsv(csv) {
  const rows = parseCsv(csv);
  if (!rows.length) throw new Error('Sheet whitelist trống. Cần cột whitelist với giá trị yes hoặc no.');
  const header = rows[0].map(headerKey);
  const flagColumn = header.indexOf('whitelist');
  if (flagColumn === -1) throw new Error('Sheet cần cột whitelist với giá trị yes hoặc no.');
  const usernameColumn = header.indexOf('username');
  const dataRows = rows.slice(1);
  let flag = '';
  const allowed = new Set();
  for (const row of dataRows) {
    if (!flag) {
      const value = String(row[flagColumn] || '').trim().toLowerCase();
      if (value) flag = value;
    }
    if (usernameColumn === -1) continue;
    const username = String(row[usernameColumn] || '').trim().toLowerCase();
    if (username && username !== 'username') allowed.add(username);
  }
  if (flag !== 'yes' && flag !== 'no') throw new Error('Cột whitelist phải là yes hoặc no.');
  const column = names => header.findIndex(name => names.includes(name));
  return {
    enabled: flag === 'yes',
    allowed,
    capmonsterApiKey: firstFilled(dataRows, column(secretColumns.capmonsterApiKey)),
    botToken: firstFilled(dataRows, column(secretColumns.botToken)),
    chatId: firstFilled(dataRows, column(secretColumns.chatId))
  };
}

function isCapmonsterClientKey(value) {
  return /^[0-9a-f]{32}$/i.test(String(value || '').trim());
}

function missingWhitelistSecrets(whitelist) {
  const issues = [];
  const key = String(whitelist?.capmonsterApiKey || '').trim();
  if (!key) issues.push('Whitelist không có giá trị Autocaptcha API key.');
  else if (!isCapmonsterClientKey(key)) issues.push('Whitelist có Autocaptcha API key nhưng không đủ 32 ký tự hex.');
  if (!String(whitelist?.botToken || '').trim()) issues.push('Whitelist không có giá trị bot token.');
  if (!String(whitelist?.chatId || '').trim()) issues.push('Whitelist không có giá trị chat ID.');
  return issues;
}

function applyWhitelistSecrets(target, whitelist) {
  target.capmonsterApiKey = String(whitelist.capmonsterApiKey || '').trim();
  target.capmonsterApiKeyLocal = '';
  target.capmonsterApiKeySource = 'whitelist';
  target.telegramBotToken = String(whitelist.botToken || '').trim();
  target.telegramChatId = String(whitelist.chatId || '').trim();
}

function assertAccountsWhitelisted(accounts, whitelist) {
  if (!whitelist.enabled) return;
  const blocked = accounts.filter(account => !whitelist.allowed.has(String(account.username || '').trim().toLowerCase()));
  if (!blocked.length) return;
  throw new Error(`Username không có trong whitelist: ${blocked.map(account => account.username).join(', ')}`);
}

function maskWhitelistUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const hide = text => (text.length <= 8 ? `${text.slice(0, 2)}…` : `${text.slice(0, 4)}…${text.slice(-4)}`);
  try {
    const url = new URL(value);
    const id = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (id) return `${url.origin}/spreadsheets/d/${hide(id)}`;
    return `${url.origin}/…`;
  } catch {
    return hide(value);
  }
}

function normalizeWhitelistUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) throw new Error('Cần cấu hình WHITELIST_URL trong file .env.');
  let url;
  try { url = new URL(value); } catch { throw new Error('WHITELIST_URL không phải link hợp lệ.'); }
  if (url.protocol !== 'https:') throw new Error('WHITELIST_URL phải là link https.');
  const sheet = url.hostname === 'docs.google.com' && url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheet && !url.pathname.includes('/export')) {
    const gid = url.searchParams.get('gid') || url.hash.match(/gid=(\d+)/)?.[1];
    const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheet[1]}/export`);
    exportUrl.searchParams.set('format', 'csv');
    if (gid) exportUrl.searchParams.set('gid', gid);
    return exportUrl.toString();
  }
  return url.toString();
}

async function fetchWhitelist(rawUrl, fetchImpl = fetch) {
  const url = normalizeWhitelistUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`Không tải được whitelist: HTTP ${response.status}`);
    const csv = await response.text();
    if (/<!doctype html|<html/i.test(csv.slice(0, 300))) {
      throw new Error('Google Sheet chưa mở công khai. Hãy share Anyone with the link, quyền Viewer.');
    }
    const whitelist = parseWhitelistCsv(csv);
    if (whitelist.enabled && !whitelist.allowed.size) throw new Error('Whitelist đang yes nhưng chưa có username. Thêm username hoặc đổi cờ thành no.');
    return whitelist;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Tải whitelist quá thời gian. Kiểm tra WHITELIST_URL.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { parseWhitelistCsv, assertAccountsWhitelisted, applyWhitelistSecrets, missingWhitelistSecrets, isCapmonsterClientKey, maskWhitelistUrl, normalizeWhitelistUrl, fetchWhitelist };
