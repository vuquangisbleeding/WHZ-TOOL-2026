let stopRequested = false;
let paused = false;
let closeOnStop = false;
const browserClosers = new Set();

function installStopHandler() {
  process.on('SIGUSR1', () => { paused = true; });
  process.on('SIGUSR2', () => { paused = false; });
  process.on('SIGTERM', () => { stopRequested = true; paused = false; });
  process.on('message', message => {
    if (message?.type === 'pause') paused = true;
    if (message?.type === 'resume') paused = false;
    if (message?.type === 'cancel') cancelAndExit();
  });
}

function registerBrowserCloser(close) {
  browserClosers.add(close);
  return () => browserClosers.delete(close);
}

function isStopRequested() {
  return stopRequested;
}

function shouldCloseBrowser() {
  return closeOnStop;
}

async function cancelAndExit() {
  stopRequested = true;
  closeOnStop = true;
  paused = false;
  await Promise.all([...browserClosers].map(close => Promise.resolve().then(close).catch(() => {})));
  process.exit(0);
}

async function waitIfPaused() {
  while (paused && !stopRequested) await new Promise(resolve => setTimeout(resolve, 100));
}

async function sleepUnlessStopped(milliseconds) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    if (isStopRequested()) return false;
    await waitIfPaused();
    if (isStopRequested()) return false;
    const remaining = end - Date.now();
    if (remaining <= 0) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(100, remaining)));
  }
  return !isStopRequested();
}

module.exports = { installStopHandler, isStopRequested, shouldCloseBrowser, registerBrowserCloser, waitIfPaused, sleepUnlessStopped };