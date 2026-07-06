// Tách từ khối pagination trong renderTable cũ — sinh dãy nút trang, gọi onChange(page) khi bấm.
export function renderPager(container, { page, pages, onChange }) {
  container.innerHTML = '';
  if (pages <= 1) return;
  function mkB(lbl, pg, dis = false, active = false) {
    const b = document.createElement('button');
    b.className = active
      ? 'bg-indigo-600 border border-indigo-600 text-white font-semibold px-2 py-1 rounded-md text-xs'
      : 'bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-md text-xs hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed';
    b.textContent = lbl;
    b.disabled = dis;
    if (!dis) b.onclick = () => onChange(Math.max(1, Math.min(pages, pg)));
    container.appendChild(b);
  }
  mkB('⇤', 1, page === 1); mkB('«-10', page - 10, page <= 10); mkB('‹-5', page - 5, page <= 5);
  mkB('‹', page - 1, page === 1);
  let sp = Math.max(1, page - 2), ep = Math.min(pages, sp + 4); sp = Math.max(1, ep - 4);
  for (let p = sp; p <= ep; p++) mkB(p, p, false, p === page);
  mkB('›', page + 1, page === pages); mkB('›+5', page + 5, page + 5 > pages);
  mkB('›+10', page + 10, page + 10 > pages); mkB('⇥', pages, page === pages);
}
