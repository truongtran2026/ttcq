export function fmt(n, d = 0) {
  return isNaN(n) ? '—' : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function hexA(h, a) {
  return h + Math.round(a * 255).toString(16).padStart(2, '0');
}
