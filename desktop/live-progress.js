const selectorPaths = {
  representedByAgent: 'contact.has_agent',
  familyName: 'personal.family_name',
  givenName1: 'personal.given_name_1',
  givenName2: 'personal.given_name_2',
  givenName3: 'personal.given_name_3',
  otherNames: 'personal.other_names',
  title: 'personal.title',
  otherTitle: 'personal.other_title',
  gender: 'personal.gender',
  dateOfBirth: 'personal.date_of_birth',
  countryOfBirth: 'personal.country_of_birth',
  streetNumber: 'address.street_number',
  streetName: 'address.street_name',
  suburb: 'address.suburb',
  city: 'address.city',
  province: 'address.province',
  postalCode: 'address.postal_code',
  addressCountry: 'address.country',
  phoneDaytime: 'contact.phone_daytime',
  phoneNight: 'contact.phone_night',
  phoneMobile: 'contact.phone_mobile',
  fax: 'contact.fax',
  email: 'contact.email',
  communicationMethod: 'contact.communication_method',
  hasCreditCard: 'contact.has_credit_card',
  passportNumber: 'identification.passport_number',
  confirmPassportNumber: 'confirm:identification.passport_number',
  passportExpiry: 'identification.passport_expiry',
  passportCitizenship: 'identification.passport_citizenship',
  idType: 'identification.id_type',
  idIssueDate: 'identification.id_issue_date',
  idExpiryDate: 'identification.id_expiry_date',
  renalDialysis: 'health.renal_dialysis',
  activeTb: 'health.active_tb',
  cancer: 'health.cancer',
  heartDisease: 'health.heart_disease',
  disability: 'health.disability',
  hospitalisation: 'health.hospitalisation',
  residentialCare: 'health.residential_care',
  pregnancy: 'health.pregnancy',
  tbRisk: 'health.tb_risk',
  medicalDetails: 'health.medical_details',
  imprisonment5Years: 'character.imprisonment_5_years',
  imprisonment12Months: 'character.imprisonment_12_months',
  deported: 'character.deported',
  removalOrder: 'character.removal_order',
  charged: 'character.charged',
  convicted: 'character.convicted',
  underInvestigation: 'character.under_investigation',
  excluded: 'character.excluded',
  removed: 'character.removed',
  characterDetails: 'character.details',
  previousWhsVisa: 'whs.previous_whs_visa',
  sufficientFundsHoliday: 'whs.sufficient_funds_holiday',
  travelDate: 'whs.travel_date',
  beenToNz: 'whs.been_to_nz',
  beenToNzWhen: 'whs.been_to_nz_when',
  sufficientFundsOnwardTicket: 'whs.sufficient_funds_onward_ticket',
  meetSchemeRequirements: 'whs.meet_scheme_requirements',
  lengthOfStay: 'whs.length_of_stay',
  payerName: 'payment.payer_name'
};

const pageSections = {
  personal1: 'personal',
  personal2: 'identification',
  personal3: 'occupation',
  health: 'health',
  character: 'character',
  whs: 'whs',
  declaration: 'declaration',
  submit: 'declaration',
  payer: 'payer',
  pay_next: 'payer',
  pay_now: 'payer'
};

const sectionTitle = {
  personal: 'Personal details',
  identification: 'Identification',
  occupation: 'Occupation details',
  health: 'Health',
  character: 'Character',
  whs: 'Working Holiday Specific',
  declaration: 'Declaration',
  payer: 'Card holder'
};

const declarationPaths = [
  'declaration.false_statement', 'declaration.notes_and_questions', 'declaration.changed_circumstances',
  'declaration.good_character', 'declaration.information_sharing', 'declaration.health_information',
  'declaration.advice', 'declaration.occupation_registration', 'declaration.entitlement',
  'declaration.permit_expiry', 'declaration.medical_insurance'
];

function createProgress() {
  return { accounts: {}, selected: 0, pinned: false };
}

function resetProgress(progress) {
  progress.accounts = {};
  progress.selected = 0;
  progress.pinned = false;
}

function accountProgress(progress, index) {
  if (!progress.accounts[index]) progress.accounts[index] = { index, page: '', seen: [], fields: {}, captcha: '' };
  return progress.accounts[index];
}

function captchaPhase(status) {
  if (status === 'AUTOCAPTCHA_FAILED' || status === 'CAPMONSTER_FAILED' || status === 'FAILED') return 'failed';
  if (status === 'FOUND' || status === 'CHECKBOX_CLICKED' || status.startsWith('CAPMONSTER_') || status.startsWith('AUTOCAPTCHA_')) return 'solving';
  if (status === 'SOLVED' || status === 'SUBMIT_SENT') return 'solved';
  return '';
}

function rememberAccount(progress, index) {
  progress.latest = index;
  if (!progress.pinned) progress.selected = index;
}

function applyProgressEvent(progress, event) {
  const account = accountProgress(progress, event.index);
  rememberAccount(progress, event.index);
  if (event.type === 'page') {
    const section = pageSections[event.page];
    if (section) {
      account.page = section;
      if (!account.seen.includes(section)) account.seen.push(section);
    } else if (event.page === 'captcha') account.captcha = 'solving';
    return account;
  }
  if (event.type === 'field') {
    const path = selectorPaths[event.selector];
    if (!path) return account;
    if (event.result === 'SET') account.fields[path] = 'set';
    else if ((event.result === 'SKIP_MISSING' || event.result === 'LABEL_FALLBACK_MISSING') && account.fields[path] !== 'set') account.fields[path] = 'missing';
    return account;
  }
  if (event.type === 'captcha') {
    const phase = captchaPhase(event.status);
    if (event.key) account.captchaKey = event.key;
    if (event.status === 'FOUND' || (phase && account.captcha !== 'solved')) account.captcha = phase || account.captcha;
    if (phase === 'solved' || phase === 'failed') account.captcha = phase;
    return account;
  }
  if (event.type === 'declaration' && event.total > 0 && event.count === event.total && event.failed === 'none') {
    for (const path of declarationPaths) account.fields[path] = 'set';
    account.page = 'declaration';
    if (!account.seen.includes('declaration')) account.seen.push('declaration');
  }
  if (event.type === 'country') account.fields.scheme_country = 'set';
  return account;
}

function parseProgressLine(line) {
  const account = line.match(/\[account (\d+)/);
  if (!account) return null;
  const index = Number(account[1]);
  const page = line.match(/ PAGE \d+ ([a-z0-9_]+)\] URL=/);
  if (page) return { type: 'page', index, page: page[1] };
  const field = line.match(/FIELD_(SET|SKIP_EMPTY|SKIP_MISSING|LABEL_FALLBACK_MISSING) (\w+)/);
  if (field) return { type: 'field', index, result: field[1], selector: field[2] };
  const captcha = line.match(/CAPTCHA id=\S+ status=([A-Z0-9_]+)/);
  if (captcha) return { type: 'captcha', index, status: captcha[1], key: line.match(/(?:^|\s)key="([^"]*)"/)?.[1] || '' };
  const declaration = line.match(/FILL_DECLARATION (\d+)\/(\d+).* failed=(\S+)/);
  if (declaration) return { type: 'declaration', index, count: Number(declaration[1]), total: Number(declaration[2]), failed: declaration[3] };
  if (/SELECT_COUNTRY \S+/.test(line)) return { type: 'country', index };
  return null;
}

const liveProgressApi = { selectorPaths, pageSections, sectionTitle, declarationPaths, createProgress, resetProgress, applyProgressEvent, parseProgressLine, captchaPhase };
if (typeof module !== 'undefined' && module.exports) module.exports = liveProgressApi;
if (typeof window !== 'undefined') window.LiveProgress = liveProgressApi;
