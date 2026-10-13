const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWhitelistCsv, assertAccountsWhitelisted, applyWhitelistSecrets, missingWhitelistSecrets, isCapmonsterClientKey, maskWhitelistUrl, normalizeWhitelistUrl, fetchWhitelist } = require('../src/whitelist');

test('parseWhitelistCsv reads the username column and the yes flag', () => {
  const whitelist = parseWhitelistCsv('whitelist,username\nyes,vuquang02122000\n,"Second.User"\n');
  assert.equal(whitelist.enabled, true);
  assert.deepEqual([...whitelist.allowed], ['vuquang02122000', 'second.user']);
});

test('parseWhitelistCsv reads the api_key column', () => {
  const whitelist = parseWhitelistCsv('whitelist,username,api_key,bot_token,chat_id\nyes,user,abcdefabcdefabcdefabcdefabcdefab,123:abc,42\n');
  assert.equal(whitelist.capmonsterApiKey, 'abcdefabcdefabcdefabcdefabcdefab');
  assert.equal(whitelist.botToken, '123:abc');
  assert.equal(whitelist.chatId, '42');
});

test('parseWhitelistCsv reads CapMonster key, bot token and chat id', () => {
  const whitelist = parseWhitelistCsv('whitelist,username,capmonster_api_key,bot_token,chat_id\nyes,user,,,\n,other,cloud-key,123:abc,9988\n');
  assert.equal(whitelist.capmonsterApiKey, 'cloud-key');
  assert.equal(whitelist.botToken, '123:abc');
  assert.equal(whitelist.chatId, '9988');
});

test('parseWhitelistCsv accepts spaced secret headers and ignores empty cells', () => {
  const whitelist = parseWhitelistCsv('whitelist,Cloud API key,Bot token,Chat ID\nno,,token-only,\n');
  assert.equal(whitelist.capmonsterApiKey, '');
  assert.equal(whitelist.botToken, 'token-only');
  assert.equal(whitelist.chatId, '');
});

test('applyWhitelistSecrets replaces local secrets with the sheet, including empty cells', () => {
  const sheetKey = 'a'.repeat(32);
  const target = { capmonsterApiKey: 'b'.repeat(32), capmonsterApiKeyLocal: 'b'.repeat(32), telegramBotToken: 'local-token', telegramChatId: 'local-chat' };
  applyWhitelistSecrets(target, { capmonsterApiKey: sheetKey, botToken: '123:abc', chatId: '42' });
  assert.equal(target.capmonsterApiKey, sheetKey);
  assert.equal(target.capmonsterApiKeyLocal, '');
  assert.equal(target.capmonsterApiKeySource, 'whitelist');
  assert.equal(target.telegramBotToken, '123:abc');
  assert.equal(target.telegramChatId, '42');

  applyWhitelistSecrets(target, { capmonsterApiKey: '', botToken: '', chatId: '' });
  assert.equal(target.capmonsterApiKey, '');
  assert.equal(target.telegramBotToken, '');
  assert.equal(target.telegramChatId, '');
  assert.equal(isCapmonsterClientKey(sheetKey), true);
});

test('missingWhitelistSecrets names each empty secret and a short CapMonster key', () => {
  assert.deepEqual(missingWhitelistSecrets({ capmonsterApiKey: '', botToken: '', chatId: '' }), [
    'Whitelist không có giá trị Autocaptcha API key.',
    'Whitelist không có giá trị bot token.',
    'Whitelist không có giá trị chat ID.'
  ]);
  assert.deepEqual(missingWhitelistSecrets({ capmonsterApiKey: 'yes', botToken: '123:abc', chatId: '42' }), [
    'Whitelist có Autocaptcha API key nhưng không đủ 32 ký tự hex.'
  ]);
  assert.deepEqual(missingWhitelistSecrets({ capmonsterApiKey: 'a'.repeat(32), botToken: '123:abc', chatId: '42' }), []);
});

test('parseWhitelistCsv turns the check off when the flag is no', () => {
  const whitelist = parseWhitelistCsv('whitelist,username\nno,\n');
  assert.equal(whitelist.enabled, false);
});

test('assertAccountsWhitelisted blocks usernames missing from the sheet', () => {
  const whitelist = { enabled: true, allowed: new Set(['vuquang02122000']) };
  assert.doesNotThrow(() => assertAccountsWhitelisted([{ username: 'Vuquang02122000' }], whitelist));
  assert.throws(() => assertAccountsWhitelisted([{ username: 'other' }], whitelist), /other/);
  assert.doesNotThrow(() => assertAccountsWhitelisted([{ username: 'other' }], { enabled: false, allowed: new Set() }));
});

test('maskWhitelistUrl hides the middle of a Google Sheet id', () => {
  const masked = maskWhitelistUrl('https://docs.google.com/spreadsheets/d/1EV1EsMQiJyGdZYNpg7v83Qw-HHacHFLj5lpHQsumoks/edit?usp=sharing');
  assert.equal(masked, 'https://docs.google.com/spreadsheets/d/1EV1…moks');
  assert.equal(masked.includes('HHacHFLj'), false);
  assert.equal(maskWhitelistUrl(''), '');
});

test('normalizeWhitelistUrl turns a Google Sheet edit link into a CSV export', () => {
  const url = normalizeWhitelistUrl('https://docs.google.com/spreadsheets/d/abc123/edit#gid=7');
  assert.equal(url, 'https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=7');
});

test('normalizeWhitelistUrl rejects a missing or non-https link', () => {
  assert.throws(() => normalizeWhitelistUrl(''), /WHITELIST_URL/);
  assert.throws(() => normalizeWhitelistUrl('http://docs.google.com/spreadsheets/d/abc/export?format=csv'), /https/);
});

test('fetchWhitelist rejects an HTML login page from a private sheet', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => '<!doctype html><html>Sign in</html>' });
  await assert.rejects(
    fetchWhitelist('https://docs.google.com/spreadsheets/d/abc123/export?format=csv', fetchImpl),
    /chưa mở công khai/
  );
});
