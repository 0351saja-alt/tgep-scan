-- v41 (27/11/2026): "Database FIX / gabungan" memuat SEMUA data logging & DDR (bukan hanya VERIFIED/SIGNED)
-- Temuan: fix_geology/fix_collar kosong karena status sample tidak pernah menjadi VERIFIED (approve_scan menyimpan DRAFT),
-- dan fix_ddr hanya DDR SIGNED tanpa rekap meter/jam/BBM. Kolom status ditambahkan di akhir agar draf tetap bisa dibedakan.

create or replace view public.fix_geology with (security_invoker = true) as
select g.holeid, g."from" as depth_from, g."to" as depth_to, g.sample_no, g.sample_id, g.zone, g.lith1, g.lith1_pct, g.lith2, g.lith2_pct,
  g.colour, g.hardness, g.weathering, g.serpentinisation, g.silica_pct, g.garnierite_pct, g.min1, g.min1_pct, g.min2, g.min2_pct,
  g.core_length, g.recovery_pct, g.loss_from, g.loss_to, g.sample_wt_kg, g.comment,
  case when s.status in ('VERIFIED','SYNCED') then s.status
       when j.status = 'APPROVED' then 'DISETUJUI'
       else 'BELUM DIPERIKSA' end as status_data,
  coalesce(j.reviewed_at, s.date_updated)::date as tgl_verifikasi
from public.v_dh_geology g
join public.sample s on s.sample_no = g.sample_no
left join public.scan_job j on j.id = s.source_scan;

create or replace view public.fix_density with (security_invoker = true) as
select d.holeid, d."from" as depth_from, d."to" as depth_to, d.sample_no, d.zone, d.len_cm, d.diam_cm, d.wet_wt_g, d.dry_wt_g,
  d.vol_caliper_ml, d.vol_arch_ml, d.wet_density, d.dry_density, d.wet_density_arch, d.dry_density_arch, d.moisture_pct, d.arch_diff_pct
from public.v_dh_density d join public.sample s on s.sample_no = d.sample_no;

create or replace view public.fix_assay with (security_invoker = true) as
select a.holeid, a."from" as depth_from, a."to" as depth_to, a.sample_no, a.lab_sample_id, a.ni, a.co, a.fe, a.mgo, a.sio2, a.al2o3,
  a.cr2o3, a.cao, a.mno, a.loi, a.lab_job_no, a.method, a.date_reported
from public.v_dh_assay a join public.sample s on s.sample_no = a.sample_no
where a.ni is not null;

create or replace view public.fix_collar with (security_invoker = true) as
select c.holeid, c.east, c.north, c.rl, c.depth, c.coord_source, c.area, c.prospect, c.grid, c.start_date, c.stop_date, c.core_size,
  c.sample_type, c.purpose, c.spacing, c.depth_tp, c.depth_l, c.depth_s,
  (select count(*) from public.sample s where s.bhid = c.holeid and s.status in ('VERIFIED','SYNCED')) as n_sample_final,
  (select count(*) from public.sample s where s.bhid = c.holeid and s.status not in ('VERIFIED','SYNCED')) as n_sample_belum,
  case when c.stop_date is not null and exists (select 1 from public.sample s where s.bhid = c.holeid) then 'LENGKAP' else 'PARSIAL' end as status_lubang,
  (select count(*) from public.sample s where s.bhid = c.holeid) as n_sample
from public.v_dh_collar c;

create or replace view public.fix_ddr with (security_invoker = true) as
select d.id as ddr_id, d.report_date, d.shift, d.rig, d.bhid as holeid, d.project, d.location, d.contractor as client, d.driller_name, d.helpers,
  d.crew_count, coalesce((select string_agg(e.value ->> 'nama', ', ') from jsonb_array_elements(d.crew) e(value)), '') as crew_nama,
  d.hm_start, d.hm_end, d.weather, d.hole_type, d.rod_m, d.target_m, d.total_depth_m, d.rig_type, d.notes,
  d.status as ddr_status, l.coring_ddr_m, l.open_hole_m, round(coalesce(l.coring_ddr_m, 0) + coalesce(l.open_hole_m, 0), 2) as meter_ddr,
  l.core_ddr_m, l.recovery_pct, l.jam_ddr_menit, round(l.jam_ddr_menit / 60.0, 2) as jam_ddr, l.standby_menit,
  l.bbm_liter, l.oli_liter,
  round(l.bbm_liter / nullif(coalesce(l.coring_ddr_m, 0) + coalesce(l.open_hole_m, 0), 0), 2) as bbm_per_meter_ddr, l.ttd
from public.ddr d join public.v_ddr_list l on l.id = d.id;

create or replace view public.fix_ddr_jam with (security_invoker = true) as
select h.ddr_id, h.tanggal, h.rig, h.shift, h.bhid as holeid, h.kategori, h.kelompok, h.mulai, h.selesai, h.menit, h.keterangan, h.ddr_status
from public.v_ddr_hours h;

create or replace view public.fix_ddr_barang with (security_invoker = true) as
select u.report_date, u.rig, u.shift, u.bhid as holeid, u.kategori, u.item, u.unit, u.qty, u.note, u.ddr_status
from public.v_consumable_use u;

-- Edit Form Logging yang SUDAH disetujui langsung dari Foto formulir (verifier/admin): isian baru langsung ditulis ke database conto
-- lewat approve_scan (setiap isian yang berubah tercatat di Riwayat koreksi). Alasan wajib.
create or replace function public.ubah_logging_disetujui(p_job uuid, p_data jsonb, p_alasan text)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare j public.scan_job; res jsonb;
begin
  if coalesce((select private.my_role()), '') not in ('verifier','admin') then raise exception 'Hanya verifier/admin yang boleh mengubah Form Logging yang sudah disetujui'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan perubahan wajib diisi'; end if;
  select * into j from public.scan_job where id = p_job for update;
  if not found then raise exception 'Form Logging tidak ditemukan'; end if;
  if j.status <> 'APPROVED' then raise exception 'Form Logging ini belum disetujui — simpan lewat Terima & simpan'; end if;
  update public.scan_job set status = 'NEEDS_REVIEW' where id = p_job;
  res := public.approve_scan(p_job, p_data, 'Diubah setelah disetujui: ' || trim(p_alasan));
  return res;
end $function$;
revoke all on function public.ubah_logging_disetujui(uuid, jsonb, text) from public, anon;
grant execute on function public.ubah_logging_disetujui(uuid, jsonb, text) to authenticated;
