import { authBadgeState } from '../components/badge.js';
import { getMyRole } from '../api/usersApi.js';
import { openOverlay, closeOverlay, wireOverlayBackdropClose } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const BTN_LOGIN = 'bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-semibold text-xs hover:bg-indigo-700 transition-colors';
const BTN_LOGOUT = 'bg-transparent text-slate-500 border border-slate-300 px-4 py-1.5 rounded-lg font-semibold text-xs hover:bg-slate-100 transition-colors';

let sb = null;
let user = null;
let canEdit = false;
let isAdmin = false;
let authMode = 'signin';
let onChangeCb = () => {};

export function getUser() { return user; }
export function getCanEdit() { return canEdit; }
export function getIsAdmin() { return isAdmin; }

export function initAuth(supabaseClient, onChange) {
  sb = supabaseClient;
  onChangeCb = onChange || (() => {});
  wireDom();
  return sb.auth.getSession().then(async ({ data: { session } }) => {
    if (session) await applyUser(session.user); else clearUser();
    sb.auth.onAuthStateChange(async (_, s) => { if (s) await applyUser(s.user); else clearUser(); });
    // Don sach token/callback con sot lai tren URL sau khi Supabase da xu ly xong,
    // tranh lan sau vo tinh gui lai cho Google gay loi "malformed request".
    if (window.location.hash || window.location.search) {
      history.replaceState(null, '', window.location.origin + window.location.pathname);
    }
  });
}

function wireDom() {
  document.getElementById('btnLogin').addEventListener('click', () => {
    if (user) doLogout(); else loginGoogle();
  });
  document.getElementById('btnLoginEmail').addEventListener('click', openAuthModal);
  document.getElementById('btnAuthSubmit').addEventListener('click', submitAuthForm);
  document.getElementById('btnToggleAuthMode').addEventListener('click', toggleAuthMode);
  document.querySelectorAll('[data-close="authOv"]').forEach(b => b.addEventListener('click', closeAuthModal));
  wireOverlayBackdropClose('authOv');
}

async function applyUser(u) {
  user = u;
  let role = 'none';
  try {
    role = await getMyRole(sb, u.id);
  } catch (e) {
    showToast('Không tra được vai trò (app_users): ' + e.message, 'err');
  }
  canEdit = role === 'editor' || role === 'admin';
  isAdmin = role === 'admin';
  document.getElementById('authEmail').textContent = u.email;
  const { text, className } = authBadgeState(canEdit);
  const badge = document.getElementById('authBadge');
  badge.textContent = text;
  badge.className = className;
  document.body.classList.toggle('view-only', !canEdit);
  const btn = document.getElementById('btnLogin');
  btn.textContent = 'Đăng xuất';
  btn.className = BTN_LOGOUT;
  document.getElementById('btnLoginEmail').style.display = 'none';
  onChangeCb();
}

function clearUser() {
  user = null; canEdit = false; isAdmin = false;
  document.body.classList.add('view-only');
  document.getElementById('authEmail').textContent = 'Chưa đăng nhập';
  const { text, className } = authBadgeState(false);
  const badge = document.getElementById('authBadge');
  badge.textContent = text;
  badge.className = className;
  const btn = document.getElementById('btnLogin');
  btn.textContent = 'Đăng nhập với Google';
  btn.className = BTN_LOGIN;
  document.getElementById('btnLoginEmail').style.display = '';
  onChangeCb();
}

function loginGoogle() {
  // Dung URL goc "sach" (bo query/hash con sot lai tu lan redirect OAuth truoc),
  // tranh gui nguyen window.location.href co the da bi dinh rac lam Google tu choi request.
  const cleanUrl = window.location.origin + window.location.pathname;
  return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cleanUrl } });
}

async function doLogout() {
  await sb.auth.signOut();
  clearUser();
}

// ── Đăng nhập / đăng ký bằng email + mật khẩu ───────────────────
function openAuthModal() {
  authMode = 'signin';
  document.getElementById('authEmailInput').value = '';
  document.getElementById('authPasswordInput').value = '';
  setAuthMsg('');
  updateAuthModalUI();
  openOverlay('authOv');
}

function closeAuthModal() { closeOverlay('authOv'); }

function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  setAuthMsg('');
  updateAuthModalUI();
}

function updateAuthModalUI() {
  const isSignin = authMode === 'signin';
  document.getElementById('authModalTitle').textContent = isSignin ? 'Đăng nhập' : 'Đăng ký tài khoản';
  document.getElementById('btnAuthSubmit').textContent = isSignin ? 'Đăng nhập' : 'Đăng ký';
  document.getElementById('btnToggleAuthMode').textContent = isSignin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập';
}

function setAuthMsg(msg, isError = false) {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = 'text-xs mt-2 ' + (isError ? 'text-red-600' : 'text-emerald-600');
}

async function submitAuthForm() {
  const email = document.getElementById('authEmailInput').value.trim();
  const password = document.getElementById('authPasswordInput').value;
  if (!email || !password) { setAuthMsg('Vui lòng nhập đủ email và mật khẩu.', true); return; }
  const btn = document.getElementById('btnAuthSubmit');
  btn.disabled = true;
  try {
    if (authMode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
    } else {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        setAuthMsg('Đăng ký thành công! Kiểm tra email để xác nhận trước khi đăng nhập.');
      } else {
        closeAuthModal();
      }
    }
  } catch (e) {
    setAuthMsg(e.message || String(e), true);
  } finally {
    btn.disabled = false;
  }
}
