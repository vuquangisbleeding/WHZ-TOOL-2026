const QUOTA_CLOSED = /no places available|no places left|there are no places|quota has been filled|quota is closed|applications are no longer being accepted|scheme is now closed/i;

function isQuotaClosedText(text) {
  return QUOTA_CLOSED.test(String(text || ''));
}

async function isQuotaClosed(page) {
  const text = await page.evaluate(() => `${location.href} ${document.body?.innerText || ''}`).catch(() => '');
  return isQuotaClosedText(text);
}

module.exports = { isQuotaClosedText, isQuotaClosed };
