-- v57 (27/11/2026): Database → DDR: kolom meter_bor, jumlah_run, recovery_pct, standby_menit, bbm_per_meter dihitung dari ISI DDR
-- (coring/open hole, distribusi jam). Sebelumnya diambil dari ringkasan foto progres saat DDR dibuat (summary) → banyak yang 0/kosong.
-- Nilai dari foto tetap ada di kolom baru meter_foto_m (dan selisih_ddr_vs_foto_m). hm_jam tetap = HM akhir − HM awal (kosong bila HM tidak diisi).
do $mig$
declare d text := pg_get_viewdef('public.v_ddr_list'::regclass);
  m text := '(SELECT round(COALESCE(sum(((x.value ->> ''to'')::numeric - (x.value ->> ''from'')::numeric)), 0::numeric), 2) FROM jsonb_array_elements(COALESCE(d.coring, ''[]''::jsonb) || COALESCE(d.open_hole, ''[]''::jsonb)) x(value))';
  n text := '(SELECT count(*)::integer FROM jsonb_array_elements(COALESCE(d.coring, ''[]''::jsonb) || COALESCE(d.open_hole, ''[]''::jsonb)) x(value))';
  r text := '(SELECT round(100::numeric * sum(LEAST((x.value ->> ''core'')::numeric, (x.value ->> ''to'')::numeric - (x.value ->> ''from'')::numeric)) / NULLIF(sum((x.value ->> ''to'')::numeric - (x.value ->> ''from'')::numeric), 0::numeric), 1) FROM jsonb_array_elements(COALESCE(d.coring, ''[]''::jsonb)) x(value) WHERE NULLIF(x.value ->> ''core'', '''') IS NOT NULL)';
  s text := '(SELECT sum(h.menit)::numeric FROM public.v_ddr_hours h WHERE h.ddr_id = d.id AND h.kelompok = ''ACTIVE/STANDBY'')';
  P text[] := array['((summary ->> ''meter_bor''::text))::numeric AS meter_bor', '((summary ->> ''jumlah_run''::text))::integer AS jumlah_run',
    '((summary ->> ''recovery_pct''::text))::numeric AS recovery_pct', '((summary ->> ''standby_menit''::text))::numeric AS standby_menit',
    '/ NULLIF(((summary ->> ''meter_bor''::text))::numeric, (0)::numeric)), 2) AS bbm_per_meter', 'AS jam_ddr_menit'];
  x text;
begin
  foreach x in array P loop if position(x in d) = 0 then raise exception 'pola v_ddr_list berubah: %', x; end if; end loop;
  d := replace(d, P[1], 'COALESCE(NULLIF(' || m || ', 0::numeric), ((summary ->> ''meter_bor''::text))::numeric) AS meter_bor');
  d := replace(d, P[2], 'COALESCE(NULLIF(' || n || ', 0), ((summary ->> ''jumlah_run''::text))::integer) AS jumlah_run');
  d := replace(d, P[3], 'COALESCE(' || r || ', ((summary ->> ''recovery_pct''::text))::numeric) AS recovery_pct');
  d := replace(d, P[4], 'COALESCE(' || s || ', ((summary ->> ''standby_menit''::text))::numeric) AS standby_menit');
  d := replace(d, P[5], '/ NULLIF(COALESCE(NULLIF(' || m || ', 0::numeric), ((summary ->> ''meter_bor''::text))::numeric), (0)::numeric)), 2) AS bbm_per_meter');
  d := replace(d, P[6], 'AS jam_ddr_menit, ((summary ->> ''meter_bor''::text))::numeric AS meter_foto_m');
  d := rtrim(d, '; ');
  execute 'create or replace view public.v_ddr_list with (security_invoker = true) as ' || d;
end $mig$;
