const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');

function readJson(fileName) {
  return fs.readFile(path.join(config.root, fileName), 'utf8').then(JSON.parse);
}

async function readProxyList(fileName = 'proxy-list.txt') {
  const source = await fs.readFile(path.join(config.root, fileName), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return source.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(':');
    if (parts.length !== 4 || parts.some(part => !part)) {
      throw new Error(`Proxy không hợp lệ ở ${fileName}, dòng ${index + 1}: cần host:port:username:password`);
    }
    const [host, port, username, password] = parts;
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error(`Port proxy không hợp lệ ở ${fileName}, dòng ${index + 1}: ${port}`);
    }
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
  });
}

async function readCapSolverApiKey(extensionPath) {
  const file = path.join(extensionPath, 'assets', 'config.js');
  const source = await fs.readFile(file, 'utf8');
  const match = source.match(/apiKey\s*:\s*(['"])(.*?)\1/);
  const apiKey = match?.[2]?.trim() || '';
  if (!apiKey) throw new Error(`CapSolver API key chưa được cấu hình trong ${file}`);
  return apiKey;
}

module.exports = { fs, path, readJson, readProxyList, readCapSolverApiKey };