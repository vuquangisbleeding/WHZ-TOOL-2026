const log = document.querySelector('#log');
const start = document.querySelector('#start');
const stop = document.querySelector('#stop');
const resume = document.querySelector('#resume');
const cancel = document.querySelector('#cancel');
const statusText = document.querySelector('#statusText');
const lastEvent = document.querySelector('#lastEvent');
const shell = document.querySelector('.shell');
const applicantInput = document.querySelector('#applicantInput');
const accountsInput = document.querySelector('#accountsInput');
const dataStatus = document.querySelector('#dataStatus');
const schemeCountry = document.querySelector('#schemeCountry');
const whitelistUrl = document.querySelector('#whitelistUrl');
const proxyList = document.querySelector('#proxyList');
const telegramStatus = document.querySelector('#telegramStatus');
const accountRows = document.querySelector('#accountRows');
const nameFilter = document.querySelector('#nameFilter');
const logFiles = document.querySelector('#logFiles');
const logFilter = document.querySelector('#logFilter');
const historicalLog = document.querySelector('#historicalLog');
const selectedLogName = document.querySelector('#selectedLogName');
const selectedLogSize = document.querySelector('#selectedLogSize');
const historicalResults = document.querySelector('#historicalResults');
const formEditor = document.querySelector('#formEditor');
const jsonEditor = document.querySelector('#jsonEditor');
const formMode = document.querySelector('#formMode');
const jsonMode = document.querySelector('#jsonMode');
const accountsFormRows = document.querySelector('#accountsFormRows');
const addAccount = document.querySelector('#addAccount');
window.INZForm.buildInzWizard(document.querySelector('#inzWizard'));
window.INZForm.stamp(document.querySelector('#liveProgress h3'), 'Live progress');
window.INZForm.stamp(document.querySelector('#liveProgress .muted'), 'The page you are on, and the fields already filled. Nothing extra is clicked on the website.');
const inzLive = document.createElement('div');
inzLive.id = 'inzLive';
inzLive.className = 'inz-live';
inzLive.hidden = true;
document.querySelector('#inzWizard').prepend(inzLive);
const liveProgress = document.querySelector('#liveProgress');
const liveAccounts = document.querySelector('#liveAccounts');
const live = window.LiveProgress.createProgress();
let livePaint = false;
const accountRuns = new Map();
let dataMode = 'form';
let accountsMode = 'form';
let runStartedAt = null;
let runPaused = false;
let logRemainder = '';

function maskUsername(username) {
  const value = String(username || '');
  return value.length <= 3 ? value : `${'*'.repeat(value.length - 3)}${value.slice(-3)}`;
}

function redactDisplayedText(text) {
  return String(text || '')
    .replace(/(\[account \d+: )([^\]]+)(\])/g, (_, prefix, username, suffix) => `${prefix}${maskUsername(username)}${suffix}`)
    .replace(/(Email hồ sơ:|Hộ chiếu:)[^\n]*/gi, '$1 [ẩn]');
}

document.querySelector('#profiles').textContent = '-';

function formatTimestamp(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString('vi-VN') : '-';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeAccountProxyFlags(accounts) {
  return accounts.map(account => {
    if (!account || typeof account !== 'object' || typeof account.proxy !== 'string') return account;
    const value = account.proxy.trim().toLowerCase();
    if (value !== 'true' && value !== 'false') return account;
    return { ...account, proxy: value === 'true' };
  });
}

function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object) ?? '';
}

function writePath(object, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key] ||= {}, object);
  target[lastKey] = value;
}

function hasPath(object, path) {
  return path.split('.').every(key => {
    if (object == null || typeof object !== 'object' || !Object.prototype.hasOwnProperty.call(object, key)) return false;
    object = object[key];
    return true;
  });
}

function displayStatus(status) {
  const labels = {
    Waiting: 'Đang chờ',
    Launching: 'Đang mở Chrome',
    'Browser ready': 'Chrome đã mở',
    'Country open': 'Quốc gia đang mở',
    Navigating: 'Đang chuyển trang',
    'Payment ready': 'Đã tới trang thanh toán',
    Error: 'Lỗi',
    Finished: 'Đã xong',
    Incomplete: 'Chưa xong',
    STOP_EXISTING_APPLICATION: 'Dừng vì đang có hồ sơ',
    STOP_PAYMENT: 'Đã tới thanh toán',
    CANCELLED: 'Đã huỷ',
    STOPPED_KEEP_BROWSER: 'Đã dừng, Chrome vẫn mở',
    WHITELIST_BLOCKED: 'Không có trong whitelist'
  };
  if (labels[status]) return labels[status];
  if (String(status || '').startsWith('ERROR')) return 'Lỗi';
  return window.INZForm.t(status || 'Waiting');
}

function paymentButton(url) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'link-button';
  window.INZForm.stamp(button, 'Open payment');
  button.addEventListener('click', () => {
    window.runnerApi.openExternal(url).catch(error => append(`[app] ${error.message}\n`, 'stderr'));
  });
  return button;
}

function appendAccountRow(account = {}) {
  const row = document.createElement('div');
  row.className = 'account-form-row';
  [['username', 'Username'], ['password', 'Password'], ['email', 'Email']].forEach(([key, label]) => {
    const field = document.createElement('label');
    const caption = document.createElement('span');
    window.INZForm.stamp(caption, label);
    field.append(caption);
    const input = document.createElement('input');
    input.dataset.accountField = key;
    input.type = key === 'password' ? 'password' : key === 'email' ? 'email' : 'text';
    input.autocomplete = key === 'password' ? 'new-password' : 'off';
    input.value = account[key] || '';
    field.appendChild(input);
    row.appendChild(field);
  });
  const proxyField = document.createElement('label');
  proxyField.className = 'proxy-flag';
  const proxyInput = document.createElement('input');
  proxyInput.type = 'checkbox';
  proxyInput.dataset.accountField = 'proxy';
  proxyInput.checked = account.proxy === true;
  const proxyCaption = document.createElement('span');
  window.INZForm.stamp(proxyCaption, 'Use proxy list');
  proxyField.append(proxyInput, proxyCaption);
  row.appendChild(proxyField);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'small-button danger-button';
  window.INZForm.stamp(remove, 'Remove');
  remove.addEventListener('click', () => {
    const username = row.querySelector('[data-account-field="username"]')?.value.trim();
    if (username && !window.confirm(`Xóa tài khoản ${username} khỏi danh sách? Dữ liệu chỉ mất khi bạn bấm Lưu tài khoản.`)) return;
    row.remove();
  });
  row.appendChild(remove);
  return row;
}

function storedValue(input) {
  if (input.type === 'checkbox') return input.checked ? 'Yes' : 'No';
  if (input.tagName === 'SELECT') {
    const selected = input.selectedOptions[0];
    if (!selected || selected.value === '') return '';
    const canonical = selected.dataset.en;
    return canonical && canonical !== 'Select' ? canonical : selected.value;
  }
  return input.value.trim();
}

function setControlValue(input, value) {
  const text = value == null ? '' : String(value);
  if (input.type === 'checkbox') {
    input.checked = value === true || text.toLowerCase() === 'yes';
    const token = input.closest('.inz-declaration')?.querySelector('.json-token');
    if (token) token.textContent = input.checked ? 'Yes' : 'No';
    return;
  }
  if (input.tagName === 'SELECT') {
    let match = [...input.options].find(option => option.value === text || option.dataset.en === text);
    if (text && !match) {
      match = document.createElement('option');
      match.dataset.en = text;
      match.textContent = text;
      match.value = text;
      input.append(match);
    }
    if (match?.dataset.en && match.dataset.en !== 'Select') match.value = match.dataset.en;
    input.value = match ? match.value : '';
    return;
  }
  input.value = text;
}

function updateConditionalFields() {
  formEditor.querySelectorAll('[data-show-when]').forEach(row => {
    const [path, expected] = row.dataset.showWhen.split('=');
    const current = formEditor.querySelector(`[data-path="${path}"]`);
    row.hidden = current?.value !== expected;
  });
}

function renderForm(applicant, accounts) {
  formEditor.querySelectorAll('[data-path]').forEach(input => setControlValue(input, readPath(applicant, input.dataset.path)));
  formEditor.querySelectorAll('[data-confirm]').forEach(input => {
    if (!input.value.trim()) setControlValue(input, readPath(applicant, input.dataset.confirm));
  });
  updateConditionalFields();
  accountsFormRows.replaceChildren();
  accounts.forEach(account => accountsFormRows.appendChild(appendAccountRow(account)));
}

function syncFormToJson() {
  const applicant = JSON.parse(applicantInput.value || '{}');
  formEditor.querySelectorAll('[data-path]').forEach(input => {
    const row = input.closest('[data-show-when]');
    if (row?.hidden) {
      if (hasPath(applicant, input.dataset.path)) writePath(applicant, input.dataset.path, '');
      return;
    }
    const value = storedValue(input);
    if (value === '' && !hasPath(applicant, input.dataset.path)) return;
    writePath(applicant, input.dataset.path, value);
  });
  const declarations = [...formEditor.querySelectorAll('[data-declaration]')];
  if (declarations.length) {
    applicant.declaration ||= {};
    applicant.declaration.all_yes = declarations.every(box => box.checked);
  }
  applicantInput.value = JSON.stringify(applicant, null, 2);
}

function syncActiveAccounts() {
  if (accountsMode === 'form') syncAccountsToJson();
}

function setAccountsMode(mode) {
  if (mode === 'json' && accountsMode === 'form') syncAccountsToJson();
  if (mode === 'form' && accountsMode !== 'form') {
    try {
      const accounts = accountsFromImport(accountsInput.value);
      accountsInput.value = JSON.stringify(accounts, null, 2);
      accountsFormRows.replaceChildren();
      accounts.forEach(account => accountsFormRows.appendChild(appendAccountRow(account)));
    } catch (error) {
      setAccountsStatus(error.message, 'invalid');
      return;
    }
  }
  accountsMode = mode;
  const formActive = mode === 'form';
  document.querySelector('#accountsFormPane').hidden = !formActive;
  document.querySelector('#accountsJsonEditor').hidden = formActive;
  document.querySelector('#accountsFormMode').classList.toggle('active', formActive);
  document.querySelector('#accountsJsonMode').classList.toggle('active', !formActive);
  addAccount.hidden = !formActive;
}

function syncAccountsToJson() {
  const accounts = [...accountsFormRows.querySelectorAll('.account-form-row')].map(row => {
    const account = {};
    row.querySelectorAll('[data-account-field]').forEach(input => {
      if (input.dataset.accountField === 'proxy') {
        account.proxy = input.checked;
        return;
      }
      const value = input.value.trim();
      if (value === '') return;
      account[input.dataset.accountField] = value;
    });
    return account;
  });
  accountsInput.value = JSON.stringify(accounts, null, 2);
}

function setDataMode(mode) {
  dataMode = mode;
  const formActive = mode === 'form';
  formEditor.hidden = !formActive;
  jsonEditor.hidden = formActive;
  formMode.classList.toggle('active', formActive);
  jsonMode.classList.toggle('active', !formActive);
  if (formActive) {
    try { renderForm(JSON.parse(applicantInput.value), JSON.parse(accountsInput.value)); } catch {}
  }
}

function setFormTab(section) {
  const personalGroup = ['personal', 'identification', 'occupation'];
  document.querySelectorAll('.form-tab').forEach(tab => {
    const mainPersonal = tab.classList.contains('inz-main-tab') && tab.dataset.formTab === 'personal' && personalGroup.includes(section);
    tab.classList.toggle('active', tab.dataset.formTab === section || mainPersonal);
  });
  document.querySelectorAll('[data-form-section]').forEach(panel => panel.classList.toggle('active', panel.dataset.formSection === section));
  const subnav = document.querySelector('.inz-subnav');
  if (subnav) subnav.hidden = !personalGroup.includes(section);
  updatePager();
}

function updatePager() {
  const current = document.querySelector('.inz-sheet .form-section.active')?.dataset.formSection || 'personal';
  const index = window.INZForm.pageOrder.indexOf(current);
  document.querySelectorAll('[data-inz-nav="previous"]').forEach(button => { button.disabled = index <= 0; });
  document.querySelectorAll('[data-inz-nav="next"]').forEach(button => { button.disabled = index < 0 || index >= window.INZForm.pageOrder.length - 1; });
}

function moveFormPage(direction) {
  const current = document.querySelector('.inz-sheet .form-section.active')?.dataset.formSection || 'personal';
  const index = window.INZForm.pageOrder.indexOf(current);
  const next = window.INZForm.pageOrder[index + direction];
  if (next) setFormTab(next);
}

let archivedLogs = [];

function renderArchivedLogs() {
  const wanted = logFilter.value.trim().toLowerCase();
  logFiles.replaceChildren();
  archivedLogs.filter(file => file.name.toLowerCase().includes(wanted)).forEach(file => {
    const button = document.createElement('button');
    button.className = 'log-file';
    button.type = 'button';
    const title = document.createElement('strong');
    title.textContent = redactDisplayedText(file.name);
    const meta = document.createElement('span');
    meta.textContent = `${formatTimestamp(file.modifiedAt)} · ${formatFileSize(file.size)}`;
    button.append(title, meta);
    button.addEventListener('click', () => loadArchivedLog(file, button));
    logFiles.appendChild(button);
  });
  if (!logFiles.children.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Không tìm thấy log.';
    logFiles.appendChild(empty);
  }
}

async function loadArchivedLog(file, button) {
  try {
    const content = await window.runnerApi.readLog(file.name);
    document.querySelectorAll('.log-file.selected').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    selectedLogName.textContent = redactDisplayedText(file.name);
    selectedLogSize.textContent = `${formatFileSize(file.size)} · ${formatTimestamp(file.modifiedAt)}`;
    historicalLog.textContent = redactDisplayedText(content);
    historicalLog.scrollTop = 0;
  } catch (error) {
    selectedLogName.textContent = 'Không thể đọc log';
    historicalLog.textContent = error.message;
  }
}

async function loadArchivedLogs() {
  try {
    archivedLogs = await window.runnerApi.listLogs();
    renderArchivedLogs();
    await loadHistoricalResults();
  } catch (error) {
    logFiles.textContent = error.message;
  }
}

function emptyRow(columns, text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = columns;
  cell.className = 'wrap';
  cell.textContent = text;
  row.appendChild(cell);
  return row;
}

async function loadHistoricalResults() {
  try {
    const results = await window.runnerApi.listLogResults();
    historicalResults.replaceChildren();
    if (!results.length) {
      historicalResults.appendChild(emptyRow(6, 'Chưa có kết quả. File được ghi khi một tài khoản thành công hoặc thất bại.'));
      return;
    }
    results.forEach(result => {
      const row = document.createElement('tr');
      const values = [result.username, result.name, result.email, result.status, result.note];
      values.forEach((value, cellIndex) => {
        const cell = document.createElement('td');
        if (cellIndex === 3) {
          cell.className = 'account-state';
          cell.classList.toggle('account-ok', value === 'thành công');
          cell.classList.toggle('account-error', value === 'thất bại');
        }
        if (cellIndex === 4) cell.className = 'wrap';
        cell.textContent = value || '-';
        row.appendChild(cell);
      });
      const paymentCell = document.createElement('td');
      if (result.payment_link) paymentCell.appendChild(paymentButton(result.payment_link));
      else paymentCell.textContent = '-';
      row.appendChild(paymentCell);
      historicalResults.appendChild(row);
    });
  } catch (error) {
    historicalResults.replaceChildren(emptyRow(6, error.message));
  }
}

function renderAccountRows(accounts = []) {
  accountRows.replaceChildren();
  if (!accounts.length) {
    accountRows.appendChild(emptyRow(5, 'Chưa có tài khoản. Thêm ở mục Cài đặt.'));
    return;
  }
  accounts.forEach((account, index) => {
    const row = document.createElement('tr');
    row.id = `account-row-${index + 1}`;
    row.dataset.name = `${account.fullName || ''} ${account.username || ''}`.toLowerCase();
    [`Tài khoản ${index + 1}`, account.username, account.fullName, 'Waiting', '-'].forEach((value, cellIndex) => {
      const cell = document.createElement('td');
      if (cellIndex === 3) cell.className = 'account-state';
      cell.textContent = cellIndex === 3 ? displayStatus(value) : (value || '-');
      row.appendChild(cell);
    });
    accountRows.appendChild(row);
  });
  updateAccountRows();
}

function updateAccountRows() {
  for (const [index, state] of accountRuns) {
    const row = document.querySelector(`#account-row-${index}`);
    if (!row) continue;
    const cells = row.querySelectorAll('td');
    const stateCell = row.querySelector('.account-state');
    const status = state.status || 'Waiting';
    stateCell.textContent = displayStatus(status);
    const failed = status === 'WHITELIST_BLOCKED' || status === 'Error' || status === 'Captcha failed' || String(status).startsWith('ERROR');
    const ready = status === 'Payment ready' || status === 'STOP_PAYMENT';
    stateCell.classList.toggle('account-error', failed);
    stateCell.classList.toggle('account-ok', ready);
    const paymentCell = cells[4];
    paymentCell.replaceChildren();
    if (state.paymentUrl) paymentCell.appendChild(paymentButton(state.paymentUrl));
    else paymentCell.textContent = '-';
  }
  const wanted = nameFilter.value.trim().toLowerCase();
  document.querySelectorAll('#accountRows tr').forEach(row => {
    row.hidden = Boolean(wanted) && !row.dataset.name.includes(wanted);
  });
}

function clearRunToInitial() {
  accountRuns.clear();
  window.LiveProgress.resetProgress(live);
  paintLive();
  runStartedAt = null;
  runPaused = false;
  lastEvent.textContent = 'Đang chờ';
  log.replaceChildren();
  document.querySelectorAll('#accountRows tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    const state = row.querySelector('.account-state');
    if (!state || cells.length < 5) return;
    state.textContent = displayStatus('Waiting');
    state.classList.remove('account-error', 'account-ok');
    cells[4].textContent = '-';
  });
}

function resetRunMonitor() {
  accountRuns.clear();
  window.LiveProgress.resetProgress(live);
  paintLive();
  runPaused = false;
  runStartedAt = Date.now();
  updateAccountRows();
}

function finishRunMonitor() {
  updateAccountRows();
  loadHistoricalResults();
}

function processLogLine(line) {
  const accountMatch = line.match(/\[account (\d+)(?:: ([^\]]+))?\]/);
  if (!accountMatch) return;
  const index = Number(accountMatch[1]);
  const timestampMatch = line.match(/\] \[(\d{4}-\d\d-\d\dT[^\]]+)\]/);
  const timestamp = timestampMatch ? Date.parse(timestampMatch[1]) : Date.now();
  const state = accountRuns.get(index) || { status: 'Waiting' };
  if (line.includes('BROWSER_LAUNCH_START')) { state.launchStartedAt = timestamp; state.status = 'Launching'; }
  else if (line.includes('SELECT_COUNTRY ') && /\bOPEN\b/i.test(line)) { state.startedAt = timestamp; state.status = 'Country open'; }
  else if (line.includes('BROWSER_LAUNCH_READY')) state.status = 'Browser ready';
  else if (line.includes('NAVIGATE ')) {
    const url = line.match(/NAVIGATE (https?:\/\/\S+)/)?.[1];
    if (url && /pay\.aspx|paymentgateway/i.test(url)) { state.paymentUrl = url; state.finishedAt = timestamp; state.status = 'Payment ready'; }
    else if (state.status !== 'Payment ready') state.status = 'Navigating';
  } else if (line.includes('dừng trước trang thanh toán')) { state.finishedAt ||= timestamp; state.status = 'Payment ready'; }
  else if (line.includes('PAYMENT_LINK ')) {
    state.paymentUrl = line.match(/PAYMENT_LINK (https?:\/\/\S+)/)?.[1] || state.paymentUrl;
    state.finishedAt ||= timestamp;
    state.status = 'Payment ready';
  }
  else if (line.includes('ACCOUNT_FINISHED')) {
    state.finishedAt = timestamp;
    state.status = line.match(/ACCOUNT_FINISHED status=([^ ]+)/)?.[1] || 'Finished';
  }
  else if (line.includes('WHITELIST_BLOCKED')) { state.finishedAt = timestamp; state.status = 'WHITELIST_BLOCKED'; }
  else if (line.includes('ACCOUNT_ERROR')) state.status = 'Error';
  const progressEvent = window.LiveProgress.parseProgressLine(line);
  const progressPage = progressEvent?.type === 'page' ? window.LiveProgress.pageSections[progressEvent.page] : '';
  if (/ACCOUNT_ERROR|lỗi:|RUN_FINISHED/.test(line)) state.finishedAt ||= timestamp;
  const settled = ['Payment ready', 'STOP_EXISTING_APPLICATION', 'STOP_PAYMENT', 'CANCELLED', 'STOPPED_KEEP_BROWSER', 'Error', 'WHITELIST_BLOCKED'].includes(state.status);
  if (!settled) {
    if (progressPage) state.status = window.LiveProgress.sectionTitle[progressPage];
    if (progressEvent?.type === 'page' && progressEvent.page === 'captcha') state.status = 'Solving captcha';
    if (progressEvent?.type === 'captcha') {
      const phase = window.LiveProgress.captchaPhase(progressEvent.status);
      if (phase === 'solving') state.status = 'Solving captcha';
      if (phase === 'solved') state.status = 'Captcha solved';
      if (phase === 'failed') state.status = 'Captcha failed';
    }
  }
  accountRuns.set(index, state);
  updateAccountRows();
  lastEvent.textContent = displayStatus(state.status);
  if (line.includes(' RESULT ')) loadHistoricalResults();
}

function noteLive(line) {
  const event = window.LiveProgress.parseProgressLine(line);
  if (!event) return;
  window.LiveProgress.applyProgressEvent(live, event);
  if (livePaint) return;
  livePaint = true;
  requestAnimationFrame(paintLive);
}

function paintLive() {
  livePaint = false;
  const accounts = Object.values(live.accounts).sort((left, right) => left.index - right.index);
  liveProgress.hidden = accounts.length === 0;
  liveAccounts.replaceChildren();
  for (const account of accounts) liveAccounts.append(liveCard(account));
  paintLiveForm(live.accounts[live.selected] || null);
}

function liveCard(account) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `live-card${account.index === live.selected ? ' selected' : ''}`;
  const title = document.createElement('strong');
  title.textContent = `Account ${account.index}`;
  const page = document.createElement('span');
  window.INZForm.stamp(page, account.page ? window.LiveProgress.sectionTitle[account.page] : 'Waiting for the website');
  const captcha = document.createElement('em');
  captcha.className = `live-captcha ${account.captcha}`;
  if (account.captcha) window.INZForm.stamp(captcha, captchaCaption(account));
  const count = document.createElement('span');
  const filled = Object.values(account.fields).filter(status => status === 'set').length;
  const filledLabel = document.createElement('span');
  window.INZForm.stamp(filledLabel, 'Filled');
  count.append(filledLabel, document.createTextNode(` ${filled}`));
  card.append(title, page, captcha, count);
  card.addEventListener('click', () => {
    live.pinned = true;
    live.selected = account.index;
    paintLive();
  });
  return card;
}

function captchaCaption(account) {
  const state = account.captcha === 'solved' ? 'Captcha solved' : account.captcha === 'failed' ? 'Captcha failed' : 'Solving captcha';
  return account.captchaKey ? `${state} · ${account.captchaKey}` : state;
}

function paintLiveForm(account) {
  formEditor.querySelectorAll('.live-filled, .live-missing').forEach(row => {
    row.classList.remove('live-filled', 'live-missing');
    row.querySelector('.live-badge')?.remove();
  });
  formEditor.querySelectorAll('[data-form-tab]').forEach(tab => tab.classList.remove('live-current', 'live-done'));
  if (!account) {
    inzLive.hidden = true;
    inzLive.replaceChildren();
    return;
  }
  const personalGroup = ['personal', 'identification', 'occupation'];
  formEditor.querySelectorAll('[data-form-tab]').forEach(tab => {
    const id = tab.dataset.formTab;
    const current = id === account.page || (tab.classList.contains('inz-main-tab') && id === 'personal' && personalGroup.includes(account.page));
    const seen = account.seen.includes(id) || (id === 'personal' && account.seen.some(section => personalGroup.includes(section)));
    tab.classList.toggle('live-current', current);
    tab.classList.toggle('live-done', seen && !current);
  });
  for (const [path, status] of Object.entries(account.fields)) {
    const input = path.startsWith('confirm:')
      ? formEditor.querySelector(`[data-confirm="${path.slice(8)}"]`)
      : formEditor.querySelector(`[data-path="${path}"]`);
    const row = input?.closest('.inz-row, .inz-declaration');
    if (!row) continue;
    row.classList.add(status === 'set' ? 'live-filled' : 'live-missing');
    const badge = document.createElement('span');
    badge.className = 'live-badge';
    window.INZForm.stamp(badge, status === 'set' ? 'Filled' : 'Not found on page');
    row.querySelector('label')?.append(badge);
  }
  inzLive.hidden = false;
  inzLive.replaceChildren();
  const who = document.createElement('strong');
  who.textContent = `Account ${account.index}`;
  const where = document.createElement('span');
  window.INZForm.stamp(where, account.page ? window.LiveProgress.sectionTitle[account.page] : 'Waiting for the website');
  inzLive.append(who, where);
  if (account.captcha) {
    const captcha = document.createElement('em');
    captcha.className = `live-captcha ${account.captcha}`;
    window.INZForm.stamp(captcha, captchaCaption(account));
    inzLive.append(captcha);
  }
}

function processRunnerOutput(text) {
  logRemainder += text;
  const lines = logRemainder.split('\n');
  logRemainder = lines.pop() || '';
  lines.forEach(line => { processLogLine(line); noteLive(line); });
}

function append(text, type = 'stdout') {
  text = redactDisplayedText(text);
  const line = document.createElement('span');
  line.className = type;
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  const visible = text.trim().split('\n').filter(Boolean).pop() || '';
  if (visible.startsWith('[app]')) lastEvent.textContent = visible.replace(/^\[app\]\s*/, '').slice(0, 80);
}

function setDataStatus(text, type = '') {
  dataStatus.textContent = text;
  dataStatus.className = `data-status ${type}`;
}

function setTelegramStatus(text, type = '') {
  telegramStatus.textContent = text;
  telegramStatus.className = `data-status ${type}`;
}

function setAccountsStatus(text, type = '') {
  const status = document.querySelector('#accountsStatus');
  status.textContent = text;
  status.className = `data-status ${type}`;
}

function accountsFromImport(content) {
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new Error('File không phải JSON hợp lệ.'); }
  const accounts = normalizeAccountProxyFlags(Array.isArray(parsed) ? parsed : [parsed]);
  if (!accounts.length || accounts.some(account => !account || typeof account !== 'object' || Array.isArray(account))) {
    throw new Error('File JSON phải là danh sách tài khoản.');
  }
  for (const [index, account] of accounts.entries()) {
    if (!account.username || !account.password || !account.email) throw new Error(`Tài khoản ${index + 1} thiếu username, password hoặc email.`);
    if (account.proxy !== undefined && typeof account.proxy !== 'boolean') throw new Error(`Tài khoản ${index + 1}: proxy chỉ được là true hoặc false.`);
  }
  return accounts;
}

function setRunning(running) {
  if (!running) runPaused = false;
  start.disabled = running;
  stop.disabled = !running || runPaused;
  resume.disabled = !running || !runPaused;
  cancel.disabled = !(running || runStartedAt);
  statusText.textContent = !running ? 'Sẵn sàng' : runPaused ? 'Tạm dừng' : 'Đang chạy';
  shell.classList.toggle('running', running && !runPaused);
  shell.classList.toggle('paused', running && runPaused);
  if (running && !runStartedAt) resetRunMonitor();
  if (!running && runStartedAt) finishRunMonitor();
}

async function loadTelegram() {
  try {
    const settings = await window.runnerApi.loadTelegram();
    schemeCountry.value = settings.schemeCountry;
    whitelistUrl.value = settings.whitelistUrl || 'Chưa có link';
    whitelistUrl.readOnly = true;
    proxyList.value = settings.proxyList || '';
    document.querySelector('#resultsFile').value = settings.resultsFile || 'Chưa có file';
    const mismatch = schemeMismatchMessage();
    if (mismatch && !dataStatus.classList.contains('invalid')) setDataStatus(mismatch, 'warn');
  } catch (error) {
    setTelegramStatus(error.message, 'invalid');
  }
}

async function saveTelegram() {
  try {
    if (dataMode === 'form') syncFormToJson();
    syncActiveAccounts();
    await window.runnerApi.saveTelegram({
      schemeCountry: schemeCountry.value,
      proxyList: proxyList.value
    });
    if (!await saveData(false)) {
      const message = dataStatus.textContent || 'Tài khoản hoặc hồ sơ chưa hợp lệ.';
      setTelegramStatus(message, 'invalid');
      setAccountsStatus(message, 'invalid');
      return false;
    }
    setTelegramStatus('Đã lưu quốc gia, proxy và tài khoản.', 'valid');
    setAccountsStatus('Đã lưu tài khoản.', 'valid');
    return true;
  } catch (error) {
    setTelegramStatus(error.message, 'invalid');
    setAccountsStatus(error.message, 'invalid');
    return false;
  }
}

async function testTelegram() {
  try {
    if (!await saveTelegram()) return;
    await window.runnerApi.testTelegram();
    setTelegramStatus('Đã gửi tin nhắn thử', 'valid');
  } catch (error) {
    setTelegramStatus(error.message, 'invalid');
  }
}

function schemeMismatchMessage() {
  let applicant = {};
  try { applicant = JSON.parse(applicantInput.value || '{}'); } catch { return ''; }
  const fromForm = String(applicant.scheme_country || '').trim();
  const fromSettings = schemeCountry.value.trim();
  if (!fromForm || !fromSettings || fromForm.toLowerCase() === fromSettings.toLowerCase()) return '';
  return `Quốc gia chương trình không khớp: form là "${fromForm}", Settings là "${fromSettings}". Tool chạy theo Settings, hãy sửa cho giống nhau.`;
}

function parseData() {
  const applicant = JSON.parse(applicantInput.value);
  window.INZForm.validateApplicant(applicant);
  const confirm = formEditor.querySelector('[data-confirm="identification.passport_number"]');
  const passport = formEditor.querySelector('[data-path="identification.passport_number"]');
  if (dataMode === 'form' && confirm && passport && confirm.value.trim() !== passport.value.trim()) {
    throw new Error('Nhập lại số hộ chiếu chưa khớp số hộ chiếu.');
  }
  const accounts = normalizeAccountProxyFlags(JSON.parse(accountsInput.value));
  if (!applicant || typeof applicant !== 'object' || Array.isArray(applicant)) throw new Error('Applicant phải là object JSON.');
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error('Cần ít nhất một tài khoản.');
  for (const [index, account] of accounts.entries()) {
    if (!account?.username || !account?.password || !account?.email) throw new Error(`Tài khoản ${index + 1} thiếu username, password hoặc email.`);
    if (account.proxy !== undefined && typeof account.proxy !== 'boolean') throw new Error(`Tài khoản ${index + 1}: proxy chỉ được là true hoặc false. Trong Form hãy tick "Dùng proxy".`);
  }
  accountsInput.value = JSON.stringify(accounts, null, 2);
  return { applicant: applicantInput.value, accounts: JSON.stringify(accounts), profiles: accounts.length };
}

function checkData() {
  try {
    const data = parseData();
    const applicant = JSON.parse(data.applicant);
    const accounts = JSON.parse(data.accounts);
    document.querySelector('#profiles').textContent = String(data.profiles);
    renderForm(applicant, accounts);
    renderAccountRows(accounts.map(account => ({
      ...account,
      fullName: [applicant.personal?.given_name_1, applicant.personal?.family_name].filter(Boolean).join(' '),
      passport: applicant.identification?.passport_number
    })));
    const mismatch = schemeMismatchMessage();
    setDataStatus(mismatch || `${data.profiles} tài khoản sẵn sàng`, mismatch ? 'warn' : 'valid');
    return data;
  } catch (error) {
    setDataStatus(error.message, 'invalid');
    return null;
  }
}

async function loadData() {
  try {
    const data = await window.runnerApi.loadData();
    applicantInput.value = JSON.stringify(JSON.parse(data.applicant), null, 2);
    accountsInput.value = JSON.stringify(JSON.parse(data.accounts), null, 2);
    checkData();
  } catch (error) {
    setDataStatus(error.message, 'invalid');
  }
}

async function saveData(showMessage = true) {
  if (dataMode === 'form') syncFormToJson();
  syncActiveAccounts();
  const data = checkData();
  if (!data) return false;
  try {
    await window.runnerApi.saveData(data);
    if (showMessage) {
      const mismatch = schemeMismatchMessage();
      setDataStatus(mismatch || 'Đã lưu', mismatch ? 'warn' : 'valid');
    }
    return true;
  } catch (error) {
    setDataStatus(error.message, 'invalid');
    return false;
  }
}

async function importFile(kind) {
  const result = await window.runnerApi.importData(kind);
  if (result.canceled) return;
  if (kind === 'applicant') applicantInput.value = result.content;
  else accountsInput.value = result.content;
  checkData();
}

async function exportFile(kind) {
  try {
    const data = parseData();
    const content = kind === 'applicant' ? data.applicant : data.accounts;
    const result = await window.runnerApi.exportData({ kind, content });
    if (!result.canceled) {
      const message = kind === 'applicant' ? 'Đã xuất hồ sơ.' : 'Đã xuất tài khoản.';
      setDataStatus(message, 'valid');
      if (kind === 'accounts') setAccountsStatus(message, 'valid');
    }
  } catch (error) {
    setDataStatus(error.message, 'invalid');
    if (kind === 'accounts') setAccountsStatus(error.message, 'invalid');
  }
}

document.querySelector('#saveData').addEventListener('click', () => saveData());
formMode.addEventListener('click', () => setDataMode('form'));
document.querySelectorAll('.form-tab').forEach(tab => tab.addEventListener('click', () => setFormTab(tab.dataset.formTab)));
formEditor.addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('[data-path]')) return;
  if (input.type === 'checkbox') {
    const token = input.closest('.inz-declaration')?.querySelector('.json-token');
    if (token) token.textContent = input.checked ? 'Yes' : 'No';
  }
  updateConditionalFields();
});
formEditor.addEventListener('click', event => {
  const direction = event.target.closest('[data-inz-nav]')?.dataset.inzNav;
  if (direction) moveFormPage(direction === 'next' ? 1 : -1);
});
jsonMode.addEventListener('click', () => {
  if (dataMode === 'form') syncFormToJson();
  setDataMode('json');
});
addAccount.addEventListener('click', () => accountsFormRows.appendChild(appendAccountRow()));
document.querySelector('#importAccounts').addEventListener('click', async () => {
  try {
    const result = await window.runnerApi.importData('accounts');
    if (result.canceled) return;
    const accounts = accountsFromImport(result.content);
    accountsInput.value = JSON.stringify(accounts, null, 2);
    accountsFormRows.replaceChildren();
    accounts.forEach(account => accountsFormRows.appendChild(appendAccountRow(account)));
    const saved = checkData();
    setAccountsStatus(saved ? `Đã nhập ${accounts.length} tài khoản. Bấm Lưu tài khoản để ghi.` : 'Đã hiện tài khoản từ file. Kiểm tra lại hồ sơ trước khi lưu.', saved ? 'valid' : 'warn');
  } catch (error) {
    setAccountsStatus(error.message, 'invalid');
  }
});
document.querySelector('#accountsFormMode').addEventListener('click', () => setAccountsMode('form'));
document.querySelector('#accountsJsonMode').addEventListener('click', () => setAccountsMode('json'));
document.querySelector('#exportAccounts').addEventListener('click', () => {
  syncActiveAccounts();
  exportFile('accounts');
});
document.querySelector('#saveAccounts').addEventListener('click', saveTelegram);
document.querySelector('#saveTelegram').addEventListener('click', saveTelegram);
document.querySelector('#openRegistration').addEventListener('click', async () => {
  try {
    const data = parseData();
    const accounts = JSON.parse(data.accounts);
    const result = await window.runnerApi.openRegistration({
      applicant: JSON.parse(data.applicant),
      account: accounts[0]
    });
    dataStatus.textContent = `Registration mở cho ${result.email}. Kiểm tra rồi tự bấm REGISTER.`;
    dataStatus.className = 'data-status valid';
  } catch (error) {
    dataStatus.textContent = error.message;
    dataStatus.className = 'data-status invalid';
  }
});
document.querySelector('#openRegistrations').addEventListener('click', async () => {
  try {
    const data = parseData();
    const result = await window.runnerApi.openRegistrations({
      applicant: JSON.parse(data.applicant),
      accounts: JSON.parse(data.accounts)
    });
    dataStatus.textContent = `Đã mở ${result.count} tab Registration. Kiểm tra rồi tự bấm REGISTER từng tab.`;
    dataStatus.className = 'data-status valid';
  } catch (error) {
    dataStatus.textContent = error.message;
    dataStatus.className = 'data-status invalid';
  }
});
async function openResultsFile() {
  try { await window.runnerApi.openResults(); }
  catch (error) {
    lastEvent.textContent = error.message;
    setTelegramStatus(error.message, 'invalid');
  }
}
document.querySelector('#openResults').addEventListener('click', openResultsFile);
document.querySelector('#openResultsSettings').addEventListener('click', openResultsFile);
document.querySelector('#testTelegram').addEventListener('click', testTelegram);
document.querySelector('#importApplicant').addEventListener('click', () => importFile('applicant'));
document.querySelector('#exportApplicant').addEventListener('click', () => exportFile('applicant'));
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab, .tab-panel').forEach(element => element.classList.remove('active'));
  tab.classList.add('active');
  document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
}));
applicantInput.addEventListener('input', checkData);
accountsInput.addEventListener('input', () => {
  if (accountsMode !== 'json') return;
  try {
    const accounts = accountsFromImport(accountsInput.value);
    setAccountsStatus(`${accounts.length} tài khoản trong JSON. Bấm Lưu tài khoản để ghi.`, 'valid');
  } catch (error) {
    setAccountsStatus(error.message, 'invalid');
  }
});
nameFilter.addEventListener('input', updateAccountRows);

let resetAfterCancel = false;
let lastRunnerFault = '';

function failStart(message) {
  append(`[app] ${message}\n`, 'stderr');
  lastEvent.textContent = message;
  lastEvent.title = message;
  start.disabled = false;
}

async function startRunnerFromUi() {
  if (start.disabled) return false;
  start.disabled = true;
  if (!await saveData(false)) {
    failStart(dataStatus.textContent || 'Không chạy được. Kiểm tra hồ sơ và tài khoản.');
    return false;
  }
  if (!await saveTelegram()) {
    failStart(telegramStatus.textContent || accountsStatusMessage() || 'Không lưu được cài đặt.');
    return false;
  }
  const mismatch = schemeMismatchMessage();
  if (mismatch) {
    setDataStatus(mismatch, 'warn');
    failStart(mismatch);
    return false;
  }
  lastRunnerFault = '';
  const result = await window.runnerApi.start();
  if (!result.ok) {
    failStart(result.message);
    return false;
  }
  append('[app] Đã bắt đầu.\n');
  lastEvent.textContent = 'Đang chạy';
  return true;
}

function accountsStatusMessage() {
  return document.querySelector('#accountsStatus').textContent;
}

start.addEventListener('click', () => startRunnerFromUi());
stop.addEventListener('click', async () => {
  const result = await window.runnerApi.pause();
  if (result.ok) {
    runPaused = true;
    setRunning(true);
  }
  append(`[app] ${result.message || 'Không tạm dừng được'}\n`);
});
resume.addEventListener('click', async () => {
  const result = await window.runnerApi.resume();
  if (result.ok) {
    runPaused = false;
    setRunning(true);
  }
  append(`[app] ${result.message || 'Không tiếp tục được'}\n`);
});
cancel.addEventListener('click', async () => {
  cancel.disabled = true;
  const result = await window.runnerApi.cancel();
  if (result.ok) {
    resetAfterCancel = true;
    return;
  }
  clearRunToInitial();
  setRunning(false);
});
document.querySelector('#clear').addEventListener('click', () => { log.replaceChildren(); lastEvent.textContent = 'Đang chờ'; });
document.querySelector('#refreshLogs').addEventListener('click', loadArchivedLogs);
logFilter.addEventListener('input', renderArchivedLogs);
if (window.runnerApi) {
  window.runnerApi.onOutput(data => {
    append(data.text, data.type);
    processRunnerOutput(data.text);
    if (data.type === 'stderr') {
      const fault = data.text.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('at '));
      if (fault) lastRunnerFault = fault;
    }
  });
  window.runnerApi.onStatus(data => setRunning(data.running));
  window.runnerApi.onExit(data => {
    if (resetAfterCancel) {
      resetAfterCancel = false;
      clearRunToInitial();
      setRunning(false);
      loadHistoricalResults();
      return;
    }
    setRunning(false);
    const blocked = [...accountRuns.values()].filter(item => item.status === 'WHITELIST_BLOCKED').length;
    if (data.code === 0) append('[app] Đã chạy xong.\n');
    else if (blocked) append(`[app] Không chạy: ${blocked} username không có trong whitelist.\n`, 'stderr');
    else if (lastRunnerFault) append(`[app] ${lastRunnerFault}\n`, 'stderr');
    else append(`[app] Runner dừng, mã ${data.code}.\n`, 'stderr');
  });
  loadData();
  loadArchivedLogs();
}
loadTelegram();
updatePager();