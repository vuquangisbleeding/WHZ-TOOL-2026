const { fs, path } = require('./io');
const config = require('./config');

const RESULT_COLUMNS = ['username', 'name', 'email', 'status', 'payment_link', 'note'];

function resultsPath(root = config.root) {
  return path.join(root, 'results.csv');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseResultsCsv(text) {
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
  const filled = rows.filter(item => item.some(value => String(value).trim()));
  if (!filled.length) return [];
  const header = filled[0].map(value => String(value).trim());
  return filled.slice(1).map(values => {
    const record = {};
    header.forEach((key, index) => { record[key] = values[index] || ''; });
    return record;
  });
}

function resultRecord({ account, applicant, status, paymentUrl, note }) {
  const name = [applicant?.personal?.given_name_1, applicant?.personal?.family_name].filter(Boolean).join(' ');
  const success = status === 'STOP_PAYMENT';
  return {
    username: String(account?.username || ''),
    name,
    email: String(account?.email || applicant?.contact?.email || ''),
    status: success ? 'thành công' : 'thất bại',
    payment_link: paymentUrl || '',
    note: success ? '' : String(note || status || '').replace(/^ERROR:\s*/, '')
  };
}

async function appendResult(record, root = config.root) {
  const file = resultsPath(root);
  let header = '';
  try { await fs.access(file); } catch { header = `${RESULT_COLUMNS.join(',')}\n`; }
  const line = RESULT_COLUMNS.map(key => csvEscape(record[key])).join(',');
  await fs.appendFile(file, `${header}${line}\n`);
  return file;
}

async function readResults(root = config.root) {
  const text = await fs.readFile(resultsPath(root), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return parseResultsCsv(text);
}

module.exports = { RESULT_COLUMNS, resultsPath, csvEscape, parseResultsCsv, resultRecord, appendResult, readResults };
