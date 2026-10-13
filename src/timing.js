const config = require('./config');
const { isStopRequested, waitIfPaused } = require('./stop');

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const CONTEXT_GONE = /Execution context was destroyed|Cannot find context with specified id|Navigating frame was detached|detached Frame/i;
const POLL_MS = 50;
const documentLoadOptions = { waitUntil: 'domcontentloaded', timeout: 0 };

function isContextGone(error) {
  return CONTEXT_GONE.test(error?.message || '');
}

async function loadDocument(page, action) {
  try {
    await action();
  } catch (error) {
    if (!isContextGone(error)) throw error;
  }
  return waitUntilDocumentReady(page);
}

async function resetPageScroll(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })).catch(() => {});
}

async function waitUntilDocumentReady(page, isCancelled = () => false) {
  while (!isCancelled() && !isStopRequested()) {
    await waitIfPaused();
    try {
      const ready = await page.evaluate(() => document.readyState === 'interactive' || document.readyState === 'complete');
      if (ready) return true;
    } catch (error) {
      if (!isContextGone(error)) throw error;
    }
    await sleep(POLL_MS);
  }
  return false;
}

function isMainFrameNavigation(page, request) {
  try {
    if (typeof request.isNavigationRequest === 'function' && !request.isNavigationRequest()) return false;
    if (typeof page.mainFrame === 'function' && typeof request.frame === 'function' && request.frame() !== page.mainFrame()) return false;
  } catch {
    return false;
  }
  return true;
}

function isDataRequest(page, request) {
  try {
    if (typeof request.isNavigationRequest === 'function' && request.isNavigationRequest()) return false;
    const type = typeof request.resourceType === 'function' ? request.resourceType() : '';
    if (type !== 'xhr' && type !== 'fetch') return false;
    if (typeof page.mainFrame === 'function' && typeof request.frame === 'function' && request.frame() !== page.mainFrame()) return false;
    return true;
  } catch {
    return false;
  }
}

function trackMainFrameNavigations(page) {
  let inflight = 0;
  let seen = false;
  let failed = false;
  let pendingData = 0;
  if (typeof page.on !== 'function') return { inflight: () => 0, seen: () => false, failed: () => false, pendingData: () => 0, stop() {} };
  const onRequest = request => {
    if (isDataRequest(page, request)) {
      pendingData += 1;
      return;
    }
    if (!isMainFrameNavigation(page, request)) return;
    seen = true;
    inflight += 1;
  };
  const onFinished = request => {
    if (isDataRequest(page, request)) {
      pendingData = Math.max(0, pendingData - 1);
      return;
    }
    if (!isMainFrameNavigation(page, request)) return;
    inflight = Math.max(0, inflight - 1);
  };
  const onFailed = request => {
    if (isDataRequest(page, request)) {
      pendingData = Math.max(0, pendingData - 1);
      return;
    }
    if (!isMainFrameNavigation(page, request)) return;
    inflight = Math.max(0, inflight - 1);
    failed = true;
  };
  page.on('request', onRequest);
  page.on('requestfinished', onFinished);
  page.on('requestfailed', onFailed);
  return {
    inflight: () => inflight,
    seen: () => seen,
    failed: () => failed,
    pendingData: () => pendingData,
    stop() {
      page.off?.('request', onRequest);
      page.off?.('requestfinished', onFinished);
      page.off?.('requestfailed', onFailed);
    }
  };
}

function trackDocumentNavigation(page) {
  const status = { value: null };
  const abort = new AbortController();
  let settled = false;
  const finish = value => {
    if (settled) return;
    settled = true;
    status.value = value;
  };
  if (typeof page.waitForNavigation === 'function') {
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 0, signal: abort.signal })
      .then(() => finish('navigation'))
      .catch(error => finish(abort.signal.aborted || error?.name === 'AbortError' ? 'aborted' : (isContextGone(error) ? 'navigation' : 'aborted')));
  }
  return {
    status,
    abort() {
      abort.abort();
      finish('aborted');
    }
  };
}

async function readPageState(page, previousUrl, previousMarker) {
  return page.evaluate((url, marker) => ({
    href: location.href,
    ready: document.readyState === 'interactive' || document.readyState === 'complete',
    changed: location.href !== url || (document.body?.innerText || '').slice(0, 500) !== marker
  }), previousUrl, previousMarker);
}

function logProgress(label, progress) {
  if (progress === 'ui_timeout') console.log(`[${label}] ACTION_NO_VISIBLE_CHANGE`);
  else if (progress !== 'stopped' && progress !== 'skipped') console.log(`[${label}] ACTION_PROGRESS ${progress}`);
  return progress;
}

async function watchClickedAction(page, label, click) {
  const previousUrl = await page.url();
  let previousMarker = '';
  try {
    previousMarker = await page.evaluate(() => (document.body?.innerText || '').slice(0, 500));
  } catch (error) {
    if (!isContextGone(error)) throw error;
  }
  const tracker = trackMainFrameNavigations(page);
  const navigation = trackDocumentNavigation(page);
  try {
    let outcome;
    try {
      outcome = await click();
    } catch (error) {
      if (!isContextGone(error)) throw error;
      const ready = await waitUntilDocumentReady(page);
      return logProgress(label, ready ? 'navigation' : 'stopped');
    }
    if (outcome === false) return 'skipped';
    let idleMs = 0;
    while (!isStopRequested()) {
      await waitIfPaused();
      if (navigation.status.value === 'navigation') {
        const ready = await waitUntilDocumentReady(page);
        return logProgress(label, ready ? 'navigation' : 'stopped');
      }
      let state;
      try {
        state = await readPageState(page, previousUrl, previousMarker);
      } catch (error) {
        if (!isContextGone(error)) throw error;
        const ready = await waitUntilDocumentReady(page);
        return logProgress(label, ready ? 'navigation' : 'stopped');
      }
      if (state.href !== previousUrl && state.ready) return logProgress(label, 'navigation');
      if (tracker.inflight() > 0 || tracker.pendingData() > 0 || (tracker.seen() && !tracker.failed())) {
        await sleep(POLL_MS);
        continue;
      }
      if (tracker.failed()) return logProgress(label, 'navigation_failed');
      if (state.changed) return logProgress(label, 'ui');
      if (idleMs >= config.clickWaitTimeoutMs) return logProgress(label, 'ui_timeout');
      await sleep(POLL_MS);
      idleMs += POLL_MS;
    }
    return 'stopped';
  } finally {
    navigation.abort();
    tracker.stop();
  }
}

function waitForNextDocument(page, previousUrl = page.url()) {
  const abort = new AbortController();
  let stopLoop = false;
  const finished = (async () => {
    const navigation = trackDocumentNavigation(page);
    try {
      const startUrl = typeof previousUrl === 'string' ? previousUrl : await previousUrl;
      while (!stopLoop && !abort.signal.aborted && !isStopRequested()) {
        await waitIfPaused();
        if (navigation.status.value === 'navigation') return waitUntilDocumentReady(page, () => stopLoop || abort.signal.aborted);
        try {
          const state = await page.evaluate(url => ({
            href: location.href,
            ready: document.readyState === 'interactive' || document.readyState === 'complete'
          }), startUrl);
          if (state.href !== startUrl && state.ready) return true;
        } catch (error) {
          if (!isContextGone(error)) throw error;
          return waitUntilDocumentReady(page, () => stopLoop || abort.signal.aborted);
        }
        await sleep(POLL_MS);
      }
      return false;
    } finally {
      navigation.abort();
    }
  })();
  finished.cancel = () => {
    stopLoop = true;
    abort.abort();
  };
  return finished;
}

function formatDuration(milliseconds) {
  const totalMs = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const remainingMs = totalMs % 1000;
  return `${hours}h ${minutes}m ${seconds}s ${String(remainingMs).padStart(3, '0')}ms`;
}

module.exports = {
  sleep,
  resetPageScroll,
  waitUntilDocumentReady,
  waitForNextDocument,
  watchClickedAction,
  loadDocument,
  documentLoadOptions,
  isContextGone,
  formatDuration
};
