const PROFILE_SECTIONS = [
  ["personal", "Cá nhân", [
    ["contact.has_agent", "Bạn có người đại diện là cố vấn di trú không?", "yesno", true],
    ["personal.family_name", "Họ", "text", true], ["personal.given_name_1", "Tên 1", "text", true],
    ["personal.given_name_2", "Tên 2", "text"], ["personal.given_name_3", "Tên 3", "text"],
    ["personal.other_names", "Tên khác đã hoặc đang dùng", "text"],
    ["personal.title", "Danh xưng", "select", true, ["Mr", "Mrs", "Miss", "Ms", "Dr", "Other"]],
    ["personal.other_title", "Ghi rõ danh xưng", "text"], ["personal.gender", "Giới tính", "select", true, ["Female", "Male"]],
    ["personal.date_of_birth", "Ngày sinh", "date", true], ["personal.country_of_birth", "Nước sinh", "text", true],
    ["address.street_number", "Số nhà", "text", true], ["address.street_name", "Tên đường", "text", true],
    ["address.suburb", "Phường / khu vực", "text", true], ["address.city", "Thành phố", "text", true],
    ["address.province", "Tỉnh / bang", "text", true], ["address.postal_code", "Mã bưu chính", "text", true],
    ["address.country", "Quốc gia", "text", true], ["contact.phone_daytime", "Điện thoại ban ngày", "tel"],
    ["contact.phone_night", "Điện thoại ban đêm", "tel"], ["contact.phone_mobile", "Số di động", "tel", true],
    ["contact.fax", "Số fax", "tel"], ["contact.email", "Email", "email", true],
    ["contact.communication_method", "Cách liên hệ mong muốn", "select", true, ["Email", "Phone", "Fax", "Post"]],
    ["contact.has_credit_card", "Có thẻ để nộp phí trực tuyến không?", "yesno", true]
  ]],
  ["identification", "Giấy tờ", [
    ["identification.passport_number", "Số hộ chiếu", "text", true],
    ["identification.passport_expiry", "Ngày hết hạn hộ chiếu", "date", true],
    ["identification.passport_citizenship", "Quốc tịch trên hộ chiếu", "text", true],
    ["identification.id_type", "Loại giấy tờ thứ hai", "select", true, ["National ID", "Birth certificate", "Driver licence"]],
    ["identification.id_issue_date", "Ngày cấp", "date", true], ["identification.id_expiry_date", "Ngày hết hạn", "date", true]
  ]],
  ["occupation", "Nghề nghiệp", [["occupation.industry_search", "Ngành nghề", "text"], ["occupation.occupation_search", "Nghề nghiệp", "text"]]],
  ["health", "Sức khỏe", [
    ["health.renal_dialysis", "Bạn có bệnh cần hoặc có thể cần lọc máu không?", "yesno", true],
    ["health.active_tb", "Bạn có bệnh lao không?", "yesno", true], ["health.cancer", "Bạn có bệnh ung thư không?", "yesno", true],
    ["health.heart_disease", "Bạn có bệnh tim không?", "yesno", true], ["health.disability", "Bạn có khuyết tật không?", "yesno", true],
    ["health.hospitalisation", "Bạn có thể cần nằm viện không?", "yesno", true], ["health.residential_care", "Bạn có cần chăm sóc tại cơ sở lưu trú không?", "yesno", true],
    ["health.pregnancy", "Bạn có đang mang thai không?", "yesno", true], ["health.tb_risk", "Bạn từng ở nước có nguy cơ lao cao từ 3 tháng trong 5 năm gần đây chưa?", "yesno", true],
    ["health.medical_details", "Chi tiết sức khỏe nếu có câu trả lời Có", "textarea"]
  ]],
  ["character", "Lý lịch", [
    ["character.imprisonment_5_years", "Từng bị kết án tù từ 5 năm trở lên chưa?", "yesno", true],
    ["character.imprisonment_12_months", "10 năm gần đây từng bị kết án tù từ 12 tháng trở lên chưa?", "yesno", true],
    ["character.deported", "Từng bị trục xuất khỏi nước nào chưa?", "yesno", true], ["character.removal_order", "Từng thuộc diện lệnh đưa ra khỏi nước chưa?", "yesno", true],
    ["character.charged", "Từng bị buộc tội chưa?", "yesno", true], ["character.convicted", "Từng bị kết án chưa?", "yesno", true],
    ["character.under_investigation", "Hiện có đang bị điều tra không?", "yesno", true], ["character.excluded", "Từng bị từ chối nhập cảnh chưa?", "yesno", true],
    ["character.removed", "Từng bị đưa ra khỏi nước nào chưa?", "yesno", true], ["character.details", "Chi tiết lý lịch nếu có câu trả lời Có", "textarea"]
  ]],
  ["whs", "Working Holiday", [
    ["whs.previous_whs_visa", "Từng được cấp visa Working Holiday New Zealand chưa?", "yesno", true],
    ["whs.sufficient_funds_holiday", "Có đủ tiền cho chuyến Working Holiday không?", "yesno", true],
    ["whs.travel_date", "Ngày dự định đến New Zealand", "date", true], ["whs.been_to_nz", "Từng đến New Zealand chưa?", "yesno", true],
    ["whs.been_to_nz_when", "Nếu rồi, vào lúc nào?", "text"], ["whs.sufficient_funds_onward_ticket", "Có đủ tiền mua vé rời New Zealand không?", "yesno", true],
    ["whs.meet_scheme_requirements", "Có đủ điều kiện riêng của chương trình không?", "yesno", true], ["whs.length_of_stay", "Thời gian dự định ở lại", "select", false, ["3 months", "6 months", "9 months", "12 months"]]
  ]],
  ["declaration", "Cam kết", [
    ["declaration.all_yes", "Tôi xác nhận tất cả các cam kết bên dưới", "checkbox"],
    ["declaration.false_statement", "Tôi hiểu khai sai có thể khiến hồ sơ bị từ chối", "yesno", true],
    ["declaration.notes_and_questions", "Tôi đã đọc và trả lời các ghi chú, câu hỏi", "yesno", true],
    ["declaration.changed_circumstances", "Tôi sẽ báo nếu hoàn cảnh thay đổi", "yesno", true],
    ["declaration.good_character", "Tôi đáp ứng yêu cầu về lý lịch", "yesno", true],
    ["declaration.information_sharing", "Tôi đồng ý chia sẻ thông tin theo quy định", "yesno", true],
    ["declaration.health_information", "Tôi đồng ý cung cấp thông tin sức khỏe", "yesno", true],
    ["declaration.advice", "Tôi hiểu các hướng dẫn của hồ sơ", "yesno", true],
    ["declaration.occupation_registration", "Tôi hiểu yêu cầu đăng ký nghề nghiệp", "yesno", true],
    ["declaration.entitlement", "Tôi hiểu quyền lợi và điều kiện visa", "yesno", true],
    ["declaration.permit_expiry", "Tôi hiểu thời hạn giấy phép", "yesno", true],
    ["declaration.medical_insurance", "Tôi hiểu yêu cầu bảo hiểm y tế", "yesno", true]
  ]],
  ["payment", "Người trả tiền", [["payment.payer_name", "Tên người trả phí", "text"]]]
];

const STORAGE_KEY = "nz-tool-customers-v1";
const form = document.querySelector("#customerForm");
const customerFields = document.querySelector("#customerFields");
const accountList = document.querySelector("#accountList");
const customerList = document.querySelector("#customerList");
const emptyState = document.querySelector("#emptyState");
const status = document.querySelector("#customerStatus");
const editorTitle = document.querySelector("#editorTitle");
const deleteButton = document.querySelector("#deleteCustomer");
const customerCount = document.querySelector("#customerCount");
let selectedId = null;
let customers = [];
let currentPage = 1;
let pageSize = 10;
const supabaseClient = window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

const inputId = path => `customer-${path.replaceAll(".", "-")}`;
const getValue = (object, path) => path.split(".").reduce((value, key) => value?.[key], object) ?? "";
function setValue(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((item, key) => (item[key] ||= {}), object);
  target[last] = value;
}
function readCustomers() { return customers; }
function backendReady() { return Boolean(supabaseClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY); }
function setStatus(message) { status.textContent = message; }
async function loadCustomers() {
  if (!backendReady()) {
    setStatus("Chưa cấu hình Supabase. Hãy điền URL và anon key trong supabase-config.js.");
    renderList();
    return;
  }
  let { data, error } = await supabaseClient.from("customers").select("id,data,updated_at,last_edited_at").order("last_edited_at", { ascending: false });
  if (error?.message?.includes("last_edited_at")) {
    ({ data, error } = await supabaseClient.from("customers").select("id,data,updated_at").order("updated_at", { ascending: false }));
  }
  if (error) {
    console.error("Không thể tải khách hàng:", error);
    setStatus(`Không thể tải dữ liệu: ${error.message}`);
    return;
  }
  customers = (data || []).map(row => normalizeCustomer({
    ...row.data,
    id: row.id,
    updatedAt: row.updated_at,
    ...(row.last_edited_at ? { lastEditedAt: row.last_edited_at } : {})
  }, 0));
  renderList();
}
async function upsertCustomer(customer) {
  if (!backendReady()) throw new Error("Chưa cấu hình Supabase.");
  const row = { id: customer.id, data: customer, updated_at: customer.updatedAt, last_edited_at: customer.lastEditedAt };
  let { error } = await supabaseClient.from("customers").upsert(row);
  if (error?.message?.includes("last_edited_at")) {
    ({ error } = await supabaseClient.from("customers").upsert({
      id: customer.id,
      data: customer,
      updated_at: customer.updatedAt
    }));
  }
  if (error) throw error;
}
async function removeCustomer(id) {
  if (!backendReady()) throw new Error("Chưa cấu hình Supabase.");
  const { error } = await supabaseClient.from("customers").delete().eq("id", id);
  if (error) throw error;
}
function parseProfile(value) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : {};
  try { return JSON.parse(value); } catch (error) {
    console.warn("Bỏ qua profile_json không hợp lệ:", error);
    return {};
  }
}
function normalizeCustomer(item, index) {
  const profile = parseProfile(item.profile || item.profile_json);
  return {
    id: item.id || `KH-${Date.now()}-${index}`,
    facebook: item.facebook || item.facebook_url || "",
    quantity: Number(item.quantity || item.accountCount || 0),
    price: Number(item.price || item.amount || 0),
    profile,
    accounts: Array.isArray(item.accounts) ? item.accounts.map(normalizeAccount) : [],
    updatedAt: item.updatedAt || item.created_at || new Date().toISOString(),
    lastEditedAt: item.lastEditedAt || item.updatedAt || item.created_at || new Date().toISOString()
  };
}
function normalizeAccount(account = {}) {
  return {
    username: account.username || account.user || "",
    password: account.password || account.pass || "",
    email: account.email || "",
    proxy: account.proxy || "",
    payLink: account.payLink || account.pay_link || "",
    isServer: Boolean(account.isServer ?? account.is_server ?? false)
  };
}
function parseJsonInput(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} không hợp lệ.`);
  }
}
async function importCustomers() {
    try {
      const parsed = parseJsonInput(document.querySelector("#customerJsonInput").value.trim(), "JSON khách hàng");
      const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed.customers) ? parsed.customers : [parsed];
      const imported = source.filter(item => item && typeof item === "object").map(normalizeCustomer);
      if (!imported.length) throw new Error("empty");
      if (!backendReady()) throw new Error("Chưa cấu hình Supabase.");
      const now = new Date().toISOString();
      imported.forEach(customer => {
        customer.updatedAt = customer.updatedAt || now;
        customer.lastEditedAt = customer.lastEditedAt || customer.updatedAt;
      });
      const rows = imported.map(customer => ({ id: customer.id, data: customer, updated_at: customer.updatedAt, last_edited_at: customer.lastEditedAt }));
      let { error } = await supabaseClient.from("customers").upsert(rows);
      if (error?.message?.includes("last_edited_at")) {
        ({ error } = await supabaseClient.from("customers").upsert(rows.map(({ last_edited_at, ...row }) => row)));
      }
      if (error) throw error;
      customers = [...imported, ...customers.filter(existing => !imported.some(item => item.id === existing.id))];
      selectedId = imported[0].id;
      openCustomer(selectedId);
      document.querySelector("#customerJsonInput").value = "";
      setStatus(`Đã nhập ${imported.length} khách hàng vào database.`);
    } catch (error) {
      console.error("Không thể nhập JSON khách hàng:", error);
      setStatus(error.message === "Chưa cấu hình Supabase." ? error.message : error.message || "JSON khách hàng không có dữ liệu.");
    }
}
function createControl(path, label, type, required, options = []) {
  const field = document.createElement("label");
  field.className = `customer-field${type === "textarea" ? " customer-field-wide" : ""}`;
  field.htmlFor = inputId(path);
  field.innerHTML = `<span>${label}${required ? " *" : ""}</span>`;
  const control = type === "textarea" ? document.createElement("textarea") : type === "select" || type === "yesno" ? document.createElement("select") : document.createElement("input");
  if (type === "select" || type === "yesno") {
    const values = type === "yesno" ? ["Yes", "No"] : options;
    control.append(new Option("— Chọn —", ""), ...values.map(value => new Option(value, value)));
  } else control.type = type;
  control.id = inputId(path); control.dataset.path = path; control.required = Boolean(required);
  field.append(control);
  return field;
}
function buildFields() {
  PROFILE_SECTIONS.forEach(([id, title, fields]) => {
    const section = document.createElement("section");
    section.className = "customer-profile-section";
    section.innerHTML = `<div class="profile-section-head"><p class="eyebrow">${id === "personal" ? "Thông tin chính" : "Thông tin"}</p><h3>${title}</h3></div>`;
    const grid = document.createElement("div");
    grid.className = "customer-grid";
    fields.forEach(field => grid.append(createControl(...field)));
    section.append(grid);
    customerFields.append(section);
  });
}
function createAccount(account = {}) {
  const card = document.createElement("article");
  card.className = "managed-account";
  card.innerHTML = `
    <div class="managed-account-head"><strong>Tài khoản</strong><button class="text-button remove-account" type="button">Xóa</button></div>
    <div class="account-grid">
      <label class="customer-field"><span>Username *</span><input data-account="username" type="text" required autocomplete="off"></label>
      <label class="customer-field"><span>Email</span><input data-account="email" type="email" autocomplete="off"></label>
      <label class="customer-field"><span>Mật khẩu *</span><input data-account="password" type="text" required autocomplete="off"></label>
      <label class="customer-field"><span>Proxy</span><input data-account="proxy" type="text" placeholder="host:port:user:pass"></label>
      <label class="customer-field"><span>Link pay</span><input data-account="payLink" type="url" placeholder="https://..."></label>
      <label class="account-checkbox"><input data-account="isServer" type="checkbox"><span>isServer</span></label>
    </div>`;
  const normalized = normalizeAccount(account);
  card.querySelector('[data-account="username"]').value = normalized.username;
  card.querySelector('[data-account="email"]').value = normalized.email;
  card.querySelector('[data-account="password"]').value = normalized.password;
  card.querySelector('[data-account="proxy"]').value = normalized.proxy;
  card.querySelector('[data-account="payLink"]').value = normalized.payLink;
  card.querySelector('[data-account="isServer"]').checked = normalized.isServer;
  card.querySelector(".remove-account").addEventListener("click", () => {
    if (accountList.children.length === 1) {
      card.querySelectorAll("input").forEach(input => { input.value = ""; });
      return;
    }
    card.remove();
    renumberAccounts();
  });
  accountList.append(card);
  renumberAccounts();
}
function renumberAccounts() {
  [...accountList.children].forEach((card, index) => { card.querySelector("strong").textContent = `Tài khoản ${index + 1}`; });
}
function emptyCustomer() {
  return { id: "", facebook: "", quantity: 1, price: 0, profile: {}, accounts: [] };
}
function fillForm(customer) {
  form.reset();
  form.querySelectorAll("[data-path]").forEach(control => {
    const value = getValue(customer.profile, control.dataset.path);
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = value;
  });
  accountList.replaceChildren();
  (customer.accounts?.length ? customer.accounts : [{}]).forEach(createAccount);
  const facebook = document.querySelector("#customer-facebook");
  if (!facebook) {
    const field = createControl("facebook", "Facebook của khách hàng", "text", true);
    field.classList.add("customer-field-wide");
    customerFields.prepend(field);
  }
  const quantity = document.querySelector("#customer-quantity");
  if (!quantity) {
    const field = createControl("quantity", "Số lượng tài khoản", "number", true);
    field.classList.add("customer-field-wide");
    const control = field.querySelector("input");
    control.id = "customer-quantity";
    control.min = "1";
    control.max = "30";
    customerFields.prepend(field);
  }
  const price = document.querySelector("#customer-price");
  if (!price) {
    const field = createControl("price", "Giá tiền (VNĐ)", "number", false);
    field.classList.add("customer-field-wide");
    const control = field.querySelector("input");
    control.id = "customer-price";
    control.min = "0";
    control.step = "1000";
    customerFields.prepend(field);
  }
  document.querySelector("#customer-facebook").value = customer.facebook || "";
  document.querySelector("#customer-quantity").value = customer.quantity || 1;
  document.querySelector("#customer-price").value = customer.price || 0;
}
function readForm() {
  const profile = {};
  form.querySelectorAll("[data-path]").forEach(control => setValue(profile, control.dataset.path, control.type === "checkbox" ? control.checked : control.value.trim()));
  return {
    facebook: document.querySelector("#customer-facebook").value.trim(),
    quantity: Number(document.querySelector("#customer-quantity").value || 1),
    price: Number(document.querySelector("#customer-price").value || 0),
    profile,
    accounts: [...accountList.children].map(card => Object.fromEntries([...card.querySelectorAll("[data-account]")].map(input => [input.dataset.account, input.type === "checkbox" ? input.checked : input.value.trim()])))
  };
}
function customerName(customer) {
  const first = getValue(customer.profile, "personal.given_name_1");
  const last = getValue(customer.profile, "personal.family_name");
  return [last, first].filter(Boolean).join(" ") || customer.facebook || "Khách chưa đặt tên";
}
function formatPrice(value) {
  return Number(value) > 0 ? `${new Intl.NumberFormat("vi-VN").format(value)} đ` : "—";
}
function accountStats(customer) {
  const required = Math.max(0, Number(customer.quantity || 0));
  const added = Array.isArray(customer.accounts) ? customer.accounts.length : 0;
  return { required, added, complete: added >= required };
}
function renderList() {
  const query = document.querySelector("#customerSearch").value.trim().toLowerCase();
  customerList.replaceChildren();
  const filter = document.querySelector("#customerStatusFilter").value;
  const filtered = readCustomers().filter(customer => {
    const matchesQuery = `${customerName(customer)} ${customer.facebook} ${getValue(customer.profile, "contact.email")}`.toLowerCase().includes(query);
    const stats = accountStats(customer);
    return matchesQuery && (filter === "all" || (filter === "complete" && stats.complete) || (filter === "missing" && !stats.complete));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const pageCustomers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allStats = readCustomers().reduce((summary, customer) => {
    const stats = accountStats(customer);
    summary.required += stats.required; summary.added += stats.added; summary.price += Number(customer.price || 0);
    return summary;
  }, { required: 0, added: 0, price: 0 });
  customerCount.textContent = `${filtered.length}/${readCustomers().length} khách hàng`;
  document.querySelector("#customerSummary").textContent = `Tài khoản: ${allStats.added}/${allStats.required} · Tổng tiền: ${formatPrice(allStats.price)}`;
  emptyState.hidden = filtered.length > 0;
  document.querySelector("#paginationInfo").textContent = filtered.length ? `Trang ${currentPage}/${totalPages} · ${filtered.length} kết quả` : "";
  document.querySelector("#previousPage").disabled = currentPage === 1;
  document.querySelector("#nextPage").disabled = currentPage === totalPages;
  if (!filtered.length) return;
  pageCustomers.forEach(customer => {
    const stats = accountStats(customer);
    const row = document.createElement("tr");
    row.className = customer.id === selectedId ? "is-selected" : "";
    row.innerHTML = `<td><strong>${customerName(customer)}</strong></td><td>${customer.facebook || "—"}</td><td>${getValue(customer.profile, "contact.email") || "—"}</td><td>${stats.required}</td><td>${stats.added}</td><td><span class="status-badge ${stats.complete ? "status-complete" : "status-missing"}">${stats.complete ? "Đủ" : `Thiếu ${stats.required - stats.added}`}</span></td><td>${formatPrice(customer.price)}</td><td>${new Date(customer.lastEditedAt || customer.updatedAt).toLocaleDateString("vi-VN")}</td><td><button class="text-button table-open" type="button">Mở</button></td>`;
    row.querySelector(".table-open").addEventListener("click", () => openCustomer(customer.id));
    row.addEventListener("dblclick", () => openCustomer(customer.id));
    customerList.append(row);
  });
}
function openCustomer(id) {
  const customer = readCustomers().find(item => item.id === id);
  if (!customer) return;
  selectedId = id; editorTitle.textContent = customerName(customer); deleteButton.hidden = false; fillForm(customer); status.textContent = ""; renderList();
  document.querySelector("#customerModal")?.showModal();
}
function newCustomer() {
  selectedId = null; editorTitle.textContent = "Thêm khách hàng mới"; deleteButton.hidden = true; fillForm(emptyCustomer()); status.textContent = ""; renderList();
  document.querySelector("#customerModal")?.showModal();
}
async function saveCustomer(event) {
  event.preventDefault();
  const invalid = form.querySelector(":invalid");
  if (invalid) {
    invalid.focus(); status.textContent = "Bạn hãy điền các mục bắt buộc trước khi lưu."; return;
  }
  const data = readForm();
  const lastEditedAt = new Date().toISOString();
  const customer = { ...data, id: selectedId || `KH-${Date.now()}`, updatedAt: lastEditedAt, lastEditedAt };
  try {
    await upsertCustomer(customer);
    const index = customers.findIndex(item => item.id === customer.id);
    if (index === -1) customers.unshift(customer); else customers[index] = customer;
    selectedId = customer.id; editorTitle.textContent = customerName(customer); deleteButton.hidden = false;
    setStatus("Đã lưu khách hàng vào database."); renderList(); document.querySelector("#customerModal")?.close();
  } catch (error) {
    console.error("Không thể lưu khách hàng:", error);
    setStatus(`Không thể lưu: ${error.message}`);
  }
}
async function deleteCustomer() {
  if (!selectedId || !window.confirm("Xóa khách hàng này và toàn bộ tài khoản đi kèm?")) return;
  try {
    await removeCustomer(selectedId);
    customers = customers.filter(customer => customer.id !== selectedId);
    newCustomer(); setStatus("Đã xóa khách hàng khỏi database.");
  } catch (error) {
    console.error("Không thể xóa khách hàng:", error);
    setStatus(`Không thể xóa: ${error.message}`);
  }
}
buildFields();
fillForm(emptyCustomer());
document.querySelector("#newCustomer").addEventListener("click", newCustomer);
document.querySelector("#resetForm").addEventListener("click", () => selectedId ? openCustomer(selectedId) : newCustomer());
document.querySelector("#deleteCustomer").addEventListener("click", deleteCustomer);
document.querySelector("#closeCustomerModal").addEventListener("click", () => document.querySelector("#customerModal").close());
document.querySelector("#customerModal")?.addEventListener("click", event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("#addAccount").addEventListener("click", () => createAccount());
document.querySelector("#customerSearch").addEventListener("input", () => { currentPage = 1; renderList(); });
document.querySelector("#customerStatusFilter").addEventListener("change", () => { currentPage = 1; renderList(); });
document.querySelector("#pageSize").addEventListener("change", event => { pageSize = Number(event.target.value); currentPage = 1; renderList(); });
document.querySelector("#previousPage").addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; renderList(); } });
document.querySelector("#nextPage").addEventListener("click", () => { currentPage += 1; renderList(); });
document.querySelector("#importCustomers").addEventListener("click", importCustomers);
document.querySelector("#importAccounts").addEventListener("click", () => {
  try {
    const parsed = parseJsonInput(document.querySelector("#accountJsonInput").value.trim(), "JSON tài khoản");
    const accounts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.accounts) ? parsed.accounts : [parsed];
    if (!accounts.length || accounts.some(account => !account || typeof account !== "object")) throw new Error("JSON tài khoản không có dữ liệu.");
    accounts.forEach(createAccount);
    document.querySelector("#accountJsonInput").value = "";
    setStatus(`Đã thêm ${accounts.length} tài khoản vào form. Bấm Lưu khách hàng để lưu database.`);
  } catch (error) {
    setStatus(error.message);
  }
});
document.querySelector("#exportCustomers").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(customers, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = "khach-hang.json"; link.click(); URL.revokeObjectURL(link.href);
});
form.addEventListener("submit", saveCustomer);
renderList();
loadCustomers();
