# Kết quả kiểm tra CloudTask

Ngày kiểm tra: 25/11/2026. Môi trường Windows, Node 24.15.0, Chrome, Wrangler local Workers runtime và D1 Miniflare. Các kiểm tra ban đầu thực hiện trước commit đầu tiên; source được lưu tại https://github.com/thoaitrantlgt/To_Do. Production tại https://cloudtask-neon.pages.dev cũng đã qua 23 kiểm tra HTTPS; xem [deployment](deployment.md) và [báo cáo production](production-verification.json).

| Kiểm tra | Kết quả |
| --- | --- |
| API integration, `cd api; npm test` | 14/14 pass |
| Worker TypeScript, `npm run typecheck` | Pass |
| Frontend TypeScript + Vite, `cd web; npm run build` | Pass |
| Chrome end-to-end, `npm test` | 8/8 pass |
| Pages Function → API Service Binding → D1, GET `/api/health` | 200 `{"ok":true}` |
| Browser suite chạy trên bản build qua Pages Function | Pass |
| 390 px: tạo/sửa/lọc/xóa, form dialog | Không cuộn ngang, thao tác được |
| Figma assets đang hiển thị | Tải thành công từ file local, không dùng URL asset tạm khi chạy |
| Dependency install audit | API và web: 0 vulnerabilities tại lần cài cuối |

Các kiểm thử API dùng auth và D1 thật trong Workers runtime. Chúng bao phủ signup, signin đúng/sai, session, signout, title/description/date validation, trường không hợp lệ, create/read/partial update/complete/delete, phân quyền hai tài khoản, Origin, no-store, bộ lọc today/overdue/upcoming kết hợp status và thứ tự null-last/date/createdAt/id.

Tám kịch bản Chrome:

1. Đăng ký, tạo, reload giữ phiên và dữ liệu, lọc quá hạn, hoàn thành, lọc hoàn thành, sửa và bỏ hạn, xóa có xác nhận, đăng xuất, đăng nhập sai và đúng mật khẩu. Chuyển sang 390 px để kiểm tra thao tác sửa và không cuộn ngang.
2. Giữ lại response PATCH sau khi backend đã lưu, đổi bộ lọc, rồi trả response: danh sách vẫn đúng bộ lọc mới. Test này thất bại trước khi sửa lỗi stale closure và pass sau khi sửa.
3. Giả lập lỗi HTTP tại ranh giới mạng trình duyệt: lỗi tải có retry; lỗi tạo giữ nội dung form; lỗi PATCH không đổi trạng thái đã xác nhận; lỗi DELETE giữ task; 401 đưa về đăng nhập.

4–7. Quay lại tab kích hoạt kiểm tra phiên nền: giữ email/mật khẩu đang nhập ở cả đăng nhập và đăng ký, khi kiểm tra phiên thành công hoặc trả 503. Bốn test đều thất bại trước sửa lỗi unmount form và pass sau khi chỉ hiển thị màn hình tải ở lần kiểm tra phiên đầu tiên. Dữ liệu nhập chỉ giữ trong bộ nhớ React, không lưu mật khẩu xuống browser storage.

8. Đăng ký/đăng nhập, reload giữ cookie phiên và tạo/hoàn thành/xóa công việc qua `http://127.0.0.1:8788`. API tests xác nhận hostname loopback cùng cổng được chấp nhận ở local; cổng khác, domain giả và loopback trên cấu hình production vẫn bị chặn. Test alias trả 403 trước sửa và pass sau khi auth/task dùng chung danh sách origin cho phép.

Ảnh đã kiểm tra trực quan: [đăng nhập desktop](screenshots/login-desktop.png), [đăng nhập mobile](screenshots/login-mobile.png), [đăng ký](screenshots/register-desktop.png), [dashboard desktop](screenshots/dashboard-desktop.png), [dashboard 390 px](screenshots/dashboard-mobile.png), [form công việc](screenshots/task-form-desktop.png). Chạy lại `node scripts/capture.mjs` từ `web/` sau khi seed demo để tạo ảnh mới.

Giao diện dùng bố cục và asset từ Figma nhưng được Việt hóa và điều chỉnh theo phạm vi tài liệu: hai trạng thái, không cộng tác, không ảnh task, không danh mục/mức ưu tiên. Dashboard dùng số liệu D1 thực tế thay vì phần trăm mẫu trong thiết kế.

Production đã có URL Pages, D1 thật, secret riêng và cookie Secure/HttpOnly/SameSite; các luồng auth/CRUD/cách ly đã pass. D1 remote được đối chiếu sau khi dọn task kiểm thử. Chưa benchmark CPU scrypt hoặc thử tải dài hạn, chưa chụp bộ ảnh Worker Logs/D1 phục vụ slide. Kiểm tra biên ngày ở đúng nửa đêm Việt Nam chưa dùng đồng hồ giả lập; logic hiện dùng một ngày Việt Nam chung cho truy vấn và cờ overdue trong từng request.
