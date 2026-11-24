// check-core-photo: memeriksa foto core terhadap standar foto SOP TGEP (bagian 02 Foto Core Utuh & 06 Core Belah).
// Foto yang tidak sesuai template (BHID/kedalaman di corebox beda, tanpa meteran, lebih dari 1 corebox, lebih dari 5 m core,
// keterangan tidak terbaca) ditandai DITOLAK dengan alasan; butir lain menjadi catatan SOP untuk verifier.
// v12 (24/11, permintaan pemilik): batas tolak resolusi DIBUKA sementara (TOLAK_PX = 0). Foto di bawah standar 3508 px hanya diberi catatan.
// Hemat saldo AI: tiap kotak (BHID + jenis + FROM–TO) paling banyak BATAS_AI kali diperiksa AI. Foto berikutnya disimpan
// sebagai unggahan manual (status MANUAL) dan diperiksa verifier tanpa AI.
// v10: tool_choice "tool" tidak didukung model 5.x → "auto" + instruksi wajib memanggil alat + cadangan JSON dari teks.
// v17 (24/11, permintaan pemilik): format corebox lapangan DITERIMA — label BHID saja (tanpa tulisan kedalaman), baris core
// bernomor 1–5 di sisi kotak, meteran/pita ukur boleh dibentang melintang di atas corebox. Nomor baris BUKAN kedalaman/nomor kotak.
// v18 (24/11): format kedua juga DITERIMA — corebox difoto tegak/vertikal, papan informasi (BHID, kotak, From–To, tanggal, geologist,
// koordinat) di samping kotak, label baris = angka meter akhir tiap baris (mis. 11–15 untuk 10–15 m), label LC (loss core).
// Nomor kotak beda hanya jadi catatan (tidak menolak) karena papan berisi beberapa angka.
// v16 (24/11): kunci AI dibersihkan dari spasi/kutip/baris baru dan dicoba dari beberapa nama secret
// (ANTHROPIC_API_KEY, lalu secret lain yang berisi kunci sk-ant-), seperti baca-nota. Log mencatat nama secret + ciri kunci (bukan isinya).
// v25 (24/11, permintaan pemilik): foto yang sudah dinyatakan sesuai oleh verifier/pemilik (reviewer_override = true)
// tetap DITERIMA walau dianalisis ulang — kolom ditolak tidak lagi bertentangan dengan keputusan itu.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"],
  { auth: { persistSession: false } });
const bersih = (v?: string) => (v ?? "").replace(/\s+/g, "").replace(/^["']+|["']+$/g, "");
const NAMA_KUNCI = ["ANTHROPIC_API_KEY", "CORE_ANTHROPIC_API_KEY", "lagi lagi", "baru", "scan", "Key", "x-terra-baca-nota", "NOTA_ANTHROPIC_API_KEY"];
const KEYS = (NAMA_KUNCI.map((n) => [n, bersih(Deno.env.get(n))]) as [string, string][])
  .filter(([n, v], i, a) => v && (n === "ANTHROPIC_API_KEY" || v.startsWith("sk-ant-")) && a.findIndex(([, w]) => w === v) === i);
const ciri = (v: string) => `${v.slice(0, 10)}…(${v.length} karakter)`;
const MODEL = Deno.env.get("CORE_PHOTO_MODEL") ?? "claude-sonnet-5-5";
const MAKS_M = 5.0, MIN_PX = 3508, TOLAK_PX = 0, BATAS_AI = 2; // TOLAK_PX 2400 → 0 sementara (24/11)
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const ITEMS: { key: string; label: string; wajib: boolean; belahOnly?: boolean; tolak?: boolean }[] = [
  { key: "satu_corebox", label: "Hanya 1 corebox dalam satu foto (maks. 5 m core), seluruh corebox masuk bingkai", wajib: true, tolak: true },
  { key: "tegak_lurus", label: "Kamera sejajar/tegak lurus corebox; foto tidak miring atau perspektif berat", wajib: true },
  { key: "tajam", label: "Foto tajam, tidak blur/goyang", wajib: true, tolak: true },
  { key: "pencahayaan", label: "Teduh dan merata: tanpa sinar matahari langsung, bayangan keras, silau, atau pantulan warna tenda", wajib: true },
  { key: "meteran", label: "Ada meteran/pita ukur di foto (boleh dibentang melintang di atas corebox atau di sepanjang baris) dan angkanya terbaca", wajib: true, tolak: true },
  { key: "keterangan", label: "Label BHID pada corebox terlihat dan terbaca (tulisan kedalaman di kotak TIDAK wajib; nomor baris 1–5 cukup)", wajib: true, tolak: true },
  { key: "core_belah", label: "Core sudah dibelah dan permukaan belahan menghadap kamera", wajib: true, belahOnly: true, tolak: true },
  { key: "penanda_loss_bz", label: "Bila ada loss core atau batas zona, penandanya terlihat", wajib: false },
];

function tool(type: string) {
  const items = ITEMS.filter((i) => !i.belahOnly || type === "BELAH");
  return {
    name: "submit_check",
    description: "WAJIB dipanggil tepat satu kali: hasil pemeriksaan foto core terhadap standar SOP",
    input_schema: {
      type: "object",
      properties: {
        ...Object.fromEntries(items.map((i) => [i.key, {
          type: "object", description: i.label,
          properties: { status: { type: "string", enum: ["LOLOS", "GAGAL", "TIDAK PASTI"] }, alasan: { type: "string" } },
          required: ["status", "alasan"],
        }])),
        bhid_terbaca: { type: "string", description: "BHID yang tertulis di corebox, persis; kosong bila tidak terbaca" },
        kedalaman_terbaca: { type: "string", description: "HANYA kedalaman From–To dalam meter yang ditulis eksplisit di corebox atau di papan informasi (mis. '0,00–5,00 m' atau 'From 10.00 To 15.00'); KOSONG bila tidak ada. Nomor baris 1,2,3,4,5 di sisi kotak dan angka pada meteran BUKAN kedalaman" },
        nomor_kotak_terbaca: { type: "string", description: "Nomor kotak HANYA bila jelas berlabel Box/Kotak/No. Box (di kotak atau di papan informasi); KOSONG bila ragu. Nomor/label baris BUKAN nomor kotak" },
        nomor_baris: { type: "string", description: "Nomor baris core yang tertulis di sisi kotak bila ada, mis. '1-5'" },
        catatan: { type: "string" },
      },
      required: [...items.map((i) => i.key), "bhid_terbaca", "kedalaman_terbaca"],
    },
  };
}

// Cadangan: bila model menjawab dengan teks, ambil objek JSON pertama dari teks itu.
function jsonDariTeks(j: { content?: { type: string; text?: string }[] }) {
  const teks = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  const a = teks.indexOf("{"), z = teks.lastIndexOf("}");
  if (a < 0 || z <= a) return null;
  try { const o = JSON.parse(teks.slice(a, z + 1)); return o && typeof o === "object" ? o : null; } catch { return null; }
}

async function run(id: string) {
  const { data: p } = await admin.from("core_photo").select("*").eq("id", id).single();
  if (!p) return;
  const diterima = p.reviewer_override === true; // sudah dinyatakan sesuai oleh verifier/pemilik
  try {
    await admin.from("core_photo").update({ status: "PROCESSING", error: null }).eq("id", id);
    // resolusi yang pasti ditolak: tolak langsung tanpa memakai saldo AI (TOLAK_PX = 0 → tidak pernah terjadi selama batas dibuka)
    const w0 = Number(p.local_check?.width), h0 = Number(p.local_check?.height);
    if (Number.isFinite(w0) && Number.isFinite(h0) && Math.max(w0, h0) < TOLAK_PX) {
      const m = `Resolusi ${w0}×${h0} px terlalu kecil (minimal ${TOLAK_PX} px sisi panjang)`;
      await admin.from("core_photo").update({ status: "CHECKED", sop_issues: [m], sop_ok: false, ditolak: !diterima, alasan_tolak: diterima ? null : `Ditolak: ${m}. Foto ulang kotak ini sesuai template SOP.` }).eq("id", id);
      return;
    }
    // batas pemeriksaan AI per kotak
    const { data: sebelum } = await admin.from("core_photo").select("ai_kali").eq("bhid", p.bhid).eq("photo_type", p.photo_type)
      .eq("depth_from", p.depth_from).eq("depth_to", p.depth_to);
    const dipakai = (sebelum ?? []).reduce((s: number, r: { ai_kali: number }) => s + (r.ai_kali ?? 0), 0);
    if (dipakai >= BATAS_AI) {
      const m = `Batas ${BATAS_AI} kali pemeriksaan AI untuk kotak ${p.bhid} ${p.photo_type} ${p.depth_from}–${p.depth_to} m sudah tercapai. Foto ini disimpan sebagai unggahan manual dan diperiksa verifier tanpa AI.`;
      await admin.from("core_photo").update({ status: "MANUAL", sop_issues: [m], sop_ok: false, ditolak: false, alasan_tolak: null, error: null }).eq("id", id);
      return;
    }
    if (!KEYS.length) throw new Error("ANTHROPIC_API_KEY belum diatur di Edge Function Secrets");
    const { data: blob, error } = await admin.storage.from("core-photos").download(p.preview_path);
    if (error || !blob) throw new Error("Foto tidak bisa diunduh: " + error?.message);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const prompt = `Anda pemeriksa mutu foto core bor nikel laterit PT Terra Grapindo Eco Prima. Foto ini diklaim sebagai foto core ${p.photo_type === "BELAH" ? "BELAH (half core)" : "UTUH (whole core)"} lubang ${p.bhid}, kotak ${p.box_no ?? "?"}, kedalaman ${p.depth_from}–${p.depth_to} m.\nStandar: satu foto berisi tepat satu corebox; satu corebox boleh memuat beberapa baris core dengan total paling banyak 5 m.\nFORMAT LAPANGAN YANG SAH: corebox kayu berisi 5 baris core, label BHID ditempel di kotak (tanpa tulisan kedalaman), nomor baris 1–5 di sisi kotak, dan meteran/pita ukur boleh dibentang melintang di atas corebox. Format ini LOLOS untuk butir keterangan dan meteran; jangan menolak karena kedalaman tidak ditulis di kotak (kedalaman diambil dari aplikasi). Jangan menganggap nomor baris 1–5 sebagai kedalaman atau nomor kotak.\nFORMAT LAPANGAN KEDUA YANG JUGA SAH: corebox difoto tegak (vertikal) atau mendatar, dengan PAPAN INFORMASI/kertas di samping kotak berisi BHID, nomor kotak, From–To, tanggal, nama geologist dan koordinat; label di ujung tiap baris bisa berupa angka meter akhir tiap baris (mis. 11,12,13,14,15 untuk kotak 10–15 m); label LC = loss core. Papan informasi BUKAN corebox kedua. Ambil BHID dan kedalaman dari papan informasi bila ada (kedalaman_terbaca = From–To di papan, mis. '10.00–15.00').\nPeriksa setiap butir standar foto SOP secara ketat dan jujur. Gunakan "TIDAK PASTI" bila foto tidak cukup jelas untuk memutuskan; jangan menebak lolos.\nAlasan singkat (maks 15 kata), dalam bahasa Indonesia, menyebut apa yang terlihat. Salin BHID, kedalaman dan nomor kotak yang tertulis di corebox persis seperti tertulis.\nKIRIM HASIL HANYA dengan memanggil alat submit_check tepat satu kali. Jangan menulis jawaban sebagai teks biasa.`;
    const body = JSON.stringify({ model: MODEL, max_tokens: 4000, tools: [tool(p.photo_type)], tool_choice: { type: "auto" },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: btoa(bin) } }, { type: "text", text: prompt }] }] });
    let r: Response | null = null, t = "";
    for (const [nama, kunci] of KEYS) {
      r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": kunci, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body });
      if (r.ok) { console.log(`check-core-photo: OK via ${nama} ${ciri(kunci)}`); break; }
      t = (await r.text()).slice(0, 300).replace(/sk-ant-[\w-]+/g, "sk-ant-…");
      console.error(`check-core-photo: ${nama} ${ciri(kunci)} model=${MODEL} → HTTP ${r.status}: ${t}`);
      if (r.status !== 401 && r.status !== 403) break; // hanya kunci ditolak yang dicoba dengan kunci berikutnya
    }
    if (!r!.ok) {
      const st = r!.status;
      if (st === 401 || st === 403) throw new Error(`Kunci AI di Supabase Edge Function Secrets ditolak Anthropic (HTTP ${st}) — hubungi admin (bukan kesalahan foto).`);
      if (st === 400 && /credit|billing|balance/i.test(t)) throw new Error("Saldo/kredit akun AI habis — admin perlu mengisi saldo Anthropic (bukan kesalahan foto).");
      if (st === 429 || st === 529) throw new Error(`Layanan AI sedang sibuk (${st}) — cek ulang beberapa menit lagi.`);
      throw new Error(`Anthropic ${st}: ${t}`);
    }
    // hanya pemeriksaan yang berhasil (dan ditagih) yang dihitung
    await admin.from("core_photo").update({ ai_kali: (p.ai_kali ?? 0) + 1 }).eq("id", id);
    const jr = await r!.json();
    const out = (jr.content ?? []).find((c: { type: string }) => c.type === "tool_use")?.input ?? jsonDariTeks(jr);
    if (!out) throw new Error("Model tidak mengembalikan hasil terstruktur");

    const issues: string[] = [], tolak: string[] = [];
    for (const it of ITEMS.filter((i) => !i.belahOnly || p.photo_type === "BELAH")) {
      const st = out[it.key]?.status;
      if (it.wajib && st === "GAGAL") { issues.push(`${it.label}: ${out[it.key]?.alasan ?? ""}`); if (it.tolak) tolak.push(`${it.label} — ${out[it.key]?.alasan ?? ""}`); }
      if (it.wajib && st === "TIDAK PASTI") issues.push(`Perlu dicek manual — ${it.label}: ${out[it.key]?.alasan ?? ""}`);
    }
    const panjang = Number(p.depth_to) - Number(p.depth_from);
    if (panjang > MAKS_M + 1e-6) { const m = `Panjang core ${panjang.toFixed(2)} m melebihi maksimal ${MAKS_M} m per foto`; issues.push(m); tolak.push(m); }
    const w = Number(p.local_check?.width), h = Number(p.local_check?.height);
    if (Number.isFinite(w) && Number.isFinite(h)) {
      const sisi = Math.max(w, h);
      if (sisi < TOLAK_PX) { const m = `Resolusi ${w}×${h} px terlalu kecil (minimal ${TOLAK_PX} px sisi panjang)`; issues.push(m); tolak.push(m); }
      else if (sisi < MIN_PX) issues.push(`Resolusi ${w}×${h} px di bawah standar ${MIN_PX} px (300 dpi cetak A4) — masih bisa dipakai, cek keterbacaan bila di-zoom`);
    }
    const norm = (s: string) => (s ?? "").toUpperCase().replace(/[\s_\-]/g, "");
    if (out.bhid_terbaca && norm(out.bhid_terbaca) !== norm(p.bhid)) { const m = `BHID di corebox "${out.bhid_terbaca}" ≠ BHID di aplikasi "${p.bhid}"`; issues.push(m); tolak.push(m); }
    const nums = String(out.kedalaman_terbaca ?? "").replace(/,/g, ".").match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
    // nomor baris 1–5 yang salah terbaca sebagai kedalaman diabaikan (kedalaman resmi dari aplikasi)
    const nomorBaris = nums.length >= 2 && nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 5) && !/m\b|from|to|dari|sampai/i.test(String(out.kedalaman_terbaca ?? ""));
    const cocok = (a: number, b: number) => Math.abs(a - b) <= 0.05;
    const awal = nums[0], akhir = nums[nums.length - 1], dF = Number(p.depth_from), dT = Number(p.depth_to);
    const sesuai = cocok(akhir, dT) && (cocok(awal, dF) || cocok(awal, Math.floor(dF) + 1)); // label baris meter akhir (11..15) juga sah
    if (!nomorBaris && nums.length >= 2 && !sesuai) {
      const m = `Kedalaman di corebox "${out.kedalaman_terbaca}" ≠ ${p.depth_from}–${p.depth_to} m di aplikasi`; issues.push(m); tolak.push(m);
    }
    const kotak = parseInt(String(out.nomor_kotak_terbaca ?? "").replace(/\D/g, ""));
    if (p.box_no && Number.isFinite(kotak) && kotak !== p.box_no) issues.push(`Cek nomor kotak: terbaca ${kotak}, di aplikasi kotak ${p.box_no}`);
    for (const w of (p.local_check?.warnings ?? []) as string[]) issues.push(`Cek di HP: ${w}`);

    const sisaAI = BATAS_AI - dipakai - 1;
    const alasan = tolak.length ? `Ditolak: ${tolak.join("; ")}. ${sisaAI > 0 ? `Foto ulang kotak ini sesuai template SOP (sisa ${sisaAI} kali pemeriksaan otomatis).` : "Batas 2 kali pemeriksaan otomatis untuk kotak ini sudah habis: foto ulang yang benar tetap diunggah, lalu diperiksa verifier secara manual."}` : null;
    await admin.from("core_photo").update({ status: "CHECKED", ai_check: out, sop_issues: issues, sop_ok: issues.length === 0, ditolak: diterima ? false : !!alasan, alasan_tolak: diterima ? null : alasan }).eq("id", id);
  } catch (e) {
    await admin.from("core_photo").update({ status: "ERROR", error: String((e as Error).message ?? e) }).eq("id", id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Tidak terautentikasi" }, 401);
    const { photo_id } = await req.json();
    const { data: p } = await admin.from("core_photo").select("id,created_by").eq("id", photo_id).maybeSingle();
    if (!p) return json({ error: "Foto tidak ditemukan" }, 404);
    const { data: me } = await admin.from("app_user").select("role").eq("user_id", u.user.id).maybeSingle();
    if (!me) return json({ error: "Akun belum terdaftar" }, 403);
    if (p.created_by !== u.user.id && !["verifier", "admin"].includes(me.role)) return json({ error: "Tidak berhak" }, 403);
    // @ts-ignore EdgeRuntime tersedia di Supabase
    EdgeRuntime.waitUntil(run(photo_id));
    return json({ ok: true }, 202);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
