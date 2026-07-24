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

// UI State
let curPage = 'dashboard';
let dashPeriod = 'today';
let ordFilterStatus = '';
let ordFilterPay = '';
let ordDateFilter = 'today';
let kasDateFilter = 'today';
let ordPage = 1;

// Menu management tabs
let menuTab = 'menu'; // 'menu' | 'cat'
let menuFilterCat = 'all';

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

function isoToDate(iso) {
  // Returns YYYY-MM-DD from ISO string
  if (!iso) return '';
  return iso.slice(0, 10);
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=sun
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

function seedData() {
  menuCats = [
    { id: 'cat1', name: 'Makanan', emoji: '🍽', order: 1 },
    { id: 'cat2', name: 'Minuman', emoji: '🥤', order: 2 },
    { id: 'cat3', name: 'Dessert', emoji: '🍰', order: 3 }
  ];
  menuItems = [
    { id: 'mn1', name: 'Nasi Goreng', price: 25000, catId: 'cat1', emoji: '🍳', desc: '', active: true },
    { id: 'mn2', name: 'Ayam Bakar', price: 35000, catId: 'cat1', emoji: '🍗', desc: '', active: true },
    { id: 'mn3', name: 'Mie Goreng', price: 22000, catId: 'cat1', emoji: '🍜', desc: '', active: true },
    { id: 'mn4', name: 'Soto Ayam', price: 28000, catId: 'cat1', emoji: '🥣', desc: '', active: true },
    { id: 'mn5', name: 'Es Teh Manis', price: 8000, catId: 'cat2', emoji: '🧋', desc: '', active: true },
    { id: 'mn6', name: 'Kopi Hitam', price: 10000, catId: 'cat2', emoji: '☕', desc: '', active: true },
    { id: 'mn7', name: 'Jus Jeruk', price: 15000, catId: 'cat2', emoji: '🍊', desc: '', active: true },
    { id: 'mn8', name: 'Es Campur', price: 20000, catId: 'cat3', emoji: '🍧', desc: '', active: true },
    { id: 'mn9', name: 'Puding', price: 12000, catId: 'cat3', emoji: '🍮', desc: '', active: true }
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

function doEnterCode() {
  const code = (g('inp-code')?.value || '').trim().toUpperCase();
  if (!code || code.length < 4) { _setCodeErr('Kode minimal 4 karakter'); return; }
  _setCodeErr('');
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
  goPage('dashboard');
  if (typeof lucide !== 'undefined') lucide.createIcons();
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
  // Sync bottom nav
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('on'));
  document.querySelectorAll(`.bnav-item[data-page="${page}"]`).forEach(n => n.classList.add('on'));
  // Close sidebar on mobile after navigation
  closeSidebar();
  const renders = {
    dashboard: refreshDash, orders: renderOrders, kas: renderKas,
    menu: renderMenuPage, promo: renderPromo, settings: renderSettings, pos: renderPOS
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
  // Header date
  const dateEl = g('dash-date');
  if (dateEl) {
    const periodLabel = {today:'Hari Ini', week:'Minggu Ini', month:'Bulan Ini'}[dashPeriod] || '';
    dateEl.textContent = periodLabel + ' · ' + new Date().toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
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
  // Inline badge (cell di grid)
  const inlineEl = g('d-top-item-inline');
  if (inlineEl) inlineEl.textContent = top.length ? top[0].name + ' (' + top[0].qty + 'x)' : '—';
  // List lengkap
  const topEl = g('d-top-items');
  if (topEl) {
    if (!top.length) {
      topEl.innerHTML = '<p style="color:var(--t3);font-size:13px;text-align:center;padding:8px 0">Belum ada data</p>';
    } else {
      topEl.innerHTML = top.map((item, i) =>
        `<div class="top-item-row">
          <span class="top-rank">${i + 1}</span>
          <span class="top-name">${esc(item.name)}</span>
          <span class="top-qty">${item.qty}x</span>
          <span class="top-rev">${fmt(item.rev)}</span>
        </div>`
      ).join('');
    }
  }

  // Chart
  _renderDashChart(ords);
}

function _ordersInPeriod() {
  const today = todayISO();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  return orders.filter(o => {
    const d = isoToDate(o.isoDate) || o.date;
    if (dashPeriod === 'today') return d === today;
    if (dashPeriod === 'week') return d >= weekStart;
    if (dashPeriod === 'month') return d >= monthStart;
    return true;
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
    const iso = d.toISOString().slice(0, 10);
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

// ─── Orders ───────────────────────────────────────────────────────────────────

function renderOrders() {
  const today = todayISO();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  let filtered = orders.filter(o => {
    const d = isoToDate(o.isoDate) || '';
    if (ordDateFilter === 'today') { if (d !== today) return false; }
    else if (ordDateFilter === 'week') { if (d < weekStart) return false; }
    else if (ordDateFilter === 'month') { if (d < monthStart) return false; }
    if (ordFilterStatus && o.status !== ordFilterStatus) return false;
    if (ordFilterPay && o.payStatus !== ordFilterPay) return false;
    return true;
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
          <span class="badge ${o.status === 'Selesai' ? 'badge-gr' : 'badge-am'}">${esc(o.status)}</span>
        </div>
        <div class="order-card-body">
          <span class="order-meta">${esc(o.date)}${o.custName ? ' &bull; ' + esc(o.custName) : ''}${o.tableNo ? ' &bull; Meja ' + esc(o.tableNo) : ''}</span>
          <span class="order-total">${fmt(o.total)}</span>
        </div>
        <div class="order-card-footer">
          <span class="badge ${o.payStatus === 'Lunas' ? 'badge-gr' : 'badge-re'}">${esc(o.payStatus)}</span>
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

function setOrdDateFilter(v) {
  ordDateFilter = v;
  ordPage = 1;
  document.querySelectorAll('.ord-date-btn').forEach(b => b.classList.remove('on'));
  const btn = g('odf-' + v);
  if (btn) btn.classList.add('on');
  renderOrders();
}

function setOrdFilter(type, val) {
  if (type === 'status') { ordFilterStatus = ordFilterStatus === val ? '' : val; }
  if (type === 'pay') { ordFilterPay = ordFilterPay === val ? '' : val; }
  ordPage = 1;
  _updateOrdFilterBtns();
  renderOrders();
}

function _updateOrdFilterBtns() {
  document.querySelectorAll('.ord-filter-btn[data-type="status"]').forEach(b => {
    b.classList.toggle('on', b.dataset.val === ordFilterStatus);
  });
  document.querySelectorAll('.ord-filter-btn[data-type="pay"]').forEach(b => {
    b.classList.toggle('on', b.dataset.val === ordFilterPay);
  });
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
        <span class="badge ${o.status === 'Selesai' ? 'badge-gr' : 'badge-am'}">${esc(o.status)}</span>
        <span class="badge ${o.payStatus === 'Lunas' ? 'badge-gr' : 'badge-re'}">${esc(o.payStatus)}</span>
      </div>
      <div class="detail-btns">
        ${o.status !== 'Selesai' ? `<button class="btn btn-sm btn-sec" onclick="setOrderStatus('${esc(o.id)}','Selesai');closeModal('m-order-detail')">Tandai Selesai</button>` : ''}
        ${o.payStatus !== 'Lunas' ? `<button class="btn btn-sm btn-p" onclick="setOrderPayStatus('${esc(o.id)}','Lunas');closeModal('m-order-detail')">Tandai Lunas</button>` : ''}
      </div>
    </div>
  `;
  openModal('m-order-detail');
}

function setOrderStatus(id, status) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  o.status = status;
  syncOrder(o);
  toast('Status diperbarui: ' + status);
  renderOrders();
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
    _rebuildPromoItemSelects();
    setTimeout(() => {
      _setBuyType(_bgBuyType);
      if (_bgBuyType === 'cat') {
        if (p.buyCatId && g('promo-buy-cat')) g('promo-buy-cat').value = p.buyCatId;
      } else {
        if (p.buyItemId && g('promo-buy-item')) g('promo-buy-item').value = p.buyItemId;
      }
      if (p.freeItemId && g('promo-free-item')) g('promo-free-item').value = p.freeItemId;
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

let _bgBuyType = 'item'; // 'item' | 'cat'

function _setBuyType(type) {
  _bgBuyType = type;
  g('bg-type-item')?.classList.toggle('on', type === 'item');
  g('bg-type-cat')?.classList.toggle('on', type === 'cat');
  const iw = g('bg-buy-item-wrap'), cw = g('bg-buy-cat-wrap');
  if (iw) iw.style.display = type === 'item' ? '' : 'none';
  if (cw) cw.style.display = type === 'cat' ? '' : 'none';
  _updatePromoBeliGratisPreview();
}

function _rebuildPromoItemSelects() {
  const itemOpts = menuItems.filter(m => m.active !== false)
    .map(m => `<option value="${esc(m.id)}">${esc((m.emoji||'') + ' ' + m.name)}</option>`)
    .join('');
  ['promo-buy-item','promo-free-item'].forEach(id => { const el = g(id); if (el) el.innerHTML = itemOpts; });
  const catOpts = menuCats.map(c => `<option value="${esc(c.id)}">${esc((c.emoji||'') + ' ' + c.name)}</option>`).join('');
  const catSel = g('promo-buy-cat'); if (catSel) catSel.innerHTML = catOpts;
  _updatePromoBeliGratisPreview();
}

function _updatePromoBeliGratisPreview() {
  const fi = menuItems.find(m => m.id === g('promo-free-item')?.value);
  const bq = parseInt(g('promo-buy-qty')?.value) || 1;
  const fq = parseInt(g('promo-free-qty')?.value) || 1;
  let buyLabel = '';
  if (_bgBuyType === 'cat') {
    const cat = menuCats.find(c => c.id === g('promo-buy-cat')?.value);
    buyLabel = cat ? `${bq}x item ${cat.name}` : '';
  } else {
    const bi = menuItems.find(m => m.id === g('promo-buy-item')?.value);
    buyLabel = bi ? `${bq}x ${bi.name}` : '';
  }
  const prev = g('promo-bg-preview');
  if (prev) prev.textContent = buyLabel && fi ? `Beli ${buyLabel} → Gratis ${fq}x ${fi.name}` : '';
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
    const freeItemId = g('promo-free-item')?.value;
    if (!freeItemId) { toast('Pilih item gratis', 'err'); return; }
    if (_bgBuyType === 'cat') {
      const buyCatId = g('promo-buy-cat')?.value;
      if (!buyCatId) { toast('Pilih kategori pembelian', 'err'); return; }
      promoData = { name, discType, buyType:'cat', buyCatId, buyQty, freeItemId, freeQty, catId:'all', discVal:0, days, from, to, note };
    } else {
      const buyItemId = g('promo-buy-item')?.value;
      if (!buyItemId) { toast('Pilih item yang dibeli', 'err'); return; }
      promoData = { name, discType, buyType:'item', buyItemId, buyQty, freeItemId, freeQty, catId:'all', discVal:0, days, from, to, note };
    }
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
  const freeItem = cart.find(c => c.id === promo.freeItemId);
  if (!freeItem) return 0;

  let totalBuyQty = 0;
  if (promo.buyType === 'cat') {
    // Hitung total qty semua item dalam kategori tertentu di cart
    const catItems = menuItems.filter(m => m.catId === promo.buyCatId).map(m => m.id);
    totalBuyQty = cart.filter(c => catItems.includes(c.id)).reduce((s, c) => s + c.qty, 0);
  } else {
    // Item spesifik
    if (promo.freeItemId === promo.buyItemId) {
      // Item sama: hitung per set (buyQty + freeQty)
      const buyItem = cart.find(c => c.id === promo.buyItemId);
      if (!buyItem) return 0;
      const sets = Math.floor(buyItem.qty / (promo.buyQty + promo.freeQty));
      return sets * promo.freeQty * buyItem.price;
    }
    const buyItem = cart.find(c => c.id === promo.buyItemId);
    totalBuyQty = buyItem?.qty || 0;
  }

  if (totalBuyQty < promo.buyQty) return 0;
  const sets = Math.floor(totalBuyQty / promo.buyQty);
  const freeCount = Math.min(sets * promo.freeQty, freeItem.qty);
  return freeCount * freeItem.price;
}

function _promoBeliGratisLabel(p) {
  const fi = menuItems.find(m => m.id === p.freeItemId);
  let buyLabel;
  if (p.buyType === 'cat') {
    const cat = menuCats.find(c => c.id === p.buyCatId);
    buyLabel = `${p.buyQty}x item ${cat?.name || 'Kategori'}`;
  } else {
    const bi = menuItems.find(m => m.id === p.buyItemId);
    buyLabel = `${p.buyQty}x ${bi?.name || '?'}`;
  }
  return `Beli ${buyLabel} → Gratis ${p.freeQty}x ${fi?.name || '?'}`;
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
      <span class="list-item-emoji">${c.emoji || '📁'}</span>
      <span class="list-item-name">${esc(c.name)}</span>
      <div class="list-item-actions">
        <button class="icon-btn" onclick="openEditCat('${c.id}')"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
        <button class="icon-btn icon-btn-danger" onclick="delCat('${c.id}')"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
      </div>
    </div>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
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

  const filtered = menuFilterCat === 'all' ? menuItems : menuItems.filter(m => m.catId === menuFilterCat);

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><p>Belum ada menu</p></div>';
    return;
  }

  el.innerHTML = filtered.map(m => {
    const cat = menuCats.find(c => c.id === m.catId);
    return `
      <div class="list-item ${m.active ? '' : 'item-inactive'}">
        <span class="list-item-emoji">${m.emoji || '🍽'}</span>
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
  g('cat-emoji').value = '';
  g('m-cat-title').textContent = 'Tambah Kategori';
  openModal('m-cat');
}

function openEditCat(id) {
  const c = menuCats.find(x => x.id === id);
  if (!c) return;
  editCatId = id;
  g('cat-name').value = c.name;
  g('cat-emoji').value = c.emoji || '';
  g('m-cat-title').textContent = 'Edit Kategori';
  openModal('m-cat');
}

function saveCat() {
  const name = g('cat-name').value.trim();
  const emoji = g('cat-emoji').value.trim() || '📁';
  if (!name) { toast('Isi nama kategori', 'err'); return; }
  if (editCatId) {
    const c = menuCats.find(x => x.id === editCatId);
    if (c) { c.name = name; c.emoji = emoji; }
  } else {
    menuCats.push({ id: 'cat' + catCtr++, name, emoji, order: menuCats.length + 1 });
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
  g('item-emoji').value = '';
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
  g('item-emoji').value = m.emoji || '';
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
  const emoji = g('item-emoji').value.trim() || '🍽';
  const desc = g('item-desc').value.trim();

  if (!name) { toast('Isi nama menu', 'err'); return; }
  if (!price) { toast('Isi harga', 'err'); return; }
  if (!catId) { toast('Pilih kategori', 'err'); return; }

  if (editItemId) {
    const m = menuItems.find(x => x.id === editItemId);
    if (m) Object.assign(m, { name, price, catId, emoji, desc });
  } else {
    menuItems.push({ id: 'mn' + menuCtr++, name, price, catId, emoji, desc, active: true });
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

  renderEmpList();
  renderOutletList();
}

function saveStoreInfo() {
  storeName = g('set-store-name').value.trim() || storeName;
  storeAddr = g('set-store-addr').value.trim();
  storeWa = g('set-store-wa').value.trim();
  syncSettings();
  toast('Informasi toko disimpan');
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
