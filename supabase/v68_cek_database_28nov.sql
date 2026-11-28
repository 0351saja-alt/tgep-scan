-- v68 (28/11/2026): pemeriksaan & perbaikan database
--  • uji silang DDR↔logging: core > interval (swelling) dibatasi panjang interval sebelum dibandingkan (13 jadi OK)
--  • revoke EXECUTE anon untuk daftar_proyek() & ddr_boleh_per_lubang() (dipanggil hanya setelah login)
--  • DH-NPG 0910 core 1,00 → 0,65 (tercatat di sample_edit_log)
-- BELUM JALAN (butuh persetujuan; jalankan di SQL Editor): hapus 4 marking berkoordinat rusak (X negatif), diarsipkan dulu ke deleted_record
begin;
insert into public.deleted_record(table_name, record_key, bhid, data, reason, deleted_by, deleted_at)
select 'marking', m.id::text, m.bhid, to_jsonb(m), 'Koordinat rusak (X negatif / di luar UTM 51S) — dibersihkan 28/11/2026', 'e1ec54e7-170e-448b-b7ef-40a535dcd78c', now()
from public.marking m where m.x_utm not between 100000 and 900000 or m.y_utm not between 9000000 and 10000000;
delete from public.marking where x_utm not between 100000 and 900000 or y_utm not between 9000000 and 10000000;
commit;
