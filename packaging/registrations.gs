/**
 * Gắn script này vào đúng một Google Sheet đăng ký.
 * Hàng đầu tiên là tiêu đề, giống registrations.csv.
 *
 * 1. Tạo một Google Sheet trống (không dùng sheet whitelist).
 * 2. Extensions → Apps Script, dán toàn bộ file này, Save.
 * 3. Deploy → New deployment → Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 4. Copy link kết thúc bằng /exec vào web/sheet-config.js
 *
 * Sheet không cần share công khai. Mở file trên Google Sheet để đọc các dòng mới.
 */
function headers_() {
  return ["created_at", "kind", "id", "full_name", "birth_date", "email", "facebook", "note", "quantity", "package_name", "price", "saved"];
}

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function ensureHeader_(sheet) {
  const headers = headers_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const first = String(sheet.getRange(1, 1).getValue() || "");
  if (first !== headers[0]) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function idColumn_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) { return String(value); });
  const index = headers.indexOf("id");
  return index === -1 ? 3 : index + 1;
}

function hasId_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2 || !id) return false;
  const column = idColumn_(sheet);
  const values = sheet.getRange(2, column, last - 1, 1).getValues();
  return values.some(function (row) { return String(row[0]) === id; });
}

function append_(data) {
  const sheet = sheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    ensureHeader_(sheet);
    if (hasId_(sheet, String(data.id || ""))) return;
    const headers = headers_();
    sheet.appendRow(headers.map(function (key) {
      const value = data[key];
      return value == null ? "" : value;
    }));
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    append_(JSON.parse(e.postData.contents));
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false });
  }
}

function doGet(e) {
  const id = String((e && e.parameter && e.parameter.id) || "");
  if (!id) return json_({ ok: true });
  const sheet = sheet_();
  ensureHeader_(sheet);
  return json_({ ok: hasId_(sheet, id), id: id });
}
