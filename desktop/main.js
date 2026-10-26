const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fillEmptyKey } = require('./env-defaults');
const { fetchWhitelist, maskWhitelistUrl, missingWhitelistSecrets } = require('../src/whitelist');
const { parseProxyLine } = require('../src/io');
const { readResults, resultsPath, RESULT_COLUMNS } = require('../src/results');
const { openAndFillRegistration, openAndFillRegistrations } = require('../src/registration-browser');

let mainWindow;
let runnerProcess;
let registrationBrowser;

function isRegistrationBrowserConnected() {
  const browser = registrationBrowser?.browser;
  if (!browser) return false;
  if (typeof browser.isConnected === 'function') return browser.isConnected();
  if (typeof browser.connected === 'function') return browser.connected();
  return Boolean(browser.connected);
}

function projectRoot() {
  return app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
}

function runnerRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : projectRoot();
}

async function dataRoot() {
  const root = app.isPackaged ? app.getPath('userData') : projectRoot();
  await fs.mkdir(root, { recursive: true });
  if (!app.isPackaged) return root;
  const templates = [
    ['applicant.json', 'packaging/applicant.template.json'],
    ['emails.json', 'packaging/emails.template.json']
  ];
  for (const [name, source] of templates) {
    const target = path.join(root, name);
    try { await fs.access(target); } catch {
      await fs.copyFile(path.join(projectRoot(), source), target);
    }
  }
  await ensurePackagedEnv(root);
  return root;
}

async function ensurePackagedEnv(root) {
  const target = path.join(root, '.env');
  const templatePath = path.join(projectRoot(), 'packaging/env.template');
  let content = '';
  try {
    content = await fs.readFile(target, 'utf8');
  } catch {
    await fs.copyFile(templatePath, target);
    return;
  }
  const template = await fs.readFile(templatePath, 'utf8');
  const next = fillEmptyKey(content, template, 'WHITELIST_URL');
  if (next !== content) await fs.writeFile(target, next);
}

async function readDataFiles() {
  const root = await dataRoot();
  const [applicant, accounts] = await Promise.all([
    fs.readFile(path.join(root, 'applicant.json'), 'utf8'),
    fs.readFile(path.join(root, 'emails.json'), 'utf8')
  ]);
  return { applicant, accounts };
}

async function listLogFiles() {
  const root = await dataRoot();
  const logsRoot = path.join(root, 'logs');
  await fs.mkdir(logsRoot, { recursive: true });
  const entries = await fs.readdir(logsRoot, { withFileTypes: true });
  const files = await Promise.all(entries.filter(entry => entry.isFile() && entry.name.endsWith('.log')).map(async entry => {
    const filePath = path.join(logsRoot, entry.name);
    const stats = await fs.stat(filePath);
    return { name: entry.name, size: stats.size, modifiedAt: stats.mtimeMs };
  }));
  return files.sort((left, right) => right.modifiedAt - left.modifiedAt);
}

async function readLogFile(_event, name) {
  if (typeof name !== 'string' || path.basename(name) !== name || !name.endsWith('.log')) {
    throw new Error('Tên log không hợp lệ.');
  }
  const root = await dataRoot();
  return fs.readFile(path.join(root, 'logs', name), 'utf8');
}

async function listLogResults() {
  const rows = await readResults(await dataRoot());
  return rows.reverse();
}

async function openResultsFile() {
  const file = resultsPath(await dataRoot());
  try { await fs.access(file); } catch {
    await fs.writeFile(file, `${RESULT_COLUMNS.join(',')}\n`);
  }
  const error = await shell.openPath(file);
  if (error) throw new Error(error);
  return { ok: true, path: file };
}

async function readTelegramSettings() {
  const root = await dataRoot();
  const envFile = path.join(root, '.env');
  const content = await fs.readFile(envFile, 'utf8');
  const readValue = key => content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] || '';
  const proxyFile = path.join(root, 'proxy-list.txt');
  const proxyList = await fs.readFile(proxyFile, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return {
    schemeCountry: readValue('SCHEME_COUNTRY'),
    whitelistUrl: maskWhitelistUrl(readValue('WHITELIST_URL')),
    resultsFile: resultsPath(root),
    proxyList
  };
}

async function readRegistrationSettings() {
  const root = await dataRoot();
  const content = await fs.readFile(path.join(root, '.env'), 'utf8');
  const readValue = key => content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() || process.env[key] || '';
  return {
    password: readValue('REGISTRATION_PASSWORD'),
    secretAnswer: readValue('REGISTRATION_SECRET_ANSWER'),
    secretQuestion: readValue('REGISTRATION_SECRET_QUESTION'),
    username: readValue('REGISTRATION_USERNAME')
  };
}

async function openRegistration(_event, { applicant, account }) {
  if (isRegistrationBrowserConnected()) {
    const page = registrationBrowser.page || registrationBrowser.pages?.[0];
    if (page) await page.bringToFront();
    return { ok: true, email: registrationBrowser.email || '' };
  }
  const settings = await readRegistrationSettings();
  try {
    registrationBrowser = await openAndFillRegistration(applicant, settings, account);
  } catch (error) {
    if (error.browser) registrationBrowser = { browser: error.browser, page: error.page };
    throw error;
  }
  return { ok: true, email: registrationBrowser.email };
}

async function openRegistrations(_event, { applicant, accounts }) {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('Cần ít nhất một tài khoản để mở nhiều Registration.');
  }
  if (isRegistrationBrowserConnected()) {
    throw new Error('Các tab Registration trước đó vẫn đang mở. Hãy đóng chúng trước.');
  }
  const settings = await readRegistrationSettings();
  try {
    registrationBrowser = await openAndFillRegistrations(applicant, accounts, settings);
  } catch (error) {
    if (error.browser) registrationBrowser = { browser: error.browser, pages: error.pages || [] };
    throw error;
  }
  return { ok: true, count: registrationBrowser.pages.length };
}

async function saveTelegramSettings(_event, { schemeCountry, proxyList }) {
  const proxies = String(proxyList || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  proxies.forEach((line, index) => parseProxyLine(line, 'danh sách proxy', index + 1));
  const root = await dataRoot();
  const file = path.join(root, '.env');
  let content = await fs.readFile(file, 'utf8');
  const values = {
    SCHEME_COUNTRY: (schemeCountry || '').trim()
  };
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
  }
  await fs.writeFile(file, content);
  await fs.writeFile(path.join(root, 'proxy-list.txt'), proxies.length ? `${proxies.join('\n')}\n` : '');
  return { ok: true };
}

async function sendTelegramTest() {
  const root = await dataRoot();
  const content = await fs.readFile(path.join(root, '.env'), 'utf8');
  const whitelist = await fetchWhitelist((content.match(/^WHITELIST_URL=(.*)$/m)?.[1] || '').trim());
  const issues = missingWhitelistSecrets(whitelist);
  if (issues.length) throw new Error(issues.join(' '));
  const response = await fetch(`https://api.telegram.org/bot${whitelist.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: whitelist.chatId, text: 'INZ Runner test message: Telegram kết nối thành công.' })
  });
  if (!response.ok) throw new Error(`Telegram trả về HTTP ${response.status}`);
  return { ok: true };
}

function validateData(applicantText, accountsText) {
  let applicant;
  let accounts;
  try { applicant = JSON.parse(applicantText); } catch { throw new Error('applicant.json không phải JSON hợp lệ.'); }
  try { accounts = JSON.parse(accountsText); } catch { throw new Error('emails.json không phải JSON hợp lệ.'); }
  if (!applicant || typeof applicant !== 'object' || Array.isArray(applicant)) throw new Error('applicant.json phải là một object JSON.');
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error('emails.json phải có ít nhất một tài khoản.');
  for (const [index, account] of accounts.entries()) {
    if (!account || typeof account !== 'object' || !account.username || !account.password || !account.email) {
      throw new Error(`Tài khoản ${index + 1} cần username, password và email.`);
    }
    if (account.proxy !== undefined && typeof account.proxy !== 'boolean') {
      throw new Error(`Tài khoản ${index + 1}: proxy phải là true hoặc false.`);
    }
  }
  return { applicant, accounts };
}

async function saveData(_event, { applicant, accounts }) {
  const parsed = validateData(applicant, accounts);
  const root = await dataRoot();
  await Promise.all([
    fs.writeFile(path.join(root, 'applicant.json'), `${JSON.stringify(parsed.applicant, null, 2)}\n`),
    fs.writeFile(path.join(root, 'emails.json'), `${JSON.stringify(parsed.accounts, null, 2)}\n`)
  ]);
  return { ok: true, profiles: parsed.accounts.length };
}

async function importData(_event, kind) {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  return { canceled: false, content: await fs.readFile(result.filePaths[0], 'utf8'), kind };
}

async function exportData(_event, { kind, content }) {
  const defaultName = kind === 'applicant' ? 'applicant.json' : 'emails.json';
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const parsed = JSON.parse(content);
  await fs.writeFile(result.filePath, `${JSON.stringify(parsed, null, 2)}\n`);
  return { canceled: false, path: result.filePath };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#10151d',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('close', event => {
    if (app.quitting || mainWindow.allowClose || !runnerProcess) return;
    event.preventDefault();
    const child = runnerProcess;
    cancelRunner();
    const closeWindow = () => {
      if (mainWindow.isDestroyed()) return;
      mainWindow.allowClose = true;
      mainWindow.close();
    };
    child.once('close', closeWindow);
    setTimeout(closeWindow, 9000);
  });
}

function send(channel, data) {
  if (!mainWindow?.isDestroyed()) mainWindow.webContents.send(channel, data);
}

async function startRunner() {
  if (runnerProcess) return { ok: false, message: 'Runner đang chạy.' };
  const root = runnerRoot();
  const writableRoot = await dataRoot();
  const packagedModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');
  const modulePath = app.isPackaged ? packagedModules : path.join(projectRoot(), 'node_modules');
  runnerProcess = spawn(process.execPath, [path.join(root, 'src', 'runner.js')], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      INZ_DATA_ROOT: writableRoot,
      NODE_PATH: [modulePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter)
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  send('runner-status', { running: true });
  const forward = type => chunk => send('runner-output', { type, text: chunk.toString() });
  runnerProcess.stdout.on('data', forward('stdout'));
  runnerProcess.stderr.on('data', forward('stderr'));
  runnerProcess.on('close', code => {
    send('runner-exit', { code });
    runnerProcess = null;
    send('runner-status', { running: false });
  });
  runnerProcess.on('error', error => send('runner-output', { type: 'stderr', text: `${error.message}\n` }));
  return { ok: true };
}

function pauseRunner() {
  if (!runnerProcess) return { ok: false, message: 'Runner chưa chạy.' };
  if (process.platform === 'win32') runnerProcess.send({ type: 'pause' });
  else runnerProcess.kill('SIGUSR1');
  return { ok: true, message: 'Đã tạm dừng mọi thứ đang chạy. Chrome giữ nguyên trang hiện tại.' };
}

function resumeRunner() {
  if (!runnerProcess) return { ok: false, message: 'Runner chưa chạy.' };
  if (process.platform === 'win32') runnerProcess.send({ type: 'resume' });
  else runnerProcess.kill('SIGUSR2');
  return { ok: true, message: 'Đã tiếp tục phần đang tạm dừng.' };
}

function cancelRunner() {
  if (!runnerProcess) return { ok: false, message: 'Runner chưa chạy.' };
  const child = runnerProcess;
  try { child.send({ type: 'cancel' }); } catch { child.kill('SIGKILL'); }
  const timer = setTimeout(() => { if (runnerProcess === child) child.kill('SIGKILL'); }, 8000);
  child.once('close', () => clearTimeout(timer));
  return { ok: true, message: 'Đã huỷ. Chrome đóng và màn hình chạy trở về ban đầu.' };
}

app.whenReady().then(() => {
  createWindow();
  ipcMain.handle('runner-start', startRunner);
  ipcMain.handle('runner-pause', pauseRunner);
  ipcMain.handle('runner-resume', resumeRunner);
  ipcMain.handle('runner-cancel', cancelRunner);
  ipcMain.handle('data-load', readDataFiles);
  ipcMain.handle('logs-list', listLogFiles);
  ipcMain.handle('logs-read', readLogFile);
  ipcMain.handle('logs-results', listLogResults);
  ipcMain.handle('results-open', openResultsFile);
  ipcMain.handle('data-save', saveData);
  ipcMain.handle('telegram-load', readTelegramSettings);
  ipcMain.handle('telegram-save', saveTelegramSettings);
  ipcMain.handle('telegram-test', sendTelegramTest);
  ipcMain.handle('data-import', importData);
  ipcMain.handle('data-export', exportData);
  ipcMain.handle('open-external', async (_event, url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('Chỉ mở được link https.');
    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('runner-open-folder', () => dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }));
  ipcMain.handle('registration-open', openRegistration);
  ipcMain.handle('registrations-open', openRegistrations);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', event => {
  if (!runnerProcess || app.quitting) return;
  event.preventDefault();
  app.quitting = true;
  const child = runnerProcess;
  cancelRunner();
  child.once('close', () => app.quit());
  setTimeout(() => app.quit(), 9000);
});