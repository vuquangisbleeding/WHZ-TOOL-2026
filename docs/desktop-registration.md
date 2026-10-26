# Điền Registration trong INZ Runner

Trong app desktop, mở tab **Hồ sơ** rồi bấm **Mở & điền Registration**.

Để mở nhiều tài khoản cùng lúc, điền/lưu danh sách tài khoản rồi bấm **Mở
nhiều Registration**. Mỗi dòng tài khoản sẽ được mở thành một tab Chrome
riêng và dùng `username`, `email`, `password` của chính dòng đó.

App sẽ:

1. Mở Chrome thật tới `https://onlineservices.immigration.govt.nz/Registration/default.aspx`.
2. Đọc họ, tên và email từ hồ sơ đang mở.
3. Đọc username, email và mật khẩu từ tài khoản đang nhập trong mục
   **Tài khoản** của tool.
4. Điền username, mật khẩu, câu hỏi/câu trả lời bảo mật và Terms of Use.
5. Giữ Chrome ở màn hình Registration để người dùng kiểm tra.

Khi mở nhiều tài khoản, app mở tất cả tab trong cùng một cửa sổ Chrome. App
không tự bấm `REGISTER`; người dùng phải tự kiểm tra và tự xác nhận từng tab.
Nút **Mở & điền Registration** dùng tài khoản đầu tiên trong danh sách. Nút
**Mở nhiều Registration** dùng thông tin riêng của từng dòng tài khoản.

Mật khẩu trong từng dòng tài khoản được ưu tiên hơn
`REGISTRATION_PASSWORD` trong `.env`. Các biến Registration trong `.env` chỉ
được dùng làm giá trị dự phòng cho trường chưa có trong tool, như câu trả lời
bảo mật.

## Cấu hình

Thêm các giá trị vào file `.env` của app:

```dotenv
REGISTRATION_PASSWORD=mật-khẩu
REGISTRATION_SECRET_QUESTION=What road did your best friend
REGISTRATION_SECRET_ANSWER=Hai Thuong Lan Ong
REGISTRATION_USERNAME=vuquang02122031
```

Không commit các giá trị thật vào Git. Nếu app đã từng tạo file `.env` trong
thư mục dữ liệu, sửa file đó rồi khởi động lại app.

Chạy app:

```bash
npm run desktop
```
