// process-scan: membaca foto formulir TGEP dua kali secara independen, membandingkan per sel,
// menjalankan aturan validasi + memberi saran perbaikan, lalu menyimpan hasil ke scan_job untuk diperiksa verifier.
// Foto yang tidak dapat dibaca ditolak otomatis (status REJECTED) dengan alasan yang jelas.
// Hemat saldo AI: tiap halaman Form Logging (BHID + nomor halaman) paling banyak BATAS_AI kali dibaca AI. Setelah itu status
// MANUAL: geologist mengisi templat Excel Form Logging dan mengunggahnya bersama foto lembar terbaik dari galeri (sumber EXCEL).
// Kiriman EXCEL tidak memakai AI: isinya langsung divalidasi dengan aturan yang sama lalu diperiksa verifier terhadap fotonya.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"];
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL_A = Deno.env.get("SCAN_MODEL_A") ?? "claude-sonnet-5-5";
const MODEL_B = Deno.env.get("SCAN_MODEL_B") ?? "claude-opus-5-5";
const BATAS_AI = 2;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Kind = "num" | "int" | "code" | "text" | "date";
interface Field { key: string; label: string; kind: Kind; list?: string }
const LOG: Field[] = [
  { key: "seq", label: "NO CONTO", kind: "int" }, { key: "depth_from", label: "FROM (m)", kind: "num" },
  { key: "depth_to", label: "TO (m)", kind: "num" }, { key: "core_length", label: "CORE LENGTH (m)", kind: "num" },
  { key: "lose_from", label: "LOSE FROM", kind: "num" }, { key: "lose_to", label: "LOSE TO", kind: "num" },
  { key: "geozone_id", label: "ZONA", kind: "code", list: "ZONE" },
  { key: "geolithcode_id_1", label: "LITO 1", kind: "code", list: "LITHO" }, { key: "geolithcode_prc_1", label: "% LITO 1", kind: "num" },
  { key: "geolithcode_gs_1", label: "GS 1", kind: "code", list: "GS" },
  { key: "geolithcode_id_2", label: "LITO 2", kind: "code", list: "LITHO" }, { key: "geolithcode_prc_2", label: "% LITO 2", kind: "num" },
  { key: "geolithcode_gs_2", label: "GS 2", kind: "code", list: "GS" },
  { key: "colour", label: "WARNA", kind: "code", list: "COLOUR" }, { key: "rock_prc", label: "ROCK %", kind: "num" },
  { key: "geosrp_id", label: "SERP", kind: "code", list: "SERP" }, { key: "geohrdns_id", label: "HARD", kind: "code", list: "HARDNESS" },
  { key: "geowthrg_id", label: "WTH", kind: "code", list: "WEATHERING" }, { key: "geofrctr_id", label: "FRC", kind: "code", list: "FRACTURE" },
  { key: "total_silica", label: "SIL %", kind: "num" }, { key: "total_garnierit", label: "GAR %", kind: "num" },
  { key: "geomnrlcode_id_1", label: "MIN 1", kind: "code", list: "MINERAL" }, { key: "min_1_prc", label: "% (MIN 1)", kind: "num" },
  { key: "geomnrlcode_id_2", label: "MIN 2", kind: "code", list: "MINERAL" }, { key: "min_2_prc", label: "% (MIN 2)", kind: "num" },
  { key: "geomnrlcode_id_3", label: "MIN 3", kind: "code", list: "MINERAL" }, { key: "min_3_prc", label: "% (MIN 3)", kind: "num" },
  { key: "comment", label: "KOMENTAR", kind: "text" },
];
const DEN: Field[] = [
  { key: "seq", label: "NO CONTO", kind: "int" },
  { key: "len1", label: "PANJANG 1 (cm)", kind: "num" }, { key: "len2", label: "PANJANG 2 (cm)", kind: "num" }, { key: "len3", label: "PANJANG 3 (cm)", kind: "num" },
  { key: "dia1", label: "DIAMETER 1 (cm)", kind: "num" }, { key: "dia2", label: "DIAMETER 2 (cm)", kind: "num" }, { key: "dia3", label: "DIAMETER 3 (cm)", kind: "num" },
  { key: "d_weight_gr", label: "BERAT BASAH conto density (g)", kind: "num" },
  { key: "d_wtr_volume_ml", label: "VOLUME 1 air awal (ml)", kind: "num" },
  { key: "d_volume_measure_ml", label: "VOLUME 2 setelah conto (ml)", kind: "num" },
  { key: "d_dry_weight_gr", label: "BERAT KERING setelah oven (g)", kind: "num" },
  { key: "d_wet_weight", label: "BERAT CONTO 1 m lapangan (kg)", kind: "num" },
  { key: "recheck_weight_kg", label: "TIMBANG ULANG crosscheck (kg)", kind: "num" },
  { key: "comment", label: "KOMENTAR", kind: "text" },
];
const HDR: Field[] = [
  { key: "bhid", label: "BHID", kind: "text" }, { key: "area", label: "AREA", kind: "text" }, { key: "prospect", label: "PROSPEK", kind: "text" },
  { key: "grid", label: "GRID", kind: "text" }, { key: "start_date", label: "TANGGAL MULAI BOR", kind: "date" },
  { key: "stop_date", label: "TANGGAL SELESAI BOR", kind: "date" }, { key: "xgps", label: "X GPS (m)", kind: "num" },
  { key: "ygps", label: "Y GPS (m)", kind: "num" }, { key: "zgps", label: "Z GPS (m)", kind: "num" },
  { key: "rigmc_id", label: "RIG / NO. ALAT BOR", kind: "text" }, { key: "teamleader", label: "KETUA TIM", kind: "text" },
  { key: "operator", label: "OPERATOR", kind: "text" }, { key: "logger", label: "LOGGER", kind: "text" },
  { key: "field_geos", label: "FIELD GEOLOGIST", kind: "text" }, { key: "depth_tp", label: "KEDALAMAN AKHIR TOP SOIL (m)", kind: "num" },
  { key: "depth_l", label: "KEDALAMAN AKHIR LIMONIT (m)", kind: "num" }, { key: "depth_s", label: "KEDALAMAN AKHIR SAPROLIT (m)", kind: "num" },
  { key: "total_depth", label: "TOTAL DEPTH / EOH (m)", kind: "num" }, { key: "total_sample", label: "TOTAL SAMPLE", kind: "int" },
  { key: "water_table", label: "MUKA AIR TANAH (m)", kind: "num" }, { key: "comment", label: "ALASAN STOP BOR / KOMENTAR", kind: "text" },
  { key: "core_size", label: "CORE SIZE (kotak yang dicentang)", kind: "code", list: "CORE_SIZE" },
  { key: "core_barrel_type", label: "BARREL (dicentang)", kind: "code", list: "BARREL" },
  { key: "samptype_id", label: "TIPE CONTO (dicentang: WC/HC/CH)", kind: "code", list: "SAMPTYPE" },
  { key: "drilprpose_id", label: "TUJUAN BOR (dicentang)", kind: "code", list: "PURPOSE" },
  { key: "spacing_id", label: "SPASI (dicentang)", kind: "code", list: "SPACING" },
  { key: "morphology_id", label: "MORFOLOGI (dicentang: FLAT/SLOPE/STEEP)", kind: "code", list: "MORPHOLOGY" },
  { key: "weather_id", label: "CUACA (dicentang: DRY/RAINY/WET/CLOUDY)", kind: "code", list: "WEATHER" },
  { key: "vgtation_id", label: "VEGETASI (dicentang: LUSH/BUSH/RARELY/RECLAMATION)", kind: "code", list: "VEGETATION" },
  { key: "brtype_id", label: "BATUAN DASAR (dicentang)", kind: "code", list: "BRTYPE" },
];
const SHEET_HDR: Field[] = [
  { key: "bhid", label: "BHID", kind: "text" }, { key: "date", label: "TANGGAL", kind: "text" },
  { key: "page", label: "HAL. ke- / dari", kind: "text" }, { key: "logger", label: "LOGGER", kind: "text" },
  { key: "rigmc_id", label: "RIG", kind: "text" }, { key: "xgps", label: "X GPS", kind: "num" },
  { key: "ygps", label: "Y GPS", kind: "num" }, { key: "zgps", label: "Z GPS", kind: "num" },
  { key: "total_depth", label: "EOH (m)", kind: "num" },
  { key: "core_size", label: "CORE SIZE (kotak yang dicentang: HQ/NQ/PQ/HQ3/NQ3/PQ3)", kind: "code", list: "CORE_SIZE" },
];
const SHEET: Field[] = [
  { key: "seq", label: "NO", kind: "int" }, { key: "depth_from", label: "FROM (m)", kind: "num" },
  { key: "depth_to", label: "TO (m)", kind: "num" }, { key: "core_length", label: "CORE L (m)", kind: "num" },
  { key: "lose_from", label: "LOSS DARI", kind: "num" }, { key: "lose_to", label: "LOSS SAMPAI", kind: "num" },
  { key: "geozone_id", label: "ZONA", kind: "code", list: "ZONE" },
  { key: "geolithcode_id_1", label: "LITO 1", kind: "code", list: "LITHO" }, { key: "geolithcode_prc_1", label: "% LITO1", kind: "num" },
  { key: "geolithcode_id_2", label: "LITO 2", kind: "code", list: "LITHO" },
  { key: "colour", label: "WARNA", kind: "code", list: "COLOUR" }, { key: "geohrdns_id", label: "HARD", kind: "code", list: "HARDNESS" },
  { key: "geowthrg_id", label: "WTH", kind: "code", list: "WEATHERING" }, { key: "geosrp_id", label: "SERP", kind: "code", list: "SERP" },
  { key: "total_silica", label: "SIL %", kind: "num" }, { key: "total_garnierit", label: "GAR %", kind: "num" },
  { key: "geomnrlcode_id_1", label: "MIN 1", kind: "code", list: "MINERAL" }, { key: "min_1_prc", label: "% (MIN 1)", kind: "num" },
  { key: "geomnrlcode_id_2", label: "MIN 2", kind: "code", list: "MINERAL" }, { key: "min_2_prc", label: "% (MIN 2)", kind: "num" },
  { key: "d_length_cm", label: "DENS. P (cm)", kind: "num" }, { key: "d_diameter_cm", label: "DENS. D (cm)", kind: "num" },
  { key: "d_weight_gr", label: "BERAT BASAH g", kind: "num" }, { key: "d_volume_measure_ml", label: "ARCHIMEDES VOL 2 (ml)", kind: "num" },
  { key: "d_wet_weight", label: "BERAT CONTO kg", kind: "num" }, { key: "comment", label: "KOMENTAR", kind: "text" },
];
const hdrOf = (form: string) => form === "HEADER" ? HDR : form === "SHEET" ? SHEET_HDR : PAGE_HDR;
const rowsOf = (form: string) => form === "LOG" ? LOG : form === "SHEET" ? SHEET : DEN;
const PAGE_HDR: Field[] = [
  { key: "bhid", label: "BHID", kind: "text" }, { key: "page", label: "HALAMAN (ke- / dari)", kind: "text" },
  { key: "date", label: "TANGGAL", kind: "text" }, { key: "logger", label: "LOGGER / PETUGAS", kind: "text" },
];

function toolFor(form: string) {
  const strObj = (fs: Field[]) => ({
    type: "object",
    properties: Object.fromEntries(fs.map((f) => [f.key, { type: "string", description: f.label }])),
    required: fs.map((f) => f.key),
  });
  if (form === "HEADER") {
    return { name: "submit_form", description: "Kirim transkripsi formulir", input_schema: {
      type: "object", properties: { form_code: { type: "string" }, header: strObj(HDR), notes: { type: "string" } },
      required: ["form_code", "header"] } };
  }
  const rowFields = rowsOf(form);
  return { name: "submit_form", description: "Kirim transkripsi formulir", input_schema: {
    type: "object",
    properties: {
      form_code: { type: "string", description: "Kode di kanan atas, mis. F-BOR" },
      header: strObj(hdrOf(form)),
      rows: { type: "array", description: "Satu objek per baris tabel yang berisi tulisan; lewati baris kosong.",
        items: { ...strObj(rowFields), properties: { row_number: { type: "string", description: "nomor baris tercetak 1–15" }, ...strObj(rowFields).properties } } },
      notes: { type: "string" },
    },
    required: ["form_code", "header", "rows"] } };
}
const COMMON = `Anda mentranskripsikan formulir lapangan eksplorasi nikel laterit PT Terra Grapindo Eco Prima.
ATURAN: tulis PERSIS seperti yang tertulis di kertas, jangan menebak, jangan menghitung, jangan mengisi dari baris lain.
Desimal di kertas memakai koma; salin apa adanya (mis. "0,40"). Sel kosong = "". Tulisan yang tidak terbaca = "?" (boleh sebagian, mis. "1,?5").
Bila ada coretan, ambil nilai pengganti yang ditulis di sampingnya. Kode geologi biasanya 1–3 huruf (mis. TP, RL, YL, ES, RS, PT, KC, Gt).
Bila gambar bukan formulir ini, terpotong, atau terlalu buram, JANGAN mengarang isi: kosongkan isian yang tidak terlihat dan tulis alasannya di notes.`;
function promptA(form: string) {
  return COMMON + (form === "HEADER"
    ? `\nBaca formulir header (F01-HDR) kotak demi kotak dari kiri atas. Untuk pilihan centang, isi dengan teks pilihan yang dicentang (mis. "NQ", "SINGLE", "WC", "REGULAR DRILLING", "25 × 25", "FLAT", "DRY", "BUSH", "PDT").`
    : `\nBaca tabel BARIS DEMI BARIS dari atas ke bawah; untuk tiap baris baca sel dari kiri ke kanan.`);
}
function promptB(form: string) {
  return COMMON + (form === "HEADER"
    ? `\nBaca formulir header dimulai dari bagian pilihan centang di bawah, lalu kotak isian dari kanan bawah ke kiri atas. Untuk pilihan centang isi teks pilihan yang dicentang.`
    : `\nBaca tabel KOLOM DEMI KOLOM: baca seluruh kolom NO CONTO dari atas ke bawah, lalu kolom berikutnya, dst. Setelah selesai, susun hasilnya per baris sesuai nomor baris tercetak.`);
}

async function extract(model: string, prompt: string, form: string, b64: string, mime: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 8000, tools: [toolFor(form)], tool_choice: { type: "tool", name: "submit_form" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
        { type: "text", text: prompt },
      ] }],
    }),
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    if (r.status === 401) throw new Error("Kunci ANTHROPIC_API_KEY di Supabase Edge Function Secrets tidak valid — hubungi admin (bukan kesalahan foto).");
    if (r.status === 400 && /credit|billing|balance/i.test(t)) throw new Error("Saldo kredit AI habis — admin perlu mengisi saldo (bukan kesalahan foto). Foto tetap tersimpan; tekan Proses ulang setelah saldo diisi.");
    if (r.status === 429 || r.status === 529) throw new Error(`Layanan AI sedang sibuk (${r.status}) — tekan Proses ulang beberapa menit lagi.`);
    throw new Error(`Anthropic ${model} ${r.status}: ${t}`);
  }
  const j = await r.json();
  const tu = (j.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!tu) throw new Error(`Model ${model} tidak mengembalikan hasil terstruktur`);
  return tu.input;
}

type Lookup = Record<string, Map<string, string>>;
function norm(raw: unknown, f: Field, lk: Lookup): { v: string | number | null; issue?: string } {
  let s = (raw ?? "").toString().trim();
  if (s === "" || s === "-" || s === "—") return { v: null };
  if (s.includes("?")) return { v: null, issue: "TIDAK TERBACA" };
  if (f.kind === "num" || f.kind === "int") {
    s = s.replace(/\s/g, "").replace(",", ".");
    const n = Number(s);
    if (!isFinite(n)) return { v: null, issue: "BUKAN ANGKA" };
    if (f.kind === "int" && !Number.isInteger(n)) return { v: null, issue: "BUKAN BILANGAN BULAT" };
    return { v: n };
  }
  if (f.kind === "code") {
    const c = lk[f.list!]?.get(s.toUpperCase().replace(/\s+/g, " ").replace("X", "×"));
    const c2 = c ?? lk[f.list!]?.get(s.toUpperCase());
    return c2 ? { v: c2 } : { v: s, issue: "KODE TIDAK BAKU" };
  }
  if (f.kind === "date") {
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return { v: s, issue: "FORMAT TANGGAL" };
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return { v: `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` };
  }
  return { v: f.key === "bhid" ? s.toUpperCase().replace(/\s/g, "") : s };
}
const same = (a: unknown, b: unknown) =>
  (a === null && b === null) || (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b);

interface Flag { row: number | null; field: string; type: string; msg: string; a?: unknown; b?: unknown; saran?: unknown }
// saran kode terdekat (salah tulis/salah baca 1 huruf). Hanya diberikan bila kandidatnya tunggal.
function nearestCode(s: string, list?: Map<string, string>): string | undefined {
  if (!list) return;
  const u = s.toUpperCase().replace(/0/g, "O").replace(/1/g, "L").replace(/5/g, "S").replace(/8/g, "B");
  if (list.has(u)) return list.get(u);
  const lev = (a: string, b: string) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length]; };
  const hits = [...list.entries()].filter(([k]) => lev(u, k) === 1);
  return hits.length === 1 ? hits[0][1] : undefined;
}
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => typeof x === "number"); return v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2) : null; };

function mergeRows(form: string, A: any, B: any, lk: Lookup) {
  const fields = rowsOf(form);
  const flags: Flag[] = [];
  const key = (r: any) => (r.row_number ?? "").toString().trim() || (r.seq ?? "").toString().trim();
  const mapB = new Map<string, any>((B.rows ?? []).map((r: any) => [key(r), r]));
  const keys = new Set<string>([...(A.rows ?? []).map(key), ...mapB.keys()]);
  const rows: any[] = [];
  const mapA = new Map<string, any>((A.rows ?? []).map((r: any) => [key(r), r]));
  for (const k of [...keys].sort((x, y) => Number(x) - Number(y))) {
    const ra = mapA.get(k), rb = mapB.get(k), out: any = { _row: Number(k) || null };
    if (!ra || !rb) flags.push({ row: out._row, field: "*", type: "BEDA", msg: `Baris ${k} hanya terbaca di pembacaan ${ra ? "A" : "B"}` });
    for (const f of fields) {
      const na = norm(ra?.[f.key], f, lk), nb = norm(rb?.[f.key], f, lk);
      out[f.key] = na.v ?? nb.v;
      if (!same(na.v, nb.v) && ra && rb) flags.push({ row: out._row, field: f.key, type: "BEDA", msg: `Pembacaan A "${ra?.[f.key]}" vs B "${rb?.[f.key]}"`, a: ra?.[f.key], b: rb?.[f.key] });
      for (const n of [na, nb]) if (n.issue) {
        const saran = n.issue === "KODE TIDAK BAKU" ? nearestCode(String(n.v), lk[f.list!]) : undefined;
        flags.push({ row: out._row, field: f.key, type: n.issue, msg: `${f.label}: ${n.issue}${saran ? ` — mungkin "${saran}"` : ""}`, saran }); break;
      }
    }
    if (form === "SHEET") {
      if (out.geolithcode_id_2 && typeof out.geolithcode_prc_1 === "number") out.geolithcode_prc_2 = +(100 - out.geolithcode_prc_1).toFixed(1);
      if (typeof out.d_volume_measure_ml === "number") out.d_wtr_volume_ml = 1400;
      if (out.geolithcode_id_1 && !out.geolithcode_id_2 && out.geolithcode_prc_1 == null) out.geolithcode_prc_1 = 100;
    }
    if (form === "DENSITY") {
      out.d_length_cm = avg([out.len1, out.len2, out.len3]);
      out.d_diameter_cm = avg([out.dia1, out.dia2, out.dia3]);
    }
    rows.push(out);
  }
  return { rows, flags };
}

function validate(form: string, header: any, rows: any[], ctx: { prevTo: number | null; prevZone: string | null; params: Record<string, number>; nomDiam: number | null; existingSeq: Set<number> }): Flag[] {
  const P = ctx.params, F: Flag[] = [];
  const add = (row: number | null, field: string, msg: string, saran?: unknown) => F.push({ row, field, type: "ATURAN", msg, ...(saran !== undefined ? { saran } : {}) });
  const rank: Record<string, number> = { TP: 1, L: 2, S: 3, BD: 4, BR: 4 };
  const gps = () => {
    if (typeof header.xgps === "number" && String(Math.trunc(header.xgps)).length !== 6) add(null, "xgps", "X GPS harus 6 digit (UTM easting)");
    if (typeof header.ygps === "number" && String(Math.trunc(header.ygps)).length !== 7) add(null, "ygps", "Y GPS harus 7 digit (UTM northing)");
  };
  if (form === "SHEET") gps();
  if (form === "HEADER") {
    if (header.start_date && header.stop_date && header.stop_date < header.start_date) add(null, "stop_date", "Tanggal selesai lebih awal dari tanggal mulai");
    const d = [header.depth_tp, header.depth_l, header.depth_s, header.total_depth].filter((x) => typeof x === "number");
    for (let i = 1; i < d.length; i++) if (d[i] < d[i - 1]) add(null, "total_depth", "Urutan kedalaman TP ≤ L ≤ S ≤ EOH tidak terpenuhi");
    gps();
    return F;
  }
  let prevTo = ctx.prevTo, prevZone = ctx.prevZone, prevSeq: number | null = null;
  rows.forEach((r, i) => {
    const row = r._row;
    if (typeof r.seq !== "number") { add(row, "seq", "NO CONTO kosong"); return; }
    if (prevSeq !== null && r.seq !== prevSeq + 1) add(row, "seq", `NO CONTO tidak berurutan (${prevSeq} → ${r.seq})`, prevSeq + 1);
    prevSeq = r.seq;
    if (form === "LOG" || form === "SHEET") {
      const run = (r.depth_to ?? NaN) - (r.depth_from ?? NaN);
      if (!(run > 0)) add(row, "depth_to", "TO harus lebih besar dari FROM");
      if (prevTo !== null && typeof r.depth_from === "number" && Math.abs(r.depth_from - prevTo) > 0.005) add(row, "depth_from", `FROM ${r.depth_from} tidak sama dengan TO sebelumnya ${prevTo}`, prevTo);
      if (r.seq === 1 && r.depth_from !== 0) add(row, "depth_from", "Conto pertama harus mulai 0,00 m", 0);
      if (typeof r.core_length === "number" && run > 0 && r.core_length > run * 1.5) {
        const s100 = +(r.core_length / 100).toFixed(2), s10 = +(r.core_length / 10).toFixed(2);
        const sar = s100 <= run * 1.05 && s100 >= run * 0.3 ? s100 : s10 <= run * 1.05 && s10 >= run * 0.3 ? s10 : undefined;
        add(row, "core_length", `CORE LENGTH ${r.core_length} jauh > run ${run.toFixed(2)} — kemungkinan salah satuan/koma`, sar);
      }
      const ZL: Record<string, string[]> = { TP: ["TP"], L: ["FC", "LM", "RL", "YL", "NT", "SB", "TR", "MN"], S: ["ST", "ES", "RS", "SR", "NT", "SB", "TR", "MN"], BD: ["DN", "PT", "HZ", "LH", "SP", "UB", "SR", "PC", "CB", "BS", "GB", "AD", "GR"], BR: ["DN", "PT", "HZ", "LH", "SP", "UB", "PC", "CB", "BS", "GB", "AD", "GR"] };
      if (r.geozone_id && r.geolithcode_id_1 && ZL[r.geozone_id] && !ZL[r.geozone_id].includes(r.geolithcode_id_1)) add(row, "geolithcode_id_1", `LITO 1 ${r.geolithcode_id_1} tidak cocok dengan ZONA ${r.geozone_id}`);
      if (typeof r.core_length === "number" && run > 0) {
        if (r.core_length > run + 0.001 && r.core_length <= run * 1.5 && !/SW/i.test(r.comment ?? "")) add(row, "core_length", "CORE LENGTH > run tanpa komentar SW");
        const lose = (typeof r.lose_from === "number" && typeof r.lose_to === "number") ? r.lose_to - r.lose_from : 0;
        if (run - r.core_length - lose > 0.05) add(row, "lose_from", "Ada core hilang tetapi LOSE FROM/TO kosong atau kurang");
        if (r.core_length / run * 100 < P.REC_MIN) add(row, "core_length", "Recovery < 80%");
      } else if (run > 0) add(row, "core_length", "CORE LENGTH kosong");
      if (typeof r.lose_from === "number" && (r.lose_from < r.depth_from - 0.005 || (r.lose_to ?? 0) > r.depth_to + 0.005)) add(row, "lose_from", "Loss core di luar interval conto");
      if ((r.geolithcode_prc_1 ?? 0) + (r.geolithcode_prc_2 ?? 0) !== 100) add(row, "geolithcode_prc_1", "% LITO 1 + % LITO 2 ≠ 100", !r.geolithcode_id_2 ? 100 : undefined);
      if ((r.min_1_prc ?? 0) + (r.min_2_prc ?? 0) + (r.min_3_prc ?? 0) > 100) add(row, "min_1_prc", "Total % mineral > 100");
      if (r.geolithcode_id_2 && r.geolithcode_prc_2 == null) add(row, "geolithcode_prc_2", "LITO 2 tanpa persen");
      if (run > 0 && run < P.MIN_INT && i < rows.length - 1) add(row, "depth_to", "Interval < 0,30 m (bukan baris terakhir)");
      if (prevZone && r.geozone_id && rank[r.geozone_id] < rank[prevZone] && !r.comment) add(row, "geozone_id", `Zona terbalik (${prevZone} → ${r.geozone_id}) tanpa komentar`);
      prevTo = typeof r.depth_to === "number" ? r.depth_to : prevTo; prevZone = r.geozone_id ?? prevZone;
    }
    if (form === "SHEET" && typeof r.d_length_cm === "number" && (r.d_length_cm < 5 || r.d_length_cm > 15)) add(row, "d_length_cm", "Panjang conto density di luar 5–15 cm");
    if (form === "SHEET" && r.geolithcode_id_2 && r.geolithcode_prc_1 == null) add(row, "geolithcode_prc_1", "Ada LITO 2 tetapi % LITO1 kosong");
    if (form === "DENSITY" || form === "SHEET") {
      if (form === "DENSITY" && !ctx.existingSeq.has(r.seq)) add(row, "seq", "NO CONTO belum ada di data logging (setujui formulir LOG dulu)");
      for (const k of ["len1", "len2", "len3"]) if (typeof r[k] === "number" && (r[k] < 5 || r[k] > 15)) add(row, k, "Panjang di luar 5–15 cm");
      const ls = [r.len1, r.len2, r.len3].filter((x) => typeof x === "number"), ds = [r.dia1, r.dia2, r.dia3].filter((x) => typeof x === "number");
      if (ls.length > 1 && Math.max(...ls) - Math.min(...ls) > 0.5) add(row, "len1", "Tiga ukuran panjang berbeda > 0,5 cm");
      if (ds.length > 1 && Math.max(...ds) - Math.min(...ds) > 0.3) add(row, "dia1", "Tiga ukuran diameter berbeda > 0,3 cm");
      if (ctx.nomDiam && r.d_diameter_cm && r.d_diameter_cm > ctx.nomDiam * (1 + P.DIAM_TOL)) add(row, form === "SHEET" ? "d_diameter_cm" : "dia1", `Diameter ${r.d_diameter_cm} cm > nominal ${ctx.nomDiam} cm (swelling?)`);
      if (form === "SHEET" && typeof r.d_diameter_cm === "number" && r.d_diameter_cm > 20 && r.d_diameter_cm / 10 > 3 && r.d_diameter_cm / 10 < 10) add(row, "d_diameter_cm", `Diameter ${r.d_diameter_cm} terlalu besar — kemungkinan ditulis dalam mm`, +(r.d_diameter_cm / 10).toFixed(2));
      if (typeof r.d_wtr_volume_ml === "number" && r.d_wtr_volume_ml !== P.VOL1) add(row, "d_wtr_volume_ml", "Volume 1 bukan 1.400 ml");
      if (typeof r.d_volume_measure_ml === "number" && typeof r.d_wtr_volume_ml === "number" && r.d_volume_measure_ml <= r.d_wtr_volume_ml) add(row, "d_volume_measure_ml", "Volume 2 harus lebih besar dari Volume 1");
      if (r.d_weight_gr && r.d_length_cm && r.d_diameter_cm) {
        const rho = r.d_weight_gr / (Math.PI / 4 * r.d_diameter_cm ** 2 * r.d_length_cm);
        if (rho < P.RHO_MIN || rho > P.RHO_MAX) add(row, "d_weight_gr", `Density ${rho.toFixed(2)} di luar ${P.RHO_MIN}–${P.RHO_MAX}`);
      }
      if (typeof r.d_volume_measure_ml === "number" && r.d_length_cm && r.d_diameter_cm) {
        const vArch = r.d_volume_measure_ml - (r.d_wtr_volume_ml ?? P.VOL1), vCal = Math.PI / 4 * r.d_diameter_cm ** 2 * r.d_length_cm;
        const tol = P.ARCH_TOL ?? 0.1;
        if (vArch > 0 && Math.abs(vArch - vCal) > vCal * tol) add(row, "d_volume_measure_ml", `Volume Archimedes ${vArch.toFixed(0)} ml vs jangka sorong ${vCal.toFixed(0)} ml (selisih ${((vArch - vCal) / vCal * 100).toFixed(0)}%)`);
      } else if (r.d_weight_gr && form === "SHEET") add(row, "d_volume_measure_ml", "Archimedes (Vol 2) kosong");
      if (typeof r.d_dry_weight_gr === "number" && typeof r.d_weight_gr === "number" && r.d_dry_weight_gr > r.d_weight_gr) add(row, "d_dry_weight_gr", "Berat kering > berat basah");
      if (typeof r.recheck_weight_kg === "number" && typeof r.d_wet_weight === "number" && Math.abs(r.recheck_weight_kg - r.d_wet_weight) > P.W_TOL) add(row, "recheck_weight_kg", "Selisih timbang ulang > 0,05 kg");
    }
  });
  return F;
}

async function run(jobId: string) {
  const { data: job } = await admin.from("scan_job").select("*").eq("id", jobId).single();
  if (!job) return;
  try {
    const manual = job.sumber === "EXCEL";
    let A: any, B: any;
    if (manual) {
      // Form Logging manual: data dari templat Excel (sudah diubah menjadi teks di HP). Tidak memakai AI.
      await admin.from("scan_job").update({ status: "PROCESSING", error: null }).eq("id", jobId);
      A = { form_code: "F-BOR", ...(job.extraction_a ?? {}) }; B = A;
      if (!Array.isArray(A.rows)) throw new Error("Isi Excel tidak terbaca — pakai templat Form Logging dari aplikasi.");
    } else {
      // batas pembacaan AI per halaman (BHID + nomor halaman yang diisi saat mengirim)
      if (job.form_type === "SHEET" && job.bhid_hint) {
        let q = admin.from("scan_job").select("id,status,ai_kali,sumber").eq("form_type", "SHEET").eq("bhid_hint", job.bhid_hint);
        q = job.hal_kirim == null ? q.is("hal_kirim", null) : q.eq("hal_kirim", job.hal_kirim);
        const { data: lain } = await q;
        const hal = job.hal_kirim == null ? "" : ` hal. ${job.hal_kirim}`;
        if ((lain ?? []).some((x: any) => x.id !== job.id && x.status === "APPROVED")) {
          const msg = `Form Logging ${job.bhid_hint}${hal} sudah DISETUJUI sebelumnya — foto ini tidak diproses (tidak memakai saldo AI). Bila ada koreksi, minta verifier mengoreksi data.`;
          await admin.from("scan_job").update({ status: "REJECTED", error: msg, review_note: msg, reviewed_at: new Date().toISOString() }).eq("id", jobId);
          return;
        }
        const dipakai = (lain ?? []).reduce((s: number, x: any) => s + (x.ai_kali ?? 0), 0);
        if (dipakai >= BATAS_AI) {
          const msg = `Batas ${BATAS_AI} kali pembacaan otomatis untuk ${job.bhid_hint}${hal} sudah habis. Isi templat Excel Form Logging (menu Foto formulir → Form Logging manual) lalu unggah bersama foto lembar terbaik dari galeri.`;
          await admin.from("scan_job").update({ status: "MANUAL", error: msg }).eq("id", jobId);
          return;
        }
      }
      await admin.from("scan_job").update({ status: "PROCESSING", error: null }).eq("id", jobId);
      if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY belum diatur di Edge Function Secrets");
      const { data: blob, error: de } = await admin.storage.from("scan-photos").download(job.photo_path);
      if (de || !blob) throw new Error("Foto tidak bisa diunduh: " + de?.message);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const b64 = btoa(bin), mime = blob.type || "image/jpeg";
      [A, B] = await Promise.all([
        extract(MODEL_A, promptA(job.form_type), job.form_type, b64, mime),
        extract(MODEL_B, promptB(job.form_type), job.form_type, b64, mime),
      ]);
      // hanya pembacaan yang berhasil (dan ditagih) yang dihitung
      await admin.from("scan_job").update({ ai_kali: (job.ai_kali ?? 0) + 1 }).eq("id", jobId);
    }

    const { data: lkRows } = await admin.from("lookup_code").select("list_name,code");
    const lk: Lookup = {};
    for (const r of lkRows ?? []) (lk[r.list_name] ??= new Map()).set(r.code.toUpperCase(), r.code);
    const { data: pr } = await admin.from("qc_param").select("name,value");
    const params = Object.fromEntries((pr ?? []).map((p) => [p.name, Number(p.value)]));
    const MODEL_TAG_A = manual ? "EXCEL" : MODEL_A, MODEL_TAG_B = manual ? "EXCEL" : MODEL_B;

    const flags: Flag[] = [];
    const expect = ({ HEADER: "F01-HDR", LOG: "F02-LOG", DENSITY: "F03-DEN", SHEET: "F-BOR" } as Record<string, string>)[job.form_type];
    if (A.form_code && !String(A.form_code).toUpperCase().includes(expect)) flags.push({ row: null, field: "form_code", type: "ATURAN", msg: `Jenis formulir di foto (${A.form_code}) tidak sama dengan pilihan (${expect})` });

    const hdrFields = hdrOf(job.form_type);
    const header: any = {};
    for (const f of hdrFields) {
      const na = norm(A.header?.[f.key], f, lk), nb = norm(B.header?.[f.key], f, lk);
      header[f.key] = na.v ?? nb.v;
      if (!same(na.v, nb.v)) flags.push({ row: null, field: f.key, type: "BEDA", msg: `Pembacaan A "${A.header?.[f.key]}" vs B "${B.header?.[f.key]}"`, a: A.header?.[f.key], b: B.header?.[f.key] });
      if (na.issue) flags.push({ row: null, field: f.key, type: na.issue, msg: `${f.label}: ${na.issue}` });
    }
    if (job.bhid_hint && header.bhid && header.bhid !== job.bhid_hint.toUpperCase()) flags.push({ row: null, field: "bhid", type: "ATURAN", msg: `BHID di ${manual ? "Excel" : "foto"} (${header.bhid}) ≠ BHID yang dipilih di aplikasi (${job.bhid_hint})`, saran: job.bhid_hint.toUpperCase() });
    if (!header.bhid && job.bhid_hint) header.bhid = job.bhid_hint.toUpperCase();

    let rows: any[] = [];
    if (job.form_type !== "HEADER") { const m = mergeRows(job.form_type, A, B, lk); rows = m.rows; flags.push(...m.flags); }

    // ---------- tolak otomatis bila foto tidak dapat dibaca ----------
    const isi = (o: any) => Object.entries(o ?? {}).filter(([k, v]) => k !== "row_number" && String(v ?? "").trim() !== "");
    const cA = [...isi(A.header), ...(A.rows ?? []).flatMap(isi)], cB = [...isi(B.header), ...(B.rows ?? []).flatMap(isi)];
    const nCell = Math.max(cA.length, cB.length), nUnread = [...cA, ...cB].filter(([, v]) => String(v).includes("?")).length;
    const unreadRatio = nUnread / Math.max(1, cA.length + cB.length), nBeda = flags.filter((f) => f.type === "BEDA").length;
    const codeA = String(A.form_code ?? "").toUpperCase().trim(), codeB = String(B.form_code ?? "").toUpperCase().trim();
    const codeOk = codeA.includes(expect) || codeB.includes(expect);
    const nRows = rows.filter((r) => typeof r.seq === "number" || typeof r.depth_from === "number").length;
    const maxUnread = params.SCAN_MAX_UNREAD ?? 0.3, maxBeda = params.SCAN_MAX_BEDA ?? 0.5;
    const alasan: string[] = [];
    if (!codeOk && (codeA || codeB)) alasan.push(`kode formulir di foto "${codeA || codeB}" bukan ${expect} (salah jenis formulir)`);
    if (nCell < 5) alasan.push(manual ? "Excel hampir kosong (pakai templat Form Logging dari aplikasi dan isi tabelnya)" : "hampir tidak ada tulisan yang terbaca (bukan formulir, foto terpotong, atau terlalu buram)");
    else {
      if (job.form_type !== "HEADER" && nRows === 0) alasan.push("tidak ada baris tabel yang terbaca");
      if (nCell >= 10 && unreadRatio > maxUnread) alasan.push(`${Math.round(unreadRatio * 100)}% isian tidak terbaca`);
      if (nCell >= 10 && nBeda / nCell > maxBeda) alasan.push(`dua pembacaan berbeda pada ${Math.round((nBeda / nCell) * 100)}% isian (foto kurang jelas)`);
    }
    if (alasan.length) {
      const msg = manual ? `Ditolak otomatis: ${alasan.join("; ")}. Perbaiki file Excel lalu unggah ulang.`
        : `Ditolak otomatis: ${alasan.join("; ")}. Foto ulang dengan cahaya merata, tegak lurus, seluruh lembar dan keempat kotak hitam di sudut masuk.`;
      await admin.from("scan_job").update({ status: "REJECTED", error: msg, review_note: msg, reviewed_at: new Date().toISOString(),
        extraction_a: A, extraction_b: B, model_a: MODEL_TAG_A, model_b: MODEL_TAG_B }).eq("id", jobId);
      return;
    }

    let prevTo: number | null = null, prevZone: string | null = null, nomDiam: number | null = null;
    const existingSeq = new Set<number>();
    if (header.bhid) {
      const firstSeq = rows.find((r) => typeof r.seq === "number")?.seq;
      if (firstSeq && firstSeq > 1) {
        const { data: p } = await admin.from("sample").select("depth_to,geozone_id").eq("bhid", header.bhid).eq("seq", firstSeq - 1).maybeSingle();
        if (p) { prevTo = Number(p.depth_to); prevZone = p.geozone_id; }
        else if (job.form_type === "LOG" || job.form_type === "SHEET") flags.push({ row: null, field: "seq", type: "ATURAN", msg: `Conto ${firstSeq - 1} (halaman sebelumnya) belum ada di database` });
      }
      const { data: bh } = await admin.from("borehole").select("core_size").eq("bhid", header.bhid).maybeSingle();
      const cz = header.core_size ?? bh?.core_size;
      if (cz) { const { data: cs } = await admin.from("lookup_code").select("extra").eq("list_name", "CORE_SIZE").eq("code", cz).maybeSingle(); nomDiam = cs ? Number(cs.extra) : null; }
      if (job.form_type === "DENSITY") { const { data: ss } = await admin.from("sample").select("seq").eq("bhid", header.bhid); (ss ?? []).forEach((s) => existingSeq.add(s.seq)); }
    } else flags.push({ row: null, field: "bhid", type: "ATURAN", msg: "BHID tidak terbaca" });

    flags.push(...validate(job.form_type, header, rows, { prevTo, prevZone, params, nomDiam, existingSeq }));
    if (manual) flags.push({ row: null, field: "*", type: "ATURAN", msg: "Data dari Excel manual (tanpa pembacaan AI) — cocokkan setiap baris dengan foto lembar sebelum menyetujui." });
    const cell_flags: Record<string, Flag[]> = {};
    for (const f of flags) (cell_flags[`${f.row ?? "h"}.${f.field}`] ??= []).push(f);

    await admin.from("scan_job").update({
      status: "NEEDS_REVIEW", extraction_a: A, extraction_b: B, merged: { header, rows },
      cell_flags, validation: flags, error: null,
      n_disagree: flags.filter((f) => f.type === "BEDA").length,
      n_rule_flags: flags.filter((f) => f.type !== "BEDA").length,
      model_a: MODEL_TAG_A, model_b: MODEL_TAG_B, page_no: parseInt(String(header.page ?? "")) || job.hal_kirim || null,
    }).eq("id", jobId);
  } catch (e) {
    await admin.from("scan_job").update({ status: "ERROR", error: String((e as Error).message ?? e) }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Tidak terautentikasi" }, 401);
    const { job_id } = await req.json();
    const { data: job } = await admin.from("scan_job").select("id,created_by,status").eq("id", job_id).maybeSingle();
    if (!job) return json({ error: "scan_job tidak ditemukan" }, 404);
    const { data: me } = await admin.from("app_user").select("role").eq("user_id", u.user.id).maybeSingle();
    if (!me) return json({ error: "Akun belum terdaftar di app_user" }, 403);
    if (job.created_by !== u.user.id && !["verifier", "admin"].includes(me.role)) return json({ error: "Tidak berhak" }, 403);
    if (job.status === "APPROVED") return json({ error: "Sudah disetujui" }, 409);
    // @ts-ignore EdgeRuntime tersedia di Supabase
    EdgeRuntime.waitUntil(run(job_id));
    return json({ ok: true, status: "PROCESSING" }, 202);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
