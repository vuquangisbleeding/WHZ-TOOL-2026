const test = require('node:test');
const assert = require('node:assert/strict');
const applicant = require('../applicant.json');
const { fieldPaths, validateApplicant, pageOrder, collectCopy, hasTranslation, optionPresentation, pages } = require('../desktop/inz-form');

const filledByRunner = [
  'contact.has_agent', 'personal.family_name', 'personal.given_name_1', 'personal.given_name_2', 'personal.given_name_3',
  'personal.other_names', 'personal.title', 'personal.other_title', 'personal.gender', 'personal.date_of_birth', 'personal.country_of_birth',
  'address.street_number', 'address.street_name', 'address.suburb', 'address.city', 'address.province', 'address.postal_code', 'address.country',
  'contact.phone_daytime', 'contact.phone_night', 'contact.phone_mobile', 'contact.fax', 'contact.email', 'contact.communication_method', 'contact.has_credit_card',
  'identification.passport_number', 'identification.passport_expiry', 'identification.passport_citizenship', 'identification.id_type', 'identification.id_issue_date', 'identification.id_expiry_date',
  'health.renal_dialysis', 'health.active_tb', 'health.cancer', 'health.heart_disease', 'health.disability', 'health.hospitalisation', 'health.residential_care', 'health.pregnancy', 'health.tb_risk', 'health.medical_details',
  'character.imprisonment_5_years', 'character.imprisonment_12_months', 'character.deported', 'character.removal_order', 'character.charged', 'character.convicted', 'character.under_investigation', 'character.excluded', 'character.removed', 'character.details',
  'whs.previous_whs_visa', 'whs.sufficient_funds_holiday', 'whs.travel_date', 'whs.been_to_nz', 'whs.been_to_nz_when', 'whs.sufficient_funds_onward_ticket', 'whs.meet_scheme_requirements', 'whs.length_of_stay',
  'scheme_country', 'payment.payer_name',
  'declaration.false_statement', 'declaration.notes_and_questions', 'declaration.changed_circumstances', 'declaration.good_character', 'declaration.information_sharing', 'declaration.health_information', 'declaration.advice', 'declaration.occupation_registration', 'declaration.entitlement', 'declaration.permit_expiry', 'declaration.medical_insurance'
];

test('every form label has a Vietnamese translation', () => {
  for (const text of collectCopy()) assert.equal(hasTranslation(text), true, text);
});

test('application pages follow the website order', () => {
  assert.deepEqual(pageOrder, ['personal', 'identification', 'occupation', 'health', 'character', 'whs', 'declaration', 'payer']);
});

test('every value the runner types has a field on the matching page', () => {
  const paths = new Set(fieldPaths());
  for (const path of filledByRunner) assert.equal(paths.has(path), true, path);
});

test('current applicant passes the same required-field checks as the form', () => {
  assert.doesNotThrow(() => validateApplicant(applicant));
});

test('select values stay identical to the strings stored in applicant.json', () => {
  const samples = ['Yes', 'No', 'Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Other', 'Female', 'Male', 'Email', 'Phone', 'Fax', 'Post', 'National ID', 'Birth certificate', 'Driver licence', '6 months', '12 months'];
  for (const value of samples) {
    for (const lang of ['vi', 'en']) {
      const view = optionPresentation(value, lang);
      assert.equal(view.value, value, `${lang} ${value}`);
      assert.equal(view.text === value || view.text.startsWith(`${value} (`), true, view.text);
    }
  }
  assert.equal(optionPresentation('Select', 'vi').value, '');
  assert.equal(optionPresentation('Select', 'en').text, 'Select');
});

test('every select in applicant.json is one of the form option values', () => {
  const read = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  for (const page of pages) {
    for (const block of page.blocks) {
      for (const field of block.rows) {
        if (field.type !== 'yesno' && field.type !== 'select') continue;
        const value = read(applicant, field.path);
        if (value == null || value === '') continue;
        const options = field.type === 'yesno' ? ['Yes', 'No'] : field.options;
        assert.equal(options.includes(value), true, `${field.path}=${value}`);
        assert.equal(optionPresentation(value, 'vi').value, value);
      }
    }
  }
});

test('a free-typed date is rejected but missing fields are allowed', () => {
  const broken = structuredClone(applicant);
  broken.personal.date_of_birth = '24/05/1996';
  assert.throws(() => validateApplicant(broken), /24 May, 1996/);
  broken.personal.date_of_birth = applicant.personal.date_of_birth;
  broken.health.renal_dialysis = '';
  assert.doesNotThrow(() => validateApplicant(broken));
});

test('a date for a hidden follow-up question is ignored', () => {
  const hidden = structuredClone(applicant);
  hidden.whs.been_to_nz = 'No';
  hidden.whs.been_to_nz_when = 'not-a-date';
  assert.doesNotThrow(() => validateApplicant(hidden));
  hidden.whs.been_to_nz = 'Yes';
  assert.throws(() => validateApplicant(hidden), /24 May, 1996/);
});
