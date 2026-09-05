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
  // Fire-and-forget: keep printer warm so first print is instant
  if (typeof warmPrinter === 'function') warmPrinter();
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
    status: 'Selesai',
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

function _receiptTime(o) {
  if (!o.isoDate) return '';
  try {
    const d = new Date(o.isoDate);
    return String(d.getHours()).padStart(2,'0') + ':' +
           String(d.getMinutes()).padStart(2,'0') + ':' +
           String(d.getSeconds()).padStart(2,'0');
  } catch(e) { return ''; }
}

function _receiptDateISO(o) {
  if (o.isoDate) { try { return new Date(o.isoDate).toISOString().slice(0,10); } catch(e) {} }
  return o.date || '';
}

function _receiptOutlet(o) {
  const out = (typeof outlets !== 'undefined' ? outlets : []).find(x => x.id === o.outletId);
  return out ? out : null;
}

function _receiptTotalQty(o) {
  return (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
}

function buildReceiptHTML(o) {
  const items = o.items || [];
  const totalQty = _receiptTotalQty(o);
  const dateISO = _receiptDateISO(o);
  const time = _receiptTime(o);
  const outlet = _receiptOutlet(o);
  const payMethod = o.payMethod || 'Tunai';
  const bayarLabel = 'Bayar (' + payMethod + ')';
  // All orders are Lunas → bayar = total, kembali = 0
  const bayarAmt = o.total;
  const kembali = 0;

  const logoHTML = storeLogoBW
    ? `<div class="r-logo"><img src="${storeLogoBW}" alt="logo"></div>`
    : '';

  const rightMeta = [
    o.handledBy || '',
    o.custName || '',
    outlet ? (outlet.addr || outlet.name || '') : ''
  ].filter(Boolean);

  const metaRows = [];
  const leftRows = [dateISO, time].filter(Boolean);
  const maxRows = Math.max(leftRows.length, rightMeta.length);
  for (let i = 0; i < maxRows; i++) {
    metaRows.push(
      `<div class="r-meta-row"><span>${esc(leftRows[i] || '')}</span><span>${esc(rightMeta[i] || '')}</span></div>`
    );
  }

  const itemRows = items.map((it, idx) => {
    const num = idx + 1;
    // detail line: "1 x price" (or "qty unit x price" if we had unit — we don't, so just qty x price)
    const detail = `${it.qty} x ${fmtAmt(it.price)}`;
    return `
      <div class="r-item">
        <div class="r-item-name"><span class="r-item-num">${num}.</span> ${esc(it.name)}</div>
        <div class="r-item-line">
          <span class="r-item-detail">${esc(detail)}</span>
          <span class="r-item-total">Rp ${fmtAmt(it.lineTotal)}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="r-wrap">
      ${logoHTML}
      <div class="r-store-name">${esc(storeName || '')}</div>
      ${storeAddr ? `<div class="r-store-line">${esc(storeAddr)}</div>` : ''}
      ${storeWa ? `<div class="r-store-line">No. Telp ${esc(storeWa)}</div>` : ''}
      <div class="r-store-line r-store-id">${esc(o.id)}</div>

      <div class="r-hr"></div>

      <div class="r-meta">${metaRows.join('')}</div>
      ${o.tableNo ? `<div class="r-tableno">Meja: ${esc(o.tableNo)}</div>` : ''}
      <div class="r-tableno">No.${esc(o.id)}</div>

      <div class="r-hr"></div>

      <div class="r-items">${itemRows}</div>

      <div class="r-hr"></div>

      <div class="r-qty-line">Total QTY : ${totalQty}</div>

      <div class="r-totals">
        <div class="r-row"><span>Sub Total</span><span>Rp ${fmtAmt(o.subtotal)}</span></div>
        ${o.promoAmt > 0 ? `<div class="r-row"><span>Diskon Promo</span><span>-Rp ${fmtAmt(o.promoAmt)}</span></div>` : ''}
        <div class="r-row r-row-total"><span>Total</span><span>Rp ${fmtAmt(o.total)}</span></div>
        <div class="r-row"><span>${esc(bayarLabel)}</span><span>Rp ${fmtAmt(bayarAmt)}</span></div>
        <div class="r-row"><span>Kembali</span><span>Rp ${fmtAmt(kembali)}</span></div>
      </div>

      ${o.notes ? `<div class="r-notes">Catatan: ${esc(o.notes)}</div>` : ''}

      <div class="r-footer">${esc(storeFooter || 'Terima kasih telah berbelanja')}</div>

      ${receiptLink ? `
        <div class="r-link-label">Link Kritik dan Saran:</div>
        <div class="r-link-url">${esc(receiptLink)}</div>` : ''}
    </div>
  `;
}

// CSS used for both the on-screen preview and the print window.
function receiptCSS(paperMM) {
  const paperW = paperMM === 55 ? '55mm' : '80mm';
  // usable width inside 2mm padding on each side
  const bodyW = paperMM === 55 ? '51mm' : '76mm';
  const baseFs = paperMM === 55 ? '11px' : '12px';
  const nameFs = paperMM === 55 ? '15px' : '17px';
  const totalFs = paperMM === 55 ? '13px' : '15px';
  return `
    .r-wrap { font-family: 'Courier New', Consolas, monospace; color:#000; width:${bodyW}; margin:0 auto;
              font-size:${baseFs}; line-height:1.35; }
    .r-wrap * { box-sizing:border-box; }
    .r-logo { text-align:center; margin-bottom:4px; }
    .r-logo img { max-width:60%; max-height:${paperMM === 55 ? '90px' : '120px'}; }
    .r-store-name { text-align:center; font-size:${nameFs}; font-weight:700; margin:2px 0; word-wrap:break-word; }
    .r-store-line { text-align:center; word-wrap:break-word; }
    .r-store-id { font-family: 'Courier New', monospace; margin-top:2px; word-break:break-all; }
    .r-hr { border-top:1px dashed #000; margin:6px 0; }
    .r-meta-row { display:flex; justify-content:space-between; gap:8px; }
    .r-meta-row span:last-child { text-align:right; }
    .r-tableno { text-align:left; }
    .r-item { margin-bottom:4px; }
    .r-item-name { font-weight:700; word-wrap:break-word; }
    .r-item-num { display:inline-block; }
    .r-item-line { display:flex; justify-content:space-between; gap:8px; padding-left:1ch; }
    .r-item-total { white-space:nowrap; }
    .r-qty-line { margin:4px 0; }
    .r-totals { margin-top:2px; }
    .r-row { display:flex; justify-content:space-between; gap:8px; padding:1px 0; }
    .r-row-total { font-weight:700; font-size:${totalFs}; }
    .r-notes { margin-top:6px; }
    .r-footer { text-align:center; margin-top:8px; }
    .r-link-label { text-align:center; margin-top:6px; }
    .r-link-url { text-align:center; word-break:break-all; }
  `;
}

function openOrderReceipt(o) {
  const el = g('receipt-body');
  if (!el) return;
  el.dataset.orderId = o.id;
  // Inject scoped preview CSS once
  if (!document.getElementById('receipt-preview-css')) {
    const s = document.createElement('style');
    s.id = 'receipt-preview-css';
    s.textContent = '#receipt-body { background:#fff; color:#000; padding:8px; }' +
      receiptCSS(80); // preview uses 80mm width for readability
    document.head.appendChild(s);
  }
  el.innerHTML = buildReceiptHTML(o);
  openModal('m-receipt');
  // Warm the BT printer while user reviews the receipt
  if (typeof warmPrinter === 'function') warmPrinter();
}

// ─── Browser / System Printer ─────────────────────────────────────────────────
function printReceipt() {
  const el = g('receipt-body');
  if (!el) return;
  const ordId = el.dataset.orderId;
  const o = (typeof orders !== 'undefined' ? orders : []).find(x => x.id === ordId);
  if (!o) { toast('Data pesanan tidak ditemukan', 'err'); return; }

  const paperMM = printerPaperMM();
  const html = buildReceiptHTML(o);
  const win = window.open('', '_blank', 'width=360,height=640');
  if (!win) { toast('Popup diblokir. Izinkan popup untuk mencetak.', 'err'); return; }
  win.document.write(`<!doctype html><html><head><title>Struk ${esc(o.id)}</title>
<style>
  @page { size: ${paperMM}mm auto; margin: 0; }
  html, body { margin:0; padding:0; background:#fff; }
  body { padding:2mm; }
  ${receiptCSS(paperMM)}
  @media print {
    body { padding:2mm; }
    .r-wrap { width:100%; }
  }
</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  // Give the browser a beat to load the logo image before printing.
  const doPrint = () => { try { win.print(); } catch(e){} setTimeout(() => { try { win.close(); } catch(e){} }, 300); };
  const imgs = win.document.images;
  if (imgs.length === 0) { setTimeout(doPrint, 200); return; }
  let loaded = 0;
  const tryPrint = () => { loaded++; if (loaded >= imgs.length) setTimeout(doPrint, 100); };
  for (let i = 0; i < imgs.length; i++) {
    if (imgs[i].complete) tryPrint();
    else { imgs[i].onload = tryPrint; imgs[i].onerror = tryPrint; }
  }
  // Safety fallback
  setTimeout(doPrint, 1500);
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

// Split a long text into wrapped lines by max column count.
function _wrapCols(text, cols) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!w) continue;
    if (w.length > cols) {
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < w.length; i += cols) lines.push(w.slice(i, i + cols));
      continue;
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= cols) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Build ESC/POS GS v 0 raster bitmap command from a data URL image.
// Returns Uint8Array or null on failure.
async function _escLogoRaster(dataUrl, printerDots) {
  return new Promise(resolve => {
    if (!dataUrl) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      // Fit logo to ~60% of printer width, aligned to 8 dots
      const targetW = Math.floor((printerDots * 0.6) / 8) * 8;
      const scale = targetW / img.width;
      const w = targetW;
      const h = Math.max(8, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
      cx.drawImage(img, 0, 0, w, h);
      const px = cx.getImageData(0, 0, w, h).data;
      const bytesPerRow = w / 8;
      const buf = new Uint8Array(bytesPerRow * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const alpha = px[i + 3];
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (alpha > 100 && lum < 150) {
            buf[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x & 7));
          }
        }
      }
      const xL = bytesPerRow & 0xff, xH = (bytesPerRow >> 8) & 0xff;
      const yL = h & 0xff, yH = (h >> 8) & 0xff;
      // ESC a 1 → center, then GS v 0 m xL xH yL yH data
      const header = new Uint8Array([0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
      const out = new Uint8Array(header.length + buf.length + 1);
      out.set(header, 0);
      out.set(buf, header.length);
      out[out.length - 1] = 0x0A; // LF after image
      resolve(out);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function buildEscReceiptResto(o) {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const INIT = escCmd(ESC, 0x40);
  const AL_C = escCmd(ESC, 0x61, 0x01);
  const AL_L = escCmd(ESC, 0x61, 0x00);
  const BON = escCmd(ESC, 0x45, 0x01), BOFF = escCmd(ESC, 0x45, 0x00);
  const FLARGE = escCmd(GS, 0x21, 0x11), FNORM = escCmd(GS, 0x21, 0x00);
  const CUT = escCmd(GS, 0x56, 0x42, 0x00), NL = escCmd(LF);

  const cols = (typeof printerCols === 'function') ? printerCols() : 32;
  const printerDots = cols === 48 ? 576 : 384;
  const dash = escText('-'.repeat(cols) + '\n');

  const padLR = (l, r) => {
    const ls = String(l || ''), rs = String(r || '');
    const gap = cols - ls.length - rs.length;
    if (gap > 0) return ls + ' '.repeat(gap) + rs + '\n';
    return ls + '\n' + ' '.repeat(Math.max(0, cols - rs.length)) + rs + '\n';
  };
  // Only wrap for centered blocks — the printer's ESC a 1 handles the actual
  // centering. Manual space-padding would double-center (esp. wrong under
  // double-width FLARGE) and shift text to the right.
  const wrapForCenter = (s, wide) => {
    const effCols = wide ? Math.floor(cols / 2) : cols;
    return _wrapCols(s, effCols).join('\n') + '\n';
  };

  const parts = [INIT];

  // Logo (raster) — optional
  if (storeLogoBW) {
    const raster = await _escLogoRaster(storeLogoBW, printerDots);
    if (raster) parts.push(raster);
  }

  // Header (centered — rely on printer ESC a 1, only wrap long text)
  parts.push(AL_C);
  if (storeName) {
    parts.push(FLARGE, BON, escText(wrapForCenter(storeName, true)), BOFF, FNORM);
  }
  if (storeAddr) parts.push(escText(wrapForCenter(storeAddr, false)));
  if (storeWa) parts.push(escText(wrapForCenter('No. Telp ' + storeWa, false)));
  parts.push(escText(wrapForCenter(o.id, false)));

  // Divider + meta
  parts.push(AL_L, dash);
  const dateISO = _receiptDateISO(o);
  const time = _receiptTime(o);
  const rightRows = [
    o.handledBy || '',
    o.custName || '',
    (() => { const out = _receiptOutlet(o); return out ? (out.addr || out.name || '') : ''; })()
  ].filter(Boolean);
  const leftRows = [dateISO, time].filter(Boolean);
  const rowCount = Math.max(leftRows.length, rightRows.length);
  for (let i = 0; i < rowCount; i++) {
    parts.push(escText(padLR(leftRows[i] || '', rightRows[i] || '')));
  }
  if (o.tableNo) parts.push(escText('Meja: ' + o.tableNo + '\n'));
  parts.push(escText('No.' + o.id + '\n'));

  // Divider + items
  parts.push(dash);
  (o.items || []).forEach((it, idx) => {
    const numPrefix = (idx + 1) + '. ';
    const nameLines = _wrapCols(numPrefix + String(it.name), cols);
    // Bold first line (item name)
    parts.push(BON);
    nameLines.forEach(l => parts.push(escText(l + '\n')));
    parts.push(BOFF);
    // Detail line: "  qty x price" right-aligned "Rp lineTotal"
    const detail = '  ' + it.qty + ' x ' + fmtAmt(it.price);
    const total = 'Rp ' + fmtAmt(it.lineTotal);
    parts.push(escText(padLR(detail, total)));
  });

  parts.push(dash);

  // Total QTY
  const totalQty = _receiptTotalQty(o);
  parts.push(escText('Total QTY : ' + totalQty + '\n'));
  parts.push(escText('\n'));

  // Totals
  parts.push(escText(padLR('Sub Total', 'Rp ' + fmtAmt(o.subtotal))));
  if ((o.promoAmt || 0) > 0) parts.push(escText(padLR('Diskon Promo', '-Rp ' + fmtAmt(o.promoAmt))));
  parts.push(BON, escText(padLR('Total', 'Rp ' + fmtAmt(o.total))), BOFF);
  parts.push(escText(padLR('Bayar (' + (o.payMethod || 'Tunai') + ')', 'Rp ' + fmtAmt(o.total))));
  parts.push(escText(padLR('Kembali', 'Rp 0')));

  if (o.notes) parts.push(escText('\nCatatan: ' + o.notes + '\n'));

  // Footer (centered — printer handles alignment)
  parts.push(NL, AL_C);
  parts.push(escText(wrapForCenter(storeFooter || 'Terima kasih telah berbelanja', false)));
  if (receiptLink) {
    parts.push(NL);
    parts.push(escText(wrapForCenter('Link Kritik dan Saran:', false)));
    parts.push(escText(wrapForCenter(receiptLink, false)));
  }

  parts.push(NL, NL, NL, CUT);
  return concatBuf(...parts);
}

// Cached printer characteristic (avoid re-scanning services on every print)
let _btChar = null;

function _attachDevListeners(dev) {
  if (!dev._kasirBound) {
    dev._kasirBound = true;
    dev.addEventListener('gattserverdisconnected', () => {
      _btChar = null;
      // keep _btDev reference so next connect() re-uses it
      if (typeof _renderPrinterStatus === 'function') _renderPrinterStatus();
    });
  }
}

// Try to reconnect to a previously-paired printer without showing the chooser.
// Returns the device on success, null if unavailable (never throws for silent path).
async function _reconnectBtSilent() {
  try {
    if (_btDev && _btDev.gatt) {
      if (_btDev.gatt.connected) return _btDev;
      await _btDev.gatt.connect();
      _attachDevListeners(_btDev);
      return _btDev;
    }
    const savedId = localStorage.getItem(_BT_ID_KEY);
    if (!savedId || !navigator.bluetooth || !navigator.bluetooth.getDevices) return null;
    const devs = await navigator.bluetooth.getDevices();
    const d = devs.find(x => x.id === savedId);
    if (!d) return null;
    await d.gatt.connect();
    _btDev = d;
    _attachDevListeners(d);
    return d;
  } catch (e) {
    // Silent path — swallow so caller can decide UX
    return null;
  }
}

// Fresh device pick via chooser. MUST be called from a user gesture.
async function _pairBtInteractive() {
  const dev = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: _BT_SVCS
  });
  await dev.gatt.connect();
  _btDev = dev;
  _btChar = null;
  localStorage.setItem(_BT_ID_KEY, dev.id);
  _attachDevListeners(dev);
  return dev;
}

// Try silent reconnect first; if it fails and interactive is true, show chooser.
async function _getBtDevice(opts) {
  const interactive = opts && opts.interactive;
  const dev = await _reconnectBtSilent();
  if (dev) return dev;
  if (interactive) return await _pairBtInteractive();
  return null;
}

// Resolve the writable printer characteristic. Cached; re-discovers if needed.
async function _getBtChar(dev) {
  if (_btChar && dev.gatt && dev.gatt.connected) return _btChar;
  const server = dev.gatt.connected ? dev.gatt : await dev.gatt.connect();
  for (const svcId of _BT_SVCS) {
    try {
      const svc = await server.getPrimaryService(svcId);
      for (const cId of _BT_CHARS) {
        try { const c = await svc.getCharacteristic(cId); _btChar = c; return c; } catch (e) {}
      }
      const cs = await svc.getCharacteristics();
      const c = cs.find(x => x.properties.writeWithoutResponse || x.properties.write) || cs[0] || null;
      if (c) { _btChar = c; return c; }
    } catch (e) {}
  }
  throw new Error('Karakteristik printer tidak ditemukan');
}

async function _writeToPrinter(char, data) {
  const CHUNK = 128;
  const useWithout = char.properties.writeWithoutResponse && !char.properties.write;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if (useWithout) await char.writeValueWithoutResponse(chunk);
    else await char.writeValue(chunk);
    await new Promise(r => setTimeout(r, 60));
  }
}

// Preconnect fire-and-forget — called when POS/receipt UI shows so first print is instant.
function warmPrinter() {
  if (!navigator.bluetooth || !localStorage.getItem(_BT_ID_KEY)) return;
  _reconnectBtSilent().catch(() => {});
}

async function printBluetooth() {
  if (!navigator.bluetooth) {
    toast('Browser tidak mendukung Bluetooth. Buka via Chrome (Android) atau install aplikasi.', 'err');
    return;
  }
  const el = g('receipt-body'); if (!el) return;
  const ordId = el.dataset.orderId;
  const o = orders.find(x => x.id === ordId);
  if (!o) { toast('Data pesanan tidak ditemukan', 'err'); return; }

  const savedId = localStorage.getItem(_BT_ID_KEY);
  toast(savedId ? 'Menyambung printer...' : 'Pilih printer Bluetooth...');

  const doPrintOnce = async () => {
    // Interactive only if user has NEVER paired — otherwise silent + throw on failure
    const dev = await _getBtDevice({ interactive: !savedId });
    if (!dev) throw Object.assign(new Error('no-device'), { code: 'no-device' });
    const char = await _getBtChar(dev);
    const data = await buildEscReceiptResto(o);
    await _writeToPrinter(char, data);
  };

  try {
    await doPrintOnce();
    toast('Berhasil dicetak!');
  } catch (e) {
    // Transient GATT issues → retry once after fresh reconnect
    const transient = /GATT|Network|disconnect|not connected|InvalidState|NotSupported/i.test(e.message || '');
    if (transient && savedId) {
      try {
        _btChar = null;
        if (_btDev && _btDev.gatt && _btDev.gatt.connected) { try { _btDev.gatt.disconnect(); } catch (_) {} }
        await new Promise(r => setTimeout(r, 400));
        await doPrintOnce();
        toast('Berhasil dicetak!');
        return;
      } catch (e2) { e = e2; }
    }
    if (e.code === 'no-device' || e.name === 'NotFoundError') {
      toast('Printer tidak dapat dijangkau. Buka menu Printer untuk memilih ulang.', 'err');
    } else if (e.name === 'NotAllowedError') {
      toast('Izin Bluetooth ditolak.', 'warn');
    } else {
      toast('Gagal cetak: ' + (e.message || e), 'err');
    }
  }
}

// ─── Printer Settings Modal (accessible dari POS untuk owner & staff) ────────

function openPrinterModal() {
  _renderPrinterStatus();
  // Sync paper width radio
  document.querySelectorAll('input[name="printer-width-pos"]').forEach(r => {
    r.checked = (r.value === String(printerWidth));
  });
  openModal('m-printer');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  // Show install button if the browser has queued an install prompt
  const installBtn = g('btn-install-pwa');
  if (installBtn) {
    const inStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    installBtn.style.display = (window.deferredInstallPrompt && !inStandalone) ? '' : 'none';
  }
  // Attempt silent reconnect then refresh status when it settles
  if (localStorage.getItem(_BT_ID_KEY)) {
    _reconnectBtSilent().finally(() => _renderPrinterStatus());
  }
}

function _renderPrinterStatus() {
  const el = g('printer-status');
  if (!el) return;
  const savedId = localStorage.getItem(_BT_ID_KEY);
  const connected = _btDev && _btDev.gatt && _btDev.gatt.connected;
  if (connected) {
    el.innerHTML = `<span style="color:var(--gr);font-weight:600">&#x25CF; Terhubung</span><br>
      <span style="font-size:12px;color:var(--t2)">${esc(_btDev.name || 'Printer')}</span>`;
  } else if (savedId) {
    el.innerHTML = `<span style="color:var(--am);font-weight:600">&#x25CF; Tersimpan (belum terhubung)</span><br>
      <span style="font-size:12px;color:var(--t2)">Printer akan otomatis dihubungkan saat mencetak.</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--t2);font-weight:600">&#x25CB; Belum ada printer</span><br>
      <span style="font-size:12px;color:var(--t2)">Tekan "Sambungkan / Ganti" untuk memilih printer Bluetooth.</span>`;
  }
}

async function btConnectPrinter() {
  if (!navigator.bluetooth) { toast('Browser tidak mendukung Bluetooth. Gunakan Chrome Android atau install PWA.', 'err'); return; }
  toast('Memilih printer...');
  try {
    _btChar = null;
    const dev = await _pairBtInteractive();
    toast('Printer tersambung: ' + (dev.name || dev.id));
    _renderPrinterStatus();
  } catch (e) {
    if (e.name === 'NotFoundError' || e.name === 'NotAllowedError') toast('Pemilihan printer dibatalkan.', 'warn');
    else toast('Gagal menyambung: ' + e.message, 'err');
  }
}

function btForgetPrinter() {
  if (!confirm('Lupakan printer yang tersimpan?')) return;
  try { if (_btDev && _btDev.gatt && _btDev.gatt.connected) _btDev.gatt.disconnect(); } catch (e) {}
  // Also revoke Web Bluetooth permission if the API is available (Chrome ≥85)
  try {
    if (_btDev && typeof _btDev.forget === 'function') _btDev.forget();
  } catch (e) {}
  _btDev = null;
  _btChar = null;
  localStorage.removeItem(_BT_ID_KEY);
  toast('Printer dilupakan');
  _renderPrinterStatus();
}

async function btTestPrint() {
  if (!navigator.bluetooth) { toast('Browser tidak mendukung Bluetooth.', 'err'); return; }
  const savedId = localStorage.getItem(_BT_ID_KEY);
  toast('Mengirim test print...');
  try {
    const dev = await _getBtDevice({ interactive: !savedId });
    if (!dev) throw new Error('Printer tidak ditemukan. Sambungkan terlebih dahulu.');
    const char = await _getBtChar(dev);
    const ESC = 0x1B, GS = 0x1D;
    const cols = (typeof printerCols === 'function') ? printerCols() : 32;
    const parts = [
      escCmd(ESC, 0x40),
      escCmd(ESC, 0x61, 0x01),
      escCmd(ESC, 0x45, 0x01), escCmd(GS, 0x21, 0x11),
      escText('TEST PRINT\n'),
      escCmd(GS, 0x21, 0x00), escCmd(ESC, 0x45, 0x00),
      escText((storeName || 'KasirHnY') + '\n'),
      escText('Lebar: ' + printerPaperMM() + ' mm (' + cols + ' kolom)\n'),
      escText(new Date().toLocaleString('id-ID') + '\n\n'),
      escText('-'.repeat(cols) + '\n'),
      escText('Jika teks ini rapi, printer siap.\n'),
      escText('-'.repeat(cols) + '\n\n\n'),
      escCmd(GS, 0x56, 0x42, 0x00)
    ];
    await _writeToPrinter(char, concatBuf(...parts));
    toast('Test print terkirim!');
    _renderPrinterStatus();
  } catch (e) {
    if (e.name === 'NotFoundError' || e.name === 'NotAllowedError') toast('Pemilihan printer dibatalkan.', 'warn');
    else toast('Gagal test print: ' + (e.message || e), 'err');
    _renderPrinterStatus();
  }
}

// Ubah lebar kertas dari modal POS (tersedia untuk owner & staff).
function savePrinterWidthQuick(val) {
  if (val !== '55' && val !== '80') return;
  printerWidth = val;
  syncSettings();
  toast('Ukuran kertas: ' + val + ' mm');
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
