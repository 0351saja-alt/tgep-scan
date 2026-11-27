-- v58 (27/11/2026): UJI SILANG otomatis DDR ↔ Drill log (Form Logging / tabel sample).
--  • v_uji_silang_interval: tiap interval logging dibandingkan dengan coring DDR yang menutupi kedalaman itu
--    (core DDR dibagi proporsional bila run DDR tidak sama dengan interval logging).
--  • v_uji_silang_lubang: ringkasan per lubang — kedalaman, meter, core, recovery DDR vs logging, meter DDR yang belum di-log.
--  Kolom chk_uji = 'OK' bila cocok; selain itu keterangan masalahnya (tampil merah di Database, bisa disaring "hanya yang bermasalah").
create or replace view public.v_uji_silang_interval with (security_invoker = true) as
with dd as (
  select bhid, dari_m, sampai_m, meter, core_m from public.v_ddr_baris where jenis = 'CORING' and meter > 0
), s as (
  select q.sample_no, q.bhid, q.seq, q.depth_from, q.depth_to, round(q.depth_to - q.depth_from, 2) as interval_m, q.core_length as core_log_m, q.geozone_id, q.status,
    (select round(sum(greatest(0, least(d.sampai_m, q.depth_to) - greatest(d.dari_m, q.depth_from))), 2) from dd d where d.bhid = q.bhid) as tercakup_ddr_m,
    (select round(sum(d.core_m * greatest(0, least(d.sampai_m, q.depth_to) - greatest(d.dari_m, q.depth_from)) / d.meter), 2) from dd d where d.bhid = q.bhid and d.core_m is not null) as core_ddr_m
  from public.sample q where q.depth_from is not null and q.depth_to is not null
)
select bhid, seq, sample_no, depth_from, depth_to, interval_m, geozone_id, core_log_m, core_ddr_m,
  round(core_log_m - core_ddr_m, 2) as selisih_core_m,
  round(100 * core_ddr_m / nullif(interval_m, 0), 1) as recovery_ddr_pct,
  round(100 * least(core_log_m, interval_m) / nullif(interval_m, 0), 1) as recovery_log_pct,
  coalesce(tercakup_ddr_m, 0) as tercakup_ddr_m, status as status_sample,
  case when coalesce(tercakup_ddr_m, 0) < 0.9 * interval_m then 'TIDAK ADA DI DDR (' || coalesce(tercakup_ddr_m, 0) || ' dari ' || interval_m || ' m)'
       when core_log_m is null and core_ddr_m is not null then 'CORE LOGGING KOSONG — DDR ' || core_ddr_m || ' m'
       when core_ddr_m is null then 'CORE DDR KOSONG'
       when abs(core_log_m - core_ddr_m) > 0.05 then 'CORE BEDA ' || round(core_log_m - core_ddr_m, 2) || ' m'
       else 'OK' end as chk_uji
from s;

create or replace view public.v_uji_silang_lubang with (security_invoker = true) as
with dd as (
  select bhid, dari_m, sampai_m, meter, core_m, jenis from public.v_ddr_baris where meter > 0 and bhid is not null
), l as (
  select bhid, count(*) as n_conto, min(depth_from) as log_dari_m, max(depth_to) as log_sampai_m, round(sum(depth_to - depth_from), 2) as log_meter,
    round(sum(core_length), 2) as log_core_m, count(*) filter (where core_length is null) as n_core_kosong
  from public.sample where depth_from is not null and depth_to is not null group by bhid
), d as (
  select bhid, min(dari_m) as ddr_dari_m, max(sampai_m) as ddr_sampai_m, round(sum(meter), 2) as ddr_meter,
    round(sum(core_m) filter (where jenis = 'CORING'), 2) as ddr_core_m,
    round(100 * sum(least(core_m, meter)) filter (where jenis = 'CORING' and core_m is not null) / nullif(sum(meter) filter (where jenis = 'CORING' and core_m is not null), 0), 1) as ddr_recovery_pct,
    round(sum(meter - coalesce((select sum(greatest(0, least(x.sampai_m, s.depth_to) - greatest(x.dari_m, s.depth_from))) from public.sample s where s.bhid = x.bhid), 0)), 2) as ddr_belum_dilog_m
  from dd x group by bhid
)
select coalesce(d.bhid, l.bhid) as bhid,
  d.ddr_dari_m, d.ddr_sampai_m, d.ddr_meter, d.ddr_core_m, d.ddr_recovery_pct,
  coalesce(l.n_conto, 0) as n_conto, l.log_dari_m, l.log_sampai_m, l.log_meter, l.log_core_m, coalesce(l.n_core_kosong, 0) as n_core_logging_kosong,
  round(d.ddr_sampai_m - l.log_sampai_m, 2) as selisih_kedalaman_m,
  round(l.log_core_m - d.ddr_core_m, 2) as selisih_core_m,
  greatest(coalesce(d.ddr_belum_dilog_m, 0), 0) as ddr_belum_dilog_m,
  (select count(*) from public.v_uji_silang_interval i where i.bhid = coalesce(d.bhid, l.bhid) and i.chk_uji <> 'OK') as n_interval_bermasalah,
  coalesce(case when d.bhid is null then 'ADA LOGGING TAPI TIDAK ADA DI DDR'
       when l.bhid is null then 'BELUM ADA DRILL LOG (Form Logging)'
       else nullif(concat_ws(' | ',
         case when abs(d.ddr_sampai_m - l.log_sampai_m) > 0.05 then 'KEDALAMAN AKHIR BEDA (DDR ' || d.ddr_sampai_m || ' / log ' || l.log_sampai_m || ' m)' end,
         case when d.ddr_belum_dilog_m > 0.05 then d.ddr_belum_dilog_m || ' m DDR BELUM DI-LOG' end,
         case when l.n_core_kosong > 0 then l.n_core_kosong || ' INTERVAL CORE LOGGING KOSONG' end,
         case when l.n_core_kosong = 0 and abs(l.log_core_m - d.ddr_core_m) > 0.1 then 'TOTAL CORE BEDA ' || round(l.log_core_m - d.ddr_core_m, 2) || ' m' end), '')
  end, 'OK') as chk_uji
from d full join l on l.bhid = d.bhid;
