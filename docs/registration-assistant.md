# Tool hỗ trợ điền Registration

Tool mở trang đăng ký New Zealand, điền thông tin từ file JSON khách hàng và
dừng trước nút `REGISTER`. Tool không tự bấm gửi đăng ký.

## Chuẩn bị

Tạo file `.env` hoặc export biến môi trường:

```bash
export REGISTRATION_PASSWORD='mật khẩu cần dùng'
export REGISTRATION_SECRET_ANSWER='câu trả lời câu hỏi bảo mật'
export REGISTRATION_SECRET_QUESTION='What road did your best friend'
```

Có thể chỉ định username; nếu bỏ qua, tool tạo username từ tên và họ:

```bash
export REGISTRATION_USERNAME='username-muon-dung'
```

Không commit các giá trị này vào Git.

## Chạy

File JSON cần có các trường:

```json
{
  "profile": {
    "personal": {
      "family_name": "Tom",
      "given_name_1": "Odell"
    },
    "contact": {
      "email": "tomodell@gmail.com"
    }
  }
}
```

Chạy:

```bash
npm run registration:assist -- --customer /absolute/path/customer.json
```

Tool sẽ mở một cửa sổ Chrome thật, giống ảnh mẫu:

```text
https://onlineservices.immigration.govt.nz/Registration/default.aspx
```

Tool điền First Name, Family Name, Email, Username, hai trường password, câu
hỏi/câu trả lời bảo mật và Terms of Use. Tool dừng trước `REGISTER`; người
dùng phải tự kiểm tra và tự bấm nút.

`REGISTRATION_SECRET_QUESTION` là không bắt buộc. Nếu bỏ qua, tool chọn lựa
chọn câu hỏi đầu tiên có giá trị hợp lệ. Nên đặt biến này để chọn đúng câu hỏi
mong muốn.
