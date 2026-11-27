-- v47 (27/11/2026, dipasang lewat apply_migration): admin_ubah_data mengizinkan geologist mengedit kirim_preparasi & kirim_preparasi_item
-- (form pengiriman sample), selain verifier/admin. Diterapkan dengan mengganti baris cek peran di definisi fungsi.
do $mig$
declare d text := pg_get_functiondef('public.admin_ubah_data'::regproc);
begin
  d := replace(d, 'if peran not in (''verifier'',''admin'') then raise exception ''Hanya verifier/admin yang boleh mengedit data ini''; end if;',
    'if peran not in (''verifier'',''admin'') and not (peran = ''geologist'' and p_tabel in (''kirim_preparasi'',''kirim_preparasi_item'')) then raise exception ''Hanya verifier/admin yang boleh mengedit data ini''; end if;');
  execute d;
end $mig$;
