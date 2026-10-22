const countInput = document.querySelector("#accountCount");
const status = document.querySelector("#accountStatus");
const countKey = "nz-tool-account-count";
const facebookInput = document.querySelector("#facebook");
const facebookKey = "nz-tool-facebook";
const profileLinks = document.querySelectorAll('a[href="ho-so.html"]');

const savedCount = Number(localStorage.getItem(countKey));
if (savedCount >= 2 && savedCount <= 30) countInput.value = String(savedCount);
facebookInput.value = localStorage.getItem(facebookKey) || "";

profileLinks.forEach(profileLink => profileLink.addEventListener("click", event => {
  const facebook = facebookInput.value.trim();
  if (facebook.length < 2 || facebook.length > 120) {
    event.preventDefault();
    status.textContent = "Nhập tên Facebook hoặc link Facebook của bạn trước nhé.";
    facebookInput.focus();
    return;
  }
  localStorage.setItem(facebookKey, facebook);
}));

function changeCount(delta) {
  const current = Number(countInput.value) || 2;
  countInput.value = String(Math.min(30, Math.max(2, current + delta)));
}

document.querySelector("#accountDown").addEventListener("click", () => changeCount(-1));
document.querySelector("#accountUp").addEventListener("click", () => changeCount(1));
document.querySelector("#accountForm").addEventListener("submit", event => {
  event.preventDefault();
  const count = Number(countInput.value);
  const facebook = facebookInput.value.trim();
  if (facebook.length < 2 || facebook.length > 120) {
    status.textContent = "Nhập tên Facebook hoặc link Facebook của bạn.";
    facebookInput.focus();
    return;
  }
  if (!Number.isInteger(count) || count < 2 || count > 30) {
    status.textContent = "Chọn từ 2 đến 30 tài khoản.";
    return;
  }
  localStorage.setItem(countKey, String(count));
  localStorage.setItem(facebookKey, facebook);
  status.textContent = `Đã lưu Facebook và đăng ký ${count} tài khoản.`;
});
