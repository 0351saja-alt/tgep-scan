-- v43 (27/11/2026): rekap_lubang tidak lagi memakai pembacaan marking dengan koordinat tidak wajar (di luar zona UTM 51S,
-- mis. marking uji dari Jakarta → DH-NPG 08R / 14 terplot di Jawa). Diterapkan via apply_migration dengan mengganti pola di definisi fungsi.
do $mig$
declare d text := pg_get_functiondef('private.rekap_lubang'::regproc); n int;
begin
  n := (length(d) - length(replace(d, 'from public.marking where bhid = bh and x_utm is not null', ''))) / length('from public.marking where bhid = bh and x_utm is not null');
  if n <> 2 then raise exception 'pola marking di rekap_lubang tidak ditemukan 2x (ditemukan %)', n; end if;
  d := replace(d, 'from public.marking where bhid = bh and x_utm is not null', 'from public.marking where bhid = bh and x_utm between 100000 and 900000 and y_utm between 1 and 10000000');
  execute d;
end $mig$;
