# CloudTask

Source code: https://github.com/thoaitrantlgt/To_Do

Ứng dụng quản lý công việc cá nhân của nhóm NEON, hiện thực từ `CloudTask_Tai_Lieu_Thiet_Ke_Va_Trien_Khai.docx`. React/Vite chạy trên Cloudflare Pages, Pages Function chuyển `/api/*` qua Service Binding đến Worker, Better Auth quản lý phiên cookie, Cloudflare D1 lưu tài khoản và công việc.

Giao diện dựa trên [To-do List Web App Design](https://www.figma.com/design/CsCHFpZPmAKcNvFUl4n08Z/To-do-List-Web-App-Design--Community-?node-id=16-35), với sidebar, dashboard hai cột và illustration của màn hình tài khoản. Bảng màu đã đổi sang đỏ đất, xám ấm và xanh sage theo yêu cầu. Nội dung được Việt hóa; chức năng bám theo plan: hai trạng thái `todo`/`done`, không thêm cộng tác nhóm, upload ảnh, mức ưu tiên hoặc danh mục. Font và asset thiết kế được lưu/phục vụ local.

**Bản production:** https://cloudtask-neon.pages.dev — đã triển khai ngày 25/11/2026. Đăng ký tài khoản mới trên website; dữ liệu và tài khoản local độc lập với production. Xem [thông tin triển khai](docs/deployment.md).

## Chạy local

Cần Node.js **22.13+** (đã kiểm tra trên Node 24), npm và Chrome để chạy kiểm thử trình duyệt.

Từ thư mục gốc:

```powershell
node scripts/setup-local.mjs
cd api
npm ci
npm run db:local
npm run dev
```

Mở terminal thứ hai:

```powershell
cd web
npm ci
npm run dev
```

Mở **http://localhost:8788**. API local cũng chấp nhận **http://127.0.0.1:8788**: khi `APP_ORIGIN` là HTTP loopback, hai hostname này được tin cậy trên cùng cổng. Cookie của hai hostname độc lập, nên cần đăng nhập lại nếu chuyển địa chỉ. Production chỉ tin cậy origin được cấu hình. Vite chuyển `/api` đến Worker local ở cổng 8787. Dữ liệu D1 local nằm trong `api/.wrangler/state/`, giữ nguyên khi khởi động lại. Không xóa thư mục này nếu muốn giữ dữ liệu local.

Tạo hai tài khoản demo và dữ liệu mẫu khi cả hai server đang chạy:

```powershell
node scripts/seed-demo.mjs
```

| Tài khoản local | Mật khẩu local |
| --- | --- |
| `demo.a@cloudtask.local` | `CloudTaskDemo2026!` |
| `demo.b@cloudtask.local` | `CloudTaskDemo2026!` |

Script seed cố định ở localhost, giữ dữ liệu nếu tài khoản đã có task. Hai tài khoản có danh sách riêng. Có thể tự đăng ký tài khoản khác qua giao diện.

Nếu môi trường hạn chế quyền ghi thư mục cấu hình Wrangler, đặt `XDG_CONFIG_HOME` và `WRANGLER_LOG_PATH` vào một thư mục có quyền ghi trước khi chạy Wrangler, ví dụ:

```powershell
$env:XDG_CONFIG_HOME = "$PWD/.wrangler/config"
$env:WRANGLER_LOG_PATH = "$PWD/.wrangler/logs"
```

Khi dùng Service Binding local, hai terminal Worker và Pages phải dùng **cùng một giá trị tuyệt đối** cho `XDG_CONFIG_HOME` để Wrangler tìm được Worker qua dev registry. Môi trường thông thường không cần đặt biến này.

## Kiểm thử

```powershell
cd api
npm test
npm run typecheck
cd ../web
npm run build
npm test
```

API tests chạy trên Workers runtime và D1 thật được giả lập bằng Miniflare; không mock session hoặc truy vấn SQL. Browser tests cần hai server local chạy trước và Chrome đã cài. Nếu dùng Chromium do Playwright tải, cài bằng `npx playwright install chromium` và bỏ `channel: 'chrome'` trong `web/playwright.config.ts`.

Test bao gồm auth, CRUD, giữ phiên khi reload, dữ liệu sai, phân quyền giữa hai người dùng, Origin, lọc kết hợp và thao tác ở 390 px. Test trình duyệt tự tạo tài khoản có email riêng trên D1 local. Xem [kết quả kiểm tra](docs/verification.md).

## Kiểm tra luồng Pages Function

Để kiểm tra đúng đường đi Pages → Service Binding → Worker → D1, giữ Worker chạy và thay Vite bằng:

```powershell
cd web
npm run build
npm run preview
```

Mở http://localhost:8788/api/health, kết quả mong đợi `{"ok":true}`. Binding `API` được cấu hình sẵn trong `web/wrangler.toml`. Không chạy Vite và Pages preview cùng cổng đồng thời.

## Triển khai Cloudflare

Production đã có Pages `cloudtask-neon`, Worker `cloudtask-api`, D1 `cloudtask-db` và secret `BETTER_AUTH_SECRET` trong tài khoản Cloudflare đã đăng nhập. `api/wrangler.production.toml` chứa cấu hình production; `api/wrangler.toml` và `.dev.vars` vẫn dành cho local để giữ dữ liệu đang dùng trên máy.

Cập nhật API và migration sau này:

```powershell
cd api
npm ci
npm test
npm run typecheck
npm run db:remote
npm run deploy
```

Cập nhật giao diện:

```powershell
cd web
npm ci
npm run build
npm run deploy
npm run verify:production
```

Lệnh verify chạy 23 kiểm tra trên HTTPS thật, gồm cookie, auth, CRUD, phân quyền và Chrome. Lệnh tạo hai tài khoản kiểm thử với mật khẩu ngẫu nhiên không lưu ra file, dọn task tạm và đăng xuất các phiên kiểm thử. Kết quả được ghi vào `docs/production-verification.json`.

Trên máy khác cần chạy `npx wrangler login` để xác thực đúng tài khoản trước khi deploy. Secret production đã được tạo riêng, không nằm trong source hoặc `.dev.vars`; chỉ xoay secret khi cần bằng `npx wrangler secret put BETTER_AUTH_SECRET --config wrangler.production.toml` tại `api/`.

`api/migrations/0001_auth.sql` được sinh bằng CLI `auth` cùng phiên bản Better Auth đã khóa trong lockfile. `0002_tasks.sql` chứa bảng task. Chỉ dùng `npm run db:generate` khi chuẩn bị schema ban đầu; sau khi triển khai phải thêm migration mới, không ghi đè migration đã áp dụng.

Mật khẩu dùng scrypt mặc định của Better Auth. Đăng ký và đăng nhập đã chạy thành công trên production; kiểm thử này không thay thế đo CPU hoặc thử tải dài hạn. Log ứng dụng không ghi mật khẩu/cookie; mỗi request ghi method, path, status và sự kiện tạo task chứa ID để đối chiếu D1.

## Hợp đồng API

Tất cả route task yêu cầu session cookie. POST/PATCH/DELETE yêu cầu `Origin` đúng `APP_ORIGIN` (hoặc hostname loopback tương đương cùng cổng khi chạy HTTP local như mô tả trên). Response auth/task dùng `Cache-Control: no-store`.

| Method | Route | Kết quả |
| --- | --- | --- |
| GET | `/api/health` | D1 `SELECT 1`, 200 hoặc 503 |
| POST | `/api/auth/sign-up/email` | `{name,email,password}` |
| POST | `/api/auth/sign-in/email` | `{email,password}` |
| GET | `/api/auth/get-session` | Phiên và tài khoản |
| POST | `/api/auth/sign-out` | Kết thúc phiên |
| GET | `/api/tasks?status=todo&due=overdue` | `{items: Task[]}` |
| POST | `/api/tasks` | `{title,description?,dueDate?}` → 201 `{item}` |
| PATCH | `/api/tasks/:id` | Ít nhất một trường title/description/dueDate/status → `{item}` |
| DELETE | `/api/tasks/:id` | 204 rỗng |

Lọc `status=todo|done`, `due=today|overdue|upcoming`; bỏ tham số để xem tất cả. Hai bộ lọc kết hợp bằng AND. Quá hạn chỉ gồm task `todo` có hạn trước hôm nay tại `Asia/Ho_Chi_Minh`. Sắp xếp hạn tăng dần, chưa có hạn cuối danh sách, cùng hạn thì tạo mới trước rồi ID tăng dần.

Task trả về: `id,title,description,dueDate,status,overdue,createdAt,updatedAt`. Ngày dạng `YYYY-MM-DD`; gửi `null` để xóa mô tả/hạn; bỏ trường PATCH để giữ nguyên. Trường lạ bị từ chối. Lỗi dạng `{"error":{"code":"INVALID_INPUT","message":"..."}}`, với HTTP 400/401/403/404/405/500. Task của người khác trả 404 khi sửa/xóa.

Tài liệu nền tảng: [Better Auth trên Cloudflare](https://better-auth.com/docs/guides/cloudflare), [Pages Service Binding](https://developers.cloudflare.com/pages/functions/bindings/), [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
