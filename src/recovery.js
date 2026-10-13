const config = require('./config');
const { sleep, loadDocument, documentLoadOptions, isContextGone } = require('./timing');
const { isStopRequested, waitIfPaused, sleepUnlessStopped } = require('./stop');
const refreshLocks = new WeakMap();

async function isHighLoadPage(page) {
  while (!isStopRequested()) {
    await waitIfPaused();
    try {
      const content = await page.evaluate(() => `${location.href} ${document.body?.innerText || ''}`);
      return /site is under high load|currently experiencing high demand|system is busy|please try again later|try again later/i.test(content);
    } catch (error) {
      if (!isContextGone(error)) {
        console.log(`[HIGH_LOAD_PROBE_ERROR] không đọc được trang: ${error.message}`);
        return false;
      }
      await sleep(50);
    }
  }
  return false;
}

async function recoverHighLoad(page, label) {
  const previousRefresh = refreshLocks.get(page);
  if (previousRefresh) return previousRefresh;
  const recovery = recoverHighLoadLocked(page, label);
  refreshLocks.set(page, recovery);
  try {
    return await recovery;
  } finally {
    refreshLocks.delete(page);
  }
}

async function recoverHighLoadLocked(page, label) {
  let attempt = 0;
  const batchSize = Math.max(1, config.maxHighLoadRetries);
  while (true) {
    await waitIfPaused();
    if (isStopRequested()) return false;
    attempt += 1;
    if (!await isHighLoadPage(page)) return false;
    const batchAttempt = ((attempt - 1) % batchSize) + 1;
    const delay = attempt === 1 ? 0 : config.highLoadBackoffMs;
    console.log(`[${label}] INZ quá tải (${batchAttempt}/${batchSize}), tải lại trang, không dừng`);
    if (delay && !await sleepUnlessStopped(delay)) return false;
    console.log(`[${label}] HIGH_LOAD_REFRESH_START`);
    try {
      await loadDocument(page, () => page.reload(documentLoadOptions));
    } catch (error) {
      console.log(`[${label}] HIGH_LOAD_REFRESH_FAILED ${error.message}`);
    }
    console.log(`[${label}] HIGH_LOAD_REFRESH_DONE`);
    if (!await isHighLoadPage(page)) return false;
    if (batchAttempt === batchSize) {
      console.log(`[${label}] HIGH_LOAD_BATCH_COOLDOWN`);
      const deadline = Date.now() + config.highLoadCooldownMs;
      while (Date.now() < deadline) {
        if (!await isHighLoadPage(page)) return false;
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        if (!await sleepUnlessStopped(Math.min(250, remaining))) return false;
      }
    }
  }
}

async function waitForManualRecovery(page, label, error) {
  const previousUrl = await page.url();
  const previousMarker = await readManualMarker(page);
  console.log(`[${label}] MANUAL_RECOVERY_WAIT error=${error.message}`);
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      page.off('framenavigated', onFrameNavigated);
      page.off('close', onClose);
    };
    const finish = result => { cleanup(); resolve(result); };
    const check = async () => {
      if (page.isClosed()) return;
      try {
        const currentUrl = await page.url();
        const currentMarker = await readManualMarker(page);
        if (currentUrl !== previousUrl || currentMarker !== previousMarker) {
          console.log(`[${label}] MANUAL_RECOVERY_DETECTED url=${currentUrl}`);
          finish(true);
        }
      } catch (checkError) {
        cleanup();
        reject(checkError);
      }
    };
    const onFrameNavigated = frame => { if (frame === page.mainFrame()) finish(true); };
    const onClose = () => { cleanup(); reject(new Error('Chrome page đã bị đóng trong lúc chờ thao tác thủ công.')); };
    const timer = setInterval(check, config.manualRecoveryPollMs);
    page.on('framenavigated', onFrameNavigated);
    page.on('close', onClose);
    check();
  });
}

async function readManualMarker(page) {
  return page.evaluate(() => {
    const body = (document.body?.innerText || '').slice(0, 500);
    const fields = [...document.querySelectorAll('input,select,textarea')]
      .map(element => `${element.name || element.id}:${element.value || ''}:${element.checked ? 'checked' : ''}`)
      .join('|');
    return `${body}\nFORM:${fields}`;
  });
}

module.exports = { isHighLoadPage, recoverHighLoad, waitForManualRecovery };