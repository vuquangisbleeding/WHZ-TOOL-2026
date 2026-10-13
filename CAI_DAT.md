# Cài INZ Runner

Bản cài này dành cho người được phát app. Máy cần có Google Chrome. App không kèm hồ sơ mẫu của người khác: lần đầu mở, đơn và tài khoản đều trống. Bạn tự điền, rồi bấm **Bắt đầu**.

Username không có trong danh sách được phép thì app dừng và báo **Không có trong whitelist**. Chrome không mở. Nhờ người phát app thêm username đó.

## Chọn đúng file

Giải nén file zip đúng hệ điều hành.

| Máy | Việc cần làm |
| --- | --- |
| Mac chip Apple (M1, M2, M3, M4), macOS 11 trở lên | Mở thư mục `Apple-Silicon`, mở file `.dmg`, kéo **INZ Runner** vào **Applications** |
| Mac chip Intel, macOS 11 trở lên | Mở thư mục `Intel`, làm tương tự |
| Windows 10 hoặc 11, máy 64-bit | Bấm đúp `INZ-Runner-Setup.exe` |

Trên Mac, bấm menu Apple, **About This Mac**. Nếu dòng Chip ghi Apple M thì dùng `Apple-Silicon`. Nếu ghi Intel thì dùng `Intel`.

Windows 32-bit không được hỗ trợ. File `INZ-Runner-Setup.exe` là bản 64-bit. Máy Windows chip ARM vẫn mở được file này.

## Cài Google Chrome trước

App mở đúng Chrome đã cài trên máy, không tải thêm trình duyệt riêng.

1. Vào [https://www.google.com/chrome/](https://www.google.com/chrome/).
2. Tải bản Chrome đúng hệ điều hành và cài.
3. Mở Chrome một lần để chắc là cài xong, rồi có thể đóng.

Nếu app báo **Không thấy Google Chrome**, Chrome chưa được cài, hoặc đang nằm ở thư mục khác. Cài lại Chrome vào chỗ mặc định rồi mở app lại.

## Cài trên Mac

1. Mở file `.dmg`.
2. Kéo **INZ Runner** vào thư mục **Applications**.
3. Mở **Applications** và bấm **INZ Runner**.

macOS sẽ chặn lần đầu vì app chưa có chữ ký của Apple. Làm một trong hai cách:

- Bấm phải (hoặc Control-bấm) vào **INZ Runner**, chọn **Open**, rồi **Open** lần nữa.
- Hoặc vào **System Settings**, **Privacy & Security**, kéo xuống và bấm **Open Anyway**.

Chỉ cần làm bước này một lần.

## Cài trên Windows

1. Bấm đúp file `setup.exe`.
2. Nếu Windows hiện SmartScreen màu xanh: bấm **More info**, rồi **Run anyway**.
3. Chọn thư mục cài nếu muốn, rồi bấm cài. Không cần quyền quản trị cả máy.
4. Mở **INZ Runner** từ màn hình desktop hoặc menu Start.

## Lần đầu dùng

1. Mở app. Tab **Hồ sơ** đang trống.
2. Điền đơn theo `HUONG_DAN_SU_DUNG.pdf`. File đó nằm cạnh app: trên Windows cùng thư mục với `INZ Runner.exe`, trên Mac bấm phải **INZ Runner** rồi chọn **Show Package Contents**. Ngày viết dạng `24 May, 1996`. Giá trị chọn vẫn là chữ trên website, ví dụ `Yes`, `No`, `Miss`.
3. Sang **Cài đặt**. Điền **Scheme country** đúng chữ trên thẻ quốc gia, ví dụ `Japan`. Ô này phải giống ô quốc gia trong đơn.
4. Dán danh sách proxy nếu tài khoản cần proxy. Mỗi dòng một proxy `host:port:username:password`.
5. Thêm một dòng tài khoản: tên đăng nhập, mật khẩu, email. Tick **Dùng proxy** khi dòng đó phải lấy proxy trong danh sách phía trên.
6. Autocaptcha API key, bot token và chat ID nằm trên whitelist. Sửa trực tiếp trên sheet. App không có ô để nhập ba giá trị này. Thiếu một giá trị thì lần chạy dừng.
7. Bấm **Lưu hồ sơ** và **Lưu cài đặt**.
8. Sang tab **Chạy**, bấm **Bắt đầu** khi thẻ quốc gia trên trang Immigration đang mở.

App dừng trước lúc nhập số thẻ. Nút **Mở trang thanh toán** mở trình duyệt để bạn tự trả.

## Dữ liệu nằm ở đâu

App không ghi đè đơn mỗi lần mở. File của bạn nằm ở:

- Mac: `~/Library/Application Support/inz-puppeteer-multi-tab`
- Windows: `%APPDATA%\inz-puppeteer-multi-tab`

Trong đó có đơn, tài khoản, file cài đặt và thư mục `logs`. Xóa thư mục này là xóa dữ liệu đã nhập trên máy đó.

## Gỡ app

- Mac: kéo **INZ Runner** từ **Applications** vào Trash. Thư mục dữ liệu ở trên vẫn còn cho đến khi bạn tự xóa.
- Windows: **Settings**, **Apps**, chọn **INZ Runner**, **Uninstall**.

## Việc bản cài không làm

- Không kèm đơn, hộ chiếu, mật khẩu hay key của người đóng gói.
- Không tự cài Chrome.
- Không ký số bởi Apple hay Microsoft, nên hệ điều hành hỏi lại ở lần mở đầu.
- Không cho chạy username nằm ngoài danh sách được phép.
