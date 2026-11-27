-- v39 (27/11/2026): ✏️ Edit data untuk admin/verifier di semua sheet yang belum punya layar edit
-- (aktivitas bor / foto run, P2H, marking, data lubang, kirim preparasi, rencana titik).
-- Satu RPC generik dengan daftar kolom yang boleh diubah per tabel; alasan wajib; setiap isian yang berubah tercatat di data_edit_log.

create table if not exists public.data_edit_log (
  id bigint generated always as identity primary key,
  tabel text not null,
  ref text not null,
  kolom text not null,
  nilai_lama text,
  nilai_baru text,
  alasan text not null,
  diubah_oleh uuid default auth.uid(),
  nama text,
  diubah_at timestamptz not null default now()
);
create index if not exists data_edit_log_ref on public.data_edit_log (tabel, ref, diubah_at desc);
alter table public.data_edit_log enable row level security;
create policy data_edit_log_baca on public.data_edit_log for select to authenticated
  using (coalesce((select private.my_role()), '') in ('geologist','verifier','admin'));
grant select on public.data_edit_log to authenticated;

create or replace function public.admin_ubah_data(p_tabel text, p_id text, p_data jsonb, p_alasan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  peran text := coalesce((select private.my_role()), '');
  kols text[]; pk text := 'id'; lama jsonb; baru jsonb; k text; n int := 0; v_nama text;
begin
  if peran not in ('verifier','admin') then raise exception 'Hanya verifier/admin yang boleh mengedit data ini'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan perubahan wajib diisi'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Isian kosong'; end if;
  kols := case p_tabel
    when 'drill_event' then array['rig','bhid','event_type','depth_from','depth_to','core_length','reason','note','captured_at','jenis_bor','tujuan_bor','lubang_asal','status_akhir','dip','azimuth','titik_bergeser','geser_ket']
    when 'p2h_check' then array['rig','unit','shift','hour_meter','layak_operasi','n_not_ok','captured_at']
    when 'marking' then array['bhid','rig','lat','lon','x_utm','y_utm','akurasi_m','z_gps','akurasi_z_m','instrument','catatan','captured_at']
    when 'borehole' then array['prospect','area','grid','start_date','stop_date','depth_tp','depth_l','depth_s','total_depth','total_sample','rigmc_id','core_size','core_barrel_type','samptype_id','drilprpose_id','spacing_id','teamleader','operator','logger','field_geos','verification_geos','water_table','comment','status','dip','azimuth']
    when 'kirim_preparasi' then array['no_kirim','tanggal','tujuan','pengirim','penerima','jumlah_karung','no_segel','catatan','status']
    when 'kirim_preparasi_item' then array['urut','sample_no','no_kantong','berat_kg','catatan']
    when 'rencana_lubang' then array['bhid','lat','lon','rencana_kedalaman','rig','catatan','dip','azimuth']
    else null end;
  if kols is null then raise exception 'Tabel % tidak bisa diedit dari menu ini', p_tabel; end if;
  if p_tabel = 'borehole' then pk := 'bhid'; end if;

  execute format('select to_jsonb(t) from public.%I t where t.%I::text = $1 for update', p_tabel, pk) into lama using p_id;
  if lama is null then raise exception 'Data tidak ditemukan'; end if;
  -- normalisasi tipe lewat jsonb_populate_record (angka/tanggal/boolean dari teks)
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', p_tabel) into baru using p_data;
  select full_name into v_nama from public.app_user where user_id = (select auth.uid());

  foreach k in array kols loop
    if not (p_data ? k) then continue; end if;
    if coalesce(lama->k, 'null'::jsonb) is not distinct from coalesce(baru->k, 'null'::jsonb) then continue; end if;
    execute format('update public.%I t set %I = (jsonb_populate_record(null::public.%I, $1)).%I where t.%I::text = $2', p_tabel, k, p_tabel, k, pk)
      using p_data, p_id;
    insert into public.data_edit_log(tabel, ref, kolom, nilai_lama, nilai_baru, alasan, nama)
    values (p_tabel, p_id, k, lama->>k, baru->>k, trim(p_alasan), v_nama);
    n := n + 1;
  end loop;
  if n > 0 and p_tabel = 'borehole' then update public.borehole set date_updated = now() where bhid = p_id; end if;
  return jsonb_build_object('ok', true, 'changed', n);
end $function$;

revoke all on function public.admin_ubah_data(text, text, jsonb, text) from public, anon;
grant execute on function public.admin_ubah_data(text, text, jsonb, text) to authenticated;
