const BADGE_BASE = 'rounded-full px-2.5 py-0.5 text-xs font-medium';

export function authBadgeState(canEdit) {
  return canEdit
    ? { text: '✓ Có quyền chỉnh sửa', className: `${BADGE_BASE} bg-emerald-100 text-emerald-700` }
    : { text: '👁 Chỉ xem', className: `${BADGE_BASE} bg-slate-100 text-slate-500` };
}

// Màu rank cho top-5 tháng nhiều km nhất.
const RANK_CLASSES = [
  'bg-amber-100 text-amber-700',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-700',
];
export function rankClass(i) {
  return `w-5 h-5 rounded-md inline-flex items-center justify-center font-bold text-xs ${RANK_CLASSES[i] || 'bg-slate-100 text-slate-400'}`;
}

export function loaiNhapBadgeHtml(loaiNhap) {
  return loaiNhap === 'lo_trinh'
    ? `<span class="${BADGE_BASE} bg-indigo-100 text-indigo-700">Lộ trình</span>`
    : `<span class="${BADGE_BASE} bg-amber-100 text-amber-700">Đoạn lẻ</span>`;
}
