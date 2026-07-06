// Mọi tính toán ngày ở đây dùng Date.UTC(...) khi TẠO Date object, và getUTC*() khi ĐỌC lại —
// tránh lỗi lệch +1 ngày do timezone khi build ISO string (đã từng xảy ra với `new Date(yr, mon, day)`).

export function toIso(d) {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
}

export function toVi(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m, d));
}

// Lấy {y,m,d} theo lịch địa phương của người dùng cho "hôm nay" (đây là ngày thật họ đang sống, không cần quy UTC).
function todayLocalYMD() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}

export function presetRange(type) {
  const { y, m } = todayLocalYMD();
  if (type === 'month') return { from: toIso(utcDate(y, m, 1)), to: toIso(utcDate(y, m + 1, 0)) };
  if (type === 'prev') return { from: toIso(utcDate(y, m - 1, 1)), to: toIso(utcDate(y, m, 0)) };
  if (type === 'year') return { from: toIso(utcDate(y, 0, 1)), to: toIso(utcDate(y, 11, 31)) };
  return { from: '', to: '' };
}

// Khoảng tháng chứa 1 ngày ISO cho trước (dùng khi mở lần đầu, mặc định về tháng của bản ghi mới nhất).
export function monthRangeOfIso(iso) {
  const d = new Date(iso);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return { from: toIso(utcDate(y, m, 1)), to: toIso(utcDate(y, m + 1, 0)) };
}
