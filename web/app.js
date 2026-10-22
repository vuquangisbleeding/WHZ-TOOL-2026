const TABS = ["hoat-dong", "bao-mat", "dang-ky"];
const STORAGE_KEY = "nz-tool-registrations-v2";
const FREE_KEY = "nz-tool-free-signups";
const BASE_PRICE = 16500000;
const MIN_QTY = 2;
const MAX_QTY = 30;

const form = document.querySelector("#registerForm");
const quantityInput = document.querySelector("#quantity");
const quoteBody = document.querySelector("#quoteBody");
const receipt = document.querySelector("#receipt");
const savedSection = document.querySelector("#savedSection");
const savedList = document.querySelector("#savedList");

function formatVnd(amount) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

function quote(count) {
  if (!Number.isInteger(count) || count < MIN_QTY || count > MAX_QTY) return null;
  const extra = count - 2;
  const combos = Math.floor(extra / 3);
  const remainder = extra % 3;
  const extraCost = combos * 2000000 + remainder * 1000000;
  const names = { 2: "Cơ bản", 5: "Tăng tốc", 8: "Tối đa" };
  return {
    count,
    name: names[count] || "Theo số lượng",
    price: BASE_PRICE + extraCost,
    saved: extra * 1000000 - extraCost,
    combos,
    remainder
  };
}

function showTab(id, { focus = false, scroll = true, updateHash = true } = {}) {
  const tabId = TABS.includes(id) ? id : "hoat-dong";
  TABS.forEach((key) => {
    const selected = key === tabId;
    const tab = document.getElementById(`tab-${key}`);
    const panel = document.getElementById(`panel-${key}`);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  });
  if (updateHash && location.hash !== `#${tabId}`) history.replaceState(null, "", `#${tabId}`);
  if (focus) document.getElementById(`tab-${tabId}`).focus();
  if (scroll) document.getElementById(`panel-${tabId}`).scrollIntoView({ block: "start" });
}

function initTabs() {
  const tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return;
  tablist.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    showTab(tab.id.replace("tab-", ""));
  });
  tablist.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const current = TABS.findIndex((key) => document.getElementById(`tab-${key}`).getAttribute("aria-selected") === "true");
    const next = {
      ArrowRight: (current + 1) % TABS.length,
      ArrowLeft: (current - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1
    }[event.key];
    event.preventDefault();
    showTab(TABS[next], { focus: true, scroll: false });
  });
  document.querySelector(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    showTab("hoat-dong");
  });
  document.querySelectorAll('a[href="#dang-ky"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showTab("dang-ky");
    });
  });
  const initial = location.hash.replace("#", "");
  if (TABS.includes(initial)) showTab(initial, { scroll: false });
  else showTab("dang-ky", { scroll: false, updateHash: false });
}

function initDeadline() {
  const node = document.querySelector("#deadline");
  if (!node) return;
  const deadline = new Date(2026, 9, 20);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((deadline - start) / 86400000);
  if (days > 1) node.textContent = `Còn ${days} ngày · hạn đăng ký 20/10/2026`;
  else if (days === 1) node.textContent = "Còn 1 ngày · hạn đăng ký 20/10/2026";
  else if (days === 0) node.textContent = "Hôm nay là hạn đăng ký 20/10/2026";
  else node.textContent = "Mình vẫn nhận thông tin · cứ điền form nhé";
}

function readQuantity() {
  return Number(quantityInput.value);
}

function renderQuote() {
  const count = readQuantity();
  const deal = quote(count);
  document.querySelectorAll(".picks [data-choose]").forEach((button) => {
    const selected = Number(button.dataset.choose) === count;
    button.setAttribute("aria-pressed", String(selected));
  });
  quoteBody.replaceChildren();
  if (!deal) {
    const hint = document.createElement("p");
    hint.className = "fine-print";
    hint.textContent = `Chọn từ ${MIN_QTY} đến ${MAX_QTY} tài khoản để xem giá tạm tính.`;
    quoteBody.appendChild(hint);
    return;
  }

  const list = document.createElement("dl");
  list.className = "quote-lines";
  const rows = [
    ["Gói", deal.name],
    ["2 tài khoản đầu", formatVnd(BASE_PRICE)]
  ];
  if (deal.combos) rows.push([`Combo 3 tài khoản × ${deal.combos}`, formatVnd(deal.combos * 2000000)]);
  if (deal.remainder) rows.push([`Thêm lẻ × ${deal.remainder}`, formatVnd(deal.remainder * 1000000)]);
  if (deal.saved) rows.push(["Tiết kiệm so với mua lẻ", formatVnd(deal.saved)]);
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    list.appendChild(row);
  });
  const total = document.createElement("div");
  total.className = "quote-total";
  const totalLabel = document.createElement("dt");
  const totalValue = document.createElement("dd");
  totalLabel.textContent = "Tạm tính";
  totalValue.textContent = formatVnd(deal.price);
  total.append(totalLabel, totalValue);
  list.appendChild(total);
  quoteBody.appendChild(list);

  const note = document.createElement("p");
  note.className = "fine-print";
  note.textContent = "Chưa gồm tiền máy chạy tool. Giá chốt khi trao đổi.";
  quoteBody.appendChild(note);
}

function choosePackage(count) {
  const alreadyOpen = document.getElementById("panel-dang-ky").hidden === false;
  quantityInput.value = String(count);
  setFieldError(quantityInput, "");
  renderQuote();
  showTab("dang-ky", { scroll: false });
  if (!alreadyOpen) document.querySelector(".quote").scrollIntoView({ block: "nearest" });
}

function initQuantity() {
  if (!quantityInput) return;
  document.body.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-choose]");
    if (!trigger) return;
    choosePackage(Number(trigger.dataset.choose));
  });
  document.querySelector("#qtyDown").addEventListener("click", () => stepQuantity(-1));
  document.querySelector("#qtyUp").addEventListener("click", () => stepQuantity(1));
  quantityInput.addEventListener("input", () => {
    setFieldError(quantityInput, "");
    renderQuote();
  });
  quantityInput.addEventListener("wheel", () => quantityInput.blur());
  renderQuote();
}

function stepQuantity(delta) {
  const current = quote(readQuantity()) ? readQuantity() : MIN_QTY;
  const next = Math.min(MAX_QTY, Math.max(MIN_QTY, current + delta));
  quantityInput.value = String(next);
  setFieldError(quantityInput, "");
  renderQuote();
}

function setFieldError(input, message) {
  const error = document.getElementById(`${input.id}Error`);
  if (error) error.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function formatDob(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return value || "—";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function validBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const year = Number(match[1]);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return year >= 1920 && date <= start && date.getDate() === Number(match[3]);
}

function readRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function makeId(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DK-${stamp}-${rand}`;
}

function messageFor(record) {
  return [
    "Đăng ký tool NZ",
    `Mã: ${record.id}`,
    `Họ tên: ${record.fullName}`,
    `Ngày sinh: ${formatDob(record.birthDate)}`,
    `Email: ${record.email}`,
    `Tên Facebook: ${record.facebook}`,
    `Số tài khoản: ${record.quantity} (${record.packageName})`,
    `Giá tạm tính: ${formatVnd(record.price)}`,
    record.saved ? `Tiết kiệm: ${formatVnd(record.saved)}` : "",
    record.note ? `Ghi chú: ${record.note}` : "",
    "Không cọc. Thành công mới trả phí dịch vụ."
  ].filter(Boolean).join("\n");
}

function addDefinition(list, label, value) {
  const rowLabel = document.createElement("dt");
  const rowValue = document.createElement("dd");
  rowLabel.textContent = label;
  rowValue.textContent = value;
  list.append(rowLabel, rowValue);
}

function renderRecord(record) {
  const card = document.createElement("article");
  card.className = "saved-card";
  const title = document.createElement("h3");
  title.textContent = `${record.id} · ${record.fullName}`;
  const list = document.createElement("dl");
  addDefinition(list, "Thời gian", new Date(record.createdAt).toLocaleString("vi-VN"));
  addDefinition(list, "Ngày sinh", formatDob(record.birthDate));
  addDefinition(list, "Email", record.email);
  addDefinition(list, "Tên Facebook", record.facebook);
  addDefinition(list, "Số lượng", `${record.quantity} tài khoản · ${record.packageName}`);
  addDefinition(list, "Tạm tính", formatVnd(record.price));
  if (record.note) addDefinition(list, "Ghi chú", record.note);
  const actions = document.createElement("div");
  actions.className = "saved-actions";
  actions.append(
    actionButton("Sao chép", () => copyText(messageFor(record), actions.querySelector("button"))),
    actionButton("Tải JSON", () => downloadRecord(record)),
    actionButton("Xóa", () => removeRecord(record.id))
  );
  card.append(title, list, actions);
  return card;
}

function actionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "text-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderSaved() {
  const records = readRecords();
  savedList.replaceChildren();
  savedSection.hidden = records.length === 0;
  records.forEach((record) => savedList.appendChild(renderRecord(record)));
}

function renderReceipt(record) {
  receipt.hidden = false;
  receipt.replaceChildren();
  const kicker = document.createElement("p");
  kicker.className = "eyebrow";
  kicker.textContent = "Đã ghi vào Google Sheet";
  const title = document.createElement("h2");
  title.textContent = record.id;
  const copy = document.createElement("p");
  copy.textContent = "Sổ đã có dòng này. Có thể sao chép tin nhắn nếu muốn gửi thêm cho mình.";
  const list = document.createElement("dl");
  addDefinition(list, "Họ tên", record.fullName);
  addDefinition(list, "Ngày sinh", formatDob(record.birthDate));
  addDefinition(list, "Email", record.email);
  addDefinition(list, "Tên Facebook", record.facebook);
  addDefinition(list, "Số lượng", `${record.quantity} tài khoản · ${record.packageName}`);
  addDefinition(list, "Tạm tính", formatVnd(record.price));
  if (record.saved) addDefinition(list, "Tiết kiệm", formatVnd(record.saved));
  if (record.note) addDefinition(list, "Ghi chú", record.note);
  const actions = document.createElement("div");
  actions.className = "receipt-actions";
  const copyButton = actionButton("Sao chép tin nhắn", () => copyText(messageFor(record), copyButton));
  actions.append(copyButton, actionButton("Tải JSON", () => downloadRecord(record)));
  receipt.append(kicker, title, copy, list, actions);
  receipt.scrollIntoView({ block: "start" });
}

async function copyText(text, button) {
  const previous = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    const host = button.closest("dialog") || document.body;
    host.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "Đã sao chép";
  setTimeout(() => { button.textContent = previous; }, 1600);
}

function downloadRecord(record) {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${record.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function removeRecord(id) {
  if (!confirm("Xóa bản trên máy này? Dòng trên Google Sheet vẫn còn.")) return;
  writeRecords(readRecords().filter((record) => record.id !== id));
  renderSaved();
}

function sheetRow(record, kind) {
  return {
    created_at: record.createdAt,
    kind,
    id: record.id,
    full_name: record.fullName,
    birth_date: record.birthDate ? formatDob(record.birthDate) : "",
    email: record.email,
    facebook: record.facebook || "",
    note: record.note || "",
    quantity: record.quantity ?? "",
    package_name: record.packageName || "",
    price: record.price ?? "",
    saved: record.saved ?? ""
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveRegistration(row) {
  const url = String(window.REGISTRATIONS_URL || "").trim();
  if (!url) throw new Error("missing-sheet");
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(row)
  });
  const check = new URL(url);
  check.searchParams.set("id", row.id);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await wait(700);
    check.searchParams.set("t", String(Date.now()));
    const response = await fetch(check.toString(), { cache: "no-store" });
    if (!response.ok) continue;
    const data = await response.json();
    if (data && data.ok) return;
  }
  throw new Error("unconfirmed");
}

function setStatus(node, message) {
  if (!node) return;
  node.textContent = message;
}

function initForm() {
  if (!form) return;
  const status = document.querySelector("#registerStatus");
  let sending = false;
  form.addEventListener("input", (event) => {
    if (event.target.id) setFieldError(event.target, "");
  });
  form.consent.addEventListener("change", () => setFieldError(form.consent, ""));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const fullName = form.fullName.value.trim();
    const birthDate = form.birthDate.value;
    const email = form.email.value.trim();
    const facebook = form.facebook.value.trim();
    const note = form.note.value.trim();
    const deal = quote(readQuantity());
    let invalid = null;

    const checks = [
      [form.fullName, fullName.length >= 2 && fullName.length <= 80 ? "" : "Nhập họ tên, ít nhất 2 ký tự."],
      [form.birthDate, validBirthDate(birthDate) ? "" : "Chọn ngày tháng năm sinh hợp lệ."],
      [form.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Nhập email hợp lệ."],
      [form.facebook, facebook.length >= 2 && facebook.length <= 120 ? "" : "Nhập tên Facebook."],
      [form.note, note.length <= 2000 ? "" : "Ghi chú tối đa 2000 ký tự."],
      [quantityInput, deal ? "" : `Chọn từ ${MIN_QTY} đến ${MAX_QTY} tài khoản.`],
      [form.consent, form.consent.checked ? "" : "Cần xác nhận trước khi đăng ký."]
    ];
    checks.forEach(([input, message]) => {
      setFieldError(input, message);
      if (message && !invalid) invalid = input;
    });
    if (invalid) {
      invalid.focus();
      return;
    }

    const record = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      fullName,
      birthDate,
      email,
      facebook,
      note,
      quantity: deal.count,
      packageName: deal.name,
      price: deal.price,
      saved: deal.saved
    };
    const button = form.querySelector("[type=submit]");
    const previous = button.textContent;
    sending = true;
    button.disabled = true;
    button.textContent = "Đang ghi...";
    setStatus(status, "");
    try {
      await saveRegistration(sheetRow(record, "goi"));
    } catch {
      setStatus(status, "Chưa ghi được vào sổ. Kiểm tra mạng rồi thử lại.");
      sending = false;
      button.disabled = false;
      button.textContent = previous;
      return;
    }
    writeRecords([record, ...readRecords()].slice(0, 20));
    renderReceipt(record);
    renderSaved();
    sending = false;
    button.disabled = false;
    button.textContent = previous;
    setStatus(status, "");
  });
  renderSaved();
}

function initFree() {
  const dialog = document.querySelector("#freeDialog");
  const freeForm = document.querySelector("#freeForm");
  const freeDone = document.querySelector("#freeDone");
  if (!dialog || !freeForm || !freeDone) return;
  const status = document.querySelector("#freeStatus");
  let lastOpener = null;
  let sending = false;

  function openFree(opener) {
    lastOpener = opener || null;
    freeForm.hidden = false;
    freeDone.hidden = true;
    freeDone.replaceChildren();
    setStatus(status, "");
    if (!dialog.open) dialog.showModal();
    freeForm.freeName.focus();
  }

  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open-free]");
    if (opener) {
      event.preventDefault();
      openFree(opener);
      return;
    }
    if (event.target.closest("[data-close-free]")) dialog.close();
    if (event.target.closest("[data-go-register]")) {
      dialog.close();
      if (document.getElementById("panel-dang-ky")) showTab("dang-ky");
    }
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    freeForm.reset();
    setFieldError(freeForm.freeName, "");
    setFieldError(freeForm.freeEmail, "");
    if (lastOpener) lastOpener.focus();
  });
  freeForm.addEventListener("input", (event) => {
    if (event.target.id) setFieldError(event.target, "");
  });
  freeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const fullName = freeForm.freeName.value.trim();
    const email = freeForm.freeEmail.value.trim();
    const nameMessage = fullName.length >= 2 && fullName.length <= 80 ? "" : "Nhập họ tên, ít nhất 2 ký tự.";
    const emailMessage = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Nhập email hợp lệ.";
    setFieldError(freeForm.freeName, nameMessage);
    setFieldError(freeForm.freeEmail, emailMessage);
    if (nameMessage) {
      freeForm.freeName.focus();
      return;
    }
    if (emailMessage) {
      freeForm.freeEmail.focus();
      return;
    }
    const record = {
      id: makeId().replace("DK-", "FREE-"),
      createdAt: new Date().toISOString(),
      fullName,
      email
    };
    const button = freeForm.querySelector("[type=submit]");
    const previous = button.textContent;
    sending = true;
    button.disabled = true;
    button.textContent = "Đang ghi...";
    setStatus(status, "");
    try {
      await saveRegistration(sheetRow(record, "tool"));
    } catch {
      setStatus(status, "Chưa ghi được vào sổ. Kiểm tra mạng rồi thử lại.");
      sending = false;
      button.disabled = false;
      button.textContent = previous;
      return;
    }
    const previousRows = readFree();
    localStorage.setItem(FREE_KEY, JSON.stringify([record, ...previousRows].slice(0, 20)));
    showFreeDone(record);
    sending = false;
    button.disabled = false;
    button.textContent = previous;
  });

  function readFree() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FREE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function showFreeDone(record) {
    const text = [
      "Đăng ký nhận tool miễn phí",
      `Họ tên: ${record.fullName}`,
      `Email: ${record.email}`,
      "Gửi tin này để nhận tool test."
    ].join("\n");
    freeForm.hidden = true;
    freeDone.hidden = false;
    freeDone.replaceChildren();
    const kicker = document.createElement("p");
    kicker.className = "eyebrow";
    kicker.textContent = "Đã ghi vào Google Sheet";
    const title = document.createElement("h2");
    title.textContent = "Mình đã nhận tên và email";
    const copy = document.createElement("p");
    copy.textContent = "Sổ đã có dòng này. Tool test sẽ gửi theo email vừa điền.";
    const who = document.createElement("p");
    who.className = "who";
    who.textContent = `${record.fullName} · ${record.email}`;
    const actions = document.createElement("div");
    actions.className = "receipt-actions";
    const copyButton = actionButton("Sao chép tin nhắn", () => copyText(text, copyButton));
    const closeButton = actionButton("Đóng", () => dialog.close());
    actions.append(copyButton, closeButton);
    freeDone.append(kicker, title, copy, who, actions);
    copyButton.focus();
  }
}

initTabs();
initDeadline();
initQuantity();
initForm();
initFree();
