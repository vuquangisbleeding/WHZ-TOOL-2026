const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgress, applyProgressEvent, parseProgressLine } = require('../desktop/live-progress');

function applyLine(progress, line) {
  const event = parseProgressLine(line);
  assert.ok(event, line);
  return applyProgressEvent(progress, event);
}

test('a page log marks that section without touching other accounts', () => {
  const progress = createProgress();
  applyLine(progress, '[0004] [2026-10-06T12:00:00.000Z] [account 1: ab PAGE 2 personal1] URL=https://example.test/personal1');
  applyLine(progress, '[0005] [2026-10-06T12:00:01.000Z] [account 2: cd PAGE 1 health] URL=https://example.test/health');
  assert.equal(progress.accounts[1].page, 'personal');
  assert.deepEqual(progress.accounts[1].seen, ['personal']);
  assert.equal(progress.accounts[2].page, 'health');
  assert.equal(progress.accounts[1].captcha, '');
});

test('field logs map onto applicant.json paths and a later success replaces a miss', () => {
  const progress = createProgress();
  applyLine(progress, '[account 1: ab PAGE 2 personal1] FIELD_SET familyName selector=#family');
  applyLine(progress, '[account 1: ab PAGE 2 personal1] FIELD_SKIP_EMPTY givenName2');
  applyLine(progress, '[account 1: ab PAGE 2 personal1] FIELD_SKIP_MISSING lengthOfStay');
  applyLine(progress, '[account 1: ab PAGE 2 personal1] FIELD_SET lengthOfStay selector=#stay');
  applyLine(progress, '[account 1: ab] SELECT_COUNTRY CROATIA (open)');
  assert.equal(progress.accounts[1].fields['personal.family_name'], 'set');
  assert.equal(progress.accounts[1].fields['personal.given_name_2'], undefined);
  assert.equal(progress.accounts[1].fields['whs.length_of_stay'], 'set');
  assert.equal(progress.accounts[1].fields.scheme_country, 'set');
});

test('captcha logs move from solving to solved or failed and keep the result', () => {
  const progress = createProgress();
  applyLine(progress, '[account 1: ab PAGE 4 captcha] CAPTCHA id=abc status=FOUND type=recaptcha');
  assert.equal(progress.accounts[1].captcha, 'solving');
  applyLine(progress, '[account 1: ab PAGE 4 captcha] CAPTCHA id=abc status=CAPMONSTER_KEY source="whitelist" key="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"');
  assert.equal(progress.accounts[1].captchaKey, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  applyLine(progress, '[account 1: ab PAGE 4 captcha] CAPTCHA id=abc status=CAPMONSTER_RESPONSE method=getTaskResult');
  assert.equal(progress.accounts[1].captcha, 'solving');
  applyLine(progress, '[account 1: ab PAGE 4 captcha] CAPTCHA id=abc status=SOLVED elapsed_ms=1200 result=solved');
  applyLine(progress, '[account 1: ab PAGE 4 captcha] CAPTCHA id=abc status=CAPMONSTER_CANCELLED taskId=1');
  assert.equal(progress.accounts[1].captcha, 'solved');
  assert.equal(progress.accounts[1].page, '');
  const failed = createProgress();
  applyLine(failed, '[account 1: ab] CAPTCHA id=abc status=FOUND type=recaptcha');
  applyLine(failed, '[account 1: ab] CAPTCHA id=abc status=AUTOCAPTCHA_IMAGE round="1"');
  assert.equal(failed.accounts[1].captcha, 'solving');
  applyLine(failed, '[account 1: ab] CAPTCHA id=abc status=AUTOCAPTCHA_FAILED message=timeout');
  assert.equal(failed.accounts[1].captcha, 'failed');
});

test('a complete declaration marks every statement and ignores unrelated lines', () => {
  const progress = createProgress();
  assert.equal(parseProgressLine('LOG_FILE /tmp/run.log'), null);
  applyLine(progress, '[account 1: ab PAGE 8 declaration] FILL_DECLARATION 11/11 fields=a,b roleCheckboxes=0 failed=none');
  assert.equal(progress.accounts[1].page, 'declaration');
  assert.equal(progress.accounts[1].fields['declaration.false_statement'], 'set');
  assert.equal(progress.accounts[1].fields['declaration.medical_insurance'], 'set');
  const partial = createProgress();
  applyLine(partial, '[account 1: ab PAGE 8 declaration] FILL_DECLARATION 0/0 fields= roleCheckboxes=0 failed=none');
  assert.equal(partial.accounts[1].fields['declaration.false_statement'], undefined);
});
