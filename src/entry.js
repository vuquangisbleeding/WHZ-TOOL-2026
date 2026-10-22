const config = require('./config');
const textSelectors = require('./selectors/text');
const { firstExisting } = require('./dom');
const { clickFirstControl, clickLabeled } = require('./actions');
const { recoverHighLoad } = require('./recovery');
const { pauseForCaptcha } = require('./captcha');
const { watchClickedAction, loadDocument, documentLoadOptions, waitUntilDocumentReady, isContextGone } = require('./timing');
const { isStopRequested, waitIfPaused, sleepUnlessStopped } = require('./stop');

async function isExistingApplicationScreen(page) {
  let url = '';
  try { url = page.url(); } catch { return false; }
  if (/\/Application\/Delete\.aspx/i.test(url)) return true;
  return page.evaluate(() => {
    const edit = document.querySelector("a[id^='ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_']");
    const text = document.body?.innerText || '';
    return Boolean(edit) || (/Existing Applications/i.test(text) && /Submit\s*Delete/i.test(text));
  }).catch(() => false);
}

async function selectSchemeCountry(page, country, label, stats) {
  let attempt = 0;
  while (true) {
    await waitIfPaused();
    if (isStopRequested()) return null;
    attempt += 1;
    let result;
    try {
      result = await page.evaluate(wanted => {
      const normalized = wanted.trim().toLowerCase();
      const name = [...document.querySelectorAll("[id^='ContentPlaceHolder1_countryRepeater_countryName_']")].find(element => element.textContent.trim().toLowerCase() === normalized);
      if (!name) return { found: false, open: false, cardText: '' };
      const suffix = name.id.split('_').pop(); const status = document.getElementById(`ContentPlaceHolder1_countryRepeater_countryStatus_${suffix}`);
      const link = document.getElementById(`ContentPlaceHolder1_countryRepeater_createLink_${suffix}`); const card = link?.closest('.category-item') || name.parentElement;
      const cardText = (card?.innerText || '').replace(/\s+/g, ' ').trim();
      if (!link || !/\bopen\b/i.test(status?.textContent || '') || /\bclosed\b/i.test(status?.textContent || '')) return { found: true, open: false, cardText };
      return { found: true, open: true, cardText, linkId: link.id };
    }, country);
    } catch (error) {
      if (!isContextGone(error)) throw error;
      await waitUntilDocumentReady(page);
      continue;
    }
    if (result.open) {
      const selectedAt = Date.now();
      console.log(`[${label}] SELECT_COUNTRY ${country} (${result.cardText})`);
      const progress = await watchClickedAction(page, label, () => page.evaluate(linkId => document.getElementById(linkId)?.click(), result.linkId));
      if (progress === 'stopped' || isStopRequested()) return null;
      await recoverHighLoad(page, label); await pauseForCaptcha(page, label, stats); return selectedAt;
    }
    console.log(`[${label}] ${country} chưa OPEN (lần ${attempt}: ${result.cardText || 'chưa xuất hiện'}), refresh sau ${config.countryPollMs}ms`);
    if (!await sleepUnlessStopped(config.countryPollMs)) return null;
    try {
      await loadDocument(page, () => page.reload(documentLoadOptions));
    } catch (error) {
      console.log(`[${label}] COUNTRY_REFRESH_FAILED ${error.message}`);
    }
    await recoverHighLoad(page, label);
    await pauseForCaptcha(page, label, stats);
  }
}

async function continueToApplication(page, applicant, label, stats) {
  if (await isExistingApplicationScreen(page)) return { stop: 'EXISTING_APPLICATION' };
  await page.waitForFunction(() => Boolean(document.querySelector('[id^="ContentPlaceHolder1_countryRepeater_countryName_"], #ContentPlaceHolder1_applyNowButton, [id^="ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_"], [id$="familyNameTextBox"]') || [...document.querySelectorAll('a,button,input')].some(node => /existing|continue|resume|apply now/i.test(`${node.textContent} ${node.value} ${node.href}`))), { timeout: 0 }).catch(error => {
    if (!isContextGone(error)) console.log(`[${label}] ENTRY_WAIT ${error.message}`);
  });
  if (await isExistingApplicationScreen(page)) return { stop: 'EXISTING_APPLICATION' };
  if (/wizard/i.test(await page.url()) || await firstExisting(page, textSelectors.familyName)) return;
  const country = config.schemeCountry || applicant.scheme_country;
  if (await page.$("[id^='ContentPlaceHolder1_countryRepeater_countryName_']")) {
    if (!country) throw new Error('Chưa cấu hình scheme country');
    const selectedAt = await selectSchemeCountry(page, country, label, stats);
    if (selectedAt == null) return { stop: 'STOPPED' };
    if (await clickFirstControl(page, ['#ContentPlaceHolder1_applyNowButton'], label, stats) || await clickLabeled(page, ['APPLY NOW'], [], label, stats)) return { startedAt: selectedAt };
  }
  const apply = await page.$('#ContentPlaceHolder1_applyNowButton');
  if (apply) {
    const progress = await watchClickedAction(page, label, () => page.evaluate(element => element.click(), apply));
    if (progress === 'stopped' || isStopRequested()) return { stop: 'STOPPED' };
    await recoverHighLoad(page, label);
    return { startedAt: Date.now() };
  }
  throw new Error(`Không tìm thấy entry hồ sơ sau login. ${(await page.evaluate(() => document.body?.innerText || '')).slice(0, 250)}`);
}

module.exports = { continueToApplication, isExistingApplicationScreen, selectSchemeCountry };