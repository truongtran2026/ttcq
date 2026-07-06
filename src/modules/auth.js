import { EDIT_ALLOWED } from '../config.js';
import { authBadgeState } from '../components/badge.js';

const BTN_LOGIN = 'ml-auto bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-semibold text-xs hover:bg-indigo-700 transition-colors';
const BTN_LOGOUT = 'ml-auto bg-transparent text-slate-500 border border-slate-300 px-4 py-1.5 rounded-lg font-semibold text-xs hover:bg-slate-100 transition-colors';

let sb = null;
let user = null;
let canEdit = false;
let onChangeCb = () => {};

export function getUser() { return user; }
export function getCanEdit() { return canEdit; }

export function initAuth(supabaseClient, onChange) {
  sb = supabaseClient;
  onChangeCb = onChange || (() => {});
  wireDom();
  return sb.auth.getSession().then(({ data: { session } }) => {
    if (session) applyUser(session.user); else clearUser();
    sb.auth.onAuthStateChange((_, s) => { if (s) applyUser(s.user); else clearUser(); });
  });
}

function wireDom() {
  document.getElementById('btnLogin').addEventListener('click', () => {
    if (canEdit || user) doLogout(); else loginGoogle();
  });
}

function applyUser(u) {
  user = u;
  canEdit = EDIT_ALLOWED.some(e => e.toLowerCase() === u.email.toLowerCase());
  document.getElementById('authEmail').textContent = u.email;
  const { text, className } = authBadgeState(canEdit);
  const badge = document.getElementById('authBadge');
  badge.textContent = text;
  badge.className = className;
  document.body.classList.toggle('view-only', !canEdit);
  const btn = document.getElementById('btnLogin');
  btn.textContent = 'Đăng xuất';
  btn.className = BTN_LOGOUT;
  onChangeCb();
}

function clearUser() {
  user = null; canEdit = false;
  document.body.classList.add('view-only');
  document.getElementById('authEmail').textContent = 'Chưa đăng nhập';
  const { text, className } = authBadgeState(false);
  const badge = document.getElementById('authBadge');
  badge.textContent = text;
  badge.className = className;
  const btn = document.getElementById('btnLogin');
  btn.textContent = 'Đăng nhập với Google';
  btn.className = BTN_LOGIN;
  onChangeCb();
}

function loginGoogle() {
  return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
}

async function doLogout() {
  await sb.auth.signOut();
  clearUser();
}
