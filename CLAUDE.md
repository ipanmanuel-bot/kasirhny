# CleanPOS Resto — Project Reference (KasirHnY)

Panduan cepat untuk sesi Claude berikutnya. Baca file ini dulu sebelum menyentuh kode.

## 1. Ringkasan Aplikasi

- **Nama produk / brand di UI:** **KasirHnY** (subtitle: *Resto & Cafe*).
- **Jenis:** Aplikasi POS (Point of Sale) berbasis web untuk resto/cafe, single-page, tanpa framework.
- **Bahasa UI:** Bahasa Indonesia.
- **Deploy:** Vercel (`vercel.json` rewrite semua route ke `index.html`).
- **Backend:** Supabase (URL & anon key di-hardcode di `js/sync.js`).
- **Cache lokal:** `localStorage` (offline-first — Supabase untuk sync antar device).
- **Cetak struk:** Web Bluetooth (ESC/POS) + fallback jendela `window.print()`. Layout 55mm/80mm, logo BW otomatis, printer di-cache & auto-reconnect (silent).
- **PWA:** `manifest.json` + `sw.js` (app-shell cache-first, CDN stale-while-revalidate, Supabase network-only). Install prompt via `beforeinstallprompt` — tombol muncul di modal Printer POS. Icon: `icon.svg` (maskable).
- **Login model:** Kode toko (multi-tenant) → pilih role Owner (password) atau Staff (Outlet → Karyawan → PIN 4 digit).

## 2. Struktur Repo

```
/
├── index.html          # Semua HTML + CSS (design tokens di :root)
├── js/
│   ├── sync.js         # Supabase client + localStorage helpers (load DULU)
│   ├── app.js          # Auth, nav, dashboard, orders, kas, menu CRUD, promo, settings
│   └── pos.js          # Halaman POS (cart, checkout, receipt, Bluetooth print)
├── vercel.json         # SPA rewrite
└── .gitignore
```

Load order di `index.html`:
1. Supabase CDN
2. Chart.js
3. Lucide icons
4. `sync.js` → `app.js` → `pos.js`
5. Init inline: `initSync()` → `loadLocalSettings()` → jika ada `cprs_code` → `supaLoadAll()` + `goLogin()`; else `showCodeScreen()`

## 3. Model Data (in-memory state di `app.js`)

Semua state global adalah variabel `let` top-level.

| Var           | Bentuk                                                                                             |
|---------------|----------------------------------------------------------------------------------------------------|
| `menuCats`    | `[{ id, name, order }]` — id format `cat<N>`                                                       |
| `menuItems`   | `[{ id, name, price, catId, desc, active }]` — id format `mn<N>`                                   |
| `promos`      | `[{ id, name, catId, discType, discVal, days, from, to, active, note, ...beli_gratis fields }]`   |
| `outlets`     | `[{ id, name, addr }]` — id format `o<N>`                                                          |
| `employees`   | `[{ id, name, pin, oid, role }]` — id format `e<N>`, `pin` = string angka 4–6 digit                |
| `orders`      | `[{ id, items[], subtotal, discAmt, promoAmt, total, payMethod, payStatus, status, tableNo, custName, notes, handledBy, outletId, date, isoDate }]` |
| `kasLog`      | `[{ id, type: 'in'|'out', desc, note, amount, time, date, outlet_id }]` — id format `k<N>`         |
| Counters      | `menuCtr, catCtr, empCtr, outCtr, promoCtr, kasCtr` — dipakai untuk generate id berikutnya         |
| Settings      | `storeName, storeAddr, storeWa, storeFooter, ownerPwd` (password owner hashed SHA-256 setelah first change; default plain `'1234'`) |

### Struktur `promo`
- **Tipe:** `discType ∈ {'persen', 'nominal', 'beli_gratis'}`.
- **Persen/nominal:** pakai `catId` (`'all'` atau id kategori) + `discVal`.
- **Beli-gratis:** `buyType, buyItemId|buyCatId, buyQty, freeType, freeItemId|freeCatId, freeQty`. Aturan overlap: kalau pool buy & free sama, `1 set = buyQty + freeQty` unit.
- **Hari:** `days` = array string `'0'..'6'` (0 = Minggu). Kosong = tiap hari.
- **Periode:** `from`, `to` = `YYYY-MM-DD`.

### Struktur `order.items`
```js
{ id, name, qty, price, lineTotal }
```
Snapshot saat checkout — tidak reference ke `menuItems` lagi (jadi rename menu tidak mengubah order lama).

## 4. Skema Supabase

Client dibuat di `js/sync.js`:

```
URL: https://eimqoidhdyuqpbpmlkvz.supabase.co
Anon key: (di-hardcode) — RLS harus batasi per user_id
```

Semua write via `sbUpsert(table, data)` dengan `{ onConflict: 'id' }`. Semua fetch via `sbFetch(table)` filter `.eq('user_id', currentUserId)`.

### Tabel

**`store_codes`** — daftar kode toko yang valid
- `code` (string) — cek eksistensi saat login (`checkStoreCode`)

**`settings`** — 1 row per kode toko (id = `<code>_settings`)
- `id`, `user_id`
- `store_name`, `store_addr`, `store_wa`, `store_footer`, `owner_pwd`
- `menu_items`, `menu_cats`, `promos`, `employees`, `outlets` — **semua JSON string** (bukan tabel terpisah!)
- `menu_ctr, cat_ctr, emp_ctr, out_ctr, promo_ctr`

**`orders`** — 1 row per pesanan
- `id`, `user_id`
- `items` (JSON string), `subtotal`, `disc_amt`, `promo_amt`, `total`
- `pay_method`, `pay_status`, `status`
- `table_no`, `cust_name`, `notes`, `handled_by`, `outlet_id`
- `date`, `iso_date`

**`kas_log`** — 1 row per entri kas
- `id`, `user_id`, `type` (`in`/`out`), `label`, `note`, `amount`, `time`, `date`, `outlet_id`
- ⚠️ Field UI-nya `desc` tapi di DB kolomnya `label` (di-map di `kasToRow`/`supaLoadAll`).

### Konvensi penting
- **Menu, kategori, promo, employee, outlet TIDAK punya tabel sendiri.** Mereka disimpan sebagai JSON string di dalam kolom `settings`. Setiap perubahan menu memanggil `syncSettings()` yang menulis ulang seluruh row `settings`.
- **Orders & kas_log** adalah tabel row-per-record.

## 5. localStorage Keys

| Key             | Isi                                              |
|-----------------|--------------------------------------------------|
| `cprs_code`     | Kode toko (juga dipakai sebagai `user_id`)       |
| `cprs_settings` | Cache seluruh row settings (JSON)                |
| `cprs_orders`   | Cache orders (JSON array)                        |
| `cprs_kas`      | Cache kas_log (JSON array)                       |
| `cprs_seeded`   | Flag `'1'` supaya seed data hanya jalan sekali   |
| `kasirhny_bt_id`| ID device Bluetooth printer terakhir             |

Kalau `cprs_seeded` belum di-set, `loadLocalSettings()` panggil `seedData()` → isi menu contoh (Nasi Goreng, dll.) + kategori Makanan/Minuman/Dessert + 1 outlet Pusat + 1 karyawan Budi (PIN 0000). Default owner pwd = `'1234'`.

## 6. Halaman & Fungsi Utama

| Page (`data-page`) | Container id     | Render func         | Fitur                                                            |
|--------------------|------------------|---------------------|------------------------------------------------------------------|
| `dashboard`        | `p-dashboard`    | `refreshDash`       | Tabs today/week/month, revenue, count, cash/non-cash, top items, bar chart 7 hari |
| `pos`              | `p-pos`          | `renderPOS`         | Menu grid + cart, table/customer/note, promo auto-detect, checkout → auto kas in |
| `orders`           | `p-orders`       | `renderOrders`      | Filter tanggal + status + payment, paginasi 15/hal, detail modal |
| `kas`              | `p-kas`          | `renderKas`         | Saldo, in/out, group by date                                     |
| `menu`             | `p-menu`         | `renderMenuPage`    | Tab Daftar Menu / Kategori, filter kategori, search, toggle aktif |
| `promo`            | `p-promo`        | `renderPromo`       | CRUD promo persen/nominal/beli-gratis                            |
| `settings`         | `p-settings`     | `renderSettings`    | Info toko, ubah password owner, karyawan, outlet                 |

Nav diatur di `goPage(page)`. Staff (bukan owner) hanya boleh akses page `pos` (lihat `_applyRoleAccess`).

## 7. Alur Login (state machine)

```
scr-code   → input kode toko → checkStoreCode() → simpan cprs_code
scr-login  → pilih Owner / Staff
   ↓ Owner
scr-opwd   → input password → hashSecret → cek → _launchApp() (curRole='owner')
   ↓ Staff
scr-outlet → pilih outlet
scr-staff  → pilih karyawan
scr-pin    → PIN 4 digit → cocok dengan employees[i].pin → _launchApp() (curRole='staff')
```

Owner → langsung ke Dashboard. Staff → langsung ke POS.

## 8. Flow Checkout (POS)

`placeOrder()` di `pos.js`:
1. `recalcCart()` — hitung subtotal, cek promo `beli_gratis` dulu, fallback ke promo persen/nominal.
2. Buat object order → `orders.unshift(o)` → `syncOrder(o)` (localStorage + Supabase upsert).
3. **Selalu** buat entri kas `type: 'in'` (walau non-tunai — semua langsung `payStatus: 'Lunas'`).
4. `clearCart()` → tampilkan modal receipt → tombol Cetak (browser) / BT (Bluetooth ESC/POS).

## 9. Konvensi Kode

- Semua fungsi & state di-**expose global** (tidak ada modul/import). Cara nambah fitur = tambah `function` top-level dan panggil dari `onclick` HTML.
- Helper generik di `app.js`: `g(id)`, `esc(s)`, `fmt(n)` (Rp), `todayISO()`, `todayStr()`, `genId()`, `openModal(id)`, `closeModal(id)`, `toast(msg, type)`.
- Class CSS sistem token (`--p`, `--bg`, `--r`, dll.) di `:root`. Skema warna primer biru `#2563EB`.
- **Setiap** mutasi menu/kategori/promo/employee/outlet **wajib** panggil `syncSettings()`.
- Mutasi order → `syncOrder(o)` atau `syncAllOrders()`. Mutasi kas → `syncKas(l)` atau `syncAllKas()`.

## 10. Cara Bulk-Import Menu (untuk sesi ini)

Ada beberapa jalur yang bisa dipakai kalau user mau input banyak menu sekaligus dari export POS lain:

### Opsi A — Paste JS di browser console (paling cepat, no code change)
1. Buka aplikasi di browser, login (owner).
2. Buka DevTools console.
3. Konversi data user ke format `menuItems` + `menuCats`, lalu jalankan sesuatu seperti:
   ```js
   // Contoh — dijalankan setelah data disiapkan
   menuCats = [/* array kategori baru */];
   menuItems = [/* array menu baru */];
   catCtr = menuCats.length + 1;
   menuCtr = menuItems.length + 1;
   syncSettings();       // simpan ke localStorage + upsert Supabase
   renderMenuPage();     // refresh UI
   ```
4. Refresh halaman → data harus tetap ada (sudah tersync).

### Opsi B — Edit `seedData()` sementara + clear `cprs_seeded`
Hanya cocok kalau belum ada data real yang mau dipertahankan.

### Opsi C — Tambah UI Import (recommended kalau user mau reusable)
- Tambah tombol "Import Menu" di halaman Menu, terima file CSV/JSON.
- Parse → generate `menuItems` dengan id `mn<catCtr++>`, map kategori (bikin baru kalau belum ada).
- Panggil `syncSettings()`.

### Yang perlu di-clarify dari user sebelum eksekusi
1. Format file export? (CSV / XLSX / JSON / XML)
2. Kolom yang ada? (nama, harga, kategori, deskripsi, gambar, SKU, dll.)
3. Perlu overwrite semua menu existing, atau merge/append?
4. Kategori di file export perlu di-map ke kategori existing atau bikin baru semua?
5. Import lewat mana? (paste console vs. tambah UI import permanen)

## 11. Known Quirks

- `store_footer` tidak ada input UI-nya di halaman Settings — hanya dari default `'Terima kasih telah berkunjung!'`.
- Kas mapping: field UI `desc` ↔ kolom DB `label`.
- `settings` disimpan sebagai satu row raksasa dengan blob JSON — hati-hati kalau menu banyak sekali (ribuan) karena setiap perubahan re-upload semuanya.
- Anon key di-commit ke repo — RLS di Supabase harus rapat (hanya `select` untuk `store_codes`, dan write/read `settings/orders/kas_log` di-scope `user_id`).
- `.DS_Store` ter-track di git (di-modify pula).

## 12. Cara Menjalankan Lokal

Serve static (misal `python3 -m http.server` atau Vercel dev). Tidak ada build step, tidak ada dependency npm.

## 13. Referensi File & Line

- Init & load: `js/sync.js:13`, `js/sync.js:162`, `index.html:1395`
- Auth flow: `js/app.js:161-323`
- Seed data: `js/app.js:133-157`
- Menu CRUD: `js/app.js:1273-1338`
- POS checkout: `js/pos.js:214-266`
- Bluetooth print: `js/pos.js:335-438`
- Promo logic: `js/app.js:1058-1129`
- Supabase upsert/fetch: `js/sync.js:58-102`
