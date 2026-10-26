# Customer API - tài liệu test

Tài liệu này dùng để gửi cho người khác kiểm tra 2 API quản lý khách hàng.

## Thông tin chung

**Base URL**

```text
https://frplsqivjroiaixgwuxs.supabase.co/functions/v1
```

Các API dùng email trong `profile.contact.email` để tìm khách hàng.

> Không gửi `service_role key` cho người test. Đây là key có toàn quyền trên
> database.
>
> Khi Edge Function bật xác thực JWT mặc định, header `Authorization` phải
> dùng **Legacy anon key dạng JWT**, thường bắt đầu bằng `eyJ...`. Không dùng
> publishable key dạng `sb_publishable_...` ở đây vì đó không phải JWT và sẽ
> gây lỗi `UNAUTHORIZED_INVALID_JWT_FORMAT`.

Trong các lệnh dưới đây, thay:

```text
YOUR_LEGACY_ANON_JWT
```

bằng Legacy anon key của Supabase project.

Lấy key tại:

```text
Supabase Dashboard
→ Project Settings
→ API Keys
→ Legacy anon, service_role API keys
→ anon / public
```

Key đúng thường có dạng:

```text
eyJhbGciOiJIUzI1NiIs...
```

---

## API 1: Lấy thông tin khách hàng

### Request

```http
GET /customer-by-email?email=tomodell%40gmail.com
Authorization: Bearer YOUR_LEGACY_ANON_JWT
```

URL đầy đủ:

```text
https://frplsqivjroiaixgwuxs.supabase.co/functions/v1/customer-by-email?email=tomodell%40gmail.com
```

### Test bằng curl

```bash
curl --request GET \
  "https://frplsqivjroiaixgwuxs.supabase.co/functions/v1/customer-by-email?email=tomodell%40gmail.com" \
  --header "Authorization: Bearer YOUR_LEGACY_ANON_JWT"
```

### Response thành công `200`

Ví dụ response với khách hàng mẫu Tom Odell:

```json
{
  "id": "KH-1792792163620-0",
  "facebook": "Tom Odell",
  "quantity": 7,
  "lastEditedAt": "2026-10-24T00:01:14.345Z",
  "profile": {
    "personal": {
      "family_name": "Tom",
      "given_name_1": "Odell",
      "date_of_birth": "2001-06-13"
    },
    "contact": {
      "email": "tomodell@gmail.com",
      "phone_mobile": "0949627381"
    }
  },
  "accounts": [
    {
      "username": "0000",
      "email": "",
      "proxy": "",
      "payLink": "",
      "isServer": false
    }
  ],
  "proxies": [""]
}
```

Mật khẩu account không được trả về trong response.

Trong data mẫu, `quantity` là `7` nhưng hiện mới có 1 phần tử trong
`accounts`. API cập nhật proxy sẽ tự tạo các account còn thiếu khi nhận đủ
7 proxy.

---

## API 2: Cập nhật danh sách proxy

API này thay proxy theo thứ tự trong danh sách:

```text
proxies[0] → account 1
proxies[1] → account 2
proxies[2] → account 3
```

### Request

```http
PATCH /update-proxies
Authorization: Bearer YOUR_LEGACY_ANON_JWT
Content-Type: application/json
```

Body:

```json
{
  "email": "tomodell@gmail.com",
  "proxies": [
    "proxy-1:8001:user:pass",
    "proxy-2:8002:user:pass",
    "proxy-3:8003:user:pass",
    "proxy-4:8004:user:pass",
    "proxy-5:8005:user:pass",
    "proxy-6:8006:user:pass",
    "proxy-7:8007:user:pass"
  ]
}
```

### Test bằng curl

```bash
curl --request PATCH \
  "https://frplsqivjroiaixgwuxs.supabase.co/functions/v1/update-proxies" \
  --header "Authorization: Bearer YOUR_LEGACY_ANON_JWT" \
  --header "Content-Type: application/json" \
  --data '{
    "email": "tomodell@gmail.com",
    "proxies": [
      "proxy-1:8001:user:pass",
      "proxy-2:8002:user:pass",
      "proxy-3:8003:user:pass",
      "proxy-4:8004:user:pass",
      "proxy-5:8005:user:pass",
      "proxy-6:8006:user:pass",
      "proxy-7:8007:user:pass"
    ]
  }'
```

### Response thành công `200`

Response có cấu trúc giống API lấy thông tin khách hàng, trong đó
`accounts` và `proxies` đã được cập nhật.

Các trường account khác được giữ nguyên:

- `username`
- `email`
- `password`
- `payLink`
- `isServer`

Nếu số proxy nhiều hơn số account hiện có, API tạo thêm account object cho
phần còn thiếu. API nhận tối đa 100 proxy không rỗng.

## API 3: Cập nhật linkpay theo username

API này tìm account theo `username` và cập nhật trường `payLink`. Username
không phân biệt hoa thường. Nếu username tồn tại ở nhiều khách hàng, API không
thực hiện cập nhật và trả về `409` để tránh sửa nhầm account.

### Request

```http
PATCH /update-linkpay-account
Authorization: ******
Content-Type: application/json
```

Body:

```json
{
  "username": "0000",
  "linkpay": "https://example.com/pay/0000"
}
```

### Test bằng curl

```bash
curl --request PATCH \
  "https://frplsqivjroiaixgwuxs.supabase.co/functions/v1/update-linkpay-account" \
  --header "Authorization: ******" \
  --header "Content-Type: application/json" \
  --data '{
    "username": "0000",
    "linkpay": "https://example.com/pay/0000"
  }'
```

API trả về thông tin khách hàng sau khi cập nhật, với `accounts[].payLink`
chứa linkpay mới.

---

## Mã lỗi

| HTTP status | Ý nghĩa |
|---|---|
| `200` | Thành công |
| `400` | Thiếu email/username/linkpay, JSON không hợp lệ hoặc `proxies` không phải danh sách hợp lệ |
| `401` | Thiếu hoặc sai `Authorization` header |
| `404` | Không tìm thấy khách hàng theo email |
| `409` | Username trùng ở nhiều khách hàng |
| `405` | Dùng sai HTTP method |
| `500` | Lỗi server hoặc lỗi database |

Response lỗi có dạng:

```json
{
  "error": "Customer not found"
}
```

## Deploy dành cho người quản trị

Không cần tự đặt `SUPABASE_SERVICE_ROLE_KEY`. Supabase cung cấp sẵn các biến
môi trường hệ thống cho Edge Functions. Chỉ cần deploy:

```bash
supabase functions deploy customer-by-email
supabase functions deploy update-proxies
supabase functions deploy update-linkpay-account
```
