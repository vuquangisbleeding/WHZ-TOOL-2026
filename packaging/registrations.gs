/**
 * Gắn script này vào đúng một Google Sheet đăng ký.
 * Hàng đầu tiên là tiêu đề, giống registrations.csv.
 *
 * 1. Tạo một Google Sheet trống (không dùng sheet whitelist).
 * 2. Extensions → Apps Script, dán toàn bộ file này, Save.
 * 3. Deploy → New deployment → Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 4. Copy link kết thúc bằng /exec vào web/sheet-config.js
 * 5. Project Settings → Script properties: thêm WHITELIST_URL bằng URL whitelist.
 *
 * Sheet không cần share công khai. Mở file trên Google Sheet để đọc các dòng mới.
 */
function headers_() {
  return ["created_at", "kind", "id", "full_name", "birth_date", "email", "facebook", "note", "quantity", "package_name", "price", "saved", "profile_json"];
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
  const width = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) { return String(value); });
  const first = current[0] || "";
  if (first !== headers[0]) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  if (current.length < headers.length || current[headers.length - 1] !== headers[headers.length - 1]) {
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

function whitelistTelegram_() {
  var properties = PropertiesService.getScriptProperties();
  var whitelistUrl = String(properties.getProperty("WHITELIST_URL") || "").trim();
  if (!whitelistUrl) return { token: "", chatId: "" };
  var rows = SpreadsheetApp.openByUrl(whitelistUrl).getSheets()[0].getDataRange().getValues();
  if (!rows.length) return { token: "", chatId: "" };
  var headers = rows[0].map(function (value) {
    return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
  });
  var tokenColumn = headers.indexOf("bottoken");
  var chatColumn = headers.indexOf("chatid");
  if (tokenColumn < 0 || chatColumn < 0) return { token: "", chatId: "" };
  for (var index = 1; index < rows.length; index += 1) {
    var token = String(rows[index][tokenColumn] || "").trim();
    var chatId = String(rows[index][chatColumn] || "").trim();
    if (token && chatId) return { token: token, chatId: chatId };
  }
  return { token: "", chatId: "" };
}

function sendTelegram_(data) {
  var telegram = whitelistTelegram_();
  if (!telegram.token || !telegram.chatId) throw new Error("Whitelist chưa có bot token hoặc chat ID.");
  var message = [
    "HỒ SƠ ĐĂNG KÝ MỚI",
    "Facebook: " + String(data.facebook || ""),
    "Số tài khoản: " + String(data.quantity || ""),
    "Thời gian: " + String(data.created_at || ""),
    "",
    "Hồ sơ:",
    String(data.profile_json || "{}")
  ].join("\n");
  for (var start = 0; start < message.length; start += 3800) {
    var response = UrlFetchApp.fetch("https://api.telegram.org/bot" + telegram.token + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: telegram.chatId, text: message.slice(start, start + 3800) }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() >= 300) throw new Error("Telegram HTTP " + response.getResponseCode());
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    append_(data);
    sendTelegram_(data);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doGet(e) {
  const id = String((e && e.parameter && e.parameter.id) || "");
  if (!id) return json_({ ok: true });
  const sheet = sheet_();
  ensureHeader_(sheet);
  return json_({ ok: hasId_(sheet, id), id: id });
}
