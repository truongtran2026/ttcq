import { initSupabase } from './src/api/supabaseClient.js';
import { loadRefData } from './src/api/refDataApi.js';
import { initAuth, getIsAdmin } from './src/modules/auth.js';
import { initDashboard, reload as reloadDashboard } from './src/modules/dashboard.js';
import { initRecords, activateRecordsTab } from './src/modules/records.js';
import { initAdminUsers, activateAdminTab } from './src/modules/adminUsers.js';

function hideLoading() { document.getElementById('loading').style.display = 'none'; }
function showErr(msg) {
  document.getElementById('lspinner').style.display = 'none';
  document.getElementById('ltxt').style.display = 'none';
  document.getElementById('lerr').style.display = 'block';
  document.getElementById('lerrmsg').innerHTML = msg;
}
function setLoadingText(t) { document.getElementById('ltxt').textContent = t; }

function wireTabs() {
  document.getElementById('tabDash').addEventListener('click', () => switchTab('dash'));
  document.getElementById('tabData').addEventListener('click', () => switchTab('data'));
  document.getElementById('tabAdmin').addEventListener('click', () => switchTab('admin'));
}

async function switchTab(tab) {
  document.getElementById('pageDash').style.display = tab === 'dash' ? 'block' : 'none';
  document.getElementById('pageData').style.display = tab === 'data' ? 'block' : 'none';
  document.getElementById('pageAdmin').style.display = tab === 'admin' ? 'block' : 'none';
  document.getElementById('tabDash').classList.toggle('active', tab === 'dash');
  document.getElementById('tabData').classList.toggle('active', tab === 'data');
  document.getElementById('tabAdmin').classList.toggle('active', tab === 'admin');
  document.getElementById('yearFilter').style.display = tab === 'dash' ? '' : 'none';
  if (tab === 'data') await activateRecordsTab();
  else if (tab === 'admin') await activateAdminTab();
}

function updateAdminTabVisibility() {
  const show = getIsAdmin();
  const tabAdmin = document.getElementById('tabAdmin');
  tabAdmin.style.display = show ? '' : 'none';
  if (!show && document.getElementById('pageAdmin').style.display !== 'none') switchTab('dash');
}

async function main() {
  wireTabs();
  const timer = setTimeout(() => showErr('Kết nối quá thời gian. Kiểm tra lại anon key.'), 15000);
  try {
    setLoadingText('Đang kết nối...');
    const sb = initSupabase();
    await initAuth(sb, updateAdminTabVisibility);
    setLoadingText('Đang tải dữ liệu...');
    await loadRefData(sb);
    initRecords(sb, reloadDashboard);
    initAdminUsers(sb);
    await initDashboard(sb);
    clearTimeout(timer);
    hideLoading();
  } catch (e) {
    clearTimeout(timer);
    showErr('<b>Lỗi:</b> ' + (e.message || String(e)));
  }
}

main();
