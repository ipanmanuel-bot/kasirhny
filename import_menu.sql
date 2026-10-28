-- ═══════════════════════════════════════════════════════════════════
-- Import 137 menu items dari export H&Y bakery (kacang bawang plastik → telur putih)
-- Target: user_id = 'ROTIHNY'
-- Strategi: APPEND ke settings row (tidak overwrite item existing).
--          Kategori auto-match by nama (case-insensitive). Bikin baru kalau belum ada.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id  text := 'ROTIHNY';
  v_cats     jsonb;
  v_items    jsonb;
  v_cat_ctr  int;
  v_menu_ctr int;
  needed_cats text[] := ARRAY['titipan','Roti','Kue','Roti Tawar','Uncategorized'];
  ct         text;
  found_id   text;
  new_cat_id text;
  cat_map    jsonb := '{}'::jsonb;
  new_items_input jsonb := '[{"name": "kacang bawang plastik", "price": 23000, "cat": "titipan"}, {"name": "kacang hijau", "price": 5000, "cat": "Roti"}, {"name": "kacang medan", "price": 20000, "cat": "Uncategorized"}, {"name": "Kacang Merah", "price": 5000, "cat": "Roti"}, {"name": "kacang telur", "price": 17000, "cat": "Kue"}, {"name": "kacang telur kecil", "price": 15000, "cat": "Uncategorized"}, {"name": "kacang wisman", "price": 90000, "cat": "Uncategorized"}, {"name": "Kappit Oiginal", "price": 85000, "cat": "titipan"}, {"name": "kappit wijen", "price": 85000, "cat": "titipan"}, {"name": "KASTANGAL WISMAN", "price": 90000, "cat": "Uncategorized"}, {"name": "Kastangel Cookies", "price": 100000, "cat": "titipan"}, {"name": "KASTANGEL HNY", "price": 70000, "cat": "Uncategorized"}, {"name": "keju Cream", "price": 5000, "cat": "Roti"}, {"name": "Keju Dalam", "price": 5000, "cat": "Roti"}, {"name": "keju Gulung", "price": 5000, "cat": "Roti"}, {"name": "Keju Luar", "price": 5000, "cat": "Roti"}, {"name": "Keju Manis", "price": 5000, "cat": "Roti"}, {"name": "keju susu", "price": 5000, "cat": "Roti"}, {"name": "kelapa", "price": 4000, "cat": "Roti"}, {"name": "kelapa pandan", "price": 5000, "cat": "Roti"}, {"name": "Kopi", "price": 5000, "cat": "Roti"}, {"name": "krenes", "price": 20000, "cat": "titipan"}, {"name": "Krienes", "price": 19000, "cat": "Uncategorized"}, {"name": "kripik bawang", "price": 25000, "cat": "titipan"}, {"name": "KRIPIK kentang", "price": 12000, "cat": "titipan"}, {"name": "kripik kentang a", "price": 35000, "cat": "titipan"}, {"name": "KRIPIK KENTANG KEJU", "price": 15000, "cat": "titipan"}, {"name": "krupuk bangka", "price": 15000, "cat": "titipan"}, {"name": "Krupuk bawang", "price": 10000, "cat": "Uncategorized"}, {"name": "KRUPUK GETAS", "price": 18000, "cat": "titipan"}, {"name": "krupuk ikan", "price": 15000, "cat": "titipan"}, {"name": "krupuk jengkol", "price": 15000, "cat": "titipan"}, {"name": "krupuk kemplang", "price": 18000, "cat": "titipan"}, {"name": "KUE KACANG", "price": 65000, "cat": "Uncategorized"}, {"name": "kue satu", "price": 15000, "cat": "titipan"}, {"name": "kue tart", "price": 135000, "cat": "Kue"}, {"name": "KUE TART KECIL", "price": 50000, "cat": "Kue"}, {"name": "KUE TART MINI", "price": 30000, "cat": "Kue"}, {"name": "kue U", "price": 125000, "cat": "Kue"}, {"name": "Kue Ulang Tahun", "price": 150000, "cat": "Kue"}, {"name": "kue Ulang tahun 2", "price": 110000, "cat": "Kue"}, {"name": "kue ulang tahun 3", "price": 75000, "cat": "Kue"}, {"name": "Kue Ulang Tahun 32", "price": 250000, "cat": "Kue"}, {"name": "kue Ultah", "price": 100000, "cat": "Kue"}, {"name": "KUE ULTAH BESAR", "price": 300000, "cat": "Kue"}, {"name": "Kue Ultah Pesanan", "price": 200000, "cat": "Kue"}, {"name": "kura kura", "price": 5000, "cat": "Roti"}, {"name": "LAPIS SPESIAL 16x16", "price": 160000, "cat": "titipan"}, {"name": "LAPIS SPESIAL 16X16 A", "price": 150000, "cat": "Uncategorized"}, {"name": "LAPIS SPESIAL 19X19", "price": 250000, "cat": "Uncategorized"}, {"name": "LAPIS SPESIAL 20X20", "price": 260000, "cat": "titipan"}, {"name": "LAPIS SURABAYA H&Y", "price": 50000, "cat": "Kue"}, {"name": "lapis surabaya kecil", "price": 30000, "cat": "Uncategorized"}, {"name": "Lapis Surabaya Slice", "price": 5000, "cat": "Kue"}, {"name": "LIDAH KUCING", "price": 60000, "cat": "Uncategorized"}, {"name": "lilin k,", "price": 1000, "cat": "Uncategorized"}, {"name": "lilin kcil", "price": 5000, "cat": "Uncategorized"}, {"name": "lilin ultah", "price": 2000, "cat": "Uncategorized"}, {"name": "LOLI POP", "price": 6000, "cat": "titipan"}, {"name": "makaroni besar", "price": 18000, "cat": "titipan"}, {"name": "makaroni pedas", "price": 7000, "cat": "Kue"}, {"name": "Marmer", "price": 37000, "cat": "Kue"}, {"name": "MELINJO", "price": 20000, "cat": "titipan"}, {"name": "Melting pineapple roll cookies", "price": 40000, "cat": "Kue"}, {"name": "Mesis", "price": 5000, "cat": "Roti"}, {"name": "Mesis gulung", "price": 5000, "cat": "Roti"}, {"name": "Nanas", "price": 4000, "cat": "Roti"}, {"name": "NASTAR H&Y", "price": 70000, "cat": "Kue"}, {"name": "NASTAR KLASIK", "price": 100000, "cat": "titipan"}, {"name": "NASTAR ROLL", "price": 125000, "cat": "titipan"}, {"name": "NASTAR WISMAN", "price": 90000, "cat": "Uncategorized"}, {"name": "Opak", "price": 18000, "cat": "titipan"}, {"name": "opak besar 250grm", "price": 16000, "cat": "Uncategorized"}, {"name": "Oreo", "price": 5000, "cat": "Roti"}, {"name": "Paket 1 Roti 1 Minum", "price": 6000, "cat": "Uncategorized"}, {"name": "Paket 2 Roti + minum", "price": 10000, "cat": "Uncategorized"}, {"name": "paket 3 roti", "price": 14000, "cat": "Uncategorized"}, {"name": "PAKET 3 ROTI A", "price": 13000, "cat": "Roti"}, {"name": "PAKET 3 ROTI MINUM", "price": 15000, "cat": "Roti"}, {"name": "PAKET LEBARAN GRAND", "price": 90000, "cat": "titipan"}, {"name": "PAKET LEBARAN SIGNATURE", "price": 100000, "cat": "titipan"}, {"name": "paket roti 1", "price": 6000, "cat": "Uncategorized"}, {"name": "PAKET ROTI 2", "price": 9000, "cat": "Uncategorized"}, {"name": "Paket Roti Binus", "price": 6000, "cat": "Uncategorized"}, {"name": "paket roti isi 2", "price": 10000, "cat": "Roti"}, {"name": "Peanut butter kuih kapit", "price": 30000, "cat": "Kue"}, {"name": "PEANUT KAMPIT KECIL", "price": 30000, "cat": "titipan"}, {"name": "peyek", "price": 25000, "cat": "titipan"}, {"name": "PIA", "price": 20000, "cat": "Kue"}, {"name": "Pineapple roll edam cheese cookies", "price": 40000, "cat": "Kue"}, {"name": "pisang bolen", "price": 35000, "cat": "titipan"}, {"name": "Pisang Coklat", "price": 5000, "cat": "Roti"}, {"name": "Pisang Keju", "price": 5000, "cat": "Roti"}, {"name": "Pisang Keju Coklat", "price": 5000, "cat": "Roti"}, {"name": "pisang seres", "price": 5000, "cat": "Roti"}, {"name": "Pisang Susu", "price": 5000, "cat": "Roti"}, {"name": "Pizza Ayam", "price": 5000, "cat": "Roti"}, {"name": "Polo Coklat", "price": 5000, "cat": "Roti"}, {"name": "Polo Coklat Keju", "price": 5000, "cat": "Roti"}, {"name": "Polo Keju", "price": 5000, "cat": "Roti"}, {"name": "polo strawberry", "price": 5000, "cat": "Roti"}, {"name": "polo susu", "price": 5000, "cat": "Roti"}, {"name": "Polo Susu Coklat", "price": 5000, "cat": "Roti"}, {"name": "Polo Susu Pandan", "price": 5000, "cat": "Roti"}, {"name": "POPCORN", "price": 23000, "cat": "titipan"}, {"name": "PUDING PUYO", "price": 8000, "cat": "Uncategorized"}, {"name": "Putih Telur", "price": 10000, "cat": "Uncategorized"}, {"name": "putri salsu", "price": 100000, "cat": "titipan"}, {"name": "Rendang Beef Egg Roll", "price": 100000, "cat": "titipan"}, {"name": "RENGINANG", "price": 20000, "cat": "titipan"}, {"name": "Rol Cake.", "price": 30000, "cat": "Kue"}, {"name": "ROTI BUAYA", "price": 300000, "cat": "Uncategorized"}, {"name": "roti keset", "price": 5000, "cat": "Roti"}, {"name": "Roti manis", "price": 5000, "cat": "Roti"}, {"name": "ROTI TAWAR", "price": 12000, "cat": "Roti Tawar"}, {"name": "Sagu Keju", "price": 100000, "cat": "titipan"}, {"name": "sagu keju wisman", "price": 90000, "cat": "Uncategorized"}, {"name": "Sambal Shrimp Egg Roll", "price": 100000, "cat": "titipan"}, {"name": "seres", "price": 5000, "cat": "Roti"}, {"name": "SINGAPURE KAMPIT KECIL", "price": 30000, "cat": "titipan"}, {"name": "singkong balado", "price": 10000, "cat": "Uncategorized"}, {"name": "singkong pedas", "price": 15000, "cat": "Uncategorized"}, {"name": "Sisir", "price": 5000, "cat": "Roti"}, {"name": "SLICE CAKE", "price": 10000, "cat": "Uncategorized"}, {"name": "Sosis Coklat", "price": 5000, "cat": "Roti"}, {"name": "sosis keju", "price": 5000, "cat": "Roti"}, {"name": "Sosis Luar", "price": 5000, "cat": "Roti"}, {"name": "Srikaya", "price": 5000, "cat": "Roti"}, {"name": "Srikaya Pandan", "price": 5000, "cat": "Roti"}, {"name": "Strawberry tart cookies", "price": 40000, "cat": "Kue"}, {"name": "Strawbery", "price": 5000, "cat": "Roti"}, {"name": "susu", "price": 5000, "cat": "Roti"}, {"name": "Susu Coklat", "price": 5000, "cat": "Roti"}, {"name": "susu keju", "price": 5000, "cat": "Roti"}, {"name": "Susu Pandan", "price": 5000, "cat": "Roti"}, {"name": "Susu Vanilla", "price": 5000, "cat": "Roti"}, {"name": "telur putih", "price": 15000, "cat": "Uncategorized"}]'::jsonb;
  it         jsonb;
  final_items jsonb := '[]'::jsonb;
  cat_id_for_item text;
  added_count int;
BEGIN
  -- 1. Load existing settings row
  SELECT
    COALESCE(menu_cats,  '[]')::jsonb,
    COALESCE(menu_items, '[]')::jsonb,
    COALESCE(cat_ctr, 1),
    COALESCE(menu_ctr, 1)
  INTO v_cats, v_items, v_cat_ctr, v_menu_ctr
  FROM settings
  WHERE user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settings row untuk user_id % tidak ditemukan. Login ke app dulu supaya row-nya kebentuk.', v_user_id;
  END IF;

  -- 2. Ensure setiap kategori yang dibutuhkan ada (match by lowercased name)
  FOREACH ct IN ARRAY needed_cats LOOP
    SELECT c->>'id' INTO found_id
    FROM jsonb_array_elements(v_cats) AS c
    WHERE lower(c->>'name') = lower(ct)
    LIMIT 1;

    IF found_id IS NULL THEN
      new_cat_id := 'cat' || v_cat_ctr;
      v_cats := v_cats || jsonb_build_array(jsonb_build_object(
        'id',    new_cat_id,
        'name',  ct,
        'order', jsonb_array_length(v_cats) + 1
      ));
      v_cat_ctr := v_cat_ctr + 1;
      cat_map := cat_map || jsonb_build_object(ct, new_cat_id);
      RAISE NOTICE '  + kategori baru: % (id=%)', ct, new_cat_id;
    ELSE
      cat_map := cat_map || jsonb_build_object(ct, found_id);
      RAISE NOTICE '  = pakai kategori existing: % (id=%)', ct, found_id;
    END IF;
  END LOOP;

  -- 3. Bangun items baru dengan id + catId proper
  FOR it IN SELECT * FROM jsonb_array_elements(new_items_input) LOOP
    cat_id_for_item := cat_map->>(it->>'cat');
    final_items := final_items || jsonb_build_array(jsonb_build_object(
      'id',     'mn' || v_menu_ctr,
      'name',   it->>'name',
      'price',  (it->>'price')::int,
      'catId',  cat_id_for_item,
      'desc',   '',
      'active', true
    ));
    v_menu_ctr := v_menu_ctr + 1;
  END LOOP;

  added_count := jsonb_array_length(final_items);

  -- 4. Update settings (cast jsonb → text karena client-side pakai JSON.parse)
  UPDATE settings
  SET menu_cats  = v_cats::text,
      menu_items = (v_items || final_items)::text,
      cat_ctr    = v_cat_ctr,
      menu_ctr   = v_menu_ctr
  WHERE user_id = v_user_id;

  RAISE NOTICE 'Selesai. % item ditambahkan. menu_ctr baru=%, cat_ctr baru=%.',
    added_count, v_menu_ctr, v_cat_ctr;
END $$;

-- (Opsional) Verifikasi jumlah menu setelah import:
-- SELECT
--   jsonb_array_length(menu_items::jsonb) AS total_menu,
--   jsonb_array_length(menu_cats::jsonb)  AS total_cats,
--   menu_ctr, cat_ctr
-- FROM settings WHERE user_id = 'ROTIHNY';
