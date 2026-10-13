const config = require('./config');
const { maskUsername } = require('./privacy');

async function sendTelegramMessage(message) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log('[TELEGRAM] bỏ qua: whitelist không có bot token hoặc chat ID.');
    return false;
  }
  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.telegramChatId, text: message })
  });
  if (!response.ok) throw new Error(`Telegram trả về HTTP ${response.status}`);
  console.log('[TELEGRAM] đã gửi kết quả');
  return true;
}

function applicantSummary(applicant, account) {
  const name = [applicant.personal?.given_name_1, applicant.personal?.family_name].filter(Boolean).join(' ') || '(chưa có tên)';
  return `Tên: ${name}\nTài khoản: ${maskUsername(account.username)}`;
}

function buildTelegramSummary(results) {
  const lines = ['KẾT QUẢ RUNNER INZ', ''];
  for (const result of results) {
    lines.push(`[${result.status}] ${result.label}`, `Payment link: ${result.paymentUrl || '(chưa có)'}`, result.applicantInfo, '');
  }
  return lines.join('\n').trim();
}

module.exports = { sendTelegramMessage, applicantSummary, buildTelegramSummary };