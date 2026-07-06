import { listRecords, createRecord, updateRecord, deleteRecord, duplicateRecord } from '../api/recordsApi.js';
import { getRefData, tenDoanTuyen } from '../api/refDataApi.js';
import { computeLoTrinhKm, computeDoanLeKm } from '../utils/kmCalculator.js';
import { toIso, toVi, presetRange, monthRangeOfIso } from '../utils/dateUtils.js';
import { fmt } from '../utils/format.js';
import { renderRecordsTable, renderRecordsCards } from '../components/table.js';
import { renderPager } from '../components/pagination.js';
import { openOverlay, closeOverlay, wireOverlayBackdropClose } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getCanEdit } from './auth.js';

let sb = null;
let onDataChanged = () => {};
let ROWS = [], FILTERED = [];
let CUR_PAGE = 1, PG_SIZE = 20;
let dupId = null, delId = null;
let loaded = false;

export function initRecords(supabaseClient, onChange) {
  sb = supabaseClient;
  onDataChanged = onChange || (() => {});
  wireDom();
}

export async function activateRecordsTab() {
  buildFormDropdowns();
  if (!loaded) {
    loaded = true;
    await loadDefaultRange();
  }
  await fetchRows();
}

async function loadDefaultRange() {
  const { data } = await sb.from('ttcq_records').select('ngay').order('ngay', { ascending: false }).limit(1);
  if (data && data[0]) {
    const { from, to } = monthRangeOfIso(data[0].ngay);
    document.getElementById('nlFrom').value = from;
    document.getElementById('nlTo').value = to;
  }
}

function wireDom() {
  document.getElementById('nlSearch').addEventListener('input', () => { CUR_PAGE = 1; filterTable(); });
  document.getElementById('nlFrom').addEventListener('change', fetchRows);
  document.getElementById('nlTo').addEventListener('change', fetchRows);
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => setPreset(btn.dataset.preset));
  });
  document.getElementById('btnAdd').addEventListener('click', () => openModal('add'));
  document.getElementById('pgSel').addEventListener('change', (e) => { PG_SIZE = parseInt(e.target.value) || 0; CUR_PAGE = 1; renderTable(); });

  document.getElementById('toggleLoTrinh').addEventListener('click', () => setLoaiNhap('lo_trinh'));
  document.getElementById('toggleDoanLe').addEventListener('click', () => setLoaiNhap('doan_le'));
  document.getElementById('fLoTrinh').addEventListener('change', calcPrev);
  document.getElementById('btnAddDoan').addEventListener('click', () => { addDoanRow(); calcPrev(); });
  document.getElementById('doanLeRows').addEventListener('change', calcPrev);
  document.getElementById('doanLeRows').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove-row]');
    if (btn) { btn.closest('.doan-row').remove(); calcPrev(); }
  });
  document.getElementById('btnSave').addEventListener('click', saveRecord);
  document.querySelectorAll('[data-close="modalOv"]').forEach(b => b.addEventListener('click', closeModal));
  wireOverlayBackdropClose('modalOv');

  document.querySelectorAll('[data-close="copyOv"]').forEach(b => b.addEventListener('click', closeCopyModal));
  wireOverlayBackdropClose('copyOv');
  document.getElementById('btnConfirmCopy').addEventListener('click', confirmCopy);

  document.querySelectorAll('[data-close="delOv"]').forEach(b => b.addEventListener('click', closeDelModal));
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);
}

function buildFormDropdowns() {
  const rd = getRefData();
  const lodSel = document.getElementById('fLoTrinh');
  lodSel.innerHTML = '<option value="">— Không chọn —</option>' +
    rd.loTrinh.map(t => `<option value="${t.id}">${t.ten_lo_trinh}</option>`).join('');
  const ltSel = document.getElementById('fLuTru');
  ltSel.innerHTML = '<option value="">-- Không lưu trú --</option>' +
    rd.luTruList.map(l => `<option value="${l}">${l}</option>`).join('');
}

function doanOptionsHtml(selectedId) {
  const rd = getRefData();
  return '<option value="">-- Chọn đoạn --</option>' +
    rd.doanTuyen.map(d => `<option value="${d.id}" ${String(d.id) === String(selectedId) ? 'selected' : ''}>${tenDoanTuyen(d.id)} (${d.km} km)</option>`).join('');
}

function addDoanRow(selectedId = '') {
  const wrap = document.createElement('div');
  wrap.className = 'doan-row flex gap-2 items-center mb-2';
  wrap.innerHTML = `<select class="fsel flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none">${doanOptionsHtml(selectedId)}</select>
    <button type="button" class="bg-red-50 text-red-600 border-none px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer" data-remove-row>✕</button>`;
  document.getElementById('doanLeRows').appendChild(wrap);
}

function setLoaiNhap(type) {
  document.getElementById('fLoaiNhap').value = type;
  document.getElementById('toggleLoTrinh').classList.toggle('on', type === 'lo_trinh');
  document.getElementById('toggleDoanLe').classList.toggle('on', type === 'doan_le');
  document.getElementById('sectionLoTrinh').style.display = type === 'lo_trinh' ? '' : 'none';
  document.getElementById('sectionDoanLe').style.display = type === 'doan_le' ? '' : 'none';
  calcPrev();
}

function selectedDoanTuyenIds() {
  return [...document.querySelectorAll('#doanLeRows select')].map(s => s.value).filter(Boolean);
}

function calcPrev() {
  const type = document.getElementById('fLoaiNhap').value;
  const km = type === 'lo_trinh'
    ? computeLoTrinhKm(document.getElementById('fLoTrinh').value)
    : computeDoanLeKm(selectedDoanTuyenIds());
  document.getElementById('kmPrev').textContent = km.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' km';
}

// ── Fetch & render bảng ──────────────────────────────────────────
async function fetchRows() {
  const from = document.getElementById('nlFrom').value;
  const to = document.getElementById('nlTo').value;
  try {
    ROWS = await listRecords(sb, { from, to });
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'err');
    return;
  }
  document.getElementById('stDong').textContent = ROWS.length + ' dòng';
  const km = ROWS.reduce((s, r) => s + (parseFloat(r.km_snapshot) || 0), 0);
  document.getElementById('stKm').textContent = fmt(km, 1) + ' km';
  filterTable();
}

function filterTable() {
  const q = (document.getElementById('nlSearch').value || '').toLowerCase();
  FILTERED = ROWS.filter(r => {
    if (!q) return true;
    const detail = r.loai_nhap === 'lo_trinh'
      ? (getRefData().loTrinhMap.get(r.lo_trinh_id)?.ten_lo_trinh || '')
      : (r.ttcq_records_doan_le || []).map(d => tenDoanTuyen(d.doan_tuyen_id)).join(' ');
    return (r.ngay + ' ' + detail + ' ' + (r.lu_tru || '') + ' ' + (r.ghi_chu || '')).toLowerCase().includes(q);
  });
  CUR_PAGE = 1;
  renderTable();
}

function renderTable() {
  const eff = PG_SIZE === 0 ? FILTERED.length : PG_SIZE;
  const total = FILTERED.length, pages = Math.ceil(total / eff) || 1;
  if (CUR_PAGE > pages) CUR_PAGE = pages;
  const start = (CUR_PAGE - 1) * eff;
  const pageRows = FILTERED.slice(start, start + eff);
  document.getElementById('pgInfo').textContent = `${total === 0 ? 0 : start + 1}–${Math.min(start + eff, total)} / ${total} dòng`;
  const handlers = {
    onEdit: (id) => openModal('edit', id),
    onDup: (id, ngay) => doDup(id, ngay),
    onDel: (id, ngay) => askDel(id, ngay),
  };
  renderRecordsTable(document.getElementById('dtblBody'), pageRows, getRefData(), handlers);
  renderRecordsCards(document.getElementById('dtblCards'), pageRows, getRefData(), handlers);
  renderPager(document.getElementById('pgBtns'), { page: CUR_PAGE, pages, onChange: (p) => { CUR_PAGE = p; renderTable(); } });
}

function setPreset(type) {
  const { from, to } = presetRange(type);
  document.getElementById('nlFrom').value = from;
  document.getElementById('nlTo').value = to;
  fetchRows();
}

// ── CRUD modal ─────────────────────────────────────────────────
function openModal(mode, id = null) {
  resetForm();
  document.getElementById('modalTitle').innerHTML = mode === 'add' ? '📝 Thêm chuyến <span>mới</span>' : '✏️ Chỉnh sửa <span>dữ liệu</span>';
  document.getElementById('fId').value = id || '';
  if (mode === 'edit') {
    const r = ROWS.find(x => x.id == id);
    if (r) fillForm(r);
  }
  openOverlay('modalOv');
}

function closeModal() { closeOverlay('modalOv'); }

function resetForm() {
  document.getElementById('fNgay').value = toIso(new Date());
  document.getElementById('fLoTrinh').value = '';
  document.getElementById('fLuTru').value = '';
  document.getElementById('fGhiChu').value = '';
  document.getElementById('doanLeRows').innerHTML = '';
  addDoanRow();
  setLoaiNhap('lo_trinh');
}

function fillForm(r) {
  document.getElementById('fNgay').value = r.ngay ? r.ngay.split('T')[0] : '';
  document.getElementById('fLuTru').value = r.lu_tru || '';
  document.getElementById('fGhiChu').value = r.ghi_chu || '';
  if (r.loai_nhap === 'lo_trinh') {
    document.getElementById('fLoTrinh').value = r.lo_trinh_id || '';
    setLoaiNhap('lo_trinh');
  } else {
    document.getElementById('doanLeRows').innerHTML = '';
    const doans = r.ttcq_records_doan_le || [];
    if (doans.length) doans.forEach(d => addDoanRow(d.doan_tuyen_id));
    else addDoanRow();
    setLoaiNhap('doan_le');
  }
}

async function saveRecord() {
  if (!getCanEdit()) { showToast('Bạn không có quyền chỉnh sửa', 'err'); return; }
  const ngay = document.getElementById('fNgay').value;
  if (!ngay) { showToast('Vui lòng nhập ngày!', 'err'); return; }
  const loaiNhap = document.getElementById('fLoaiNhap').value;
  const loTrinhId = document.getElementById('fLoTrinh').value || null;
  const doanIds = selectedDoanTuyenIds();

  if (loaiNhap === 'lo_trinh' && !loTrinhId) { showToast('Vui lòng chọn lộ trình!', 'err'); return; }
  if (loaiNhap === 'doan_le' && !doanIds.length) { showToast('Cần chọn ít nhất 1 đoạn!', 'err'); return; }

  const payload = {
    ngay,
    loai_nhap: loaiNhap,
    lo_trinh_id: loaiNhap === 'lo_trinh' ? +loTrinhId : null,
    km_snapshot: loaiNhap === 'lo_trinh' ? computeLoTrinhKm(loTrinhId) : computeDoanLeKm(doanIds),
    doan_tuyen_ids: doanIds.map(Number),
    lu_tru: document.getElementById('fLuTru').value || null,
    ghi_chu: document.getElementById('fGhiChu').value || null,
  };

  const id = document.getElementById('fId').value;
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Đang lưu...';
  try {
    if (id) await updateRecord(sb, id, payload); else await createRecord(sb, payload);
    showToast(id ? 'Đã cập nhật ✓' : 'Đã thêm thành công ✓');
    closeModal();
    await fetchRows();
    await onDataChanged();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Lưu';
  }
}

// ── Copy ───────────────────────────────────────────────────────
function doDup(id, ngay) {
  dupId = id;
  document.getElementById('copySrc').textContent = 'Sao chép từ ngày ' + toVi(ngay);
  document.getElementById('copyDate').value = toIso(new Date());
  openOverlay('copyOv');
}

function closeCopyModal() { closeOverlay('copyOv'); dupId = null; }

async function confirmCopy() {
  const srcId = dupId;
  if (!srcId) { showToast('Không xác định được nguồn', 'err'); return; }
  const nd = document.getElementById('copyDate').value;
  if (!nd) { showToast('Vui lòng chọn ngày mới!', 'err'); return; }
  closeCopyModal();
  if (!getCanEdit()) { showToast('Bạn không có quyền', 'err'); return; }
  try {
    await duplicateRecord(sb, srcId, nd);
    showToast('Đã sao chép sang ' + toVi(nd) + ' ✓');
    await fetchRows();
    await onDataChanged();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'err');
  }
}

// ── Xóa ────────────────────────────────────────────────────────
function askDel(id, ngay) {
  delId = id;
  document.getElementById('delMsg').textContent = `Xóa dòng ngày ${toVi(ngay)}? Không thể hoàn tác.`;
  document.getElementById('delOv').classList.add('open');
}

function closeDelModal() { document.getElementById('delOv').classList.remove('open'); delId = null; }

async function confirmDelete() {
  const id = delId;
  closeDelModal();
  if (!id) { showToast('Không xác định dòng', 'err'); return; }
  if (!getCanEdit()) { showToast('Bạn không có quyền', 'err'); return; }
  try {
    await deleteRecord(sb, id);
    showToast('Đã xóa thành công ✓');
    await fetchRows();
    await onDataChanged();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'err');
  }
}
