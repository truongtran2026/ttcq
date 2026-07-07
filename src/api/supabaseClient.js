import { SUPABASE_URL, SUPABASE_ANON } from '../config.js';

let sb = null;

export function initSupabase() {
  if (!SUPABASE_ANON || SUPABASE_ANON === 'PASTE_YOUR_ANON_KEY_HERE' || SUPABASE_ANON.length < 50) {
    throw new Error(
      '<b>⚙️ Cần cấu hình một lần</b><br><br>' +
      'Mở file <code>src/config.js</code> trên GitHub,<br>' +
      'tìm dòng <code>PASTE_YOUR_ANON_KEY_HERE</code><br>' +
      'và thay bằng <b>anon public key</b> từ:<br>' +
      '<b>Supabase → Settings → API → anon public</b>'
    );
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { redirectTo: window.location.href } });
  return sb;
}

export function getSb() {
  return sb;
}

// Client tạm, KHÔNG lưu session (persistSession:false) — dùng khi admin tạo tài khoản
// email/mật khẩu cho người khác ngay trong app, để không ghi đè/đăng xuất phiên admin
// đang đăng nhập trên client chính `sb`.
export function createScratchClient() {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
