// baca-nota: membaca satu foto nota / bukti transfer / bukti pembayaran (sudah dipotong di HP) untuk mengisi
// laporan keuangan lapangan. Hanya admin & admin_lapangan. Hasil = usulan; admin lapangan tetap memeriksa & boleh mengubah.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"];
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });
// Kunci dicoba berurutan: NOTA_ANTHROPIC_API_KEY lalu ANTHROPIC_API_KEY, sehingga kunci lama yang tertinggal di salah satu
// nama tidak memblokir kunci baru di nama lain. Spasi/tanda kutip tak sengaja saat menempel dibuang.
const bersih = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const KEYS = ([["NOTA_ANTHROPIC_API_KEY", bersih(Deno.env.get("NOTA_ANTHROPIC_API_KEY"))], ["ANTHROPIC_API_KEY", bersih(Deno.env.get("ANTHROPIC_API_KEY"))]] as [string, string][])
  .filter(([, v], i, a) => v && a.findIndex(([, w]) => w === v) === i);
const ciri = (v: string) => `${v.slice(0, 10)}…(${v.length} karakter)`; // untuk log; tidak pernah membuka isi kunci
const MODEL = Deno.env.get("NOTA_MODEL") ?? Deno.env.get("SCAN_MODEL_A") ?? "claude-sonnet-5-5";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const KAT_KELUAR = ["BBM", "Konsumsi / makan", "Akomodasi / sewa mes", "Transportasi & ojek", "Upah harian / tenaga lokal", "Sewa alat / kendaraan", "Material & consumable bor",
  "Suku cadang & perbaikan", "Air & logistik", "ATK & cetak", "Kesehatan & K3", "Komunikasi / pulsa", "Retribusi & izin lokal", "Kasbon / uang muka", "Lain-lain"];
const KAT_MASUK = ["Dana operasional dari kantor", "Pengembalian kasbon", "Lain-lain"];
const yakin = { type: "string", enum: ["tinggi", "sedang", "rendah"] };
const TOOL = { name: "isi_laporan", description: "Kirim hasil pembacaan dokumen keuangan", input_schema: { type: "object", properties: {
  jenis_dokumen: { type: "string", enum: ["NOTA", "TRANSFER", "PEMBAYARAN", "LAINNYA"], description: "NOTA = nota/struk/kuitansi pembelian; TRANSFER = bukti transfer bank/m-banking; PEMBAYARAN = bukti bayar QRIS/EDC/e-wallet/tagihan; LAINNYA = bukan bukti keuangan" },
  arah: { type: "string", enum: ["MASUK", "KELUAR"], description: "MASUK bila uang DITERIMA pihak kita (kas lapangan); KELUAR bila pihak kita membeli/membayar/mentransfer ke orang lain" },
  alasan_arah: { type: "string", description: "Satu kalimat: bukti di gambar yang menentukan arah (mis. 'penerima transfer = rekening kas lapangan')" },
  tanggal: { type: "string", description: "Tanggal transaksi format YYYY-MM-DD; kosong bila tidak ada" },
  jumlah: { type: "integer", description: "Nilai rupiah utama tanpa titik: total yang benar-benar dibayar setelah diskon (Grand Total), bukan uang tunai yang diberikan/kembalian; atau nominal transfer/pembayaran. 0 bila tidak terbaca" },
  biaya_admin: { type: "integer", description: "Biaya admin/transfer bila tertulis terpisah, selain itu 0" },
  pihak: { type: "string", description: "Nama toko/penjual untuk nota; nama penerima (bila KELUAR) atau pengirim (bila MASUK) untuk transfer" },
  no_ref: { type: "string", description: "Nomor nota/struk atau nomor referensi/ID transaksi" },
  metode: { type: "string", enum: ["TUNAI", "TRANSFER", "QRIS", "LAINNYA"], description: "Kartu debit/kredit/EDC = LAINNYA kecuali tertulis transfer/QRIS" },
  kategori: { type: "string", description: "Pilih satu dari daftar kategori yang diberikan" },
  uraian: { type: "string", description: "Uraian singkat untuk laporan, maks 80 karakter, mis. 'Solar 40 L, oli mesin 2 btl'" },
  barang: { type: "array", description: "Baris barang di nota, termasuk diskon/potongan sebagai baris dengan subtotal NEGATIF dan pajak/service sebagai baris positif bila ditulis terpisah, sehingga jumlah semua subtotal = total dibayar. Kosongkan untuk transfer", items: { type: "object", properties: { nama: { type: "string" }, qty: { type: "string" }, subtotal: { type: "integer" } }, required: ["nama"] } },
  keyakinan: { type: "object", properties: { jenis_dokumen: yakin, arah: yakin, tanggal: yakin, jumlah: yakin, pihak: yakin, kategori: yakin }, required: ["arah", "tanggal", "jumlah"] },
  catatan: { type: "string", description: "Hal yang perlu dicek manusia: tulisan buram, angka dicoret, nota tulisan tangan, dsb." },
}, required: ["jenis_dokumen", "arah", "alasan_arah", "tanggal", "jumlah", "pihak", "metode", "kategori", "uraian", "keyakinan"] } };

function prompt(k: Record<string, string>) {
  return `Anda membaca SATU foto bukti keuangan lapangan proyek eksplorasi nikel PT Terra Grapindo Eco Prima (Indonesia), untuk laporan kas lapangan.
PIHAK KITA (kas lapangan): PT Terra Grapindo Eco Prima / TGEP${k.rekening ? `, rekening/akun "${k.rekening}"` : ""}${k.nama ? `, admin lapangan "${k.nama}"` : ""}.
Tentukan:
1. Jenis dokumen: nota/struk/kuitansi pembelian, bukti transfer bank/m-banking, bukti pembayaran (QRIS, EDC, e-wallet, tagihan), atau lainnya.
2. Arah uang dilihat dari PIHAK KITA: nota/struk pembelian = KELUAR. Bukti transfer/pembayaran: KELUAR bila pengirimnya pihak kita / kita membayar orang lain; MASUK bila penerimanya pihak kita (mis. dana operasional dari kantor, pengembalian kasbon). Bila nama pengirim/penerima tidak cocok dengan pihak kita dan tidak jelas, pilih KELUAR dan beri keyakinan arah "rendah".
3. Angka rupiah: titik ATAU koma bisa menjadi pemisah ribuan (250.000 / 250,000 / 21,700 = dua puluh satu ribu tujuh ratus). "Rp 1.250.000,00" = 1250000. Pada nota, ambil GRAND TOTAL / total yang dibayar setelah diskon, BUKAN subtotal sebelum diskon, "Tunai", "Bayar" atau "Kembali". Pada transfer, ambil nominal transfer; biaya admin dicatat terpisah.
4. Tanggal ke format YYYY-MM-DD (format Indonesia biasanya hari/bulan/tahun). Bila tahun tidak tertulis, pakai ${k.tahun}.
5. Kategori, pilih tepat satu: KELUAR = ${KAT_KELUAR.join(" | ")}; MASUK = ${KAT_MASUK.join(" | ")}.
Jangan menebak angka yang tidak terlihat: isi 0 / kosong dan beri keyakinan "rendah", lalu jelaskan di catatan.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Tidak terautentikasi" }, 401);
    const { data: me } = await admin.from("app_user").select("role,full_name").eq("user_id", u.user.id).maybeSingle();
    if (!me || !["admin", "admin_lapangan"].includes(me.role)) return json({ error: "Hanya admin lapangan / admin" }, 403);
    if (!KEYS.length) { console.error("baca-nota: tidak ada secret NOTA_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY");
      return json({ error: "Pembaca nota belum aktif: kunci AI (ANTHROPIC_API_KEY) belum diisi di Supabase → Edge Functions → Secrets. Isi angka manual dulu.", kode: "KUNCI_KOSONG" }, 500); }
    const b = await req.json();
    const img = String(b?.image_b64 ?? ""), mime = b?.mime === "image/png" ? "image/png" : "image/jpeg";
    if (img.length < 1000) return json({ error: "Gambar kosong" }, 400);
    if (img.length > 6_500_000) return json({ error: "Gambar terlalu besar" }, 413);
    const k = { rekening: String(b?.rekening ?? "").slice(0, 120), nama: me.full_name ?? "", tahun: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 4) };
    const body = JSON.stringify({ model: MODEL, max_tokens: 2000, tools: [TOOL], tool_choice: { type: "tool", name: "isi_laporan" },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: img } }, { type: "text", text: prompt(k) }] }] });
    let r: Response | null = null, t = "", dipakai = "";
    for (const [nama, kunci] of KEYS) {
      r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": kunci, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body });
      dipakai = nama;
      if (r.ok) break;
      t = (await r.text()).slice(0, 400);
      console.error(`baca-nota: ${nama} ${ciri(kunci)} model=${MODEL} → HTTP ${r.status}: ${t}`);
      if (r.status !== 401 && r.status !== 403) break; // hanya kunci ditolak yang dicoba dengan kunci berikutnya
    }
    if (!r!.ok) {
      const st = r!.status, info = { secret: dipakai, status: st, pesan: t.replace(/sk-ant-[\w-]+/g, "sk-ant-…") };
      if (st === 401 || st === 403) return json({ error: `Pembaca nota belum aktif: kunci AI di Supabase ditolak Anthropic (HTTP ${st}). Periksa secret ${KEYS.map(([n]) => n).join(" / ")}. Sementara isi angka manual — foto tetap tersimpan.`, kode: "KUNCI_TIDAK_VALID", info }, 502);
      if (st === 400 && /credit|billing|balance/i.test(t)) return json({ error: "Pembaca nota berhenti: saldo/kredit akun AI habis. Admin perlu mengisi saldo. Sementara isi angka manual.", kode: "KREDIT_HABIS", info }, 502);
      if (st === 404 || (st === 400 && /model/i.test(t))) return json({ error: `Model AI "${MODEL}" tidak tersedia untuk kunci ini — admin perlu mengatur NOTA_MODEL.`, kode: "MODEL", info }, 502);
      if (st === 429 || st === 529) return json({ error: "Layanan baca nota sedang sibuk, coba lagi sebentar atau isi manual.", kode: "SIBUK", info }, 503);
      return json({ error: `Gagal membaca (${st}). Isi angka manual.`, info }, 502);
    }
    const j = await r!.json(), tu = (j.content ?? []).find((c: { type: string }) => c.type === "tool_use");
    if (!tu) return json({ error: "Hasil baca tidak terstruktur" }, 502);
    const o = tu.input ?? {};
    o.keyakinan ??= {};
    const peringatan: string[] = [];
    const kat = o.arah === "MASUK" ? KAT_MASUK : KAT_KELUAR;
    if (!kat.includes(o.kategori)) { o.kategori = "Lain-lain"; o.keyakinan.kategori = "rendah"; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.tanggal ?? "")) { o.tanggal = ""; o.keyakinan.tanggal = "rendah"; }
    else { const hari = (Date.now() - Date.parse(o.tanggal)) / 864e5; if (hari < -2 || hari > 120) { peringatan.push(`Tanggal ${o.tanggal} jauh dari hari ini — periksa.`); o.keyakinan.tanggal = "rendah"; } }
    const items = Array.isArray(o.barang) ? o.barang : [], sum = items.reduce((s: number, x: { subtotal?: number }) => s + (Number(x.subtotal) || 0), 0);
    if (o.jenis_dokumen === "NOTA" && sum > 0 && o.jumlah > 0 && Math.abs(sum - o.jumlah) > Math.max(1000, o.jumlah * 0.01)) {
      peringatan.push(`Jumlah baris barang (${sum.toLocaleString("id-ID")}) ≠ total (${Number(o.jumlah).toLocaleString("id-ID")}) — periksa total, diskon atau PPN.`); o.keyakinan.jumlah = "rendah"; }
    if (!(o.jumlah > 0)) { peringatan.push("Jumlah tidak terbaca — isi manual."); o.keyakinan.jumlah = "rendah"; }
    if (o.biaya_admin > 0) peringatan.push(`Ada biaya admin Rp ${Number(o.biaya_admin).toLocaleString("id-ID")} di luar nominal.`);
    console.log(`baca-nota: OK via ${dipakai}`);
    return json({ ok: true, hasil: o, peringatan, model: MODEL });
  } catch (e) { console.error("baca-nota:", e); return json({ error: String((e as Error).message ?? e) }, 500); }
});
