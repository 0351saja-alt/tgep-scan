-- v52 (27/11/2026): Rilis ke client OTOMATIS — panel "Rilis foto & scan ke client" dihapus.
-- Setiap Hole ID yang muncul (lubang, DDR, aktivitas, foto core, scan, foto formulir, sample) langsung dirilis untuk semua jenis data,
-- sehingga data yang masuk/terupdate langsung terlihat client yang proyeknya mencakup lubang itu.
-- Penyaring yang tetap berlaku (dari kebijakan RLS lama): foto core DITOLAK tidak ikut, scan Form Logging hanya yang APPROVED,
-- DDR hanya yang SIGNED, data geologi/assay hanya untuk client yang diberi akses geologi (client_geo).
create or replace function private.rilis_otomatis(p_bhid text)
returns void
language sql
security definer
set search_path to ''
as $$
  insert into public.client_release(bhid, jenis, released_by, released_at, catatan)
  select nullif(trim(p_bhid), ''), j, null, now(), 'otomatis'
    from unnest(array['FOTO_CORE','SCAN_LOGGING','FORM_ARSIP','AKTIVITAS_BOR','DDR','GEOLOGI','ASSAY']) j
   where nullif(trim(p_bhid), '') is not null
  on conflict (bhid, jenis) do nothing
$$;
revoke all on function private.rilis_otomatis(text) from public, anon, authenticated;

create or replace function private.rilis_otomatis_trg()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform private.rilis_otomatis(coalesce(to_jsonb(new)->>'bhid', to_jsonb(new)->>'bhid_hint'));
  return null;
end $$;

do $mig$
declare t text;
begin
  foreach t in array array['borehole','ddr','drill_event','core_photo','scan_job','form_photo','sample'] loop
    execute format('create or replace trigger zz_rilis_otomatis after insert or update on public.%I for each row execute function private.rilis_otomatis_trg()', t);
  end loop;
end $mig$;

-- semua Hole ID yang sudah ada
select private.rilis_otomatis(b) from (
  select bhid b from public.borehole union select bhid from public.ddr union select bhid from public.drill_event
  union select bhid from public.core_photo union select bhid_hint from public.scan_job union select bhid from public.form_photo
  union select bhid from public.sample) x where b is not null;
