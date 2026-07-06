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
| 2026-07-06 | Phân loại "loại tuyến" cho record `doan_le`: lấy theo `loai_tuyen` của từng đoạn đã chọn (dedup trong cùng record); record `lo_trinh` luôn `'ĐHCM'` | Suy luận lại khi không có source code RPC `get_loai_stats` cũ — **cần đối chiếu số liệu thực tế**, sửa tại `statsUtils.groupByLoaiTuyen` nếu sai |
