import { listAllRecordsForStats } from '../api/recordsApi.js';
import { getRefData } from '../api/refDataApi.js';
import { groupByMonth, groupByYear, groupByLoaiTuyen, groupByLuuTru, MONTHS_LABEL } from '../utils/statsUtils.js';
import { fmt, hexA, PAL, YC, CHART_GRID, CHART_TICK, lp, dpLp } from '../utils/chartHelpers.js';
import { rankClass } from '../components/badge.js';

let sb = null;
let MONTHS = [], YEARS = {}, LUTRU = [], LOAI_STATS = [];
let charts = {};
let thangType = 'bar', loaiType = 'doughnut';
let selectedYears = new Set();
let presets = [];

export async function initDashboard(supabaseClient) {
  sb = supabaseClient;
  wireDom();
  await reload();
}

export async function reload() {
  const records = await listAllRecordsForStats(sb);
  MONTHS = groupByMonth(records);
  YEARS = groupByYear(MONTHS);
  LUTRU = groupByLuuTru(records);
  LOAI_STATS = groupByLoaiTuyen(records, getRefData());

  const years = [...new Set(MONTHS.map(m => m.nam))].sort();
  const sel = document.getElementById('yearFilter');
  sel.innerHTML = '<option value="all">Tất cả năm</option>';
  years.forEach(y => sel.innerHTML += `<option value="${y}">${y}</option>`);
  buildSlicer(years);
  applyFilter();
}

function wireDom() {
  document.getElementById('yearFilter').addEventListener('change', applyFilter);
  document.getElementById('btnRefresh').addEventListener('click', reload);
  document.getElementById('tb-bar').addEventListener('click', () => switchThang('bar'));
  document.getElementById('tb-line').addEventListener('click', () => switchThang('line'));
  document.getElementById('tb-ldnut').addEventListener('click', () => switchLoai('doughnut'));
  document.getElementById('tb-lbar').addEventListener('click', () => switchLoai('bar'));
}

function applyFilter() {
  const y = document.getElementById('yearFilter').value;
  const ms = y === 'all' ? MONTHS : MONTHS.filter(m => m.nam == y);
  const tag = y === 'all' ? 'Tất cả năm' : `Năm ${y}`;
  [1, 2, 3, 4, 5].forEach(i => document.getElementById('t' + i).textContent = tag);
  const tk = ms.reduce((s, m) => s + m.tong_km, 0);
  const tc = ms.reduce((s, m) => s + m.so_chuyen, 0);
  const tb = ms.length ? tk / ms.length : 0;
  const top = [...ms].sort((a, b) => b.tong_km - a.tong_km)[0];
  document.getElementById('k1').textContent = fmt(tk) + ' km';
  document.getElementById('k2').textContent = fmt(tc) + ' ngày';
  document.getElementById('k3').textContent = fmt(tb, 1) + ' km';
  document.getElementById('k4').textContent = top ? `T${top.thang_so}/${top.nam}` : '—';
  document.getElementById('k5').textContent = tc > 0 ? fmt(tk / tc, 1) + ' km' : '—';
  renderTop(ms, tag);
  renderLuTru(y);
  renderNam();
  renderTrung();
  renderLoai();
  renderThang(thangType);
}

function buildSlicer(years) {
  const sorted = [...years].sort((a, b) => b - a);
  selectedYears = new Set(sorted.slice(0, 2).map(String));
  const slYears = document.getElementById('slicerYears');
  slYears.innerHTML = years.map(y =>
    `<span class="spill ${selectedYears.has(String(y)) ? 'on' : ''}" data-y="${y}">${y}</span>`).join('');
  slYears.onclick = (e) => { const el = e.target.closest('.spill'); if (el) toggleY(el.dataset.y); };

  presets = [
    { l: '2 năm gần', v: sorted.slice(0, 2) }, { l: '3 năm', v: sorted.slice(0, 3) },
    { l: '4 năm', v: sorted.slice(0, 4) }, { l: 'Tất cả', v: sorted }].filter(p => p.v.length);
  const slPre = document.getElementById('slicerPresets');
  slPre.innerHTML = presets.map((p, i) => `<span class="spill" data-i="${i}">${p.l}</span>`).join('');
  slPre.onclick = (e) => { const el = e.target.closest('.spill'); if (el) applyPre(+el.dataset.i); };
  renderThang(thangType);
}

function toggleY(y) {
  if (selectedYears.has(String(y)) && selectedYears.size > 1) selectedYears.delete(String(y));
  else selectedYears.add(String(y));
  document.querySelectorAll('#slicerYears .spill').forEach(el => el.classList.toggle('on', selectedYears.has(el.dataset.y)));
  renderThang(thangType);
}

function applyPre(i) {
  selectedYears = new Set(presets[i].v.map(String));
  document.querySelectorAll('#slicerYears .spill').forEach(el => el.classList.toggle('on', selectedYears.has(el.dataset.y)));
  renderThang(thangType);
}

function renderThang(type) {
  const ctx = document.getElementById('cThang').getContext('2d');
  if (charts.th) charts.th.destroy();
  const years = [...selectedYears].map(Number).sort((a, b) => a - b);
  const datasets = years.map((y, yi) => {
    const col = YC[yi % YC.length], arr = Array(12).fill(null);
    MONTHS.filter(m => m.nam === String(y) || m.nam === y).forEach(m => arr[m.thang_so - 1] = m.tong_km);
    return { label: String(y), data: arr, backgroundColor: hexA(col, type === 'line' ? 0 : .82), borderColor: col,
      borderWidth: type === 'line' ? 2 : 0, borderRadius: type === 'bar' ? 5 : 0,
      tension: .4, fill: false, pointBackgroundColor: col, pointRadius: type === 'line' ? 4 : 0, spanGaps: false };
  });
  const plugin = lp({ mode: type === 'bar' ? 'bar-inside' : 'line-above', color: (v, i, ds) => type !== 'bar' ? ds.borderColor : '#ffffffbb', fmt: v => v != null && v > 0 ? fmt(v) : '', size: 9, gap: 10 });
  charts.th = new Chart(ctx, { type: type === 'line' ? 'line' : 'bar', data: { labels: MONTHS_LABEL, datasets },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: type === 'line' ? 22 : 6 } },
      plugins: { legend: { display: true, position: 'top', labels: { color: CHART_TICK, font: { size: 11 }, boxWidth: 10, boxHeight: 10, padding: 12 } },
        tooltip: { callbacks: { label: c => `  ${c.dataset.label}: ${c.parsed.y != null ? fmt(c.parsed.y) + ' km' : '—'}` } } },
      scales: { x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 10 } } },
                y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 10 }, callback: v => fmt(v) } } } }, plugins: [plugin] });
}

function renderTop(ms, tag) {
  document.getElementById('topSub').textContent = `Top 5 km nhất — ${tag}`;
  const top = [...ms].sort((a, b) => b.tong_km - a.tong_km).slice(0, 5);
  const mx = top[0]?.tong_km || 1;
  document.getElementById('topBody').innerHTML = top.map((m, i) => `<tr class="border-b border-slate-100 last:border-0">
    <td class="py-2"><span class="${rankClass(i)}">${i + 1}</span></td>
    <td class="py-2 text-sm text-slate-700">T${m.thang_so}/${m.nam}</td>
    <td class="py-2"><div class="flex items-center gap-2"><div class="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden min-w-[40px]"><div class="h-full bg-indigo-500 rounded-full" style="width:${(m.tong_km / mx * 100).toFixed(0)}%"></div></div>
      <span class="font-mono text-xs text-indigo-600 font-semibold whitespace-nowrap">${fmt(m.tong_km)}</span></div></td>
    <td class="py-2 text-sm text-slate-500 whitespace-nowrap">${m.so_chuyen}</td></tr>`).join('');
}

function renderLuTru(y) {
  const isAll = y === 'all';
  const diem = {}; const dc = { 'TMY': PAL[4], 'PSN': PAL[5], 'HIN': PAL[2] };
  LUTRU.forEach(r => { if (!isAll && r.nam != y) return; diem[r.dia_diem] = (diem[r.dia_diem] || 0) + (+r.so_ngay); });
  const total = Object.values(diem).reduce((s, v) => s + v, 0);
  document.getElementById('luTotal').textContent = fmt(total);
  document.getElementById('luGrid').innerHTML = Object.entries(diem).sort((a, b) => b[1] - a[1]).map(([n, d]) => {
    const c = dc[n] || PAL[6];
    return `<div class="bg-slate-50 border rounded-lg p-3 text-center transition-transform hover:-translate-y-0.5" style="border-color:${c}44">
      <div class="text-xs font-bold mb-1" style="color:${c}">${n}</div>
      <div class="font-mono text-xl font-bold" style="color:${c}">${d}</div>
      <div class="text-[10px] text-slate-400 mt-0.5">ngày</div></div>`;
  }).join('');
  const ctx = document.getElementById('cLuTru').getContext('2d');
  if (charts.lu) charts.lu.destroy();
  const years = [...new Set(LUTRU.map(r => r.nam))].sort();
  const dms = [...new Set(LUTRU.map(r => r.dia_diem))];
  const datasets = dms.map((dm, idx) => {
    const c = dc[dm] || PAL[idx % PAL.length];
    return { label: dm, data: years.map(yr => { const r = LUTRU.find(x => x.nam === yr && x.dia_diem === dm); return r ? +r.so_ngay : 0; }),
      backgroundColor: hexA(c, .85), borderRadius: 3, borderWidth: 0, stack: 's', _c: c };
  });
  const plugins = datasets.map(ds => lp({ mode: 'stk', color: '#fff', cTop: ds._c, fmt: v => v > 0 ? `${v} ngày` : '', size: 10 }));
  charts.lu = new Chart(ctx, { type: 'bar', data: { labels: years, datasets },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: CHART_TICK, font: { size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', padding: 10 } },
        tooltip: { callbacks: { label: c => `  ${c.dataset.label}: ${c.parsed.y} ngày` } } },
      scales: { x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK }, stacked: true },
                y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, callback: v => v + ' ngày' }, stacked: true } } }, plugins });
}

function renderNam() {
  const ctx = document.getElementById('cNam').getContext('2d');
  if (charts.nam) charts.nam.destroy();
  const years = Object.keys(YEARS).sort();
  const kv = years.map(y => YEARS[y].km), cv = years.map(y => YEARS[y].chuyen);
  const lpKm = lp({ mode: 'bar-inside', color: '#ffffffcc', fmt: v => v > 0 ? fmt(v) + ' km' : '', size: 10 });
  const lpCh = { id: 'ch', afterDatasetsDraw(chart) {
    const ctx = chart.ctx, meta = chart.getDatasetMeta(1); if (!meta || meta.hidden) return;
    meta.data.forEach((el, i) => { const v = cv[i]; if (!v) return;
      ctx.save(); ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.fillStyle = '#ffab40';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(v + ' chuyến', el.x, el.y - 14); ctx.restore(); });
  } };
  charts.nam = new Chart(ctx, { type: 'bar', data: { labels: years, datasets: [
    { label: 'Tổng km', data: kv, backgroundColor: hexA(PAL[1], .72), borderRadius: 5, borderWidth: 0, yAxisID: 'y', order: 2 },
    { label: 'Số chuyến', data: cv, type: 'line', tension: .4, borderColor: '#ffab40', backgroundColor: 'transparent',
      pointBackgroundColor: '#ffab40', pointRadius: 7, pointStyle: 'circle', borderWidth: 2.5, yAxisID: 'y1', order: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 34, bottom: 4 } },
      plugins: { legend: { position: 'bottom', align: 'center', labels: { color: CHART_TICK, font: { size: 11 }, usePointStyle: true,
        generateLabels(c) { return c.data.datasets.map((ds, i) => ({ text: ds.label, fillStyle: i === 0 ? hexA(PAL[1], .72) : '#ffab40',
          strokeStyle: i === 0 ? hexA(PAL[1], .72) : '#ffab40', color: CHART_TICK, pointStyle: i === 0 ? 'rectRounded' : 'circle', hidden: false, datasetIndex: i })); },
        boxWidth: 12, boxHeight: 12, padding: 16 } },
        tooltip: { callbacks: { label: c => c.dataset.label === 'Tổng km' ? ' ' + fmt(c.parsed.y) + ' km' : ' ' + fmt(c.parsed.y) + ' chuyến' } } },
      scales: { x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK } },
        y: { grid: { color: CHART_GRID }, ticks: { color: PAL[1], font: { size: 10 }, callback: v => fmt(v) }, position: 'left' },
        y1: { grid: { drawOnChartArea: false }, ticks: { color: '#ffab40', font: { size: 10 } }, position: 'right' } } },
    plugins: [lpKm, lpCh] });
}

function renderTrung() {
  const ctx = document.getElementById('cTrung').getContext('2d');
  if (charts.trung) charts.trung.destroy();
  const years = Object.keys(YEARS).sort();
  const tbv = years.map(y => YEARS[y].km / (YEARS[y].nThang || 1));
  const kpv = years.map(y => YEARS[y].chuyen > 0 ? YEARS[y].km / YEARS[y].chuyen : 0);
  const lpTB = lp({ mode: 'bar-inside', color: '#ffffffcc', fmt: v => v > 0 ? fmt(v, 0) + ' km/tháng' : '', size: 10 });
  const lpKP = { id: 'kpLabel', afterDatasetsDraw(chart) {
    const ctx = chart.ctx, meta = chart.getDatasetMeta(1); if (!meta || meta.hidden) return;
    meta.data.forEach((el, i) => { const v = kpv[i]; if (!v) return;
      ctx.save(); ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.fillStyle = '#ffab40';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(fmt(v, 1) + ' km/chuyến', el.x, el.y - 14); ctx.restore(); });
  } };
  charts.trung = new Chart(ctx, { type: 'bar', data: { labels: years, datasets: [
    { label: 'TB km/tháng', data: tbv, backgroundColor: hexA(PAL[4], .75), borderRadius: 6, borderWidth: 0, yAxisID: 'y', order: 2 },
    { label: 'TB km/chuyến', data: kpv, type: 'line', tension: .4, borderColor: '#ffab40', backgroundColor: 'transparent',
      pointBackgroundColor: '#ffab40', pointRadius: 7, pointStyle: 'circle', borderWidth: 2.5, yAxisID: 'y1', order: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 34, bottom: 4 } },
      plugins: { legend: { position: 'bottom', align: 'center', labels: { color: CHART_TICK, font: { size: 11 }, usePointStyle: true,
        generateLabels(c) { return c.data.datasets.map((ds, i) => ({ text: ds.label, fillStyle: i === 0 ? hexA(PAL[4], .75) : '#ffab40',
          strokeStyle: i === 0 ? hexA(PAL[4], .75) : '#ffab40', color: CHART_TICK, pointStyle: i === 0 ? 'rectRounded' : 'circle', hidden: false, datasetIndex: i })); },
        boxWidth: 12, boxHeight: 12, padding: 16 } },
        tooltip: { callbacks: { label: c => c.dataset.label.includes('tháng') ? ' ' + fmt(c.parsed.y, 1) + ' km/tháng' : ' ' + fmt(c.parsed.y, 1) + ' km/chuyến' } } },
      scales: { x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK } },
        y: { grid: { color: CHART_GRID }, ticks: { color: PAL[4], font: { size: 10 }, callback: v => fmt(v) }, position: 'left' },
        y1: { grid: { drawOnChartArea: false }, ticks: { color: '#ffab40', font: { size: 10 } }, position: 'right' } } },
    plugins: [lpTB, lpKP] });
}

function renderLoai() {
  const ctx = document.getElementById('cLoai').getContext('2d');
  if (charts.loai) charts.loai.destroy();
  const data = LOAI_STATS;
  const type = loaiType, labels = data.map(r => r.loai_tuyen), vals = data.map(r => +r.so_chuyen);
  const isR = ['doughnut', 'pie'].includes(type);
  const bg = PAL.slice(0, labels.length).map(c => hexA(c, isR ? .9 : .8));
  const plugins = isR ? [dpLp()] : [lp({ mode: 'bar-top', color: (v, i) => PAL[i % PAL.length], fmt: v => v + ' chuyến', size: 10 })];
  charts.loai = new Chart(ctx, { type, data: { labels, datasets: [{ label: 'Chuyến', data: vals, backgroundColor: bg,
    borderColor: isR ? '#ffffff' : bg, borderWidth: isR ? 2 : 0, borderRadius: isR ? 0 : 5, cutout: type === 'doughnut' ? '60%' : undefined }] },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: isR ? { right: 90, left: 20 } : { top: 24 } },
      plugins: { legend: { display: isR, position: 'right', labels: { color: CHART_TICK, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 9 } },
        tooltip: { callbacks: { label: c => ' ' + (c.parsed || c.raw) + ' chuyến' } } },
      scales: isR ? {} : { x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 10 } } },
                     y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 10 } } } } }, plugins });
}

function switchThang(t) { thangType = t; document.getElementById('tb-bar').classList.toggle('on', t === 'bar'); document.getElementById('tb-line').classList.toggle('on', t === 'line'); renderThang(t); }
function switchLoai(t) { loaiType = t; document.getElementById('tb-ldnut').classList.toggle('on', t === 'doughnut'); document.getElementById('tb-lbar').classList.toggle('on', t === 'bar'); renderLoai(); }
