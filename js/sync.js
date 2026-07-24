// sync.js — Supabase integration + localStorage persistence
// KasirHnY

const SUPABASE_URL = 'https://eimqoidhdyuqpbpmlkvz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_z_zDDwhodZaYFAXeyiWEQQ_6ET0zrPe';

let supabase = null;
let supaEnabled = false;
let currentUserId = null;

// ─── Init ────────────────────────────────────────────────────────────────────

function initSync() {
  if (typeof window.supabase !== 'undefined') {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      supaEnabled = true;
    } catch (e) {
      console.warn('[sync] Supabase init failed:', e);
    }
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function checkSession() {
  if (!supaEnabled || !supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUserId = session.user.id;
      return session.user;
    }
  } catch (e) { console.warn('[auth] checkSession error:', e); }
  return null;
}

async function authSignIn(email, password) {
  if (!supaEnabled || !supabase) return { error: 'Supabase tidak tersedia' };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    currentUserId = data.user.id;
    return { user: data.user };
  } catch (e) { return { error: e.message }; }
}

async function authSignUp(email, password) {
  if (!supaEnabled || !supabase) return { error: 'Supabase tidak tersedia' };
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user && !data.session) return { needConfirm: true };
    currentUserId = data.user.id;
    return { user: data.user };
  } catch (e) { return { error: e.message }; }
}

async function authSignOut() {
  if (supaEnabled && supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
  currentUserId = null;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function sbUpsert(table, data) {
  if (!supaEnabled || !supabase) return;
  try {
    const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
    if (error) console.warn('[sync] upsert error', table, error.message);
  } catch (e) {
    console.warn('[sync] sbUpsert exception', e);
  }
}

async function sbFetch(table) {
  if (!supaEnabled || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', currentUserId);
    if (error) { console.warn('[sync] fetch error', table, error.message); return null; }
    return data;
  } catch (e) {
    console.warn('[sync] sbFetch exception', e);
    return null;
  }
}

async function sbDelete(table, id) {
  if (!supaEnabled || !supabase) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', currentUserId);
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

function syncOrder(o) {
  // Save all orders to localStorage
  localStorage.setItem('cprs_orders', JSON.stringify(orders));
  // Optionally push to Supabase
  sbUpsert('orders', orderToRow(o));
}

function syncAllOrders() {
  localStorage.setItem('cprs_orders', JSON.stringify(orders));
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
  localStorage.setItem('cprs_kas', JSON.stringify(kasLog));
  sbUpsert('kas_log', kasToRow(l));
}

function syncAllKas() {
  localStorage.setItem('cprs_kas', JSON.stringify(kasLog));
}

// ─── Supabase full load ───────────────────────────────────────────────────────

async function supaLoadAll() {
  if (!supaEnabled) return;

  // Load settings
  const settingsRows = await sbFetch('settings');
  if (settingsRows && settingsRows.length > 0) {
    _applySettings(settingsRows[0]);
  }

  // Load orders
  const orderRows = await sbFetch('orders');
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

  // Load kas
  const kasRows = await sbFetch('kas_log');
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
