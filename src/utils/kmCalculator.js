import { getRefData } from '../api/refDataApi.js';

// Nguồn DUY NHẤT tính km khi lưu record — kết quả được snapshot vào ttcq_records.km_snapshot
// tại thời điểm ghi (không JOIN sống sau này, xem quy tắc dữ liệu trong CLAUDE.md).

export function computeLoTrinhKm(loTrinhId) {
  if (!loTrinhId) return 0;
  const km = getRefData().kmByLoTrinh.get(Number(loTrinhId));
  return km || 0;
}

export function computeDoanLeKm(doanTuyenIds) {
  const { doanTuyenMap } = getRefData();
  return (doanTuyenIds || []).reduce((sum, id) => sum + (parseFloat(doanTuyenMap.get(Number(id))?.km) || 0), 0);
}
