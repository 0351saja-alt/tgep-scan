-- v83 (28/11/2026): dokumen yang sudah ditandatangani CLIENT/PENERIMA = FINAL & TERKUNCI (tidak bisa diubah/dihapus siapa pun),
-- kecuali admin membuka kunci lewat public.buka_kunci_dokumen(jenis, id, alasan) — TTD client/penerima dilepas, tercatat di log.
--   DDR: terkunci bila ada ddr_signature slot CLIENT (termasuk sinkron uji silang).  BA: terkunci bila status FINAL.
--   Form pengiriman sample: terkunci bila penerima_ttd_at terisi (isi sample juga).
-- Bypass internal: set_config('tgep.buka_kunci','1', true) (dipakai buka_kunci_dokumen dan ttd_client_pin).
-- BELUM TERPASANG saat ditulis — persetujuan Supabase tidak terjawab. Jalankan di SQL Editor:
-- https://supabase.com/dashboard/project/ytrvezripgkzuwyjvmnb/sql/new
create or replace function private.kunci_aktif() returns boolean language sql stable set search_path to '' as $$
  select coalesce(current_setting('tgep.buka_kunci', true), '') <> '1' $$;
create or replace function private.trg_kunci_ddr() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (select private.kunci_aktif()) and exists (select 1 from public.ddr_signature s where s.ddr_id = old.id and s.slot = 'CLIENT') then
    if tg_op = 'DELETE' then raise exception 'DDR sudah ditandatangani client (FINAL) — tidak bisa dihapus. Minta admin membuka kunci.'; end if;
    if (to_jsonb(new) - array['updated_at','date_updated','synced_at']) is distinct from (to_jsonb(old) - array['updated_at','date_updated','synced_at']) then
      raise exception 'DDR sudah ditandatangani client (FINAL) — tidak bisa diubah. Minta admin membuka kunci.'; end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create or replace function private.trg_kunci_ddr_ttd() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (select private.kunci_aktif()) and exists (select 1 from public.ddr_signature s where s.ddr_id = old.ddr_id and s.slot = 'CLIENT') then
    raise exception 'DDR sudah ditandatangani client (FINAL) — tanda tangan tidak bisa dihapus. Minta admin membuka kunci.'; end if;
  return old;
end $$;
create or replace function private.trg_kunci_ba() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (select private.kunci_aktif()) and old.status = 'FINAL' then
    raise exception 'Berita acara sudah FINAL (ditandatangani) — tidak bisa diubah/dihapus. Minta admin membuka kunci.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create or replace function private.trg_kunci_ba_ttd() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (select private.kunci_aktif()) and exists (select 1 from public.berita_acara b where b.id = old.ba_id and b.status = 'FINAL') then
    raise exception 'Berita acara sudah FINAL — tanda tangan tidak bisa dihapus. Minta admin membuka kunci.'; end if;
  return old;
end $$;
create or replace function private.trg_kunci_kirim() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if (select private.kunci_aktif()) and old.penerima_ttd_at is not null then
    raise exception 'Form pengiriman sudah ditandatangani penerima (FINAL) — tidak bisa diubah/dihapus. Minta admin membuka kunci.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create or replace function private.trg_kunci_kirim_item() returns trigger language plpgsql security definer set search_path to '' as $$
declare kid uuid := case when tg_op = 'INSERT' then new.kirim_id else old.kirim_id end;
begin
  if (select private.kunci_aktif()) and exists (select 1 from public.kirim_preparasi k where k.id = kid and k.penerima_ttd_at is not null) then
    raise exception 'Form pengiriman sudah ditandatangani penerima (FINAL) — isi sample tidak bisa diubah.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger zzz_kunci_final before update or delete on public.ddr for each row execute function private.trg_kunci_ddr();
create trigger zzz_kunci_final before delete on public.ddr_signature for each row execute function private.trg_kunci_ddr_ttd();
create trigger zzz_kunci_final before update or delete on public.berita_acara for each row execute function private.trg_kunci_ba();
create trigger zzz_kunci_final before delete on public.ba_signature for each row execute function private.trg_kunci_ba_ttd();
create trigger zzz_kunci_final before update or delete on public.kirim_preparasi for each row execute function private.trg_kunci_kirim();
create trigger zzz_kunci_final before insert or update or delete on public.kirim_preparasi_item for each row execute function private.trg_kunci_kirim_item();

create or replace function public.buka_kunci_dokumen(p_jenis text, p_id uuid, p_alasan text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a public.app_user;
begin
  select * into a from public.app_user where user_id = auth.uid();
  if a.role is distinct from 'admin' then raise exception 'Hanya admin yang bisa membuka kunci dokumen FINAL'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Tulis alasan membuka kunci'; end if;
  perform set_config('tgep.buka_kunci', '1', true);
  if p_jenis = 'DDR' then
    insert into public.ddr_edit_log(ddr_id, field, old_value, new_value, reason, status_saat_edit, edited_by, editor_name)
      select p_id, 'ttd_client', to_jsonb(s), null, 'Buka kunci FINAL: ' || trim(p_alasan), 'SIGNED', a.user_id, a.full_name from public.ddr_signature s where s.ddr_id = p_id and s.slot = 'CLIENT';
    delete from public.ddr_signature where ddr_id = p_id and slot = 'CLIENT';
  elsif p_jenis = 'BA' then
    insert into public.data_edit_log(tabel, ref, kolom, nilai_lama, nilai_baru, alasan, diubah_oleh, nama)
      values ('berita_acara', p_id::text, 'status', 'FINAL', 'DRAFT', 'Buka kunci FINAL: ' || trim(p_alasan), a.user_id, a.full_name);
    delete from public.ba_signature where ba_id = p_id and slot = 'SITE_REP';
    update public.berita_acara set status = 'DRAFT', updated_at = now() where id = p_id;
  elsif p_jenis = 'KIRIM' then
    insert into public.data_edit_log(tabel, ref, kolom, nilai_lama, nilai_baru, alasan, diubah_oleh, nama)
      select 'kirim_preparasi', p_id::text, 'penerima_ttd', k.penerima_ttd_nama || ' ' || k.penerima_ttd_at, null, 'Buka kunci FINAL: ' || trim(p_alasan), a.user_id, a.full_name from public.kirim_preparasi k where k.id = p_id;
    update public.kirim_preparasi set penerima_ttd_path = null, penerima_ttd_at = null, penerima_ttd_oleh = null, penerima_ttd_nama = null, status = 'DIKIRIM' where id = p_id;
  else raise exception 'Jenis tidak dikenal'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.buka_kunci_dokumen(text, uuid, text) from public, anon;
grant execute on function public.buka_kunci_dokumen(text, uuid, text) to authenticated;

do $$ declare d text := pg_get_functiondef('public.ttd_client_pin(text,uuid,text,text)'::regprocedure);
  a text := 'update private.signature_secret set failed = 0, locked_until = null where user_id = u.user_id;';
begin
  if position(a in d) = 0 then raise exception 'pola tidak ada'; end if;
  execute replace(d, a, a || E'\n  perform set_config(''tgep.buka_kunci'', ''1'', true);');
end $$;
