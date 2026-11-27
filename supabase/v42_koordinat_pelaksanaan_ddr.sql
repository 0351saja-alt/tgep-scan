-- v42 (27/11/2026): Koordinat titik pelaksanaan diisi di DDR → otomatis menjadi koordinat lubang (borehole) & dicatat di koordinat_log.
alter table public.ddr
  add column if not exists koord_x numeric,
  add column if not exists koord_y numeric,
  add column if not exists koord_z numeric,
  add column if not exists koord_sumber text;

create or replace function private.koordinat_dari_ddr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare b public.borehole; nm text; bh text := nullif(trim(new.bhid), ''); al text;
begin
  if bh is null or new.koord_x is null or new.koord_y is null then return new; end if;
  if new.koord_x < 100000 or new.koord_x > 900000 or new.koord_y < 0 or new.koord_y > 10000000 then
    raise exception 'Koordinat pelaksanaan tidak wajar (X 6 digit, Y 7 digit, UTM WGS84 51S)'; end if;
  if tg_op = 'UPDATE' and new.koord_x is not distinct from old.koord_x and new.koord_y is not distinct from old.koord_y
     and new.koord_z is not distinct from old.koord_z and new.bhid is not distinct from old.bhid then return new; end if;
  select * into b from public.borehole where bhid = bh for update;
  if b.bhid is not null and round(b.xgps, 2) is not distinct from round(new.koord_x, 2) and round(b.ygps, 2) is not distinct from round(new.koord_y, 2)
     and (new.koord_z is null or round(b.zgps, 2) is not distinct from round(new.koord_z, 2)) then return new; end if;
  select full_name into nm from public.app_user where user_id = auth.uid();
  al := format('Koordinat pelaksanaan dari DDR %s %s %s', new.report_date, new.rig, new.shift);
  insert into public.koordinat_log(bhid, x_lama, y_lama, z_lama, x_baru, y_baru, z_baru, sumber, alasan, nama)
    values (bh, b.xgps, b.ygps, b.zgps, round(new.koord_x, 2), round(new.koord_y, 2), round(coalesce(new.koord_z, b.zgps), 2), coalesce(new.koord_sumber, 'DDR'), al, nm);
  if b.bhid is not null then
    update public.borehole set xgps = round(new.koord_x, 2), ygps = round(new.koord_y, 2), zgps = round(coalesce(new.koord_z, zgps), 2),
      koordinat_sumber = coalesce(new.koord_sumber, 'DDR'), date_updated = now() where bhid = bh;
  else
    insert into public.borehole(bhid, xgps, ygps, zgps, koordinat_sumber, rigmc_id, start_date, status, created_by, date_added)
      values (bh, round(new.koord_x, 2), round(new.koord_y, 2), round(new.koord_z, 2), coalesce(new.koord_sumber, 'DDR'), new.rig, new.report_date, 'DRAFT', auth.uid(), now());
  end if;
  return new;
end $function$;

-- berjalan sebelum zzz_gabung_ddr_ganda (urutan nama), jadi tetap jalan walau kiriman edit digabung ke DDR lama
create or replace trigger zw_koordinat_ddr before insert or update of koord_x, koord_y, koord_z, bhid on public.ddr
  for each row execute function private.koordinat_dari_ddr();

-- penggabungan DDR ganda (edit DDR) ikut membawa koordinat pelaksanaan
create or replace function private.gabung_ddr_ganda()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare old_row public.ddr; peran text; pakai_baru boolean;
begin
  select * into old_row from public.ddr d
   where d.rig = new.rig and d.report_date = new.report_date and d.shift = new.shift
     and d.client_uuid is distinct from new.client_uuid
   for update;
  if not found then return new; end if;
  if old_row.status is distinct from 'DRAFT' then return new; end if;
  select role into peran from public.app_user where user_id = auth.uid();
  if not (old_row.created_by = coalesce(auth.uid(), new.created_by) or old_row.created_by = new.created_by
          or peran in ('geologist','verifier','admin')) then
    return new;
  end if;
  pakai_baru := coalesce(new.captured_at, new.created_at, now()) >= coalesce(old_row.captured_at, old_row.created_at, '-infinity');
  insert into private.ddr_versi(ddr_id, data_lama, data_kiriman, dipakai)
    values (old_row.id, to_jsonb(old_row), to_jsonb(new), case when pakai_baru then 'KIRIMAN' else 'LAMA' end);
  if pakai_baru then
    update public.ddr set
      client_uuid = new.client_uuid, bhid = new.bhid, jenis_bor = coalesce(new.jenis_bor, old_row.jenis_bor), redrill = new.redrill, lubang_asal = new.lubang_asal, contractor = new.contractor, driller_name = new.driller_name,
      helpers = new.helpers, crew_count = new.crew_count, hm_start = new.hm_start, hm_end = new.hm_end,
      weather = new.weather, notes = new.notes, consumables = new.consumables, summary = new.summary,
      captured_at = new.captured_at, open_hole = new.open_hole, coring = new.coring, hours = new.hours,
      hole_type = coalesce(new.hole_type, old_row.hole_type), rod_m = new.rod_m, target_m = new.target_m,
      total_depth_m = new.total_depth_m, rig_type = new.rig_type, location = new.location,
      project = coalesce(new.project, old_row.project), crew = new.crew,
      foto_crew_datang = coalesce(new.foto_crew_datang, old_row.foto_crew_datang),
      foto_crew_datang_at = coalesce(new.foto_crew_datang_at, old_row.foto_crew_datang_at),
      foto_crew_pulang = coalesce(new.foto_crew_pulang, old_row.foto_crew_pulang),
      foto_crew_pulang_at = coalesce(new.foto_crew_pulang_at, old_row.foto_crew_pulang_at),
      crew_lat = coalesce(new.crew_lat, old_row.crew_lat), crew_lon = coalesce(new.crew_lon, old_row.crew_lon),
      koord_x = new.koord_x, koord_y = new.koord_y, koord_z = new.koord_z, koord_sumber = new.koord_sumber
    where id = old_row.id;
  else
    update public.ddr set client_uuid = new.client_uuid where id = old_row.id;
  end if;
  return null;
end $function$;
