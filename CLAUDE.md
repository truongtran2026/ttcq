# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Bối cảnh dự án
Ứng dụng web thống kê hành trình tuần tra cáp quang. Chi tiết kiến trúc dữ liệu (schema Supabase) xem `ARCHITECTURE.md` — đọc file đó trước khi bắt đầu bất kỳ task nào liên quan đến database.

Người yêu cầu (chủ project) KHÔNG rành lập trình. Luôn ưu tiên giải thích ngắn gọn, dễ hiểu khi thay đổi ảnh hưởng lớn, và **luôn giải thích bằng tiếng Việt** khi trao đổi với người dùng.

## Stack
- 100% static, KHÔNG build step, KHÔNG package.json/bundler. Module hóa bằng ES Modules native (`import`/`export`, `<script type="module">`) — chạy thẳng trên trình duyệt, không cần biên dịch.
- CSS: Tailwind qua CDN (`<script src="https://cdn.tailwindcss.com">`). Chỉ có 1 khối `<style>` nhỏ trong `index.html` cho những gì Tailwind không làm được (keyframe spinner, class `.overlay`/`.toast`/`.spill`/`.tbtn`/`.tab-btn` cho trạng thái active/on, và rule ẩn nút khi ở chế độ chỉ xem).
- Chart.js 4 (CDN) vẽ biểu đồ dashboard; `@supabase/supabase-js@2` (CDN) làm client DB + Auth (Google OAuth qua `sb.auth.signInWithOAuth`).
- Backend/DB: Supabase (PostgreSQL, RLS) — graph model (`doan_tuyen`/`lo_trinh`/`v_lo_trinh_km`...), xem `ARCHITECTURE.md`.
- Hosting: GitHub Pages — deploy = commit + push lên `main`, không có CI/build.

## Chạy & deploy
- Không có lệnh build/lint/test. Vì dùng ES Modules (`import`/`export`), PHẢI mở qua HTTP server local (`py -m http.server` hoặc `npx serve .`), KHÔNG mở trực tiếp bằng `file://` (trình duyệt chặn `import` qua giao thức file).
- Deploy: `git push` lên `main` (GitHub Pages tự publish toàn bộ file tĩnh, không cần thao tác gì thêm).
- Không có test tự động. Sau khi sửa, tự mở app qua local server, thử luồng liên quan rồi mô tả lại đã test gì (xem mục cuối file).

## Cấu trúc code (repo root — KHÔNG bọc thêm thư mục `/ttcq-app`, vì GitHub Pages cần `index.html` ở root)
```
index.html                     -- markup Tailwind + Chart.js/Supabase CDN, chỉ 1 <script type="module" src="./app.js">
app.js                          -- entry: import + init các module (auth, dashboard, records, adminUsers), KHÔNG chứa logic
src/config.js                   -- SUPABASE_URL, SUPABASE_ANON (nơi DUY NHẤT sửa khi đổi key)
src/api/supabaseClient.js       -- khởi tạo & export client `sb` (dùng window.supabase từ CDN)
src/api/refDataApi.js           -- load 1 lần + cache: diem, doan_tuyen, lo_trinh, v_lo_trinh_km, v_doan_tuyen_ten, lu_tru_list — export getRefData()/tenDoanTuyen()
src/api/recordsApi.js           -- CRUD ttcq_records + ttcq_records_doan_le (nested select 1 round-trip để lấy kèm tên đoạn/lộ trình)
src/api/usersApi.js             -- CRUD bảng vai trò `app_users` (listUsers/updateUserRole/revokeUser)
src/utils/format.js             -- fmt(), hexA() — formatting số/màu thuần
src/utils/dateUtils.js          -- toàn bộ tính Date bằng Date.UTC(...): toIso/toVi/presetRange/monthRangeOfIso — KHÔNG dùng `new Date(y,m,d)` local time (đã gây lệch +1 ngày)
src/utils/kmCalculator.js       -- computeLoTrinhKm()/computeDoanLeKm() — nguồn DUY NHẤT tính km_snapshot khi lưu record
src/utils/statsUtils.js         -- hàm thuần tính dashboard: groupByMonth/groupByYear/groupByLoaiTuyen/groupByLuuTru — áp toàn bộ quy tắc dữ liệu bên dưới
src/utils/chartHelpers.js       -- palette PAL/YC, plugin vẽ label lên Chart.js (lp/dpLp), màu grid/tick cho theme sáng
src/components/                 -- modal.js, pagination.js, table.js, badge.js, toast.js — UI dùng chung, không chứa business logic
src/modules/auth.js             -- login/logout (Google OAuth + email/mật khẩu), tính CAN_EDIT/IS_ADMIN từ bảng `app_users`, toggle class `view-only` trên `<body>`
src/modules/dashboard.js        -- load toàn bộ records 1 lần, tính stats qua statsUtils, render 6 chart + slicer năm
src/modules/records.js          -- tab "Tổng hợp dữ liệu": filter/search/pagination + modal thêm/sửa với toggle loại nhập (lộ trình dựng sẵn / đoạn lẻ động)
src/modules/adminUsers.js       -- tab "⚙️ Quản lý" (chỉ admin thấy): danh sách user + đổi vai trò/thu quyền qua usersApi
```
**Nguyên tắc module hóa**: mỗi module/component chỉ export hàm, không đụng DOM của module khác ngoài phạm vi được giao. Thêm tính năng mới = thêm file mới đúng tầng (api/utils/components/modules), tránh nhồi logic nghiệp vụ vào `components/`.

## Cơ chế phân quyền — bảng `app_users` (role: none/editor/admin)
Đăng nhập được bằng Google OAuth HOẶC email/mật khẩu (`auth.js`, chỉ `signInWithPassword` — KHÔNG có form đăng ký công khai). Mỗi tài khoản có đúng 1 dòng trong bảng `app_users` (tự tạo qua trigger `on_auth_user_created` khi tài khoản mới được tạo, mặc định `role='none'`). `auth.js` sau khi đăng nhập luôn `select role from app_users` để tính `CAN_EDIT`/`IS_ADMIN` — KHÔNG còn whitelist hardcode trong code.

- `role='admin'`: thấy thêm tab "⚙️ Quản lý" (`adminUsers.js`) — đổi vai trò/thu quyền qua `usersApi.updateUserRole`/`revokeUser`, và **tạo tài khoản email/mật khẩu mới cho người khác** ngay trong tab này (không có đăng ký công khai). Việc tạo tài khoản dùng 1 client Supabase "tạm" riêng (`supabaseClient.createScratchClient()`, `persistSession:false`) để không ghi đè/đăng xuất phiên admin đang đăng nhập — xem `adminUsers.createUserAsAdmin`. Đây là kỹ thuật bắt buộc vì site tĩnh không có service role key để tạo user kiểu admin API thật.
- `role='editor'`/`'admin'`: thấy nút thêm/sửa/copy/xóa (`view-edit-only` + bỏ class `view-only` trên `<body>`).
- `role='none'` (mặc định): chỉ xem.

**Bảo mật thật nằm ở RLS**, KHÔNG phải UI: policy ghi trên `ttcq_records`/`ttcq_records_doan_le` dùng hàm `public.can_edit()` (security definer, tra `app_users`); policy sửa `app_users.role` dùng `public.is_admin()`. Nếu sửa/thêm bảng dữ liệu mới có thao tác ghi, PHẢI thêm policy dùng `can_edit()` tương tự — ẩn nút ở UI mà quên RLS thì ai đăng nhập cũng gọi thẳng API ghi được (đã từng gặp bug này với `ttcq_records_doan_le`).

## Quy tắc dữ liệu quan trọng — KHÔNG được vi phạm
- `doan_tuyen.km` là NGUỒN SỰ THẬT DUY NHẤT về km từng đoạn ngắn. Không lưu km lộ trình dài tay — luôn tính qua `v_lo_trinh_km` (xem `kmCalculator.js`).
- Khi ghi `ttcq_records` mới: PHẢI snapshot km vào cột `km_snapshot` tại thời điểm ghi (đã làm trong `recordsApi.js`), KHÔNG JOIN sống với `v_lo_trinh_km`/`doan_tuyen` khi hiển thị lịch sử — dữ liệu lịch sử không được thay đổi khi km chuẩn của 1 đoạn được cập nhật sau này.
- Số chuyến = số NGÀY có đi (dedup theo ngày, xem `statsUtils.groupByMonth`), KHÔNG đếm theo số dòng/số đoạn trong ngày đó.
- Ngày tháng: PHẢI qua `src/utils/dateUtils.js` (dùng `Date.UTC(...)`), KHÔNG tự viết `new Date(yr, mon, day)` ở nơi khác (đã từng gây lỗi lệch +1 ngày do timezone).
- `loai_nhap` ('lo_trinh' | 'doan_le') loại trừ lẫn nhau — 1 record chỉ dùng 1 trong 2 luồng. Khi sửa record, `recordsApi.updateRecord` luôn xóa hết `ttcq_records_doan_le` cũ rồi ghi lại theo `loai_nhap` mới (không diff từng dòng).
- Phân loại "loại tuyến" (dùng cho chart phân tích) cho record `lo_trinh` LUÔN là `'ĐHCM'`; record `doan_le` lấy theo `loai_tuyen` của từng đoạn đã chọn (xem `statsUtils.groupByLoaiTuyen`) — đây là quy tắc suy luận lại khi migrate từ RPC cũ `get_loai_stats` (đã bỏ), **cần đối chiếu số liệu thực tế nếu thấy sai** và sửa lại đúng 1 chỗ này.

## UI/UX Design System (Tailwind CSS)
- Tailwind qua CDN, không viết CSS tùy chỉnh trừ phần bắt buộc đã liệt kê ở mục Stack.
- Bảng màu: nền chính `bg-slate-50`; card `bg-white rounded-xl shadow-sm border border-slate-200 p-5`/`p-6`; nhấn chính `bg-indigo-600` (nút, active state); trạng thái `emerald` (success), `amber` (warning), `red` (error); text chính `text-slate-900`, text phụ `text-slate-500`/`text-slate-400`.
- Typography: tiêu đề trang `text-2xl font-semibold`/`font-extrabold`; tiêu đề card `text-sm font-bold`; số liệu KPI `font-mono text-2xl font-bold tabular-nums`.
- Component pattern dùng lại (KHÔNG tự sáng tạo mới): nút chính `bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm`; nút phụ `bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200`; input/select `border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500`; badge `rounded-full px-2.5 py-0.5 text-xs font-medium bg-{color}-100 text-{color}-700` (xem `components/badge.js`); table header `bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500`.
- Không dùng gradient màu mè, không bo góc quá lớn (không quá `rounded-2xl`), không box-shadow đậm (chỉ `shadow-sm`/`shadow-2xl` cho modal).
- Icon hiện tại vẫn là emoji (📊, 🗂️, ✏️...) — CHƯA đổi sang Lucide, không tự ý đổi trừ khi được yêu cầu rõ.

## Quy tắc làm việc (BẮT BUỘC)
- Khi sửa 1 tính năng, CHỈ sửa file/hàm liên quan trực tiếp đến yêu cầu, đúng tầng module đã định nghĩa ở trên. KHÔNG tự ý refactor code không liên quan dù thấy chưa tối ưu.
- Nếu 1 thay đổi cần đụng vào hơn 2 file, PHẢI giải thích ngắn gọn kế hoạch và hỏi xác nhận trước khi sửa.
- Sau khi hoàn thành 1 tính năng/module lớn, tự cập nhật phần "Decision Log" trong `ARCHITECTURE.md`.
- Không tạo file/thư mục mới ngoài cấu trúc đã định nghĩa ở trên, trừ khi được yêu cầu rõ.

## Trước khi báo cáo hoàn thành 1 task
- Tự kiểm tra bằng cách chạy local server (`py -m http.server` hoặc `npx serve .`), mô tả lại (bằng lời) đã test được gì.
- Nếu không tự test được (cần đăng nhập Google thật, cần tương tác UI phức tạp), nói rõ để người dùng tự test tay.
