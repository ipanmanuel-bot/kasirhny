// app.js — Main application logic
// KasirHnY

// ─── Global State ─────────────────────────────────────────────────────────────

let curRole = null; // 'owner' | 'staff'
let curStaff = null;
let ownerPwd = '1234';
let pinEntry = '';

// Data
let orders = [];
let kasLog = [];
let kasCtr = 1;
let promos = [];
let promoCtr = 1;
let menuItems = [];
let menuCats = [];
let employees = [];
let outlets = [];
let menuCtr = 1, catCtr = 1, empCtr = 1, outCtr = 1;

// Settings
let storeName = 'KasirHnY';
let storeAddr = '';
let storeWa = '';
let storeFooter = 'Terima kasih telah berkunjung!';
let storeLogo = '';       // original uploaded image (data URL)
let storeLogoBW = '';     // auto-converted black & white PNG (data URL)
let printerWidth = '80';  // '55' or '80' (mm)
let receiptLink = '';     // e-receipt / feedback link printed at bottom

// UI State
let curPage = 'dashboard';
let dashPeriod = 'today';
let dashFrom = '', dashTo = '';
let ordDateFilter = 'today';
let ordFrom = '', ordTo = '';
let kasDateFilter = 'today';
let ordPage = 1;

// Report page
let repPeriod = 'today';
let repFrom = '', repTo = '';

// Menu management tabs
let menuTab = 'menu'; // 'menu' | 'cat'
let menuFilterCat = 'all';
let menuSearch = '';

// Edit states
let editItemId = null;
let editCatId = null;
let editPromoId = null;
let editEmpId = null;
let editOutId = null;

// Staff login flow
let staffOutletId = null;

// Promo discount tracking for POS
let currentPromoAmt = 0;
let currentSubtotal = 0;
let currentTotal = 0;

// Dashboard chart
let dashChart = null;

// ─── Utility ──────────────────────────────────────────────────────────────────

const g = id => document.getElementById(id);
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fmt(n) { return 'Rp ' + (Math.round(n) || 0).toLocaleString('id-ID'); }

function NOW() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function genId() {
  return 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  return new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function openModal(id) {
  const m = g(id);
  if (m) { m.style.display = 'flex'; requestAnimationFrame(() => m.classList.add('on')); }
}

function closeModal(id) {
  const m = g(id);
  if (m) { m.classList.remove('on'); setTimeout(() => m.style.display = 'none', 180); }
}

function toast(msg, type) {
  const wrap = g('toast-wrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'err' ? ' toast-err' : type === 'warn' ? ' toast-warn' : '');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, 2800);
}

async function hashSecret(s) {
  const enc = new TextEncoder().encode(String(s));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _localYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToDate(iso) {
  // Return YYYY-MM-DD in the user's LOCAL timezone.
  // Slicing iso.slice(0,10) would give the UTC date, causing early-morning
  // WIB (UTC+7) orders to fall on the previous day and disappear from
  // "Hari Ini" filters.
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return _localYMD(d);
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=sun
  d.setDate(d.getDate() - day);
  return _localYMD(d);
}

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Check whether a local YYYY-MM-DD date falls in the requested period.
// `period` ∈ 'today' | 'week' | 'month' | 'custom' | 'all'.
function isInPeriod(dateISO, period, customFrom, customTo) {
  if (!dateISO) return false;
  if (period === 'today') return dateISO === todayISO();
  if (period === 'week') return dateISO >= getWeekStart();
  if (period === 'month') return dateISO >= getMonthStart();
  if (period === 'custom') {
    if (customFrom && dateISO < customFrom) return false;
    if (customTo && dateISO > customTo) return false;
    return true;
  }
  return true; // 'all'
}

function periodLabel(period, from, to) {
  const map = { today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', all: 'Semua' };
  if (period === 'custom') {
    if (from && to) return from + ' → ' + to;
    if (from) return 'Sejak ' + from;
    if (to) return 'Sampai ' + to;
    return 'Custom (pilih tanggal)';
  }
  return map[period] || '';
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

function seedData() {
  menuCats = [
    { id: 'cat1', name: 'Makanan', order: 1 },
    { id: 'cat2', name: 'Minuman', order: 2 },
    { id: 'cat3', name: 'Dessert', order: 3 }
  ];
  menuItems = [
    { id: 'mn1', name: 'Nasi Goreng', price: 25000, catId: 'cat1', desc: '', active: true },
    { id: 'mn2', name: 'Ayam Bakar', price: 35000, catId: 'cat1', desc: '', active: true },
    { id: 'mn3', name: 'Mie Goreng', price: 22000, catId: 'cat1', desc: '', active: true },
    { id: 'mn4', name: 'Soto Ayam', price: 28000, catId: 'cat1', desc: '', active: true },
    { id: 'mn5', name: 'Es Teh Manis', price: 8000, catId: 'cat2', desc: '', active: true },
    { id: 'mn6', name: 'Kopi Hitam', price: 10000, catId: 'cat2', desc: '', active: true },
    { id: 'mn7', name: 'Jus Jeruk', price: 15000, catId: 'cat2', desc: '', active: true },
    { id: 'mn8', name: 'Es Campur', price: 20000, catId: 'cat3', desc: '', active: true },
    { id: 'mn9', name: 'Puding', price: 12000, catId: 'cat3', desc: '', active: true }
  ];
  menuCtr = 10; catCtr = 4;
  promos = [{ id: 'pr1', name: 'Diskon Weekday', catId: 'all', discType: 'persen', discVal: 10, days: ['1', '2', '3', '4', '5'], from: '', to: '', active: true, note: '10% off setiap hari kerja' }];
  promoCtr = 2;
  outlets = [{ id: 'o1', name: 'Pusat', addr: '' }];
  outCtr = 2;
  employees = [{ id: 'e1', name: 'Budi', pin: '0000', oid: 'o1', role: 'Kasir' }];
  empCtr = 2;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function goLogin() {
  // Setelah auth berhasil, tampilkan role picker
  g('app').style.display = 'none';
  _hideAllScr();
  g('scr-login').style.display = 'flex';
}

function _hideAllScr() {
  ['scr-code','scr-login','scr-opwd','scr-outlet','scr-staff','scr-pin'].forEach(id => {
    const el = g(id); if (el) el.style.display = 'none';
  });
}

// ─── Kode Toko ────────────────────────────────────────────────────────────────

function showCodeScreen() {
  g('app').style.display = 'none';
  _hideAllScr();
  const scr = g('scr-code'); if (scr) scr.style.display = 'flex';
  setTimeout(() => g('inp-code')?.focus(), 150);
}

function _setCodeErr(msg) {
  const el = g('scr-code-err'); if (!el) return;
  el.textContent = msg; el.style.display = msg ? '' : 'none';
}

async function doEnterCode() {
  const code = (g('inp-code')?.value || '').trim().toUpperCase();
  if (!code || code.length < 4) { _setCodeErr('Kode minimal 4 karakter'); return; }
  const btn = document.querySelector('#scr-code button.scr-btn');
  const origLabel = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Memverifikasi...'; }
  _setCodeErr('');
  const res = await checkStoreCode(code);
  if (btn) { btn.disabled = false; btn.textContent = origLabel || 'Masuk'; }
  if (!res.valid) {
    _setCodeErr(res.error || 'Kode toko tidak valid. Hubungi admin untuk mendapatkan kode.');
    return;
  }
  saveStoreCode(code);
  loadLocalSettings();
  supaLoadAll().catch(() => {});
  goLogin();
}

function doLogout() {
  curRole = null; curStaff = null;
  clearStoreCode();
  showCodeScreen();
}

function goOwnerLogin() {
  _hideAllScr();
  g('scr-opwd').style.display = 'flex';
  g('inp-opwd').value = '';
  setTimeout(() => g('inp-opwd').focus(), 100);
}

async function doOwnerLogin() {
  const val = g('inp-opwd').value.trim();
  if (!val) { toast('Masukkan kata sandi', 'err'); return; }
  const hashed = await hashSecret(val);
  // Check against stored password (may be plain '1234' on first run, or hashed)
  let match = false;
  if (ownerPwd.length === 64) {
    // stored as hash
    match = hashed === ownerPwd;
  } else {
    // stored as plain (legacy / default)
    match = val === ownerPwd;
  }
  if (!match) { toast('Kata sandi salah', 'err'); g('inp-opwd').value = ''; return; }
  curRole = 'owner';
  curStaff = null;
  _launchApp();
}

function goStaffLogin() {
  _hideAllScr();
  g('scr-outlet').style.display = 'flex';
  renderOutletBtns();
}

function renderOutletBtns() {
  const wrap = g('outlet-btns');
  if (!wrap) return;
  if (!outlets.length) {
    wrap.innerHTML = '<p style="color:rgba(255,255,255,.5);font-size:13px;text-align:center">Belum ada outlet</p>';
    return;
  }
  wrap.innerHTML = outlets.map(o =>
    `<button class="scr-btn" onclick="pickOutlet('${o.id}')">${esc(o.name)}</button>`
  ).join('');
}

function pickOutlet(oid) {
  staffOutletId = oid;
  _hideAllScr();
  g('scr-staff').style.display = 'flex';
  buildStaffBtns(oid);
}

function buildStaffBtns(oid) {
  const wrap = g('staff-btns');
  const outName = outlets.find(o => o.id === oid)?.name || '';
  const el = g('staff-outlet-name');
  if (el) el.textContent = outName;
  if (!wrap) return;
  const emps = employees.filter(e => e.oid === oid);
  if (!emps.length) {
    wrap.innerHTML = '<p style="color:rgba(255,255,255,.5);font-size:13px;text-align:center">Belum ada karyawan di outlet ini</p>';
    return;
  }
  wrap.innerHTML = emps.map(e =>
    `<button class="scr-btn" onclick="pickStaff('${e.id}')">${esc(e.name)}</button>`
  ).join('');
}

function pickStaff(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;
  curStaff = emp;
  pinEntry = '';
  _hideAllScr();
  g('scr-pin').style.display = 'flex';
  const el = g('pin-staff-name');
  if (el) el.textContent = emp.name;
  renderPinDots();
}

function renderPinDots() {
  const dots = g('pin-dots');
  if (!dots) return;
  dots.innerHTML = [0, 1, 2, 3].map(i =>
    `<div class="pin-dot ${i < pinEntry.length ? 'filled' : ''}"></div>`
  ).join('');
}

function kp(n) {
  if (n === 'del') {
    pinEntry = pinEntry.slice(0, -1);
  } else {
    if (pinEntry.length >= 4) return;
    pinEntry += String(n);
  }
  renderPinDots();
  if (pinEntry.length === 4) {
    setTimeout(chkPin, 100);
  }
}

function chkPin() {
  if (!curStaff) return;
  if (pinEntry === curStaff.pin) {
    curRole = 'staff';
    _launchApp();
  } else {
    toast('PIN salah', 'err');
    pinEntry = '';
    renderPinDots();
  }
}

function _launchApp() {
  _hideAllScr();
  g('app').style.display = 'flex';
  _updateUserBadge();
  _applyRoleAccess();
  // Karyawan langsung ke POS, owner ke dashboard
  goPage(curRole === 'staff' ? 'pos' : 'dashboard');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _applyRoleAccess() {
  const isStaff = curRole === 'staff';
  // Toggle class di body untuk mobile CSS
  document.body.classList.toggle('is-staff', isStaff);
  // Nav item yang boleh diakses karyawan (hanya POS)
  const staffAllowed = ['pos'];
  document.querySelectorAll('#sbnav .ni').forEach(el => {
    const page = el.getAttribute('data-page');
    if (!page) return;
    el.style.display = (isStaff && !staffAllowed.includes(page)) ? 'none' : '';
  });
}

function _updateUserBadge() {
  const el = g('user-badge');
  if (!el) return;
  if (curRole === 'owner') {
    el.textContent = 'Owner';
  } else if (curStaff) {
    el.textContent = curStaff.name;
  }
}

function logout() {
  // Logout dari role saja (kembali ke role picker, tidak keluar dari akun)
  curRole = null;
  curStaff = null;
  goLogin();
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function goPage(page, btn) {
  curPage = page;
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const el = g('p-' + page);
  if (el) el.style.display = 'block';
  // Sync sidebar nav
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  document.querySelectorAll(`.ni[data-page="${page}"]`).forEach(n => n.classList.add('on'));
  // Close sidebar on mobile after navigation
  closeSidebar();
  const renders = {
    dashboard: refreshDash, orders: renderOrders, kas: renderKas,
    menu: renderMenuPage, promo: renderPromo, settings: renderSettings, pos: renderPOS,
    report: renderReport
  };
  if (renders[page]) renders[page]();
}

function toggleSidebar() {
  const sb = g('sbnav'), ov = g('sb-overlay');
  if (!sb) return;
  const isOpen = sb.classList.contains('mob-open');
  if (isOpen) { sb.classList.remove('mob-open'); ov.classList.remove('on'); }
  else { sb.classList.add('mob-open'); ov.classList.add('on'); }
}

function closeSidebar() {
  const sb = g('sbnav'), ov = g('sb-overlay');
  if (sb) sb.classList.remove('mob-open');
  if (ov) ov.classList.remove('on');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function refreshDash() {
  // Toggle custom row visibility + sync inputs
  const cr = g('dash-custom-row');
  if (cr) cr.style.display = (dashPeriod === 'custom') ? '' : 'none';
  const cf = g('dash-from'); if (cf && cf.value !== dashFrom) cf.value = dashFrom;
  const ct = g('dash-to'); if (ct && ct.value !== dashTo) ct.value = dashTo;

  // Header date
  const dateEl = g('dash-date');
  if (dateEl) {
    const lbl = periodLabel(dashPeriod, dashFrom, dashTo);
    dateEl.textContent = lbl + ' · ' + new Date().toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  }

  const ords = _ordersInPeriod();
  const revenue = ords.filter(o => o.payStatus === 'Lunas').reduce((s, o) => s + (o.total || 0), 0);
  const count = ords.length;
  const avg = count > 0 ? Math.round(revenue / count) : 0;

  const se = (id, v) => { const el = g(id); if (el) el.textContent = v; };
  se('d-revenue', fmt(revenue));
  const sub = g('d-revenue-sub');
  if (sub) sub.textContent = count + ' pesanan · rata-rata ' + fmt(avg);
  se('d-count', count);

  // Payment breakdown
  const tunai = ords.filter(o => o.payMethod === 'Tunai').reduce((s, o) => s + o.total, 0);
  const nonTunai = ords.filter(o => o.payMethod === 'Transfer' || o.payMethod === 'QRIS').reduce((s, o) => s + o.total, 0);
  se('d-tunai', fmt(tunai));
  se('d-nontunai', fmt(nonTunai));

  // Top items
  const top = _topItems(ords);
  // Inline badge (cell di grid stat "Menu Terlaris")
  const inlineEl = g('d-top-item-inline');
  if (inlineEl) inlineEl.textContent = top.length ? top[0].name + ' (' + top[0].qty + 'x)' : '—';

  // Chart
  _renderDashChart(ords);
}

function _ordersInPeriod() {
  return orders.filter(o => {
    const d = isoToDate(o.isoDate) || o.date;
    return isInPeriod(d, dashPeriod, dashFrom, dashTo);
  });
}

function _topItems(ords) {
  const map = {};
  ords.forEach(o => {
    (o.items || []).forEach(it => {
      if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, rev: 0 };
      map[it.name].qty += it.qty || 1;
      map[it.name].rev += it.lineTotal || 0;
    });
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
}

function _renderDashChart(ords) {
  const canvas = g('dash-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Group by date (last 7 days)
  const days = [];
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = _localYMD(d);
    const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const rev = orders
      .filter(o => isoToDate(o.isoDate) === iso && o.payStatus === 'Lunas')
      .reduce((s, o) => s + o.total, 0);
    days.push(rev);
    labels.push(label);
  }

  if (dashChart) { dashChart.destroy(); dashChart = null; }

  dashChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Pendapatan',
        data: days,
        backgroundColor: '#2563EB99',
        borderColor: '#2563EB',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: {
        y: { ticks: { callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'k', font: { size: 11 } }, grid: { color: '#E2E8F0' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function setDashPeriod(p) {
  dashPeriod = p;
  document.querySelectorAll('.dtab-btn').forEach(b => b.classList.remove('on'));
  const btn = g('dp-' + p);
  if (btn) btn.classList.add('on');
  refreshDash();
}

function applyDashCustom() {
  dashFrom = (g('dash-from')?.value || '').trim();
  dashTo = (g('dash-to')?.value || '').trim();
  if (dashFrom && dashTo && dashFrom > dashTo) { toast('Tanggal awal harus sebelum tanggal akhir', 'warn'); return; }
  dashPeriod = 'custom';
  document.querySelectorAll('.dtab-btn').forEach(b => b.classList.remove('on'));
  const btn = g('dp-custom'); if (btn) btn.classList.add('on');
  refreshDash();
}

// ─── Orders ───────────────────────────────────────────────────────────────────

function renderOrders() {
  // Toggle custom row + sync inputs
  const cr = g('ord-custom-row');
  if (cr) cr.style.display = (ordDateFilter === 'custom') ? '' : 'none';
  const cf = g('ord-from'); if (cf && cf.value !== ordFrom) cf.value = ordFrom;
  const ct = g('ord-to'); if (ct && ct.value !== ordTo) ct.value = ordTo;

  let filtered = orders.filter(o => {
    const d = isoToDate(o.isoDate) || '';
    return isInPeriod(d, ordDateFilter, ordFrom, ordTo);
  });

  const total = filtered.length;
  const pages = Math.ceil(total / 15) || 1;
  if (ordPage > pages) ordPage = pages;

  const paginated = filtered.slice((ordPage - 1) * 15, ordPage * 15);

  const el = g('orders-list');
  if (!el) return;

  if (!paginated.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada pesanan</p></div>';
  } else {
    el.innerHTML = paginated.map(o => `
      <div class="order-card" onclick="openOrderDetail('${esc(o.id)}')">
        <div class="order-card-header">
          <span class="order-id">${esc(o.id)}</span>
          <span class="badge ${o.payStatus === 'Lunas' ? 'badge-gr' : 'badge-re'}">${esc(o.payStatus)}</span>
        </div>
        <div class="order-card-body">
          <span class="order-meta">${esc(o.date)}${o.custName ? ' &bull; ' + esc(o.custName) : ''}${o.tableNo ? ' &bull; Meja ' + esc(o.tableNo) : ''}</span>
          <span class="order-total">${fmt(o.total)}</span>
        </div>
        <div class="order-card-footer">
          <span class="order-pay-method">${esc(o.payMethod)}</span>
        </div>
      </div>
    `).join('');
  }

  // Pagination
  const pgEl = g('orders-pagination');
  if (pgEl) {
    if (pages <= 1) { pgEl.innerHTML = ''; }
    else {
      pgEl.innerHTML = `
        <button class="pg-btn" onclick="ordGo(${ordPage - 1})" ${ordPage <= 1 ? 'disabled' : ''}>Sebelumnya</button>
        <span class="pg-info">Hal ${ordPage} / ${pages}</span>
        <button class="pg-btn" onclick="ordGo(${ordPage + 1})" ${ordPage >= pages ? 'disabled' : ''}>Berikutnya</button>
      `;
    }
  }

  // Summary
  const sumEl = g('orders-summary');
  if (sumEl) {
    const totalRev = filtered.filter(o => o.payStatus === 'Lunas').reduce((s, o) => s + o.total, 0);
    sumEl.textContent = `${total} pesanan | Total: ${fmt(totalRev)}`;
  }
}

function ordGo(p) { ordPage = p; renderOrders(); }

function applyOrdCustom() {
  ordFrom = (g('ord-from')?.value || '').trim();
  ordTo = (g('ord-to')?.value || '').trim();
  if (ordFrom && ordTo && ordFrom > ordTo) { toast('Tanggal awal harus sebelum tanggal akhir', 'warn'); return; }
  ordDateFilter = 'custom';
  ordPage = 1;
  document.querySelectorAll('.ord-date-btn').forEach(b => b.classList.remove('on'));
  const btn = g('odf-custom'); if (btn) btn.classList.add('on');
  renderOrders();
}

function setOrdDateFilter(v) {
  ordDateFilter = v;
  ordPage = 1;
  document.querySelectorAll('.ord-date-btn').forEach(b => b.classList.remove('on'));
  const btn = g('odf-' + v);
  if (btn) btn.classList.add('on');
  renderOrders();
}

function openOrderDetail(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  const el = g('m-order-detail-body');
  if (!el) return;
  el.innerHTML = `
    <div class="detail-section">
      <div class="detail-row"><span class="dr-label">ID Pesanan</span><span class="dr-val mono">${esc(o.id)}</span></div>
      <div class="detail-row"><span class="dr-label">Tanggal</span><span class="dr-val">${esc(o.date)}</span></div>
      ${o.custName ? `<div class="detail-row"><span class="dr-label">Pelanggan</span><span class="dr-val">${esc(o.custName)}</span></div>` : ''}
      ${o.tableNo ? `<div class="detail-row"><span class="dr-label">Meja</span><span class="dr-val">${esc(o.tableNo)}</span></div>` : ''}
      ${o.handledBy ? `<div class="detail-row"><span class="dr-label">Kasir</span><span class="dr-val">${esc(o.handledBy)}</span></div>` : ''}
      ${o.notes ? `<div class="detail-row"><span class="dr-label">Catatan</span><span class="dr-val">${esc(o.notes)}</span></div>` : ''}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Item Pesanan</div>
      ${(o.items || []).map(it => `
        <div class="detail-item-row">
          <span class="di-name">${esc(it.name)}</span>
          <span class="di-qty">${it.qty}x</span>
          <span class="di-price">${fmt(it.lineTotal)}</span>
        </div>
      `).join('')}
    </div>
    <div class="detail-section">
      <div class="detail-row"><span class="dr-label">Subtotal</span><span class="dr-val">${fmt(o.subtotal)}</span></div>
      ${o.promoAmt > 0 ? `<div class="detail-row"><span class="dr-label" style="color:var(--gr)">Diskon Promo</span><span class="dr-val" style="color:var(--gr)">-${fmt(o.promoAmt)}</span></div>` : ''}
      <div class="detail-row bold"><span class="dr-label">Total</span><span class="dr-val">${fmt(o.total)}</span></div>
      <div class="detail-row"><span class="dr-label">Metode Bayar</span><span class="dr-val">${esc(o.payMethod)}</span></div>
    </div>
    <div class="detail-actions">
      <div class="detail-badges">
        <span class="badge ${o.payStatus === 'Lunas' ? 'badge-gr' : 'badge-re'}">${esc(o.payStatus)}</span>
      </div>
      <div class="detail-btns">
        ${o.payStatus !== 'Lunas' ? `<button class="btn btn-sm btn-p" onclick="setOrderPayStatus('${esc(o.id)}','Lunas');closeModal('m-order-detail')">Tandai Lunas</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteOrder('${esc(o.id)}')">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i> Hapus Pesanan
        </button>
      </div>
    </div>
  `;
  openModal('m-order-detail');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function deleteOrder(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  if (!confirm('Hapus pesanan ' + id + '? Entri kas terkait juga akan dihapus.')) return;

  // Remove from local state + persist
  orders = orders.filter(x => x.id !== id);
  syncAllOrders();
  if (typeof sbDelete === 'function') sbDelete('orders', id);

  // Also remove auto-generated kas entries linked to this order
  const kasTag = 'Penjualan - ' + id;
  const kasToDelete = kasLog.filter(k => k.desc === kasTag);
  if (kasToDelete.length) {
    kasLog = kasLog.filter(k => k.desc !== kasTag);
    syncAllKas();
    if (typeof sbDelete === 'function') {
      kasToDelete.forEach(k => sbDelete('kas_log', k.id));
    }
  }

  closeModal('m-order-detail');
  toast('Pesanan dihapus');
  renderOrders();
  if (curPage === 'kas' && typeof renderKas === 'function') renderKas();
  if (curPage === 'dashboard' && typeof refreshDash === 'function') refreshDash();
}

function setOrderPayStatus(id, ps) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  const wasUnpaid = o.payStatus !== 'Lunas';
  o.payStatus = ps;
  syncOrder(o);
  // Auto kas entry for cash payments
  if (ps === 'Lunas' && o.payMethod === 'Tunai' && wasUnpaid) {
    const kasEntry = {
      id: 'k' + kasCtr++,
      type: 'in',
      desc: 'Penjualan - ' + o.id,
      note: o.custName || '',
      amount: o.total,
      time: NOW(),
      date: todayISO(),
      outlet_id: o.outletId || ''
    };
    kasLog.unshift(kasEntry);
    syncKas(kasEntry);
  }
  toast('Pembayaran: ' + ps);
  renderOrders();
}

// ─── Kas ──────────────────────────────────────────────────────────────────────

function renderKas() {
  const today = todayISO();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  let filtered = kasLog.filter(l => {
    const d = l.date || '';
    if (kasDateFilter === 'today') return d === today;
    if (kasDateFilter === 'week') return d >= weekStart;
    if (kasDateFilter === 'month') return d >= monthStart;
    return true;
  });

  const totalIn = filtered.filter(l => l.type === 'in').reduce((s, l) => s + (l.amount || 0), 0);
  const totalOut = filtered.filter(l => l.type === 'out').reduce((s, l) => s + (l.amount || 0), 0);
  const balance = totalIn - totalOut;

  const se = (id, v) => { const el = g(id); if (el) el.textContent = v; };
  se('kas-balance', fmt(balance));
  se('kas-in', fmt(totalIn));
  se('kas-out', fmt(totalOut));

  // Group by date
  const byDate = {};
  filtered.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });

  const el = g('kas-list');
  if (!el) return;

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  if (!dates.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada transaksi kas</p></div>';
    return;
  }

  el.innerHTML = dates.map(date => {
    const entries = byDate[date];
    const displayDate = (() => {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    })();
    return `
      <div class="kas-date-group">
        <div class="kas-date-header">${displayDate}</div>
        ${entries.map(l => `
          <div class="kas-entry ${l.type === 'out' ? 'kas-out' : 'kas-in'}">
            <div class="kas-entry-info">
              <span class="kas-entry-desc">${esc(l.desc)}</span>
              ${l.note ? `<span class="kas-entry-note">${esc(l.note)}</span>` : ''}
            </div>
            <div class="kas-entry-right">
              <span class="kas-entry-amt">${l.type === 'out' ? '-' : '+'}${fmt(l.amount)}</span>
              <span class="kas-entry-time">${esc(l.time || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function setKasDateFilter(v) {
  kasDateFilter = v;
  document.querySelectorAll('.kas-date-btn').forEach(b => b.classList.remove('on'));
  const btn = g('kdf-' + v);
  if (btn) btn.classList.add('on');
  renderKas();
}

function openKasTambah(type) {
  editCatId = null;
  const typeEl = g('kas-form-type');
  if (typeEl) typeEl.value = type;
  const titleEl = g('kas-form-title');
  if (titleEl) titleEl.textContent = type === 'in' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran';
  g('kas-desc').value = '';
  g('kas-amount').value = '';
  g('kas-note-inp').value = '';
  openModal('m-kas');
}

function submitKas() {
  const type = g('kas-form-type').value;
  const desc = g('kas-desc').value.trim();
  const amount = parseInt(g('kas-amount').value) || 0;
  const note = g('kas-note-inp').value.trim();
  if (!desc) { toast('Isi deskripsi', 'err'); return; }
  if (!amount) { toast('Isi jumlah', 'err'); return; }
  const outId = curStaff?.oid || outlets[0]?.id || '';
  const entry = {
    id: 'k' + kasCtr++,
    type,
    desc,
    note,
    amount,
    time: NOW(),
    date: todayISO(),
    outlet_id: outId
  };
  kasLog.unshift(entry);
  syncKas(entry);
  closeModal('m-kas');
  toast('Entri kas ditambahkan');
  renderKas();
}

// ─── Promo ────────────────────────────────────────────────────────────────────

function renderPromo() {
  const el = g('promo-list');
  if (!el) return;

  if (!promos.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada promo</p></div>';
    return;
  }

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  el.innerHTML = promos.map(p => {
    const isBG = p.discType === 'beli_gratis';
    const catName = p.catId === 'all' ? 'Semua Kategori' : (menuCats.find(c => c.id === p.catId)?.name || p.catId);
    const discStr = isBG ? _promoBeliGratisLabel(p) : (p.discType === 'persen' ? p.discVal + '%' : fmt(p.discVal));
    const daysStr = (p.days || []).map(d => dayNames[parseInt(d)] || d).join(', ');
    const dateStr = p.from || p.to ? `${p.from || '...'} s/d ${p.to || '...'}` : '';
    return `
      <div class="promo-card ${p.active ? '' : 'promo-inactive'}">
        <div class="promo-card-header">
          <div class="promo-card-title">${esc(p.name)}</div>
          <div class="promo-card-actions">
            <label class="toggle">
              <input type="checkbox" ${p.active ? 'checked' : ''} onchange="togglePromo('${p.id}')">
              <span class="toggle-slider"></span>
            </label>
            <button class="icon-btn" onclick="openEditPromo('${p.id}')"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
            <button class="icon-btn icon-btn-danger" onclick="delPromo('${p.id}')"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
          </div>
        </div>
        <div class="promo-card-body">
          ${isBG
            ? `<div class="promo-meta" style="grid-column:1/-1"><span>Promo:</span><strong>${esc(discStr)}</strong></div>`
            : `<div class="promo-meta"><span>Kategori:</span><strong>${esc(catName)}</strong></div>
               <div class="promo-meta"><span>Diskon:</span><strong>${discStr}</strong></div>`
          }
          <div class="promo-meta"><span>Hari:</span><strong>${daysStr || 'Setiap hari'}</strong></div>
          ${dateStr ? `<div class="promo-meta"><span>Periode:</span><strong>${dateStr}</strong></div>` : ''}
          ${p.note ? `<div class="promo-note">${esc(p.note)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAddPromo() {
  editPromoId = null;
  g('promo-name').value = '';
  g('promo-cat').value = 'all';
  g('promo-disc-type').value = 'persen';
  g('promo-disc-val').value = '';
  g('promo-from').value = '';
  g('promo-to').value = '';
  g('promo-note').value = '';
  g('promo-buy-qty').value = '2';
  g('promo-free-qty').value = '1';
  _bgBuyType = 'item';
  _bgFreeType = 'item';
  document.querySelectorAll('.promo-day-cb').forEach(cb => cb.checked = false);
  g('m-promo-title').textContent = 'Tambah Promo';
  _buildPromoCatOptions();
  onPromoDiscTypeChange();
  openModal('m-promo');
}

function openEditPromo(id) {
  const p = promos.find(x => x.id === id);
  if (!p) return;
  editPromoId = id;
  g('promo-name').value = p.name;
  g('promo-disc-type').value = p.discType;
  g('promo-disc-val').value = p.discVal || '';
  g('promo-from').value = p.from || '';
  g('promo-to').value = p.to || '';
  g('promo-note').value = p.note || '';
  g('promo-buy-qty').value = p.buyQty || 2;
  g('promo-free-qty').value = p.freeQty || 1;
  document.querySelectorAll('.promo-day-cb').forEach(cb => {
    cb.checked = (p.days || []).includes(cb.value);
  });
  g('m-promo-title').textContent = 'Edit Promo';
  _buildPromoCatOptions(p.catId);
  onPromoDiscTypeChange();
  if (p.discType === 'beli_gratis') {
    _bgBuyType = p.buyType || 'item';
    _bgFreeType = p.freeType || 'item';
    _rebuildPromoItemSelects();
    setTimeout(() => {
      _setBuyType(_bgBuyType);
      _setFreeType(_bgFreeType);
      if (_bgBuyType === 'cat') {
        if (p.buyCatId && g('promo-buy-cat')) g('promo-buy-cat').value = p.buyCatId;
      } else {
        if (p.buyItemId && g('promo-buy-item')) g('promo-buy-item').value = p.buyItemId;
      }
      if (_bgFreeType === 'cat') {
        if (p.freeCatId && g('promo-free-cat')) g('promo-free-cat').value = p.freeCatId;
      } else {
        if (p.freeItemId && g('promo-free-item')) g('promo-free-item').value = p.freeItemId;
      }
      _updatePromoBeliGratisPreview();
    }, 0);
  }
  openModal('m-promo');
}

function _buildPromoCatOptions(selected) {
  const sel = g('promo-cat');
  if (!sel) return;
  sel.innerHTML = '<option value="all">Semua Kategori</option>' +
    menuCats.map(c => `<option value="${esc(c.id)}" ${selected === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  if (selected && selected !== 'all') sel.value = selected;
}

function onPromoDiscTypeChange() {
  const val = g('promo-disc-type')?.value;
  const isBG = val === 'beli_gratis';
  const catSec = g('promo-cat-section');
  const valSec = g('promo-disc-val-section');
  const bgSec  = g('promo-beli-gratis-section');
  if (catSec) catSec.style.display = isBG ? 'none' : '';
  if (valSec) valSec.style.display = isBG ? 'none' : '';
  if (bgSec)  bgSec.style.display  = isBG ? '' : 'none';
  if (isBG) _rebuildPromoItemSelects();
}

let _bgBuyType = 'item';  // 'item' | 'cat'
let _bgFreeType = 'item'; // 'item' | 'cat'

function _setBuyType(type) {
  _bgBuyType = type;
  g('bg-type-item')?.classList.toggle('on', type === 'item');
  g('bg-type-cat')?.classList.toggle('on', type === 'cat');
  const iw = g('bg-buy-item-wrap'), cw = g('bg-buy-cat-wrap');
  if (iw) iw.style.display = type === 'item' ? '' : 'none';
  if (cw) cw.style.display = type === 'cat' ? '' : 'none';
  _updatePromoBeliGratisPreview();
}

function _setFreeType(type) {
  _bgFreeType = type;
  g('bg-ftype-item')?.classList.toggle('on', type === 'item');
  g('bg-ftype-cat')?.classList.toggle('on', type === 'cat');
  const iw = g('bg-free-item-wrap'), cw = g('bg-free-cat-wrap');
  if (iw) iw.style.display = type === 'item' ? '' : 'none';
  if (cw) cw.style.display = type === 'cat' ? '' : 'none';
  _updatePromoBeliGratisPreview();
}

function _rebuildPromoItemSelects() {
  const itemOpts = menuItems.filter(m => m.active !== false)
    .map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`)
    .join('');
  ['promo-buy-item','promo-free-item'].forEach(id => { const el = g(id); if (el) el.innerHTML = itemOpts; });
  const catOpts = menuCats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  ['promo-buy-cat','promo-free-cat'].forEach(id => { const el = g(id); if (el) el.innerHTML = catOpts; });
  _updatePromoBeliGratisPreview();
}

function _updatePromoBeliGratisPreview() {
  const bq = parseInt(g('promo-buy-qty')?.value) || 1;
  const fq = parseInt(g('promo-free-qty')?.value) || 1;
  let buyLabel = '', freeLabel = '';
  if (_bgBuyType === 'cat') {
    const cat = menuCats.find(c => c.id === g('promo-buy-cat')?.value);
    buyLabel = cat ? `${bq}x item ${cat.name}` : '';
  } else {
    const bi = menuItems.find(m => m.id === g('promo-buy-item')?.value);
    buyLabel = bi ? `${bq}x ${bi.name}` : '';
  }
  if (_bgFreeType === 'cat') {
    const cat = menuCats.find(c => c.id === g('promo-free-cat')?.value);
    freeLabel = cat ? `${fq}x item ${cat.name}` : '';
  } else {
    const fi = menuItems.find(m => m.id === g('promo-free-item')?.value);
    freeLabel = fi ? `${fq}x ${fi.name}` : '';
  }
  const prev = g('promo-bg-preview');
  if (prev) prev.textContent = buyLabel && freeLabel ? `Beli ${buyLabel} → Gratis ${freeLabel}` : '';
}

function savePromo() {
  const name = g('promo-name').value.trim();
  const discType = g('promo-disc-type').value;
  const from = g('promo-from').value;
  const to = g('promo-to').value;
  const note = g('promo-note').value.trim();
  const days = Array.from(document.querySelectorAll('.promo-day-cb:checked')).map(cb => cb.value);

  if (!name) { toast('Isi nama promo', 'err'); return; }

  let promoData;
  if (discType === 'beli_gratis') {
    const buyQty = parseInt(g('promo-buy-qty')?.value) || 1;
    const freeQty = parseInt(g('promo-free-qty')?.value) || 1;
    const base = { name, discType, buyQty, freeQty, catId:'all', discVal:0, days, from, to, note };

    // Buy side
    if (_bgBuyType === 'cat') {
      const buyCatId = g('promo-buy-cat')?.value;
      if (!buyCatId) { toast('Pilih kategori pembelian', 'err'); return; }
      base.buyType = 'cat'; base.buyCatId = buyCatId;
    } else {
      const buyItemId = g('promo-buy-item')?.value;
      if (!buyItemId) { toast('Pilih item yang dibeli', 'err'); return; }
      base.buyType = 'item'; base.buyItemId = buyItemId;
    }

    // Free side
    if (_bgFreeType === 'cat') {
      const freeCatId = g('promo-free-cat')?.value;
      if (!freeCatId) { toast('Pilih kategori gratis', 'err'); return; }
      base.freeType = 'cat'; base.freeCatId = freeCatId;
    } else {
      const freeItemId = g('promo-free-item')?.value;
      if (!freeItemId) { toast('Pilih item gratis', 'err'); return; }
      base.freeType = 'item'; base.freeItemId = freeItemId;
    }
    promoData = base;
  } else {
    const catId = g('promo-cat').value;
    const discVal = parseFloat(g('promo-disc-val').value) || 0;
    if (!discVal) { toast('Isi nilai diskon', 'err'); return; }
    promoData = { name, catId, discType, discVal, days, from, to, note };
  }

  if (editPromoId) {
    const p = promos.find(x => x.id === editPromoId);
    if (p) Object.assign(p, promoData);
  } else {
    promos.push({ id: 'pr' + promoCtr++, ...promoData, active: true });
  }
  syncSettings();
  closeModal('m-promo');
  toast('Promo disimpan');
  renderPromo();
}

function togglePromo(id) {
  const p = promos.find(x => x.id === id);
  if (!p) return;
  p.active = !p.active;
  syncSettings();
  toast(p.active ? 'Promo diaktifkan' : 'Promo dinonaktifkan');
  renderPromo();
}

function delPromo(id) {
  if (!confirm('Hapus promo ini?')) return;
  promos = promos.filter(x => x.id !== id);
  syncSettings();
  toast('Promo dihapus');
  renderPromo();
}

function isPromoToday(p) {
  const day = String(new Date().getDay()); // 0=sun
  if (p.days && p.days.length && !p.days.includes(day)) return false;
  const today = todayISO();
  if (p.from && today < p.from) return false;
  if (p.to && today > p.to) return false;
  return true;
}

function getActivePromo(catId) {
  return promos.find(p => {
    if (!p.active) return false;
    if (!isPromoToday(p)) return false;
    if (p.catId !== 'all' && p.catId !== catId) return false;
    return true;
  }) || null;
}

function calcPromoDisc(p, subtotal) {
  if (!p) return 0;
  if (p.discType === 'persen') return Math.round(subtotal * p.discVal / 100);
  return Math.min(p.discVal, subtotal);
}

function calcBeliGratisDisc(promo, cart) {
  const getMatchIds = (type, itemId, catId) => {
    if (type === 'cat') return menuItems.filter(m => m.catId === catId).map(m => m.id);
    return itemId ? [itemId] : [];
  };
  const buyIds  = getMatchIds(promo.buyType,  promo.buyItemId,  promo.buyCatId);
  const freeIds = getMatchIds(promo.freeType || 'item', promo.freeItemId, promo.freeCatId);
  if (!buyIds.length || !freeIds.length) return 0;

  const buyItems  = cart.filter(c => buyIds.includes(c.id));
  const freeItems = cart.filter(c => freeIds.includes(c.id));

  const totalBuyQty = buyItems.reduce((s, c) => s + c.qty, 0);
  if (totalBuyQty < promo.buyQty) return 0;

  // Cek overlap: apakah buy dan free dari pool item yang sama?
  const overlap = buyIds.some(id => freeIds.includes(id));

  let sets;
  if (overlap) {
    // Pool sama → 1 set = (buyQty + freeQty) unit
    sets = Math.floor(totalBuyQty / (promo.buyQty + promo.freeQty));
  } else {
    // Pool beda → sets berdasarkan buy saja
    sets = Math.floor(totalBuyQty / promo.buyQty);
  }
  const maxFree = sets * promo.freeQty;
  if (maxFree <= 0) return 0;

  // Kumpulkan unit item free, urut termurah dulu (customer dapat yang termurah gratis)
  const freeUnits = [];
  freeItems.forEach(c => { for (let i = 0; i < c.qty; i++) freeUnits.push(c.price); });
  freeUnits.sort((a, b) => a - b);

  const actualFree = Math.min(maxFree, freeUnits.length);
  let disc = 0;
  for (let i = 0; i < actualFree; i++) disc += freeUnits[i];
  return disc;
}

function _promoBeliGratisLabel(p) {
  const buyLabel = p.buyType === 'cat'
    ? `${p.buyQty}x item ${menuCats.find(c => c.id === p.buyCatId)?.name || 'Kategori'}`
    : `${p.buyQty}x ${menuItems.find(m => m.id === p.buyItemId)?.name || '?'}`;
  const freeLabel = (p.freeType || 'item') === 'cat'
    ? `${p.freeQty}x item ${menuCats.find(c => c.id === p.freeCatId)?.name || 'Kategori'}`
    : `${p.freeQty}x ${menuItems.find(m => m.id === p.freeItemId)?.name || '?'}`;
  return `Beli ${buyLabel} → Gratis ${freeLabel}`;
}

// ─── Laporan Produk Terjual ──────────────────────────────────────────────────

function setRepPeriod(p) {
  repPeriod = p;
  document.querySelectorAll('#p-report .dtab-btn').forEach(b => b.classList.remove('on'));
  const btn = g('rp-' + p); if (btn) btn.classList.add('on');
  renderReport();
}

function applyRepCustom() {
  repFrom = (g('rep-from')?.value || '').trim();
  repTo = (g('rep-to')?.value || '').trim();
  if (repFrom && repTo && repFrom > repTo) { toast('Tanggal awal harus sebelum tanggal akhir', 'warn'); return; }
  repPeriod = 'custom';
  document.querySelectorAll('#p-report .dtab-btn').forEach(b => b.classList.remove('on'));
  const btn = g('rp-custom'); if (btn) btn.classList.add('on');
  renderReport();
}

function _reportData() {
  const ords = orders.filter(o => {
    const d = isoToDate(o.isoDate) || o.date;
    return isInPeriod(d, repPeriod, repFrom, repTo);
  });

  const byMenu = {};   // key = menu name (fallback if id missing) → { name, catId, qty, revenue }
  const byCat = {};    // key = catId → { name, qty, revenue }
  let totalItems = 0, totalRevenue = 0;

  ords.forEach(o => {
    (o.items || []).forEach(it => {
      const qty = Number(it.qty) || 0;
      const rev = Number(it.lineTotal) || 0;
      totalItems += qty;
      totalRevenue += rev;

      // Resolve category from live menu (items are order-time snapshots without catId)
      const menuRef = menuItems.find(m => m.id === it.id);
      const catId = menuRef ? menuRef.catId : '_unknown';

      const key = it.id || it.name;
      if (!byMenu[key]) byMenu[key] = { name: it.name, catId, qty: 0, revenue: 0 };
      byMenu[key].qty += qty;
      byMenu[key].revenue += rev;

      if (!byCat[catId]) {
        const c = menuCats.find(x => x.id === catId);
        byCat[catId] = { name: c ? c.name : 'Tanpa Kategori', qty: 0, revenue: 0 };
      }
      byCat[catId].qty += qty;
      byCat[catId].revenue += rev;
    });
  });

  return {
    orders: ords,
    orderCount: ords.length,
    totalItems,
    totalRevenue,
    menus: Object.values(byMenu).sort((a, b) => b.qty - a.qty),
    cats: Object.values(byCat).sort((a, b) => b.qty - a.qty)
  };
}

function renderReport() {
  // Toggle custom row + sync inputs
  const cr = g('rep-custom-row');
  if (cr) cr.style.display = (repPeriod === 'custom') ? '' : 'none';
  const cf = g('rep-from'); if (cf && cf.value !== repFrom) cf.value = repFrom;
  const ct = g('rep-to'); if (ct && ct.value !== repTo) ct.value = repTo;

  const lbl = g('rep-period-label');
  if (lbl) lbl.textContent = 'Periode: ' + periodLabel(repPeriod, repFrom, repTo);

  const data = _reportData();

  const se = (id, v) => { const el = g(id); if (el) el.textContent = v; };
  se('rep-revenue', fmt(data.totalRevenue));
  se('rep-orders', data.orderCount);
  se('rep-items', data.totalItems);
  se('rep-uniq', data.menus.length);

  // Menu table
  const menuEl = g('rep-menu-table');
  if (menuEl) {
    if (!data.menus.length) {
      menuEl.innerHTML = '<div class="rep-empty">Belum ada penjualan pada periode ini</div>';
    } else {
      const rows = data.menus.map((m, i) => {
        const catName = m.catId === '_unknown'
          ? '—'
          : (menuCats.find(c => c.id === m.catId)?.name || '—');
        return `<tr>
          <td class="rank">${i + 1}</td>
          <td>${esc(m.name)}</td>
          <td>${esc(catName)}</td>
          <td class="num">${m.qty}</td>
          <td class="num">${fmt(m.revenue)}</td>
        </tr>`;
      }).join('');
      menuEl.innerHTML = `<table class="rep-tbl">
        <thead><tr>
          <th class="rank">#</th><th>Nama Menu</th><th>Kategori</th>
          <th class="num">Qty</th><th class="num">Pendapatan</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row"><td colspan="3">TOTAL</td>
            <td class="num">${data.totalItems}</td>
            <td class="num">${fmt(data.totalRevenue)}</td></tr>
        </tbody>
      </table>`;
    }
  }

  // Category table
  const catEl = g('rep-cat-table');
  if (catEl) {
    if (!data.cats.length) {
      catEl.innerHTML = '<div class="rep-empty">Belum ada data</div>';
    } else {
      const rows = data.cats.map((c, i) =>
        `<tr>
          <td class="rank">${i + 1}</td>
          <td>${esc(c.name)}</td>
          <td class="num">${c.qty}</td>
          <td class="num">${fmt(c.revenue)}</td>
        </tr>`
      ).join('');
      catEl.innerHTML = `<table class="rep-tbl">
        <thead><tr>
          <th class="rank">#</th><th>Kategori</th>
          <th class="num">Qty</th><th class="num">Pendapatan</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row"><td colspan="2">TOTAL</td>
            <td class="num">${data.totalItems}</td>
            <td class="num">${fmt(data.totalRevenue)}</td></tr>
        </tbody>
      </table>`;
    }
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function exportReportCSV(kind) {
  const data = _reportData();
  const rows = [];
  const lbl = periodLabel(repPeriod, repFrom, repTo);
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === 'menu') {
    rows.push(['#', 'Nama Menu', 'Kategori', 'Qty', 'Pendapatan']);
    data.menus.forEach((m, i) => {
      const catName = m.catId === '_unknown' ? '—' : (menuCats.find(c => c.id === m.catId)?.name || '—');
      rows.push([i + 1, m.name, catName, m.qty, m.revenue]);
    });
    rows.push(['', 'TOTAL', '', data.totalItems, data.totalRevenue]);
  } else {
    rows.push(['#', 'Kategori', 'Qty', 'Pendapatan']);
    data.cats.forEach((c, i) => rows.push([i + 1, c.name, c.qty, c.revenue]));
    rows.push(['', 'TOTAL', data.totalItems, data.totalRevenue]);
  }

  const csv = rows.map(r =>
    r.map(v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')
  ).join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-${kind}-${stamp}-${(lbl || '').replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV diunduh');
}

// ─── Menu Management ─────────────────────────────────────────────────────────

function renderMenuPage() {
  _renderMenuTabs();
  if (menuTab === 'cat') {
    renderCatList();
  } else {
    renderMenuList();
  }
}

function _renderMenuTabs() {
  document.querySelectorAll('.menu-tab-btn').forEach(b => b.classList.remove('on'));
  const btn = g('mtab-' + menuTab);
  if (btn) btn.classList.add('on');
  const catPanel = g('menu-cat-panel');
  const menuPanel = g('menu-item-panel');
  if (catPanel) catPanel.style.display = menuTab === 'cat' ? '' : 'none';
  if (menuPanel) menuPanel.style.display = menuTab === 'menu' ? '' : 'none';
}

function switchMenuTab(tab) {
  menuTab = tab;
  _renderMenuTabs();
  if (tab === 'cat') renderCatList();
  else renderMenuList();
}

function renderCatList() {
  const el = g('cat-list');
  if (!el) return;
  if (!menuCats.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada kategori</p></div>';
    return;
  }
  el.innerHTML = menuCats.map(c => `
    <div class="list-item">
      <span class="list-item-name">${esc(c.name)}</span>
      <div class="list-item-actions">
        <button class="icon-btn" onclick="openEditCat('${c.id}')"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
        <button class="icon-btn icon-btn-danger" onclick="delCat('${c.id}')"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
      </div>
    </div>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onMenuSearch(val) {
  menuSearch = (val || '').trim().toLowerCase();
  renderMenuList();
}

function renderMenuList() {
  const el = g('menu-item-list');
  if (!el) return;

  // Category filter buttons
  const filterEl = g('menu-cat-filter');
  if (filterEl) {
    filterEl.innerHTML = `<button class="filter-btn ${menuFilterCat === 'all' ? 'on' : ''}" onclick="setMenuCatFilter('all')">Semua</button>` +
      menuCats.map(c => `<button class="filter-btn ${menuFilterCat === c.id ? 'on' : ''}" onclick="setMenuCatFilter('${c.id}')">${esc(c.name)}</button>`).join('');
  }

  let filtered = menuFilterCat === 'all' ? menuItems : menuItems.filter(m => m.catId === menuFilterCat);
  if (menuSearch) {
    filtered = filtered.filter(m => (m.name || '').toLowerCase().includes(menuSearch) || (m.desc || '').toLowerCase().includes(menuSearch));
  }

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><p>' + (menuSearch ? 'Tidak ada menu cocok dengan pencarian' : 'Belum ada menu') + '</p></div>';
    return;
  }

  el.innerHTML = filtered.map(m => {
    const cat = menuCats.find(c => c.id === m.catId);
    return `
      <div class="list-item ${m.active ? '' : 'item-inactive'}">
        <div class="list-item-info">
          <span class="list-item-name">${esc(m.name)}</span>
          <span class="list-item-sub">${cat ? esc(cat.name) : ''} &bull; ${fmt(m.price)}</span>
        </div>
        <div class="list-item-actions">
          <label class="toggle">
            <input type="checkbox" ${m.active ? 'checked' : ''} onchange="toggleMenuItem('${m.id}')">
            <span class="toggle-slider"></span>
          </label>
          <button class="icon-btn" onclick="openEditItem('${m.id}')"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
          <button class="icon-btn icon-btn-danger" onclick="delMenuItem('${m.id}')"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
        </div>
      </div>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setMenuCatFilter(catId) {
  menuFilterCat = catId;
  renderMenuList();
}

function openAddCat() {
  editCatId = null;
  g('cat-name').value = '';
  g('m-cat-title').textContent = 'Tambah Kategori';
  openModal('m-cat');
}

function openEditCat(id) {
  const c = menuCats.find(x => x.id === id);
  if (!c) return;
  editCatId = id;
  g('cat-name').value = c.name;
  g('m-cat-title').textContent = 'Edit Kategori';
  openModal('m-cat');
}

function saveCat() {
  const name = g('cat-name').value.trim();
  if (!name) { toast('Isi nama kategori', 'err'); return; }
  if (editCatId) {
    const c = menuCats.find(x => x.id === editCatId);
    if (c) { c.name = name; }
  } else {
    menuCats.push({ id: 'cat' + catCtr++, name, order: menuCats.length + 1 });
  }
  syncSettings();
  closeModal('m-cat');
  toast('Kategori disimpan');
  renderCatList();
}

function delCat(id) {
  const inUse = menuItems.some(m => m.catId === id);
  if (inUse) { toast('Kategori masih digunakan oleh menu', 'warn'); return; }
  if (!confirm('Hapus kategori ini?')) return;
  menuCats = menuCats.filter(x => x.id !== id);
  syncSettings();
  toast('Kategori dihapus');
  renderCatList();
}

function openAddItem() {
  editItemId = null;
  g('item-name').value = '';
  g('item-price').value = '';
  g('item-desc').value = '';
  g('m-item-title').textContent = 'Tambah Menu';
  _buildItemCatOptions();
  openModal('m-item');
}

function openEditItem(id) {
  const m = menuItems.find(x => x.id === id);
  if (!m) return;
  editItemId = id;
  g('item-name').value = m.name;
  g('item-price').value = m.price;
  g('item-desc').value = m.desc || '';
  g('m-item-title').textContent = 'Edit Menu';
  _buildItemCatOptions(m.catId);
  openModal('m-item');
}

function _buildItemCatOptions(selected) {
  const sel = g('item-cat');
  if (!sel) return;
  sel.innerHTML = menuCats.map(c =>
    `<option value="${esc(c.id)}" ${selected === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');
}

function saveMenuItem() {
  const name = g('item-name').value.trim();
  const price = parseInt(g('item-price').value) || 0;
  const catId = g('item-cat').value;
  const desc = g('item-desc').value.trim();

  if (!name) { toast('Isi nama menu', 'err'); return; }
  if (!price) { toast('Isi harga', 'err'); return; }
  if (!catId) { toast('Pilih kategori', 'err'); return; }

  if (editItemId) {
    const m = menuItems.find(x => x.id === editItemId);
    if (m) Object.assign(m, { name, price, catId, desc });
  } else {
    menuItems.push({ id: 'mn' + menuCtr++, name, price, catId, desc, active: true });
  }
  syncSettings();
  closeModal('m-item');
  toast('Menu disimpan');
  renderMenuList();
}

function delMenuItem(id) {
  if (!confirm('Hapus menu ini?')) return;
  menuItems = menuItems.filter(x => x.id !== id);
  syncSettings();
  toast('Menu dihapus');
  renderMenuList();
}

function toggleMenuItem(id) {
  const m = menuItems.find(x => x.id === id);
  if (!m) return;
  m.active = !m.active;
  syncSettings();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function renderSettings() {
  const se = (id, v) => { const el = g(id); if (el) el.value = v; };
  se('set-store-name', storeName);
  se('set-store-addr', storeAddr);
  se('set-store-wa', storeWa);
  se('set-store-footer', storeFooter);
  se('set-receipt-link', receiptLink);

  // Printer width radio
  document.querySelectorAll('input[name="printer-width"]').forEach(r => {
    r.checked = (r.value === String(printerWidth));
  });

  _renderLogoPreview();

  renderEmpList();
  renderOutletList();
}

function saveStoreInfo() {
  storeName = g('set-store-name').value.trim() || storeName;
  storeAddr = g('set-store-addr').value.trim();
  storeWa = g('set-store-wa').value.trim();
  const ft = g('set-store-footer');
  if (ft) storeFooter = ft.value.trim();
  const rl = g('set-receipt-link');
  if (rl) receiptLink = rl.value.trim();
  const pw = document.querySelector('input[name="printer-width"]:checked');
  if (pw) printerWidth = pw.value;
  syncSettings();
  toast('Informasi toko disimpan');
}

// ─── Receipt Logo ─────────────────────────────────────────────────────────────

function _renderLogoPreview() {
  const wrap = g('logo-preview');
  if (!wrap) return;
  if (storeLogoBW) {
    wrap.innerHTML = `<img src="${storeLogoBW}" alt="Logo BW" style="max-width:120px;max-height:120px;background:#fff;padding:6px;border:1px solid var(--b2);border-radius:6px">
      <button type="button" class="btn btn-sec btn-sm" onclick="removeStoreLogo()" style="margin-left:12px">Hapus Logo</button>`;
  } else {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--t2)">Belum ada logo. Upload gambar untuk ditampilkan di atas struk.</div>`;
  }
}

function onLogoFilePicked(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('File harus berupa gambar', 'err'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('Ukuran logo maksimal 3 MB', 'err'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const { color, bw } = _logoToBW(img);
      storeLogo = color;
      storeLogoBW = bw;
      syncSettings();
      _renderLogoPreview();
      toast('Logo disimpan');
      input.value = '';
    };
    img.onerror = () => toast('Gagal membaca gambar', 'err');
    img.src = ev.target.result;
  };
  reader.onerror = () => toast('Gagal membaca file', 'err');
  reader.readAsDataURL(file);
}

function removeStoreLogo() {
  if (!confirm('Hapus logo struk?')) return;
  storeLogo = '';
  storeLogoBW = '';
  syncSettings();
  _renderLogoPreview();
  toast('Logo dihapus');
}

// Downscale + threshold to pure B/W (1-bit look, stored as PNG data URL).
function _logoToBW(img) {
  const maxW = 384; // matches ~58mm printer raster; scales down on 55mm and up-fits on 80mm
  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(8, Math.round(img.width * scale));
  const h = Math.max(8, Math.round(img.height * scale));

  // Color-preserved (downscaled) version for reference
  const cv1 = document.createElement('canvas');
  cv1.width = w; cv1.height = h;
  const cx1 = cv1.getContext('2d');
  cx1.fillStyle = '#fff'; cx1.fillRect(0, 0, w, h);
  cx1.drawImage(img, 0, 0, w, h);
  const color = cv1.toDataURL('image/png');

  // BW threshold version
  const cv2 = document.createElement('canvas');
  cv2.width = w; cv2.height = h;
  const cx2 = cv2.getContext('2d');
  cx2.fillStyle = '#fff'; cx2.fillRect(0, 0, w, h);
  cx2.drawImage(img, 0, 0, w, h);
  const imgData = cx2.getImageData(0, 0, w, h);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const alpha = px[i + 3];
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    // Transparent → white; else threshold at ~150 (a bit lenient so line art stays)
    const black = alpha > 100 && lum < 150;
    const v = black ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  cx2.putImageData(imgData, 0, 0);
  const bw = cv2.toDataURL('image/png');

  return { color, bw };
}

// Printer columns for monospace formatting (Bluetooth ESC/POS)
function printerCols() {
  return String(printerWidth) === '55' ? 32 : 48;
}

// Printer paper width in mm (for browser print CSS)
function printerPaperMM() {
  return String(printerWidth) === '55' ? 55 : 80;
}

async function changeOwnerPwd() {
  const oldVal = g('set-old-pwd').value.trim();
  const newVal = g('set-new-pwd').value.trim();
  const confirmVal = g('set-confirm-pwd').value.trim();

  if (!oldVal || !newVal || !confirmVal) { toast('Isi semua field kata sandi', 'err'); return; }
  if (newVal !== confirmVal) { toast('Konfirmasi kata sandi tidak cocok', 'err'); return; }
  if (newVal.length < 4) { toast('Kata sandi minimal 4 karakter', 'err'); return; }

  // Verify old password
  const oldHashed = await hashSecret(oldVal);
  let match = false;
  if (ownerPwd.length === 64) {
    match = oldHashed === ownerPwd;
  } else {
    match = oldVal === ownerPwd;
  }
  if (!match) { toast('Kata sandi lama salah', 'err'); return; }

  ownerPwd = await hashSecret(newVal);
  syncSettings();
  g('set-old-pwd').value = '';
  g('set-new-pwd').value = '';
  g('set-confirm-pwd').value = '';
  toast('Kata sandi berhasil diubah');
}

// Employees
function renderEmpList() {
  const el = g('emp-list');
  if (!el) return;
  if (!employees.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada karyawan</p></div>';
    return;
  }
  el.innerHTML = employees.map(e => {
    const out = outlets.find(o => o.id === e.oid);
    return `
      <div class="list-item">
        <div class="list-item-info">
          <span class="list-item-name">${esc(e.name)}</span>
          <span class="list-item-sub">${esc(e.role || 'Kasir')} &bull; ${out ? esc(out.name) : '-'} &bull; PIN: ${esc(e.pin)}</span>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="openEditEmployee('${e.id}')"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
          <button class="icon-btn icon-btn-danger" onclick="delEmployee('${e.id}')"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
        </div>
      </div>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAddEmployee() {
  editEmpId = null;
  g('emp-name').value = '';
  g('emp-pin').value = '';
  g('emp-role').value = 'Kasir';
  g('m-emp-title').textContent = 'Tambah Karyawan';
  _buildEmpOutletOptions();
  openModal('m-employee');
}

function openEditEmployee(id) {
  const e = employees.find(x => x.id === id);
  if (!e) return;
  editEmpId = id;
  g('emp-name').value = e.name;
  g('emp-pin').value = e.pin;
  g('emp-role').value = e.role || 'Kasir';
  g('m-emp-title').textContent = 'Edit Karyawan';
  _buildEmpOutletOptions(e.oid);
  openModal('m-employee');
}

function _buildEmpOutletOptions(selected) {
  const sel = g('emp-outlet');
  if (!sel) return;
  sel.innerHTML = outlets.map(o =>
    `<option value="${esc(o.id)}" ${selected === o.id ? 'selected' : ''}>${esc(o.name)}</option>`
  ).join('');
}

function saveEmployee() {
  const name = g('emp-name').value.trim();
  const pin = g('emp-pin').value.trim();
  const role = g('emp-role').value.trim() || 'Kasir';
  const oid = g('emp-outlet').value;

  if (!name) { toast('Isi nama karyawan', 'err'); return; }
  if (!pin || pin.length < 4) { toast('PIN minimal 4 digit', 'err'); return; }
  if (!/^\d+$/.test(pin)) { toast('PIN harus berupa angka', 'err'); return; }

  if (editEmpId) {
    const e = employees.find(x => x.id === editEmpId);
    if (e) Object.assign(e, { name, pin, role, oid });
  } else {
    employees.push({ id: 'e' + empCtr++, name, pin, role, oid });
  }
  syncSettings();
  closeModal('m-employee');
  toast('Karyawan disimpan');
  renderEmpList();
}

function delEmployee(id) {
  if (!confirm('Hapus karyawan ini?')) return;
  employees = employees.filter(x => x.id !== id);
  syncSettings();
  toast('Karyawan dihapus');
  renderEmpList();
}

// Outlets
function renderOutletList() {
  const el = g('outlet-list');
  if (!el) return;
  if (!outlets.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada outlet</p></div>';
    return;
  }
  el.innerHTML = outlets.map(o => `
    <div class="list-item">
      <div class="list-item-info">
        <span class="list-item-name">${esc(o.name)}</span>
        ${o.addr ? `<span class="list-item-sub">${esc(o.addr)}</span>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="icon-btn" onclick="openEditOutlet('${o.id}')"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
        <button class="icon-btn icon-btn-danger" onclick="delOutlet('${o.id}')"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
      </div>
    </div>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAddOutlet() {
  editOutId = null;
  g('outlet-name').value = '';
  g('outlet-addr').value = '';
  g('m-outlet-title').textContent = 'Tambah Outlet';
  openModal('m-outlet');
}

function openEditOutlet(id) {
  const o = outlets.find(x => x.id === id);
  if (!o) return;
  editOutId = id;
  g('outlet-name').value = o.name;
  g('outlet-addr').value = o.addr || '';
  g('m-outlet-title').textContent = 'Edit Outlet';
  openModal('m-outlet');
}

function saveOutlet() {
  const name = g('outlet-name').value.trim();
  const addr = g('outlet-addr').value.trim();
  if (!name) { toast('Isi nama outlet', 'err'); return; }
  if (editOutId) {
    const o = outlets.find(x => x.id === editOutId);
    if (o) { o.name = name; o.addr = addr; }
  } else {
    outlets.push({ id: 'o' + outCtr++, name, addr });
  }
  syncSettings();
  closeModal('m-outlet');
  toast('Outlet disimpan');
  renderOutletList();
}

function delOutlet(id) {
  const inUse = employees.some(e => e.oid === id);
  if (inUse) { toast('Outlet masih memiliki karyawan', 'warn'); return; }
  if (!confirm('Hapus outlet ini?')) return;
  outlets = outlets.filter(x => x.id !== id);
  syncSettings();
  toast('Outlet dihapus');
  renderOutletList();
}
