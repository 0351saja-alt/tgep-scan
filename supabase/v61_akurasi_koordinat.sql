-- v61 (27/11/2026): akurasi koordinat ikut tercatat & tampil.
--  • borehole.koordinat_akurasi_m = akurasi GPS terbaik dari sesi marking yang dipakai (kosong bila koordinat diisi manual / DDR / survey).
--  • terapkan_plot_terbaru mengisi akurasi; v_dh_collar menambah kolom coord_akurasi_m.
alter table public.borehole add column if not exists koordinat_akurasi_m numeric;

create or replace function private.terapkan_plot_terbaru(p_bh text)
returns void language plpgsql security definer set search_path to '' as $$
declare bh text := nullif(trim(p_bh), ''); v record; b public.borehole; terakhir timestamptz; acc numeric;
begin
  if bh is null then return; end if;
  select * into v from private.koordinat_plot_terbaru(bh);
  if v.x is null then return; end if;
  select max(diubah_at) into terakhir from public.koordinat_log where bhid = bh;
  if terakhir is not null and terakhir >= v.waktu then return; end if;
  select * into b from public.borehole where bhid = bh for update;
  if b.bhid is null then return; end if;
  if round(b.xgps, 2) is not distinct from v.x and round(b.ygps, 2) is not distinct from v.y then return; end if;
  select min(akurasi_m) into acc from public.marking where bhid = bh and captured_at between v.waktu - interval '15 minutes' and v.waktu + interval '15 minutes'
    and x_utm between 100000 and 900000 and coalesce(akurasi_m, 0) <= 15;
  insert into public.koordinat_log(bhid, x_lama, y_lama, z_lama, x_baru, y_baru, z_baru, sumber, alasan, nama, diubah_at)
    values (bh, b.xgps, b.ygps, b.zgps, v.x, v.y, coalesce(v.z, b.zgps), v.sumber || ' TERBARU',
            format('Plot terbaru %s WIB (otomatis)%s', to_char(v.waktu at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI'), case when acc is not null then ' · akurasi ±' || acc || ' m' else '' end), 'otomatis', now());
  update public.borehole set xgps = v.x, ygps = v.y, zgps = coalesce(v.z, zgps), koordinat_sumber = v.sumber || ' TERBARU (otomatis)', koordinat_akurasi_m = acc, date_updated = now() where bhid = bh;
end $$;

-- isian koordinat manual / DDR: akurasi tidak diketahui → kosongkan (trigger kecil, tanpa mengubah fungsi lama)
create or replace function private.reset_akurasi_koordinat()
returns trigger language plpgsql set search_path to '' as $$
begin
  if (new.xgps is distinct from old.xgps or new.ygps is distinct from old.ygps) and new.koordinat_akurasi_m is not distinct from old.koordinat_akurasi_m
     and coalesce(new.koordinat_sumber, '') not ilike 'MARKING%' then new.koordinat_akurasi_m := null; end if;
  return new;
end $$;
create or replace trigger reset_akurasi_koordinat before update of xgps, ygps on public.borehole for each row execute function private.reset_akurasi_koordinat();

-- isi awal: akurasi terbaik marking yang berada ≤ 3 m dari koordinat lubang sekarang
update public.borehole b set koordinat_akurasi_m = (select min(m.akurasi_m) from public.marking m where m.bhid = b.bhid and m.x_utm between 100000 and 900000
  and sqrt((m.x_utm - b.xgps)^2 + (m.y_utm - b.ygps)^2) <= 3)
where b.xgps is not null;

do $mig$
declare d text := pg_get_viewdef('public.v_dh_collar'::regclass);
begin
  if position('END AS coord_source,' in d) = 0 then raise exception 'pola v_dh_collar berubah'; end if;
  d := rtrim(d, '; ') ;
  -- kolom baru di akhir: tambah sebelum FROM terakhir
  d := regexp_replace(d, '\s+FROM \(\(borehole b', ', b.koordinat_akurasi_m AS coord_akurasi_m FROM ((borehole b');
  execute 'create or replace view public.v_dh_collar with (security_invoker = true) as ' || d;
end $mig$;
