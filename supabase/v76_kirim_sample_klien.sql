-- v76 (28/11/2026): menu client "Pengiriman sample" — client (Site Representative / penerima) melihat form pengiriman
-- proyeknya dan menandatangani tanda terima (status → DITERIMA). Tidak menghapus data apa pun;
-- "drop policy if exists" hanya agar skrip aman dijalankan ulang.
alter table public.kirim_preparasi add column if not exists penerima_ttd_path text, add column if not exists penerima_ttd_at timestamptz,
  add column if not exists penerima_ttd_oleh uuid, add column if not exists penerima_ttd_nama text, add column if not exists diterima_catatan text;

create or replace function private.client_boleh_kirim(p_project text)
returns boolean language sql stable security definer set search_path to '' as $$
  select (select private.my_role()) = 'client' and exists (
    select 1 from public.penugasan pn where pn.user_id = (select auth.uid()) and (pn.project is null or p_project is null or pn.project = p_project))
$$;

drop policy if exists "client baca kirim" on public.kirim_preparasi;
create policy "client baca kirim" on public.kirim_preparasi for select to authenticated using ((select private.client_boleh_kirim(project)));
drop policy if exists "client baca item kirim" on public.kirim_preparasi_item;
create policy "client baca item kirim" on public.kirim_preparasi_item for select to authenticated
  using (exists (select 1 from public.kirim_preparasi k where k.id = kirim_id and (select private.client_boleh_kirim(k.project))));

create or replace function public.kirim_sample_isi(p_kirim uuid)
returns table(urut int, bhid text, sample_no text, sample_id text, depth_from numeric, depth_to numeric, geozone_id text, core_length numeric, no_kantong text, berat_kg numeric, catatan text)
language plpgsql stable security definer set search_path to '' as $$
declare k public.kirim_preparasi;
begin
  select * into k from public.kirim_preparasi where id = p_kirim;
  if not found then return; end if;
  if not ((select private.is_staff()) or (select private.client_boleh_kirim(k.project))) then raise exception 'Tidak berhak'; end if;
  return query select i.urut::int, s.bhid, i.sample_no, (s.seq::text || coalesce(s.geozone_id, '')), s.depth_from::numeric, s.depth_to::numeric, s.geozone_id, s.core_length::numeric, i.no_kantong, i.berat_kg::numeric, i.catatan
    from public.kirim_preparasi_item i left join public.sample s on s.sample_no = i.sample_no where i.kirim_id = p_kirim order by i.urut;
end $$;
revoke execute on function public.kirim_sample_isi(uuid) from public, anon; grant execute on function public.kirim_sample_isi(uuid) to authenticated;

create or replace function public.ttd_terima_sample(p_kirim uuid, p_path text, p_catatan text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare k public.kirim_preparasi; u public.app_user;
begin
  select * into u from public.app_user where user_id = auth.uid();
  if u.user_id is null or u.role not in ('client','admin') then raise exception 'Hanya penerima (akun client) yang bisa menandatangani'; end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'File TTD tidak sah'; end if;
  select * into k from public.kirim_preparasi where id = p_kirim for update; if not found then raise exception 'Form tidak ditemukan'; end if;
  if u.role = 'client' and not (select private.client_boleh_kirim(k.project)) then raise exception 'Tidak berhak'; end if;
  if k.penerima_ttd_at is not null then raise exception 'Form ini sudah ditandatangani penerima'; end if;
  update public.kirim_preparasi set penerima_ttd_path = p_path, penerima_ttd_at = now(), penerima_ttd_oleh = u.user_id, penerima_ttd_nama = initcap(u.full_name),
    penerima = coalesce(nullif(penerima, ''), initcap(u.full_name)), diterima_catatan = nullif(trim(p_catatan), ''), status = 'DITERIMA' where id = p_kirim;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.ttd_terima_sample(uuid, text, text) from public, anon; grant execute on function public.ttd_terima_sample(uuid, text, text) to authenticated;
revoke execute on function private.client_boleh_kirim(text) from public, anon;
