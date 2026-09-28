let stopRequested = false;
let paused = false;

function installStopHandler() {
  process.on('SIGUSR1', () => { paused = true; });
  process.on('SIGUSR2', () => { paused = false; });
  process.on('SIGTERM', () => { stopRequested = true; paused = false; });
}

function isStopRequested() {
  return stopRequested;
}

async function waitIfPaused() {
  while (paused && !stopRequested) await new Promise(resolve => setTimeout(resolve, 100));
}

module.exports = { installStopHandler, isStopRequested, waitIfPaused };