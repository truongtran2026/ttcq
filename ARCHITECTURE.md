# ARCHITECTURE.md — TTCQ (Tuần Tra Cáp Quang)

## 1. Tổng quan hệ thống

```
GitHub Pages (Static HTML/JS)  <-->  Supabase (PostgreSQL + Auth + RLS)
                                          |
                                     Webhook sync
                                          |
                                   Google Sheets (backup/xem nhanh)
```

- **Hosting**: GitHub Pages — static, miễn phí, deploy qua `git push`
- **Database**: Supabase (PostgreSQL) — RLS bật, Auth qua Google OAuth
- **Đồng bộ**: Webhook Supabase → Apps Script ghi lại vào Google Sheets (đang fix `buildRow`)

## 2. Mô hình dữ liệu (Graph Model) — ĐÃ TRIỂN KHAI, ĐÃ XÁC MINH 100%

Toàn bộ schema dưới đây đã chạy thật trên Supabase, đối chiếu khớp 100% với dữ liệu gốc (16 đoạn, 11 lộ trình, 209 bản ghi ttcq_records).

```
diem (15 dong)
  id, ten_diem

doan_tuyen (16 dong — NGUON SU THAT DUY NHAT ve km)
  id, diem_dau_id, diem_cuoi_id, km, loai_tuyen
  -- Canh HAI CHIEU (A-B = B-A ve km). Cho phep self-loop
  -- (diem_dau_id = diem_cuoi_id) cho truong hop "Noi thi" (id=16, tai diem 2T9)

lo_trinh (11 dong)
  id, ten_lo_trinh, doan_ids[]  -- mang tham chieu doan_tuyen.id THEO THU TU,
                                  -- CHO PHEP LAP (vd [10,10] = di roi ve cung 1 canh)

v_lo_trinh_km (VIEW)
  -- Tinh SUM(km) tu doan_ids bang unnest() + JOIN (KHONG dung WHERE id = ANY(...))
  -- Ly do bat buoc dung unnest(): ANY() loc theo SET semantics, khong nhan ban
  -- phan tu lap trong mang -> lo trinh "di roi ve" se bi tinh thieu mot nua km.
  -- unnest() chuyen moi phan tu mang thanh 1 dong rieng (BAG semantics) truoc
  -- khi JOIN, dam bao canh lap lai duoc cong dung so lan.

v_doan_tuyen_ten (VIEW ho tro)
  -- Sinh ten dang "DiemA-DiemB" ca 2 chieu (ten_thuan, ten_nguoc) tu diem
  -- Dung de doi chieu voi du lieu TEXT cu (lod_trinh, tuyen1-4) khi migrate

ttcq_records (209 dong — bo sung 3 cot so voi ban goc)
  ..., loai_nhap TEXT CHECK IN ('lo_trinh','doan_le'), lo_trinh_id INT, km_snapshot NUMERIC
  -- loai_nhap: discriminator column, co index rieng — 2 luong nhap lieu
  --   LOAI TRU LAN NHAU (chi dung 1 trong 2 moi ngay):
  --   'lo_trinh' = chon lo trinh dung san (dai, nhieu chang)
  --   'doan_le'  = chon tung doan ngan rieng (qua bang con ben duoi)
  -- km_snapshot: DONG BANG km tai thoi diem ghi, KHONG JOIN song voi view
  --   Ly do: neu sau nay sua km chuan 1 doan, chuyen di lich su KHONG bi doi theo
  --   (nguyen tac point-in-time correctness)

ttcq_records_doan_le (bang con — chuan hoa 1NF thay the 4 cot tuyen1-4 cu)
  id, record_id -> ttcq_records.id (CASCADE), doan_tuyen_id -> doan_tuyen.id, thu_tu
  UNIQUE (record_id, thu_tu)
  -- Uu diem so voi 4 cot wide: khong gioi han so doan/ngay, JOIN 1 lan thay vi
  -- lap lai 4 lan, them/xoa 1 doan doc lap khong dung cham dong cha
```

**Trường hợp đặc biệt đã xử lý (xác nhận cùng người dùng ngày 05-06/07/2026):**
- Lộ trình `PSN-LXO-PSN-ĐNG` (203km, id=7) → sửa path đúng thành `PSN-LXO-PSN-TMY-ĐNG` (đi qua TMY: 35+35+61+72=203), không cần thêm cạnh mới. 2 bản ghi lịch sử dùng tên gốc được map riêng qua `lo_trinh_id=7`.
- Đoạn "Nội thị" (41km, id=16 trong `doan_tuyen`) → self-loop tại điểm `2T9` (đi vòng trong thành phố), vẫn nằm trong graph model thống nhất, không cần bảng ngoại lệ riêng.

**Bảng cũ (giữ song song làm backup/rollback, theo nguyên tắc expand-contract migration):**
`tuyen_list`, `lod_trinh_list`, `lu_tru_list` — KHÔNG xóa cho đến khi xác nhận toàn bộ ứng dụng đã chuyển hẳn sang schema mới và chạy ổn định qua ít nhất 1-2 chu kỳ nhập liệu thực tế.

## 2b. Phân quyền người dùng — bảng `app_users` (thay whitelist hardcode)

```
app_users (1 dong / tai khoan auth.users)
  user_id uuid PK -> auth.users.id (CASCADE), email text, role text CHECK IN ('none','editor','admin'), created_at
  -- Tu dong co dong khi dang ky lan dau (trigger on_auth_user_created tren auth.users), mac dinh role='none'

is_admin() / can_edit()  -- 2 ham SQL security definer, tra app_users theo auth.uid(), dung trong moi RLS policy
                            can_edit() ap cho policy ghi tren ttcq_records va ttcq_records_doan_le (thay auth.email()=... hardcode)
                            is_admin() ap cho policy sua app_users.role
```
Đăng nhập hỗ trợ cả Google OAuth lẫn email/mật khẩu (Supabase Auth built-in `signUp`/`signInWithPassword`). Cấp/thu quyền `editor`/`admin` làm ngay trong tab "⚙️ Quản lý" (chỉ admin thấy) — không cần sửa code/deploy lại nữa. Admin đầu tiên phải gán bằng 1 câu `UPDATE app_users SET role='admin' WHERE email=...` chạy tay 1 lần duy nhất sau khi tài khoản đó đã đăng nhập ít nhất 1 lần.

## 3. Index hiệu năng

```sql
idx_ttcq_records_ngay          -- filter theo ngay/thang/nam
idx_ttcq_records_created_at    -- sort theo thoi gian tao, phuc vu sync
idx_ttcq_records_ngay_loai     -- composite, filter nam + loai tuyen cung luc
```

## 4. UI/UX Design System

Xem chi tiết trong `CLAUDE.md` phần "UI/UX Design System". Tóm tắt: Tailwind CSS qua CDN, tông màu slate/indigo, component pattern cố định (card, button, table, badge), icon Lucide.

## 5. Cấu trúc module code — ĐÃ TRIỂN KHAI (2026-07-06)

```
index.html                     -- markup Tailwind CDN, chỉ 1 <script type="module" src="./app.js">
app.js                          -- CHI import + khoi tao, khong chua logic
src/config.js                   -- SUPABASE_URL/ANON, EDIT_ALLOWED
src/api/
  supabaseClient.js              -- khoi tao ket noi, CHI 1 noi duy nhat
  refDataApi.js                  -- diem/doan_tuyen/lo_trinh/v_lo_trinh_km/v_doan_tuyen_ten/lu_tru_list (cache)
  recordsApi.js                  -- CRUD ttcq_records + ttcq_records_doan_le
src/utils/
  format.js, dateUtils.js        -- xu ly UTC (tranh loi +1 ngay da gap truoc day)
  kmCalculator.js                -- tinh km_snapshot khi ghi record moi
  statsUtils.js                  -- tinh thong ke dashboard phia client (thay v_thong_ke_*/get_loai_stats cu)
  chartHelpers.js                -- palette + plugin label Chart.js
src/components/
  table.js, modal.js, pagination.js, badge.js, toast.js
src/modules/
  auth.js, dashboard.js, records.js
CLAUDE.md
ARCHITECTURE.md
```
KHÔNG bọc thêm thư mục `/ttcq-app` như bản vẽ trước đây — `index.html` phải nằm ở repo root để GitHub Pages phục vụ được.

**Nguyên tắc module hóa:**
- Mỗi module chỉ export hàm, không truy cập trực tiếp biến/DOM của module khác
- Giao tiếp giữa module qua callback hoặc custom event
- Thêm tính năng mới = thêm file mới đúng tầng (api/utils/components/modules), không nhồi logic nghiệp vụ vào `components/`

## 6. Các quyết định đã chốt (Decision Log)

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-07-05 | Chuyển 2 bảng rời sang graph model | Tránh trùng lặp km, tự động tính lộ trình dài |
| 2026-07-05 | km_snapshot lưu cứng, không JOIN sống | Bảo toàn dữ liệu lịch sử khi km chuẩn thay đổi |
| 2026-07-05 | Giữ nguyên Supabase + GitHub Pages | Không phải nguyên nhân gây chậm/tốn token trước đây |
| 2026-07-05 | "Nội thị" xử lý như self-loop tại 2T9 | Giữ thống nhất trong graph, không cần bảng ngoại lệ |
| 2026-07-06 | Sửa view `v_lo_trinh_km` dùng `unnest()` thay vì `WHERE id = ANY(...)` | ANY() lọc theo set semantics, không nhân bản phần tử lặp trong mảng — gây tính thiếu km cho lộ trình "đi rồi về" |
| 2026-07-06 | Thêm cột `loai_nhap` (discriminator) + bảng con `ttcq_records_doan_le` thay 4 cột `tuyen1-4` | 2 luồng nhập liệu loại trừ lẫn nhau; cần tách để filter/JOIN nhanh, tránh giới hạn cứng 4 tuyến/ngày |
| 2026-07-06 | Migration dữ liệu thật hoàn tất: 209/209 bản ghi map đúng `lo_trinh_id`/`doan_le`, `km_snapshot` không còn NULL | Xác minh qua truy vấn kiểm tra, 0 dòng lỗi |
| 2026-07-06 | Frontend module hóa (ES Modules native) + đổi CSS sang Tailwind CDN + chuyển hẳn sang đọc/ghi schema graph model mới | `index.html` trước đó vẫn 1 file monolith, dark-theme tự viết, còn query schema cũ (`tuyen_list`, `lod_trinh_list`, `v_thong_ke_*`, `get_loai_stats`) dù DB đã migrate xong từ 2026-07-05/06 |
| 2026-07-06 | Bỏ `v_thong_ke_thang`/`v_thong_ke_nam`/`v_lu_tru_nam`/`get_loai_stats` phía frontend, tự tính thống kê client-side trong `src/utils/statsUtils.js` | Dữ liệu quá nhỏ (~209 dòng) để cần view SQL; tự kiểm soát đúng quy tắc dedup-theo-ngày/km_snapshot mà không phụ thuộc view có thể chưa cập nhật theo schema mới. Bảng/view cũ vẫn giữ nguyên ở Supabase, chỉ ngừng gọi từ frontend |
| 2026-07-06 | Phân loại "loại tuyến": tra `loai_tuyen` của TỪNG ĐOẠN cấu thành chuyến đi (dedup trong record) — áp dụng như nhau cho `lo_trinh` (qua `lo_trinh.doan_ids`) và `doan_le`, KHÔNG gán cứng `'ĐHCM'` cho lo_trinh nữa | Bản đầu gán cứng ĐHCM cho lo_trinh sai theo phản hồi thực tế (thiếu Nội thị/đường biển) — sửa tại `statsUtils.groupByLoaiTuyen` |
| 2026-07-06 | Thêm PWA (`manifest.json` + icon), KHÔNG dùng Service Worker; bảng dữ liệu thêm chế độ card cho mobile (`renderRecordsCards`) | Cho phép "Thêm vào màn hình chính"; Service Worker cấu hình sai sẽ làm nặng thêm vấn đề cache trình duyệt vừa gặp; bảng 7 cột không dùng được trên điện thoại |
| 2026-07-07 | Sửa `refDataApi` đọc đúng cột `km_tong` của `v_lo_trinh_km` (trước đó code giả định nhầm là `tong_km`) | Xác nhận qua dữ liệu thật do người dùng cung cấp; các bản ghi lo_trinh tạo trong lúc bug còn tồn tại cần tự sửa lại (mở Sửa rồi Lưu, hoặc chạy UPDATE quét theo km_snapshot=0) |
| 2026-07-07 | Bỏ whitelist `EDIT_ALLOWED` hardcode, chuyển sang bảng `app_users` (role none/editor/admin) quản lý qua tab "⚙️ Quản lý"; thêm đăng nhập email/mật khẩu song song Google OAuth | Người dùng muốn tự cấp/thu quyền qua UI, không sửa code mỗi lần đổi người; xem chi tiết schema mục 2b |
| 2026-07-07 | Bỏ form "Đăng ký" công khai; chỉ admin tạo được tài khoản email/mật khẩu (trong tab Quản lý, dùng client Supabase tạm `persistSession:false` để không đè phiên admin) | Chỉ 1 người quản trị, không cần ai tự đăng ký; tránh lộ khả năng tạo tài khoản tùy ý cho người lạ |
| 2026-07-07 | Trigger `on_auth_user_created` KHÔNG hồi tố cho tài khoản đã tồn tại từ trước (chỉ chạy khi có INSERT mới vào auth.users) | Phát hiện khi tài khoản admin gốc (đã dùng từ đầu dự án) không tự có dòng trong `app_users` — phải tự `insert ... select ... from auth.users` bổ sung thủ công 1 lần |
| 2026-07-07 | Cho phép đăng nhập bằng "tên đăng nhập" thường (không cần định dạng email) — tự ghép `@ttcq.local` phía dưới qua `utils/identity.js` nếu input không có "@" | Supabase Auth built-in luôn cần 1 địa chỉ dạng email làm định danh; đây là cách phổ biến để có "username" mà không cần backend riêng |
