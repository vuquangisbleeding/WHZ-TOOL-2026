const QUOTA_CLOSED = /no longer a place available|no places available|no places left|there are no places|quota has been filled|quota is closed|applications are no longer being accepted|scheme is now closed/i;

function isQuotaClosedText(text) {
  return QUOTA_CLOSED.test(String(text || ''));
}

async function isQuotaClosed(page) {
  const text = await page.evaluate(() => `${location.href} ${document.body?.innerText || ''}`).catch(() => '');
  return isQuotaClosedText(text);
}

async function clickSubmit(page, label, stats) {
  const { clickFirstControl, clickLabeled } = require('./actions');
  const actions = require('./selectors/actions');
  return clickFirstControl(page, actions.submit, label, stats)
    || clickLabeled(page, ['SUBMIT'], ['CANCEL', 'PAY NOW', 'PAY LATER'], label, stats);
}

async function refreshUntilSubmit(page, label, stats) {
  const config = require('./config');
  const { recoverHighLoad } = require('./recovery');
  const { pauseForCaptcha } = require('./captcha');
  const { loadDocument, documentLoadOptions } = require('./timing');
  const { isStopRequested, waitIfPaused, sleepUnlessStopped } = require('./stop');
  console.log(`[${label}] QUOTA_CLOSED hết slot. Tải lại đúng trang này.`);
  let attempt = 0;
  while (!isStopRequested()) {
    await waitIfPaused();
    if (isStopRequested()) return 'stopped';
    attempt += 1;
    console.log(`[${label}] QUOTA_REFRESH lần ${attempt}`);
    try {
      await loadDocument(page, () => page.reload(documentLoadOptions));
    } catch (error) {
      console.log(`[${label}] QUOTA_REFRESH_FAILED ${error.message}`);
    }
    if (isStopRequested()) return 'stopped';
    await recoverHighLoad(page, label);
    await pauseForCaptcha(page, label, stats);
    if (isStopRequested()) return 'stopped';
    if (!await isQuotaClosed(page)) {
      if (await clickSubmit(page, label, stats)) return 'submitted';
      return 'ready';
    }
    if (!await sleepUnlessStopped(config.countryPollMs)) return 'stopped';
  }
  return 'stopped';
}

module.exports = { isQuotaClosedText, isQuotaClosed, refreshUntilSubmit };
