# CleanPOS Resto — Project Reference (KasirHnY)

Panduan cepat untuk sesi Claude berikutnya. Baca file ini dulu sebelum menyentuh kode.

## 1. Ringkasan Aplikasi

- **Brand / UI:** **KasirHnY** — awalnya "Resto & Cafe", **sekarang dipakai untuk toko roti** (bakery). Semua transaksi langsung selesai (roti ready).
- **Jenis:** POS single-page, HTML + vanilla JS, tanpa framework, tanpa build step.
- **Bahasa UI:** Indonesia.
- **Deploy:** Vercel. `vercel.json` sekarang **selective rewrite** — tidak menangkap `sw.js`, `manifest.json`, `icon.*`, `js/*`, PNG/SVG/ICO. Header khusus: `sw.js` no-cache + `Service-Worker-Allowed: /`, `manifest.json` MIME benar.
- **Backend:** Supabase (URL & anon key hardcoded di `js/sync.js`).
- **Cache lokal:** `localStorage` (offline-first — Supabase untuk sync antar device).
- **PWA:** `manifest.json` + `sw.js` (app-shell cache-first, CDN stale-while-revalidate, Supabase network-only, offline fallback ke `index.html`). Icon: `icon.svg` (maskable). Install prompt via `beforeinstallprompt` — tombol muncul di modal Printer POS.
- **Cetak struk:** Web Bluetooth (ESC/POS) + fallback jendela `window.print()`. Layout 55mm / 80mm, logo BW otomatis, printer di-cache & auto-reconnect (silent), preconnect saat POS/receipt render.
- **Login model:** Kode toko (multi-tenant) → pilih role Owner (password) atau Staff (Outlet → Karyawan → PIN 4 digit).

## 2. Struktur Repo

```
/
├── index.html          # Semua HTML + CSS (design tokens di :root)
├── js/
│   ├── sync.js         # Supabase client + localStorage helpers (load DULU)
│   ├── app.js          # Auth, nav, dashboard, orders, kas, laporan, menu CRUD, promo, settings
│   └── pos.js          # POS (cart, checkout, receipt HTML+ESC/POS, Bluetooth print, printer modal)
├── manifest.json       # PWA manifest (standalone, brand color, shortcuts)
├── sw.js               # Service worker (versioned cache, activate/fetch/message handlers)
├── icon.svg            # PWA icon (maskable, brand blue)
├── vercel.json         # Selective SPA rewrite + PWA headers
└── CLAUDE.md           # File ini
```

Load order di `index.html`:
1. Supabase CDN
2. Chart.js
3. Lucide icons
4. `sync.js` → `app.js` → `pos.js`
5. Init inline: `initSync()` → `loadLocalSettings()` → jika ada `cprs_code` → `supaLoadAll()` + `goLogin()`; else `showCodeScreen()`
6. SW registration + `beforeinstallprompt` handler + auto-reload saat `controllerchange`

## 3. Model Data (in-memory state di `app.js`)

Semua state global adalah variabel `let` top-level.

| Var           | Bentuk                                                                                             |
|---------------|----------------------------------------------------------------------------------------------------|
| `menuCats`    | `[{ id, name, order }]` — id format `cat<N>`                                                       |
| `menuItems`   | `[{ id, name, price, catId, desc, active }]` — id format `mn<N>`                                   |
| `promos`      | `[{ id, name, catId, discType, discVal, days, from, to, active, note, ...beli_gratis fields }]`   |
| `outlets`     | `[{ id, name, addr }]` — id format `o<N>`                                                          |
| `employees`   | `[{ id, name, pin, oid, role }]` — id format `e<N>`, `pin` = string angka 4–6 digit                |
| `orders`      | `[{ id, items[], subtotal, discAmt, promoAmt, total, payMethod, payStatus, status, tableNo, custName, notes, handledBy, outletId, date, isoDate }]` — `status` selalu `'Selesai'`, `payStatus` selalu `'Lunas'` untuk pesanan baru. `tableNo/custName/notes` selalu string kosong (input dihapus dari POS). |
| `kasLog`      | `[{ id, type: 'in'|'out', desc, note, amount, time, date, outlet_id }]` — id format `k<N>`         |
| Counters      | `menuCtr, catCtr, empCtr, outCtr, promoCtr, kasCtr`                                                |
| Settings      | `storeName, storeAddr, storeWa, storeFooter, ownerPwd, storeLogo, storeLogoBW, printerWidth, receiptLink` |
| Period state  | `dashPS, ordPS, kasPS, repPS` — bentuk `{ mode: 'day'|'week'|'month', offset: number }` (0 = current, -1 = prev, dst) |
| Report state  | `repMenuSort = { key, dir }`, `repMenuPage`                                                        |

### Struktur `promo`
- **Tipe:** `discType ∈ {'persen', 'nominal', 'beli_gratis'}`.
- **Persen/nominal:** pakai `catId` (`'all'` atau id kategori) + `discVal`.
- **Beli-gratis:** `buyType, buyItemId|buyCatId, buyQty, freeType, freeItemId|freeCatId, freeQty`. Overlap: kalau pool buy & free sama, `1 set = buyQty + freeQty` unit.
- **Hari:** `days` = array string `'0'..'6'` (0 = Minggu). Kosong = tiap hari.
- **Periode:** `from`, `to` = `YYYY-MM-DD`.

### Struktur `order.items`
```js
{ id, name, qty, price, lineTotal }
```
Snapshot saat checkout — tidak reference ke `menuItems` lagi (rename menu tidak mengubah order lama). Kategori di Laporan di-resolve dari `menuItems` live via `it.id`; kalau menu sudah dihapus, kategori muncul sebagai `—`.

## 4. Skema Supabase

Client dibuat di `js/sync.js`:
```
URL: https://eimqoidhdyuqpbpmlkvz.supabase.co
Anon key: (di-hardcode) — RLS harus batasi per user_id
```

Semua write via `sbUpsert(table, data)` dengan `{ onConflict: 'id' }`. Semua fetch via `sbFetch(table)` filter `.eq('user_id', currentUserId)`. Delete via `sbDelete(table, id)`.

### Tabel

**`store_codes`** — daftar kode toko yang valid
- `code` (string) — cek eksistensi saat login (`checkStoreCode`)

**`settings`** — 1 row per kode toko (id = `<code>_settings`)
- `id`, `user_id`
- `store_name`, `store_addr`, `store_wa`, `store_footer`, `owner_pwd`
- **Baru:** `store_logo`, `store_logo_bw`, `printer_width`, `receipt_link` — perlu di-`ALTER TABLE` di Supabase, lihat §12.
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
- **Menu, kategori, promo, employee, outlet TIDAK punya tabel sendiri.** Semua di-serialize sebagai JSON string di kolom `settings`. Setiap perubahan panggil `syncSettings()` yang menulis ulang seluruh row.
- **Orders & kas_log** adalah tabel row-per-record.
- **Logo:** disimpan sebagai base64 data URL di kolom `store_logo` (original, downscale max 400px) dan `store_logo_bw` (threshold hitam-putih). Awas ukuran row settings kalau logo besar.

## 5. localStorage Keys

| Key             | Isi                                              |
|-----------------|--------------------------------------------------|
| `cprs_code`     | Kode toko (juga dipakai sebagai `user_id`)       |
| `cprs_settings` | Cache seluruh row settings (JSON)                |
| `cprs_orders`   | Cache orders (JSON array)                        |
| `cprs_kas`      | Cache kas_log (JSON array)                       |
| `cprs_seeded`   | Flag `'1'` supaya seed data hanya jalan sekali   |
| `kasirhny_bt_id`| ID device Bluetooth printer terakhir (Web BT persistence via `getDevices()`) |

Kalau `cprs_seeded` belum di-set, `loadLocalSettings()` panggil `seedData()` → isi menu contoh + kategori + 1 outlet Pusat + 1 karyawan Budi (PIN 0000). Default owner pwd = `'1234'`.

## 6. Halaman & Fungsi Utama

| Page (`data-page`) | Container id     | Render func         | Akses  | Fitur                                                            |
|--------------------|------------------|---------------------|--------|------------------------------------------------------------------|
| `dashboard`        | `p-dashboard`    | `refreshDash`       | Owner  | Period nav segmented, revenue, count, cash/non-cash, top item, chart 7 hari |
| `pos`              | `p-pos`          | `renderPOS`         | Semua  | Menu grid + cart minimal (no cust/table/notes), promo auto-detect, checkout → auto kas in, tombol Printer |
| `orders`           | `p-orders`       | `renderOrders`      | Owner  | Period nav, kartu 5-kolom single-line (grid), pagination 10/hal, detail modal + delete |
| `kas`              | `p-kas`          | `renderKas`         | Owner  | Period nav, saldo/in/out, group by date                          |
| `report`           | `p-report`       | `renderReport`      | Owner  | **Rekap per Kategori (atas) + per Menu (bawah)**. Menu table: sortable header (Nama/Kategori/Qty/Pendapatan), pagination 10/hal. Export CSV per tabel. |
| `menu`             | `p-menu`         | `renderMenuPage`    | Owner  | Tab Daftar Menu / Kategori, filter, search, toggle aktif         |
| `promo`            | `p-promo`        | `renderPromo`       | Owner  | CRUD promo persen/nominal/beli-gratis                            |
| `settings`         | `p-settings`     | `renderSettings`    | Owner  | Info toko, ubah password owner, karyawan, outlet, **logo upload + printer width + footer + receipt link** |

Nav diatur di `goPage(page)`. Staff hanya boleh akses `pos` (`_applyRoleAccess`, `staffAllowed = ['pos']`). Halaman `report` otomatis owner-only.

## 7. Period Nav (shared component)

Semua halaman dengan filter tanggal pakai UI seragam: **segmented control [Harian / Mingguan / Bulanan] + `‹` prev / label / `›` next**. Custom date picker sudah dihapus.

- State per page: `{ mode: 'day'|'week'|'month', offset: number }` (offset 0 = current, -1 = prev, dst).
- Helper: `resolvePeriod(ps) → {from, to, label}`, `matchesPeriod(dateISO, ps)`, `renderPeriodNav(containerId, ps, onChange)`.
- Label context-aware: "Hari Ini" / "Kemarin" / "N hari lalu" / full date; "Minggu Ini" / "Minggu Lalu" / "07 - 13 Sep 2026"; "Bulan Ini" / "Bulan Lalu" / "Agustus 2026".
- Tombol `›` disabled saat offset ≥ 0 (tidak bisa ke masa depan yang belum ada data).
- Ganti mode → auto reset offset ke 0.
- Definisi di `js/app.js` sekitar §Utility (baris ~145–235).

## 8. Alur Login (state machine)

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
Owner → Dashboard. Staff → POS.

## 9. Flow Checkout (POS)

`placeOrder()` di `pos.js`:
1. `recalcCart()` — subtotal, cek promo `beli_gratis` dulu, fallback ke persen/nominal.
2. Buat object order (`status: 'Selesai'`, `payStatus: 'Lunas'`, `custName/tableNo/notes` empty) → `orders.unshift(o)` → `syncOrder(o)`.
3. **Selalu** buat entri kas `type: 'in'` (untuk semua metode bayar).
4. `clearCart()` → tampilkan modal receipt → tombol **Cetak** (browser/system printer) atau **BT** (Bluetooth ESC/POS).

## 10. Struk & Printer

### Layout struk (HTML + ESC/POS)
Cocok referensi "Karis Jaya Shop":
1. Logo BW (center, optional)
2. Nama toko (bold + double-width)
3. Alamat / telp / order ID (center)
4. Divider
5. Meta 2 kolom: kiri = tanggal ISO + jam, kanan = kasir / customer / outlet address (kalau ada)
6. `No.<order-id>` left-aligned
7. Divider
8. Item bernomor: `1. Nama Menu` (bold) → `  qty x price` ┅ `Rp lineTotal`
9. Divider
10. `Total QTY : N`
11. Sub Total, Diskon Promo (kalau ada), **Total** (bold), Metode Bayar
12. Divider + footer center + link kritik saran (kalau di-set)

Baris **Bayar** & **Kembali sudah dihapus** — diganti satu baris "Metode Bayar: Tunai/Transfer/QRIS" (semua order langsung Lunas, jadi kembalian selalu 0 dan tidak informatif).

### Printer width
- `printerWidth` ∈ `'55'` | `'80'` (mm). Setting per-store (bukan per-device).
- HTML print: `@page size:<width>mm auto; margin:0;` + CSS scaled per width.
- ESC/POS: `printerCols()` → 32 (55mm) atau 48 (80mm); `_wrapCols(text, cols)` untuk wrap; **centering pakai `ESC a 1` printer**, JANGAN pre-pad manual (dobel-center bikin geser ke kanan, terutama saat FLARGE double-width).

### Logo BW conversion
- `_logoToBW(img)` di `app.js` — canvas downscale ke max 400px + threshold luminance <150 → hitam, else putih.
- Untuk ESC/POS: `_escLogoRaster(dataUrl, printerDots)` di `pos.js` — render ke canvas selebar 60% printer (aligned ke multiple 8 dots), threshold, generate `GS v 0` raster command.

### Bluetooth persistence (Android PWA-friendly)
Kunci: **tidak perlu re-select printer setiap cetak**.

- `_reconnectBtSilent()` — pakai `navigator.bluetooth.getDevices()` untuk reconnect device yang sudah pernah di-grant permission, tanpa chooser.
- `_pairBtInteractive()` — chooser via `requestDevice()`, hanya dipanggil sekali di tombol "Sambungkan / Ganti" atau saat print pertama (belum pernah pair).
- `_getBtDevice({ interactive })` — try silent dulu, chooser hanya kalau flag interactive.
- `_getBtChar(dev)` — cache karakteristik (`_btChar`), tidak scan service ulang setiap cetak.
- `warmPrinter()` — fire-and-forget reconnect saat `renderPOS()` atau `openOrderReceipt()` dipanggil, biar cetak pertama instan.
- `printBluetooth()` — silent reconnect + 1x retry pada GATT transient error; chooser hanya kalau belum pernah pair.
- Modal Printer di POS (`m-printer`) — status koneksi live, tombol Sambungkan / Lupakan / Test Cetak, radio 55/80mm, tombol Install PWA (kalau `beforeinstallprompt` sudah fired), tips Android.

## 11. Konvensi Kode

- Semua fungsi & state **expose global** (tidak ada modul/import). Fitur baru = tambah `function` top-level + panggil dari `onclick` HTML.
- Helper generik di `app.js`: `g(id)`, `esc(s)`, `fmt(n)` (Rp), `todayISO()`, `todayStr()`, `_localYMD(d)`, `genId()`, `openModal(id)`, `closeModal(id)`, `toast(msg, type)`, `resolvePeriod`, `matchesPeriod`, `renderPeriodNav`.
- **Timezone:** `todayISO()` pakai `getFullYear/getMonth/getDate` (lokal). `isoToDate(iso)` sekarang parse `new Date(iso)` lalu ambil komponen lokal — **jangan** slice `toISOString()` (bug UTC). Gunakan `_localYMD(d)` untuk konversi Date → `YYYY-MM-DD` lokal di tempat lain.
- Class CSS sistem token (`--p`, `--bg`, `--r`, dll.) di `:root`. Warna primer biru `#2563EB`.
- **Setiap** mutasi menu/kategori/promo/employee/outlet/logo/printer-width/receipt-link → `syncSettings()`.
- Mutasi order → `syncOrder(o)` atau `syncAllOrders()`. Mutasi kas → `syncKas(l)` atau `syncAllKas()`.
- `deleteOrder(id)` juga menghapus kas entry terkait (`desc === 'Penjualan - <id>'`) supaya saldo tidak stale.

## 12. Migrasi Supabase (perlu dijalankan sekali)

Kolom baru untuk logo/printer/footer/link:
```sql
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS store_logo TEXT,
  ADD COLUMN IF NOT EXISTS store_logo_bw TEXT,
  ADD COLUMN IF NOT EXISTS printer_width TEXT,
  ADD COLUMN IF NOT EXISTS receipt_link TEXT;
```
Tanpa kolom ini, `syncSettings()` bakal munculin toast "Sync gagal" (data lokal tetap tersimpan).

## 13. Cara Bulk-Import Menu

Belum ada UI. Opsi:
1. **Console (tercepat):** login owner → DevTools → set `menuCats`, `menuItems`, update counters → `syncSettings()` → `renderMenuPage()`.
2. **Edit `seedData()` + clear `cprs_seeded`** — cuma cocok kalau belum ada data real.
3. **Tambah UI Import CSV/JSON** — recommended kalau reusable.

Yang perlu di-clarify sebelum eksekusi: format file, kolom, overwrite vs merge, mapping kategori, jalur import.

## 14. Known Quirks

- Kas mapping: field UI `desc` ↔ kolom DB `label`.
- `settings` = satu row raksasa dengan blob JSON + logo base64 — hati-hati ukuran kalau menu ribuan atau logo besar.
- Anon key di-commit — RLS Supabase harus rapat: `select` untuk `store_codes`, dan write/read `settings/orders/kas_log` scope per `user_id`.
- `.DS_Store` ter-track di git.
- Legacy order dengan `status: 'Baru'` masih ada di data lama; UI sekarang tidak tampilkan status badge (badge diganti payStatus). Field `status` tetap disimpan.
- Web Bluetooth cuma jalan di **Chrome Android / Edge**, bukan Firefox / iOS Safari. Untuk iOS, apple-touch-icon SVG tidak ideal — perlu PNG kalau mau optimasi iOS home screen.
- `getDevices()` (Web BT persistence) butuh Chrome ≥85 dengan permission backend baru (default di Chrome modern).

## 15. Cara Menjalankan Lokal

Serve static: `python3 -m http.server 8765` atau Vercel dev. Tidak ada build step, tidak ada npm.

Untuk test PWA di Android: deploy ke Vercel (HTTPS wajib), atau tunneling (ngrok/cloudflared). SW butuh HTTPS atau localhost.

## 16. Referensi File & Line (current)

`js/app.js` (~1936 baris):
- Global state: 4–66
- Helpers (fmt/date/period nav/etc.): 68–233
- Seed: 235–261
- Auth flow: 263–467
- Navigation: 469–500
- Dashboard: 503–603
- Orders (list + card + pagination + detail + delete): 605–770
- Kas: 771–864
- Promo logic: 866–1195 (approx)
- Report (data / sort / render / CSV export): 1197–1420
- Menu Management: 1422+
- Settings + logo + printer helpers: ~1600+

`js/pos.js` (~923 baris):
- Cart state + render: 4–129
- Cart ops + place order: 131–254
- Receipt modal + HTML builder + CSS: 256–415
- Browser/system print: 418–455
- ESC/POS Bluetooth (helpers, wrap, raster logo, builder): 457–636
- Printer connection (silent reconnect / pair / char cache / warm / print): 640–785
- Printer settings modal + handlers: 787–893
- POS input handlers + mobile toggle: 896–923

`js/sync.js` (~322 baris): settings row + apply, orders/kas map, `supaLoadAll`.

`index.html` (~1698 baris): CSS di `<style>`, semua halaman + modal, script boot + PWA registration di akhir.

`sw.js`, `manifest.json`, `icon.svg`, `vercel.json` — root-level PWA files.

## 17. Riwayat Perubahan Besar (untuk konteks cepat)

- **Struk thermal + printer settings** — layout Karis Jaya style, 55/80mm, logo BW, footer, link.
- **PWA setup** — manifest, SW, install prompt, icon, vercel headers.
- **Bluetooth persistence** — silent reconnect via `getDevices()`, char cache, warm preconnect, retry on transient GATT.
- **Timezone fix** — `isoToDate` + chart pakai local date, bukan UTC slice.
- **Bakery mode** — status default `'Selesai'`, hapus tombol "Tandai Selesai", filter status, badge status, input cust/table/notes di POS. Tambah delete order (+ kas terkait).
- **Struk final** — hapus Bayar/Kembali (gak ada kembalian di semua metode bayar), ganti satu baris "Metode Bayar".
- **Center-align fix** — hapus manual space padding, andalkan `ESC a 1` printer.
- **Laporan page** — per-menu + per-kategori (kategori di atas), sortable menu header, pagination 10/hal, CSV export.
- **Period nav baru** — segmented Harian/Mingguan/Bulanan + prev/next arrows, replace old date filter di Dashboard/Orders/Kas/Report. Custom date picker dihapus.
- **Orders list compact** — kartu grid 5 kolom single-line (desktop), 2 baris (mobile), pagination 10/hal.
