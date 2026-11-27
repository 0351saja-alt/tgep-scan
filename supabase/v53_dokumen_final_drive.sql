-- v53 (27/11/2026): Data yang sudah FIX otomatis dikirim ke Google Drive, dipisah per rig → per tanggal.
--  • DDR yang sudah LENGKAP DITANDATANGANI → PDF dibuat server (edge function drive-sync) → Driller/<Proyek>/Progres bor/<RIG>/<tanggal>/
--    (satu folder dengan foto progres hari itu). Bila DDR diubah / ditandatangani ulang → PDF revisi baru (_rev2, _rev3, …).
--  • Form Logging yang DISETUJUI → Wellsite (Geologi)/<Proyek>/Form Logging/<RIG>/<tanggal disetujui>/
--  • Form kirim sample berstatus DIKIRIM / DITERIMA → PDF berkop → Wellsite (Geologi)/<Proyek>/Kirim sample/<tanggal kirim>/
--  • Foto progres tetap di Driller/<Proyek>/Progres bor/<RIG>/<tanggal>/ (sudah per rig & tanggal).
-- File yang sudah tersalin sebelumnya tidak dipindah.
insert into storage.buckets(id, name, public) values ('dokumen-final', 'dokumen-final', false) on conflict (id) do nothing;

create table if not exists public.dokumen_final (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('DDR', 'KIRIM SAMPLE')),
  ref_id uuid not null,
  versi text not null,
  revisi integer not null default 1,
  rig text, tanggal date, bhid text, project text,
  path text not null unique,
  nama text not null,
  created_at timestamptz not null default now(),
  unique (jenis, ref_id, versi));
alter table public.dokumen_final enable row level security;
create policy "dokumen final: staf baca" on public.dokumen_final for select to authenticated
  using ((select private.my_role()) in ('geologist', 'verifier', 'admin'));

-- dokumen yang perlu dibuat (versi = sidik isi; berubah bila isi / tanda tangan berubah). Hanya untuk service role (edge function).
create or replace view public.v_dokumen_perlu as
select x.* from (
  select 'DDR'::text as jenis, d.id as ref_id,
    left(md5((to_jsonb(d) - 'client_uuid' - 'ganti_id')::text || coalesce((select string_agg(concat_ws(';', s.slot, s.signed_at, s.signature_path, s.signer_name), '|' order by s.slot)
      from public.ddr_signature s where s.ddr_id = d.id), '')), 12) as versi,
    d.rig, d.report_date as tanggal, d.bhid, d.project, coalesce(d.captured_at, d.created_at) as waktu
  from public.ddr d where d.status = 'SIGNED'
  union all
  select 'KIRIM SAMPLE', k.id,
    left(md5(to_jsonb(k)::text || coalesce((select string_agg((to_jsonb(i) - 'id')::text, '|' order by i.urut, i.sample_no) from public.kirim_preparasi_item i where i.kirim_id = k.id), '')), 12),
    null, k.tanggal, null, k.project, k.created_at
  from public.kirim_preparasi k where k.status in ('DIKIRIM', 'DITERIMA')) x
where not exists (select 1 from public.dokumen_final f where f.jenis = x.jenis and f.ref_id = x.ref_id and f.versi = x.versi);
revoke all on public.v_dokumen_perlu from public, anon, authenticated;

create or replace function private.drive_audiens(p_jenis text)
returns text language sql immutable set search_path to ''
as $function$
  select case when p_jenis like 'KEU%' then 'Keuangan (internal)'
              when p_jenis in ('PROGRES','P2H','ARSIP DDR','ARSIP P2H','DDR PDF') then 'Driller' else 'Wellsite (Geologi)' end $function$;

-- rig sebuah lubang: DDR terakhir → aktivitas terakhir → data lubang
create or replace function private.rig_lubang(p_bhid text)
returns text language sql stable set search_path to ''
as $function$
  select coalesce((select d.rig from public.ddr d where d.bhid = p_bhid order by d.report_date desc limit 1),
                  (select e.rig from public.drill_event e where e.bhid = p_bhid order by e.captured_at desc limit 1),
                  (select b.rigmc_id from public.borehole b where b.bhid = p_bhid)) $function$;

create or replace view public.v_drive_antrean as
 SELECT bucket, path, jenis, bhid, ((private.drive_audiens(jenis) || '/'::text) || folder) AS folder, nama, waktu
   FROM ( SELECT 'core-photos'::text AS bucket, c.photo_path AS path, 'FOTO CORE'::text AS jenis, c.bhid,
            (((COALESCE(private.nm(c.project), 'TANPA PROYEK'::text) || '/'::text) || COALESCE(private.nm(c.bhid), 'TANPA BHID'::text)) || '/Foto core'::text) AS folder,
            ((concat_ws('_'::text, private.nm(c.bhid), private.nm(c.photo_type), ('kotak'::text || c.box_no), (((replace((c.depth_from)::text, '.'::text, ','::text) || '-'::text) || replace((c.depth_to)::text, '.'::text, ','::text)) || 'm'::text)) || '.'::text) || private.ext(c.photo_path)) AS nama,
            c.created_at AS waktu
           FROM public.core_photo c
          WHERE ((c.photo_path IS NOT NULL) AND (NOT COALESCE(c.ditolak, false)))
        UNION ALL
         SELECT 'scan-photos'::text, j.photo_path, 'FORM LOGGING'::text, j.bhid_hint,
            COALESCE(private.nm(j.project), 'TANPA PROYEK'::text) || '/Form Logging/' || COALESCE(private.nm(private.rig_lubang(j.bhid_hint)), 'tanpa rig') || '/' || private.tgl(COALESCE(j.reviewed_at, j.created_at)),
            ((concat_ws('_'::text, private.nm(j.bhid_hint), 'FormLogging', ('hal'::text || COALESCE((j.page_no)::text, '-'::text)), private.tgl(j.created_at), "left"((j.id)::text, 8)) || '.'::text) || private.ext(j.photo_path)),
            j.created_at
           FROM public.scan_job j
          WHERE ((j.photo_path IS NOT NULL) AND (j.status = 'APPROVED'::text))
        UNION ALL
         SELECT 'scan-photos'::text, f.photo_path, ('ARSIP '::text || f.jenis), f.bhid,
            ((((COALESCE(private.nm(f.project), 'TANPA PROYEK'::text) || '/'::text) || COALESCE(private.nm(f.bhid), ('Arsip '::text || COALESCE(private.nm(f.rig), 'tanpa rig'::text)))) || '/Arsip '::text) || private.nm(f.jenis)),
            ((concat_ws('_'::text, private.nm(f.jenis), private.nm(COALESCE(f.bhid, f.rig)), COALESCE((f.tanggal)::text, private.tgl(f.captured_at)), f.shift, ('hal'::text || COALESCE((f.halaman)::text, '1'::text)), "left"((f.id)::text, 8)) || '.'::text) || private.ext(f.photo_path)),
            f.created_at
           FROM public.form_photo f
          WHERE (f.photo_path IS NOT NULL)
        UNION ALL
         SELECT 'progress-photos'::text, e.photo_path, 'PROGRES'::text, e.bhid,
            ((((COALESCE(private.nm(e.project), 'TANPA PROYEK'::text) || '/Progres bor/'::text) || COALESCE(private.nm(e.rig), 'tanpa rig'::text)) || '/'::text) || private.tgl(e.captured_at)),
            ((concat_ws('_'::text, to_char((e.captured_at AT TIME ZONE 'Asia/Jakarta'::text), 'HH24MI'::text), private.nm(e.event_type), private.nm(e.bhid),
                CASE WHEN (e.depth_to IS NOT NULL) THEN (((replace((COALESCE(e.depth_from, (0)::numeric))::text, '.'::text, ','::text) || '-'::text) || replace((e.depth_to)::text, '.'::text, ','::text)) || 'm'::text) ELSE NULL::text END,
                "left"((e.id)::text, 8)) || '.'::text) || private.ext(e.photo_path)),
            e.created_at
           FROM public.drill_event e
          WHERE (e.photo_path IS NOT NULL)
        UNION ALL
         SELECT 'progress-photos'::text, p.photo_path, 'P2H'::text, NULL::text,
            ((COALESCE(private.nm(p.project), 'TANPA PROYEK'::text) || '/P2H/'::text) || COALESCE(private.nm(p.rig), 'tanpa rig'::text)),
            ((concat_ws('_'::text, 'P2H', private.nm(p.rig), private.tgl(p.captured_at), p.shift, "left"((p.id)::text, 8)) || '.'::text) || private.ext(p.photo_path)),
            p.created_at
           FROM public.p2h_check p
          WHERE (p.photo_path IS NOT NULL)
        UNION ALL
         SELECT 'dokumen-final'::text, df.path, CASE WHEN df.jenis = 'DDR' THEN 'DDR PDF' ELSE 'KIRIM SAMPLE PDF' END, df.bhid,
            CASE WHEN df.jenis = 'DDR'
                 THEN COALESCE(private.nm(df.project), 'TANPA PROYEK') || '/Progres bor/' || COALESCE(private.nm(df.rig), 'tanpa rig') || '/' || to_char(df.tanggal, 'YYYY-MM-DD')
                 ELSE COALESCE(private.nm(df.project), 'TANPA PROYEK') || '/Kirim sample/' || to_char(df.tanggal, 'YYYY-MM-DD') END,
            df.nama, df.created_at
           FROM public.dokumen_final df
        UNION ALL
         SELECT 'keuangan'::text, x.p, 'KEU BUKTI'::text, NULL::text,
            (((COALESCE(private.nm(t.project), 'TANPA PROYEK'::text) || '/'::text) || to_char((t.tanggal)::timestamp with time zone, 'YYYY-MM'::text)) || '/Nota & bukti'::text),
            (concat_ws('_'::text, to_char((t.tanggal)::timestamp with time zone, 'YYYY-MM-DD'::text), b.jenis, private.nm("left"(t.uraian, 40)), ('Rp'::text || (t.jumlah)::text), x.k, "left"((b.id)::text, 8)) || '.jpg'::text),
            b.created_at
           FROM ((public.keu_bukti b JOIN public.keu_transaksi t ON ((t.id = b.transaksi_id)))
             CROSS JOIN LATERAL ( VALUES (b.path,'potong'::text), (b.path_asli,'asli'::text)) x(p, k))
          WHERE ((x.p IS NOT NULL) AND (t.dihapus_at IS NULL))
        UNION ALL
         SELECT 'keuangan'::text, x.p, 'KEU ABSENSI'::text, NULL::text,
            ((COALESCE(private.nm(a_1.project), 'TANPA PROYEK'::text) || '/Absensi tim lapangan/'::text) || to_char((a_1.tanggal)::timestamp with time zone, 'YYYY-MM'::text)),
            (concat_ws('_'::text, to_char((a_1.tanggal)::timestamp with time zone, 'YYYY-MM-DD'::text), a_1.shift, private.nm(a_1.rig), x.k, "left"((a_1.id)::text, 8)) || '.jpg'::text),
            a_1.created_at
           FROM (public.absensi_lapangan a_1 CROSS JOIN LATERAL ( VALUES (a_1.foto_berangkat,'berangkat'::text), (a_1.foto_pulang,'pulang'::text)) x(p, k))
          WHERE (x.p IS NOT NULL)
        UNION ALL
         SELECT 'keuangan'::text, r.path, 'KEU REKAP'::text, NULL::text,
            (COALESCE(private.nm(r.project), 'TANPA PROYEK'::text) || '/Rekap Excel'::text), r.nama, r.created_at
           FROM public.keu_rekap_file r) a
  WHERE ((EXISTS ( SELECT 1 FROM storage.objects o WHERE ((o.bucket_id = a.bucket) AND (o.name = a.path))))
    AND (NOT (EXISTS ( SELECT 1 FROM public.drive_file d WHERE ((d.bucket = a.bucket) AND (d.path = a.path))))));
