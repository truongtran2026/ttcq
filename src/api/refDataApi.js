// Dữ liệu danh mục — rất nhỏ (vài chục dòng), load 1 lần lúc khởi động và cache trong bộ nhớ.
let cache = null;

export async function loadRefData(sb) {
  const [diem, doan, loTrinh, kmView, tenView, luTru] = await Promise.all([
    sb.from('diem').select('*'),
    sb.from('doan_tuyen').select('*'),
    sb.from('lo_trinh').select('*'),
    sb.from('v_lo_trinh_km').select('*'),
    sb.from('v_doan_tuyen_ten').select('*'),
    sb.from('lu_tru_list').select('*').order('dia_diem'),
  ]);
  const firstError = [diem, doan, loTrinh, kmView, tenView, luTru].find(r => r.error);
  if (firstError) throw firstError.error;

  const diemMap = new Map((diem.data || []).map(r => [r.id, r]));
  const doanTuyenMap = new Map((doan.data || []).map(r => [r.id, r]));
  const loTrinhMap = new Map((loTrinh.data || []).map(r => [r.id, r]));
  const kmByLoTrinh = new Map((kmView.data || []).map(r => [r.lo_trinh_id ?? r.id, +r.km_tong]));
  const tenByDoanTuyen = new Map((tenView.data || []).map(r => [r.doan_tuyen_id ?? r.id, r]));

  cache = {
    diem: diem.data || [],
    doanTuyen: doan.data || [],
    loTrinh: loTrinh.data || [],
    luTruList: (luTru.data || []).map(r => r.dia_diem),
    diemMap,
    doanTuyenMap,
    loTrinhMap,
    kmByLoTrinh,
    tenByDoanTuyen,
  };
  return cache;
}

export function getRefData() {
  if (!cache) throw new Error('refData chưa được load — gọi loadRefData() trước');
  return cache;
}

export function tenDoanTuyen(doanTuyenId) {
  const d = getRefData().doanTuyenMap.get(doanTuyenId);
  // Doan tu-quay-ve cung 1 diem (self-loop, vd "Noi thi" id=16) -> hien loai_tuyen
  // thay vi ghep "DiemA-DiemA" trung lap vo nghia.
  if (d && d.diem_dau_id === d.diem_cuoi_id) {
    return d.loai_tuyen || `#${doanTuyenId}`;
  }
  const t = getRefData().tenByDoanTuyen.get(doanTuyenId);
  if (t) return t.ten_thuan || t.ten_nguoc || `#${doanTuyenId}`;
  if (!d) return `#${doanTuyenId}`;
  const a = getRefData().diemMap.get(d.diem_dau_id)?.ten_diem || '?';
  const b = getRefData().diemMap.get(d.diem_cuoi_id)?.ten_diem || '?';
  return `${a}-${b}`;
}
