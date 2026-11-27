-- v54 (27/11/2026): wellsite (geologist) boleh ✏️ Edit data aktivitas bor (keterangan, kedalaman, koordinat foto, dll.) dari Progres bor;
-- tetap wajib alasan & tercatat di data_edit_log (seperti verifier/admin).
do $mig$
declare d text := pg_get_functiondef('public.admin_ubah_data'::regproc);
begin
  if position('p_tabel in (''kirim_preparasi'',''kirim_preparasi_item'')' in d) = 0 then raise exception 'pola admin_ubah_data berubah'; end if;
  d := replace(d, 'p_tabel in (''kirim_preparasi'',''kirim_preparasi_item'')', 'p_tabel in (''kirim_preparasi'',''kirim_preparasi_item'',''drill_event'')');
  execute d;
end $mig$;
