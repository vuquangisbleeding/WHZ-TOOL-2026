const puppeteer = require('puppeteer');

const REGISTRATION_URL = 'https://onlineservices.immigration.govt.nz/Registration/default.aspx';

function customerName(customer) {
  const profile = customer.profile || customer || {};
  return {
    firstName: String(profile.personal?.given_name_1 || '').trim(),
    familyName: String(profile.personal?.family_name || '').trim(),
    email: String(profile.contact?.email || '').trim()
  };
}

async function waitForRegistrationFrame(page) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      for (const frame of page.frames()) {
        if (await frame.$('input')) return frame;
      }
    } catch (error) {
      if (!/execution context was destroyed|most likely because of a navigation/i.test(error.message)) {
        throw error;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const title = await page.title().catch(() => '');
  throw new Error(`Trang Registration chưa tải form (URL: ${page.url()}, title: ${title || 'không có'}). Kiểm tra kết nối hoặc thử lại.`);
}

async function openRegistrationPage(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);
  await page.goto(REGISTRATION_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const frame = await waitForRegistrationFrame(page);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { page, frame };
}

async function fillField(frame, selectors, value, label) {
  const field = await frame.$(selectors);
  if (!field) throw new Error(`Không tìm thấy trường ${label}.`);
  await field.click({ clickCount: 3 });
  await field.type(value);
}

async function tickTermsOfUse(frame) {
  const checkboxes = await frame.$$('input[type="checkbox"]');
  let terms;

  for (const checkbox of checkboxes) {
    const text = await frame.evaluate(input => {
      const labels = input.id
        ? [...document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`)]
        : [];
      const parentText = input.parentElement?.textContent || '';
      return [...labels.map(label => label.textContent), parentText]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }, checkbox);

    if (/terms?\s+of\s+use|agree\s+to\s+the\s+terms|by\s+registering/.test(text)) {
      terms = checkbox;
      break;
    }
  }

  terms ||= await frame.$(
    'input[type="checkbox"][name*="Term" i], input[type="checkbox"][id*="Term" i]'
  );
  if (!terms) throw new Error('Không tìm thấy checkbox Terms of Use.');

  if (!(await frame.evaluate(input => input.checked, terms))) {
    await terms.click();
  }
  if (!(await frame.evaluate(input => input.checked, terms))) {
    throw new Error('Không thể tick checkbox Terms of Use.');
  }
}

async function fillRegistrationPage(page, frame, customer, settings, account = {}) {
  const { firstName, familyName, email } = customerName(customer);
  const accountEmail = String(account.email || email).trim();
  if (!firstName || !familyName || !email) {
    throw new Error('Hồ sơ cần họ, tên và email để điền Registration.');
  }
  if (!accountEmail) throw new Error('Tài khoản cần email để điền Registration.');
  const username = account.username || settings.username ||
    `${firstName}${familyName}`.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const password = account.password || settings.password;
  if (!password) throw new Error(`Tài khoản ${username} thiếu mật khẩu.`);
  if (!settings.secretAnswer) {
    throw new Error('Thiếu câu trả lời bảo mật. Hãy nhập REGISTRATION_SECRET_ANSWER trong .env.');
  }

  await fillField(frame, 'input[name*="FirstName" i], input[id*="FirstName" i]', firstName, 'First Name');
  await fillField(frame, 'input[name*="FamilyName" i], input[id*="FamilyName" i], input[name*="Surname" i]', familyName, 'Family Name');
  await fillField(frame, 'input[type="email"], input[name*="Email" i], input[id*="Email" i]', accountEmail, 'Email');
  await fillField(frame, 'input[name*="UserName" i], input[id*="UserName" i]', username, 'Username');

  const passwords = await frame.$$('input[type="password"]');
  if (passwords.length < 2) throw new Error('Không tìm thấy đủ hai trường mật khẩu.');
  for (const field of passwords.slice(0, 2)) {
    await field.click({ clickCount: 3 });
    await field.type(password);
  }

  const secretSelect = await frame.$('select[name*="Secret" i], select[id*="Secret" i]');
  if (secretSelect) {
    const selected = await frame.evaluate((select, question) => {
      const option = [...select.options].find(item =>
        item.value && !/select|choose/i.test(item.textContent) &&
        (!question || item.textContent.trim().toLowerCase().includes(question.toLowerCase()))
      );
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, secretSelect, settings.secretQuestion);
    if (!selected) throw new Error('Không tìm thấy câu hỏi bảo mật phù hợp.');
  }
  await fillField(frame, 'input[name*="SecretAnswer" i], input[id*="SecretAnswer" i], input[name*="Answer" i]', settings.secretAnswer, 'Secret answer');

  await tickTermsOfUse(frame);

  return { page, username, email: accountEmail };
}

async function openAndFillRegistrations(customer, accounts, settings) {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const pages = [];
  try {
    for (const account of accounts) {
      const { page, frame } = await openRegistrationPage(browser);
      pages.push(await fillRegistrationPage(page, frame, customer, settings, account));
    }
    return { browser, pages };
  } catch (error) {
    error.browser = browser;
    error.pages = pages;
    throw error;
  }
}

async function openAndFillRegistration(customer, settings, account = {}) {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  let page;
  let frame;
  try {
    ({ page, frame } = await openRegistrationPage(browser));
    const result = await fillRegistrationPage(page, frame, customer, settings, account);
    return { browser, ...result };
  } catch (error) {
    error.browser = browser;
    error.page = error.page || page;
    throw error;
  }
}

module.exports = { openAndFillRegistration, openAndFillRegistrations };
