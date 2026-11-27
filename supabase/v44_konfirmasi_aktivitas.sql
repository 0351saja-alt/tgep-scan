-- v44 (27/11/2026): ✅ Konfirmasi tanda masalah foto aktivitas (JAUH DARI TITIK BOR, FOTO LAMA/GALERI, dll.) oleh wellsite/verifier/admin.
-- Foto yang sudah dikonfirmasi tidak lagi dihitung bermasalah (kolom flags kosong); alasan & siapa tercatat.
-- Juga: admin_ubah_data boleh mengubah lat/lon foto aktivitas (koordinat foto = koordinat lubang).
alter table public.drill_event
  add column if not exists konfirmasi_at timestamptz,
  add column if not exists konfirmasi_oleh uuid,
  add column if not exists konfirmasi_ket text;

create or replace function public.konfirmasi_aktivitas(p_id uuid, p_ket text, p_batal boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare e public.drill_event; nm text;
begin
  if coalesce((select private.my_role()), '') not in ('geologist','verifier','admin') then raise exception 'Hanya wellsite, verifier atau admin yang boleh mengonfirmasi'; end if;
  select * into e from public.drill_event where id = p_id for update;
  if not found then raise exception 'Data aktivitas tidak ditemukan'; end if;
  select full_name into nm from public.app_user where user_id = auth.uid();
  if p_batal then
    update public.drill_event set konfirmasi_at = null, konfirmasi_oleh = null, konfirmasi_ket = null where id = p_id;
  else
    update public.drill_event set konfirmasi_at = now(), konfirmasi_oleh = auth.uid(),
      konfirmasi_ket = concat_ws(' · ', nullif(trim(p_ket), ''), nm) where id = p_id;
  end if;
  insert into public.data_edit_log(tabel, ref, kolom, nilai_lama, nilai_baru, alasan, nama)
  values ('drill_event', p_id::text, 'konfirmasi', e.konfirmasi_ket, case when p_batal then null else coalesce(nullif(trim(p_ket), ''), 'dikonfirmasi') end,
          coalesce(nullif(trim(p_ket), ''), case when p_batal then 'konfirmasi dibatalkan' else 'dikonfirmasi' end), nm);
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.konfirmasi_aktivitas(uuid, text, boolean) from public, anon;
grant execute on function public.konfirmasi_aktivitas(uuid, text, boolean) to authenticated;

do $mig$
declare d text := pg_get_viewdef('public.v_drill_event_qc'::regclass);
begin
  if position('d.created_by,' in d) = 0 or position('END) AS flags' in d) = 0 or position('concat_ws('' | ''::text,' in d) = 0 then raise exception 'pola view v_drill_event_qc berubah'; end if;
  d := replace(d, 'd.created_by,', 'd.created_by, d.konfirmasi_at, d.konfirmasi_ket,');
  d := replace(d, 'concat_ws('' | ''::text,', 'CASE WHEN e.konfirmasi_at IS NOT NULL THEN ''''::text ELSE concat_ws('' | ''::text,');
  d := replace(d, 'END) AS flags', 'END) END AS flags, e.konfirmasi_at, e.konfirmasi_ket');
  execute 'create or replace view public.v_drill_event_qc with (security_invoker = true) as ' || d;
end $mig$;

do $mig$
declare d text := pg_get_functiondef('public.admin_ubah_data'::regproc);
begin
  if position('''titik_bergeser'',''geser_ket'']' in d) = 0 then raise exception 'pola admin_ubah_data berubah'; end if;
  d := replace(d, '''titik_bergeser'',''geser_ket'']', '''titik_bergeser'',''geser_ket'',''lat'',''lon'']');
  execute d;
end $mig$;
