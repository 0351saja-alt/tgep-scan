-- v56 (27/11/2026): Recovery per lubang di Dashboard juga dari DDR. Sebelumnya v_dash_hole hanya menghitung recovery dari Form Logging
-- (conto), sehingga hanya DH-NPG 12 yang punya angka; lubang lain (08, 08R, 09, 13, 14, 14R) kosong walau coring & core length sudah di DDR.
--  • recovery_pct = dari logging bila ada, selain itu dari DDR (core / interval coring).
--  • eoh = total_depth lubang → kedalaman conto terdalam → kedalaman DDR terdalam.
--  • kolom baru: recovery_ddr_pct, meter_ddr (meter dari DDR per lubang).
do $mig$
declare d text := pg_get_viewdef('public.v_dash_hole'::regclass);
  rlog text := 'round((((100)::numeric * sum(LEAST(q.core_length, q.run))) / NULLIF(sum(q.run), (0)::numeric)), 1) AS recovery_pct';
  rddr text := '(SELECT round(100::numeric * sum(LEAST(x.core_m, x.meter)) / NULLIF(sum(x.meter), 0::numeric), 1) FROM public.v_ddr_baris x WHERE x.bhid = b.bhid AND x.jenis = ''CORING'' AND x.core_m IS NOT NULL AND x.meter > 0)';
begin
  if position(rlog in d) = 0 or position('COALESCE(b.total_depth, max(q.depth_to)) AS eoh' in d) = 0 or position('AS conto_foto_lengkap' in d) = 0 then raise exception 'pola v_dash_hole berubah'; end if;
  d := replace(d, rlog, 'COALESCE(' || replace(rlog, ' AS recovery_pct', '') || ', ' || rddr || ') AS recovery_pct');
  d := replace(d, 'COALESCE(b.total_depth, max(q.depth_to)) AS eoh', 'COALESCE(b.total_depth, max(q.depth_to), (SELECT max(x.sampai_m) FROM public.v_ddr_baris x WHERE x.bhid = b.bhid)) AS eoh');
  d := replace(d, 'AS conto_foto_lengkap', 'AS conto_foto_lengkap, ' || rddr || ' AS recovery_ddr_pct, (SELECT sum(x.meter) FROM public.v_ddr_baris x WHERE x.bhid = b.bhid) AS meter_ddr');
  d := rtrim(d, '; ');
  execute 'create or replace view public.v_dash_hole with (security_invoker = true) as ' || d;
end $mig$;
