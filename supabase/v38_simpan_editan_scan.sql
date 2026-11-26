-- v38 (26/11/2026): Periksa Scan — "💾 Simpan editan" (simpan sementara tanpa menyetujui)
-- Editan pemeriksa disimpan di scan_job.draft, TIDAK menimpa scan_job.merged (hasil baca asli),
-- sehingga saat "✅ Terima & simpan" approve_scan tetap membandingkan dengan hasil baca asli
-- dan semua koreksi tetap tercatat di Riwayat koreksi (sample_edit_log).
-- Draf otomatis dibuang bila: scan disetujui / ditolak / diproses ulang, atau hasil baca (merged) berubah.

alter table public.scan_job
  add column if not exists draft jsonb,
  add column if not exists draft_by uuid,
  add column if not exists draft_at timestamptz,
  add column if not exists draft_note text;

comment on column public.scan_job.draft is 'Editan pemeriksa yang disimpan sementara (belum disetujui). Hasil baca asli tetap di merged.';

create or replace function public.simpan_editan_scan(p_job uuid, p_data jsonb, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare j public.scan_job;
begin
  if coalesce((select private.my_role()), '') not in ('verifier','admin') then
    raise exception 'Hanya verifier/admin yang boleh menyimpan editan pemeriksaan'; end if;
  select * into j from public.scan_job where id = p_job for update;
  if not found then raise exception 'Form Logging tidak ditemukan'; end if;
  if j.status = 'APPROVED' then raise exception 'Sudah disetujui — koreksi lewat menu Data & cek (Koreksi conto)'; end if;
  if j.status = 'REJECTED' then raise exception 'Form Logging ini sudah ditolak'; end if;
  if j.status = 'PROCESSING' then raise exception 'Masih dibaca otomatis — tunggu selesai lalu buka lagi'; end if;
  if p_data is null or jsonb_typeof(p_data->'header') is distinct from 'object' then raise exception 'Isian kosong'; end if;
  update public.scan_job
     set draft = p_data, draft_by = (select auth.uid()), draft_at = now(), draft_note = nullif(trim(p_note), '')
   where id = p_job;
  return jsonb_build_object('ok', true, 'baris', coalesce(jsonb_array_length(p_data->'rows'), 0), 'draft_at', now());
end $function$;

revoke all on function public.simpan_editan_scan(uuid, jsonb, text) from public, anon;
grant execute on function public.simpan_editan_scan(uuid, jsonb, text) to authenticated;

create or replace function private.buang_draft_scan()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- update yang memang menyimpan draf (draft_at berubah) dibiarkan
  if new.draft_at is distinct from old.draft_at then return new; end if;
  if new.draft is not null and (
       new.merged is distinct from old.merged
       or (new.status is distinct from old.status and new.status in ('APPROVED','REJECTED','PROCESSING'))) then
    new.draft := null; new.draft_by := null; new.draft_at := null; new.draft_note := null;
  end if;
  return new;
end $function$;

create or replace trigger buang_draft_scan before update on public.scan_job
  for each row execute function private.buang_draft_scan();
