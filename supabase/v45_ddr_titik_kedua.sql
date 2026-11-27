-- v45 (27/11/2026): DDR dengan pindah titik dalam satu shift — "titik ke-2" (ddr.titik_lain) dengan koordinat pelaksanaannya sendiri.
alter table public.ddr add column if not exists titik_lain jsonb;

create or replace function private.terapkan_koordinat_ddr(p_bh text, p_x numeric, p_y numeric, p_z numeric, p_sumber text, p_rig text, p_tgl date, p_alasan text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare b public.borehole; nm text; bh text := nullif(trim(p_bh), '');
begin
  if bh is null or p_x is null or p_y is null then return; end if;
  if p_x < 100000 or p_x > 900000 or p_y < 0 or p_y > 10000000 then
    raise exception 'Koordinat pelaksanaan % tidak wajar (X 6 digit, Y 7 digit, UTM WGS84 51S)', bh; end if;
  select * into b from public.borehole where bhid = bh for update;
  if b.bhid is not null and round(b.xgps, 2) is not distinct from round(p_x, 2) and round(b.ygps, 2) is not distinct from round(p_y, 2)
     and (p_z is null or round(b.zgps, 2) is not distinct from round(p_z, 2)) then return; end if;
  select full_name into nm from public.app_user where user_id = auth.uid();
  insert into public.koordinat_log(bhid, x_lama, y_lama, z_lama, x_baru, y_baru, z_baru, sumber, alasan, nama)
    values (bh, b.xgps, b.ygps, b.zgps, round(p_x, 2), round(p_y, 2), round(coalesce(p_z, b.zgps), 2), coalesce(p_sumber, 'DDR'), p_alasan, nm);
  if b.bhid is not null then
    update public.borehole set xgps = round(p_x, 2), ygps = round(p_y, 2), zgps = round(coalesce(p_z, zgps), 2),
      koordinat_sumber = coalesce(p_sumber, 'DDR'), date_updated = now() where bhid = bh;
  else
    insert into public.borehole(bhid, xgps, ygps, zgps, koordinat_sumber, rigmc_id, start_date, status, created_by, date_added)
      values (bh, round(p_x, 2), round(p_y, 2), round(p_z, 2), coalesce(p_sumber, 'DDR'), p_rig, p_tgl, 'DRAFT', auth.uid(), now());
  end if;
end $function$;

create or replace function private.koordinat_dari_ddr()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare t jsonb; al text;
begin
  if tg_op = 'UPDATE' and new.koord_x is not distinct from old.koord_x and new.koord_y is not distinct from old.koord_y
     and new.koord_z is not distinct from old.koord_z and new.bhid is not distinct from old.bhid and new.titik_lain is not distinct from old.titik_lain then return new; end if;
  al := format('Koordinat pelaksanaan dari DDR %s %s %s', new.report_date, new.rig, new.shift);
  perform private.terapkan_koordinat_ddr(new.bhid, new.koord_x, new.koord_y, new.koord_z, new.koord_sumber, new.rig, new.report_date, al);
  for t in select * from jsonb_array_elements(coalesce(new.titik_lain, '[]'::jsonb)) loop
    perform private.terapkan_koordinat_ddr(private.baku_bhid(t->>'bhid'), nullif(t->>'koord_x', '')::numeric, nullif(t->>'koord_y', '')::numeric,
      nullif(t->>'koord_z', '')::numeric, t->>'koord_sumber', new.rig, new.report_date, al || ' (titik ke-2)');
  end loop;
  return new;
end $function$;

create or replace trigger zw_koordinat_ddr before insert or update of koord_x, koord_y, koord_z, bhid, titik_lain on public.ddr
  for each row execute function private.koordinat_dari_ddr();

do $mig$
declare d text := pg_get_functiondef('private.gabung_ddr_ganda'::regproc);
begin
  if position('koord_sumber = new.koord_sumber' in d) = 0 then raise exception 'pola gabung_ddr_ganda berubah'; end if;
  d := replace(d, 'koord_sumber = new.koord_sumber', 'koord_sumber = new.koord_sumber, titik_lain = new.titik_lain');
  execute d;
end $mig$;
