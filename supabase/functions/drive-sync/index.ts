// drive-sync: dipanggil Google Apps Script "X-Terra Sinkron Drive".
// GET  ?limit=N              -> (v17) buat dulu PDF dokumen final yang belum ada (DDR bertanda tangan, form kirim sample DIKIRIM/DITERIMA),
//                               lalu antrean file yang belum ada di Drive + link unduh sementara (15 menit)
// GET  ?mode=hapus           -> file yang boleh dihapus dari Storage (sudah >= N hari di Drive)
// GET  ?mode=akses           -> daftar email per folder peran (Driller / Wellsite / Client/<nama> / '' = semua)
// GET  ?mode=client          -> salinan file rilis yang perlu dibuat / ditarik untuk tiap client
// GET  ?mode=dokumen         -> hanya membuat PDF dokumen final (uji)
// POST {bucket,path,drive_id,drive_url,ukuran,...}   -> catat file sudah tersalin
// POST {hapus:[{bucket,path}]}                       -> hapus file asli dari Storage (dicek ulang)
// POST {client_catat:[{user_id,bucket,path,drive_id,folder}]} / {client_tarik:[{user_id,bucket,path}]}
// Otorisasi: header x-sync-key; yang disimpan di sini hanya SHA-256-nya.
import { createClient } from "npm:@supabase/supabase-js@2";
import { pdfDDR, pdfKirim } from "./pdf.ts";

const HASH_KUNCI = "58ce547bea401cad0ab5edb7589809429bb08a3af45ceca2bb67a0f44d196fa5";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const BUCKET_DOK = "dokumen-final", PT = "PT TERRA GRAPINDO ECO PRIMA";

async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function samaAman(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// kop surat (salinan KOP_HEADER / KOP_FOOTER app.js) diambil dari GitHub Pages aplikasi
const KOP_URL = "https://0351saja-alt.github.io/tgep-scan/dokumen/";
let KOP: Promise<[Uint8Array, Uint8Array]> | null = null;
const ambil = async (f: string) => { const r = await fetch(KOP_URL + f); if (!r.ok) throw new Error(`kop ${f} ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
const kop = () => (KOP ??= Promise.all([ambil("kop_header.png"), ambil("kop_footer.png")]).catch((e) => { KOP = null; throw e; }));
const nm = (s: unknown) => String(s ?? "").replace(/[\\/:*?"<>|#]+/g, "-").trim();

// Buat PDF untuk dokumen yang sudah FIX tetapi belum punya PDF versi terbaru (v_dokumen_perlu). Maks n per panggilan.
async function buatDokumen(n = 4) {
  const { data: perlu, error } = await sb.from("v_dokumen_perlu").select("*").order("waktu").limit(n);
  if (error) return { dibuat: 0, galat: [error.message] };
  const hasil = { dibuat: 0, galat: [] as string[] };
  for (const p of perlu ?? []) {
    try {
      const { count } = await sb.from("dokumen_final").select("id", { count: "exact", head: true }).eq("jenis", p.jenis).eq("ref_id", p.ref_id);
      const rev = (count ?? 0) + 1, sfx = rev > 1 ? `_rev${rev}` : "";
      let pdf: Uint8Array, nama: string;
      if (p.jenis === "DDR") {
        const [{ data: d, error: e1 }, { data: sig }] = await Promise.all([sb.from("ddr").select("*").eq("id", p.ref_id).single(), sb.from("ddr_signature").select("*").eq("ddr_id", p.ref_id)]);
        if (e1 || !d) throw new Error(e1?.message ?? "DDR tidak ditemukan");
        const ttd: Record<string, Uint8Array | null> = {};
        for (const s of sig ?? []) if (s.signature_path) {
          const { data: blob } = await sb.storage.from("signatures").download(s.signature_path);
          ttd[s.signature_path] = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
        }
        pdf = await pdfDDR(d, sig ?? [], ttd, rev);
        nama = `DDR_${nm(d.rig)}_${d.report_date}_${d.shift === "PAGI" ? "Day" : "Night"}_${nm(d.bhid || "tanpa-HoleID")}${sfx}.pdf`;
      } else {
        const [{ data: k, error: e1 }, { data: it }] = await Promise.all([sb.from("kirim_preparasi").select("*").eq("id", p.ref_id).single(),
          sb.from("v_kirim_preparasi").select("*").eq("kirim_id", p.ref_id).order("urut")]);
        if (e1 || !k) throw new Error(e1?.message ?? "Form kirim tidak ditemukan");
        const [ka, kb] = await kop();
        pdf = await pdfKirim(k, it ?? [], ka, kb, PT, rev);
        nama = `FormKirimSample_${nm(k.no_kirim)}_${k.tanggal}${sfx}.pdf`;
      }
      const path = `${p.jenis === "DDR" ? "ddr" : "kirim"}/${p.ref_id}/${p.versi}.pdf`;
      const { error: eu } = await sb.storage.from(BUCKET_DOK).upload(path, new Blob([pdf], { type: "application/pdf" }), { upsert: true, contentType: "application/pdf" });
      if (eu) throw new Error(eu.message);
      const { error: ei } = await sb.from("dokumen_final").insert({ jenis: p.jenis, ref_id: p.ref_id, versi: p.versi, revisi: rev, rig: p.rig, tanggal: p.tanggal, bhid: p.bhid, project: p.project, path, nama });
      if (ei && !/duplicate/i.test(ei.message)) throw new Error(ei.message);
      hasil.dibuat++;
    } catch (e) { hasil.galat.push(`${p.jenis} ${p.ref_id}: ${(e as Error).message}`); }
  }
  return hasil;
}

Deno.serve(async (req) => {
  const k = req.headers.get("x-sync-key") ?? "";
  const env = Deno.env.get("DRIVE_SYNC_KEY") ?? "";
  const sah = (k.length >= 16 && samaAman(await sha256(k), HASH_KUNCI)) || (env.length >= 16 && samaAman(k, env));
  if (!sah) return json({ error: "kunci salah" }, 401);
  const q = new URL(req.url).searchParams;

  if (req.method === "GET") {
    const lim = Math.min(100, Math.max(1, Number(q.get("limit") ?? 20)));
    const mode = q.get("mode");
    if (mode === "hapus") {
      const { data, error } = await sb.from("v_drive_hapus").select("bucket,path,drive_id,ukuran,jenis").order("synced_at").limit(lim);
      if (error) return json({ error: error.message }, 500);
      return json({ file: data ?? [] });
    }
    if (mode === "akses") {
      const { data, error } = await sb.from("v_drive_akses").select("folder,email,role");
      if (error) return json({ error: error.message }, 500);
      return json({ akses: data ?? [] });
    }
    if (mode === "client") {
      const [a, b] = await Promise.all([
        sb.from("v_drive_client_tambah").select("user_id,bucket,path,sumber_id,nama,folder").limit(lim),
        sb.from("v_drive_client_tarik").select("user_id,bucket,path,drive_id").limit(lim)]);
      if (a.error || b.error) return json({ error: (a.error ?? b.error)!.message }, 500);
      return json({ tambah: a.data ?? [], tarik: b.data ?? [] });
    }
    if (mode === "dokumen") return json(await buatDokumen(Math.min(10, lim)));
    const dok = await buatDokumen(4).catch((e) => ({ dibuat: 0, galat: [String(e)] }));
    const { data, error, count } = await sb.from("v_drive_antrean").select("*", { count: "exact" }).order("waktu").limit(lim);
    if (error) return json({ error: error.message }, 500);
    const out = [];
    for (const r of data ?? []) {
      const { data: s, error: e } = await sb.storage.from(r.bucket).createSignedUrl(r.path, 900);
      out.push({ ...r, url: s?.signedUrl ?? null, galat: e?.message ?? null });
    }
    return json({ sisa: count ?? out.length, file: out, dokumen: dok });
  }

  if (req.method === "POST") {
    const b = await req.json().catch(() => null);
    if (Array.isArray(b?.hapus)) {
      const hasil = { dihapus: 0, ditolak: [] as string[] };
      for (const h of b.hapus.slice(0, 100)) {
        const { data: ok } = await sb.from("v_drive_hapus").select("path").eq("bucket", h.bucket).eq("path", h.path).maybeSingle();
        if (!ok) { hasil.ditolak.push(`${h.bucket}:${h.path}`); continue; }
        const { error: e } = await sb.storage.from(h.bucket).remove([h.path]);
        if (e) { hasil.ditolak.push(`${h.bucket}:${h.path} (${e.message})`); continue; }
        await sb.from("drive_file").update({ dihapus_at: new Date().toISOString() }).eq("bucket", h.bucket).eq("path", h.path);
        hasil.dihapus++;
      }
      return json(hasil);
    }
    if (Array.isArray(b?.client_catat)) {
      const rows = b.client_catat.slice(0, 100).map((x: any) => ({ user_id: x.user_id, bucket: x.bucket, path: x.path, drive_id: x.drive_id, folder: x.folder ?? null }));
      const { error } = await sb.from("drive_client").upsert(rows);
      return error ? json({ error: error.message }, 500) : json({ ok: rows.length });
    }
    if (Array.isArray(b?.client_tarik)) {
      let n = 0;
      for (const x of b.client_tarik.slice(0, 100)) {
        const { error } = await sb.from("drive_client").delete().eq("user_id", x.user_id).eq("bucket", x.bucket).eq("path", x.path);
        if (!error) n++;
      }
      return json({ ok: n });
    }
    if (!b?.bucket || !b?.path || !b?.drive_id || !b?.drive_url) return json({ error: "data tidak lengkap" }, 400);
    const { error } = await sb.from("drive_file").upsert({ bucket: b.bucket, path: b.path, drive_id: b.drive_id, drive_url: b.drive_url,
      folder: b.folder ?? null, nama: b.nama ?? null, jenis: b.jenis ?? null, bhid: b.bhid ?? null,
      ukuran: Number.isFinite(Number(b.ukuran)) ? Number(b.ukuran) : null, synced_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  return json({ error: "metode tidak didukung" }, 405);
});
