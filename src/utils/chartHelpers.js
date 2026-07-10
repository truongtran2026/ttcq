// Palette + plugin vẽ label lên Chart.js — chuyển nguyên logic từ bản cũ, chỉ đổi màu chữ/lưới
// cho theme sáng Tailwind (slate) thay vì theme tối trước đây.
import { fmt, hexA } from './format.js';

export const PAL = ['#2dce89','#4a9eff','#ffab40','#ff5c57','#bd93f9','#ff79c6','#06b6d4','#84cc16','#f97316','#e879f9'];
export const YC  = ['#4a9eff','#2dce89','#ffab40','#bd93f9','#ff5c57','#ff79c6','#06b6d4','#84cc16'];

export const CHART_GRID = '#e2e8f0';       // slate-200
export const CHART_TICK = '#64748b';       // slate-500
export const CHART_TEXT = '#334155';       // slate-700

export function lp(opts = {}) {
  return { id: 'lp' + Math.random().toString(36).slice(2), afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di); if (meta.hidden) return;
      const mode = opts.mode || 'bar-inside';
      meta.data.forEach((el, i) => {
        const v = ds.data[i]; if (!v && v !== 0) return;
        const txt = (opts.fmt || fmt)(v); if (!txt || txt === '0') return;
        const c = typeof opts.color === 'function' ? opts.color(v, i, ds) : (opts.color || '#ffffff');
        ctx.save(); ctx.font = `bold ${opts.size || 10}px JetBrains Mono,monospace`;
        ctx.textAlign = 'center'; ctx.fillStyle = c;
        if (mode === 'bar-inside') { const h = el.height || 0; if (h < 13) { ctx.restore(); return; } ctx.textBaseline = 'middle'; ctx.fillText(txt, el.x, el.y + h / 2); }
        else if (mode === 'bar-top') { ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - (opts.gap || 5)); }
        else if (mode === 'line-above') { ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - (opts.gap || 14)); }
        else if (mode === 'stk') { const h = el.height || 0; if (h >= 16) { ctx.textBaseline = 'middle'; ctx.fillText(txt, el.x, el.y + h / 2); } else if (h > 0) { ctx.fillStyle = opts.cTop || c; ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - 2); } }
        ctx.restore();
      });
    });
  } };
}

export function dpLp() {
  return { id: 'dp', afterDraw(chart) {
    const { ctx, data, chartArea } = chart;
    if (!['doughnut', 'pie'].includes(chart.config.type)) return;
    const ds = data.datasets[0], meta = chart.getDatasetMeta(0);
    const total = ds.data.reduce((s, v) => s + (v || 0), 0); if (!total) return;
    const cx = (chartArea.left + chartArea.right) / 2, cy = (chartArea.top + chartArea.bottom) / 2;
    const R = meta.data[0] ? meta.data[0].outerRadius : 100;
    const outsideLeft = [], outsideRight = [];

    meta.data.forEach((arc, i) => {
      const v = ds.data[i]; if (!v) return;
      // So tren, % duoi (theo cap) - thay vi 1 dong dai "12 (34.5%)" de vua o lat cat hep.
      const line1 = `${v}`, line2 = `${(v / total * 100).toFixed(1)}%`;
      const mid = (arc.startAngle + arc.endAngle) / 2, deg = (arc.endAngle - arc.startAngle) * 180 / Math.PI;
      const col = ds.backgroundColor[i] || PAL[i];
      if (deg >= 28) {
        const r = R * .78, tx = cx + Math.cos(mid) * r, ty = cy + Math.sin(mid) * r;
        ctx.save(); ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(line1, tx + 1, ty - 5); ctx.fillText(line2, tx + 1, ty + 7);
        ctx.fillStyle = '#fff'; ctx.fillText(line1, tx, ty - 6); ctx.fillText(line2, tx, ty + 6);
        ctx.restore();
      } else {
        const r1 = R * 1.05, r2 = R * 1.22, r3 = R * 1.28;
        const isRight = Math.cos(mid) >= 0;
        const x1 = cx + Math.cos(mid) * r1, y1 = cy + Math.sin(mid) * r1;
        const x2 = cx + Math.cos(mid) * r2;
        const x3 = cx + Math.cos(mid) * r3 + (isRight ? 14 : -14);
        (isRight ? outsideRight : outsideLeft).push({ line1, line2, col, x1, y1, x2, x3, y: cy + Math.sin(mid) * r2, isRight });
      }
    });

    // Chong chong-cheo: cac nhan ben ngoai cung phia trai/phai gan nhau qua thi
    // dan deu quanh vi tri trung binh cua ca nhom (KHONG day don huong xuong duoi,
    // vi day don huong lam nhan troi xa khoi lat cat, nhin roi hon).
    const MIN_GAP = 22;
    [outsideLeft, outsideRight].forEach(items => {
      if (items.length < 2) return;
      items.sort((a, b) => a.y - b.y);
      let overlap = false;
      for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < MIN_GAP) { overlap = true; break; }
      if (!overlap) return;
      const avgY = items.reduce((s, it) => s + it.y, 0) / items.length;
      let y = avgY - MIN_GAP * (items.length - 1) / 2;
      items.forEach(it => { it.y = y; y += MIN_GAP; });
    });

    [...outsideLeft, ...outsideRight].forEach(({ line1, line2, col, x1, y1, x2, x3, y, isRight }) => {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y); ctx.lineTo(x3, y); ctx.stroke();
      ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.fillStyle = col;
      ctx.textAlign = isRight ? 'left' : 'right'; ctx.textBaseline = 'middle';
      const lx = x3 + (isRight ? 3 : -3);
      ctx.fillText(line1, lx, y - 6); ctx.fillText(line2, lx, y + 6);
      ctx.restore();
    });
  } };
}

export { fmt, hexA };
