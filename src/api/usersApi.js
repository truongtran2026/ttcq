// CRUD vai trò người dùng — bảng public.app_users (1 dòng / tài khoản, xem ARCHITECTURE.md).
// role: 'none' (chỉ xem) | 'editor' (được thêm/sửa/xóa) | 'admin' (được cấp/thu quyền người khác).

export async function listUsers(sb) {
  const { data, error } = await sb.from('app_users').select('*').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function getMyRole(sb, userId) {
  const { data, error } = await sb.from('app_users').select('role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.role || 'none';
}

export async function updateUserRole(sb, userId, role) {
  const { error } = await sb.from('app_users').update({ role }).eq('user_id', userId);
  if (error) throw error;
}

export async function revokeUser(sb, userId) {
  return updateUserRole(sb, userId, 'none');
}
