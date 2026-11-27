-- STATUS 27/11: BELUM DITERAPKAN (persetujuan server tidak dijawab) — menunggu konfirmasi user.
-- v59c (27/11/2026): atas permintaan user "tetap titiknya koordinat pakai titik marking":
-- koordinat lubang otomatis HANYA dari marking terbaru (foto patok / drill pad tidak lagi mengubah koordinat).
-- Tanpa DROP: fungsi trigger mengabaikan drill_event.
create or replace function private.koordinat_plot_terbaru(p_bh text, out x numeric, out y numeric, out z numeric, out sumber text, out waktu timestamptz)
language sql stable security definer set search_path to '' as $$
  with rc as (select u.x, u.y from public.rencana_lubang r, lateral private.ll_ke_utm(r.lat, r.lon) u where r.bhid = p_bh and r.lat is not null limit 1),
  mk as (select * from public.marking m where m.bhid = p_bh and m.x_utm between 100000 and 900000 and m.y_utm between 9000000 and 10000000 and coalesce(m.akurasi_m, 0) <= 15),
  cand as (
    select m.captured_at as w, 'MARKING' as s,
      (select avg(k.x_utm) from mk k where k.captured_at between m.captured_at - interval '15 minutes' and m.captured_at + interval '15 minutes') as x,
      (select avg(k.y_utm) from mk k where k.captured_at between m.captured_at - interval '15 minutes' and m.captured_at + interval '15 minutes') as y,
      (select avg(coalesce(k.z_gps, k.z_dem)) from mk k where k.captured_at between m.captured_at - interval '15 minutes' and m.captured_at + interval '15 minutes') as z
    from mk m)
  select round(c.x, 2), round(c.y, 2), round(c.z, 2), c.s, c.w from cand c
  where c.x is not null and (not exists (select 1 from rc) or (select sqrt((c.x - rc.x)^2 + (c.y - rc.y)^2) from rc) <= 300)
  order by c.w desc limit 1
$$;

create or replace function private.plot_terbaru_trg()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_table_name <> 'marking' then return null; end if;   -- foto tidak dipakai untuk koordinat
  begin perform private.terapkan_plot_terbaru(new.bhid);
  exception when others then raise warning 'plot terbaru gagal: %', sqlerrm; end;
  return null;
end $$;

-- kembalikan DH-NPG 08 & 13 ke marking terbaru (sebelumnya diambil dari foto patok)
do $mig$
declare b public.borehole; v record;
begin
  for b in select * from public.borehole where koordinat_sumber like 'FOTO%' for update loop
    select * into v from private.koordinat_plot_terbaru(b.bhid);
    if v.x is null then continue; end if;
    insert into public.koordinat_log(bhid, x_lama, y_lama, z_lama, x_baru, y_baru, z_baru, sumber, alasan, nama, diubah_at)
      values (b.bhid, b.xgps, b.ygps, b.zgps, v.x, v.y, coalesce(v.z, b.zgps), 'MARKING TERBARU', 'Koordinat kembali ke titik marking (foto tidak dipakai untuk koordinat)', 'otomatis', now());
    update public.borehole set xgps = v.x, ygps = v.y, zgps = coalesce(v.z, zgps), koordinat_sumber = 'MARKING TERBARU (otomatis)', date_updated = now() where bhid = b.bhid;
  end loop;
end $mig$;
