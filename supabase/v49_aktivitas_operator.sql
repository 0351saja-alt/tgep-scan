-- v49 (27/11/2026): semua yang dilakukan seorang operator/wellsite — kiriman (v_upload_item) + marking, pemeriksaan Form Logging,
-- koreksi conto, edit data, koordinat, konfirmasi foto, ubah foto, kirim sample, berita acara. Dipakai menu Rekap operator → Folder.
create or replace view public.v_aktivitas_operator with (security_invoker = true) as
select u.user_id, u.jenis, u.waktu, u.rig, u.bhid, u.ket, u.bucket, u.photo_path, u.status, u.ref_id::text as ref_id from public.v_upload_item u
union all select m.created_by, 'MARKING', coalesce(m.captured_at, m.created_at), m.rig, m.bhid,
  concat_ws(' · ', 'X ' || round(m.x_utm, 1), 'Y ' || round(m.y_utm, 1), '±' || m.akurasi_m || ' m', m.catatan), null, null, null, m.id::text from public.marking m
union all select j.reviewed_by, 'PERIKSA FORM LOGGING', j.reviewed_at, null, j.bhid_hint, concat_ws(' · ', j.status, 'hal. ' || j.page_no, j.review_note), 'scan-photos', j.photo_path, j.status, j.id::text
  from public.scan_job j where j.reviewed_by is not null and j.reviewed_at is not null
union all select l.edited_by, 'KOREKSI CONTO', l.edited_at, null, s.bhid, concat_ws(' · ', l.sample_no, l.field || ': ' || coalesce(l.old_value, '-') || ' → ' || coalesce(l.new_value, '-'), l.reason), null, null, null, l.id::text
  from public.sample_edit_log l left join public.sample s on s.sample_no = l.sample_no
union all select e.diubah_oleh, 'EDIT DATA', e.diubah_at, null, null, concat_ws(' · ', e.tabel, e.kolom || ': ' || coalesce(e.nilai_lama, '-') || ' → ' || coalesce(e.nilai_baru, '-'), e.alasan), null, null, null, e.id::text
  from public.data_edit_log e
union all select k.diubah_oleh, 'KOORDINAT LUBANG', k.diubah_at, null, k.bhid, concat_ws(' · ', 'X ' || k.x_baru, 'Y ' || k.y_baru, k.sumber, k.alasan), null, null, null, k.id::text from public.koordinat_log k
union all select f.diubah_oleh, 'UBAH FOTO', f.diubah_at, null, null, concat_ws(' · ', f.tabel, f.kolom, f.alasan), null, null, null, f.id::text from public.foto_edit_log f
union all select d.konfirmasi_oleh, 'KONFIRMASI FOTO', d.konfirmasi_at, d.rig, d.bhid, concat_ws(' · ', d.event_type, d.konfirmasi_ket), 'progress-photos', d.photo_path, null, d.id::text
  from public.drill_event d where d.konfirmasi_oleh is not null
union all select p.created_by, 'KIRIM SAMPLE', p.created_at, null, null, concat_ws(' · ', p.no_kirim, p.tujuan, p.status), null, null, p.status, p.id::text from public.kirim_preparasi p
union all select b.created_by, 'BERITA ACARA', b.created_at, null, b.bhid, concat_ws(' · ', b.jenis, b.nomor, b.status), null, null, b.status, b.id::text from public.berita_acara b;
grant select on public.v_aktivitas_operator to authenticated;
