const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');

function readJson(fileName) {
  return fs.readFile(path.join(config.root, fileName), 'utf8').then(JSON.parse);
}

function parseProxyLine(line, fileName = 'proxy-list.txt', lineNumber = 1) {
  const parts = line.trim().split(':');
  if (parts.length !== 4 || parts.some(part => !part)) {
    throw new Error(`Proxy không hợp lệ ở ${fileName}, dòng ${lineNumber}: cần host:port:username:password`);
  }
  const [host, port, username, password] = parts;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`Port proxy không hợp lệ ở ${fileName}, dòng ${lineNumber}: ${port}`);
  }
  return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
}

async function readProxyList(fileName = 'proxy-list.txt') {
  const source = await fs.readFile(path.join(config.root, fileName), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return source.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    .map((line, index) => parseProxyLine(line, fileName, index + 1));
}

module.exports = { fs, path, readJson, parseProxyLine, readProxyList };