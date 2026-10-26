const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer");
require("dotenv").config();

const REGISTRATION_URL = "https://onlineservices.immigration.govt.nz/Registration/default.aspx";

function readOption(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

function customerName(customer) {
  const profile = customer.profile || {};
  return {
    firstName: String(profile.personal?.given_name_1 || "").trim(),
    familyName: String(profile.personal?.family_name || "").trim(),
    email: String(profile.contact?.email || "").trim()
  };
}

async function fillFirst(page, selectors, value, label) {
  const field = await page.$(selectors);
  if (!field) throw new Error(`Không tìm thấy trường ${label}.`);
  await field.click({ clickCount: 3 });
  await field.type(value);
}

async function fillRegistration(page, customer) {
  const { firstName, familyName, email } = customerName(customer);
  const username = process.env.REGISTRATION_USERNAME?.trim() ||
    `${firstName}${familyName}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const password = requiredEnv("REGISTRATION_PASSWORD");
  const secretAnswer = requiredEnv("REGISTRATION_SECRET_ANSWER");
  const secretQuestion = process.env.REGISTRATION_SECRET_QUESTION?.trim();

  if (!firstName || !familyName || !email) {
    throw new Error("Khách hàng cần profile.personal.given_name_1, profile.personal.family_name và profile.contact.email.");
  }

  await fillFirst(page, 'input[name*="FirstName" i], input[id*="FirstName" i]', firstName, "First Name");
  await fillFirst(page, 'input[name*="FamilyName" i], input[id*="FamilyName" i], input[name*="Surname" i]', familyName, "Family Name");
  await fillFirst(page, 'input[type="email"], input[name*="Email" i], input[id*="Email" i]', email, "Email");
  await fillFirst(page, 'input[name*="UserName" i], input[id*="UserName" i]', username, "Username");

  const passwordFields = await page.$$('input[type="password"]');
  if (passwordFields.length < 2) throw new Error("Không tìm thấy đủ hai trường mật khẩu.");
  for (const field of passwordFields.slice(0, 2)) {
    await field.click({ clickCount: 3 });
    await field.type(password);
  }

  const secretSelect = await page.$('select[name*="Secret" i], select[id*="Secret" i]');
  if (secretSelect) {
    const selected = await page.evaluate((select, question) => {
      const option = [...select.options].find(item =>
        item.value &&
        !/select|choose/i.test(item.textContent) &&
        (!question || item.textContent.trim().toLowerCase().includes(question.toLowerCase()))
      );
      if (!option) return null;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return option.textContent.trim();
    }, secretSelect, secretQuestion);
    if (!selected) throw new Error("Không tìm thấy lựa chọn câu hỏi bảo mật.");
  }

  await fillFirst(page, 'input[name*="SecretAnswer" i], input[id*="SecretAnswer" i], input[name*="Answer" i]', secretAnswer, "Secret answer");

  const terms = await page.$('input[type="checkbox"][name*="Term" i], input[type="checkbox"][id*="Term" i]');
  if (!terms) throw new Error("Không tìm thấy checkbox Terms of Use.");
  if (!(await page.evaluate(input => input.checked, terms))) await terms.click();

  return { email, username };
}

async function main() {
  const customerPath = path.resolve(readOption("--customer"));
  if (!customerPath || customerPath === path.resolve("")) {
    throw new Error("Dùng: node src/registration-assistant.js --customer path/to/customer.json");
  }
  const customer = JSON.parse(await fs.readFile(customerPath, "utf8"));
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();
  await page.goto(REGISTRATION_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("input", { timeout: 60000 });
  const result = await fillRegistration(page, customer);
  console.log(`Đã điền hồ sơ đăng ký cho ${result.email}. Username: ${result.username}`);
  console.log("Tool đã dừng trước nút REGISTER. Hãy kiểm tra và tự bấm REGISTER nếu thông tin chính xác.");
  await new Promise(() => {});
}

main().catch(error => {
  console.error(`Không thể điền hồ sơ đăng ký: ${error.message}`);
  process.exitCode = 1;
});
