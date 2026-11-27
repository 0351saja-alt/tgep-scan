-- v46b (27/11/2026): izinkan 2 DDR (atau lebih) untuk rig + tanggal + shift yang sama bila Hole ID berbeda (pindah titik dalam satu shift).
-- JALANKAN DI SQL EDITOR SUPABASE (memuat DROP CONSTRAINT, tidak bisa lewat apply_migration):
-- https://supabase.com/dashboard/project/ytrvezripgkzuwyjvmnb/sql/new
-- Persiapan (kolom ganti_id, fungsi ddr_boleh_per_lubang, gabung_ddr_ganda & pindah_kunci_ddr) sudah dipasang lewat v46a.
-- Setelah file ini dijalankan, aturan "satu DDR per rig/tanggal/shift" menjadi "satu DDR per rig/tanggal/shift/Hole ID".
create unique index if not exists ddr_rig_tgl_shift_bhid_key on public.ddr (rig, report_date, shift, coalesce(bhid, ''));
alter table public.ddr drop constraint if exists ddr_rig_report_date_shift_key;
select public.ddr_boleh_per_lubang() as ddr_per_lubang_aktif;  -- harus true
