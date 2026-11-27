-- v59 (27/11/2026): Koordinat titik = PLOT TERBARU, otomatis ke semua sheet.
-- Setiap marking baru (Marking/plot) atau foto lubang bor bergeotag (foto patok / foto drill pad) yang lebih baru dari perubahan koordinat
-- terakhir langsung menjadi koordinat lubang (borehole.xgps/ygps/zgps) → Collar, Database, Peta, BA/BASTP, uji silang, ekspor ikut berubah.
-- Tercatat di koordinat_log. Penyaring: marking akurasi ≤ 15 m (dirata-rata dengan bacaan ±15 menit), foto: GPS kamera akurasi ≤ 15 m
-- atau GPS dari data foto galeri; harus di UTM 51S (lat −11…0, lon 119…127) dan ≤ 300 m dari titik rencana (bila ada rencana).
-- Koordinat yang diubah manual / dari DDR SETELAH waktu plot tidak ditimpa (yang terbaru menang).
create or replace function private.ll_ke_utm(p_lat double precision, p_lon double precision, p_zona int default 51, out x numeric, out y numeric)
language plpgsql immutable set search_path to '' as $$
declare k0 float8 := 0.9996; a float8 := 6378137; f float8 := 1/298.257223563; e2 float8; ep2 float8; phi float8; lam float8; lam0 float8;
  n float8; t float8; c float8; aa float8; m float8; e4 float8; e6 float8;
begin
  if p_lat is null or p_lon is null then return; end if;
  e2 := f*(2-f); ep2 := e2/(1-e2); e4 := e2*e2; e6 := e4*e2;
  phi := radians(p_lat); lam := radians(p_lon); lam0 := radians(p_zona*6-183);
  n := a/sqrt(1-e2*sin(phi)^2); t := tan(phi)^2; c := ep2*cos(phi)^2; aa := cos(phi)*(lam-lam0);
  m := a*((1-e2/4-3*e4/64-5*e6/256)*phi - (3*e2/8+3*e4/32+45*e6/1024)*sin(2*phi) + (15*e4/256+45*e6/1024)*sin(4*phi) - (35*e6/3072)*sin(6*phi));
  x := round((k0*n*(aa+(1-t+c)*aa^3/6+(5-18*t+t*t+72*c-58*ep2)*aa^5/120) + 500000)::numeric, 3);
  y := round((k0*(m+n*tan(phi)*(aa^2/2+(5-t+9*c+4*c*c)*aa^4/24+(61-58*t+t*t+600*c-330*ep2)*aa^6/720)) + case when p_lat < 0 then 10000000 else 0 end)::numeric, 3);
end $$;

create or replace function private.koordinat_plot_terbaru(p_bh text, out x numeric, out y numeric, out z numeric, out sumber text, out waktu timestamptz)
language sql stable security definer set search_path to '' as $$
  with rc as (select u.x, u.y from public.rencana_lubang r, lateral private.ll_ke_utm(r.lat, r.lon) u where r.bhid = p_bh and r.lat is not null limit 1),
  mk as (select * from public.marking m where m.bhid = p_bh and m.x_utm between 100000 and 900000 and m.y_utm between 9000000 and 10000000 and coalesce(m.akurasi_m, 0) <= 15),
  cand as (
    select m.captured_at as w, 'MARKING' as s,
      (select avg(k.x_utm) from mk k where k.captured_at between m.captured_at - interval '15 minutes' and m.captured_at + interval '15 minutes') as x,
      (select avg(k.y_utm) from mk k where k.captured_at between m.captured_at - interval '15 minutes' and m.captured_at + interval '15 minutes') as y,
      (select avg(coalesce(k.z_gps, k.z_dem)) from mk k where k.captured_at between m.captured_at - interval '15 minutes' and m.captured_at + interval '15 minutes') as z
    from mk m
    union all
    select e.captured_at, 'FOTO ' || replace(e.event_type, '_', ' '), u.x, u.y, null::numeric
    from public.drill_event e, lateral private.ll_ke_utm(e.lat, e.lon) u
    where e.bhid = p_bh and e.event_type in ('FOTO_PATOK', 'FOTO_DRILL_PAD', 'FOTO_AKHIR') and e.lat between -11 and 0 and e.lon between 119 and 127
      and (e.gps_accuracy_m <= 15 or (e.gps_accuracy_m is null and e.note ilike '%GPS dari data foto%')))
  select round(c.x, 2), round(c.y, 2), round(c.z, 2), c.s, c.w from cand c
  where c.x is not null and (not exists (select 1 from rc) or (select sqrt((c.x - rc.x)^2 + (c.y - rc.y)^2) from rc) <= 300)
  order by c.w desc limit 1
$$;

create or replace function private.terapkan_plot_terbaru(p_bh text)
returns void language plpgsql security definer set search_path to '' as $$
declare bh text := nullif(trim(p_bh), ''); v record; b public.borehole; terakhir timestamptz;
begin
  if bh is null then return; end if;
  select * into v from private.koordinat_plot_terbaru(bh);
  if v.x is null then return; end if;
  select max(diubah_at) into terakhir from public.koordinat_log where bhid = bh;
  if terakhir is not null and terakhir >= v.waktu then return; end if;   -- ada perubahan koordinat yang lebih baru (manual / DDR / plot lain)
  select * into b from public.borehole where bhid = bh for update;
  if b.bhid is null then return; end if;                                -- lubang belum ada: dibuat oleh rekap_lubang
  if round(b.xgps, 2) is not distinct from v.x and round(b.ygps, 2) is not distinct from v.y then return; end if;
  insert into public.koordinat_log(bhid, x_lama, y_lama, z_lama, x_baru, y_baru, z_baru, sumber, alasan, nama, diubah_at)
    values (bh, b.xgps, b.ygps, b.zgps, v.x, v.y, coalesce(v.z, b.zgps), v.sumber || ' TERBARU',
            format('Plot terbaru %s WIB (otomatis)', to_char(v.waktu at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI')), 'otomatis', now());
  update public.borehole set xgps = v.x, ygps = v.y, zgps = coalesce(v.z, zgps), koordinat_sumber = v.sumber || ' TERBARU (otomatis)', date_updated = now() where bhid = bh;
end $$;

create or replace function private.plot_terbaru_trg()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  begin perform private.terapkan_plot_terbaru(new.bhid);
  exception when others then raise warning 'plot terbaru gagal: %', sqlerrm; end;
  return null;
end $$;

create or replace trigger zzz_plot_terbaru after insert or update of x_utm, y_utm, z_gps, bhid, akurasi_m on public.marking
  for each row execute function private.plot_terbaru_trg();
create or replace trigger zzz_plot_terbaru after insert or update of lat, lon, bhid, event_type on public.drill_event
  for each row when (new.event_type in ('FOTO_PATOK', 'FOTO_DRILL_PAD', 'FOTO_AKHIR')) execute function private.plot_terbaru_trg();

-- v59b: label sumber "FOTO PATOK TERBARU" / "MARKING TERBARU"; backfill: select private.terapkan_plot_terbaru(bhid) from public.borehole;
--   27/11: DH-NPG 08 → foto patok 25/11 (geser 10 m), DH-NPG 09 → marking 26/11 (1,6 m), DH-NPG 13 → foto patok 27/11 (4,7 m).
-- v60: v_dh_collar.depth = total_depth → kedalaman DDR terdalam → eoh dari logging → run foto terdalam (lubang yang masih dibor, mis. DH-NPG 09, ikut terisi).
