-- v80 (28/11/2026): Uji silang → tombol "🔄 Sinkronkan": core DDR mengikuti Form Logging (setelah dikonfirmasi).
-- Kedalaman loss ikut tersinkron: remark run DDR = posisi loss dari Form Logging (lose_from–lose_to) / sisa loss.
-- Hanya geologist/verifier/admin. Selisih (log − DDR) ditambahkan ke run DDR yang LOSS (core < meter) di dalam interval,
-- atau dikurangkan dari run terakhir bila DDR lebih panjang. Swelling: DDR maksimal = panjang interval.
-- Tiap perubahan tercatat di ddr_edit_log (tampil di dokumen DDR "Data coring/run diubah…"); PDF DDR di Drive dibuat ulang (revisi).
-- DIPASANG 28/11/2026 (migrasi v80_sinkron_core_ddr + perbaikan urutan: run yang memuat posisi loss Form Logging didahulukan).
-- Uji (dibatalkan/rollback): 09 3–4 m → run 3,00–3,50 core 0,25→0,50 (OK); 14R 7–8 m → run 7,40–7,65 core 0,25→0,00 'Loss 7.40–7.65 m' (OK).
-- Bila perlu dijalankan ulang di SQL Editor: https://supabase.com/dashboard/project/ytrvezripgkzuwyjvmnb/sql/new
create or replace function public.sinkron_core_ddr(p_bhid text, p_from numeric, p_to numeric, p_alasan text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a public.app_user; s public.sample; target numeric; kini numeric := 0; delta numeric; sisa numeric; r record; tambah numeric; baru numeric; n int := 0; log jsonb := '[]';
begin
  select * into a from public.app_user where user_id = auth.uid();
  if a.user_id is null or a.role not in ('geologist','verifier','admin') then raise exception 'Hanya geologist/verifier/admin yang bisa menyinkronkan'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Tulis alasan / konfirmasi'; end if;
  select * into s from public.sample where bhid = p_bhid and depth_from = p_from and depth_to = p_to limit 1;
  if not found or s.core_length is null then raise exception 'Interval % %–% m tidak ada di Form Logging / core kosong', p_bhid, p_from, p_to; end if;
  target := least(s.core_length, p_to - p_from);
  select coalesce(sum(x.core * (least(x.sampai, p_to) - greatest(x.dari, p_from)) / nullif(x.sampai - x.dari, 0)), 0) into kini
    from (select (e.v->>'from')::numeric dari, (e.v->>'to')::numeric sampai, coalesce(nullif(e.v->>'core','')::numeric, 0) core
      from public.ddr d cross join lateral jsonb_array_elements(coalesce(d.coring, '[]')) e(v)
      where coalesce(nullif(e.v->>'bhid',''), d.bhid) = p_bhid and (e.v->>'from') ~ '^-?\d+(\.\d+)?$' and (e.v->>'to') ~ '^-?\d+(\.\d+)?$'
        and (e.v->>'from')::numeric < p_to and (e.v->>'to')::numeric > p_from) x;
  delta := round(target - kini, 2);
  if abs(delta) <= 0.005 then return jsonb_build_object('ok', true, 'diubah', 0, 'pesan', 'Sudah sama'); end if;
  sisa := delta;
  for r in select d.id ddr_id, d.status, (e.ord - 1)::int idx, (e.v->>'from')::numeric dari, (e.v->>'to')::numeric sampai, coalesce(nullif(e.v->>'core','')::numeric, 0) core
      from public.ddr d cross join lateral jsonb_array_elements(coalesce(d.coring, '[]')) with ordinality e(v, ord)
      where coalesce(nullif(e.v->>'bhid',''), d.bhid) = p_bhid and (e.v->>'from') ~ '^-?\d+(\.\d+)?$' and (e.v->>'to') ~ '^-?\d+(\.\d+)?$'
        and (e.v->>'from')::numeric >= p_from - 0.001 and (e.v->>'to')::numeric <= p_to + 0.001
      order by case when s.lose_from is not null and s.lose_to is not null and (e.v->>'from')::numeric < s.lose_to and (e.v->>'to')::numeric > s.lose_from then (case when delta < 0 then 0 else 1 end) else (case when delta < 0 then 1 else 0 end) end,
        case when delta > 0 then (e.v->>'from')::numeric end asc, case when delta < 0 then (e.v->>'from')::numeric end desc loop
    exit when abs(sisa) <= 0.005;
    if sisa > 0 then tambah := least(sisa, (r.sampai - r.dari) - r.core); else tambah := -least(-sisa, r.core, case when s.lose_from is not null and s.lose_to is not null and r.dari < s.lose_to and r.sampai > s.lose_from then least(r.sampai, s.lose_to) - greatest(r.dari, s.lose_from) else r.core end); end if;
    continue when tambah = 0;
    baru := round(r.core + tambah, 2);
    -- kedalaman loss ikut tersinkron: remark run DDR diisi posisi loss dari Form Logging (lose_from–lose_to) bila ada di run ini
    update public.ddr set coring = jsonb_set(jsonb_set(coring, array[r.idx::text, 'core'], to_jsonb(baru)), array[r.idx::text, 'remark'],
        to_jsonb(case when s.lose_from is not null and s.lose_to is not null and s.lose_from < r.sampai and s.lose_to > r.dari and baru < (r.sampai - r.dari)
          then 'Loss ' || s.lose_from || '–' || s.lose_to || ' m (sinkron Form Logging)'
          when baru >= (r.sampai - r.dari) then 'Recovery penuh (sinkron Form Logging)' else 'Loss ' || round((r.sampai - r.dari) - baru, 2) || ' m (sinkron Form Logging)' end))
      where id = r.ddr_id;
    insert into public.ddr_edit_log(ddr_id, field, old_value, new_value, reason, status_saat_edit, edited_by, editor_name)
      values (r.ddr_id, 'coring', jsonb_build_object('from', r.dari, 'to', r.sampai, 'core', r.core), jsonb_build_object('from', r.dari, 'to', r.sampai, 'core', baru),
        'Sinkron uji silang: core DDR mengikuti Form Logging ' || coalesce(s.sample_no, '') || ' (' || p_from || '–' || p_to || ' m, core log ' || s.core_length || ' m). ' || trim(p_alasan),
        r.status, a.user_id, a.full_name);
    log := log || jsonb_build_object('run', r.dari || '–' || r.sampai, 'lama', r.core, 'baru', baru);
    sisa := round(sisa - tambah, 2); n := n + 1;
  end loop;
  if n = 0 then raise exception 'Tidak ada run DDR yang seluruhnya di dalam interval %–% m; sesuaikan manual lewat Edit DDR', p_from, p_to; end if;
  return jsonb_build_object('ok', true, 'diubah', n, 'run', log, 'sisa', sisa, 'target', target, 'sebelum', round(kini, 2));
end $$;
revoke execute on function public.sinkron_core_ddr(text, numeric, numeric, text) from public, anon;
grant execute on function public.sinkron_core_ddr(text, numeric, numeric, text) to authenticated;
