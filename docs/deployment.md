# Triển khai CloudTask lên Cloudflare

Đã triển khai ngày 25/11/2026 và kiểm tra qua HTTPS production.

**Website:** https://cloudtask-neon.pages.dev

**Health check:** https://cloudtask-neon.pages.dev/api/health

Đăng ký tài khoản mới trên website để sử dụng. Dữ liệu local không được sao chép ra production.

| Thành phần | Resource | Chức năng |
| --- | --- | --- |
| Cloudflare Pages | `cloudtask-neon`, production branch `main` | Phục vụ React/Vite build và font/asset |
| Pages Function | `/api/*` | Chuyển request nguyên trạng qua Service Binding `API` |
| Cloudflare Worker | `cloudtask-api` | Better Auth, session cookie và task REST API |
| Cloudflare D1 | `cloudtask-db`, APAC | Lưu tài khoản, phiên và công việc |

Luồng API: trình duyệt → Pages Function → Service Binding → Worker → D1. Worker không mở endpoint `workers.dev` công khai; request ứng dụng đi qua Pages cùng origin. Không có máy chủ VM hoặc tiến trình Node cần duy trì khi website chạy.

Worker version: `7d4311b9-9d82-4f73-a24c-cb7f654364a9`.

Pages deployment: `15e45e06-9bcd-4c6a-b099-a5aafc393a84`, môi trường Production.

URL sử dụng là domain production ổn định phía trên. Các URL hash của từng deployment không phải origin xác thực production.

Migration `0001_auth.sql` và `0002_tasks.sql` đã áp dụng remote. Wrangler xác nhận không còn migration chờ. `BETTER_AUTH_SECRET` đã được sinh ngẫu nhiên và lưu qua Cloudflare secret; không xuất giá trị vào source hay log.

Cấu hình remote ở `api/wrangler.production.toml`; cấu hình local ở `api/wrangler.toml`. Lệnh `api/npm run deploy` và `npm run db:remote` chọn rõ file production; chạy `npm run dev` vẫn dùng cấu hình local.

23 kiểm tra production đã pass, gồm health truy vấn D1, signup hai tài khoản, cookie Secure/HttpOnly/SameSite, signin qua Chrome, reload giữ phiên, CRUD bền vững, cách ly tài khoản, chặn Origin khác, bộ lọc, signout và viewport 390px. Xem [kết quả máy đọc được](production-verification.json).

Task kiểm thử đã được dọn. Hai tài khoản kiểm thử còn trong D1, dùng email UUID dưới `example.com` và mật khẩu ngẫu nhiên không được lưu. Tại thời điểm đối chiếu D1 sau kiểm thử: 2 user và 0 task.

Theo dõi Worker trong Cloudflare Dashboard hoặc từ `api/`:

```powershell
npx wrangler tail cloudtask-api --config wrangler.production.toml
```

Để kiểm tra bảng task từ `api/`:

```powershell
npx wrangler d1 execute cloudtask-db --remote --config wrangler.production.toml --command "SELECT id, title, status, due_date FROM tasks ORDER BY created_at DESC LIMIT 10"
```

Đăng ký và đăng nhập đã thành công trên deployment thật; chưa thực hiện benchmark CPU hoặc thử tải dài hạn. Không thay đổi gói thanh toán trong quá trình triển khai.
