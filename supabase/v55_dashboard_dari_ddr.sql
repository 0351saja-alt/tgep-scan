-- v55 (27/11/2026): Dashboard merekap jam dari DDR. Sebelumnya jam kerja bor & standby hanya dihitung dari foto aktivitas,
-- sehingga hari yang DDR-nya lengkap (mis. 26/11 RIG 2: coring 07:30–16:00) tampil 0 jam. Sekarang:
--  • v_dash_rig_day.jam_kerja_bor = jam DRILLING SYSTEM di DDR (bila ada), selain itu dari foto; standby_menit = ACTIVE/STANDBY DDR (bila ada), selain itu dari foto.
--  • v_dash_time (distribusi waktu): hari+rig yang punya jam DDR memakai DDR; hari tanpa jam DDR tetap dari foto.
create or replace view public.v_dash_rig_day as
 WITH prog AS (
         SELECT tanggal, rig, sum(meter_bor) AS meter_bor, sum(jumlah_run) AS jumlah_run, sum(core_terambil_m) AS core_m,
            sum(standby_menit) AS standby_menit, sum(jam_kerja_bor) AS jam_kerja_bor, sum(ganti_mata_bor) AS ganti_mata_bor,
            bool_or(jam_p2h IS NOT NULL) AS ada_p2h,
            bool_or(chk_harian ~~ '%TANPA P2H%' OR chk_harian ~~ '%P2H SETELAH%' OR chk_harian ~~ '%TIDAK LAYAK%') AS p2h_bermasalah,
            sum(kejadian_bermasalah) AS kejadian_bermasalah
           FROM public.v_drill_progress_daily GROUP BY tanggal, rig
        ), ddr AS (
         SELECT report_date AS tanggal, rig, sum(bbm_liter) AS bbm_liter, sum(oli_liter) AS oli_liter, count(*) AS n_ddr,
            count(*) FILTER (WHERE status = 'SIGNED') AS n_ddr_ttd, sum(hm_jam) AS hm_jam, sum(jam_ddr_menit) / 60.0 AS jam_ddr
           FROM public.v_ddr_list GROUP BY report_date, rig
        ), dm AS (
         SELECT tanggal, rig, sum(meter) AS meter,
            sum(core_m) FILTER (WHERE jenis = 'CORING' AND core_m IS NOT NULL) AS core_m,
            sum(meter) FILTER (WHERE jenis = 'CORING' AND core_m IS NOT NULL) AS meter_core
           FROM public.v_ddr_baris GROUP BY tanggal, rig
        ), dh AS (
         SELECT tanggal, rig, sum(menit) FILTER (WHERE kelompok = 'DRILLING SYSTEM') / 60.0 AS jam_bor,
            sum(menit) FILTER (WHERE kelompok = 'ACTIVE/STANDBY') AS standby
           FROM public.v_ddr_hours GROUP BY tanggal, rig
        )
 SELECT COALESCE(p.tanggal, d.tanggal) AS tanggal,
    COALESCE(p.rig, d.rig) AS rig,
    COALESCE(m.meter, 0::numeric) AS meter_bor,
    COALESCE(p.jumlah_run, 0::numeric) AS jumlah_run,
    round(100::numeric * m.core_m / NULLIF(m.meter_core, 0::numeric), 1) AS recovery_pct,
    round(COALESCE(NULLIF(h.jam_bor, 0), p.jam_kerja_bor, 0::numeric), 2) AS jam_kerja_bor,
    COALESCE(NULLIF(h.standby, 0)::numeric, p.standby_menit, 0::numeric) AS standby_menit,
    round(m.meter / NULLIF(COALESCE(NULLIF(h.jam_bor, 0), NULLIF(d.jam_ddr, 0::numeric), p.jam_kerja_bor), 0::numeric), 2) AS meter_per_jam,
    COALESCE(p.ganti_mata_bor, 0::numeric) AS ganti_mata_bor,
    COALESCE(d.bbm_liter, 0::numeric) AS bbm_liter,
    COALESCE(d.oli_liter, 0::numeric) AS oli_liter,
    round(d.bbm_liter / NULLIF(m.meter, 0::numeric), 2) AS bbm_per_meter,
    d.hm_jam,
    COALESCE(p.ada_p2h, false) AS ada_p2h,
    COALESCE(p.p2h_bermasalah, false) AS p2h_bermasalah,
    COALESCE(d.n_ddr, 0::bigint) AS n_ddr,
    COALESCE(d.n_ddr_ttd, 0::bigint) AS n_ddr_ttd,
    COALESCE(p.kejadian_bermasalah, 0::numeric) AS kejadian_bermasalah,
    COALESCE(p.meter_bor, 0::numeric) AS meter_run_foto
   FROM prog p
     FULL JOIN ddr d ON d.tanggal = p.tanggal AND d.rig = p.rig
     LEFT JOIN dm m ON m.tanggal = COALESCE(p.tanggal, d.tanggal) AND m.rig = COALESCE(p.rig, d.rig)
     LEFT JOIN dh h ON h.tanggal = COALESCE(p.tanggal, d.tanggal) AND h.rig = COALESCE(p.rig, d.rig);

create or replace view public.v_dash_time with (security_invoker = true) as
 SELECT tanggal, rig,
        CASE WHEN event_type = ANY (ARRAY['MULAI_BOR','RUN','TAMBAH_STANG']) THEN 'Pengeboran'
             WHEN event_type = 'GANTI_MATA_BOR' THEN 'Ganti mata bor'
             WHEN event_type = 'STANDBY' THEN 'Standby'
             WHEN event_type = 'PERBAIKAN' THEN 'Perbaikan'
             WHEN event_type = 'PINDAH_TITIK' THEN 'Pindah titik'
             ELSE 'Lainnya' END AS kegiatan,
    COALESCE(NULLIF(reason, ''), '-') AS alasan,
    sum(LEAST(durasi_ke_berikutnya_min, 720::numeric)) AS menit
   FROM public.v_drill_event_qc e
  WHERE event_type <> ALL (ARRAY['SELESAI_BOR','KELUAR']) AND durasi_ke_berikutnya_min IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.v_ddr_hours h WHERE h.tanggal = e.tanggal AND h.rig = e.rig)
  GROUP BY 1, 2, 3, 4
 UNION ALL
 SELECT tanggal, rig,
        CASE WHEN kelompok = 'DRILLING SYSTEM' THEN 'Pengeboran'
             WHEN kategori = 'SERVICE/MAINTENANCE' THEN 'Perbaikan'
             WHEN kategori = 'RIG SET UP/DOWN/PREPARATION' OR kategori = 'DRILL SITE PREPARATION' THEN 'Pindah titik'
             WHEN kelompok = 'ACTIVE/STANDBY' THEN 'Standby'
             ELSE 'Lainnya' END,
    kategori, sum(menit)::numeric
   FROM public.v_ddr_hours
  GROUP BY 1, 2, 3, 4;
