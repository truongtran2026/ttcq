import { listUsers, updateUserRole, revokeUser } from '../api/usersApi.js';
import { createScratchClient } from '../api/supabaseClient.js';
import { getUser } from './auth.js';
import { showToast } from '../components/toast.js';
import { toAuthEmail, displayIdentity } from '../utils/identity.js';

let sb = null;

export function initAdminUsers(supabaseClient) {
  sb = supabaseClient;
  document.getElementById('btnCreateUser').addEventListener('click', createUserAsAdmin);
}

export async function activateAdminTab() {
  await loadAndRender();
}

function roleOptionsHtml(current) {
  return ['none', 'editor', 'admin'].map(r =>
    `<option value="${r}" ${r === current ? 'selected' : ''}>${r === 'none' ? 'Chỉ xem' : r === 'editor' ? 'Editor' : 'Admin'}</option>`).join('');
}

async function loadAndRender() {
  let users;
  try {
    users = await listUsers(sb);
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'err');
    return;
  }
  const myId = getUser()?.id;
  const tbody = document.getElementById('adminUsersBody');
  tbody.innerHTML = users.map(u => `<tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0">
    <td class="px-3 py-2 text-sm text-slate-700">${displayIdentity(u.email)}${u.user_id === myId ? ' <span class="text-[10px] text-slate-400">(bạn)</span>' : ''}</td>
    <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">${new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
    <td class="px-3 py-2">
      <select class="border border-slate-300 rounded-md px-2 py-1 text-xs outline-none" data-role-for="${u.user_id}">${roleOptionsHtml(u.role)}</select>
    </td>
    <td class="px-3 py-2 text-center">
      <button class="bg-red-50 text-red-600 border-none px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" data-revoke="${u.user_id}" ${u.role === 'none' ? 'disabled' : ''}>Thu quyền</button>
    </td>
  </tr>`).join('');

  tbody.onchange = async (e) => {
    const sel = e.target.closest('select[data-role-for]'); if (!sel) return;
    try {
      await updateUserRole(sb, sel.getAttribute('data-role-for'), sel.value);
      showToast('Đã cập nhật vai trò ✓');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'err');
    }
    await loadAndRender();
  };

  tbody.onclick = async (e) => {
    const btn = e.target.closest('button[data-revoke]'); if (!btn) return;
    try {
      await revokeUser(sb, btn.getAttribute('data-revoke'));
      showToast('Đã thu quyền ✓');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'err');
    }
    await loadAndRender();
  };
}

function setNewUserMsg(msg, isError = false) {
  const el = document.getElementById('newUserMsg');
  el.textContent = msg;
  el.className = 'text-xs mb-2 ' + (isError ? 'text-red-600' : 'text-emerald-600');
}

// Admin tạo tài khoản email/mật khẩu cho người khác — dùng 1 client "tạm" riêng
// (không lưu session) để signUp KHÔNG ghi đè/đăng xuất phiên admin đang đăng nhập
// trên client chính `sb`. Gán vai trò ngay sau khi tạo xong bằng client chính.
async function createUserAsAdmin() {
  const raw = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;
  if (!raw || !password) { setNewUserMsg('Vui lòng nhập đủ tên đăng nhập/email và mật khẩu.', true); return; }
  if (password.length < 6) { setNewUserMsg('Mật khẩu cần ít nhất 6 ký tự.', true); return; }

  const btn = document.getElementById('btnCreateUser');
  btn.disabled = true;
  try {
    const email = toAuthEmail(raw);
    const scratch = createScratchClient();
    const { data, error } = await scratch.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Không tạo được tài khoản.');
    await updateUserRole(sb, data.user.id, role);
    setNewUserMsg('Đã tạo tài khoản ✓' + (data.session ? '' : ' (có thể cần xác nhận email tùy cấu hình Supabase trước khi đăng nhập được)'));
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    await loadAndRender();
  } catch (e) {
    setNewUserMsg(e.message || String(e), true);
  } finally {
    btn.disabled = false;
  }
}
