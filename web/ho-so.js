const sections = [
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

const form = document.querySelector("#profileForm");
const status = document.querySelector("#profileStatus");
const submitButton = document.querySelector("#submitProfile");
const discardButton = document.querySelector("#discardProfile");
const supabaseClient = window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;
let editingCustomer = null;
let showWizardStep = null;
const inputId = path => `profile-${path.replaceAll(".", "-")}`;
const getValue = (object, path) => path.split(".").reduce((value, key) => value?.[key], object) ?? "";
function setValue(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((item, key) => (item[key] ||= {}), object);
  target[last] = value;
}
function buildForm() {
  sections.forEach(([id, title, fields]) => {
    const section = document.createElement("section");
    section.className = "profile-section";
    section.innerHTML = `<div class="profile-section-head"><p class="eyebrow">${id === "personal" ? "Bước 1" : "Thông tin"}</p><h2>${title}</h2></div>`;
    const grid = document.createElement("div");
    grid.className = "profile-grid";
    fields.forEach(([path, label, type, required, options = []]) => {
      const field = document.createElement("label");
      field.className = `profile-field${type === "textarea" ? " profile-wide" : ""}`;
      field.htmlFor = inputId(path);
      const requiredMark = required ? " *" : "";
      field.insertAdjacentHTML("afterbegin", `<span>${label}${requiredMark}</span>`);
      let control;
      if (type === "textarea") control = document.createElement("textarea");
      else if (type === "select" || type === "yesno") {
        control = document.createElement("select");
        const values = type === "yesno" ? ["Yes", "No"] : options;
        control.append(new Option("— Chọn —", ""), ...values.map(value => new Option(value, value)));
      } else {
        control = document.createElement("input");
        control.type = type;
      }
      control.id = inputId(path); control.name = path; control.dataset.path = path;
      if (required) control.required = true;
      field.append(control); grid.append(field);
    });
    section.append(grid); form.append(section);
  });
  initWizard();
}
function initWizard() {
  const steps = [...form.querySelectorAll(".profile-section")];
  let currentStep = 0;
  const previousButton = document.querySelector("#previousStep");
  const nextButton = document.querySelector("#nextStep");
  const indicator = document.querySelector("#stepIndicator");
  function renderStep() {
    steps.forEach((step, index) => { step.hidden = index !== currentStep; });
    previousButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === steps.length - 1;
    submitButton.hidden = !editingCustomer && currentStep !== steps.length - 1;
    discardButton.hidden = !editingCustomer;
    indicator.textContent = `Bước ${currentStep + 1}/${steps.length}`;
    status.textContent = "";
    window.scrollTo({ top: form.offsetTop - 24, behavior: "smooth" });
  }
  showWizardStep = step => {
    currentStep = Math.max(0, Math.min(step, steps.length - 1));
    renderStep();
  };
  previousButton.addEventListener("click", () => {
    if (currentStep > 0) { currentStep -= 1; renderStep(); }
  });
  nextButton.addEventListener("click", () => {
    if (currentStep < steps.length - 1) { currentStep += 1; renderStep(); }
  });
  discardButton.addEventListener("click", () => {
    if (!editingCustomer) return;
    fillCustomer(editingCustomer);
    editingCustomer = null;
    submitButton.textContent = "Lưu thông tin";
    showWizardStep?.(0);
    showStatus("Đã hủy thay đổi.");
  });
  renderStep();
}
function readProfile() {
  const profile = {};
  form.querySelectorAll("[data-path]").forEach(control => {
    setValue(profile, control.dataset.path, control.type === "checkbox" ? control.checked : control.value.trim());
  });
  profile.declaration ||= {};
  profile.declaration.all_yes = form.querySelector(`[data-path="declaration.all_yes"]`)?.checked || false;
  return profile;
}
function fillProfile(profile) {
  form.querySelectorAll("[data-path]").forEach(control => {
    const value = getValue(profile, control.dataset.path);
    if (control.type === "checkbox") control.checked = value === true || value === "true";
    else control.value = value;
  });
}
function fillCustomer(customer) {
  fillProfile(customer.profile || {});
  const facebook = form.querySelector("#facebook");
  const quantity = form.querySelector("#accountCount");
  if (facebook) facebook.value = customer.facebook || "";
  if (quantity) quantity.value = String(customer.quantity || 1);
}
function dateForTool(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : `${date.getDate()} ${date.toLocaleString("en-US", { month: "long" })}, ${date.getFullYear()}`;
}
function normalizeDates(profile) {
  ["personal.date_of_birth", "identification.passport_expiry", "identification.id_issue_date", "identification.id_expiry_date", "whs.travel_date"].forEach(path => {
    const value = getValue(profile, path); if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setValue(profile, path, dateForTool(value));
  });
  return profile;
}
function showStatus(message) { status.textContent = message; }
function profileId() { return `HOSO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function readRegistration() {
  return {
    facebook: form.querySelector("#facebook")?.value.trim() || "",
    quantity: Number(form.querySelector("#accountCount")?.value || 0),
    profile: readProfile()
  };
}
async function submitProfile() {
  const fields = [...form.querySelectorAll("[required]")];
  const invalid = fields.find(field => {
    if (field.type === "checkbox") return !field.checked;
    if (field.type === "number") return !Number.isInteger(Number(field.value)) || Number(field.value) < 1 || Number(field.value) > 30;
    return !field.value.trim();
  });
  if (invalid) {
    invalid.focus();
    showStatus(invalid.id === "accountCount"
      ? "Chọn từ 1 đến 30 tài khoản."
      : "Bạn hãy điền hết các mục bắt buộc trước khi gửi.");
    return;
  }
  if (!supabaseClient) {
    showStatus("Chưa cấu hình nơi lưu hồ sơ. Vui lòng báo người quản trị.");
    return;
  }
  const profile = readProfile();
  const quantity = Number(form.querySelector("#accountCount")?.value || 0);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
    showStatus("Số lượng tài khoản phải từ 1 đến 30.");
    return;
  }
  const isEditing = Boolean(editingCustomer?.id);
  const id = editingCustomer?.id || profileId();
  const lastEditedAt = new Date().toISOString();
  const payload = {
    ...(editingCustomer || {}),
    id,
    facebook: form.querySelector("#facebook")?.value.trim() || "",
    quantity,
    profile,
    updatedAt: lastEditedAt,
    lastEditedAt
  };
  submitButton.disabled = true;
  submitButton.textContent = "Đang gửi...";
  showStatus("");
  try {
    const { error } = await supabaseClient.from("customers").upsert({
      id,
      data: payload,
      updated_at: payload.updatedAt,
      last_edited_at: payload.lastEditedAt
    });
    if (error) throw error;
    editingCustomer = payload;
    submitButton.textContent = "Lưu thay đổi";
    showStatus(isEditing ? "Đã lưu thay đổi hồ sơ thành công." : "Đã lưu hồ sơ thành công. Bạn có thể dùng họ, tên và ngày sinh để kiểm tra lại.");
  } catch (error) {
    console.error("Không thể lưu hồ sơ:", error);
    showStatus(`Lưu hồ sơ chưa thành công: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingCustomer ? "Lưu thay đổi" : "Lưu thông tin";
  }
}
buildForm();
const facebookField = form.querySelector("#facebook");
const quantityField = form.querySelector("#accountCount");
const savedFacebook = localStorage.getItem("nz-tool-facebook");
const savedQuantity = Number(localStorage.getItem("nz-tool-account-count"));
if (facebookField && savedFacebook) facebookField.value = savedFacebook;
if (quantityField && savedQuantity >= 1 && savedQuantity <= 30) quantityField.value = String(savedQuantity);
form.addEventListener("submit", event => {
  event.preventDefault();
  if (facebookField) localStorage.setItem("nz-tool-facebook", facebookField.value.trim());
  if (quantityField) localStorage.setItem("nz-tool-account-count", quantityField.value);
  submitProfile();
});
form.addEventListener("change", event => {
  if (event.target.dataset.path === "declaration.all_yes") {
    form.querySelectorAll('[data-path^="declaration."]:not([data-path="declaration.all_yes"])').forEach(control => { control.value = "Yes"; });
  }
});
document.querySelector("#lookupForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const result = document.querySelector("#lookupResult");
  const familyName = document.querySelector("#lookupFamilyName").value.trim().toLowerCase();
  const givenName = document.querySelector("#lookupGivenName").value.trim().toLowerCase();
  const dob = document.querySelector("#lookupDob").value;
  if (!supabaseClient) {
    result.textContent = "Chưa cấu hình nơi lưu hồ sơ.";
    return;
  }
  result.textContent = "Đang kiểm tra...";
  try {
    const { data, error } = await supabaseClient.from("customers").select("data");
    if (error) throw error;
    const match = (data || []).map(row => row.data).find(customer => {
      const profile = customer?.profile || {};
      return String(profile.personal?.family_name || "").trim().toLowerCase() === familyName
        && String(profile.personal?.given_name_1 || "").trim().toLowerCase() === givenName
        && profile.personal?.date_of_birth === dob;
    });
    if (!match) {
      editingCustomer = null;
      result.textContent = "Không tìm thấy hồ sơ trùng khớp.";
      return;
    }
    editingCustomer = match;
    fillCustomer(match);
    submitButton.textContent = "Lưu thay đổi";
    result.textContent = "";
    const message = document.createElement("span");
    message.textContent = `Đã tìm thấy hồ sơ của ${match.profile.personal.family_name} ${match.profile.personal.given_name_1}.`;
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-ghost button-small";
    editButton.textContent = "Xem và sửa hồ sơ";
    editButton.addEventListener("click", () => {
      showWizardStep?.(0);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    result.append(message, editButton);
  } catch (error) {
    console.error("Không thể tra cứu hồ sơ:", error);
    result.textContent = `Tra cứu chưa thành công: ${error.message}`;
  }
});
