// Cho phép đăng nhập bằng "tên đăng nhập" đơn giản thay vì bắt buộc email thật —
// Supabase Auth vẫn cần 1 địa chỉ dạng email để lưu trong auth.users, nên nếu người dùng
// gõ không có "@" thì tự ghép thành "<tenDangNhap>@ttcq.local" phía dưới (miền giả, không
// gửi mail thật). Nếu gõ có "@" (email thật) thì giữ nguyên như cũ.
const FAKE_EMAIL_DOMAIN = 'ttcq.local';
const USERNAME_RE = /^[a-zA-Z0-9._+-]+$/;

export function toAuthEmail(input) {
  const v = input.trim().toLowerCase();
  if (v.includes('@')) return v;
  if (!USERNAME_RE.test(v)) {
    throw new Error('Tên đăng nhập chỉ được chứa chữ/số không dấu, dấu chấm, gạch dưới hoặc gạch ngang.');
  }
  return v + '@' + FAKE_EMAIL_DOMAIN;
}

// Hiển thị lại cho người dùng: bỏ hậu tố "@ttcq.local" nếu là tài khoản username giả lập,
// còn email thật (Google/email thật) thì hiển thị nguyên vẹn.
export function displayIdentity(email) {
  if (!email) return '';
  const suffix = '@' + FAKE_EMAIL_DOMAIN;
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
