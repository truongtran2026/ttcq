// Hàm thuần: nhận records (đã kèm ttcq_records_doan_le.doan_tuyen) + refData, trả về số liệu dashboard.
// Quy tắc bắt buộc (xem CLAUDE.md "Quy tắc dữ liệu quan trọng"):
//  - "Số chuyến" = số NGÀY duy nhất có ghi nhận (dedup theo `ngay`), KHÔNG phải số dòng.
//  - Tổng km = SUM(km_snapshot) trực tiếp, không tính lại từ doan_tuyen/lo_trinh.

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

function monthKey(ngay) { return ngay.slice(0, 7); } // 'YYYY-MM'
function yearOf(ngay) { return ngay.slice(0, 4); }
function monthOf(ngay) { return +ngay.slice(5, 7); }

export function groupByMonth(records) {
  const byKey = new Map();
  records.forEach(r => {
    const key = monthKey(r.ngay);
    if (!byKey.has(key)) byKey.set(key, { nam: yearOf(r.ngay), thang_so: monthOf(r.ngay), tong_km: 0, days: new Set() });
    const g = byKey.get(key);
    g.tong_km += parseFloat(r.km_snapshot) || 0;
    g.days.add(r.ngay);
  });
  return [...byKey.values()]
    .map(g => ({ nam: g.nam, thang_so: g.thang_so, tong_km: g.tong_km, so_chuyen: g.days.size }))
    .sort((a, b) => a.nam - b.nam || a.thang_so - b.thang_so);
}

export function groupByYear(months) {
  const byYear = {};
  months.forEach(m => {
    if (!byYear[m.nam]) byYear[m.nam] = { km: 0, chuyen: 0, nThang: 0 };
    byYear[m.nam].km += m.tong_km;
    byYear[m.nam].chuyen += m.so_chuyen;
    byYear[m.nam].nThang += 1;
  });
  return byYear;
}

export function topMonths(months, n = 5) {
  return [...months].sort((a, b) => b.tong_km - a.tong_km).slice(0, n);
}

// lo_trinh -> luôn bucket 'ĐHCM'; doan_le -> mỗi loai_tuyen khác nhau xuất hiện trong record (dedup trong cùng record) +1.
export function groupByLoaiTuyen(records) {
  const counts = new Map();
  const bump = (loai) => counts.set(loai, (counts.get(loai) || 0) + 1);
  records.forEach(r => {
    if (r.loai_nhap === 'lo_trinh') { bump('ĐHCM'); return; }
    const loaiSet = new Set((r.ttcq_records_doan_le || []).map(d => d.doan_tuyen?.loai_tuyen).filter(Boolean));
    loaiSet.forEach(bump);
  });
  return [...counts.entries()].map(([loai_tuyen, so_chuyen]) => ({ loai_tuyen, so_chuyen }));
}

export function groupByLuuTru(records) {
  const rows = [];
  records.forEach(r => {
    if (!r.lu_tru) return;
    rows.push({ nam: yearOf(r.ngay), dia_diem: r.lu_tru, so_ngay: 1 });
  });
  const byKey = new Map();
  rows.forEach(r => {
    const key = r.nam + '|' + r.dia_diem;
    byKey.set(key, (byKey.get(key) || 0) + r.so_ngay);
  });
  return [...byKey.entries()].map(([key, so_ngay]) => {
    const [nam, dia_diem] = key.split('|');
    return { nam, dia_diem, so_ngay };
  });
}

export const MONTHS_LABEL = MONTH_LABELS;
