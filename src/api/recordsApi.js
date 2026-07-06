const SELECT_WITH_DOAN_LE =
  '*, ttcq_records_doan_le(thu_tu, doan_tuyen_id, doan_tuyen(id, km, loai_tuyen, diem_dau_id, diem_cuoi_id))';

export async function listRecords(sb, { from, to } = {}) {
  let q = sb.from('ttcq_records').select(SELECT_WITH_DOAN_LE).order('ngay', { ascending: false });
  if (from) q = q.gte('ngay', from);
  if (to) q = q.lte('ngay', to);
  const { data, error } = await q;
  if (error) throw error;
  (data || []).forEach(r => r.ttcq_records_doan_le?.sort((a, b) => a.thu_tu - b.thu_tu));
  return data || [];
}

export async function listAllRecordsForStats(sb) {
  const { data, error } = await sb.from('ttcq_records').select(SELECT_WITH_DOAN_LE);
  if (error) throw error;
  return data || [];
}

export async function getRecord(sb, id) {
  const { data, error } = await sb.from('ttcq_records').select(SELECT_WITH_DOAN_LE).eq('id', id).single();
  if (error) throw error;
  data.ttcq_records_doan_le?.sort((a, b) => a.thu_tu - b.thu_tu);
  return data;
}

async function replaceDoanLe(sb, recordId, doanTuyenIds) {
  const { error: delErr } = await sb.from('ttcq_records_doan_le').delete().eq('record_id', recordId);
  if (delErr) throw delErr;
  if (!doanTuyenIds.length) return;
  const rows = doanTuyenIds.map((doanTuyenId, i) => ({ record_id: recordId, doan_tuyen_id: doanTuyenId, thu_tu: i + 1 }));
  const { error: insErr } = await sb.from('ttcq_records_doan_le').insert(rows);
  if (insErr) throw insErr;
}

// payload: { ngay, loai_nhap, lo_trinh_id, doan_tuyen_ids, km_snapshot, lu_tru, ghi_chu }
export async function createRecord(sb, payload) {
  const { doan_tuyen_ids, ...rec } = payload;
  const { data, error } = await sb.from('ttcq_records').insert(rec).select().single();
  if (error) throw error;
  if (payload.loai_nhap === 'doan_le') await replaceDoanLe(sb, data.id, doan_tuyen_ids || []);
  return data;
}

export async function updateRecord(sb, id, payload) {
  const { doan_tuyen_ids, ...rec } = payload;
  const { data, error } = await sb.from('ttcq_records').update(rec).eq('id', id).select().single();
  if (error) throw error;
  await replaceDoanLe(sb, id, payload.loai_nhap === 'doan_le' ? (doan_tuyen_ids || []) : []);
  return data;
}

export async function deleteRecord(sb, id) {
  const { error } = await sb.from('ttcq_records').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateRecord(sb, srcId, newNgay) {
  const src = await getRecord(sb, srcId);
  const payload = {
    ngay: newNgay,
    loai_nhap: src.loai_nhap,
    lo_trinh_id: src.lo_trinh_id,
    km_snapshot: src.km_snapshot,
    lu_tru: src.lu_tru,
    ghi_chu: src.ghi_chu,
    doan_tuyen_ids: (src.ttcq_records_doan_le || []).map(d => d.doan_tuyen_id),
  };
  return createRecord(sb, payload);
}
