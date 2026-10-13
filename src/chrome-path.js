const fs = require('node:fs');
const path = require('node:path');

function chromeCandidates(platform = process.platform, env = process.env) {
  const home = env.HOME || env.USERPROFILE || '';
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || '';
    return [
      path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome')
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

function findChrome(explicit, options = {}) {
  const requested = String(explicit || '').trim();
  if (requested) return requested;
  const exists = options.exists || fs.existsSync;
  return chromeCandidates(options.platform, options.env).find(candidate => candidate && exists(candidate)) || '';
}

module.exports = { chromeCandidates, findChrome };
