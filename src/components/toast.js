const BASE = 'toast fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm font-bold z-[999]';
const COLORS = { ok: 'bg-emerald-500 text-white', err: 'bg-red-500 text-white' };

export function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `${BASE} ${COLORS[type] || COLORS.ok}`;
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => el.classList.remove('show'), 3000);
}
