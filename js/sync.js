// sync.js — Supabase integration + localStorage persistence
// KasirHnY

const SUPABASE_URL = 'https://eimqoidhdyuqpbpmlkvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbXFvaWRoZHl1cXBicG1sa3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzM0NzcsImV4cCI6MjEwMDQ0OTQ3N30.zSNPtFuRYZmvjC2259iJFBM2cUPPA7az03FCKAsa_6Q';

let sbClient = null;
let supaEnabled = false;
let currentUserId = null;

// ─── Init ────────────────────────────────────────────────────────────────────

function initSync() {
  const saved = localStorage.getItem('cprs_code');
  if (saved) currentUserId = saved;

  if (sbClient) return;

  if (typeof window.supabase !== 'undefined') {
    try {
      sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      supaEnabled = true;
    } catch (e) {
      console.warn('[sync] Supabase init failed:', e);
    }
  }
}

// ─── Kode Toko ───────────────────────────────────────────────────────────────

function getStoredCode() {
  return localStorage.getItem('cprs_code') || null;
}

function saveStoreCode(code) {
  localStorage.setItem('cprs_code', code);
  currentUserId = code;
}

function clearStoreCode() {
  localStorage.removeItem('cprs_code');
  currentUserId = null;
}

async function checkStoreCode(code) {
  if (!supaEnabled || !sbClient) return { valid: false, error: 'Koneksi Supabase belum siap. Coba refresh.' };
  try {
    const tout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    const req = sbClient.from('store_codes').select('code').eq('code', code).maybeSingle();
    const { data, error } = await Promise.race([req, tout]);
    if (error) return { valid: false, error: error.message };
    return { valid: !!data };
  } catch (e) {
    return { valid: false, error: e.message === 'timeout' ? 'Koneksi timeout' : e.message };
  }
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function sbUpsert(table, data) {
  if (!supaEnabled || !sbClient) {
    if (typeof toast === 'function') toast('Supabase belum siap', 'err');
    return;
  }
  if (!currentUserId) {
    if (typeof toast === 'function') toast('Kode toko belum diset', 'err');
    return;
  }
  try {
    const { error } = await sbClient.from(table).upsert(data, { onConflict: 'id' });
    if (error) {
      console.warn('[sync] upsert error', table, error);
      if (typeof toast === 'function') toast('Sync gagal: ' + error.message, 'err');
    }
  } catch (e) {
    console.warn('[sync] sbUpsert exception', e);
    if (typeof toast === 'function') toast('Sync exception: ' + e.message, 'err');
  }
}

async function sbFetch(table, opts = {}) {
  if (!supaEnabled || !sbClient) return null;
  try {
    let q = sbClient.from(table).select('*').eq('user_id', currentUserId);
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending === true });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) { console.warn('[sync] fetch error', table, error.message); return null; }
    return data;
  } catch (e) {
    console.warn('[sync] sbFetch exception', e);
    return null;
  }
}

// Fetch ALL rows via pagination (PostgREST max-rows cap is per-request, usually 1000)
async function sbFetchAll(table, opts = {}) {
  if (!supaEnabled || !sbClient) return null;
  const pageSize = 1000;
  const all = [];
  let from = 0;
  try {
    while (true) {
      let q = sbClient.from(table).select('*').eq('user_id', currentUserId);
      if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending === true });
      q = q.range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) {
        console.warn('[sync] fetchAll error', table, error.message);
        return all.length ? all : null;
      }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  } catch (e) {
    console.warn('[sync] sbFetchAll exception', e);
    return all.length ? all : null;
  }
}

async function sbDelete(table, id) {
  if (!supaEnabled || !sbClient) return;
  try {
    const { error } = await sbClient.from(table).delete().eq('id', id).eq('user_id', currentUserId);
    if (error) console.warn('[sync] delete error', table, error.message);
  } catch (e) {
    console.warn('[sync] sbDelete exception', e);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

function buildSettingsRow() {
  return {
    id: currentUserId + '_settings',
    user_id: currentUserId || 'local',
    store_name: storeName,
    store_addr: storeAddr,
    store_wa: storeWa,
    store_footer: storeFooter,
    store_logo: storeLogo,
    store_logo_bw: storeLogoBW,
    printer_width: printerWidth,
    receipt_link: receiptLink,
    owner_pwd: ownerPwd,
    menu_items: JSON.stringify(menuItems),
    menu_cats: JSON.stringify(menuCats),
    promos: JSON.stringify(promos),
    employees: JSON.stringify(employees),
    outlets: JSON.stringify(outlets),
    menu_ctr: menuCtr,
    cat_ctr: catCtr,
    emp_ctr: empCtr,
    out_ctr: outCtr,
    promo_ctr: promoCtr
  };
}

function _saveSettingsLocal() {
  const row = buildSettingsRow();
  localStorage.setItem('cprs_settings', JSON.stringify(row));
}

function _applySettings(s) {
  if (!s) return;
  if (s.store_name !== undefined) storeName = s.store_name;
  if (s.store_addr !== undefined) storeAddr = s.store_addr;
  if (s.store_wa !== undefined) storeWa = s.store_wa;
  if (s.store_footer !== undefined) storeFooter = s.store_footer;
  if (s.store_logo !== undefined) storeLogo = s.store_logo || '';
  if (s.store_logo_bw !== undefined) storeLogoBW = s.store_logo_bw || '';
  if (s.printer_width !== undefined && s.printer_width) printerWidth = String(s.printer_width);
  if (s.receipt_link !== undefined) receiptLink = s.receipt_link || '';
  if (s.owner_pwd !== undefined) ownerPwd = s.owner_pwd;
  if (s.menu_items) {
    try { menuItems = JSON.parse(s.menu_items); } catch (e) { menuItems = []; }
  }
  if (s.menu_cats) {
    try { menuCats = JSON.parse(s.menu_cats); } catch (e) { menuCats = []; }
  }
  if (s.promos) {
    try { promos = JSON.parse(s.promos); } catch (e) { promos = []; }
  }
  if (s.employees) {
    try { employees = JSON.parse(s.employees); } catch (e) { employees = []; }
  }
  if (s.outlets) {
    try { outlets = JSON.parse(s.outlets); } catch (e) { outlets = []; }
  }
  if (s.menu_ctr) menuCtr = s.menu_ctr;
  if (s.cat_ctr) catCtr = s.cat_ctr;
  if (s.emp_ctr) empCtr = s.emp_ctr;
  if (s.out_ctr) outCtr = s.out_ctr;
  if (s.promo_ctr) promoCtr = s.promo_ctr;
}

function loadLocalSettings() {
  initSync();
  const raw = localStorage.getItem('cprs_settings');
  if (raw) {
    try {
      const s = JSON.parse(raw);
      _applySettings(s);
    } catch (e) {
      console.warn('[sync] Failed to parse local settings');
    }
  }

  // Load orders from localStorage
  const rawOrders = localStorage.getItem('cprs_orders');
  if (rawOrders) {
    try { orders = JSON.parse(rawOrders); } catch (e) { orders = []; }
  }

  // Load kas from localStorage
  const rawKas = localStorage.getItem('cprs_kas');
  if (rawKas) {
    try {
      kasLog = JSON.parse(rawKas);
      kasCtr = kasLog.length + 1;
    } catch (e) { kasLog = []; }
  }

  // Seed if first launch
  const seeded = localStorage.getItem('cprs_seeded');
  if (!seeded) {
    seedData();
    _saveSettingsLocal();
    localStorage.setItem('cprs_seeded', '1');
  }
}

function syncSettings() {
  _saveSettingsLocal();
  sbUpsert('settings', buildSettingsRow());
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function orderToRow(o) {
  return {
    id: o.id,
    user_id: currentUserId || 'local',
    items: JSON.stringify(o.items),
    subtotal: o.subtotal,
    disc_amt: o.discAmt,
    promo_amt: o.promoAmt,
    total: o.total,
    pay_method: o.payMethod,
    pay_status: o.payStatus,
    status: o.status,
    table_no: o.tableNo || '',
    cust_name: o.custName || '',
    notes: o.notes || '',
    handled_by: o.handledBy || '',
    outlet_id: o.outletId || '',
    date: o.date,
    iso_date: o.isoDate
  };
}

// localStorage caches recent entries only; Supabase is source of truth for full history.
// Caps keep quota safe (~5MB per origin) as orders accumulate.
const LOCAL_ORDERS_CAP = 2000;
const LOCAL_KAS_CAP = 2000;

function _safeSetItem(key, value, fallbackSlice) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('[sync] localStorage quota exceeded for', key, '— retrying with smaller slice');
    try { localStorage.setItem(key, fallbackSlice); }
    catch (e2) { console.warn('[sync] localStorage second attempt failed for', key, e2); }
  }
}

function syncOrder(o) {
  syncAllOrders();
  sbUpsert('orders', orderToRow(o));
}

function syncAllOrders() {
  const slice = orders.slice(0, LOCAL_ORDERS_CAP);
  _safeSetItem('cprs_orders', JSON.stringify(slice), JSON.stringify(orders.slice(0, 500)));
}

// ─── Kas ─────────────────────────────────────────────────────────────────────

function kasToRow(l) {
  return {
    id: l.id,
    user_id: currentUserId || 'local',
    type: l.type,
    label: l.desc,
    note: l.note || '',
    amount: l.amount,
    time: l.time,
    date: l.date,
    outlet_id: l.outlet_id || ''
  };
}

function syncKas(l) {
  syncAllKas();
  sbUpsert('kas_log', kasToRow(l));
}

function syncAllKas() {
  const slice = kasLog.slice(0, LOCAL_KAS_CAP);
  _safeSetItem('cprs_kas', JSON.stringify(slice), JSON.stringify(kasLog.slice(0, 500)));
}

// ─── Supabase full load ───────────────────────────────────────────────────────

async function supaLoadAll() {
  if (!supaEnabled) return;

  // Load settings
  const settingsRows = await sbFetch('settings');
  if (settingsRows && settingsRows.length > 0) {
    _applySettings(settingsRows[0]);
  }

  // Load ALL orders (paginated) so Report page has full historical access
  const orderRows = await sbFetchAll('orders', { orderBy: 'iso_date', ascending: false });
  if (orderRows && orderRows.length > 0) {
    orders = orderRows.map(r => ({
      id: r.id,
      items: (() => { try { return JSON.parse(r.items); } catch (e) { return []; } })(),
      subtotal: r.subtotal,
      discAmt: r.disc_amt,
      promoAmt: r.promo_amt,
      total: r.total,
      payMethod: r.pay_method,
      payStatus: r.pay_status,
      status: r.status,
      tableNo: r.table_no,
      custName: r.cust_name,
      notes: r.notes,
      handledBy: r.handled_by,
      outletId: r.outlet_id,
      date: r.date,
      isoDate: r.iso_date
    }));
    syncAllOrders();
  }

  // Load ALL kas (paginated) so Report / Kas page has full historical access
  const kasRows = await sbFetchAll('kas_log', { orderBy: 'date', ascending: false });
  if (kasRows && kasRows.length > 0) {
    kasLog = kasRows.map(r => ({
      id: r.id,
      type: r.type,
      desc: r.label,
      note: r.note,
      amount: r.amount,
      time: r.time,
      date: r.date,
      outlet_id: r.outlet_id
    }));
    kasCtr = kasLog.length + 1;
    syncAllKas();
  }
}
