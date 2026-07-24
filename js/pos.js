// pos.js — POS page: menu display + cart
// KasirHnY

// ─── Cart State ───────────────────────────────────────────────────────────────

let cart = []; // [{id, name, price, qty, lineTotal, catId}]
let posActiveCat = 'all';
let posSearch = '';
let posCustName = '';
let posTableNo = '';
let posPayMethod = 'Tunai';
let posNotes = '';
let posSubtotal = 0;
let posPromoAmt = 0;
let posTotal = 0;
let posActivePromo = null;

// Mobile cart view toggle
let showCartMobile = false;

// ─── Render POS ───────────────────────────────────────────────────────────────

function renderPOS() {
  renderPOSCatFilter();
  renderPOSMenu();
  renderPOSCart();
}

function renderPOSCatFilter() {
  const el = g('pos-cat-filter');
  if (!el) return;
  el.innerHTML =
    `<button class="cat-pill ${posActiveCat === 'all' ? 'on' : ''}" onclick="setPOSCat('all')">Semua</button>` +
    menuCats.map(c =>
      `<button class="cat-pill ${posActiveCat === c.id ? 'on' : ''}" onclick="setPOSCat('${c.id}')">${esc(c.name)}</button>`
    ).join('');
}

function setPOSCat(catId) {
  posActiveCat = catId;
  renderPOSCatFilter();
  renderPOSMenu();
}

function renderPOSMenu() {
  const el = g('pos-menu-grid');
  if (!el) return;

  let items = menuItems.filter(m => m.active);
  if (posActiveCat !== 'all') {
    items = items.filter(m => m.catId === posActiveCat);
  }
  if (posSearch.trim()) {
    const q = posSearch.trim().toLowerCase();
    items = items.filter(m => m.name.toLowerCase().includes(q));
  }

  if (!items.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Menu tidak ditemukan</p></div>`;
    return;
  }

  el.innerHTML = items.map(m => {
    const inCart = cart.find(c => c.id === m.id);
    return `
      <div class="menu-card ${inCart ? 'in-cart' : ''}" onclick="addToCart('${m.id}')">
        <div class="menu-card-name">${esc(m.name)}</div>
        <div class="menu-card-price">${fmt(m.price)}</div>
        ${inCart ? `<div class="menu-card-badge">${inCart.qty}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderPOSCart() {
  recalcCart();

  // Update cart toggle button badge (mobile)
  const badge = g('cart-mobile-badge');
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  if (badge) badge.textContent = totalQty || '';

  const el = g('pos-cart-inner');
  if (!el) return;

  if (!cart.length) {
    el.innerHTML = `
      <div class="cart-empty">
        <p style="color:var(--t3);font-size:13px;text-align:center;padding:32px 16px">Keranjang kosong.<br>Pilih menu untuk mulai.</p>
      </div>
    `;
    g('cart-footer') && (g('cart-footer').style.display = 'none');
    return;
  }

  g('cart-footer') && (g('cart-footer').style.display = '');

  el.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <span class="cart-item-name">${esc(item.name)}</span>
        <span class="cart-item-price">${fmt(item.price)}</span>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="updateCartQty('${item.id}',-1)">-</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateCartQty('${item.id}',1)">+</button>
        <span class="cart-line-total">${fmt(item.lineTotal)}</span>
      </div>
    </div>
  `).join('');

  // Update footer totals
  const se = (id, v) => { const el2 = g(id); if (el2) el2.textContent = v; };
  se('cart-subtotal', fmt(posSubtotal));
  const promoLabel = posActivePromo
    ? (posActivePromo.discType === 'beli_gratis' ? _promoBeliGratisLabel(posActivePromo) : posActivePromo.name)
    : '';
  se('cart-promo-row', promoLabel);

  const promoRow = g('cart-promo-wrap');
  if (promoRow) promoRow.style.display = posPromoAmt > 0 ? '' : 'none';
  se('cart-promo-amt', '-' + fmt(posPromoAmt));
  se('cart-total', fmt(posTotal));

  // Sync input fields
  const cn = g('pos-cust-name');
  const tn = g('pos-table-no');
  const nt = g('pos-notes');
  if (cn && cn.value !== posCustName) cn.value = posCustName;
  if (tn && tn.value !== posTableNo) tn.value = posTableNo;
  if (nt && nt.value !== posNotes) nt.value = posNotes;

  // Payment method
  document.querySelectorAll('.pay-method-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.method === posPayMethod);
  });
}

// ─── Cart Operations ──────────────────────────────────────────────────────────

function addToCart(itemId) {
  const m = menuItems.find(x => x.id === itemId);
  if (!m) return;
  const existing = cart.find(c => c.id === itemId);
  if (existing) {
    existing.qty++;
    existing.lineTotal = existing.qty * existing.price;
  } else {
    cart.push({ id: m.id, name: m.name, price: m.price, qty: 1, lineTotal: m.price, catId: m.catId });
  }
  renderPOSMenu();
  renderPOSCart();
}

function removeFromCart(itemId) {
  cart = cart.filter(c => c.id !== itemId);
  renderPOSMenu();
  renderPOSCart();
}

function updateCartQty(itemId, delta) {
  const item = cart.find(c => c.id === itemId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(itemId);
    return;
  }
  item.lineTotal = item.qty * item.price;
  renderPOSCart();
  renderPOSMenu();
}

function recalcCart() {
  posSubtotal = cart.reduce((s, c) => s + c.lineTotal, 0);

  // 1. Cek promo beli_gratis dulu (item-specific, cart-aware)
  let promo = null, promoDisc = 0;
  for (const p of (typeof promos !== 'undefined' ? promos : [])) {
    if (!p.active || !isPromoToday(p)) continue;
    if (p.discType === 'beli_gratis') {
      const disc = calcBeliGratisDisc(p, cart);
      if (disc > promoDisc) { promo = p; promoDisc = disc; }
    }
  }

  // 2. Fallback: promo biasa (persen/nominal)
  if (!promo) {
    promo = getActivePromo('all');
    if (!promo && cart.length > 0) {
      const dominant = cart.slice().sort((a, b) => b.lineTotal - a.lineTotal)[0];
      promo = getActivePromo(dominant.catId);
    }
    promoDisc = calcPromoDisc(promo, posSubtotal);
  }

  posActivePromo = promo;
  posPromoAmt = promoDisc;
  posTotal = posSubtotal - posPromoAmt;
}

function clearCart() {
  cart = [];
  posTableNo = '';
  posCustName = '';
  posNotes = '';
  posActiveCat = 'all';
  renderPOS();
}

// ─── Place Order ──────────────────────────────────────────────────────────────

function placeOrder() {
  if (!cart.length) { toast('Keranjang masih kosong', 'warn'); return; }
  recalcCart();

  const outId = curStaff?.oid || outlets[0]?.id || '';
  const o = {
    id: genId(),
    items: cart.map(l => ({ id: l.id, name: l.name, qty: l.qty, price: l.price, lineTotal: l.lineTotal })),
    subtotal: posSubtotal,
    discAmt: 0,
    promoAmt: posPromoAmt,
    total: posTotal,
    payMethod: posPayMethod,
    payStatus: 'Lunas',
    status: 'Baru',
    tableNo: posTableNo,
    custName: posCustName,
    notes: posNotes,
    date: todayStr(),
    isoDate: new Date().toISOString(),
    handledBy: curStaff?.name || 'Owner',
    outletId: outId
  };

  orders.unshift(o);
  syncOrder(o);

  // Auto kas entry untuk semua metode bayar (semua order langsung Lunas)
  if (true) {
    const kasEntry = {
      id: 'k' + kasCtr++,
      type: 'in',
      desc: 'Penjualan - ' + o.id,
      note: o.custName || '',
      amount: o.total,
      time: NOW(),
      date: todayISO(),
      outlet_id: outId
    };
    kasLog.unshift(kasEntry);
    syncKas(kasEntry);
  }

  const savedCart = [...cart];
  const savedSubtotal = posSubtotal;
  const savedPromoAmt = posPromoAmt;
  const savedTotal = posTotal;
  const savedPromo = posActivePromo;

  clearCart();
  toast('Pesanan ' + o.id + ' berhasil disimpan!');
  openOrderReceipt(o);
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function openOrderReceipt(o) {
  const el = g('receipt-body');
  if (!el) return;
  el.dataset.orderId = o.id;

  const storeInfo = storeName ? `<div class="receipt-store">${esc(storeName)}</div>` : '';
  const addrInfo = storeAddr ? `<div class="receipt-addr">${esc(storeAddr)}</div>` : '';

  el.innerHTML = `
    <div class="receipt-header">
      ${storeInfo}
      ${addrInfo}
      <div class="receipt-id">${esc(o.id)}</div>
      <div class="receipt-date">${esc(o.date)} ${o.isoDate ? new Date(o.isoDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
      ${o.custName ? `<div class="receipt-cust">Pelanggan: ${esc(o.custName)}</div>` : ''}
      ${o.tableNo ? `<div class="receipt-cust">Meja: ${esc(o.tableNo)}</div>` : ''}
      ${o.handledBy ? `<div class="receipt-cust">Kasir: ${esc(o.handledBy)}</div>` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-items">
      ${(o.items || []).map(it => `
        <div class="receipt-item">
          <span class="ri-name">${esc(it.name)}</span>
          <span class="ri-qty">${it.qty}x</span>
          <span class="ri-price">${fmt(it.lineTotal)}</span>
        </div>
      `).join('')}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-totals">
      <div class="receipt-row"><span>Subtotal</span><span>${fmt(o.subtotal)}</span></div>
      ${o.promoAmt > 0 ? `<div class="receipt-row" style="color:var(--gr)"><span>Diskon Promo</span><span>-${fmt(o.promoAmt)}</span></div>` : ''}
      <div class="receipt-row receipt-total-row"><span>Total</span><span>${fmt(o.total)}</span></div>
      <div class="receipt-row"><span>Pembayaran</span><span>${esc(o.payMethod)}</span></div>
    </div>
    ${o.notes ? `<div class="receipt-notes">Catatan: ${esc(o.notes)}</div>` : ''}
    <div class="receipt-footer">${esc(storeFooter || 'Terima kasih!')}</div>
  `;

  openModal('m-receipt');
}

// ─── Browser Print (fallback) ─────────────────────────────────────────────────
function printReceipt() {
  const body = g('receipt-body');
  if (!body) return;
  const win = window.open('', '_blank', 'width=320,height=600');
  win.document.write(`<html><head><title>Struk</title><style>
    body{font-family:monospace;font-size:12px;margin:0;padding:8px;width:280px}
    .receipt-store{font-size:14px;font-weight:bold;text-align:center}
    .receipt-addr,.receipt-id,.receipt-date,.receipt-cust{text-align:center;font-size:11px;margin-bottom:2px}
    .receipt-divider{border-top:1px dashed #000;margin:6px 0}
    .receipt-item{display:flex;justify-content:space-between;margin-bottom:2px}
    .ri-name{flex:1}.ri-qty{width:30px;text-align:center}.ri-price{width:80px;text-align:right}
    .receipt-row{display:flex;justify-content:space-between;margin-bottom:2px}
    .receipt-total-row{font-weight:bold;font-size:14px;border-top:1px solid #000;padding-top:4px;margin-top:4px}
    .receipt-footer{text-align:center;margin-top:8px;font-size:11px}
    .receipt-notes{font-size:11px;margin-top:4px}
    @media print{body{width:auto}}
  </style></head><body>${body.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── ESC/POS Bluetooth Print ──────────────────────────────────────────────────
const _BT_SVCS = ['000018f0-0000-1000-8000-00805f9b34fb','0000ff00-0000-1000-8000-00805f9b34fb','0000ffe0-0000-1000-8000-00805f9b34fb'];
const _BT_CHARS = ['00002af1-0000-1000-8000-00805f9b34fb','0000ff02-0000-1000-8000-00805f9b34fb','0000ffe1-0000-1000-8000-00805f9b34fb'];
let _btDev = null;
const _BT_ID_KEY = 'kasirhny_bt_id';

function escCmd(...b) { return new Uint8Array(b); }
function escText(s) { return new TextEncoder().encode(s); }
function concatBuf(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total); let off = 0;
  arrs.forEach(a => { out.set(a, off); off += a.length; });
  return out;
}
function fmtAmt(n) { return String(Math.round(Math.abs(Number(n)||0))).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }

function buildEscReceiptResto(o) {
  const ESC=0x1B,GS=0x1D,LF=0x0A;
  const INIT=escCmd(ESC,0x40), C=escCmd(ESC,0x61,0x01), L=escCmd(ESC,0x61,0x00);
  const BON=escCmd(ESC,0x45,0x01), BOFF=escCmd(ESC,0x45,0x00);
  const FLARGE=escCmd(GS,0x21,0x11), FNORM=escCmd(GS,0x21,0x00);
  const CUT=escCmd(GS,0x56,0x42,0x00), NL=escCmd(LF);
  const W = 32;
  const dash = escText('-'.repeat(W)+'\n');
  const pad = (l,r) => { const ls=String(l||''),rs=String(r||''); const g=W-ls.length-rs.length; return g>0?ls+' '.repeat(g)+rs+'\n':ls+'\n'+' '.repeat(Math.max(0,W-rs.length))+rs+'\n'; };

  const parts = [INIT, C, FLARGE, BON];
  (storeName||'KasirHnY').split('\n').forEach(line => parts.push(escText(line+'\n')));
  parts.push(BOFF, FNORM);
  if (storeAddr) parts.push(escText(storeAddr+'\n'));
  if (storeWa) parts.push(escText(storeWa+'\n'));
  parts.push(NL, L, dash);
  parts.push(escText(pad('No:', o.id)));
  if (o.tableNo) parts.push(escText(pad('Meja:', o.tableNo)));
  if (o.custName) parts.push(escText(pad('Pelanggan:', o.custName)));
  parts.push(escText(pad('Kasir:', o.handledBy||'-')));
  parts.push(escText(pad('Tgl:', (o.date||''))));
  parts.push(dash);

  (o.items||[]).forEach(it => {
    const tot = 'Rp '+fmtAmt(it.lineTotal);
    const det = '  '+it.qty+'x Rp '+fmtAmt(it.price);
    parts.push(escText(String(it.name)+'\n'));
    const g2 = W-det.length-tot.length;
    parts.push(escText(g2>0 ? det+' '.repeat(g2)+tot+'\n' : det+'\n'+' '.repeat(Math.max(0,W-tot.length))+tot+'\n'));
  });

  parts.push(dash);
  if ((o.promoAmt||0)>0) parts.push(escText(pad('Diskon:', '-Rp '+fmtAmt(o.promoAmt))));
  parts.push(BON, escText(pad('TOTAL:', 'Rp '+fmtAmt(o.total))), BOFF);
  parts.push(escText(pad('Bayar:', o.payMethod||'')));
  if (o.notes) parts.push(escText(pad('Ket:', o.notes)));
  parts.push(dash, C);
  (storeFooter||'Terima kasih!').split('\n').forEach(line => parts.push(escText(line+'\n')));
  parts.push(NL, NL, NL, CUT);
  return concatBuf(...parts);
}

async function _getBtDevice() {
  if (_btDev) { try { if (!_btDev.gatt.connected) await _btDev.gatt.connect(); return _btDev; } catch(e) { _btDev=null; } }
  const savedId = localStorage.getItem(_BT_ID_KEY);
  if (savedId && navigator.bluetooth?.getDevices) {
    try { const devs = await navigator.bluetooth.getDevices(); const d = devs.find(x=>x.id===savedId); if(d){await d.gatt.connect();_btDev=d;d.addEventListener('gattserverdisconnected',()=>{_btDev=null;});return d;} } catch(e){}
  }
  const dev = await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:_BT_SVCS});
  _btDev = dev; localStorage.setItem(_BT_ID_KEY, dev.id); dev.addEventListener('gattserverdisconnected',()=>{_btDev=null;});
  return dev;
}

async function printBluetooth() {
  if (!navigator.bluetooth) { toast('Browser tidak mendukung Bluetooth. Gunakan Chrome.','err'); return; }
  const el = g('receipt-body'); if (!el) return;
  // Get current order from receipt body data
  const ordId = el.dataset.orderId;
  const o = orders.find(x => x.id === ordId);
  if (!o) { toast('Data pesanan tidak ditemukan','err'); return; }
  toast('Menghubungkan ke printer...');
  try {
    const dev = await _getBtDevice();
    const server = await dev.gatt.connect();
    let char = null;
    for (const svcId of _BT_SVCS) {
      try {
        const svc = await server.getPrimaryService(svcId);
        for (const cId of _BT_CHARS) { try { char = await svc.getCharacteristic(cId); break; } catch(e){} }
        if (!char) { const cs = await svc.getCharacteristics(); char = cs.find(c=>c.properties.writeWithoutResponse||c.properties.write)||cs[0]||null; }
        if (char) break;
      } catch(e){}
    }
    if (!char) { toast('Karakteristik printer tidak ditemukan','err'); return; }
    const data = buildEscReceiptResto(o);
    const CHUNK = 128;
    const useWithout = char.properties.writeWithoutResponse && !char.properties.write;
    for (let i=0; i<data.length; i+=CHUNK) {
      const chunk = data.slice(i, i+CHUNK);
      if (useWithout) await char.writeValueWithoutResponse(chunk); else await char.writeValue(chunk);
      await new Promise(r=>setTimeout(r,60));
    }
    toast('Berhasil dicetak!');
  } catch(e) {
    if (e.name==='NotFoundError'||e.name==='NotAllowedError') { toast('Pemilihan printer dibatalkan.','warn'); _btDev=null; localStorage.removeItem(_BT_ID_KEY); }
    else { toast('Gagal cetak: '+e.message,'err'); _btDev=null; }
  }
}

// ─── POS Input Handlers ───────────────────────────────────────────────────────

function onPOSSearch(val) {
  posSearch = val;
  renderPOSMenu();
}

function onPOSCustName(val) {
  posCustName = val;
}

function onPOSTableNo(val) {
  posTableNo = val;
}

function onPOSNotes(val) {
  posNotes = val;
}

function setPayMethod(method) {
  posPayMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.method === method);
  });
}

// Mobile: toggle cart panel visibility
function toggleMobileCart() {
  showCartMobile = !showCartMobile;
  const cartPanel = g('pos-cart-panel');
  const menuPanel = g('pos-menu-panel');
  if (!cartPanel || !menuPanel) return;
  if (showCartMobile) {
    cartPanel.classList.add('mobile-visible');
    menuPanel.classList.add('mobile-hidden');
  } else {
    cartPanel.classList.remove('mobile-visible');
    menuPanel.classList.remove('mobile-hidden');
  }
}
