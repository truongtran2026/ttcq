import { fmt } from '../utils/format.js';
import { toVi } from '../utils/dateUtils.js';
import { tenDoanTuyen } from '../api/refDataApi.js';
import { loaiNhapBadgeHtml } from './badge.js';

function chiTietHtml(r, refData) {
  if (r.loai_nhap === 'lo_trinh') {
    return refData.loTrinhMap.get(r.lo_trinh_id)?.ten_lo_trinh || '—';
  }
  const doans = r.ttcq_records_doan_le || [];
  if (!doans.length) return '—';
  return doans.map(d => tenDoanTuyen(d.doan_tuyen_id)).join(' → ');
}

const ACTION_BTN = 'view-edit-only border-none px-2 py-1 rounded-md text-xs font-semibold cursor-pointer';

export function renderRecordsTable(tbody, rows, refData, handlers) {
  const D = '<span class="text-slate-300">—</span>';
  tbody.innerHTML = rows.map(r => `<tr class="hover:bg-slate-50">
    <td class="px-3 py-2 font-mono text-xs font-medium text-indigo-600 whitespace-nowrap">${toVi(r.ngay)}</td>
    <td class="px-3 py-2">${loaiNhapBadgeHtml(r.loai_nhap)}</td>
    <td class="px-3 py-2 text-sm text-slate-500 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap" title="${chiTietHtml(r, refData)}">${chiTietHtml(r, refData)}</td>
    <td class="px-3 py-2 font-mono text-xs text-amber-600">${r.km_snapshot ? fmt(+r.km_snapshot, 1) : D}</td>
    <td class="px-3 py-2 text-sm text-slate-500">${r.lu_tru || ''}</td>
    <td class="px-3 py-2 text-xs text-slate-400 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap" title="${r.ghi_chu || ''}">${r.ghi_chu || ''}</td>
    <td class="px-3 py-2"><div class="flex gap-1 justify-center">
      <button class="${ACTION_BTN} bg-indigo-50 text-indigo-600" data-id="${r.id}" data-act="edit">✏️</button>
      <button class="${ACTION_BTN} bg-amber-50 text-amber-600"  data-id="${r.id}" data-ngay="${r.ngay}" data-act="dup">⧉</button>
      <button class="${ACTION_BTN} bg-red-50 text-red-600"     data-id="${r.id}" data-ngay="${r.ngay}" data-act="del">🗑</button>
    </div></td></tr>`).join('');

  tbody.onclick = function (e) {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act'), ngay = btn.getAttribute('data-ngay') || '';
    if (act === 'edit') handlers.onEdit(id);
    else if (act === 'dup') handlers.onDup(id, ngay);
    else if (act === 'del') handlers.onDel(id, ngay);
  };
}
