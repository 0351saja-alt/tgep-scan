-- v40 (27/11/2026): 🗑 Hapus untuk data yang salah kirim / salah upload / salah marking.
-- Fungsi public.hapus_data_tersimpan dipanggil aplikasi (Data tersimpan & Database) tetapi BELUM ADA di database
-- → tombol 🗑 Hapus selama ini gagal. Data yang dihapus disimpan utuh di Arsip terhapus (deleted_record) dan bisa dipulihkan admin.
-- JALANKAN DI SQL EDITOR SUPABASE (memuat DELETE, tidak bisa lewat apply_migration):
-- https://supabase.com/dashboard/project/ytrvezripgkzuwyjvmnb/sql/new

create or replace function public.hapus_data_tersimpan(p_table text, p_id uuid, p_alasan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid := (select auth.uid()); peran text := coalesce((select private.my_role()), '');
        v_row jsonb; v_rel jsonb; v_owner uuid; v_final boolean := false; v_bhid text;
begin
  if uid is null then raise exception 'Harus masuk dulu'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan penghapusan wajib diisi'; end if;
  if p_table not in ('ddr','scan_job','form_photo','p2h_check','drill_event','core_photo','marking','kirim_preparasi','rencana_lubang') then
    raise exception 'Tabel % tidak bisa dihapus dari menu ini', p_table; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', p_table) into v_row using p_id;
  if v_row is null then raise exception 'Data tidak ditemukan (mungkin sudah dihapus)'; end if;
  v_owner := nullif(v_row->>'created_by', '')::uuid;
  v_bhid := coalesce(v_row->>'bhid', v_row->>'bhid_hint', v_row->>'rig', v_row->>'no_kirim');
  v_final := (p_table = 'ddr' and v_row->>'status' = 'SIGNED') or (p_table = 'scan_job' and v_row->>'status' = 'APPROVED')
          or (p_table = 'kirim_preparasi' and v_row->>'status' = 'DITERIMA');
  if peran not in ('verifier','admin') and (v_owner is distinct from uid or peran not in ('geologist','driller','admin_lapangan')) then
    raise exception 'Hanya pengirim (atau verifier/admin) yang boleh menghapus data ini'; end if;
  if v_final and peran <> 'admin' then raise exception 'Data ini sudah final (ditandatangani/disetujui/diterima) — hanya admin yang boleh menghapus'; end if;
  if p_table = 'ddr' then
    select jsonb_build_object('signatures', coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)) into v_rel from public.ddr_signature s where s.ddr_id = p_id;
  elsif p_table = 'kirim_preparasi' then
    select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)) into v_rel from public.kirim_preparasi_item i where i.kirim_id = p_id;
  end if;
  insert into public.deleted_record(table_name, record_key, bhid, data, related, reason, deleted_by)
  values (p_table, p_id::text, v_bhid, v_row, v_rel, p_alasan, uid);
  execute format('delete from public.%I where id = $1', p_table) using p_id;
  return jsonb_build_object('ok', true, 'deleted', p_table, 'key', p_id);
end $function$;

revoke all on function public.hapus_data_tersimpan(text, uuid, text) from public, anon;
grant execute on function public.hapus_data_tersimpan(text, uuid, text) to authenticated;

-- Pemulihan dari Arsip terhapus: tambah marking, rencana_lubang, kirim_preparasi (+ isi kiriman)
create or replace function private.admin_restore_impl(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare d public.deleted_record;
begin
  perform private.cek_admin();
  select * into d from public.deleted_record where id = p_id for update;
  if not found or d.restored_at is not null then raise exception 'Arsip tidak ada atau sudah dipulihkan'; end if;
  if d.table_name = 'sample' then
    insert into public.sample select * from jsonb_populate_record(null::public.sample, d.data);
    insert into public.sample_edit_log overriding system value
      select * from jsonb_populate_recordset(null::public.sample_edit_log, coalesce(d.related->'edit_log', '[]'::jsonb));
  elsif d.table_name = 'ddr' then
    insert into public.ddr select * from jsonb_populate_record(null::public.ddr, d.data);
    insert into public.ddr_signature
      select * from jsonb_populate_recordset(null::public.ddr_signature, coalesce(d.related->'signatures', '[]'::jsonb));
  elsif d.table_name = 'kirim_preparasi' then
    insert into public.kirim_preparasi select * from jsonb_populate_record(null::public.kirim_preparasi, d.data);
    insert into public.kirim_preparasi_item
      select * from jsonb_populate_recordset(null::public.kirim_preparasi_item, coalesce(d.related->'items', '[]'::jsonb));
  elsif d.table_name in ('scan_job','core_photo','borehole','drill_event','p2h_check','form_photo','survey','client_release','marking','rencana_lubang') then
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', d.table_name, d.table_name) using d.data;
  else
    raise exception 'Tabel % tidak bisa dipulihkan', d.table_name;
  end if;
  update public.deleted_record set restored_at = now(), restored_by = (select auth.uid()) where id = p_id;
  return jsonb_build_object('restored', d.table_name, 'key', d.record_key);
end $function$;
