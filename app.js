// X-Terra (dulu X-Terra) — aplikasi web untuk HP (bisa dipasang & dipakai offline)
import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const app = $("#app");
let session = null, me = null, tab = localStorage.getItem("tab") || "prog";

// ---------- kolom formulir (harus sama dengan fungsi process-scan) ----------
const LOG = [["seq","No sample"],["depth_from","From"],["depth_to","To"],["core_length","Core L"],["lose_from","Lose F"],["lose_to","Lose T"],["geozone_id","Zona"],
 ["geolithcode_id_1","Lito1"],["geolithcode_prc_1","%1"],["geolithcode_gs_1","GS1"],["geolithcode_id_2","Lito2"],["geolithcode_prc_2","%2"],["geolithcode_gs_2","GS2"],
 ["colour","Warna"],["rock_prc","Rock%"],["geosrp_id","Serp"],["geohrdns_id","Hard"],["geowthrg_id","Wth"],["geofrctr_id","Frc"],["total_silica","Sil%"],["total_garnierit","Gar%"],
 ["geomnrlcode_id_1","Min1"],["min_1_prc","%"],["geomnrlcode_id_2","Min2"],["min_2_prc","%"],["geomnrlcode_id_3","Min3"],["min_3_prc","%"],["comment","Komentar"]];
const DEN = [["seq","No sample"],["len1","P1"],["len2","P2"],["len3","P3"],["dia1","D1"],["dia2","D2"],["dia3","D3"],["d_weight_gr","Berat basah g"],["d_wtr_volume_ml","Vol1 ml"],
 ["d_volume_measure_ml","Arch Vol2 ml"],["d_dry_weight_gr","Berat kering g"],["d_wet_weight","Berat conto kg"],["recheck_weight_kg","Timbang ulang kg"],["comment","Komentar"]];
const HDR = [["bhid","Hole ID"],["area","Area"],["prospect","Prospek"],["grid","Grid"],["start_date","Mulai"],["stop_date","Selesai"],["xgps","X GPS"],["ygps","Y GPS"],["zgps","Z GPS"],
 ["rigmc_id","Rig"],["teamleader","Ketua tim"],["operator","Operator"],["logger","Logger"],["field_geos","Field geos"],["depth_tp","Akhir TP"],["depth_l","Akhir L"],["depth_s","Akhir S"],
 ["total_depth","EOH"],["total_sample","Total sample"],["water_table","Air tanah"],["core_size","Core size"],["core_barrel_type","Barrel"],["samptype_id","Tipe conto"],
 ["drilprpose_id","Tujuan"],["spacing_id","Spasi"],["morphology_id","Morfologi"],["weather_id","Cuaca"],["vgtation_id","Vegetasi"],["brtype_id","Batuan dasar"],["comment","Komentar"]];
const SHEET = [["seq","No sample"],["depth_from","From"],["depth_to","To"],["core_length","Core L"],["lose_from","Loss dari"],["lose_to","Loss sampai"],["geozone_id","Zona"],
 ["geolithcode_id_1","Lito1"],["geolithcode_prc_1","%1"],["geolithcode_id_2","Lito2"],["geolithcode_prc_2","%2 (hitung)"],["colour","Warna"],["geohrdns_id","Hard"],["geowthrg_id","Wth"],["geosrp_id","Serp"],
 ["total_silica","Sil%"],["total_garnierit","Gar%"],["geomnrlcode_id_1","Min1"],["min_1_prc","%"],["geomnrlcode_id_2","Min2"],["min_2_prc","%"],
 ["d_length_cm","P cm"],["d_diameter_cm","D cm"],["d_weight_gr","Basah g"],["d_volume_measure_ml","Arch Vol2 ml"],["d_wet_weight","Conto kg"],["comment","Komentar"]];
const SHDR = [["bhid","Hole ID"],["date","Tanggal"],["page","Hal."],["logger","Logger"],["rigmc_id","Rig"],["xgps","X GPS"],["ygps","Y GPS"],["zgps","Z GPS"],["total_depth","EOH"],["core_size","Core size"]];
const PHDR = [["bhid","Hole ID"],["page","Halaman"],["date","Tanggal"],["logger","Logger/petugas"]];
const FORMS = { SHEET: "Form Logging", HEADER: "F01 Header lubang (lama)", LOG: "F02 Logging (lama)", DENSITY: "F03 Density (lama)" };
const NUMERIC = new Set(["seq","depth_from","depth_to","core_length","lose_from","lose_to","geolithcode_prc_1","geolithcode_prc_2","rock_prc","total_silica","total_garnierit",
 "min_1_prc","min_2_prc","min_3_prc","len1","len2","len3","dia1","dia2","dia3","d_weight_gr","d_wtr_volume_ml","d_volume_measure_ml","d_dry_weight_gr","d_wet_weight",
 "recheck_weight_kg","xgps","ygps","zgps","depth_tp","depth_l","depth_s","total_depth","total_sample","water_table"]);

// ---------- Konfirmasi tulisan Form Logging oleh pengirim (wellsite) ----------
// Kolom berkode → daftar kamus SOP (lookup_code). Harus sama dengan fungsi process-scan.
const KOLOM_KAMUS = { geozone_id: "ZONE", geolithcode_id_1: "LITHO", geolithcode_id_2: "LITHO", geolithcode_gs_1: "GS", geolithcode_gs_2: "GS", colour: "COLOUR", geosrp_id: "SERP",
  geohrdns_id: "HARDNESS", geowthrg_id: "WEATHERING", geofrctr_id: "FRACTURE", geomnrlcode_id_1: "MINERAL", geomnrlcode_id_2: "MINERAL", geomnrlcode_id_3: "MINERAL", core_size: "CORE_SIZE" };
const KET_KOLOM = { seq: "NO SAMPLE (mulai 1 + kode zona, mis. 1L)", depth_from: "FROM (m)", depth_to: "TO (m)", core_length: "Core length (m)", lose_from: "Loss dari (m)", lose_to: "Loss sampai (m)", geozone_id: "Zona",
  geolithcode_id_1: "Litologi 1", geolithcode_prc_1: "% Litologi 1", geolithcode_id_2: "Litologi 2", colour: "Warna", geohrdns_id: "Kekerasan", geowthrg_id: "Pelapukan", geosrp_id: "Serpentinisasi",
  total_silica: "Silika %", total_garnierit: "Garnierit %", geomnrlcode_id_1: "Mineral 1", min_1_prc: "% Mineral 1", geomnrlcode_id_2: "Mineral 2", min_2_prc: "% Mineral 2",
  d_length_cm: "Panjang density (cm)", d_diameter_cm: "Diameter density (cm)", d_weight_gr: "Berat basah (g)", d_volume_measure_ml: "Archimedes Vol 2 (ml)", d_wet_weight: "Berat conto (kg)",
  comment: "Komentar", bhid: "Hole ID", date: "Tanggal", page: "Halaman", logger: "Logger", rigmc_id: "Rig", xgps: "X GPS", ygps: "Y GPS", zgps: "Z GPS", total_depth: "EOH (m)", core_size: "Core size" };
const JENIS_TANYA = new Set(["BEDA", "TIDAK TERBACA", "BUKAN ANGKA", "BUKAN BILANGAN BULAT", "KODE TIDAK BAKU", "FORMAT TANGGAL"]);
let KAMUS = JSON.parse(localStorage.getItem("kamusSOP") || "{}");
async function muatKamus() {
  if (online()) { const { data } = await sb.from("lookup_code").select("list_name,code,name").order("sort"); if (data?.length) { KAMUS = {}; for (const r of data) (KAMUS[r.list_name] ??= []).push({ code: r.code, name: r.name }); localStorage.setItem("kamusSOP", JSON.stringify(KAMUS)); } }
  return KAMUS;
}
// levenshtein() didefinisikan di bagian pencocokan nama (dipakai bersama)
// ubah huruf/angka yang sering tertukar di tulisan tangan (1↔L/I, 0↔O, 5↔S, 8↔B, 2↔Z)
const miripHuruf = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9×]/g, "").replace(/0/g, "O").replace(/1/g, "L").replace(/5/g, "S").replace(/8/g, "B").replace(/2/g, "Z");
// litologi yang sah per zona menurut SOP (sama dengan aturan di process-scan)
const LITO_ZONA = { TP: ["TP"], L: ["FC", "LM", "RL", "YL", "NT", "SB", "TR", "MN"], S: ["ST", "ES", "RS", "SR", "NT", "SB", "TR", "MN"], BD: ["DN", "PT", "HZ", "LH", "SP", "UB", "SR", "PC", "CB", "BS", "GB", "AD", "GR"], BR: ["DN", "PT", "HZ", "LH", "SP", "UB", "PC", "CB", "BS", "GB", "AD", "GR"] };
function kandidatKode(list, bacaan, zona) { const L = KAMUS[list] ?? [], skor = new Map();
  for (const t of bacaan.filter(Boolean)) { const u = String(t).toUpperCase().trim(), m = miripHuruf(t);
    for (const c of L) { const C = c.code.toUpperCase(), d = Math.min(levenshtein(u, C), levenshtein(m, miripHuruf(C))); if (d <= 1 || (C.length > 2 && d <= 2)) skor.set(c.code, Math.min(skor.get(c.code) ?? 9, d)); } }
  const sah = list === "LITHO" && LITO_ZONA[zona] ? LITO_ZONA[zona] : null, bobot = (k, d) => d + (sah && !sah.includes(k) ? 1.5 : 0);
  return [...skor.entries()].sort((a, b) => bobot(a[0], a[1]) - bobot(b[0], b[1])).slice(0, 4).map(([k]) => L.find((c) => c.code === k)); }
const angka = (x) => { const n = Number(String(x ?? "").replace(/\s/g, "").replace(",", ".")); return String(x ?? "").trim() !== "" && Number.isFinite(n) ? n : null; };
function pertanyaanScan(j) {
  const cf = j.cell_flags ?? {}, sudah = j.konfirmasi ?? {}, rows = j.merged?.rows ?? [], hdr = j.merged?.header ?? {};
  return Object.entries(cf).flatMap(([k, fs]) => {
    if (sudah[k]) return []; const [row, field] = [k.slice(0, k.indexOf(".")), k.slice(k.indexOf(".") + 1)];
    if (field === "*" || field === "form_code") return [];
    const baca = fs.filter((f) => JENIS_TANYA.has(f.type)), aturan = fs.filter((f) => f.type === "ATURAN" && f.saran != null);
    if (!baca.length && !aturan.length) return [];
    const r = row === "h" ? null : rows.find((x) => String(x._row) === row), sekarang = row === "h" ? hdr[field] : r?.[field];
    const bacaan = [...new Set(fs.flatMap((f) => [f.a, f.b]).filter((x) => x != null && String(x).trim() !== "").map(String))];
    return [{ k, row, field, label: KET_KOLOM[field] ?? field, list: KOLOM_KAMUS[field], numerik: NUMERIC.has(field), sekarang, bacaan, saran: [...baca, ...aturan].map((f) => f.saran).filter((x) => x != null),
      alasan: [...baca, ...aturan].map((f) => f.msg), zona: r?.geozone_id, konteks: r ? `Baris ${row} · NO ${r.seq ?? "?"} · ${r.depth_from ?? "?"}–${r.depth_to ?? "?"} m${r.geozone_id ? ` · zona ${r.geozone_id}` : ""}` : "Kepala lembar", wajib: baca.length > 0 }];
  }).sort((a, b) => (a.row === "h" ? -1 : Number(a.row)) - (b.row === "h" ? -1 : Number(b.row)));
}
async function konfirmasiModal(jobId) {
  if (document.querySelector("[data-konf]")) return;
  await muatKamus();
  const { data: j, error } = await sb.from("scan_job").select("id,form_type,bhid_hint,photo_path,status,merged,cell_flags,konfirmasi").eq("id", jobId).single();
  if (error || !j) return alert(error?.message ?? "Scan tidak ditemukan");
  const Q = pertanyaanScan(j); if (!Q.length) return toast("Tidak ada tulisan yang perlu dikonfirmasi.");
  const { data: url } = await sb.storage.from("scan-photos").createSignedUrl(j.photo_path, 3600);
  const jawab = {}; let i = 0;
  const m = modal(`<div data-konf><h3>Konfirmasi tulisan · ${esc(FORMS[j.form_type] ?? j.form_type)} ${esc(j.bhid_hint ?? "")}</h3>
    <p class="muted" style="margin:0 0 6px">Ada <b>${Q.length}</b> tulisan yang kurang jelas dibaca. Lihat foto, lalu pilih nilai yang benar. Pilihan kode diambil dari kamus SOP.</p>
    <div style="position:relative;overflow:auto;max-height:34vh;border-radius:10px;background:#000"><img id="kfImg" src="${url?.signedUrl ?? ""}" style="width:100%;display:block;transform-origin:0 0"></div>
    <div class="row" style="align-items:center;margin:4px 0"><span class="muted" style="flex:0;white-space:nowrap">Perbesar</span><input id="kfZm" type="range" min="1" max="4" step=".25" value="1"></div>
    <div id="kfQ"></div><div id="kfE" class="err"></div></div>`);
  m.querySelector("#kfZm").oninput = (e) => (m.querySelector("#kfImg").style.width = `${100 * e.target.value}%`);
  const tampil = () => {
    const q = Q[i], box = m.querySelector("#kfQ"), pilihan = [];
    const tambah = (v, ket) => { if (v == null || v === "") return; const key = q.numerik ? angka(v) : String(v).toUpperCase().trim(); if (key == null || pilihan.some((p) => p.v === key)) return; pilihan.push({ v: key, ket }); };
    for (const s2 of q.saran) tambah(s2, "saran aturan/kamus");
    if (q.list) { for (const b of q.bacaan) { const c = (KAMUS[q.list] ?? []).find((x) => x.code.toUpperCase() === String(b).toUpperCase().trim()); if (c) tambah(c.code, c.name); }
      for (const c of kandidatKode(q.list, q.bacaan, q.zona)) tambah(c.code, c.name + (q.list === "LITHO" && LITO_ZONA[q.zona] && !LITO_ZONA[q.zona].includes(c.code) ? ` · tidak lazim di zona ${q.zona}` : "")); }
    else for (const b of q.bacaan) tambah(b, "terbaca");
    if (q.sekarang != null && q.sekarang !== "") tambah(q.sekarang, "hasil sementara");
    const nm = (v) => (q.list ? (KAMUS[q.list] ?? []).find((c) => c.code === v)?.name : null);
    box.innerHTML = `<div style="border:1px solid #e3e8e1;border-radius:12px;padding:10px 12px;margin-top:6px">
      <div class="row" style="align-items:center"><b style="flex:1">Pertanyaan ${i + 1} dari ${Q.length}</b><span class="pill ${q.wajib ? "NEEDS_REVIEW" : "APPROVED"}" style="flex:0">${q.wajib ? "tulisan tidak jelas" : "cek aturan"}</span></div>
      <p style="margin:6px 0 2px">${esc(q.konteks)} · kolom <b>${esc(q.label)}</b></p>
      <p class="muted" style="margin:0 0 6px">${q.bacaan.length ? `Terbaca: ${q.bacaan.map((b) => `<b>"${esc(b)}"</b>`).join(" atau ")}. ` : ""}${esc(q.alasan.join(" · "))}</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${pilihan.map((p) => `<button class="sec" data-v="${esc(p.v)}" style="flex:0 0 auto;width:auto;padding:8px 12px;${jawab[q.k]?.nilai === p.v ? "background:#12251E;color:#fff" : ""}">${esc(p.v)}${p.ket ? `<small style="display:block;font-weight:400">${esc(nm(p.v) ?? p.ket)}</small>` : ""}</button>`).join("")}</div>
      <label style="margin-top:8px">Atau tulis yang benar${q.list ? " (pilih dari kamus SOP)" : ""}</label>
      <input id="kfIn" ${q.numerik ? 'inputmode="decimal"' : ""} ${q.list ? 'list="kfDl" autocapitalize="characters"' : ""} value="${esc(jawab[q.k] && !jawab[q.k].tidak_tahu ? jawab[q.k].nilai : "")}">
      ${q.list ? `<datalist id="kfDl">${(KAMUS[q.list] ?? []).map((c) => `<option value="${esc(c.code)}">${esc(c.name ?? "")}</option>`).join("")}</datalist><p class="muted" style="margin:4px 0 0;font-size:12px">Kamus ${esc(q.list)}: ${(KAMUS[q.list] ?? []).slice(0, 14).map((c) => `${esc(c.code)} = ${esc(c.name ?? "")}`).join(" · ")}${(KAMUS[q.list] ?? []).length > 14 ? " …" : ""}</p>` : ""}
      <button class="sec" id="kfTT" style="margin-top:8px;${jawab[q.k]?.tidak_tahu ? "background:#FFF1C2" : ""}">Saya juga tidak yakin — serahkan ke verifier</button>
      <div class="row" style="margin-top:10px"><button class="sec" id="kfPrev" ${i === 0 ? "disabled" : ""}>← Sebelumnya</button>${i < Q.length - 1 ? `<button id="kfNext">Berikutnya →</button>` : `<button id="kfSave">Simpan ${Object.keys(jawab).length || ""} jawaban</button>`}</div>
      <button class="sec" id="kfLater" style="margin-top:6px">Nanti saja</button></div>`;
    const set = (v) => { m.querySelector("#kfE").textContent = ""; jawab[q.k] = { row: q.row, field: q.field, nilai: v, terbaca: q.bacaan }; };
    box.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { set(q.numerik ? angka(b.dataset.v) : b.dataset.v); tampil(); }));
    box.querySelector("#kfTT").onclick = () => { jawab[q.k] = { row: q.row, field: q.field, tidak_tahu: true, terbaca: q.bacaan }; tampil(); };
    const ambilInput = () => { const t = box.querySelector("#kfIn").value.trim(); if (!t) return true;
      if (q.numerik) { const n = angka(t); if (n == null) { m.querySelector("#kfE").textContent = "Isi angka (desimal boleh pakai koma)."; return false; } set(n); return true; }
      const v = t.toUpperCase(); if (q.list && !(KAMUS[q.list] ?? []).some((c) => c.code.toUpperCase() === v) && !confirm(`"${v}" tidak ada di kamus SOP ${q.list}. Tetap pakai?`)) return false; set(q.list ? ((KAMUS[q.list] ?? []).find((c) => c.code.toUpperCase() === v)?.code ?? v) : t); return true; };
    box.querySelector("#kfPrev").onclick = () => { if (ambilInput()) { i--; tampil(); } };
    box.querySelector("#kfNext")?.addEventListener("click", () => { if (!ambilInput()) return; if (!jawab[q.k] && q.wajib && !confirm("Pertanyaan ini belum dijawab. Lewati?")) return; i++; tampil(); });
    box.querySelector("#kfLater").onclick = () => m.remove();
    box.querySelector("#kfSave")?.addEventListener("click", async () => {
      if (!ambilInput()) return; const L = Object.values(jawab); if (!L.length) return (m.querySelector("#kfE").textContent = "Belum ada jawaban.");
      const { error: e2 } = await sb.rpc("konfirmasi_scan", { p_job: j.id, p_jawaban: L });
      if (e2) return (m.querySelector("#kfE").textContent = e2.message);
      m.remove(); toast(`✓ ${L.length} jawaban tersimpan — verifier akan melihatnya`); if (tab === "foto") render();
    });
  };
  tampil();
}
// pantau scan yang baru dikirim; begitu selesai dibaca, langsung minta konfirmasi bila ada tulisan tidak jelas
function tandaiScan(id) { const L = JSON.parse(localStorage.getItem("scanTunggu") || "[]"); L.push({ id, t: Date.now() }); localStorage.setItem("scanTunggu", JSON.stringify(L)); }
async function pantauScan() {
  let L = JSON.parse(localStorage.getItem("scanTunggu") || "[]").filter((x) => Date.now() - x.t < 45 * 60e3); if (!L.length || !online()) return localStorage.setItem("scanTunggu", JSON.stringify(L));
  const { data } = await sb.from("scan_job").select("id,status,bhid_hint,error,merged,cell_flags,konfirmasi").in("id", L.map((x) => x.id));
  for (const j of data ?? []) {
    if (["UPLOADED", "PROCESSING"].includes(j.status)) continue;
    L = L.filter((x) => x.id !== j.id);
    if (j.status === "REJECTED") { toast(`Form Logging ${j.bhid_hint ?? ""} ditolak otomatis — lihat Kiriman saya`); continue; }
    if (j.status === "NEEDS_REVIEW") { const n = pertanyaanScan(j).length; if (n) { toast(`❓ ${n} tulisan di Form Logging ${j.bhid_hint ?? ""} perlu Anda konfirmasi`); konfirmasiModal(j.id); } }
  }
  localStorage.setItem("scanTunggu", JSON.stringify(L));
}
setInterval(() => pantauScan().catch(() => {}), 15e3);

// ---------- antrean offline (IndexedDB) ----------
const db = await new Promise((res, rej) => {
  const r = indexedDB.open("tgep-scan", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("queue", { keyPath: "client_uuid" });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const q = (mode, fn) => new Promise((res, rej) => { const t = db.transaction("queue", mode); const s = t.objectStore("queue"); const r = fn(s); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); });
const qAll = () => q("readonly", (s) => s.getAll());
const qPut = (x) => q("readwrite", (s) => s.put({ antre_at: Date.now(), ...x })); // antre_at: kapan pertama masuk antrean
const qDel = (k) => q("readwrite", (s) => s.delete(k));

// ---------- notifikasi singkat ----------
function toast(t) { const el = Object.assign(document.createElement("div"), { textContent: t }); el.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:70;background:#12251E;color:#fff;padding:9px 14px;border-radius:10px;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.3)"; document.body.appendChild(el); setTimeout(() => el.remove(), 3500); }
// ---------- Kamera ditutup paksa oleh HP ----------
// Di sebagian HP Android (memori kecil), browser ditutup saat aplikasi kamera terbuka; setelah memotret, halaman dimuat ulang dan
// foto hilang tanpa pesan. Catat saat kamera dibuka; bila halaman dimuat ulang sebelum foto diterima, beri tahu dan arahkan ke galeri.
document.addEventListener("click", (e) => { const t = e.target; if (t?.matches?.('input[type="file"][capture]')) try { localStorage.setItem("kameraDibuka", String(Date.now())); } catch {} }, true);
document.addEventListener("change", (e) => { if (e.target?.matches?.('input[type="file"]')) try { localStorage.removeItem("kameraDibuka"); } catch {} }, true);
// Kamera dibatalkan / kembali tanpa muat ulang: halaman masih hidup, jadi tanda dihapus.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(() => { try { localStorage.removeItem("kameraDibuka"); } catch {} }, 1500); });
setTimeout(() => { let t = 0; try { t = Number(localStorage.getItem("kameraDibuka")) || 0; localStorage.removeItem("kameraDibuka"); } catch {}
  if (!t || Date.now() - t > 15 * 60e3) return;
  const m = modal(`<h3 style="margin-top:0">📷 Foto tadi tidak sampai ke aplikasi</h3>
    <p>HP menutup aplikasi X-Terra saat kamera terbuka (biasa terjadi bila memori HP penuh), sehingga foto tidak tersimpan di aplikasi.</p>
    <p><b>Cara aman:</b> potret dengan <b>aplikasi Kamera HP biasa</b>, lalu masukkan dari galeri:</p>
    <ul style="margin:4px 0 8px 18px;padding:0"><li><b>Progres bor</b> → centang <b>🖼️ Ambil foto dari galeri</b>, lalu tekan tombol kegiatannya</li>
    <li><b>Foto formulir</b> → <b>🖼️ Unggah foto / PDF</b></li><li><b>Foto core</b> → <b>🖼️ Dari galeri</b></li></ul>
    <p class="muted">Tutup aplikasi lain yang tidak dipakai agar kamera dalam aplikasi lebih jarang terputus.</p><button id="kmOk">Mengerti</button>`);
  m.querySelector("#kmOk").onclick = () => m.remove(); }, 2500);
// ---------- pratinjau foto: "Pakai foto ini" atau "Foto ulang" ----------
function pratinjauFoto(file, judul = "Periksa foto") {
  return new Promise((res) => {
    let url = URL.createObjectURL(file), cur = file;
    const m = modal(`<h3>${esc(judul)}</h3><img id="pvImg" src="${url}" style="width:100%;max-height:60vh;object-fit:contain;border-radius:10px;background:#000">
      <p class="muted" style="margin:6px 0">Pastikan foto jelas, tidak buram, dan objeknya terlihat utuh.</p>
      <div class="row"><button id="pvOk">✓ Pakai foto ini</button><button class="sec" id="pvUl">📷 Foto ulang</button></div><button class="sec" id="pvX" style="margin-top:6px">Batal</button>
      <input id="pvIn" type="file" accept="image/*" capture="environment" class="hide">`);
    const tutup = (v) => { URL.revokeObjectURL(url); m.remove(); res(v); };
    m.querySelector("#pvOk").onclick = () => tutup(cur);
    m.querySelector("#pvX").onclick = () => tutup(null);
    m.querySelector("#pvUl").onclick = () => m.querySelector("#pvIn").click();
    m.querySelector("#pvIn").onchange = (ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (!f) return; URL.revokeObjectURL(url); cur = f; url = URL.createObjectURL(f); m.querySelector("#pvImg").src = url; };
  });
}
// ---------- jaringan ----------
function netBadge() { const n = $("#net"); n.textContent = navigator.onLine ? "online" : "offline"; n.className = navigator.onLine ? "" : "off"; }
addEventListener("online", () => { netBadge(); sync(); }); addEventListener("offline", netBadge); netBadge();
// Kirim otomatis: saat sinyal kembali (online), saat aplikasi dibuka lagi, dan dicoba ulang tiap 2 menit selama antrean belum kosong
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
setInterval(async () => { if (db && (await qAll()).length) sync(); }, 120e3);
setInterval(() => cekAntreLama(), 60e3);
async function cekAntreLama() {
  if (!db) return; const L = await qAll(), lama = L.filter((x) => Date.now() - (x.antre_at ?? Date.now()) > 3600e3);
  let el = document.getElementById("antreLama");
  if (!L.length) { el?.remove(); return; }
  if (!el) { el = Object.assign(document.createElement("div"), { id: "antreLama" }); document.querySelector("body > header")?.after(el) ?? document.body.prepend(el); }
  // Ringkas, di atas (di bawah header, tidak melayang) agar tidak menutupi tombol Kirim/Simpan di bawah maupun menu tab
  el.style.cssText = `position:static;margin:6px 8px 0;padding:4px 8px;border-radius:8px;font-size:12px;line-height:1.3;box-shadow:0 1px 4px rgba(0,0,0,.2);display:flex;gap:6px;align-items:center;color:#222`;
  const err = L.find((x) => x.error)?.error;
  el.style.background = lama.length ? "#F6C9C3" : "#FFE58A";
  const info = `${!navigator.onLine ? "HP sedang offline. " : ""}Terkirim otomatis begitu ada sinyal.${err ? `<br>Galat terakhir: ${esc(err)}<br>Data yang gagal bisa dihapus lewat tombol <b>Lihat</b>.` : ""}`;
  el.innerHTML = `<details style="flex:1;min-width:0"><summary style="cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lama.length ? `⚠ <b>${lama.length}</b> antre &gt;1 jam` : `⏳ <b>${L.length}</b> antre`}${err ? " · ada galat" : ""}</summary><div style="font-size:11px;margin-top:2px">${info}</div></details><button style="flex:0;white-space:nowrap;padding:3px 8px;font-size:12px;min-height:0" id="antreKirim">Kirim</button><button class="sec" style="flex:0;white-space:nowrap;padding:3px 8px;font-size:12px;min-height:0" id="antreLihat">Lihat</button>`;
  el.querySelector("#antreKirim").onclick = async () => { el.querySelector("#antreKirim").textContent = "…"; await sync(); cekAntreLama(); };
  el.querySelector("#antreLihat").onclick = () => antreanModal();
}
// Daftar semua data di antrean HP: kirim ulang atau hapus item yang galat permanen (DDR, Form Logging, progres, foto, dll.)
const JENIS_ANTRE = { ddr: "DDR", event: "Progres bor", p2h: "P2H", marking: "Marking", core: "Foto core", arsip: "Arsip foto", keu: "Keuangan", keubukti: "Bukti keuangan", absl: "Absensi tim" };
const ringkasAntre = (x) => { const r = x.row ?? {};
  if (x.kind === "ddr") return `${r.rig ?? ""} · ${r.report_date ?? ""} · ${r.shift === "MALAM" ? "Night" : "Day"} · ${r.bhid ?? ""} · TTD ${x.signs?.length ?? 0}`;
  if (x.kind === "event") return `${EV[r.event_type] ?? r.event_type ?? ""} · ${r.rig ?? ""} ${r.bhid ?? ""}${r.depth_to != null ? ` · ${r.depth_from ?? ""}–${r.depth_to} m` : ""}`;
  if (x.kind === "core") return `${x.bhid ?? ""} · kotak ${x.box_no ?? "?"} · ${x.depth_from ?? ""}–${x.depth_to ?? ""} m`;
  if (!x.kind) return `${FORMS?.[x.form_type] ?? "Form Logging"} · ${x.bhid ?? ""}${x.page_no ? ` · hal. ${x.page_no}` : ""}`;
  return `${r.rig ?? r.bhid ?? r.keterangan ?? ""}`; };
async function antreanModal() {
  const L = (await qAll()).sort((a, b) => (a.antre_at ?? 0) - (b.antre_at ?? 0));
  const m = modal(`<h3 style="margin-top:0">Antrean data di HP (${L.length})</h3>
    <p class="muted" style="margin-top:0">Data di sini belum sampai di server. Yang galat terus (mis. data ganda, sudah ditandatangani, isian ditolak server) bisa dihapus dari antrean — <b>data itu hilang dari HP</b>, jadi pastikan sudah dikirim ulang lewat cara lain atau memang tidak dipakai.</p>
    <ul class="list">${L.map((x) => `<li style="flex-wrap:wrap"><span class="pill ${x.error ? "REJECTED" : "ANTRE"}">${esc(x.kind ? JENIS_ANTRE[x.kind] ?? x.kind : "Form Logging")}</span><span style="flex:1;min-width:180px">${esc(ringkasAntre(x))}<br><span class="muted">antre sejak ${x.antre_at ? fmtT(new Date(x.antre_at)) : "-"}</span>${x.error ? `<br><span class="err">${esc(x.error)}</span>` : ""}</span><button class="danger" data-hq="${esc(x.client_uuid)}" style="flex:0">Hapus dari antrean</button></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul>
    <div class="row"><button class="sec" id="aqT">Tutup</button><button id="aqK">Kirim ulang semua</button></div>`);
  m.querySelector("#aqT").onclick = () => m.remove();
  m.querySelector("#aqK").onclick = async () => { m.querySelector("#aqK").textContent = "Mengirim…"; await sync(); m.remove(); antreanModal(); cekAntreLama(); };
  m.querySelectorAll("[data-hq]").forEach((b) => (b.onclick = async () => {
    const it = L.find((x) => x.client_uuid === b.dataset.hq); if (!it) return;
    if (!confirm(`Hapus dari antrean?\n${it.kind ? JENIS_ANTRE[it.kind] ?? it.kind : "Form Logging"}: ${ringkasAntre(it)}\n\nData ini BELUM terkirim dan akan hilang dari HP.${it.kind === "ddr" ? " Tanda tangan di DDR ini ikut hilang." : ""}`)) return;
    if (it.kind === "core") { const H = JSON.parse(localStorage.getItem("coreHist") || "{}"), k = `${it.photo_type}|${it.bhid}`;
      if (H[k] && H[k].box === it.box_no) { H[k] = { box: Math.max(0, (it.box_no ?? 1) - 1), to: Number(it.depth_from) || 0 }; localStorage.setItem("coreHist", JSON.stringify(H)); } }
    await qDel(it.client_uuid); m.remove(); antreanModal(); cekAntreLama(); if (typeof render === "function") render(); }));
}
const APP_VERSION = "2026-11-27.41";
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const cek = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && navigator.onLine && cek());
    setInterval(() => navigator.onLine && cek(), 30 * 60e3);
  });
  let hadCtrl = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadCtrl) { hadCtrl = true; return; }
    if (document.getElementById("updBar")) return;
    const b = document.createElement("div"); b.id = "updBar";
    b.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:70;background:#12251E;color:#fff;padding:12px 14px;border-radius:12px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.3)";
    b.innerHTML = `<span style="flex:1">Versi baru aplikasi sudah tersedia. Data yang belum terkirim tetap aman di HP.</span><button style="flex:0;white-space:nowrap">Muat ulang</button>`;
    b.querySelector("button").onclick = () => location.reload(); document.body.appendChild(b);
  });
}

// ---------- foto: perkecil sebelum disimpan ----------
async function shrink(file, max = 2400) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
}

// ---------- sinkronisasi ----------
let syncing = false;
async function sync() {
  if (syncing || !navigator.onLine || !session || session.offline) return;
  syncing = true; const n0 = (await qAll()).length;
  try {
    for (const it of await qAll()) {
      if (it.kind === "core") { await syncCore(it); continue; }
      if (it.kind === "event" || it.kind === "p2h") { await syncProg(it); continue; }
      if (it.kind === "ddr") { await syncDDR(it); continue; }
      if (it.kind === "keu") { await syncKeu(it); continue; }
      if (it.kind === "keubukti") { await syncKeuBukti(it); continue; }
      if (it.kind === "absl") { await syncAbsl(it); continue; }
      if (it.kind === "arsip") { await syncArsip(it); continue; }
      if (it.kind === "marking") { const r = await sb.from("marking").upsert(it.row, { onConflict: "client_uuid", ignoreDuplicates: true });
        if (r.error) { it.error = r.error.message; await qPut(it); } else await qDel(it.client_uuid); continue; }
      const path = `${session.user.id}/${it.client_uuid}.jpg`;
      const up = await sb.storage.from("scan-photos").upload(path, it.blob, { contentType: "image/jpeg", upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) { it.error = up.error.message; await qPut(it); continue; }
      let excel_path = null;
      if (it.sumber === "EXCEL" && it.excel) { excel_path = `${session.user.id}/${it.client_uuid}.xlsx`;
        const ux = await sb.storage.from("scan-photos").upload(excel_path, it.excel, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false });
        if (ux.error && !/exists|Duplicate/i.test(ux.error.message)) { it.error = ux.error.message; await qPut(it); continue; } }
      const ins = await sb.from("scan_job").upsert({ client_uuid: it.client_uuid, form_type: it.form_type, bhid_hint: it.bhid, photo_path: path, captured_at: it.captured_at, sumber: it.sumber ?? null, file_name: it.file_name ?? null,
        hal_kirim: it.hal_kirim ?? null, page_no: it.page_no ?? null, ...(it.sumber === "EXCEL" ? { excel_path, extraction_a: it.extraction_a } : {}) },
        { onConflict: "client_uuid", ignoreDuplicates: true });
      if (ins.error) { it.error = ins.error.message; await qPut(it); continue; }
      const { data: job } = await sb.from("scan_job").select("id").eq("client_uuid", it.client_uuid).single();
      if (job) { await sb.functions.invoke("process-scan", { body: { job_id: job.id } }); tandaiScan(job.id); }
      await qDel(it.client_uuid);
    }
  } finally { syncing = false; const n1 = (await qAll()).length; if (n0 > n1) toast(`✓ ${n0 - n1} data terkirim${n1 ? ` · ${n1} masih antre` : ""}`); cekAntreLama(); beat(true); loadLanjutan(); jadwalCekTolak(); if (["foto", "core", "prog", "ddr", "keu", "absl"].includes(tab)) render(); }
}
async function syncCore(it) {
  const base = `${session.user.id}/${it.bhid}/${it.client_uuid}`;
  for (const [p, b] of [[`${base}.jpg`, it.blob], [`${base}_preview.jpg`, it.preview]]) {
    const up = await sb.storage.from("core-photos").upload(p, b, { contentType: "image/jpeg", upsert: false });
    if (up.error && !/exists|Duplicate/i.test(up.error.message)) { it.error = up.error.message; await qPut(it); return; }
  }
  const ins = await sb.from("core_photo").upsert({ client_uuid: it.client_uuid, bhid: it.bhid, box_no: it.box_no, depth_from: it.depth_from, depth_to: it.depth_to,
    photo_type: it.photo_type, file_name: it.file_name, photo_path: `${base}.jpg`, preview_path: `${base}_preview.jpg`, local_check: it.local_check, captured_at: it.captured_at },
    { onConflict: "client_uuid", ignoreDuplicates: true });
  if (ins.error) { it.error = ins.error.message; await qPut(it); return; }
  const { data: row } = await sb.from("core_photo").select("id").eq("client_uuid", it.client_uuid).single();
  if (row) await sb.functions.invoke("check-core-photo", { body: { photo_id: row.id } });
  await qDel(it.client_uuid);
}

// ---------- tampilan ----------
const LABEL_PERAN = { driller: "Driller", geologist: "Wellsite geologist", verifier: "Verifier", admin: "General admin", client: "Client", admin_lapangan: "Admin lapangan" };
// nama akun yang sedang masuk, di kiri kepala aplikasi (semua peran)
function tampilAkun() {
  const el = document.getElementById("akun"); if (!el) return;
  if (!session) { el.style.display = "none"; el.innerHTML = ""; return; }
  const nama = me?.full_name || session.user?.email || "", inisial = nama.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
  const sub = [(me?.is_owner ? "Owner" : null) ?? LABEL_PERAN[me?.role] ?? (me ? me.role : "menunggu persetujuan"), myTugas?.project && me?.role !== "admin" ? myTugas.project : ""].filter(Boolean).join(" · ");
  el.innerHTML = `<span class="av">${esc(inisial)}</span><span class="nm">${esc(nama)}<small>${esc(sub)}</small></span>`; el.title = `Masuk sebagai ${nama}${session.user?.email && session.user.email !== nama ? ` (${session.user.email})` : ""}`; el.style.display = "";
}
async function render() {
  tampilAkun();
  document.body.style.overflow = ""; if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); // keluar dari layar penuh peta saat pindah menu
  if (!session) return loginView();
  if (!me) {
    app.innerHTML = `<div class="card"><h2>Menunggu persetujuan admin</h2><p>Akun <b>${esc(session.user.email)}</b> sudah terdaftar, tetapi belum disetujui admin TGEP. Coba masuk lagi setelah admin menyetujui.</p><p id="rq" class="muted"></p><button class="sec" id="out">Keluar</button></div>`;
    $("#out").onclick = () => { localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); sb.auth.signOut(); };
    sb.from("registration_request").select("status,decision_note,created_at").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
      if (data) $("#rq").textContent = data.status === "REJECTED" ? `Pendaftaran ditolak${data.decision_note ? ": " + data.decision_note : ""}.` : `Status: ${data.status === "PENDING" ? "menunggu" : data.status} · didaftarkan ${new Date(data.created_at).toLocaleString("id-ID")}`;
    });
    return;
  }
  if (online() && !sessionStorage.getItem("tugasLoaded")) { sessionStorage.setItem("tugasLoaded", "1"); await loadTugas(); tampilAkun(); loadLanjutan(); }
  setTimeout(() => cekZonaBaru(), 1500);
  if (me?.role === "admin_lapangan" && !myTugas?.project) { app.innerHTML = `<div class="card"><h2>Belum ada proyek</h2><p>Akun admin lapangan ini belum ditetapkan ke proyek. Minta admin menetapkan proyek di menu Pengguna, lalu buka ulang aplikasi.</p><button class="sec" id="out">Keluar</button></div>`;
    $("#out").onclick = () => { localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); sb.auth.signOut(); }; return; }
  if (!["client", "admin", "verifier", "admin_lapangan"].includes(me?.role) && (!myTugas || myTugas.pilih_rig) && !sessionStorage.getItem("proyekOk")) return pilihProyekView(false);
  const R = me?.role, staff = ["geologist", "verifier", "admin"].includes(R), ver = ["verifier", "admin"].includes(R);
  const navs = R === "admin_lapangan" ? [["keu", "Keuangan"], ["absl", "Absensi tim"], ["peta", "Peta"], ["dok", "Dokumen"]] : R === "client" ? [["dash", "Dashboard"], ["klien", "Laporan rig"], ["simpan", "Data tersimpan"], ["db", "Database"], ["fk", "Foto & scan"], ["peta", "Peta"], ["dok", "Dokumen"]] : [["prog", "Progres bor"], ["ddr", "DDR"], ["foto", "Foto formulir"], ...(staff ? [["core", "Foto core"], ["sampel", "Kirim sample"], ["ba", "BA & BASTP"]] : []),
    ...(ver ? [["review", "Periksa scan"]] : []), ...(staff ? [["data", "Data & cek"], ["db", "Database"]] : []), ...(ver ? [["dash", "Dashboard"], ["rekap", "Rekap operator"]] : []), ["simpan", "Data tersimpan"], ["peta", "Peta"], ...(R === "admin" ? [["keu", "Keuangan"], ["absl", "Absensi tim"], ["users", "Pengguna"]] : []), ["dok", "Dokumen"], ["ttd", "TTD saya"]];
  if (!navs.some(([k]) => k === tab)) tab = navs[0][0];
  // Tombol 📖 Panduan di kepala aplikasi: membuka panduan sesuai peran akun ini (PDF di menu Dokumen juga)
  const PANDUAN = { driller: "driller", geologist: "geologist", verifier: "verifier", admin: "admin", client: "client", admin_lapangan: "admin_lapangan" };
  let pandu = document.getElementById("pandu");
  if (PANDUAN[R]) { if (!pandu) { pandu = Object.assign(document.createElement("a"), { id: "pandu", target: "_blank", rel: "noopener", textContent: "📖 Panduan", title: "Panduan penggunaan untuk peran Anda" });
      pandu.style.cssText = "color:#fff;text-decoration:none;font-size:13px;margin-right:10px;white-space:nowrap"; document.getElementById("net")?.before(pandu); }
    pandu.href = `dokumen/panduan/Panduan_X-Terra_${PANDUAN[R]}.pdf`; } else pandu?.remove();
  const banner = session.offline ? `<div class="card" style="background:#FBE6D0">Mode offline — foto disimpan di HP dan dikirim otomatis saat ada sinyal.</div>` : "";
  beat();
  if (location.hash.startsWith("#buka=")) { const [b, ...p] = decodeURIComponent(location.hash.slice(6)).split(":"); return bukaLinkView(b, p.join(":")); }
  app.innerHTML = banner + `<nav>${navs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}<button class="sec" id="out" style="flex:0">Keluar</button></nav><div id="v"></div><p class="muted" style="text-align:center;font-size:12px;margin:18px 0">${myTugas ? `Proyek <b>${esc(myTugas.nama)}</b> · ${esc(myTugas.rig ?? "semua rig")}${me?.role === "client" ? "" : ` · <a href="#" id="gantiP">${myTugas.pilih_rig ? "ganti rig" : "penugasan"}</a>`} · ` : ["client", "admin", "verifier"].includes(me?.role) ? "" : `<a href="#" id="gantiP">belum ada penugasan</a> · `}X-Terra · versi ${APP_VERSION}</p>`;
  $("#gantiP")?.addEventListener("click", (e) => { e.preventDefault(); pilihProyekView(false); });
  if (!sessionStorage.getItem("tolakCek")) { sessionStorage.setItem("tolakCek", "1"); cekPenolakan(true); }
  app.querySelectorAll("nav [data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; localStorage.setItem("tab", tab); render(); }));
  $("#out").onclick = async () => { if (!confirm("Keluar dari akun? Foto di antrean tetap tersimpan di HP.")) return; localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); session = null; await sb.auth.signOut().catch(() => {}); render(); };
  if (me?.role === "admin" && navigator.onLine && !session.offline) sb.from("registration_request").select("user_id", { count: "exact", head: true }).eq("status", "PENDING")
    .then(({ count }) => { const b = app.querySelector('nav [data-t="users"]'); if (b && count) b.textContent = `Pengguna (${count} baru)`; });
  document.querySelector("main").style.maxWidth = tab === "db" || tab === "dash" || tab === "rekap" || tab === "klien" || tab === "peta" ? "none" : "";
  if (tab === "foto") return fotoView($("#v"));
  if (tab === "review") return reviewList($("#v"));
  if (tab === "data") return dataView($("#v"));
  if (tab === "sampel") return sampelView($("#v"));
  if (tab === "ba") return baView($("#v"));
  if (tab === "core") return coreView($("#v"));
  if (tab === "db") return dbView($("#v"));
  if (tab === "prog") return progView($("#v"));
  if (tab === "users") return usersView($("#v"));
  if (tab === "ddr") return ddrView($("#v"));
  if (tab === "ttd") return ttdView($("#v"));
  if (tab === "dok") return dokView($("#v"));
  if (tab === "simpan") return simpanView($("#v"));
  if (tab === "rekap") return rekapView($("#v"));
  if (tab === "dash") return dashView($("#v"));
  if (tab === "klien") return klienView($("#v"));
  if (tab === "fk") return fotoKlienView($("#v"));
  if (tab === "peta") return petaView($("#v"));
  if (tab === "keu") return isKeu() ? keuView($("#v")) : null;
  if (tab === "absl") return isKeu() ? abslView($("#v")) : null;
}

async function bukaLinkView(bucket, path) {
  app.innerHTML = `<div class="card"><h2>Membuka file…</h2><p class="muted">${esc(path)}</p><div id="bf"></div><div style="margin-top:10px"><button class="sec" id="bk">Kembali ke aplikasi</button></div></div>`;
  $("#bk").onclick = () => { history.replaceState(null, "", location.pathname + location.search); render(); };
  if (!online()) return ($("#bf").innerHTML = `<p class="err">Perlu sinyal untuk membuka file.</p>`);
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) { const dv = await linkDrive(bucket, path);
    return ($("#bf").innerHTML = dv ? `<p>File asli sudah dipindah ke Google Drive.</p><p><a href="${esc(dv)}" target="_blank" rel="noopener"><b>Buka di Google Drive</b></a></p>` : `<p class="err">File tidak bisa dibuka: ${esc(error?.message ?? "tidak ditemukan / akun ini tidak punya akses")}</p>`); }
  const { data: dv } = isClient() ? { data: null } : await sb.from("drive_file").select("drive_url").eq("bucket", bucket).eq("path", path).maybeSingle();
  if (dv?.drive_url) $("#bf").insertAdjacentHTML("beforebegin", `<p><a href="${esc(dv.drive_url)}" target="_blank" rel="noopener"><b>Buka di Google Drive</b></a></p>`);
  const gambar = /\.(jpe?g|png|webp|gif)$/i.test(path);
  $("#bf").innerHTML = `${gambar ? `<img src="${data.signedUrl}" style="max-width:100%;border-radius:8px;margin:6px 0">` : ""}<p><a href="${data.signedUrl}" target="_blank" rel="noopener">Buka / unduh file asli</a> <span class="muted">(link unduhan berlaku 1 jam)</span></p>`;
}
function loginView() {
  const qp = new URLSearchParams(location.search);
  const dicabut = localStorage.getItem("aksesDicabut");
  const after = dicabut ? `<div class="card" style="background:#F6C9C3"><b>Akun Anda sudah ${esc(dicabut)} oleh admin.</b> Semua akses dan data aplikasi di HP ini sudah ditutup. Untuk memakai aplikasi lagi, <a href="daftar.html">daftar ulang</a> lalu tunggu persetujuan admin.</div>` : qp.get("daftar") === "ok" ? `<div class="card" style="background:#DCEFE4"><b>Pendaftaran terkirim.</b> Akun Anda menunggu persetujuan admin TGEP. Setelah disetujui, masuk dengan email dan kata sandi yang Anda buat.</div>` : "";
  app.innerHTML = after + `<div class="card"><h2>Masuk</h2><p class="muted">Akun dibuat oleh admin. Setelah sekali masuk, aplikasi tetap bisa memotret saat offline.</p>
  <label>Email</label><input id="em" type="email" autocomplete="username"><label>Kata sandi</label><input id="pw" type="password" autocomplete="current-password">
  <div style="margin-top:12px"><button id="go">Masuk</button></div><div id="e" class="err"></div>
  <p style="margin-top:10px"><a href="#" id="lupa">Lupa kata sandi?</a></p>
  <p class="muted" style="margin-top:12px">Belum punya akun? <a href="daftar.html">Daftar di sini</a> — akun aktif setelah disetujui admin.</p></div>`;
  if (qp.get("email")) $("#em").value = qp.get("email");
  $("#go").onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) $("#e").innerHTML = /banned/i.test(error.message) ? "Akun ini sudah dinonaktifkan admin. Untuk memakai aplikasi lagi, hubungi admin agar pendaftaran Anda ditinjau ulang." : /invalid login/i.test(error.message) ? `Email atau kata sandi salah. <a href="#" id="lupa2">Lupa kata sandi?</a> Bila akun Anda sudah dihapus admin, daftar ulang lewat tautan di bawah.` : esc(error.message);
    else localStorage.removeItem("aksesDicabut");
    const l2 = $("#lupa2"); if (l2) l2.onclick = (e) => { e.preventDefault(); lupaSandi($("#em").value.trim()); };
  };
  $("#pw").onkeydown = (e) => { if (e.key === "Enter") $("#go").click(); };
  $("#lupa").onclick = (e) => { e.preventDefault(); lupaSandi($("#em").value.trim()); };
}
// Lupa kata sandi: kirim link reset ke email (bila layanan email aktif) + catat permintaan agar admin bisa membuat kata sandi sementara
function lupaSandi(emailAwal = "") {
  const m = modal(`<h3>Lupa kata sandi</h3>
    <p class="muted">Masukkan email akun Anda. Aplikasi mengirim link untuk membuat kata sandi baru ke email itu, dan admin juga menerima permintaan Anda.</p>
    <label>Email</label><input id="lse" type="email" value="${esc(emailAwal)}" autocomplete="username">
    <p class="err" id="lsx"></p><div id="lso"></div>
    <div class="row"><button class="sec" id="lsb">Tutup</button><button id="lsk">Kirim</button></div>`);
  m.querySelector("#lsb").onclick = () => m.remove();
  m.querySelector("#lsk").onclick = async () => {
    const em = m.querySelector("#lse").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return (m.querySelector("#lsx").textContent = "Isi email yang benar.");
    if (!navigator.onLine) return (m.querySelector("#lsx").textContent = "Butuh sinyal untuk meminta reset kata sandi.");
    m.querySelector("#lsk").disabled = true; m.querySelector("#lsx").textContent = "";
    try { await sb.rpc("minta_reset_password", { p_email: em }); } catch {}
    const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    m.querySelector("#lso").innerHTML = `<div class="card" style="background:#DCEFE4;margin:8px 0"><b>Permintaan terkirim.</b><br>
      1. Bila email terdaftar, link <b>buat kata sandi baru</b> dikirim ke <b>${esc(em)}</b>. Buka link itu di HP ini (cek juga folder Spam/Promosi).<br>
      2. Bila dalam 10 menit tidak ada email${error ? ` <span class="muted">(layanan email: ${esc(error.message)})</span>` : ""}, hubungi admin. Admin sudah melihat permintaan Anda dan bisa memberi <b>kata sandi sementara</b>; setelah masuk, Anda diminta membuat kata sandi baru.</div>`;
    m.querySelector("#lsk").textContent = "Kirim ulang"; m.querySelector("#lsk").disabled = false;
  };
}
// Buat kata sandi baru: setelah membuka link reset email, atau setelah masuk dengan kata sandi sementara dari admin
function buatSandiBaru(alasan) {
  if (document.getElementById("sbBaru")) return;
  const m = modal(`<div id="sbBaru"><h3>Buat kata sandi baru</h3><p class="muted">${esc(alasan)}</p>
    <label>Kata sandi baru (min. 8 karakter)</label><input id="sb1" type="password" autocomplete="new-password">
    <label>Ulangi kata sandi baru</label><input id="sb2" type="password" autocomplete="new-password">
    <p class="err" id="sbx"></p><div class="row"><button id="sbk">Simpan kata sandi</button></div></div>`);
  m.querySelector("#sbk").onclick = async () => {
    const a = m.querySelector("#sb1").value, b = m.querySelector("#sb2").value, x = m.querySelector("#sbx");
    if (a.length < 8) return (x.textContent = "Minimal 8 karakter.");
    if (a !== b) return (x.textContent = "Kedua isian tidak sama.");
    m.querySelector("#sbk").disabled = true;
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { x.textContent = /same|different/i.test(error.message) ? "Kata sandi baru harus berbeda dari yang lama." : error.message; m.querySelector("#sbk").disabled = false; return; }
    try { await sb.rpc("selesai_ganti_password"); } catch {}
    if (me) { me.wajib_ganti_pw = false; localStorage.setItem("me", JSON.stringify(me)); }
    m.remove(); toast?.("Kata sandi baru tersimpan.");
  };
}

const ARSIP = { DDR: "DDR kertas", P2H: "P2H kertas", DRILL_LOG_LAMA: "Drill log lama", SURVEY: "Survey / koordinat", LAINNYA: "Formulir lain" };
async function pdfToJpegs(file, onProg) {
  const pdfjs = await import("./vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", location.href).href;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise, out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProg?.(i, doc.numPages);
    const pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 }), sc = Math.min(4, 2400 / Math.max(v1.width, v1.height));
    const vp = pg.getViewport({ scale: sc }), cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: cx, viewport: vp }).promise;
    out.push(await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.88)));
  }
  return out;
}
// ---------- Form Logging manual (Excel): templat dan pembacaan ----------
// Baris kunci tersembunyi (nama kolom database) membuat pembacaan tetap benar walau label diubah.
const LOG_XL_HDR = [["bhid", "BHID"], ["date", "TANGGAL (dd/mm/yyyy)"], ["page", "HAL. ke- / dari"], ["logger", "LOGGER"], ["rigmc_id", "RIG"], ["xgps", "X GPS (6 digit)"], ["ygps", "Y GPS (7 digit)"], ["zgps", "Z GPS"], ["total_depth", "EOH (m)"], ["core_size", "CORE SIZE (NQ/HQ)"]];
const LOG_XL_ROW = SHEET.filter(([k]) => k !== "geolithcode_prc_2");
const LOG_XL_LABEL = { seq: "NO SAMPLE", depth_from: "FROM (m)", depth_to: "TO (m)", core_length: "CORE L (m)", lose_from: "LOSS DARI", lose_to: "LOSS SAMPAI", geozone_id: "ZONA", geolithcode_id_1: "LITO 1", geolithcode_prc_1: "% LITO1",
  geolithcode_id_2: "LITO 2", colour: "WARNA", geohrdns_id: "HARD", geowthrg_id: "WTH", geosrp_id: "SERP", total_silica: "SIL %", total_garnierit: "GAR %", geomnrlcode_id_1: "MIN 1", min_1_prc: "% MIN1",
  geomnrlcode_id_2: "MIN 2", min_2_prc: "% MIN2", d_length_cm: "DENS. P (cm)", d_diameter_cm: "DENS. D (cm)", d_weight_gr: "BERAT BASAH g", d_volume_measure_ml: "ARCHIMEDES VOL 2 (ml)", d_wet_weight: "BERAT CONTO kg", comment: "KOMENTAR" };
async function templatLogging(bhid, hal) {
  await muatKamus();
  await muatJS("vendor/exceljs.min.js", () => window.ExcelJS); const EJ = window.ExcelJS, wb = new EJ.Workbook(); wb.creator = "X-Terra";
  const ws = wb.addWorksheet("Form Logging", { views: [{ state: "frozen", ySplit: 7 }] }), wk = wb.addWorksheet("Kode");
  const hijau = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12251E" } }, putih = { color: { argb: "FFFFFFFF" }, bold: true };
  ws.getCell("A1").value = `FORM LOGGING F-BOR — isian manual · ${bhid} hal. ${hal}`; ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getRow(2).values = LOG_XL_HDR.map(([k]) => k); ws.getRow(2).hidden = true;
  ws.getRow(3).values = LOG_XL_HDR.map(([, t]) => t); ws.getRow(3).eachCell((c) => { c.fill = hijau; c.font = putih; });
  ws.getRow(4).values = LOG_XL_HDR.map(([k]) => k === "bhid" ? bhid : k === "page" ? `${hal} / ` : "");
  ws.getRow(4).eachCell({ includeEmpty: true }, (c) => { c.numFmt = "@"; c.border = { bottom: { style: "thin" } }; });
  ws.getCell("A5").value = "Desimal pakai koma (0,40). Satu nilai per sel. Sel yang tidak berlaku dikosongkan. Kode harus dari daftar (pilih di panah sel). % LITO2 dan density dihitung sistem."; ws.getCell("A5").font = { italic: true, size: 9 };
  ws.getRow(6).values = LOG_XL_ROW.map(([k]) => k); ws.getRow(6).hidden = true;
  ws.getRow(7).values = LOG_XL_ROW.map(([k]) => LOG_XL_LABEL[k] ?? k); ws.getRow(7).eachCell((c) => { c.fill = hijau; c.font = putih; c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" }; }); ws.getRow(7).height = 30;
  const daftar = {}; let kol = 1;
  for (const [nama, list] of Object.entries(KAMUS)) { const kodes = list.map((x) => x.code); if (!kodes.length) continue;
    wk.getCell(1, kol).value = nama; wk.getCell(1, kol).font = { bold: true }; kodes.forEach((c, i) => { wk.getCell(i + 2, kol).value = c; wk.getCell(i + 2, kol + 1).value = list[i].name ?? ""; });
    const L = wk.getColumn(kol).letter; daftar[nama] = `Kode!$${L}$2:$${L}$${kodes.length + 1}`; kol += 3; }
  for (let r = 8; r < 8 + 15; r++) {
    LOG_XL_ROW.forEach(([k], i) => { const c = ws.getCell(r, i + 1); c.numFmt = "@"; c.border = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
      const kam = KOLOM_KAMUS[k]; if (kam && daftar[kam]) c.dataValidation = { type: "list", allowBlank: true, formulae: [daftar[kam]], showErrorMessage: true, errorTitle: "Kode tidak baku", error: "Pilih kode dari daftar SOP" }; });
  }
  LOG_XL_ROW.forEach(([k], i) => (ws.getColumn(i + 1).width = k === "comment" ? 26 : 9));
  const cs = KAMUS.CORE_SIZE?.length ? daftar.CORE_SIZE : null; if (cs) ws.getCell(4, 10).dataValidation = { type: "list", allowBlank: true, formulae: [cs] };
  const buf = await wb.xlsx.writeBuffer(), a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `Form_Logging_${bhid.replace(/\s+/g, "_")}_hal${hal}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function bacaExcelLogging(file) {
  await muatJS("vendor/exceljs.min.js", () => window.ExcelJS); const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet("Form Logging") ?? wb.worksheets[0]; if (!ws) throw new Error("sheet Form Logging tidak ada");
  const txt = (v) => String(v ?? "").trim(), aoa = [];
  // angka yang diketik sebagai bilangan (bukan teks) ditulis dengan koma desimal agar sama dengan kertas
  const nilai = (c) => { const v = c.value; if (v == null) return ""; if (typeof v === "number") return String(v).replace(".", ",");
    if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`; return c.text ?? String(v); };
  for (let r = 1; r <= ws.rowCount; r++) { const row = ws.getRow(r), arr = []; for (let c = 1; c <= Math.max(ws.columnCount, 30); c++) arr.push(nilai(row.getCell(c))); aoa.push(arr); }
  const iH = aoa.findIndex((r) => txt(r[0]) === "bhid"), iR = aoa.findIndex((r) => txt(r[0]) === "seq");
  if (iH < 0 || iR < 0) throw new Error("bukan templat Form Logging dari aplikasi (baris kunci tidak ditemukan) — unduh templat lewat tombol ⬇ Templat Excel");
  const kH = aoa[iH].map(txt), kR = aoa[iR].map(txt), header = {}, rows = [];
  const nilaiH = aoa.slice(iH + 1).find((r) => r.some((c) => txt(c) && !LOG_XL_HDR.some(([, t]) => t === txt(c)))) ?? [];
  kH.forEach((k, i) => { if (k) header[k] = txt(nilaiH[i]); });
  aoa.slice(iR + 1).forEach((r) => { if (Object.values(LOG_XL_LABEL).includes(txt(r[0])) || txt(r[0]) === "NO") return; // "NO" = label templat lama if (!r.some((c) => txt(c))) return;
    const o = { row_number: String(rows.length + 1) }; kR.forEach((k, i) => { if (k) o[k] = txt(r[i]); });
    if (o.seq) { const m = o.seq.replace(/\s/g, "").match(/^(\d+)([A-Za-z]{1,3})$/); if (m) { o.seq = m[1]; if (!o.geozone_id) o.geozone_id = m[2].toUpperCase(); } } // NO SAMPLE "6S" → 6 (+ zona S)
    rows.push(o); });
  return { form_code: "F-BOR", header, rows: rows.slice(0, 15), notes: `Excel manual: ${file.name}` };
}

async function fotoView(v) {
  const staff = isStaff(), last = JSON.parse(localStorage.getItem("fotoLast") || "{}");
  const queue = (await qAll()).filter((x) => !x.kind || x.kind === "arsip");
  const jenisOpt = (staff ? `<option value="SHEET">Form Logging — logging geologi + density (dibaca otomatis)</option>` : "") + Object.entries(ARSIP).map(([k, t]) => `<option value="${k}">${t} (arsip foto, tidak dibaca otomatis)</option>`).join("");
  v.innerHTML = `<div class="card"><h2>Foto / unggah formulir</h2>
   <label>Ini formulir apa? *</label><select id="jn">${jenisOpt}</select>
   <div class="row"><div><label>Hole ID <span id="bhReq">*</span></label><input id="bh" data-bhid value="${esc(localStorage.getItem("bhid") || "")}" placeholder="mis. DH-NPG 01" autocapitalize="characters"></div><div><label>Rig</label>${rigField()}</div></div>
   <div class="row" id="halRow"><div><label>Halaman ke- * <span class="muted">(sesuai HAL. di lembar)</span></label><input id="hl" inputmode="numeric" placeholder="1" value="${esc(localStorage.getItem("halLog") || "")}"></div></div>
   <div class="row" id="tglRow"><div><label>Tanggal formulir</label><input id="tg" type="date" value="${todayWIB()}"></div><div><label>Shift</label><select id="sh"><option value="">—</option><option value="PAGI">Day</option><option value="MALAM">Night</option></select></div></div>
   <label>Keterangan</label><input id="kt" placeholder="mis. DDR Rig 04 shift malam, hal. 1–2" value="">
   <p class="muted" id="tip"></p>
   <div class="big"><button id="bCam">📷 Ambil foto<small>kamera HP</small></button><button id="bUp" class="sec">🖼️ Unggah foto / PDF<small>galeri, CamScanner, file scan (bisa banyak)</small></button></div>
   <input id="fCam" type="file" accept="image/*" capture="environment" class="hide"><input id="fUp" type="file" accept="image/*,application/pdf,.pdf" multiple class="hide">
   <div id="manBox" style="margin-top:10px;padding:10px;border-radius:10px;background:#F3F5F2"><b>Form Logging manual</b>
     <p class="muted" style="margin:4px 0 6px">Setiap halaman hanya <b>2 kali</b> dibaca otomatis (hemat saldo AI). Bila 2 foto tetap gagal/ditolak: unduh templat Excel, isi sesuai lembar, lalu kirim Excel bersama <b>foto lembar terbaik dari galeri</b> (bukan foto baru). Verifier memeriksa Excel terhadap foto itu.</p>
     <div class="row"><button class="sec" id="tplX">⬇ Templat Excel</button><button class="sec" id="manX">📄 Kirim Excel + foto galeri</button></div>
     <input id="fX" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hide"><input id="fXg" type="file" accept="image/*" class="hide"></div>
   <div id="pr" class="muted"></div><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean di HP (${queue.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${queue.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.kind === "arsip" ? ARSIP[x.row.jenis] : FORMS[x.form_type])} · ${esc(x.bhid || x.row?.bhid || x.row?.rig || "")}${(x.page_no || x.row?.halaman) ? ` · hal. ${x.page_no || x.row.halaman}` : ""} · ${esc(x.sumber || x.row?.sumber || "")}<br><span class="muted">${new Date(x.captured_at || x.row.captured_at).toLocaleString("id-ID")}${x.error ? " · gagal: " + esc(x.error) : ""}</span></span>${x.error || !EV[x.row?.event_type] && x.kind === "event" ? `<button class="sec" data-qdel="${esc(x.client_uuid)}" title="Hapus dari antrean" style="flex:0;padding:4px 10px">🗑</button>` : ""}</li>`).join("") || `<li class="muted">Kosong — semua foto sudah terkirim.</li>`}</ul></div>
   <div class="card"><h3>${["verifier", "admin"].includes(me?.role) ? "Form Logging (semua pengirim) & kiriman saya" : "Kiriman saya"}</h3>${["verifier", "admin"].includes(me?.role) ? `<p class="muted" style="margin-top:0">✏️ Edit = buka tabel isian + foto. Simpan langsung masuk database conto (yang sudah disetujui pun bisa diubah; tiap perubahan tercatat di Riwayat koreksi).</p>` : ""}<ul class="list" id="mine"><li class="muted">Memuat…</li></ul></div>`;
  v.querySelectorAll("[data-qdel]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus data ini dari antrean HP? Data yang gagal tidak akan pernah terkirim; setelah dihapus, ambil/unggah ulang fotonya.")) return;
    await qDel(b.dataset.qdel); b.closest("li").remove(); cekAntreLama(); toast("Data dihapus dari antrean");
  }));
  if (last.jenis && $("#jn").querySelector(`option[value="${last.jenis}"]`)) $("#jn").value = last.jenis;
  const upd = () => { const j = $("#jn").value, fb = j === "SHEET"; $("#bhReq").style.display = fb ? "" : "none"; $("#tglRow").style.display = fb ? "none" : ""; $("#halRow").style.display = fb ? "" : "none"; $("#manBox").style.display = fb ? "" : "none";
    $("#tip").textContent = fb ? "Form Logging: letakkan di permukaan datar, cahaya merata, keempat kotak hitam di sudut harus masuk. Hasil CamScanner boleh, asal tidak terpotong dan tidak tertutup tanda air." : "Arsip: foto/scan disimpan apa adanya sebagai bukti; isinya tidak dibaca otomatis. DDR tetap wajib diisi di menu DDR."; };
  $("#jn").onchange = upd; upd();
  const meta = () => {
    const jenis = $("#jn").value, bhid = bakuBH($("#bh").value), rig = $("#rg").value.trim().toUpperCase();
    if (jenis === "SHEET" && !bhid) { $("#e").textContent = "Isi Hole ID dulu."; return null; }
    const hal = parseInt($("#hl").value);
    if (jenis === "SHEET" && !(hal > 0)) { $("#e").textContent = "Isi nomor halaman Form Logging (HAL. ke- di lembar)."; return null; }
    if (hal > 0) localStorage.setItem("halLog", String(hal));
    if (jenis !== "SHEET" && !bhid && !rig) { $("#e").textContent = "Isi Hole ID atau Rig supaya arsip bisa dicari."; return null; }
    $("#e").textContent = ""; if (bhid) localStorage.setItem("bhid", bhid); if (rig) localStorage.setItem("rig", rig); localStorage.setItem("fotoLast", JSON.stringify({ jenis }));
    return { jenis, bhid, rig, hal: hal > 0 ? hal : null, tanggal: $("#tg").value || null, shift: $("#sh").value || null, keterangan: $("#kt").value.trim() || null };
  };
  const cekLogging = async (blob, nama) => {
    try { const bmp = await createImageBitmap(blob), lc = await localCheck(bmp); const why = [];
      if (lc.sharpness < 25) why.push("terlalu buram"); if (lc.brightness < 45) why.push("terlalu gelap"); /* batas resolusi dibuka sementara (24/11) */
      if (why.length) { $("#e").textContent = `Ditolak sebelum dikirim${nama ? " (" + nama + ")" : ""}: ${why.join(", ")}. Foto ulang dengan cahaya merata dan HP tidak bergoyang.`; return false; }
    } catch { /* format tidak dikenali browser: biarkan server yang memeriksa */ }
    return true;
  };
  const put = async (m, blob, sumber, file_name, halaman, jumlah, captured_at) => {
    const client_uuid = crypto.randomUUID();
    if (m.jenis === "SHEET" && !(await cekLogging(blob, file_name))) return false;
    if (m.jenis === "SHEET") return qPut({ client_uuid, form_type: "SHEET", bhid: m.bhid, hal_kirim: (m.hal ?? 1) + Math.max(0, (halaman ?? 1) - 1), page_no: (m.hal ?? 1) + Math.max(0, (halaman ?? 1) - 1), blob, captured_at, sumber, file_name });
    return qPut({ kind: "arsip", client_uuid, blob, row: { client_uuid, jenis: m.jenis, rig: m.rig || null, bhid: m.bhid || null, tanggal: m.tanggal, shift: m.shift, keterangan: m.keterangan, halaman, jumlah_halaman: jumlah, sumber, file_name, captured_at } });
  };
  $("#bCam").onclick = () => meta() && $("#fCam").click();
  $("#bUp").onclick = () => meta() && $("#fUp").click();
  $("#fCam").onchange = async (ev) => { const f0 = ev.target.files[0], m = meta(); ev.target.value = ""; if (!f0 || !m) return; const f = await pratinjauFoto(f0, "Foto formulir"); if (!f) return; const ok = await put(m, await shrink(f), "KAMERA", null, null, null, new Date().toISOString()); ev.target.value = ""; if (ok === false) return; render(); sync(); };
  $("#fUp").onchange = async (ev) => {
    const fs = [...ev.target.files], m = meta(); if (!fs.length || !m) return;
    let n = 0;
    try {
      for (const f of fs) {
        if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          const pages = await pdfToJpegs(f, (i, t) => ($("#pr").textContent = `Membaca ${f.name}: halaman ${i}/${t}…`));
          for (let i = 0; i < pages.length; i++) { if ((await put(m, pages[i], "PDF", `${f.name} hal. ${i + 1}`, i + 1, pages.length, new Date(f.lastModified || Date.now()).toISOString())) !== false) n++; }
        } else { $("#pr").textContent = `Menyiapkan ${f.name}…`; if ((await put(m, await shrink(f), "GALERI", f.name, fs.length > 1 ? fs.indexOf(f) + 1 : null, fs.length > 1 ? fs.length : null, new Date(f.lastModified || Date.now()).toISOString())) !== false) n++; }
      }
    } catch (e) { $("#e").textContent = "Gagal membaca file: " + e.message; }
    ev.target.value = ""; $("#pr").textContent = `${n} halaman masuk antrean.`; if (n) setTimeout(() => { render(); sync(); }, $("#e").textContent ? 4000 : 600);
  };
  $("#tplX").onclick = async () => { const m = meta(); if (!m) return; try { await templatLogging(m.bhid, m.hal); } catch (e) { $("#e").textContent = "Gagal membuat templat: " + e.message; } };
  let xFile = null;
  $("#manX").onclick = () => { const m = meta(); if (!m) return; xFile = null; $("#fX").click(); };
  $("#fX").onchange = (ev) => { xFile = ev.target.files[0]; ev.target.value = ""; if (!xFile) return; $("#pr").textContent = `Excel: ${xFile.name}. Sekarang pilih foto lembar dari galeri…`; $("#fXg").click(); };
  $("#fXg").onchange = async (ev) => {
    const g = ev.target.files[0], m = meta(); ev.target.value = ""; if (!g || !xFile || !m) return;
    try {
      const isi = await bacaExcelLogging(xFile);
      if (isi.header.bhid && bakuBH(isi.header.bhid) !== m.bhid) { $("#e").textContent = `BHID di Excel (${isi.header.bhid}) berbeda dengan Hole ID yang dipilih (${m.bhid}). Samakan dulu.`; return; }
      if (!isi.rows.length) { $("#e").textContent = "Tabel conto di Excel masih kosong."; return; }
      isi.header.bhid ||= m.bhid; isi.header.page ||= String(m.hal);
      await qPut({ client_uuid: crypto.randomUUID(), form_type: "SHEET", bhid: m.bhid, hal_kirim: m.hal, page_no: m.hal, sumber: "EXCEL", file_name: xFile.name,
        blob: await shrink(g), excel: xFile, extraction_a: isi, captured_at: new Date(g.lastModified || Date.now()).toISOString() });
      $("#pr").textContent = `Form Logging manual ${m.bhid} hal. ${m.hal} (${isi.rows.length} baris) masuk antrean.`; setTimeout(() => { render(); sync(); }, 600);
    } catch (e) { $("#e").textContent = "Excel tidak bisa dibaca: " + e.message; }
  };
  $("#sy").onclick = sync;
  if (online()) {
    const [{ data: a }, { data: b }] = await Promise.all([
      staff ? sb.from("scan_job").select("id,form_type,bhid_hint,page_no,status,created_at,n_disagree,n_rule_flags,error,sumber,merged,cell_flags,konfirmasi").or(["verifier", "admin"].includes(me?.role) ? "form_type.not.is.null" : `created_by.eq.${session.user.id}`).order("created_at", { ascending: false }).limit(["verifier", "admin"].includes(me?.role) ? 60 : 30) : Promise.resolve({ data: [] }),
      sb.from("form_photo").select("id,jenis,rig,bhid,tanggal,shift,keterangan,halaman,jumlah_halaman,sumber,created_at").eq("created_by", session.user.id).order("created_at", { ascending: false }).limit(30)]);
    const items = [...(a ?? []).map((j) => ({ id: j.id, t: j.created_at, h: `<li><span class="pill ${j.status}">${j.status === "REJECTED" ? "DITOLAK" : j.status === "MANUAL" ? "ISI MANUAL" : j.status}</span><span>${esc(FORMS[j.form_type])} · ${esc(j.bhid_hint)}${j.page_no ? " hal. " + j.page_no : ""}${j.sumber ? " · " + j.sumber : ""}<br><span class="muted">${new Date(j.created_at).toLocaleString("id-ID")}${j.status === "NEEDS_REVIEW" ? ` · ${j.n_disagree} beda baca, ${j.n_rule_flags} cek aturan` : ""}${j.error ? " · " + esc(j.error) : ""}</span></span></li>` })),
      ...(b ?? []).map((p) => ({ fid: p.id, t: p.created_at, h: `<li><span class="pill APPROVED">ARSIP</span><span>${esc(ARSIP[p.jenis])} · ${esc(p.bhid || p.rig || "")}${p.halaman ? ` · hal. ${p.halaman}/${p.jumlah_halaman ?? "?"}` : ""} · ${p.sumber}<br><span class="muted">${p.tanggal ?? ""} · dikirim ${new Date(p.created_at).toLocaleString("id-ID")}</span></span></li>` }))].sort((x, y) => (x.t < y.t ? 1 : -1));
    $("#mine").innerHTML = items.map((x) => x.h).join("") || `<li class="muted">Belum ada.</li>`;
    // tombol konfirmasi tulisan untuk scan sendiri yang masih menunggu periksa
    (a ?? []).filter((j) => j.status === "NEEDS_REVIEW").forEach((j) => { const n = pertanyaanScan(j).length, nk = Object.keys(j.konfirmasi ?? {}).length, li = [...$("#mine").children][items.findIndex((x) => x.id === j.id)];
      if (!li || (!n && !nk)) return; li.insertAdjacentHTML("beforeend", n ? `<button class="warn" data-kf="${j.id}" style="flex:0 0 auto;width:auto;padding:6px 10px">❓ Konfirmasi ${n}</button>` : `<span class="pill APPROVED" style="flex:0">✓ ${nk} dikonfirmasi</span>`); });
    $("#mine").querySelectorAll("[data-kf]").forEach((b) => (b.onclick = () => konfirmasiModal(b.dataset.kf)));
    // ✏️ Edit isian Form Logging milik sendiri (belum disetujui): buka editor tabel + foto, simpan → dikirim ke verifier
    const verF = ["verifier", "admin"].includes(me?.role);
    (a ?? []).filter((j) => (verF || j.status !== "APPROVED") && j.status !== "PROCESSING").forEach((j) => { const li = [...$("#mine").children][items.findIndex((x) => x.id === j.id)];
      if (li) li.insertAdjacentHTML("beforeend", `<button class="sec" data-edj="${j.id}" data-st="${j.status}" style="flex:0 0 auto;width:auto;padding:6px 10px">✏️ Edit</button>`); });
    // v.23: verifier/admin mengedit di sini → langsung ke database (belum disetujui: Terima & simpan; sudah disetujui: Simpan perubahan ke database)
    $("#mine").querySelectorAll("[data-edj]").forEach((b) => (b.onclick = () => { scrollTo(0, 0); reviewDetail($("#v"), b.dataset.edj, !verF ? "pengirim" : b.dataset.st === "APPROVED" ? "ubah" : "foto"); }));
    // 🛠 Perbaiki data kiriman (salah Hole ID, halaman, jenis, rig, tanggal…) atau 🗑 hapus (diarsipkan, bisa dipulihkan admin)
    const tbl = `style="flex:0 0 auto;width:auto;padding:6px 10px"`;
    (a ?? []).filter((j) => (j.status !== "APPROVED" || ["verifier", "admin"].includes(me?.role)) && j.status !== "PROCESSING").forEach((j) => { const li = [...$("#mine").children][items.findIndex((x) => x.id === j.id)];
      if (li) li.insertAdjacentHTML("beforeend", `<button class="sec" data-kd="scan_job|${j.id}" ${tbl}>🛠 Data</button><button class="danger" data-kh="scan_job|${j.id}" ${tbl}>🗑</button>`); });
    (b ?? []).forEach((p) => { const li = [...$("#mine").children][items.findIndex((x) => x.fid === p.id)];
      if (li) li.insertAdjacentHTML("beforeend", `<button class="sec" data-kd="form_photo|${p.id}" ${tbl}>🛠 Data</button><button class="danger" data-kh="form_photo|${p.id}" ${tbl}>🗑</button>`); });
    $("#mine").querySelectorAll("li").forEach((li) => { li.style.flexWrap = "wrap"; const sp = li.children[1]; if (sp?.tagName === "SPAN") sp.style.flex = "1 1 55%"; });
    const cari = (t, id) => (t === "scan_job" ? a : b)?.find((r) => r.id === id);
    $("#mine").querySelectorAll("[data-kd]").forEach((x) => (x.onclick = () => { const [t, id] = x.dataset.kd.split("|"); editKirimanModal(t, cari(t, id), () => fotoView(v)); }));
    $("#mine").querySelectorAll("[data-kh]").forEach((x) => (x.onclick = async () => { const [t, id] = x.dataset.kh.split("|"), r = cari(t, id);
      const lbl = t === "scan_job" ? `${FORMS[r.form_type] ?? r.form_type} ${r.bhid_hint ?? ""}${r.page_no ? " hal. " + r.page_no : ""}` : `${ARSIP[r.jenis] ?? r.jenis} ${r.bhid || r.rig || ""} ${r.tanggal ?? ""}`;
      const alasan = prompt(`Hapus kiriman "${lbl}"?\nFoto & isiannya dipindah ke arsip (admin bisa memulihkan). Setelah itu Anda bisa kirim ulang yang benar.\n\nAlasan (wajib):`);
      if (!alasan?.trim()) return;
      const { error } = await sb.rpc("hapus_kiriman_foto", { p_table: t, p_id: id, p_alasan: alasan.trim() });
      if (error) return alert(error.message); toast("Kiriman dihapus — silakan kirim ulang yang benar."); fotoView(v); }));
  } else $("#mine").innerHTML = `<li class="muted">Offline — daftar akan tampil saat ada sinyal.</li>`;
}
// Form perbaiki data kiriman Foto formulir (Form Logging = scan_job, arsip = form_photo)
function editKirimanModal(t, r, selesai) {
  if (!r) return alert("Kiriman tidak ditemukan — muat ulang halaman.");
  const scan = t === "scan_job", opsi = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(n)}</option>`).join("");
  const m = modal(`<h3 style="margin-top:0">🛠 Perbaiki data kiriman</h3>
    <p class="muted" style="margin:0 0 8px">Untuk salah tulis Hole ID, nomor halaman, jenis formulir, rig, tanggal, dll. Fotonya tetap. Kalau fotonya yang salah, tutup lalu pakai 🗑 Hapus dan kirim ulang.</p>
    <label>Jenis formulir<select id="kJ">${scan ? opsi(FORMS, r.form_type) : opsi(ARSIP, r.jenis)}</select></label>
    <label>Hole ID<input id="kB" value="${esc((scan ? r.bhid_hint : r.bhid) ?? "")}" placeholder="mis. DH-NPG 12" autocapitalize="characters"></label>
    ${scan ? "" : `<div class="row"><label>Rig<input id="kR" value="${esc(r.rig ?? "")}" placeholder="RIG 1" autocapitalize="characters"></label><label>Tanggal<input id="kT" type="date" value="${r.tanggal ?? ""}"></label></div>
    <label>Shift<select id="kS"><option value="">—</option><option value="PAGI"${r.shift === "PAGI" ? " selected" : ""}>Day (PAGI)</option><option value="MALAM"${r.shift === "MALAM" ? " selected" : ""}>Night (MALAM)</option></select></label>`}
    <div class="row"><label>Halaman<input id="kH" type="number" min="1" inputmode="numeric" value="${(scan ? r.page_no : r.halaman) ?? ""}"></label>${scan ? "" : `<label>Jumlah halaman<input id="kN" type="number" min="1" inputmode="numeric" value="${r.jumlah_halaman ?? ""}"></label>`}</div>
    ${scan ? "" : `<label>Keterangan<input id="kK" value="${esc(r.keterangan ?? "")}"></label>`}
    <label>Alasan perubahan (wajib)<input id="kA" placeholder="mis. salah tulis Hole ID"></label>
    <p id="kE" class="err"></p>
    <div class="row"><button class="sec" id="kX">Batal</button><button id="kOk">Simpan perubahan</button></div>`);
  const q = (s) => m.querySelector(s);
  q("#kX").onclick = () => m.remove();
  q("#kOk").onclick = async () => {
    const alasan = q("#kA").value.trim(); if (!alasan) return (q("#kE").textContent = "Isi alasan perubahan.");
    const bh = q("#kB").value.trim().toUpperCase().replace(/\s+/g, " ");
    if (bh && !/^[A-Z0-9][A-Z0-9 _\-\/.]*$/.test(bh)) return (q("#kE").textContent = "Hole ID berisi karakter tidak wajar.");
    const d = scan ? { jenis: q("#kJ").value, bhid: bh, halaman: q("#kH").value }
      : { jenis: q("#kJ").value, bhid: bh, rig: q("#kR").value, tanggal: q("#kT").value, shift: q("#kS").value, halaman: q("#kH").value, jumlah_halaman: q("#kN").value, keterangan: q("#kK").value };
    q("#kOk").disabled = true;
    const { error } = await sb.rpc("edit_kiriman_foto", { p_table: t, p_id: r.id, p_data: d, p_alasan: alasan });
    q("#kOk").disabled = false;
    if (error) return (q("#kE").textContent = /edit_kiriman_foto/.test(error.message) ? "Fungsi database belum dipasang — jalankan edit_hapus_kiriman_foto.sql di Supabase." : error.message);
    m.remove(); toast("Data kiriman diperbaiki."); selesai?.();
  };
}
async function syncArsip(it) {
  const path = `${session.user.id}/arsip/${it.client_uuid}.jpg`;
  const up = await sb.storage.from("scan-photos").upload(path, it.blob, { contentType: "image/jpeg", upsert: false });
  if (up.error && !/exists|Duplicate/i.test(up.error.message)) { it.error = up.error.message; return qPut(it); }
  const ins = await sb.from("form_photo").upsert({ ...it.row, photo_path: path }, { onConflict: "client_uuid", ignoreDuplicates: true });
  if (ins.error) { it.error = ins.error.message; return qPut(it); }
  await qDel(it.client_uuid);
}
async function arsipList(box) {
  const { data } = await sb.from("form_photo").select("id,jenis,rig,bhid,tanggal,shift,keterangan,halaman,jumlah_halaman,sumber,file_name,photo_path,created_at").order("created_at", { ascending: false }).limit(50);
  box.innerHTML = `<h3>Foto formulir arsip (50 terakhir)</h3><ul class="list">${(data ?? []).map((p) => `<li style="flex-wrap:wrap"><span style="flex:1"><b>${esc(ARSIP[p.jenis])}</b> · ${esc(p.bhid || "")} ${esc(p.rig || "")} ${p.tanggal ?? ""} ${p.shift ? (p.shift === "PAGI" ? "Day" : "Night") : ""}${p.halaman ? ` · hal. ${p.halaman}/${p.jumlah_halaman ?? "?"}` : ""}<br><span class="muted">${p.sumber}${p.file_name ? " · " + esc(p.file_name) : ""}${p.keterangan ? " · " + esc(p.keterangan) : ""}</span></span><button class="sec" data-ar="${esc(p.photo_path)}" style="flex:0">Lihat</button></li>`).join("") || `<li class="muted">Belum ada.</li>`}</ul>`;
  box.querySelectorAll("[data-ar]").forEach((b) => (b.onclick = async () => { bukaFile("scan-photos", b.dataset.ar); }));
}

async function reviewList(v) {
  const { data, error } = await sb.from("scan_job").select("id,form_type,bhid_hint,page_no,status,created_at,n_disagree,n_rule_flags,error,draft_at")
    .in("status", ["NEEDS_REVIEW", "ERROR", "PROCESSING", "UPLOADED", "MANUAL"]).order("created_at");
  v.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Scan menunggu pemeriksaan</h2><button class="sec" id="rf" style="flex:0">Muat ulang</button></div>
  ${error ? `<p class="err">${esc(error.message)}</p>` : ""}
  <ul class="list">${(data ?? []).map((j) => `<li><span class="pill ${j.status}">${j.status}</span><span style="flex:1">${esc(FORMS[j.form_type])} · <b>${esc(j.bhid_hint)}</b>${j.page_no ? " hal. " + j.page_no : ""}<br>
   <span class="muted">${new Date(j.created_at).toLocaleString("id-ID")}${j.status === "NEEDS_REVIEW" ? ` · ${j.n_disagree} beda baca · ${j.n_rule_flags} cek aturan` : ""}${j.error ? " · " + esc(j.error) : ""}${j.draft_at ? ` · <b style="color:#1E9E69">💾 editan tersimpan ${esc(fmtT(new Date(j.draft_at)))}</b>` : ""}</span></span>
   <button data-id="${j.id}" style="flex:0">Buka</button>${me?.role === "admin" ? `<button class="danger" data-del="${j.id}" style="flex:0">Hapus</button>` : ""}</li>`).join("") || `<li class="muted">Tidak ada yang perlu diperiksa.</li>`}</ul></div>`;
  const ab = document.createElement("div"); ab.className = "card"; ab.innerHTML = "<p class='muted'>Memuat arsip…</p>"; v.appendChild(ab); arsipList(ab);
  $("#rf").onclick = () => reviewList(v);
  v.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => reviewDetail(v, b.dataset.id)));
  v.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (await adminDelete("scan_job", b.dataset.del, "scan formulir")) reviewList(v); }));
}

async function reviewDetail(v, id, mode) {
  const ubahFinal = mode === "ubah", dariFoto = mode === "foto" || ubahFinal; // v.23: dibuka verifier/admin dari Foto formulir (ubah = Form Logging yang sudah disetujui)
  const pengirim = mode === "pengirim"; // dibuka dari Foto formulir → Kiriman saya: pengirim mengedit isiannya sendiri, lalu dikirim ke verifier
  const { data: j, error } = await sb.from("scan_job").select("*").eq("id", id).single();
  if (error) return (v.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const { data: url } = await sb.storage.from("scan-photos").createSignedUrl(j.photo_path, 3600);
  // v.19: editan pemeriksa yang disimpan sementara (💾 Simpan editan) ada di j.draft; hasil baca asli tetap di j.merged
  const asli = j.merged ?? { header: {}, rows: [] };
  const adaDraf = !pengirim && j.draft && typeof j.draft === "object";
  const data = structuredClone(adaDraf ? j.draft : asli);
  const flags = j.validation ?? [], cf = j.cell_flags ?? {};
  const hdrCols = j.form_type === "HEADER" ? HDR : j.form_type === "SHEET" ? SHDR : PHDR, rowCols = j.form_type === "LOG" ? LOG : j.form_type === "DENSITY" ? DEN : j.form_type === "SHEET" ? SHEET : [];
  // Bila belum ada hasil baca otomatis (gagal/ERROR, MANUAL, atau masih diproses), siapkan tabel kosong agar bisa diisi manual dari foto.
  if (!data.header) data.header = {};
  if (!data.header.bhid && j.bhid_hint) data.header.bhid = j.bhid_hint;
  if (j.form_type === "SHEET" && data.header.page == null && j.page_no) data.header.page = j.page_no;
  const isiManual = rowCols.length > 0 && !(asli.rows ?? []).length;
  if (isiManual && !(data.rows ?? []).length) data.rows = Array.from({ length: 15 }, (_, i) => ({ _row: i + 1 }));
  // isian draf yang berbeda dari hasil baca asli ditandai hijau (dianggap koreksi pemeriksa → wajib alasan saat Terima & simpan)
  const sm = (a, b) => (a ?? "") === (b ?? "") || String(a ?? "") === String(b ?? "");
  const bedaDraf = (key, idx) => {
    if (!adaDraf || isiManual) return false;
    if (idx === null || idx === undefined || idx === "") return !sm(asli.header?.[key], data.header?.[key]);
    const r = data.rows?.[idx], o = (asli.rows ?? []).find((x) => String(x._row) === String(r?._row));
    return o ? !sm(o[key], r?.[key]) : r?.[key] !== null && r?.[key] !== undefined && r?.[key] !== "";
  };
  // Lembar lanjutan: bila halaman yang sama berisi baris hari sebelumnya yang SUDAH tersimpan (interval From–To sama di lubang yang sama),
  // baris itu ditandai "sudah tersimpan" dan dilewati; yang disimpan hanya sisanya (baris baru hari ini).
  let lamaN = 0;
  if (rowCols.some(([k]) => k === "depth_from") && data.header?.bhid && !isiManual && !ubahFinal) {
    const { data: ada } = await sb.from("sample").select("depth_from,depth_to").eq("bhid", bakuBH(data.header.bhid));
    const sama = (r) => (ada ?? []).some((x) => Math.abs(+x.depth_from - +r.depth_from) < 0.011 && Math.abs(+x.depth_to - +r.depth_to) < 0.011);
    for (const r of data.rows ?? []) if (r.depth_from != null && r.depth_to != null && sama(r)) { r._lama = true; lamaN++; }
  }
  // v.22: No sample OTOMATIS untuk Form Logging (LOG/SHEET): nomor urut mulai 1 per lubang + kode zona (1L, 2L … 6S), tidak diketik.
  // Lembar lanjutan: nomor dilanjutkan dari jumlah conto lubang ini di database yang berada di atas FROM baris pertama.
  const autoNo = j.form_type === "SHEET" || j.form_type === "LOG";
  const isiBaris = (r) => Object.entries(r ?? {}).some(([k, x]) => !["_row", "seq", "_lama"].includes(k) && x !== null && x !== undefined && x !== "");
  let dbS = [];
  const ambilNoDb = async () => { dbS = []; const bh = bakuBH(data.header?.bhid ?? ""); if (!autoNo || !bh) return; const { data: x } = await sb.from("sample").select("seq,depth_to").eq("bhid", bh); dbS = x ?? []; };
  const nomori = () => { if (!autoNo) return; const rows = data.rows ?? [], first = rows.find(isiBaris);
    const f0 = first && first.depth_from !== null && first.depth_from !== undefined && Number.isFinite(+first.depth_from) ? +first.depth_from : 0;
    let no = dbS.filter((x) => +x.depth_to <= f0 + 0.005).length;
    for (const r of rows) r.seq = isiBaris(r) ? ++no : null; };
  await ambilNoDb(); nomori();
  const cls = (k) => { const f = cf[k]; if (!f) return ""; return f.some((x) => x.type === "BEDA") ? "f-BEDA" : "f-ATURAN"; };
  const KF = j.konfirmasi ?? {};
  const tip = (k) => [...(cf[k] ?? []).map((x) => x.msg), ...(KF[k] ? [KF[k].tidak_tahu ? `Pengirim (${KF[k].nama}) juga tidak yakin` : `Dikonfirmasi pengirim (${KF[k].nama}): ${KF[k].nilai}`] : [])].join(" | ");
  // v.21: kolom No sample = nomor urut (mulai 1) + kode zona dari kolom Zona, mis. 1L, 6S. Yang disimpan tetap nomornya (seq); zona dari kolom Zona.
  const noSampel = (r) => (r?.seq === null || r?.seq === undefined || r?.seq === "" ? "" : `${r.seq}${r.geozone_id ?? ""}`);
  const cell = (val, key, idx, rowNo) => { const oto = key === "seq" && idx !== null && idx !== undefined; if (oto) val = noSampel(data.rows[idx]); const fk = `${rowNo ?? "h"}.${key}`;
    if (oto && autoNo) return `<td title="No sample otomatis: nomor urut mulai 1 + kode zona"><input data-k="seq" data-r="${idx}" value="${esc(val ?? "")}" readonly tabindex="-1" style="background:#EEF2F0;font-weight:600;width:4.5em"></td>`;
    return `<td class="${bedaDraf(key, idx) ? "edited" : cls(fk)}" title="${esc(tip(fk))}"${KF[fk] && !KF[fk].tidak_tahu ? ' style="outline:2px solid #1E9E69;outline-offset:-2px"' : ""}><input data-k="${key}" data-r="${idx ?? ""}" value="${esc(val ?? "")}" inputmode="${NUMERIC.has(key) ? "decimal" : "text"}"></td>`; };
  v.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">${esc(FORMS[j.form_type])} · ${esc(j.bhid_hint)}</h2><button class="sec" id="bk" style="flex:0">← Kembali</button></div>
   <p class="muted">Kuning = dua pembacaan berbeda · Merah = melanggar aturan validasi · Hijau = sudah Anda ubah · Bingkai hijau = sudah dikonfirmasi pengirim (${Object.keys(j.konfirmasi ?? {}).length}). Bandingkan dengan foto sebelum menyetujui.</p>
   ${j.status === "ERROR" ? `<p class="err">Gagal diproses: ${esc(j.error)}</p>` : ""}${j.status === "MANUAL" ? `<p class="err">${esc(j.error)}</p>` : ""}
   ${j.sumber === "EXCEL" ? `<p><b>Form Logging manual dari Excel</b> (tanpa pembacaan AI) · <a href="#" id="dlx">⬇ Unduh Excel asli${j.file_name ? " (" + esc(j.file_name) + ")" : ""}</a> — cocokkan setiap baris dengan foto lembar.</p>` : ""}
   ${(j.ai_kali ?? 0) > 0 ? `<p class="muted">Dibaca otomatis ${j.ai_kali}× untuk foto ini · batas 2× per halaman.</p>` : ""}
   ${adaDraf ? `<p style="background:#E3F4EA;padding:8px 10px;border-radius:8px">💾 <b>Melanjutkan editan tersimpan</b> — disimpan ${esc(fmtT(new Date(j.draft_at)))}${j.draft_note ? ` · catatan: ${esc(j.draft_note)}` : ""}. Isian hijau = berbeda dari hasil baca asli. Editan belum masuk database conto sampai <b>✅ Terima & simpan</b>.</p>` : ""}
   ${isiManual ? `<p style="background:#FFF4D6;padding:8px 10px;border-radius:8px">✍️ <b>Belum ada hasil baca otomatis</b> — tabel kosong sudah disiapkan. Isi langsung dari foto di samping, lalu <b>✅ Terima & simpan</b>. Kolom <b>No sample</b> terisi otomatis (nomor mulai 1 + kode zona, mis. 1L, 6S); baris yang dibiarkan kosong tidak disimpan. Bisa juga tekan <b>Proses ulang</b> bila kunci baca otomatis sudah diperbaiki.</p>` : ""}</div>
   <div class="rv"><div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Foto</h3><input id="zm" type="range" min="1" max="4" step="0.25" value="1" style="flex:2"></div>
     <div class="photo" id="ph"><img id="im" src="${url?.signedUrl ?? ""}" alt="Foto formulir" style="width:100%"></div></div>
   <div class="card"><h3>Hasil scan (bisa diedit)</h3>
     <div class="tw"><table><tr>${hdrCols.map(([, t]) => `<th>${t}</th>`).join("")}</tr><tr>${hdrCols.map(([k]) => cell(data.header?.[k], k, null, null)).join("")}</tr></table></div>
     ${rowCols.length ? `<div class="tw" style="margin-top:10px"><table><tr><th>Baris</th>${rowCols.map(([, t]) => `<th>${t}</th>`).join("")}</tr>
       ${(data.rows ?? []).map((r, i) => `<tr${r._lama ? ' class="lama" style="opacity:.45;background:#eee" title="Sudah tersimpan dari lembar hari sebelumnya — dilewati"' : ""}><td style="padding:4px 6px">${r._row ?? i + 1}${r._lama ? "<br><small>lama</small>" : ""}</td>${rowCols.map(([k]) => cell(r[k], k, i, r._row)).join("")}</tr>`).join("")}</table></div>
       ${lamaN ? `<p style="background:#E8F1FB;padding:3px 8px;border-radius:6px;margin:4px 0;font-size:11.5px">📄 <b>Lembar lanjutan:</b> ${lamaN} baris pertama sudah tersimpan dari logging hari sebelumnya (abu-abu) dan <b>dilewati</b>. Yang disimpan hanya ${(data.rows ?? []).length - lamaN} baris baru. <label style="display:inline-flex;gap:6px;align-items:center;font-weight:400;margin:0"><input type="checkbox" id="ikutLama" style="width:auto"> sertakan juga baris lama (menimpa data tersimpan)</label></p>` : ""}
       <button class="sec" id="addRow" style="width:auto;margin-top:6px">+ Tambah baris</button>` : ""}
   </div></div>
   <div class="card"><h3>Temuan (${flags.length})</h3><ul class="list flags">${flags.map((f) => `<li><span><b>${f.row ? "Baris " + f.row : "Kepala"}</b> · ${esc(f.field)} · ${esc(f.type)} — ${esc(f.msg)}
     ${f.saran !== undefined && f.saran !== null ? `<span class="ab"><button class="sec" data-sar="${esc(f.saran)}" data-f="${esc(f.field)}" data-row="${f.row ?? ""}">Pakai saran: ${esc(f.saran)}</button></span>` : ""}
     ${f.type === "BEDA" && f.field !== "*" ? `<span class="ab"><button class="sec" data-pick="a" data-f="${esc(f.field)}" data-row="${f.row ?? ""}">Pakai A: ${esc(f.a)}</button><button class="sec" data-pick="b" data-f="${esc(f.field)}" data-row="${f.row ?? ""}">Pakai B: ${esc(f.b)}</button></span>` : ""}</span></li>`).join("") || `<li class="muted">Tidak ada temuan.</li>`}</ul></div>
   <div class="card"><label>Catatan pemeriksa</label><textarea id="nt" rows="2"></textarea>
     ${pengirim ? `<p class="muted" style="margin:6px 0">Isian Anda dikirim ke verifier untuk diperiksa & disetujui. Setelah disetujui, data masuk ke database conto.</p><div class="row" style="margin-top:10px"><button id="sv">💾 Simpan isian & kirim ke verifier</button></div>` : ""}
     ${ubahFinal ? `<p style="background:#E8F1FB;padding:6px 10px;border-radius:8px;margin:6px 0">Form Logging ini <b>sudah disetujui</b>. Ubah isian yang salah, tulis alasannya di catatan, lalu simpan — perubahan langsung masuk database conto dan tercatat di Riwayat koreksi.</p><div class="row" style="margin-top:10px"><button id="ub">💾 Simpan perubahan ke database</button></div>` : ""}<div class="row" style="margin-top:10px;${pengirim || ubahFinal ? "display:none" : ""}"><button id="ok">✅ Terima & simpan</button><button class="sec" id="sd">💾 Simpan editan</button><button class="danger" id="no">✖ Tidak sesuai SOP</button><button class="warn" id="re">Proses ulang</button></div>
     ${pengirim ? "" : `<p class="muted" style="font-size:12px;margin:6px 0 0">💾 Simpan editan = simpan sementara tanpa menyetujui (status tetap menunggu periksa, bisa dilanjutkan nanti). Data baru masuk database conto setelah ✅ Terima & simpan.</p>`}<div id="e" class="err"></div></div>`;
  $("#bk").onclick = () => (pengirim || dariFoto ? render() : reviewList(v));
  if (ubahFinal) { const lb = v.querySelector("#nt")?.previousElementSibling; if (lb) lb.textContent = "Alasan perubahan (wajib)"; }
  if (pengirim) { const lb = v.querySelector("#nt")?.previousElementSibling; if (lb) lb.textContent = "Catatan untuk verifier (opsional)"; }
  if (adaDraf && j.draft_note) $("#nt").value = j.draft_note;
  if ($("#dlx")) $("#dlx").onclick = async (ev) => { ev.preventDefault(); const { data: u2 } = await sb.storage.from("scan-photos").createSignedUrl(j.excel_path, 600, { download: j.file_name || "form_logging.xlsx" }); if (u2?.signedUrl) location.href = u2.signedUrl; };
  // uji silang: foto core pada rentang kedalaman lembar ini
  if (j.form_type === "SHEET" || j.form_type === "LOG") {
    const ds = (data.rows ?? []).flatMap((r) => [r.depth_from, r.depth_to]).filter((x) => typeof x === "number");
    if (ds.length && data.header?.bhid) {
      const { data: cps } = await sb.from("core_photo").select("file_name,preview_path,photo_type,depth_from,depth_to,sop_ok,reviewer_override")
        .eq("bhid", data.header.bhid).lt("depth_from", Math.max(...ds)).gt("depth_to", Math.min(...ds)).order("photo_type").order("depth_from");
      const urls = await Promise.all((cps ?? []).map((c) => sb.storage.from("core-photos").createSignedUrl(c.preview_path, 3600)));
      const box = document.createElement("div"); box.className = "card";
      box.innerHTML = `<h3>Foto core ${esc(data.header.bhid)} untuk uji silang (${cps?.length ?? 0})</h3>${(cps ?? []).length ? (cps ?? []).map((c, i) => `<p class="muted" style="margin:8px 0 4px">${esc(c.file_name)} ${(c.reviewer_override ?? c.sop_ok) === false ? "· <span class='err'>tidak sesuai SOP</span>" : ""}</p><img src="${urls[i].data?.signedUrl ?? ""}" alt="Foto core ${esc(c.file_name)}" style="width:100%;border-radius:8px">`).join("") : `<p class="err">Belum ada foto core untuk kedalaman ${Math.min(...ds)}–${Math.max(...ds)} m.</p>`}`;
      v.querySelector(".rv").after(box);
    }
  }
  $("#zm").oninput = (e) => ($("#im").style.width = `${e.target.value * 100}%`);
  const rowIdx = (r) => (data.rows ?? []).findIndex((x) => String(x._row) === String(r));
  const pasangInput = (inp) => (inp.oninput = () => {
    const k = inp.dataset.k, r = inp.dataset.r, raw = inp.value.trim();
    if (k === "seq" && r !== "" && autoNo) return; // No sample otomatis — tidak diketik
    if (k === "seq" && r !== "") { const m = raw.replace(/\s/g, "").match(/^(\d*)([A-Za-z]{0,3})$/); data.rows[Number(r)].seq = m && m[1] ? Number(m[1]) : raw === "" ? null : NaN; inp.parentElement.className = "edited"; return; }
    const val = raw === "" ? null : NUMERIC.has(k) ? Number(raw.replace(",", ".")) : raw;
    if (r === "") data.header[k] = val; else data.rows[Number(r)][k] = val;
    inp.parentElement.className = "edited";
    if (r === "" && k === "bhid") ambilNoDb().then(tampilNo); else tampilNo();
  });
  const tampilNo = () => { if (!autoNo) return; nomori(); v.querySelectorAll('td input[data-k="seq"]').forEach((si) => { if (si.dataset.r !== "") si.value = noSampel(data.rows[Number(si.dataset.r)]); }); };
  v.querySelectorAll("td input").forEach(pasangInput);
  if ($("#addRow")) $("#addRow").onclick = () => {
    const i = data.rows.length, no = Math.max(0, ...data.rows.map((x) => Number(x._row) || 0)) + 1; data.rows.push({ _row: no });
    const tb = $("#addRow").previousElementSibling.querySelector("table");
    tb.insertAdjacentHTML("beforeend", `<tr><td style="padding:4px 6px">${no}</td>${rowCols.map(([k]) => cell(null, k, i, no)).join("")}</tr>`);
    tb.querySelectorAll("tr:last-child td input").forEach(pasangInput); tampilNo();
  };
  v.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => {
    const f = b.dataset.f, raw = String(b.dataset.pick === "a" ? flags.find((x) => x.field === f && String(x.row ?? "") === b.dataset.row)?.a : flags.find((x) => x.field === f && String(x.row ?? "") === b.dataset.row)?.b ?? "");
    const i = b.dataset.row === "" ? null : rowIdx(b.dataset.row);
    const inp = v.querySelector(`td input[data-k="${f}"][data-r="${i ?? ""}"]`);
    if (inp) { inp.value = raw; inp.dispatchEvent(new Event("input")); }
  }));
  v.querySelectorAll("[data-sar]").forEach((b) => (b.onclick = () => {
    const i = b.dataset.row === "" ? null : rowIdx(b.dataset.row);
    const inp = v.querySelector(`td input[data-k="${b.dataset.f}"][data-r="${i ?? ""}"]`);
    if (inp) { inp.value = b.dataset.sar; inp.dispatchEvent(new Event("input")); b.disabled = true; }
  }));
  const validasi = () => { nomori();
    const adaIsi = (r) => Object.entries(r).some(([k, x]) => k !== "_row" && x !== null && x !== undefined && x !== "");
    const kurangNo = (data.rows ?? []).filter((r) => adaIsi(r) && (r.seq === null || r.seq === undefined));
    if (kurangNo.length) return ($("#e").textContent = `Baris ${kurangNo.map((r) => r._row).join(", ")}: kolom No belum diisi.`);
    const salahNo = (data.rows ?? []).filter((r) => adaIsi(r) && !(Number.isInteger(r.seq) && r.seq >= 1));
    if (salahNo.length) return ($("#e").textContent = `Baris ${salahNo.map((r) => r._row).join(", ")}: No sample harus nomor mulai 1 diikuti kode zona (mis. 1L, 6S).`);
    if (!String(data.header?.bhid ?? "").trim()) return ($("#e").textContent = "Isi Hole ID di kepala tabel.");
    for (const r of data.rows ?? []) {
      if (j.form_type === "DENSITY") {
        const av = (xs) => { const n = xs.filter((x) => typeof x === "number" && isFinite(x)); return n.length ? +(n.reduce((a, b) => a + b, 0) / n.length).toFixed(2) : null; };
        r.d_length_cm = av([r.len1, r.len2, r.len3]); r.d_diameter_cm = av([r.dia1, r.dia2, r.dia3]);
      }
      for (const k of Object.keys(r)) if (NUMERIC.has(k) && r[k] !== null && !isFinite(r[k])) return ($("#e").textContent = `Baris ${r._row}: ${k} bukan angka`);
    }
    if (j.form_type === "SHEET") for (const r of data.rows ?? []) { r.geolithcode_prc_2 = r.geolithcode_id_2 && typeof r.geolithcode_prc_1 === "number" ? +(100 - r.geolithcode_prc_1).toFixed(1) : null; r.d_wtr_volume_ml = typeof r.d_volume_measure_ml === "number" ? 1400 : null; }
    const ikut = $("#ikutLama")?.checked;
    return { ...data, rows: (data.rows ?? []).filter((r) => adaIsi(r) && (ikut || !r._lama)).map(({ _lama, ...r }) => r) };
  };
  if (pengirim) $("#sv").onclick = async () => { $("#e").textContent = ""; const isi = validasi(); if (typeof isi !== "object") return;
    $("#sv").disabled = true; const { error } = await sb.rpc("simpan_isian_scan", { p_job: id, p_data: isi, p_note: $("#nt").value || null }); $("#sv").disabled = false;
    if (error) return ($("#e").textContent = error.message); toast("Isian tersimpan — menunggu diperiksa verifier"); render(); };
  if ($("#ub")) $("#ub").onclick = async () => {
    $("#e").textContent = ""; const isi = validasi(); if (typeof isi !== "object") return;
    const alasan = $("#nt").value.trim(); if (!alasan) { $("#nt").focus(); return ($("#e").textContent = "Tulis alasan perubahan."); }
    $("#ub").disabled = true; const { data: res, error } = await sb.rpc("ubah_logging_disetujui", { p_job: id, p_data: isi, p_alasan: alasan }); $("#ub").disabled = false;
    if (error) return ($("#e").textContent = /ubah_logging_disetujui/.test(error.message) ? "Fungsi database belum dipasang (v41)." : error.message);
    alert(`Tersimpan ke database: ${res.rows_written} baris untuk ${res.bhid}.${res.isian_dikoreksi || res.kepala_dikoreksi ? `\nKoreksi tercatat: ${res.isian_dikoreksi ?? 0} isian baris, ${res.kepala_dikoreksi ?? 0} isian kepala.` : ""}`); render();
  };
  $("#ok").onclick = async () => {
    $("#e").textContent = "";
    const isi = validasi(); if (typeof isi !== "object") return;
    // v.16: koreksi pemeriksa wajib beralasan; semua isian tersimpan ke database, koreksi per isian tercatat di Riwayat koreksi
    const nEdit = v.querySelectorAll("td.edited").length;
    if (nEdit && !isiManual && !$("#nt").value.trim()) return ($("#e").textContent = `Ada ${nEdit} isian yang Anda koreksi — tulis alasan koreksi di Catatan pemeriksa.`);
    $("#ok").disabled = true;
    const { data: res, error } = await sb.rpc("approve_scan", { p_job: id, p_data: isi, p_note: $("#nt").value || null });
    $("#ok").disabled = false;
    if (error) return ($("#e").textContent = error.message);
    alert(`Tersimpan ke database: ${res.rows_written} baris untuk ${res.bhid}.${res.isian_dikoreksi || res.kepala_dikoreksi ? `\nKoreksi tercatat: ${res.isian_dikoreksi ?? 0} isian baris, ${res.kepala_dikoreksi ?? 0} isian kepala.` : ""}\nCek hasil hitung di tab "Data & cek".`); dariFoto ? render() : reviewList(v);
  };
  // v.19: 💾 Simpan editan — simpan isian tabel apa adanya (tanpa menyetujui) ke scan_job.draft
  $("#sd").onclick = async () => {
    $("#e").textContent = "";
    for (const r of data.rows ?? []) for (const k of Object.keys(r)) if (NUMERIC.has(k) && r[k] !== null && r[k] !== undefined && !isFinite(r[k])) return ($("#e").textContent = `Baris ${r._row}: ${k} bukan angka`);
    const isi = { ...data, rows: (data.rows ?? []).map(({ _lama, ...r }) => r) };
    $("#sd").disabled = true;
    const { error } = await sb.rpc("simpan_editan_scan", { p_job: id, p_data: isi, p_note: $("#nt").value || null });
    $("#sd").disabled = false;
    if (error) return ($("#e").textContent = /simpan_editan_scan/.test(error.message) ? "Fungsi database belum dipasang — jalankan v38_simpan_editan_scan.sql di Supabase." : error.message);
    toast("Editan tersimpan — belum disetujui. Lanjutkan kapan saja, lalu ✅ Terima & simpan.");
  };
  $("#re").onclick = async () => { if (adaDraf || v.querySelector("td.edited")) { if (!confirm("Proses ulang akan membuang editan yang belum disetujui (termasuk editan tersimpan). Lanjutkan?")) return; } const { error } = await sb.functions.invoke("process-scan", { body: { job_id: id } }); $("#e").textContent = error ? error.message : "Diproses ulang — buka lagi dalam ±1 menit."; };
  $("#no").onclick = async () => {
    if (!$("#nt").value.trim()) return ($("#e").textContent = "Tulis alasan tidak sesuai SOP di Catatan pemeriksa.");
    const { error } = await sb.from("scan_job").update({ status: "REJECTED", review_note: $("#nt").value, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) $("#e").textContent = error.message; else dariFoto ? render() : reviewList(v);
  };
}

async function dataView(v) {
  v.innerHTML = `<div class="card" id="ddrLog"></div><div class="card"><h2>Data tersimpan & hasil cek</h2><div class="row"><select id="bh"><option value="">Memuat daftar titik…</option></select><button id="go" style="flex:0">Tampilkan</button></div><div id="dout"></div></div>`;
  // Dropdown titik yang sudah masuk database (conto logging / lubang dibor), terbaru dipilih otomatis
  (async () => {
    const [{ data: H }, { data: G }, { data: DB }] = await Promise.all([sb.from("v_dash_hole").select("bhid,jumlah_conto"), sb.from("v_logging_lubang").select("bhid,kedalaman_bor,status"), sb.from("v_ddr_baris").select("bhid").limit(5000)]);
    const A = {}; for (const h of H ?? []) A[h.bhid] = { ...A[h.bhid], conto: +h.jumlah_conto || 0 };
    for (const g of G ?? []) A[g.bhid] = { ...A[g.bhid], dalam: g.kedalaman_bor, st: g.status };
    for (const x of DB ?? []) A[x.bhid] = { conto: 0, ...A[x.bhid] };
    const L = Object.keys(A).filter(Boolean).sort((a, b) => a.localeCompare(b, "id", { numeric: true })), pil = localStorage.getItem("bhid") || "";
    $("#bh").innerHTML = L.length ? L.map((b) => `<option value="${esc(b)}" ${b === pil ? "selected" : ""}>${esc(b)} — ${A[b].conto ? `${A[b].conto} conto` : "belum ada conto"}${asalRedrill(b) ? " · redrill" : ""}</option>`).join("") : `<option value="">Belum ada titik di database</option>`;
    $("#bh").onchange = () => $("#go").click(); if (L.length) $("#go").click(); else panelDdrLogging($("#ddrLog"), "");
  })();
  $("#go").onclick = async () => {
    const bh = $("#bh").value.trim().toUpperCase(); panelDdrLogging($("#ddrLog"), bh);
    const { data, error } = await sb.from("v_sample_qc").select("sample_no,sample_id,depth_from,depth_to,core_length,core_recovery,geozone_id,geolithcode_id_1,d_wet_density,d_wet_arch,d_dry_density,d_dry_arch,d_arch_diff_pct,d_moisture_pct,d_wet_weight,chk_interval,chk_recovery,chk_lith,chk_code,chk_zone,chk_density,chk_arch,chk_weight").eq("bhid", bh).order("depth_from");
    if (error) return ($("#dout").innerHTML = `<p class="err">${esc(error.message)}</p>`);
    const cols = data?.length ? Object.keys(data[0]) : [];
    const bad = (k, x) => k.startsWith("chk_") && x && !["OK", "OK-SW", "MENUNGGU LAB"].includes(x);
    $("#dout").innerHTML = data?.length ? `<p class="muted">Ketuk satu baris untuk mengoreksi data yang salah baca/salah tulis atau mengisi timbang ulang (crosscheck). Setiap koreksi wajib alasan dan tercatat. Berat kering, dry density dan kadar air berasal dari hasil laboratorium.</p><div class="tw" style="margin-top:10px"><table><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${data.map((r) => `<tr data-s="${esc(r.sample_no)}" style="cursor:pointer">${cols.map((c) => `<td style="padding:5px 7px;${bad(c, r[c]) ? "background:#F6C9C3" : ""}">${esc(r[c])}</td>`).join("")}</tr>`).join("")}</table></div><div id="ed"></div>` : `<p class="muted">Belum ada data untuk ${esc(bh)}.</p>`;
    $("#dout").querySelectorAll("tr[data-s]").forEach((tr) => (tr.onclick = () => editSample(tr.dataset.s, () => $("#go").onclick())));
  };
}

// ---------- foto core ----------
// cek cepat di HP (tanpa sinyal): resolusi, orientasi, ketajaman, terang-gelap, silau, warna tenda
async function localCheck(bmp) {
  const w = 800, h = Math.round(bmp.height * w / bmp.width);
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h }); const x = c.getContext("2d");
  x.drawImage(bmp, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h); let sum = 0, clip = 0, r = 0, b = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; g[j] = v; sum += v; if (v >= 250) clip++; r += d[i]; b += d[i + 2]; }
  const n = w * h, mean = sum / n; let lap = 0, lap2 = 0, m = 0;
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) { const k = yy * w + xx; const L = 4 * g[k] - g[k - 1] - g[k + 1] - g[k - w] - g[k + w]; lap += L; lap2 += L * L; m++; }
  const sharp = lap2 / m - (lap / m) ** 2, cast = (r - b) / n / Math.max(mean, 1);
  const warnings = [];
  if (Math.max(bmp.width, bmp.height) < 3000) warnings.push(`Resolusi rendah (${bmp.width}×${bmp.height}); minimal sisi panjang 3.000 piksel`);
  if (bmp.height > bmp.width) warnings.push("Foto tegak (portrait); corebox sebaiknya difoto mendatar");
  if (sharp < 60) warnings.push(`Kemungkinan blur (ketajaman ${sharp.toFixed(0)})`);
  if (mean < 60) warnings.push("Terlalu gelap"); if (mean > 200) warnings.push("Terlalu terang");
  if (clip / n > 0.05) warnings.push(`Silau/terpapar matahari (${(clip / n * 100).toFixed(0)}% piksel putih)`);
  if (Math.abs(cast) > 0.35) warnings.push(cast > 0 ? "Warna kemerahan/oranye (pantulan tenda?)" : "Warna kebiruan (pantulan tenda/bayangan?)");
  return { sharpness: +sharp.toFixed(0), brightness: +mean.toFixed(0), clipped_pct: +(clip / n * 100).toFixed(1), cast: +cast.toFixed(2), width: bmp.width, height: bmp.height, warnings };
}
// standar foto core: sisi panjang ≥ 3508 px = 300 dpi bila dicetak selebar A4 lanskap (11,69 in); file ditandai 300 dpi (JFIF)
// Status tolak foto core yang BERLAKU: foto yang sudah dinyatakan sesuai oleh verifier/pemilik dianggap DITERIMA walau AI menolaknya.
// Dipakai di semua tampilan supaya halaman lubang, menu Data, rilis client & notifikasi selalu sama.
const coreDitolak = (c) => (c?.reviewer_override === true ? false : !!c?.ditolak);
const FOTO_CORE_MIN_PX = 3508, FOTO_CORE_TOLAK_PX = 0; // SEMENTARA (24/11, permintaan pemilik): batas tolak resolusi dibuka — foto kecil hanya diberi catatan. ≥3508 standar 300 dpi A4 · 2400–3507 peringatan (masih terbaca di-zoom) · <2400 ditolak
async function dpi300(blob) {
  const b = new Uint8Array(await blob.arrayBuffer());
  // JFIF APP0: FF D8 FF E0 len(2) 'JFIF\0' ver(2) units(1) Xd(2) Yd(2)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[3] === 0xe0 && String.fromCharCode(...b.slice(6, 10)) === "JFIF") { b[13] = 1; b[14] = 1; b[15] = 44; b[16] = 1; b[17] = 44; return new Blob([b], { type: "image/jpeg" }); }
  return blob;
}
async function toJpeg(bmp, max, q) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return await new Promise((r) => c.toBlob(r, "image/jpeg", q));
}
const fmtD = (n) => Number(n).toFixed(2).replace(".", ",");
// Core run lebih panjang dari interval (SWELLING laterit/lempung) boleh disimpan s.d. 1,5× interval; remark otomatis "SWELLING".
// > 1,5× interval dianggap salah ketik. Hasil: null = lolos, "" = dibatalkan pengguna, teks = pesan galat.
function cekCoreRun(L) {
  const i0 = L.findIndex((x) => x.core === null || !Number.isFinite(x.core) || x.core < 0); if (i0 >= 0) return `Baris run ${i0 + 1}: isi core length (m).`;
  const i1 = L.findIndex((x) => x.core > (x.to - x.from) * 1.5 + 1e-9);
  if (i1 >= 0) return `Baris run ${i1 + 1}: core ${fmtD(L[i1].core)} m lebih dari 1,5× interval ${fmtD(L[i1].to - L[i1].from)} m — kemungkinan salah ketik. Periksa lagi.`;
  const sw = L.filter((x) => x.core > x.to - x.from + 0.005);
  if (sw.length && !confirm(`${sw.length} run punya core lebih panjang dari interval (SWELLING):\n${sw.map((x) => `• ${fmtD(x.from)}–${fmtD(x.to)} m: core ${fmtD(x.core)} m`).join("\n")}\n\nSimpan apa adanya? Remark otomatis diberi "SWELLING"; recovery rata-rata tetap dihitung maksimal 100%.`)) return "";
  for (const x of sw) if (!/swell/i.test(x.remark ?? "")) x.remark = x.remark ? `${x.remark}; SWELLING` : "SWELLING";
  return null;
}
async function coreView(v) {
  const bh = localStorage.getItem("bhid") || "", lastType = localStorage.getItem("coreType") || "UTUH";
  const qd = (await qAll()).filter((x) => x.kind === "core");
  v.innerHTML = `<div class="card"><h2>Foto core</h2>
   <div class="row"><div><label>Hole ID</label><input id="cb" data-bhid value="${esc(bh)}" autocapitalize="characters"></div><div><label>Jenis foto</label><select id="cty"><option value="UTUH" ${lastType === "UTUH" ? "selected" : ""}>Core UTUH</option><option value="BELAH" ${lastType === "BELAH" ? "selected" : ""}>Core BELAH</option></select></div></div>
   <p id="cl" class="muted"></p>
   <div class="row"><div><label>Kotak ke-</label><input id="cx" inputmode="numeric"></div><div><label>FROM (m)</label><input id="cf" inputmode="decimal"></div><div><label>TO (m)</label><input id="ct" inputmode="decimal"></div></div>
   <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="crt" style="width:auto"> Foto ulang kotak yang sudah pernah dikirim (mis. karena ditolak)</label>
   <p class="muted">Template SOP: 1 corebox per foto (maks. 5 m core), resolusi standar ≥ 3508 px sisi panjang (300 dpi cetak A4); sementara foto beresolusi lebih kecil tetap diterima (diberi catatan) — pakai resolusi kamera tertinggi, jangan mode hemat/kecil; teduh, meteran 0–100 cm, papan Hole ID · nomor kotak · kedalaman terbaca, kamera tegak lurus. Kotak dan kedalaman harus melanjutkan kotak sebelumnya.</p>
   <div class="big"><button id="cgo">📷 Ambil foto corebox</button><button id="cgg" class="sec">🖼️ Dari galeri<small>foto ulang / unggah manual</small></button></div>
   <p class="muted" style="margin:6px 0 0">Setiap kotak hanya <b>2 kali</b> diperiksa otomatis. Setelah itu foto terbaik diunggah <b>dari galeri</b> dan diperiksa verifier secara manual.</p>
   <input id="cfile" type="file" accept="image/*" capture="environment" class="hide"><input id="cfileG" type="file" accept="image/*" class="hide"><div id="lc"></div><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean foto core (${qd.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${qd.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.file_name)}${x.local_check.warnings.length ? `<br><span class="err">${x.local_check.warnings.map(esc).join(" · ")}</span>` : ""}${x.error ? `<br><span class="err">${esc(x.error)}</span>` : ""}${!(Number(x.depth_to) > Number(x.depth_from)) || x.error ? `<br><span class="muted">Kotak ${x.box_no ?? "?"} · ${fmtD(x.depth_from)}–${fmtD(x.depth_to)} m</span><br><button class="sec" data-qfix="${x.client_uuid}" style="flex:0;padding:4px 10px;margin-top:4px">Perbaiki FROM–TO</button> <button class="sec" data-qdel="${x.client_uuid}" style="flex:0;padding:4px 10px;margin-top:4px">Hapus dari antrean</button>` : ""}</span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
   <div class="card"><h3>Kelengkapan & kesesuaian SOP</h3><div class="row"><input id="kb" value="${esc(bh)}"><button id="kg" style="flex:0">Cek</button></div><div id="ko"></div></div>`;
  const num = (s) => Number(String(s).replace(",", "."));
  let nx = { lastBox: 0, lastTo: 0, box: 1, from: 0 };
  const isi = async () => {
    const bhid = bakuBH($("#cb").value), type = $("#cty").value; if (!bhid) { $("#cl").textContent = ""; return; }
    nx = await nextCore(bhid, type);
    $("#cl").innerHTML = nx.lastBox ? `Terakhir dikirim: <b>kotak ${nx.lastBox}</b> sampai <b>${fmtD(nx.lastTo)} m</b> (${type}). Lanjut kotak ${nx.box} dari ${fmtD(nx.from)} m.` : `Belum ada foto ${type} untuk ${esc(bhid)} — mulai kotak 1 dari 0,00 m.`;
    if (!$("#crt").checked) { $("#cx").value = nx.box; $("#cf").value = fmtD(nx.from); $("#ct").value = ""; }
  };
  $("#cb").onchange = isi; $("#cty").onchange = () => { localStorage.setItem("coreType", $("#cty").value); isi(); };
  $("#crt").onchange = () => { if (!$("#crt").checked) isi(); else { $("#cx").value = ""; $("#cf").value = ""; $("#ct").value = ""; $("#cx").focus(); } };
  await isi();
  let ambil = null; // nilai dikunci saat tombol ditekan; form bisa ter-reset (onchange Hole ID) saat kamera terbuka
  let pakaiGaleri = false;
  $("#cgg").onclick = () => { pakaiGaleri = true; $("#cgo").onclick(); };
  $("#cgo").onclick = async () => {
    const galeri = pakaiGaleri; pakaiGaleri = false;
    const f = num($("#cf").value), to = num($("#ct").value), box = parseInt($("#cx").value), retake = $("#crt").checked;
    if (!$("#cb").value.trim()) return ($("#e").textContent = "Isi Hole ID.");
    if (!(box > 0)) return ($("#e").textContent = "Isi nomor kotak.");
    if (!(isFinite(f) && isFinite(to) && to > f)) return ($("#e").textContent = "Isi FROM dan TO kotak ini (TO > FROM).");
    if (to - f > 5.0001) return ($("#e").textContent = `Ditolak: satu foto = satu corebox (isi 5 m), maksimal 5 m core per foto (isian ${fmtD(to - f)} m). Pisahkan menjadi beberapa foto/kotak.`);
    if (!retake) {
      if (box !== nx.box) return ($("#e").textContent = `Ditolak: kotak ${box} tidak melanjutkan kotak terakhir (${nx.lastBox}). Seharusnya kotak ${nx.box}. Bila ini foto ulang, centang “Foto ulang”.`);
      if (Math.abs(f - nx.from) > 0.02) return ($("#e").textContent = `Ditolak: FROM ${fmtD(f)} m tidak menyambung dengan TO kotak sebelumnya (${fmtD(nx.from)} m).`);
    } else if (box > nx.lastBox) return ($("#e").textContent = `Ditolak: kotak ${box} belum pernah dikirim, jadi bukan foto ulang. Hilangkan centang “Foto ulang”.`);
    $("#e").textContent = ""; ambil = { bhid: bakuBH($("#cb").value), type: $("#cty").value, f, to, box };
    if (retake && !galeri && online()) { // batas 2 kali pemeriksaan AI per kotak
      const { data: cek } = await sb.from("core_photo").select("ai_kali").eq("bhid", ambil.bhid).eq("photo_type", ambil.type).eq("depth_from", f).eq("depth_to", to);
      const n = (cek ?? []).reduce((s, r) => s + (r.ai_kali ?? 0), 0);
      if (n >= 2) { $("#e").textContent = "Kotak ini sudah 2 kali diperiksa otomatis. Unggah foto terbaik dari galeri (tombol 🖼️ Dari galeri); foto akan diperiksa verifier secara manual."; return; }
    }
    (galeri ? $("#cfileG") : $("#cfile")).click();
  };
  $("#cfileG").onchange = (ev) => $("#cfile").onchange(ev);
  $("#cfile").onchange = async (ev) => {
    const file = ev.target.files[0]; if (!file) return; ev.target.value = "";
    const bmp = await createImageBitmap(file); const lc = await localCheck(bmp);
    if (!ambil) return ($("#e").textContent = "Isi Kotak, FROM dan TO lalu tekan tombol Ambil foto corebox.");
    const { bhid, type, f, to, box } = ambil;
    if (!(Number.isFinite(f) && Number.isFinite(to) && to > f && to - f <= 5.0001)) return ($("#e").textContent = `Foto tidak disimpan: FROM–TO tidak valid (${fmtD(f)}–${fmtD(to)} m). Isi ulang lalu foto lagi.`);
    const sisi = Math.max(lc.width, lc.height);
    if (sisi < FOTO_CORE_TOLAK_PX) return ($("#e").textContent = `Ditolak sebelum dikirim: resolusi foto ${lc.width}×${lc.height} px terlalu kecil (minimal ${FOTO_CORE_TOLAK_PX} px sisi panjang ≈ 5 MP); tulisan di corebox tidak akan terbaca bila di-zoom. Atur kamera HP ke resolusi tertinggi (bukan mode kecil/hemat/zoom digital) lalu foto ulang.`);
    if (sisi < FOTO_CORE_MIN_PX) lc.warnings.push(`Resolusi ${lc.width}×${lc.height} px di bawah standar ${FOTO_CORE_MIN_PX} px (300 dpi cetak A4), tetapi masih bisa dibaca bila di-zoom. Tetap simpan bila HP tidak bisa lebih tinggi.`);
    if (lc.sharpness < 25 || lc.brightness < 45) return ($("#e").textContent = `Ditolak sebelum dikirim: ${lc.sharpness < 25 ? "foto terlalu buram" : "foto terlalu gelap"}. Ambil ulang di tempat teduh yang terang dan HP tidak bergoyang.`);
    const save = async () => {
      const fn = `${bhid}_K${box}_${fmtD(f)}-${fmtD(to)}_${type}.jpg`;
      await qPut({ kind: "core", client_uuid: crypto.randomUUID(), bhid, box_no: box, depth_from: f, depth_to: to, photo_type: type, file_name: fn,
        blob: await dpi300(await toJpeg(bmp, 4961, 0.92)), preview: await toJpeg(bmp, 1600, 0.85), local_check: { ...lc, dpi: 300, cetak_a4_dpi: Math.round(Math.min(4961, Math.max(lc.width, lc.height)) / 11.69) }, captured_at: new Date().toISOString() });
      const H = JSON.parse(localStorage.getItem("coreHist") || "{}"), k = `${type}|${bhid}`;
      H[k] = { box: Math.max(H[k]?.box ?? 0, box ?? 0), to: Math.max(Number(H[k]?.to ?? 0), to) }; localStorage.setItem("coreHist", JSON.stringify(H));
      localStorage.setItem("bhid", bhid); render(); sync();
    };
    if (!lc.warnings.length) return save();
    $("#lc").innerHTML = `<div class="card" style="background:#FBE6D0"><b>Foto mungkin tidak sesuai SOP:</b><ul>${lc.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      <div class="row"><button id="rt">Ambil ulang</button><button class="sec" id="ks">Tetap simpan</button></div></div>`;
    $("#rt").onclick = () => { $("#lc").innerHTML = ""; $("#cgo").onclick(); };
    $("#ks").onclick = save;
  };
  $("#sy").onclick = sync;
  v.querySelectorAll("[data-qdel]").forEach((b) => (b.onclick = async () => { if (!confirm("Hapus foto ini dari antrean? Foto belum terkirim dan akan hilang dari HP.")) return;
    const it = (await qAll()).find((x) => x.client_uuid === b.dataset.qdel), H = JSON.parse(localStorage.getItem("coreHist") || "{}"), k = it && `${it.photo_type}|${it.bhid}`;
    if (it && H[k] && H[k].box === it.box_no) { H[k] = { box: Math.max(0, (it.box_no ?? 1) - 1), to: Number(it.depth_from) || 0 }; localStorage.setItem("coreHist", JSON.stringify(H)); }
    await qDel(b.dataset.qdel); render(); }));
  v.querySelectorAll("[data-qfix]").forEach((b) => (b.onclick = async () => {
    const it = (await qAll()).find((x) => x.client_uuid === b.dataset.qfix); if (!it) return render();
    const fs = prompt(`FROM (m) untuk ${it.bhid} kotak ${it.box_no ?? "?"}:`, fmtD(it.depth_from)); if (fs == null) return;
    const ts = prompt("TO (m):", Number(it.depth_to) > Number(it.depth_from) ? fmtD(it.depth_to) : ""); if (ts == null) return;
    const f = num(fs), to = num(ts);
    if (!(Number.isFinite(f) && Number.isFinite(to) && to > f)) return alert("TO harus lebih besar dari FROM.");
    if (to - f > 5.0001) return alert("Maksimal 5 m per foto (satu corebox).");
    const H = JSON.parse(localStorage.getItem("coreHist") || "{}"), k = `${it.photo_type}|${it.bhid}`; if (H[k]) { H[k].to = Math.max(Number(H[k].to) || 0, to); localStorage.setItem("coreHist", JSON.stringify(H)); }
    await qPut({ ...it, depth_from: f, depth_to: to, file_name: `${it.bhid}_K${it.box_no}_${fmtD(f)}-${fmtD(to)}_${it.photo_type}.jpg`, error: null }); render(); sync();
  }));
  $("#kg").onclick = () => coverage($("#kb").value.trim().toUpperCase());
  if (bh && navigator.onLine) coverage(bh);
}
async function coverage(bh) {
  const ko = $("#ko"); ko.innerHTML = `<p class="muted">Memuat…</p>`;
  const [{ data: s, error }, { data: ph }] = await Promise.all([
    sb.from("v_sample_photo").select("sample_no,seq,depth_from,depth_to,geozone_id,belah_wajib,chk_foto_utuh,chk_foto_belah").eq("bhid", bh).order("depth_from"),
    sb.from("core_photo").select("id,file_name,photo_type,box_no,depth_from,depth_to,status,sop_ok,sop_issues,reviewer_override,review_note,preview_path,error,ditolak,alasan_tolak").eq("bhid", bh).order("photo_type").order("depth_from"),
  ]);
  if (error) return (ko.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const bad = (x) => x && x !== "OK";
  const nBad = (s ?? []).filter((r) => bad(r.chk_foto_utuh) || bad(r.chk_foto_belah)).length;
  // celah antar kotak foto (per jenis)
  const gaps = [];
  for (const t of ["UTUH", "BELAH"]) {
    const arr = (ph ?? []).filter((p) => p.photo_type === t).sort((a, b) => a.depth_from - b.depth_from); let end = null;
    for (const p of arr) { if (end !== null && p.depth_from > end + 0.02) gaps.push(`${t}: ${fmtD(end)}–${fmtD(p.depth_from)} m belum difoto`); if (end !== null && p.depth_from < end - 0.02) gaps.push(`${t}: ${fmtD(p.depth_from)}–${fmtD(Math.min(end, p.depth_to))} m difoto dobel`); end = Math.max(end ?? 0, p.depth_to); }
  }
  const isV = ["verifier", "admin"].includes(me?.role);
  ko.innerHTML = `<p><b>${nBad ? `${nBad} conto belum lengkap / tidak sesuai SOP` : (s?.length ? "Semua conto lengkap dan sesuai SOP" : "Belum ada data logging untuk Hole ID ini")}</b></p>
   ${gaps.length ? `<p class="err">${gaps.map(esc).join("<br>")}</p>` : ""}
   ${s?.length ? `<div class="tw"><table><tr><th>Conto</th><th>FROM–TO</th><th>Foto utuh</th><th>Foto belah</th></tr>${s.map((r) => `<tr><td>${r.seq}${esc(r.geozone_id ?? "")}</td><td>${fmtD(r.depth_from)}–${fmtD(r.depth_to)}</td>
     <td style="${bad(r.chk_foto_utuh) ? "background:#F6C9C3" : ""}">${esc(r.chk_foto_utuh)}</td><td style="${bad(r.chk_foto_belah) ? "background:#F6C9C3" : ""}">${esc(r.chk_foto_belah ?? "tidak wajib")}</td></tr>`).join("")}</table></div>` : ""}
   <h3>Foto (${ph?.length ?? 0})</h3><ul class="list">${(ph ?? []).map((p) => { const ok = p.reviewer_override ?? p.sop_ok;
     return `<li><span class="pill ${p.status === "CHECKED" ? (ok ? "APPROVED" : "REJECTED") : p.status}">${p.status === "CHECKED" ? (ok ? "SESUAI SOP" : "TIDAK SESUAI") : p.status}</span><span style="flex:1">${esc(p.file_name)}
       ${coreDitolak(p) ? `<br><b class="err">DITOLAK: ${esc(p.alasan_tolak ?? "")}</b>` : ""}${(p.sop_issues ?? []).length && !ok ? `<br><span class="err">${p.sop_issues.map(esc).join("<br>")}</span>` : ""}${p.error ? `<br><span class="err">${esc(p.error)}</span>` : ""}${p.review_note ? `<br><span class="muted">Catatan: ${esc(p.review_note)}</span>` : ""}</span>
       <button class="sec" data-pv="${esc(p.preview_path)}" style="flex:0">Lihat</button>${isV && p.status !== "PROCESSING" ? `<button class="sec" data-prk="${p.id}" style="flex:0">Periksa / koreksi</button>` : ""}${isV && p.status === "ERROR" ? `<button class="sec" data-re="${p.id}" style="flex:0">Cek ulang</button>` : ""}${me?.role === "admin" ? `<button class="danger" data-delp="${p.id}" style="flex:0">Hapus</button>` : ""}</li>`; }).join("") || `<li class="muted">Belum ada foto core.</li>`}</ul><div id="pvw"></div>`;
  ko.querySelectorAll("[data-pv]").forEach((b) => (b.onclick = async () => {
    const { data } = await sb.storage.from("core-photos").createSignedUrl(b.dataset.pv, 600);
    $("#pvw").innerHTML = `<img src="${data?.signedUrl ?? ""}" alt="Foto core" style="width:100%;border-radius:8px">`; $("#pvw").scrollIntoView({ behavior: "smooth" });
  }));
  // v.16: Periksa foto core — pemeriksa bisa mengoreksi Hole ID / kotak / kedalaman / jenis, lalu "Terima & simpan":
  // koreksi + status diterima langsung tersimpan ke database (RPC terima_foto_core, alasan wajib, tercatat di catatan foto).
  // Berlaku juga untuk foto yang belum/gagal dicek otomatis (UPLOADED/ERROR).
  ko.querySelectorAll("[data-prk]").forEach((b) => (b.onclick = async () => {
    const p = (ph ?? []).find((x) => x.id === b.dataset.prk); if (!p) return;
    const { data: u } = await sb.storage.from("core-photos").createSignedUrl(p.preview_path, 600);
    $("#pvw").innerHTML = `<div class="card" style="border:2px solid #2B6CB0"><h3 style="margin-top:0">Periksa foto core</h3><p class="muted" style="margin:0 0 6px">${esc(p.file_name)} · status ${esc(p.status)}</p>
      <img src="${u?.signedUrl ?? ""}" alt="Foto core" style="width:100%;border-radius:8px">
      <p class="muted">Cocokkan dengan foto. Ubah isian yang salah, tulis alasan, lalu <b>Terima & simpan</b> — semua koreksi langsung tersimpan ke database dan tercatat.</p>
      <div class="row"><label style="flex:2">Hole ID<input id="kfB" value="${esc(p.bhid)}"></label><label style="flex:1">Kotak<input id="kfK" inputmode="numeric" value="${esc(p.box_no ?? "")}"></label></div>
      <div class="row"><label>Dari (m)<input id="kfF" inputmode="decimal" value="${esc(p.depth_from)}"></label><label>Sampai (m)<input id="kfT" inputmode="decimal" value="${esc(p.depth_to)}"></label>
       <label>Jenis<select id="kfJ"><option ${p.photo_type === "UTUH" ? "selected" : ""}>UTUH</option><option ${p.photo_type === "BELAH" ? "selected" : ""}>BELAH</option></select></label></div>
      <label>Alasan / catatan pemeriksaan (wajib)<textarea id="kfN" rows="2" placeholder="mis. kedalaman di label kotak 5–8 m; sesuai SOP"></textarea></label>
      <div class="row" style="margin-top:8px"><button id="kfOk">✅ Terima & simpan</button><button class="danger" id="kfNo">✖ Tidak sesuai SOP</button><button class="sec" id="kfX" style="flex:0">Batal</button></div><div id="kfE" class="err"></div></div>`;
    $("#pvw").scrollIntoView({ behavior: "smooth" });
    $("#kfX").onclick = () => ($("#pvw").innerHTML = "");
    const kirim = async (terima) => {
      const n = (x) => { const t = String(x ?? "").trim().replace(",", "."); return t === "" ? null : Number(t); };
      const f = n($("#kfF").value), t = n($("#kfT").value), k = n($("#kfK").value), note = $("#kfN").value.trim();
      if (!note) return ($("#kfE").textContent = "Tulis alasan / catatan pemeriksaan.");
      if ([f, t, k].some((x) => x !== null && !isFinite(x))) return ($("#kfE").textContent = "Kotak dan kedalaman harus angka.");
      if (f === null || t === null || t <= f) return ($("#kfE").textContent = "Kedalaman Dari harus lebih kecil dari Sampai.");
      $("#kfOk").disabled = $("#kfNo").disabled = true;
      const { data: r, error } = await sb.rpc("terima_foto_core", { p_id: p.id, p_bhid: $("#kfB").value.trim(), p_box: k, p_from: f, p_to: t, p_type: $("#kfJ").value, p_terima: terima, p_note: note });
      $("#kfOk").disabled = $("#kfNo").disabled = false;
      if (error) return ($("#kfE").textContent = error.message);
      toast(`${terima ? "Diterima & tersimpan" : "Ditandai tidak sesuai"}${r?.koreksi?.length ? ` · koreksi: ${r.koreksi.join(", ")}` : ""}`);
      coverage(bh);
    };
    $("#kfOk").onclick = () => kirim(true); $("#kfNo").onclick = () => kirim(false);
  }));
  ko.querySelectorAll("[data-delp]").forEach((b) => (b.onclick = async () => { if (await adminDelete("core_photo", b.dataset.delp, "foto core")) coverage(bh); }));
  ko.querySelectorAll("[data-re]").forEach((b) => (b.onclick = async () => { await sb.functions.invoke("check-core-photo", { body: { photo_id: b.dataset.re } }); coverage(bh); }));
}

// ---------- progres pemboran (foto bergeotag) & P2H ----------
const EV = { MASUK: "Masuk shift", MULAI_BOR: "Mulai bor", RUN: "Angkat run (core)", GANTI_MATA_BOR: "Ganti mata bor", TAMBAH_STANG: "Tambah stang",
  STANDBY: "Standby", PERBAIKAN: "Perbaikan / kerusakan", SELESAI_BOR: "Selesai bor", PINDAH_TITIK: "Pindah titik", KELUAR: "Keluar shift", LAINNYA: "Lainnya",
  FOTO_DRILL_PAD: "Foto drill pad (akhir lubang)", FOTO_PATOK: "Foto patok lubang (EOH/STB)", FOTO_AKHIR: "Drill pad & patok" };
const P2H_DEFAULT = ["Oli mesin (level & bocoran)", "Oli hidrolik (level & bocoran)", "Air radiator / pendingin", "Bahan bakar", "Aki & kabel kelistrikan", "Selang hidrolik & sambungan",
  "Wire rope / winch / hoist", "Mast / menara & pengunci", "Stang bor (rod) & core barrel", "Pompa air & selang sirkulasi", "Pelindung bagian berputar (guard)", "Tombol emergency stop",
  "APAR (alat pemadam)", "Kotak P3K", "Rambu & barikade area bor", "Kebersihan & tumpahan oli (housekeeping)", "APD kru lengkap"];
function getPos() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), t: new Date(p.timestamp).toISOString() }),
      () => res(null), { enableHighAccuracy: true, timeout: 25000, maximumAge: 60000 });
  });
}
const fmtT = (d) => new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
async function stampPhoto(file, lines) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) }), x = c.getContext("2d");
  x.drawImage(bmp, 0, 0, c.width, c.height);
  const fs = Math.max(16, Math.round(c.width / 45)), h = fs * 1.35 * lines.length + fs;
  x.fillStyle = "rgba(0,0,0,0.6)"; x.fillRect(0, c.height - h, c.width, h);
  x.fillStyle = "#fff"; x.font = `600 ${fs}px sans-serif`;
  lines.forEach((l, i) => x.fillText(l, fs * 0.6, c.height - h + fs * 1.25 * (i + 1)));
  return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
}
async function syncProg(it) {
  const path = `${session.user.id}/${it.rig}/${it.client_uuid}.jpg`;
  if (it.blob) {
    const up = await sb.storage.from("progress-photos").upload(path, it.blob, { contentType: "image/jpeg", upsert: false });
    if (up.error && !/exists|Duplicate/i.test(up.error.message)) { it.error = up.error.message; await qPut(it); return; }
  }
  const row = { ...it.row, client_uuid: it.client_uuid, photo_path: it.blob ? path : null };
  const ins = await sb.from(it.kind === "p2h" ? "p2h_check" : "drill_event").upsert(row, { onConflict: "client_uuid", ignoreDuplicates: true });
  if (ins.error) { it.error = ins.error.message; await qPut(it); return; }
  await qDel(it.client_uuid);
}
// Penampil foto nota: cubit dua jari / tombol + − untuk memperbesar, geser untuk melihat bagian lain.
function lihatZoom(blob) {
  const u = URL.createObjectURL(blob), v = document.createElement("div");
  v.style.cssText = "position:fixed;inset:0;z-index:70;background:#000;display:flex;flex-direction:column";
  v.innerHTML = `<div style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y pinch-zoom" id="zW"><img id="zI" src="${u}" style="display:block;width:100%;margin:auto"></div>
    <div style="display:flex;gap:6px;padding:8px;padding-bottom:calc(8px + env(safe-area-inset-bottom));background:#12251E">
    <button class="sec" id="zK" style="flex:1">−</button><button class="sec" id="zP" style="flex:1">＋</button><button class="sec" id="zR" style="flex:1">Pas layar</button><button id="zX" style="flex:1.4">Tutup</button></div>`;
  document.body.appendChild(v);
  let k = 1; const I = v.querySelector("#zI"), set = (x) => { k = Math.min(5, Math.max(1, x)); I.style.width = `${k * 100}%`; };
  v.querySelector("#zP").onclick = () => set(k * 1.5); v.querySelector("#zK").onclick = () => set(k / 1.5); v.querySelector("#zR").onclick = () => set(1);
  let d0 = 0, k0 = 1; const W = v.querySelector("#zW");
  W.addEventListener("touchstart", (e) => { if (e.touches.length === 2) { d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); k0 = k; } }, { passive: true });
  W.addEventListener("touchmove", (e) => { if (e.touches.length === 2 && d0) { e.preventDefault(); set(k0 * Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) / d0); } }, { passive: false });
  W.addEventListener("touchend", () => { d0 = 0; });
  v.querySelector("#zX").onclick = () => { v.remove(); URL.revokeObjectURL(u); };
}
function modal(html) {
  const m = document.createElement("div");
  // Lapisan luar yang menggulir (bukan kartu di dalamnya): di HP form panjang tetap bisa digeser sampai tombol paling bawah,
  // juga saat keyboard terbuka atau halaman di-zoom (cubit dua jari tetap diizinkan).
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:flex;flex-direction:column;align-items:center;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-x pan-y pinch-zoom";
  m.innerHTML = `<div class="card" style="width:min(560px,100%);margin:auto 0 0;padding-bottom:calc(14px + env(safe-area-inset-bottom));border-radius:16px 16px 0 0;flex:none">${html}</div>`;
  document.body.appendChild(m); return m;
}
// ---------- Personil hadir per shift (dicatat saat Masuk / Keluar shift di Progres bor) ----------
const JABATAN = ["WSG", "Driller", "Helper", "Mekanik", "Lainnya"];
const shiftDari = (d) => { const w = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })), h = w.getHours();
  const t = new Date(w.getTime() - 6 * 36e5); const tgl = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return { tanggal: tgl, shift: h >= 6 && h < 18 ? "PAGI" : "MALAM" }; };
const kunciPersonil = (rig, tgl, sh) => `personil|${rig}|${tgl}|${sh}`;
// Daftar personil resmi (diisi admin). Disimpan di HP agar tetap bisa dipilih tanpa sinyal.
const masterPersonil = () => JSON.parse(localStorage.getItem("masterPersonil") || "[]");
const kunciNama = (x) => String(x ?? "").trim().replace(/\s+/g, " ").toUpperCase();
async function loadPersonil() {
  if (!online()) return masterPersonil();
  const { data, error } = await sb.from("personil").select("id,project,nama,jabatan,rigs,status,aktif").neq("status", "DITOLAK").order("nama");
  if (!error) localStorage.setItem("masterPersonil", JSON.stringify(data ?? []));
  return masterPersonil();
}
const resmiDi = (rig) => masterPersonil().filter((p) => p.status === "RESMI" && p.aktif && (!myTugas?.project || p.project === myTugas.project) && (!rig || !(p.rigs ?? []).length || p.rigs.includes(rig)));
// Cek titik GPS terhadap batas IUP (poligon lon/lat dari tabel wilayah; tersimpan di HP agar jalan tanpa sinyal)
const diDalam = (lon, lat, T) => { let c = false; for (let i = 0, j = T.length - 1; i < T.length; j = i++) { const a = T[i], b = T[j];
  if ((a.lat > lat) !== (b.lat > lat) && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) c = !c; } return c; };
const cekIUP = (lon, lat) => { const W = JSON.parse(localStorage.getItem("wilayah") || "[]"); if (!W.length) return null;
  const masuk = W.find((w) => diDalam(lon, lat, w.titik ?? [])); return masuk ? { dalam: true, nama: masuk.nama } : { dalam: false, nama: W.map((w) => w.nama).join(", ") }; };
const crewMin = () => Number(localStorage.getItem("crewMin")) || 4;   // qc_param CREW_MIN: driller + helper/mekanik, tanpa WSG
const jabatanSaya = () => (me?.role === "geologist" ? "WSG" : me?.role === "driller" ? "Driller" : "Lainnya");
function personilAwal(rig, t, capturedAt) {
  const { tanggal, shift } = shiftDari(capturedAt), hariIni = JSON.parse(localStorage.getItem(kunciPersonil(rig, tanggal, shift)) || "null");
  const M = resmiDi(rig).map((p) => ({ nama: p.nama, jabatan: p.jabatan }));
  let L = t === "KELUAR" && hariIni ? hariIni : hariIni ?? (M.length ? M : JSON.parse(localStorage.getItem(`personilLast|${rig}`) || "[]"));
  L = L.map((x) => ({ ...x }));
  if (t === "MASUK" && me?.full_name && !L.some((x) => x.nama.toUpperCase() === me.full_name.toUpperCase())) L.unshift({ nama: me.full_name, jabatan: jabatanSaya() });
  if (!L.some((x) => x.jabatan === "WSG")) L.unshift({ nama: "", jabatan: "WSG" });
  if (!L.some((x) => x.jabatan === "Driller")) L.push({ nama: "", jabatan: "Driller" });
  while (t === "MASUK" && L.filter((x) => x.jabatan !== "WSG").length < crewMin()) L.push({ nama: "", jabatan: "Helper" });
  return L.sort((a, b) => JABATAN.indexOf(a.jabatan) - JABATAN.indexOf(b.jabatan));
}
function personilEditor(box, list) {
  const rigNow = localStorage.getItem("rig") || "", resmi = resmiDi(rigNow), semua = resmiDi(""), R = Object.fromEntries(semua.map((p) => [kunciNama(p.nama), p]));
  const riwayat = [...new Set([...resmi.map((p) => p.nama), ...semua.map((p) => p.nama)])];
  const baris = (x) => `<div class="row" data-ps style="align-items:center;margin-top:4px"><select style="flex:0 0 112px">${JABATAN.map((j) => `<option ${x.jabatan === j ? "selected" : ""}>${j}</option>`).join("")}</select>
    <input value="${esc(x.nama)}" placeholder="Pilih / ketik nama" list="dlNama" autocapitalize="words"><span data-st style="flex:0 0 18px;text-align:center"></span><button class="sec" data-hp style="flex:0;padding:8px 12px">✕</button></div>`;
  box.innerHTML = `<datalist id="dlNama">${riwayat.map((n) => `<option value="${esc(n)}">`).join("")}</datalist><div data-pl>${list.map(baris).join("")}</div>
    <button class="sec" data-pa style="width:auto;margin-top:6px">+ personil</button><div class="muted" data-pc style="margin-top:4px"></div>`;
  const hitung = () => { const L = ambilPersonil(box), n = (j) => L.filter((x) => x.jabatan === j).length;
    const cr = L.length - n("WSG"), kos = [...box.querySelectorAll("[data-ps] input")].filter((x) => !x.value.trim()).length;
    box.querySelectorAll("[data-ps]").forEach((r) => { const v = r.querySelector("input").value.trim(), o = R[kunciNama(v)];
      r.querySelector("[data-st]").innerHTML = !v ? "" : o ? `<span title="Terdaftar" style="color:var(--green)">✓</span>` : `<span title="Belum terdaftar — diusulkan ke admin" style="color:#B26B00">?</span>`; });
    const baru = L.filter((x) => !R[kunciNama(x.nama)]).length;
    box.querySelector("[data-pc]").innerHTML = (baru ? `<span style="color:#B26B00">${baru} nama belum terdaftar (?) — akan diusulkan ke admin.</span><br>` : "") + `${L.length} orang · WSG ${n("WSG")} · <b style="color:${cr < crewMin() ? "var(--red)" : "inherit"}">crew ${cr}/${crewMin()}</b> (driller ${n("Driller")})${kos ? ` · <span style="color:var(--red)">${kos} nama kosong</span>` : ""}`; };
  const pasang = () => { box.querySelectorAll("[data-hp]").forEach((b) => (b.onclick = () => { b.closest("[data-ps]").remove(); hitung(); })); box.querySelectorAll("[data-ps] input,[data-ps] select").forEach((x) => (x.oninput = hitung));
    box.querySelectorAll("[data-ps] input").forEach((x) => (x.onchange = () => { const o = R[kunciNama(x.value)]; if (o) { x.value = o.nama; x.closest("[data-ps]").querySelector("select").value = o.jabatan; } hitung(); })); };
  box.querySelector("[data-pa]").onclick = () => { box.querySelector("[data-pl]").insertAdjacentHTML("beforeend", baris({ nama: "", jabatan: "Helper" })); pasang(); box.querySelector("[data-pl] [data-ps]:last-child input").focus(); hitung(); };
  pasang(); hitung();
}
const ambilPersonil = (box) => [...box.querySelectorAll("[data-ps]")].map((r) => ({ jabatan: r.querySelector("select").value, nama: r.querySelector("input").value.trim().replace(/\s+/g, " ") })).filter((x) => x.nama);
function simpanPersonilLokal(rig, capturedAt, t, L) {
  const { tanggal, shift } = shiftDari(capturedAt);
  if (t === "MASUK") { localStorage.setItem(kunciPersonil(rig, tanggal, shift), JSON.stringify(L)); localStorage.setItem(`personilLast|${rig}`, JSON.stringify(L)); }
  const r = new Set(JSON.parse(localStorage.getItem("namaPersonil") || "[]")); L.forEach((x) => r.add(x.nama));
  localStorage.setItem("namaPersonil", JSON.stringify([...r].sort().slice(-300)));
}
async function progView(v) {
  const tok = (progView.tok = (progView.tok ?? 0) + 1);
  const rig = localStorage.getItem("rig") || "", bh = localStorage.getItem("bhid") || "", shift = localStorage.getItem("shift") || "PAGI";
  const q = (await qAll()).filter((x) => x.kind === "event" || x.kind === "p2h" || x.kind === "marking");
  if (tok !== progView.tok) return;
  v.innerHTML = `<div class="card"><h2>Progres pemboran</h2>
   <div class="row"><div><label>Rig</label>${rigField()}</div>
   <div><label>Hole ID</label><input id="pb" data-bhid value="${esc(bh)}" autocapitalize="characters"></div>
   <div style="flex:0.7"><label>Shift</label><select id="sh"><option ${shift === "PAGI" ? "selected" : ""}>PAGI</option><option ${shift === "MALAM" ? "selected" : ""}>MALAM</option></select></div>
   <div style="flex:0.8"><label>Jenis pemboran</label>${pilihJenisBor("jb", bh)}</div></div>
   <p class="muted" id="jbInfo" style="margin:2px 0 0"></p>
   <p class="muted">Setiap tombol membuka kamera (atau galeri bila kotak 🖼️ di bawah dicentang). Koordinat GPS dan jam dicatat otomatis dan dicetak di foto. GPS tetap jalan tanpa sinyal internet.</p>
   <div class="big">
    <button data-ev="MASUK">Masuk shift<small>foto kru di lokasi</small></button>
    <button data-p2h="1" class="sec">P2H rig<small>wajib sebelum mulai bor</small></button>
    <button data-ev="MULAI_BOR">Mulai bor<small>foto rig di titik bor</small></button>
    <button data-ev="ACT">Foto aktivitas<small>angkat run · ganti mata bor · tambah stang · standby · lainnya</small></button>
    <button data-ev="SELESAI_BOR">Selesai bor / stop<small>foto akhir</small></button>
    <button data-ev="FOTO_AKHIR">📸 Drill pad & patok<small>wajib setelah EOH/STB · 2 foto: drill pad lalu patok</small></button>
    <button data-ev="KELUAR" class="sec">Keluar shift</button>
    ${isStaff() ? `<button data-mk="1" class="sec">📍 Marking titik<small>koordinat GPS + akurasi · boleh berkali-kali</small></button><button data-ko="1" class="sec">🧭 Koordinat lubang<small>isi / koreksi manual koordinat collar</small></button>` : ""}
   </div>
   <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:400"><input type="checkbox" id="pgal" style="width:auto;flex:0">🖼️ Ambil foto dari galeri<span class="muted">— bila foto kamera hilang/terhapus; jam & GPS dibaca dari foto</span></label>
   <input id="pf" type="file" accept="image/*" capture="environment" class="hide"><input id="pfG" type="file" accept="image/*" class="hide"><div id="e" class="err"></div></div>
   <div class="card" id="susulan" style="display:none"></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean progres di HP (${q.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${q.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.kind === "p2h" ? "P2H " + (x.row.layak_operasi ? "LAYAK" : "TIDAK LAYAK") : x.kind === "marking" ? `Marking ±${x.row.akurasi_m} m` : EV[x.row.event_type] + (x.row.note ? " (galeri)" : ""))} · ${esc(x.row.rig)} ${esc(x.row.bhid ?? "")}<br><span class="muted">${fmtT(x.row.captured_at)}${x.row.lat ? "" : " · tanpa GPS"}${x.error ? " · gagal: " + esc(x.error) : ""}</span></span>${x.error || !EV[x.row?.event_type] && x.kind === "event" ? `<button class="sec" data-qdel="${esc(x.client_uuid)}" title="Hapus dari antrean" style="flex:0;padding:4px 10px">🗑</button>` : ""}</li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
   <div class="card"><h3>Hari ini (terkirim)</h3><div id="today" class="muted">${navigator.onLine && !session.offline ? "Memuat…" : "Offline — tampil saat ada sinyal."}</div></div>`;
  v.querySelectorAll("[data-qdel]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus data ini dari antrean HP? Data yang gagal tidak akan pernah terkirim; setelah dihapus, ambil/unggah ulang fotonya.")) return;
    await qDel(b.dataset.qdel); b.closest("li").remove(); cekAntreLama(); toast("Data dihapus dari antrean");
  }));
  const keep = () => { const b = bhJenis($("#pb").value, $("#jb").value); if (b) $("#pb").value = b; localStorage.setItem("rig", $("#rg").value.trim().toUpperCase()); localStorage.setItem("bhid", b); localStorage.setItem("shift", $("#sh").value); jbInfo(); };
  const jbInfo = () => { const b = $("#pb").value.trim(); $("#jbInfo").innerHTML = $("#jb").value === "REDRILL" ? `🔁 <b>REDRILL</b> — Hole ID <b>${esc(b || "…R")}</b>, run mulai dari 0 dan meternya terpisah dari lubang utama.` : ""; };
  $("#jb").onchange = keep; $("#pb").addEventListener("change", () => { $("#jb").value = jenisDariBH(bakuBH($("#pb").value)); keep(); }); jbInfo();
  let pending = null, dariGaleri = false;
  v.querySelectorAll("[data-ev]").forEach((b) => (b.onclick = () => {
    if (sessionStorage.getItem("akhirLanjut")) sessionStorage.removeItem("akhirLanjut"); else sessionStorage.removeItem("susulanBH");
    keep(); if (!localStorage.getItem("rig")) return ($("#e").textContent = "Isi nama rig dulu.");
    if (b.dataset.ev !== "MASUK" && b.dataset.ev !== "KELUAR" && !localStorage.getItem("bhid") && !sessionStorage.getItem("susulanBH")) return ($("#e").textContent = "Isi Hole ID dulu.");
    $("#e").textContent = ""; pending = b.dataset.ev; dariGaleri = $("#pgal").checked; (dariGaleri ? $("#pfG") : $("#pf")).click();
  }));
  v.querySelector("[data-mk]")?.addEventListener("click", () => { keep(); markingForm(); });
  if (isStaff()) peringatanMarking(v.querySelector(".card"), (b) => { $("#pb").value = b; $("#jb").value = jenisDariBH(b); keep(); markingForm(); }); else titikBelumMarking().catch(() => {});
  v.querySelector("[data-ko]")?.addEventListener("click", () => { keep(); koordinatLubang(localStorage.getItem("bhid") || ""); });
  // 📸 Foto susulan drill pad & patok untuk lubang lama (DDR sudah masuk, rig sudah pindah): Hole ID & rig diambil dari lubang itu, bukan dari isian di atas
  const mulaiSusulan = (bhid, rig) => { sessionStorage.setItem("susulanBH", JSON.stringify({ bhid, rig })); sessionStorage.setItem("akhirNext", "FOTO_DRILL_PAD");
    $("#e").textContent = ""; pending = "FOTO_AKHIR"; dariGaleri = $("#pgal").checked; (dariGaleri ? $("#pfG") : $("#pf")).click(); };
  v.querySelector("[data-p2h]").onclick = () => { keep(); if (!localStorage.getItem("rig")) return ($("#e").textContent = "Isi nama rig dulu."); p2hForm(); };
  $("#pfG").onchange = (ev) => $("#pf").onchange(ev);
  $("#pf").onchange = async (ev) => {
    const f0 = ev.target.files[0]; ev.target.value = ""; if (!f0) return;
    const gal = dariGaleri; dariGaleri = false;
    const file = await pratinjauFoto(f0, `Foto ${EV[pending] ?? "aktivitas"}${gal ? " (galeri)" : ""}`); if (!file) return;
    // Foto galeri: jam & GPS diambil dari data foto (EXIF) bila ada, bukan dari jam/lokasi HP saat ini.
    const ex = gal ? await bacaExif(file) : {};
    let capturedAt = gal ? ex.time ?? new Date(file.lastModified) : new Date();
    let age = Math.round((Date.now() - (gal ? capturedAt.getTime() : file.lastModified)) / 1000);
    // v.35: foto dari GALERI → koordinat foto = koordinat lubang (Hole ID yang dipilih): collar, lalu titik rencana; GPS data foto hanya cadangan
    const bhGal = gal ? ((pending === "FOTO_AKHIR" ? JSON.parse(sessionStorage.getItem("susulanBH") || "null")?.bhid : null) || localStorage.getItem("bhid")) : null;
    const posP = gal ? posLubang(bhGal).then((h) => (h ? { ...h, t: capturedAt.toISOString() } : ex.lat != null ? { lat: ex.lat, lon: ex.lon, acc: null, t: capturedAt.toISOString(), sumber: "data foto" } : null)).catch(() => null) : getPos();
    const sus = pending === "FOTO_AKHIR" ? JSON.parse(sessionStorage.getItem("susulanBH") || "null") : null;
    const r = { rig: sus?.rig || localStorage.getItem("rig"), bhid: sus?.bhid || localStorage.getItem("bhid") || null }; r.jenis_bor = r.bhid ? jenisDariBH(r.bhid) : "UTAMA";
    let lastTo = lastRunTo(r.bhid);
    const m = modal(`<h3>Konfirmasi foto</h3><p class="muted">${fmtT(capturedAt)} · ${esc(r.rig)} · ${esc(r.bhid ?? "")}</p>
      ${sus ? `<div class="card" style="background:#E6F4EC;margin:6px 0;font-size:13px">📸 <b>FOTO SUSULAN</b> untuk lubang lama <b>${esc(sus.bhid)}</b> (${esc(sus.rig)}). Foto diambil sekarang dan ditandai “FOTO SUSULAN” untuk verifier; data DDR lubang ini tidak berubah.</div>` : ""}
      ${gal ? `<div class="card" style="background:#FFF4D6;margin:6px 0;font-size:13px">🖼️ <b>Foto dari galeri</b> — ditandai “FOTO GALERI” untuk verifier. Jam ${ex.time ? "terbaca dari data foto" : "<b>tidak terbaca</b> dari data foto (dipakai jam file) — periksa"}; GPS ${ex.lat != null ? "terbaca dari data foto" : "tidak ada di data foto (HP sering menghapusnya), disimpan tanpa GPS"}.
        <label style="margin-top:6px">Jam foto diambil *</label><input id="gjam" type="datetime-local" step="60" value="${jamLokal(capturedAt)}" max="${jamLokal(new Date())}"></div>`
        : age > 300 ? `<p class="err">Foto ini dibuat ${Math.round(age / 60)} menit lalu — kemungkinan dari galeri, akan ditandai.</p>` : ""}
      <label>Foto ini untuk:</label>
      <div class="list" id="types">${(() => { const L = pending === "ACT" || !EV[pending] ? ["RUN", "GANTI_MATA_BOR", "TAMBAH_STANG", "STANDBY", "PERBAIKAN", "PINDAH_TITIK", "LAINNYA"] : pending === "FOTO_AKHIR" ? ["FOTO_DRILL_PAD", "FOTO_PATOK"] : [pending];
        const pil = L.includes(sessionStorage.getItem("akhirNext")) ? sessionStorage.getItem("akhirNext") : L[0];
        return L.map((k) => `<label style="display:flex;gap:8px;align-items:center;padding:8px 0"><input type="radio" name="et" value="${k}" ${k === pil ? "checked" : ""} style="width:auto">${EV[k]}</label>`).join(""); })()}</div>
      <div id="akhirTip" class="card" style="display:none;background:#EEF6F1;margin:6px 0;font-size:13px"></div>
      <div id="runf" class="row"><div><label>FROM (m)</label><input id="rf" inputmode="decimal" value="${fmtD(lastTo)}"></div><div><label>TO (m)</label><input id="rt" inputmode="decimal"></div><div><label>Core (m)</label><input id="rc" inputmode="decimal"></div></div>
      <div id="akhirf" style="display:none"><label>Status akhir lubang *</label><select id="sa"><option value="">— pilih —</option><option value="EOH">EOH — sampai target / bedrock</option><option value="STB">STB — berhenti sebelum target</option></select>
        <label>Kedalaman akhir (m)</label><input id="sad" inputmode="decimal" value="${fmtD(lastTo)}"></div>
      <div id="dipf" style="display:none"><div class="row"><div><label>Tujuan bor</label><select id="tjb"><option value="">REGULAR DRILLING</option>${TUJUAN_BOR.slice(1).map((k) => `<option ${k === "REDRILL" && asalRedrill(r.bhid) ? "selected" : ""}>${k}</option>`).join("")}</select></div><div id="rdaBox" style="display:${asalRedrill(r.bhid) ? "" : "none"}"><label>Lubang asal (redrill) *</label><input id="rda" value="${esc(asalRedrill(r.bhid) ?? "")}" autocapitalize="characters"></div></div>
        <div class="row"><div><label>Kemiringan / dip (°)</label><input id="dip" inputmode="decimal" value="${esc(rencanaLokal().find((z) => z.bhid === r.bhid)?.dip ?? -90)}"></div><div><label>Azimuth (°)</label><input id="az" inputmode="decimal" value="${esc(rencanaLokal().find((z) => z.bhid === r.bhid)?.azimuth ?? 0)}"></div></div>
        <p class="muted" style="margin:2px 0 0">−90 = tegak lurus ke bawah. Ubah hanya bila lubang dibor miring.</p></div>
      <div id="psn" style="display:none"><h3 style="margin:12px 0 2px" id="psnT">Personil hadir</h3><p class="muted" id="psnTip" style="margin:0"></p><div id="psnBox"></div></div>
      <div id="rsn"><label>Alasan / keterangan</label><input id="rn" placeholder="mis. mata bor aus, pompa rusak, hujan"></div>
      <p id="gps" class="muted">Mengambil GPS…</p>
      <div class="row" style="margin-top:10px"><button id="ok">Ya, simpan</button><button class="sec" id="cx">Batal</button></div><div id="me" class="err"></div>`);
    // FROM run = TO terakhir lubang ini (server + HP); lubang EOH tidak dilanjutkan; boleh diubah
    m.querySelector("#rf").addEventListener("input", (e) => (e.target.dataset.manual = "1"));
    if (r.bhid) kedalamanTerakhir(r.bhid, "run").then((k) => { const f = m.querySelector("#rf"); if (!f || f.dataset.manual) return;
      if (k.eoh) { f.insertAdjacentHTML("afterend", `<small class="err">${esc(r.bhid)} sudah EOH</small>`); return; }
      if (k.to != null && k.to > lastTo) { lastTo = k.to; f.value = fmtD(lastTo); m.querySelector("#sad").value = fmtD(lastTo); } });
    const tp = () => m.querySelector('input[name="et"]:checked').value;
    const TIP_AKHIR = { FOTO_DRILL_PAD: "<b>Foto drill pad</b>: ambil dari jarak ±5–10 m sehingga seluruh pad, lubang/casing dan sekitarnya terlihat; tunjukkan kondisi setelah rig pindah (sudah dibersihkan, lubang ditutup, sampah/oli tidak tertinggal).",
      FOTO_PATOK: "<b>Foto patok</b>: patok berdiri di mulut lubang, tulisan <b>Hole ID</b>, kedalaman akhir dan tanggal harus terbaca jelas (dekatkan kamera ±1 m). Ketik tulisan di patok pada kolom Keterangan." };
    const upd = () => { const t = tp(); const ta = m.querySelector("#akhirTip"); ta.style.display = TIP_AKHIR[t] ? "" : "none"; ta.innerHTML = TIP_AKHIR[t] ?? "";
      m.querySelector("#rn").placeholder = t === "FOTO_PATOK" ? `tulisan di patok, mis. ${r.bhid ?? "TGEP-001"} · EOH ${fmtD(lastTo)} m` : t === "FOTO_DRILL_PAD" ? "kondisi pad, mis. sudah dibersihkan, lubang ditutup" : "mis. mata bor aus, pompa rusak, hujan";
      m.querySelector("#runf").style.display = t === "RUN" ? "" : "none"; m.querySelector("#akhirf").style.display = t === "SELESAI_BOR" ? "" : "none"; m.querySelector("#dipf").style.display = t === "MULAI_BOR" ? "" : "none"; m.querySelector("#ok").textContent = `Ya, simpan sebagai ${EV[t]}`;
      const ps = t === "MASUK" || t === "KELUAR"; m.querySelector("#psn").style.display = ps ? "" : "none";
      if (ps && !m.querySelector("#psnBox").dataset.ok) { m.querySelector("#psnBox").dataset.ok = "1"; loadPersonil(); personilEditor(m.querySelector("#psnBox"), personilAwal(r.rig, t, capturedAt));
        m.querySelector("#psnT").textContent = t === "MASUK" ? "Personil hadir (WSG, driller, crew)" : "Personil yang keluar shift";
        m.querySelector("#psnTip").textContent = t === "MASUK" ? "Tulis semua yang ada di foto. Terisi dari shift terakhir rig ini — hapus yang tidak hadir, tambah yang baru." : "Hapus nama yang sudah pulang lebih dulu."; } };
    m.querySelectorAll('input[name="et"]').forEach((x) => (x.onchange = upd)); upd();
    m.querySelector("#tjb").onchange = () => { const rd = m.querySelector("#tjb").value === "REDRILL"; m.querySelector("#rdaBox").style.display = rd ? "" : "none"; if (rd && !m.querySelector("#rda").value) m.querySelector("#rda").value = asalRedrill(r.bhid) ?? ""; };
    let pos = null; posP.then((p) => { pos = p; m.querySelector("#gps").textContent = p ? `GPS${gal ? ` (${p?.sumber ?? "data foto"})` : ""}: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}${p.acc != null ? ` (±${p.acc} m)` : ""}` : gal ? "Tanpa GPS (tidak ada di data foto galeri)." : "GPS tidak didapat — aktifkan Lokasi di HP. Foto tetap disimpan dan ditandai.";
      const k = p && cekIUP(p.lon, p.lat); if (k && !k.dalam) m.querySelector("#gps").insertAdjacentHTML("afterend", `<p class="err" style="font-weight:600">⚠ Titik GPS ini berada DI LUAR batas IUP (${esc(k.nama)}). Pastikan lokasi bor benar sebelum mengebor; hubungi WSG/admin.</p>`); });
    m.querySelector("#cx").onclick = () => m.remove();
    m.querySelector("#ok").onclick = async () => {
      if (!EV[tp()] || tp() === "FOTO_AKHIR") return (m.querySelector("#me").textContent = "Pilih jenis aktivitas foto ini dulu.");
      const t = tp(), num = (s) => (String(s).trim() === "" ? null : Number(String(s).replace(",", ".")));
      if (gal) { const j = m.querySelector("#gjam").value ? new Date(m.querySelector("#gjam").value) : null;
        if (!j || isNaN(j)) return (m.querySelector("#me").textContent = "Isi jam foto diambil.");
        if (j.getTime() > Date.now() + 60e3) return (m.querySelector("#me").textContent = "Jam foto tidak boleh di masa depan.");
        capturedAt = j; age = Math.round((Date.now() - j.getTime()) / 1000); }
      const row = { ...r, event_type: t, reason: m.querySelector("#rn").value || null, captured_at: capturedAt.toISOString(), photo_age_s: age,
        ...(gal || sus ? { note: [sus ? "FOTO SUSULAN lubang lama" : null, gal ? `FOTO GALERI · jam ${ex.time && Math.abs(ex.time - capturedAt) < 60e3 ? "dari data foto" : "diisi manual"} · koordinat ${pos?.sumber ?? (ex.lat != null ? "data foto" : "tidak ada")}${ex.lat != null && pos?.sumber && pos.sumber !== "data foto" ? ` (GPS data foto ${(+ex.lat).toFixed(6)}, ${(+ex.lon).toFixed(6)})` : ""}` : null].filter(Boolean).join(" · ") } : {}) };
      if (t === "RUN") {
        Object.assign(row, { depth_from: num(m.querySelector("#rf").value), depth_to: num(m.querySelector("#rt").value), core_length: num(m.querySelector("#rc").value) });
        if (!(row.depth_to > row.depth_from)) return (m.querySelector("#me").textContent = "Isi FROM dan TO run (TO > FROM).");
        if (Math.abs(row.depth_from - lastTo) > 0.02 && !confirm(`FROM ${fmtD(row.depth_from)} m tidak menyambung dengan TO run terakhir ${fmtD(lastTo)} m. Tetap simpan?`)) return;
        if (row.core_length === null) return (m.querySelector("#me").textContent = "Isi panjang core yang terambil.");
      }
      if (t === "MULAI_BOR") {
        const tj = m.querySelector("#tjb").value;
        if (tj) row.tujuan_bor = tj;
        if (tj === "REDRILL") {
          row.lubang_asal = bakuBH(m.querySelector("#rda").value) || null;
          if (!asalRedrill(r.bhid)) return (m.querySelector("#me").textContent = `Redrill: Hole ID harus berakhiran R, mis. ${r.bhid ?? "DH-NPG 12"}R. Pilih Jenis pemboran REDRILL di atas.`);
          if (!row.lubang_asal) return (m.querySelector("#me").textContent = "Redrill: isi lubang asal.");
          if (!row.reason) { m.querySelector("#rn").focus(); return (m.querySelector("#me").textContent = "Redrill: tulis alasan redrill di kolom Alasan (mis. recovery rendah, lubang runtuh)."); }
        } else if (asalRedrill(r.bhid) && !confirm(`Hole ID ${r.bhid} berakhiran R (redrill), tetapi tujuan bor bukan REDRILL. Tetap simpan?`)) return;
        { // ⚠️ titik belum di-marking (tidak menghalangi simpan)
          let blm = (await titikBelumMarking().catch(() => [])).some((x) => kunciBH(x.bhid) === kunciBH(r.bhid ?? ""));
          if (!blm && online() && r.bhid) { const { count } = await sb.from("marking").select("id", { count: "exact", head: true }).eq("bhid", r.bhid); blm = count === 0; }
          if (blm && !confirm(`⚠️ Titik ${r.bhid} BELUM di-marking (belum ada koordinat GPS).\n\n${isStaff() ? "Lakukan 📍 Marking titik di lokasi" : "Minta wellsite/geologist melakukan 📍 Marking titik"} sebelum atau segera setelah mulai bor — koordinat collar dibutuhkan untuk Peta dan Database.\n\nTetap simpan Mulai bor?`)) return;
        }
        row.dip = num(m.querySelector("#dip").value); row.azimuth = num(m.querySelector("#az").value);
        if (row.dip === null || row.dip < -90 || row.dip > 0) return (m.querySelector("#me").textContent = "Dip antara −90 (tegak) dan 0 (mendatar).");
        if (row.azimuth === null || row.azimuth < 0 || row.azimuth >= 360) return (m.querySelector("#me").textContent = "Azimuth antara 0 dan 359.");
      }
      if (t === "SELESAI_BOR") {
        row.status_akhir = m.querySelector("#sa").value || null; row.depth_to = num(m.querySelector("#sad").value);
        if (!row.status_akhir) return (m.querySelector("#me").textContent = "Pilih status akhir: EOH atau STB.");
        if (row.status_akhir === "STB" && !row.reason) { m.querySelector("#rn").focus(); return (m.querySelector("#me").textContent = "STB: tulis alasan berhenti di kolom Alasan."); }
      }
      if (t === "FOTO_PATOK") {
        const tulis = (m.querySelector("#rn").value || "").trim();
        if (!tulis) { m.querySelector("#rn").focus(); return (m.querySelector("#me").textContent = "Ketik tulisan yang ada di patok (Hole ID & kedalaman akhir)."); }
        const bersihkan = (x) => String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (r.bhid && !bersihkan(tulis).includes(bersihkan(r.bhid)) && !confirm(`Tulisan patok "${tulis}" tidak memuat Hole ID ${r.bhid}. Patok salah tulis atau salah lubang? Tetap simpan (akan terlihat saat diperiksa)?`)) return;
      }
      if (t === "MASUK" || t === "KELUAR") {
        const L = ambilPersonil(m.querySelector("#psnBox")), n = (j) => L.filter((x) => x.jabatan === j).length, dup = L.map((x) => x.nama.toUpperCase()).filter((x, i, a) => a.indexOf(x) !== i);
        if (!L.length) return (m.querySelector("#me").textContent = "Isi nama personil yang hadir.");
        if (dup.length) return (m.querySelector("#me").textContent = "Nama ganda: " + [...new Set(dup)].join(", "));
        if (t === "MASUK") {
          if (!n("Driller")) return (m.querySelector("#me").textContent = "Isi minimal satu Driller.");
          const cr = L.length - n("WSG"), kos = [...m.querySelectorAll("#psnBox [data-ps] input")].filter((x) => !x.value.trim()).length;
          if (cr < crewMin()) {
            if (!m.querySelector("#rn").value.trim()) { m.querySelector("#rn").focus();
              return (m.querySelector("#me").textContent = `Crew baru ${cr} dari ${crewMin()} orang${kos ? ` (${kos} nama kosong)` : ""}. Isi semua nama crew, atau tulis alasannya di kolom Alasan (mis. 1 helper sakit).`); }
            if (!confirm(`Crew hanya ${cr} dari ${crewMin()} orang. Simpan dengan alasan: "${m.querySelector("#rn").value.trim()}"?`)) return;
          }
          if (!n("WSG") && !confirm("Tidak ada WSG di daftar personil. Tetap simpan? (akan ditandai di rekap)")) return;
        }
        row.personil = L; simpanPersonilLokal(r.rig, capturedAt, t, L);
      }
      m.querySelector("#ok").disabled = true;
      if (!pos) pos = await Promise.race([posP, new Promise((r2) => setTimeout(() => r2(null), 4000))]);
      if (pos) Object.assign(row, { lat: pos.lat, lon: pos.lon, gps_accuracy_m: pos.acc, gps_time: pos.t });
      // Lokasi foto jauh dari titik rencana → tanya: titik bor bergeser atau tidak (sekali per lubang; "tidak" diingat sampai besok)
      if (pos && r.bhid && !["MASUK", "KELUAR"].includes(t) && !(gal && pos.sumber && pos.sumber !== "data foto")) { const g = await cekGeser(r.bhid, pos); if (g === null) { m.querySelector("#ok").disabled = false; return; } if (g) Object.assign(row, g); }
      const line2 = t === "RUN" ? `RUN ${fmtD(row.depth_from)}–${fmtD(row.depth_to)} m · core ${fmtD(row.core_length)} m` : EV[t] + (row.status_akhir ? ` ${row.status_akhir}` : "") + (t === "MULAI_BOR" ? ` · dip ${row.dip}° az ${row.azimuth}°` : "") + (row.personil ? ` · ${row.personil.length} personil` : "") + (row.reason ? ` · ${row.reason}` : "");
      const blob = await stampPhoto(file, [`TGEP · ${r.rig} · ${r.bhid ?? "-"} · ${me?.full_name ?? ""}`, line2,
        `${fmtT(capturedAt)} WIB · ${pos ? `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}${pos.acc != null ? ` ±${pos.acc} m` : ""}` : "TANPA GPS"}${gal ? " · FOTO GALERI" : ""}${sus ? " · FOTO SUSULAN" : ""}${row.titik_bergeser ? ` · TITIK BERGESER ±${row.geser_m} m` : ""}`]);
      await qPut({ kind: "event", client_uuid: crypto.randomUUID(), row, blob });
      if (t === "RUN") localStorage.setItem(`lastTo_${r.bhid}`, row.depth_to);
      m.remove(); render(); sync();
      // akhir lubang: langsung arahkan ke foto drill pad lalu foto patok
      const next = t === "SELESAI_BOR" && row.status_akhir ? "FOTO_DRILL_PAD" : t === "FOTO_DRILL_PAD" ? "FOTO_PATOK" : null;
      if (t === "FOTO_PATOK") { sessionStorage.removeItem("akhirNext"); sessionStorage.removeItem("susulanBH"); }
      if (next) setTimeout(() => { sessionStorage.setItem("akhirNext", next);
        const a = modal(`<h3>${next === "FOTO_DRILL_PAD" ? `Lubang ${esc(r.bhid ?? "")} ${esc(row.status_akhir ?? "")} — foto akhir` : "Drill pad tersimpan ✓"}</h3>
          <p>${next === "FOTO_DRILL_PAD" ? "Wajib 2 foto penutup lubang: <b>1) drill pad</b> lalu <b>2) patok</b> di mulut lubang." : "Sekarang <b>foto patok</b> di mulut lubang. Tulisan Hole ID dan kedalaman akhir harus terbaca."}</p>
          <div class="row"><button id="aGo">📷 Foto ${next === "FOTO_DRILL_PAD" ? "drill pad" : "patok"} sekarang</button><button class="sec" id="aNanti">Nanti</button></div>
          <p class="muted" style="margin-top:6px">Bisa juga belakangan lewat tombol <b>📸 Drill pad & patok</b>.</p>`);
        a.querySelector("#aNanti").onclick = () => a.remove();
        a.querySelector("#aGo").onclick = () => { a.remove(); if (sessionStorage.getItem("susulanBH")) sessionStorage.setItem("akhirLanjut", "1"); document.querySelector('[data-ev="FOTO_AKHIR"]')?.click(); }; }, 400);
    };
  };
  $("#sy").onclick = sync;
  if (navigator.onLine && !session.offline) {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const [{ data: evs }, { data: sum }] = await Promise.all([
      sb.from("v_drill_event_qc").select("id,event_type,bhid,depth_from,depth_to,core_length,captured_at,flags,photo_path,reason,note,konfirmasi_at,konfirmasi_ket").eq("rig", localStorage.getItem("rig") || "-").eq("tanggal", day).order("captured_at"),
      sb.from("v_drill_progress_daily").select("bhid,meter_bor,jumlah_run,recovery_pct,standby_menit,jam_p2h,chk_harian").eq("rig", localStorage.getItem("rig") || "-").eq("tanggal", day),
    ]);
    const akhirKurang = [...new Set((evs ?? []).filter((x) => x.event_type === "SELESAI_BOR").map((x) => x.bhid))].map((b) => [b, ["FOTO_DRILL_PAD", "FOTO_PATOK"].filter((k) => !(evs ?? []).some((x) => x.bhid === b && x.event_type === k))]).filter(([, k]) => k.length);
    if (tok !== progView.tok || !$("#today")) return; // layar sudah berganti
    isiSusulan(tok, mulaiSusulan);
    $("#today").innerHTML = `${akhirKurang.map(([b, k]) => `<p class="err" style="font-weight:600">⚠ ${esc(b)} sudah selesai bor tetapi belum ada ${k.map((x) => (x === "FOTO_PATOK" ? "foto patok" : "foto drill pad")).join(" & ")} — tekan 📸 Drill pad & patok.</p>`).join("")}${(sum ?? []).map((s) => `<p><b>${esc(s.bhid)}</b>: ${s.meter_bor} m · ${s.jumlah_run} run · recovery ${s.recovery_pct ?? "-"}% · standby ${s.standby_menit} mnt · P2H ${s.jam_p2h ? fmtT(s.jam_p2h).slice(-8) : "BELUM"}${s.chk_harian ? `<br><span class="err">${esc(s.chk_harian)}</span>` : ""}</p>`).join("")}
      <ul class="list">${(evs ?? []).map((x) => `<li><span style="flex:1">${fmtT(x.captured_at).slice(-8)} · <b>${esc(EV[x.event_type])}</b>${x.event_type === "RUN" ? ` ${fmtD(x.depth_from)}–${fmtD(x.depth_to)} m (core ${fmtD(x.core_length)})` : ""}${x.reason ? " · " + esc(x.reason) : ""}${x.note ? ` <span class="pill ANTRE">${/SUSULAN/.test(x.note) ? "susulan" : "galeri"}</span>` : ""}${x.flags ? `<br><span class="err">${esc(x.flags)}</span>` : ""}${x.konfirmasi_at ? `<br><span style="color:#1b7a3a;font-size:12.5px">✅ Dikonfirmasi${x.konfirmasi_ket ? ": " + esc(x.konfirmasi_ket) : ""}</span>` : ""}</span>${x.flags && isStaff() ? `<button data-kfm="${x.id}" style="flex:0;white-space:nowrap">✅ Konfirmasi</button>` : ""}${x.photo_path ? `<button class="sec" data-ph="${esc(x.photo_path)}" style="flex:0">Foto</button>` : ""}</li>`).join("") || `<li class="muted">Belum ada aktivitas terkirim hari ini untuk rig ini.</li>`}</ul><div id="phv"></div>`;
    // v.36: ✅ Konfirmasi tanda masalah (JAUH DARI TITIK BOR, FOTO LAMA/GALERI, …) — foto dianggap benar, tidak lagi dihitung bermasalah
    $("#today").querySelectorAll("[data-kfm]").forEach((b) => (b.onclick = () => konfirmasiAktivitas(b.dataset.kfm, (evs ?? []).find((x) => x.id === b.dataset.kfm), () => progView(v))));
    $("#today").querySelectorAll("[data-ph]").forEach((b) => (b.onclick = async () => { const { data } = await sb.storage.from("progress-photos").createSignedUrl(b.dataset.ph, 600);
      if (data?.signedUrl) return ($("#phv").innerHTML = `<img src="${data.signedUrl}" alt="Foto aktivitas bor" style="width:100%;border-radius:8px">`);
      const dv = await linkDrive("progress-photos", b.dataset.ph); $("#phv").innerHTML = dv ? `<p>Foto sudah dipindah ke Google Drive. <a href="${esc(dv)}" target="_blank" rel="noopener">Buka di Drive</a></p>` : `<p class="err">Foto tidak ditemukan.</p>`; }));
  }
}
// ---------- Jam & data foto (EXIF) untuk foto galeri / isian manual ----------
const jamLokal = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60e3); return z.toISOString().slice(0, 16); };
// Baca jam ambil (DateTimeOriginal) dan GPS dari EXIF JPEG. Banyak HP/browser menghapus GPS saat memilih dari galeri — maka GPS bisa kosong.
async function bacaExif(file) {
  try {
    const b = new DataView(await file.slice(0, 262144).arrayBuffer());
    if (b.getUint16(0) !== 0xffd8) return {};
    let o = 2;
    while (o < b.byteLength - 4) {
      const mk = b.getUint16(o);
      if (mk === 0xffe1 && b.getUint32(o + 4) === 0x45786966) return exifTiff(b, o + 10);
      if ((mk & 0xff00) !== 0xff00 || mk === 0xffda) break;
      o += 2 + b.getUint16(o + 2);
    }
  } catch { /* foto tanpa EXIF */ }
  return {};
}
function exifTiff(b, t) {
  const le = b.getUint16(t) === 0x4949, u16 = (p) => b.getUint16(p, le), u32 = (p) => b.getUint32(p, le);
  const ifd = (p) => { const E = {}, n = u16(p); for (let i = 0; i < n; i++) { const e = p + 2 + i * 12, ty = u16(e + 2), c = u32(e + 4), sz = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 })[ty] ?? 1;
    E[u16(e)] = { ty, c, v: c * sz <= 4 ? e + 8 : t + u32(e + 8) }; } return E; };
  const str = (x) => { let s = ""; for (let i = 0; i < x.c - 1; i++) s += String.fromCharCode(b.getUint8(x.v + i)); return s; };
  const rat = (p) => u32(p) / (u32(p + 4) || 1), dms = (x) => rat(x.v) + rat(x.v + 8) / 60 + rat(x.v + 16) / 3600;
  const I0 = ifd(t + u32(t + 4)), out = {};
  const Ex = I0[0x8769] ? ifd(t + u32(I0[0x8769].v)) : {}, dt = Ex[0x9003] ?? I0[0x0132];
  const mt = dt && /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(str(dt));
  if (mt) { const d = new Date(+mt[1], +mt[2] - 1, +mt[3], +mt[4], +mt[5], +mt[6]); if (!isNaN(d) && mt[1] !== "0000") out.time = d; }
  if (I0[0x8825]) { const G = ifd(t + u32(I0[0x8825].v));
    if (G[2] && G[4]) { const lat = dms(G[2]) * (str(G[1] ?? { c: 2, v: 0 }) === "S" ? -1 : 1), lon = dms(G[4]) * (G[3] && String.fromCharCode(b.getUint8(G[3].v)) === "W" ? -1 : 1);
      if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) Object.assign(out, { lat, lon }); } }
  return out;
}
// ⚠️ Titik belum di-marking / lubang sudah dibor tanpa koordinat (view v_titik_belum_marking, DB v35). Disimpan di HP agar bisa dipakai offline.
async function titikBelumMarking() {
  if (online()) { const { data, error } = await sb.from("v_titik_belum_marking").select("kategori,bhid,project,rig,start_date,hari_sejak_mulai,lubang_asal,lubang_asal_berkoordinat");
    if (!error && data) { localStorage.setItem("titikBelumMarking", JSON.stringify(data)); return data; } }
  return JSON.parse(localStorage.getItem("titikBelumMarking") || "[]");
}
async function peringatanMarking(el, bukaMarking) {
  if (!el) return; const L = await titikBelumMarking().catch(() => []), P = myTugas?.project, cocokP = (x) => !P || !x.project || x.project === P;
  const D = L.filter((x) => x.kategori === "DIBOR_TANPA_KOORDINAT" && cocokP(x)), R = L.filter((x) => x.kategori === "RENCANA_BELUM_MARKING" && cocokP(x));
  if (!D.length && !R.length) return;
  const box = document.createElement("div"); box.className = "card"; box.id = "pmk"; box.style.cssText = "background:#FDECEA;border-left:5px solid #C0392B;color:#3a1410";
  const bh = (b) => (bukaMarking ? `<a href="#" data-mkb="${esc(b)}"><b>${esc(b)}</b></a>` : `<b>${esc(b)}</b>`);
  box.innerHTML = `${D.length ? `<b>⚠️ ${D.length} lubang sudah dibor tetapi belum di-marking / belum berkoordinat</b> — belum bisa diplot di Peta dan collar kosong di Database.
    <ul style="margin:6px 0;padding-left:18px">${D.map((x) => `<li>${bh(x.bhid)}${x.rig ? ` · ${esc(x.rig)}` : ""} · mulai ${esc(x.start_date ?? "?")}${x.hari_sejak_mulai > 0 ? ` (${x.hari_sejak_mulai} hari lalu)` : x.hari_sejak_mulai === 0 ? " (hari ini)" : ""}${x.lubang_asal ? ` · redrill dari ${esc(x.lubang_asal)}${x.lubang_asal_berkoordinat ? " (lubang asal sudah berkoordinat — tetap marking posisi redrill)" : ""}` : ""}</li>`).join("")}</ul>` : ""}
    ${R.length ? `<div style="margin-top:4px">📍 ${R.length} titik rencana belum di-marking: ${R.map((x) => bh(x.bhid)).join(", ")}</div>` : ""}
    ${bukaMarking ? `<small style="opacity:.8">Ketuk Hole ID untuk langsung 📍 Marking titik di lokasi.</small>` : ""}`;
  document.getElementById("pmk")?.remove(); el.before(box);
  box.querySelectorAll("[data-mkb]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); bukaMarking(a.dataset.mkb); }));
}
// ---------- Marking titik: setiap pembacaan GPS = satu baris di database (akurasi ikut tersimpan) ----------
function markingForm() {
  const m = modal(`<h3>📍 Marking titik bor</h3>
    <label>Hole ID *</label><input id="mkb" data-bhid value="${esc(localStorage.getItem("bhid") || "")}" autocapitalize="characters">
    <div id="mkg" style="margin:10px 0;padding:10px;border-radius:10px;background:#f1f3ef;font-size:14px">Menunggu GPS… aktifkan Lokasi HP.</div>
    <label>Catatan (opsional)</label><input id="mkc" placeholder="mis. patok kayu baru, di bahu bukit">
    <p class="muted">Setiap tekan <b>Simpan pembacaan</b> tersimpan sebagai satu baris sendiri lengkap dengan akurasinya — ambil 2–3 kali bila perlu. Tunggu angka ± turun (idealnya ≤ 5 m) sebelum menyimpan.</p>
    <div class="row"><button id="mks">Simpan pembacaan</button><button class="sec" id="mkx">Selesai</button></div>
    <div id="mke" class="err"></div><ul class="list" id="mkl"></ul>`);
  let c = null, ct = null, ke = 0;
  const tampil = () => { if (!c) return; const acc = c.accuracy, warna = acc <= 5 ? "#C8EBD4" : acc <= 15 ? "#FFE58A" : "#F6C9C3", u = UTM.ke(c.longitude, c.latitude);
    const r = rencanaLokal().find((z) => kunciBH(z.bhid) === kunciBH(m.querySelector("#mkb").value)), d = r ? jarakM([c.longitude, c.latitude], [r.lon, r.lat]) : null;
    const g = m.querySelector("#mkg"); g.style.background = warna;
    g.innerHTML = `<b>±${acc.toFixed(1)} m</b> ${acc <= 5 ? "akurasi baik" : acc <= 15 ? "cukup — tunggu sebentar" : "kurang — tunggu GPS terkunci"}<br>${c.latitude.toFixed(7)}, ${c.longitude.toFixed(7)} · UTM 51S E ${u[0].toFixed(1)} N ${u[1].toFixed(1)}${c.altitude != null ? `<br>Tinggi GPS ${c.altitude.toFixed(1)} m${c.altitudeAccuracy != null ? ` ±${c.altitudeAccuracy.toFixed(1)} m` : ""}` : ""}${d != null ? `<br>Jarak ke titik rencana ${esc(r.bhid)}: <b>${d < 1000 ? d.toFixed(1) + " m" : (d / 1000).toFixed(2) + " km"}</b>` : ""}`; };
  const wid = navigator.geolocation?.watchPosition((p) => { c = p.coords; ct = p.timestamp; tampil(); },
    () => (m.querySelector("#mkg").textContent = "GPS tidak didapat — aktifkan Lokasi HP dan izinkan untuk aplikasi."), { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
  m.querySelector("#mkb").addEventListener("input", tampil);
  m.querySelector("#mkx").onclick = () => { if (wid != null) navigator.geolocation.clearWatch(wid); m.remove(); render(); };
  m.querySelector("#mks").onclick = async () => {
    const bhid = bakuBH(m.querySelector("#mkb").value), e = m.querySelector("#mke"); e.textContent = "";
    if (!bhid) return (e.textContent = "Isi Hole ID.");
    if (!c) return (e.textContent = "GPS belum didapat.");
    if (c.accuracy > 15 && !confirm(`Akurasi baru ±${c.accuracy.toFixed(0)} m. Tetap simpan pembacaan ini?`)) return;
    { const uu = UTM.ke(c.longitude, c.latitude); if (!(uu[0] >= 100000 && uu[0] <= 900000 && uu[1] > 0 && uu[1] < 10000000)) return (e.textContent = "Posisi GPS di luar zona UTM 51S (bukan di lokasi proyek) — marking tidak disimpan. Lakukan marking di titik bor."); }
    const u = UTM.ke(c.longitude, c.latitude), z = await tinggiDi(c.longitude, c.latitude).catch(() => null), id = crypto.randomUUID();
    const row = { client_uuid: id, bhid, lat: c.latitude, lon: c.longitude, x_utm: +u[0].toFixed(3), y_utm: +u[1].toFixed(3), akurasi_m: +c.accuracy.toFixed(1),
      z_gps: c.altitude != null ? +c.altitude.toFixed(2) : null, akurasi_z_m: c.altitudeAccuracy != null ? +c.altitudeAccuracy.toFixed(1) : null, z_dem: z != null ? +z.toFixed(1) : null,
      instrument: "GPS HP", catatan: m.querySelector("#mkc").value.trim() || null, rig: localStorage.getItem("rig") || null, project: myTugas?.project ?? null, captured_at: new Date(ct || Date.now()).toISOString() };
    await qPut({ kind: "marking", client_uuid: id, row }); localStorage.setItem("bhid", bhid); ke++;
    m.querySelector("#mkl").insertAdjacentHTML("afterbegin", `<li><span class="pill ANTRE">antre</span><span>Pembacaan ${ke} · ${esc(bhid)} · ${fmtT(row.captured_at).slice(-8)} · ±${row.akurasi_m} m</span></li>`);
    sync();
  };
}
async function p2hForm() {
  let items = JSON.parse(localStorage.getItem("p2hItems") || "null") ?? P2H_DEFAULT;
  if (navigator.onLine && !session.offline) { const { data } = await sb.from("p2h_item").select("item").eq("active", true).order("sort"); if (data?.length) { items = data.map((x) => x.item); localStorage.setItem("p2hItems", JSON.stringify(items)); } }
  const m = modal(`<h3>P2H rig ${esc(localStorage.getItem("rig"))} · shift ${esc(localStorage.getItem("shift"))}</h3>
    <label>Hour meter</label><input id="hm" inputmode="decimal">
    <div class="row" style="margin:8px 0"><button class="sec" id="allok">Tandai semua OK</button></div>
    <div class="list">${items.map((it, i) => `<div style="padding:6px 0;border-bottom:1px solid #e3e8e1"><div>${esc(it)}</div><div class="row" style="gap:4px;margin-top:4px">${["OK", "TIDAK OK", "N/A"].map((s) => `<label style="flex:1;display:flex;gap:4px;align-items:center"><input type="radio" name="i${i}" value="${s}" ${s === "OK" ? "" : ""} style="width:auto">${s}</label>`).join("")}</div><input data-n="${i}" placeholder="catatan (wajib bila TIDAK OK)" style="margin-top:4px"></div>`).join("")}</div>
    <p class="muted">Setelah tombol simpan, kamera terbuka untuk foto unit rig.</p>
    <div class="row"><button id="ok">Simpan & foto rig</button><button class="sec" id="cx">Batal</button></div><div id="me" class="err"></div>
    <input id="pf2" type="file" accept="image/*" capture="environment" class="hide">`);
  m.querySelector("#cx").onclick = () => m.remove();
  m.querySelector("#allok").onclick = () => m.querySelectorAll('input[value="OK"]').forEach((x) => (x.checked = true));
  let res = null;
  m.querySelector("#ok").onclick = () => {
    res = items.map((it, i) => ({ item: it, status: m.querySelector(`input[name="i${i}"]:checked`)?.value ?? null, note: m.querySelector(`[data-n="${i}"]`).value.trim() || null }));
    const kosong = res.filter((x) => !x.status), tanpaCatatan = res.filter((x) => x.status === "TIDAK OK" && !x.note);
    if (kosong.length) return (m.querySelector("#me").textContent = `${kosong.length} item belum diisi.`);
    if (tanpaCatatan.length) return (m.querySelector("#me").textContent = `Isi catatan untuk item TIDAK OK: ${tanpaCatatan.map((x) => x.item).join(", ")}`);
    m.querySelector("#pf2").click();
  };
  m.querySelector("#pf2").onchange = async (ev) => {
    const f0 = ev.target.files[0]; ev.target.value = ""; if (!f0) return;
    const file = await pratinjauFoto(f0, "Foto unit rig (P2H)"); if (!file) return;
    const capturedAt = new Date(), age = Math.round((Date.now() - file.lastModified) / 1000), pos = await Promise.race([getPos(), new Promise((r) => setTimeout(() => r(null), 15000))]);
    const nNot = res.filter((x) => x.status === "TIDAK OK").length;
    const row = { rig: localStorage.getItem("rig"), shift: localStorage.getItem("shift"), hour_meter: Number(String(m.querySelector("#hm").value).replace(",", ".")) || null,
      items: res, n_not_ok: nNot, layak_operasi: nNot === 0, captured_at: capturedAt.toISOString(), photo_age_s: age,
      ...(pos ? { lat: pos.lat, lon: pos.lon, gps_accuracy_m: pos.acc } : {}) };
    const blob = await stampPhoto(file, [`TGEP · P2H ${row.rig} · shift ${row.shift} · ${me?.full_name ?? ""}`, nNot ? `TIDAK LAYAK: ${nNot} item TIDAK OK` : "LAYAK OPERASI",
      `${fmtT(capturedAt)} WIB · ${pos ? `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)} ±${pos.acc} m` : "TANPA GPS"}`]);
    await qPut({ kind: "p2h", client_uuid: crypto.randomUUID(), row, blob });
    m.remove(); if (nNot) alert(`P2H: ${nNot} item TIDAK OK — rig dinyatakan TIDAK LAYAK operasi sampai diperbaiki.`); render(); sync();
  };
}

// ---------- pengguna (admin) ----------
// Hapus akun: tanpa data -> dihapus permanen; sudah ada data -> login ditutup permanen (email dilepas, kata sandi dihapus),
// nama & semua data tetap tersimpan dan tetap tampil di laporan. Orangnya boleh daftar ulang dengan email yang sama.
async function hapusAkun(uid, nama) {
  const { data: pv, error: e1 } = await sb.rpc("admin_hapus_pengguna", { p_user: uid, p_konfirmasi: false });
  if (e1) { alert(e1.message); return false; }
  return new Promise((selesai) => {
    const m = modal(`<h3 style="color:#B3261E">Hapus akun ${esc(nama || pv.nama || "")}?</h3>
      ${pv.data_tetap ? `<p>Akun ini sudah mengirim <b>${pv.total_data} data</b> (${esc(pv.ringkasan)}).</p>
        <p><b>Data tersebut TIDAK ikut dihapus</b>: tetap tersimpan, tetap tampil di Database, Dashboard, laporan dan DDR atas nama <b>${esc(nama || pv.nama)}</b>.</p>
        <p>Yang dihapus: akses masuk. Email dilepas, kata sandi dihapus, sesi di semua HP diputus, penugasan proyek dicabut. Akun pindah ke daftar <b>Akun dihapus</b>.</p>`
      : `<p>Akun ini belum pernah mengirim data, jadi dihapus <b>permanen</b> (akun, pendaftaran, penugasan).</p>`}
      <p>Tidak bisa dibatalkan. Bila orang ini perlu masuk lagi, ia mendaftar ulang dan menunggu persetujuan.</p>
      <label>Alasan (wajib)</label><textarea id="haa" rows="2" placeholder="mis. sudah tidak ikut proyek / kontrak selesai"></textarea>
      <p class="err" id="hae"></p>
      <div class="row"><button class="sec" id="hab">Batal</button><button id="hao" style="background:#B3261E">Ya, hapus akun</button></div>`);
    const tutup = (x) => { m.remove(); selesai(x); };
    m.querySelector("#hab").onclick = () => tutup(false);
    m.querySelector("#hao").onclick = async () => {
      const alasan = m.querySelector("#haa").value.trim();
      if (!alasan) return (m.querySelector("#hae").textContent = "Alasan wajib diisi.");
      m.querySelector("#hao").disabled = true;
      const { error } = await sb.rpc("admin_hapus_pengguna", { p_user: uid, p_konfirmasi: true, p_alasan: alasan });
      if (error) { m.querySelector("#hae").textContent = error.message; m.querySelector("#hao").disabled = false; return; }
      tutup(true);
    };
  });
}
// Admin membuat kata sandi sementara untuk pengguna yang lupa kata sandi; pengguna wajib menggantinya saat masuk.
async function resetSandiAdmin(uid, nama) {
  if (!confirm(`Buat kata sandi sementara untuk ${nama}?\n\nKata sandi lamanya langsung tidak berlaku. Kirim kata sandi sementara langsung ke orangnya (WA/telepon), bukan lewat grup.`)) return false;
  const { data, error } = await sb.rpc("admin_reset_password", { p_user: uid });
  if (error) { alert(error.message); return false; }
  const pesan = `X-Terra: kata sandi sementara untuk ${data.email} adalah ${data.password_sementara}\nMasuk di ${location.origin + location.pathname} lalu buat kata sandi baru Anda sendiri.`;
  return new Promise((selesai) => {
    const m = modal(`<h3>Kata sandi sementara</h3><p>${esc(data.nama)} · ${esc(data.email)}</p>
      <p style="font-size:26px;font-weight:800;letter-spacing:2px;text-align:center;background:#F1F5F3;border-radius:10px;padding:10px;user-select:all">${esc(data.password_sementara)}</p>
      <p class="muted">Hanya ditampilkan sekali. Saat masuk, pengguna langsung diminta membuat kata sandi baru.${data.nonaktif ? " <b>Catatan: akun ini masih NONAKTIF</b>, aktifkan dulu agar bisa masuk." : ""}</p>
      <div class="row"><button class="sec" id="rsc">Salin pesan</button><a class="btn" id="rsw" href="https://wa.me/?text=${encodeURIComponent(pesan)}" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:10px;border-radius:10px;background:#1E9E69;color:#fff;text-decoration:none">Kirim lewat WhatsApp</a></div>
      <div class="row"><button id="rso">Selesai</button></div>`);
    m.querySelector("#rsc").onclick = async () => { await navigator.clipboard?.writeText(pesan); m.querySelector("#rsc").textContent = "Tersalin"; };
    m.querySelector("#rso").onclick = () => { m.remove(); selesai(true); };
  });
}
async function usersView(v) {
  const { data: rq, error } = await sb.from("registration_request").select("*").order("created_at", { ascending: false });
  if (error) return (v.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const [{ data: au }, { data: rs }] = await Promise.all([sb.from("app_user").select("user_id,role,dihapus_at,nonaktif_alasan,wajib_ganti_pw,is_owner"), sb.rpc("admin_daftar_reset")]);
  const roleOf = Object.fromEntries((au ?? []).map((x) => [x.user_id, x.role])), auOf = Object.fromEntries((au ?? []).map((x) => [x.user_id, x]));
  const dihapus = rq.filter((r) => auOf[r.user_id]?.dihapus_at);
  const pend = rq.filter((r) => r.status === "PENDING"), rest = rq.filter((r) => r.status !== "PENDING" && !auOf[r.user_id]?.dihapus_at);
  const link = new URL("daftar.html", location.href).href;
  // Hanya Owner yang dapat memberi/mencabut peran General admin dan mengubah akun General admin (dijaga juga oleh server)
  const owner = !!me?.is_owner, terkunci = (uid) => !owner && uid !== session?.user?.id && (roleOf[uid] === "admin" || auOf[uid]?.is_owner);
  const opt = (sel) => ["driller", "geologist", "verifier", "admin", "client", "admin_lapangan"].filter((r) => owner || r !== "admin" || sel === "admin").map((r) => `<option value="${r}" ${r === sel ? "selected" : ""}>${LABEL_PERAN[r]}</option>`).join("");
  const peranTeks = (uid) => auOf[uid]?.is_owner ? "Owner" : LABEL_PERAN[roleOf[uid]] ?? roleOf[uid];
  const row = (r, pending) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(r.full_name)}</b> · ${esc(r.email)}<br><span class="muted">${esc(r.position ?? "")} · ${esc(r.company ?? "")} · ${esc(r.phone ?? "")}${r.reason ? " · " + esc(r.reason) : ""}<br>
      ${pending ? `minta: ${esc(r.requested_role)} · daftar ${new Date(r.created_at).toLocaleString("id-ID")}` : `status: ${roleOf[r.user_id] === "nonaktif" ? "<b style='color:#C8281F'>NONAKTIF</b>" : roleOf[r.user_id] ? "AKTIF (" + esc(peranTeks(r.user_id)) + ")" : r.status === "REJECTED" ? "DITOLAK" : r.status}${r.decision_note ? " · " + esc(r.decision_note) : ""}`}</span></span>
      ${auOf[r.user_id]?.is_owner ? `<b style="flex:0;color:#8a5a00;white-space:nowrap">👑 Owner</b>` : terkunci(r.user_id) ? `<span class="muted" style="flex:0;white-space:nowrap">🔒 hanya Owner yang dapat mengubah</span>` : `<select data-role="${r.user_id}" style="flex:0;width:auto">${opt(roleOf[r.user_id] && roleOf[r.user_id] !== "nonaktif" ? roleOf[r.user_id] : r.requested_role)}</select>
      <button data-ok="${r.user_id}" style="flex:0">${pending ? "Setujui" : roleOf[r.user_id] && roleOf[r.user_id] !== "nonaktif" ? "Ubah peran" : "Aktifkan"}</button>
      ${pending || (roleOf[r.user_id] && roleOf[r.user_id] !== "nonaktif") ? `<button class="danger" data-no="${r.user_id}" style="flex:0">${pending ? "Tolak" : "Nonaktifkan"}</button>` : ""}
      ${!pending && roleOf[r.user_id] && r.user_id !== session?.user?.id ? `<button class="sec" data-rpw="${r.user_id}" data-nm="${esc(r.full_name)}" style="flex:0" title="Buat kata sandi sementara (pengguna lupa kata sandi)">🔑 Reset sandi</button>` : ""}
      ${r.user_id === session?.user?.id || auOf[r.user_id]?.is_owner ? "" : `<button class="danger" data-del="${r.user_id}" data-nm="${esc(r.full_name)}" style="flex:0" title="Hapus akun. Bila sudah pernah mengirim data, datanya tetap tersimpan">Hapus akun</button>`}`}
      ${auOf[r.user_id]?.wajib_ganti_pw ? `<span class="muted" style="width:100%">memakai kata sandi sementara, belum diganti</span>` : ""}</li>`;
  v.innerHTML = `<div class="card"><h2>Pengguna</h2>
    <p>Link pendaftaran untuk dibagikan: <b>${esc(link)}</b> <button class="sec" id="cp" style="padding:4px 10px">Salin</button></p>
    <p class="muted">Pendaftar tidak bisa melihat atau mengirim data sampai disetujui. Periksa nama, perusahaan dan nomor HP sebelum menyetujui — email belum diverifikasi otomatis.</p></div>
    ${(rs ?? []).length ? `<div class="card" style="background:#FFF4D6"><h3>Permintaan lupa kata sandi (${rs.length})</h3><p class="muted">Pengguna sudah meminta link reset ke email. Bila emailnya tidak sampai, buat kata sandi sementara lalu kirim ke orangnya langsung (WA/telepon), jangan lewat grup.</p><ul class="list">${rs.map((x) => `<li style="flex-wrap:wrap"><span style="flex:1"><b>${esc(x.nama)}</b> · ${esc(x.email)}<br><span class="muted">${esc(x.peran)} · diminta ${new Date(x.diminta_at).toLocaleString("id-ID")}${x.jumlah > 1 ? ` · ${x.jumlah}×` : ""}</span></span><button data-rpw="${x.user_id}" data-nm="${esc(x.nama)}" style="flex:0">🔑 Buat kata sandi sementara</button></li>`).join("")}</ul></div>` : ""}
    <div class="card"><h3>Menunggu persetujuan (${pend.length})</h3><ul class="list">${pend.map((r) => row(r, true)).join("") || `<li class="muted">Tidak ada.</li>`}</ul></div>
    <div class="card"><h3>Semua pengguna</h3><ul class="list">${rest.map((r) => row(r, false)).join("") || `<li class="muted">-</li>`}</ul></div>
    ${dihapus.length ? `<details class="card"><summary><b>Akun dihapus (${dihapus.length})</b> <span class="muted">— tidak bisa masuk; data yang pernah dikirim tetap tersimpan atas nama mereka</span></summary><ul class="list">${dihapus.map((r) => `<li><span style="flex:1"><b>${esc(r.full_name)}</b> · ${esc(r.email)}<br><span class="muted">dihapus ${new Date(auOf[r.user_id].dihapus_at).toLocaleString("id-ID")}${auOf[r.user_id].nonaktif_alasan ? " · " + esc(auOf[r.user_id].nonaktif_alasan) : ""}</span></span></li>`).join("")}</ul><p class="muted">Bila orang ini perlu masuk lagi, ia mendaftar ulang (email yang sama boleh) dan menunggu persetujuan.</p></details>` : ""}
    <div class="card" id="akc"></div><div class="card" id="rlc"></div>`;
  aksesKlien($("#akc")); rilisAdmin($("#rlc"));
  $("#cp").onclick = async () => { await navigator.clipboard?.writeText(link); $("#cp").textContent = "Tersalin"; };
  const act = async (uid, role) => {
    const note = role ? prompt("Catatan (opsional), mis. 'kru RIG-03':") ?? "" : prompt("Alasan menolak / menonaktifkan (wajib):");
    if (!role && !note) return;
    const { error } = await sb.rpc("admin_set_user", { p_user: uid, p_role: role, p_note: note || null });
    if (error) alert(error.message); else usersView(v);
  };
  v.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = () => act(b.dataset.ok, v.querySelector(`[data-role="${b.dataset.ok}"]`).value)));
  v.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => act(b.dataset.no, null)));
  // Hapus permanen: server menolak bila akun pernah mengirim data (pakai Nonaktifkan agar riwayat utuh)
  v.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (await hapusAkun(b.dataset.del, b.dataset.nm)) usersView(v); }));
  v.querySelectorAll("[data-rpw]").forEach((b) => (b.onclick = async () => { if (await resetSandiAdmin(b.dataset.rpw, b.dataset.nm)) usersView(v); }));
}

// ---------- utilitas bersama ----------
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const pinToken = (uid, pin) => sha256(`TGEP|${uid}|${pin}`);
const isStaff = () => ["geologist", "verifier", "admin"].includes(me?.role);
const isVer = () => ["verifier", "admin"].includes(me?.role);
const todayWIB = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const online = () => navigator.onLine && session && !session.offline;
async function cached(key, fetcher) {
  if (online()) { try { const d = await fetcher(); if (d?.length) { localStorage.setItem(key, JSON.stringify(d)); return d; } } catch { /* pakai cache */ } }
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function shiftWindow(date, shift) {
  const s = new Date(`${date}T${shift === "PAGI" ? "06:00" : "18:00"}:00+07:00`);
  return [s.toISOString(), new Date(s.getTime() + 12 * 3600e3).toISOString()];
}
async function signedUrls(bucket, paths) {
  const ps = [...new Set(paths.filter(Boolean))]; if (!ps.length) return {};
  const { data } = await sb.storage.from(bucket).createSignedUrls(ps, 3600);
  return Object.fromEntries((data ?? []).map((x) => [x.path, x.signedUrl]));
}

// ---------- TTD saya: daftar tanda tangan sekali, PIN + kartu QR ----------
async function ttdView(v) {
  let prof = null;
  if (online()) prof = (await sb.from("signature_profile").select("*").eq("user_id", session.user.id).maybeSingle()).data;
  const img = prof ? (await signedUrls("signatures", [prof.signature_path]))[prof.signature_path] : null;
  v.innerHTML = `<div class="card"><h2>Tanda tangan elektronik</h2>
    ${prof ? `<p>TTD terdaftar atas nama <b>${esc(prof.full_name)}</b>${prof.title ? " · " + esc(prof.title) : ""}.</p><img src="${img ?? ""}" alt="Tanda tangan terdaftar" style="max-width:320px;background:#fff;border:1px solid #ccc;border-radius:8px">` : `<p>Belum ada TTD. Daftarkan sekali, lalu setiap DDR cukup ditandatangani dengan <b>PIN</b> atau <b>kartu QR</b>.</p>`}
    <p class="muted">PIN dan kartu QR sama dengan tanda tangan Anda — jangan diberikan ke orang lain. Salah PIN 5 kali mengunci TTD 15 menit.</p></div>
    <div class="card"><h3>${prof ? "Ganti" : "Daftarkan"} tanda tangan</h3>
    <label>Cara membuat tanda tangan</label>
    <div class="row"><button class="sec" id="mDraw" style="flex:1">Gambar sendiri</button><button class="sec" id="mFont" style="flex:1">Pilih gaya dari nama</button></div>
    <div id="fontBox" style="display:none"><label>Nama pada tanda tangan</label><input id="sigName" value="${esc(prof?.full_name ?? me?.full_name ?? "")}">
      <div id="styles" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"></div><p class="muted">Ketuk salah satu gaya. Hasilnya muncul di kotak bawah dan masih bisa ditambah coretan/paraf.</p></div>
    <label>Tanda tangan (kotak putih)</label>
    <canvas id="pad" width="600" height="220" style="width:100%;max-width:600px;height:auto;background:#fff;border:2px dashed #9aa59f;border-radius:8px;touch-action:none"></canvas>
    <div class="row" style="margin-top:6px"><button class="sec" id="clr" style="flex:0">Hapus gambar</button></div>
    <label>Jabatan</label><input id="ttl" value="${esc(prof?.title ?? (me?.role === "driller" ? "Driller" : "Wellsite Geologist"))}">
    <div class="row"><div><label>PIN 6 angka</label><input id="p1" type="password" inputmode="numeric" maxlength="6"></div><div><label>Ulangi PIN</label><input id="p2" type="password" inputmode="numeric" maxlength="6"></div></div>
    <div style="margin-top:10px"><button id="sv">Simpan TTD & buat kartu QR</button></div><div id="e" class="err"></div><div id="card"></div></div>`;
  const pad = $("#pad"), x = pad.getContext("2d"); let drawing = false, inked = false;
  x.lineWidth = 3; x.lineCap = "round"; x.strokeStyle = "#0b2a6b";
  const pt = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; };
  pad.onpointerdown = (e) => { drawing = true; x.beginPath(); x.moveTo(...pt(e)); pad.setPointerCapture(e.pointerId); };
  pad.onpointermove = (e) => { if (!drawing) return; x.lineTo(...pt(e)); x.stroke(); inked = true; };
  pad.onpointerup = () => (drawing = false);
  $("#clr").onclick = () => { x.clearRect(0, 0, pad.width, pad.height); inked = false; };
  const FONTS = [["Great Vibes", "great-vibes"], ["Dancing Script", "dancing-script"], ["Sacramento", "sacramento"], ["Allura", "allura"]];
  const drawName = (cv, fam, name) => { const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = "#0b2a6b"; c.textBaseline = "middle";
    let size = cv.height * 0.55; c.font = `${size}px "${fam}"`; while (c.measureText(name).width > cv.width * 0.9 && size > 10) { size -= 2; c.font = `${size}px "${fam}"`; }
    const w = c.measureText(name).width, x0 = (cv.width - w) / 2; c.fillText(name, x0, cv.height * 0.48);
    c.strokeStyle = "#0b2a6b"; c.lineWidth = Math.max(1.5, cv.height / 110); c.beginPath(); c.moveTo(x0 + w * 0.1, cv.height * 0.78); c.quadraticCurveTo(x0 + w * 0.55, cv.height * 0.70, x0 + w * 1.02, cv.height * 0.80); c.stroke(); };
  const showStyles = async () => {
    const name = $("#sigName").value.trim(); if (!name) return ($("#styles").innerHTML = `<p class="err">Isi nama dulu.</p>`);
    await Promise.all(FONTS.map(async ([fam, f]) => { if (![...document.fonts].some((ff) => ff.family === fam && ff.status === "loaded")) { const ff = new FontFace(fam, `url(./vendor/fonts/${f}-latin-400-normal.woff2)`); await ff.load(); document.fonts.add(ff); } }));
    $("#styles").innerHTML = ""; FONTS.forEach(([fam]) => { const cv = document.createElement("canvas"); cv.width = 600; cv.height = 220; cv.style.cssText = "width:100%;background:#fff;border:2px solid #ccd;border-radius:8px;cursor:pointer";
      drawName(cv, fam, name); cv.onclick = () => { drawName(pad, fam, name); x.lineWidth = 3; x.strokeStyle = "#0b2a6b"; inked = true; $("#styles").querySelectorAll("canvas").forEach((k) => (k.style.borderColor = "#ccd")); cv.style.borderColor = "#1E9E69"; }; $("#styles").appendChild(cv); });
  };
  $("#mDraw").onclick = () => { $("#fontBox").style.display = "none"; };
  $("#mFont").onclick = () => { $("#fontBox").style.display = ""; showStyles().catch(() => ($("#styles").innerHTML = `<p class="err">Gaya huruf belum tersimpan di HP; buka sekali saat online.</p>`)); };
  $("#sigName").oninput = () => showStyles().catch(() => {});
  $("#sv").onclick = async () => {
    const p1 = $("#p1").value, p2 = $("#p2").value;
    if (!online()) return ($("#e").textContent = "Pendaftaran TTD perlu sinyal internet.");
    if (!inked) return ($("#e").textContent = "Gambar tanda tangan dulu.");
    if (!/^\d{6}$/.test(p1)) return ($("#e").textContent = "PIN harus 6 angka.");
    if (/^(\d)\1{5}$|^(012345|123456|234567|345678|456789|987654|876543|765432|654321|543210)$/.test(p1)) return ($("#e").textContent = "PIN terlalu mudah ditebak.");
    if (p1 !== p2) return ($("#e").textContent = "Ulangan PIN tidak sama.");
    $("#sv").disabled = true;
    const blob = await new Promise((r) => pad.toBlob(r, "image/png"));
    const path = `${session.user.id}/ttd-${Date.now()}.png`;
    const up = await sb.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
    if (up.error) { $("#sv").disabled = false; return ($("#e").textContent = up.error.message); }
    const qrSecret = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await sb.rpc("set_signature", { p_path: path, p_title: $("#ttl").value.trim() || null, p_pin_token: await pinToken(session.user.id, p1), p_qr_secret: qrSecret });
    $("#sv").disabled = false;
    if (error) return ($("#e").textContent = error.message);
    localStorage.removeItem("signers");
    const { default: qrcode } = await import("./vendor/qrgen.js");
    const q = qrcode(0, "M"); q.addData(`TGEPSIG|${session.user.id}|${qrSecret}`); q.make();
    const c = document.createElement("canvas"), n = q.getModuleCount(), cell = 8, pad2 = 32; c.width = n * cell + pad2 * 2; c.height = c.width + 90;
    const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height); cx.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) cx.fillRect(pad2 + k * cell, pad2 + r * cell, cell, cell);
    cx.font = "bold 18px sans-serif"; cx.fillText(`TTD ${me?.full_name ?? ""}`, pad2, c.width + 20); cx.font = "14px sans-serif";
    cx.fillText("Kartu tanda tangan DDR · PT Terra Grapindo Eco Prima", pad2, c.width + 44); cx.fillText("RAHASIA — jangan dipinjamkan", pad2, c.width + 66);
    const url = c.toDataURL("image/png");
    $("#card").innerHTML = `<div class="card" style="background:#DCEFE4"><b>TTD tersimpan.</b> Ini kartu QR Anda — <b>hanya ditampilkan sekali</b>. Simpan di HP Anda atau cetak, lalu tunjukkan ke kamera saat menandatangani DDR.<br><img src="${url}" alt="Kartu QR tanda tangan" style="max-width:260px;margin-top:8px"><br><a href="${url}" download="Kartu_TTD_${esc((me?.full_name ?? "").replace(/\s+/g, "_"))}.png"><button>Unduh kartu QR</button></a></div>`;
  };
}

// ---------- dialog tanda tangan (PIN atau scan QR) ----------
// Wellsite boleh menerima TTD DRILLER langsung di layar HP-nya: driller tidak perlu akun/login (metode CORET, server mencatat wellsite yang menginput).
const bisaTtdLayar = (slot) => slot === "DRILLER" && ["geologist", "verifier", "admin"].includes(me?.role);
// ---------- 🧭 Koordinat lubang (collar) manual: UTM WGS84 51S atau lat/lon → borehole.xgps/ygps/zgps, tercatat di koordinat_log ----------
async function koordinatLubang(bh0 = "", selesai) {
  if (!online()) return alert("Perlu sinyal untuk menyimpan koordinat lubang.");
  const m = modal(`<h3 style="margin-top:0">🧭 Koordinat lubang (collar)</h3>
    <p class="muted" style="margin-top:0">Isi bila koordinat di database kosong atau salah. Sistem: <b>UTM WGS84 Zona 51S</b> (X 6 digit, Y 7 digit). Bisa juga ketik lintang/bujur desimal — otomatis diubah ke UTM.</p>
    <label>Hole ID *</label><div class="row"><input id="koB" data-bhid list="dlBH" value="${esc(bh0)}" autocapitalize="characters"><button class="sec" id="koL" style="flex:0">Muat</button></div>
    <div id="koInfo" class="muted" style="font-size:13px;margin:6px 0"></div>
    <div class="row" style="flex-wrap:wrap"><button class="sec" id="koM" style="flex:1 1 150px">Isi dari Marking titik</button><button class="sec" id="koR" style="flex:1 1 150px">Isi dari titik rencana</button></div>
    <div class="row"><div><label>X / Easting (m)</label><input id="koX" inputmode="decimal" placeholder="mis. 586300,12"></div><div><label>Y / Northing (m)</label><input id="koY" inputmode="decimal" placeholder="mis. 9814100,50"></div><div style="max-width:110px"><label>Z (m dpl)</label><input id="koZ" inputmode="decimal"></div></div>
    <div class="row"><div><label>atau Lintang (desimal)</label><input id="koLat" inputmode="decimal" placeholder="-1.681810"></div><div><label>Bujur (desimal)</label><input id="koLon" inputmode="decimal" placeholder="121.776326"></div></div>
    <p id="koJ" class="muted" style="font-size:13px;margin:4px 0"></p>
    <label>Sumber koordinat</label><select id="koS"><option value="MARKING">Marking titik (GPS aplikasi)</option><option value="GPS GENGGAM">GPS genggam (Garmin dll.)</option><option value="SURVEY">Survei (total station / GNSS)</option><option value="RENCANA">Titik rencana (belum diukur)</option><option value="MANUAL">Lainnya / manual</option></select>
    <label>Alasan / keterangan *</label><input id="koA" placeholder="mis. koordinat kosong, diisi dari GPS Garmin wellsite">
    <div class="row" style="margin-top:10px"><button id="koOk">Simpan koordinat</button><button class="sec" id="koX2">Batal</button></div><div id="koE" class="err"></div><div id="koLog"></div>`);
  const q = (x) => m.querySelector(x), E = (t) => (q("#koE").textContent = t), num = (x) => (String(x ?? "").trim() === "" ? null : Number(String(x).replace(/\s/g, "").replace(",", ".")));
  let MK = [], RC = null;
  const isiXY = (x, y, z) => { q("#koX").value = x != null ? (+x).toFixed(2).replace(".", ",") : ""; q("#koY").value = y != null ? (+y).toFixed(2).replace(".", ",") : ""; if (z != null) q("#koZ").value = String(Math.round(+z * 100) / 100).replace(".", ","); jarakInfo(); };
  const jarakInfo = () => { const x = num(q("#koX").value), y = num(q("#koY").value); if (!RC || x == null || y == null) return (q("#koJ").textContent = "");
    const [rx, ry] = UTM.ke(+RC.lon, +RC.lat), d = Math.round(Math.hypot(x - rx, y - ry)); q("#koJ").innerHTML = `Jarak dari titik rencana: <b>${d} m</b>${d > 25 ? " — titik bergeser dari rencana" : ""}`; };
  q("#koX").oninput = q("#koY").oninput = () => { q("#koLat").value = ""; q("#koLon").value = ""; jarakInfo(); };
  q("#koLat").oninput = q("#koLon").oninput = () => { const la = num(q("#koLat").value), lo = num(q("#koLon").value);
    if (la != null && lo != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) { const [x, y] = UTM.ke(lo, la); q("#koX").value = x.toFixed(2).replace(".", ","); q("#koY").value = y.toFixed(2).replace(".", ","); jarakInfo(); } };
  const muat = async () => { const bh = bakuBH(q("#koB").value); if (!bh) return; q("#koB").value = bh; q("#koInfo").textContent = "Memuat…";
    const [{ data: c }, { data: mk }, { data: lg }] = await Promise.all([sb.from("v_dh_collar").select("east,north,rl,coord_source").eq("holeid", bh).maybeSingle(),
      sb.from("marking").select("lat,lon,akurasi_m,x_utm,y_utm,z_gps,z_dem,captured_at").eq("bhid", bh).order("akurasi_m"),
      sb.from("koordinat_log").select("x_lama,y_lama,x_baru,y_baru,z_baru,sumber,alasan,nama,diubah_at").eq("bhid", bh).order("diubah_at", { ascending: false })]);
    MK = mk ?? []; RC = rencanaLokal().find((z) => z.bhid === bh) ?? null;
    q("#koInfo").innerHTML = `${c?.east != null ? `Koordinat sekarang: <b>X ${fmtD(c.east)} · Y ${fmtD(c.north)}${c.rl != null ? ` · Z ${fmtD(c.rl)}` : ""}</b> (${esc(c.coord_source ?? "")})` : `<b style="color:#8A1C12">Koordinat di database masih kosong.</b>`}<br>Marking titik: ${MK.length ? `${MK.length} pembacaan, terbaik ±${MK[0].akurasi_m} m` : "belum ada"} · Titik rencana: ${RC ? "ada" : "tidak ada"}`;
    q("#koM").disabled = !MK.length; q("#koR").disabled = !RC;
    if (c?.east != null) isiXY(c.east, c.north, c.rl); else if (MK.length) q("#koM").click(); else jarakInfo();
    q("#koLog").innerHTML = (lg ?? []).length ? `<h4 style="margin:10px 0 4px">Riwayat koordinat</h4><ul class="list">${lg.map((l) => `<li><span>${esc(fmtT(new Date(l.diubah_at)))} · <b>${esc(l.nama ?? "")}</b> · ${l.x_lama != null ? `${fmtD(l.x_lama)}, ${fmtD(l.y_lama)}` : "kosong"} → ${fmtD(l.x_baru)}, ${fmtD(l.y_baru)} (${esc(l.sumber ?? "")})<br><span class="muted">${esc(l.alasan)}</span></span></li>`).join("")}</ul>` : ""; };
  // Marking: rata-rata pembacaan dengan akurasi terbaik (selisih ≤ 2 m dari yang terbaik)
  q("#koM").onclick = () => { if (!MK.length) return; const best = +MK[0].akurasi_m || 0, P = MK.filter((x) => (+x.akurasi_m || 0) <= best + 2);
    const av = (k) => { const v = P.map((x) => x[k]).filter((x) => x != null && x !== ""); return v.length ? v.reduce((s, x) => s + +x, 0) / v.length : null; };
    const la = av("lat"), lo = av("lon"), [x, y] = UTM.ke(lo, la); isiXY(x, y, av("z_gps") ?? av("z_dem")); q("#koS").value = "MARKING";
    if (!q("#koA").value) q("#koA").value = `rata-rata ${P.length} pembacaan Marking titik (±${best} m)`; };
  q("#koR").onclick = () => { if (!RC) return; const [x, y] = UTM.ke(+RC.lon, +RC.lat); isiXY(x, y, null); q("#koS").value = "RENCANA"; if (!q("#koA").value) q("#koA").value = "koordinat titik rencana (belum diukur di lapangan)"; };
  q("#koL").onclick = muat; q("#koB").onchange = muat; q("#koX2").onclick = () => m.remove();
  q("#koOk").onclick = async () => { const bh = bakuBH(q("#koB").value), x = num(q("#koX").value), y = num(q("#koY").value), z = num(q("#koZ").value), al = q("#koA").value.trim();
    if (!bh) return E("Isi Hole ID.");
    if (!(x >= 100000 && x <= 900000 && y >= 0 && y <= 10000000)) return E("Koordinat UTM tidak wajar: X 6 digit, Y 7 digit (UTM WGS84 51S).");
    if (!al) { q("#koA").focus(); return E("Tulis alasan / sumber koordinat."); }
    q("#koOk").disabled = true; const { error } = await sb.rpc("set_koordinat_lubang", { p_bhid: bh, p_x: x, p_y: y, p_z: z, p_sumber: q("#koS").value, p_alasan: al }); q("#koOk").disabled = false;
    if (error) return E(error.message); m.remove(); toast(`✓ Koordinat ${bh} disimpan`); selesai?.(); };
  if (bh0) muat();
}
// ---------- Titik bergeser dari rencana (drill plan) ----------
// Hasil: null = batal (Hole ID salah), {} = tidak perlu ditanya, { titik_bergeser, geser_m, geser_ket } = jawaban
async function cekGeser(bhid, pos) {
  const rc = rencanaLokal().find((z) => z.bhid === bhid); if (!rc || rc.lat == null || rc.lon == null) return {};
  const d = Math.round(jarakM([pos.lon, pos.lat], [+rc.lon, +rc.lat])), batas = Math.max(25, (Number(pos.acc) || 0) * 1.5); if (d <= batas) return {};
  const k = `geser_${bhid}`, ingat = localStorage.getItem(k) ?? "";
  if (ingat.startsWith("YA")) return { titik_bergeser: true, geser_m: d, geser_ket: ingat.slice(3) || null };
  if (ingat === `TIDAK|${todayWIB()}`) return { titik_bergeser: false, geser_m: d, geser_ket: "titik sesuai rencana (dikonfirmasi)" };
  return new Promise((res) => {
    const m = modal(`<h3 style="margin-top:0">📍 Lokasi berbeda dari drill plan</h3>
      <p>Lokasi foto ini <b>±${d} m</b> dari titik rencana <b>${esc(bhid)}</b>${pos.acc != null ? ` (akurasi GPS ±${Math.round(pos.acc)} m)` : ""}.</p>
      <p style="margin:6px 0"><b>Apakah titik bor bergeser dari rencana?</b></p>
      <label>Keterangan (wajib bila bergeser)</label><input id="gsK" placeholder="mis. digeser 30 m ke utara karena lereng curam / akses jalan">
      <div class="row" style="margin-top:10px;flex-wrap:wrap"><button id="gsY" style="flex:1 1 160px">Ya, titik bergeser</button><button class="sec" id="gsT" style="flex:1 1 160px">Tidak, titik sesuai rencana</button></div>
      <p class="muted" style="font-size:12px;margin:6px 0">Pilih <b>Tidak</b> bila GPS sedang meleset atau foto diambil agak jauh dari lubang.</p>
      <div class="row"><button class="sec" id="gsX">Hole ID salah — batal</button></div><div id="gsE" class="err"></div>`);
    m.querySelector("#gsY").onclick = () => { const ket = m.querySelector("#gsK").value.trim(); if (ket.length < 5) return (m.querySelector("#gsE").textContent = "Tulis keterangan pergeseran (arah, jarak, alasan).");
      localStorage.setItem(k, `YA|${ket}`); m.remove(); toast(isStaff() ? "Titik bergeser dicatat — lakukan 📍 Marking titik untuk koordinat baru." : "Titik bergeser dicatat."); res({ titik_bergeser: true, geser_m: d, geser_ket: ket }); };
    m.querySelector("#gsT").onclick = () => { localStorage.setItem(k, `TIDAK|${todayWIB()}`); m.remove(); res({ titik_bergeser: false, geser_m: d, geser_ket: m.querySelector("#gsK").value.trim() || "titik sesuai rencana (dikonfirmasi)" }); };
    m.querySelector("#gsX").onclick = () => { m.remove(); res(null); };
  });
}
// ---------- ✏️ Ubah / ganti foto aktivitas (termasuk foto run yang tampil di DDR) ----------
const JENIS_UBAH = ["GANTI_MATA_BOR", "TAMBAH_STANG", "STANDBY", "PERBAIKAN", "PINDAH_TITIK", "LAINNYA", "FOTO_DRILL_PAD", "FOTO_PATOK"];
async function editFotoAktivitas(id, selesai) {
  if (!online()) return alert("Perlu sinyal untuk mengubah data yang sudah terkirim.");
  const [{ data: e, error }, { data: lg }] = await Promise.all([sb.from("drill_event").select("*").eq("id", id).single(),
    sb.from("foto_edit_log").select("kolom,nilai_lama,nilai_baru,alasan,nama,diubah_at").eq("ref_id", id).order("diubah_at", { ascending: false })]);
  if (error) return alert(error.message);
  const url = e.photo_path ? (await signedUrls("progress-photos", [e.photo_path]))[e.photo_path] : null;
  let baru = null;
  const bisaJenis = JENIS_UBAH.includes(e.event_type);
  const m = modal(`<h3 style="margin-top:0">✏️ Ubah foto aktivitas</h3>
    <p class="muted" style="margin-top:0">${esc(EV[e.event_type] ?? e.event_type)} · ${esc(e.rig ?? "")} · ${esc(fmtT(new Date(e.captured_at)))}${e.depth_to != null ? ` · ${fmtD(e.depth_from)}–${fmtD(e.depth_to)} m` : ""}</p>
    <div id="efF" style="text-align:center">${url ? `<img src="${esc(url)}" style="max-height:30vh;max-width:100%;border-radius:8px">` : `<p class="muted">Foto lama tidak tersedia di server (mungkin sudah dipindah ke Drive).</p>`}</div>
    <div class="row" style="margin-top:6px"><button class="sec" id="efK" style="flex:1">📷 Ganti dengan foto kamera</button><button class="sec" id="efG" style="flex:1">🖼 Ganti dari galeri</button></div>
    <label>Hole ID</label><input id="efB" data-bhid list="dlBH" value="${esc(e.bhid ?? "")}" autocapitalize="characters">
    ${bisaJenis ? `<label>Jenis foto</label><select id="efJ">${JENIS_UBAH.map((k) => `<option value="${k}" ${k === e.event_type ? "selected" : ""}>${esc(EV[k] ?? k)}</option>`).join("")}</select>` : `<p class="muted" style="font-size:12px">Jenis ${esc(EV[e.event_type] ?? e.event_type)} tidak bisa diubah; bila salah jenis, hapus lalu foto ulang.</p>`}
    <label>Titik bor bergeser dari drill plan?</label><select id="efS"><option value="">— tidak diubah${e.titik_bergeser == null ? "" : e.titik_bergeser ? " (sekarang: YA)" : " (sekarang: TIDAK)"} —</option><option value="1">Ya, titik bergeser</option><option value="0">Tidak, sesuai rencana</option></select>
    <input id="efSK" placeholder="keterangan pergeseran (arah, jarak, alasan)" value="${esc(e.geser_ket ?? "")}" style="margin-top:4px">
    <label>Alasan perubahan *</label><input id="efR" placeholder="mis. foto tertukar dengan kotak/lubang lain, foto buram">
    <div class="row" style="margin-top:10px"><button id="efOk">Simpan perubahan</button><button class="sec" id="efX">Batal</button></div><div id="efE" class="err"></div>
    ${(lg ?? []).length ? `<h4 style="margin:10px 0 4px">Riwayat perubahan</h4><ul class="list">${lg.map((l) => `<li><span>${esc(fmtT(new Date(l.diubah_at)))} · <b>${esc(l.nama ?? "")}</b> · ${esc(l.kolom)}${l.kolom === "photo_path" ? " (foto diganti)" : `: ${esc(l.nilai_lama ?? "-")} → ${esc(l.nilai_baru ?? "-")}`}<br><span class="muted">${esc(l.alasan)}</span></span></li>`).join("")}</ul>` : ""}`);
  const q = (x) => m.querySelector(x), E = (t) => (q("#efE").textContent = t);
  const ganti = async (kamera) => { const f0 = await pilihFile(kamera); if (!f0) return; const f = await pratinjauFoto(f0, "Foto pengganti"); if (!f) return; baru = f;
    q("#efF").innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-height:30vh;max-width:100%;border-radius:8px;border:3px solid #1E9E69"><br><small style="color:#1E9E69;font-weight:600">Foto baru — belum disimpan</small>`; };
  q("#efK").onclick = () => ganti(true); q("#efG").onclick = () => ganti(false); q("#efX").onclick = () => m.remove();
  q("#efOk").onclick = async () => {
    const alasan = q("#efR").value.trim(); if (!alasan) { q("#efR").focus(); return E("Tulis alasan perubahan."); }
    const bh = bakuBH(q("#efB").value) || null, jn = q("#efJ")?.value || null, gs = q("#efS").value;
    if (gs === "1" && q("#efSK").value.trim().length < 5) return E("Tulis keterangan pergeseran titik.");
    q("#efOk").disabled = true; E("Menyimpan…");
    let path = null;
    if (baru) { const blob = await stampPhoto(baru, [`TGEP · ${e.rig ?? ""} · ${bh ?? e.bhid ?? "-"} · ${me?.full_name ?? ""}`, `${EV[jn ?? e.event_type] ?? ""} · FOTO PENGGANTI`, `${fmtT(new Date())} WIB · diganti dari foto ${fmtT(new Date(e.captured_at))}`]);
      path = `${session.user.id}/${e.rig || "RIG"}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("progress-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false }); if (up.error) { q("#efOk").disabled = false; return E(up.error.message); } }
    const { data: r, error: er } = await sb.rpc("ubah_foto_aktivitas", { p_id: id, p_photo_path: path, p_bhid: bh, p_event_type: jn, p_alasan: alasan,
      p_titik_bergeser: gs === "" ? null : gs === "1", p_geser_ket: q("#efSK").value.trim() || null });
    q("#efOk").disabled = false; if (er) return E(er.message);
    if (gs === "1" && bh) localStorage.setItem(`geser_${bh}`, `YA|${q("#efSK").value.trim()}`);
    m.remove(); toast(r?.changed ? `✓ ${r.changed} perubahan disimpan` : "Tidak ada perubahan"); selesai?.(); };
}
// ---------- ✏️ Ubah / ganti foto core (wellsite/verifier/admin) — foto baru diperiksa ulang otomatis ----------
async function editFotoCore(id, selesai) {
  if (!online()) return alert("Perlu sinyal untuk mengubah foto core.");
  const [{ data: c, error }, { data: lg }] = await Promise.all([sb.from("core_photo").select("id,bhid,box_no,depth_from,depth_to,photo_type,photo_path,preview_path,status,captured_at").eq("id", id).single(),
    sb.from("foto_edit_log").select("kolom,nilai_lama,nilai_baru,alasan,nama,diubah_at").eq("ref_id", id).order("diubah_at", { ascending: false })]);
  if (error) return alert(error.message);
  const pv = c.preview_path || c.photo_path, url = pv ? (await signedUrls("core-photos", [pv]))[pv] : null;
  let baru = null;
  const m = modal(`<h3 style="margin-top:0">✏️ Ubah foto core</h3>
    <div id="ecF" style="text-align:center">${url ? `<img src="${esc(url)}" style="max-height:30vh;max-width:100%;border-radius:8px">` : `<p class="muted">Foto lama tidak tersedia di server.</p>`}</div>
    <div class="row" style="margin-top:6px"><button class="sec" id="ecK" style="flex:1">📷 Foto ulang corebox</button><button class="sec" id="ecG" style="flex:1">🖼 Ganti dari galeri</button></div>
    <div class="row"><div><label>Hole ID</label><input id="ecB" data-bhid list="dlBH" value="${esc(c.bhid ?? "")}" autocapitalize="characters"></div><div style="max-width:90px"><label>Kotak</label><input id="ecN" inputmode="numeric" value="${esc(c.box_no ?? "")}"></div></div>
    <div class="row"><div><label>FROM (m)</label><input id="ecA" inputmode="decimal" value="${esc(fmtD(c.depth_from))}"></div><div><label>TO (m)</label><input id="ecZ" inputmode="decimal" value="${esc(fmtD(c.depth_to))}"></div><div><label>Jenis</label><select id="ecT">${["UTUH", "BELAH"].map((k) => `<option ${k === c.photo_type ? "selected" : ""}>${k}</option>`).join("")}</select></div></div>
    <label>Alasan perubahan *</label><input id="ecR" placeholder="mis. foto tertukar kotak 2 dan 3, kedalaman salah tulis">
    <p class="muted" style="font-size:12px">Foto pengganti diperiksa ulang otomatis sesuai SOP (status kembali menunggu pemeriksaan).</p>
    <div class="row" style="margin-top:8px"><button id="ecOk">Simpan perubahan</button><button class="sec" id="ecX">Batal</button></div><div id="ecE" class="err"></div>
    ${(lg ?? []).length ? `<h4 style="margin:10px 0 4px">Riwayat perubahan</h4><ul class="list">${lg.map((l) => `<li><span>${esc(fmtT(new Date(l.diubah_at)))} · <b>${esc(l.nama ?? "")}</b> · ${esc(l.kolom)}${l.kolom === "photo_path" ? " (foto diganti)" : `: ${esc(l.nilai_lama ?? "-")} → ${esc(l.nilai_baru ?? "-")}`}<br><span class="muted">${esc(l.alasan)}</span></span></li>`).join("")}</ul>` : ""}`);
  const q = (x) => m.querySelector(x), E = (t) => (q("#ecE").textContent = t), num = (x) => (String(x ?? "").trim() === "" ? null : Number(String(x).replace(",", ".")));
  const ganti = async (kamera) => { const f = await pilihFile(kamera); if (!f) return; baru = f; q("#ecF").innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-height:30vh;max-width:100%;border-radius:8px;border:3px solid #1E9E69"><br><small style="color:#1E9E69;font-weight:600">Foto baru — belum disimpan</small>`; };
  q("#ecK").onclick = () => ganti(true); q("#ecG").onclick = () => ganti(false); q("#ecX").onclick = () => m.remove();
  q("#ecOk").onclick = async () => {
    const alasan = q("#ecR").value.trim(); if (!alasan) { q("#ecR").focus(); return E("Tulis alasan perubahan."); }
    const bh = bakuBH(q("#ecB").value) || null, box = num(q("#ecN").value), fr = num(q("#ecA").value), to = num(q("#ecZ").value);
    if (!(Number.isFinite(fr) && Number.isFinite(to) && to > fr && to - fr <= 5.0001)) return E("FROM–TO tidak valid (TO > FROM, maksimal 5 m per kotak).");
    q("#ecOk").disabled = true; E("Menyimpan…");
    let path = null, prev = null;
    if (baru) { try { const bmp = await bukaGambar(baru); const lc = await localCheck(bmp);
        if (lc.sharpness < 25 || lc.brightness < 45) { q("#ecOk").disabled = false; return E(lc.sharpness < 25 ? "Foto pengganti terlalu buram — ambil ulang." : "Foto pengganti terlalu gelap — ambil ulang di tempat terang."); }
        const base = `${session.user.id}/${bh ?? c.bhid}/${crypto.randomUUID()}`; path = `${base}.jpg`; prev = `${base}_preview.jpg`;
        for (const [p, b] of [[path, await dpi300(await toJpeg(bmp, 4961, 0.92))], [prev, await toJpeg(bmp, 1600, 0.85)]]) {
          const up = await sb.storage.from("core-photos").upload(p, b, { contentType: "image/jpeg", upsert: false }); if (up.error) throw up.error; }
      } catch (x) { q("#ecOk").disabled = false; return E(x.message); } }
    const { data: r, error: er } = await sb.rpc("ganti_foto_core", { p_id: id, p_path: path, p_preview: prev, p_bhid: bh, p_box_no: box, p_from: fr, p_to: to, p_type: q("#ecT").value, p_alasan: alasan });
    q("#ecOk").disabled = false; if (er) return E(er.message);
    if (r?.foto_baru) sb.functions.invoke("check-core-photo", { body: { photo_id: id } }).catch(() => {});
    m.remove(); toast(r?.changed ? `✓ ${r.changed} perubahan disimpan${r.foto_baru ? " — foto baru sedang diperiksa" : ""}` : "Tidak ada perubahan"); selesai?.(); };
}
// Daftar lubang lama yang kurang foto drill pad / patok (30 hari terakhir). Lubang dianggap selesai bila ada SELESAI_BOR
// atau rig-nya sudah bekerja di lubang lain sesudahnya (DDR / foto aktivitas).
async function isiSusulan(tok, mulai) {
  const el = $("#susulan"); if (!el) return;
  const dari = new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [{ data: E }, { data: D }] = await Promise.all([
    sb.from("v_drill_event_qc").select("bhid,rig,event_type,tanggal,captured_at").gte("tanggal", dari).not("bhid", "is", null).limit(5000),
    sb.from("v_ddr_baris").select("bhid,rig,tanggal").gte("tanggal", dari).not("bhid", "is", null).limit(5000)]);
  if (tok !== progView.tok || !$("#susulan")) return;
  const H = {}, akhirRig = {};
  const catat = (bh, rig, tgl, w, ev) => { const h = (H[bh] ??= { bhid: bh, rig, akhir: "", ev: new Set() }); if (`${tgl}|${w}` > h.akhir) { h.akhir = `${tgl}|${w}`; h.rig = rig || h.rig; h.tgl = tgl; }
    if (ev) h.ev.add(ev); if (rig && (!akhirRig[rig] || `${tgl}|${w}` > akhirRig[rig].k)) akhirRig[rig] = { k: `${tgl}|${w}`, bhid: bh }; };
  for (const e of E ?? []) catat(e.bhid, e.rig, e.tanggal, e.captured_at ?? "", e.event_type);
  for (const d of D ?? []) catat(d.bhid, d.rig, d.tanggal, "", null);
  const L = Object.values(H).filter((h) => (h.ev.has("SELESAI_BOR") || (h.rig && akhirRig[h.rig] && akhirRig[h.rig].bhid !== h.bhid)) && !(h.ev.has("FOTO_DRILL_PAD") && h.ev.has("FOTO_PATOK")))
    .sort((a, b) => b.akhir.localeCompare(a.akhir));
  el.style.display = "";
  el.innerHTML = `<h3 style="margin-top:0">📸 Foto susulan drill pad & patok</h3>
    <p class="muted" style="margin-top:0">Untuk lubang lama yang DDR-nya sudah masuk tetapi foto drill pad / patok akhir belum ada. Foto sekarang di lokasi; Hole ID dan rig otomatis dari lubang yang dipilih.</p>
    <ul class="list">${L.map((h, i) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:160px"><b>${esc(h.bhid)}</b> · ${esc(h.rig ?? "")}<br><span class="muted">terakhir ${esc(h.tgl ?? "")} · kurang ${["FOTO_DRILL_PAD", "FOTO_PATOK"].filter((k) => !h.ev.has(k)).map((k) => (k === "FOTO_PATOK" ? "foto patok" : "foto drill pad")).join(" & ")}</span></span><button data-sus="${i}" style="flex:0;white-space:nowrap">📸 Foto susulan</button></li>`).join("") || `<li class="muted">Tidak ada lubang lama yang kurang foto drill pad / patok (30 hari terakhir).</li>`}</ul>
    <div class="row" style="margin-top:6px"><button class="sec" id="susLain" style="flex:0;white-space:nowrap">Lubang lain…</button></div>`;
  el.querySelectorAll("[data-sus]").forEach((b) => (b.onclick = () => { const h = L[+b.dataset.sus]; mulai(h.bhid, h.rig || localStorage.getItem("rig")); }));
  el.querySelector("#susLain").onclick = () => { const bh = bakuBH(prompt("Hole ID lubang lama yang akan difoto susulan:") || ""); if (!bh) return;
    const rig = (prompt("Rig lubang itu:", H[bh]?.rig || localStorage.getItem("rig") || "") || "").trim().toUpperCase(); if (!rig) return; mulai(bh, rig); };
}
async function signDialog(slot, namaDriller = "") {
  const r = await signDialog0(slot, namaDriller);
  if (r === "__CORET__") { const c = await ttdDrillerLayar(namaDriller); return c ?? signDialog(slot, namaDriller); }
  return r;
}
function ttdDrillerLayar(nama = "") {
  return new Promise((resolve) => {
    const m = modal(`<h3 style="margin-top:0">✍️ TTD driller di layar ini</h3>
      <p class="muted" style="margin-top:0">Serahkan HP ke driller untuk tanda tangan langsung di kotak putih. Driller tidak perlu akun atau login. Server mencatat bahwa TTD ini diinput lewat akun Anda (${esc(me?.full_name ?? "wellsite")}).</p>
      <label>Nama driller *</label><input id="tdN" value="${esc(nama)}" placeholder="nama lengkap driller">
      <label>Tanda tangan driller (kotak putih)</label>
      <canvas id="tdP" width="600" height="220" style="width:100%;max-width:600px;height:auto;background:#fff;border:2px dashed #9aa59f;border-radius:8px;touch-action:none"></canvas>
      <div class="row" style="margin-top:6px"><button class="sec" id="tdC" style="flex:0">Hapus gambar</button></div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><input type="checkbox" id="tdS" style="width:auto;margin-top:3px"> <span>Saya menyaksikan driller menandatangani langsung di HP ini.</span></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:4px"><input type="checkbox" id="tdSimpan" checked style="width:auto;margin-top:3px"> <span>Simpan TTD ini atas persetujuan driller — DDR berikutnya cukup pilih namanya (TTD terisi otomatis).</span></label>
      <div class="row" style="margin-top:10px"><button id="tdOk">Simpan TTD driller</button><button class="sec" id="tdX">Kembali</button></div><div id="tdE" class="err"></div>`);
    const pad = m.querySelector("#tdP"), x = pad.getContext("2d"); let gambar = false, coret = 0;
    x.lineWidth = 3; x.lineCap = "round"; x.strokeStyle = "#0b2a6b";
    const pt = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; };
    pad.onpointerdown = (e) => { gambar = true; x.beginPath(); x.moveTo(...pt(e)); pad.setPointerCapture(e.pointerId); };
    pad.onpointermove = (e) => { if (!gambar) return; x.lineTo(...pt(e)); x.stroke(); coret++; };
    pad.onpointerup = pad.onpointercancel = () => (gambar = false);
    m.querySelector("#tdC").onclick = () => { x.clearRect(0, 0, pad.width, pad.height); coret = 0; };
    m.querySelector("#tdX").onclick = () => { m.remove(); resolve(null); };
    m.querySelector("#tdOk").onclick = () => { const E = (t) => (m.querySelector("#tdE").textContent = t), nm = m.querySelector("#tdN").value.trim().replace(/\s+/g, " ");
      if (nm.length < 3) return E("Isi nama driller.");
      if (coret < 8) return E("Minta driller menandatangani di kotak putih.");
      if (!m.querySelector("#tdS").checked) return E("Centang pernyataan bahwa Anda menyaksikan driller menandatangani.");
      const png = pad.toDataURL("image/png"); m.remove();
      resolve({ slot: "DRILLER", method: "CORET", name: nm, png, simpan: m.querySelector("#tdSimpan")?.checked ?? false, signed_at: new Date().toISOString() }); };
  });
}
// ✍️ Lengkapi TTD driller untuk banyak DDR sekaligus (wellsite/admin): per nama driller pakai TTD tersimpan,
// bila belum ada → driller coret sekali di layar (disimpan) lalu dipakai untuk DDR lain milik driller yang sama.
async function lengkapiTtdDriller(L, selesai) {
  if (!online()) return alert("Perlu sinyal untuk menandatangani DDR yang sudah terkirim.");
  const kunci = (x) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  let TS = await ttdDrillerTersimpan().catch(() => []);
  const G = {}; for (const d of L) (G[kunci(d.driller_name) || "(tanpa nama)"] ??= { nama: d.driller_name || "", ddr: [] }).ddr.push(d);
  const m = modal(`<h3 style="margin-top:0">✍️ Lengkapi TTD driller</h3>
    <p class="muted" style="margin-top:0">DDR yang belum ada TTD driller. Centang DDR yang sudah disetujui driller-nya. Driller tidak perlu login: dipakai <b>TTD tersimpan</b>; bila belum ada, driller tanda tangan <b>sekali</b> di layar HP ini lalu dipakai untuk DDR lain miliknya. Tercatat atas nama Anda.</p>
    ${Object.entries(G).map(([k, g], gi) => { const ts = TS.find((t) => kunci(t.nama) === k);
      return `<div class="card" style="margin:6px 0;padding:8px"><b>Driller: ${esc(g.nama || "(nama driller kosong di DDR)")}</b> · ${ts ? `<span style="color:#1E7A4F">TTD tersimpan ✓</span>` : `<span style="color:#8A5A00">belum ada TTD tersimpan — driller coret sekali</span>`}
        <ul class="list" style="margin:4px 0">${g.ddr.map((d) => `<li><label style="display:flex;gap:8px;align-items:center;margin:0;font-weight:400"><input type="checkbox" data-td="${esc(d.id)}" data-g="${gi}" ${g.nama ? "checked" : "disabled"} style="width:auto"> ${esc(d.report_date)} · ${d.shift === "MALAM" ? "Night" : "Day"} · ${esc(d.rig)} · ${esc(d.bhid ?? "")}</label></li>`).join("")}</ul>
        ${g.nama ? "" : `<small class="err">Isi nama driller lewat ✏️ Edit DDR dulu.</small>`}</div>`; }).join("")}
    <label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><input type="checkbox" id="tmS" style="width:auto;margin-top:3px"> <span>Saya menyatakan driller yang bersangkutan sudah menyetujui isi DDR yang dicentang.</span></label>
    <div class="row" style="margin-top:10px"><button id="tmOk">Simpan TTD driller</button><button class="sec" id="tmX">Batal</button></div><div id="tmE" class="err"></div>`);
  const q = (x) => m.querySelector(x), E = (t) => (q("#tmE").innerHTML = t);
  q("#tmX").onclick = () => m.remove();
  q("#tmOk").onclick = async () => {
    const pilih = [...m.querySelectorAll("[data-td]:checked")]; if (!pilih.length) return E("Centang minimal satu DDR.");
    if (!q("#tmS").checked) return E("Centang pernyataan persetujuan driller.");
    q("#tmOk").disabled = true; const hasil = [];
    const grup = Object.values(G);
    for (const [gi, g] of grup.entries()) {
      const ids = pilih.filter((c) => +c.dataset.g === gi).map((c) => c.dataset.td); if (!ids.length) continue;
      let ts = TS.find((t) => kunci(t.nama) === kunci(g.nama)), mulai = 0;
      if (!ts) { m.style.display = "none"; const c = await ttdDrillerLayar(g.nama); m.style.display = "";
        if (!c) { hasil.push(`${g.nama}: dibatalkan`); continue; }
        const { error } = await kirimTtdCoret(ids[0], { ...c, simpan: true }); hasil.push(`${g.nama} · DDR 1: ${error ? "GAGAL " + error.message : "✓"}`); mulai = 1;
        TS = await ttdDrillerTersimpan().catch(() => TS); ts = TS.find((t) => kunci(t.nama) === kunci(g.nama));
        if (!ts && ids.length > 1) { hasil.push(`${g.nama}: TTD tidak tersimpan, DDR lain dilewati`); continue; } }
      for (const id of ids.slice(mulai)) { const { error } = await kirimTtdCoret(id, { tersimpan: true, name: ts.nama, path: ts.signature_path, signed_at: new Date().toISOString() });
        hasil.push(`${g.nama} · ${L.find((d) => d.id === id)?.report_date ?? ""}: ${error ? "GAGAL " + error.message : "✓"}`); }
    }
    m.remove(); alert(`TTD driller:\n${hasil.join("\n")}\n\nDDR yang sudah ada TTD wellsite otomatis menjadi LENGKAP.`); selesai?.();
  };
}
// Kirim TTD CORET: unggah gambar ke bucket signatures (folder akun wellsite), lalu server mencatatnya di slot DRILLER
async function kirimTtdCoret(ddrId, s) {
  if (s.tersimpan) return sb.rpc("sign_ddr_coret2", { p_ddr: ddrId, p_nama: s.name, p_path: s.path, p_signed_at: s.signed_at, p_simpan: false, p_tersimpan: true });
  const b64 = s.png.split(",")[1], bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const path = `${session.user.id}/driller-${ddrId}-${Date.now()}.png`;
  const up = await sb.storage.from("signatures").upload(path, new Blob([u8], { type: "image/png" }), { contentType: "image/png" });
  if (up.error) return { error: up.error };
  const r = await sb.rpc("sign_ddr_coret2", { p_ddr: ddrId, p_nama: s.name, p_path: path, p_signed_at: s.signed_at, p_simpan: !!s.simpan, p_tersimpan: false });
  if (!r.error && s.simpan) localStorage.removeItem("ttdDrillerTersimpan");
  return r;
}
// Daftar TTD driller tersimpan (disimpan di HP untuk dipakai offline)
async function ttdDrillerTersimpan() {
  if (online()) { const { data } = await sb.from("ttd_driller_tersimpan").select("id,nama,signature_path").eq("aktif", true).order("nama"); if (data) { localStorage.setItem("ttdDrillerTersimpan", JSON.stringify(data)); return data; } }
  return JSON.parse(localStorage.getItem("ttdDrillerTersimpan") || "[]");
}
async function signDialog0(slot, namaDriller = "") {
  const signers = await cached("signers", async () => (await sb.from("signature_profile").select("user_id,full_name,title")).data);
  const TS = bisaTtdLayar(slot) ? await ttdDrillerTersimpan().catch(() => []) : [];
  const kunciNama = (x) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim(), cocok = TS.find((t) => kunciNama(t.nama) === kunciNama(namaDriller));
  return new Promise((resolve) => {
    const m = modal(`<h3>Tanda tangan ${SLOT_LABEL[slot]}${slot === "CLIENT" ? " (boleh menyusul)" : ""}</h3>
      ${bisaTtdLayar(slot) ? `<div style="background:#E6F4EC;border-radius:10px;padding:10px;margin-bottom:6px"><b>Driller tidak punya akun / tidak login?</b>
        ${TS.length ? `<label style="margin-top:6px">TTD driller tersimpan</label><div class="row"><select id="tsP">${TS.map((t, i) => `<option value="${i}" ${t === cocok ? "selected" : ""}>${esc(t.nama)}</option>`).join("")}</select><button id="tsOk" style="flex:0;white-space:nowrap">✔ Pakai TTD ini</button></div>
          <div id="tsImg" style="margin-top:4px"></div>${cocok ? `<small>Terpilih otomatis sesuai nama driller di DDR (${esc(cocok.nama)}).</small>` : ""}` : ""}
        <div class="row" style="margin-top:6px"><button class="${TS.length ? "sec" : ""}" id="crt">✍️ Driller tanda tangan di layar ini${TS.length ? " (baru)" : ""}</button></div></div><p class="muted" style="margin:4px 0">atau driller yang sudah punya akun & TTD terdaftar:</p>` : ""}
      <label>Nama</label><select id="sg"><option value="">— pilih —</option>${signers.map((s) => `<option value="${s.user_id}">${esc(s.full_name)}${s.title ? " · " + esc(s.title) : ""}</option>`).join("")}</select>
      <label>PIN 6 angka</label><input id="pin" type="password" inputmode="numeric" maxlength="6">
      <div class="row" style="margin-top:10px"><button id="okp">Tanda tangan dengan PIN</button></div>
      <p class="muted" style="margin:10px 0 4px">atau</p><div class="row"><button class="sec" id="qr">Scan kartu QR</button></div>
      <div id="cam"></div><div class="row" style="margin-top:10px"><button class="sec" id="skip">Nanti saja</button></div><div id="me" class="err"></div>
      ${signers.length || bisaTtdLayar(slot) ? "" : `<p class="err">Belum ada TTD terdaftar${online() ? "" : " di HP ini (buka menu DDR sekali saat online)"}.</p>`}`);
    let stream = null; const done = (r) => { stream?.getTracks().forEach((t) => t.stop()); m.remove(); resolve(r); };
    m.querySelector("#skip").onclick = () => done(null);
    m.querySelector("#crt")?.addEventListener("click", () => done("__CORET__"));
    const tsSel = m.querySelector("#tsP");
    if (tsSel) { const lihat = async () => { const t = TS[+tsSel.value]; if (!online()) return (m.querySelector("#tsImg").innerHTML = "");
        const u = (await signedUrls("signatures", [t.signature_path]))[t.signature_path]; m.querySelector("#tsImg").innerHTML = u ? `<img src="${esc(u)}" style="height:56px;background:#fff;border:1px solid #ccd;border-radius:6px">` : ""; };
      tsSel.onchange = lihat; lihat().catch(() => {});
      m.querySelector("#tsOk").onclick = () => { const t = TS[+tsSel.value]; if (!confirm(`Pakai TTD tersimpan milik ${t.nama} untuk DDR ini?\nPastikan driller ${t.nama} menyetujui isi DDR ini.`)) return;
        done({ slot, method: "CORET", tersimpan: true, name: t.nama, path: t.signature_path, signed_at: new Date().toISOString() }); }; }
    m.querySelector("#okp").onclick = async () => {
      const id = m.querySelector("#sg").value, pin = m.querySelector("#pin").value;
      if (!id) return (m.querySelector("#me").textContent = "Pilih nama penanda tangan.");
      if (!/^\d{6}$/.test(pin)) return (m.querySelector("#me").textContent = "PIN 6 angka.");
      done({ slot, signer_id: id, method: "PIN", proof: await pinToken(id, pin), signed_at: new Date().toISOString(), name: signers.find((s) => s.user_id === id)?.full_name });
    };
    m.querySelector("#qr").onclick = async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); }
      catch { return (m.querySelector("#me").textContent = "Kamera tidak bisa dibuka."); }
      m.querySelector("#cam").innerHTML = `<video id="vd" playsinline muted style="width:100%;border-radius:8px;margin-top:8px"></video>`;
      const vd = m.querySelector("#vd"); vd.srcObject = stream; await vd.play();
      const det = "BarcodeDetector" in window ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = det ? null : (await import("./vendor/jsqr.js")).default;
      const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
      const tick = async () => {
        if (!stream?.active) return;
        let txt = null;
        if (det) { const r = await det.detect(vd).catch(() => []); txt = r[0]?.rawValue ?? null; }
        else if (vd.videoWidth) { cv.width = vd.videoWidth; cv.height = vd.videoHeight; cx.drawImage(vd, 0, 0); txt = jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)?.data ?? null; }
        const mm = txt?.match(/^TGEPSIG\|([0-9a-f-]{36})\|([0-9a-f]{32,})$/);
        if (mm) return done({ slot, signer_id: mm[1], method: "QR", proof: mm[2], signed_at: new Date().toISOString(), name: signers.find((s) => s.user_id === mm[1])?.full_name ?? "(kartu QR)" });
        requestAnimationFrame(tick);
      };
      tick();
    };
  });
}

// ---------- Data tersimpan: semua data yang sudah masuk server (sesuai hak akses) + yang masih di antrean HP ----------
// Progres resmi = meter DDR (coring + open hole); meter run Progres bor hanya pembanding. Client: DDR tanpa BBM/oli & nama crew (fungsi server ddr_proyek_client).
const JENIS_SIMPAN = { ddr: "DDR", run: "Progres bor", core: "Foto core", scan: "Form Logging", arsip: "Arsip foto", p2h: "P2H", marking: "Marking", sampel: "Kirim sample" };
async function simpanView(v) {
  const klien = isClient(), staf = !klien, ver = ["verifier", "admin"].includes(me?.role);
  const F = { dari: new Date(Date.now() - 6 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), sampai: todayWIB(), bh: "", rig: "", jenis: "", ...JSON.parse(sessionStorage.getItem("simpanF") || "{}") };
  v.innerHTML = `<div class="card"><h2>Data tersimpan</h2>
    <p class="muted" style="margin-top:0">Semua data yang sudah tersimpan${klien ? " untuk proyek Anda" : ""}, termasuk yang <b>masih di antrean HP</b> (belum terkirim). Progres resmi = <b>meter DDR</b> (coring + open hole); meter run hanya pembanding. Ketuk tombol di baris untuk membuka foto atau DDR.</p>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end"><div style="flex:1 1 130px"><label>Dari</label><input type="date" id="sdF" value="${F.dari}"></div><div style="flex:1 1 130px"><label>Sampai</label><input type="date" id="sdT" value="${F.sampai}"></div>
      <div style="flex:1 1 130px"><label>Hole ID</label><input id="sdB" data-bhid data-nojenis value="${esc(F.bh)}" placeholder="semua" autocapitalize="characters"></div>
      <div style="flex:1 1 120px"><label>Rig</label><select id="sdR"><option value="">Semua rig</option>${daftarRig().map((r) => `<option ${r === F.rig ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
      <div style="flex:1 1 140px"><label>Jenis data</label><select id="sdJ"><option value="">Semua jenis</option>${Object.entries(JENIS_SIMPAN).filter(([k]) => staf || !["p2h", "marking"].includes(k)).map(([k, l]) => `<option value="${k}" ${k === F.jenis ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <button id="sdGo" style="flex:0 0 auto">Tampilkan</button></div></div>
    <div class="card"><div id="sdSum" class="muted"></div><ul class="list" id="sdL"><li class="muted">Memuat…</li></ul></div>`;
  const ambil = () => ({ dari: $("#sdF").value, sampai: $("#sdT").value, bh: bakuBH($("#sdB").value), rig: $("#sdR").value, jenis: $("#sdJ").value });
  $("#sdGo").onclick = () => { sessionStorage.setItem("simpanF", JSON.stringify(ambil())); simpanView(v); };
  const f = ambil(), wibA = `${f.dari}T00:00:00+07:00`, wibB = new Date(new Date(`${f.sampai}T00:00:00+07:00`).getTime() + 864e5).toISOString();
  const mau = (k) => !f.jenis || f.jenis === k;
  const Q = (q, colT = "captured_at", colBh = "bhid", colRig = "rig") => { q = q.gte(colT, colT === "report_date" ? f.dari : wibA).lt(colT, colT === "report_date" ? new Date(new Date(f.sampai).getTime() + 864e5).toISOString().slice(0, 10) : wibB);
    if (f.bh && colBh) q = q.eq(colBh, f.bh); if (f.rig && colRig) q = q.eq(colRig, f.rig); return q.limit(400); };
  const B = []; // baris: {t, jenis, judul, ket, status, kelas, aksi:[{l, fn, c?}]}
  const ulang = () => simpanView(v);
  const del = (t, id, lbl) => (staf ? [{ l: "🗑 Hapus", c: "danger", fn: () => hapusTersimpan(t, id, lbl, ulang) }] : []);
  const ana = (jenis, id) => (staf ? [{ l: "🔄 Analisis ulang", fn: () => analisisUlang(jenis, id, ulang) }] : []);
  // 1) antrean HP (belum terkirim)
  for (const x of await qAll()) { const r = x.row ?? {}, jen = x.kind === "ddr" ? "ddr" : x.kind === "event" ? "run" : x.kind === "core" ? "core" : !x.kind ? "scan" : x.kind === "arsip" ? "arsip" : x.kind === "p2h" ? "p2h" : x.kind === "marking" ? "marking" : null;
    if (!jen || !mau(jen)) continue; const bh = r.bhid ?? x.bhid ?? x.bhid_hint ?? "", rg = r.rig ?? "";
    if (f.bh && bakuBH(bh) !== f.bh) continue; if (f.rig && rg && rg !== f.rig) continue;
    B.push({ bh, t: r.captured_at ?? x.captured_at ?? new Date(x.antre_at ?? Date.now()).toISOString(), jenis: jen, judul: ringkasAntre(x), ket: x.error ? `galat: ${x.error}` : "menunggu sinyal", status: "BELUM TERKIRIM", kelas: x.error ? "REJECTED" : "ANTRE", aksi: [{ l: "Antrean", fn: () => antreanModal() }] }); }
  if (online()) {
    const jobs = [];
    // 2) DDR
    if (mau("ddr")) jobs.push((async () => {
      let rows = [];
      if (klien) { const { data, error } = await sb.rpc("ddr_proyek_client", { p_dari: f.dari, p_sampai: f.sampai }); if (error) return B.push({ t: `${f.sampai}T23:59`, jenis: "ddr", judul: "DDR belum bisa ditampilkan", ket: error.message, status: "-", kelas: "NEEDS_REVIEW", aksi: [] }); rows = (data ?? []).filter((d) => (!f.rig || d.rig === f.rig) && (!f.bh || d.bhid === f.bh || [...(d.coring ?? []), ...(d.open_hole ?? [])].some((x) => x.bhid === f.bh))); }
      else { const { data } = await Q(sb.from("ddr").select("id,report_date,shift,rig,bhid,status,coring,open_hole,consumables,crew_count,driller_name,created_at"), "report_date", null); rows = (data ?? []).filter((d) => !f.bh || d.bhid === f.bh || [...(d.coring ?? []), ...(d.open_hole ?? [])].some((x) => x.bhid === f.bh)); }
      for (const d of rows) { const bs = [...(d.coring ?? []), ...(d.open_hole ?? [])].filter((x) => +x.to > +x.from), m = bs.reduce((s, x) => s + (+x.to - +x.from), 0);
        const lb = [...new Set(bs.map((x) => x.bhid || d.bhid).filter(Boolean))], bbm = staf ? (d.consumables ?? []).filter((c) => c.kategori === "BBM").reduce((s, c) => s + (+c.qty || 0), 0) : null;
        B.push({ bh: d.bhid, t: `${d.report_date}T${d.shift === "MALAM" ? "18" : "06"}:00:00+07:00`, jenis: "ddr", judul: `${d.report_date} · ${d.shift === "MALAM" ? "Night" : "Day"} · ${d.rig} · ${lb.join(", ") || d.bhid || "-"}`,
          ket: `Meter DDR ${fmtD(m)} m (coring ${fmtD((d.coring ?? []).filter((x) => +x.to > +x.from).reduce((s, x) => s + (+x.to - +x.from), 0))} m)${staf ? ` · crew ${d.crew_count ?? "-"} · BBM ${bbm} L` : ""}`,
          status: d.status === "SIGNED" ? "LENGKAP TTD" : "DRAF", kelas: d.status === "SIGNED" ? "APPROVED" : "NEEDS_REVIEW", aksi: [{ l: "Lihat DDR", fn: () => (staf ? printDDR(d.id) : ddrClientModal(d)) }, ...(!klien && isStaff() ? [d.status !== "SIGNED" ? { l: "✏️ Edit DDR (Hole ID, meter, jam, BBM, crew…)", fn: () => editDDR(d.id) } : { l: "✏️ Edit DDR (buka TTD dulu)", fn: () => menuEditData({ tanggal: d.report_date, rig: d.rig, konteks: "Data tersimpan" }) }] : []), ...del("ddr", d.id, `DDR ${d.rig} ${d.report_date} ${d.shift === "MALAM" ? "Night" : "Day"}${d.status === "SIGNED" ? " (sudah ditandatangani)" : ""}`)] }); }
    })());
    // 3) Progres bor (run & kejadian)
    if (mau("run")) jobs.push(Q(sb.from("drill_event").select("*").order("captured_at", { ascending: false })).then(({ data }) => { for (const e of data ?? []) B.push({ bh: e.bhid, foto: e.photo_path ? ["progress-photos", e.photo_path] : null, t: e.captured_at, jenis: "run", judul: `${EV[e.event_type] ?? e.event_type} · ${e.rig ?? ""} ${e.bhid ?? ""}${e.jenis_bor === "REDRILL" ? " (redrill)" : ""}`,
      ket: [e.depth_to != null ? `${e.depth_from ?? "?"}–${e.depth_to} m${e.core_length != null ? ` · core ${e.core_length} m` : ""}` : null, e.status_akhir, e.lat ? "GPS ✓" : "tanpa GPS", e.reason].filter(Boolean).join(" · "), status: "TERKIRIM", kelas: "APPROVED", aksi: [...(e.photo_path ? [{ l: "Foto", fn: () => bukaFile("progress-photos", e.photo_path) }] : []), ...(staf && (isStaff() || e.created_by === session?.user?.id) ? [{ l: "✏️ Ubah / ganti foto", fn: () => editFotoAktivitas(e.id, ulang) }] : []), ...(ver ? [{ l: "✏️ Edit (Hole ID, kedalaman, panjang core, waktu, jenis)", fn: () => editBaris("drill_event", e.id, ulang) }] : []), ...del("drill_event", e.id, `${EV[e.event_type] ?? e.event_type} ${e.rig ?? ""} ${e.bhid ?? ""}`)] }); }));
    // 4) Foto core
    if (mau("core")) jobs.push(Q(sb.from("core_photo").select("id,bhid,box_no,depth_from,depth_to,photo_type,status,sop_ok,reviewer_override,ditolak,alasan_tolak,error,photo_path,preview_path,captured_at"), "captured_at", "bhid", null).then(({ data }) => { for (const c of data ?? []) B.push({ bh: c.bhid, raw: c, foto: (c.preview_path || c.photo_path) ? ["core-photos", c.preview_path || c.photo_path] : null, t: c.captured_at, jenis: "core", judul: `${c.bhid} · kotak ${c.box_no ?? "?"} · ${c.depth_from}–${c.depth_to} m${c.photo_type ? ` · ${c.photo_type}` : ""}`,
      ket: coreDitolak(c) ? `ditolak: ${c.alasan_tolak ?? "-"}` : c.error ?? "", status: coreDitolak(c) ? "DITOLAK" : c.status === "CHECKED" ? ((c.reviewer_override ?? c.sop_ok) ? "SESUAI SOP" : "TIDAK SESUAI") : c.status, kelas: coreDitolak(c) || c.status === "ERROR" ? "REJECTED" : c.status === "APPROVED" || (c.status === "CHECKED" && (c.reviewer_override ?? c.sop_ok)) ? "APPROVED" : "NEEDS_REVIEW", aksi: [{ l: "Foto", fn: () => bukaFile("core-photos", c.preview_path || c.photo_path) }, ...(isStaff() ? [{ l: "✏️ Edit (Hole ID, no. kotak/corebox, kedalaman, jenis, foto)", fn: () => editFotoCore(c.id, ulang) }] : []), ...ana("core", c.id), ...del("core_photo", c.id, `foto core ${c.bhid} kotak ${c.box_no ?? "?"}`)] }); }));
    // 5) Form Logging
    if (mau("scan")) jobs.push(Q(sb.from("scan_job").select("id,form_type,bhid_hint,page_no,status,error,photo_path,captured_at,sumber"), "captured_at", "bhid_hint", null).then(({ data }) => { for (const j of data ?? []) B.push({ bh: j.bhid_hint, raw: j, foto: j.photo_path ? ["scan-photos", j.photo_path] : null, t: j.captured_at, jenis: "scan", judul: `${FORMS?.[j.form_type] ?? "Form Logging"} · ${j.bhid_hint ?? ""} · hal. ${j.page_no ?? "?"}`,
      ket: j.error ?? (j.sumber ? `sumber ${j.sumber}` : ""), status: j.status, kelas: j.status === "ERROR" || j.status === "REJECTED" ? "REJECTED" : j.status === "APPROVED" ? "APPROVED" : "NEEDS_REVIEW", aksi: [...(j.photo_path ? [{ l: "Foto", fn: () => bukaFile("scan-photos", j.photo_path) }] : []), ...(staf ? [{ l: "✏️ Edit (Hole ID, halaman, jenis formulir)", fn: () => editKirimanModal("scan_job", j, ulang) }] : []), ...(ver && j.status !== "PROCESSING" ? [{ l: "✏️ Edit isian tabel logging", fn: () => { scrollTo(0, 0); reviewDetail($("#v"), j.id, j.status === "APPROVED" ? "ubah" : "foto"); } }] : []), ...(j.status !== "APPROVED" && j.sumber !== "EXCEL" ? ana("scan", j.id) : []), ...del("scan_job", j.id, `Form Logging ${j.bhid_hint ?? ""} hal. ${j.page_no ?? "?"}`)] }); }));
    // 6) Arsip foto
    if (mau("arsip")) jobs.push(Q(sb.from("form_photo").select("id,jenis,rig,bhid,tanggal,shift,halaman,jumlah_halaman,keterangan,photo_path,captured_at")).then(({ data }) => { for (const a of data ?? []) B.push({ bh: a.bhid, foto: a.photo_path ? ["scan-photos", a.photo_path] : null, t: a.captured_at, jenis: "arsip", judul: `${ARSIP?.[a.jenis] ?? a.jenis} · ${a.rig ?? ""} ${a.bhid ?? ""}${a.halaman ? ` · hal. ${a.halaman}${a.jumlah_halaman ? "/" + a.jumlah_halaman : ""}` : ""}`,
      ket: [a.tanggal, a.keterangan].filter(Boolean).join(" · "), status: "TERKIRIM", kelas: "APPROVED", aksi: [...(a.photo_path ? [{ l: "Foto", fn: () => bukaFile("scan-photos", a.photo_path) }] : []), ...(staf && a.photo_path && ["DRILL_LOG_LAMA", "LAINNYA"].includes(a.jenis) ? [{ l: "🔄 Scan sebagai Form Logging", fn: () => scanDariArsip(a, ulang) }] : []), ...(staf ? [{ l: "✏️ Edit (Hole ID, rig, tanggal, shift, halaman, jenis)", fn: () => editKirimanModal("form_photo", a, ulang) }] : []), ...del("form_photo", a.id, `${ARSIP?.[a.jenis] ?? a.jenis} ${a.bhid || a.rig || ""}`)] }); }));
    // 7) P2H & marking (staf)
    if (staf && mau("p2h")) jobs.push(Q(sb.from("p2h_check").select("id,rig,shift,unit,hour_meter,n_not_ok,layak_operasi,photo_path,captured_at"), "captured_at", null).then(({ data }) => { for (const p of data ?? []) B.push({ foto: p.photo_path ? ["progress-photos", p.photo_path] : null, t: p.captured_at, jenis: "p2h", judul: `P2H ${p.rig ?? ""} · ${p.shift ?? ""}${p.unit ? ` · ${p.unit}` : ""}`,
      ket: `${p.n_not_ok ?? 0} item tidak OK${p.hour_meter ? ` · HM ${p.hour_meter}` : ""}`, status: p.layak_operasi ? "LAYAK" : "TIDAK LAYAK", kelas: p.layak_operasi ? "APPROVED" : "REJECTED", aksi: [...(p.photo_path ? [{ l: "Foto", fn: () => bukaFile("progress-photos", p.photo_path) }] : []), ...(ver ? [{ l: "✏️ Edit (rig, shift, HM, layak)", fn: () => editBaris("p2h_check", p.id, ulang) }] : []), ...del("p2h_check", p.id, `P2H ${p.rig ?? ""} ${p.shift ?? ""}`)] }); }));
    if (staf && mau("marking")) jobs.push(Q(sb.from("marking").select("id,bhid,lat,lon,akurasi_m,x_utm,y_utm,catatan,rig,captured_at")).then(({ data }) => { for (const k of data ?? []) B.push({ bh: k.bhid, t: k.captured_at, jenis: "marking", judul: `Marking ${k.bhid ?? ""} · ${k.rig ?? ""}`,
      ket: `${(+k.lat).toFixed(6)}, ${(+k.lon).toFixed(6)} ±${k.akurasi_m ?? "?"} m${k.catatan ? ` · ${k.catatan}` : ""}`, status: "TERKIRIM", kelas: "APPROVED", aksi: [...(ver ? [{ l: "✏️ Edit (Hole ID, koordinat, catatan)", fn: () => editBaris("marking", k.id, ulang) }] : []), ...del("marking", k.id, `marking ${k.bhid ?? ""}`)] }); }));
    if (staf && mau("sampel")) jobs.push((async () => { let q = sb.from("kirim_preparasi").select("id,no_kirim,tanggal,tujuan,status,pengirim,penerima,created_at,kirim_preparasi_item(count)").gte("tanggal", f.dari).lte("tanggal", f.sampai).limit(400);
      const { data, error } = await q; if (error) throw error;
      for (const k of data ?? []) B.push({ t: k.created_at, jenis: "sampel", judul: `${k.no_kirim} · ${k.kirim_preparasi_item?.[0]?.count ?? 0} sample → ${k.tujuan}`, ket: [k.tanggal, k.pengirim, k.penerima && "→ " + k.penerima].filter(Boolean).join(" · "),
        status: k.status, kelas: k.status === "DITERIMA" ? "APPROVED" : "NEEDS_REVIEW", aksi: [{ l: "Buka", fn: () => { tab = "sampel"; localStorage.setItem("tab", "sampel"); render(); } }, ...(isStaff() ? [{ l: "✏️ Edit (no. kirim, tanggal, penerima, berat, kantong…)", fn: () => editKirim(k.id, ulang) }, { l: "📄 PDF", fn: () => cetakKirim(k.id) }] : []), ...del("kirim_preparasi", k.id, `kiriman ${k.no_kirim}`)] }); })());
    await Promise.all(jobs.map((p) => p.catch((e) => B.push({ t: "", jenis: "-", judul: "Sebagian data gagal dimuat", ket: e.message, status: "-", kelas: "REJECTED", aksi: [] }))));
  } else B.push({ t: "", jenis: "-", judul: "Offline", ket: "Data di server tampil saat ada sinyal. Yang di bawah ini hanya antrean di HP.", status: "-", kelas: "ANTRE", aksi: [] });
  B.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  const hit = {}; for (const b of B) hit[b.jenis] = (hit[b.jenis] ?? 0) + 1;
  const mDDR = B.filter((b) => b.jenis === "ddr" && b.status !== "BELUM TERKIRIM").reduce((s, b) => s + (Number(/Meter DDR ([\d,]+)/.exec(b.ket)?.[1]?.replace(",", ".")) || 0), 0);
  $("#sdSum").innerHTML = `${B.length} baris · ${Object.entries(hit).filter(([k]) => JENIS_SIMPAN[k]).map(([k, n]) => `${JENIS_SIMPAN[k]} ${n}`).join(" · ")}${hit.ddr ? ` · <b>meter DDR ${fmtD(mDDR)} m</b>` : ""}`;
  // v.28/.29: tombol aksi disembunyikan (klik kanan / tekan lama = menu; klik = buka detail + ✅ Konfirmasi). Data dikelompokkan dalam folder per Hole ID
  // (nama folder = Hole ID yang terdaftar di DDR; Hole ID yang belum ada di DDR dikumpulkan di folder "Belum terdaftar di DDR — cek Hole ID").
  const ddrBH = new Set(daftarBHLokal().filter(([, src]) => src.includes("DDR")).map(([b]) => kunciBH(b)));
  for (const b of B.filter((x) => x.jenis === "ddr" && x.bh)) ddrBH.add(kunciBH(b.bh));
  const masalah = (b) => ["REJECTED", "NEEDS_REVIEW"].includes(b.kelas) && b.jenis !== "ddr";
  const folderOf = (b) => { const bh = b.bh ? bakuBH(b.bh) : ""; if (!bh) return "~Tanpa Hole ID (P2H, kiriman sample, dll.)"; return ddrBH.has(kunciBH(bh)) ? bh : "~Belum terdaftar di DDR — cek Hole ID"; };
  const G = {}; B.forEach((b, i) => (G[folderOf(b)] ??= []).push(i));
  const bukaF = JSON.parse(sessionStorage.getItem("sdFolder") || "[]");
  const baris = (i) => { const b = B[i]; return `<li data-si="${i}" style="flex-wrap:wrap;cursor:pointer" title="Klik = buka · klik kanan (HP: tekan lama) = Foto / Edit / Hapus"><span class="pill ${b.kelas}">${esc(b.status ?? "")}</span><span style="flex:1;min-width:200px"><b>${esc(JENIS_SIMPAN[b.jenis] ?? "")}</b> · ${esc(b.judul)}<br><span class="muted">${b.t ? esc(fmtT(new Date(b.t))) : ""}${b.ket ? " · " + esc(b.ket) : ""}</span></span>${masalah(b) ? `<span title="perlu dicek" style="color:#B3261E;font-weight:700">●</span>` : ""}</li>`; };
  // v.31: sub folder per jenis data di dalam folder Hole ID
  // v.32: setiap folder Hole ID selalu berisi 4 sub folder yang sama (Logging · Foto core · DDR · Foto aktivitas), yang kosong tetap tampil
  const SUB = [["logging", "📝 Logging", ["scan", "arsip"]], ["core", "🪨 Foto core", ["core"]], ["ddr", "📋 DDR", ["ddr"]], ["kegiatan", "📷 Foto aktivitas", ["run", "marking", "p2h"]], ["lain", "📦 Lainnya", null]];
  const subDari = (j) => (SUB.find(([, , js]) => js?.includes(j)) ?? SUB[SUB.length - 1])[0];
  const subFolder = (k, ix) => SUB.map(([id, nama]) => { const iy = ix.filter((i) => subDari(B[i].jenis) === id); if (!iy.length && (id === "lain" || k.startsWith("~"))) return ""; const kk = `${k}|${id}`, nM = iy.filter((i) => masalah(B[i])).length;
    return `<details data-fd="${esc(kk)}" ${bukaF.includes(kk) ? "open" : ""} style="border-left:3px solid #CFE3D8;margin:4px 0 4px 4px;padding-left:6px"><summary style="cursor:pointer;padding:5px 4px;font-weight:600;font-size:14px">${nama} <span class="muted" style="font-weight:400">· ${iy.length}</span>${nM ? ` <span style="color:#B3261E;font-weight:400">· ${nM} perlu dicek</span>` : ""}</summary><ul class="list" style="margin:0">${iy.map(baris).join("") || `<li class="muted" style="font-size:12.5px">Belum ada data pada periode ini.</li>`}</ul></details>`; }).join("");
  const keys = Object.keys(G).sort((x, y) => (x.startsWith("~") - y.startsWith("~")) || urutBH(x, y));
  $("#sdL").innerHTML = keys.map((k) => { const ix = G[k], nM = ix.filter((i) => masalah(B[i])).length, nama = k.replace(/^~/, "");
    return `<li style="display:block;padding:0;border:none"><details data-fd="${esc(k)}" ${bukaF.includes(k) || f.bh || keys.length === 1 ? "open" : ""} style="border:1px solid #DDE5E0;border-radius:10px;margin:6px 0;background:#FAFCFB">
      <summary style="cursor:pointer;padding:8px 10px;font-weight:600">📁 ${esc(nama)} <span class="muted" style="font-weight:400">· ${ix.length} data</span>${nM ? ` <span style="color:#B3261E">· ${nM} perlu dicek</span>` : ""}${k.startsWith("~") ? "" : `<div data-kr="${esc(k)}" style="color:#B3261E;font-size:11.5px;font-weight:400;margin-top:2px"></div>`}</summary>
      <div style="margin:0 8px 8px">${subFolder(k, ix)}</div></details></li>`; }).join("") || `<li class="muted">Tidak ada data untuk filter ini.</li>`;
  if (online() && !klien) catatanKurang(keys.filter((k) => !k.startsWith("~"))).then((K) => { for (const [bh, xs] of Object.entries(K)) { const el = $("#sdL")?.querySelector(`[data-kr="${CSS.escape(bh)}"]`); if (el && xs.length) el.textContent = "Kurang: " + xs.join(" · "); } }).catch(() => {});
  $("#sdL").querySelectorAll("details[data-fd]").forEach((d) => d.addEventListener("toggle", () => { const S = new Set(JSON.parse(sessionStorage.getItem("sdFolder") || "[]")); d.open ? S.add(d.dataset.fd) : S.delete(d.dataset.fd); sessionStorage.setItem("sdFolder", JSON.stringify([...S])); }));
  if (B.length) $("#sdSum").insertAdjacentHTML("beforeend", `<br><span style="font-size:12px">💡 Data dikelompokkan per Hole ID. Klik baris untuk membuka (ada tombol ✅ Konfirmasi untuk yang bertanda merah); klik kanan / tekan lama untuk Foto, Edit, Hapus.</span>`);
  $("#sdL").querySelectorAll("[data-si]").forEach((li) => { pasangMenuKlikKanan(li, () => B[+li.dataset.si].aksi); li.addEventListener("click", () => { if (Date.now() - (li._lp || 0) < 900) return; bukaDataTersimpan(B[+li.dataset.si], ulang); }); });
}
// 🗑 Hapus dari Data tersimpan: pengirim / verifier / admin (yang final hanya admin). Masuk Arsip terhapus, admin bisa memulihkan.
async function hapusTersimpan(tbl, id, label, ulang) {
  const alasan = prompt(`Hapus ${label}?\nData dipindah ke Arsip terhapus (admin bisa memulihkan). Setelah itu kirim ulang yang benar bila perlu.\n\nAlasan (wajib):`);
  if (!alasan?.trim()) return;
  const { error } = await sb.rpc("hapus_data_tersimpan", { p_table: tbl, p_id: id, p_alasan: alasan.trim() });
  if (error) return alert(/hapus_data_tersimpan/.test(error.message) ? "Fungsi database belum dipasang — jalankan hapus_data_tersimpan.sql di Supabase." : error.message);
  toast("Data dihapus (masuk Arsip terhapus)."); ulang?.();
}
// ---------- v.20: ✏️ Edit data (admin/verifier) untuk sheet yang belum punya layar edit — salah tulis, salah marking, salah upload ----------
// Satu editor generik → RPC admin_ubah_data (alasan wajib, tiap isian yang berubah tercatat di data_edit_log).
// Tipe isian: t teks · n angka · d tanggal · w tanggal+jam WIB · b ya/tidak · o:<pilihan> daftar pilihan
const EDIT_SPEC = {
  drill_event: { pk: "id", judul: "Aktivitas bor / foto run", f: [["rig", "Rig", "t"], ["bhid", "Hole ID", "t"], ["event_type", "Jenis aktivitas", "ev"], ["depth_from", "Dari (m)", "n"], ["depth_to", "Sampai (m)", "n"], ["core_length", "Panjang core (m)", "n"],
    ["captured_at", "Waktu (WIB)", "w"], ["reason", "Alasan / kejadian", "t"], ["note", "Catatan", "t"], ["jenis_bor", "Jenis bor", "o:UTAMA,REDRILL"], ["lubang_asal", "Lubang asal (bila redrill)", "t"], ["status_akhir", "Status akhir", "t"], ["dip", "Dip", "n"], ["azimuth", "Azimuth", "n"], ["lat", "Lintang foto (lat)", "n"], ["lon", "Bujur foto (lon)", "n"]] },
  p2h_check: { pk: "id", judul: "P2H rig", f: [["rig", "Rig", "t"], ["shift", "Shift", "o:PAGI,MALAM"], ["unit", "Unit", "t"], ["hour_meter", "Hour meter", "n"], ["n_not_ok", "Jumlah item tidak OK", "n"], ["layak_operasi", "Layak operasi", "b"], ["captured_at", "Waktu (WIB)", "w"]] },
  marking: { pk: "id", judul: "Marking titik", f: [["bhid", "Hole ID", "t"], ["rig", "Rig", "t"], ["x_utm", "X / Easting UTM 51S", "n"], ["y_utm", "Y / Northing UTM 51S", "n"], ["lat", "Lintang (lat)", "n"], ["lon", "Bujur (lon)", "n"], ["z_gps", "Elevasi GPS (m)", "n"],
    ["akurasi_m", "Akurasi (m)", "n"], ["instrument", "Alat", "t"], ["catatan", "Catatan", "t"], ["captured_at", "Waktu (WIB)", "w"]] },
  borehole: { pk: "bhid", judul: "Data lubang", f: [["rigmc_id", "Rig", "t"], ["start_date", "Mulai bor", "d"], ["stop_date", "Selesai bor", "d"], ["total_depth", "EOH / kedalaman akhir (m)", "n"], ["depth_tp", "Tebal top soil (m)", "n"], ["depth_l", "Tebal limonit (m)", "n"], ["depth_s", "Tebal saprolit (m)", "n"],
    ["total_sample", "Jumlah conto", "n"], ["core_size", "Ukuran core", "t"], ["core_barrel_type", "Tipe core barrel", "t"], ["dip", "Dip", "n"], ["azimuth", "Azimuth", "n"], ["water_table", "Muka air tanah (m)", "n"], ["prospect", "Prospek", "t"], ["area", "Area", "t"], ["grid", "Grid", "t"],
    ["logger", "Logger", "t"], ["teamleader", "Team leader", "t"], ["operator", "Operator", "t"], ["field_geos", "Geologist lapangan", "t"], ["verification_geos", "Geologist verifikasi", "t"], ["status", "Status", "t"], ["comment", "Komentar", "t"]] },
  kirim_preparasi: { pk: "id", judul: "Kiriman sample ke preparasi", f: [["no_kirim", "No. kirim", "t"], ["tanggal", "Tanggal", "d"], ["tujuan", "Tujuan", "t"], ["pengirim", "Pengirim", "t"], ["penerima", "Penerima", "t"], ["jumlah_karung", "Jumlah karung", "n"], ["no_segel", "No. segel", "t"], ["status", "Status", "o:DIKIRIM,DITERIMA,DRAF"], ["catatan", "Catatan", "t"]] },
  kirim_preparasi_item: { pk: "id", judul: "Isi kiriman (satu sample)", f: [["urut", "Urut", "n"], ["sample_no", "Sample no", "t"], ["no_kantong", "No. kantong", "t"], ["berat_kg", "Berat (kg)", "n"], ["catatan", "Catatan", "t"]] },
  rencana_lubang: { pk: "id", judul: "Titik rencana", f: [["bhid", "Hole ID", "t"], ["rig", "Rig", "t"], ["lat", "Lintang (lat)", "n"], ["lon", "Bujur (lon)", "n"], ["rencana_kedalaman", "Rencana kedalaman (m)", "n"], ["dip", "Dip", "n"], ["azimuth", "Azimuth", "n"], ["catatan", "Catatan", "t"]] },
};
const HAPUS_OK = new Set(["ddr", "scan_job", "form_photo", "p2h_check", "drill_event", "core_photo", "marking", "kirim_preparasi", "rencana_lubang"]);
const keWIB = (iso) => { if (!iso) return ""; const d = new Date(new Date(iso).getTime() + 7 * 3600e3); return d.toISOString().slice(0, 16); };
async function editBaris(tabel, id, selesai) {
  const S = EDIT_SPEC[tabel]; if (!S) return alert("Data ini belum bisa diedit.");
  if (!["verifier", "admin"].includes(me?.role)) return alert("Hanya verifier/admin yang boleh mengedit data ini.");
  if (!online()) return alert("Perlu sinyal untuk mengubah data yang sudah terkirim.");
  const [{ data: r, error }, { data: lg }] = await Promise.all([sb.from(tabel).select("*").eq(S.pk, id).maybeSingle(),
    sb.from("data_edit_log").select("kolom,nilai_lama,nilai_baru,alasan,nama,diubah_at").eq("tabel", tabel).eq("ref", String(id)).order("diubah_at", { ascending: false }).limit(50)]);
  if (error) return alert(error.message); if (!r) return alert("Data tidak ditemukan (mungkin sudah dihapus).");
  const nilai = (k, t) => (t === "w" ? keWIB(r[k]) : t === "b" ? (r[k] === true ? "1" : r[k] === false ? "0" : "") : r[k] ?? "");
  const inp = ([k, l, t]) => {
    const v = nilai(k, t), id2 = `eb_${k}`;
    if (t === "b") return `<label>${esc(l)}<select id="${id2}"><option value="">—</option><option value="1"${v === "1" ? " selected" : ""}>Ya</option><option value="0"${v === "0" ? " selected" : ""}>Tidak</option></select></label>`;
    if (t === "ev" || t.startsWith("o:")) { const ops = t === "ev" ? Object.keys(EV) : t.slice(2).split(","); if (v && !ops.includes(v)) ops.unshift(v);
      return `<label>${esc(l)}<select id="${id2}"><option value="">—</option>${ops.map((o) => `<option value="${esc(o)}"${o === v ? " selected" : ""}>${esc(t === "ev" ? EV[o] ?? o : o)}</option>`).join("")}</select></label>`; }
    return `<label>${esc(l)}<input id="${id2}" value="${esc(v)}" type="${t === "d" ? "date" : t === "w" ? "datetime-local" : "text"}"${t === "n" ? ' inputmode="decimal"' : ""}${k === "bhid" || k === "rig" || k === "lubang_asal" || k === "rigmc_id" ? ' autocapitalize="characters"' : ""}></label>`; };
  const judul = tabel === "borehole" ? `${S.judul} ${esc(id)}` : `${S.judul}${r.bhid ? " · " + esc(r.bhid) : ""}${r.rig ? " · " + esc(r.rig) : ""}`;
  const ekstra = tabel === "drill_event" ? `<button class="sec" id="ebFoto" style="flex:1">📷 Ubah / ganti foto</button><button class="sec" id="ebLub" style="flex:1">📍 Koordinat foto = koordinat lubang</button>` : tabel === "borehole" ? `<button class="sec" id="ebKo" style="flex:1">🧭 Koordinat lubang</button>` : "";
  const m = modal(`<h3 style="margin-top:0">✏️ Edit ${judul}</h3>
    <p class="muted" style="margin-top:0">Ubah isian yang salah lalu tulis alasannya. Hanya isian yang berubah yang disimpan dan semuanya tercatat (siapa, kapan, nilai lama → baru).${tabel === "marking" ? " Bila X/Y diubah, lat/lon dihitung ulang otomatis (dan sebaliknya)." : ""}</p>
    ${ekstra ? `<div class="row">${ekstra}</div>` : ""}
    <div class="row" style="flex-wrap:wrap">${S.f.map((x) => `<div style="flex:1 1 150px">${inp(x)}</div>`).join("")}</div>
    <label>Alasan perubahan *</label><input id="ebR" placeholder="mis. salah tulis kedalaman, salah Hole ID, salah marking">
    <div class="row" style="margin-top:10px"><button id="ebOk">Simpan perubahan</button>${HAPUS_OK.has(tabel) ? `<button class="danger" id="ebDel" style="flex:0">🗑 Hapus</button>` : ""}<button class="sec" id="ebX" style="flex:0">Batal</button></div><div id="ebE" class="err"></div>
    ${(lg ?? []).length ? `<h4 style="margin:10px 0 4px">Riwayat perubahan</h4><ul class="list">${lg.map((l) => `<li><span>${esc(fmtT(new Date(l.diubah_at)))} · <b>${esc(l.nama ?? "")}</b> · ${esc(l.kolom)}: ${esc(l.nilai_lama ?? "-")} → ${esc(l.nilai_baru ?? "-")}<br><span class="muted">${esc(l.alasan)}</span></span></li>`).join("")}</ul>` : ""}`);
  const q = (x) => m.querySelector(x), E = (t) => (q("#ebE").textContent = t);
  q("#ebX").onclick = () => m.remove();
  q("#ebFoto")?.addEventListener("click", () => { m.remove(); editFotoAktivitas(id, selesai); });
  q("#ebKo")?.addEventListener("click", () => { m.remove(); koordinatLubang(id, selesai); });
  q("#ebLub")?.addEventListener("click", async () => { const h = await posLubang(q("#eb_bhid").value); if (!h) return E("Koordinat lubang / titik rencana untuk Hole ID ini belum ada.");
    q("#eb_lat").value = h.lat.toFixed(7); q("#eb_lon").value = h.lon.toFixed(7); if (!q("#ebR").value) q("#ebR").value = `koordinat foto disamakan dengan ${h.sumber} (foto galeri / GPS salah)`; E(""); });
  q("#ebDel")?.addEventListener("click", () => { m.remove(); hapusTersimpan(tabel, id, `${S.judul}${r.bhid ? " " + r.bhid : ""}`, selesai); });
  q("#ebOk").onclick = async () => {
    const alasan = q("#ebR").value.trim(); if (!alasan) { q("#ebR").focus(); return E("Tulis alasan perubahan."); }
    const ubah = {};
    for (const [k, l, t] of S.f) {
      const raw = q(`#eb_${k}`).value.trim(); if (raw === String(nilai(k, t))) continue;
      let v = raw === "" ? null : raw;
      if (v !== null && t === "n") { v = Number(raw.replace(",", ".")); if (!Number.isFinite(v)) return E(`${l}: bukan angka`); }
      if (v !== null && t === "w") v = new Date(`${raw}:00+07:00`).toISOString();
      if (t === "b") v = raw === "" ? null : raw === "1";
      if (v !== null && ["bhid", "lubang_asal"].includes(k)) v = bakuBH(v);
      if (v !== null && ["rig", "rigmc_id"].includes(k)) v = v.toUpperCase().replace(/\s+/g, " ");
      ubah[k] = v;
    }
    if (tabel === "drill_event") { const a = ubah.depth_from ?? r.depth_from, b = ubah.depth_to ?? r.depth_to; if (a != null && b != null && +b < +a) return E("Sampai (m) harus ≥ Dari (m)."); }
    if (tabel === "marking") {
      if ("x_utm" in ubah || "y_utm" in ubah) { const x = ubah.x_utm ?? r.x_utm, y = ubah.y_utm ?? r.y_utm; if (x != null && y != null) { const [lo, la] = UTM.dari(+x, +y); ubah.lon = +lo.toFixed(7); ubah.lat = +la.toFixed(7); } }
      else if ("lat" in ubah || "lon" in ubah) { const la = ubah.lat ?? r.lat, lo = ubah.lon ?? r.lon; if (la != null && lo != null) { const u = UTM.ke(+lo, +la); ubah.x_utm = +u[0].toFixed(3); ubah.y_utm = +u[1].toFixed(3); } }
    }
    if (!Object.keys(ubah).length) return E("Belum ada isian yang diubah.");
    q("#ebOk").disabled = true; E("Menyimpan…");
    const { data: res, error: er } = await sb.rpc("admin_ubah_data", { p_tabel: tabel, p_id: String(id), p_data: ubah, p_alasan: alasan });
    q("#ebOk").disabled = false;
    if (er) return E(/admin_ubah_data/.test(er.message) ? "Fungsi database belum dipasang (v39)." : er.message);
    m.remove(); toast(res?.changed ? `✓ ${res.changed} isian diperbarui` : "Tidak ada perubahan"); selesai?.();
  };
}
// Isi kiriman preparasi per baris (dari sheet Database: kirim_id + urut)
async function editItemKirim(kirimId, urut, selesai) {
  const { data, error } = await sb.from("kirim_preparasi_item").select("id").eq("kirim_id", kirimId).eq("urut", urut).maybeSingle();
  if (error || !data) return alert(error?.message ?? "Baris kiriman tidak ditemukan.");
  editBaris("kirim_preparasi_item", data.id, selesai);
}
// Daftar aksi untuk satu baris sheet Database: [{l, fn, c}] — dipakai bilah ✏️ Edit di atas tabel, klik kanan / tekan lama, dan klik dua kali
function aksiBarisDb(ds, r, ulang) {
  const ver = ["verifier", "admin"].includes(me?.role), adm = me?.role === "admin", staf = isStaff(), A = [];
  const info = (t) => A.push({ l: `ℹ️ ${t}`, fn: () => alert(t), info: true });
  const lubang = (bh) => { if (!bh) return; if (ver) A.push({ l: `✏️ Edit data lubang ${bh}`, fn: () => editBaris("borehole", bh, ulang) }); if (staf) A.push({ l: `🧭 Koordinat ${bh}`, fn: () => koordinatLubang(bh, ulang) }); };
  const hariRig = (t, rig) => { if (t && staf) A.push({ l: `✏️ Edit DDR & foto run ${rig ?? ""} ${t}`, fn: () => menuEditData({ tanggal: String(t).slice(0, 10), rig: rig ?? null, konteks: DATASETS[ds]?.t }) }); };
  const hapus = (t, id, lbl) => { if (staf && id) A.push({ l: "🗑 Hapus", c: "danger", fn: () => hapusTersimpan(t, id, lbl, ulang) }); };
  const conto = (no) => { if (no && staf) A.push({ l: `✏️ Edit conto ${no}`, fn: () => editSample(no, ulang) }); };
  switch (ds) {
    case "collar": lubang(r.holeid); if (adm) A.push({ l: "🗑 Hapus lubang", c: "danger", fn: async () => { if (await adminDelete("borehole", r.holeid, "lubang")) ulang(); } }); break;
    case "survey": lubang(r.holeid); break;
    case "geology": case "density": conto(r.sample_no); lubang(r.holeid); if (adm && r.sample_no) A.push({ l: "🗑 Hapus conto", c: "danger", fn: async () => { if (await adminDelete("sample", r.sample_no, "conto")) ulang(); } }); break;
    case "foto": case "belumkirim": conto(r.sample_no); break;
    case "assay": case "qaqc": info("Hasil lab diperbarui lewat impor ulang file hasil lab, bukan diedit manual."); break;
    case "progres": case "kinerja": hariRig(r.tanggal, r.rig); if (r.bhid) lubang(r.bhid); break;
    case "jam": case "bbm": hariRig(r.tanggal ?? r.report_date, r.rig); break;
    case "ddr": if (staf) { if (r.status !== "SIGNED") A.push({ l: "✏️ Edit DDR", fn: () => editDDR(r.id) }); A.push({ l: r.status === "SIGNED" ? "✏️ Edit DDR (buka TTD dulu)" : "Lihat DDR & foto run hari itu", fn: () => menuEditData({ tanggal: r.report_date, rig: r.rig, konteks: "DDR" }) }); A.push({ l: "Lihat / cetak", fn: () => printDDR(r.id) }); } hapus("ddr", r.id, `DDR ${r.rig} ${r.report_date}`); break;
    case "rekapddr": case "ddrlubang": { const id = r.ddr_id, st = r.ddr_status, t = r.report_date ?? r.tanggal; if (staf) { if (st !== "SIGNED" && id) A.push({ l: "✏️ Edit DDR", fn: () => editDDR(id) }); A.push({ l: st === "SIGNED" ? "✏️ Edit DDR (buka TTD dulu)" : "Lihat DDR & foto run hari itu", fn: () => menuEditData({ tanggal: t, rig: r.rig, konteks: "Rekap DDR" }) }); if (id) A.push({ l: "Lihat / cetak", fn: () => printDDR(id) }); } hapus("ddr", id, `DDR ${r.rig} ${t}`); break; }
    case "aktivitas": if (staf && r.flags) A.push({ l: "✅ Konfirmasi (tanda merah benar)", fn: () => konfirmasiAktivitas(r.id, r, ulang) }); if (ver) A.push({ l: "✏️ Edit data aktivitas", fn: () => editBaris("drill_event", r.id, ulang) }); if (staf) A.push({ l: "📷 Ubah / ganti foto", fn: () => editFotoAktivitas(r.id, ulang) }); hapus("drill_event", r.id, `aktivitas ${r.rig ?? ""} ${r.bhid ?? ""}`); break;
    case "p2h": if (ver) A.push({ l: "✏️ Edit P2H", fn: () => editBaris("p2h_check", r.id, ulang) }); hapus("p2h_check", r.id, `P2H ${r.rig ?? ""}`); break;
    case "lubang": case "logging": case "profil": lubang(r.bhid); break;
    case "arsipfoto": if (staf) A.push({ l: "🛠 Perbaiki data kiriman", fn: () => editKirimanModal("form_photo", r, ulang) }); hapus("form_photo", r.id, "foto formulir"); break;
    case "scanfile": if (ver && r.status !== "APPROVED") A.push({ l: "✏️ Edit isian (Periksa scan)", fn: () => { scrollTo(0, 0); reviewDetail($("#v"), r.id); } }); if (staf) A.push({ l: "🛠 Perbaiki data kiriman", fn: () => editKirimanModal("scan_job", r, ulang) }); hapus("scan_job", r.id, "Form Logging"); break;
    case "corefile": if (staf) A.push({ l: "✏️ Ubah / ganti foto core", fn: () => editFotoCore(r.id, ulang) }); hapus("core_photo", r.id, `foto core ${r.bhid ?? ""}`); break;
    case "marking": if (ver && r.id) A.push({ l: "✏️ Edit marking", fn: () => editBaris("marking", r.id, ulang) }); hapus("marking", r.id, `marking ${r.bhid ?? ""}`); break;
    case "preparasi": if (staf && r.kirim_id) { A.push({ l: `✏️ Edit kiriman ${r.no_kirim ?? ""}`, fn: () => editKirim(r.kirim_id, ulang) }); A.push({ l: "📄 PDF form kirim", fn: () => cetakKirim(r.kirim_id) }); } conto(r.sample_no); hapus("kirim_preparasi", r.kirim_id, `kiriman ${r.no_kirim ?? ""}`); break;
    case "kepatuhan": info("Rekap operator dihitung otomatis dari P2H, DDR, foto core & Form Logging — edit data sumbernya (sheet P2H, DDR, Foto core, Scan)."); break;
    case "koreksi": info("Riwayat koreksi adalah catatan audit dan tidak bisa diedit."); break;
    case "arsip": if (adm && !r.restored_at) A.push({ l: "♻️ Pulihkan", fn: async () => { const { error } = await sb.rpc("admin_restore", { p_id: Number(r.id) }); if (error) alert(error.message); else ulang(); } }); break;
  }
  return A;
}
// v.36: konfirmasi foto aktivitas bertanda masalah (wellsite/verifier/admin); opsi menyamakan koordinat foto dengan koordinat lubang
async function konfirmasiAktivitas(id, x, selesai) {
  const jauh = /JAUH DARI TITIK|TANPA GPS/.test(x?.flags ?? "");
  const m = modal(`<h3 style="margin-top:0">✅ Konfirmasi foto aktivitas</h3><p style="margin:0 0 6px">${esc(EV[x?.event_type] ?? "")} · ${esc(x?.bhid ?? "")}</p><p class="err" style="margin:0 0 8px">${esc(x?.flags ?? "")}</p>
    <p class="muted" style="margin-top:0">Konfirmasi = foto ini sudah diperiksa dan benar. Tanda merah hilang dan tidak dihitung sebagai kejadian bermasalah. Tercatat siapa dan kapan.</p>
    ${jauh ? `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="kfL" checked style="width:auto"> Samakan koordinat foto dengan koordinat lubang ${esc(x?.bhid ?? "")} (mis. foto dari galeri)</label>` : ""}
    <label>Keterangan</label><input id="kfT" value="${/GALERI/.test(x?.flags ?? "") ? "foto galeri, lokasi benar di titik bor" : "sudah dicek, sesuai"}">
    <div class="row" style="margin-top:10px"><button id="kfOk">✅ Konfirmasi</button><button class="sec" id="kfX">Batal</button></div><div id="kfE" class="err"></div>`);
  const q = (s) => m.querySelector(s); q("#kfX").onclick = () => m.remove();
  q("#kfOk").onclick = async () => { q("#kfOk").disabled = true; const ket = q("#kfT").value.trim();
    if (q("#kfL")?.checked && x?.bhid && ["verifier", "admin"].includes(me?.role)) { const h = await posLubang(x.bhid);
      if (h) { const { error: e1 } = await sb.rpc("admin_ubah_data", { p_tabel: "drill_event", p_id: id, p_data: { lat: +h.lat.toFixed(7), lon: +h.lon.toFixed(7) }, p_alasan: `koordinat foto = ${h.sumber} (${ket || "konfirmasi"})` }); if (e1) { q("#kfOk").disabled = false; return (q("#kfE").textContent = e1.message); } } }
    const { error } = await sb.rpc("konfirmasi_aktivitas", { p_id: id, p_ket: ket || null, p_batal: false }); q("#kfOk").disabled = false;
    if (error) return (q("#kfE").textContent = /konfirmasi_aktivitas/.test(error.message) ? "Fungsi database belum dipasang (v44)." : error.message);
    m.remove(); toast("✓ Dikonfirmasi"); selesai?.(); };
}
// v.35: koordinat lubang (lat/lon) dari Hole ID: collar (koordinat lubang) → titik rencana (redrill: titik lubang asal)
async function posLubang(bh0) {
  const b = bakuBH(bh0 ?? ""); if (!b) return null;
  if (online()) { const { data: c } = await sb.from("v_dh_collar").select("east,north").eq("holeid", b).maybeSingle();
    if (c && +c.east >= 100000 && +c.east <= 900000 && +c.north > 0) { const [lo, la] = UTM.dari(+c.east, +c.north); return { lat: la, lon: lo, acc: null, sumber: `koordinat lubang ${b}` }; } }
  const R = rencanaLokal().find((z) => z.bhid === b) ?? (asalRedrill(b) ? rencanaLokal().find((z) => z.bhid === asalRedrill(b)) : null);
  return R && R.lat != null ? { lat: +R.lat, lon: +R.lon, acc: null, sumber: `titik rencana ${R.bhid}` } : null;
}
// v.34: daftar pembacaan marking satu lubang — edit / hapus pembacaan yang salah (mis. GPS di luar lokasi)
async function daftarMarking(bh) {
  const { data, error } = await sb.from("marking").select("id,bhid,rig,x_utm,y_utm,lat,lon,akurasi_m,catatan,captured_at").eq("bhid", bh).order("captured_at", { ascending: false });
  if (error) return alert(error.message);
  const salah = (k) => !(+k.x_utm >= 100000 && +k.x_utm <= 900000);
  const m = modal(`<h3 style="margin-top:0">📍 Marking ${esc(bh)}</h3><p class="muted" style="margin-top:0">Koordinat lubang dihitung dari pembacaan marking dengan akurasi terbaik. Hapus atau edit pembacaan yang salah, lalu perbaiki koordinat lubang bila perlu.</p>
    <ul class="list">${(data ?? []).map((k, i) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:200px">${esc(fmtT(new Date(k.captured_at)))} · ±${esc(k.akurasi_m ?? "?")} m<br><span class="muted">X ${esc(k.x_utm)} · Y ${esc(k.y_utm)}${k.catatan ? ` · ${esc(k.catatan)}` : ""}</span>${salah(k) ? `<br><b style="color:#B3261E;font-size:12px">Koordinat tidak wajar (di luar zona UTM 51S) — kemungkinan GPS dari lokasi lain</b>` : ""}</span>
      ${["verifier", "admin"].includes(me?.role) ? `<button class="sec" data-me="${i}" style="flex:0">✏️ Edit</button>` : ""}<button class="danger" data-mh="${i}" style="flex:0">🗑 Hapus</button></li>`).join("") || `<li class="muted">Belum ada marking.</li>`}</ul>
    <div class="row" style="margin-top:8px"><button class="sec" id="mkKo">🧭 Edit koordinat lubang</button><button class="sec" id="mkX">Tutup</button></div>`);
  m.querySelector("#mkX").onclick = () => m.remove();
  m.querySelector("#mkKo").onclick = () => { m.remove(); koordinatLubang(bh, () => render()); };
  m.querySelectorAll("[data-me]").forEach((b) => (b.onclick = () => { m.remove(); editBaris("marking", data[+b.dataset.me].id, () => daftarMarking(bh)); }));
  m.querySelectorAll("[data-mh]").forEach((b) => (b.onclick = () => { m.remove(); hapusTersimpan("marking", data[+b.dataset.mh].id, `marking ${bh}`, () => daftarMarking(bh)); }));
}
// v.30: catatan merah kecil per folder Hole ID — kelengkapan data lubang (seluruh data lubang, bukan hanya periode filter)
async function catatanKurang(holes) {
  const K = Object.fromEntries(holes.map((b) => [b, []])); if (!holes.length) return K;
  const [{ data: lg }, { data: mk }, { data: ev }, { data: dd }, { data: sp }, { data: cp }] = await Promise.all([
    sb.from("v_logging_lubang").select("bhid,status,belum_logging_m,jumlah_conto").in("bhid", holes),
    sb.from("v_titik_belum_marking").select("bhid,kategori").in("bhid", holes),
    sb.from("drill_event").select("bhid,event_type").in("bhid", holes).in("event_type", ["SELESAI_BOR", "FOTO_DRILL_PAD", "FOTO_PATOK", "FOTO_AKHIR"]),
    sb.from("v_ddr_baris").select("bhid,ddr_id,ddr_status").in("bhid", holes),
    sb.from("v_sample_photo").select("bhid,chk_foto_utuh,chk_foto_belah").in("bhid", holes),
    sb.from("core_photo").select("bhid").in("bhid", holes).limit(2000)]);
  for (const b of holes) {
    const X = K[b], L = (lg ?? []).find((x) => x.bhid === b), E = new Set((ev ?? []).filter((x) => x.bhid === b).map((x) => x.event_type));
    const D = [...new Map((dd ?? []).filter((x) => x.bhid === b).map((x) => [x.ddr_id, x.ddr_status])).values()], S = (sp ?? []).filter((x) => x.bhid === b);
    if (!L || !(L.jumlah_conto > 0)) X.push("Form Logging belum ada"); else if (L.status !== "LENGKAP") X.push(`logging belum lengkap${L.belum_logging_m > 0 ? ` (${L.belum_logging_m} m)` : ""}${L.status === "TERLAMBAT" ? " — TERLAMBAT" : ""}`);
    if (!(cp ?? []).some((x) => x.bhid === b)) X.push("foto core belum ada");
    else { const nu = S.filter((x) => x.chk_foto_utuh && x.chk_foto_utuh !== "OK").length, nb = S.filter((x) => x.chk_foto_belah && x.chk_foto_belah !== "OK").length;
      if (nu) X.push(`${nu} conto belum foto core utuh`); if (nb) X.push(`${nb} conto belum foto core belah`); }
    if ((mk ?? []).some((x) => x.bhid === b)) X.push("belum marking / koordinat");
    const nd = D.filter((x) => x !== "SIGNED").length; if (nd) X.push(`${nd} DDR belum ditandatangani`);
    if (!D.length) X.push("DDR belum ada");
    if (E.has("SELESAI_BOR")) { if (!E.has("FOTO_DRILL_PAD") && !E.has("FOTO_AKHIR")) X.push("foto drill pad belum ada"); if (!E.has("FOTO_PATOK") && !E.has("FOTO_AKHIR")) X.push("foto patok belum ada"); }
  }
  return K;
}
// v.29: buka satu data tersimpan: foto + keterangan + ✅ Konfirmasi (langsung diterima) + semua aksi
async function bukaDataTersimpan(b, ulang) {
  const ver = ["verifier", "admin"].includes(me?.role), c = b.raw;
  const coreMasalah = b.jenis === "core" && c && (coreDitolak(c) || c.status !== "CHECKED" || !(c.reviewer_override ?? c.sop_ok));
  const scanMasalah = b.jenis === "scan" && c && !["APPROVED", "PROCESSING"].includes(c.status);
  const url = b.foto && online() ? (await sb.storage.from(b.foto[0]).createSignedUrl(b.foto[1], 3600)).data?.signedUrl : null;
  const m = modal(`<h3 style="margin-top:0">${esc(JENIS_SIMPAN[b.jenis] ?? "")} · ${esc(b.judul)}</h3>
    <p style="margin:0 0 6px"><span class="pill ${b.kelas}">${esc(b.status ?? "")}</span> <span class="muted">${b.t ? esc(fmtT(new Date(b.t))) : ""}</span></p>
    ${b.ket ? `<p class="muted" style="margin:0 0 8px">${esc(b.ket)}</p>` : ""}
    ${url ? `<img src="${esc(url)}" style="width:100%;max-height:45vh;object-fit:contain;border-radius:8px;background:#eee">` : ""}
    ${coreMasalah && ver ? `<label>Catatan konfirmasi</label><input id="bkN" value="Dikonfirmasi sesuai SOP dari Data tersimpan">` : ""}
    <div class="row" style="flex-wrap:wrap;margin-top:10px">${coreMasalah && ver ? `<button id="bkOk" style="flex:1 1 200px">✅ Konfirmasi — terima</button>` : ""}${scanMasalah && ver ? `<button id="bkSc" style="flex:1 1 200px">✅ Periksa & terima Form Logging</button>` : ""}
      ${b.aksi.map((a, k) => `<button class="${a.c ?? "sec"}" data-k="${k}" style="flex:1 1 140px">${esc(a.l)}</button>`).join("")}<button class="sec" id="bkX" style="flex:1 1 100px">Tutup</button></div><div id="bkE" class="err"></div>`);
  const q = (x) => m.querySelector(x);
  q("#bkX").onclick = () => m.remove();
  m.querySelectorAll("[data-k]").forEach((x) => (x.onclick = () => { m.remove(); b.aksi[+x.dataset.k].fn(); }));
  q("#bkSc")?.addEventListener("click", () => { m.remove(); scrollTo(0, 0); reviewDetail($("#v"), c.id, "foto"); });
  q("#bkOk")?.addEventListener("click", async () => { const note = q("#bkN").value.trim() || "Dikonfirmasi dari Data tersimpan"; q("#bkOk").disabled = true;
    const { error } = await sb.rpc("terima_foto_core", { p_id: c.id, p_bhid: c.bhid, p_box: c.box_no, p_from: c.depth_from, p_to: c.depth_to, p_type: c.photo_type, p_terima: true, p_note: note });
    q("#bkOk").disabled = false; if (error) return (q("#bkE").textContent = error.message); m.remove(); toast("✓ Foto core diterima"); ulang?.(); });
}
// Menu aksi melayang (klik kanan / tekan lama): A = [{l, fn, c?, info?}]
function menuAksi(A, x, y) {
  document.getElementById("dbPop")?.remove(); if (!A?.length) return;
  const p = document.createElement("div"); p.id = "dbPop";
  p.style.cssText = `position:fixed;left:${Math.max(4, Math.min(x, innerWidth - 250))}px;top:${Math.max(4, Math.min(y, innerHeight - 44 * A.length - 16))}px;z-index:60;background:#fff;border:1px solid #ccd;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:6px;min-width:220px`;
  p.innerHTML = A.map((a, k) => `<button class="${a.c ?? "sec"}" data-k="${k}" style="display:block;width:100%;text-align:left;margin:3px 0">${esc(a.l)}</button>`).join("");
  document.body.appendChild(p); p.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { p.remove(); A[+b.dataset.k].fn(); }));
  setTimeout(() => document.addEventListener("click", function tutup(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener("click", tutup); } }), 0);
}
function pasangMenuKlikKanan(el, ambilAksi) {
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); menuAksi(ambilAksi(), e.clientX, e.clientY); });
  let tm = null; el.addEventListener("touchstart", (e) => { const t = e.touches[0]; tm = setTimeout(() => { el._lp = Date.now(); menuAksi(ambilAksi(), t.clientX, t.clientY); }, 550); }, { passive: true });
  ["touchend", "touchmove", "touchcancel"].forEach((n) => el.addEventListener(n, () => clearTimeout(tm), { passive: true }));
}
// Bilah ✏️ Edit di atas tabel + klik baris (pilih), klik dua kali (edit), klik kanan / tekan lama (menu)
function pasangEditTabel(wadah, ds, rows, ulang) {
  if (isClient()) return;
  const tbl = wadah.querySelector("table"); if (!tbl) return;
  const bar = document.createElement("div"); bar.className = "row"; bar.style.cssText = "align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;position:sticky;top:0;background:inherit;z-index:2";
  bar.innerHTML = `<button id="dbEd" style="flex:0 0 auto;width:auto" disabled>✏️ Edit</button><button class="danger" id="dbDel" style="flex:0 0 auto;width:auto" disabled>🗑 Hapus</button><button class="sec" id="dbMn" style="flex:0 0 auto;width:auto" disabled>⋯ Pilihan lain</button>
    <span id="dbSel" class="muted" style="flex:1;min-width:180px;font-size:12.5px">Klik baris untuk memilih, lalu ✏️ Edit · klik dua kali = edit · klik kanan / tekan lama = menu</span>`;
  wadah.prepend(bar);
  const trs = [...tbl.querySelectorAll("tr")].slice(1); let pilih = -1;
  const aksi = (i) => aksiBarisDb(ds, rows[i], ulang);
  const utama = (A) => A.find((a) => !a.info && a.c !== "danger");
  const set = (i) => { trs.forEach((t, k) => (t.style.outline = k === i ? "2px solid #1E9E69" : "")); trs.forEach((t, k) => (t.style.background = k === i ? "#E3F4EA" : "")); pilih = i;
    const A = aksi(i), u = utama(A), d = A.find((a) => a.c === "danger"), r = rows[i];
    bar.querySelector("#dbEd").disabled = !u; bar.querySelector("#dbEd").textContent = u ? u.l : "✏️ Edit"; bar.querySelector("#dbDel").disabled = !d; bar.querySelector("#dbMn").disabled = A.length < 2 && !A.some((a) => a.info);
    bar.querySelector("#dbSel").textContent = `Dipilih: ${[r.holeid ?? r.bhid ?? r.bhid_hint, r.sample_no, r.tanggal ?? r.report_date, r.rig].filter(Boolean).join(" · ") || "baris " + (i + 1)}${!A.length ? " — tidak ada aksi untuk akun ini" : A.every((a) => a.info) ? " — " + A[0].l.replace("ℹ️ ", "") : ""}`; };
  const menu = (i, x, y) => { set(i); const A = aksi(i); if (!A.length) return;
    document.getElementById("dbPop")?.remove();
    const p = document.createElement("div"); p.id = "dbPop"; p.style.cssText = `position:fixed;left:${Math.min(x, innerWidth - 260)}px;top:${Math.min(y, innerHeight - 40 * A.length - 20)}px;z-index:60;background:#fff;border:1px solid #ccd;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:6px;min-width:230px`;
    p.innerHTML = A.map((a, k) => `<button class="${a.c ?? "sec"}" data-k="${k}" style="display:block;width:100%;text-align:left;margin:3px 0">${esc(a.l)}</button>`).join("");
    document.body.appendChild(p); p.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { p.remove(); A[+b.dataset.k].fn(); }));
    setTimeout(() => document.addEventListener("click", function tutup(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener("click", tutup); } }), 0); };
  trs.forEach((t, i) => { t.style.cursor = "pointer";
    t.addEventListener("click", (e) => { if (e.target.closest("button,a")) return; set(i); });
    t.addEventListener("dblclick", (e) => { if (e.target.closest("button,a")) return; const u = utama(aksi(i)); if (u) u.fn(); });
    t.addEventListener("contextmenu", (e) => { e.preventDefault(); menu(i, e.clientX, e.clientY); });
    let tm = null; t.addEventListener("touchstart", (e) => { const p = e.touches[0]; tm = setTimeout(() => menu(i, p.clientX, p.clientY), 600); }, { passive: true });
    ["touchend", "touchmove", "touchcancel"].forEach((n) => t.addEventListener(n, () => clearTimeout(tm), { passive: true })); });
  bar.querySelector("#dbEd").onclick = () => { const u = pilih >= 0 && utama(aksi(pilih)); if (u) u.fn(); };
  bar.querySelector("#dbDel").onclick = () => { const d = pilih >= 0 && aksi(pilih).find((a) => a.c === "danger"); if (d) d.fn(); };
  bar.querySelector("#dbMn").onclick = (e) => { if (pilih >= 0) { const b = e.target.getBoundingClientRect(); menu(pilih, b.left, b.bottom + 4); } };
}
// 🔄 Analisis ulang oleh AI: foto core (cek SOP/label) atau Form Logging (baca ulang isian)
async function analisisUlang(jenis, id, ulang) {
  toast("Dikirim ke AI untuk dianalisis ulang… tunggu ±1 menit");
  const { data, error } = await sb.functions.invoke(jenis === "core" ? "check-core-photo" : "process-scan", { body: jenis === "core" ? { photo_id: id } : { job_id: id } });
  if (error) return alert("Analisis ulang gagal: " + (error.context?.status ? `HTTP ${error.context.status} · ` : "") + error.message);
  if (data?.error) return alert("Analisis ulang gagal: " + data.error);
  if (jenis === "scan") tandaiScan(id);
  toast("Terkirim ke AI — hasil muncul di daftar ini setelah dimuat ulang."); setTimeout(() => ulang?.(), 5000);
}
// Foto arsip (mis. salah pilih "Drill log lama") → dibuat jadi scan Form Logging tanpa memotret ulang, lalu dibaca AI
async function scanDariArsip(a, ulang) {
  const bh = bakuBH(prompt("Scan foto ini sebagai Form Logging.\nHole ID:", a.bhid ?? "") ?? ""); if (!bh) return;
  const hal = Number(prompt("Nomor halaman Form Logging:", a.halaman ?? 1)); if (!hal) return;
  const { data: job, error } = await sb.from("scan_job").insert({ client_uuid: crypto.randomUUID(), form_type: "SHEET", bhid_hint: bh, page_no: hal, hal_kirim: hal, photo_path: a.photo_path, captured_at: a.captured_at, sumber: "GALERI", file_name: `dari arsip ${a.jenis}` }).select("id").single();
  if (error) return alert("Gagal membuat scan: " + error.message);
  await analisisUlang("scan", job.id, ulang);
  if (confirm("Scan Form Logging dibuat. Hapus foto arsip lamanya supaya tidak dobel?")) await hapusTersimpan("form_photo", a.id, "foto arsip lama", ulang);
}
// DDR untuk client: tanpa BBM/oli dan nama crew
function ddrClientModal(d) {
  const bs = (a) => (a ?? []).filter((x) => +x.to > +x.from);
  const m = modal(`<h3 style="margin-top:0">DDR ${esc(d.rig)} · ${esc(d.report_date)} · ${d.shift === "MALAM" ? "Night" : "Day"}</h3><p class="muted">Status: ${d.status === "SIGNED" ? "lengkap ditandatangani" : "draf"} · Hole ID ${esc(d.bhid ?? "-")}${d.jenis_bor === "REDRILL" ? " · redrill" : ""}</p>
    <div class="tw"><table><tr><th>Jenis</th><th>Hole ID</th><th>From</th><th>To</th><th>Interval</th><th>Core</th><th>Rec %</th></tr>${[...bs(d.coring).map((x) => ["Coring", x]), ...bs(d.open_hole).map((x) => ["Open hole", x])].map(([j, x]) => `<tr><td>${j}</td><td>${esc(x.bhid || d.bhid || "")}</td><td>${fmtD(x.from)}</td><td>${fmtD(x.to)}</td><td>${fmtD(x.to - x.from)}</td><td>${x.core != null ? fmtD(x.core) : ""}</td><td>${x.core != null ? Math.round((100 * x.core) / (x.to - x.from)) : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Tidak ada meter bor.</td></tr>`}</table></div>
    <h4>Distribusi jam</h4><div class="tw"><table><tr><th>Mulai</th><th>Selesai</th><th>Kegiatan</th><th>Keterangan</th></tr>${(d.hours ?? []).map((h) => `<tr><td>${esc(h.mulai ?? "")}</td><td>${esc(h.selesai ?? "")}</td><td>${esc(h.kategori ?? "")}</td><td>${esc(h.ket ?? "")}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">-</td></tr>`}</table></div>
    <div style="margin-top:8px"><button id="dcT">Tutup</button></div>`);
  m.querySelector("#dcT").onclick = () => m.remove();
}

// ---------- Edit langsung dari Dashboard: klik/ketuk, klik kanan, atau tekan lama pada grafik atau baris tabel → data mentah (DDR + foto run) ----------
// Menu: Lihat DDR · Edit DDR (DRAF: pengirim/verifier/admin; DDR bertanda tangan dikunci, verifier/admin bisa Buka TTD dengan alasan) · Lihat foto run.
async function menuEditData(o) {
  if (isClient() || !online()) return;
  const ver = ["verifier", "admin"].includes(me?.role), adm = me?.role === "admin";
  let q = sb.from("ddr").select("id,report_date,shift,rig,bhid,status,coring,open_hole,created_by").eq("report_date", o.tanggal); if (o.rig) q = q.eq("rig", o.rig);
  const [{ data: dd }, { data: ev }] = await Promise.all([q.order("rig").order("shift"), (() => { let e = sb.from("v_drill_event_qc").select("id,bhid,depth_from,depth_to,photo_path,captured_at,rig,created_by").eq("event_type", "RUN").eq("tanggal", o.tanggal); if (o.rig) e = e.eq("rig", o.rig); return e.order("captured_at"); })()]);
  const meter = (d) => [...(d.coring ?? []), ...(d.open_hole ?? [])].filter((x) => +x.to > +x.from).reduce((s, x) => s + (+x.to - +x.from), 0);
  const m = modal(`<h3 style="margin-top:0">Data ${esc(o.rig ?? "semua rig")} · ${esc(o.tanggal)}</h3>
    ${o.konteks ? `<p class="muted" style="margin-top:0">Dari: ${esc(o.konteks)}</p>` : ""}
    <ul class="list">${(dd ?? []).map((d) => { const milik = d.created_by === session?.user?.id, bisa = d.status !== "SIGNED" && (milik || ver || me?.role === "geologist");
      return `<li style="flex-wrap:wrap"><span class="pill ${d.status === "SIGNED" ? "APPROVED" : "NEEDS_REVIEW"}">${d.status === "SIGNED" ? "TTD" : "DRAF"}</span><span style="flex:1;min-width:170px"><b>DDR ${esc(d.rig)} · ${d.shift === "MALAM" ? "Night" : "Day"}</b> · ${esc(d.bhid ?? "")}<br><span class="muted">meter DDR ${fmtD(meter(d))} m</span></span>
        <button class="sec" data-lh="${d.id}" style="flex:0">Lihat DDR</button>
        ${bisa ? `<button data-ed2="${d.id}" style="flex:0">✏️ Edit DDR</button>` : d.status === "SIGNED" ? `<button class="sec" disabled style="flex:0;opacity:.55" title="Sudah ditandatangani">Sudah ditandatangani — verifier/admin bisa buka TTD</button>${ver ? `<button class="danger" data-bt="${d.id}" style="flex:0">🔓 Buka TTD</button>` : ""}` : `<button class="sec" disabled style="flex:0;opacity:.55">Hanya pengirim/wellsite/verifier/admin</button>`}</li>`; }).join("") || `<li class="muted">Belum ada DDR untuk ${esc(o.rig ?? "rig ini")} pada tanggal ini.</li>`}</ul>
    <h4 style="margin:10px 0 4px">Foto run (pembanding)</h4><ul class="list">${(ev ?? []).map((e, i) => `<li><span style="flex:1">${esc(e.rig)} · ${esc(e.bhid ?? "")} · ${fmtD(e.depth_from)}–${fmtD(e.depth_to)} m <span class="muted">${fmtT(new Date(e.captured_at))}</span></span>${e.photo_path ? `<button class="sec" data-fr="${i}" style="flex:0">Foto</button>` : ""}${isStaff() || e.created_by === session?.user?.id ? `<button class="sec" data-fe="${i}" style="flex:0;white-space:nowrap">✏️ Ubah</button>` : ""}</li>`).join("") || `<li class="muted">Tidak ada foto run.</li>`}</ul>
    <div style="margin-top:8px"><button class="sec" id="meT">Tutup</button></div>`);
  m.querySelector("#meT").onclick = () => m.remove();
  m.querySelectorAll("[data-lh]").forEach((b) => (b.onclick = () => printDDR(b.dataset.lh)));
  m.querySelectorAll("[data-fr]").forEach((b) => (b.onclick = () => bukaFile("progress-photos", ev[+b.dataset.fr].photo_path)));
  m.querySelectorAll("[data-fe]").forEach((b) => (b.onclick = () => { m.remove(); editFotoAktivitas(ev[+b.dataset.fe].id, () => menuEditData(o)); }));
  m.querySelectorAll("[data-ed2]").forEach((b) => (b.onclick = () => { m.remove(); editDDR(b.dataset.ed2, o.sorot); }));
  m.querySelectorAll("[data-bt]").forEach((b) => (b.onclick = async () => {
    const alasan = prompt("Alasan membuka tanda tangan DDR ini (wajib, tercatat di log):"); if (!alasan || alasan.trim().length < 5) return alert("Alasan wajib diisi (minimal 5 huruf).");
    if (!confirm("Semua tanda tangan DDR ini akan dicabut dan DDR kembali menjadi DRAF. Setelah diperbaiki, DDR perlu ditandatangani ulang. Lanjutkan?")) return;
    const { error } = await sb.rpc("admin_buka_ttd", { p_ddr: b.dataset.bt, p_alasan: alasan.trim() }); if (error) return alert("Gagal: " + error.message);
    toast("Tanda tangan dibuka — DDR kembali DRAF."); m.remove(); menuEditData(o); }));
}
// Buka formulir DDR terisi dari server. Simpan = kirim ulang rig/tanggal/shift yang sama; server mengganti isi DDR DRAF dan menyimpan versi lama (v23).
function editDDR(id, sorot) { sessionStorage.setItem("ddrEdit", JSON.stringify({ id, sorot: sorot ?? null, dari: tab })); tab = "ddr"; localStorage.setItem("tab", "ddr"); render(); }
// Pasang klik kanan / tekan lama pada grafik Chart.js dan baris tabel di dalam wadah
function pasangMenuEdit(wadah, Chart) {
  if (!wadah || wadah.dataset.menuEdit || isClient()) return; wadah.dataset.menuEdit = "1";
  const TGL = /\b(20\d\d-\d\d-\d\d)\b/, RIG = /\bRIG\s*\d+\b/i;
  const dariTitik = (el, ev) => {
    if (el.tagName === "CANVAS" && Chart) { const ch = Chart.getChart?.(el) ?? Object.values(Chart.instances ?? {}).find((c) => c.canvas === el); if (!ch) return null;
      const pts = ch.getElementsAtEventForMode(ev, "nearest", { intersect: false }, true); if (!pts.length) return null;
      const p = pts[0], lbl = String(ch.data.labels?.[p.index] ?? ""), ds = String(ch.data.datasets?.[p.datasetIndex]?.label ?? "");
      const t = TGL.exec(lbl)?.[1] ?? TGL.exec(ds)?.[1]; if (!t) return null;
      return { tanggal: t, rig: (RIG.exec(ds) ?? RIG.exec(lbl))?.[0]?.toUpperCase().replace(/\s+/, " ") ?? null, konteks: `${ch.options?.plugins?.title?.text || el.closest("div")?.querySelector("h3,h4,b")?.textContent || "grafik"} · ${ds || lbl}`, sorot: "meter" }; }
    const tr = el.closest("tr"); if (!tr) return null; const tx = [...tr.children].map((c) => c.textContent.trim()).join(" | ");
    const t = TGL.exec(tx)?.[1]; if (!t) return null;
    return { tanggal: t, rig: RIG.exec(tx)?.[0]?.toUpperCase().replace(/\s+/, " ") ?? null, konteks: tx.slice(0, 80), sorot: "meter" }; };
  const buka = (el, ev) => { const o = dariTitik(el, ev); if (o) { ev.preventDefault?.(); menuEditData(o); return true; } return false; };
  wadah.addEventListener("contextmenu", (ev) => { buka(ev.target, ev); });
  // Klik / ketuk biasa juga langsung membuka data mentah (DDR + foto run) tanggal & rig tersebut
  let lp = 0;
  wadah.addEventListener("click", (ev) => { if (Date.now() - lp < 900 || ev.target.closest("button,a,input,select,textarea,label,summary")) return; buka(ev.target, ev); });
  let tm = null, awal = null;
  wadah.addEventListener("touchstart", (ev) => { const t = ev.touches[0]; awal = [t.clientX, t.clientY]; const el = ev.target;
    tm = setTimeout(() => { tm = null; lp = Date.now(); buka(el, { native: ev, x: t.clientX - el.getBoundingClientRect().left, y: t.clientY - el.getBoundingClientRect().top, type: "click", preventDefault() {} }); }, 600); }, { passive: true });
  const batal = (ev) => { if (!tm) return; if (ev.type === "touchmove") { const t = ev.touches[0]; if (Math.hypot(t.clientX - awal[0], t.clientY - awal[1]) < 10) return; } clearTimeout(tm); tm = null; };
  wadah.addEventListener("touchmove", batal, { passive: true }); wadah.addEventListener("touchend", batal);
}

// ---------- DDR (Daily Drilling Report) ----------
const HOUR_CAT = [["DRILLING SYSTEM", ["CORING DRILLING", "OPEN HOLE DRILLING"]],
  ["WORKING", ["RIG SET UP/DOWN/PREPARATION", "HOLE CONDITION/CEMENTING", "REAMING, CASING, INSTALLING", "RUNNING/PULL UP/STUCK ROD", "HANDLING HOLE"]],
  ["ACTIVE/STANDBY", ["TRAVELLING CREW", "P2H+P5M", "DRILL SITE PREPARATION", "WEATHER/UNSAVE CONDITION", "WAITING WATER", "WAITING ACCESS", "SERVICE/MAINTENANCE", "GEOSERVICES/LOGGING"]],
  ["ISTIRAHAT", ["ISTIRAHAT SIANG"]]]; // bukan standby/perbaikan, bukan jam bor efektif
const SLOT_LABEL = { DRILLER: "Driller", WELLSITE: "Well site", CLIENT: "Client representative" };
// "12,30" "12.30" "12:30" "1230" "12" "7.5" → "12:30" / "07:00"; teks tak terbaca dikembalikan apa adanya (server juga merapikan, v21a)
const bakuJam = (s) => { const t = String(s ?? "").trim().replace(/\s+/g, ""); if (!t) return "";
  let m = /^(\d{1,2})[:.,;](\d{1,2})$/.exec(t), h, mi;
  if (m) { h = +m[1]; mi = m[2].length === 1 ? +m[2] * 10 : +m[2]; }
  else if ((m = /^(\d{3,4})$/.exec(t))) { h = +t.slice(0, -2); mi = +t.slice(-2); }
  else if ((m = /^(\d{1,2})$/.exec(t))) { h = +t; mi = 0; }
  else return t;
  if (h === 24 && mi === 0) h = 0;
  return h < 24 && mi < 60 ? `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` : t; };
const hm2min = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(bakuJam(s)); return m ? +m[1] * 60 + +m[2] : null; };
const JAM15 = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const durMin = (a, b) => { const x = hm2min(a), y = hm2min(b); return x === null || y === null ? null : (y - x + 1440) % 1440; };
async function ddrView(v) {
  const tok = (ddrView.tok = (ddrView.tok ?? 0) + 1); // hanya render terbaru yang dilanjutkan
  const items = await cached("ddrItems2", async () => (await sb.from("consumable_item").select("item,unit,kategori").eq("active", true).order("sort")).data);
  cached("signers", async () => (await sb.from("signature_profile").select("user_id,full_name,title")).data);
  const q = (await qAll()).filter((x) => x.kind === "ddr");
  if (tok !== ddrView.tok) return;
  const shiftNow = shiftDari(new Date()), rig = localStorage.getItem("rig") || "", shift = shiftNow.shift, last = JSON.parse(localStorage.getItem("ddrLast") || "{}"); if (last.v !== 2) delete last.contractor;
  const cats = [...new Set(items.map((i) => i.kategori))];
  v.innerHTML = `<div class="card"><h2>DAILY DRILLING REPORT</h2>
    <p class="muted">Urutan sama dengan formulir DDR lapangan. Kolom * wajib. Kolom <b>Client</b> diisi nama perusahaan client. Pemakaian barang: isi yang dipakai saja — kolom jumlah yang <b>dikosongkan berarti tidak dipakai</b>. Jam boleh ditulis 12,30 / 12.30 / 1230. FROM baris berikutnya terisi otomatis dari TO sebelumnya.</p>
    <div class="row"><div><label>PROJECT</label>${myTugas?.project ? `<input id="pj" value="${esc(myTugas.nama ? `${myTugas.project}` : myTugas.project)}" readonly title="Terisi otomatis dari penugasan">` : `<input id="pj" value="${esc(last.project ?? "")}" placeholder="boleh kosong — diisi server dari penugasan">`}</div><div><label>LOCATION</label><input id="lc" value="${esc(last.location ?? "")}"></div></div>
    <div class="row"><div><label>HOLE ID *</label><input id="bh" data-bhid value="${esc(localStorage.getItem("bhid") || "")}" autocapitalize="characters"></div><div><label>RIG NO *</label>${rigField()}</div><div style="flex:.8"><label>Jenis pemboran</label>${pilihJenisBor("jbd", localStorage.getItem("bhid") || "")}</div><div><label>RIG TYPE</label><input id="rt" value="${esc(last.rig_type ?? "")}"></div></div>
    <div id="kpBox" style="background:#F2F7F4;border:1px solid #CFE3D8;border-radius:10px;padding:8px 10px;margin:6px 0"><b>Koordinat titik pelaksanaan</b> <span class="muted" style="font-size:12.5px">(UTM WGS84 51S) — isi bila titik diplot baru / bergeser dari rencana. Koordinat lubang di peta & database otomatis mengikuti koordinat ini.</span>
      <div id="kpInfo" class="muted" style="font-size:12.5px;margin:4px 0"></div>
      <div class="row"><div><label>X / Easting (m)</label><input id="kpX" inputmode="decimal" placeholder="6 digit"></div><div><label>Y / Northing (m)</label><input id="kpY" inputmode="decimal" placeholder="7 digit"></div><div style="flex:.6"><label>Z (m)</label><input id="kpZ" inputmode="decimal" placeholder="boleh kosong"></div></div>
      <div class="row" style="flex-wrap:wrap"><button class="sec" id="kpG" type="button" style="flex:1 1 140px">📍 Ambil GPS sekarang</button><button class="sec" id="kpR" type="button" style="flex:1 1 140px">Pakai titik rencana</button><button class="sec" id="kpC" type="button" style="flex:0 0 auto">Kosongkan</button></div></div>
    <div class="row" style="align-items:center;flex-wrap:wrap;margin:2px 0 6px"><button class="sec" id="t2Add" type="button" style="flex:0 0 auto;width:auto">➕ Pindah titik di shift ini (titik ke-2)</button><span class="muted" style="font-size:12px;flex:1;min-width:200px">atau buat <b>DDR terpisah</b> untuk titik baru: isi DDR baru dengan rig/tanggal/shift yang sama dan Hole ID titik baru (BBM, crew, jam diisi bagian titik itu saja).</span></div>
    <div id="t2Box" style="display:none;background:#F4F1FA;border:1px solid #D9D0EA;border-radius:10px;padding:8px 10px;margin:6px 0"><div class="row" style="align-items:center"><b style="flex:1">Titik ke-2 — pindah titik di shift ini</b><button class="sec" id="t2Del" type="button" style="flex:0">✕ Hapus titik ke-2</button></div>
      <p class="muted" style="font-size:12.5px;margin:2px 0 6px">Isi bila setelah finish/STB titik pertama, rig moving dan langsung running di titik baru dalam shift yang sama. Meter titik ke-2 diisi lewat tombol baris di bawah (Hole ID otomatis). Jam moving catat sebagai <b>Pindah titik</b>.</p>
      <div class="row"><div><label>HOLE ID titik ke-2 *</label><input id="bh2" data-bhid autocapitalize="characters"></div></div>
      <div id="kp2Info" class="muted" style="font-size:12.5px;margin:4px 0"></div>
      <div class="row"><div><label>X / Easting (m)</label><input id="kp2X" inputmode="decimal" placeholder="6 digit"></div><div><label>Y / Northing (m)</label><input id="kp2Y" inputmode="decimal" placeholder="7 digit"></div><div style="flex:.6"><label>Z (m)</label><input id="kp2Z" inputmode="decimal"></div></div>
      <div class="row" style="flex-wrap:wrap"><button class="sec" id="kp2G" type="button" style="flex:1 1 140px">📍 GPS sekarang</button><button class="sec" id="kp2R" type="button" style="flex:1 1 140px">Pakai titik rencana</button><button id="t2Oh" type="button" style="flex:1 1 160px">+ baris open hole titik ke-2</button><button id="t2Cr" type="button" style="flex:1 1 160px">+ baris coring titik ke-2</button></div></div>
    <div class="row"><div><label>DATE *</label><input id="dt" type="date" value="${shiftNow.tanggal}"></div><div><label>TIME *</label><select id="sh"><option value="PAGI" ${shift === "PAGI" ? "selected" : ""}>Day (06–18)</option><option value="MALAM" ${shift === "MALAM" ? "selected" : ""}>Night (18–06)</option></select></div><div><label>Client *</label><input id="ct" value="${esc(last.contractor ?? "")}"></div></div>
    <div class="row"><div><label>DRILLER *</label>${me?.role === "driller" ? `<input id="dn" value="${esc(me.full_name ?? "")}" readonly title="Nama akun Anda">` : `<input id="dn" value="${esc(last.driller_name ?? "")}">`}</div><div style="flex:.5"><label>CREW *</label><input id="cc" inputmode="numeric" readonly title="Dihitung otomatis: driller + assistant" value="${esc(last.crew_count ?? "")}"></div></div>
    <label>ASSISTANT / CREW lain * <span class="muted">(minimal ${crewMin()} orang termasuk driller)</span></label>
    <datalist id="dlCrew">${[...new Set(masterPersonil().filter((p) => p.aktif !== false).map((p) => p.nama))].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div id="crw"></div><button class="sec" id="crwAdd" style="width:auto;margin-top:4px">+ crew</button>
    <p class="muted" id="crewInfo" style="margin:4px 0 0"></p>

    <h3>1. DRILLING</h3>
    <p class="muted" id="fromInfo" style="margin:0 0 4px"></p><b>OPEN HOLE (m)</b><div id="oh"></div><button class="sec" id="ohAdd" style="width:auto">+ baris open hole</button>
    <p style="margin:10px 0 0"><b>CORING (m)</b> <span class="muted">Interval = To − From; Recovery = Core / Interval (dihitung otomatis)</span></p>
    <div id="cr"></div><div class="row"><button class="sec" id="crAdd" style="flex:0;white-space:nowrap">+ baris coring</button><button class="sec" id="crFoto" style="flex:0;white-space:nowrap">Isi dari foto RUN</button></div>

    <h3>2. HOURLY DISTRIBUTION</h3>
    <datalist id="dlJam">${JAM15.map((j) => `<option value="${j}">`).join("")}</datalist><div id="hr"></div><button class="sec" id="hrAdd" style="width:auto">+ baris jam</button><div id="hrSum" class="muted" style="margin-top:6px"></div>

    <h3>3. ACCESSORIES AND CONSUMABLES</h3>
    <div class="tw"><table><tr><th>Barang</th><th>QTY</th><th>UNIT</th><th>Catatan</th></tr>${cats.map((k) => `<tr><th colspan="4" style="text-align:left">${esc(k)}</th></tr>` + items.map((it, i) => (it.kategori !== k ? "" : `<tr><td style="padding:4px 6px">${esc(it.item)}</td><td><input data-q="${i}" inputmode="decimal" style="width:80px" placeholder="—"></td><td style="padding:4px 6px">${esc(it.unit)}</td><td><input data-n="${i}"></td></tr>`)).join("")).join("")}</table></div>
    <div class="row"><div><label>Jenis lubang</label><select id="ht"><option value="VERTICAL/HORIZONTAL">VERTICAL/HORIZONTAL</option><option value="INCLINE">INCLINE</option></select></div><div><label>ROD (m) <span class="muted" title="Panjang total stang bor (rod) yang terpasang di lubang saat akhir shift">ⓘ</span></label><input id="rd" inputmode="decimal" placeholder="panjang stang terpasang"></div></div>
    <div class="row"><div><label>TARGET (m)</label><input id="tg" inputmode="decimal" value="${esc(last.target_m ?? "")}"></div><div><label>TOTAL DEPTH (m)</label><input id="td" inputmode="decimal"></div></div>
    <div class="row"><div><label>HM awal</label><input id="h1" inputmode="decimal"></div><div><label>HM akhir</label><input id="h2" inputmode="decimal"></div><div><label>Cuaca</label><select id="wx"><option>Cerah</option><option>Berawan</option><option>Hujan</option><option>Hujan lebat</option></select></div></div>

    <h3>4. COMMENTS</h3><textarea id="nt" rows="2"></textarea>
    <h3>5. SIGNATURE</h3><p class="muted">Setelah disimpan: Driller → Well site → Client representative (boleh menyusul). DDR LENGKAP bila Driller dan Well site sudah sah.</p>
    <div style="margin-top:10px"><button id="sv">Simpan DDR & tanda tangan</button></div><div id="e" class="err"></div></div>
    <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean DDR di HP (${q.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
    <ul class="list">${q.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.row.rig)} · ${esc(x.row.report_date)} · ${esc(x.row.shift)} · TTD ${x.signs.length}${x.error ? `<br><span class="err">${esc(x.error)}</span>` : ""}</span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
    <div class="card"><h3>DDR terkirim</h3><div id="lst" class="muted">${online() ? "Memuat…" : "Offline."}</div></div>`;
  const num = (s) => (String(s ?? "").trim() === "" ? null : Number(String(s).replace(",", ".")));
  const EDIT = JSON.parse(sessionStorage.getItem("ddrEdit") || "null"); // mode edit dari Dashboard / Data tersimpan
  let consEkstra = [], kunciAsal = null; // edit: barang di luar daftar baku tetap ikut; rig/tanggal/shift asal
  const addRow = (box, html) => { const d = document.createElement("div"); d.className = "row"; d.style.alignItems = "center"; d.innerHTML = html + `<button class="sec" style="flex:0" title="hapus">✕</button>`; d.lastChild.onclick = () => { d.remove(); hrSum(); }; $(box).appendChild(d); return d; };
  // FROM otomatis = TO terdalam baris yang sudah ada (open hole + coring), atau kedalaman terakhir lubang di server; kecuali lubang sudah EOH. Boleh diubah.
  let dalamServer = { to: null, eoh: false };
  const toTerakhir = () => { const rs = [...v.querySelectorAll("#oh .row, #cr .row")], akhir = rs[rs.length - 1]?.querySelector("[data-rbh]")?.value.trim() ?? "";
    const xs = rs.filter((r) => (r.querySelector("[data-rbh]")?.value.trim() ?? "") === akhir).map((r) => num(r.querySelectorAll("input")[1].value)).filter((x) => Number.isFinite(x));
    return xs.length ? Math.max(...xs) : akhir ? 0 : dalamServer.eoh ? null : dalamServer.to; };
  const fdK = (x) => (x == null || !Number.isFinite(+x) ? "" : fmtD(x));
  const fromAuto = (o) => { if (o.bhid === undefined && !o.kosong) { const rs = [...v.querySelectorAll("#oh .row, #cr .row")]; o.bhid = rs[rs.length - 1]?.querySelector("[data-rbh]")?.value.trim() ?? ""; } return o.from ?? (o.kosong ? "" : fdK(toTerakhir())); };
  const sambung = (d) => { const [f, t] = d.querySelectorAll("input"); t.addEventListener("change", () => { const nx = d.nextElementSibling?.querySelector("input"); if (nx && !nx.value.trim()) nx.value = t.value.trim(); }); f.addEventListener("input", () => (f.dataset.manual = "1")); return d; };
  // kolom Hole ID per baris: kosong = Hole ID di atas; diisi bila satu shift mengebor dua lubang (mis. pindah titik setelah STB/EOH)
  const bhBaris = (o) => `<input data-rbh list="dlBH" placeholder="Hole ID (bila beda)" value="${esc(o.bhid ?? "")}" autocapitalize="characters" style="max-width:130px">`;
  const ohRow = (o = {}) => sambung(addRow("#oh", `<input placeholder="From" inputmode="decimal" value="${fromAuto(o)}"><input placeholder="To" inputmode="decimal" value="${o.to ?? ""}">${bhBaris(o)}`));
  const crRow = (o = {}) => sambung(addRow("#cr", `<input placeholder="From" inputmode="decimal" value="${fromAuto(o)}"><input placeholder="To" inputmode="decimal" value="${o.to ?? ""}"><input placeholder="Core (m)" inputmode="decimal" value="${o.core ?? ""}"><input placeholder="Remark" value="${esc(o.remark ?? "")}">${bhBaris(o)}`));
  const segarkanFrom = async () => { const b = bakuBH($("#bh").value); if (!b) return; dalamServer = await kedalamanTerakhir(b, "ddr");
    const f = v.querySelector("#oh .row input, #cr .row input"); const semua = [...v.querySelectorAll("#oh .row, #cr .row")];
    if (semua.length <= 2 && semua.every((r) => !r.querySelectorAll("input")[1].value.trim())) semua.forEach((r) => { const i = r.querySelector("input"); if (!i.dataset.manual) i.value = dalamServer.eoh ? "" : fdK(dalamServer.to ?? 0); });
    const info = $("#fromInfo"); if (info) info.textContent = dalamServer.eoh ? `${b} sudah EOH — FROM tidak dilanjutkan otomatis.` : dalamServer.to != null ? `Kedalaman terakhir ${b} di server: ${fmtD(dalamServer.to)} m (FROM baris pertama).` : `${b}: belum ada data — FROM mulai 0.`; void f; };
  // jam: ketik bebas (12,30 / 1230) atau pilih dari daftar per 15 menit; dirapikan ke HH:MM saat keluar kolom; jam mulai baris baru = jam selesai baris sebelumnya
  const jamTerakhir = () => { const r = [...$("#hr").querySelectorAll(".row")].pop(); return r ? bakuJam(r.querySelectorAll("input")[1].value) : ""; };
  const hrRow = (o = {}) => { const d = addRow("#hr", `<input placeholder="Mulai 06:00" list="dlJam" inputmode="decimal" value="${esc(o.mulai ?? jamTerakhir())}" style="max-width:96px"><input placeholder="Selesai" list="dlJam" inputmode="decimal" value="${esc(o.selesai ?? "")}" style="max-width:96px"><select>${HOUR_CAT.map(([g, xs]) => `<optgroup label="${g}">${xs.map((c) => `<option ${c === o.kategori ? "selected" : ""}>${c}</option>`).join("")}</optgroup>`).join("")}</select><input placeholder="Description">`); d.querySelectorAll("input,select").forEach((el) => (el.oninput = hrSum));
    const [ja, jb] = d.querySelectorAll("input");
    for (const j of [ja, jb]) j.addEventListener("blur", () => { j.value = bakuJam(j.value); hrSum(); });
    jb.addEventListener("change", () => { jb.value = bakuJam(jb.value); const nx = d.nextElementSibling?.querySelector("input"); if (nx && !nx.value.trim()) nx.value = jb.value; hrSum(); });
    return d; };
  const hrSum = () => { let t = 0, bad = 0, urut = 0, prev = null; $("#hr").querySelectorAll(".row").forEach((r) => { const [a, b] = r.querySelectorAll("input"); if (!a.value.trim() && !b.value.trim()) return; const m = durMin(a.value, b.value); if (m === null) bad++; else t += m; if (prev !== null && hm2min(a.value) !== null && hm2min(a.value) !== prev) urut++; prev = hm2min(b.value); });
    const kuning = (x) => ` <span style="background:#FFF1C2;color:#7a5600;padding:1px 6px;border-radius:6px">${x}</span>`;
    $("#hrSum").innerHTML = `TOTAL HOURS: <b>${(t / 60).toFixed(2)} jam</b>${t > 720 ? kuning("lebih dari 12 jam satu shift — periksa") : ""}${bad ? kuning(`${bad} baris jam belum terbaca (mis. 06:30) — tetap bisa disimpan`) : ""}${urut ? kuning(`${urut} baris tidak menyambung dengan jam selesai baris sebelumnya`) : ""}`; };
  $("#ohAdd").onclick = () => ohRow(); $("#crAdd").onclick = () => crRow(); $("#hrAdd").onclick = () => hrRow();
  ohRow({ kosong: true }); crRow({ kosong: true }); hrRow({ mulai: shift === "PAGI" ? "06:00" : "18:00", kategori: "P2H+P5M" }); hrSum();
  $("#jbd").onchange = () => { const b = bhJenis($("#bh").value, $("#jbd").value); if (b) $("#bh").value = b; segarkanFrom(); };
  $("#bh").addEventListener("change", () => { $("#jbd").value = jenisDariBH(bakuBH($("#bh").value)); });
  $("#bh").addEventListener("change", segarkanFrom); if (!EDIT) segarkanFrom();
  async function isiEditDDR() {
    const { data: d, error } = online() ? await sb.from("ddr").select("*").eq("id", EDIT.id).single() : { error: { message: "offline" } };
    if (error || !d) { sessionStorage.removeItem("ddrEdit"); return alert("DDR untuk diedit tidak bisa dimuat: " + (error?.message ?? "tidak ditemukan")); }
    if (d.status === "SIGNED") { sessionStorage.removeItem("ddrEdit"); return alert("DDR ini sudah ditandatangani. Minta verifier/admin membuka tanda tangan (🔓 Buka TTD) dulu — TTD lama dihapus dan DDR perlu ditandatangani ulang."); }
    const set = (id, x) => { const el = $(id); if (el && x != null) el.value = x; };
    if (![...$("#rg").options ?? []].some((o) => o.value === d.rig) && $("#rg").tagName === "SELECT") $("#rg").insertAdjacentHTML("afterbegin", `<option>${esc(d.rig)}</option>`);
    set("#rg", d.rig); set("#dt", d.report_date); set("#sh", d.shift); set("#bh", d.bhid); set("#jbd", d.jenis_bor ?? jenisDariBH(d.bhid ?? "")); set("#pj", d.project); set("#lc", d.location); set("#rt", d.rig_type);
    set("#ct", d.contractor); set("#dn", d.driller_name); set("#ht", d.hole_type); set("#rd", d.rod_m); set("#tg", d.target_m); set("#td", d.total_depth_m); set("#h1", d.hm_start); set("#h2", d.hm_end); set("#wx", d.weather); set("#nt", d.notes);
    { const t2 = (d.titik_lain ?? [])[0]; if (t2?.bhid) { $("#t2Box").style.display = ""; $("#t2Add").style.display = "none"; $("#bh2").value = t2.bhid; $("#kp2X").value = t2.koord_x != null ? String(t2.koord_x).replace(".", ",") : ""; $("#kp2Y").value = t2.koord_y != null ? String(t2.koord_y).replace(".", ",") : ""; $("#kp2Z").value = t2.koord_z != null ? String(t2.koord_z).replace(".", ",") : ""; } }
    if (d.koord_x != null) { $("#kpX").value = String(d.koord_x).replace(".", ","); $("#kpY").value = String(d.koord_y ?? "").replace(".", ","); $("#kpZ").value = d.koord_z != null ? String(d.koord_z).replace(".", ",") : ""; kpSumber = d.koord_sumber; }
    kunciAsal = { rig: d.rig, tanggal: d.report_date, shift: d.shift };
    for (const id of ["#rg", "#dt", "#sh"]) { $(id).style.outline = "2px dashed #F2B705"; $(id).title = "Boleh diubah: DDR ini dipindah ke rig / tanggal / shift (Day–Night) yang baru saat disimpan"; }
    consEkstra = (d.consumables ?? []).filter((c) => !items.some((it) => it.item === c.item));
    isiDaftarCrew((d.crew ?? []).filter((x) => x.jabatan !== "Driller" && x.jabatan !== "WSG"));
    $("#oh").innerHTML = ""; $("#cr").innerHTML = ""; $("#hr").innerHTML = "";
    for (const x of d.open_hole ?? []) ohRow({ from: x.from, to: x.to, bhid: x.bhid ?? "" }); if (!(d.open_hole ?? []).length) ohRow({ kosong: true });
    for (const x of d.coring ?? []) crRow({ from: x.from, to: x.to, core: x.core, remark: x.remark, bhid: x.bhid ?? "" }); if (!(d.coring ?? []).length) crRow({ kosong: true });
    for (const h of d.hours ?? []) { const r = hrRow({ mulai: h.mulai, selesai: h.selesai, kategori: h.kategori }); r.querySelectorAll("input")[2].value = h.ket ?? ""; } if (!(d.hours ?? []).length) hrRow({});
    hrSum();
    for (const c of d.consumables ?? []) { const i = items.findIndex((it) => it.item === c.item); if (i < 0) continue; const q = v.querySelector(`[data-q="${i}"]`); if (q && +c.qty) q.value = String(c.qty).replace(".", ","); const nn = v.querySelector(`[data-n="${i}"]`); if (nn && c.note) nn.value = c.note; }
    const kartu = v.querySelector(".card"); kartu.insertAdjacentHTML("afterbegin", `<div id="editBanner" style="background:#FFF1C2;border-radius:10px;padding:10px;margin-bottom:8px">✏️ <b>Mode edit DDR</b> ${esc(d.rig)} · ${esc(d.report_date)} · ${d.shift === "MALAM" ? "Night" : "Day"} (${d.status}).<br><span style="font-size:13px">Simpan = isi DDR ini diganti; versi lama tetap tersimpan di server. Tanda tangan yang sudah ada tidak diminta ulang.</span> <button class="sec" id="editBatal" style="width:auto;padding:4px 10px;margin-top:4px">Batal edit</button></div>`);
    $("#editBatal").onclick = () => { sessionStorage.removeItem("ddrEdit"); tab = EDIT.dari || "dash"; localStorage.setItem("tab", tab); render(); };
    // TTD yang sudah ada: bisa dihapus (wellsite/verifier/admin) bila salah orang, lalu ditandatangani ulang saat simpan
    const { data: sgE } = await sb.from("ddr_signature").select("slot,signer_name,method,signed_at,ttd_tersimpan").eq("ddr_id", EDIT.id);
    $("#editBanner").insertAdjacentHTML("beforeend", `<div style="margin-top:8px;font-size:13px"><b>Tanggal, shift (Day/Night) dan rig bisa diubah</b> (kolom bergaris kuning). <b>Tanda tangan:</b> ${(sgE ?? []).length ? (sgE ?? []).map((x) => `${esc(SLOT_LABEL[x.slot] ?? x.slot)}: ${esc(x.signer_name)}${isStaff() ? ` <button class="danger" data-hts="${esc(x.slot)}" style="width:auto;padding:2px 8px">Hapus</button>` : ""}`).join(" · ") : "belum ada"} — yang kosong diminta saat simpan.</div>`);
    $("#editBanner").querySelectorAll("[data-hts]").forEach((b) => (b.onclick = async () => { const al = prompt(`Hapus TTD ${SLOT_LABEL[b.dataset.hts]} di DDR ini?\nAlasan (wajib, tercatat):`); if (!al || !al.trim()) return;
      const { error } = await sb.rpc("hapus_ttd_ddr", { p_ddr: EDIT.id, p_slot: b.dataset.hts, p_alasan: al.trim() }); if (error) return alert("Gagal: " + error.message);
      toast("TTD dihapus — tanda tangan ulang saat simpan."); b.replaceWith(Object.assign(document.createElement("i"), { textContent: "(dihapus)" })); }));
    const sorot = EDIT.sorot === "jam" ? ["#hr"] : EDIT.sorot === "barang" ? [] : ["#oh", "#cr"];
    for (const id of sorot) { $(id).style.outline = "3px solid #F2B705"; $(id).style.borderRadius = "8px"; }
    $(sorot[0] ?? "#oh")?.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#sv").textContent = "Simpan perubahan DDR";
  }
  $("#crFoto").onclick = async () => {
    const r = $("#rg").value.trim().toUpperCase(), [a, b] = shiftWindow($("#dt").value, $("#sh").value);
    let ev = (await qAll()).filter((x) => x.kind === "event" && x.row?.event_type === "RUN" && x.row.rig === r && x.row.captured_at >= a && x.row.captured_at < b).map((x) => x.row);
    if (online()) { const { data } = await sb.from("v_drill_event_qc").select("depth_from,depth_to,core_length,captured_at").eq("rig", r).eq("event_type", "RUN").gte("captured_at", a).lt("captured_at", b); ev = ev.concat(data ?? []); }
    ev = [...new Map(ev.map((e) => [`${e.depth_from}|${e.depth_to}`, e])).values()].sort((x, y) => x.depth_from - y.depth_from);
    if (!ev.length) return alert("Belum ada foto RUN untuk rig dan shift ini.");
    $("#cr").innerHTML = ""; ev.forEach((e) => crRow({ from: e.depth_from, to: e.depth_to, core: e.core_length }));
  };
  // Crew DDR: driller (kolom DRILLER) + daftar assistant, minimal crewMin() orang. Diisi otomatis dari Masuk shift (Progres bor) bila ada.
  let crewDDR = [];
  const JAB_CREW = ["Helper", "Mekanik", "Driller", "Lainnya"];
  const crwRow = (x = {}) => { $("#crw").insertAdjacentHTML("beforeend", `<div class="row" data-cw style="align-items:center;margin-top:4px"><select style="flex:0 0 104px">${JAB_CREW.map((j) => `<option ${(x.jabatan || "Helper") === j ? "selected" : ""}>${j}</option>`).join("")}</select><input value="${esc(x.nama ?? "")}" list="dlCrew" placeholder="Nama crew" autocapitalize="words"><button class="sec" data-x style="flex:0;padding:8px 12px">✕</button></div>`);
    const r = $("#crw").lastElementChild; r.querySelector("[data-x]").onclick = () => { r.remove(); hitungCrew(); }; r.querySelector("input").oninput = hitungCrew; };
  const ambilCrew = () => [...$("#crw").querySelectorAll("[data-cw]")].map((r) => ({ jabatan: r.querySelector("select").value, nama: r.querySelector("input").value.trim().replace(/\s+/g, " ") })).filter((x) => x.nama);
  const hitungCrew = () => { const n = (val => val ? 1 : 0)($("#dn").value.trim()) + ambilCrew().length; $("#cc").value = n || "";
    const el = $("#crewMin"); if (el) el.innerHTML = `Crew terisi <b style="color:${n < crewMin() ? "var(--red)" : "var(--green)"}">${n}/${crewMin()}</b>${n < crewMin() ? " — tambah nama sampai minimal " + crewMin() : ""}`; };
  const isiDaftarCrew = (L) => { $("#crw").innerHTML = ""; L.forEach(crwRow); while ($("#crw").children.length < crewMin() - 1) crwRow(); hitungCrew(); };
  $("#crwAdd").onclick = () => { crwRow(); hitungCrew(); };
  $("#dn").addEventListener("input", hitungCrew);
  // ✍️ TTD driller satu ketuk (25-11-2026): bila nama driller cocok dengan TTD tersimpan, wellsite/admin cukup centang persetujuan driller;
  // TTD tersimpan dipasang otomatis saat simpan (server mencatat akun penyimpan sebagai saksi). Tanpa centang → alur TTD biasa.
  let ttdOto = null;
  const knTtd = (x) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (bisaTtdLayar("DRILLER")) { const box = document.createElement("div"); box.id = "ttdAuto"; box.style.margin = "4px 0 6px"; $("#dn").closest(".row")?.after(box);
    let tmr = null; const isi = async () => { const nm = $("#dn").value.trim(); ttdOto = null; if (!nm) return (box.innerHTML = "");
      const t = (await ttdDrillerTersimpan().catch(() => [])).find((x) => knTtd(x.nama) === knTtd(nm));
      if (!t) return (box.innerHTML = `<small class="muted">Belum ada TTD tersimpan untuk <b>${esc(nm)}</b>. Saat simpan, driller tanda tangan <b>sekali</b> di layar (biarkan "Simpan TTD ini" tercentang); DDR berikutnya cukup satu centang di sini.</small>`);
      ttdOto = t; box.innerHTML = `<label style="display:flex;gap:8px;align-items:flex-start;background:#E6F4EC;border-radius:8px;padding:8px;margin:0;font-weight:400"><input type="checkbox" id="ttdOk" style="width:auto;margin-top:3px"> <span>✍️ Driller <b>${esc(t.nama)}</b> sudah membaca &amp; menyetujui isi DDR ini — pasang TTD tersimpannya otomatis saat simpan (tercatat atas nama saya sebagai saksi).</span></label>`; };
    $("#dn").addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(isi, 500); }); $("#dn").addEventListener("change", isi); setTimeout(isi, 300); }
  const ttdOtomatis = () => (ttdOto && $("#ttdOk")?.checked && knTtd(ttdOto.nama) === knTtd($("#dn").value) ? { slot: "DRILLER", method: "CORET", tersimpan: true, name: ttdOto.nama, path: ttdOto.signature_path, signed_at: new Date().toISOString() } : null);
  isiDaftarCrew((last.crew_list ?? (last.helpers ?? "").split(",").map((n) => ({ nama: n.trim(), jabatan: "Helper" }))).filter((x) => x.nama));
  const isiCrew = async () => {
    if (EDIT) return; // mode edit: crew diambil dari DDR yang diedit
    const rg = $("#rg").value.trim().toUpperCase(), tg = $("#dt").value, sh = $("#sh").value;
    let L = JSON.parse(localStorage.getItem(kunciPersonil(rg, tg, sh)) || "null");
    if (!L && online()) { const { data } = await sb.from("v_personil_shift").select("personil").eq("rig", rg).eq("tanggal", tg).eq("shift", sh).maybeSingle(); L = data?.personil ?? null; }
    crewDDR = L ?? [];
    const info = $("#crewInfo"); if (!info) return;
    if (!crewDDR.length) { info.innerHTML = `<span id="crewMin"></span><br><span class="muted">Belum ada daftar Masuk shift di Progres bor untuk ${esc(rg)} · ${esc(tg)} · ${sh === "PAGI" ? "Day" : "Night"} — isi nama crew manual.</span>`; hitungCrew(); return; }
    const dr = crewDDR.find((x) => x.jabatan === "Driller"); if (dr && !$("#dn").readOnly && !$("#dn").value.trim()) $("#dn").value = dr.nama;
    const dn = $("#dn").value.trim().toUpperCase();
    isiDaftarCrew(crewDDR.filter((x) => x.jabatan !== "WSG" && x.nama.toUpperCase() !== dn));
    info.innerHTML = `<span id="crewMin"></span><br><span class="muted">Diisi dari Masuk shift (Progres bor) — bisa ditambah/diubah.</span>`; hitungCrew();
  };
  ["#rg", "#dt", "#sh"].forEach((id) => $(id).addEventListener("change", isiCrew)); isiCrew();
  // v.25: koordinat titik pelaksanaan di DDR → koordinat lubang (trigger DB zw_koordinat_ddr)
  let kpSumber = null; const kpNum = (x) => (String(x ?? "").trim() === "" ? null : Number(String(x).replace(/\s/g, "").replace(",", ".")));
  const kpRencana = () => { const bh = bhJenis($("#bh").value, $("#jbd").value), a = asalRedrill(bh); return rencanaLokal().find((z) => z.bhid === bh) ?? (a ? rencanaLokal().find((z) => z.bhid === a) : null); };
  const kpInfo = () => { const R = kpRencana(), x = kpNum($("#kpX").value), y = kpNum($("#kpY").value); let h = "";
    if (R) { const [rx, ry] = UTM.ke(+R.lon, +R.lat); h = `Titik rencana ${esc(R.bhid)}: X ${fmtD(rx)} · Y ${fmtD(ry)}`; if (x != null && y != null) { const d = Math.round(Math.hypot(x - rx, y - ry)); h += ` · jarak titik pelaksanaan <b>${d} m</b>${d > 25 ? " (bergeser dari rencana)" : ""}`; } }
    else h = $("#bh").value.trim() ? "Hole ID ini tidak ada di titik rencana — isi koordinat pelaksanaan agar lubang muncul di peta." : "";
    $("#kpInfo").innerHTML = h; $("#kpR").disabled = !R; };
  ["#bh", "#jbd"].forEach((id) => $(id)?.addEventListener("change", kpInfo)); $("#bh")?.addEventListener("input", kpInfo);
  $("#kpX").oninput = $("#kpY").oninput = () => { kpSumber = "DDR (diketik)"; kpInfo(); };
  $("#kpR").onclick = () => { const R = kpRencana(); if (!R) return; const [x, y] = UTM.ke(+R.lon, +R.lat); $("#kpX").value = x.toFixed(2).replace(".", ","); $("#kpY").value = y.toFixed(2).replace(".", ","); kpSumber = "RENCANA"; kpInfo(); };
  $("#kpC").onclick = () => { $("#kpX").value = $("#kpY").value = $("#kpZ").value = ""; kpSumber = null; kpInfo(); };
  $("#kpG").onclick = () => { if (!navigator.geolocation) return alert("GPS tidak tersedia di perangkat ini."); $("#kpG").textContent = "Mencari GPS…";
    navigator.geolocation.getCurrentPosition((p) => { const [x, y] = UTM.ke(p.coords.longitude, p.coords.latitude); $("#kpX").value = x.toFixed(2).replace(".", ","); $("#kpY").value = y.toFixed(2).replace(".", ",");
      if (p.coords.altitude != null) $("#kpZ").value = p.coords.altitude.toFixed(1).replace(".", ","); kpSumber = `GPS APLIKASI ±${Math.round(p.coords.accuracy)} m`; $("#kpG").textContent = `📍 GPS ±${Math.round(p.coords.accuracy)} m`; kpInfo(); },
      (e) => { $("#kpG").textContent = "📍 Ambil GPS sekarang"; alert("GPS gagal: " + e.message); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); };
  kpInfo();
  // v.37: titik ke-2 (pindah titik di shift yang sama) — Hole ID & koordinat pelaksanaan sendiri, baris coring/open hole otomatis ber-Hole ID titik ke-2
  let kp2Sumber = null;
  const bh2 = () => bakuBH($("#bh2").value);
  const kp2Info = () => { const b = bh2(), R = b ? (rencanaLokal().find((z) => z.bhid === b) ?? (asalRedrill(b) ? rencanaLokal().find((z) => z.bhid === asalRedrill(b)) : null)) : null, x = kpNum($("#kp2X").value), y = kpNum($("#kp2Y").value);
    let h = ""; if (R) { const [rx, ry] = UTM.ke(+R.lon, +R.lat); h = `Titik rencana ${esc(R.bhid)}: X ${fmtD(rx)} · Y ${fmtD(ry)}`; if (x != null && y != null) { const d = Math.round(Math.hypot(x - rx, y - ry)); h += ` · jarak <b>${d} m</b>${d > 25 ? " (bergeser)" : ""}`; } }
    $("#kp2Info").innerHTML = h; $("#kp2R").disabled = !R; };
  const tampilT2 = (on) => { $("#t2Box").style.display = on ? "" : "none"; $("#t2Add").style.display = on ? "none" : ""; };
  $("#t2Add").onclick = () => { tampilT2(true); $("#bh2").focus(); };
  $("#t2Del").onclick = () => { if (v.querySelector(`#oh [data-rbh], #cr [data-rbh]`) && [...v.querySelectorAll("#oh [data-rbh], #cr [data-rbh]")].some((i) => bh2() && bakuBH(i.value) === bh2()) && !confirm("Baris coring/open hole titik ke-2 tetap ada (Hole ID-nya bisa dihapus manual). Hapus titik ke-2?")) return;
    $("#bh2").value = $("#kp2X").value = $("#kp2Y").value = $("#kp2Z").value = ""; kp2Sumber = null; tampilT2(false); };
  $("#bh2").addEventListener("input", kp2Info); $("#bh2").addEventListener("change", kp2Info);
  $("#kp2X").oninput = $("#kp2Y").oninput = () => { kp2Sumber = "DDR (diketik)"; kp2Info(); };
  $("#kp2R").onclick = () => { const b = bh2(), R = rencanaLokal().find((z) => z.bhid === b) ?? rencanaLokal().find((z) => z.bhid === asalRedrill(b)); if (!R) return; const [x, y] = UTM.ke(+R.lon, +R.lat); $("#kp2X").value = x.toFixed(2).replace(".", ","); $("#kp2Y").value = y.toFixed(2).replace(".", ","); kp2Sumber = "RENCANA"; kp2Info(); };
  $("#kp2G").onclick = () => { if (!navigator.geolocation) return alert("GPS tidak tersedia."); $("#kp2G").textContent = "Mencari GPS…";
    navigator.geolocation.getCurrentPosition((p) => { const [x, y] = UTM.ke(p.coords.longitude, p.coords.latitude); if (!(x >= 100000 && x <= 900000)) { $("#kp2G").textContent = "📍 GPS sekarang"; return alert("Posisi GPS di luar zona UTM 51S — bukan di lokasi proyek."); }
      $("#kp2X").value = x.toFixed(2).replace(".", ","); $("#kp2Y").value = y.toFixed(2).replace(".", ","); if (p.coords.altitude != null) $("#kp2Z").value = p.coords.altitude.toFixed(1).replace(".", ","); kp2Sumber = `GPS APLIKASI ±${Math.round(p.coords.accuracy)} m`; $("#kp2G").textContent = `📍 GPS ±${Math.round(p.coords.accuracy)} m`; kp2Info(); },
      (e) => { $("#kp2G").textContent = "📍 GPS sekarang"; alert("GPS gagal: " + e.message); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); };
  const toTitik2 = () => { const b = bh2(), xs = [...v.querySelectorAll("#oh .row, #cr .row")].filter((r) => bakuBH(r.querySelector("[data-rbh]")?.value ?? "") === b).map((r) => num(r.querySelectorAll("input")[1].value)).filter((x) => Number.isFinite(x)); return xs.length ? Math.max(...xs) : 0; };
  $("#t2Cr").onclick = () => { if (!bh2()) return $("#bh2").focus(); crRow({ bhid: bh2(), from: fdK(toTitik2()) }); };
  $("#t2Oh").onclick = () => { if (!bh2()) return $("#bh2").focus(); ohRow({ bhid: bh2(), from: fdK(toTitik2()) }); };
  if (EDIT) { await isiEditDDR(); kpInfo(); kp2Info(); }
  $("#sv").onclick = async () => {
    const val = (id) => $(id).value.trim();
    const rows = (box) => [...$(box).querySelectorAll(".row")].map((r) => [...r.querySelectorAll("input,select")].map((x) => x.value.trim()));
    const bhH = bhJenis(val("#bh"), $("#jbd").value), bhR = (x) => { const b = bhJenis(x, jenisDariBH(x)); return b && b !== bhH ? b : undefined; };
    const open_hole = rows("#oh").filter((x) => x[0] || x[1]).map(([f, t, b]) => ({ from: num(f), to: num(t), ...(bhR(b) ? { bhid: bhR(b) } : {}) }));
    const coring = rows("#cr").filter((x) => x[0] || x[1]).map(([f, t, c, rm, b]) => ({ from: num(f), to: num(t), core: num(c), remark: rm || null, ...(bhR(b) ? { bhid: bhR(b) } : {}) }));
    const hours = rows("#hr").filter((x) => x[0] || x[1]).map(([m, s, k, d]) => ({ mulai: bakuJam(m), selesai: bakuJam(s), kategori: k, ket: d || null }));
    const peringatan = []; // tidak menghalangi simpan
    const row = { project: val("#pj") || null, location: val("#lc") || null, rig: val("#rg").toUpperCase(), rig_type: val("#rt") || null, report_date: val("#dt"), shift: $("#sh").value,
      bhid: bhJenis(val("#bh"), $("#jbd").value) || null, jenis_bor: $("#jbd").value, contractor: val("#ct"), driller_name: val("#dn"), helpers: ambilCrew().map((x) => x.nama).join(", ") || null, crew_count: num(val("#cc")),
      crew: [...(val("#dn") ? [{ nama: val("#dn"), jabatan: "Driller" }] : []), ...ambilCrew(), ...crewDDR.filter((x) => x.jabatan === "WSG")],
      hm_start: num(val("#h1")), hm_end: num(val("#h2")), weather: $("#wx").value, notes: val("#nt") || null, hole_type: $("#ht").value, rod_m: num(val("#rd")),
      target_m: num(val("#tg")), total_depth_m: num(val("#td")), open_hole, coring, hours, captured_at: new Date().toISOString() };
    if (asalRedrill(row.bhid)) Object.assign(row, { redrill: true, lubang_asal: bakuBH(asalRedrill(row.bhid)) }); // REDRILL: lubang asal = Hole ID tanpa R
    { const kx = kpNum($("#kpX").value), ky = kpNum($("#kpY").value), kz = kpNum($("#kpZ").value);
      if ((kx == null) !== (ky == null)) return ($("#e").textContent = "Koordinat pelaksanaan: isi X dan Y keduanya (atau kosongkan keduanya).");
      if (kx != null && !(kx >= 100000 && kx <= 900000 && ky >= 0 && ky <= 10000000)) return ($("#e").textContent = "Koordinat pelaksanaan tidak wajar: X 6 digit, Y 7 digit (UTM WGS84 51S).");
      if (kz != null && !(kz > -100 && kz < 5000)) return ($("#e").textContent = "Elevasi Z tidak wajar.");
      Object.assign(row, { koord_x: kx, koord_y: ky, koord_z: kz, koord_sumber: kx != null ? kpSumber ?? "DDR" : null }); }
    { const b2 = $("#t2Box").style.display !== "none" ? bakuBH($("#bh2").value) : ""; row.titik_lain = null;
      if (b2) { if (b2 === row.bhid) return ($("#e").textContent = "Hole ID titik ke-2 sama dengan Hole ID di atas.");
        const x2 = kpNum($("#kp2X").value), y2 = kpNum($("#kp2Y").value), z2 = kpNum($("#kp2Z").value);
        if ((x2 == null) !== (y2 == null)) return ($("#e").textContent = "Koordinat titik ke-2: isi X dan Y keduanya (atau kosongkan keduanya).");
        if (x2 != null && !(x2 >= 100000 && x2 <= 900000 && y2 >= 0 && y2 <= 10000000)) return ($("#e").textContent = "Koordinat titik ke-2 tidak wajar: X 6 digit, Y 7 digit (UTM WGS84 51S).");
        if (![...open_hole, ...coring].some((x) => x.bhid === b2) && !confirm(`Belum ada baris coring/open hole untuk ${b2}. Tetap simpan?`)) return;
        row.titik_lain = [{ bhid: b2, koord_x: x2, koord_y: y2, koord_z: z2, koord_sumber: x2 != null ? kp2Sumber ?? "DDR" : null }]; } }
    // v.38: edit DDR selalu mengganti DDR asal (ganti_id); DDR baru di rig/tanggal/shift yang sudah ada DDR-nya → DDR terpisah per Hole ID (setelah v46b)
    if (EDIT?.id) row.ganti_id = EDIT.id;
    else if (online()) { const { data: ada } = await sb.from("ddr").select("id,bhid,status").eq("rig", row.rig).eq("report_date", row.report_date).eq("shift", row.shift);
      if ((ada ?? []).length) { const { data: perLubang } = await sb.rpc("ddr_boleh_per_lubang"); const sama = ada.find((x) => x.bhid === row.bhid), lain = ada.filter((x) => x.bhid !== row.bhid).map((x) => x.bhid).join(", ");
        const sh = row.shift === "MALAM" ? "Night" : "Day";
        if (sama) { if (sama.status === "SIGNED") return ($("#e").textContent = `DDR ${row.rig} ${row.report_date} ${sh} untuk ${row.bhid} sudah ditandatangani — minta verifier/admin Buka TTD lalu Edit DDR.`);
          if (!confirm(`Sudah ada DDR ${row.rig} ${row.report_date} ${sh} untuk ${row.bhid}. DDR ini akan MENGGANTI isinya (versi lama tetap tersimpan). Lanjut?`)) return; }
        else if (perLubang) { if (!confirm(`Sudah ada DDR ${row.rig} ${row.report_date} ${sh} untuk ${lain}.\nDDR ini disimpan sebagai DDR TERPISAH untuk ${row.bhid}.\n\nPastikan BBM, oli, barang, crew, HM dan jam diisi hanya bagian titik ${row.bhid} (jangan dobel). Lanjut?`)) return; }
        else return ($("#e").textContent = `Sudah ada DDR ${row.rig} ${row.report_date} ${sh} untuk ${lain}. Satu shift saat ini hanya boleh 1 DDR — pakai "➕ Pindah titik di shift ini (titik ke-2)" di DDR itu (Edit DDR), atau minta admin menjalankan v46b agar boleh DDR terpisah per Hole ID.`); } }
    const miss = ["bhid", "rig", "report_date", "contractor", "driller_name", "crew_count"].filter((k) => row[k] === null || row[k] === "");
    if (miss.length) return ($("#e").textContent = "Lengkapi kolom bertanda * (" + miss.join(", ") + ").");
    if (row.crew_count < crewMin()) return ($("#e").textContent = `Nama crew baru ${row.crew_count} — minimal ${crewMin()} orang (driller + assistant). Tambah dengan "+ crew".`);
    if ([...open_hole, ...coring].some((x) => !(x.to > x.from))) return ($("#e").textContent = "Setiap baris open hole/coring harus To > From.");
    { const ce = cekCoreRun(coring); if (ce !== null) return ($("#e").textContent = ce); }
    if (hours.some((h) => durMin(h.mulai, h.selesai) === null)) peringatan.push(`${hours.filter((h) => durMin(h.mulai, h.selesai) === null).length} baris jam tidak terbaca`);
    if (!hours.length) peringatan.push("HOURLY DISTRIBUTION belum diisi");
    if (row.hm_start !== null && row.hm_end !== null && row.hm_end < row.hm_start) return ($("#e").textContent = "HM akhir lebih kecil dari HM awal.");
    // Jumlah kosong = tidak dipakai (0). Koma desimal boleh. Teks bukan angka → 0 + teks asli ke catatan (server juga merapikan, v21b).
    const cons = items.map((it, i) => { const raw = v.querySelector(`[data-q="${i}"]`).value.trim(), note = v.querySelector(`[data-n="${i}"]`).value.trim() || null, q = num(raw);
      return Number.isFinite(q) ? { ...it, qty: q ?? 0, note } : { ...it, qty: 0, note: [note, `jumlah tertulis: ${raw}`].filter(Boolean).join(" · ") }; });
    row.consumables = [...cons, ...consEkstra];
    const tot = hours.reduce((s, h) => s + (durMin(h.mulai, h.selesai) ?? 0), 0);
    if (tot > 720) peringatan.push(`total jam ${(tot / 60).toFixed(1)} > 12 jam`);
    if (peringatan.length) toast?.(`Disimpan dengan catatan: ${peringatan.join("; ")}. Bisa diperbaiki lewat Edit.`);
    localStorage.setItem("ddrLast", JSON.stringify({ v: 2, contractor: row.contractor, driller_name: row.driller_name, crew_count: row.crew_count, helpers: row.helpers, crew_list: ambilCrew(), project: row.project, location: row.location, rig_type: row.rig_type, target_m: row.target_m }));
    localStorage.setItem("rig", row.rig); localStorage.setItem("shift", row.shift); localStorage.setItem("bhid", row.bhid);
    if (EDIT && kunciAsal && (row.rig !== kunciAsal.rig || row.report_date !== kunciAsal.tanggal || row.shift !== kunciAsal.shift)) {
      if (!online()) return ($("#e").textContent = "Memindah tanggal / shift / rig DDR perlu sinyal internet.");
      const al = prompt(`Pindahkan DDR ini:\n${kunciAsal.rig} · ${kunciAsal.tanggal} · ${kunciAsal.shift === "MALAM" ? "Night" : "Day"}\n→ ${row.rig} · ${row.report_date} · ${row.shift === "MALAM" ? "Night" : "Day"}\n\nAlasan (wajib, tercatat):`);
      if (!al || !al.trim()) return ($("#e").textContent = "Alasan pemindahan tanggal/shift/rig wajib diisi.");
      const { error: ek } = await sb.rpc("pindah_kunci_ddr", { p_ddr: EDIT.id, p_rig: row.rig, p_tanggal: row.report_date, p_shift: row.shift, p_alasan: al.trim() });
      if (ek) return ($("#e").textContent = "Gagal memindah DDR: " + ek.message);
      kunciAsal = { rig: row.rig, tanggal: row.report_date, shift: row.shift }; }
    if (EDIT) { // kirim ulang DDR yang sama (rig/tanggal/shift); server mengganti isi DDR DRAF dan menyimpan versi lama
      // tanda tangan yang belum ada di DDR ini diminta setelah edit (yang sudah ada tetap tersimpan)
      const { data: sgAda } = online() ? await sb.from("ddr_signature").select("slot").eq("ddr_id", EDIT.id) : { data: [] };
      const ada = new Set((sgAda ?? []).map((x) => x.slot)), signs = [];
      for (const slot of ["DRILLER", "WELLSITE", "CLIENT"].filter((k) => !ada.has(k))) { const s = slot === "DRILLER" && ttdOtomatis() || await signDialog(slot, row.driller_name ?? ""); if (s) signs.push(s); }
      await qPut({ kind: "ddr", client_uuid: crypto.randomUUID(), row, signs, edit_dari: EDIT.id });
      sessionStorage.removeItem("ddrEdit"); alert(`Perubahan DDR disimpan dan dikirim. Isi DDR lama diganti; versi lama tetap tersimpan di server.${ada.size ? `\nTanda tangan yang sudah ada tetap: ${[...ada].map((k) => SLOT_LABEL[k]).join(", ")}.` : ""}${signs.length ? `\nTanda tangan baru: ${signs.length}.` : ""}${ada.size + signs.length < 2 ? "\nTanda tangan yang kurang bisa dilengkapi dari daftar DDR → Tanda tangani." : ""}`);
      tab = EDIT.dari || "dash"; localStorage.setItem("tab", tab); render(); sync(); return; }
    const signs = [];
    for (const slot of ["DRILLER", "WELLSITE", "CLIENT"]) { const s = slot === "DRILLER" && ttdOtomatis() || await signDialog(slot, row.driller_name ?? ""); if (s) signs.push(s); }
    await qPut({ kind: "ddr", client_uuid: crypto.randomUUID(), row, signs });
    alert(`DDR disimpan dengan ${signs.length} tanda tangan.${signs.length < 2 ? " Yang kurang bisa dilengkapi dari daftar DDR setelah terkirim." : ""}`);
    render(); sync();
  };
  $("#sy").onclick = sync;
  if (online()) {
    // v.27: DDR yang sudah LENGKAP (ditandatangani) pindah ke Database (sheet Rekap DDR) — daftar ini hanya DDR yang masih DRAF
    const [{ data }, { count: nLengkap }] = await Promise.all([sb.from("v_ddr_list").select("id,report_date,shift,rig,bhid,status,driller_name,meter_bor,coring_ddr_m,selisih_ddr_vs_foto_m,bbm_liter,bbm_per_meter,ttd").neq("status", "SIGNED").order("report_date", { ascending: false }).limit(60),
      sb.from("ddr").select("id", { count: "exact", head: true }).eq("status", "SIGNED")]);
    const { data: pb } = (data ?? []).length ? await sb.from("ddr").select("id,created_by").in("id", data.map((d) => d.id)) : { data: [] };
    const pembuat = Object.fromEntries((pb ?? []).map((x) => [x.id, x.created_by]));
    const bisaEdit = (d) => d.status !== "SIGNED" && (["geologist", "verifier", "admin"].includes(me?.role) || pembuat[d.id] === session?.user?.id);
    const kurangDrl = (data ?? []).filter((d) => d.status !== "SIGNED" && !/DRILLER:/.test(d.ttd ?? ""));
    $("#lst").innerHTML = `${nLengkap ? `<div class="row" style="align-items:center;margin-bottom:8px;background:#E8F4EC;border-radius:8px;padding:6px 10px"><span style="flex:1">📦 <b>${nLengkap} DDR LENGKAP</b> (sudah ditandatangani) sudah pindah ke <b>Database → Rekap DDR</b>.</span>${!isStaff() ? "" : `<button class="sec" id="keRekap" style="flex:0;white-space:nowrap">Buka Rekap DDR</button>`}</div>` : ""}${!(data ?? []).length ? `<p class="muted">Tidak ada DDR draf — semua DDR sudah lengkap.</p>` : ""}${bisaTtdLayar("DRILLER") && kurangDrl.length ? `<div class="row" style="margin-bottom:8px"><button id="ttdMassal" style="flex:0;white-space:nowrap">✍️ Lengkapi TTD driller (${kurangDrl.length} DDR)</button><span class="muted" style="font-size:12px;align-self:center">DDR yang sudah selesai tapi belum ada TTD driller — diisi wellsite/admin tanpa driller memakai aplikasi</span></div>` : ""}<ul class="list">${(data ?? []).map((d) => `<li style="flex-wrap:wrap"><span class="pill ${d.status === "SIGNED" ? "APPROVED" : "NEEDS_REVIEW"}">${d.status === "SIGNED" ? "LENGKAP" : "DRAF"}</span>
      <span style="flex:1">${esc(d.report_date)} · ${d.shift === "PAGI" ? "Day" : "Night"} · <b>${esc(d.rig)}</b> ${esc(d.bhid ?? "")}<br><span class="muted">Coring DDR ${d.coring_ddr_m ?? 0} m · Diesel ${d.bbm_liter} L${d.bbm_per_meter ? ` (${d.bbm_per_meter} L/m)` : ""}<br>${esc(d.ttd ?? "belum ada TTD")}</span></span>
      ${!/CLIENT/.test(d.ttd ?? "") ? `<button class="sec" data-sg="${d.id}" style="flex:0">Tanda tangani</button>` : ""}${bisaEdit(d) ? `<button data-ef="${d.id}" style="flex:0;white-space:nowrap">✏️ Edit DDR</button>` : d.status === "SIGNED" && ["verifier", "admin"].includes(me?.role) ? `<button class="danger" data-bt="${d.id}" style="flex:0;white-space:nowrap">🔓 Buka TTD</button>` : ""}<button class="sec" data-pr="${d.id}" style="flex:0">Lihat / cetak</button></li>`).join("") || `<li class="muted">Belum ada.</li>`}</ul>
      <p class="muted" style="font-size:12px;margin:6px 0 0">✏️ Edit DDR = ubah semua isian DDR yang masih DRAF (crew, jam, open hole, coring/run, barang, catatan) lalu tekan simpan; versi lama tetap tersimpan di server. DDR yang sudah ditandatangani harus dibuka verifier/admin (🔓 Buka TTD) sebelum diedit — TTD lama dihapus dan DDR perlu ditandatangani ulang.</p>`;
    $("#lst").querySelectorAll("[data-ef]").forEach((b) => (b.onclick = () => editDDR(b.dataset.ef)));
    $("#keRekap")?.addEventListener("click", () => { const st = JSON.parse(sessionStorage.getItem("dbst") || "{}"); sessionStorage.setItem("dbst", JSON.stringify({ ...st, ds: "rekapddr", page: 0 })); tab = "db"; localStorage.setItem("tab", "db"); render(); });
    $("#ttdMassal")?.addEventListener("click", () => lengkapiTtdDriller(kurangDrl, () => render()));
    $("#lst").querySelectorAll("[data-bt]").forEach((b) => (b.onclick = async () => {
      const alasan = prompt("Alasan membuka tanda tangan DDR ini (wajib, tercatat di log):"); if (!alasan || alasan.trim().length < 5) return alert("Alasan wajib diisi (minimal 5 huruf).");
      if (!confirm("Semua tanda tangan DDR ini akan dicabut dan DDR kembali menjadi DRAF. Setelah diperbaiki, DDR perlu ditandatangani ulang. Lanjutkan?")) return;
      const { error } = await sb.rpc("admin_buka_ttd", { p_ddr: b.dataset.bt, p_alasan: alasan.trim() }); if (error) return alert("Gagal: " + error.message);
      toast("Tanda tangan dibuka — DDR kembali DRAF."); render(); }));
    $("#lst").querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.pr)));
    $("#lst").querySelectorAll("[data-ed]").forEach((b) => (b.onclick = () => editRunDDR(b.dataset.ed)));
    $("#lst").querySelectorAll("[data-sg]").forEach((b) => (b.onclick = async () => {
      const { data: sg } = await sb.from("ddr_signature").select("slot").eq("ddr_id", b.dataset.sg);
      const have = new Set((sg ?? []).map((x) => x.slot));
      for (const slot of ["DRILLER", "WELLSITE", "CLIENT"].filter((s) => !have.has(s))) {
        const s = await signDialog(slot, (data ?? []).find((d) => d.id === b.dataset.sg)?.driller_name ?? ""); if (!s) continue;
        const { error } = s.method === "CORET" ? await kirimTtdCoret(b.dataset.sg, s) : await sb.rpc("sign_ddr", { p_ddr: b.dataset.sg, p_slot: slot, p_signer: s.signer_id, p_method: s.method, p_proof: s.proof, p_signed_at: s.signed_at });
        if (error) alert(`${SLOT_LABEL[slot]}: ${error.message}`);
      }
      render();
    }));
  }
}
// ---------- Edit data run (coring) DDR yang sudah terkirim — tercatat di ddr_edit_log dengan alasan ----------
async function editRunDDR(id) {
  if (!online()) return alert("Perlu sinyal untuk mengubah DDR yang sudah terkirim.");
  const [{ data: d, error }, { data: lg }] = await Promise.all([sb.from("ddr").select("id,rig,report_date,shift,bhid,status,coring").eq("id", id).single(),
    sb.from("ddr_edit_log").select("reason,editor_name,edited_at,status_saat_edit,old_value,new_value").eq("ddr_id", id).order("edited_at", { ascending: false })]);
  if (error) return alert(error.message);
  const n2 = (x) => (x == null || x === "" ? "" : String(x).replace(".", ","));
  const baris = (o = {}) => `<div class="row" data-run style="align-items:center;margin-top:4px"><input placeholder="From" inputmode="decimal" value="${esc(n2(o.from))}"><input placeholder="To" inputmode="decimal" value="${esc(n2(o.to))}">
    <input placeholder="Core" inputmode="decimal" value="${esc(n2(o.core))}"><input placeholder="Remark" value="${esc(o.remark ?? "")}"><input placeholder="Hole ID (bila beda)" list="dlBH" value="${esc(o.bhid ?? "")}" style="max-width:130px"><button class="sec" data-x style="flex:0">✕</button></div>`;
  const m = modal(`<h3 style="margin-top:0">✏️ Edit data run DDR</h3>
    <p class="muted" style="margin-top:0">${esc(d.report_date)} · ${d.shift === "PAGI" ? "Day" : "Night"} · <b>${esc(d.rig)}</b> ${esc(d.bhid ?? "")} · ${d.status === "SIGNED" ? "LENGKAP (sudah ditandatangani)" : "DRAF"}</p>
    ${d.status === "SIGNED" ? `<p style="background:#FFF4D6;padding:8px 10px;border-radius:8px;font-size:13px">DDR ini sudah ditandatangani. Perubahan tetap disimpan, tetapi <b>dicatat</b> (siapa, kapan, alasan, nilai lama → baru) dan tampil di cetakan DDR.</p>` : ""}
    <div class="row muted" style="font-size:12px"><span>From (m)</span><span>To (m)</span><span>Core (m)</span><span>Remark</span><span style="flex:0;min-width:40px"></span></div>
    <div id="erL">${(d.coring ?? []).map(baris).join("")}</div>
    <div class="row"><button class="sec" id="erAdd" style="flex:0;white-space:nowrap">+ baris run</button><button class="sec" id="erFoto" style="flex:0;white-space:nowrap">Ganti dari foto RUN</button></div>
    <p class="muted" id="erSum"></p>
    <label>Alasan perubahan *</label><input id="erR" placeholder="mis. salah ketik TO run ke-3, disesuaikan dengan patok">
    <div class="row" style="margin-top:10px"><button id="erOk">Simpan perubahan</button><button class="sec" id="erX">Batal</button></div><div id="erE" class="err"></div>
    ${(lg ?? []).length ? `<h3>Riwayat perubahan run (${lg.length})</h3><ul class="list">${lg.map((l) => `<li><span>${fmtT(l.edited_at)} · <b>${esc(l.editor_name ?? "")}</b>${l.status_saat_edit === "SIGNED" ? " · setelah TTD" : ""}<br>${esc(l.reason)}<br><span class="muted">${(l.old_value ?? []).length} → ${(l.new_value ?? []).length} baris</span></span></li>`).join("")}</ul>` : ""}`);
  const q = (x) => m.querySelector(x), num = (x) => (String(x ?? "").trim() === "" ? null : Number(String(x).replace(",", ".")));
  const ambil = () => [...m.querySelectorAll("[data-run]")].map((r) => [...r.querySelectorAll("input")].map((x) => x.value.trim())).filter((x) => x[0] || x[1] || x[2])
    .map(([f, t, c, rm, b]) => { const bh = b ? bakuBH(b) : ""; return { from: num(f), to: num(t), core: num(c), remark: rm || null, ...(bh && bh !== d.bhid ? { bhid: bh } : {}) }; }); // Hole ID per baris (DDR dua lubang) tidak hilang
  const hitung = () => { const L = ambil(), I = L.reduce((s, x) => s + (x.to > x.from ? x.to - x.from : 0), 0), C = L.reduce((s, x) => s + (Number(x.core) || 0), 0);
    q("#erSum").textContent = `${L.length} run · interval ${I.toFixed(2)} m · core ${C.toFixed(2)} m · recovery ${I ? ((100 * Math.min(C, I)) / I).toFixed(1) : "-"}%`; };
  const pasang = () => { m.querySelectorAll("[data-run]").forEach((r) => { r.querySelector("[data-x]").onclick = () => { r.remove(); hitung(); }; r.querySelectorAll("input").forEach((x) => (x.oninput = hitung)); }); hitung(); };
  q("#erAdd").onclick = () => { const L = ambil(); q("#erL").insertAdjacentHTML("beforeend", baris({ from: L.length ? L[L.length - 1].to : "" })); pasang(); };
  q("#erFoto").onclick = async () => {
    const [a, b] = shiftWindow(d.report_date, d.shift);
    const { data: ev } = await sb.from("v_drill_event_qc").select("depth_from,depth_to,core_length").eq("rig", d.rig).eq("event_type", "RUN").gte("captured_at", a).lt("captured_at", b);
    const E = [...new Map((ev ?? []).map((e) => [`${e.depth_from}|${e.depth_to}`, e])).values()].sort((x, y) => x.depth_from - y.depth_from);
    if (!E.length) return (q("#erE").textContent = "Belum ada foto RUN untuk rig dan shift ini.");
    if (!confirm(`Ganti ${ambil().length} baris run dengan ${E.length} run dari foto RUN?`)) return;
    q("#erL").innerHTML = E.map((e) => baris({ from: e.depth_from, to: e.depth_to, core: e.core_length })).join(""); pasang(); };
  q("#erX").onclick = () => m.remove();
  q("#erOk").onclick = async () => {
    const L = ambil(), E = (t) => (q("#erE").textContent = t);
    const salah = L.findIndex((x) => !(x.to > x.from)); if (salah >= 0) return E(`Baris ${salah + 1}: To harus lebih besar dari From.`);
    { const ce = cekCoreRun(L); if (ce !== null) return E(ce); }
    for (let i = 1; i < L.length; i++) if ((L[i].bhid ?? "") === (L[i - 1].bhid ?? "") && Math.abs(L[i].from - L[i - 1].to) > 0.02 && !confirm(`Run ${i + 1} (From ${n2(L[i].from)}) tidak menyambung dengan To run ${i} (${n2(L[i - 1].to)}). Tetap simpan?`)) return;
    if (!q("#erR").value.trim()) { q("#erR").focus(); return E("Tulis alasan perubahan."); }
    q("#erOk").disabled = true;
    const { data: r, error: er } = await sb.rpc("edit_ddr_coring", { p_ddr: id, p_coring: L, p_reason: q("#erR").value.trim() });
    q("#erOk").disabled = false;
    if (er) return E(er.message);
    m.remove(); toast(r?.changed ? "✓ Data run DDR diperbarui" : "Tidak ada perubahan"); render();
  };
  pasang();
}
async function ddrSummary(rig, date, shift) {
  const [a, b] = shiftWindow(date, shift);
  const { data: ev } = await sb.from("v_drill_event_qc").select("event_type,bhid,depth_from,depth_to,run_m,core_length,durasi_ke_berikutnya_min,captured_at,flags").eq("rig", rig).gte("captured_at", a).lt("captured_at", b).order("captured_at");
  const E = ev ?? [], runs = E.filter((e) => e.event_type === "RUN"), sum = (xs, k) => xs.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const m = sum(runs, "run_m"), c = sum(runs, "core_length");
  return { meter_bor: +m.toFixed(2), jumlah_run: runs.length, core_m: +c.toFixed(2), recovery_pct: m ? +(100 * Math.min(c, m) / m).toFixed(1) : null,
    kedalaman_akhir: runs.length ? Math.max(...runs.map((r) => Number(r.depth_to))) : null, bhid: [...new Set(E.map((e) => e.bhid).filter(Boolean))].join(", "),
    standby_menit: sum(E.filter((e) => ["STANDBY", "PERBAIKAN"].includes(e.event_type)), "durasi_ke_berikutnya_min"),
    ganti_mata_bor: E.filter((e) => e.event_type === "GANTI_MATA_BOR").length, jumlah_foto: E.length, kejadian_bermasalah: E.filter((e) => e.flags).length,
    mulai: E.find((e) => e.event_type === "MULAI_BOR")?.captured_at ?? null, selesai: [...E].reverse().find((e) => e.event_type === "SELESAI_BOR")?.captured_at ?? null };
}
async function syncDDR(it) {
  const ins = await sb.from("ddr").upsert({ ...it.row, client_uuid: it.client_uuid }, { onConflict: "client_uuid", ignoreDuplicates: true });
  if (ins.error) { it.error = /ddr_rig_report_date_shift_key/.test(ins.error.message) ? "DDR rig/tanggal/shift ini sudah ada di server" : ins.error.message; await qPut(it); return; }
  const { data: d } = await sb.from("ddr").select("id,status").eq("client_uuid", it.client_uuid).single();
  if (d?.status === "DRAFT") await sb.from("ddr").update({ summary: await ddrSummary(it.row.rig, it.row.report_date, it.row.shift) }).eq("id", d.id);
  const errs = [];
  for (const s of it.signs ?? []) {
    const { error } = s.method === "CORET" ? await kirimTtdCoret(d.id, s) : await sb.rpc("sign_ddr", { p_ddr: d.id, p_slot: s.slot, p_signer: s.signer_id, p_method: s.method, p_proof: s.proof, p_signed_at: s.signed_at });
    if (error && !/sudah ditandatangani|sudah lengkap/.test(error.message)) errs.push(`${s.slot} (${s.name}): ${error.message}`);
  }
  await qDel(it.client_uuid);
  if (errs.length) alert(`DDR ${it.row.rig} ${it.row.report_date} ${it.row.shift} terkirim, tetapi tanda tangan gagal:\n${errs.join("\n")}\nUlangi dari daftar DDR → Tanda tangani.`);
}
// ---------- Penampil dokumen di dalam aplikasi (pengganti jendela pop-up yang tidak jalan di aplikasi terpasang) ----------
// Pakai: const w = jendelaDok("Judul", "A4"|"16:9"); lalu w.document.open()/write()/close() seperti jendela biasa.
// tempel dokumen HTML (laporan/slide) ke elemen, terisolasi dengan shadow DOM; slide 16:9 diskalakan ke lebar layar
function pasangDok(isi, host, buf, ukuran) {
  const doc = new DOMParser().parseFromString(buf, "text/html");
  const css = [...doc.querySelectorAll("style")].map((x) => x.textContent).join("\n").replace(/@page\s*\{[^}]*\}/g, "");
  doc.querySelectorAll(".bar0,.bar,script").forEach((x) => x.remove());
  isi.innerHTML = ""; host.style.cssText = ukuran === "16:9" ? "padding:4px 0" : ukuran === "A3L" ? "background:#fff;width:420mm;margin:0 auto" : "background:#fff;max-width:1000px;margin:0 auto"; host.dataset.dok = "1"; isi.appendChild(host);
  const sh = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  sh.innerHTML = `<style>:host{display:block}${css.replace(/\bbody\b/g, ".dok-body")}</style><div class="dok-body" style="margin:0;background:transparent">${doc.body.innerHTML}</div>`;
  if (ukuran === "16:9") { const skala = () => { if (isi.isConnected) host.style.zoom = Math.min(1, (isi.clientWidth - 6) / 1300); }; skala(); addEventListener("resize", skala); }
  if (ukuran === "A3L") { const skala = () => { if (isi.isConnected) host.style.zoom = Math.min(1, (isi.clientWidth - 6) / 1588); }; skala(); addEventListener("resize", skala); }
}
// wadah tulis yang menempel dokumen ke elemen halaman (dipakai Dashboard)
function wadahDi(el, ukuran) { let buf = ""; const host = document.createElement("div");
  return { document: { open() { buf = ""; }, write(h) { buf += h; }, close() { pasangDok(el, host, buf, ukuran); }, get body() { return { set innerHTML(h) { el.innerHTML = h; } }; } } }; }
function jendelaDok(judul, ukuran = "A4") {
  document.getElementById("dokLayer")?.remove(); document.getElementById("dokPrint")?.remove(); window._lapDL = null;
  const L = Object.assign(document.createElement("div"), { id: "dokLayer" });
  L.style.cssText = "position:fixed;inset:0;z-index:80;background:#3a4741;display:flex;flex-direction:column";
  L.innerHTML = `<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:#12251E;color:#fff;flex:0 0 auto">
    <b style="flex:1;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(judul)}</b>
    <button data-cetak style="flex:0 0 auto;width:auto;padding:8px 12px;background:#1E9E69">Simpan PDF</button><button data-xl style="flex:0 0 auto;width:auto;padding:8px 12px;display:none" class="sec">Excel</button><button data-tutup class="sec" style="flex:0 0 auto;width:auto;padding:8px 12px">✕ Tutup</button></div>
    <div data-isi style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch"><p style="color:#fff;font-family:Arial;padding:20px">Menyusun ${esc(judul.toLowerCase())}…</p></div>`;
  document.body.appendChild(L); document.body.style.overflow = "hidden";
  const pr = Object.assign(document.createElement("style"), { id: "dokPrint" });
  pr.textContent = `@media print{@page{size:${ukuran === "16:9" ? "338.67mm 190.5mm" : ukuran === "A3L" ? "420mm 297mm" : "A4"};margin:${ukuran === "16:9" || ukuran === "A3L" ? 0 : "10mm"}}body>*:not(#dokLayer){display:none!important}#dokLayer{position:static!important;background:#fff!important}#dokLayer>div:first-child{display:none!important}#dokLayer [data-isi]{overflow:visible!important}[data-dok]{zoom:1!important;padding:0!important}}`;
  document.head.appendChild(pr);
  const isi = L.querySelector("[data-isi]"), host = document.createElement("div"); let buf = "";
  const tutup = () => { L.remove(); pr.remove(); document.body.style.overflow = ""; };
  L.querySelector("[data-tutup]").onclick = tutup;
  L.querySelector("[data-cetak]").onclick = () => print();
  const tampil = () => { pasangDok(isi, host, buf, ukuran);
    if (window._lapDL) { const b = L.querySelector("[data-xl]"); b.style.display = ""; b.onclick = () => window._lapDL(); } };
  return { document: { open() { buf = ""; }, write(h) { buf += h; }, close() { tampil(); }, get body() { return { set innerHTML(h) { buf = `<html><body>${h}</body></html>`; tampil(); } }; } }, close: tutup };
}
async function printDDR(id) {
  const w = jendelaDok("DDR", "A4");
  const { data: d } = await sb.from("ddr").select("*").eq("id", id).single();
  const { data: sg } = await sb.from("ddr_signature").select("*").eq("ddr_id", id);
  const [a, b] = shiftWindow(d.report_date, d.shift);
  const { data: ev } = await sb.from("v_drill_event_qc").select("*").eq("rig", d.rig).gte("captured_at", a).lt("captured_at", b).order("captured_at");
  const ph = await signedUrls("progress-photos", (ev ?? []).map((e) => e.photo_path)), tt = await signedUrls("signatures", (sg ?? []).map((s) => s.signature_path));
  const S = d.summary ?? {}, T = (x) => (x ? fmtT(x) : "-"), f2 = (x) => (x == null ? "" : Number(x).toFixed(2));
  const sigBox = (k) => { const s = (sg ?? []).find((x) => x.slot === k); return `<td style="width:33%;vertical-align:top;height:120px"><b>${k === "WELLSITE" ? "WELL SITE" : k === "CLIENT" ? "CLIENT REPRESENTATIVE" : "DRILLER"}</b><br>${s ? `<img src="${tt[s.signature_path] ?? ""}" style="height:60px"><br>${esc(s.signer_name)}<br><small>${T(s.signed_at)} WIB · ${s.method === "CORET" ? (s.ttd_tersimpan ? "TTD tersimpan, dipilih wellsite" : "TTD langsung di HP wellsite") : s.method} · verifikasi server ${T(s.verified_at)}</small>` : "<br><br><i>belum ditandatangani</i>"}</td>`; };
  const cor = d.coring ?? [], oh = d.open_hole ?? [], hrs = d.hours ?? [];
  const { data: elog } = await sb.from("ddr_edit_log").select("reason,editor_name,edited_at,status_saat_edit").eq("ddr_id", id).order("edited_at");
  const sumI = (xs) => xs.reduce((s, x) => s + (x.to - x.from), 0), sumC = cor.reduce((s, x) => s + (Number(x.core) || 0), 0);
  const totMin = hrs.reduce((s, h) => s + (durMin(h.mulai, h.selesai) ?? 0), 0);
  const cons = (d.consumables ?? []).filter((c) => !(isClient() && BARANG_BBM.test(`${c.item} ${c.kategori}`))), cats = [...new Set(cons.map((c) => c.kategori))];
  w.document.open(); w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>DDR ${esc(d.rig)} ${esc(d.report_date)} ${d.shift === "PAGI" ? "Day" : "Night"}</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#111} h1{font-size:17px;margin:0} h3{margin:10px 0 2px;font-size:12px} table{border-collapse:collapse;width:100%;margin:4px 0} td,th{border:1px solid #888;padding:3px 5px;text-align:left} th{background:#e6efe9}
  .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px} .g img{width:100%;border:1px solid #ccc} .two{display:grid;grid-template-columns:1fr 1fr;gap:10px} @media print{button{display:none}}</style></head><body>
  <button onclick="print()">Cetak / simpan PDF</button>
  <h1>DAILY DRILLING REPORT</h1><div>CLIENT: <b>${esc(d.contractor ?? "")}</b> · status: <b>${d.status === "SIGNED" ? "LENGKAP DITANDATANGANI" : "DRAF"}</b></div>
  <table><tr><th>PROJECT</th><td>${esc(d.project ?? "")}</td><th>DATE</th><td>${esc(d.report_date)}</td><th>DRILLER</th><td>${esc(d.driller_name ?? "")}</td></tr>
  <tr><th>LOCATION</th><td>${esc(d.location ?? "")}</td><th>TIME</th><td>${d.shift === "PAGI" ? "Day" : "Night"}</td><th>ASSISTANT</th><td>${esc(d.helpers ?? "")}</td></tr>
  <tr><th>HOLE ID</th><td>${esc(d.bhid ?? "")}</td><th>RIG NO</th><td>${esc(d.rig)}</td><th>CREW</th><td>${d.crew_count ?? ""}</td></tr>
  <tr><th>RIG TYPE</th><td>${esc(d.rig_type ?? "")}</td><th>HM</th><td>${d.hm_start ?? ""} – ${d.hm_end ?? ""}</td><th>Cuaca</th><td>${esc(d.weather ?? "")}</td></tr></table>
  <h3>1. DRILLING</h3><div class="two"><table><tr><th colspan="3">OPEN HOLE (m)</th></tr><tr><th>From</th><th>To</th><th>Interval</th></tr>${oh.map((x) => `<tr><td>${f2(x.from)}</td><td>${f2(x.to)}</td><td>${f2(x.to - x.from)}</td></tr>`).join("")}<tr><th colspan="2">Total</th><th>${f2(sumI(oh))}</th></tr></table>
  <table><tr><th colspan="6">CORING (m) / CORE RESULT</th></tr><tr><th>From</th><th>To</th><th>Interval</th><th>Length</th><th>Recovery</th><th>REMARK</th></tr>${cor.map((x) => `<tr><td>${f2(x.from)}</td><td>${f2(x.to)}</td><td>${f2(x.to - x.from)}</td><td>${f2(x.core)}</td><td>${x.to > x.from ? Math.round((100 * x.core) / (x.to - x.from)) + "%" : ""}</td><td>${esc(x.remark ?? "")}</td></tr>`).join("")}
  <tr><th colspan="2">Total</th><th>${f2(sumI(cor))}</th><th>${f2(sumC)}</th><th>${sumI(cor) ? Math.round((100 * sumC) / sumI(cor)) + "%" : ""}</th><th></th></tr></table></div>
  ${(elog ?? []).length ? `<p style="color:#8a5a00"><b>Data coring/run diubah setelah DDR terkirim:</b> ${elog.map((l) => `${esc(T(l.edited_at))} oleh ${esc(l.editor_name ?? "-")}${l.status_saat_edit === "SIGNED" ? " (setelah ditandatangani)" : ""} — ${esc(l.reason)}`).join("; ")}</p>` : ""}
  <h3>2. HOURLY DISTRIBUTION</h3><table><tr><th>Kelompok</th><th>Kegiatan</th><th>TIME</th><th>DESCRIPTION</th><th>TOTAL (jam)</th></tr>${HOUR_CAT.map(([g, xs]) => xs.map((c) => { const r = hrs.filter((h) => h.kategori === c); const m = r.reduce((s, h) => s + (durMin(h.mulai, h.selesai) ?? 0), 0); return `<tr><td>${g}</td><td>${c}</td><td>${r.map((h) => `${h.mulai}–${h.selesai}`).join(", ")}</td><td>${esc(r.map((h) => h.ket).filter(Boolean).join("; "))}</td><td>${m ? (m / 60).toFixed(2) : ""}</td></tr>`; }).join("")).join("")}<tr><th colspan="4">TOTAL HOURS</th><th>${(totMin / 60).toFixed(2)}</th></tr></table>
  <h3>3. ACCESSORIES AND CONSUMABLES</h3><table><tr><th>Item</th><th>QTY</th><th>UNIT</th><th>Catatan</th></tr>${cats.map((k) => `<tr><th colspan="4">${esc(k)}</th></tr>` + cons.filter((c) => c.kategori === k).map((c) => `<tr><td>${esc(c.item)}</td><td>${c.qty}</td><td>${esc(c.unit)}</td><td>${esc(c.note ?? "")}</td></tr>`).join("")).join("")}</table>
  ${d.redrill ? `<p><b>REDRILL</b> dari lubang asal <b>${esc(d.lubang_asal ?? "-")}</b></p>` : ""}<table><tr><th>${esc(d.hole_type ?? "")}</th><th>ROD</th><td>${d.rod_m ?? ""} m</td><th>TARGET</th><td>${d.target_m ?? ""} m</td><th>TOTAL DEPTH</th><td>${d.total_depth_m ?? ""} m</td><th>TOTAL HOURS</th><td>${(totMin / 60).toFixed(2)} hours</td></tr></table>
  <h3>4. COMMENTS</h3><p>${esc(d.notes ?? "-")}</p>
  <h3>5. SIGNATURE</h3><table><tr>${sigBox("DRILLER")}${sigBox("WELLSITE")}${sigBox("CLIENT")}</tr></table>
  <h3>Lampiran: foto aktivitas bergeotag</h3><table><tr><th>Jam</th><th>Kegiatan</th><th>Kedalaman</th><th>Koordinat</th><th>Catatan cek</th></tr>${(ev ?? []).map((e) => `<tr><td>${T(e.captured_at).slice(-8)}</td><td>${esc(EV[e.event_type])}${e.reason ? " · " + esc(e.reason) : ""}</td><td>${e.event_type === "RUN" ? `${e.depth_from}–${e.depth_to} (core ${e.core_length})` : ""}</td><td>${e.lat ? `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)} ±${e.gps_accuracy_m}m` : "-"}</td><td>${esc(e.flags ?? "")}</td></tr>`).join("")}</table>
  <div class="g">${(ev ?? []).filter((e) => e.photo_path).map((e) => `<div><img src="${ph[e.photo_path] ?? ""}"><br><small>${T(e.captured_at).slice(-8)} · ${esc(EV[e.event_type])}</small></div>`).join("")}</div>
  <small>Dokumen elektronik database TGEP · ID ${d.id} · dibuat ${T(d.created_at)} WIB.</small></body></html>`);
  w.document.close();
}

// ---------- Dashboard ----------
// Logo perusahaan: pakai file logo-terra.png bila sudah ada di aplikasi; bila belum, wordmark sementara.
function logoPT(h = 40) {
  return `<span style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;height:${h}px;min-width:${h}px;border-radius:${h / 4}px;background:#fff;padding:3px 8px">
    <img src="logo-terra.png" alt="PT Terra Grapindo Eco Prima" style="height:${h - 8}px;display:block" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'TERRA',style:'font:800 ${Math.round(h / 2.6)}px Arial;letter-spacing:.08em;color:#12251E'}))"></span>`;
}
// Peta + panel grafik + 3D di halaman Dashboard (tetap tampil walau data bor belum ada)
async function petaDashboard(st, basi = () => false) {
  const box = $("#dPeta"), box3 = $("#d3D"); if (!box) return;
  if (online()) { const { data } = await sb.from("wilayah").select("nama,nomor_sk,titik").eq("aktif", true); if (data) localStorage.setItem("wilayah", JSON.stringify(data)); }
  const LB = online() ? ((await ambilLubangPeta()).data ?? []) : JSON.parse(localStorage.getItem("petaLubangDash") || "[]"); localStorage.setItem("petaLubangDash", JSON.stringify(LB));
  const bh = LB.map((x) => x.bhid), prof = online() && bh.length ? ((await sb.from("v_profil_bor").select("*").in("bhid", bh).order("bhid").order("dari_m")).data ?? []) : [];
  const { data: rd } = online() ? await sb.from("v_dash_rig_day").select("tanggal,rig,meter_bor,jam_kerja_bor").gte("tanggal", st.from).lte("tanggal", st.to).order("tanggal") : { data: [] };
  const days = rd ?? [], tg = [...new Set(days.map((d) => d.tanggal))].sort(); let cum = 0;
  const dayRows = tg.map((t) => { const m = days.filter((d) => d.tanggal === t).reduce((s, d) => s + (+d.meter_bor || 0), 0); cum += m; return [t, 0, +m.toFixed(1), +cum.toFixed(1)]; });
  await muatZona(); const A = await analisisData(LB, prof, days);
  const tgtM = LB.reduce((s, x) => s + (+x.rencana_kedalaman || 0), 0), selesai = LB.filter((x) => ["EOH", "STB", "SELESAI"].includes(x.status));
  const panel = [{ judul: "Status titik bor", svg: panelStatus(LB, cum, tgtM), h: 118 }, { judul: "Meter bor harian & kumulatif", svg: panelHarian(dayRows), h: 106 },
    { judul: "Sebaran kedalaman akhir lubang (m)", svg: panelHist(selesai.map((x) => +x.kedalaman), "#22c55e", "m"), h: 112 }, { judul: "Tebal rata-rata tiap layer", svg: panelLayer(A.zona), h: 116 }];
  if (basi()) return;
  box.classList.remove("muted"); box.innerHTML = `<div style="overflow-x:auto">${await petaSVG(LB, { w: 1200, h: 600, grafik: prof, gh: 74, panel })}</div>`;
  const info = $("#petaInfo"); if (info) info.textContent = `${LB.length} titik · ${selesai.length} selesai · ${LB.filter((x) => x.status === "PROGRES").length} progres`;
  if (box3) { box3.classList.remove("muted"); box3.innerHTML = await blok3D(LB, prof, { w: 1100, h: 520 }).catch((e) => `<p class="muted">Tampilan 3D belum bisa dibuat: ${esc(e.message)}</p>`); }
}
async function dashView(v) {
  const tok = (dashView.tok = (dashView.tok ?? 0) + 1), basi = () => tok !== dashView.tok || tab !== "dash";   // render lama dibatalkan bila ada render baru
  const to = todayWIB(), from = new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const st = JSON.parse(sessionStorage.getItem("dash") || "null") ?? { from, to, rig: "" };
  v.innerHTML = `<div class="card dashHead" style="display:flex;align-items:center;gap:14px;background:linear-gradient(120deg,#0d1f18,#12251E 60%,#1b4a37);color:#fff">${logoPT(46)}
    <div style="flex:1"><div style="font:700 11px Arial;letter-spacing:.16em;color:#7CE0B0">PT TERRA GRAPINDO ECO PRIMA</div><div style="font:800 21px Arial">Dashboard eksplorasi nikel laterit</div><div style="font-size:12px;opacity:.75">X-Terra · data dari lapangan, terverifikasi</div></div></div>
    <div class="card"><h2>Dashboard progres & evaluasi</h2>
    <style>.dfil>div{flex:1 1 140px;min-width:140px}.dfil>div select,.dfil>div input{width:100%}@media(max-width:520px){.dfil>button{flex:1 1 45%!important}}</style><div class="row dfil" style="flex-wrap:wrap;align-items:flex-end"><div><label>Dari</label><input id="f" type="date" value="${st.from}"></div><div><label>Sampai</label><input id="t" type="date" value="${st.to}"></div>
    ${proyekSelect()}<div><label>Rig</label><input id="r" value="${esc(st.rig)}" placeholder="semua"></div><div><label>Topografi 3D</label><select id="topo3d">${[["redup", "Redup (bor menonjol)"], ["sedang", "Sedang"], ["asli", "Asli (tajam)"]].map(([k, l]) => `<option value="${k}" ${(localStorage.getItem("topo3d") || "redup") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><button id="go" style="flex:0">Tampilkan</button><button class="sec" id="dx" style="flex:0;white-space:nowrap">Unduh Excel</button><button id="lap" style="flex:0;white-space:nowrap">Laporan PDF (peta + profil)</button><button id="pres" style="flex:0;white-space:nowrap;background:#12251E">🎞 Presentasi 16:9</button>${isClient() ? "" : `<button id="waPr" style="flex:0;white-space:nowrap;background:#1FA855">💬 WA progres ke client</button>`}</div></div>
    <div id="dSlide" style="background:#3a4741;border-radius:14px;padding:6px 3px;margin-bottom:12px"><p style="color:#fff;font-family:Arial;padding:16px;margin:0">Menyusun tampilan presentasi…</p></div>
    <details class="card" id="rinci" open><summary style="font-weight:700;cursor:pointer">Indikator & grafik dashboard</summary><div id="kpi" style="margin-top:8px"></div>
    <div id="ch" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-top:10px"></div></details>`;
  if (online()) laporanProgres({ from: st.from, to: st.to, rig: st.rig, proj: sessionStorage.getItem("filterProyek") || "", slide: true, wadah: wadahDi($("#dSlide"), "16:9") }).catch((e) => { if ($("#dSlide")) $("#dSlide").innerHTML = `<p style="color:#fff;padding:16px">Tampilan presentasi gagal: ${esc(e.message)}</p>`; });
  $("#topo3d").onchange = (e) => { localStorage.setItem("topo3d", e.target.value); $("#go").onclick(); };
  $("#lap").onclick = () => laporanProgres({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase(), proj: $("#fproj").value });
  if ($("#waPr")) $("#waPr").onclick = () => waProgresClient({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase(), proj: $("#fproj").value });
  $("#pres").onclick = () => laporanProgres({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase(), proj: $("#fproj").value, slide: true });
  $("#go").onclick = () => { sessionStorage.setItem("filterProyek", $("#fproj").value); sessionStorage.setItem("dash", JSON.stringify({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase() })); dashView(v); };
  if (!online()) { $("#dSlide").innerHTML = `<p style="color:#fff;padding:16px;margin:0">Dashboard perlu sinyal internet.</p>`; return; }
  if (!isClient()) peringatanMarking(v.querySelector(".dashHead")?.nextElementSibling ?? null, null).catch(() => {});
  const pf = await proyekFilter();
  const R = (q) => (st.rig ? q.eq("rig", st.rig) : pf ? q.in("rig", pf.rigs.length ? pf.rigs : ["-"]) : q);
  const [{ data: rd }, { data: tm }, { data: cu }, { data: hl }] = await Promise.all([
    R(sb.from("v_dash_rig_day").select("*").gte("tanggal", st.from).lte("tanggal", st.to)).order("tanggal"),
    R(sb.from("v_dash_time").select("*").gte("tanggal", st.from).lte("tanggal", st.to)),
    R(sb.from("v_consumable_use").select("*").gte("report_date", st.from).lte("report_date", st.to)),
    sb.from("v_dash_hole").select("*"),
  ]);
  // Redrill (v.15): statistik per lubang memakai lubang AKTIF (lubang lama yang sudah di-redrill tidak dihitung); meter redrill & meter lubang lama ditampilkan terpisah
  const RDR = await petaRedrill().catch(() => ({}));
  const { data: VB } = await sb.from("v_ddr_baris").select("bhid,meter,tanggal,rig").gte("tanggal", st.from).lte("tanggal", st.to).limit(5000);
  if (basi()) return;
  const days = rd ?? [], holes = (hl ?? []).filter((h) => h.jumlah_conto > 0 && !RDR[h.bhid] && (!pf || pf.bhids.includes(h.bhid))), K = computeKPI(days, tm ?? [], cu ?? [], holes).filter(([l]) => !isClient() || (l !== "Foto core lengkap" && !/BBM|Oli/i.test(l) && (clientGeo() || !GEO_KPI.includes(l))));
  { const vb = (VB ?? []).filter((x) => (!st.rig || String(x.rig ?? "").toUpperCase() === st.rig.toUpperCase()) && (!pf || pf.bhids.includes(x.bhid)));
    const mR = vb.filter((x) => asalRedrill(x.bhid)), mL = vb.filter((x) => RDR[x.bhid]), sm = (xs) => xs.reduce((a, x) => a + (+x.meter || 0), 0);
    if (mR.length || mL.length) K.push(["Meter redrill", `${sm(mR).toFixed(1)} m · ${new Set(mR.map((x) => x.bhid)).size} lubang`],
      ["Meter lubang lama (diganti redrill)", `${sm(mL).toFixed(1)} m · ${[...new Set(mL.map((x) => x.bhid))].join(", ")}`, sm(mL) > 0 ? "!" : ""]); }
  $("#dx").onclick = async () => { try { const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new(), sh = (rows, nm) => X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), nm);
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["DASHBOARD TGEP", `${st.from} s/d ${st.to}`, st.rig || "semua rig"], [], ["Indikator", "Nilai"], ...K.map(([a, b]) => [a, b])]), "KPI");
    sh(tanpaBBM(days), "Kinerja rig harian"); sh(tm ?? [], "Pembagian waktu"); sh(isClient() ? (cu ?? []).filter((c) => !BARANG_BBM.test(`${c.item} ${c.kategori}`)) : cu ?? [], "Pemakaian barang"); if (!isClient() || clientGeo()) sh(holes, "Ringkasan lubang");
    X.writeFile(wb, `TGEP_Dashboard_${st.from}_${st.to}.xlsx`); } catch (e) { alert(e.message); } };
  $("#kpi").innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">${K.map(([l, val, note]) => `<div style="background:#fff;border-radius:10px;padding:10px;border-left:5px solid ${note === "!" ? "#C8281F" : "#1E9E69"}"><div class="muted" style="font-size:12px">${esc(l)}</div><div style="font-size:22px;font-weight:700">${esc(val)}</div></div>`).join("")}</div>
    <p class="muted" style="margin-top:8px">Periode ${st.from} s/d ${st.to}${st.rig ? " · rig " + esc(st.rig) : " · semua rig"}. ${isClient() ? `Akun client: data rig proyek Anda${clientGeo() ? " termasuk data geologi yang sudah disetujui" : " (meter, jam, standby, P2H, DDR)"}.` : "Data geologi (tebal zona, conto) mencakup semua lubang yang sudah disetujui."}</p>`;
  const klien = isClient() && !clientGeo();
  const { data: kp } = isClient() ? { data: [] } : await sb.from("v_kepatuhan_harian").select("nama,rig,status,kurang,antrean").eq("tanggal", st.to);
  if (basi()) return;
  if (kp?.length) { const c = document.createElement("div"); c.className = "card"; const bel = kp.filter((r) => ["BELUM", "SEBAGIAN"].includes(r.status)), hp = kp.filter((r) => r.antrean > 0);
    c.innerHTML = `<h3 style="margin:0 0 6px">Pengiriman operator ${st.to}</h3><p>Lengkap <b>${kp.filter((r) => r.status === "LENGKAP").length}</b> · sebagian <b>${kp.filter((r) => r.status === "SEBAGIAN").length}</b> · belum <b>${kp.filter((r) => r.status === "BELUM").length}</b> · data tertahan di HP <b>${hp.length}</b> orang</p>${bel.length ? `<p class="err">${bel.map((r) => `${esc(r.nama)} (${esc(r.rig ?? "-")}): ${esc((r.kurang ?? []).join(", "))}`).join(" · ")}</p>` : ""}<button class="sec" id="toRek" style="width:auto">Buka Rekap operator</button>`;
    $("#kpi").after(c); c.querySelector("#toRek").onclick = () => { tab = "rekap"; localStorage.setItem("tab", tab); render(); }; }
  const { Chart } = await import("./vendor/chart.js");
  if (basi()) return;
  const box = (id, title) => { const d = document.createElement("div"); d.className = "card"; d.innerHTML = `<h3 style="margin:0 0 6px">${title}</h3><canvas id="${id}" height="230"></canvas>`; $("#ch").appendChild(d); return d.querySelector("canvas"); };
  const pal = ["#1E9E69", "#E8892B", "#2F6FB0", "#C8281F", "#8E5BB5", "#7A8B83", "#D4B12A", "#12251E", "#57B8C9", "#B5651D"];
  const by = (xs, kf, vf) => xs.reduce((m, x) => ((m[kf(x)] = (m[kf(x)] ?? 0) + (Number(vf(x)) || 0)), m), {});
  const hist = (vals, edges) => edges.slice(0, -1).map((e, i) => vals.filter((x) => x >= e && (i === edges.length - 2 ? x <= edges[i + 1] : x < edges[i + 1])).length);
  const rigs = [...new Set(days.map((d) => d.rig))], dates = [...new Set(days.map((d) => d.tanggal))];
  let cum = 0; const cumv = dates.map((t) => (cum += days.filter((d) => d.tanggal === t).reduce((s, d) => s + Number(d.meter_bor), 0)));
  new Chart(box("c1", "Meter bor per hari (per rig) & kumulatif"), { type: "bar", data: { labels: dates, datasets: [...rigs.map((r, i) => ({ type: "bar", label: r, stack: "m", data: dates.map((t) => days.filter((d) => d.tanggal === t && d.rig === r).reduce((s, d) => s + Number(d.meter_bor), 0)), backgroundColor: pal[i % 10] })),
    { type: "line", label: "Kumulatif", data: cumv, yAxisID: "y2", borderColor: "#12251E", pointRadius: 0 }] }, options: { scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "m/hari" } }, y2: { type: "linear", position: "right", beginAtZero: true, stacked: false, grid: { display: false }, title: { display: true, text: "kumulatif m" } } } } });
  const mr = by(days, (d) => d.rig, (d) => d.meter_bor), jr = by(days, (d) => d.rig, (d) => d.jam_kerja_bor);
  new Chart(box("c2", "Meter per rig & produktivitas (m/jam)"), { type: "bar", data: { labels: Object.keys(mr), datasets: [{ type: "bar", label: "Meter", yAxisID: "y", data: Object.values(mr), backgroundColor: "#1E9E69" }, { type: "line", label: "m/jam", data: Object.keys(mr).map((r) => (jr[r] ? +(mr[r] / jr[r]).toFixed(2) : null)), yAxisID: "y2", borderColor: "#E8892B" }] }, options: { scales: { y: { type: "linear", position: "left", beginAtZero: true }, y2: { type: "linear", position: "right", beginAtZero: true, grid: { display: false } } } } });
  const tk = by(tm ?? [], (x) => x.kegiatan, (x) => x.menit);
  new Chart(box("c3", "Pembagian waktu kerja (menit)"), { type: "pie", data: { labels: Object.keys(tk), datasets: [{ data: Object.values(tk), backgroundColor: pal }] } });
  const sb2 = by((tm ?? []).filter((x) => ["Standby", "Perbaikan"].includes(x.kegiatan)), (x) => `${x.kegiatan}: ${x.alasan}`, (x) => x.menit);
  new Chart(box("c4", "Penyebab standby & perbaikan (menit)"), { type: "pie", data: { labels: Object.keys(sb2).length ? Object.keys(sb2) : ["(tidak ada)"], datasets: [{ data: Object.keys(sb2).length ? Object.values(sb2) : [1], backgroundColor: pal }] } });
  if (!isClient()) {
  const br = by(days, (d) => d.rig, (d) => d.bbm_liter);
  new Chart(box("c5", "BBM per rig: total (L) & per meter (L/m)"), { type: "bar", data: { labels: Object.keys(br), datasets: [{ type: "bar", label: "BBM (L)", yAxisID: "y", data: Object.values(br), backgroundColor: "#2F6FB0" }, { type: "line", label: "L/m", data: Object.keys(br).map((r) => (mr[r] ? +(br[r] / mr[r]).toFixed(2) : null)), yAxisID: "y2", borderColor: "#C8281F" }] }, options: { scales: { y: { type: "linear", position: "left", beginAtZero: true }, y2: { type: "linear", position: "right", beginAtZero: true, grid: { display: false } } } } });
  }
  const lq = by((cu ?? []).filter((c) => c.unit === "liter" && !(isClient() && BARANG_BBM.test(`${c.item} ${c.kategori}`))), (c) => c.item, (c) => c.qty);
  new Chart(box("c6", "Pemakaian cairan (liter) per jenis"), { type: "pie", data: { labels: Object.keys(lq).length ? Object.keys(lq) : ["(belum ada DDR)"], datasets: [{ data: Object.keys(lq).length ? Object.values(lq) : [1], backgroundColor: pal }] } });
  const { data: dh } = await R(sb.from("v_ddr_hours").select("kategori,kelompok,menit").gte("tanggal", st.from).lte("tanggal", st.to));
  const hk = by(dh ?? [], (x) => x.kategori, (x) => x.menit), hg = by(dh ?? [], (x) => x.kelompok, (x) => x.menit);
  new Chart(box("c11", "Distribusi jam DDR per kegiatan (jam)"), { type: "bar", data: { labels: Object.keys(hk).length ? Object.keys(hk) : ["(belum ada DDR)"], datasets: [{ label: "jam", data: Object.values(hk).map((m) => +(m / 60).toFixed(2)), backgroundColor: "#2F6FB0" }] }, options: { indexAxis: "y" } });
  new Chart(box("c12", "Drilling / Working / Standby (DDR)"), { type: "pie", data: { labels: Object.keys(hg).length ? Object.keys(hg) : ["(belum ada DDR)"], datasets: [{ data: Object.keys(hg).length ? Object.values(hg) : [1], backgroundColor: ["#1E9E69", "#E8892B", "#C8281F"] }] } });
  if (klien) { pasangKlikGrafik(Chart); return; }
  const ed = [0, 2, 4, 6, 8, 10, 12, 15, 20, 30], lab = ed.slice(0, -1).map((e, i) => `${e}–${ed[i + 1]} m`);
  new Chart(box("c7", "Histogram tebal zona per lubang"), { type: "bar", data: { labels: lab, datasets: [{ label: "Limonit", data: hist(holes.map((h) => Number(h.tebal_limonit)), ed), backgroundColor: "#E8892B" }, { label: "Saprolit", data: hist(holes.map((h) => Number(h.tebal_saprolit)), ed), backgroundColor: "#1E9E69" }] }, options: { scales: { y: { title: { display: true, text: "jumlah lubang" } } } } });
  const nl = holes.reduce((s, h) => s + h.conto_limonit, 0), ns = holes.reduce((s, h) => s + h.conto_saprolit, 0), nt = holes.reduce((s, h) => s + h.jumlah_conto, 0);
  new Chart(box("c8", "Jumlah conto per zona"), { type: "pie", data: { labels: ["Limonit", "Saprolit", "TP / batuan dasar"], datasets: [{ data: [nl, ns, nt - nl - ns], backgroundColor: ["#E8892B", "#1E9E69", "#7A8B83"] }] } });
  const re = [0, 50, 70, 80, 90, 95, 100.01];
  new Chart(box("c9", "Histogram recovery per lubang (%)"), { type: "bar", data: { labels: ["<50", "50–70", "70–80", "80–90", "90–95", "95–100"], datasets: [{ label: "lubang", data: hist(holes.map((h) => Number(h.recovery_pct)).filter(isFinite), re), backgroundColor: ["#C8281F", "#C8281F", "#E8892B", "#D4B12A", "#1E9E69", "#1E9E69"] }] } });
  const avg = (k) => { const xs = holes.map((h) => Number(h[k])).filter((x) => isFinite(x) && x > 0); return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null; };
  new Chart(box("c10", "Rata-rata density kering per zona (t/m³)"), { type: "bar", data: { labels: ["Limonit", "Saprolit"], datasets: [{ label: "dry density", data: [avg("dry_density_limonit"), avg("dry_density_saprolit")], backgroundColor: ["#E8892B", "#1E9E69"] }] } });
  await statistikConto(Chart, box, pf?.bhids ?? null); if (basi()) return;
  pasangKlikGrafik(Chart);
  pasangMenuEdit(document.getElementById("rinci"), Chart); // klik kanan / tekan lama → Lihat/Edit DDR
}
// Akun client tidak melihat konsumsi BBM/oli (data biaya internal kontraktor): kolom dibuang dari semua tampilan & unduhan client
const KOLOM_BBM = /(^|_)(bbm|oli)(_|$)|bbm_per_meter/i;
const tanpaBBM = (rows) => (isClient() ? (rows ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !KOLOM_BBM.test(k)))) : rows);
const BARANG_BBM = /bbm|solar|bensin|pertalite|pertamax|dexlite|oli|pelumas|grease|hydraulic|hidrolik|fuel|minyak/i;
const isClient = () => me?.role === "client", clientGeo = () => isClient() && !!myTugas?.akses_geologi;
const CLIENT_RIG_DS = ["kinerja", "progres", "ddr", "jam", "p2h", "aktivitas"], CLIENT_GEO_DS = ["collar", "survey", "geology", "density", "assay", "qaqc", "lubang", "profil"];
const dsAllowed = () => isClient() ? [...CLIENT_RIG_DS, ...(clientGeo() ? CLIENT_GEO_DS : [])] : null;
const GEO_KPI = ["Lubang berdata", "Jumlah conto", "Rata tebal limonit", "Rata tebal saprolit", "Conto bermasalah (QC)", "Foto core lengkap"];
function computeKPI(days, tm, cu, holes) {
  const s = (xs, k) => xs.reduce((a, x) => a + (Number(x[k]) || 0), 0), pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "-");
  const m = s(days, "meter_bor"), jam = s(days, "jam_kerja_bor"), bbm = s(days, "bbm_liter"), activeDays = days.filter((d) => Number(d.meter_bor) > 0);
  const tAll = s(tm, "menit"), tStb = s(tm.filter((x) => ["Standby", "Perbaikan"].includes(x.kegiatan)), "menit");
  const p2hOk = activeDays.filter((d) => d.ada_p2h && !d.p2h_bermasalah).length, ddrOk = activeDays.filter((d) => d.n_ddr_ttd > 0).length;
  const nC = s(holes, "jumlah_conto"), nBad = s(holes, "conto_bermasalah"), nFoto = s(holes, "conto_foto_lengkap");
  const avgT = (k) => (holes.length ? (s(holes, k) / holes.length).toFixed(1) + " m" : "-");
  return [
    ["Total meter bor", m.toFixed(1) + " m"], ["Hari-rig aktif", String(activeDays.length)], ["Meter per hari-rig", activeDays.length ? (m / activeDays.length).toFixed(1) + " m" : "-"],
    ["Produktivitas", jam ? (m / jam).toFixed(2) + " m/jam" : "-"], ["Standby + perbaikan", pct(tStb, tAll), tAll && tStb / tAll > 0.25 ? "!" : ""],
    ["BBM total", bbm.toFixed(0) + " L"], ["BBM per meter", m ? (bbm / m).toFixed(2) + " L/m" : "-"], ["Oli total", s(days, "oli_liter").toFixed(1) + " L"],
    ["Lubang berdata", String(holes.length)], ["Jumlah conto", String(nC)], ["Rata tebal limonit", avgT("tebal_limonit")], ["Rata tebal saprolit", avgT("tebal_saprolit")],
    ["Kepatuhan P2H", pct(p2hOk, activeDays.length), activeDays.length && p2hOk < activeDays.length ? "!" : ""], ["DDR bertanda tangan", pct(ddrOk, activeDays.length), activeDays.length && ddrOk < activeDays.length ? "!" : ""],
    ["Conto bermasalah (QC)", pct(nBad, nC), nBad ? "!" : ""], ["Foto core lengkap", pct(nFoto, nC), nC && nFoto < nC ? "!" : ""],
  ];
}

// ---------- Laporan progres (ringkasan periode; cetak/PDF + Excel) ----------
// ---------- Titik bor untuk peta (semua peran, termasuk client) ----------
async function ambilLubangPeta() {
  const r = await sb.rpc("peta_lubang"); if (!r.error) return r;
  return sb.from("v_peta_lubang").select("*");
}
// ---------- Warna zona + konfirmasi zona baru ----------
let ZONA = JSON.parse(localStorage.getItem("zonaWarna") || "[]");
// ---------- Dashboard: tabel data di balik grafik (ketuk grafik) & statistik conto per layer ----------
function tabelModal(judul, kolom, baris, sorot = -1, catatan = "") {
  const m = modal(`<h3 style="margin-top:0">${esc(judul)}</h3>${catatan ? `<p class="muted">${catatan}</p>` : ""}
    <div class="tw" style="max-height:60vh;overflow:auto"><table><tr>${kolom.map((k) => `<th>${esc(k)}</th>`).join("")}</tr>
    ${baris.map((r, i) => `<tr${i === sorot ? ' style="background:#FFF1C2;font-weight:700"' : ""}>${r.map((x) => `<td>${esc(x == null ? "" : typeof x === "number" ? (+x.toFixed(3)).toLocaleString("id-ID") : String(x))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${kolom.length}" class="muted">Tidak ada data</td></tr>`}</table></div>
    <div class="row" style="margin-top:8px"><button class="sec" id="tmx">Unduh Excel</button><button id="tmt">Tutup</button></div>`);
  m.querySelector("#tmt").onclick = () => m.remove();
  pasangMenuEdit(m); // baris bertanggal: klik kanan / tekan lama → Lihat/Edit DDR
  m.querySelector("#tmx").onclick = async () => { const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([kolom, ...baris]), "Data"); X.writeFile(wb, `${judul.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_").slice(0, 60)}.xlsx`); };
  return m;
}
// semua grafik di #ch: ketuk -> tabel data grafik itu (label × seri), baris yang diketuk disorot
function pasangKlikGrafik(Chart) {
  for (const ch of Object.values(Chart.instances ?? {})) {
    const cv = ch.canvas; if (!cv?.closest("#ch") || ch.$klik) continue; ch.$klik = true; cv.style.cursor = "pointer";
    const judul = cv.closest(".card")?.querySelector("h3")?.textContent ?? "Data grafik";
    if (!cv.closest(".card").querySelector(".ketuk")) cv.insertAdjacentHTML("afterend", `<p class="muted ketuk" style="margin:4px 0 0;font-size:12px">Ketuk grafik untuk melihat datanya.</p>`);
    ch.options.onClick = (e, els) => {
      // batang bertanggal (meter harian per rig): ketukan ditangani menu DDR (pasangMenuEdit), jangan buka tabel juga
      if (!isClient() && (ch.data.labels ?? []).some((l) => /\b20\d\d-\d\d-\d\d\b/.test(String(l)))) return;
      if (typeof ch.$detail === "function" && els?.length) return ch.$detail(els[0].index, els[0].datasetIndex);
      const L = ch.data.labels ?? [], D = ch.data.datasets ?? [];
      const baris = L.map((l, i) => [l, ...D.map((d) => { const v = d.data[i]; return v && typeof v === "object" ? v.y : v; })]);
      tabelModal(judul, [ch.config.type === "pie" ? "Kategori" : "Label", ...D.map((d, k) => d.label || (D.length === 1 ? "Nilai" : `Seri ${k + 1}`))], baris, els?.[0]?.index ?? -1);
    };
    ch.update("none");
  }
}
const statRingkas = (xs) => { const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b), n = v.length; if (!n) return null;
  const mean = v.reduce((a, b) => a + b, 0) / n, med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2, sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, med, min: v[0], max: v[n - 1], sd }; };
async function statistikConto(Chart, box, bhids) {
  let G = []; try { for (let i = 0; ; i += 1000) { const { data, error } = await sb.from("v_dh_geology").select("holeid,sample_no,sample_id,from,to,zone,lith1,recovery_pct,core_length").order("holeid").order("from").range(i, i + 999);
      if (error) throw error; G.push(...data); if (data.length < 1000) break; } } catch { return; }
  if (bhids) G = G.filter((g) => bhids.includes(g.holeid));
  await muatZona().catch(() => {});
  const BAKU = { TP: "Top soil", L: "Limonit", LIM: "Limonit", S: "Saprolit", SAP: "Saprolit", BR: "Bedrock", BD: "Bedrock", BZ: "Bluezone", SED: "Sedimen" };
  const ZN = Object.fromEntries((ZONA ?? []).map((z) => [z.code, z])), nama = (k) => (k ? ZN[k]?.nama ?? (BAKU[k] ? `${BAKU[k]} (${k})` : k) : "(tanpa zona)"), warna = (k, i) => ZN[k]?.warna ?? ["#7A8B83", "#57B8C9", "#8E5BB5", "#D4B12A"][i % 4];
  const URUT = { TP: 1, SED: 2, L: 3, LIM: 3, S: 4, SAP: 4, BZ: 5, BD: 6, BR: 6 };
  const kunci = [...new Set(G.map((g) => g.zone ?? ""))].sort((a, b) => ((ZN[a]?.urut ?? URUT[a] ?? 99) - (ZN[b]?.urut ?? URUT[b] ?? 99)) || a.localeCompare(b));
  const panjang = (g) => +g.to - +g.from, tengah = (g) => (+g.to + +g.from) / 2, rec = (g) => (g.recovery_pct != null ? +g.recovery_pct : g.core_length != null && panjang(g) > 0 ? Math.min(100, (100 * +g.core_length) / panjang(g)) : NaN);
  const S = kunci.map((k, i) => { const xs = G.filter((g) => (g.zone ?? "") === k); return { k, nama: nama(k), warna: warna(k, i), xs, n: xs.length, lubang: new Set(xs.map((g) => g.holeid)).size,
    P: statRingkas(xs.map(panjang)), D: statRingkas(xs.map(tengah)), R: statRingkas(xs.map(rec)) }; });
  const f2 = (x) => (x == null ? "–" : (+x.toFixed(2)).toLocaleString("id-ID")), tot = G.length;
  const daftar = (s) => tabelModal(`Conto ${s.nama} (${s.n})`, ["Lubang", "No. conto", "Dari (m)", "Sampai (m)", "Panjang (m)", "Zona", "Litologi", "Recovery %"],
    s.xs.map((g) => [g.holeid, g.sample_no ?? g.sample_id ?? "", +g.from, +g.to, +panjang(g).toFixed(2), g.zone ?? "", g.lith1 ?? "", Number.isFinite(rec(g)) ? +rec(g).toFixed(1) : ""]), -1,
    `Panjang: rata-rata ${f2(s.P?.mean)} · median ${f2(s.P?.med)} · min ${f2(s.P?.min)} · maks ${f2(s.P?.max)} m. Kedalaman tengah conto ${f2(s.D?.min)}–${f2(s.D?.max)} m.`);
  const c = document.createElement("div"); c.className = "card";
  c.innerHTML = `<h3 style="margin:0 0 6px">Statistik conto per layer <span class="muted" style="font-weight:400;font-size:13px">· ${tot} conto di ${new Set(G.map((g) => g.holeid)).size} lubang</span></h3>
    ${tot ? `<div class="tw"><table><tr><th>Layer</th><th>Jumlah conto</th><th>%</th><th>Lubang</th><th>Panjang conto (m): rata-rata</th><th>median</th><th>min</th><th>maks</th><th>SD</th><th>Kedalaman tengah (m): rata-rata</th><th>min</th><th>maks</th><th>Recovery rata-rata %</th></tr>
      ${S.map((s, i) => `<tr data-lay="${i}" style="cursor:pointer"><td><span style="display:inline-block;width:12px;height:12px;background:${esc(s.warna)};border-radius:3px;margin-right:6px;vertical-align:-1px"></span><b>${esc(s.nama)}</b></td><td><b>${s.n}</b></td><td>${((100 * s.n) / tot).toFixed(1)}</td><td>${s.lubang}</td>
        <td>${f2(s.P?.mean)}</td><td>${f2(s.P?.med)}</td><td>${f2(s.P?.min)}</td><td>${f2(s.P?.max)}</td><td>${f2(s.P?.sd)}</td><td>${f2(s.D?.mean)}</td><td>${f2(s.D?.min)}</td><td>${f2(s.D?.max)}</td><td>${s.R ? f2(s.R.mean) : "–"}</td></tr>`).join("")}
      <tr style="font-weight:700;background:#F1F5F3"><td>Total</td><td>${tot}</td><td>100</td><td>${new Set(G.map((g) => g.holeid)).size}</td>${(() => { const P = statRingkas(G.map(panjang)), D = statRingkas(G.map(tengah)), R = statRingkas(G.map(rec));
        return `<td>${f2(P?.mean)}</td><td>${f2(P?.med)}</td><td>${f2(P?.min)}</td><td>${f2(P?.max)}</td><td>${f2(P?.sd)}</td><td>${f2(D?.mean)}</td><td>${f2(D?.min)}</td><td>${f2(D?.max)}</td><td>${R ? f2(R.mean) : "–"}</td>`; })()}</tr></table></div>
      <p class="muted" style="font-size:12px">Ketuk baris layer untuk melihat daftar contonya. Layer atau litologi baru otomatis muncul begitu ada di Form Logging yang disetujui.</p>
      <canvas id="cS1" height="200"></canvas>` : `<p class="muted">Belum ada conto di database (Form Logging yang disetujui verifier).</p>`}`;
  $("#ch").prepend(c);
  c.querySelectorAll("[data-lay]").forEach((tr) => (tr.onclick = () => daftar(S[+tr.dataset.lay])));
  if (!tot) return;
  const ch = new Chart(c.querySelector("#cS1"), { type: "bar", data: { labels: S.map((s) => s.nama), datasets: [{ label: "Jumlah conto", data: S.map((s) => s.n), backgroundColor: S.map((s) => s.warna), yAxisID: "y" },
    { type: "line", label: "Panjang rata-rata (m)", data: S.map((s) => (s.P ? +s.P.mean.toFixed(2) : null)), yAxisID: "y2", borderColor: "#12251E", pointRadius: 4 }] },
    options: { scales: { y: { title: { display: true, text: "conto" } }, y2: { position: "right", grid: { display: false }, title: { display: true, text: "m" } } } } });
  ch.$detail = (i) => daftar(S[i]);
}

async function muatZona() {
  if (online()) { const { data } = await sb.from("zona_warna").select("*").order("urut"); if (data) { ZONA = data; localStorage.setItem("zonaWarna", JSON.stringify(data)); } }
  return ZONA;
}
async function cekZonaBaru(paksa) {
  if (!isStaff() || !online() || document.querySelector("[data-zbaru]")) return;
  if (!paksa && Date.now() - Number(sessionStorage.getItem("zonaCek") || 0) < 6e5) return; sessionStorage.setItem("zonaCek", Date.now());
  const baru = (await muatZona()).filter((z) => z.status === "MENUNGGU"); if (!baru.length) return;
  const m = modal(`<div data-zbaru><h3>Zona baru di data logging</h3><p class="muted">Kode zona di bawah belum dikenal (masih abu-abu di profil bor). Isi nama dan pilih warnanya. Setelah dikonfirmasi, zona ini berlaku untuk semua pengguna dan muncul otomatis di profil bor.</p>
    ${baru.map((z) => `<div class="row" data-z="${esc(z.code)}" style="align-items:flex-end;margin-top:6px"><div style="flex:0 0 74px"><label>Kode</label><b>${esc(z.code)}</b><div class="muted" style="font-size:11px">${esc(z.contoh_bhid ?? "")}</div></div><div><label>Nama zona *</label><input value="${esc(z.nama === z.code ? "" : z.nama)}" placeholder="mis. Gabro, Sedimen"></div><div style="flex:0 0 60px"><label>Warna</label><input type="color" value="${esc(z.warna)}" style="padding:2px;height:40px"></div></div>`).join("")}
    <div class="row" style="margin-top:12px"><button id="zok">Konfirmasi</button><button class="sec" id="zx">Nanti</button></div><div id="ze" class="err"></div></div>`);
  m.querySelector("#zx").onclick = () => m.remove();
  m.querySelector("#zok").onclick = async () => {
    const isi = [...m.querySelectorAll("[data-z]")].map((r) => ({ code: r.dataset.z, nama: r.querySelector("input:not([type=color])").value.trim(), warna: r.querySelector("input[type=color]").value }));
    const kos = isi.filter((x) => !x.nama); if (kos.length) return (m.querySelector("#ze").textContent = `Isi nama untuk ${kos.map((x) => x.code).join(", ")}.`);
    if (!confirm(`Konfirmasi ${isi.map((x) => `${x.code} = ${x.nama}`).join(", ")}? Zona ini akan berlaku untuk semua tim.`)) return;
    for (const x of isi) { const { error } = await sb.from("zona_warna").update({ nama: x.nama, warna: x.warna, status: "TERKONFIRMASI" }).eq("code", x.code); if (error) return (m.querySelector("#ze").textContent = error.message); }
    await muatZona(); m.remove();
  };
}
// ---------- Profil bor (kolom zona per lubang) ----------
function profilSVG(rows, o = {}) {
  const B = [...new Set(rows.map((r) => r.bhid))], maxD = Math.max(1, ...rows.map((r) => +r.sampai_m));
  const H = o.h ?? 320, top = 34, lw = 46, gap = 64, left = 46, W = left + B.length * (lw + gap) + 10, step = [1, 2, 5, 10, 20, 50].find((s) => maxD / s <= 10) ?? 100;
  const y = (d) => top + (H * d) / maxD;
  let g = `<line x1="${left - 8}" y1="${top}" x2="${left - 8}" y2="${y(maxD)}" stroke="#555"/>`;
  for (let d = 0; d <= maxD + 1e-9; d += step) g += `<line x1="${left - 12}" y1="${y(d)}" x2="${left - 8}" y2="${y(d)}" stroke="#555"/><text x="${left - 14}" y="${y(d) + 3}" font-size="9" text-anchor="end">${d}</text>`;
  g += `<text x="6" y="${top - 8}" font-size="9">m</text>`;
  B.forEach((b, i) => { const x = left + i * (lw + gap), R = rows.filter((r) => r.bhid === b), dd = Math.max(...R.map((r) => +r.sampai_m));
    g += `<text x="${x + lw / 2}" y="${top - 10}" font-size="10" font-weight="700" text-anchor="middle">${esc(b)}</text>`;
    for (const r of R) { const y1 = y(+r.dari_m), h = Math.max(0.6, y(+r.sampai_m) - y1), gelap = (([rr, gg, bb]) => 0.299 * rr + 0.587 * gg + 0.114 * bb < 140)([1, 3, 5].map((k) => parseInt(String(r.warna).slice(k, k + 2), 16) || 0));
      g += `<rect x="${x}" y="${y1}" width="${lw}" height="${h}" fill="${esc(r.warna)}" stroke="#222" stroke-width=".5"><title>${esc(r.nama_zona)} ${r.dari_m}–${r.sampai_m} m (${r.tebal_m} m)</title></rect>`;
      if (h >= 11) g += `<text x="${x + lw / 2}" y="${y1 + h / 2 + 3}" font-size="9" text-anchor="middle" fill="${gelap ? "#fff" : "#111"}">${esc(r.zona)}</text>`;
      g += `<text x="${x + lw + 3}" y="${y1 + h / 2 + 3}" font-size="8.5" fill="#333">${(+r.tebal_m).toFixed(1)} m</text>`; }
    g += `<text x="${x + lw / 2}" y="${y(dd) + 12}" font-size="9" text-anchor="middle">EOH ${dd.toFixed(2)} m</text>`; });
  const Z = [...new Map(rows.map((r) => [r.zona, r])).values()];
  const leg = Z.map((r, i) => `<span style="display:inline-flex;align-items:center;gap:4px;margin:0 10px 4px 0"><span style="width:14px;height:12px;background:${esc(r.warna)};border:1px solid #222;display:inline-block"></span>${esc(r.zona)} = ${esc(r.nama_zona)}${r.status_zona === "MENUNGGU" ? " (belum dikonfirmasi)" : ""}</span>`).join("");
  return `<div style="overflow-x:auto"><svg width="${o.fit ? "100%" : W}" ${o.fit ? `style="max-height:${o.fit}px;background:#fff;font-family:Arial,sans-serif"` : `height="${top + H + 24}" style="background:#fff;font-family:Arial,sans-serif"`} viewBox="0 0 ${W} ${top + H + 24}" preserveAspectRatio="xMinYMin meet">${g}</svg></div><div style="font-size:11px;margin-top:4px">${leg}</div>`;
}
async function profilModal(bhid) {
  const m = modal(`<h3>Profil bor ${esc(bhid)}</h3><div id="pfx">Memuat…</div><div class="row" style="margin-top:10px"><button class="sec" id="pfc">Tutup</button></div>`);
  m.querySelector("#pfc").onclick = () => m.remove();
  if (!online()) return (m.querySelector("#pfx").textContent = "Profil bor perlu sinyal internet.");
  const { data, error } = await sb.from("v_profil_bor").select("*").eq("bhid", bhid).order("dari_m");
  if (error) return (m.querySelector("#pfx").textContent = error.message);
  if (!data?.length) return (m.querySelector("#pfx").innerHTML = `<p class="muted">Belum ada data logging ${esc(bhid)} di database${isClient() ? " yang dirilis untuk Anda" : " (Form Logging belum disetujui verifier)"}.</p>`);
  const tb = (z) => data.filter((r) => r.zona === z).reduce((s, r) => s + +r.tebal_m, 0);
  const ring = [...new Set(data.map((r) => r.zona))].map((z) => { const r = data.find((x) => x.zona === z); return `<tr><td><span style="display:inline-block;width:12px;height:12px;background:${esc(r.warna)};border:1px solid #222"></span> ${esc(r.nama_zona)}</td><td style="text-align:right">${tb(z).toFixed(2)} m</td></tr>`; }).join("");
  m.querySelector("#pfx").innerHTML = profilSVG(data, { h: 260 }) + `<table class="tbl" style="margin-top:8px"><tr><th>Zona</th><th>Tebal</th></tr>${ring}</table>`;
  cekZonaBaru(true);
}
// ---------- Citra drone + lapisan peta (dipakai peta statis, blok 3D, 3D bawah permukaan, Dashboard, laporan & unduhan) ----------
const _imgCache = {}, _tileList = {};
const muatGambar = (src) => (_imgCache[src] ??= new Promise((ok) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; }));
async function daftarCitra() { try { const pj = myTugas?.project; return (await (await fetch("peta/citra/index.json")).json()).filter((c) => !c.project || !pj || c.project === pj); } catch { return []; } }
async function daftarLapisan() {
  let srv = JSON.parse(localStorage.getItem("petaLayerSrv") || "[]");
  if (online()) try { const { data } = await sb.from("peta_layer").select("id,nama,warna,geojson,aktif").eq("aktif", true).order("created_at"); if (data) { srv = data; try { localStorage.setItem("petaLayerSrv", JSON.stringify(data)); } catch {} } } catch {}
  return [...srv, ...JSON.parse(localStorage.getItem("petaLokal") || "[]")].filter((l) => l?.geojson);
}
const fiturGeo = (gj) => (gj?.type === "FeatureCollection" ? gj.features : gj?.type === "Feature" ? [gj] : gj?.type ? [{ geometry: gj }] : []).filter((f) => f?.geometry);
// gambar lapisan (titik/garis/poligon) di kanvas; X/Y = lon/lat → piksel
function kanvasLapisan(g, LAY, X, Y, lebar = 2) {
  for (const ly of LAY) for (const f of fiturGeo(ly.geojson)) { const T = f.geometry.type, C = f.geometry.coordinates, w = ly.warna || "#00b7ff";
    const ring = (r) => r.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
    g.strokeStyle = w; g.fillStyle = w; g.lineWidth = lebar; g.lineJoin = "round";
    if (T === "Polygon" || T === "MultiPolygon") { g.beginPath(); (T === "Polygon" ? [C] : C).forEach((pl) => pl.forEach((r) => { ring(r); g.closePath(); })); g.globalAlpha = 0.12; g.fill("evenodd"); g.globalAlpha = 1; g.stroke(); }
    else if (T === "LineString" || T === "MultiLineString") { g.beginPath(); (T === "LineString" ? [C] : C).forEach(ring); g.stroke(); }
    else if (T === "Point" || T === "MultiPoint") (T === "Point" ? [C] : C).forEach((q) => { g.beginPath(); g.arc(X(q[0]), Y(q[1]), lebar * 2.2, 0, 7); g.fill(); g.lineWidth = Math.max(1, lebar * 0.5); g.strokeStyle = "#111"; g.stroke(); }); }
}
// lapisan sebagai SVG (untuk peta statis); P = [lon,lat] → "x,y"
function svgLapisan(LAY, P, R = 4) {
  let g = "";
  for (const ly of LAY) for (const f of fiturGeo(ly.geojson)) { const T = f.geometry.type, C = f.geometry.coordinates, w = esc(ly.warna || "#00b7ff"), rg = (r) => r.map(P).join(" ");
    if (T === "Polygon" || T === "MultiPolygon") g += `<path d="${(T === "Polygon" ? [C] : C).map((pl) => pl.map((r) => "M" + rg(r).replace(/ /g, " L") + " Z").join(" ")).join(" ")}" fill="${w}" fill-opacity=".12" fill-rule="evenodd" stroke="${w}" stroke-width="2"/>`;
    else if (T === "LineString" || T === "MultiLineString") (T === "LineString" ? [C] : C).forEach((l) => (g += `<polyline points="${rg(l)}" fill="none" stroke="${w}" stroke-width="2"/>`));
    else if (T === "Point" || T === "MultiPoint") (T === "Point" ? [C] : C).forEach((q) => { const [x, y] = P(q).split(","); g += `<circle cx="${x}" cy="${y}" r="${R}" fill="${w}" stroke="#111"/>`; }); }
  return g;
}
// Kanvas citra drone terbaru (ortofoto tile + citra gambar) untuk kotak lon/lat bb, utara di atas; transparan di luar citra
async function kanvasCitra(bb, Wp, Hp, o = {}) {
  const [x0, y0, x1, y1] = bb, c = document.createElement("canvas"); c.width = Math.max(1, Math.round(Wp)); c.height = Math.max(1, Math.round(Hp)); const g = c.getContext("2d");
  const X = (lon) => ((lon - x0) / (x1 - x0)) * c.width, Y = (lat) => ((y1 - lat) / (y1 - y0)) * c.height, cosl = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  c.nama = [];
  for (const ct of o.citra === false ? [] : await daftarCitra()) {
    if (o.hanya && !o.hanya.has(String(ct.id))) continue;
    const b = ct.bbox; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
    if (ct.tiles) {
      const ax0 = Math.max(x0, b[0]), ax1 = Math.min(x1, b[2]), ay0 = Math.max(y0, b[1]), ay1 = Math.min(y1, b[3]), mpp = ((x1 - x0) * 111320 * cosl) / c.width;
      if (ct.daftar && !_tileList[ct.daftar]) _tileList[ct.daftar] = fetch(ct.daftar).then((r) => r.json()).then((a) => new Set(a)).catch(() => null);
      const ada = ct.daftar ? await _tileList[ct.daftar] : null;
      let z = Math.max(ct.minzoom ?? 13, Math.min(ct.maxzoom ?? 18, Math.ceil(Math.log2((156543.03 * cosl) / mpp)))), T = [], n, tx, ty;
      for (; z >= (ct.minzoom ?? 13); z--) { n = 2 ** z; tx = (lon) => ((lon + 180) / 360) * n; ty = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
        T = []; for (let x = Math.floor(tx(ax0)); x <= Math.floor(tx(ax1)); x++) for (let y = Math.floor(ty(ay1)); y <= Math.floor(ty(ay0)); y++) { const u = ct.tiles.replace("{z}", z).replace("{x}", x).replace("{y}", y); if (!ada || ada.has(u)) T.push([x, y, u]); }
        if (T.length <= (o.maksTile ?? 500)) break; }
      const lon = (x) => (x / n) * 360 - 180, lat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
      const ims = await Promise.all(T.map((t) => muatGambar(t[2]))); let k2 = 0;
      T.forEach(([x, y], k) => { const im = ims[k]; if (!im) return; const px = X(lon(x)), py = Y(lat(y)); g.drawImage(im, px, py, X(lon(x + 1)) - px + 0.6, Y(lat(y + 1)) - py + 0.6); k2++; });
      if (k2) c.nama.push(ct.nama);
    } else { const im = await muatGambar(ct.file); if (im) { g.drawImage(im, X(b[0]), Y(b[3]), X(b[2]) - X(b[0]), Y(b[1]) - Y(b[3])); c.nama.push(ct.nama); } }
  }
  if (o.lapisan) { const LAY = await daftarLapisan(); kanvasLapisan(g, LAY, X, Y, o.lebar ?? Math.max(2, c.width / 700)); c.lapisan = LAY.map((l) => l.nama); }
  if (o.iup) { const Wl = JSON.parse(localStorage.getItem("wilayah") || "[]"); g.strokeStyle = "#ff2d2d"; g.lineWidth = o.lebar ?? Math.max(2, c.width / 700);
    for (const w of Wl) if ((w.titik ?? []).length) { g.beginPath(); w.titik.forEach((t, i) => (i ? g.lineTo(X(t.lon), Y(t.lat)) : g.moveTo(X(t.lon), Y(t.lat)))); g.closePath(); g.stroke(); } }
  return c;
}
// ---------- Peta pemboran statis (SVG) untuk laporan/PDF ----------
let _konturCache = null, _elevCache = null;
// Mosaik ubin peta web (citra satelit / OSM) untuk kotak lon/lat — dipakai ekspor PDF agar sama dengan latar peta di layar
async function mosaikUbin(tpl, bb, lebarPx = 2400, maksUbin = 140) {
  const txf = (lon, z) => ((lon + 180) / 360) * 2 ** z, tyf = (lat, z) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
  let z = Math.min(19, Math.max(3, Math.ceil(Math.log2((lebarPx / 256) / ((bb[2] - bb[0]) / 360)))));
  const hitung = (z) => (Math.floor(txf(bb[2], z)) - Math.floor(txf(bb[0], z)) + 1) * (Math.floor(tyf(bb[1], z)) - Math.floor(tyf(bb[3], z)) + 1);
  while (z > 3 && hitung(z) > maksUbin) z--;
  const X0 = Math.floor(txf(bb[0], z)), X1 = Math.floor(txf(bb[2], z)), Y0 = Math.floor(tyf(bb[3], z)), Y1 = Math.floor(tyf(bb[1], z)), nx = X1 - X0 + 1, ny = Y1 - Y0 + 1;
  const c = Object.assign(document.createElement("canvas"), { width: nx * 256, height: ny * 256 }), g = c.getContext("2d"); let ada = 0;
  await Promise.all(Array.from({ length: nx * ny }, (_, k) => new Promise((ok) => { const x = X0 + (k % nx), y = Y0 + Math.floor(k / nx), im = new Image(); im.crossOrigin = "anonymous";
    const t = setTimeout(ok, 15000); im.onload = () => { clearTimeout(t); g.drawImage(im, (x - X0) * 256, (y - Y0) * 256); ada++; ok(); }; im.onerror = () => { clearTimeout(t); ok(); };
    im.src = tpl.replace("{z}", z).replace("{x}", x).replace("{y}", y); })));
  if (!ada) return null;
  const lonT = (t) => (t / 2 ** z) * 360 - 180, latT = (t) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / 2 ** z))) * 180) / Math.PI;
  let url; try { url = c.toDataURL("image/jpeg", 0.9); } catch { return null; }
  return { url, bb: [lonT(X0), latT(Y1 + 1), lonT(X1 + 1), latT(Y0)], z, lengkap: ada === nx * ny };
}
const SKALA_A3 = [500, 1000, 2000, 2500, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000, 200000, 250000];
// Bingkai A3 di atas peta tab Peta: geser peta untuk memilih posisi, pilih skala (zoom/cubit ikut membulat ke skala standar).
// Bingkai = area peta di PDF (279 × 257 mm). Mengembalikan {pusat:[lon,lat], skala} atau null bila batal.
function aturBingkaiA3(map, { skala, pusat, L = [] } = {}) {
  return new Promise((selesai) => {
    const FWmm = 279, FHmm = 257, wadah = map.getContainer(), lama = { pitch: map.getPitch(), bearing: map.getBearing() };
    const ov = document.createElement("div");
    ov.id = "bingkaiA3";
    ov.style.cssText = "position:absolute;inset:0;z-index:40;pointer-events:none;font:13px system-ui,sans-serif";
    ov.innerHTML = `<div id="bfF" style="position:absolute;border:2px solid #d00;box-shadow:0 0 0 9999px rgba(0,0,0,.42);border-radius:2px"><span style="position:absolute;left:4px;top:3px;background:#d00;color:#fff;font-size:11px;padding:1px 5px;border-radius:3px">Area peta PDF A3</span>
        <span style="position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #d00;border-radius:50%"></span></div>
      <div id="bfBar" style="position:absolute;left:8px;right:8px;top:8px;pointer-events:auto;background:#fff;color:#111;border-radius:10px;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <b style="flex:1 1 100%;font-size:13px">📐 Geser peta untuk posisi · pilih skala (zoom/cubit ikut dibulatkan ke skala standar)</b>
        <select id="bfS" style="flex:1 1 140px;margin:0">${SKALA_A3.map((v) => `<option value="${v}">1 : ${v.toLocaleString("id-ID")}</option>`).join("")}</select>
        <button class="sec" id="bfO" style="flex:0 0 auto;width:auto;margin:0">Semua bor</button><button class="sec" id="bfB" style="flex:0 0 auto;width:auto;margin:0">Batal</button><button id="bfP" style="flex:0 0 auto;width:auto;margin:0">✓ Pakai</button>
        <span id="bfI" style="flex:1 1 100%;font-size:12px;color:#555"></span></div>`;
    wadah.appendChild(ov); wadah.scrollIntoView({ block: "start", behavior: "smooth" });
    const F = ov.querySelector("#bfF"), sel = ov.querySelector("#bfS"), inf = ov.querySelector("#bfI"), bar = ov.querySelector("#bfBar");
    // ukuran bingkai: rasio 279:257, sebesar mungkin di bawah bilah alat
    let fr = null;
    const tata = () => { const W = wadah.clientWidth, H = wadah.clientHeight, atas = bar.offsetHeight + 18, bawah = 30;
      const aw = W - 24, ah = Math.max(80, H - atas - bawah), w = Math.min(aw, ah * FWmm / FHmm), h = w * FHmm / FWmm;
      fr = { x: (W - w) / 2, y: atas + (ah - h) / 2, w, h }; Object.assign(F.style, { left: fr.x + "px", top: fr.y + "px", width: w + "px", height: h + "px" }); };
    const tengahPx = () => [fr.x + fr.w / 2, fr.y + fr.h / 2];
    // meter per piksel MapLibre (ubin 512) ↔ skala kertas: lebar bingkai (px) mewakili 279 mm di kertas
    const MPP0 = 40075016.686 / 512, cosd = (lat) => Math.cos((lat * Math.PI) / 180);
    const skalaDariZoom = () => MPP0 * cosd(map.unproject(tengahPx()).lat) / 2 ** map.getZoom() * fr.w * 1000 / FWmm;
    const zoomUntuk = (S, lat) => Math.log2(MPP0 * cosd(lat) / (FWmm / 1000 * S / fr.w));
    const terdekat = (S) => SKALA_A3.reduce((a, b) => Math.abs(Math.log(b / S)) < Math.abs(Math.log(a / S)) ? b : a);
    let sibuk = false;
    // atur zoom = skala S, dan letakkan titik ll tepat di pusat bingkai (bukan pusat layar)
    const ke = (S, ll) => { sibuk = true; const c = ll ?? map.unproject(tengahPx());
      map.jumpTo({ zoom: zoomUntuk(S, c.lat), pitch: 0, bearing: 0 });
      const [px, py] = tengahPx(), cc = map.project(c);
      map.jumpTo({ center: map.unproject([wadah.clientWidth / 2 + (cc.x - px), wadah.clientHeight / 2 + (cc.y - py)]) }); sibuk = false; };
    const km = (m) => m >= 1000 ? (m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " km" : Math.round(m) + " m";
    const hitung = () => { const a = map.unproject([fr.x, fr.y + fr.h]), b = map.unproject([fr.x + fr.w, fr.y]);
      const q = L.filter((p) => Number.isFinite(+p.lon)), n = q.filter((p) => +p.lon >= a.lng && +p.lon <= b.lng && +p.lat >= a.lat && +p.lat <= b.lat).length, S = +sel.value;
      inf.textContent = `${n} dari ${q.length} titik bor di dalam bingkai · liputan ±${km(FWmm / 1000 * S)} × ${km(FHmm / 1000 * S)} · 1 cm di kertas = ${km(S / 100)}`; };
    const putar = { r: map.dragRotate.isEnabled() };
    map.dragRotate.disable(); map.touchZoomRotate.disableRotation?.();
    tata();
    const S0 = skala && SKALA_A3.includes(+skala) ? +skala : terdekat(skalaDariZoom());
    sel.value = String(S0);
    ke(S0, pusat ? { lng: pusat[0], lat: pusat[1] } : null); hitung();
    const akhir = () => { if (sibuk) return; const S = skalaDariZoom();
      if (Math.abs(Math.log(S / +sel.value)) > 0.015) { const t = terdekat(S); sel.value = String(t); ke(t); } hitung(); };
    map.on("moveend", akhir);
    const rz = () => { const c = map.unproject(tengahPx()); tata(); ke(+sel.value, c); hitung(); }; window.addEventListener("resize", rz);
    sel.onchange = () => { ke(+sel.value); hitung(); };
    ov.querySelector("#bfO").onclick = () => { // semua titik bor masuk bingkai, skala bulat terkecil yang cukup
      const q = L.filter((p) => Number.isFinite(+p.lon) && Number.isFinite(+p.lat)); if (!q.length) return;
      const x0 = Math.min(...q.map((p) => +p.lon)), x1 = Math.max(...q.map((p) => +p.lon)), y0 = Math.min(...q.map((p) => +p.lat)), y1 = Math.max(...q.map((p) => +p.lat)), lat = (y0 + y1) / 2;
      const gw = (x1 - x0) * 111320 * cosd(lat) * 1.08 + 300, gh = (y1 - y0) * 110574 * 1.08 + 300;
      const t = SKALA_A3.find((s) => gw <= FWmm / 1000 * s && gh <= FHmm / 1000 * s) ?? 250000; sel.value = String(t); ke(t, { lng: (x0 + x1) / 2, lat }); hitung(); };
    const tutup = (hasil) => { map.off("moveend", akhir); window.removeEventListener("resize", rz); ov.remove();
      if (putar.r) map.dragRotate.enable(); map.touchZoomRotate.enableRotation?.();
      if (!hasil && lama.pitch > 0) map.easeTo({ pitch: lama.pitch, bearing: lama.bearing, duration: 400 }); selesai(hasil); };
    ov.querySelector("#bfB").onclick = () => tutup(null);
    ov.querySelector("#bfP").onclick = () => { const c = map.unproject(tengahPx()); tutup({ pusat: [c.lng, c.lat], skala: +sel.value }); };
  });
}
const UBIN_LATAR = { sat: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" };
// Hillshade dari ubin DEM terrain-RGB (peta/dem) untuk kotak lon/lat: bayangan gelap + sorotan terang transparan (ditumpuk di atas peta)
async function hillshadeKanvas(bb, o = {}) {
  const txf = (lon, z) => ((lon + 180) / 360) * 2 ** z, tyf = (lat, z) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
  let z = 14; while (z > 10 && (Math.floor(txf(bb[2], z)) - Math.floor(txf(bb[0], z)) + 1) * (Math.floor(tyf(bb[1], z)) - Math.floor(tyf(bb[3], z)) + 1) > 48) z--;
  const X0 = Math.floor(txf(bb[0], z)), X1 = Math.floor(txf(bb[2], z)), Y0 = Math.floor(tyf(bb[3], z)), Y1 = Math.floor(tyf(bb[1], z)), nx = X1 - X0 + 1, ny = Y1 - Y0 + 1;
  const c = Object.assign(document.createElement("canvas"), { width: nx * 256, height: ny * 256 }), g = c.getContext("2d", { willReadFrequently: true });
  let ada = 0;
  await Promise.all(Array.from({ length: nx * ny }, (_, k) => new Promise((ok) => { const tx = X0 + (k % nx), ty = Y0 + Math.floor(k / nx), im = new Image();
    im.onload = () => { g.drawImage(im, (tx - X0) * 256, (ty - Y0) * 256); ada++; ok(); }; im.onerror = ok; im.src = `peta/dem/${z}/${tx}/${ty}.png`; })));
  if (!ada) return null;
  const W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data, E = new Float32Array(W * H), ok = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { if (d[i * 4 + 3] < 200) continue; E[i] = -10000 + (d[i * 4] * 65536 + d[i * 4 + 1] * 256 + d[i * 4 + 2]) * 0.1; ok[i] = 1; }
  const latc = (bb[1] + bb[3]) / 2, px = (156543.03 * Math.cos((latc * Math.PI) / 180)) / 2 ** z, zf = o.eks ?? 2;
  const az = ((360 - (o.az ?? 315) + 90) * Math.PI) / 180, alt = ((o.alt ?? 45) * Math.PI) / 180, out = g.createImageData(W, H), q = out.data, kuat = o.kuat ?? 0.85;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!ok[i] || !ok[i - 1] || !ok[i + 1] || !ok[i - W] || !ok[i + W]) continue;
    const dzdx = ((E[i + 1] - E[i - 1]) / (2 * px)) * zf, dzdy = ((E[i - W] - E[i + W]) / (2 * px)) * zf;
    const sl = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx);
    const h = Math.max(0, Math.cos(alt) * Math.cos(sl) + Math.sin(alt) * Math.sin(sl) * Math.cos(az - asp)), datar = Math.cos(alt);
    if (h < datar) { q[i * 4 + 3] = Math.min(255, ((datar - h) / datar) * 255 * kuat); } else { q[i * 4] = q[i * 4 + 1] = q[i * 4 + 2] = 255; q[i * 4 + 3] = Math.min(255, ((h - datar) / (1 - datar)) * 80 * kuat); } }
  g.putImageData(out, 0, 0);
  const lonT = (t) => (t / 2 ** z) * 360 - 180, latT = (t) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / 2 ** z))) * 180) / Math.PI;
  return { url: c.toDataURL("image/png"), bb: [lonT(X0), latT(Y1 + 1), lonT(X1 + 1), latT(Y0)], z };
}
// Unduh langsung PDF (tanpa dialog cetak): halaman HTML → gambar 240 dpi → PDF satu halaman ukuran kertas yang diminta
async function htmlKePdf(html, nama, o = {}) {
  const wmm = o.wmm ?? 420, hmm = o.hmm ?? 297, dpi = o.dpi ?? 240;
  const doc = new DOMParser().parseFromString(html, "text/html"), css = [...doc.querySelectorAll("style")].map((x) => x.textContent).join("\n");
  const sheet = doc.querySelector(o.sel ?? ".sheet") ?? doc.body;
  const keData = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(null); f.readAsDataURL(b); });
  await Promise.all([...sheet.querySelectorAll("img")].map(async (im) => { const src = im.getAttribute("src") || ""; if (src.startsWith("data:")) return;
    try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 12000); const r = await fetch(new URL(src, location.href).href, { signal: ctl.signal }); if (!r.ok) throw 0; im.setAttribute("src", await keData(await r.blob())); }
    catch { im.remove(); } }));
  sheet.querySelectorAll("[onerror]").forEach((x) => x.removeAttribute("onerror"));
  const xhtml = new XMLSerializer().serializeToString(sheet);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wmm}mm" height="${hmm}mm" viewBox="0 0 ${(wmm / 25.4) * 96} ${(hmm / 25.4) * 96}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="akar" style="margin:0"><style>${css.replace(/\bbody\b/g, "div.akar").replace(/</g, "&lt;")}</style>${xhtml}</div></foreignObject></svg>`;
  const img = new Image(); img.decoding = "sync";
  await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error("Halaman peta tidak bisa digambar di browser ini")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const W = Math.round((wmm / 25.4) * dpi), H = Math.round((hmm / 25.4) * dpi), c = Object.assign(document.createElement("canvas"), { width: W, height: H }), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.drawImage(img, 0, 0, W, H); await new Promise((r) => setTimeout(r, 300)); g.drawImage(img, 0, 0, W, H); // gambar ulang: Safari kadang belum memuat gambar di dalam halaman pada gambar pertama
  const jpg = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92)); if (!jpg) throw new Error("Gagal membuat gambar halaman (memori HP tidak cukup?)");
  const jb = new Uint8Array(await jpg.arrayBuffer()), enc = new TextEncoder(), parts = [], off = []; let len = 0;
  const tulis = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; }, obj = (n, isi) => { off[n] = len; tulis(`${n} 0 obj\n`); isi(); tulis("\nendobj\n"); };
  const pw = ((wmm / 25.4) * 72).toFixed(2), ph = ((hmm / 25.4) * 72).toFixed(2), isiHal = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  tulis("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => tulis("<</Type/Catalog/Pages 2 0 R>>")); obj(2, () => tulis("<</Type/Pages/Kids[3 0 R]/Count 1>>"));
  obj(3, () => tulis(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pw} ${ph}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`));
  obj(4, () => { tulis(`<</Type/XObject/Subtype/Image/Width ${W}/Height ${H}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jb.length}>>\nstream\n`); tulis(jb); tulis("\nendstream"); });
  obj(5, () => tulis(`<</Length ${isiHal.length}>>\nstream\n${isiHal}\nendstream`));
  obj(6, () => tulis(`<</Title(${String(o.judul ?? nama).replace(/[()\\]/g, "")})/Producer(X-Terra)/CreationDate(D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)})>>`));
  const xr = len; tulis(`xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => String(off[n]).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<</Size 7/Root 1 0 R/Info 6 0 R>>\nstartxref\n${xr}\n%%EOF`);
  const blob = new Blob(parts, { type: "application/pdf" }), a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: nama.endsWith(".pdf") ? nama : nama + ".pdf" });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  return { bytes: blob.size, W, H };
}
// ---------- Ekspor peta lokasi titik bor A3 lanskap (template lampiran: peta + panel keterangan, skala bulat sebenarnya) ----------
const PETA_A3_DEF = {
  perusahaan: "PT NUSA PRIMA GEMILANG", judul: "PETA LOKASI TITIK BOR EKSPLORASI", sub: "", lampiran: "Lampiran Laporan Kegiatan Eksplorasi Nikel Laterit",
  nomor: "-", tanggal: "-", kota: "", jabatan: "Kepala Teknik Tambang", nama: "",
  dasar: "", catatan: "1. Posisi titik bor dari GPS collar / Mulai bor; titik rencana dari daftar rencana lubang.\n2. Kedalaman sesuai laporan harian (Progres bor & DDR) di aplikasi X-Terra.",
};
function petaA3Dialog(L, mode = {}) {
  const S = { ...PETA_A3_DEF, ...JSON.parse(localStorage.getItem("petaA3") || "{}") }, logo = localStorage.getItem("petaA3Logo");
  if (mode.g3d) S.judul = localStorage.getItem("petaA3judul3d") || "PETA 3D LUBANG BOR BAWAH PERMUKAAN";
  const Wl = JSON.parse(localStorage.getItem("wilayah") || "[]");
  if (!S.sub) S.sub = (Wl[0]?.nama ? Wl[0].nama.toUpperCase() + " · " : "") + "TAHUN " + new Date().getFullYear();
  const f = (k, l, ph = "") => `<label>${l}</label><input data-k="${k}" value="${esc(S[k] ?? "")}" placeholder="${esc(ph)}">`;
  const m = modal(`<h3>${mode.g3d ? "Peta 3D bawah permukaan" : "Peta lokasi"} PDF (A3 lanskap)</h3>
    <p class="muted">Isian disimpan di HP ini untuk ekspor berikutnya. ${mode.peta ? "Posisi dan skala bisa diatur sendiri lewat tombol 📐 sebelum mengunduh." : "Skala dipilih otomatis (bulat) agar semua titik bor dan batas IUP masuk."}</p>
    <label>Logo perusahaan (PNG/JPG)</label><div class="row" style="align-items:center"><span id="paLg" style="flex:0 0 90px;height:44px;display:flex;align-items:center;justify-content:center;border:1px dashed #9aa;border-radius:6px;overflow:hidden">${logo ? `<img src="${logo}" style="max-height:42px;max-width:88px">` : `<span class="muted" style="font-size:11px">belum ada</span>`}</span><input id="paLf" type="file" accept="image/*" style="flex:1"></div>
    ${f("perusahaan", "Nama perusahaan (judul & kaki panel)")}${f("judul", "Judul peta")}${f("sub", "Sub-judul (proyek · tahun)")}
    <div ${mode.g3d ? 'style="display:none"' : ""}><label>Cakupan peta</label><select data-k="cakupan">${mode.peta ? `<option value="atur" ${S.cakupan === "atur" ? "selected" : ""}>Posisi & skala yang saya atur (bingkai 📐)</option>` : ""}${mode.tampilan ? `<option value="layar" ${!["bor", "iup", "atur"].includes(S.cakupan) ? "selected" : ""}>Sesuai tampilan peta di layar</option>` : ""}<option value="bor" ${S.cakupan === "bor" || (!mode.tampilan && S.cakupan !== "iup") ? "selected" : ""}>Area pemboran saja (skala lebih besar)</option><option value="iup" ${S.cakupan === "iup" ? "selected" : ""}>Seluruh batas IUP</option></select>
    <label>Skala peta</label><select data-k="skala"><option value="">Otomatis (semua isi cakupan masuk)</option>${SKALA_A3.map((v) => `<option value="${v}" ${+S.skala === v ? "selected" : ""}>1 : ${v.toLocaleString("id-ID")}</option>`).join("")}</select>
    ${mode.peta ? `<button class="sec" id="paAtur" style="width:100%;margin:6px 0">📐 Atur posisi & skala di peta (lihat bingkai A3)</button><p class="muted" id="paAi" style="font-size:12px;margin:0 0 6px"></p>` : ""}
    ${mode.tampilan ? `<p class="muted" style="font-size:12px;margin:2px 0 6px">Isi peta mengikuti tampilan di layar: latar ${({ sat: "citra satelit", osm: "peta jalan OSM", none: "tanpa latar" })[mode.tampilan.basemap] ?? ""}, lapisan yang dicentang, status lubang yang tampil${mode.tampilan.vis.hs ? ", bayangan relief" : ""}${mode.tampilan.vis.kontur ? ", kontur" : ""}. Ubah lewat tombol Lapisan sebelum mengekspor.</p>` : ""}
    <label ${mode.tampilan ? 'style="display:none"' : ""}>Bayangan relief (hillshade)</label><select data-k="hillshade" ${mode.tampilan ? 'style="display:none"' : ""}><option value="ya" ${S.hillshade !== "tidak" ? "selected" : ""}>Tampilkan (kesan 3D)</option><option value="tidak" ${S.hillshade === "tidak" ? "selected" : ""}>Tidak</option></select></div>
    ${f("lampiran", "Keterangan lampiran")}<div class="row"><div>${f("nomor", "Nomor")}</div><div>${f("tanggal", "Tanggal")}</div></div>
    <div class="row"><div>${f("kota", "Kota (tanda tangan)", "mis. Luwuk")}</div><div>${f("jabatan", "Jabatan penandatangan")}</div></div>${f("nama", "Nama penandatangan", me?.full_name ?? "")}
    <label>Dasar / sumber tambahan (satu per baris, opsional)</label><textarea data-k="dasar" rows="3" placeholder="mis. SK IUP OP No. ...">${esc(S.dasar)}</textarea>
    <label>Catatan</label><textarea data-k="catatan" rows="3">${esc(S.catatan)}</textarea>
    <p class="err" id="pae"></p><p class="muted" id="pap"></p><div class="row"><button class="sec" id="pab">Batal</button><button class="sec" id="pav">Pratinjau</button><button id="pak">⬇ Unduh PDF A3</button></div>`);
  let logoBaru = logo;
  m.querySelector("#paLf").onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return;
    const bmp = await createImageBitmap(fl), k = Math.min(1, 600 / Math.max(bmp.width, bmp.height)), c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); logoBaru = c.toDataURL("image/png"); m.querySelector("#paLg").innerHTML = `<img src="${logoBaru}" style="max-height:42px;max-width:88px">`; };
  m.querySelector("#pab").onclick = () => m.remove();
  if (mode.g3d) m.style.zIndex = 10000;
  let pusatAtur = mode.peta ? (() => { const c = mode.peta.getCenter(); return [c.lng, c.lat]; })() : null;
  const selC = m.querySelector('[data-k="cakupan"]'), selS = m.querySelector('[data-k="skala"]');
  const infoAtur = () => { const i = m.querySelector("#paAi"); if (i) i.textContent = selC.value === "atur" ? `Bingkai: pusat ${pusatAtur[1].toFixed(5)}, ${pusatAtur[0].toFixed(5)} · skala ${selS.value ? "1 : " + (+selS.value).toLocaleString("id-ID") : "otomatis"}` : ""; };
  if (mode.peta) { infoAtur(); selC.onchange = selS.onchange = infoAtur;
    m.querySelector("#paAtur").onclick = async () => { m.style.display = "none";
      const r = await aturBingkaiA3(mode.peta, { skala: +selS.value || null, pusat: selC.value === "atur" ? pusatAtur : null, L });
      m.style.display = "flex"; if (r) { pusatAtur = r.pusat; selS.value = String(r.skala); selC.value = "atur"; infoAtur(); } }; }
  const ambil = () => { const O = {}; m.querySelectorAll("[data-k]").forEach((x) => (O[x.dataset.k] = x.value.trim()));
    if (mode.tampilan) O.tampilan = mode.tampilan;
    if (O.cakupan === "atur" && pusatAtur) O.pusat = pusatAtur;
    if (mode.g3d) { localStorage.setItem("petaA3judul3d", O.judul); const lama = JSON.parse(localStorage.getItem("petaA3") || "{}"); O.judulPeta2D = lama.judul; }
    { const { tampilan: _t, ...simpan } = O; localStorage.setItem("petaA3", JSON.stringify(mode.g3d ? { ...simpan, judul: O.judulPeta2D ?? PETA_A3_DEF.judul } : simpan)); } if (mode.g3d) O.g3d = mode.g3d; if (logoBaru) try { localStorage.setItem("petaA3Logo", logoBaru); } catch {} return { ...O, logo: logoBaru }; };
  m.querySelector("#pav").onclick = () => { const O = ambil(); m.remove(); petaA3(L, O); if (mode.g3d) { const d = document.getElementById("dokLayer"); if (d) d.style.zIndex = 10001; } };
  m.querySelector("#pak").onclick = async () => {
    const O = ambil(), b = m.querySelector("#pak"), st = m.querySelector("#pap"); b.disabled = true; m.querySelector("#pae").textContent = "";
    try { st.textContent = "Menyusun peta (citra, kontur, hillshade, peta situasi)…"; const html = await petaA3HTML(L, O);
      st.textContent = "Membuat file PDF A3…"; const nama = `${O.g3d ? "Peta_3D_Bawah_Permukaan" : "Peta_Lokasi_Titik_Bor"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const r = await htmlKePdf(html, nama, { judul: O.judul }); st.textContent = `Selesai: ${nama} (${(r.bytes / 1048576).toFixed(1)} MB, A3 lanskap, 240 dpi) — cek folder Unduhan.`; b.disabled = false; b.textContent = "⬇ Unduh lagi";
    } catch (e) { b.disabled = false; st.textContent = ""; m.querySelector("#pae").textContent = `PDF langsung gagal (${e.message}). Pakai Pratinjau lalu Simpan PDF.`; }
  };
}
async function petaA3(L, O) {
  const w = jendelaDok("Peta lokasi titik bor (A3)", "A3L");
  try { w.document.open(); w.document.write(await petaA3HTML(L, O)); w.document.close(); }
  catch (e) { w.document.open(); w.document.write(`<p style="padding:20px;color:#b00">Peta gagal disusun: ${esc(e.message)}</p>`); w.document.close(); }
}
// Peta 3D bawah permukaan dalam format lampiran A3 yang sama (gambar 3D di bingkai peta, panel keterangan di kanan)
async function petaA3HTML3D(L, O) {
  const G = O.g3d, FX = 20, FY = 20, FW = 279, FH = 257;
  const pts = L.filter((x) => Number.isFinite(+x.lon) && Number.isFinite(+x.lat));
  const nS = (k) => pts.filter((p) => (k === "EOH" ? ["EOH", "STB"].includes(p.status) : p.status === k)).length;
  const mBor = pts.reduce((s, p) => s + (+p.kedalaman || +p.kd || 0), 0);
  const [lo0, la0, lo1, la1] = G.wilayahLL, lc = (lo0 + lo1) / 2, la = (la0 + la1) / 2;
  const { inset, situasiKet, IW, IH } = await petaSituasi(lc, la, [lo0, la1], [lo1, la0]);
  const mataAngin = (d) => ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"][Math.round(((d % 360) + 360) % 360 / 45) % 8];
  const leg = (sym, t) => `<div style="display:flex;align-items:center;gap:2mm;margin:.6mm 0"><span style="flex:0 0 9mm;display:flex;justify-content:center">${sym}</span><span>${t}</span></div>`;
  const kotak = (c) => `<span style="display:inline-block;width:5mm;height:3mm;background:${esc(c)};border:.2mm solid #333"></span>`;
  const dot = (c) => `<svg viewBox="0 0 4 4" style="width:3.2mm;height:3.2mm"><circle cx="2" cy="2" r="1.7" fill="${c}" stroke="#111" stroke-width=".3"/></svg>`;
  const thn = new Date().getFullYear(), tglTtd = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const sumber = [`Titik bor & kedalaman: database X-Terra, keadaan ${tglTtd}`, "Layer (TP, limonit, saprolit, bedrock, dll.): Form Logging yang disetujui verifier",
    "Topografi: DEMNAS (Badan Informasi Geospasial)", "Peta situasi: © kontributor OpenStreetMap", ...String(O.dasar || "").split("\n").map((x) => x.trim()).filter(Boolean)];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(O.judul)}</title><style>
    body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111}
    .sheet{position:relative;width:420mm;height:297mm;background:#fff;overflow:hidden;box-sizing:border-box}
    .pn{position:absolute;left:313mm;top:8mm;width:99mm;height:281mm;border:.35mm solid #111;box-sizing:border-box;display:flex;flex-direction:column;font-size:2.6mm}
    .pn>div{border-bottom:.25mm solid #111;padding:1.6mm 2.2mm}.pn>div:last-child{border-bottom:0}
    .c{text-align:center}.b{font-weight:700}.kv{display:grid;grid-template-columns:30mm 3mm 1fr;row-gap:.4mm}
    ol{margin:.5mm 0 0 4mm;padding:0}li{margin:.2mm 0}h4{margin:0 0 1mm;font-size:2.9mm;text-align:center}
  </style></head><body><div class="sheet">
  <svg viewBox="0 0 420 297" style="position:absolute;left:0;top:0;width:420mm;height:297mm;font-family:Arial,Helvetica,sans-serif">
    <rect x="4" y="4" width="412" height="289" fill="none" stroke="#111" stroke-width=".5"/>
    <image href="${G.url}" x="${FX}" y="${FY}" width="${FW}" height="${FH}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" fill="none" stroke="#111" stroke-width=".4"/>
    <g transform="translate(${FX + 12},${FY + 14}) rotate(${G.utara.toFixed(1)})"><circle r="8" fill="#fff" opacity=".85" stroke="#111" stroke-width=".25"/><polygon points="0,-6.5 3,3.5 0,1.5 -3,3.5" fill="#111"/><text y="-7.6" font-size="3" font-weight="700" text-anchor="middle">U</text></g>
    <text x="${FX + 2}" y="${FY + FH - 2.5}" font-size="2.4" fill="#333">Tampilan perspektif tanpa skala · relief ×${G.VE} · panjang lubang ×${G.HE} · dilihat dari arah ${mataAngin(G.arahLihat)}</text>
  </svg>
  <div class="pn">
    <div style="font-size:2.4mm">${esc(O.lampiran)}<div class="kv" style="grid-template-columns:14mm 3mm 1fr;margin-top:.8mm"><span>Nomor</span><span>:</span><span>${esc(O.nomor)}</span><span>Tanggal</span><span>:</span><span>${esc(O.tanggal)}</span></div></div>
    <div class="c">${O.logo ? `<img src="${O.logo}" style="max-height:16mm;max-width:60mm;display:block;margin:0 auto 1.5mm">` : ""}<div class="b" style="font-size:3.6mm;line-height:1.3">${esc(O.judul)}</div><div class="b" style="font-size:3mm;margin-top:.6mm">${esc(O.sub)}</div></div>
    <div><div class="kv"><span>Jumlah titik bor</span><span>:</span><span>${pts.length} titik (${nS("EOH")} selesai, ${nS("PROGRES")} progres, ${nS("RENCANA")} rencana)</span><span>Meter dibor</span><span>:</span><span>${mBor.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m</span><span>Kedalaman maks.</span><span>:</span><span>${(+G.maxD).toLocaleString("id-ID", { maximumFractionDigits: 1 })} m</span><span>Elevasi permukaan</span><span>:</span><span>${Math.round(G.zMin)} – ${Math.round(G.zMax)} m dpl</span></div></div>
    <div><h4>TAMPILAN 3D</h4><div class="kv" style="grid-template-columns:30mm 3mm 1fr;font-size:2.4mm"><span>Skala</span><span>:</span><span>Tanpa skala (perspektif)</span><span>Pembesaran relief</span><span>:</span><span>× ${G.VE}</span><span>Pembesaran lubang</span><span>:</span><span>× ${G.HE} (panjang lubang tidak sebanding dengan relief)</span><span>Arah pandang</span><span>:</span><span>dari ${mataAngin(G.arahLihat)} (${Math.round(G.arahLihat)}°)</span><span>Topografi</span><span>:</span><span>${esc(G.topo)}, tembus pandang ${Math.round((1 - G.tembus) * 100)} %</span><span>Datum</span><span>:</span><span>WGS 84 · elevasi DEMNAS</span></div></div>
    <div><h4>KETERANGAN</h4>
      ${G.zon.length ? G.zon.map(([n, w]) => leg(kotak(w), esc(n))).join("") : leg(kotak("#bbb"), "Lubang belum ber-logging (warna = status)")}
      ${leg(dot(WARNA_STATUS.RENCANA), "Collar titik rencana")}${leg(dot(WARNA_STATUS.PROGRES), "Collar titik progres")}${leg(dot(WARNA_STATUS.EOH), "Collar titik selesai (EOH / STB)")}
      ${leg(`<svg viewBox="0 0 9 2" style="width:9mm;height:2mm"><line x1="0" y1="1" x2="9" y2="1" stroke="#333" stroke-width=".5" stroke-dasharray="1.2 .8"/></svg>`, "Sisa kedalaman rencana")}
      ${leg(`<span style="display:inline-block;width:6mm;height:3mm;background:linear-gradient(135deg,#e7efe9,#9fb3a8);opacity:.8;border:.2mm solid #999"></span>`, "Permukaan topografi (tembus pandang)")}</div>
    <div style="font-size:2.2mm"><b>Sumber:</b><ol>${sumber.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
    <div style="font-size:2.2mm"><b>Catatan:</b><div style="white-space:pre-line;margin-top:.4mm">${esc([O.catatan, "Gambar 3D adalah visualisasi; panjang lubang diperbesar agar terlihat. Ukuran dan kedalaman yang berlaku ada di tabel database / Form Logging."].filter(Boolean).join("\n"))}</div></div>
    <div><b style="font-size:2.4mm">Peta Situasi</b> <span style="font-size:2.2mm">— ${esc(situasiKet)}</span><div style="position:relative;width:${IW}mm;height:${IH - 14}mm;overflow:hidden;border:.2mm solid #777;margin-top:.8mm;background:#aad3df">${inset.replace(/top:([\d.-]+)mm/g, (m, v) => `top:${(+v - 7).toFixed(2)}mm`)}</div></div>
    <div class="c" style="margin-top:auto;font-size:2.5mm">${esc(O.kota ? O.kota + ", " : "")}${tglTtd}<div class="b">${esc(O.perusahaan)}</div><div>${esc(O.jabatan)}</div><div style="height:13mm"></div><div class="b" style="text-decoration:underline">${esc(O.nama || "........................................")}</div></div>
    <div class="c" style="background:#f1f1f1"><div class="b" style="font-size:3.2mm">${esc(O.perusahaan)}</div><div>${thn}</div></div>
  </div></div></body></html>`;
}
async function petaSituasi(lc, la, kA, kB) {
  // peta situasi (indeks regional): pulau/kepulauan tempat lokasi berada, ubin OSM, kotak merah = cakupan peta
  const REG = [["Sumatera", [95.0, -6.2, 106.3, 6.1]], ["Jawa & Bali", [105.0, -8.9, 115.8, -5.8]], ["Kalimantan", [108.5, -4.3, 119.3, 7.1]], ["Sulawesi", [118.7, -6.3, 125.5, 2.1]],
    ["Nusa Tenggara", [115.8, -11.0, 125.3, -7.8]], ["Maluku", [124.6, -8.5, 135.0, 3.0]], ["Papua", [130.8, -9.3, 141.1, 1.0]]];
  const cocok = REG.filter(([, b]) => lc >= b[0] && lc <= b[2] && la >= b[1] && la <= b[3]).sort((a, b) => Math.hypot(lc - (a[1][0] + a[1][2]) / 2, la - (a[1][1] + a[1][3]) / 2) - Math.hypot(lc - (b[1][0] + b[1][2]) / 2, la - (b[1][1] + b[1][3]) / 2));
  const [regNama, rb] = cocok[0] ?? ["Regional", [lc - 4, la - 3, lc + 4, la + 3]];
  let provinsi = "";
  try { if (navigator.onLine) { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 5000);
    const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=5&accept-language=id&lat=${la}&lon=${lc}`, { signal: ctl.signal })).json(); provinsi = j?.address?.state ?? j?.address?.province ?? ""; } } catch {}
  const IW = 92, IH = 68, txf = (lon, z) => ((lon + 180) / 360) * 2 ** z, tyf = (lat, z) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
  let z = 3, ts = 0; for (let k = 9; k >= 3; k--) { const t = Math.min(IW / (txf(rb[2], k) - txf(rb[0], k)), IH / (tyf(rb[1], k) - tyf(rb[3], k))); if (t >= 14) { z = k; ts = t; break; } }
  if (!ts) { z = 3; ts = Math.min(IW / (txf(rb[2], 3) - txf(rb[0], 3)), IH / (tyf(rb[1], 3) - tyf(rb[3], 3))); }
  const cX = (txf(rb[0], z) + txf(rb[2], z)) / 2, cY = (tyf(rb[1], z) + tyf(rb[3], z)) / 2, MX = (tx) => IW / 2 + (tx - cX) * ts, MY = (ty) => IH / 2 + (ty - cY) * ts;
  let inset = "";
  for (let tx = Math.floor(cX - IW / 2 / ts); tx <= Math.floor(cX + IW / 2 / ts); tx++) for (let ty = Math.floor(cY - IH / 2 / ts); ty <= Math.floor(cY + IH / 2 / ts); ty++)
    if (ty >= 0 && ty < 2 ** z) inset += `<img src="https://tile.openstreetmap.org/${z}/${((tx % 2 ** z) + 2 ** z) % 2 ** z}/${ty}.png" style="position:absolute;left:${MX(tx)}mm;top:${MY(ty)}mm;width:${ts + 0.05}mm;height:${ts + 0.05}mm" onerror="this.remove()">`;
  const kx0 = MX(txf(kA[0], z)), ky0 = MY(tyf(kA[1], z)), kw = Math.max(2.2, MX(txf(kB[0], z)) - kx0), kh = Math.max(2.2, MY(tyf(kB[1], z)) - ky0);
  inset += `<div style="position:absolute;left:${kx0 + (MX(txf(kB[0], z)) - kx0) / 2 - kw / 2}mm;top:${ky0 + (MY(tyf(kB[1], z)) - ky0) / 2 - kh / 2}mm;width:${kw}mm;height:${kh}mm;border:.6mm solid #e01b1b;box-sizing:border-box"></div>`;
  const situasiKet = `${regNama === "Regional" ? "Regional lokasi" : "Regional " + regNama}${provinsi ? " · Provinsi " + provinsi.replace(/^Provinsi\s+/i, "") : ""}`;
  return { inset, situasiKet, IW, IH };
}
async function petaA3HTML(L, O) {
  if (O.g3d) return petaA3HTML3D(L, O);
  const Wl = JSON.parse(localStorage.getItem("wilayah") || "[]");
  const T = O.tampilan ?? null, V = T?.vis ?? null; // keadaan peta di layar (null = ekspor bawaan)
  // zona UTM mengikuti lokasi yang dipetakan (pusat tampilan layar, atau titik bor / IUP)
  const atur = O.cakupan === "atur" && O.pusat ? O.pusat : null;
  const pusat = atur ?? (O.cakupan === "layar" && T?.bounds ? [(T.bounds[0] + T.bounds[2]) / 2, (T.bounds[1] + T.bounds[3]) / 2]
    : (() => { const q = L.filter((x) => Number.isFinite(+x.lon)); const w = Wl.flatMap((x) => x.titik ?? []); const A = q.length ? q : w; return A.length ? [A.reduce((s, x) => s + +x.lon, 0) / A.length, A.reduce((s, x) => s + +x.lat, 0) / A.length] : [123, -1]; })());
  const ZU = zonaUTMDari(pusat[0], pusat[1]), UTM = buatUTM(ZU.zona, ZU.selatan);
  let pts = L.filter((x) => Number.isFinite(+x.lon) && Number.isFinite(+x.lat) && (!V || V.st?.[x.status] !== false)).map((x) => ({ ...x, u: UTM.ke(+x.lon, +x.lat) }));
  let poly = (V && !V.iup ? [] : Wl).filter((x) => (x.titik ?? []).length > 2).map((x) => ({ ...x, u: x.titik.map((t) => UTM.ke(+t.lon, +t.lat)) }));
  const semua = [...pts.map((p) => p.u), ...poly.flatMap((p) => p.u)];
  if (!semua.length) return "<p style='padding:20px'>Belum ada titik bor atau batas IUP untuk dipetakan.</p>";
  // cakupan: area pemboran (bawaan) atau seluruh IUP
  const layar = O.cakupan === "layar" && T?.bounds ? [UTM.ke(T.bounds[0], T.bounds[1]), UTM.ke(T.bounds[2], T.bounds[3]), UTM.ke(T.bounds[0], T.bounds[3]), UTM.ke(T.bounds[2], T.bounds[1])] : null;
  const fokus = layar ?? (O.cakupan !== "iup" && pts.length ? pts.map((p) => p.u) : semua);
  // bingkai peta (mm) dan skala bulat
  const FX = 20, FY = 20, FW = 279, FH = 257;
  let e0 = Math.min(...fokus.map((c) => c[0])), e1 = Math.max(...fokus.map((c) => c[0])), n0 = Math.min(...fokus.map((c) => c[1])), n1 = Math.max(...fokus.map((c) => c[1]));
  const tepi = fokus === semua || layar ? 0 : 150; // ruang 150 m di sekeliling titik bor
  const gw = Math.max(300, (e1 - e0) * (layar ? 1 : 1.08) + 2 * tepi), gh = Math.max(300, (n1 - n0) * (layar ? 1 : 1.08) + 2 * tepi);
  let Ec = (e0 + e1) / 2, Nc = (n0 + n1) / 2;
  if (atur) [Ec, Nc] = UTM.ke(atur[0], atur[1]); // pusat bingkai yang diatur pengguna
  const S = +O.skala > 0 ? +O.skala : SKALA_A3.find((s) => gw <= (FW / 1000) * s && gh <= (FH / 1000) * s) ?? 250000; // skala pilihan pengguna atau otomatis
  const mm = 1000 / S; // mm per meter
  const X = (E) => FX + FW / 2 + (E - Ec) * mm, Y = (N) => FY + FH / 2 - (N - Nc) * mm;
  const Ea = Ec - FW / 2 / mm, Eb = Ec + FW / 2 / mm, Na = Nc - FH / 2 / mm, Nb = Nc + FH / 2 / mm;
  if (layar || atur || +O.skala > 0) { // hanya titik & IUP yang masuk area peta yang dihitung di rekap/panel
    pts = pts.filter((p) => p.u[0] >= Ea && p.u[0] <= Eb && p.u[1] >= Na && p.u[1] <= Nb);
    poly = poly.filter((p) => Math.max(...p.u.map((c) => c[0])) >= Ea && Math.min(...p.u.map((c) => c[0])) <= Eb && Math.max(...p.u.map((c) => c[1])) >= Na && Math.min(...p.u.map((c) => c[1])) <= Nb); }
  const PU = (c) => `${X(c[0]).toFixed(2)},${Y(c[1]).toFixed(2)}`, PL = (lon, lat) => PU(UTM.ke(lon, lat));
  const ll0 = UTM.dari(Ea, Na), ll1 = UTM.dari(Eb, Nb), bbLL = [Math.min(ll0[0], ll1[0]) - 0.002, Math.min(ll0[1], ll1[1]) - 0.002, Math.max(ll0[0], ll1[0]) + 0.002, Math.max(ll0[1], ll1[1]) + 0.002];
  let g = "", gK = "", catSumber = [], adaKontur = false, adaCitra = false, adaHS = false, adaElev = false, adaLereng = false, latar = "", LAY = [], latarKurang = false;
  const taruh = (url, bb, op = 1) => { const a = UTM.ke(bb[0], bb[3]), b = UTM.ke(bb[2], bb[1]); return `<image href="${url}" x="${X(a[0])}" y="${Y(a[1])}" width="${X(b[0]) - X(a[0])}" height="${Y(b[1]) - Y(a[1])}" preserveAspectRatio="none" opacity="${op}"/>`; };
  if (T && UBIN_LATAR[T.basemap]) { const mz = await mosaikUbin(UBIN_LATAR[T.basemap], bbLL).catch(() => null); // latar sama dengan di layar
    if (mz) { g += taruh(mz.url, mz.bb); latar = T.basemap; latarKurang = !mz.lengkap; catSumber.push(T.basemap === "sat" ? "Citra satelit: Esri World Imagery (Maxar, Earthstar Geographics)" : "Peta dasar: © kontributor OpenStreetMap"); } else latarKurang = true; }
  try { // latar elevasi + kontur DEMNAS
    const I = await (await fetch("peta/kontur/index.json")).json(), bb = I.elevasi.bbox;
    if (!_elevCache) { const b = await (await fetch("peta/kontur/elevasi.png")).blob(); _elevCache = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }
    if (!V) g += taruh(_elevCache, bb, 0.45);
    else if (V.elev) { g += taruh(_elevCache, bb, T.opRel ?? 0.65); adaElev = true; }
    else if (V.lereng) { try { const lb = await (await fetch("peta/kontur/lereng.png")).blob(), lu = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(lb); }); g += taruh(lu, I.lereng?.bbox ?? bb, T.opRel ?? 0.65); adaLereng = true; } catch {} }
    const pakaiKontur = !V || V.kontur;
    if (pakaiKontur && !_konturCache) _konturCache = await (await fetch("peta/kontur/kontur.geojson")).json();
    const inBox = (c) => c[0] > bbLL[0] && c[0] < bbLL[2] && c[1] > bbLL[1] && c[1] < bbLL[3];
    for (const f of pakaiKontur ? _konturCache.features : []) { const c = f.geometry.coordinates; if (!c.some(inBox)) continue; const idx = f.properties.i === 1; adaKontur = true;
      gK += `<polyline points="${c.map((q) => PL(q[0], q[1])).join(" ")}" fill="none" stroke="${idx ? "#7a4a25" : "#a87a52"}" stroke-width="${idx ? 0.28 : 0.13}"/>`;
      if (idx) { const md = c[Math.floor(c.length / 2)]; if (inBox(md)) { const [x, y] = PL(md[0], md[1]).split(","); gK += `<text x="${x}" y="${y}" font-size="1.9" fill="#8a5a33" stroke="#fff" stroke-width=".5" paint-order="stroke">${esc(String(f.properties.z))}</text>`; } } }
    if (adaKontur || adaElev || adaLereng || !V || V.hs) catSumber.push(`Topografi: DEMNAS (Badan Informasi Geospasial)${adaKontur ? ", kontur 25 m (indeks 100 m)" : ""}${adaLereng ? ", kelas lereng Van Zuidam (1985)" : ""}`);
  } catch {}
  try { // citra drone & lapisan peta yang diunggah di aplikasi
    const kc = await kanvasCitra(bbLL, 2200, 2200 * (bbLL[3] - bbLL[1]) / (bbLL[2] - bbLL[0]) / Math.cos((((bbLL[1] + bbLL[3]) / 2) * Math.PI) / 180), { maksTile: 260, ...(T ? { hanya: new Set(T.citra ?? []), citra: (T.citra ?? []).length ? undefined : false } : {}) });
    if (kc.nama.length) { const a = UTM.ke(bbLL[0], bbLL[3]), b = UTM.ke(bbLL[2], bbLL[1]); g += `<image href="${kc.toDataURL("image/png")}" x="${X(a[0])}" y="${Y(a[1])}" width="${X(b[0]) - X(a[0])}" height="${Y(b[1]) - Y(a[1])}" preserveAspectRatio="none"/>`; adaCitra = true; catSumber.push("Citra drone: " + kc.nama.join(", ")); }
    if (V ? V.hs : O.hillshade !== "tidak") { const hs = await hillshadeKanvas(bbLL, { kuat: adaCitra ? 0.55 : 0.75 }).catch(() => null);
      if (hs) { const a = UTM.ke(hs.bb[0], hs.bb[3]), b = UTM.ke(hs.bb[2], hs.bb[1]); g += `<image href="${hs.url}" x="${X(a[0])}" y="${Y(a[1])}" width="${X(b[0]) - X(a[0])}" height="${Y(b[1]) - Y(a[1])}" preserveAspectRatio="none"/>`; adaHS = true; catSumber.push("Hillshade dari DEMNAS (cahaya barat laut 315°, tinggi 45°, relief ×2)"); } }
    g += gK; gK = "";
    LAY = (await daftarLapisan()).filter((l) => !T || (T.lapisan ?? []).includes(String(l.id))); if (LAY.length) g += svgLapisan(LAY, (c) => PL(c[0], c[1]), 0.9).replace(/stroke-width="2"/g, 'stroke-width=".35"');
  } catch {}
  g += gK;
  // grid geografis (biru muda) — interval mengikuti luas peta
  const dLon = bbLL[2] - bbLL[0], gI = [5, 10, 15, 30, 60, 120, 300, 600].map((s) => s / 3600).find((s) => dLon / s <= 6) ?? 0.25;
  const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a + 1e-9), mn = Math.floor((a - d) * 60 + 1e-7), sc = Math.round(((a - d) * 60 - mn) * 60); return `${d}° ${mn}' ${sc}" ${v >= 0 ? pos : neg}`; };
  let grid = "", lab = "";
  for (let lon = Math.ceil(bbLL[0] / gI) * gI; lon <= bbLL[2]; lon += gI) { const ln = []; for (let k = 0; k <= 20; k++) ln.push(PL(lon, bbLL[1] + ((bbLL[3] - bbLL[1]) * k) / 20)); grid += `<polyline points="${ln.join(" ")}" fill="none" stroke="#8cc8ee" stroke-width=".22"/>`;
    const xt = X(UTM.ke(lon, UTM.dari(Ec, Nb)[1])[0]), xb = X(UTM.ke(lon, UTM.dari(Ec, Na)[1])[0]);
    if (xt > FX + 4 && xt < FX + FW - 4) lab += `<text x="${xt}" y="${FY - 7.5}" font-size="2.3" text-anchor="middle">${dms(lon, "BT", "BB")}</text><text x="${xb}" y="${FY + FH + 9.8}" font-size="2.3" text-anchor="middle">${dms(lon, "BT", "BB")}</text>`; }
  for (let lat = Math.ceil(bbLL[1] / gI) * gI; lat <= bbLL[3]; lat += gI) { const ln = []; for (let k = 0; k <= 20; k++) ln.push(PL(bbLL[0] + ((bbLL[2] - bbLL[0]) * k) / 20, lat)); grid += `<polyline points="${ln.join(" ")}" fill="none" stroke="#8cc8ee" stroke-width=".22"/>`;
    const y = Y(UTM.ke(UTM.dari(Ea, Nc)[0], lat)[1]);
    if (y > FY + 4 && y < FY + FH - 4) lab += `<text transform="translate(${FX - 7},${y}) rotate(-90)" font-size="2.3" text-anchor="middle">${dms(lat, "LU", "LS")}</text><text transform="translate(${FX + FW + 7},${y}) rotate(90)" font-size="2.3" text-anchor="middle">${dms(lat, "LU", "LS")}</text>`; }
  // grid UTM: tanda di tepi + label mT/mU, silang di dalam peta
  const gs = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].find((s) => (Eb - Ea) / s <= 6) ?? 20000, ribu = (v) => Math.round(v).toLocaleString("id-ID");
  for (let E = Math.ceil(Ea / gs) * gs; E < Eb; E += gs) { const x = X(E); lab += `<line x1="${x}" y1="${FY}" x2="${x}" y2="${FY - 2}" stroke="#111" stroke-width=".2"/><line x1="${x}" y1="${FY + FH}" x2="${x}" y2="${FY + FH + 2}" stroke="#111" stroke-width=".2"/><text x="${x}" y="${FY - 2.8}" font-size="2" text-anchor="middle">${ribu(E)} mT</text><text x="${x}" y="${FY + FH + 4.6}" font-size="2" text-anchor="middle">${ribu(E)} mT</text>`;
    for (let N = Math.ceil(Na / gs) * gs; N < Nb; N += gs) { const y = Y(N); grid += `<path d="M${x - 1.6},${y}H${x + 1.6}M${x},${y - 1.6}V${y + 1.6}" stroke="#111" stroke-width=".22"/>`; } }
  for (let N = Math.ceil(Na / gs) * gs; N < Nb; N += gs) { const y = Y(N); lab += `<line x1="${FX}" y1="${y}" x2="${FX - 2}" y2="${y}" stroke="#111" stroke-width=".2"/><line x1="${FX + FW}" y1="${y}" x2="${FX + FW + 2}" y2="${y}" stroke="#111" stroke-width=".2"/><text transform="translate(${FX - 2.8},${y}) rotate(-90)" font-size="2" text-anchor="middle">${ribu(N)} mU</text><text transform="translate(${FX + FW + 2.8},${y}) rotate(90)" font-size="2" text-anchor="middle">${ribu(N)} mU</text>`; }
  // batas IUP
  for (const p of poly) g += `<polygon points="${p.u.map(PU).join(" ")}" fill="none" stroke="#e01b1b" stroke-width=".9"/>`;
  if (!V || V.iupno) for (const p of poly) p.u.forEach((c, k) => { const [x, y] = PU(c).split(",").map(Number); if (x < FX || x > FX + FW || y < FY || y > FY + FH) return;
    g += `<circle cx="${x}" cy="${y}" r=".55" fill="#e01b1b"/><text x="${x + 0.9}" y="${y - 0.7}" font-size="1.8" fill="#b00" stroke="#fff" stroke-width=".45" paint-order="stroke">${esc(String(p.titik[k]?.no ?? k + 1))}</text>`; });
  // titik bor
  const rT = Math.max(0.9, Math.min(1.6, 8 / Math.sqrt(Math.max(1, pts.length)))), fT = Math.max(1.6, Math.min(2.6, rT * 1.7));
  for (const p of [...pts].sort((a, b) => (a.status === "RENCANA" ? 0 : 1) - (b.status === "RENCANA" ? 0 : 1))) { const x = X(p.u[0]), y = Y(p.u[1]), r = p.status === "RENCANA" ? rT * 0.8 : rT;
    g += `<circle cx="${x}" cy="${y}" r="${r}" fill="${WARNA_STATUS[p.status] ?? "#999"}" stroke="${p.di_dalam_iup === false ? "#e00" : "#111"}" stroke-width="${p.di_dalam_iup === false ? 0.5 : 0.22}"/>${!V || V.lbl ? `<text x="${x + r + 0.6}" y="${y + fT * 0.35}" font-size="${fT}" font-weight="700" stroke="#fff" stroke-width=".55" paint-order="stroke">${esc(p.bhid)}</text>` : ""}`; }
  // rekap di pojok kiri bawah peta
  const nS = (k) => pts.filter((p) => (k === "EOH" ? ["EOH", "STB"].includes(p.status) : p.status === k)).length;
  const mBor = pts.reduce((s, p) => s + (+p.kedalaman || +p.kd || 0), 0), mRk = pts.reduce((s, p) => s + (+p.rencana_kedalaman || +p.rk || 0), 0);
  const tb = [["Rencana", nS("RENCANA")], ["Progres (sedang dibor)", nS("PROGRES")], ["Selesai (EOH / STB)", nS("EOH")], ["Total titik", pts.length]];
  const tx = FX + 3, ty = FY + FH - 30;
  g += `<rect x="${tx}" y="${ty}" width="72" height="27" fill="#fff" stroke="#111" stroke-width=".25"/><text x="${tx + 36}" y="${ty + 4}" font-size="2.4" font-weight="700" text-anchor="middle">REKAP TITIK BOR</text>
    ${tb.map(([a, b], i) => `<text x="${tx + 2}" y="${ty + 8.5 + i * 3.4}" font-size="2.2"${i === 3 ? ' font-weight="700"' : ""}>${a}</text><text x="${tx + 70}" y="${ty + 8.5 + i * 3.4}" font-size="2.2" text-anchor="end"${i === 3 ? ' font-weight="700"' : ""}>${b}</text>`).join("")}
    <text x="${tx + 2}" y="${ty + 23.2}" font-size="2.2">Meter dibor / rencana</text><text x="${tx + 70}" y="${ty + 23.2}" font-size="2.2" text-anchor="end">${mBor.toLocaleString("id-ID", { maximumFractionDigits: 1 })} / ${mRk ? mRk.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "–"} m</text>`;
  // luas IUP (UTM, rumus shoelace)
  const luas = poly.reduce((s, p) => { let a = 0; for (let i = 0, n = p.u.length; i < n; i++) { const [x1, y1] = p.u[i], [x2, y2] = p.u[(i + 1) % n]; a += x1 * y2 - x2 * y1; } return s + Math.abs(a) / 2; }, 0) / 1e4;
  // batang skala (≈ 80 mm, bulat)
  const sbM = [50, 100, 200, 250, 400, 500, 800, 1000, 1500, 2000, 2500, 4000, 5000, 10000, 20000].filter((v) => v * mm <= 82).pop() ?? 100, sbW = sbM * mm;
  const skalaSVG = `<svg viewBox="0 0 ${sbW + 12} 13" style="width:${sbW + 12}mm;height:13mm;display:block;margin:0 auto">${[0, 1, 2, 3].map((i) => `<rect x="${6 + (i * sbW) / 4}" y="4" width="${sbW / 4}" height="1.4" fill="${i % 2 ? "#fff" : "#111"}" stroke="#111" stroke-width=".15"/>`).join("")}
    ${[0, 1, 2, 3, 4].map((i) => `<text x="${6 + (i * sbW) / 4}" y="2.8" font-size="2" text-anchor="middle">${((i * sbW) / 4 / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 })}</text><text x="${6 + (i * sbW) / 4}" y="9" font-size="2" text-anchor="middle">${((i * sbM) / 4).toLocaleString("id-ID")}</text>`).join("")}<text x="${sbW + 9}" y="2.8" font-size="2">cm</text><text x="${sbW + 9}" y="9" font-size="2">m</text></svg>`;
  const [lc, la] = UTM.dari(Ec, Nc);
  const { inset, situasiKet, IW, IH } = await petaSituasi(lc, la, UTM.dari(Ea, Nb), UTM.dari(Eb, Na));
  const zonaTxt = `Universal Transverse Mercator (UTM) Zona ${ZU.zona} ${ZU.selatan ? "Selatan" : "Utara"}`;
  const sumber = [
    ...poly.map((x) => `Batas IUP: ${x.nama ?? "wilayah"}${x.nomor_sk ? " — " + x.nomor_sk : ""}`),
    `Titik bor: database X-Terra, keadaan ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, ...catSumber,
    ...(latarKurang ? ["Sebagian latar peta tidak termuat (belum pernah dibuka saat ada sinyal)"] : []),
    ...(LAY.length ? [`Lapisan peta: ${LAY.map((l) => l.nama).join(", ")}`] : []), "Peta situasi: © kontributor OpenStreetMap",
    ...String(O.dasar || "").split("\n").map((s) => s.trim()).filter(Boolean)];
  const leg = (sym, t) => `<div style="display:flex;align-items:center;gap:2mm;margin:.6mm 0"><span style="flex:0 0 9mm;display:flex;justify-content:center">${sym}</span><span>${t}</span></div>`;
  const dot = (c, r = 1.6) => `<svg viewBox="0 0 4 4" style="width:${r * 2}mm;height:${r * 2}mm"><circle cx="2" cy="2" r="1.7" fill="${c}" stroke="#111" stroke-width=".3"/></svg>`;
  const garis = (c, w = 0.6, da = "") => `<svg viewBox="0 0 9 2" style="width:9mm;height:2mm"><line x1="0" y1="1" x2="9" y2="1" stroke="${c}" stroke-width="${w}" ${da ? `stroke-dasharray="${da}"` : ""}/></svg>`;
  const thn = new Date().getFullYear(), tglTtd = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(O.judul)}</title><style>
    body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111}
    .sheet{position:relative;width:420mm;height:297mm;background:#fff;overflow:hidden;box-sizing:border-box}
    .pn{position:absolute;left:313mm;top:8mm;width:99mm;height:281mm;border:.35mm solid #111;box-sizing:border-box;display:flex;flex-direction:column;font-size:2.6mm}
    .pn>div{border-bottom:.25mm solid #111;padding:1.6mm 2.2mm}.pn>div:last-child{border-bottom:0}
    .c{text-align:center}.b{font-weight:700}.kv{display:grid;grid-template-columns:30mm 3mm 1fr;row-gap:.4mm}
    ol{margin:.5mm 0 0 4mm;padding:0}li{margin:.2mm 0}h4{margin:0 0 1mm;font-size:2.9mm;text-align:center}
  </style></head><body><div class="sheet">
  <svg viewBox="0 0 420 297" style="position:absolute;left:0;top:0;width:420mm;height:297mm;font-family:Arial,Helvetica,sans-serif">
    <rect x="4" y="4" width="412" height="289" fill="none" stroke="#111" stroke-width=".5"/>
    <defs><clipPath id="pk"><rect x="${FX}" y="${FY}" width="${FW}" height="${FH}"/></clipPath></defs>
    <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" fill="#f7f4ec"/>
    <g clip-path="url(#pk)">${g}${grid}</g>
    <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" fill="none" stroke="#111" stroke-width=".4"/>
    <rect x="${FX - 10.5}" y="${FY - 10.5}" width="${FW + 21}" height="${FH + 21}" fill="none" stroke="#111" stroke-width=".3"/>
    ${lab}
  </svg>
  <div class="pn">
    <div style="font-size:2.4mm">${esc(O.lampiran)}<div class="kv" style="grid-template-columns:14mm 3mm 1fr;margin-top:.8mm"><span>Nomor</span><span>:</span><span>${esc(O.nomor)}</span><span>Tanggal</span><span>:</span><span>${esc(O.tanggal)}</span></div></div>
    <div class="c">${O.logo ? `<img src="${O.logo}" style="max-height:16mm;max-width:60mm;display:block;margin:0 auto 1.5mm">` : ""}<div class="b" style="font-size:3.6mm;line-height:1.3">${esc(O.judul)}</div><div class="b" style="font-size:3mm;margin-top:.6mm">${esc(O.sub)}</div></div>
    <div><div class="kv"><span>Jumlah titik bor</span><span>:</span><span>${pts.length} titik (${nS("EOH")} selesai, ${nS("PROGRES")} progres, ${nS("RENCANA")} rencana)</span>${luas ? `<span>Luas IUP</span><span>:</span><span>${luas.toLocaleString("id-ID", { maximumFractionDigits: 2 })} Ha</span>` : ""}<span>Meter dibor</span><span>:</span><span>${mBor.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m</span></div></div>
    <div class="c"><div class="b" style="font-size:3.4mm;margin-bottom:1mm">Skala 1 : ${S.toLocaleString("id-ID")}</div>${skalaSVG}
      <svg viewBox="0 0 10 14" style="width:7mm;height:10mm;display:block;margin:1mm auto 0"><text x="5" y="3.4" font-size="3.6" text-anchor="middle" font-weight="700">U</text><polygon points="5,4.5 9,13.5 5,10.8 1,13.5" fill="#111"/></svg></div>
    <div><div class="kv" style="grid-template-columns:26mm 3mm 1fr;font-size:2.3mm"><span>Sistem Proyeksi</span><span>:</span><span>${zonaTxt}</span><span>Datum Horizontal</span><span>:</span><span>World Geodetic System 1984 (WGS 84)</span><span>Sistem Koordinat</span><span>:</span><span>Geografis (derajat) dan UTM (meter)</span><span>Interval Grid</span><span>:</span><span>Geografis ${gI >= 1 / 60 ? Math.round(gI * 60) + "'" : Math.round(gI * 3600) + '"'} ; UTM ${gs.toLocaleString("id-ID")} m</span></div></div>
    <div><h4>KETERANGAN</h4>
      ${poly.length ? leg(garis("#e01b1b", 0.9), "Batas IUP") : ""}
      ${!V || V.st?.RENCANA !== false ? leg(dot(WARNA_STATUS.RENCANA, 1.3), "Titik rencana pemboran") : ""}${!V || V.st?.PROGRES !== false ? leg(dot(WARNA_STATUS.PROGRES), "Titik bor progres (sedang dibor)") : ""}${!V || V.st?.EOH !== false || V.st?.STB !== false ? leg(dot(WARNA_STATUS.EOH), "Titik bor selesai (EOH / STB)") : ""}
      ${poly.length && (!V || V.iupno) ? leg(`<svg viewBox="0 0 4 4" style="width:2.4mm;height:2.4mm"><circle cx="2" cy="2" r="1.4" fill="#e01b1b"/></svg>`, "Titik koordinat batas IUP (nomor)") : ""}
      ${latar === "sat" ? leg(`<span style="display:inline-block;width:6mm;height:3mm;background:linear-gradient(90deg,#4b5b3a,#8a8f6a,#5d6b4a)"></span>`, "Citra satelit") : latar === "osm" ? leg(`<span style="display:inline-block;width:6mm;height:3mm;background:#f2efe9;border:.2mm solid #bbb"></span>`, "Peta dasar OpenStreetMap") : ""}
      ${adaElev ? leg(`<span style="display:inline-block;width:6mm;height:3mm;background:linear-gradient(90deg,#26734d,#e9d48a,#b5651d,#f5f5f5)"></span>`, "Warna elevasi (DEMNAS)") : ""}${adaLereng ? leg(`<span style="display:inline-block;width:6mm;height:3mm;background:linear-gradient(90deg,#2e8b57,#d4e157,#ff9800,#c62828)"></span>`, "Kemiringan lereng (datar → sangat curam)") : ""}
      ${pts.some((p) => p.di_dalam_iup === false) ? leg(`<svg viewBox="0 0 4 4" style="width:3.2mm;height:3.2mm"><circle cx="2" cy="2" r="1.6" fill="#fff" stroke="#e00" stroke-width=".6"/></svg>`, "Titik di luar batas IUP") : ""}
      ${adaKontur ? leg(garis("#8a5a33", 0.5), "Kontur indeks 100 m") + leg(garis("#b98a62", 0.25), "Kontur 25 m") : ""}
      ${LAY.map((l) => leg(garis(esc(l.warna || "#00b7ff"), 0.6), esc(l.nama))).join("")}
      ${leg(garis("#8cc8ee", 0.4), "Grid geografis")}${leg(`<svg viewBox="0 0 4 4" style="width:3mm;height:3mm"><path d="M0,2H4M2,0V4" stroke="#111" stroke-width=".4"/></svg>`, "Grid UTM")}
      ${adaCitra ? leg(`<span style="display:inline-block;width:6mm;height:3mm;background:linear-gradient(90deg,#6b7f4a,#9aa77a)"></span>`, "Citra drone") : ""}${adaHS ? leg(`<span style="display:inline-block;width:6mm;height:3mm;background:linear-gradient(135deg,#fff,#9a9a9a 55%,#444)"></span>`, "Bayangan relief (hillshade)") : ""}</div>
    <div style="font-size:2.2mm"><b>Sumber:</b><ol>${sumber.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
    ${O.catatan ? `<div style="font-size:2.2mm"><b>Catatan:</b><div style="white-space:pre-line;margin-top:.4mm">${esc(O.catatan)}</div></div>` : ""}
    <div><b style="font-size:2.4mm">Peta Situasi</b> <span style="font-size:2.2mm">— ${esc(situasiKet)}</span><div style="position:relative;width:${IW}mm;height:${IH}mm;overflow:hidden;border:.2mm solid #777;margin-top:.8mm;background:#aad3df">${inset}</div><div style="display:flex;align-items:center;gap:1.5mm;font-size:2.1mm;margin-top:.6mm"><span style="display:inline-block;width:3mm;height:2.2mm;border:.5mm solid #e01b1b"></span>Lokasi yang dipetakan</div></div>
    <div class="c" style="margin-top:auto;font-size:2.5mm">${esc(O.kota ? O.kota + ", " : "")}${tglTtd}<div class="b">${esc(O.perusahaan)}</div><div>${esc(O.jabatan)}</div><div style="height:15mm"></div><div class="b" style="text-decoration:underline">${esc(O.nama || "........................................")}</div></div>
    <div class="c" style="background:#f1f1f1"><div class="b" style="font-size:3.2mm">${esc(O.perusahaan)}</div><div>${thn}</div></div>
  </div></div></body></html>`;
}
async function petaSVG(L, o = {}) {
  const W = o.w ?? 900, H = o.h ?? 580, pad = 0.12;
  const Wl = JSON.parse(localStorage.getItem("wilayah") || "[]"), pts = L.filter((x) => Number.isFinite(+x.lon) && Number.isFinite(+x.lat)).map((x) => ({ ...x, ll: x.x != null ? UTM.dari(+x.x, +x.y) : [+x.lon, +x.lat] }));
  const semua = [...pts.map((p) => p.ll), ...Wl.flatMap((w) => (w.titik ?? []).map((t) => [t.lon, t.lat]))];
  if (!semua.length) return "<p>Belum ada titik bor untuk dipetakan.</p>";
  const fokus = pts.length ? pts.map((p) => p.ll) : semua;
  let [x0, x1] = [Math.min(...fokus.map((c) => c[0])), Math.max(...fokus.map((c) => c[0]))], [y0, y1] = [Math.min(...fokus.map((c) => c[1])), Math.max(...fokus.map((c) => c[1]))];
  const lc = (y0 + y1) / 2, kx = 111320 * Math.cos((lc * Math.PI) / 180), ky = 110574;
  let mw = Math.max((x1 - x0) * kx, 400), mh = Math.max((y1 - y0) * ky, 300); mw *= 1 + 2 * pad; mh *= 1 + 2 * pad;
  const sc = Math.min(W / mw, H / mh); mw = W / sc; mh = H / sc;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = cx - mw / 2 / kx; x1 = cx + mw / 2 / kx; y0 = cy - mh / 2 / ky; y1 = cy + mh / 2 / ky;
  const X = (lon) => ((lon - x0) * kx) * sc, Y = (lat) => ((y1 - lat) * ky) * sc, P = (c) => `${X(c[0]).toFixed(1)},${Y(c[1]).toFixed(1)}`;
  let g = "";
  try { // latar elevasi DEMNAS
    const I = await (await fetch("peta/kontur/index.json")).json(), bb = I.elevasi.bbox;
    if (!_elevCache) { const b = await (await fetch("peta/kontur/elevasi.png")).blob(); _elevCache = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }
    g += `<image href="${_elevCache}" x="${X(bb[0])}" y="${Y(bb[3])}" width="${X(bb[2]) - X(bb[0])}" height="${Y(bb[1]) - Y(bb[3])}" preserveAspectRatio="none" opacity=".55"/>`;
    if (!_konturCache) _konturCache = await (await fetch("peta/kontur/kontur.geojson")).json();
    const inBox = (c) => c[0] > x0 && c[0] < x1 && c[1] > y0 && c[1] < y1;
    for (const f of _konturCache.features) { const c = f.geometry.coordinates; if (!c.some(inBox)) continue; const idx = f.properties.i === 1;
      g += `<polyline points="${c.map(P).join(" ")}" fill="none" stroke="${idx ? "#6b4a2b" : "#9a7b5c"}" stroke-width="${idx ? 0.9 : 0.4}" opacity=".7"/>`;
      if (idx) { const mid = c[Math.floor(c.length / 2)]; if (inBox(mid)) g += `<text x="${X(mid[0])}" y="${Y(mid[1])}" font-size="8" fill="#6b4a2b" stroke="#fff" stroke-width="2" paint-order="stroke">${f.properties.z}</text>`; } }
  } catch {}
  let catCitra = "";
  try { // citra drone terbaru (ortofoto) di atas latar elevasi, lalu semua lapisan peta
    const kc = await kanvasCitra([x0, y0, x1, y1], W * 1.6, H * 1.6, { maksTile: 220 });
    if (kc.nama.length) { g += `<image href="${kc.toDataURL("image/png")}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`; catCitra = ` · citra: ${kc.nama.map(esc).join(", ")}`; }
    const LAY = await daftarLapisan(); if (LAY.length) { g += svgLapisan(LAY, P); catCitra += ` · lapisan: ${LAY.map((l) => esc(l.nama)).join(", ")}`; }
  } catch {}
  for (const w of Wl) if ((w.titik ?? []).length) g += `<polygon points="${w.titik.map((t) => P([t.lon, t.lat])).join(" ")}" fill="none" stroke="#d00" stroke-width="2" stroke-dasharray="7 4"/>`;
  if (o.grafik) { // grafik per lubang menempel di lokasinya (kolom zona, atau batang kedalaman vs rencana)
    const PR = o.grafik, maxD = Math.max(5, ...PR.map((r) => +r.sampai_m), ...pts.map((p) => +p.kedalaman || 0)), gh = o.gh ?? 70, gw = 13;
    const ada = pts.filter((p) => p.status !== "RENCANA" || PR.some((r) => r.bhid === p.bhid)), boxH = gh + 32, boxW = gw + 50;
    // kotak grafik disusun di kolom kiri/kanan peta (tidak saling menumpuk), dihubungkan garis ke titiknya
    const tata = (L2, kiri) => { const xs = kiri ? 70 : W - boxW - 14, maxY = kiri ? H - 40 : H - 100, n = Math.max(1, L2.length);
      const tinggi = Math.min(boxH + 8, (maxY - (kiri ? 64 : 26)) / n); L2.sort((a, b) => Y(a.ll[1]) - Y(b.ll[1]));
      let yk = kiri ? 64 : 26; const pos = L2.map((p) => { const ideal = Math.max(yk, Math.min(maxY - tinggi, Y(p.ll[1]) - tinggi / 2)); yk = ideal + tinggi; return ideal; });
      for (let k = pos.length - 1, bawah = maxY; k >= 0; k--) { pos[k] = Math.min(pos[k], bawah - tinggi); bawah = pos[k]; }
      return L2.map((p, k) => ({ p, gx: xs + 3, gy: pos[k] + 16, kiri, sk: Math.min(1, (tinggi - 8) / boxH) })); };
    const kiriL = o.panel ? ada : ada.filter((p) => X(p.ll[0]) < W / 2), kananL = o.panel ? [] : ada.filter((p) => X(p.ll[0]) >= W / 2);
    [...tata(kiriL, true), ...tata(kananL, false)].forEach(({ p, gx, gy: gy0, kiri, sk }) => {
      const x = X(p.ll[0]), y = Y(p.ll[1]), gh = (o.gh ?? 70) * sk, gy = gy0;
      g += `<line x1="${x}" y1="${y}" x2="${kiri ? gx + boxW - 3 : gx - 3}" y2="${gy + gh / 2}" stroke="#111" stroke-width=".9"/><rect x="${gx - 3}" y="${gy - 14}" width="${boxW}" height="${gh + 22}" rx="5" fill="#fff" opacity=".93" stroke="#777" stroke-width=".6"/>`;
      const R = PR.filter((r) => r.bhid === p.bhid), sy = gh / maxD;
      if (R.length) for (const r of R) g += `<rect x="${gx}" y="${gy + r.dari_m * sy}" width="${gw}" height="${Math.max(0.8, (r.sampai_m - r.dari_m) * sy)}" fill="${esc(r.warna)}" stroke="#222" stroke-width=".3"><title>${esc(r.nama_zona)} ${r.tebal_m} m</title></rect>`;
      else { const kd = +p.kedalaman || 0, rk = +p.rencana_kedalaman || 0; if (rk) g += `<rect x="${gx}" y="${gy}" width="${gw}" height="${rk * sy}" fill="none" stroke="#999" stroke-dasharray="2 2"/>`;
        g += `<rect x="${gx}" y="${gy}" width="${gw}" height="${Math.max(1, kd * sy)}" fill="${WARNA_STATUS[p.status] ?? "#999"}" stroke="#222" stroke-width=".4"/>`; }
      const d = R.length ? Math.max(...R.map((r) => +r.sampai_m)) : +p.kedalaman || 0;
      g += `<text x="${gx - 1}" y="${gy - 4}" font-size="8.5" font-weight="700">${esc(p.bhid)}</text><text x="${gx + gw + 3}" y="${gy + 9}" font-size="8">${d ? d.toFixed(1) + " m" : "–"}</text>${p.rencana_kedalaman ? `<text x="${gx + gw + 3}" y="${gy + 19}" font-size="7.5" fill="#666">/${p.rencana_kedalaman} m</text>` : ""}${p.rec != null ? `<text x="${gx + gw + 3}" y="${gy + 29}" font-size="7.5" fill="${p.rec < 90 ? "#c00" : "#1E9E69"}">Rec ${Math.round(p.rec)}%</text>` : ""}`;
    });
  }
  for (const p of pts) { const r = p.status === "RENCANA" ? 5 : 7, x = X(p.ll[0]), y = Y(p.ll[1]);
    g += `<circle cx="${x}" cy="${y}" r="${r}" fill="${WARNA_STATUS[p.status] ?? "#999"}" stroke="${p.di_dalam_iup === false ? "#e00" : "#111"}" stroke-width="${p.di_dalam_iup === false ? 3 : 1.4}"/>
      <text x="${x + r + 3}" y="${y + 3}" font-size="10" font-weight="700" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(p.bhid)}</text>`; }
  // skala, utara, grid UTM
  const nice = [50, 100, 200, 250, 500, 1000, 2000, 5000].find((m) => m * sc >= W / 8) ?? 5000, bx = 16, by = 34;
  g += `<rect x="${bx - 6}" y="${by - 18}" width="${nice * sc + 52}" height="28" fill="#fff" opacity=".85"/><rect x="${bx}" y="${by}" width="${(nice * sc) / 2}" height="5" fill="#111"/><rect x="${bx + (nice * sc) / 2}" y="${by}" width="${(nice * sc) / 2}" height="5" fill="#fff" stroke="#111"/>
    <text x="${bx}" y="${by - 4}" font-size="9">0</text><text x="${bx + nice * sc}" y="${by - 4}" font-size="9" text-anchor="middle">${nice >= 1000 ? nice / 1000 + " km" : nice + " m"}</text>`;
  const pw = o.panelW ?? 268;
  if (o.panel?.length) { // panel grafik ringkas di sisi kanan peta
    let py = 12; const tinggiPanel = (H - 104 - 12 - 8 * (o.panel.length - 1)) / o.panel.length;
    for (const pn of o.panel) { const ph = Math.min(pn.h ?? 130, tinggiPanel);
      g += `<rect x="${W - pw - 12}" y="${py}" width="${pw}" height="${ph}" rx="10" fill="#fff" opacity=".94" stroke="#cfd8d3"/><text x="${W - pw - 2}" y="${py + 16}" font-size="11.5" font-weight="700" fill="#12251E">${esc(pn.judul)}</text>
        ${pn.svg.replace("<svg ", `<svg x="${W - pw - 6}" y="${py + 20}" width="${pw - 12}" height="${ph - 24}" preserveAspectRatio="xMidYMid meet" `)}`; py += ph + 8; } }
  g += `<g transform="translate(${o.panel?.length ? W - pw - 34 : W - 30},34)"><polygon points="0,-20 7,4 0,-2 -7,4" fill="#111"/><text y="18" font-size="12" font-weight="700" text-anchor="middle">U</text></g>`;
  const u0 = UTM.ke(x0, y0), u1 = UTM.ke(x1, y1), gs = [100, 250, 500, 1000, 2000].find((s) => (u1[0] - u0[0]) / s <= 6) ?? 5000;
  for (let e = Math.ceil(u0[0] / gs) * gs; e < u1[0]; e += gs) { const ll = UTM.dari(e, (u0[1] + u1[1]) / 2), x = X(ll[0]); g += `<line x1="${x}" y1="0" x2="${x}" y2="6" stroke="#111"/><text x="${x}" y="16" font-size="8" text-anchor="middle">${e}</text>`; }
  for (let n = Math.ceil(u0[1] / gs) * gs; n < u1[1]; n += gs) { const ll = UTM.dari((u0[0] + u1[0]) / 2, n), y = Y(ll[1]); g += `<line x1="0" y1="${y}" x2="6" y2="${y}" stroke="#111"/><text x="8" y="${y + 3}" font-size="8">${n}</text>`; }
  const leg = [["RENCANA", "Rencana"], ["PROGRES", "Progres"], ["EOH", "EOH / STB (selesai)"]].map(([k, t], i) => `<circle cx="${W - 150}" cy="${H - 64 + i * 15}" r="5" fill="${WARNA_STATUS[k]}" stroke="#111"/><text x="${W - 140}" y="${H - 61 + i * 15}" font-size="10">${t}</text>`).join("");
  g += `<rect x="${W - 160}" y="${H - 78}" width="152" height="70" fill="#fff" opacity=".9" stroke="#999"/>${leg}<line x1="${W - 156}" y1="${H - 16}" x2="${W - 142}" y2="${H - 16}" stroke="#d00" stroke-width="2" stroke-dasharray="5 3"/><text x="${W - 140}" y="${H - 13}" font-size="10">Batas IUP</text>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="border:1px solid #333;background:#f4f1ea;max-width:100%;height:auto;font-family:Arial,sans-serif"><defs><clipPath id="cp"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#cp)">${g}</g></svg>
    <div style="font-size:10px;color:#555">Grid UTM zona 51S (WGS84) · latar elevasi DEMNAS, kontur 25 m (tebal tiap 100 m)${catCitra} · posisi titik: collar/GPS Mulai bor/rencana</div>`;
}
const fmtTgl = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "");
// ---------- Statistik pemboran & geologi (untuk presentasi dan laporan) ----------
const stat = (xs) => { const v = xs.map(Number).filter(Number.isFinite).sort((a, b) => a - b), n = v.length; if (!n) return { n: 0 };
  const q = (p) => { const i = (n - 1) * p, a = Math.floor(i); return v[a] + (v[Math.min(n - 1, a + 1)] - v[a]) * (i - a); }, mean = v.reduce((s, x) => s + x, 0) / n;
  return { n, min: v[0], max: v[n - 1], mean, med: q(0.5), q1: q(0.25), q3: q(0.75), sd: n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0, sum: v.reduce((s, x) => s + x, 0) }; };
function statistikData({ dayRows, HR, LB, prof, st, PJ, mCum }) {
  const f = (x, d = 1) => (x == null || !Number.isFinite(+x) ? "–" : (+x).toFixed(d));
  const aktif = dayRows.filter((r) => r[2] > 0), kal = Math.max(1, Math.round((new Date(st.to) - new Date(st.from)) / 864e5) + 1);
  const sH = stat(aktif.map((r) => r[2])), best = aktif.reduce((a, r) => (!a || r[2] > a[2] ? r : a), null);
  const selesai = LB.filter((x) => ["EOH", "STB", "SELESAI"].includes(x.status)), sEOH = stat(selesai.map((x) => x.kedalaman));
  const sRec = stat(HR.map((h) => h.rec)), recOk = HR.filter((h) => h.rec != null && h.rec >= 90).length;
  const tgtM = +PJ?.target_meter || LB.reduce((s, x) => s + (+x.rencana_kedalaman || 0), 0), sisa = Math.max(0, tgtM - mCum), laju = sH.n ? (sH.sum / kal) : 0;
  const hariLagi = laju > 0 && sisa > 0 ? Math.ceil(sisa / laju) : null, eta = hariLagi ? new Date(new Date(st.to).getTime() + hariLagi * 864e5).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : null;
  // ketebalan per lubang per zona
  const Z = {}; for (const r of prof ?? []) { const z = (Z[r.zona] ??= { nama: r.nama_zona, warna: r.warna, per: {} }); z.per[r.bhid] = (z.per[r.bhid] ?? 0) + +r.tebal_m; }
  const zona = Object.entries(Z).map(([k, z]) => ({ k, ...z, s: stat(Object.values(z.per)) }));
  const bh = [...new Set((prof ?? []).map((r) => r.bhid))], tebalDi = (b, ks) => (prof ?? []).filter((r) => r.bhid === b && ks.includes(r.zona)).reduce((s, r) => s + +r.tebal_m, 0);
  const sOB = stat(bh.map((b) => tebalDi(b, ["TP", "SED"]))), sL = stat(bh.map((b) => tebalDi(b, ["L"])).filter((x) => x > 0)), sS = stat(bh.map((b) => tebalDi(b, ["S"])).filter((x) => x > 0));   // hanya lubang yang menembus zona itu (sama dengan tabel)
  const sBR = stat(bh.map((b) => { const r = (prof ?? []).filter((x) => x.bhid === b && ["BR", "BZ", "BD"].includes(x.zona)); return r.length ? Math.min(...r.map((x) => +x.dari_m)) : null; }).filter((x) => x != null));
  return { f, aktif, kal, sH, best, selesai, sEOH, sRec, recOk, tgtM, sisa, laju, hariLagi, eta, zona, bh, sOB, sL, sS, sBR };
}
function boxSVG(rows, o = {}) { // rows: [{label, warna, s}]
  const W = o.w ?? 560, rh = 34, H = rows.length * rh + 40, mx = Math.max(1, ...rows.map((r) => r.s.max ?? 0)) * 1.08, X = (v) => 110 + ((W - 130) * v) / mx;
  let g = ""; for (let t = 0; t <= mx; t += [1, 2, 5, 10, 20, 50].find((s) => mx / s <= 8) ?? 100) g += `<line x1="${X(t)}" x2="${X(t)}" y1="10" y2="${H - 22}" stroke="#e3e8e1"/><text x="${X(t)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#6b7a72">${t}</text>`;
  rows.forEach((r, i) => { const y = 18 + i * rh, s = r.s; g += `<text x="104" y="${y + 13}" font-size="12" text-anchor="end">${esc(r.label)}</text>`; if (!s.n) return;
    g += `<line x1="${X(s.min)}" x2="${X(s.max)}" y1="${y + 9}" y2="${y + 9}" stroke="#333"/><line x1="${X(s.min)}" x2="${X(s.min)}" y1="${y + 3}" y2="${y + 15}" stroke="#333"/><line x1="${X(s.max)}" x2="${X(s.max)}" y1="${y + 3}" y2="${y + 15}" stroke="#333"/>
      <rect x="${X(s.q1)}" y="${y}" width="${Math.max(2, X(s.q3) - X(s.q1))}" height="18" fill="${esc(r.warna)}" opacity=".85" stroke="#222"/><line x1="${X(s.med)}" x2="${X(s.med)}" y1="${y}" y2="${y + 18}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="${X(s.mean)}" cy="${y + 9}" r="3.5" fill="#fff" stroke="#111"/><text x="${X(s.max) + 6}" y="${y + 13}" font-size="11" fill="#333">n=${s.n}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${o.maxH ?? 300}px;font-family:Arial,sans-serif">${g}<text x="${W - 4}" y="10" font-size="11" text-anchor="end" fill="#6b7a72">${esc(o.unit ?? "m")}</text></svg>
    <div style="font-size:11px;color:#6b7a72">Kotak = kuartil 25–75%, garis putih = median, bulatan = rata-rata, garis = min–maks.</div>`;
}
function histSVG(vals, o = {}) {
  const v = vals.filter((x) => x > 0); if (!v.length) return "";
  const W = o.w ?? 560, H = 220, mn = Math.floor(Math.min(...v)), mx = Math.ceil(Math.max(...v)), nb = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(v.length)))), bw = Math.max(0.5, (mx - mn) / nb), B = Array(nb).fill(0);
  v.forEach((x) => B[Math.min(nb - 1, Math.floor((x - mn) / bw))]++); const top = Math.max(...B), cw = (W - 60) / nb;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:230px;font-family:Arial,sans-serif">${B.map((c, i) => `<rect x="${44 + i * cw + 2}" y="${H - 34 - ((H - 60) * c) / top}" width="${cw - 4}" height="${((H - 60) * c) / top}" rx="3" fill="#1E9E69"/><text x="${44 + i * cw + cw / 2}" y="${H - 38 - ((H - 60) * c) / top}" font-size="11" text-anchor="middle">${c || ""}</text><text x="${44 + i * cw + cw / 2}" y="${H - 18}" font-size="10.5" text-anchor="middle" fill="#6b7a72">${(mn + i * bw).toFixed(1)}–${(mn + (i + 1) * bw).toFixed(1)}</text>`).join("")}
    <text x="${W / 2}" y="${H - 2}" font-size="11" text-anchor="middle" fill="#6b7a72">${esc(o.label ?? "")}</text><text x="10" y="14" font-size="11" fill="#6b7a72">jumlah hari</text></svg>`;
}
// lereng tanah (derajat) di satu titik dari DEMNAS, beda tinggi ±10 m
async function lerengTitik(lon, lat) { const d = 10 / 111320, dx = d / Math.cos((lat * Math.PI) / 180);
  const [e, w, n, s2] = await Promise.all([tinggiDi(lon + dx, lat), tinggiDi(lon - dx, lat), tinggiDi(lon, lat + d), tinggiDi(lon, lat - d)].map((p) => p.catch(() => null)));
  if ([e, w, n, s2].some((x) => x == null)) return null; return (Math.atan(Math.hypot((e - w) / 20, (n - s2) / 20)) * 180) / Math.PI; }
const WARNA_RIG = ["#1E9E69", "#E0A100", "#2563EB", "#D62828", "#7C3AED", "#0891B2"];
// grafik batang bertumpuk meter harian per rig
function rigHarianSVG(days, rigs, o = {}) {
  const tg = [...new Set(days.map((d) => d.tanggal))].sort(); if (!tg.length) return `<p class="kosong">Belum ada data harian.</p>`;
  const M = (t, r) => days.filter((d) => d.tanggal === t && d.rig === r).reduce((s, d) => s + (+d.meter_bor || 0), 0);
  const tot = tg.map((t) => rigs.reduce((s, r) => s + M(t, r), 0)), mx = Math.max(1, ...tot), W = o.w ?? 1120, H = o.h ?? 250, bw = Math.max(4, Math.min(46, (W - 70) / tg.length - 4)), Y = (v) => H - 28 - ((H - 50) * v) / mx;
  let g = [0, 0.5, 1].map((f) => `<line x1="44" x2="${W}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="#e3e8e1"/><text x="38" y="${Y(mx * f) + 4}" font-size="12" text-anchor="end" fill="#6b7a72">${(mx * f).toFixed(0)}</text>`).join("");
  tg.forEach((t, i) => { let b = 0; const x = 50 + i * (bw + 4); rigs.forEach((r, k) => { const m = M(t, r); if (!m) return; g += `<rect x="${x}" y="${Y(b + m)}" width="${bw}" height="${Y(b) - Y(b + m)}" fill="${WARNA_RIG[k % WARNA_RIG.length]}"><title>${t} ${esc(r)}: ${m.toFixed(1)} m</title></rect>`; b += m; });
    if (i % Math.ceil(tg.length / 12) === 0) g += `<text x="${x + bw / 2}" y="${H - 10}" font-size="11" text-anchor="middle" fill="#6b7a72">${t.slice(5)}</text>`; });
  g += rigs.map((r, k) => `<rect x="${60 + k * 110}" y="4" width="12" height="12" fill="${WARNA_RIG[k % WARNA_RIG.length]}"/><text x="${77 + k * 110}" y="14" font-size="12">${esc(r)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${o.maxH ?? 250}px;font-family:Arial,sans-serif">${g}</svg>`;
}
// histogram kecil satu layer
function histKecil(vals, warna, judul) {
  const v = vals.filter((x) => x > 0); const W = 200, H = 128; if (!v.length) return "";
  const mn = Math.floor(Math.min(...v)), mx = Math.ceil(Math.max(...v)), nb = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(v.length)) + 1)), bw = Math.max(0.5, (mx - mn) / nb), B = Array(nb).fill(0);
  v.forEach((x) => B[Math.min(nb - 1, Math.floor((x - mn) / bw))]++); const top = Math.max(...B), cw = (W - 30) / nb;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:Arial,sans-serif"><text x="4" y="12" font-size="11.5" font-weight="700">${esc(judul)}</text><text x="${W - 4}" y="12" font-size="10" text-anchor="end" fill="#6b7a72">n=${v.length}</text>
    ${B.map((c, i) => `<rect x="${20 + i * cw + 1}" y="${H - 28 - ((H - 58) * c) / top}" width="${cw - 2}" height="${((H - 58) * c) / top}" fill="${esc(warna)}" stroke="#222" stroke-width=".4"/>${c ? `<text x="${20 + i * cw + cw / 2}" y="${H - 31 - ((H - 58) * c) / top}" font-size="10" text-anchor="middle">${c}</text>` : ""}<text x="${20 + i * cw + cw / 2}" y="${H - 14}" font-size="9" text-anchor="middle" fill="#6b7a72">${(mn + i * bw).toFixed(1)}</text>`).join("")}
    <text x="${W - 4}" y="${H - 2}" font-size="9" text-anchor="end" fill="#6b7a72">tebal (m)</text></svg>`;
}
// sebaran kedalaman atas–bawah rata-rata tiap layer
function kedalamanLayerSVG(zona) {
  const W = 560, rh = 30, H = zona.length * rh + 40, mx = Math.max(1, ...zona.map((z) => z.bawahMax)) * 1.05, X = (v) => 110 + ((W - 140) * v) / mx;
  let g = ""; for (let t = 0; t <= mx; t += [1, 2, 5, 10].find((s) => mx / s <= 8) ?? 20) g += `<line x1="${X(t)}" x2="${X(t)}" y1="8" y2="${H - 22}" stroke="#e3e8e1"/><text x="${X(t)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#6b7a72">${t}</text>`;
  zona.forEach((z, i) => { const y = 14 + i * rh; g += `<text x="104" y="${y + 12}" font-size="12" text-anchor="end">${esc(z.nama)}</text>
    <line x1="${X(z.atasMin)}" x2="${X(z.bawahMax)}" y1="${y + 8}" y2="${y + 8}" stroke="#999" stroke-dasharray="3 2"/><rect x="${X(z.atas)}" y="${y}" width="${Math.max(2, X(z.bawah) - X(z.atas))}" height="16" fill="${esc(z.warna)}" stroke="#222" stroke-width=".5"/>
    <text x="${X(z.bawahMax) + 6}" y="${y + 12}" font-size="10.5" fill="#333">${z.atas.toFixed(1)}–${z.bawah.toFixed(1)} m</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${zona.length > 5 ? 250 : 220}px;font-family:Arial,sans-serif">${g}<text x="${W - 4}" y="10" font-size="11" text-anchor="end" fill="#6b7a72">kedalaman (m)</text></svg>
    <div style="font-size:11px;color:#6b7a72">Kotak = kedalaman atas rata-rata s.d. bawah rata-rata; garis putus = paling dangkal s.d. paling dalam.</div>`;
}
// diagram pencar + garis regresi linear, r dan n
function pencarSVG(P, o) {
  const W = 360, H = 230, ok = P.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const head = `<text x="4" y="13" font-size="12" font-weight="700">${esc(o.judul)}</text>`;
  if (ok.length < 2) return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:Arial,sans-serif">${head}<text x="${W / 2}" y="${H / 2}" font-size="12" text-anchor="middle" fill="#6b7a72">data belum cukup (n=${ok.length})</text></svg>`;
  const xs = ok.map((p) => p.x), ys = ok.map((p) => p.y), x0 = Math.min(0, ...xs), x1 = Math.max(...xs) * 1.1 || 1, y0 = Math.min(0, ...ys), y1 = Math.max(...ys) * 1.1 || 1;
  const X = (v) => 40 + ((W - 55) * (v - x0)) / (x1 - x0), Y = (v) => H - 34 - ((H - 60) * (v - y0)) / (y1 - y0), n = ok.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n, sxy = ok.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0), sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0), syy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const b = sxx ? sxy / sxx : 0, a = my - b * mx, r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0, kuat = Math.abs(r) >= 0.7 ? "kuat" : Math.abs(r) >= 0.4 ? "sedang" : "lemah";
  let g = head; for (const t of [0, 0.5, 1]) { const vx = x0 + (x1 - x0) * t, vy = y0 + (y1 - y0) * t; g += `<text x="${X(vx)}" y="${H - 20}" font-size="10" text-anchor="middle" fill="#6b7a72">${vx.toFixed(0)}</text><text x="34" y="${Y(vy) + 3}" font-size="10" text-anchor="end" fill="#6b7a72">${vy.toFixed(0)}</text><line x1="40" x2="${W - 15}" y1="${Y(vy)}" y2="${Y(vy)}" stroke="#eef2ef"/>`; }
  g += `<line x1="40" x2="${W - 15}" y1="${H - 34}" y2="${H - 34}" stroke="#999"/><line x1="40" x2="40" y1="22" y2="${H - 34}" stroke="#999"/>`;
  if (sxx && n >= 3) g += `<line x1="${X(x0)}" y1="${Y(a + b * x0)}" x2="${X(x1)}" y2="${Y(a + b * x1)}" stroke="#D62828" stroke-width="1.5" stroke-dasharray="5 3"/>`;
  g += ok.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="${esc(p.c ?? "#1E9E69")}" stroke="#111" stroke-width=".8"><title>${esc(p.t ?? "")}: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}</title></circle>`).join("");
  g += `<text x="${(W + 40) / 2}" y="${H - 4}" font-size="11" text-anchor="middle">${esc(o.sx)}</text><text x="10" y="${H / 2}" font-size="11" text-anchor="middle" transform="rotate(-90 10 ${H / 2})">${esc(o.sy)}</text>
    <text x="${W - 15}" y="30" font-size="11" text-anchor="end" fill="${n >= 3 ? "#D62828" : "#6b7a72"}">${n >= 3 ? `r = ${r.toFixed(2)} (${kuat}) · n = ${n}${n < 5 ? " · belum stabil" : ""}` : `n = ${n} — korelasi belum bisa dihitung`}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:Arial,sans-serif;background:#fbfcfb;border:1px solid #e3e8e1;border-radius:8px;max-height:${o.maxH ?? 999}px">${g}</svg>`;
}
// recovery core tertimbang panjang: Σ panjang core / Σ panjang interval (Form Logging); bila belum ada, pakai recovery harian (DDR/progres)
async function recoveryData(LB, HR = [], prof = []) {
  let G = []; try { const bh = LB.map((x) => x.bhid); if (typeof sb !== "undefined" && bh.length && online()) G = (await sb.from("v_dh_geology").select("holeid,from,to,zone,core_length,recovery_pct").in("holeid", bh)).data ?? []; } catch {}
  const ZW = {}; for (const r of prof ?? []) ZW[r.zona] ??= { nama: r.nama_zona, warna: r.warna };
  const agg = (xs) => { let L = 0, C = 0, n = 0, low = 0; for (const g of xs) { const len = +g.to - +g.from; if (!(len > 0)) continue;
      const c = g.core_length != null && g.core_length !== "" ? +g.core_length : g.recovery_pct != null && g.recovery_pct !== "" ? (len * +g.recovery_pct) / 100 : null; if (c == null || !Number.isFinite(c)) continue;
      L += len; C += c; n++; if (c / len < 0.9) low++; } return { v: L ? (100 * C) / L : null, m: L, n, low }; };
  const warnaR = (v) => (v == null ? "#9CA3AF" : v >= 90 ? "#1E9E69" : v >= 80 ? "#E0A100" : "#D62828");
  const bhs = [...new Set([...G.map((g) => g.holeid), ...HR.filter((h) => h.rec != null).map((h) => h.b)])].sort();
  const lubang = bhs.map((b) => { const a = agg(G.filter((g) => g.holeid === b)), hr = HR.find((h) => h.b === b)?.rec; const v = a.v ?? (hr != null ? +hr : null);
    return { label: b, v: v ?? 0, nilai: v, t: v != null ? `${v.toFixed(1)}%` : "–", sub: a.n ? `${a.n} int · ${a.m.toFixed(1)} m${a.low ? ` · ${a.low} <90%` : ""}` : "dari laporan harian", c: warnaR(v), sumber: a.n ? "logging" : "harian" }; });
  const zk = [...new Set(G.map((g) => g.zone).filter(Boolean))];
  const layer = zk.map((k) => { const a = agg(G.filter((g) => g.zone === k)); return { k, nama: ZW[k]?.nama ?? k, warnaZ: ZW[k]?.warna ?? "#94a3b8", ...a, label: ZW[k]?.nama ?? k, nilai: a.v, t: a.v != null ? `${a.v.toFixed(1)}%` : "–", sub: `${a.n} int · ${a.m.toFixed(1)} m${a.low ? ` · ${a.low} <90%` : ""}`, c: warnaR(a.v) }; })
    .filter((z) => z.n).sort((a, b) => (ZW[a.k] ? 0 : 1) - (ZW[b.k] ? 0 : 1));
  const all = agg(G), hv = lubang.filter((x) => x.nilai != null);
  const total = all.v ?? (hv.length ? hv.reduce((s, x) => s + x.nilai, 0) / hv.length : null);
  const titik = G.filter((g) => +g.to > +g.from).map((g) => { const len = +g.to - +g.from, c = g.core_length != null ? +g.core_length : g.recovery_pct != null ? (len * +g.recovery_pct) / 100 : NaN;
    return { x: (+g.from + +g.to) / 2, y: (100 * c) / len, t: `${g.holeid} ${g.zone ?? ""}`, c: ZW[g.zone]?.warna ?? "#94a3b8" }; }).filter((p) => Number.isFinite(p.y));
  return { lubang, layer, total, nInt: all.n, mInt: all.m, low: all.low, titik, adaLogging: G.length > 0, okLubang: hv.filter((x) => x.nilai >= 90).length, nLubang: hv.length };
}
// data analisis layer, per rig, dan hubungan
async function analisisData(LB, prof, days) {
  const PR = prof ?? [], bh = [...new Set(PR.map((r) => r.bhid))], RIG = Object.fromEntries(LB.map((x) => [x.bhid, x.rig || "-"]));
  const Z = {}; for (const r of PR) { const z = (Z[r.zona] ??= { k: r.zona, nama: r.nama_zona, warna: r.warna, per: {}, atasL: {}, bawahL: {} }); z.per[r.bhid] = (z.per[r.bhid] ?? 0) + +r.tebal_m;
    z.atasL[r.bhid] = Math.min(z.atasL[r.bhid] ?? 1e9, +r.dari_m); z.bawahL[r.bhid] = Math.max(z.bawahL[r.bhid] ?? -1, +r.sampai_m); }
  const zona = Object.values(Z).map((z) => { const at = Object.values(z.atasL), bw = Object.values(z.bawahL); return { ...z, tebal: Object.values(z.per), atas: at.reduce((a, b) => a + b, 0) / at.length, bawah: bw.reduce((a, b) => a + b, 0) / bw.length, atasMin: Math.min(...at), bawahMax: Math.max(...bw) }; }).sort((a, b) => a.atas - b.atas);
  const eoh = (b) => Math.max(...PR.filter((r) => r.bhid === b).map((r) => +r.sampai_m)), tb = (b, k) => PR.filter((r) => r.bhid === b && r.zona === k).reduce((s, r) => s + +r.tebal_m, 0);
  const lereng = {}; for (const x of LB.filter((x) => bh.includes(x.bhid) || +x.kedalaman > 0)) if (Number.isFinite(+x.lon)) lereng[x.bhid] = await lerengTitik(+x.lon, +x.lat).catch(() => null);
  const dalam = (b) => (bh.includes(b) ? eoh(b) : +LB.find((x) => x.bhid === b)?.kedalaman || null);
  const titik = (fx, fy, bs, c) => bs.map((b) => ({ x: fx(b), y: fy(b), t: b, c })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const hub = {
    eohL: titik(eoh, (b) => tb(b, "L"), bh.filter((b) => tb(b, "L") > 0), "#D62828"),
    eohS: titik(eoh, (b) => tb(b, "S"), bh.filter((b) => tb(b, "S") > 0), "#9AAE3A"),
    lerEoh: titik((b) => lereng[b], dalam, Object.keys(lereng), "#1E9E69"),
    lerL: titik((b) => lereng[b], (b) => tb(b, "L"), bh.filter((b) => tb(b, "L") > 0), "#D62828"),
  };
  // per rig
  const rigs = [...new Set([...days.map((d) => d.rig), ...LB.filter((x) => x.rig && x.status !== "RENCANA").map((x) => x.rig)])].filter(Boolean).sort();
  const perRig = rigs.map((r) => { const dd = days.filter((d) => d.rig === r), akt = dd.filter((d) => +d.meter_bor > 0), sm = stat(akt.map((d) => +d.meter_bor)), lb = LB.filter((x) => x.rig === r && x.status !== "RENCANA");
    const bR = bh.filter((b) => RIG[b] === r), tz = (k) => stat(bR.map((b) => tb(b, k)).filter((x) => x > 0));
    return { r, hari: akt.length, meter: sm.sum ?? 0, sm, lubang: lb.length, selesai: lb.filter((x) => ["EOH", "STB", "SELESAI"].includes(x.status)).length, totDalam: lb.reduce((s, x) => s + (+x.kedalaman || 0), 0),
      jam: dd.reduce((s, d) => s + (+d.jam_kerja_bor || 0), 0), L: tz("L"), S: tz("S"), OB: stat(bR.map((b) => tb(b, "TP") + tb(b, "SED")).filter((x) => x > 0)), nLog: bR.length }; });
  return { zona, hub, perRig, rigs, lereng };
}
// ---------- panel grafik ringkas untuk di atas peta ----------
function panelStatus(LB, mCum, tgtM) {
  const n = { RENCANA: 0, PROGRES: 0, EOH: 0 }; for (const x of LB) n[["EOH", "STB", "SELESAI"].includes(x.status) ? "EOH" : x.status === "PROGRES" ? "PROGRES" : "RENCANA"]++;
  const tot = Math.max(1, LB.length), R = 34, cx = 48, cy = 48; let a0 = -Math.PI / 2, arc = "";
  for (const [k, w] of [["EOH", WARNA_STATUS.EOH], ["PROGRES", WARNA_STATUS.PROGRES], ["RENCANA", "#dfe6e2"]]) { const a1 = a0 + (2 * Math.PI * n[k]) / tot; if (n[k]) arc += n[k] === tot ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${w}" stroke-width="16"/>` : `<path d="M${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}" fill="none" stroke="${w}" stroke-width="16"/>`; a0 = a1; }
  const p = tgtM ? Math.min(100, Math.round((100 * mCum) / tgtM)) : null;
  return `<svg viewBox="0 0 250 100">${arc}<text x="${cx}" y="${cy + 2}" font-size="15" font-weight="800" text-anchor="middle">${n.EOH}/${tot}</text><text x="${cx}" y="${cy + 15}" font-size="8" text-anchor="middle" fill="#6b7a72">selesai</text>
    ${[["EOH / STB", n.EOH, WARNA_STATUS.EOH], ["Progres", n.PROGRES, WARNA_STATUS.PROGRES], ["Rencana", n.RENCANA, "#dfe6e2"]].map(([t, v, w], i) => `<rect x="104" y="${14 + i * 17}" width="10" height="10" rx="2" fill="${w}" stroke="#999" stroke-width=".5"/><text x="119" y="${23 + i * 17}" font-size="11">${t} <tspan font-weight="700">${v}</tspan></text>`).join("")}
    ${p != null ? `<text x="104" y="80" font-size="10" fill="#6b7a72">meter ke target</text><rect x="104" y="85" width="136" height="8" rx="4" fill="#e3e8e1"/><rect x="104" y="85" width="${1.36 * p}" height="8" rx="4" fill="#1E9E69"/><text x="240" y="80" font-size="10" text-anchor="end" font-weight="700">${p}%</text>` : ""}</svg>`;
}
function panelHist(vals, warna, satuan) {
  const v = vals.filter((x) => x > 0); if (!v.length) return `<svg viewBox="0 0 250 90"><text x="125" y="48" font-size="11" text-anchor="middle" fill="#6b7a72">belum ada data</text></svg>`;
  const mn = Math.floor(Math.min(...v)), mx = Math.ceil(Math.max(...v)), nb = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(v.length)) + 1)), bw = Math.max(0.5, (mx - mn) / nb), B = Array(nb).fill(0);
  v.forEach((x) => B[Math.min(nb - 1, Math.floor((x - mn) / bw))]++); const top = Math.max(...B), cw = 230 / nb, avg = v.reduce((a, b) => a + b, 0) / v.length;
  return `<svg viewBox="0 0 250 90">${B.map((c, i) => `<rect x="${12 + i * cw + 1}" y="${70 - (52 * c) / top}" width="${cw - 2}" height="${(52 * c) / top}" rx="2" fill="${warna}"/>${c ? `<text x="${12 + i * cw + cw / 2}" y="${66 - (52 * c) / top}" font-size="9" text-anchor="middle">${c}</text>` : ""}<text x="${12 + i * cw + cw / 2}" y="82" font-size="8.5" text-anchor="middle" fill="#6b7a72">${(mn + i * bw).toFixed(0)}</text>`).join("")}
    <line x1="${12 + ((avg - mn) / (bw * nb)) * 230}" x2="${12 + ((avg - mn) / (bw * nb)) * 230}" y1="12" y2="72" stroke="#D62828" stroke-dasharray="3 2"/><text x="248" y="10" font-size="9" text-anchor="end" fill="#D62828">rata-rata ${avg.toFixed(1)} ${satuan} · n=${v.length}</text></svg>`;
}
function panelLayer(zona) {
  if (!zona.length) return `<svg viewBox="0 0 250 90"><text x="125" y="48" font-size="11" text-anchor="middle" fill="#6b7a72">menunggu Form Logging disetujui</text></svg>`;
  const Z = zona.slice(0, 6), mx = Math.max(1, ...Z.map((z) => z.tebal.reduce((a, b) => a + b, 0) / z.tebal.length)), h = 14;
  return `<svg viewBox="0 0 250 ${Z.length * h + 6}">${Z.map((z, i) => { const t = z.tebal.reduce((a, b) => a + b, 0) / z.tebal.length; return `<text x="62" y="${i * h + 11}" font-size="9.5" text-anchor="end">${esc(z.nama)}</text><rect x="66" y="${i * h + 2}" width="${(140 * t) / mx}" height="${h - 4}" rx="2" fill="${esc(z.warna)}"/><text x="${70 + (140 * t) / mx}" y="${i * h + 11}" font-size="9">${t.toFixed(1)} m</text>`; }).join("")}</svg>`;
}
function panelHarian(dayRows) {
  if (!dayRows.length) return `<svg viewBox="0 0 250 80"><text x="125" y="44" font-size="11" text-anchor="middle" fill="#6b7a72">belum ada meter bor</text></svg>`;
  const mx = Math.max(1, ...dayRows.map((r) => r[2])), bw = 230 / dayRows.length, c0 = dayRows[0][3] - dayRows[0][2], c1 = dayRows[dayRows.length - 1][3], cy = (v) => 62 - (50 * (v - c0)) / Math.max(1, c1 - c0);
  return `<svg viewBox="0 0 250 80">${dayRows.map((r, i) => `<rect x="${12 + i * bw + 0.5}" y="${62 - (50 * r[2]) / mx}" width="${Math.max(1, bw - 1)}" height="${(50 * r[2]) / mx}" fill="#1E9E69" opacity=".85"/>`).join("")}
    <polyline points="${dayRows.map((r, i) => `${12 + i * bw + bw / 2},${cy(r[3])}`).join(" ")}" fill="none" stroke="#E0A100" stroke-width="2"/><text x="12" y="76" font-size="8.5" fill="#6b7a72">${dayRows[0][0].slice(5)}</text><text x="242" y="76" font-size="8.5" text-anchor="end" fill="#6b7a72">${dayRows[dayRows.length - 1][0].slice(5)}</text>
    <text x="248" y="9" font-size="9" text-anchor="end" fill="#E0A100">kumulatif ${c1.toFixed(0)} m</text><text x="12" y="9" font-size="9" fill="#1E9E69">maks ${mx.toFixed(1)} m/hari</text></svg>`;
}
// ---------- grafik SVG untuk slide performa rig ----------
function barH(rows, o = {}) { // rows: [{label, v, c, sub}]
  const W = o.w ?? 560, rh = o.rh ?? 26, H = Math.max(40, rows.length * rh + 14), mx = o.max ?? Math.max(1e-9, ...rows.map((r) => +r.v || 0)), L = o.lw ?? 120;
  if (!rows.length) return `<svg viewBox="0 0 ${W} 50" width="100%"><text x="${W / 2}" y="30" font-size="13" text-anchor="middle" fill="#6b7a72">belum ada data</text></svg>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:Arial,sans-serif;max-height:${o.maxH ?? 999}px">${rows.map((r, i) => { const w = ((W - L - (rows.some((x) => x.sub) ? 175 : 80)) * (+r.v || 0)) / mx, y = 6 + i * rh;
    return `<text x="${L - 6}" y="${y + rh / 2 + 4}" font-size="12" text-anchor="end">${esc(r.label)}</text><rect x="${L}" y="${y + 3}" width="${Math.max(1, w)}" height="${rh - 8}" rx="4" fill="${r.c ?? "#1E9E69"}"/>
      <text x="${L + w + 6}" y="${y + rh / 2 + 4}" font-size="12" font-weight="700">${esc(r.t ?? String(r.v))}</text>${r.sub ? `<text x="${W - 2}" y="${y + rh / 2 + 4}" font-size="10.5" text-anchor="end" fill="#6b7a72">${esc(r.sub)}</text>` : ""}`; }).join("")}</svg>`;
}
function stackH(rows, kunci, o = {}) { // rows: [{label, parts:{k:v}}], kunci: [[k, warna]]
  const W = o.w ?? 560, rh = 28, H = rows.length * rh + 34, L = o.lw ?? 90;
  if (!rows.length) return `<svg viewBox="0 0 ${W} 50" width="100%"><text x="${W / 2}" y="30" font-size="13" text-anchor="middle" fill="#6b7a72">belum ada data</text></svg>`;
  let g = rows.map((r, i) => { const tot = kunci.reduce((s, [k]) => s + (+r.parts[k] || 0), 0) || 1; let x = L; const y = 6 + i * rh;
    return `<text x="${L - 6}" y="${y + 16}" font-size="12" text-anchor="end">${esc(r.label)}</text>` + kunci.map(([k, c]) => { const w = ((W - L - 10) * (+r.parts[k] || 0)) / tot; const out = w > 0 ? `<rect x="${x}" y="${y + 3}" width="${w}" height="${rh - 8}" fill="${c}"><title>${esc(k)}: ${Math.round(+r.parts[k] / 60 * 10) / 10} jam</title></rect>${w > 34 ? `<text x="${x + w / 2}" y="${y + 17}" font-size="10" text-anchor="middle" fill="#fff">${Math.round((100 * (+r.parts[k] || 0)) / tot)}%</text>` : ""}` : ""; x += w; return out; }).join(""); }).join("");
  g += kunci.map(([k, c], i) => `<rect x="${L + i * 96}" y="${H - 18}" width="10" height="10" fill="${c}"/><text x="${L + 14 + i * 96}" y="${H - 9}" font-size="10.5">${esc(k)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:Arial,sans-serif">${g}</svg>`;
}
function heatRig(days, rigs) { // kalender meter per rig per hari
  const tg = [...new Set(days.map((d) => d.tanggal))].sort(); if (!tg.length || !rigs.length) return `<svg viewBox="0 0 560 50" width="100%"><text x="280" y="30" font-size="13" text-anchor="middle" fill="#6b7a72">belum ada data</text></svg>`;
  const W = 1180, L = 70, cw = Math.min(40, (W - L - 10) / tg.length), rh = 26, H = rigs.length * rh + 30, mx = Math.max(1, ...days.map((d) => +d.meter_bor || 0));
  const col = (v) => (!v ? "#eef2ef" : `rgba(30,158,105,${0.25 + 0.75 * (v / mx)})`);
  let g = rigs.map((r, i) => `<text x="${L - 6}" y="${i * rh + 17}" font-size="12" text-anchor="end">${esc(r)}</text>` + tg.map((t, j) => { const d = days.find((x) => x.rig === r && x.tanggal === t), v = +d?.meter_bor || 0, bad = d && (!d.ada_p2h || d.p2h_bermasalah);
    return `<rect x="${L + j * cw}" y="${i * rh + 2}" width="${cw - 2}" height="${rh - 4}" rx="3" fill="${col(v)}" stroke="${bad && v ? "#D62828" : "none"}" stroke-width="1.5"><title>${t} ${esc(r)}: ${v} m</title></rect>${v && cw > 26 ? `<text x="${L + j * cw + cw / 2 - 1}" y="${i * rh + 17}" font-size="9.5" text-anchor="middle" fill="${v > mx * 0.6 ? "#fff" : "#12251E"}">${v.toFixed(0)}</text>` : ""}`; }).join("")).join("");
  g += tg.filter((_, j) => j % Math.ceil(tg.length / 15) === 0).map((t) => `<text x="${L + tg.indexOf(t) * cw + cw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#6b7a72">${t.slice(5)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:Arial,sans-serif">${g}</svg>`;
}
// ---------- Kesimpulan prospek (saringan awal, ambang bisa disesuaikan) ----------
const KRITERIA = { tebal: [6, 3], kontinu: [70, 40], ob: [0.5, 1], lereng: [20, 30], nMin: 5 };
// Penilaian dari data geologi lapangan (ketebalan, kontinuitas, overburden, lereng). Kadar Ni tidak dianalisis di sini.
function kesimpulanProspek({ A, T, prof, LB }) {
  const K = KRITERIA, f = (x, d = 1) => (x == null || !Number.isFinite(+x) ? "–" : (+x).toFixed(d));
  const bh = [...new Set(prof.map((r) => r.bhid))], tb = (b, ks) => prof.filter((r) => r.bhid === b && ks.includes(r.zona)).reduce((s, r) => s + +r.tebal_m, 0);
  const nilai = (v, [ok, warn], naik = true) => (v == null || !Number.isFinite(v) ? "na" : naik ? (v >= ok ? "ok" : v >= warn ? "warn" : "bad") : v <= ok ? "ok" : v <= warn ? "warn" : "bad");
  const bijih = bh.map((b) => tb(b, ["L", "S"])), tebalBijih = bijih.length ? bijih.reduce((a, b) => a + b, 0) / bijih.length : null;
  const kontinu = bh.length ? (100 * bijih.filter((x) => x >= 3).length) / bh.length : null, obR = tebalBijih ? T.sOB.mean / tebalBijih : null;
  const ler = Object.values(A.lereng).filter((x) => x != null), lerAvg = ler.length ? ler.reduce((a, b) => a + b, 0) / ler.length : null;
  const baris = [
    { k: "Tebal zona laterit (limonit + saprolit) rata-rata", v: tebalBijih != null ? f(tebalBijih) + " m" : "–", amb: `≥ ${K.tebal[0]} m / ≥ ${K.tebal[1]} m`, s: nilai(tebalBijih, K.tebal) },
    { k: "Kontinuitas: lubang dengan zona laterit ≥ 3 m", v: kontinu != null ? f(kontinu, 0) + "%" : "–", amb: `≥ ${K.kontinu[0]}% / ≥ ${K.kontinu[1]}%`, s: nilai(kontinu, K.kontinu) },
    { k: "Rasio overburden : zona laterit", v: obR != null ? f(obR, 2) : "–", amb: `≤ ${K.ob[0]} / ≤ ${K.ob[1]}`, s: nilai(obR, K.ob, false) },
    { k: "Lereng rata-rata di titik bor (DEMNAS)", v: lerAvg != null ? f(lerAvg) + "°" : "–", amb: `≤ ${K.lereng[0]}° / ≤ ${K.lereng[1]}°`, s: nilai(lerAvg, K.lereng, false) },
    { k: "Tebal limonit rata-rata", v: T.sL.n ? f(T.sL.mean) + " m" : "–", amb: "informasi", s: T.sL.n ? "ok" : "na", info: true },
    { k: "Tebal saprolit rata-rata", v: T.sS.n ? f(T.sS.mean) + " m" : "–", amb: "informasi", s: T.sS.n ? "ok" : "na", info: true },
    { k: "Kecukupan data (lubang berdata logging)", v: `${bh.length} lubang`, amb: `≥ ${K.nMin} lubang`, s: bh.length >= K.nMin ? "ok" : bh.length ? "warn" : "na" },
  ];
  const nilaiUtama = baris.slice(0, 4), ok = nilaiUtama.filter((r) => r.s === "ok").length, bad = nilaiUtama.filter((r) => r.s === "bad").length, warn = nilaiUtama.filter((r) => r.s === "warn").length;
  let vonis, warna, alasan;
  if (!bh.length) { vonis = "BELUM ADA DATA"; warna = "#6b7a72"; alasan = "Belum ada Form Logging yang disetujui verifier, jadi ketebalan layer belum bisa dinilai."; }
  else if (bad >= 2) { vonis = "KURANG PROSPEK"; warna = "#D62828"; alasan = `${bad} dari 4 kriteria geologi tidak terpenuhi.`; }
  else if (ok >= 3 && bad === 0) { vonis = "PROSPEK"; warna = "#1E9E69"; alasan = `${ok} dari 4 kriteria geologi terpenuhi${warn ? `, ${warn} di ambang sedang` : ""}.`; }
  else { vonis = "PROSPEK BERSYARAT"; warna = "#E0A100"; alasan = `${ok} kriteria terpenuhi, ${warn} sedang, ${bad} tidak.`; }
  if (bh.length && bh.length < K.nMin) alasan += ` Masih indikasi awal: baru ${bh.length} lubang berdata (minimal ${K.nMin}).`;
  const rekom = [];
  if (bh.length < K.nMin) rekom.push(`Selesaikan dan setujui Form Logging minimal ${K.nMin} lubang agar penilaian representatif.`);
  if (kontinu != null && kontinu < K.kontinu[0]) rekom.push("Zona laterit belum menerus: evaluasi spasi bor dan bor isian di sekitar lubang yang tebal.");
  if (obR != null && obR > K.ob[0]) rekom.push("Overburden relatif tebal terhadap zona laterit — perhitungkan pengupasan.");
  if (lerAvg != null && lerAvg > K.lereng[0]) rekom.push("Lereng curam di titik bor — laterit cenderung tipis; prioritaskan punggungan landai.");
  if (T.sRec.n && T.sRec.min < 90) rekom.push("Recovery core < 90% di sebagian lubang — perbaiki teknik bor agar ketebalan tidak bias.");
  if (vonis.startsWith("PROSPEK")) rekom.push("Lanjutkan pemboran ke titik rencana berikutnya; hasil kadar dari laboratorium dicatat di database.");
  if (!rekom.length) rekom.push("Lanjutkan program sesuai rencana.");
  return { vonis, warna, alasan, ringkas: alasan.split(".")[0] + ".", baris, rekom };
}
// ---------- Template presentasi pemboran 16:9 (cetak / simpan PDF) ----------
async function presentasiHTML(D) {
  const { st, PJ, mPer, mCum, nSelesai, HR, K, dayRows, rigRows, sbRows, notes, LB, prof, klien } = D, days = D.days ?? [], tm = D.tm ?? [];
  const ringkas = (D.ringkas ?? []).slice(1), qcRows = D.qcRows ?? [], opRows = D.opRows ?? [], holesC = D.holes ?? [];
  const nCt = holesC.reduce((a, h) => a + (+h.jumlah_conto || 0), 0), nCl = holesC.reduce((a, h) => a + (+h.conto_limonit || 0), 0), nCs = holesC.reduce((a, h) => a + (+h.conto_saprolit || 0), 0);
  const n = (x) => Number(x) || 0, pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
  const nama = PJ?.nama ?? (st.proj || "Semua proyek"), per = `${fmtTgl(st.from)} – ${fmtTgl(st.to)}`;
  const hit = (k) => LB.filter((x) => (k === "EOH" ? ["EOH", "STB", "SELESAI"].includes(x.status) : x.status === k)).length;
  const rec = HR.filter((h) => h.rec != null), recAvg = rec.length ? Math.round(rec.reduce((s, h) => s + n(h.rec), 0) / rec.length) : null;
  const stb = sbRows.reduce((s, r) => s + n(r[1]), 0), rigAktif = rigRows.length;
  const tgtM = n(PJ?.target_meter), tgtL = n(PJ?.target_lubang) || LB.length;
  const card = (v, l, sub = "", warna = "#1E9E69") => `<div class="kpi"><div class="v" style="color:${warna}">${v}</div><div class="l">${l}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
  const bar = (p, warna = "#1E9E69") => `<div class="bar"><span style="width:${Math.max(0, Math.min(100, p ?? 0))}%;background:${warna}"></span></div>`;
  let no = 0; const slide = (judul, isi, sub = "") => `<section class="sl"><header><span class="no">${String(++no).padStart(2, "0")}</span><h2>${judul}</h2>${sub ? `<span class="sub">${sub}</span>` : ""}<span class="br">X-Terra · TGEP</span></header><div class="isi">${isi}</div><footer>${esc(nama)} · ${per}<span>${no}</span></footer></section>`;
  // grafik meter harian
  const mx = Math.max(1, ...dayRows.map((r) => r[2])), W = 1120, H = 330, bw = dayRows.length ? Math.max(4, Math.min(46, Math.floor((W - 60) / dayRows.length) - 4)) : 20;
  const cum = dayRows.length ? Math.max(...dayRows.map((r) => r[3])) : 1, cMin = dayRows.length ? Math.min(...dayRows.map((r) => r[3] - r[2])) : 0;
  const gx = (i) => 50 + i * (bw + 4), gyB = (v) => H - 30 - ((H - 70) * v) / mx, gyC = (v) => H - 30 - ((H - 70) * (v - cMin)) / Math.max(1, cum - cMin);
  const grafik = dayRows.length ? `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:330px">
    ${[0, 0.5, 1].map((f) => `<line x1="44" x2="${W}" y1="${gyB(mx * f)}" y2="${gyB(mx * f)}" stroke="#e3e8e1"/><text x="38" y="${gyB(mx * f) + 4}" font-size="12" text-anchor="end" fill="#6b7a72">${(mx * f).toFixed(0)}</text>`).join("")}
    ${dayRows.map((r, i) => `<rect x="${gx(i)}" y="${gyB(r[2])}" width="${bw}" height="${H - 30 - gyB(r[2])}" rx="3" fill="#1E9E69"><title>${r[0]}: ${r[2]} m</title></rect>`).join("")}
    <polyline points="${dayRows.map((r, i) => `${gx(i) + bw / 2},${gyC(r[3])}`).join(" ")}" fill="none" stroke="#E0A100" stroke-width="3"/>
    ${dayRows.filter((_, i) => i % Math.ceil(dayRows.length / 10) === 0).map((r) => `<text x="${gx(dayRows.indexOf(r)) + bw / 2}" y="${H - 10}" font-size="11" text-anchor="middle" fill="#6b7a72">${r[0].slice(5)}</text>`).join("")}
    <text x="${W}" y="16" font-size="12" text-anchor="end" fill="#E0A100">— kumulatif proyek ${cum.toFixed(0)} m</text><text x="50" y="16" font-size="12" fill="#1E9E69">■ meter / hari</text></svg>` : `<p class="kosong">Belum ada meter bor pada periode ini.</p>`;
  // status titik bor
  const bar2 = LB.map((x) => { const p = x.rencana_kedalaman ? pct(n(x.kedalaman), n(x.rencana_kedalaman)) : ["EOH", "STB", "SELESAI"].includes(x.status) ? 100 : x.kedalaman ? 50 : 0;
    const c = WARNA_STATUS[x.status] === "#ffffff" ? "#cfd8d3" : WARNA_STATUS[x.status];
    return `<tr><td><b>${esc(x.bhid)}</b></td><td><span class="dot" style="background:${WARNA_STATUS[x.status] ?? "#999"}"></span>${esc((LABEL_STATUS[x.status] ?? x.status).replace(" (continue)", ""))}</td><td class="r">${x.kedalaman != null ? (+x.kedalaman).toFixed(1) : "–"}</td><td class="r">${x.rencana_kedalaman ?? "–"}</td><td>${bar(p, c)}</td><td class="r">${x.dip ?? -90}° / ${x.azimuth ?? 0}°</td></tr>`; });
  const half = Math.ceil(bar2.length / 2), tTitik = (rows) => `<table class="t st"><tr><th>Hole ID</th><th>Status</th><th class="r">Kedalaman (m)</th><th class="r">Rencana (m)</th><th style="width:22%">Capaian</th><th class="r">Dip / Az</th></tr>${rows.join("")}</table>`;
  // ketebalan zona rata-rata
  const Z = {}; for (const r of prof ?? []) { (Z[r.zona] ??= { nama: r.nama_zona, warna: r.warna, tebal: 0, bh: new Set() }); Z[r.zona].tebal += n(r.tebal_m); Z[r.zona].bh.add(r.bhid); }
  const zonaRows = Object.entries(Z).map(([k, z]) => `<tr><td><span class="sw" style="background:${esc(z.warna)}"></span>${esc(z.nama)} (${esc(k)})</td><td class="r">${(z.tebal / z.bh.size).toFixed(1)} m</td><td class="r">${z.bh.size}</td></tr>`).join("");
  const S = [];
  // ===== data tambahan =====
  const REC = Object.fromEntries(HR.map((h) => [h.b, h.rec]));
  const T = statistikData({ dayRows, HR, LB, prof, st, PJ, mCum }), f = T.f;
  const A = await analisisData(LB, prof, days);
  const KS = kesimpulanProspek({ A, T, prof: prof ?? [], LB });
  const panel = [{ judul: "Status titik bor", svg: panelStatus(LB, mCum, tgtM), h: 118 }, { judul: "Meter bor harian & kumulatif", svg: panelHarian(dayRows), h: 106 },
    { judul: "Sebaran kedalaman akhir lubang (m)", svg: panelHist(T.selesai.map((x) => +x.kedalaman), "#22c55e", "m"), h: 112 }, { judul: "Tebal rata-rata tiap layer", svg: panelLayer(A.zona), h: 116 }];
  const petaGraf = await petaSVG(LB.map((x) => ({ ...x, rec: REC[x.bhid] })), { w: 1200, h: 600, grafik: prof ?? [], gh: 74, panel }).catch(() => "<p>Peta tidak dapat dibuat.</p>");
  const tiga = await blok3D(LB, prof, { w: 900, h: 560 }).catch(() => "");
  const kecil = (s) => (s.n && s.n < 5 ? `<span class="nk">n=${s.n}</span>` : "");
  // ===== 1. Sampul =====
  S.push(`<section class="sl cover"><div class="cv-l"><div class="tag">LAPORAN PROGRES PEMBORAN</div><h1>${esc(nama)}</h1><div class="per">${per}${st.rig ? ` · ${esc(st.rig)}` : ""}</div>
    <div class="cv-k">${card(mPer.toFixed(1) + " m", "meter bor periode", "", "#7CE0B0")}${card(`${nSelesai}/${tgtL}`, "lubang selesai", "", "#7CE0B0")}${card(mCum.toFixed(0) + " m", "kumulatif proyek", tgtM ? `${pct(mCum, tgtM)}% dari target ${tgtM} m` : "", "#7CE0B0")}${card(String(nCt), "conto di database", nCt ? `L ${nCl} · S ${nCs} · lain ${nCt - nCl - nCs}` : "belum ada conto", "#7CE0B0")}</div>
    <div class="vonis" style="border-color:${KS.warna}"><div class="vl">KESIMPULAN</div><div class="vv" style="color:${KS.warna}">${esc(KS.vonis)}</div><div class="vs">${esc(KS.ringkas)}</div></div>
    <div class="by">PT Terra Grapindo Eco Prima · eksplorasi nikel laterit · disusun ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · ${esc(me?.full_name ?? "")}</div></div>
    <div class="cv-r3">${tiga}</div></section>`);
  // ===== 2. Progres & produktivitas per rig =====
  S.push(slide("Progres & produktivitas", `<div class="grid8">
    ${card(f(T.sH.mean) + " m", "Rata-rata m / hari aktif", `median ${f(T.sH.med)} · maks ${f(T.sH.max)} m`)}${card(`${T.aktif.length}/${T.kal}`, "Hari aktif / kalender", `${pct(T.aktif.length, T.kal)}% utilisasi`)}
    ${card(T.sEOH.n ? f(T.sEOH.mean) + " m" : "–", "Kedalaman akhir rata-rata", T.sEOH.n ? `${f(T.sEOH.min)}–${f(T.sEOH.max)} m ${kecil(T.sEOH)}` : "belum ada")}${card(T.sRec.n ? f(T.sRec.mean, 0) + "%" : "–", "Recovery core", T.sRec.n ? `${T.recOk}/${T.sRec.n} lubang ≥ 90%` : "", T.sRec.n && T.sRec.min < 90 ? "#D62828" : "#1E9E69")}
    ${card(f(T.sisa, 0) + " m", "Sisa ke target", `target ${f(T.tgtM, 0)} m`, "#E0A100")}${card(T.eta ?? "–", "Perkiraan selesai", T.hariLagi ? `±${T.hariLagi} hari, laju sekarang` : "", "#12251E")}
    ${card(f(stb, 1) + " jam", "Standby + perbaikan", sbRows[0] ? esc(String(sbRows[0][0]).slice(0, 34)) : "", stb > 0 ? "#E0A100" : "#1E9E69")}${card(`${hit("PROGRES")} · ${hit("RENCANA")}`, "Sedang dibor · rencana", "")}</div>
    <div class="dua" style="grid-template-columns:1.15fr 1fr;margin-top:10px"><div><h3 style="margin:0 0 4px">Meter bor harian per rig</h3>${A.rigs.length ? rigHarianSVG(days, A.rigs, { w: 640, h: 330, maxH: 420 }) : grafik}</div>
    <div><table class="t kc"><tr><th>Rig</th>${["Hari", "Meter", "m/hari", "Maks", "m/jam", "Lubang", "Σ kedalaman", "Limonit", "Saprolit"].map((h) => `<th class="r">${h}</th>`).join("")}</tr>
    ${A.perRig.map((x, k) => `<tr><td><span class="sw" style="background:${WARNA_RIG[k % WARNA_RIG.length]}"></span><b>${esc(x.r)}</b></td><td class="r">${x.hari}</td><td class="r"><b>${f(x.meter)}</b></td><td class="r">${f(x.sm.mean)}</td><td class="r">${f(x.sm.max)}</td><td class="r">${x.jam ? f(x.meter / x.jam, 2) : "–"}</td><td class="r">${x.lubang} (${x.selesai})</td><td class="r">${f(x.totDalam)}</td><td class="r">${x.L.n ? f(x.L.mean) : "–"}</td><td class="r">${x.S.n ? f(x.S.mean) : "–"}</td></tr>`).join("")}</table>
    <h3 style="margin:8px 0 2px">Kendala utama</h3><ul class="tl" style="font-size:13px">${sbRows.slice(0, 3).map((r) => `<li>${esc(r[0])} — ${r[1]} jam</li>`).join("") || "<li>Tidak ada standby/perbaikan tercatat.</li>"}</ul></div></div>`, "statistik harian per rig"));
  // ===== Performa rig (gabungan grafik dashboard) =====
  let CU = []; try { if (typeof sb !== "undefined") { let q = sb.from("v_consumable_use").select("rig,kategori,unit,qty,item").gte("report_date", st.from).lte("report_date", st.to); if (st.rig) q = q.eq("rig", st.rig); CU = (await q).data ?? []; } } catch {}
  const RG = A.rigs, sum = (xs, k) => xs.reduce((a, x) => a + (+x[k] || 0), 0), perRigD = (r) => days.filter((d) => d.rig === r);
  const akt = (r) => perRigD(r).filter((d) => +d.meter_bor > 0), pctR = (a, b) => (b ? Math.round((100 * a) / b) : null);
  const kegKunci = [["Drilling", "#1E9E69"], ["Working", "#2563EB"], ["Standby", "#E0A100"], ["Perbaikan", "#D62828"], ["Lainnya", "#9CA3AF"]];
  const kegOf = (k) => (/drill|bor|coring|run/i.test(k) ? "Drilling" : /stand/i.test(k) ? "Standby" : /perbaik|repair|rusak/i.test(k) ? "Perbaikan" : /work|kerja|pindah|p2h|setup|moving/i.test(k) ? "Working" : "Lainnya");
  const waktuRig = RG.map((r) => { const parts = {}; for (const x of tm.filter((x) => x.rig === r)) { const k = kegOf(String(x.kegiatan ?? "")); parts[k] = (parts[k] ?? 0) + (+x.menit || 0); } return { label: r, parts }; }).filter((x) => Object.keys(x.parts).length);
  const bbmRig = RG.map((r, k) => { const b = sum(perRigD(r), "bbm_liter"), m = sum(perRigD(r), "meter_bor"); return { label: r, v: b, t: `${b.toFixed(0)} L`, sub: m ? `${(b / m).toFixed(2)} L/m` : "", c: WARNA_RIG[k % WARNA_RIG.length] }; });
  const mRig = RG.map((r, k) => { const m = sum(perRigD(r), "meter_bor"), j = sum(perRigD(r), "jam_kerja_bor"); return { label: r, v: m, t: `${m.toFixed(1)} m`, sub: j ? `${(m / j).toFixed(2)} m/jam · ${akt(r).length} hari` : `${akt(r).length} hari`, c: WARNA_RIG[k % WARNA_RIG.length] }; });
  const kpRig = RG.flatMap((r) => { const a = akt(r); return [{ label: `${r} · P2H`, v: pctR(a.filter((d) => d.ada_p2h && !d.p2h_bermasalah).length, a.length) ?? 0, t: a.length ? `${pctR(a.filter((d) => d.ada_p2h && !d.p2h_bermasalah).length, a.length)}%` : "–", c: "#1E9E69" },
    { label: `${r} · DDR TTD`, v: pctR(a.filter((d) => d.n_ddr_ttd > 0).length, a.length) ?? 0, t: a.length ? `${pctR(a.filter((d) => d.n_ddr_ttd > 0).length, a.length)}%` : "–", c: "#2563EB" }]; });
  const recRig = RG.map((r, k) => { const xs = perRigD(r).filter((d) => d.recovery_pct != null), v = xs.length ? xs.reduce((a, d) => a + +d.recovery_pct, 0) / xs.length : null; return { label: r, v: v ?? 0, t: v != null ? `${v.toFixed(0)}%` : "–", c: v != null && v < 90 ? "#D62828" : "#1E9E69" }; });
  const sbCause = sbRows.slice(0, 7).map((r) => ({ label: String(r[0]).replace(/^(Standby|Perbaikan): /, "").slice(0, 26), v: +r[1], t: `${r[1]} jam`, c: /^Perbaikan/.test(r[0]) ? "#D62828" : "#E0A100" }));
  const cair = {}; for (const c of CU.filter((c) => /liter/i.test(c.unit ?? ""))) cair[c.kategori ?? c.item] = (cair[c.kategori ?? c.item] ?? 0) + (+c.qty || 0);
  const cairRows = Object.entries(cair).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k, v, t: `${v.toFixed(0)} L`, c: "#0891B2" }));
  const ganti = RG.map((r, k) => ({ label: r, v: sum(perRigD(r), "ganti_mata_bor"), t: String(sum(perRigD(r), "ganti_mata_bor")), sub: `${sum(perRigD(r), "jumlah_run")} run`, c: WARNA_RIG[k % WARNA_RIG.length] }));
  S.push(slide("Performa rig: produksi & waktu", `<div class="dua" style="grid-template-columns:1fr 1fr;gap:10px 26px">
    <div><h3 style="margin:0 0 4px">Meter bor & produktivitas per rig</h3>${barH(mRig, { lw: 70 })}</div>
    <div><h3 style="margin:0 0 4px">Pembagian waktu kerja per rig</h3>${stackH(waktuRig, kegKunci, { lw: 70 })}</div></div>
    <h3 style="margin:10px 0 4px">Kalender meter bor harian per rig <span style="font-weight:400;color:#6b7a72;font-size:13px">· angka = meter · bingkai merah = tanpa P2H / P2H bermasalah</span></h3>${heatRig(days, RG)}
    <div class="dua" style="grid-template-columns:1fr 1fr;gap:10px 26px;margin-top:8px"><div><h3 style="margin:0 0 4px">Recovery core rata-rata per rig</h3>${barH(recRig, { lw: 70 })}</div><div><h3 style="margin:0 0 4px">Ganti mata bor & jumlah run</h3>${barH(ganti, { lw: 70 })}</div></div>`, "gabungan grafik dashboard"));
  S.push(slide(klien ? "Performa rig: kepatuhan & kendala" : "Performa rig: biaya, kepatuhan & kendala", `<div class="dua" style="grid-template-columns:1fr 1fr;gap:16px 26px">
    <div>${klien ? `<h3 style="margin:0 0 4px">Pemakaian cairan bor per jenis (DDR)</h3>${barH(cairRows.filter((r) => !BARANG_BBM.test(r.label)), { lw: 120 })}` : `<h3 style="margin:0 0 4px">BBM per rig (total & per meter)</h3>${barH(bbmRig, { lw: 70 })}<h3 style="margin:12px 0 4px">Pemakaian cairan per jenis (DDR)</h3>${barH(cairRows, { lw: 120 })}`}</div>
    <div><h3 style="margin:0 0 4px">Kepatuhan P2H & DDR bertanda tangan (hari aktif)</h3>${barH(kpRig, { lw: 110, rh: 22 })}<h3 style="margin:12px 0 4px">Penyebab standby & perbaikan</h3>${barH(sbCause, { lw: 170 })}</div></div>`, klien ? "cairan · P2H · DDR · standby" : "BBM · cairan · P2H · DDR · standby"));
  // ===== 3. Peta pemboran + grafik per lubang =====
  S.push(slide("Peta pemboran & grafik per lubang", `<div class="peta">${petaGraf}</div>`, `${LB.length} titik · kotak = kolom zona / kedalaman vs rencana · Rec = recovery`));
  // ===== 4. Geologi =====
  S.push(slide("Profil & ketebalan layer", (prof ?? []).length ? `<div class="pf" style="grid-template-columns:1fr 1.15fr"><div>${profilSVG(prof, { h: 300, fit: 400 })}</div>
    <div><div class="grid4" style="gap:8px">${card(f(T.sOB.mean) + " m", "Overburden", `TP + sedimen`, "#8B3A1F")}${card(f(T.sL.mean) + " m", "Limonit", `n=${T.sL.n}`, "#D62828")}${card(f(T.sS.mean) + " m", "Saprolit", `n=${T.sS.n}`, "#6f8a1f")}${card(T.sBR.n ? f(T.sBR.mean) + " m" : "–", "Ke bedrock", "kedalaman", "#1D4ED8")}</div>
    ${kedalamanLayerSVG(A.zona)}
    <table class="t kc"><tr><th>Layer</th>${["n", "Atas", "Bawah", "Min", "Rata-rata", "Median", "Maks", "SD"].map((h) => `<th class="r">${h}</th>`).join("")}</tr>${A.zona.map((z) => { const s2 = stat(z.tebal); return `<tr><td><span class="sw" style="background:${esc(z.warna)}"></span>${esc(z.nama)}</td><td class="r">${s2.n}</td><td class="r">${f(z.atas)}</td><td class="r">${f(z.bawah)}</td><td class="r">${f(s2.min)}</td><td class="r"><b>${f(s2.mean)}</b></td><td class="r">${f(s2.med)}</td><td class="r">${f(s2.max)}</td><td class="r">${f(s2.sd)}</td></tr>`; }).join("")}</table>
    <p class="ket">Tebal (m) per lubang yang menembus layer. Rasio limonit : saprolit = ${T.sS.mean ? f(T.sL.mean / T.sS.mean, 2) : "–"} : 1.</p></div></div>` : `<p class="kosong">Profil tampil setelah Form Logging disetujui verifier.</p>`, `${T.bh.length} lubang berdata logging`));
  // ===== 5. Hubungan & sebaran layer =====
  // ===== Recovery core per lubang & per layer =====
  const RC = await recoveryData(LB, HR, prof);
  const rcL = RC.lubang, dua2 = rcL.length > 16, hL = dua2 ? Math.ceil(rcL.length / 2) : rcL.length;
  const rcBar = (rows) => barH(rows, { lw: 92, rh: rcL.length > 24 ? 15 : rcL.length > 12 ? 19 : 24, max: 100, w: dua2 ? 420 : 560 });
  S.push(slide("Recovery core", RC.nLubang || RC.layer.length ? `<div class="dua" style="grid-template-columns:1.1fr 1fr;gap:20px;align-items:start">
    <div><h3 style="margin:0 0 4px">Recovery per lubang <span style="font-weight:400;color:#6b7a72;font-size:13px">· hijau ≥ 90 % · kuning 80–90 % · merah &lt; 80 %</span></h3>
      ${dua2 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${rcBar(rcL.slice(0, hL))}${rcBar(rcL.slice(hL))}</div>` : rcBar(rcL)}</div>
    <div><div class="grid4" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">${card(RC.total != null ? RC.total.toFixed(1) + "%" : "–", "Recovery rata-rata", RC.adaLogging ? "tertimbang panjang interval" : "dari laporan harian", RC.total != null && RC.total < 90 ? "#D62828" : "#1E9E69")}
      ${card(`${RC.okLubang}/${RC.nLubang}`, "Lubang ≥ 90 %", "")}${card(RC.nInt ? `${RC.low}/${RC.nInt}` : "–", "Interval < 90 %", RC.nInt ? `${RC.mInt.toFixed(1)} m ter-logging` : "belum ada logging", RC.low ? "#E0A100" : "#1E9E69")}</div>
      <h3 style="margin:4px 0 4px">Recovery per layer</h3>${RC.layer.length ? barH(RC.layer.map((z) => ({ ...z, label: z.nama })), { lw: 110, rh: 24, max: 100 }) : `<p class="ket" style="font-size:13px">Recovery per layer muncul setelah Form Logging lubang disetujui verifier.</p>`}
      ${RC.titik.length >= 2 ? pencarSVG(RC.titik, { judul: "Recovery vs kedalaman (tiap interval, warna = layer)", sx: "kedalaman tengah interval (m)", sy: "recovery (%)", maxH: 200 }) : ""}
      <p class="ket">Recovery = Σ panjang core ÷ Σ panjang interval. Recovery rendah di satu layer menurunkan keterwakilan conto layer tersebut.</p></div></div>`
    : `<p class="kosong">Belum ada data recovery (Form Logging atau laporan harian).</p>`, "per lubang & per layer"));
  S.push(slide("Hubungan & sebaran layer", `<div class="dua" style="grid-template-columns:1.3fr 1fr;align-items:start"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start">
    ${pencarSVG(A.hub.eohL, { judul: "Kedalaman vs tebal limonit", sx: "kedalaman akhir (m)", sy: "limonit (m)", maxH: 190 })}${pencarSVG(A.hub.eohS, { judul: "Kedalaman vs tebal saprolit", sx: "kedalaman akhir (m)", sy: "saprolit (m)", maxH: 190 })}
    ${pencarSVG(A.hub.lerEoh, { judul: "Lereng vs kedalaman", sx: "lereng collar (°)", sy: "kedalaman (m)", maxH: 190 })}${pencarSVG(A.hub.lerL, { judul: "Lereng vs tebal limonit", sx: "lereng collar (°)", sy: "limonit (m)", maxH: 190 })}</div>
    <div><h3 style="margin:0 0 6px">Histogram ketebalan tiap layer</h3><div style="display:grid;grid-template-columns:repeat(${A.zona.length > 4 ? 3 : 2},1fr);gap:6px">${A.zona.slice(0, 9).map((z) => `<div class="kpi hk" style="padding:3px 6px">${histKecil(z.tebal, z.warna, z.nama)}</div>`).join("") || `<p class="kosong">Menunggu Form Logging disetujui.</p>`}</div>
    <p class="ket">r = korelasi Pearson; n &lt; 3 tidak dihitung, n &lt; 5 belum stabil. Lereng dari DEMNAS di posisi collar.</p></div></div>`, "kedalaman · ketebalan · lereng"));
  // ===== Ringkasan data, conto & kepatuhan (isi Laporan PDF diringkas) =====
  const half2 = Math.ceil(ringkas.length / 2), tRk = (rows) => `<table class="t kc rk"><tr><th>Indikator</th><th class="r">Nilai</th></tr>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="r"><b>${esc(String(b))}</b></td></tr>`).join("")}</table>`;
  const contoBar = nCt ? [{ label: "Limonit", v: nCl, t: String(nCl), c: "#D62828" }, { label: "Saprolit", v: nCs, t: String(nCs), c: "#9AAE3A" }, { label: "TP / lainnya", v: nCt - nCl - nCs, t: String(nCt - nCl - nCs), c: "#8B3A1F" }] : [];
  const opTop = opRows.filter((r) => r[3]).slice(0, 6);
  S.push(slide("Ringkasan data, conto & kepatuhan", `<div class="dua" style="grid-template-columns:1.25fr 1fr;gap:18px;align-items:start">
    <div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${tRk(ringkas.slice(0, half2))}${tRk(ringkas.slice(half2))}</div></div>
    <div><h3 style="margin:0 0 4px">Jumlah conto per zona <span style="font-weight:400;color:#6b7a72;font-size:13px">· total ${nCt} conto di ${holesC.length} lubang</span></h3>${contoBar.length ? barH(contoBar, { lw: 90, rh: 20 }) : `<p class="ket" style="font-size:14px">Belum ada conto di database.</p>`}
    ${klien ? "" : `<h3 style="margin:10px 0 4px">Data, conto & QC</h3><table class="t kc">${qcRows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="r"><b>${esc(String(b))}</b></td></tr>`).join("")}</table>`}
    ${!klien && opTop.length ? `<h3 style="margin:10px 0 4px">Kepatuhan kirim operator (terendah)</h3><table class="t kc"><tr><th>Operator</th><th>Rig</th><th class="r">Wajib</th><th class="r">% lengkap</th></tr>${opTop.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[2])}</td><td class="r">${r[3]}</td><td class="r"><b>${esc(String(r[7]))}</b></td></tr>`).join("")}</table>` : ""}
    <div class="cat" style="margin-top:10px;padding:8px 14px"><h3 style="font-size:14px;margin-bottom:3px">Catatan otomatis</h3><ul style="font-size:12.5px;line-height:1.4">${(notes ?? []).slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div></div>`, "isi Laporan PDF dalam satu halaman"));
  // ===== 6. Kesimpulan prospek =====
  S.push(slide("Kesimpulan: prospek atau tidak?", `<div class="dua" style="grid-template-columns:1fr 1.5fr;align-items:start">
    <div class="vonis2" style="border-color:${KS.warna}"><div class="vl">STATUS</div><div class="vv" style="color:${KS.warna}">${esc(KS.vonis)}</div><p>${esc(KS.alasan)}</p>
      <h3>Rekomendasi</h3><ul class="tl">${KS.rekom.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><table class="t"><tr><th>Kriteria</th><th class="r">Nilai</th><th>Ambang (✓ / !)</th><th>Status</th></tr>${KS.baris.map((r) => `<tr><td>${esc(r.k)}</td><td class="r"><b>${esc(r.v)}</b></td><td>${esc(r.amb)}</td><td>${r.info ? `<span class="muted">—</span>` : `<span class="stt s${r.s}">${{ ok: "✓ memenuhi", warn: "! sedang", bad: "✗ tidak", na: "? belum ada data" }[r.s]}</span>`}</td></tr>`).join("")}</table>
    <p class="ket">Penilaian berdasarkan data geologi lapangan (ketebalan, kontinuitas, overburden, lereng); kadar Ni dari laboratorium tidak dianalisis di sini. Ambang dapat disesuaikan dan kesimpulan perlu ditinjau geologis yang berkompeten.</p></div></div>`, "indikasi dari data geologi"));
  const css = `@page{size:338.67mm 190.5mm;margin:0}*{box-sizing:border-box}body{margin:0;background:#3a4741;font-family:"Segoe UI",Arial,sans-serif;color:#12251E}
  .bar0{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:center;padding:8px;background:#12251E}.bar0 button{font:600 14px Arial;padding:8px 14px;border:0;border-radius:8px;background:#1E9E69;color:#fff;cursor:pointer}
  .sl{width:338.67mm;height:190.5mm;margin:14px auto;background:#fff;position:relative;overflow:hidden;page-break-after:always;break-after:page;display:flex;flex-direction:column;box-shadow:0 4px 18px rgba(0,0,0,.35)}
  .sl>header{display:flex;align-items:center;gap:14px;padding:16px 34px 10px;border-bottom:3px solid #1E9E69}.sl>header .no{font:700 26px Arial;color:#1E9E69}.sl>header h2{margin:0;font-size:28px;white-space:nowrap}.sl>header .sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.sl>header .sub{color:#6b7a72;font-size:15px}.sl>header .br{margin-left:auto;font:700 13px Arial;color:#12251E;opacity:.55;letter-spacing:.06em}
  .isi{flex:1;padding:16px 34px;overflow:hidden}.sl>footer{display:flex;justify-content:space-between;padding:6px 34px;font-size:12px;color:#6b7a72;border-top:1px solid #e3e8e1}
  .cover{flex-direction:row;background:linear-gradient(135deg,#0d1f18,#12251E 55%,#1b4a37);color:#fff}.cv-l{flex:0 0 42%;padding:46px 40px;display:flex;flex-direction:column}.cv-r{flex:1;padding:22px 22px 22px 0;display:flex;align-items:center}.cv-r svg{width:100%;height:auto;border-radius:10px;border:0!important}.cv-r div{display:none}
  .tag{font:700 14px Arial;letter-spacing:.18em;color:#7CE0B0}.cover h1{font-size:46px;line-height:1.08;margin:14px 0 8px}.per{font-size:19px;opacity:.85}.cv-k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:30px 0 auto}.cover .cv-k .kpi{padding:10px 12px}.cover .cv-k .kpi .v{font-size:27px}.cover .cv-k .kpi .l{font-size:12.5px}.cover .cv-k .kpi .s{font-size:11px}.cover .kpi{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15)}.cover .kpi .l,.cover .kpi .s{color:#cfe3d9}.by{font-size:13px;opacity:.7;line-height:1.6}
  .kpi{border:1px solid #e3e8e1;border-radius:14px;padding:14px 16px;background:#f7faf8}.grid8{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}.grid8 .kpi{padding:8px 10px;border-radius:10px}.grid8 .kpi .v{font-size:22px}.grid8 .kpi .l{font-size:12px}.grid8 .kpi .s{font-size:10.5px}
  .hk svg{max-height:112px}.t.rk{font-size:11.5px}.t.rk td,.t.rk th{padding:2.5px 6px}.t.kc{font-size:12px}.t.kc th,.t.kc td{padding:3px 6px}.t.kc td:first-child{white-space:nowrap}.cv-r3{flex:1;padding:18px 18px 18px 0;display:flex;flex-direction:column;justify-content:center}.cv-r3 svg{width:100%;height:auto;border-radius:12px}.cv-r3>div{color:#cfe3d9!important;font-size:10px!important}
  .vonis{margin:18px 0 auto;border:2px solid;border-radius:14px;padding:10px 16px;background:rgba(255,255,255,.06)}.vonis .vl,.vonis2 .vl{font:700 12px Arial;letter-spacing:.14em;opacity:.7}.vonis .vv{font:800 26px Arial}.vonis .vs{font-size:13px;opacity:.85}
  .vonis2{border:3px solid;border-radius:16px;padding:16px 20px;background:#f7faf8}.vonis2 .vv{font:800 30px Arial;margin:2px 0 6px}.vonis2 p{margin:0 0 8px;font-size:14px}.vonis2 h3{margin:8px 0 4px;font-size:15px}
  .stt{display:inline-block;padding:2px 8px;border-radius:8px;font-size:12px;font-weight:700}.sok{background:#DCEFE4;color:#14653f}.swarn{background:#FFF1C2;color:#7a5b00}.sbad{background:#F6C9C3;color:#8a1c12}.sna{background:#eceff0;color:#555}.kpi .v{font:800 34px Arial;line-height:1.1}.kpi .l{font-size:14px;color:#3d4f46;margin-top:4px}.kpi .s{font-size:12px;color:#6b7a72;margin-top:4px}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.cat{margin-top:16px;background:#12251E;color:#fff;border-radius:14px;padding:12px 20px}.cat h3{margin:0 0 6px;color:#7CE0B0;font-size:16px}.cat ul{margin:0;padding-left:20px;font-size:15px;line-height:1.5}
  .bar{height:10px;background:#e3e8e1;border-radius:6px;overflow:hidden;margin-top:6px}.bar span{display:block;height:100%;border-radius:6px}
  .tiga svg{display:block;margin:0 auto;border-radius:8px}.peta{display:flex;justify-content:center}.peta svg{height:116mm;width:auto;max-width:100%;border-radius:8px}.peta>div:last-child{display:none}.leg3{display:flex;gap:26px;justify-content:center;font-size:15px;margin-top:6px}.leg3 i{display:inline-block;width:14px;height:14px;border-radius:50%;border:1.5px solid #111;margin-right:6px;vertical-align:-2px}
  .t{width:100%;border-collapse:collapse;font-size:13.5px}.t th{background:#12251E;color:#fff;text-align:left;padding:6px 8px;font-weight:600}.t th.r{text-align:right}.t td{padding:5px 8px;border-bottom:1px solid #e3e8e1}.t th,.t.st td:nth-child(-n+2){white-space:nowrap}.t tr:nth-child(even) td{background:#f7faf8}.r{text-align:right}
  .dot{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid #111;margin-right:6px;vertical-align:-1px}.sw{display:inline-block;width:16px;height:12px;border:1px solid #222;margin-right:8px;vertical-align:-1px}
  .dua{display:grid;grid-template-columns:1fr 1fr;gap:22px}.dua h3{margin:0 0 8px;font-size:17px}.tl{margin:0;padding-left:20px;font-size:15px;line-height:1.55}
  .pf{display:grid;grid-template-columns:1.7fr 1fr;gap:22px;align-items:start}.ket{font-size:12px;color:#6b7a72;margin:6px 0 0}.nk{display:inline-block;margin-left:4px;padding:0 6px;border-radius:8px;background:#FFE58A;color:#5a4a00;font-size:11px}.kosong{font-size:18px;color:#6b7a72;text-align:center;margin-top:60px}
  @media print{body{background:#fff}.bar0{display:none}.sl{margin:0;box-shadow:none}}`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Presentasi Pemboran ${esc(nama)} ${st.from}–${st.to}</title><style>${css}</style></head><body>
    <div class="bar0"><button onclick="print()">Simpan PDF / cetak (16:9)</button><button onclick="try{opener._lapDL()}catch(e){alert('Buka ulang dari Dashboard untuk mengunduh Excel.')}">Unduh Excel data</button></div>${S.join("")}</body></html>`;
}
// ---------- Blok diagram 3D (topografi DEMNAS + lubang bor), dilihat miring dari samping ----------
async function blok3D(L, prof, o = {}) {
  const W = o.w ?? 1100, H = o.h ?? 560, az = ((o.az ?? 62) * Math.PI) / 180, tilt = ((o.tilt ?? 30) * Math.PI) / 180, VE = o.ve ?? 1.5;
  const pts = L.filter((x) => Number.isFinite(+x.lon) && Number.isFinite(+x.lat)).map((x) => ({ ...x, ll: x.x != null ? UTM.dari(+x.x, +x.y) : [+x.lon, +x.lat] }));
  if (!pts.length) return "<p>Belum ada titik bor untuk tampilan 3D.</p>";
  const lc = pts.reduce((s, p) => s + p.ll[1], 0) / pts.length, kx = 111320 * Math.cos((lc * Math.PI) / 180), ky = 110574, padM = o.pad ?? 450;
  let x0 = Math.min(...pts.map((p) => p.ll[0])) - padM / kx, x1 = Math.max(...pts.map((p) => p.ll[0])) + padM / kx, y0 = Math.min(...pts.map((p) => p.ll[1])) - padM / ky, y1 = Math.max(...pts.map((p) => p.ll[1])) + padM / ky;
  const NX = o.nx ?? 64, NY = Math.max(16, Math.round((NX * (y1 - y0) * ky) / ((x1 - x0) * kx))), Z = [];
  for (let j = 0; j <= NY; j++) { Z[j] = []; for (let i = 0; i <= NX; i++) Z[j][i] = await tinggiDi(x0 + ((x1 - x0) * i) / NX, y0 + ((y1 - y0) * j) / NY).catch(() => null); }
  const flat = Z.flat().filter((v) => v != null); if (!flat.length) return "<p>Data DEMNAS tidak tersedia untuk area ini.</p>";
  const zMin = Math.min(...flat), zMax = Math.max(...flat), fill = (v) => (v == null ? zMin : v);
  const cx = ((x1 - x0) * kx) / 2, cy = ((y1 - y0) * ky) / 2, zBase = zMin - (zMax - zMin) * 0.25 - 30;
  const maxDepth = Math.max(5, ...pts.map((p) => +p.kedalaman || +p.rencana_kedalaman || 0), ...(prof ?? []).map((r) => +r.sampai_m));
  const HE = o.he ?? Math.max(1, Math.round(((zMax - zMin) * VE * 0.55) / maxDepth)); // perbesaran kedalaman lubang agar terlihat
  const P3 = (mx, my, z) => { const x = mx - cx, y = my - cy, xr = x * Math.cos(az) - y * Math.sin(az), yr = x * Math.sin(az) + y * Math.cos(az);
    return [xr, -(z - zMin) * VE * Math.cos(tilt) - yr * Math.sin(tilt), yr]; };
  const gm = (i, j, z) => P3(((x1 - x0) * kx * i) / NX, ((y1 - y0) * ky * j) / NY, z);
  // skala ke layar
  const sample = []; for (const [i, j] of [[0, 0], [NX, 0], [0, NY], [NX, NY]]) { sample.push(gm(i, j, fill(Z[j][i]))); sample.push(gm(i, j, zBase)); sample.push(gm(i, j, zMax)); }
  const sxs = sample.map((p) => p[0]), sys = sample.map((p) => p[1]), sc = Math.min((W - 60) / (Math.max(...sxs) - Math.min(...sxs)), (H - 70) / (Math.max(...sys) - Math.min(...sys)));
  const ox = 30 - Math.min(...sxs) * sc, oy = 40 - Math.min(...sys) * sc, S = (p) => [p[0] * sc + ox, p[1] * sc + oy];
  const I = await (await fetch("peta/kontur/index.json")).json().catch(() => null), stops = I?.elev_stops ?? [[0, [38, 115, 77]], [1100, [245, 245, 245]]];
  const warna = (v, sh) => { let a = stops[0], b = stops[stops.length - 1]; for (let k = 0; k < stops.length - 1; k++) if (v >= stops[k][0] && v <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; }
    const t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]); return `rgb(${[0, 1, 2].map((c) => Math.round((a[1][c] + (b[1][c] - a[1][c]) * t) * sh)).join(",")})`; };
  const quads = [], cellX = ((x1 - x0) * kx) / NX, cellY = ((y1 - y0) * ky) / NY;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const z00 = fill(Z[j][i]), z10 = fill(Z[j][i + 1]), z01 = fill(Z[j + 1][i]), z11 = fill(Z[j + 1][i + 1]);
    const dzx = ((z10 + z11 - z00 - z01) / 2) * VE / cellX, dzy = ((z01 + z11 - z00 - z10) / 2) * VE / cellY, nl = Math.hypot(dzx, dzy, 1);
    const sh = Math.max(0.45, Math.min(1.15, 0.75 + 0.45 * ((-dzx * -0.6 + -dzy * 0.6 + 0.6) / nl)));   // cahaya dari barat laut
    const c = [gm(i, j, z00), gm(i + 1, j, z10), gm(i + 1, j + 1, z11), gm(i, j + 1, z01)];
    quads.push({ d: (c[0][2] + c[2][2]) / 2, pts: c.map(S), col: warna((z00 + z10 + z01 + z11) / 4, sh) });
  }
  quads.sort((a, b) => b.d - a.d);
  // dinding blok (sisi yang menghadap pengamat)
  let walls = ""; const sisi = [[(t) => [t, 0], NX], [(t) => [NX, t], NY], [(t) => [t, NY], NX], [(t) => [0, t], NY]];
  for (const [f, nn] of sisi) { const a = f(0), b = f(nn), mid = gm((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zMin), ctr = gm(NX / 2, NY / 2, zMin);
    if (mid[2] > ctr[2]) continue; // sisi belakang tidak digambar
    const atas = [], bawah = []; for (let t = 0; t <= nn; t++) { const [i, j] = f(t); atas.push(S(gm(i, j, fill(Z[j][i])))); bawah.unshift(S(gm(i, j, zBase))); }
    walls += `<polygon points="${[...atas, ...bawah].map((p) => p.join(",")).join(" ")}" fill="url(#tanah)" stroke="#5b4636" stroke-width=".6"/>`; }
  // topografi diredupkan (blur + kontras/saturasi rendah) agar lubang bor menonjol; tingkat diatur dari Dashboard
  const TOPO = { redup: { blur: 1.6, sat: 0.3, k: 0.5, b: 0.42 }, sedang: { blur: 0.8, sat: 0.6, k: 0.75, b: 0.2 }, asli: { blur: 0, sat: 1, k: 1, b: 0 } }[o.topo ?? (localStorage.getItem("topo3d") || "redup")] ?? { blur: 1.6, sat: 0.3, k: 0.5, b: 0.42 };
  const fid = "tf" + Math.random().toString(36).slice(2, 8);
  const filt = `<filter id="${fid}" x="-2%" y="-2%" width="104%" height="104%">${TOPO.blur ? `<feGaussianBlur stdDeviation="${TOPO.blur}"/>` : ""}<feColorMatrix type="saturate" values="${TOPO.sat}"/><feComponentTransfer>${["R", "G", "B"].map((c) => `<feFunc${c} type="linear" slope="${TOPO.k}" intercept="${TOPO.b}"/>`).join("")}</feComponentTransfer></filter>`;
  let g = `<g filter="url(#${fid})">` + walls + quads.map((q) => `<polygon points="${q.pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="${q.col}" stroke="${q.col}" stroke-width=".4"/>`).join("") + "</g>";
  // citra drone terbaru + lapisan peta dibungkus ke permukaan topografi (tidak diredupkan agar bukaan lahan tetap terbaca)
  let catCitra = "";
  try { const TW = Math.min(2400, Math.max(600, Math.round(((x1 - x0) * kx) / 1.2))), TH = Math.round((TW * (y1 - y0) * ky) / ((x1 - x0) * kx));
    const tex = await kanvasCitra([x0, y0, x1, y1], TW, TH, { lapisan: true, iup: true, maksTile: 260, lebar: Math.max(2, TW / 500) });
    if (tex.nama.length || tex.lapisan?.length) {
      const K = 2, cv = document.createElement("canvas"); cv.width = W * K; cv.height = H * K; const c2 = cv.getContext("2d");
      const tri = (s0, s1, s2, t0, t1, t2) => { const [x0_, y0_] = t0, [x1_, y1_] = t1, [x2_, y2_] = t2, den = x0_ * (y1_ - y2_) + x1_ * (y2_ - y0_) + x2_ * (y0_ - y1_); if (!den) return;
        const a = (s0[0] * (y1_ - y2_) + s1[0] * (y2_ - y0_) + s2[0] * (y0_ - y1_)) / den, b = (s0[0] * (x2_ - x1_) + s1[0] * (x0_ - x2_) + s2[0] * (x1_ - x0_)) / den, e = (s0[0] * (x1_ * y2_ - x2_ * y1_) + s1[0] * (x2_ * y0_ - x0_ * y2_) + s2[0] * (x0_ * y1_ - x1_ * y0_)) / den;
        const cc = (s0[1] * (y1_ - y2_) + s1[1] * (y2_ - y0_) + s2[1] * (y0_ - y1_)) / den, d = (s0[1] * (x2_ - x1_) + s1[1] * (x0_ - x2_) + s2[1] * (x1_ - x0_)) / den, f = (s0[1] * (x1_ * y2_ - x2_ * y1_) + s1[1] * (x2_ * y0_ - x0_ * y2_) + s2[1] * (x0_ * y1_ - x1_ * y0_)) / den;
        const mx = (s0[0] + s1[0] + s2[0]) / 3, my = (s0[1] + s1[1] + s2[1]) / 3, gr = (p) => [p[0] + (p[0] - mx) * 0.04 + Math.sign(p[0] - mx) * 0.6, p[1] + (p[1] - my) * 0.04 + Math.sign(p[1] - my) * 0.6];
        c2.save(); c2.beginPath(); [s0, s1, s2].map(gr).forEach((p, i) => (i ? c2.lineTo(p[0] * K, p[1] * K) : c2.moveTo(p[0] * K, p[1] * K))); c2.closePath(); c2.clip(); c2.setTransform(a * K, cc * K, b * K, d * K, e * K, f * K);
        const ux = Math.max(0, Math.floor(Math.min(x0_, x1_, x2_)) - 2), uy = Math.max(0, Math.floor(Math.min(y0_, y1_, y2_)) - 2), uw = Math.min(tex.width - ux, Math.ceil(Math.max(x0_, x1_, x2_)) + 2 - ux), uh = Math.min(tex.height - uy, Math.ceil(Math.max(y0_, y1_, y2_)) + 2 - uy);
        if (uw > 0 && uh > 0) c2.drawImage(tex, ux, uy, uw, uh, ux, uy, uw, uh); c2.restore(); };
      const qs = []; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const c = [gm(i, j, fill(Z[j][i])), gm(i + 1, j, fill(Z[j][i + 1])), gm(i + 1, j + 1, fill(Z[j + 1][i + 1])), gm(i, j + 1, fill(Z[j + 1][i]))];
        const t = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => [(u / NX) * TW, (1 - v / NY) * TH]); qs.push({ d: (c[0][2] + c[2][2]) / 2, s: c.map(S), t }); }
      qs.sort((a, b) => b.d - a.d);
      for (const q of qs) { c2.globalCompositeOperation = "destination-out"; c2.beginPath(); q.s.forEach((p, i) => (i ? c2.lineTo(p[0] * K, p[1] * K) : c2.moveTo(p[0] * K, p[1] * K))); c2.closePath(); c2.fill();
        c2.globalCompositeOperation = "source-over"; tri(q.s[0], q.s[1], q.s[2], q.t[0], q.t[1], q.t[2]); tri(q.s[0], q.s[2], q.s[3], q.t[0], q.t[2], q.t[3]); }
      g += `<image href="${cv.toDataURL("image/png")}" x="0" y="0" width="${W}" height="${H}"/>`;
      catCitra = [tex.nama.length ? `citra ${tex.nama.map(esc).join(", ")}` : "", tex.lapisan?.length ? `lapisan ${tex.lapisan.map(esc).join(", ")}` : "", "batas IUP (merah)"].filter(Boolean).join(" · ") + " · ";
    } } catch (e) { console.warn("citra 3D", e); }
  // lubang bor
  const hz = async (p) => fill(await tinggiDi(p.ll[0], p.ll[1]).catch(() => null)), PRF = prof ?? [];
  const lub = []; for (const p of pts) { const mx = (p.ll[0] - x0) * kx, my = (p.ll[1] - y0) * ky, z = await hz(p); lub.push({ p, mx, my, z, d: P3(mx, my, z)[2] }); }
  lub.sort((a, b) => b.d - a.d);
  for (const h of lub) { const top = S(P3(h.mx, h.my, h.z)), R = PRF.filter((r) => r.bhid === h.p.bhid), seg = (a, b) => [S(P3(h.mx, h.my, h.z - a * HE / VE)), S(P3(h.mx, h.my, h.z - b * HE / VE))];
    if (R.length) { const [a0, b0] = seg(0, Math.max(...R.map((r) => +r.sampai_m))); g += `<line x1="${a0[0]}" y1="${a0[1]}" x2="${b0[0]}" y2="${b0[1]}" stroke="#111" stroke-width="14" stroke-linecap="square"/>`; for (const r of R) { const [a, b] = seg(+r.dari_m, +r.sampai_m); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${esc(r.warna)}" stroke-width="11" stroke-linecap="butt"><title>${esc(h.p.bhid)} ${esc(r.nama_zona)} ${r.dari_m}–${r.sampai_m} m</title></line>`; } }
    else if (+h.p.kedalaman) { const [a, b] = seg(0, +h.p.kedalaman); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#111" stroke-width="13"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${WARNA_STATUS[h.p.status] ?? "#999"}" stroke-width="10"/>`; }
    if (+h.p.rencana_kedalaman && h.p.status !== "EOH" && h.p.status !== "STB") { const [a, b] = seg(0, +h.p.rencana_kedalaman); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#111" stroke-width="1.6" stroke-dasharray="4 3" opacity=".85"/>`; }
    const tiang = S(P3(h.mx, h.my, h.z + ((zMax - zMin) * (0.07 + 0.06 * (lub.indexOf(h) % 3))) / VE));   // tiang label berselang tinggi agar tidak bertumpuk
    g += `<line x1="${top[0]}" y1="${top[1]}" x2="${tiang[0]}" y2="${tiang[1]}" stroke="#111" stroke-width=".8"/><circle cx="${top[0]}" cy="${top[1]}" r="5.5" fill="${WARNA_STATUS[h.p.status] ?? "#999"}" stroke="#111" stroke-width="1.2"/>
      <text x="${tiang[0]}" y="${tiang[1] - 3}" font-size="11" font-weight="800" text-anchor="middle" stroke="#fff" stroke-width="3.5" paint-order="stroke">${esc(h.p.bhid)}</text>`; }
  // panah utara (proyeksi arah utara di permukaan)
  const u0 = S(P3(cx, cy, zMin)), u1 = S(P3(cx, cy + 1, zMin)), ang = Math.atan2(u1[1] - u0[1], u1[0] - u0[0]);
  g += `<g transform="translate(${W - 46},48) rotate(${(ang * 180) / Math.PI + 90})"><polygon points="0,-20 7,6 0,0 -7,6" fill="#111"/></g><text x="${W - 46}" y="84" font-size="12" font-weight="700" text-anchor="middle">U</text>`;
  const Zs = [...new Map(PRF.map((r) => [r.zona, r])).values()];
  const leg = `<div style="font-size:11px;color:#333;margin-top:4px">${catCitra}Topografi DEMNAS, tinggi ${zMin.toFixed(0)}–${zMax.toFixed(0)} m, perbesaran vertikal ${VE}× · <b>panjang lubang bor diperbesar ${HE}×</b> agar terlihat · garis putus = kedalaman rencana · dilihat dari arah ${["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"][Math.round((((o.az ?? 62) + 180) % 360) / 45) % 8]} · ${Zs.map((r) => `<span style="display:inline-block;width:12px;height:10px;background:${esc(r.warna)};border:1px solid #222;vertical-align:-1px"></span> ${esc(r.nama_zona)}`).join(" ")}</div>`;
  return `<svg width="${o.fit ? "100%" : W}" viewBox="0 0 ${W} ${H}" style="background:linear-gradient(#eaf2f7,#fff);font-family:Arial,sans-serif;${o.fit ? `max-height:${o.fit}px;` : ""}"><defs>${filt}<linearGradient id="tanah" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98b62"/><stop offset=".55" stop-color="#8b5e3c"/><stop offset="1" stop-color="#5b4636"/></linearGradient></defs>${g}</svg>${leg}`;
}
// ---------- Pesan WhatsApp progres pekerjaan untuk client ----------
// Disusun dari data X-Terra (meter bor, lubang, conto, recovery, kendala). Tanpa data internal: BBM/oli, biaya, nama crew, kepatuhan operator.
async function waProgresClient(st0) {
  if (!online()) return alert("Menyusun pesan WA perlu sinyal internet.");
  const S = { format: "rig", jenis: "harian", salam: "Bapak/Ibu", pengirim: me?.full_name ?? "", lubang: true, kum: true, conto: true, kendala: true, rencana: "", catatan: "", ...JSON.parse(localStorage.getItem("waProgres") || "{}") };
  S.rencana = ""; S.catatan = ""; // isi bebas tidak dibawa ke hari berikutnya
  const m = modal(`<h3 style="margin-top:0">💬 Pesan WhatsApp progres untuk client</h3>
    <p class="muted" style="margin-top:0">Disusun otomatis dari <b>DDR</b> (meter coring + open hole = progres resmi; foto run tidak dipakai), per titik bor untuk semua rig. Tidak memuat BBM/oli, biaya, nama crew maupun kepatuhan operator. Periksa dulu, teks boleh diubah sebelum dikirim.</p>
    <label>Format pesan</label><select id="waFmt"><option value="rig">Format lapangan — per rig (PROGRES BOR HARIAN)</option><option value="titik">Format formal — per titik bor</option></select>
    <div class="row" style="flex-wrap:wrap"><div style="flex:1 1 140px"><label>Jenis laporan</label><select id="waJ"><option value="harian">Harian (satu tanggal)</option><option value="periode">Periode (dari–sampai)</option></select></div>
      <div style="flex:1 1 130px" id="waFw"><label>Dari</label><input type="date" id="waF" value="${esc(st0.from)}"></div>
      <div style="flex:1 1 130px"><label id="waTl">Tanggal</label><input type="date" id="waT" value="${esc(st0.to)}"></div></div>
    <div class="row" style="flex-wrap:wrap"><div style="flex:1 1 140px"><label>Sapaan</label><input id="waS" value="${esc(S.salam)}"></div><div style="flex:1 1 160px"><label>Nama pengirim</label><input id="waP" value="${esc(S.pengirim)}"></div></div>
    <label>Rencana kerja berikutnya (opsional)</label><textarea id="waR" rows="2" placeholder="mis. RIG 1 lanjut TG-014, RIG 2 pindah ke TG-021"></textarea>
    <label>Catatan lain (opsional)</label><textarea id="waC" rows="2" placeholder="mis. akses jalan ke blok B diperbaiki"></textarea>
    <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0;font-size:13px">${[["lubang", "Rincian per lubang"], ["kum", "Kumulatif vs target"], ["conto", "Conto & recovery (data geologi)"], ["kendala", "Kendala / standby"]].map(([k, l]) => `<label style="display:flex;gap:4px;align-items:center;margin:0"><input type="checkbox" data-wa="${k}" ${S[k] ? "checked" : ""} style="width:auto">${l}</label>`).join("")}</div>
    <label>Pratinjau pesan (boleh diubah)</label><textarea id="waX" rows="14" style="font-family:ui-monospace,monospace;font-size:12.5px">Menyusun…</textarea>
    <p class="muted" id="waI" style="font-size:12px;margin:4px 0"></p>
    <div class="row"><button class="sec" id="waB">Tutup</button><button class="sec" id="waK">Salin</button><a class="btn" id="waW" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#1FA855;color:#fff;border-radius:10px;padding:11px 8px;font-weight:700;text-decoration:none">💬 Kirim lewat WhatsApp</a></div>`);
  const $m = (s) => m.querySelector(s); $m("#waJ").value = S.jenis; $m("#waFmt").value = S.format === "titik" ? "titik" : "rig";
  const simpan = () => localStorage.setItem("waProgres", JSON.stringify({ format: $m("#waFmt").value, jenis: $m("#waJ").value, salam: $m("#waS").value, pengirim: $m("#waP").value, ...Object.fromEntries([...m.querySelectorAll("[data-wa]")].map((c) => [c.dataset.wa, c.checked])) }));
  let D = null, kunci = "", diubah = false;
  const n = (x) => Number(x) || 0, fm = (x, d = 1) => n(x).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
  const tglPanjang = (t) => new Date(t + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const tglPendek = (t) => new Date(t + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  // Progres resmi = meter DDR (coring + open hole). Foto run hanya pembanding, tidak dipakai di pesan.
  async function muat(from, to) {
    const k = [from, to, st0.proj, st0.rig].join("|"); if (k === kunci && D) return D; kunci = k;
    sessionStorage.setItem("filterProyek", st0.proj || "");
    const pf = await proyekFilter(), PJs = JSON.parse(localStorage.getItem("projects") || "[]"), PJ = PJs.find((p) => p.code === st0.proj) ?? (PJs.length === 1 ? PJs[0] : null);
    const { data: pj } = PJ ? await sb.from("project").select("*").eq("code", PJ.code).maybeSingle() : { data: null };
    const R = (q) => (st0.rig ? q.eq("rig", st0.rig) : pf ? q.in("rig", pf.rigs.length ? pf.rigs : ["-"]) : q);
    const [{ data: dd }, { data: hl }, LB0] = await Promise.all([
      R(sb.from("ddr").select("rig,report_date,shift,bhid,coring,open_hole,hours,target_m,total_depth_m,status,notes").lte("report_date", to)).order("report_date").order("shift"),
      sb.from("v_dash_hole").select("bhid,stop_date,eoh,jumlah_conto,recovery_pct"),
      ambilLubangPeta(),
    ]);
    const LB = (LB0.data ?? []).filter((x) => (!pf || pf.bhids.includes(x.bhid) || x.status === "RENCANA") && (!st0.rig || !x.rig || x.rig === st0.rig || x.status === "RENCANA"));
    return (D = { from, to, PJ: pj ?? PJ, dd: (dd ?? []).filter((d) => !pf || !d.bhid || pf.bhids.includes(d.bhid) || pf.rigs.includes(d.rig)), hl: hl ?? [], LB });
  }
  // satu baris DDR → [{bhid, rig, from, to, m, core, jenis}] ; Hole ID per baris (DDR dua lubang) bila ada, selain itu Hole ID header
  const barisDDR = (d) => [...(d.coring ?? []).map((x) => ({ ...x, jenis: "coring" })), ...(d.open_hole ?? []).map((x) => ({ ...x, jenis: "open" }))]
    .filter((x) => Number.isFinite(+x.from) && Number.isFinite(+x.to) && +x.to > +x.from)
    .map((x) => ({ bhid: x.bhid || d.bhid || "-", rig: d.rig, tgl: d.report_date, from: +x.from, to: +x.to, m: +x.to - +x.from, core: x.jenis === "coring" && x.core != null ? +x.core : null, coring: x.jenis === "coring" }));
  const KENDALA = ["WEATHER/UNSAVE CONDITION", "WAITING WATER", "WAITING ACCESS", "SERVICE/MAINTENANCE", "HOLE CONDITION/CEMENTING", "RUNNING/PULL UP/STUCK ROD", "DRILL SITE PREPARATION"];
  const NAMA_K = { "WEATHER/UNSAVE CONDITION": "Cuaca / kondisi tidak aman", "WAITING WATER": "Menunggu air", "WAITING ACCESS": "Menunggu akses", "SERVICE/MAINTENANCE": "Servis / perbaikan rig", "HOLE CONDITION/CEMENTING": "Kondisi lubang / cementing", "RUNNING/PULL UP/STUCK ROD": "Stang terjepit / tarik stang", "DRILL SITE PREPARATION": "Persiapan drill site" };
  // Format lapangan (disepakati 24/11): per rig → titik, lalu HARI INI + KUMULATIF (redrill & recovery lubang awal ditampilkan)
  const susunRig = () => {
    const { from, to, PJ, dd, hl, LB } = D, harian = from === to, f2 = (x) => fm(x, 2), o = Object.fromEntries([...m.querySelectorAll("[data-wa]")].map((c) => [c.dataset.wa, c.checked]));
    const semua = dd.flatMap(barisDDR), per = semua.filter((x) => x.tgl >= from && x.tgl <= to), ddPer = dd.filter((d) => d.report_date >= from && d.report_date <= to);
    const HL = Object.fromEntries(hl.map((h) => [h.bhid, h])), ST = Object.fromEntries(LB.map((x) => [x.bhid, x]));
    const dalam = (b) => Math.max(0, ...semua.filter((x) => x.bhid === b && x.tgl <= to).map((x) => x.to));
    const rec = (xs) => { const c = xs.filter((x) => x.coring && x.core != null), i = c.reduce((s, x) => s + x.m, 0); return i ? (100 * c.reduce((s, x) => s + x.core, 0)) / i : null; };
    const stat = (b) => { const s = ST[b]?.status; return s === "EOH" || s === "STB" ? s : HL[b]?.stop_date ? "SELESAI" : "LANJUT"; };
    const nConto = (b) => n(HL[b]?.jumlah_conto);
    const L = [`*PROGRES BOR ${harian ? "HARIAN" : "PERIODE"}*`, `*${String(PJ?.nama ?? "Proyek eksplorasi nikel").toUpperCase()}*`, harian ? tglPanjang(to) : `${tglPendek(from)} – ${tglPendek(to)} ${to.slice(0, 4)}`, ""];
    const rigs = [...new Set([...ddPer.map((d) => d.rig), ...per.map((x) => x.rig)])].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
    let mHari = 0, cHari = 0;
    for (const r of rigs) {
      const xsR = per.filter((x) => x.rig === r), titik = [...new Set(xsR.map((x) => x.bhid))], dR = ddPer.filter((d) => d.rig === r);
      const K = {}; for (const d of dR) for (const h of d.hours ?? []) if (KENDALA.includes(h.kategori)) { const mn = durMin(h.mulai, h.selesai); if (mn) K[NAMA_K[h.kategori] + (h.ket ? ` (${String(h.ket).trim()})` : "")] = (K[NAMA_K[h.kategori] + (h.ket ? ` (${String(h.ket).trim()})` : "")] ?? 0) + mn; }
      const sbT = Object.entries(K).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${fm(v / 60)} jam ${k}`).join("; ");
      const catatan = [...new Set(dR.map((d) => String(d.notes ?? "").replace(/\[[^\]]*\]/g, "").trim()).filter(Boolean))].join("; ");
      for (const b of titik.length ? titik : [dR[0]?.bhid ?? "-"]) {
        const xs = xsR.filter((x) => x.bhid === b), mm = xs.reduce((s, x) => s + x.m, 0), asal = asalRedrill(b), rc = rec(xs);
        mHari += mm; const nc = xs.length ? nConto(b) : 0;
        L.push(`*${r} – ${b}*${asal ? ` (REDRILL dari ${asal})` : ""}`);
        L.push(`• Kedalaman : ${xs.length ? `${f2(Math.min(...xs.map((x) => x.from)))} → ${f2(Math.max(...xs.map((x) => x.to)))} m (+${f2(mm)} m)` : "belum ada meter di DDR"}`);
        if (o.conto) { L.push(`• Recovery : ${rc != null ? fm(rc, 0) + "%" : "–"}`); L.push(`• Jumlah sampel : ${nc || "– (logging belum masuk)"}`); }
        L.push(`• Status : ${stat(b)}${["EOH", "STB"].includes(stat(b)) ? ` (${f2(dalam(b))} m)` : ""}`);
        if (o.kendala) { L.push(`• Standby : ${sbT || "–"}`); L.push(`• Kendala : ${catatan || "–"}`); }
        if (asal && o.conto) { const xa = semua.filter((x) => x.bhid === asal), ra = rec(xa);
          L.push(`• Recovery ${asal} (lubang awal, ${f2(dalam(asal))} m) : ${ra != null ? fm(ra, 1) + "%" : "–"}`); }
        L.push("");
      }
    }
    if (!rigs.length) L.push("Belum ada DDR untuk tanggal ini.", "");
    const DDRbelum = harian ? (JSON.parse(localStorage.getItem("projects") || "[]").find((p) => p.code === PJ?.code)?.rigs ?? []).filter((r) => (!st0.rig || r === st0.rig) && !ddPer.some((d) => d.rig === r)) : [];
    cHari = [...new Set(per.map((x) => x.bhid))].reduce((s, b) => s + nConto(b), 0);
    L.push(`*${harian ? "HARI INI" : "PERIODE INI"} : ${f2(mHari)} m | ${cHari || "–"} sampel | ${rigs.length} rig aktif*`);
    if (DDRbelum.length) L.push(`DDR belum masuk: ${DDRbelum.join(", ")}`);
    if (o.kum) {
      const sampai = semua.filter((x) => x.tgl <= to), dibor = [...new Set(sampai.map((x) => x.bhid))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
      const mCum = sampai.reduce((s, x) => s + x.m, 0), selesai = dibor.filter((b) => ["EOH", "STB", "SELESAI"].includes(stat(b))), red = dibor.filter((b) => asalRedrill(b));
      const nRen = PJ?.target_lubang || LB.length, rc = rec(sampai), nc = dibor.reduce((s, b) => s + nConto(b), 0);
      L.push("", `*KUMULATIF s/d ${tglPendek(to)} ${to.slice(0, 4)}*`, `• Total kedalaman dibor : ${f2(mCum)} m${PJ?.target_meter ? ` dari target ${fm(PJ.target_meter, 0)} m (${Math.round((100 * mCum) / PJ.target_meter)}%)` : ""}`);
      for (const b of dibor) { const asal = asalRedrill(b), punyaRedrill = dibor.find((x) => asalRedrill(x) === b), r = rec(sampai.filter((x) => x.bhid === b)), st = stat(b);
        L.push(`   – ${b} : ${f2(dalam(b))} m (${punyaRedrill ? `redrill → ${punyaRedrill}` : st === "LANJUT" ? "lanjut" : st.toLowerCase()}${asal ? `, redrill dari ${asal}` : ""}${o.conto && r != null ? `, recovery ${fm(r, 1)}%` : ""})`); }
      L.push(`• Titik selesai (EOH/STB) : ${selesai.length}${nRen ? ` dari ${nRen} titik rencana (${Math.round((100 * selesai.length) / nRen)}%)` : ""}`);
      L.push(`• Titik sedang dibor : ${dibor.filter((b) => stat(b) === "LANJUT" && !dibor.some((x) => asalRedrill(x) === b)).length} | Redrill : ${red.length}${red.length ? ` (${red.map((b) => asalRedrill(b)).join(", ")})` : ""}`);
      if (o.conto) { if (nc) L.push(`• Total sampel (logging masuk database) : ${nc}`); if (rc != null) L.push(`• Rata-rata recovery semua lubang : ${fm(rc, 1)}%`); }
    }
    const ren = $m("#waR").value.trim(), cat = $m("#waC").value.trim();
    L.push("", `Rencana besok : ${ren ? ren.replace(/\n+/g, "; ") : "–"}`);
    if (cat) L.push(`Catatan : ${cat.replace(/\n+/g, "; ")}`);
    L.push(`Pelapor : ${$m("#waP").value.trim() || "Tim lapangan"}`, "", `_Sumber: DDR X-Terra per ${new Date().toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}_`);
    return L.join("\n");
  };
  const susun = () => {
    if ($m("#waFmt").value === "rig") return susunRig();
    const { from, to, PJ, dd, hl, LB } = D, harian = from === to;
    const L = []; const o = Object.fromEntries([...m.querySelectorAll("[data-wa]")].map((c) => [c.dataset.wa, c.checked]));
    const proyek = PJ?.nama ?? "Proyek eksplorasi nikel", rigTeks = st0.rig ? ` · ${st0.rig}` : "";
    L.push(`*LAPORAN PROGRES PEMBORAN${harian ? " HARIAN" : ""}*`, `*${proyek}*${rigTeks}`, harian ? tglPanjang(to) : `Periode ${tglPendek(from)} – ${tglPendek(to)} ${to.slice(0, 4)}`, "");
    L.push(`Yth. ${$m("#waS").value.trim() || "Bapak/Ibu"},`, `berikut progres pekerjaan pemboran ${harian ? "hari ini" : "periode ini"} (sumber: DDR):`, "");
    const semua = dd.flatMap(barisDDR), per = semua.filter((x) => x.tgl >= from && x.tgl <= to), ddPer = dd.filter((d) => d.report_date >= from && d.report_date <= to);
    const mPer = per.reduce((s, x) => s + x.m, 0), perRig = {}; for (const x of per) perRig[x.rig] = (perRig[x.rig] ?? 0) + x.m;
    const rigs = [...new Set([...ddPer.map((d) => d.rig), ...Object.keys(perRig)])].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
    const HL = Object.fromEntries(hl.map((h) => [h.bhid, h])), ST = Object.fromEntries(LB.map((x) => [x.bhid, x]));
    const dalam = (b) => Math.max(0, ...semua.filter((x) => x.bhid === b).map((x) => x.to));
    const TG = {}; for (const d of dd) if (d.bhid && d.target_m) TG[d.bhid] = +d.target_m;
    const statusL = (b) => { const s = ST[b]?.status; return s === "EOH" || s === "STB" ? s : HL[b]?.stop_date ? "selesai" : "berjalan"; };
    L.push(`📍 *${harian ? "Hari ini" : "Periode ini"}*`);
    L.push(`• Meter bor: *${fm(mPer)} m*${rigs.length > 1 ? ` (${rigs.map((r) => `${r} ${fm(perRig[r] ?? 0)} m`).join(" · ")})` : ""}`);
    if (!harian) { const hari = new Set(per.map((x) => x.tgl)).size; L.push(`• Hari bor aktif: ${hari} · rata-rata ${hari ? fm(mPer / hari) : "0"} m/hari`); }
    const DDRbelum = harian ? (JSON.parse(localStorage.getItem("projects") || "[]").find((p) => p.code === PJ?.code)?.rigs ?? []).filter((r) => (!st0.rig || r === st0.rig) && !ddPer.some((d) => d.rig === r)) : [];
    if (DDRbelum.length) L.push(`• DDR belum masuk: ${DDRbelum.join(", ")}`);
    // per titik (gabungan 2 rig): kedalaman, meter periode, recovery, conto, status
    const titik = [...new Set(per.map((x) => x.bhid))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
    if (o.lubang && titik.length) {
      L.push("", `🕳️ *Per titik bor*`);
      for (const b of titik) { const xs = per.filter((x) => x.bhid === b), mm = xs.reduce((s, x) => s + x.m, 0), cr = xs.filter((x) => x.coring && x.core != null), ci = cr.reduce((s, x) => s + x.m, 0);
        const rec = ci ? (100 * cr.reduce((s, x) => s + x.core, 0)) / ci : null, t = TG[b], st = statusL(b), nc = n(HL[b]?.jumlah_conto);
        L.push(`*${b}*${asalRedrill(b) ? " (redrill)" : ""} · ${[...new Set(xs.map((x) => x.rig))].join("/")}`);
        L.push(`   Kedalaman ${fm(dalam(b), 2)} m${t ? ` / target ${fm(t)} m` : ""} · +${fm(mm, 2)} m ${harian ? "hari ini" : "periode ini"}`);
        L.push(`   ${[o.conto && rec != null ? `Recovery ${fm(rec, 0)}%` : null, o.conto && nc ? `conto ${nc}` : null, `status ${st === "berjalan" ? "lanjut bor" : st}`].filter(Boolean).join(" · ")}`); }
    } else if (titik.length) L.push(`• Titik dikerjakan: ${titik.join(", ")}`);
    L.push("");
    if (o.kum) {
      const setSelesai = new Set([...LB.filter((x) => ["EOH", "STB", "SELESAI"].includes(x.status)).map((x) => x.bhid), ...hl.filter((h) => h.stop_date && h.stop_date.slice(0, 10) <= to).map((h) => h.bhid)]);
      const dibor = new Set(semua.map((x) => x.bhid)), mCum = semua.reduce((s, x) => s + x.m, 0), mRed = semua.filter((x) => asalRedrill(x.bhid)).reduce((s, x) => s + x.m, 0);
      const nRen = LB.filter((x) => x.status === "RENCANA" && !dibor.has(x.bhid) && !setSelesai.has(x.bhid)).length, pc = (a, b) => (b ? ` (${Math.round((100 * a) / b)}%)` : "");
      L.push(`📊 *Kumulatif s/d ${tglPendek(to)}*`);
      L.push(`• Total meter bor: *${fm(mCum)} m*${PJ?.target_meter ? ` dari target ${fm(PJ.target_meter, 0)} m${pc(mCum, PJ.target_meter)}` : ""}${mRed ? ` (termasuk redrill ${fm(mRed)} m)` : ""}`);
      L.push(`• Titik selesai: *${setSelesai.size}*${PJ?.target_lubang ? ` dari target ${PJ.target_lubang}${pc(setSelesai.size, PJ.target_lubang)}` : ""} · sudah dibor ${dibor.size}${nRen ? ` · rencana belum dibor ${nRen}` : ""}`);
      if (o.conto) { const nc = hl.filter((h) => dibor.has(h.bhid)).reduce((s, h) => s + n(h.jumlah_conto), 0), cr = semua.filter((x) => x.coring && x.core != null), ci = cr.reduce((s, x) => s + x.m, 0);
        if (nc) L.push(`• Conto/sample terkumpul: ${nc.toLocaleString("id-ID")}`);
        if (ci) L.push(`• Recovery core rata-rata: ${fm((100 * cr.reduce((s, x) => s + x.core, 0)) / ci, 0)}%`); }
      L.push("");
    }
    if (o.kendala) {
      const K = {}; for (const d of ddPer) for (const h of d.hours ?? []) if (KENDALA.includes(h.kategori)) { const mn = durMin(h.mulai, h.selesai); if (mn) { const k = `${NAMA_K[h.kategori]}${h.ket ? ` (${String(h.ket).trim()})` : ""}`; K[k] = (K[k] ?? { m: 0, r: new Set() }); K[k].m += mn; K[k].r.add(d.rig); } }
      const top = Object.entries(K).sort((a, b) => b[1].m - a[1].m).filter(([, x]) => x.m >= 15).slice(0, 5);
      L.push(`⏸️ *Standby / kendala*`, ...(top.length ? top.map(([k, x]) => `• ${k}: ${fm(x.m / 60)} jam${rigs.length > 1 ? ` · ${[...x.r].join("/")}` : ""}`) : ["• Tidak ada kendala berarti"]), "");
    }
    const ren = $m("#waR").value.trim(), cat = $m("#waC").value.trim();
    if (ren) L.push(`🗓️ *Rencana berikutnya*`, ...ren.split(/\n+/).map((x) => `• ${x.replace(/^[•\-–*]\s*/, "")}`), "");
    if (cat) L.push(`📝 *Catatan*`, ...cat.split(/\n+/).map((x) => `• ${x.replace(/^[•\-–*]\s*/, "")}`), "");
    L.push("Demikian disampaikan, terima kasih.", "", `Salam,`, `*${$m("#waP").value.trim() || "Tim lapangan"}*`, "PT Terra Grapindo Eco Prima", `_Data X-Terra per ${new Date().toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}; angka hari berjalan dapat bertambah setelah semua laporan masuk._`);
    return L.join("\n");
  };
  const pasang = (teks) => { $m("#waX").value = teks; $m("#waW").href = "https://wa.me/?text=" + encodeURIComponent(teks); diubah = false;
    $m("#waI").textContent = `${teks.length} karakter.${D?.dd.some((d) => d.report_date >= D.from && d.report_date <= D.to) ? "" : " Belum ada DDR untuk tanggal ini — periksa tanggalnya atau tunggu DDR terkirim."}`; };
  const perbarui = async () => {
    const harian = $m("#waJ").value === "harian"; $m("#waFw").style.display = harian ? "none" : ""; $m("#waTl").textContent = harian ? "Tanggal" : "Sampai";
    const to = $m("#waT").value || todayWIB(), from = harian ? to : $m("#waF").value || to;
    if (from > to) return pasang("Tanggal 'Dari' lebih besar dari 'Sampai'.");
    $m("#waI").textContent = "Mengambil data…";
    try { await muat(from, to); pasang(susun()); } catch (e) { pasang("Gagal menyusun pesan: " + e.message); }
    simpan();
  };
  let tunda; const nanti = () => { clearTimeout(tunda); tunda = setTimeout(perbarui, 350); };
  for (const id of ["#waJ", "#waF", "#waT"]) $m(id).onchange = perbarui;
  $m("#waFmt").onchange = () => { if (D) { pasang(susun()); simpan(); } };
  for (const el of [$m("#waS"), $m("#waP"), $m("#waR"), $m("#waC"), ...m.querySelectorAll("[data-wa]")]) el.oninput = el.onchange = () => { if (D) { pasang(susun()); simpan(); } };
  $m("#waX").oninput = () => { diubah = true; $m("#waW").href = "https://wa.me/?text=" + encodeURIComponent($m("#waX").value); };
  $m("#waB").onclick = () => m.remove();
  $m("#waK").onclick = async () => { try { await navigator.clipboard.writeText($m("#waX").value); $m("#waK").textContent = "✓ Tersalin"; } catch { $m("#waX").select(); document.execCommand("copy"); $m("#waK").textContent = "✓ Tersalin"; } setTimeout(() => ($m("#waK").textContent = "Salin"), 1800); };
  void nanti; await perbarui();
}
async function laporanProgres(st) {
  if (!online()) return alert("Laporan perlu sinyal internet.");
  const w = st.wadah ?? jendelaDok(st.slide ? "Presentasi pemboran 16:9" : "Laporan progres pemboran", st.slide ? "16:9" : "A4");
  try {
    sessionStorage.setItem("filterProyek", st.proj || "");
    const pf = await proyekFilter();
    const { data: pjAll } = await sb.from("project").select("*");
    const PJ = (pjAll ?? []).find((p) => p.code === st.proj) ?? null;
    const R = (q) => (st.rig ? q.eq("rig", st.rig) : pf ? q.in("rig", pf.rigs.length ? pf.rigs : ["-"]) : q);
    const inB = (q, col) => (pf ? q.in(col, pf.bhids.length ? pf.bhids : ["-"]) : q);
    const [{ data: rd }, { data: rdAll }, { data: tm }, { data: hl }, { data: lg }, { data: kp0 }, { data: pn }, { data: dd }, { data: qc }] = await Promise.all([
      R(sb.from("v_dash_rig_day").select("*").gte("tanggal", st.from).lte("tanggal", st.to)).order("tanggal"),
      R(sb.from("v_dash_rig_day").select("tanggal,meter_bor").lte("tanggal", st.to)),
      R(sb.from("v_dash_time").select("*").gte("tanggal", st.from).lte("tanggal", st.to)),
      inB(sb.from("v_dash_hole").select("*"), "bhid"),
      R(sb.from("v_logging_lubang").select("*")),
      me?.role === "client" ? { data: [] } : R(sb.from("v_kepatuhan_harian").select("tanggal,user_id,nama,peran,rig,status,kurang").gte("tanggal", st.from).lte("tanggal", st.to)),
      sb.from("penugasan").select("user_id,project"),
      R(sb.from("ddr").select("bhid,rig,report_date,target_m,total_depth_m").lte("report_date", st.to)).order("report_date"),
      me?.role === "client" ? { data: [] } : inB(sb.from("v_sample_qc").select("bhid,chk_density,status"), "bhid"),
    ]);
    const days = rd ?? [], holesAll = hl ?? [], holes = holesAll.filter((h) => h.jumlah_conto > 0);
    const LB = ((await ambilLubangPeta()).data ?? []).filter((x) => !pf || pf.bhids.includes(x.bhid) || x.status === "RENCANA").sort((a, b) => String(a.bhid).localeCompare(String(b.bhid), "id", { numeric: true }));
    await muatZona();
    const { data: prof } = await sb.from("v_profil_bor").select("*").in("bhid", LB.map((x) => x.bhid).length ? LB.map((x) => x.bhid) : ["-"]).order("bhid").order("dari_m");
    const titikRows = LB.map((x) => [x.bhid, LABEL_STATUS[x.status] ?? x.status, x.rig ?? "", x.kedalaman ?? "", x.rencana_kedalaman ?? "", x.dip ?? "", x.azimuth ?? "", x.di_dalam_iup === false ? "DI LUAR IUP" : "dalam IUP"]);
    const P = Object.fromEntries((pn ?? []).map((p) => [p.user_id, p.project]));
    const kp = (kp0 ?? []).filter((r) => !st.proj || P[r.user_id] === st.proj);
    const n = (x) => Number(x) || 0, f1 = (x) => (x == null || x === "" ? "" : Number(x).toFixed(1)), f2 = (x) => (x == null || x === "" ? "" : Number(x).toFixed(2));
    const pct = (a, b) => (b ? Math.round((100 * a) / b) : null), P_ = (x) => (x == null ? "-" : x + "%");
    const sum = (xs, k) => xs.reduce((s, x) => s + n(x[k]), 0);
    // target per lubang dari DDR terakhir
    const TG = {}; for (const d of dd ?? []) if (d.bhid) TG[d.bhid] = { target: d.target_m ?? TG[d.bhid]?.target, td: d.total_depth_m ?? TG[d.bhid]?.td };
    const LG = Object.fromEntries((lg ?? []).map((l) => [l.bhid, l])), HL = Object.fromEntries(holesAll.map((h) => [h.bhid, h]));
    const bhids = [...new Set([...(lg ?? []).map((l) => l.bhid), ...holes.map((h) => h.bhid)])].filter((b) => !pf || pf.bhids.includes(b)).sort();
    const holeRow = (b) => { const l = LG[b] ?? {}, h = HL[b] ?? {}, t = TG[b] ?? {}, bor = n(l.kedalaman_bor) || n(h.eoh), tgt = n(t.target);
      const selesai = !!h.stop_date || (tgt > 0 && bor >= tgt - 0.05) || (n(t.td) > 0 && bor >= n(t.td) - 0.05);
      return { b, rig: l.rig ?? "", mulai: (h.start_date ?? l.mulai ?? "").toString().slice(0, 10), akhir: (l.terakhir_bor ?? h.stop_date ?? "").toString().slice(0, 10), bor, tgt, logm: n(l.kedalaman_logging), conto: n(l.jumlah_conto ?? h.jumlah_conto), lstat: l.status ?? "-", tl: h.tebal_limonit, ts: h.tebal_saprolit, rec: h.recovery_pct, selesai }; };
    const HR = bhids.map(holeRow), nSelesai = HR.filter((h) => h.selesai).length;
    const petaGrafik = await petaSVG(LB.map((x) => ({ ...x, rec: HR.find((h) => h.b === x.bhid)?.rec })), { w: 960, h: 600, grafik: prof ?? [] }).catch((e) => `<p>Peta gagal dibuat: ${esc(e.message)}</p>`);
    const gbr3D = await blok3D(LB, prof, { w: 960, h: 500 }).catch((e) => `<p>Tampilan 3D gagal: ${esc(e.message)}</p>`);
    const mPer = sum(days, "meter_bor"), mCum = sum(rdAll ?? [], "meter_bor");
    const klien = isClient();
    const K = computeKPI(days, tm ?? [], [], holes).filter(([l]) => !klien || (l !== "Foto core lengkap" && !/BBM|Oli/i.test(l) && (clientGeo() || !GEO_KPI.includes(l))));
    // per rig
    const rigs = [...new Set(days.map((d) => d.rig))].sort();
    const rigRows = rigs.map((r) => { const xs = days.filter((d) => d.rig === r), act = xs.filter((d) => n(d.meter_bor) > 0), m = sum(xs, "meter_bor"), j = sum(xs, "jam_kerja_bor"), b = sum(xs, "bbm_liter");
      return [r, act.length, +m.toFixed(1), sum(xs, "jumlah_run"), j ? +(m / j).toFixed(2) : "", act.length ? +(m / act.length).toFixed(1) : "", +(sum(xs, "standby_menit") / 60).toFixed(1), +b.toFixed(0), m ? +(b / m).toFixed(2) : "",
        P_(pct(act.filter((d) => d.ada_p2h && !d.p2h_bermasalah).length, act.length)), P_(pct(act.filter((d) => d.n_ddr_ttd > 0).length, act.length))]; });
    // harian
    const dates = [...new Set(days.map((d) => d.tanggal))].sort(); let cum = mCum - mPer;
    const dayRows = dates.map((t) => { const m = days.filter((d) => d.tanggal === t).reduce((s, d) => s + n(d.meter_bor), 0); cum += m; return [t, days.filter((d) => d.tanggal === t && n(d.meter_bor) > 0).length, +m.toFixed(1), +cum.toFixed(1)]; });
    // standby
    const sb2 = {}; for (const x of (tm ?? []).filter((x) => ["Standby", "Perbaikan"].includes(x.kegiatan))) sb2[`${x.kegiatan}: ${x.alasan || "-"}`] = (sb2[`${x.kegiatan}: ${x.alasan || "-"}`] ?? 0) + n(x.menit);
    const sbRows = Object.entries(sb2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, m]) => [k, +(m / 60).toFixed(1)]);
    // kepatuhan operator
    const ops = [...new Map(kp.map((r) => [r.user_id, r])).values()];
    const opRows = ops.map((o) => { const xs = kp.filter((r) => r.user_id === o.user_id && ["LENGKAP", "SEBAGIAN", "BELUM"].includes(r.status)), ok = xs.filter((r) => r.status === "LENGKAP").length;
      const kr = {}; for (const r of xs) for (const k of r.kurang ?? []) kr[k] = (kr[k] ?? 0) + 1;
      return [o.nama ?? "-", o.peran ?? "", o.rig ?? "", xs.length, ok, xs.filter((r) => r.status === "SEBAGIAN").length, xs.filter((r) => r.status === "BELUM").length, P_(pct(ok, xs.length)), Object.entries(kr).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => `${k} (${c})`).join(", ")]; })
      .sort((a, b) => (parseInt(a[7]) || 0) - (parseInt(b[7]) || 0));
    // QC & data
    const nC = (qc ?? []).length, nLab = (qc ?? []).filter((x) => x.chk_density === "MENUNGGU LAB").length;
    const lgc = (s) => HR.filter((h) => h.lstat === s).length;
    const qcRows = [["Conto di database", nC], ["Conto bermasalah (QC)", sum(holes, "conto_bermasalah")], ["Conto foto core lengkap", sum(holes, "conto_foto_lengkap")], ["Density menunggu hasil lab", nLab],
      ["Lubang: Form Logging lengkap", lgc("LENGKAP")], ["Lubang: logging dalam tenggat", lgc("DALAM TENGGAT")], ["Lubang: menunggu periksa", lgc("MENUNGGU PERIKSA")], ["Lubang: logging TERLAMBAT", lgc("TERLAMBAT")]];
    // catatan otomatis
    const kpiV = Object.fromEntries(K.map(([a, b, c]) => [a, { v: b, f: c }]));
    const notes = [];
    if (PJ?.target_meter) notes.push(`Realisasi kumulatif ${mCum.toFixed(1)} m dari target ${PJ.target_meter} m (${pct(mCum, PJ.target_meter)}%).`);
    if (PJ?.target_lubang) notes.push(`Lubang selesai ${nSelesai} dari target ${PJ.target_lubang} lubang (${pct(nSelesai, PJ.target_lubang)}%).`);
    for (const [k, x] of Object.entries(kpiV)) if (x.f === "!") notes.push(`Perlu perhatian — ${k}: ${x.v}.`);
    if (!klien && lgc("TERLAMBAT")) notes.push(`${lgc("TERLAMBAT")} lubang Form Logging terlambat: ${HR.filter((h) => h.lstat === "TERLAMBAT").map((h) => h.b).join(", ")}.`);
    const lowOp = opRows.filter((r) => r[3] && (parseInt(r[7]) || 0) < 80); if (!klien && lowOp.length) notes.push(`Operator dengan kepatuhan kirim < 80%: ${lowOp.map((r) => `${r[0]} (${r[7]})`).join(", ")}.`);
    if (sbRows[0]) notes.push(`Penyebab standby/perbaikan terbesar: ${sbRows[0][0]} (${sbRows[0][1]} jam).`);
    if (!klien && nLab) notes.push(`${nLab} conto density menunggu hasil laboratorium (berat kering oven).`);
    if (!notes.length) notes.push("Tidak ada catatan khusus pada periode ini.");
    // tabel
    const RC = await recoveryData(LB, HR, prof);
    const T = {
      ringkasan: [["Indikator", "Nilai"], ["Periode", `${st.from} s/d ${st.to}`], ["Proyek", PJ?.nama ?? "Semua proyek"], ["Rig", st.rig || "Semua rig"], ["Meter bor periode", mPer.toFixed(1) + " m"], ["Meter bor kumulatif", mCum.toFixed(1) + " m"],
        ["Target meter proyek", PJ?.target_meter ? `${PJ.target_meter} m (${pct(mCum, PJ.target_meter)}%)` : "belum diisi admin"], ["Lubang selesai / dikerjakan", `${nSelesai} / ${HR.length}`], ["Target lubang proyek", PJ?.target_lubang ? `${PJ.target_lubang} (${pct(nSelesai, PJ.target_lubang)}%)` : "belum diisi admin"],
        ...K.filter(([a]) => a !== "Total meter bor").map(([a, b]) => [a, b])],
      rig: [["Rig", "Hari aktif", "Meter", "Run", "m/jam", "m/hari aktif", "Standby+perbaikan (jam)", "BBM (L)", "BBM (L/m)", "P2H", "DDR ber-TTD"], ...rigRows].map((r) => (klien ? r.filter((_, i) => i !== 7 && i !== 8) : r)),
      harian: [["Tanggal", "Rig aktif", "Meter", "Kumulatif proyek"], ...dayRows],
      lubang: [["Hole ID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Logging (m)", "Conto", "Status logging", "Limonit (m)", "Saprolit (m)", "Recovery %", "Status lubang"],
        ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", +f2(h.logm) || 0, h.conto, h.lstat, h.tl == null ? "" : +f1(h.tl), h.ts == null ? "" : +f1(h.ts), h.rec == null ? "" : Math.round(h.rec), h.selesai ? "SELESAI" : "BERJALAN"])],
      standby: [["Penyebab", "Jam"], ...sbRows],
      operator: [["Operator", "Peran", "Rig", "Hari wajib", "Lengkap", "Sebagian", "Belum", "% lengkap", "Kekurangan terbanyak"], ...opRows],
      qc: [["Butir", "Jumlah"], ...qcRows],
      catatan: [["Catatan otomatis"], ...notes.map((x) => [x])],
      recovery: [["Jenis", "Nama", "Recovery (%)", "Interval", "Meter ter-logging", "Interval < 90%", "Sumber"], ["Total", "Semua lubang", RC.total == null ? "" : +RC.total.toFixed(1), RC.nInt, +RC.mInt.toFixed(2), RC.low, RC.adaLogging ? "Form Logging" : "laporan harian"],
        ...RC.layer.map((z) => ["Layer", z.nama, z.v == null ? "" : +z.v.toFixed(1), z.n, +z.m.toFixed(2), z.low, "Form Logging"]), ...RC.lubang.map((x) => ["Lubang", x.label, x.nilai == null ? "" : +x.nilai.toFixed(1), "", "", "", x.sumber === "logging" ? "Form Logging" : "laporan harian"])],
      titik: [["Hole ID", "Status", "Rig", "Kedalaman (m)", "Rencana (m)", "Dip (°)", "Azimuth (°)", "IUP"], ...titikRows],
      profil: [["Hole ID", "Dari (m)", "Sampai (m)", "Tebal (m)", "Zona", "Nama zona", "Jumlah conto"], ...(prof ?? []).map((r) => [r.bhid, +r.dari_m, +r.sampai_m, +r.tebal_m, r.zona, r.nama_zona, r.jumlah_conto])],
    };
    const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
    if (klien) T.lubang = T.lubang.map((r) => (clientGeo() ? [r[0], r[1], r[2], r[3], r[4], r[5], r[7], r[9], r[10], r[11], r[12]] : [r[0], r[1], r[2], r[3], r[4], r[5], r[12]]));
    for (const [k, nm] of [["ringkasan", "Ringkasan"], ["catatan", "Catatan"], ["rig", "Per rig"], ["harian", "Harian"], ["lubang", "Status lubang"], ["standby", "Standby"], ["titik", "Titik bor"], ["profil", "Profil bor"], ["recovery", "Recovery"], ...(klien ? [] : [["operator", "Kepatuhan operator"], ["qc", "Data & QC"]])])
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(T[k]), nm);
    const fname = `TGEP_Laporan_Progres_${st.proj || "semua"}_${st.from}_${st.to}.xlsx`;
    window._lapDL = () => X.writeFile(wb, fname);
    const tbl = (a, opt = {}) => `<table>${a.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${esc(String(c))}</th>` : `<td${opt.col && /TERLAMBAT|BELUM\b/.test(String(c)) ? ' style="background:#F6C9C3"' : ""}>${esc(String(c ?? ""))}</td>`)).join("")}</tr>`).join("")}</table>`;
    const mx = Math.max(1, ...dayRows.map((r) => r[2])), bw = dayRows.length ? Math.min(40, Math.max(4, Math.floor(680 / dayRows.length) - 2)) : 10;
    const svg = dayRows.length ? `<svg width="720" height="170" style="border:1px solid #ddd;background:#fff">${dayRows.map((r, i) => { const h = (130 * r[2]) / mx; return `<rect x="${30 + i * (bw + 2)}" y="${145 - h}" width="${bw}" height="${h}" fill="#1E9E69"><title>${r[0]}: ${r[2]} m</title></rect>`; }).join("")}<text x="4" y="14" font-size="10">${mx.toFixed(0)} m</text><text x="30" y="162" font-size="10">${dayRows[0][0]}</text><text x="600" y="162" font-size="10">${dayRows.at(-1)[0]}</text></svg>` : "<p>Tidak ada data bor pada periode ini.</p>";
    if (st.slide) { w.document.open(); w.document.write(await presentasiHTML({ st, PJ, mPer, mCum, nSelesai, HR, K, dayRows, rigRows, sbRows, notes, LB, prof, klien, days, tm: tm ?? [], ringkas: T.ringkasan, qcRows, opRows, holes })); w.document.close(); return; }
    w.document.open(); w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Progres ${esc(PJ?.nama ?? "TGEP")} ${st.from}–${st.to}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:18px;color:#111;max-width:1000px} h1{font-size:18px;margin:0} h2{font-size:13px;margin:14px 0 4px;color:#12251E;border-bottom:2px solid #1E9E69} table{border-collapse:collapse;width:100%;margin:4px 0} td,th{border:1px solid #999;padding:3px 5px;text-align:left} th{background:#e6efe9} ul{margin:4px 0 4px 18px} .bar{display:flex;gap:8px;margin-bottom:10px} .bar a,.bar button{padding:6px 10px;border:1px solid #1E9E69;border-radius:6px;background:#fff;color:#12251E;text-decoration:none;font:inherit;cursor:pointer} @media print{.bar{display:none} h2{break-after:avoid} tr{break-inside:avoid}}</style></head><body>
    <div class="bar"><button onclick="print()">Cetak / simpan PDF</button><button onclick="try{opener._lapDL()}catch(e){alert('Buka ulang laporan dari menu Dashboard untuk mengunduh Excel.')}">Unduh Excel laporan</button></div>
    <h1>LAPORAN PROGRES PEMBORAN & DATA EKSPLORASI</h1><div>PT Terra Grapindo Eco Prima · ${esc(PJ?.nama ?? "Semua proyek")} · periode <b>${st.from} s/d ${st.to}</b>${st.rig ? " · rig " + esc(st.rig) : ""}</div>
    <h2>1. Ringkasan</h2>${tbl(T.ringkasan)}
    <h2>Peta pemboran & grafik per lubang</h2>${petaGrafik}
    <h3 style="font-size:12px;margin:8px 0 2px">Titik bor (rencana, progres, EOH/STB)</h3>${tbl(T.titik)}
    <h2>2. Catatan & hal yang perlu ditindaklanjuti</h2><ul>${notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <h2>3. Progres per rig</h2>${tbl(T.rig)}
    <h2>4. Meter bor harian</h2>${svg}${tbl(T.harian)}
    <h2>5. Status lubang</h2>${klien ? tbl(clientGeo() ? [["Hole ID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Conto", "Limonit (m)", "Saprolit (m)", "Recovery %", "Status lubang"], ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", h.conto, h.tl == null ? "" : +f1(h.tl), h.ts == null ? "" : +f1(h.ts), h.rec == null ? "" : Math.round(h.rec), h.selesai ? "SELESAI" : "BERJALAN"])] : [["Hole ID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Status lubang"], ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", h.selesai ? "SELESAI" : "BERJALAN"])]) : tbl(T.lubang, { col: 1 })}<p style="color:#555">SELESAI = tanggal selesai terisi atau kedalaman ≥ target/total depth di DDR. Kedalaman dari foto RUN aplikasi${klien ? "" : "; tebal zona dan recovery dari Form Logging yang sudah disetujui"}.</p>
    ${(() => { const T2 = statistikData({ dayRows, HR, LB, prof, st, PJ, mCum }), f = T2.f; return `<h2>Statistik pemboran & geologi</h2><table><tr><th>Indikator</th><th>Nilai</th><th>Indikator</th><th>Nilai</th></tr>
      <tr><td>Rata-rata meter / hari aktif</td><td>${f(T2.sH.mean)} m (median ${f(T2.sH.med)}, SD ${f(T2.sH.sd)})</td><td>Overburden (TP + sedimen)</td><td>${f(T2.sOB.mean)} m (${f(T2.sOB.min)}–${f(T2.sOB.max)})</td></tr>
      <tr><td>Hari aktif / kalender</td><td>${T2.aktif.length}/${T2.kal}</td><td>Tebal limonit rata-rata</td><td>${f(T2.sL.mean)} m (median ${f(T2.sL.med)})</td></tr>
      <tr><td>Kedalaman akhir rata-rata</td><td>${f(T2.sEOH.mean)} m (${f(T2.sEOH.min)}–${f(T2.sEOH.max)})</td><td>Tebal saprolit rata-rata</td><td>${f(T2.sS.mean)} m (median ${f(T2.sS.med)})</td></tr>
      <tr><td>Recovery core rata-rata</td><td>${f(T2.sRec.mean, 0)}% (${T2.recOk}/${T2.sRec.n} lubang ≥ 90%)</td><td>Kedalaman ke bluezone/bedrock</td><td>${f(T2.sBR.mean)} m</td></tr>
      <tr><td>Sisa meter ke target</td><td>${f(T2.sisa, 0)} m dari ${f(T2.tgtM, 0)} m</td><td>Perkiraan selesai (laju sekarang)</td><td>${T2.eta ?? "–"}</td></tr></table>
      ${T2.zona.length ? boxSVG(T2.zona.map((z) => ({ label: z.nama, warna: z.warna, s: z.s })), { unit: "tebal (m)", w: 760 }) : ""}${T2.bh.length && T2.bh.length < 5 ? `<p><i>Baru ${T2.bh.length} lubang berdata logging — statistik belum representatif.</i></p>` : ""}`; })()}
    <h2>Tampilan 3D pemboran</h2>${gbr3D}
    ${await (async () => { const A = await analisisData(LB, prof, days), f = (x, d = 1) => (x == null || !Number.isFinite(+x) ? "–" : (+x).toFixed(d));
      return `<h2>Statistik per rig</h2>${A.rigs.length ? rigHarianSVG(days, A.rigs) + `<table><tr><th>Rig</th><th>Hari aktif</th><th>Total meter</th><th>Rata-rata m/hari</th><th>Maks/hari</th><th>Lubang (selesai)</th><th>Jumlah kedalaman</th><th>Overburden</th><th>Limonit</th><th>Saprolit</th></tr>${A.perRig.map((x) => `<tr><td>${esc(x.r)}</td><td>${x.hari}</td><td>${f(x.meter)}</td><td>${f(x.sm.mean)}</td><td>${f(x.sm.max)}</td><td>${x.lubang} (${x.selesai})</td><td>${f(x.totDalam)} m</td><td>${x.OB.n ? f(x.OB.mean) + " m" : "–"}</td><td>${x.L.n ? f(x.L.mean) + " m" : "–"}</td><td>${x.S.n ? f(x.S.mean) + " m" : "–"}</td></tr>`).join("")}</table>` : "<p>Belum ada data rig.</p>"}
      ${A.zona.length ? `<h2>Sebaran layer</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${A.zona.map((z) => histKecil(z.tebal, z.warna, z.nama)).join("")}</div>${kedalamanLayerSVG(A.zona)}` : ""}
      <h2>Hubungan kedalaman, ketebalan & lereng</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${pencarSVG(A.hub.eohL, { judul: "Kedalaman akhir vs tebal limonit", sx: "kedalaman akhir (m)", sy: "tebal limonit (m)" })}${pencarSVG(A.hub.eohS, { judul: "Kedalaman akhir vs tebal saprolit", sx: "kedalaman akhir (m)", sy: "tebal saprolit (m)" })}${pencarSVG(A.hub.lerEoh, { judul: "Lereng vs kedalaman", sx: "lereng (°)", sy: "kedalaman (m)" })}${pencarSVG(A.hub.lerL, { judul: "Lereng vs tebal limonit", sx: "lereng (°)", sy: "tebal limonit (m)" })}</div>
      <p><small>r = korelasi Pearson; dengan jumlah lubang kecil nilainya belum stabil. Lereng dari DEMNAS di posisi collar.</small></p>`; })()}
    <h2>Recovery core per lubang & per layer</h2>${RC.nLubang || RC.layer.length ? `<p>Recovery rata-rata <b>${RC.total != null ? RC.total.toFixed(1) + " %" : "–"}</b> (${RC.adaLogging ? `tertimbang panjang, ${RC.nInt} interval / ${RC.mInt.toFixed(1)} m; ${RC.low} interval &lt; 90 %` : "dari laporan harian"}); ${RC.okLubang} dari ${RC.nLubang} lubang ≥ 90 %.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><b>Per lubang</b>${barH(RC.lubang, { lw: 92, rh: 20, max: 100 })}</div><div><b>Per layer</b>${RC.layer.length ? barH(RC.layer, { lw: 110, rh: 22, max: 100 }) : "<p>Muncul setelah Form Logging disetujui.</p>"}${RC.titik.length >= 2 ? pencarSVG(RC.titik, { judul: "Recovery vs kedalaman", sx: "kedalaman tengah interval (m)", sy: "recovery (%)" }) : ""}</div></div>` : "<p>Belum ada data recovery.</p>"}
    <h2>Profil bor (ketebalan zona)</h2>${(prof ?? []).length ? profilSVG(prof) : "<p>Belum ada data logging yang masuk database untuk lubang-lubang ini.</p>"}
    ${await (async () => { const A = await analisisData(LB, prof, days), T2 = statistikData({ dayRows, HR, LB, prof, st, PJ, mCum });
      const KS = kesimpulanProspek({ A, T: T2, prof: prof ?? [], LB });
      return `<h2>Kesimpulan: prospek atau tidak?</h2><div style="border:3px solid ${KS.warna};border-radius:10px;padding:8px 12px;margin:6px 0"><b style="font-size:16px;color:${KS.warna}">${esc(KS.vonis)}</b><br>${esc(KS.alasan)}</div>
        <table><tr><th>Kriteria</th><th>Nilai</th><th>Ambang (✓ / !)</th><th>Status</th></tr>${KS.baris.map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td><td>${esc(r.amb)}</td><td>${{ ok: "✓ memenuhi", warn: "! sedang", bad: "✗ tidak", na: "? belum ada data" }[r.s]}</td></tr>`).join("")}</table>
        <p><b>Rekomendasi:</b></p><ul>${KS.rekom.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p><small>Penilaian dari data geologi lapangan; kadar Ni tidak dianalisis. Ambang dapat disesuaikan dan perlu ditinjau geologis yang berkompeten.</small></p>`; })()}
    <h2>6. Penyebab standby & perbaikan</h2>${sbRows.length ? tbl(T.standby) : "<p>Tidak ada standby/perbaikan tercatat.</p>"}
    ${klien ? "" : `<h2>7. Kepatuhan pengiriman operator</h2>${opRows.length ? tbl(T.operator, { col: 1 }) : "<p>Belum ada data operator.</p>"}
    <h2>8. Kelengkapan data & QC</h2>${tbl(T.qc)}`}
    <table style="margin-top:24px"><tr><td style="height:70px;width:50%;vertical-align:top"><b>Disusun oleh</b><br><br><br>Nama / tanggal:</td><td style="vertical-align:top"><b>Diperiksa oleh</b><br><br><br>Nama / tanggal:</td></tr></table>
    <small>Dibuat otomatis dari database aplikasi X-Terra · ${new Date().toLocaleString("id-ID")} · oleh ${esc(me?.full_name ?? "")}. Angka mengikuti data yang sudah masuk server saat laporan dibuat.</small></body></html>`);
    w.document.close();
  } catch (e) { w.document.body.innerHTML = `<p style="font-family:Arial;color:#b00">Gagal menyusun laporan: ${esc(e.message)}</p>`; }
}
// ---------- Akun client: laporan per rig (baca saja) ----------
async function aksesKlien(box) {
  const [{ data: us }, { data: pn }, { data: pj }] = await Promise.all([sb.from("app_user").select("user_id,full_name,company,email").eq("role", "client").order("full_name"), sb.from("penugasan").select("*"), sb.from("project").select("code,nama,rigs,aktif").order("nama")]);
  const P = Object.fromEntries((pn ?? []).map((p) => [p.user_id, p]));
  box.innerHTML = `<h3>Akses akun client</h3><p class="muted">Client bisa melihat dan mengunduh Dashboard, Laporan rig dan Database data rig (DDR, progres, P2H, aktivitas) serta Dokumen yang dibuka untuk peran client. Centang “boleh lihat & unduh data geologi” agar client juga mendapat collar, survey, geologi, density, assay dan QAQC <b>yang sudah disetujui</b> untuk lubang proyeknya. Foto core dan scan formulir hanya terbuka setelah Anda merilisnya (kotak di bawah); data operator tidak pernah dibuka untuk client. Pilih proyek: client melihat semua rig proyek itu; centang rig bila hanya rig tertentu.</p>
    <ul class="list">${(us ?? []).map((u) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>${esc(u.full_name ?? "")}</b><br><span class="muted">${esc(u.company ?? "")} · ${esc(u.email ?? "")}</span></span>
      ${proyekSel(u.user_id, pj, P[u.user_id]?.project ?? "", "— belum ada akses —")}
      <span data-rcw="${u.user_id}" style="display:flex;gap:10px;flex:0;align-items:center">${rigCek(u.user_id, P[u.user_id]?.project, pj, P[u.user_id]?.rigs)}</span>
      <label style="flex:0;white-space:nowrap;margin:0"><input type="checkbox" data-kg="${u.user_id}" ${P[u.user_id]?.akses_geologi ? "checked" : ""} style="width:auto"> boleh lihat & unduh data geologi</label>
      <button class="sec" data-ks="${u.user_id}" style="flex:0">Simpan</button></li>`).join("") || `<li class="muted">Belum ada akun client. Setujui pendaftar dengan peran <b>client</b> di atas.</li>`}</ul>`;
  pasangRigCek(box, pj);
  box.querySelectorAll("[data-ks]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.ks, project = box.querySelector(`[data-pp="${id}"]`).value || null;
    const { error } = await sb.rpc("admin_set_penugasan", { p_user: id, p_project: project, p_rigs: ambilRig(box, id), p_akses_geologi: box.querySelector(`[data-kg="${id}"]`).checked, p_wajib_harian: false, p_catatan: P[id]?.catatan ?? null });
    if (error) return alert(error.message); b.textContent = "Tersimpan ✓";
  }));
}
async function klienView(v) {
  const to = todayWIB(), from = new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const st = JSON.parse(sessionStorage.getItem("klien") || "null") ?? { from, to, rig: "" };
  v.innerHTML = `<div class="card"><h2>Laporan rig</h2><p class="muted">Rekap operasional rig yang dibuka untuk akun Anda. Data masuk dari aplikasi lapangan (foto bergeotag, P2H, DDR bertanda tangan).</p>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end"><div><label>Dari</label><input id="f" type="date" value="${st.from}"></div><div><label>Sampai</label><input id="t" type="date" value="${st.to}"></div>
    <div><label>Rig</label><input id="r" value="${esc(st.rig)}" placeholder="semua"></div><button id="go" style="flex:0">Tampilkan</button><button class="sec" id="xl" style="flex:0;white-space:nowrap">Unduh Excel rekap</button>
    <button class="sec" id="lp" style="flex:0;white-space:nowrap">Laporan progres</button></div><div id="info" class="muted"></div></div>
    <div class="card" id="kr">Memuat…</div><div class="card" id="kd"></div>`;
  const rd = () => ({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase() });
  $("#go").onclick = () => { sessionStorage.setItem("klien", JSON.stringify(rd())); klienView(v); };
  $("#lp").onclick = () => laporanProgres({ ...rd(), proj: "" });
  if (!online()) return ($("#kr").textContent = "Laporan perlu sinyal internet.");
  const F = (q, col) => { q = q.gte(col, st.from).lte(col, st.to); return st.rig ? q.eq("rig", st.rig) : q; };
  const [{ data: days, error }, { data: dl }] = await Promise.all([F(sb.from("v_dash_rig_day").select("*"), "tanggal").order("tanggal", { ascending: false }).order("rig"), F(sb.from("v_ddr_list").select("*"), "report_date").order("report_date", { ascending: false }).limit(500)]);
  if (error) return ($("#kr").innerHTML = `<p class="err">${esc(error.message)}</p>`);
  if (!(days ?? []).length && !(dl ?? []).length) { $("#kr").innerHTML = `<p>Belum ada data untuk periode ini. Bila tetap kosong, minta admin TGEP memastikan akses proyek/rig akun Anda sudah diatur.</p>`; return; }
  const f1 = (x) => (x == null ? "" : Number(x).toFixed(1)), n = (x) => Number(x) || 0;
  const rigs = [...new Set((days ?? []).map((d) => d.rig))].sort();
  $("#kr").innerHTML = `<h3>Ringkasan per rig</h3><div class="tw"><table><tr><th>Rig</th><th>Hari aktif</th><th>Meter</th><th>m/jam</th><th>Standby (jam)</th><th>P2H ada</th><th>DDR ber-TTD</th></tr>
    ${rigs.map((r) => { const xs = days.filter((d) => d.rig === r), a = xs.filter((d) => n(d.meter_bor) > 0), m = xs.reduce((s, d) => s + n(d.meter_bor), 0), j = xs.reduce((s, d) => s + n(d.jam_kerja_bor), 0), b = xs.reduce((s, d) => s + n(d.bbm_liter), 0);
      return `<tr><td><b>${esc(r)}</b></td><td>${a.length}</td><td>${f1(m)}</td><td>${j ? (m / j).toFixed(2) : "-"}</td><td>${f1(xs.reduce((s, d) => s + n(d.standby_menit), 0) / 60)}</td><td>${a.filter((d) => d.ada_p2h).length}/${a.length}</td><td>${a.filter((d) => d.n_ddr_ttd > 0).length}/${a.length}</td></tr>`; }).join("")}</table></div>
    <h3>Rekap harian</h3><div class="tw"><table><tr><th>Tanggal</th><th>Rig</th><th>Meter</th><th>Run</th><th>Recovery %</th><th>Jam bor</th><th>Standby (mnt)</th><th>m/jam</th><th>P2H</th><th>DDR (TTD)</th><th>Kejadian</th></tr>
    ${(days ?? []).map((d) => `<tr><td>${d.tanggal}</td><td>${esc(d.rig)}</td><td>${f1(d.meter_bor)}</td><td>${d.jumlah_run ?? ""}</td><td>${d.recovery_pct ?? ""}</td><td>${f1(d.jam_kerja_bor)}</td><td>${d.standby_menit ?? ""}</td><td>${d.meter_per_jam ?? ""}</td>
      <td style="${!d.ada_p2h || d.p2h_bermasalah ? "background:#F6C9C3" : ""}">${d.ada_p2h ? (d.p2h_bermasalah ? "ada masalah" : "OK") : "tidak ada"}</td><td>${d.n_ddr ?? 0} (${d.n_ddr_ttd ?? 0})</td><td>${esc(String(d.kejadian_bermasalah ?? ""))}</td></tr>`).join("")}</table></div>`;
  $("#kd").innerHTML = `<h3>DDR (${(dl ?? []).length})</h3><ul class="list">${(dl ?? []).map((d) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(d.report_date)} · ${d.shift === "PAGI" ? "Day" : "Night"} · ${esc(d.rig)}</b> ${esc(d.bhid ?? "")}<br><span class="muted">${d.status === "SIGNED" ? "lengkap ditandatangani" : "draf"} · ${f1(d.coring_ddr_m)} m coring · ${esc(d.ttd ?? "belum ada TTD")}</span></span>
    <button class="sec" data-pr="${d.id}" style="flex:0">Lihat / cetak</button></li>`).join("") || `<li class="muted">Belum ada DDR.</li>`}</ul>`;
  $("#kd").querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.pr)));
  $("#xl").onclick = async () => {
    $("#info").textContent = "Menyiapkan Excel…";
    try {
      const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
      const flat = (rows) => (rows ?? []).map((r) => { const o = { ...r }; delete o.data; delete o.related; for (const c in o) if (o[c] && typeof o[c] === "object") o[c] = Array.isArray(o[c]) && o[c].every((x) => typeof x !== "object") ? o[c].join("; ") : JSON.stringify(o[c]); return o; });
      const src = [["Kinerja rig harian", "v_dash_rig_day", "tanggal"], ["Progres harian bor", "v_drill_progress_daily", "tanggal"], ["DDR", "v_ddr_list", "report_date"], ["Distribusi jam DDR", "v_ddr_hours", "tanggal"], ["Aktivitas bor", "v_drill_event_qc", "captured_at"], ["P2H", "p2h_check", "captured_at"]];
      for (const [nm, vw, col] of src) {
        const out = []; for (let i = 0; ; i += 1000) { let q = sb.from(vw).select("*"); q = col === "captured_at" ? q.gte(col, `${st.from}T00:00:00+07:00`).lte(col, `${st.to}T23:59:59+07:00`) : q.gte(col, st.from).lte(col, st.to); if (st.rig) q = q.eq("rig", st.rig);
          const { data, error: e } = await q.order(col).range(i, i + 999); if (e) throw e; out.push(...data); if (data.length < 1000) break; }
        X.utils.book_append_sheet(wb, out.length ? X.utils.json_to_sheet(flat(tanpaBBM(out))) : X.utils.aoa_to_sheet([["(kosong)"]]), nm);
      }
      X.writeFile(wb, `TGEP_Rekap_Rig_${st.rig || "semua"}_${st.from}_${st.to}.xlsx`); $("#info").textContent = "Excel diunduh (6 sheet).";
    } catch (e) { $("#info").textContent = e.message; }
  };
}

// ---------- Rilis foto core / scan ke client (admin) ----------
const RILIS = { FOTO_CORE: "Foto core", SCAN_LOGGING: "Scan Form Logging (disetujui)", FORM_ARSIP: "Foto formulir arsip" };
async function rilisAdmin(box) {
  box.innerHTML = `<h3>Rilis foto & scan ke client</h3><p class="muted">Memuat…</p>`;
  const [{ data: cp }, { data: sj }, { data: fp }, { data: rl }] = await Promise.all([
    sb.from("core_photo").select("bhid,ditolak,reviewer_override").limit(20000), sb.from("scan_job").select("bhid_hint,status").eq("status", "APPROVED").limit(20000),
    sb.from("form_photo").select("bhid").not("bhid", "is", null).limit(20000), sb.from("client_release").select("*")]);
  const cnt = {}; const add = (b, j) => { if (!b) return; (cnt[b] ??= { FOTO_CORE: 0, SCAN_LOGGING: 0, FORM_ARSIP: 0 })[j]++; };
  (cp ?? []).filter((c) => !coreDitolak(c)).forEach((c) => add(c.bhid, "FOTO_CORE")); (sj ?? []).forEach((s) => add(s.bhid_hint, "SCAN_LOGGING")); (fp ?? []).forEach((f) => add(f.bhid, "FORM_ARSIP"));
  const R = new Set((rl ?? []).map((r) => `${r.bhid}|${r.jenis}`)), bh = Object.keys(cnt).sort();
  box.innerHTML = `<h3>Rilis foto & scan ke client</h3><p class="muted">Foto core, scan Form Logging dan foto formulir <b>tidak terlihat</b> oleh client sampai Anda merilisnya per lubang. Setelah dicentang, client yang proyeknya mencakup lubang itu langsung bisa melihat & mengunduh di menu “Foto & scan”. Hilangkan centang untuk menarik kembali. Foto core yang ditolak dan scan yang belum disetujui tidak pernah ikut terkirim.</p>
    <div class="row" style="flex-wrap:wrap"><input id="rf" placeholder="cari Hole ID" style="max-width:180px"></div>
    <div class="tw"><table id="rt"><tr><th>Hole ID</th>${Object.values(RILIS).map((t) => `<th>${t}</th>`).join("")}</tr>
    ${bh.map((b) => `<tr data-b="${esc(b)}"><td><b>${esc(b)}</b></td>${Object.keys(RILIS).map((j) => `<td>${cnt[b][j] ? `<label style="white-space:nowrap"><input type="checkbox" data-rb="${esc(b)}" data-rj="${j}" ${R.has(`${b}|${j}`) ? "checked" : ""} style="width:auto"> rilis (${cnt[b][j]})</label>` : '<span class="muted">-</span>'}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="4" class="muted">Belum ada foto core / scan.</td></tr>`}</table></div>`;
  box.querySelector("#rf").oninput = (e) => box.querySelectorAll("#rt tr[data-b]").forEach((tr) => (tr.style.display = tr.dataset.b.toUpperCase().includes(e.target.value.toUpperCase()) ? "" : "none"));
  box.querySelectorAll("[data-rb]").forEach((c) => (c.onchange = async () => {
    const q = c.checked ? sb.from("client_release").upsert({ bhid: c.dataset.rb, jenis: c.dataset.rj, released_at: new Date().toISOString() }, { onConflict: "bhid,jenis" })
      : sb.from("client_release").delete().eq("bhid", c.dataset.rb).eq("jenis", c.dataset.rj);
    const { error } = await q; if (error) { alert(error.message); c.checked = !c.checked; }
  }));
}
// ---------- Foto & scan (client) ----------
async function fotoKlienView(v) {
  v.innerHTML = `<div class="card"><h2>Foto & scan</h2><p class="muted">Foto core dan scan formulir yang sudah dirilis admin TGEP untuk lubang proyek Anda.</p><div id="fk">Memuat…</div></div><div id="fd"></div>`;
  if (!online()) return ($("#fk").textContent = "Perlu sinyal internet.");
  const { data, error } = await sb.from("client_release").select("*").order("bhid");
  if (error) return ($("#fk").innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const by = {}; for (const r of data ?? []) (by[r.bhid] ??= []).push(r);
  $("#fk").innerHTML = Object.keys(by).length ? `<ul class="list">${Object.entries(by).map(([b, rs]) => `<li style="flex-wrap:wrap"><span style="flex:1"><b>${esc(b)}</b><br><span class="muted">${rs.map((r) => RILIS[r.jenis]).join(" · ")} · dirilis ${fmtT(rs.map((r) => r.released_at).sort().at(-1)).slice(0, 10)}</span></span><button class="sec" data-fb="${esc(b)}" style="flex:0">Buka</button></li>`).join("")}</ul>` : `<p>Belum ada foto/scan yang dirilis untuk Anda.</p>`;
  $("#fk").querySelectorAll("[data-fb]").forEach((b) => (b.onclick = () => fotoKlienBH(b.dataset.fb, by[b.dataset.fb].map((r) => r.jenis))));
}
async function fotoKlienBH(bhid, jenis) {
  const box = $("#fd"); box.innerHTML = `<div class="card">Memuat ${esc(bhid)}…</div>`;
  const sign = async (bucket, paths) => { const ps = paths.filter(Boolean); if (!ps.length) return {}; const { data } = await sb.storage.from(bucket).createSignedUrls(ps, 3600); return Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl])); };
  let html = "";
  if (jenis.includes("FOTO_CORE")) {
    const { data: cp } = await sb.from("core_photo").select("box_no,depth_from,depth_to,photo_type,photo_path,preview_path,captured_at").eq("bhid", bhid).order("photo_type").order("box_no");
    const U = await sign("core-photos", (cp ?? []).flatMap((c) => [c.preview_path, c.photo_path]));
    html += `<div class="card"><h3>Foto core ${esc(bhid)} (${(cp ?? []).length})</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">${(cp ?? []).map((c) => `<div><a href="${U[c.photo_path] ?? U[c.preview_path] ?? "#"}" target="_blank" download><img src="${U[c.preview_path] ?? U[c.photo_path] ?? ""}" style="width:100%;border-radius:6px;border:1px solid #ccc"></a><small>${c.photo_type === "UTUH" ? "Core utuh" : c.photo_type === "BELAH" ? "Core belah" : esc(c.photo_type ?? "")} · kotak ${c.box_no ?? "-"} · ${c.depth_from ?? ""}–${c.depth_to ?? ""} m</small></div>`).join("")}</div><p class="muted">Ketuk foto untuk membuka ukuran asli lalu simpan.</p></div>`;
  }
  if (jenis.includes("SCAN_LOGGING")) {
    const { data: sj } = await sb.from("scan_job").select("page_no,photo_path,captured_at,reviewed_at").eq("bhid_hint", bhid).eq("status", "APPROVED").order("page_no");
    const U = await sign("scan-photos", (sj ?? []).map((s) => s.photo_path));
    html += `<div class="card"><h3>Scan Form Logging ${esc(bhid)} (${(sj ?? []).length})</h3><ul class="list">${(sj ?? []).map((s) => `<li><span style="flex:1">Halaman ${s.page_no ?? "-"} · difoto ${fmtT(s.captured_at).slice(0, 16)} · disetujui ${s.reviewed_at ? fmtT(s.reviewed_at).slice(0, 10) : "-"}</span><a class="sec" href="${U[s.photo_path] ?? "#"}" target="_blank" download style="flex:0">Buka / unduh</a></li>`).join("")}</ul></div>`;
  }
  if (jenis.includes("FORM_ARSIP")) {
    const { data: fp } = await sb.from("form_photo").select("jenis,tanggal,shift,halaman,jumlah_halaman,photo_path,keterangan").eq("bhid", bhid).order("tanggal");
    const U = await sign("scan-photos", (fp ?? []).map((f) => f.photo_path));
    html += `<div class="card"><h3>Foto formulir arsip ${esc(bhid)} (${(fp ?? []).length})</h3><ul class="list">${(fp ?? []).map((f) => `<li><span style="flex:1">${esc(ARSIP[f.jenis] ?? f.jenis)} · ${esc(f.tanggal ?? "")} ${esc(f.shift ?? "")} · hal ${f.halaman ?? 1}/${f.jumlah_halaman ?? 1}${f.keterangan ? " · " + esc(f.keterangan) : ""}</span><a class="sec" href="${U[f.photo_path] ?? "#"}" target="_blank" download style="flex:0">Buka / unduh</a></li>`).join("")}</ul></div>`;
  }
  box.innerHTML = html || `<div class="card">Tidak ada file.</div>`;
  box.scrollIntoView({ behavior: "smooth" });
}

// ---------- Proyek & rig, lanjutan isian, pemberitahuan penolakan ----------
let myTugas = JSON.parse(localStorage.getItem("myTugas") || "null");
// ---------- Pilih Hole ID dari titik rencana bor (agar ID di lapangan = ID di peta) ----------
const kunciBH = (x) => String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const rencanaLokal = () => JSON.parse(localStorage.getItem("rencanaLubang") || "[]");
async function muatRencana() {
  if (online()) { const { data } = await sb.from("rencana_lubang").select("bhid,lon,lat,rig,rencana_kedalaman,dip,azimuth").order("bhid"); if (data) localStorage.setItem("rencanaLubang", JSON.stringify(data)); }
  const dl = document.getElementById("dlBH") ?? document.body.appendChild(Object.assign(document.createElement("datalist"), { id: "dlBH" }));
  isiDlBH();
  return rencanaLokal();
}
// v.24: daftar Hole ID yang SUDAH TERDAFTAR di aplikasi (rencana, lubang, DDR termasuk redrill mis. DH-NPG 08R, progres bor, foto core,
// Form Logging, marking) → pilihan di SEMUA kolom Hole ID (datalist dlBH). Disimpan di HP agar tetap ada saat offline.
const daftarBHLokal = () => { try { return JSON.parse(localStorage.getItem("daftarBH") || "[]"); } catch { return []; } };
const urutBH = (a, b) => String(a).localeCompare(String(b), "id", { numeric: true });
function isiDlBH() {
  const dl = document.getElementById("dlBH") ?? document.body.appendChild(Object.assign(document.createElement("datalist"), { id: "dlBH" }));
  const M = new Map(); for (const r of rencanaLokal()) if (r.bhid) M.set(r.bhid, new Set(["rencana"]));
  for (const [b, src] of daftarBHLokal()) { if (!b) continue; if (!M.has(b)) M.set(b, new Set()); for (const x of src) M.get(b).add(x); }
  dl.innerHTML = [...M.keys()].sort(urutBH).map((b) => `<option value="${esc(b)}" label="${esc([asalRedrill(b) ? "REDRILL" : null, ...M.get(b)].filter(Boolean).join(" · "))}">`).join("");
}
async function muatDaftarBH() {
  if (!online() || isClient()) return isiDlBH();
  const Q = [["borehole", "bhid", "lubang"], ["v_ddr_baris", "bhid", "DDR"], ["ddr", "bhid", "DDR"], ["drill_event", "bhid", "progres bor"], ["core_photo", "bhid", "foto core"], ["scan_job", "bhid_hint", "Form Logging"], ["marking", "bhid", "marking"]];
  const res = await Promise.all(Q.map(([t, c]) => sb.from(t).select(c).not(c, "is", null).limit(5000).then((r) => r.data ?? [], () => [])));
  const M = new Map(); res.forEach((rows, i) => { for (const r of rows) { const b = String(r[Q[i][1]] ?? "").trim().toUpperCase(); if (!b) continue; if (!M.has(b)) M.set(b, new Set()); M.get(b).add(Q[i][2]); } });
  try { localStorage.setItem("daftarBH", JSON.stringify([...M].map(([b, x]) => [b, [...x]]))); } catch {}
  isiDlBH();
}
// Semua kolom Hole ID (termasuk filter Hole ID di Database & Data tersimpan, form edit) memakai daftar pilihan dlBH
const ID_BH = new Set(["fb", "sdB", "kB", "kfB", "eb_bhid", "eb_lubang_asal"]);
function pasangDaftarBH(root) {
  root.querySelectorAll?.("input:not([list]):not([readonly])").forEach((inp) => {
    if (inp.type && !["text", "search", ""].includes(inp.type)) return;
    const lbl = inp.closest("label")?.textContent ?? (inp.previousElementSibling?.tagName === "LABEL" ? inp.previousElementSibling.textContent : "") ?? "";
    if (ID_BH.has(inp.id) || inp.hasAttribute("data-bhid") || inp.hasAttribute("data-rbh") || /hole\s*id|\bbhid\b/i.test(lbl) || /hole\s*id/i.test(inp.placeholder ?? "")) { inp.setAttribute("list", "dlBH"); inp.setAttribute("autocomplete", "off"); }
  });
}
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) pasangDaftarBH(n); }).observe(document.body, { childList: true, subtree: true });
// "DHNPG01", "dh-npg01", "DH NPG 1"? -> ejaan resmi rencana bila hurufnya sama
const bakuBH = (x) => { const t = String(x ?? "").trim().toUpperCase(); if (!t) return ""; const L = rencanaLokal(), r = L.find((z) => kunciBH(z.bhid) === kunciBH(t)); if (r) return r.bhid;
  const k = kunciBH(t), mr = /^(.*\d)(R\d*)$/.exec(k); if (mr) { const d = L.find((z) => kunciBH(z.bhid) === mr[1]); if (d) return d.bhid + mr[2]; } // redrill: Hole ID dasar + R / R2
  return t; };
// Redrill = Hole ID dasar + sufiks R (mis. DH-NPG 08R): meter, FROM otomatis, conto dan peta terpisah dari lubang utama
const TUJUAN_BOR = ["REGULAR DRILLING", "VERIFICATION DRILLING", "TWIN DRILLING", "REDRILL", "GEOSTATISTICS DRILLING", "SCOUT DRILLING"];
// Redrill: Hole ID berakhiran R (mis. DH-NPG 12R, DH-NPG 12R2) → lubang asal = tanpa akhiran R
const asalRedrill = (bh) => { const m = String(bh ?? "").trim().toUpperCase().match(/^(.*\d)\s*R\d*$/); return m ? m[1] : null; };
const jenisDariBH = (b) => (asalRedrill(b) ? "REDRILL" : "UTAMA");
const bhJenis = (b, jenis) => { const x = bakuBH(b); if (!x) return x; if (jenis === "REDRILL") return /R$/.test(kunciBH(x)) ? x : bakuBH(x + "R"); return asalRedrill(x) ? bakuBH(asalRedrill(x)) : x; };
const pilihJenisBor = (id, b) => `<select id="${id}" title="UTAMA = lubang rencana; REDRILL = bor ulang di titik yang sama, Hole ID otomatis bersufiks R"><option value="UTAMA">UTAMA</option><option value="REDRILL" ${jenisDariBH(b) === "REDRILL" ? "selected" : ""}>REDRILL</option></select>`;
const jarakM = (a, b) => { const R = 6371000, r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
function pasangPilihBH(inp) {
  if (inp.dataset.bhOk) return; inp.dataset.bhOk = "1"; inp.setAttribute("list", "dlBH");
  if (!document.getElementById("dlBH")) isiDlBH();
  const st = document.createElement("div"); st.style.cssText = "font-size:12px;margin-top:3px";
  const btn = Object.assign(document.createElement("button"), { type: "button", className: "sec", textContent: "📍 Pilih titik rencana" }); btn.style.cssText = "width:auto;padding:4px 10px;margin-top:4px;font-size:13px";
  inp.after(st, btn);
  // v.26: pilihan UTAMA / REDRILL di setiap kolom Hole ID — REDRILL menambah akhiran R otomatis (DH-NPG 14 → DH-NPG 14R), UTAMA menghapusnya.
  // Form yang sudah punya pilihan Jenis pemboran (Progres bor #jb, DDR #jbd) memakai pilihan itu.
  let js = inp.closest(".row")?.querySelector("#jb, #jbd") ?? null;
  if (!js && !inp.hasAttribute("data-nojenis")) {
    js = document.createElement("select"); js.title = "UTAMA = titik rencana; REDRILL = bor ulang di titik yang sama (Hole ID otomatis + R)"; js.style.cssText = "width:auto;margin-top:4px;margin-right:6px";
    js.innerHTML = `<option value="UTAMA">UTAMA</option><option value="REDRILL">REDRILL (+R)</option>`; st.before(js); }
  if (js) { js.value = jenisDariBH(inp.value);
    js.addEventListener("change", () => { const v = inp.value.trim(); if (!v) return; const b = bhJenis(v, js.value); if (b && b !== v) { inp.value = b; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); } });
    inp.addEventListener("input", () => { if (inp.value.trim()) js.value = jenisDariBH(inp.value); }); }
  const cek = () => { const t = inp.value.trim(); if (!t) return (st.textContent = ""); const R = rencanaLokal(), r = R.find((z) => kunciBH(z.bhid) === kunciBH(t));
    if (r) { st.innerHTML = `<span style="color:#1b7a3a">✓ Terhubung ke titik rencana <b>${esc(r.bhid)}</b> di peta</span>${r.bhid !== t.toUpperCase() ? ` <span class="muted">(ejaan disamakan saat disimpan)</span>` : ""}`; }
    else if (asalRedrill(t) && R.find((z) => kunciBH(z.bhid) === kunciBH(asalRedrill(t)))) st.innerHTML = `<span style="color:#1b7a3a">✓ <b>REDRILL</b> dari titik rencana <b>${esc(R.find((z) => kunciBH(z.bhid) === kunciBH(asalRedrill(t))).bhid)}</b> (titik sama, Hole ID + R)</span>`;
    else if (daftarBHLokal().some(([b]) => kunciBH(b) === kunciBH(t))) st.innerHTML = `<span style="color:#1b7a3a">✓ Hole ID sudah terdaftar${asalRedrill(t) ? " (REDRILL)" : ""}</span>`;
    else st.innerHTML = R.length ? `<span style="color:#a15c00">⚠ Tidak ada di daftar rencana — akan menjadi titik bor BARU di peta. Pastikan bukan salah ketik.</span>` : ""; };
  inp.addEventListener("input", cek); cek();
  btn.onclick = async () => {
    const R = rencanaLokal(); if (!R.length) return alert("Belum ada titik rencana bor (atau belum tersimpan di HP — buka aplikasi sekali saat ada sinyal).");
    const m = modal(`<h3>Pilih titik rencana bor</h3><p class="muted" id="plg">Mencari posisi GPS untuk mengurutkan dari yang terdekat…</p><ul class="list" id="pll"></ul><button class="sec" id="plx">Tutup</button>`);
    m.querySelector("#plx").onclick = () => m.remove();
    const isi = (pos) => { const rows = R.map((r) => ({ ...r, d: pos ? jarakM(pos, [r.lon, r.lat]) : null })).sort((a, b) => (pos ? a.d - b.d : a.bhid.localeCompare(b.bhid)));
      m.querySelector("#plg").textContent = pos ? "Urut dari yang terdekat dengan posisi Anda sekarang." : "GPS tidak tersedia — diurutkan menurut nama.";
      m.querySelector("#pll").innerHTML = rows.map((r) => `<li style="cursor:pointer" data-pl="${esc(r.bhid)}"><span style="flex:1"><b>${esc(r.bhid)}</b>${r.rig ? ` · ${esc(r.rig)}` : ""}${r.rencana_kedalaman ? ` · rencana ${esc(r.rencana_kedalaman)} m` : ""}</span><span class="muted">${r.d != null ? (r.d < 1000 ? Math.round(r.d) + " m" : (r.d / 1000).toFixed(1) + " km") : ""}</span></li>`).join("");
      m.querySelectorAll("[data-pl]").forEach((li) => (li.onclick = () => { inp.value = js?.value === "REDRILL" ? bhJenis(li.dataset.pl, "REDRILL") : li.dataset.pl; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); m.remove(); })); };
    isi(null);
    navigator.geolocation?.getCurrentPosition((p) => isi([p.coords.longitude, p.coords.latitude]), () => isi(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  };
}
new MutationObserver(() => document.querySelectorAll("input[data-bhid]:not([data-bh-ok])").forEach(pasangPilihBH)).observe(document.body, { childList: true, subtree: true });
async function loadTugas() {
  if (!online()) return myTugas;
  const [{ data: a, error }, { data: pj }] = await Promise.all([sb.rpc("my_assignment"), sb.from("project").select("*").eq("aktif", true).order("nama")]);
  localStorage.setItem("projects", JSON.stringify(pj ?? []));
  loadPersonil(); muatRencana().then(() => muatDaftarBH()).catch(() => {});
  sb.from("wilayah").select("nama,nomor_sk,titik").eq("aktif", true).then(({ data }) => { if (data) localStorage.setItem("wilayah", JSON.stringify(data)); });
  sb.from("qc_param").select("value").eq("name", "CREW_MIN").maybeSingle().then(({ data }) => { if (data?.value) localStorage.setItem("crewMin", data.value); });
  if (error) return myTugas;
  const rigs = a?.rigs ?? [], simpan = localStorage.getItem("rig");
  myTugas = a?.ada_penugasan ? { project: a.proyek, nama: a.nama_proyek ?? a.proyek, rigs, pilih_rig: !!a.pilih_rig, akses_geologi: !!a.akses_geologi, wajib_harian: a.wajib_harian,
    rig: rigs.includes(simpan) ? simpan : rigs[0] ?? null } : null;
  localStorage.setItem("myTugas", JSON.stringify(myTugas));
  if (myTugas?.rig) localStorage.setItem("rig", myTugas.rig);
  return myTugas;
}
// Proyek & rig diatur admin (penugasan). Driller/geologist tidak bisa mengetik rig; wellsite dengan >1 rig memilih rig yang sedang diisi.
const rigTerkunci = () => !!myTugas && !["admin", "verifier", "client"].includes(me?.role);
// Daftar rig baku: lookup_code RIG (template) + rig proyek dari admin. Admin menambah rig lewat pengaturan proyek.
function daftarRig() {
  const pj = JSON.parse(localStorage.getItem("projects") || "[]"), kode = myTugas?.project;
  const dariProyek = pj.filter((p) => !kode || p.code === kode).flatMap((p) => p.rigs ?? []);
  const L = [...new Set([...(KAMUS.RIG ?? []).map((x) => x.code), ...dariProyek, ...(myTugas?.rigs ?? [])].map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
  return (L.length ? L : ["RIG 1", "RIG 2"]).sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
}
function rigField() {
  const cur = (localStorage.getItem("rig") || "").toUpperCase();
  const rs = rigTerkunci() ? myTugas.rigs ?? [] : [];
  if (rs.length === 1) return `<input id="rg" value="${esc(rs[0])}" readonly title="Rig diatur admin">`;
  const L = rs.length > 1 ? rs : daftarRig(), pilih = rs.length > 1 ? myTugas.rig ?? cur : cur;
  const lbl = (r) => (KAMUS.RIG ?? []).find((x) => x.code === r)?.name ?? r;
  return `<select id="rg">${L.includes(pilih) || !pilih ? "" : `<option value="${esc(pilih)}" selected>${esc(pilih)}</option>`}<option value="" ${pilih ? "" : "selected"}>— pilih rig —</option>${L.map((r) => `<option value="${esc(r)}" ${r === pilih ? "selected" : ""}>${esc(lbl(r))}</option>`).join("")}</select>`;
}
document.addEventListener("change", (e) => {
  if (e.target?.id !== "rg" || e.target.tagName !== "SELECT" || !myTugas) return;
  myTugas.rig = e.target.value; localStorage.setItem("rig", e.target.value); localStorage.setItem("myTugas", JSON.stringify(myTugas));
});
function pilihProyekView(paksa) {
  const t = myTugas;
  app.innerHTML = `<div class="card"><h2>Penugasan proyek & rig</h2>${t ? `<p>Proyek: <b>${esc(t.nama)}</b> <span class="muted">(${esc(t.project)})</span></p>
      <p>Rig tugas: <b>${esc((t.rigs ?? []).join(", ") || "semua rig proyek")}</b></p>
      ${t.pilih_rig ? `<label>Saya sekarang mengisi untuk rig</label><select id="prg">${t.rigs.map((r) => `<option ${t.rig === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>` : ""}
      <p class="muted">Proyek dan rig diatur admin dan terkunci di semua formulir. Hubungi admin bila penugasan Anda tidak sesuai.</p>
      <div style="margin-top:10px"><button id="ps">Lanjut</button></div>`
    : `<p class="err">Akun Anda belum diberi penugasan proyek/rig oleh admin.</p><p class="muted">Data lapangan belum bisa dikirim sampai admin mengisi penugasan. Hubungi admin, lalu tekan Muat ulang.</p>
      <div style="margin-top:10px"><button id="pr">Muat ulang</button></div>`}
    ${paksa ? "" : `<div style="margin-top:8px"><button class="sec" id="pl">${t ? "Kembali" : "Lewati dulu"}</button></div>`}<div id="e" class="err"></div></div>`;
  $("#ps")?.addEventListener("click", () => { const r = $("#prg")?.value; if (r) { t.rig = r; localStorage.setItem("rig", r); localStorage.setItem("myTugas", JSON.stringify(t)); } sessionStorage.setItem("proyekOk", "1"); render(); });
  $("#pr")?.addEventListener("click", async () => { await loadTugas(); if (myTugas) { sessionStorage.setItem("proyekOk", "1"); render(); } else $("#e").textContent = online() ? "Penugasan belum diisi admin." : "Tidak ada sinyal."; });
  $("#pl")?.addEventListener("click", () => { sessionStorage.setItem("proyekOk", "1"); render(); });
}
// Editor penugasan (admin): proyek + centang rig. Tanpa centang = semua rig proyek.
const rigCek = (uid, code, pj, sel) => { const p = (pj ?? []).find((x) => x.code === code);
  return (p?.rigs ?? []).map((r) => `<label style="flex:0;white-space:nowrap;margin:0"><input type="checkbox" data-rc="${uid}" value="${esc(r)}" ${(sel ?? []).includes(r) ? "checked" : ""} style="width:auto"> ${esc(r)}</label>`).join(" ") || (code ? `<span class="muted">proyek tanpa rig</span>` : ""); };
const proyekSel = (uid, pj, cur, kosong) => `<select data-pp="${uid}" style="max-width:240px"><option value="">${kosong}</option>${(pj ?? []).filter((p) => p.aktif !== false || p.code === cur).map((p) => `<option value="${esc(p.code)}" ${cur === p.code ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select>`;
function pasangRigCek(box, pj) { box.querySelectorAll("[data-pp]").forEach((s) => (s.onchange = () => { box.querySelector(`[data-rcw="${s.dataset.pp}"]`).innerHTML = rigCek(s.dataset.pp, s.value, pj, []); })); }
const ambilRig = (box, uid) => [...box.querySelectorAll(`[data-rc="${uid}"]:checked`)].map((x) => x.value);
async function loadLanjutan() {
  if (!online()) return; const { data } = await sb.from("v_lanjutan").select("jenis,bhid,kotak_terakhir,to_terakhir");
  if (data) localStorage.setItem("lanjut", JSON.stringify(Object.fromEntries(data.map((r) => [`${r.jenis}|${r.bhid}`, r]))));
}
async function nextCore(bhid, type) {
  const L = JSON.parse(localStorage.getItem("lanjut") || "{}")[`CORE_${type}|${bhid}`] ?? {}, H = JSON.parse(localStorage.getItem("coreHist") || "{}")[`${type}|${bhid}`] ?? {};
  const Q = (await qAll()).filter((x) => x.kind === "core" && x.bhid === bhid && x.photo_type === type);
  const box = Math.max(L.kotak_terakhir ?? 0, H.box ?? 0, ...Q.map((x) => x.box_no ?? 0)), to = Math.max(Number(L.to_terakhir ?? 0), Number(H.to ?? 0), ...Q.map((x) => Number(x.depth_to)));
  return { lastBox: box, lastTo: to, box: box + 1, from: to };
}
// Kedalaman terakhir lubang (maks. TO dari run Progres bor, baris DDR, dan catatan HP) + apakah sudah EOH. STB tetap dilanjutkan.
// SEMENTARA (24/11): DDR dan foto run TIDAK saling mengisi kedalaman. sumber "ddr" = hanya DDR; "run" = hanya foto run.
async function kedalamanTerakhir(bhid, sumber = "run") {
  const b = bakuBH(bhid); let to = sumber === "run" ? lastRunTo(b) || null : null, eoh = false;
  if (online()) try {
    const [{ data: ev }, { data: dd }] = await Promise.all([
      sb.from("drill_event").select("depth_to,event_type,status_akhir").eq("bhid", b).in("event_type", ["RUN", "SELESAI_BOR"]).order("depth_to", { ascending: false }).limit(50),
      sumber === "ddr" ? sb.from("ddr").select("coring,open_hole").eq("bhid", b).limit(200) : Promise.resolve({ data: [] })]);
    for (const e of ev ?? []) { if (sumber === "run" && +e.depth_to > (to ?? 0)) to = +e.depth_to; if (e.event_type === "SELESAI_BOR" && e.status_akhir === "EOH") eoh = true; }
    for (const d of dd ?? []) for (const x of [...(d.coring ?? []), ...(d.open_hole ?? [])]) if (+x.to > (to ?? 0)) to = +x.to;
  } catch {}
  return { to, eoh };
}
function lastRunTo(bhid) {
  const L = JSON.parse(localStorage.getItem("lanjut") || "{}")[`RUN|${bhid}`];
  return Math.max(Number(localStorage.getItem(`lastTo_${bhid}`) || 0), Number(L?.to_terakhir ?? 0));
}
async function cekPenolakan(tampil) {
  if (!online()) return;
  const seen = localStorage.getItem("tolakSeen") || new Date(Date.now() - 7 * 864e5).toISOString();
  const { data } = await sb.from("v_penolakan").select("*").eq("user_id", session.user.id).gt("waktu", seen).order("waktu", { ascending: false }).limit(30);
  const xs = data ?? []; if (!xs.length) return;
  if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted")
    navigator.serviceWorker?.ready.then((r) => r.showNotification("TGEP: kiriman ditolak", { body: `${xs.length} kiriman ditolak — buka aplikasi untuk alasannya`, icon: "icon-192.png", tag: "tolak" }));
  if (!tampil && document.getElementById("tolakBox")) return;
  document.getElementById("tolakBox")?.remove();
  const box = document.createElement("div"); box.id = "tolakBox"; box.className = "card"; box.style.cssText = "background:#F6C9C3;border-left:6px solid #C8281F";
  box.innerHTML = `<h3 style="margin:0 0 6px">${xs.length} kiriman Anda DITOLAK — mohon diperbaiki</h3><ul class="list">${xs.map((x) => `<li style="flex-wrap:wrap"><span style="flex:1"><b>${esc(x.jenis)}</b> · ${esc(x.bhid ?? "")} ${esc(x.ket ?? "")}<br><span>${esc(x.alasan ?? "Alasan tidak tercatat")}</span><br><span class="muted">${fmtT(x.waktu)}</span></span>
    <button class="sec" data-go="${x.jenis === "FOTO CORE" ? "core" : "foto"}" data-bh="${esc(x.bhid ?? "")}" style="flex:0;white-space:nowrap">Foto ulang</button></li>`).join("")}</ul>
    <div class="row"><button id="tOk" style="flex:0;white-space:nowrap">Sudah saya baca</button>${"Notification" in window && Notification.permission === "default" ? `<button class="sec" id="tNot" style="flex:0;white-space:nowrap">Aktifkan notifikasi HP</button>` : ""}</div>`;
  app.prepend(box);
  box.querySelector("#tOk").onclick = () => { localStorage.setItem("tolakSeen", xs[0].waktu); box.remove(); };
  box.querySelector("#tNot")?.addEventListener("click", () => Notification.requestPermission().then(() => box.querySelector("#tNot")?.remove()));
  box.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { if (b.dataset.bh) localStorage.setItem("bhid", b.dataset.bh); tab = b.dataset.go; localStorage.setItem("tab", tab); render(); }));
}
let tolakTimer = null;
const jadwalCekTolak = () => { clearTimeout(tolakTimer); tolakTimer = setTimeout(() => cekPenolakan(true), 120e3); };
async function proyekAdmin(box) {
  const { data: pj } = await sb.from("project").select("*").order("nama");
  box.innerHTML = `<h3>Proyek & rig (admin)</h3><p class="muted">Rig proyek dipakai di penugasan driller/wellsite/client (bagian Penugasan di atas). Rig ditulis dipisah koma. Target lubang & meter dipakai di Laporan progres (realisasi vs rencana).</p>
    <ul class="list">${(pj ?? []).map((p) => `<li style="flex-wrap:wrap"><span style="flex:1"><b>${esc(p.nama)}</b> <span class="muted">(${esc(p.code)})</span>${p.aktif ? "" : ' <span class="err">nonaktif</span>'}</span>
      <input data-rg="${esc(p.code)}" value="${esc((p.rigs ?? []).join(", "))}" style="max-width:220px"><input data-tl="${esc(p.code)}" type="number" value="${p.target_lubang ?? ""}" placeholder="target lubang" style="max-width:120px"><input data-tm="${esc(p.code)}" type="number" step="0.1" value="${p.target_meter ?? ""}" placeholder="target meter" style="max-width:120px"><button class="sec" data-sv="${esc(p.code)}" style="flex:0">Simpan</button><button class="sec" data-ak="${esc(p.code)}" data-v="${p.aktif ? 0 : 1}" style="flex:0">${p.aktif ? "Nonaktifkan" : "Aktifkan"}</button></li>`).join("") || `<li class="muted">Belum ada proyek.</li>`}</ul>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end"><div><label>Kode</label><input id="pc" placeholder="mis. TGEP-BLK-A" autocapitalize="characters"></div><div><label>Nama proyek</label><input id="pn" placeholder="mis. Eksplorasi Blok A"></div><div><label>Rig (pisah koma)</label><input id="pr2" placeholder="RIG03, RIG04"></div><button id="pa" style="flex:0">Tambah</button></div><div id="pe" class="err"></div>`;
  const rigs = (s) => s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  box.querySelector("#pa").onclick = async () => { const code = box.querySelector("#pc").value.trim().toUpperCase(), nama = box.querySelector("#pn").value.trim(); if (!code || !nama) return (box.querySelector("#pe").textContent = "Isi kode dan nama.");
    const { error } = await sb.from("project").insert({ code, nama, rigs: rigs(box.querySelector("#pr2").value) }); if (error) return (box.querySelector("#pe").textContent = error.message); proyekAdmin(box); };
  box.querySelectorAll("[data-sv]").forEach((b) => (b.onclick = async () => { const nv = (s) => { const x = box.querySelector(s).value; return x === "" ? null : Number(x); };
    const { error } = await sb.from("project").update({ rigs: rigs(box.querySelector(`[data-rg="${b.dataset.sv}"]`).value), target_lubang: nv(`[data-tl="${b.dataset.sv}"]`), target_meter: nv(`[data-tm="${b.dataset.sv}"]`) }).eq("code", b.dataset.sv); if (error) return alert(error.message); b.textContent = "✓"; }));
  box.querySelectorAll("[data-ak]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("project").update({ aktif: b.dataset.v === "1" }).eq("code", b.dataset.ak); if (error) return alert(error.message); proyekAdmin(box); }));
}
async function proyekFilter() {
  const p = sessionStorage.getItem("filterProyek") || ""; if (!p) return null;
  const pj = JSON.parse(localStorage.getItem("projects") || "[]").find((x) => x.code === p);
  const { data } = await sb.from("v_bhid_project").select("bhid").eq("project", p);
  return { code: p, nama: pj?.nama ?? p, rigs: pj?.rigs ?? [], bhids: (data ?? []).map((r) => r.bhid) };
}
const proyekSelect = () => { const pj = JSON.parse(localStorage.getItem("projects") || "[]"), cur = sessionStorage.getItem("filterProyek") || "";
  return `<div><label>Proyek</label><select id="fproj"><option value="">Semua proyek</option>${pj.map((p) => `<option value="${esc(p.code)}" ${cur === p.code ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select></div>`; };

// ---------- Rekap operator: folder per operator, kepatuhan harian, status HP ----------
let lastBeat = 0;
async function beat(force) {
  if (!online() || !me?.role || (!force && Date.now() - lastBeat < 120e3)) return; lastBeat = Date.now();
  const q = await qAll(), old = q.map((x) => x.captured_at || x.row?.captured_at).filter(Boolean).sort()[0] ?? null;
  await sb.from("device_status").upsert({ user_id: session.user.id, last_seen: new Date().toISOString(), app_version: APP_VERSION, antrean: q.length, antrean_tertua: old, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: "user_id" }).then(() => {}, () => {});
}
const ST_COL = { LENGKAP: "#C8EBD4", SEBAGIAN: "#FFE58A", BELUM: "#F6C9C3", "RIG TIDAK BEROPERASI": "#E3E8E1", "TANPA PENUGASAN": "#FBE6D0", "ADA KIRIMAN (TANPA PENUGASAN)": "#FBE6D0", "TIDAK WAJIB": "#E3E8E1" };
const ST_ORD = ["BELUM", "SEBAGIAN", "TANPA PENUGASAN", "ADA KIRIMAN (TANPA PENUGASAN)", "LENGKAP", "RIG TIDAK BEROPERASI", "TIDAK WAJIB"];
const ago = (t) => { if (!t) return "-"; const m = Math.round((Date.now() - Date.parse(t)) / 60e3); return m < 60 ? `${m} mnt lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };
async function rekapView(v) {
  const tgl = sessionStorage.getItem("rekapTgl") || todayWIB();
  v.innerHTML = `<div class="card"><h2>Rekap & pelacakan operator</h2>
    <div class="row" style="align-items:flex-end;flex-wrap:wrap"><div><label>Tanggal</label><input id="rt" type="date" value="${tgl}"></div>${proyekSelect()}<button id="rgo" style="flex:0">Tampilkan</button><button class="sec" id="rcsv" style="flex:0;white-space:nowrap">Unduh CSV</button></div>
    <p class="muted">Kewajiban harian — driller: P2H, foto progres, DDR/TTD DDR; geologist: foto core, pada hari rig yang ditugaskan beroperasi. Form Logging dinilai per lubang dengan tenggat (boleh dikirim besoknya). Penugasan rig diatur admin di bagian bawah.${me?.role === "admin" ? " <b>Mengeluarkan operator</b> (mis. akun uji coba atau bukan petugas): tekan <b>✕ Keluarkan</b> di bawah namanya. <b>Menghapus kiriman:</b> tekan <b>Folder</b> pada operator, lalu <b>Hapus</b> per kiriman (atau centang beberapa lalu <b>Hapus terpilih</b>). Data masuk arsip dan bisa dipulihkan." : ""}</p></div>
    <div id="rs" class="card">Memuat…</div><div id="rl" class="card"></div><div id="rm" class="card"></div>${me?.role === "admin" ? `<div id="rab" class="card"></div><div id="rmp" class="card"></div><div id="rp" class="card"></div><div id="rpj" class="card"></div>` : ""}`;
  $("#rgo").onclick = () => { sessionStorage.setItem("rekapTgl", $("#rt").value); sessionStorage.setItem("filterProyek", $("#fproj").value); rekapView(v); };
  if (!online()) return ($("#rs").textContent = "Rekap perlu sinyal internet.");
  const from14 = new Date(Date.parse(tgl) - 13 * 864e5).toISOString().slice(0, 10);
  const fp = sessionStorage.getItem("filterProyek") || "";
  const [{ data: all0, error }, { data: pnAll }] = await Promise.all([sb.from("v_kepatuhan_harian").select("*").gte("tanggal", from14).lte("tanggal", tgl), sb.from("penugasan").select("user_id,project")]);
  const PJ = Object.fromEntries((pnAll ?? []).map((p) => [p.user_id, p.project])), all = (all0 ?? []).filter((r) => !fp || PJ[r.user_id] === fp);
  if (error) return ($("#rs").innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const day = (all ?? []).filter((r) => r.tanggal === tgl).sort((a, b) => ST_ORD.indexOf(a.status) - ST_ORD.indexOf(b.status) || (a.nama ?? "").localeCompare(b.nama ?? ""));
  const cnt = (s) => day.filter((r) => r.status === s).length, hp = day.filter((r) => r.antrean > 0);
  $("#rs").innerHTML = `<h3>${tgl}</h3><div class="row" style="flex-wrap:wrap;gap:6px">${["LENGKAP", "SEBAGIAN", "BELUM", "TANPA PENUGASAN"].map((s) => `<span class="pill" style="background:${ST_COL[s]};color:#12251E">${s}: ${cnt(s)}</span>`).join("")}<span class="pill" style="background:${hp.length ? "#F6C9C3" : "#C8EBD4"};color:#12251E">Data tertahan di HP: ${hp.length} orang</span></div>
    <div class="tw" style="margin-top:8px"><table><tr><th>Operator</th><th>Peran / rig</th><th>Status</th><th>Belum dikirim</th><th>P2H</th><th>Progres</th><th>DDR/TTD</th><th>Form Logging</th><th>Core</th><th>Arsip</th><th>Logging terlambat (rig)</th><th>Kirim terakhir</th><th>HP</th><th></th></tr>
    ${day.map((r) => `<tr><td><b>${esc(r.nama ?? "-")}</b><br><span class="muted">${esc(r.perusahaan ?? "")}</span>${me?.role === "admin" && r.user_id !== session?.user?.id ? `<br><button class="sec" data-kl="${r.user_id}" data-nm="${esc(r.nama ?? "")}" style="padding:2px 8px;margin-top:4px;color:#B3261E;border-color:#B3261E;width:auto" title="Hapus / nonaktifkan akun ini">✕ Keluarkan</button>` : ""}</td><td>${esc(r.peran)}<br>${esc(r.rig ?? "—")}</td>
      <td style="background:${ST_COL[r.status] ?? "#fff"}">${esc(r.status)}</td><td>${esc((r.kurang ?? []).join(", "))}</td>
      <td>${r.p2h}</td><td>${r.progres}</td><td>${r.ddr_ttd}</td><td>${r.fbor}</td><td>${r.foto_core}</td><td>${r.arsip}</td><td style="${r.peran === "geologist" && r.lubang_logging_terlambat ? "background:#F6C9C3" : ""}">${r.peran === "geologist" ? (r.lubang_logging_terlambat ? r.lubang_logging_terlambat + " lubang" : "0") : "-"}</td><td>${r.terakhir ? fmtT(r.terakhir).slice(-8) : "-"}</td>
      <td style="${r.antrean > 0 ? "background:#F6C9C3" : ""}">${r.antrean ? `<b>${r.antrean} antre</b> sejak ${ago(r.antrean_tertua)}<br>` : ""}online ${ago(r.last_seen)}${r.app_version && r.app_version !== APP_VERSION ? `<br><span class="err">versi lama ${esc(r.app_version)}</span>` : ""}</td>
      <td style="white-space:nowrap"><button class="sec" data-fd="${r.user_id}" data-nm="${esc(r.nama ?? "")}" style="flex:0">Folder</button></td></tr>`).join("") || `<tr><td colspan="14" class="muted">Belum ada operator (driller/geologist) yang disetujui.</td></tr>`}</table></div>`;
  logLubang($("#rl"));
  const dates = [...Array(14)].map((_, i) => new Date(Date.parse(tgl) - (13 - i) * 864e5).toISOString().slice(0, 10)), ops = [...new Map((all ?? []).map((r) => [r.user_id, r])).values()];
  const sym = { LENGKAP: "✓", SEBAGIAN: "½", BELUM: "✗", "RIG TIDAK BEROPERASI": "–", "TANPA PENUGASAN": "?", "ADA KIRIMAN (TANPA PENUGASAN)": "+", "TIDAK WAJIB": "–" };
  $("#rm").innerHTML = `<h3>14 hari terakhir</h3><p class="muted">✓ lengkap · ½ sebagian · ✗ belum · – rig tidak beroperasi / tidak wajib · ? tanpa penugasan</p><div class="tw"><table><tr><th>Operator</th>${dates.map((d) => `<th>${d.slice(8)}/${d.slice(5, 7)}</th>`).join("")}<th>% lengkap</th></tr>
    ${ops.map((o) => { const rs = dates.map((d) => (all ?? []).find((r) => r.user_id === o.user_id && r.tanggal === d)); const wajib = rs.filter((r) => r && ["LENGKAP", "SEBAGIAN", "BELUM"].includes(r.status)); const ok = wajib.filter((r) => r.status === "LENGKAP").length;
      return `<tr><td>${esc(o.nama ?? "-")} <span class="muted">${esc(o.rig ?? "")}</span></td>${rs.map((r) => `<td style="text-align:center;background:${ST_COL[r?.status] ?? "#fff"}" title="${esc(r?.status ?? "")}${r?.kurang?.length ? " — " + esc(r.kurang.join(", ")) : ""}">${sym[r?.status] ?? ""}</td>`).join("")}<td><b>${wajib.length ? Math.round((100 * ok) / wajib.length) + "%" : "-"}</b></td></tr>`; }).join("")}</table></div>`;
  v.querySelectorAll("[data-fd]").forEach((b) => (b.onclick = () => folderView(v, b.dataset.fd, b.dataset.nm)));
  v.querySelectorAll("[data-kl]").forEach((b) => (b.onclick = async () => { if (await keluarkanOperator(b.dataset.kl, b.dataset.nm)) rekapView(v); }));
  $("#rcsv").onclick = () => { const cols = ["tanggal", "nama", "perusahaan", "peran", "rig", "status", "kurang", "p2h", "progres", "ddr_ttd", "fbor", "foto_core", "arsip", "lubang_logging_terlambat", "total_kiriman", "terakhir", "antrean", "last_seen", "app_version"];
    const csv = [cols.join(","), ...(all ?? []).map((r) => cols.map((c) => `"${String(Array.isArray(r[c]) ? r[c].join("; ") : r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `TGEP_Rekap_Operator_${from14}_${tgl}.csv`; a.click(); };
  if (me?.role === "admin") {
    absensiGaji($("#rab")); personilAdmin($("#rmp"));
    proyekAdmin($("#rpj"));
    const [{ data: us }, { data: pn }, { data: pj }] = await Promise.all([sb.from("app_user").select("user_id,full_name,role,company").in("role", ["driller", "geologist"]).order("full_name"), sb.from("penugasan").select("*"), sb.from("project").select("code,nama,rigs,aktif").order("nama")]);
    const P = Object.fromEntries((pn ?? []).map((p) => [p.user_id, p]));
    $("#rp").innerHTML = `<h3>Penugasan proyek & rig (admin)</h3><p class="muted">Pilih proyek dan centang rig tiap driller / wellsite. Driller biasanya satu rig; wellsite yang mengawasi dua rig dicentang keduanya (ia memilih rig saat mengisi). Tanpa centang = semua rig proyek. Pengguna tidak bisa mengubah sendiri. Hilangkan “wajib” untuk staf yang tidak bertugas harian (cuti, kantor).</p>
      <ul class="list">${(us ?? []).map((u) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:180px"><b>${esc(u.full_name ?? "")}</b> · ${esc(u.role)}<br><span class="muted">${esc(u.company ?? "")}</span></span>
        ${proyekSel(u.user_id, pj, P[u.user_id]?.project ?? "", "— tanpa penugasan —")}
        <span data-rcw="${u.user_id}" style="display:flex;gap:10px;flex:0;align-items:center">${rigCek(u.user_id, P[u.user_id]?.project, pj, P[u.user_id]?.rigs)}</span>
        <label style="flex:0;white-space:nowrap;margin:0"><input type="checkbox" data-wj="${u.user_id}" ${P[u.user_id]?.wajib_harian === false ? "" : "checked"} style="width:auto"> wajib</label>
        <button class="sec" data-sp="${u.user_id}" style="flex:0">Simpan</button></li>`).join("") || `<li class="muted">Belum ada driller/geologist.</li>`}</ul>`;
    pasangRigCek($("#rp"), pj);
    $("#rp").querySelectorAll("[data-sp]").forEach((b) => (b.onclick = async () => {
      const id = b.dataset.sp, box = $("#rp"), project = box.querySelector(`[data-pp="${id}"]`).value || null;
      const { error } = await sb.rpc("admin_set_penugasan", { p_user: id, p_project: project, p_rigs: ambilRig(box, id), p_akses_geologi: P[id]?.akses_geologi ?? false,
        p_wajib_harian: box.querySelector(`[data-wj="${id}"]`).checked, p_catatan: P[id]?.catatan ?? null });
      if (error) return alert(error.message); b.textContent = "Tersimpan ✓"; setTimeout(() => rekapView(v), 500);
    }));
  }
}
async function logLubang(box) {
  const [{ data, error }, { data: gp }] = await Promise.all([sb.from("v_logging_lubang").select("*").neq("status", "BELUM ADA RUN").order("terakhir_bor", { ascending: false }).limit(200), sb.from("qc_param").select("value").eq("name", "LOGGING_GRACE_DAYS").maybeSingle()]);
  if (error) return (box.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const g = gp?.value ?? 2, col = { LENGKAP: "#C8EBD4", "MENUNGGU PERIKSA": "#FFE58A", "DALAM TENGGAT": "#E3E8E1", TERLAMBAT: "#F6C9C3" }, rows = (data ?? []).sort((a, b) => ["TERLAMBAT", "MENUNGGU PERIKSA", "DALAM TENGGAT", "LENGKAP"].indexOf(a.status) - ["TERLAMBAT", "MENUNGGU PERIKSA", "DALAM TENGGAT", "LENGKAP"].indexOf(b.status));
  box.innerHTML = `<h3>Form Logging per lubang</h3><p class="muted">Kedalaman bor (dari foto RUN) dibandingkan kedalaman yang sudah masuk database. Form Logging boleh dikirim per hari atau per lubang; baru <b>TERLAMBAT</b> bila interval yang sudah dibor belum di-logging lebih dari <b>${g} hari</b>.${me?.role === "admin" ? ` Ubah tenggat: <input id="gd" type="number" min="0" max="30" value="${g}" style="width:70px"> hari <button class="sec" id="gs" style="width:auto">Simpan</button>` : ""}</p>
    <div class="tw"><table><tr><th>Hole ID</th><th>Rig</th><th>Bor (m)</th><th>Logging (m)</th><th>Belum (m)</th><th>Conto</th><th>Scan menunggu</th><th>Belum sejak</th><th>Status</th></tr>
    ${rows.map((l) => `<tr><td><b>${esc(l.bhid)}</b></td><td>${esc(l.rig ?? "")}</td><td>${l.kedalaman_bor ?? ""}</td><td>${l.kedalaman_logging}</td><td>${l.belum_logging_m}</td><td>${l.jumlah_conto}</td><td>${l.scan_menunggu}</td><td>${l.belum_sejak ? `${fmtT(l.belum_sejak).slice(0, 10)} (${l.umur_hari} hr)` : "-"}</td><td style="background:${col[l.status] ?? "#fff"}">${esc(l.status)}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">Belum ada lubang dengan foto RUN.</td></tr>`}</table></div>`;
  box.querySelector("#gs")?.addEventListener("click", async () => { const { error: e } = await sb.from("qc_param").update({ value: Number(box.querySelector("#gd").value) }).eq("name", "LOGGING_GRACE_DAYS"); if (e) return alert(e.message); logLubang(box); });
}
// ---------- Absensi & penggajian (admin): dari daftar personil Masuk/Keluar shift di Progres bor ----------
const levenshtein = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
async function absensiGaji(box) {
  const t = todayWIB(), awal = t.slice(0, 8) + "01", st = JSON.parse(sessionStorage.getItem("absGaji") || "null") ?? { from: awal, to: t, rig: "", jab: "" };
  const rigs = [...new Set(JSON.parse(localStorage.getItem("projects") || "[]").flatMap((p) => p.rigs ?? []))].sort();
  box.innerHTML = `<h3>Absensi & penggajian (admin)</h3><p class="muted">Dari daftar personil di <b>Masuk shift</b> dan <b>Keluar shift</b> (Progres bor). Satu shift dihitung bila nama ada di foto masuk; jam kerja dihitung bila nama juga ada di foto keluar. Shift malam yang lewat tengah malam dihitung ke tanggal mulai shift. Data ini tidak terlihat oleh client.</p>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end"><div><label>Dari</label><input id="agF" type="date" value="${st.from}"></div><div><label>Sampai</label><input id="agT" type="date" value="${st.to}"></div>
    <div><label>Rig</label><select id="agR"><option value="">Semua</option>${rigs.map((r) => `<option ${st.rig === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
    <div><label>Jabatan</label><select id="agJ"><option value="">Semua</option>${JABATAN.map((j) => `<option ${st.jab === j ? "selected" : ""}>${j}</option>`).join("")}</select></div>
    <button id="agG" style="flex:0">Tampilkan</button><button class="sec" id="agX" style="flex:0;white-space:nowrap">Unduh Excel</button></div><div id="agO" class="muted" style="margin-top:8px"></div>`;
  let D = null;
  const ambil = async () => {
    Object.assign(st, { from: $("#agF").value, to: $("#agT").value, rig: $("#agR").value, jab: $("#agJ").value }); sessionStorage.setItem("absGaji", JSON.stringify(st));
    let q = sb.from("v_absensi_personil").select("*").gte("tanggal", st.from).lte("tanggal", st.to).order("tanggal").order("shift").order("rig").limit(10000);
    let q2 = sb.from("v_personil_shift").select("*").gte("tanggal", st.from).lte("tanggal", st.to).order("tanggal").order("shift").order("rig").limit(5000);
    if (st.rig) { q = q.eq("rig", st.rig); q2 = q2.eq("rig", st.rig); } if (st.jab) q = q.eq("jabatan", st.jab);
    const [{ data: rows, error }, { data: sh, error: e2 }] = await Promise.all([q, q2]); if (error || e2) throw new Error((error ?? e2).message);
    const P = {};
    for (const r of rows ?? []) { const k = r.nama_kunci || String(r.nama).toUpperCase(), o = (P[k] ??= { kunci: k, resmi: r.nama_resmi, idk: r.id_karyawan ?? "", pt: r.perusahaan ?? "", stn: r.status_nama === "ALIAS" ? "RESMI" : r.status_nama, ejaan: {}, jab: {}, rig: new Set(), tgl: new Set(), shift: 0, pagi: 0, malam: 0, lengkap: 0, belum: 0, tanpaMasuk: 0, jam: 0, hari: {} });
      o.ejaan[r.nama] = (o.ejaan[r.nama] ?? 0) + 1; o.jab[r.jabatan_resmi ?? r.jabatan] = (o.jab[r.jabatan_resmi ?? r.jabatan] ?? 0) + 1; o.rig.add(r.rig);
      if (r.status === "TIDAK FOTO MASUK") { o.tanpaMasuk++; continue; }
      o.tgl.add(r.tanggal); o.shift++; r.shift === "PAGI" ? o.pagi++ : o.malam++; r.status === "LENGKAP" ? o.lengkap++ : o.belum++;
      o.jam += Number(r.durasi_jam) || 0; o.hari[r.tanggal] = (o.hari[r.tanggal] ?? "") + (r.shift === "PAGI" ? "P" : "M"); }
    const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const orang = Object.values(P).map((o) => ({ ...o, nama: o.resmi ?? top(o.ejaan), jabatan: top(o.jab), ejaanLain: Object.keys(o.ejaan).filter((e) => kunciNama(e) !== kunciNama(o.resmi ?? top(o.ejaan))) }))
      .sort((a, b) => JABATAN.indexOf(a.jabatan) - JABATAN.indexOf(b.jabatan) || a.nama.localeCompare(b.nama));
    const mirip = []; for (let i = 0; i < orang.length; i++) for (let j = i + 1; j < orang.length; j++) { if (orang[i].stn === "RESMI" && orang[j].stn === "RESMI") continue; const a = kunciNama(orang[i].nama), b = kunciNama(orang[j].nama);
      if (levenshtein(a, b) <= (Math.min(a.length, b.length) <= 6 ? 1 : 2) || a.startsWith(b + " ") || b.startsWith(a + " ")) mirip.push([orang[i].nama, orang[j].nama]); }
    const tanggal = []; for (let d = new Date(st.from + "T00:00:00Z"); d <= new Date(st.to + "T00:00:00Z"); d = new Date(d.getTime() + 864e5)) tanggal.push(d.toISOString().slice(0, 10));
    return { rows: rows ?? [], sh: sh ?? [], orang, mirip, tanggal };
  };
  const tampil = async () => {
    $("#agO").textContent = "Memuat…";
    try { D = await ambil(); } catch (e) { return ($("#agO").innerHTML = `<span class="err">${esc(e.message)}</span>`); }
    const { orang, mirip, sh, tanggal } = D, j1 = (x) => (Math.round(x * 10) / 10).toLocaleString("id-ID");
    const shKurang = sh.filter((x) => (x.kurang ?? []).length);
    $("#agO").innerHTML = `<p style="color:inherit"><b>${orang.length}</b> orang · <b>${sh.length}</b> shift rig · ${tanggal.length} hari</p>
      ${mirip.length ? `<div class="card" style="background:#FBE6D0;margin:6px 0"><b>Periksa nama mirip sebelum penggajian</b> — bisa jadi orang yang sama ditulis berbeda (dihitung terpisah). Gabungkan di kartu Daftar personil resmi:<br>${mirip.map(([a, b]) => `${esc(a)} ↔ ${esc(b)}`).join("<br>")}</div>` : ""}
      ${orang.some((o) => o.stn !== "RESMI") ? `<p style="color:#B26B00;margin:6px 0">${orang.filter((o) => o.stn !== "RESMI").length} nama belum terdaftar resmi (tanda ?). Setujui atau gabungkan di kartu Daftar personil resmi sebelum penggajian.</p>` : ""}
      ${shKurang.length ? `<p class="err" style="margin:6px 0">${shKurang.length} shift rig bermasalah (crew kurang, tanpa driller, belum foto keluar, dll.) — lihat sheet “Per shift rig” di Excel.</p>` : ""}
      <div class="tw"><table><tr><th>Nama</th><th>Jabatan</th><th>Rig</th><th>Hari kerja</th><th>Shift</th><th>Pagi</th><th>Malam</th><th>Jam kerja</th><th>Belum foto keluar</th>${tanggal.map((d) => `<th>${d.slice(8)}</th>`).join("")}</tr>
      ${orang.map((o) => `<tr><td style="padding:4px 6px;white-space:nowrap"><b>${esc(o.nama)}</b>${o.stn !== "RESMI" ? ` <span style="color:#B26B00" title="Belum terdaftar resmi">?</span>` : ""}${o.idk ? ` <span class="muted">${esc(o.idk)}</span>` : ""}${o.ejaanLain.length ? `<br><span class="muted">ditulis: ${o.ejaanLain.map(esc).join(" / ")}</span>` : ""}</td><td style="padding:4px 6px">${esc(o.jabatan)}</td><td style="padding:4px 6px">${esc([...o.rig].join(", "))}</td>
        <td style="padding:4px 6px;text-align:right"><b>${o.tgl.size}</b></td><td style="padding:4px 6px;text-align:right">${o.shift}</td><td style="padding:4px 6px;text-align:right">${o.pagi}</td><td style="padding:4px 6px;text-align:right">${o.malam}</td>
        <td style="padding:4px 6px;text-align:right">${j1(o.jam)}</td><td style="padding:4px 6px;text-align:right;${o.belum ? "color:var(--red)" : ""}">${o.belum || ""}</td>
        ${tanggal.map((d) => `<td style="padding:4px 3px;text-align:center">${o.hari[d] ?? ""}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="9" class="muted" style="padding:6px">Belum ada data personil pada periode ini.</td></tr>`}</table></div>
      <p class="muted">P = shift pagi (06–18), M = shift malam (18–06). Jam kerja hanya dari shift yang punya foto masuk dan keluar dengan nama yang sama.</p>`;
  };
  $("#agG").onclick = tampil;
  $("#agX").onclick = async () => {
    try { if (!D) D = await ambil(); const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new(), { orang, rows, sh, mirip, tanggal } = D;
      const add = (data, nm) => X.utils.book_append_sheet(wb, data.length ? X.utils.json_to_sheet(data) : X.utils.aoa_to_sheet([["(kosong)"]]), nm);
      add(orang.map((o) => ({ Nama: o.nama, "ID karyawan": o.idk, Perusahaan: o.pt, "Status nama": o.stn === "RESMI" ? "RESMI" : "BELUM TERDAFTAR", Jabatan: o.jabatan, Rig: [...o.rig].join(", "), "Hari kerja": o.tgl.size, "Jumlah shift": o.shift, "Shift pagi": o.pagi, "Shift malam": o.malam,
        "Jam kerja": Math.round(o.jam * 100) / 100, "Shift lengkap (masuk+keluar)": o.lengkap, "Belum foto keluar": o.belum, "Hanya di foto keluar": o.tanpaMasuk, "Ejaan lain": o.ejaanLain.join(" / ") })), "Rekap per orang");
      add(orang.map((o) => Object.fromEntries([["Nama", o.nama], ["Jabatan", o.jabatan], ...tanggal.map((d) => [d, o.hari[d] ?? ""]), ["Hari kerja", o.tgl.size]])), "Kehadiran harian");
      add(rows.map((r) => ({ Tanggal: r.tanggal, Shift: r.shift, Rig: r.rig, "Nama resmi": r.nama_resmi ?? "", "Nama tertulis": r.nama, "ID karyawan": r.id_karyawan ?? "", Jabatan: r.jabatan_resmi ?? r.jabatan, "Jam masuk": (r.jam_masuk ?? "").replace("T", " ").slice(0, 16), "Jam keluar": (r.jam_keluar ?? "").replace("T", " ").slice(0, 16),
        "Durasi (jam)": r.durasi_jam, Status: r.status, "Alasan (crew kurang dll.)": r.alasan_masuk ?? "", "Dicatat oleh": r.dicatat_oleh ?? "" })), "Detail per shift");
      add(sh.map((x) => ({ Tanggal: x.tanggal, Shift: x.shift, Rig: x.rig, "Jam masuk": (x.jam_masuk ?? "").replace("T", " ").slice(0, 16), "Jam keluar": (x.jam_keluar ?? "").replace("T", " ").slice(0, 16),
        WSG: x.wsg, Driller: x.driller, Crew: x.crew, "Jumlah crew (tanpa WSG)": x.jumlah_crew, "Crew minimum": x.crew_min, Kekurangan: (x.kurang ?? []).join("; ") })), "Per shift rig");
      add([{ Keterangan: `Periode ${st.from} s.d. ${st.to}${st.rig ? " · " + st.rig : ""}${st.jab ? " · " + st.jab : ""}` }, { Keterangan: "Sumber: daftar personil Masuk/Keluar shift (Progres bor), foto bergeotag & berjam." },
        { Keterangan: "Hari kerja = jumlah tanggal shift berbeda; shift malam 18–06 dihitung ke tanggal mulai shift." }, { Keterangan: "Jam kerja hanya dari shift dengan foto masuk dan keluar berisi nama yang sama." },
        ...mirip.map(([a, b]) => ({ Keterangan: `PERIKSA nama mirip: ${a} ↔ ${b}` })), { Keterangan: `Diunduh ${new Date().toLocaleString("id-ID")} oleh ${me?.full_name ?? ""}` }], "Catatan");
      X.writeFile(wb, `TGEP_Absensi_Gaji_${st.from}_${st.to}${st.rig ? "_" + st.rig.replace(/\s/g, "") : ""}.xlsx`);
    } catch (e) { alert(e.message); }
  };
  tampil();
}
// ---------- Daftar personil resmi (admin) ----------
async function personilAdmin(box) {
  const pjs = JSON.parse(localStorage.getItem("projects") || "[]"), proj = sessionStorage.getItem("mpProj") || pjs[0]?.code || "";
  const rigsP = pjs.find((p) => p.code === proj)?.rigs ?? [];
  const { data, error } = await sb.from("personil").select("*").eq("project", proj).order("status").order("jabatan").order("nama");
  if (error) return (box.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const L = data ?? [], us = L.filter((p) => p.status === "USULAN"), rs = L.filter((p) => p.status === "RESMI"), JB = (cur) => JABATAN.map((j) => `<option ${cur === j ? "selected" : ""}>${j}</option>`).join("");
  const rigC = (id, sel) => rigsP.map((r) => `<label style="flex:0;white-space:nowrap;margin:0"><input type="checkbox" data-mr="${id}" value="${esc(r)}" ${(sel ?? []).includes(r) ? "checked" : ""} style="width:auto"> ${esc(r)}</label>`).join(" ");
  box.innerHTML = `<h3>Daftar personil resmi (admin)</h3><p class="muted">Nama di sini muncul sebagai pilihan dan isian otomatis di <b>Masuk shift</b> rig yang dicentang (langsung saat HP petugas online). Nama baru yang diketik petugas masuk ke <b>Usulan</b>: setujui bila orang baru, atau gabungkan ke nama resmi bila hanya beda ejaan — rekap gaji ikut terhitung ke orang resmi, catatan lapangan tidak diubah.</p>
    ${pjs.length > 1 ? `<label>Proyek</label><select id="mpP">${pjs.map((p) => `<option value="${esc(p.code)}" ${p.code === proj ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select>` : ""}
    ${us.length ? `<h3 style="margin-top:12px;color:#B26B00">Usulan dari lapangan (${us.length})</h3><ul class="list">${us.map((p) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:160px"><b>${esc(p.nama)}</b> · ${esc(p.jabatan)} · ${esc((p.rigs ?? []).join(", "))}<br><span class="muted">${esc(p.catatan ?? "")}</span></span>
      <button data-ok="${p.id}" style="flex:0">Setujui</button><select data-gt="${p.id}" style="max-width:200px"><option value="">Gabungkan ke…</option>${rs.map((r) => `<option value="${r.id}">${esc(r.nama)} (${esc(r.jabatan)})</option>`).join("")}</select><button class="sec" data-tl="${p.id}" style="flex:0">Tolak</button></li>`).join("")}</ul>` : ""}
    <h3 style="margin-top:12px">Resmi (${rs.length})</h3>
    <ul class="list">${rs.map((p) => `<li style="flex-wrap:wrap;${p.aktif ? "" : "opacity:.55"}"><input data-mn="${p.id}" value="${esc(p.nama)}" style="flex:1;min-width:150px"><select data-mj="${p.id}" style="flex:0 0 110px">${JB(p.jabatan)}</select>
      <span style="display:flex;gap:8px;flex:0">${rigC(p.id, p.rigs)}</span><input data-mi="${p.id}" value="${esc(p.id_karyawan ?? "")}" placeholder="ID karyawan" style="max-width:120px"><input data-mt="${p.id}" value="${esc(p.perusahaan ?? "")}" placeholder="Perusahaan" style="max-width:150px">
      <button class="sec" data-ms="${p.id}" style="flex:0">Simpan</button><button class="sec" data-ma="${p.id}" data-v="${p.aktif ? 0 : 1}" style="flex:0">${p.aktif ? "Nonaktifkan" : "Aktifkan"}</button></li>`).join("") || `<li class="muted">Belum ada. Tambahkan WSG, driller dan crew tiap rig di bawah.</li>`}</ul>
    <h3 style="margin-top:12px">Tambah personil</h3><div class="row" style="flex-wrap:wrap;align-items:center"><input id="mpN" placeholder="Nama lengkap" style="min-width:160px"><select id="mpJ" style="flex:0 0 110px">${JB("Helper")}</select>
      <span style="display:flex;gap:8px;flex:0">${rigC("baru", [])}</span><input id="mpI" placeholder="ID karyawan (opsional)" style="max-width:150px"><input id="mpT" placeholder="Perusahaan" style="max-width:150px"><button id="mpA" style="flex:0">Tambah</button></div><div id="mpE" class="err"></div>`;
  const ulang = () => { loadPersonil(); personilAdmin(box); }, rigOf = (id) => [...box.querySelectorAll(`[data-mr="${id}"]:checked`)].map((x) => x.value), nul = (x) => x.trim() || null;
  box.querySelector("#mpP")?.addEventListener("change", (e) => { sessionStorage.setItem("mpProj", e.target.value); personilAdmin(box); });
  box.querySelector("#mpA").onclick = async () => { const nama = box.querySelector("#mpN").value.trim().replace(/\s+/g, " "); if (!nama) return (box.querySelector("#mpE").textContent = "Isi nama.");
    const { error } = await sb.from("personil").insert({ project: proj, nama, jabatan: box.querySelector("#mpJ").value, rigs: rigOf("baru"), id_karyawan: nul(box.querySelector("#mpI").value), perusahaan: nul(box.querySelector("#mpT").value), updated_by: session.user.id });
    if (error) return (box.querySelector("#mpE").textContent = /personil_unik|duplicate/.test(error.message) ? "Nama ini sudah ada di daftar (atau di usulan)." : error.message); ulang(); };
  box.querySelectorAll("[data-ms]").forEach((b) => (b.onclick = async () => { const id = b.dataset.ms;
    const { error } = await sb.from("personil").update({ nama: box.querySelector(`[data-mn="${id}"]`).value.trim().replace(/\s+/g, " "), jabatan: box.querySelector(`[data-mj="${id}"]`).value, rigs: rigOf(id),
      id_karyawan: nul(box.querySelector(`[data-mi="${id}"]`).value), perusahaan: nul(box.querySelector(`[data-mt="${id}"]`).value), updated_at: new Date().toISOString(), updated_by: session.user.id }).eq("id", id);
    if (error) return alert(/personil_unik|duplicate/.test(error.message) ? "Nama itu sudah dipakai orang lain di daftar." : error.message); b.textContent = "✓"; loadPersonil(); }));
  box.querySelectorAll("[data-ma]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("personil").update({ aktif: b.dataset.v === "1", updated_at: new Date().toISOString(), updated_by: session.user.id }).eq("id", b.dataset.ma); if (error) return alert(error.message); ulang(); }));
  box.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("personil").update({ status: "RESMI", updated_at: new Date().toISOString(), updated_by: session.user.id }).eq("id", b.dataset.ok); if (error) return alert(error.message); ulang(); }));
  box.querySelectorAll("[data-tl]").forEach((b) => (b.onclick = async () => { if (!confirm("Tolak nama ini? Shift yang memakai nama ini tidak dihitung ke orang resmi mana pun.")) return;
    const { error } = await sb.from("personil").update({ status: "DITOLAK", aktif: false, updated_at: new Date().toISOString(), updated_by: session.user.id }).eq("id", b.dataset.tl); if (error) return alert(error.message); ulang(); }));
  box.querySelectorAll("[data-gt]").forEach((s) => (s.onchange = async () => { if (!s.value) return; const ke = s.options[s.selectedIndex].text;
    if (!confirm(`Gabungkan "${us.find((p) => p.id === s.dataset.gt)?.nama}" ke ${ke}? Semua shift dengan ejaan itu dihitung untuk ${ke}.`)) return (s.value = "");
    const { error } = await sb.rpc("admin_gabung_personil", { p_dari: s.dataset.gt, p_ke: s.value }); if (error) return alert(error.message); ulang(); }));
}
// Keluarkan operator dari rekap (admin): sama dengan Hapus akun (data tetap tersimpan bila sudah ada).
function keluarkanOperator(uid, nama) { return hapusAkun(uid, nama); }
// Hapus kiriman (admin) dari Folder operator: data dipindah ke arsip (deleted_record) dan bisa dipulihkan.
const hapusJenis = (j) => ({ PROGRES: ["h", "drill_event"], P2H: ["h", "p2h_check"], DDR: ["h", "ddr"], "FORM LOGGING": ["d", "scan_job"], "FOTO CORE": ["d", "core_photo"] })[j] ?? (j?.startsWith("ARSIP ") ? ["h", "form_photo"] : null);
function hapusKiriman(items) {
  return new Promise((selesai) => {
    const ada = (j) => items.some((i) => i.jenis === j);
    const m = modal(`<h3 style="color:#B3261E">Hapus ${items.length} data?</h3>
      <p><b>Apakah Anda yakin ingin menghapus data ini?</b></p>
      <ul style="max-height:180px;overflow:auto;margin:0 0 8px;padding-left:18px">${items.map((i) => `<li>${esc(i.label)}</li>`).join("")}</ul>
      <p class="muted">Data dipindah ke <b>Database → Arsip terhapus (admin)</b> dan masih bisa dipulihkan dari sana. Rekap kepatuhan operator ikut berubah.${ada("PROGRES") ? " Menghapus foto progres <b>Masuk/Keluar shift</b> juga menghapus daftar personil (absensi & jam kerja) shift itu." : ""}${ada("DDR") ? " Menghapus DDR juga menghapus tanda tangannya." : ""}</p>
      <label>Alasan penghapusan (wajib)</label><textarea id="hal" rows="2" placeholder="mis. data uji coba / foto dobel / salah lubang"></textarea>
      <p class="err" id="her"></p>
      <div class="row"><button class="sec" id="hbt">Batal</button><button id="hok" style="background:#B3261E">Ya, hapus</button></div>`);
    const tutup = (v) => { m.remove(); selesai(v); };
    m.querySelector("#hbt").onclick = () => tutup(false);
    m.querySelector("#hok").onclick = async () => {
      const alasan = m.querySelector("#hal").value.trim(), er = m.querySelector("#her"), b = m.querySelector("#hok");
      if (!alasan) return (er.textContent = "Alasan wajib diisi.");
      if (!online()) return (er.textContent = "Perlu sinyal internet.");
      b.disabled = true; let ok = 0; const gagal = [];
      for (const it of items) {
        const [cara, tabel] = hapusJenis(it.jenis);
        b.textContent = `Menghapus ${ok + gagal.length + 1}/${items.length}…`;
        const { error } = cara === "h" ? await sb.rpc("admin_hapus_data", { p_table: tabel, p_id: it.id, p_alasan: alasan })
          : await sb.rpc("admin_delete", { p_table: tabel, p_key: it.id, p_reason: alasan });
        if (error) gagal.push(`${it.label}: ${error.message}`); else ok++;
      }
      if (gagal.length) { er.innerHTML = `${ok} terhapus, ${gagal.length} gagal:<br>${gagal.map(esc).join("<br>")}`; b.textContent = "Tutup"; b.disabled = false; b.onclick = () => tutup(ok > 0); return; }
      tutup(true);
    };
  });
}
async function folderView(v, uid, nama) {
  const admin = me?.role === "admin";
  const to = sessionStorage.getItem("rekapTgl") || todayWIB(), from = new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
  v.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Folder: ${esc(nama || "-")}</h2><button class="sec" id="bk" style="flex:0">← Rekap</button></div>
    <div class="row" style="align-items:flex-end;flex-wrap:wrap"><div><label>Dari</label><input id="ff" type="date" value="${from}"></div><div><label>Sampai</label><input id="ft" type="date" value="${to}"></div>
    <div><label>Jenis</label><select id="fj"><option value="">Semua</option>${["PROGRES", "P2H", "DDR", "TTD DDR", "FORM LOGGING", "FOTO CORE", "ARSIP DDR", "ARSIP P2H", "ARSIP DRILL_LOG_LAMA", "ARSIP SURVEY", "ARSIP LAINNYA"].map((j) => `<option>${j}</option>`).join("")}</select></div><button id="fg" style="flex:0">Tampilkan</button></div></div>
    <div class="card" id="fl">Memuat…</div>`;
  $("#bk").onclick = () => rekapView(v);
  const load = async () => {
    let q = sb.from("v_upload_item").select("*").eq("user_id", uid).gte("waktu", `${$("#ff").value}T00:00:00+07:00`).lte("waktu", `${$("#ft").value}T23:59:59+07:00`).order("waktu", { ascending: false }).limit(1000);
    if ($("#fj").value) q = q.eq("jenis", $("#fj").value);
    const { data, error } = await q; if (error) return ($("#fl").innerHTML = `<p class="err">${esc(error.message)}</p>`);
    const byDay = {}; for (const r of data ?? []) (byDay[fmtT(r.waktu).slice(0, 10)] ??= []).push(r);
    const tot = Object.entries((data ?? []).reduce((m, r) => ((m[r.jenis] = (m[r.jenis] ?? 0) + 1), m), {}));
    $("#fl").innerHTML = `<p><b>${(data ?? []).length}</b> kiriman · ${tot.map(([k, n]) => `${esc(k)} ${n}`).join(" · ") || "-"}</p>` + (Object.entries(byDay).map(([d, rs]) => `<h3 style="margin:12px 0 4px">${d} <span class="muted">(${rs.length})</span></h3><ul class="list">${rs.map((r) => `<li style="flex-wrap:wrap"><span style="flex:1">${fmtT(r.waktu).slice(-8)} · <b>${esc(r.jenis)}</b> ${esc(r.rig ?? "")} ${esc(r.bhid ?? "")}${r.status ? ` <span class="pill ${esc(r.status)}">${esc(r.status)}</span>` : ""}<br><span class="muted">${esc(r.ket ?? "")}</span></span>${r.photo_path && r.bucket ? `<button class="sec" data-b="${esc(r.bucket)}" data-p="${esc(r.photo_path)}" style="flex:0">Lihat</button>` : r.jenis === "DDR" || r.jenis === "TTD DDR" ? `<button class="sec" data-ddr="${r.ref_id}" style="flex:0">DDR</button>` : ""}${admin && hapusJenis(r.jenis) ? `<button class="sec" data-hx="${esc(r.ref_id)}" data-hj="${esc(r.jenis)}" style="flex:0;color:#B3261E;border-color:#B3261E">Hapus</button><label style="flex:0;margin:0" title="Pilih untuk hapus sekaligus"><input type="checkbox" data-hc="${esc(r.ref_id)}" data-hj="${esc(r.jenis)}" data-hk="${esc(`${fmtT(r.waktu)} · ${r.jenis} ${r.rig ?? ""} ${r.bhid ?? ""}`)}" style="width:auto"></label>` : ""}</li>`).join("")}</ul>`).join("") || `<p class="muted">Tidak ada kiriman pada periode ini.</p>`);
    $("#fl").querySelectorAll("[data-p]").forEach((b) => (b.onclick = async () => { bukaFile(b.dataset.b, b.dataset.p); }));
    $("#fl").querySelectorAll("[data-ddr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.ddr)));
    if (!admin) return;
    const ket = (id) => (data ?? []).find((r) => String(r.ref_id) === id);
    $("#fl").querySelectorAll("[data-hx]").forEach((b) => (b.onclick = async () => { const r = ket(b.dataset.hx);
      if (await hapusKiriman([{ id: b.dataset.hx, jenis: b.dataset.hj, label: `${fmtT(r.waktu)} · ${r.jenis} ${r.rig ?? ""} ${r.bhid ?? ""} — ${r.ket ?? ""}` }])) load(); }));
    const cek = () => { const n = $("#fl").querySelectorAll("[data-hc]:checked").length; $("#hsel").disabled = !n; $("#hsel").textContent = `Hapus terpilih (${n})`; };
    $("#fl").insertAdjacentHTML("afterbegin", `<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:6px"><button class="sec" id="hall" style="flex:0;white-space:nowrap">Pilih semua</button><button id="hsel" disabled style="flex:0;white-space:nowrap;background:#B3261E">Hapus terpilih (0)</button></div>`);
    $("#fl").querySelectorAll("[data-hc]").forEach((c) => (c.onchange = cek));
    $("#hall").onclick = () => { const cs = [...$("#fl").querySelectorAll("[data-hc]")], semua = cs.every((c) => c.checked); cs.forEach((c) => (c.checked = !semua)); cek(); };
    $("#hsel").onclick = async () => { const its = [...$("#fl").querySelectorAll("[data-hc]:checked")].map((c) => ({ id: c.dataset.hc, jenis: c.dataset.hj, label: c.dataset.hk }));
      if (its.length && (await hapusKiriman(its))) load(); };
  };
  $("#fg").onclick = load; load();
}

// ---------- Dokumen: formulir kosong, SOP, panduan ----------
const DOK_CACHE = "tgep-dokumen";
const hexToBytes = (h) => { h = h.startsWith("\\x") ? h.slice(2) : h; const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; };
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
async function dokBlob(d) {
  const stamp = String(Date.parse(d.uploaded_at) || 0), key = `./_dok/${d.id}/${stamp}/${encodeURIComponent(d.file_name)}`, c = await caches.open(DOK_CACHE);
  const hit = await c.match(key); if (hit) return hit.blob();
  for (const k of await c.keys()) if (k.url.includes(`/_dok/${d.id}/`)) await c.delete(k); // versi lama di HP dibuang
  if (!online()) throw new Error("Dokumen belum tersimpan di HP; buka sekali saat ada sinyal.");
  let blob;
  if (d.url) { const r = await fetch(d.url, { cache: "no-store" }); if (!r.ok) throw new Error("Gagal mengunduh " + d.file_name); blob = await r.blob(); }
  else if (d.storage_path) { const { data, error } = await sb.storage.from("dokumen").download(d.storage_path); if (error) throw error; blob = data; }
  else { const { data, error } = await sb.from("document").select("content").eq("id", d.id).single(); if (error) throw error; blob = new Blob([hexToBytes(data.content)], { type: d.mime }); }
  await c.put(key, new Response(blob, { headers: { "Content-Type": d.mime } }));
  return blob;
}
async function dokView(v) {
  const list = await cached("dokList", async () => (await sb.from("document").select("id,judul,kategori,keterangan,versi,file_name,mime,size_bytes,url,storage_path,untuk_peran,aktif,uploaded_at").order("kategori").order("judul")).data);
  const c = await caches.open(DOK_CACHE), have = new Set((await c.keys()).map((r) => new URL(r.url).pathname.split("/_dok/")[1]?.split("/").slice(0, 2).join("/")));
  const KAT = { FORMULIR: "Formulir kosong untuk dicetak", SOP: "SOP", PANDUAN: "Panduan aplikasi", LAINNYA: "Lainnya" };
  const admin = me?.role === "admin";
  v.innerHTML = `<div class="card"><h2>Dokumen</h2><p class="muted">Unduh formulir kosong untuk dicetak, SOP, dan panduan aplikasi. Dokumen yang sudah dibuka sekali tersimpan di HP dan bisa dibuka lagi tanpa sinyal.</p></div>
    ${Object.keys(KAT).map((k) => { const xs = list.filter((d) => d.kategori === k && (d.aktif || admin)); if (!xs.length) return k === "SOP" ? `<div class="card"><h3>SOP</h3><p class="muted">Belum ada file SOP. ${admin ? "Unggah PDF SOP lewat formulir di bawah." : "Hubungi admin."}</p></div>` : "";
      return `<div class="card"><h3>${KAT[k]}</h3><ul class="list">${xs.map((d) => `<li style="flex-wrap:wrap"><span style="flex:1"><b>${esc(d.judul)}</b> ${d.versi ? `<span class="muted">${esc(d.versi)}</span>` : ""}${d.aktif ? "" : ` <span class="err">(nonaktif)</span>`}<br><span class="muted">${esc(d.keterangan ?? "")} · ${fmtSize(d.size_bytes)}${have.has(`${d.id}/${Date.parse(d.uploaded_at) || 0}`) ? " · tersimpan di HP ✓" : ""}${admin ? ` · untuk: ${esc(d.untuk_peran.join(", "))}` : ""}</span></span>
        <button data-op="${d.id}" style="flex:0;white-space:nowrap">Buka</button><button class="sec" data-dl="${d.id}" style="flex:0;white-space:nowrap">Unduh</button>${admin ? `<button class="sec" data-rp="${d.id}" style="flex:0;white-space:nowrap">Ganti file</button><button class="sec" data-tg="${d.id}" style="flex:0">${d.aktif ? "Nonaktifkan" : "Aktifkan"}</button>` : ""}</li>`).join("")}</ul></div>`; }).join("")}
    ${admin ? `<div class="card"><h3>Unggah dokumen (admin)</h3>
      <label>File (PDF, Word, Excel; maks. 50 MB)</label><input id="uf" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx">
      <div class="row"><div><label>Judul *</label><input id="uj"></div><div style="flex:.6"><label>Kategori</label><select id="uk"><option>SOP</option><option>FORMULIR</option><option>PANDUAN</option><option>LAINNYA</option></select></div><div style="flex:.4"><label>Versi</label><input id="uv" placeholder="v1"></div></div>
      <label>Keterangan</label><input id="uket">
      <label>Boleh diunduh oleh</label><div class="row">${["driller", "geologist", "verifier", "admin", "client", "admin_lapangan"].map((r) => `<label style="flex:0;white-space:nowrap"><input type="checkbox" value="${r}" class="ur" ${r !== "driller" && r !== "admin_lapangan" ? "checked" : ""}> ${r}</label>`).join("")}</div>
      <p class="muted">Dokumen yang diunggah di sini disimpan di database (privat) dan hanya bisa diunduh akun yang disetujui sesuai peran yang dicentang. Versi lama sebaiknya dinonaktifkan, bukan dihapus.</p>
      <button id="ub">Unggah</button><div id="ue" class="err"></div></div>` : ""}`;
  const get = (id) => list.find((d) => d.id === id);
  v.querySelectorAll("[data-op]").forEach((b) => (b.onclick = async () => {
    const w = window.open("", "_blank");
    try { const u = URL.createObjectURL(await dokBlob(get(b.dataset.op))); if (w) w.location = u; else location.href = u; } catch (e) { w?.close(); alert(e.message); }
  }));
  v.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = async () => {
    try { const d = get(b.dataset.dl), a = document.createElement("a"); a.href = URL.createObjectURL(await dokBlob(d)); a.download = d.file_name; document.body.appendChild(a); a.click(); a.remove(); render(); } catch (e) { alert(e.message); }
  }));
  const toStore = async (f) => { const p = `${Date.now()}_${f.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`; const { error } = await sb.storage.from("dokumen").upload(p, f, { contentType: f.type || "application/octet-stream" }); if (error) throw error; return p; };
  const toHex = async (f) => { const bytes = new Uint8Array(await f.arrayBuffer()); let hex = "\\x"; for (let i = 0; i < bytes.length; i += 32768) hex += Array.from(bytes.subarray(i, i + 32768), (x) => x.toString(16).padStart(2, "0")).join(""); return hex; };
  v.querySelectorAll("[data-rp]").forEach((b) => (b.onclick = () => {
    const d = get(b.dataset.rp), inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      if (!online()) return alert("Mengganti file perlu sinyal.");
      if (f.size > 50 * 1048576) return alert("File lebih dari 50 MB.");
      const versi = prompt(`Versi baru untuk "${d.judul}" (sebelumnya ${d.versi ?? "-"}):`, d.versi ?? ""); if (versi === null) return;
      b.disabled = true; b.textContent = "Mengunggah…";
      let sp; try { sp = await toStore(f); } catch (e) { b.disabled = false; b.textContent = "Ganti file"; return alert(e.message); }
      const { error } = await sb.from("document").update({ storage_path: sp, content: null, url: null, file_name: f.name, mime: f.type || "application/octet-stream", size_bytes: f.size, versi: versi.trim() || null, uploaded_at: new Date().toISOString(), aktif: true }).eq("id", d.id);
      if (error) { b.disabled = false; b.textContent = "Ganti file"; return alert(error.message); }
      const c = await caches.open(DOK_CACHE); for (const k of await c.keys()) if (k.url.includes(`/_dok/${d.id}/`)) await c.delete(k);
      localStorage.removeItem("dokList"); render();
    };
    inp.click();
  }));
  v.querySelectorAll("[data-tg]").forEach((b) => (b.onclick = async () => {
    const d = get(b.dataset.tg); const { error } = await sb.from("document").update({ aktif: !d.aktif }).eq("id", d.id);
    if (error) return alert(error.message); localStorage.removeItem("dokList"); render();
  }));
  if (admin) $("#ub").onclick = async () => {
    const f = $("#uf").files[0], judul = $("#uj").value.trim(), peran = [...v.querySelectorAll(".ur:checked")].map((x) => x.value);
    if (!online()) return ($("#ue").textContent = "Unggah perlu sinyal.");
    if (!f || !judul) return ($("#ue").textContent = "Pilih file dan isi judul.");
    if (f.size > 50 * 1048576) return ($("#ue").textContent = "File lebih dari 50 MB.");
    if (!peran.length) return ($("#ue").textContent = "Centang minimal satu peran.");
    $("#ub").disabled = true; $("#ue").textContent = "Mengunggah…";
    let sp; try { sp = await toStore(f); } catch (e) { $("#ub").disabled = false; return ($("#ue").textContent = e.message); }
    const { error } = await sb.from("document").insert({ storage_path: sp, judul, kategori: $("#uk").value, versi: $("#uv").value.trim() || null, keterangan: $("#uket").value.trim() || null,
      file_name: f.name, mime: f.type || "application/octet-stream", size_bytes: f.size, untuk_peran: peran });
    $("#ub").disabled = false;
    if (error) return ($("#ue").textContent = error.message);
    localStorage.removeItem("dokList"); render();
  };
}

// ---------- hapus (admin) dengan arsip ----------
async function adminDelete(table, key, label) {
  const reason = prompt(`Hapus ${label} ${key}?\nData dipindah ke arsip dan bisa dipulihkan admin.\n\nAlasan (wajib):`);
  if (!reason) return false;
  const { error } = await sb.rpc("admin_delete", { p_table: table, p_key: key, p_reason: reason });
  if (error) { alert(error.message); return false; }
  return true;
}

// ---------- halaman Database (laptop kantor) ----------
const DATASETS = {
  collar: { t: "Collar (lubang bor)", v: "v_dh_collar", order: ["holeid"], bh: "holeid", bad: ["chk_borehole"] },
  survey: { t: "Survey", v: "v_dh_survey", order: ["holeid", "depth"], bh: "holeid" },
  geology: { t: "Geologi + recovery", v: "v_dh_geology", order: ["holeid", "from"], bh: "holeid", bad: ["chk_interval", "chk_recovery", "chk_lith", "chk_code", "chk_zone"], del: ["sample", "sample_no"] },
  density: { t: "Density", v: "v_dh_density", order: ["holeid", "from"], bh: "holeid", bad: ["chk_density", "chk_arch"] },
  assay: { t: "Assay (hasil lab)", v: "v_dh_assay", order: ["holeid", "from"], bh: "holeid" },
  qaqc: { t: "QAQC (blank, CRM, duplikat)", v: "v_dh_qaqc", order: ["dispatch_id", "seq_in_batch"], bh: null },
  foto: { t: "Kelengkapan foto core", v: "v_sample_photo", order: ["bhid", "depth_from"], bh: "bhid", bad: ["chk_foto_utuh", "chk_foto_belah"] },
  progres: { t: "Progres harian bor", v: "v_drill_progress_daily", order: ["tanggal", "rig"], bh: "bhid", bad: ["chk_harian"] },
  aktivitas: { t: "Log aktivitas bor (foto bergeotag)", v: "v_drill_event_qc", order: ["captured_at"], bh: "bhid", bad: ["flags"] },
  p2h: { t: "P2H rig", v: "p2h_check", order: ["captured_at"], bh: null },
  ddr: { t: "DDR", v: "v_ddr_list", order: ["report_date", "rig"], bh: "bhid" },
  rekapddr: { t: "Rekap DDR (meter, jam, BBM per DDR)", v: "fix_ddr", sel: "ddr_id,report_date,shift,rig,holeid,ddr_status,coring_ddr_m,open_hole_m,meter_ddr,core_ddr_m,recovery_pct,jam_ddr,standby_menit,bbm_liter,oli_liter,bbm_per_meter_ddr,crew_count,driller_name,ttd", order: ["report_date", "rig"], bh: "holeid" },
  ddrlubang: { t: "DDR per lubang (interval coring/open hole)", v: "v_ddr_baris", order: ["tanggal", "rig", "bhid", "dari_m"], bh: "bhid" },
  jam: { t: "Distribusi jam DDR", v: "v_ddr_hours", order: ["tanggal", "rig"], bh: "bhid" },
  bbm: { t: "Pemakaian BBM, oli & barang", v: "v_consumable_use", order: ["report_date", "rig"], bh: "bhid" },
  lubang: { t: "Ringkasan per lubang", v: "v_dash_hole", order: ["bhid"], bh: "bhid" },
  kinerja: { t: "Kinerja rig harian", v: "v_dash_rig_day", order: ["tanggal", "rig"], bh: null },
  arsipfoto: { t: "Foto formulir arsip", v: "form_photo", order: ["created_at"], bh: "bhid" },
  kepatuhan: { t: "Rekap operator harian", v: "v_kepatuhan_harian", order: ["tanggal", "nama"], bh: null },
  logging: { t: "Status Form Logging per lubang", v: "v_logging_lubang", order: ["bhid"], bh: "bhid" },
  koreksi: { t: "Riwayat koreksi", v: "sample_edit_log", order: ["edited_at"], bh: null },
  preparasi: { t: "Sample dikirim ke preparasi", v: "v_kirim_preparasi", order: ["tanggal", "no_kirim", "urut"], bh: "bhid" },
  belumkirim: { t: "Sample belum dikirim ke preparasi", v: "v_sample_belum_kirim", order: ["bhid", "depth_from"], bh: "bhid" },
  profil: { t: "Profil bor (ketebalan zona per lubang)", v: "v_profil_bor", order: ["bhid", "dari_m"], bh: "bhid" },
  marking: { t: "Marking koordinat (semua pembacaan + akurasi)", v: "v_survey_marking", order: ["tanggal", "bhid", "ke"], bh: "bhid" },
  corefile: { t: "Foto core (file)", v: "core_photo", sel: "id,bhid,box_no,depth_from,depth_to,photo_type,photo_path,status,sop_ok,ditolak,alasan_tolak,captured_at,created_at,project", order: ["bhid", "depth_from"], bh: "bhid" },
  scanfile: { t: "Scan Form Logging (file)", v: "scan_job", sel: "id,form_type,bhid_hint,page_no,status,photo_path,sumber,file_name,captured_at,created_at,reviewed_at,review_note,project", order: ["created_at"], bh: "bhid_hint" },
  arsip: { t: "Arsip terhapus (admin)", v: "deleted_record", order: ["deleted_at"], bh: "bhid", admin: true },
};
// Kolom berisi file → tempat penyimpanan (bucket). Di tabel tampil tombol “Buka”; di Excel/CSV ada kolom *_link (link permanen, perlu login).
const FILE_COL = { aktivitas: { photo_path: "progress-photos" }, p2h: { photo_path: "progress-photos" }, arsipfoto: { photo_path: "scan-photos" }, corefile: { photo_path: "core-photos" }, scanfile: { photo_path: "scan-photos" } };
const linkFile = (bucket, path) => new URL("./", location.href).href + "#buka=" + encodeURIComponent(bucket) + ":" + encodeURIComponent(path);
const tambahLink = async (k, rows) => { const fc = FILE_COL[k]; if (!fc) return rows; const DV = await petaDrive(rows, fc);
  return rows.map((r) => { const o = { ...r }; for (const [c, b] of Object.entries(fc)) if (r[c]) { o[c + "_link"] = linkFile(b, r[c]); if (!isClient()) o[c + "_drive"] = DV[b + ":" + r[c]] ?? ""; } return o; }); };
// Buka file: dari server bila masih ada; bila file asli sudah dipindah ke Google Drive (dihapus dari server setelah 1 hari), buka salinan Drive.
async function linkDrive(bucket, path) {
  if (isClient()) return null;
  const { data } = await sb.from("drive_file").select("drive_url").eq("bucket", bucket).eq("path", path).maybeSingle();
  return data?.drive_url ?? null;
}
async function bukaFile(bucket, path) {
  const w = window.open("", "_blank"); const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
  const url = data?.signedUrl ?? (await linkDrive(bucket, path));
  if (!url) { w?.close(); return alert("File tidak bisa dibuka: " + (error?.message ?? "tidak ditemukan / tidak punya akses")); }
  if (w) w.location = url; else location.href = url;
}
// Salinan Google Drive (diisi Apps Script "X-Terra Sinkron Drive"): peta bucket:path -> link Drive
async function petaDrive(rows, fc) {
  const paths = [...new Set(rows.flatMap((r) => Object.keys(fc).map((c) => r[c]).filter(Boolean)))];
  if (!paths.length || isClient()) return {};
  const M = {};
  for (let i = 0; i < paths.length; i += 150) {
    const { data } = await sb.from("drive_file").select("bucket,path,drive_url").in("path", paths.slice(i, i + 150));
    for (const d of data ?? []) M[d.bucket + ":" + d.path] = d.drive_url;
  }
  return M;
}
const OKV = new Set(["OK", "OK-SW", "MENUNGGU LAB", "MENUNGGU CEK"]);
// Lubang yang sudah di-REDRILL: { lubang lama: lubang redrill } dari lubang_asal di DDR / progres bor + Hole ID berakhiran R
async function petaRedrill() {
  if (!online()) return JSON.parse(localStorage.getItem("petaRedrill") || "{}");
  const [{ data: D }, { data: E }, { data: V }] = await Promise.all([sb.from("ddr").select("bhid,lubang_asal").not("lubang_asal", "is", null),
    sb.from("drill_event").select("bhid,lubang_asal").not("lubang_asal", "is", null), sb.from("v_ddr_baris").select("bhid").ilike("bhid", "%R").limit(5000)]);
  const P = {}; for (const x of [...(D ?? []), ...(E ?? [])]) if (x.lubang_asal && x.bhid && bakuBH(x.lubang_asal) !== x.bhid) P[bakuBH(x.lubang_asal)] = x.bhid;
  for (const x of V ?? []) { const a = asalRedrill(x.bhid); if (a && !P[a]) P[a] = x.bhid; }
  localStorage.setItem("petaRedrill", JSON.stringify(P)); return P;
}
// Tabel geologi/lubang: lubang lama yang sudah di-redrill dipisah ke "arsip"; data operasional (DDR, progres, BBM, kinerja) tetap utuh karena meter memang dibor
const GEO_V = new Set(["v_dh_collar", "v_dh_survey", "v_dh_geology", "v_dh_density", "v_dh_assay", "v_sample_photo", "v_dash_hole", "v_profil_bor", "v_logging_lubang", "v_sample_belum_kirim", "v_kirim_preparasi", "core_photo", "scan_job", "v_survey_marking"]);
const RIG_V = new Set(["fix_ddr", "form_photo", "p2h_check", "v_consumable_use", "v_dash_rig_day", "v_ddr_baris", "v_ddr_hours", "v_ddr_list", "v_drill_event_qc", "v_drill_progress_daily", "v_kepatuhan_harian", "v_logging_lubang", "v_survey_marking"]);
function dbQuery(d, f) {
  let q = sb.from(d.v).select(d.sel ?? "*", { count: "exact" });
  if (f.bh && d.bh) q = q.ilike(d.bh, `%${f.bh}%`);
  if (f.rd && d.bh && GEO_V.has(d.v)) { const L = Object.keys(f.rd);
    if (f.lub === "arsip") q = q.in(d.bh, L.length ? L : ["-"]); else if (f.lub !== "semua" && L.length) q = q.not(d.bh, "in", `(${L.map((x) => `"${x.replace(/"/g, "")}"`).join(",")})`); }
  if (f.rig) { if (RIG_V.has(d.v)) q = q.eq("rig", f.rig); else if (d.bh) q = q.in(d.bh, f.rigBH?.length ? f.rigBH : ["-"]); }
  if (f.proj) { if (d.bh) q = q.in(d.bh, f.proj.bhids.length ? f.proj.bhids : ["-"]); else if (["v_dash_rig_day", "p2h_check", "v_kepatuhan_harian"].includes(d.v)) q = q.in("rig", f.proj.rigs.length ? f.proj.rigs : ["-"]); }
  if (f.bad && d.bad && ["chk_harian", "flags"].includes(d.bad[0])) q = q.neq(d.bad[0], "");
  else if (f.bad && d.bad) q = q.or(d.bad.map((c) => `and(${c}.not.is.null,${c}.not.in.(${[...OKV].map((x) => `"${x}"`).join(",")}))`).join(","));
  const desc = ["v_survey_marking", "v_kepatuhan_harian", "deleted_record", "sample_edit_log", "v_drill_progress_daily", "v_drill_event_qc", "p2h_check", "form_photo", "v_ddr_list", "fix_ddr", "v_ddr_baris", "v_ddr_hours", "v_consumable_use", "v_dash_rig_day", "scan_job"].includes(d.v);
  for (const o of d.order) q = q.order(o, { ascending: d.v === "v_survey_marking" ? o !== "tanggal" : !desc }); // marking: tanggal terbaru dulu, pembacaan ke-1,2,3 berurutan
  return q;
}
async function fetchAll(d, f) {
  const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await dbQuery(d, f).range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return tanpaBBM(out); }
}
// ---------- Database FIX (hanya data final) untuk Microsoft Access ----------
// v.23: semua data (logging & DDR draf ikut, dibedakan kolom status). Satu sheet = satu tabel Access.
const FIX = [
  ["collar", "holeid", "", "Collar lubang yang punya data final; status_lubang LENGKAP bila semua sampel final & bor selesai", "holeid,east,north,rl,depth,coord_source,area,prospect,grid,start_date,stop_date,core_size,sample_type,purpose,spacing,depth_tp,depth_l,depth_s,n_sample_final,n_sample_belum,status_lubang,n_sample"],
  ["survey", "holeid, depth", "holeid → collar", "Survey arah lubang (vertikal)", "holeid,depth,azimuth,dip"],
  ["geology", "sample_no", "holeid → collar", "Logging geologi per interval — semua conto tersimpan (kolom status_data: DISETUJUI / BELUM DIPERIKSA / VERIFIED)", "holeid,depth_from,depth_to,sample_no,sample_id,zone,lith1,lith1_pct,lith2,lith2_pct,colour,hardness,weathering,serpentinisation,silica_pct,garnierite_pct,min1,min1_pct,min2,min2_pct,core_length,recovery_pct,loss_from,loss_to,sample_wt_kg,comment,status_data,tgl_verifikasi"],
  ["density", "sample_no", "sample_no → geology", "Density (caliper & Archimedes) semua conto", "holeid,depth_from,depth_to,sample_no,zone,len_cm,diam_cm,wet_wt_g,dry_wt_g,vol_caliper_ml,vol_arch_ml,wet_density,dry_density,wet_density_arch,dry_density_arch,moisture_pct,arch_diff_pct"],
  ["assay", "lab_sample_id", "sample_no → geology", "Assay conto primer (hasil lab)", "holeid,depth_from,depth_to,sample_no,lab_sample_id,ni,co,fe,mgo,sio2,al2o3,cr2o3,cao,mno,loi,lab_job_no,method,date_reported"],
  ["qaqc", "lab_sample_id", "", "Hasil QAQC lab (CRM, blank, duplikat)", "dispatch_id,seq_in_batch,lab_sample_id,qc_type,source_sample_no,crm_id,ni_cert_pct,ni_sd_pct,ni,co,fe,crm_z,lab_job_no,date_reported"],
  ["ddr", "ddr_id", "", "Rekap DDR semua (DRAF & bertanda tangan): meter coring/open hole, jam, BBM, oli, TTD — kolom ddr_status", "ddr_id,report_date,shift,rig,holeid,project,location,client,driller_name,helpers,crew_count,crew_nama,hm_start,hm_end,weather,hole_type,rod_m,target_m,total_depth_m,rig_type,notes,ddr_status,coring_ddr_m,open_hole_m,meter_ddr,core_ddr_m,recovery_pct,jam_ddr_menit,jam_ddr,standby_menit,bbm_liter,oli_liter,bbm_per_meter_ddr,ttd"],
  ["ddr_jam", "", "ddr_id → ddr", "Distribusi jam semua DDR (kolom ddr_status)", "ddr_id,tanggal,rig,shift,holeid,kategori,kelompok,mulai,selesai,menit,keterangan,ddr_status"],
  ["ddr_barang", "", "", "Pemakaian barang/consumable semua DDR (kolom ddr_status)", "report_date,rig,shift,holeid,kategori,item,unit,qty,note,ddr_status"],
  ["progres_harian", "", "", "Progres bor harian per rig/lubang dari foto bergeotag", "tanggal,rig,holeid,jam_masuk,jam_mulai_bor,jam_selesai_bor,jam_keluar,jumlah_run,meter_bor,core_terambil_m,recovery_pct,kedalaman_akhir,ganti_mata_bor,standby_menit,jam_kerja_bor,p2h_layak,p2h_item_tidak_ok,kejadian_bermasalah"],
  ["absensi", "", "", "Absensi personil per shift (Masuk/Keluar shift) — data penggajian", "tanggal,shift,rig,project,nama,nama_tertulis,id_karyawan,perusahaan,jabatan,jam_masuk,jam_keluar,durasi_jam,status,status_nama,alasan_masuk"],
  ["lookup", "list_name, code", "", "Daftar kode (zona, litologi, mineral, dll.)", "list_name,code,name,extra,sort"],
];
const keTanggal = (v) => { if (typeof v !== "string") return v; const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m || v.length > 26) return v; return m[4] ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : new Date(+m[1], m[2] - 1, +m[3]); };
async function unduhFix(info) {
  if (!online()) return alert("Perlu sinyal internet.");
  try {
    const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new(), skema = [];
    for (const [t, pk, fk, ket, cols] of FIX) {
      info.textContent = `Mengambil ${t}…`; const C = cols.split(","), rows = [];
      for (let i = 0; ; i += 1000) { const { data, error } = await sb.from("fix_" + t).select(cols).range(i, i + 999); if (error) throw new Error(`${t}: ${error.message}`);
        rows.push(...(data ?? [])); if (!data || data.length < 1000) break; }
      const aoa = [C, ...rows.map((r) => C.map((c) => (r[c] === null || r[c] === undefined ? null : keTanggal(r[c]))))];
      const ws = X.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: "yyyy-mm-dd hh:mm" }); X.utils.book_append_sheet(wb, ws, t);
      skema.push({ tabel: t, kunci_utama: pk, relasi: fk, jumlah_baris: rows.length, keterangan: ket });
    }
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(skema), "_skema");
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["TGEP — Database gabungan (semua data tersimpan)"], [`Diunduh ${new Date().toLocaleString("id-ID")} oleh ${me?.full_name ?? ""}`],
      ["Semua conto logging & semua DDR ikut. Bedakan dengan kolom status_data (geology) dan ddr_status (ddr, ddr_jam, ddr_barang): DRAFT = belum ditandatangani; SIGNED = bertanda tangan."],
      ["Impor ke Access: unduh 'Macro impor Access' (TGEP_Impor_Access.bas) dari aplikasi, di Access tekan Alt+F11 > File > Import File > pilih .bas, lalu jalankan ImporTGEP (F5)."],
      ["Tanpa macro: Access > External Data > New Data Source > From File > Excel > pilih sheet satu per satu (baris pertama = nama kolom)."]]), "_info");
    X.writeFile(wb, `TGEP_Database_FIX_${todayWIB()}.xlsx`, { cellDates: true });
    info.textContent = `Database FIX diunduh: ${skema.map((x) => `${x.tabel} ${x.jumlah_baris}`).join(" · ")}`;
  } catch (e) { info.textContent = "Gagal: " + e.message; }
}
function unduhMacroAccess() {
  const T = FIX.map((x) => `"${x[0]}"`).join(", "), q = (sql) => `    msg = msg & Jalankan(db, "${sql}")`;
  const L = ["Attribute VB_Name = \"TGEP_Impor\"", "Option Compare Database", "Option Explicit", "",
    "' Impor Database FIX TGEP (file TGEP_Database_FIX_yyyy-mm-dd.xlsx dari aplikasi) ke database Access ini.",
    "' Pakai: Alt+F11 > File > Import File > pilih file ini, klik di dalam ImporTGEP lalu tekan F5.",
    "' Tabel lama dengan nama yang sama diganti isinya (impor ulang aman). Kunci utama & relasi dibuat ulang.", "",
    "Public Function ImporTGEP()", "    Dim fd As Object, path As String, t As Variant, db As DAO.Database, msg As String, i As Integer",
    "    Set fd = Application.FileDialog(3)", "    fd.Title = \"Pilih file TGEP_Database_FIX_....xlsx\"", "    fd.Filters.Clear", "    fd.Filters.Add \"Excel\", \"*.xlsx\"",
    "    If fd.Show = 0 Then Exit Function", "    path = fd.SelectedItems(1)", "    Set db = CurrentDb",
    "    For i = db.Relations.Count - 1 To 0 Step -1", "        If Left(db.Relations(i).Name, 3) = \"fk_\" Then db.Relations.Delete db.Relations(i).Name", "    Next i",
    `    For Each t In Array(${T})`, "        On Error Resume Next", "        DoCmd.DeleteObject acTable, t", "        Err.Clear", "        On Error GoTo 0",
    "        DoCmd.TransferSpreadsheet acImport, acSpreadsheetTypeExcel12Xml, t, path, True, t & \"!\"", "    Next t",
    q("ALTER TABLE collar ADD CONSTRAINT pk_collar PRIMARY KEY (holeid)"), q("ALTER TABLE geology ADD CONSTRAINT pk_geology PRIMARY KEY (sample_no)"),
    q("ALTER TABLE density ADD CONSTRAINT pk_density PRIMARY KEY (sample_no)"), q("ALTER TABLE assay ADD CONSTRAINT pk_assay PRIMARY KEY (lab_sample_id)"),
    q("ALTER TABLE qaqc ADD CONSTRAINT pk_qaqc PRIMARY KEY (lab_sample_id)"), q("ALTER TABLE ddr ADD CONSTRAINT pk_ddr PRIMARY KEY (ddr_id)"),
    q("ALTER TABLE survey ADD CONSTRAINT pk_survey PRIMARY KEY (holeid, depth)"), q("ALTER TABLE lookup ADD CONSTRAINT pk_lookup PRIMARY KEY (list_name, code)"),
    q("ALTER TABLE survey ADD CONSTRAINT fk_survey_collar FOREIGN KEY (holeid) REFERENCES collar (holeid)"),
    q("ALTER TABLE geology ADD CONSTRAINT fk_geology_collar FOREIGN KEY (holeid) REFERENCES collar (holeid)"),
    q("ALTER TABLE density ADD CONSTRAINT fk_density_geology FOREIGN KEY (sample_no) REFERENCES geology (sample_no)"),
    q("ALTER TABLE assay ADD CONSTRAINT fk_assay_geology FOREIGN KEY (sample_no) REFERENCES geology (sample_no)"),
    q("ALTER TABLE ddr_jam ADD CONSTRAINT fk_ddrjam_ddr FOREIGN KEY (ddr_id) REFERENCES ddr (ddr_id)"),
    "    MsgBox \"Impor TGEP selesai: 12 tabel.\" & IIf(msg = \"\", \"\", vbCrLf & vbCrLf & \"Catatan:\" & vbCrLf & msg), vbInformation", "End Function", "",
    "Private Function Jalankan(db As DAO.Database, sql As String) As String", "    On Error Resume Next", "    db.Execute sql, dbFailOnError",
    "    If Err.Number <> 0 Then Jalankan = \"- \" & sql & \" : \" & Err.Description & vbCrLf", "End Function", ""];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/plain" })); a.download = "TGEP_Impor_Access.bas"; a.click();
}
// ---------- Peta: citra satelit + relief DEMNAS 3D + batas IUP + lubang bor ----------
// UTM <-> geografis (WGS84), zona 51 selatan (EPSG:32751)
// Konversi UTM WGS 84 untuk zona tertentu (bawaan 51 Selatan = lokasi TGEP); ekspor peta memilih zona dari lokasi yang ditampilkan
function buatUTM(zona = 51, selatan = true) { const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), lon0 = (zona * 6 - 183) * Math.PI / 180, N0 = selatan ? 10000000 : 0, E0 = 500000;
  const M = (p) => a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const ke = (lon, lat) => { const p = lat * Math.PI / 180, l = lon * Math.PI / 180 - lon0, N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = Math.cos(p) * l;
    return [E0 + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120),
      N0 + k0 * (M(p) + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720))]; };
  const dari = (x, y) => { const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2)), mu = (y - N0) / k0 / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
    const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2, R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = (x - E0) / (N1 * k0);
    const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
    return [lon * 180 / Math.PI, lat * 180 / Math.PI]; };
  return { ke, dari, zona, selatan }; }
const UTM = buatUTM(51, true);
const zonaUTMDari = (lon, lat) => ({ zona: Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1)), selatan: lat < 0 });
// Elevasi DEMNAS di satu titik: baca piksel tile terrain-RGB zoom 14 (sama dengan yang dipakai peta)
const demCache = {};
// ---------- Peta 3D bawah permukaan (three.js): topografi tembus pandang + lubang bor menembus ke bawah, bisa diputar ----------
const ren0MaxTex = () => { try { const c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl"); const m = gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? 4096; gl?.getExtension("WEBGL_lose_context")?.loseContext(); return m; } catch { return 4096; } };
async function bawahPermukaan3D(L, PRF = []) {
  const lay = document.createElement("div"); lay.id = "bp3";
  lay.style.cssText = "position:fixed;inset:0;z-index:9999;background:#0e1a15;display:flex;flex-direction:column;color:#fff;font:13px system-ui";
  const topoNow = localStorage.getItem("topo3d") || "redup";
  lay.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;background:#12251E">
    <b style="font-size:15px;margin-right:6px">Peta 3D bawah permukaan</b>
    <select id="bpT" style="flex:0 0 auto;width:auto;padding:4px">${[["redup", "Topo redup + blur"], ["sedang", "Topo sedang"], ["asli", "Topo asli"]].map(([k, l]) => `<option value="${k}" ${topoNow === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    <label style="margin:0;color:#cfe3d9">Tembus pandang <input id="bpO" type="range" min="0.1" max="1" step="0.05" value="${localStorage.getItem("bp3op") || 0.45}" style="width:90px;vertical-align:middle"></label>
    <label style="margin:0;color:#cfe3d9">Relief × <input id="bpV" type="range" min="1" max="4" step="0.5" value="1.5" style="width:70px;vertical-align:middle"><span id="bpVv">1,5</span></label>
    <label style="margin:0;color:#cfe3d9">Lubang × <input id="bpH" type="range" min="1" max="30" step="1" value="1" style="width:90px;vertical-align:middle"><span id="bpHv"></span></label>
    <button id="bpA" class="sec" style="flex:0;padding:4px 10px">Atas</button><button id="bpS" class="sec" style="flex:0;padding:4px 10px">Samping</button>
    <button id="bpP" class="sec" style="flex:0;padding:4px 10px">Simpan gambar</button><button id="bpPDF" class="sec" style="flex:0;padding:4px 10px">⬇ PDF A3</button><button id="bpX" style="flex:0;padding:4px 12px;margin-left:auto">✕ Tutup</button></div>
    <div id="bpC" style="flex:1;position:relative;min-height:0"><div id="bpL" style="position:absolute;left:10px;top:10px;background:rgba(0,0,0,.55);border-radius:8px;padding:6px 9px;font-size:12px;line-height:1.6;pointer-events:none"></div>
      <div id="bpM" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px">Memuat topografi DEMNAS…</div></div>
    <div id="bpI" style="padding:6px 10px;background:#12251E;color:#cfe3d9;font-size:12px;min-height:1.4em">Seret untuk memutar · dua jari / klik kanan untuk menggeser · cubit / roda untuk zoom · ketuk lubang untuk keterangan layer.</div>`;
  document.body.appendChild(lay);
  let stop = false, ren = null; const tutup = () => { stop = true; try { ren?.dispose(); ren?.forceContextLoss(); } catch {} lay.remove(); };
  $("#bpX").onclick = tutup;
  let THREE, OC; try { THREE = await import("./vendor/three.module.min.js"); OC = (await import("./vendor/OrbitControls.js")).OrbitControls; }
  catch (e) { $("#bpM").textContent = "Pustaka 3D gagal dimuat (perlu sinyal pertama kali): " + e.message; return; }
  const P = L.filter((x) => Number.isFinite(+x.lon) && Number.isFinite(+x.lat));
  if (!P.length) { $("#bpM").textContent = "Belum ada titik bor."; return; }
  const dalam = (x) => Math.max(+x.kd || 0, ...PRF.filter((r) => r.bhid === x.bhid).map((r) => +r.sampai_m));
  // area & grid DEM
  const lat0 = P.reduce((s, p) => s + +p.lat, 0) / P.length, kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574, pad = 350;
  const lo0 = Math.min(...P.map((p) => +p.lon)) - pad / kx, lo1 = Math.max(...P.map((p) => +p.lon)) + pad / kx, la0 = Math.min(...P.map((p) => +p.lat)) - pad / ky, la1 = Math.max(...P.map((p) => +p.lat)) + pad / ky;
  const wM = (lo1 - lo0) * kx, hM = (la1 - la0) * ky, NX = 110, NY = Math.max(20, Math.round((NX * hM) / wM)), clo = (lo0 + lo1) / 2, cla = (la0 + la1) / 2;
  const Z = []; for (let j = 0; j <= NY; j++) { if (stop) return; Z[j] = await Promise.all(Array.from({ length: NX + 1 }, (_, i) => tinggiDi(lo0 + ((lo1 - lo0) * i) / NX, la1 - ((la1 - la0) * j) / NY).catch(() => null)));
    if (j % 10 === 0) $("#bpM").textContent = `Memuat topografi DEMNAS… ${Math.round((100 * j) / NY)}%`; }
  const fl = Z.flat().filter((v) => v != null); if (!fl.length) { $("#bpM").textContent = "DEMNAS belum tersedia untuk area ini (buka Peta sekali saat ada sinyal, lalu Simpan offline)."; return; }
  const zMin = Math.min(...fl), zMax = Math.max(...fl), zz = (v) => (v == null ? zMin : v);
  for (const p of P) p.z = zz(await tinggiDi(+p.lon, +p.lat).catch(() => null));
  const RK = await (await fetch("peta/kontur/index.json")).json().catch(() => null), stops = RK?.elev_stops ?? [[0, [38, 115, 77]], [1100, [245, 245, 245]]];
  const warnaE = (v) => { let a = stops[0], b = stops[stops.length - 1]; for (let k = 0; k < stops.length - 1; k++) if (v >= stops[k][0] && v <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; }
    const t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]); return [0, 1, 2].map((c) => a[1][c] + (b[1][c] - a[1][c]) * t); };
  // tekstur: warna elevasi + bayangan relief, lalu blur/kontras sesuai pilihan
  const dasar = document.createElement("canvas"); dasar.width = NX * 8; dasar.height = NY * 8; { const g = dasar.getContext("2d"), cw = dasar.width / NX, ch = dasar.height / NY;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = zz(Z[j][i]), b = zz(Z[j][i + 1]), c = zz(Z[j + 1][i]), m = (a + b + c + zz(Z[j + 1][i + 1])) / 4;
      const sx = (b - a) / (wM / NX), sy = (a - c) / (hM / NY), sh = Math.max(0.55, Math.min(1.2, 0.9 + 1.6 * (-sx * 0.7 + sy * 0.7) / Math.hypot(sx, sy, 1)));
      const col = warnaE(m).map((v) => Math.max(0, Math.min(255, Math.round(v * sh)))); g.fillStyle = `rgb(${col.join(",")})`; g.fillRect(i * cw, j * ch, cw + 1, ch + 1); } }
  const FIL = { redup: "blur(5px) saturate(0.35) contrast(0.55) brightness(1.15)", sedang: "blur(2px) saturate(0.65) contrast(0.8) brightness(1.05)", asli: "none" };
  // citra drone terbaru + semua lapisan peta + batas IUP dibungkus ke permukaan (tidak diredupkan agar bukaan lahan terbaca)
  $("#bpM").textContent = "Memuat citra drone & lapisan…";
  const maxT = Math.min(4096, ren0MaxTex()), TW0 = Math.max(dasar.width, Math.round(wM / 0.6)), TH0 = Math.round((TW0 * hM) / wM), fk = Math.min(1, maxT / Math.max(TW0, TH0)), TW = Math.round(TW0 * fk), TH = Math.round(TH0 * fk);
  const citra = await kanvasCitra([lo0, la0, lo1, la1], TW, TH, { lapisan: true, iup: true, lebar: Math.max(2, TW / 600) }).catch(() => null);
  const tekstur = (k) => { const c = document.createElement("canvas"); c.width = citra ? TW : dasar.width; c.height = citra ? TH : dasar.height; const g = c.getContext("2d"); g.filter = FIL[k] ?? FIL.redup; g.drawImage(dasar, 0, 0, c.width, c.height); g.filter = "none";
    if (citra) g.drawImage(citra, 0, 0); 
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ren?.capabilities?.getMaxAnisotropy?.() ?? 1; return t; };
  // adegan
  $("#bpM").remove(); const box = $("#bpC"), W = () => box.clientWidth, H = () => box.clientHeight;
  ren = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); ren.setPixelRatio(Math.min(2, devicePixelRatio)); ren.setSize(W(), H()); ren.setClearColor(0xeef3f1); box.prepend(ren.domElement);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, W() / H(), 1, Math.max(wM, hM) * 20), ctl = new OC(cam, ren.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.95;
  sc.add(new THREE.AmbientLight(0xffffff, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-1, 2, 1); sc.add(sun);
  const pos = (lon, lat) => [(lon - clo) * kx, -(lat - cla) * ky];
  const maxD = Math.max(5, ...P.map((p) => Math.max(dalam(p), +p.rk || 0))), span = Math.max(wM, hM);
  const heAuto = Math.max(1, Math.round((zMax - zMin + 60) * 0.8 / maxD)); $("#bpH").value = Math.min(30, heAuto);
  let grp = null, terr = null, hit = [], zonAkhir = new Map();
  const label = (txt, warna = "#111") => { const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "bold 44px system-ui"; c.width = Math.ceil(g.measureText(txt).width) + 24; c.height = 60;
    g.font = "bold 44px system-ui"; g.fillStyle = "rgba(255,255,255,.88)"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = warna; g.fillText(txt, 12, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); const k = span * 0.0007; s.scale.set(c.width * k * 0.5, c.height * k * 0.5, 1); s.renderOrder = 10; return s; };
  const bangun = () => {
    const VE = +$("#bpV").value, HE = +$("#bpH").value; $("#bpVv").textContent = String(VE).replace(".", ","); $("#bpHv").textContent = HE + "×";
    if (grp) { sc.remove(grp); grp.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
    grp = new THREE.Group(); sc.add(grp); hit = [];
    const geo = new THREE.PlaneGeometry(wM, hM, NX, NY); geo.rotateX(-Math.PI / 2); const ps = geo.attributes.position;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) ps.setY(j * (NX + 1) + i, (zz(Z[j][i]) - zMin) * VE); geo.computeVertexNormals();
    terr = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tekstur($("#bpT").value), transparent: true, opacity: +$("#bpO").value, side: THREE.DoubleSide, depthWrite: false })); terr.renderOrder = 5; grp.add(terr);
    // garis tepi blok dan alas
    const yb = -maxD * HE - 20, tepi = [[-wM / 2, -hM / 2], [wM / 2, -hM / 2], [wM / 2, hM / 2], [-wM / 2, hM / 2], [-wM / 2, -hM / 2]];
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tepi.map(([x, z]) => new THREE.Vector3(x, yb, z))), new THREE.LineBasicMaterial({ color: 0x6b7a72 })));
    for (const [x, z] of tepi.slice(0, 4)) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, yb, z), new THREE.Vector3(x, 0, z)]), new THREE.LineBasicMaterial({ color: 0x9aa8a0 })));
    const r = Math.max(3, span * 0.005), zon = new Map();
    for (const p of P) { const [x, z] = pos(+p.lon, +p.lat), y0 = (p.z - zMin) * VE, dip = (Math.abs(+p.dip || 90) * Math.PI) / 180, az = ((+p.az || 0) * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(dip), -Math.sin(dip), -Math.cos(az) * Math.cos(dip)).normalize(), at = (d) => new THREE.Vector3(x, y0, z).addScaledVector(dir, d * HE);
      const D = dalam(p), R = PRF.filter((q) => q.bhid === p.bhid), iv = R.length ? R.map((q) => [+q.dari_m, +q.sampai_m, q.warna, q.nama_zona]) : D > 0 ? [[0, D, p.warna, LABEL_STATUS[p.status] ?? p.status]] : [];
      for (const [a, b, w, nm] of iv) { if (!(b > a)) continue; const A = at(a), B = at(b), len = A.distanceTo(B);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), new THREE.MeshLambertMaterial({ color: w || "#999" })); m.position.copy(A).add(B).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.userData = `${p.bhid} · ${nm} ${a.toFixed(1)}–${b.toFixed(1)} m (tebal ${(b - a).toFixed(1)} m)`; grp.add(m); hit.push(m);
        if (R.length) zon.set(nm, w); }
      if (+p.rk > D) { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([at(D), at(+p.rk)]), new THREE.LineDashedMaterial({ color: 0x333333, dashSize: r * 2, gapSize: r * 1.5 })); ln.computeLineDistances(); grp.add(ln); }
      const col = new THREE.Mesh(new THREE.SphereGeometry(r * 1.5, 16, 12), new THREE.MeshLambertMaterial({ color: WARNA_STATUS[p.status] ?? "#999" })); col.position.set(x, y0, z); col.userData = `${p.bhid} · ${LABEL_STATUS[p.status] ?? p.status}${D ? ` · kedalaman ${D.toFixed(1)} m` : ""}${+p.rk ? ` · rencana ${p.rk} m` : ""}`; grp.add(col); hit.push(col);
      const lb = label(p.bhid); lb.position.set(x, y0 + span * 0.035, z); grp.add(lb);
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y0, z), lb.position.clone()]), new THREE.LineBasicMaterial({ color: 0x333333 }))); }
    const u = label("U ↑", "#c00"); u.position.set(0, (zMax - zMin) * VE + span * 0.05, -hM / 2); grp.add(u);
    zonAkhir = zon;
    $("#bpL").innerHTML = [...zon].map(([n, w]) => `<div><span style="display:inline-block;width:12px;height:12px;background:${esc(w)};border:1px solid #fff;margin-right:6px;vertical-align:-1px"></span>${esc(n)}</div>`).join("")
      + `<div>${["RENCANA", "PROGRES", "EOH"].map((k) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${WARNA_STATUS[k]};border:1px solid #fff;margin:0 4px 0 0"></span>${k === "EOH" ? "EOH/STB" : LABEL_STATUS[k].replace(" (continue)", "")}`).join(" &nbsp;")}</div>
      <div style="opacity:.8">Relief ${zMin.toFixed(0)}–${zMax.toFixed(0)} m ×${VE} · lubang ×${HE} · garis putus = sisa rencana</div>${citra?.nama?.length || citra?.lapisan?.length ? `<div style="opacity:.8">${[...(citra.nama ?? []), ...(citra.lapisan ?? [])].map(esc).join(" · ")} · batas IUP merah</div>` : ""}`;
  };
  bangun();
  const lihat = (atas) => { const d = span * 0.95; ctl.target.set(0, -maxD * +$("#bpH").value * 0.3, 0); if (atas) cam.position.set(0, d * 1.3, d * 0.05); else cam.position.set(-d * 0.75, d * 0.45, d * 0.75); ctl.update(); };
  lihat(false);
  $("#bpA").onclick = () => lihat(true); $("#bpS").onclick = () => lihat(false);
  $("#bpT").onchange = (e) => { localStorage.setItem("topo3d", e.target.value); terr.material.map.dispose(); terr.material.map = tekstur(e.target.value); terr.material.needsUpdate = true; };
  $("#bpO").oninput = (e) => { localStorage.setItem("bp3op", e.target.value); terr.material.opacity = +e.target.value; };
  $("#bpV").oninput = bangun; $("#bpH").oninput = bangun;
  $("#bpPDF").onclick = () => {
    // render ulang resolusi tinggi dengan perbandingan sisi bingkai peta A3 (279 × 257 mm)
    const w0 = W(), h0 = H(), pr = ren.getPixelRatio(), RW = 2600, RH = Math.round((RW * 257) / 279);
    ren.setPixelRatio(1); ren.setSize(RW, RH, false); cam.aspect = RW / RH; cam.updateProjectionMatrix(); ren.render(sc, cam);
    const cv = Object.assign(document.createElement("canvas"), { width: RW, height: RH }), cg = cv.getContext("2d"); cg.fillStyle = "#fff"; cg.fillRect(0, 0, RW, RH); cg.drawImage(ren.domElement, 0, 0);
    const url = cv.toDataURL("image/jpeg", 0.92);
    // arah utara di layar: proyeksikan titik pusat & titik ke utara
    const p0 = new THREE.Vector3(0, 0, 0).project(cam), p1 = new THREE.Vector3(0, 0, -span * 0.2).project(cam), sudut = (Math.atan2((p1.x - p0.x) * RW, (p1.y - p0.y) * RH) * 180) / Math.PI;
    const arahLihat = ((Math.atan2(cam.position.x - ctl.target.x, -(cam.position.z - ctl.target.z)) * 180) / Math.PI + 360) % 360; // posisi kamera dilihat dari titik pusat (0° = utara)
    ren.setPixelRatio(pr); ren.setSize(w0, h0); cam.aspect = w0 / h0; cam.updateProjectionMatrix();
    const t = $("#bpT"), info = { url, utara: sudut, VE: +$("#bpV").value, HE: +$("#bpH").value, topo: t.options[t.selectedIndex].text, tembus: +$("#bpO").value,
      zon: [...zonAkhir], zMin, zMax, maxD, arahLihat, wilayahLL: [lo0, la0, lo1, la1] };
    petaA3Dialog(L, { g3d: info });
  };
  $("#bpP").onclick = () => { ren.render(sc, cam); const a = document.createElement("a"); a.href = ren.domElement.toDataURL("image/png"); a.download = `Peta3D_bawah_permukaan_${new Date().toISOString().slice(0, 10)}.png`; a.click(); };
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2(); let turun = null;
  ren.domElement.addEventListener("pointerdown", (e) => (turun = [e.clientX, e.clientY]));
  ren.domElement.addEventListener("pointerup", (e) => { if (!turun || Math.hypot(e.clientX - turun[0], e.clientY - turun[1]) > 6) return; const b = ren.domElement.getBoundingClientRect();
    v2.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(v2, cam); const h = ray.intersectObjects(hit)[0];
    $("#bpI").textContent = h ? h.object.userData : "Ketuk kolom lubang untuk keterangan layer."; });
  const ubah = () => { if (stop) return; cam.aspect = W() / H(); cam.updateProjectionMatrix(); ren.setSize(W(), H()); }; addEventListener("resize", ubah);
  const jalan = () => { if (stop) return removeEventListener("resize", ubah); ctl.update(); ren.render(sc, cam); requestAnimationFrame(jalan); }; jalan();
}
async function tinggiDi(lon, lat) {
  const z = 14, n = 2 ** z, xf = (lon + 180) / 360 * n, r = lat * Math.PI / 180, yf = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n, x = Math.floor(xf), y = Math.floor(yf), k = `${x}/${y}`;
  demCache[k] ??= new Promise((ok) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0); ok(g); }; im.onerror = () => ok(null); im.src = `peta/dem/${z}/${x}/${y}.png`; });
  const g = await demCache[k]; if (!g) return null; const d = g.getImageData(Math.min(255, Math.floor((xf - x) * 256)), Math.min(255, Math.floor((yf - y) * 256)), 1, 1).data;
  return -10000 + (d[0] * 65536 + d[1] * 256 + d[2]) * 0.1;
}
let petaML = null;
const WARNA_STATUS = { RENCANA: "#ffffff", PROGRES: "#ffd400", EOH: "#22c55e", STB: "#22c55e", SELESAI: "#16a34a" };
const LABEL_STATUS = { RENCANA: "Rencana", PROGRES: "Progres (continue)", EOH: "EOH", STB: "STB", SELESAI: "Selesai" };
const muatJS = (src, cek) => (cek() ? Promise.resolve() : new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = src; sc.onload = ok; sc.onerror = () => no(new Error(`Gagal memuat ${src} (perlu sinyal pertama kali)`)); document.head.appendChild(sc); }));
// File → GeoJSON (WGS84). SHP: .zip atau .shp+.dbf(+.prj); KML; KMZ; GeoJSON; CSV (kolom lon/lat atau x/y UTM 51S)
async function bacaFilePeta(files) {
  const F = [...files], ext = (f) => f.name.toLowerCase().split(".").pop(), buf = (f) => f.arrayBuffer(), txt = (f) => f.text();
  const fc = (features) => ({ type: "FeatureCollection", features });
  const satukan = (x) => (Array.isArray(x) ? fc(x.flatMap((c) => c.features)) : x);
  const z = F.find((f) => ext(f) === "zip"), shpF = F.find((f) => ext(f) === "shp"), kml = F.find((f) => ext(f) === "kml"), kmz = F.find((f) => ext(f) === "kmz");
  const gj = F.find((f) => ["geojson", "json"].includes(ext(f))), csv = F.find((f) => ["csv", "txt"].includes(ext(f)));
  if (z || shpF) { await muatJS("vendor/shp.min.js", () => window.shp);
    if (z) return { nama: z.name, data: satukan(await shp(await buf(z))) };
    const dbf = F.find((f) => ext(f) === "dbf"), prj = F.find((f) => ext(f) === "prj");
    if (!prj) throw new Error("File .prj tidak ikut. Pilih .shp, .dbf, .prj (dan .shx) sekaligus, atau kirim satu .zip — tanpa .prj sistem koordinat tidak diketahui.");
    return { nama: shpF.name, data: shp.combine([shp.parseShp(await buf(shpF), await txt(prj)), dbf ? shp.parseDbf(await buf(dbf)) : []]) }; }
  if (kml || kmz) { await muatJS("vendor/togeojson.umd.js", () => window.toGeoJSON);
    let t; if (kmz) { await muatJS("vendor/jszip.min.js", () => window.JSZip); const zz = await JSZip.loadAsync(await buf(kmz)); const k = Object.keys(zz.files).find((n) => n.toLowerCase().endsWith(".kml")); if (!k) throw new Error("KMZ tidak berisi .kml"); t = await zz.files[k].async("string"); } else t = await txt(kml);
    return { nama: (kmz ?? kml).name, data: toGeoJSON.kml(new DOMParser().parseFromString(t, "text/xml")) }; }
  if (gj) { const d = JSON.parse(await txt(gj)); return { nama: gj.name, data: d.type === "FeatureCollection" ? d : fc([d]) }; }
  if (csv) { const L = (await txt(csv)).split(/\r?\n/).filter((x) => x.trim()), sep = L[0].includes(";") ? ";" : ",", H = L[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    const i = (...n) => H.findIndex((h) => n.includes(h)), iLon = i("lon", "long", "longitude", "bujur", "x_dd"), iLat = i("lat", "latitude", "lintang", "y_dd"), iX = i("x", "east", "easting", "utm_x", "timur"), iY = i("y", "north", "northing", "utm_y", "utara");
    if (!((iLon >= 0 && iLat >= 0) || (iX >= 0 && iY >= 0))) throw new Error("CSV butuh kolom lon & lat (derajat) atau x & y (UTM 51S).");
    const feats = L.slice(1).map((r) => { const c = r.split(sep).map((v) => v.trim().replace(/^"|"$/g, "")), nm = (v) => Number(String(v).replace(",", "."));
      const ll = iLon >= 0 ? [nm(c[iLon]), nm(c[iLat])] : UTM.dari(nm(c[iX]), nm(c[iY])); return { type: "Feature", properties: Object.fromEntries(H.map((h, k) => [h, c[k]])), geometry: { type: "Point", coordinates: ll } }; })
      .filter((f) => f.geometry.coordinates.every(Number.isFinite));
    return { nama: csv.name, data: fc(feats) }; }
  throw new Error("Format tidak dikenal. Pakai SHP (.zip atau .shp+.dbf+.prj), KML, KMZ, GeoJSON, atau CSV.");
}
// Koreksi bila koordinat ternyata UTM (|x| > 180) tanpa .prj
function pastikanWGS84(fc) { const ubah = (c) => (typeof c[0] === "number" ? (Math.abs(c[0]) > 180 ? UTM.dari(c[0], c[1]) : c.slice(0, 2)) : c.map(ubah));
  fc.features = fc.features.filter((f) => f.geometry).map((f) => ({ ...f, geometry: { ...f.geometry, coordinates: ubah(f.geometry.coordinates) } })); return fc; }
const lapisanLokal = () => JSON.parse(localStorage.getItem("petaLokal") || "[]");
async function petaView(v) {
  const bisaTulis = ["verifier", "admin"].includes(me?.role);
  v.innerHTML = `<div class="card" id="pmCard" style="padding:8px"><div class="row" style="flex-wrap:wrap;align-items:center;gap:6px">
      <select id="pmB" style="flex:0 0 140px"><option value="sat">Citra satelit</option><option value="osm">Peta jalan (OSM)</option><option value="none">Tanpa latar</option></select>
      <button class="sec" id="pm3" style="flex:0">3D</button><button class="sec" id="pmA3" style="flex:0;white-space:nowrap" title="Ekspor peta lokasi titik bor ke PDF A3 lanskap">🖨 Peta PDF A3</button><button class="sec" id="pmBP" style="flex:0;white-space:nowrap;background:#12251E;color:#fff">🧊 3D bawah permukaan</button><label id="pmKl" style="flex:0;white-space:nowrap;margin:0;display:none">Kolom bor <input id="pmK" type="range" min="0.5" max="3" step="0.25" value="${localStorage.getItem("kolom3d") || 1}" style="width:80px;vertical-align:middle"></label><select id="pmTopo" title="Tampilan topografi saat 3D" style="flex:0 0 150px">${[["redup", "Topo redup (bor jelas)"], ["sedang", "Topo sedang"], ["asli", "Topo asli"]].map(([k, l]) => `<option value="${k}" ${(localStorage.getItem("topo3d") || "redup") === k ? "selected" : ""}>${l}</option>`).join("")}</select><label style="flex:0;white-space:nowrap;margin:0">Tinggi <input id="pmX" type="range" min="1" max="4" step="0.5" value="1.5" style="width:80px;vertical-align:middle"> <span id="pmXv">1,5×</span></label>
      <button class="sec" id="pmL" style="flex:0">Lapisan ▾</button><button class="sec" id="pmF" style="flex:0">Impor file</button><input type="file" id="pmFi" multiple accept=".zip,.shp,.dbf,.prj,.shx,.cpg,.kml,.kmz,.geojson,.json,.csv,.txt" style="display:none">
      <button class="sec" id="pmT" style="flex:0">● Lacak</button><button class="sec" id="pmI" style="flex:0">Ke IUP</button><button class="sec" id="pmO" style="flex:0">Simpan offline</button></div>
    <div id="pmPanel" class="card" style="display:none;margin:8px 0 0;padding:8px;background:#f6f7f2"></div>
    <div style="position:relative"><div id="pmap" style="height:70vh;margin-top:8px;border-radius:10px;overflow:hidden;background:#dfe5df"></div>
      <div id="pmLeg" style="position:absolute;left:8px;top:16px;background:rgba(255,255,255,.88);border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.6">${[["RENCANA", "Rencana"], ["PROGRES", "Progres (continue)"], ["EOH", "EOH / STB (selesai bor)"]].map(([k, t]) => `<div><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${WARNA_STATUS[k]};border:1.5px solid #111;vertical-align:-1px"></span> ${t}</div>`).join("")}<div><span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:2.5px solid #e00;vertical-align:-1px"></span> di luar IUP</div></div></div>
    <div class="muted" id="pmInfo" style="margin-top:6px;min-height:1.2em">Memuat peta…</div><div id="pm3info" style="font-size:12px;color:#12251E;margin-top:2px"></div>
    <p class="muted" style="margin:4px 0 0">Relief: DEMNAS (BIG) ±8 m sampai pantai; di hutan bisa mengikuti puncak pohon. Citra: Esri World Imagery. Bagian peta yang pernah tampil (citra satelit, OSM, relief, citra drone) otomatis tersimpan di HP dan bisa dibuka & diekspor saat offline; “Simpan offline” menyimpan seluruh relief & citra drone sekaligus.</p></div>`;
  try { if (!window.maplibregl) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "vendor/maplibre-gl.css"; document.head.appendChild(l); await muatJS("vendor/maplibre-gl.js", () => window.maplibregl); } }
  catch (e) { return ($("#pmInfo").textContent = e.message); }
  const BB = [121.725, -1.8, 121.85, -1.622], demURL = new URL("peta/dem/", location.href).href + "{z}/{x}/{y}.png";
  // Batas IUP: selalu ambil terbaru dari server saat online (jangan hanya andalkan simpanan sesi), simpan untuk offline
  if (online()) { const { data, error } = await sb.from("wilayah").select("nama,nomor_sk,titik").eq("aktif", true); if (!error && data) localStorage.setItem("wilayah", JSON.stringify(data)); }
  const W = JSON.parse(localStorage.getItem("wilayah") || "[]");
  const map = (petaML = new maplibregl.Map({ container: "pmap", bounds: [[121.7387, -1.726], [121.7784, -1.6327]], fitBoundsOptions: { padding: 25 }, maxPitch: 80, attributionControl: { compact: true },
    style: { version: 8, sources: {
        sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "Citra © Esri, Maxar, Earthstar Geographics" },
        osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap" },
        dem: { type: "raster-dem", tiles: [demURL], tileSize: 256, minzoom: 10, maxzoom: 14, bounds: BB, encoding: "mapbox", attribution: "DEMNAS © BIG" },
        demhs: { type: "raster-dem", tiles: [demURL], tileSize: 256, minzoom: 10, maxzoom: 14, bounds: BB, encoding: "mapbox" } },
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#dfe5df" } }, { id: "sat", type: "raster", source: "sat" }, { id: "osm", type: "raster", source: "osm", layout: { visibility: "none" } },
        { id: "hs", type: "hillshade", source: "demhs", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#2b2b2b" } }] } }));
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right"); map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
  // GPS: titik biru mengikuti posisi (GPS HP bekerja tanpa sinyal data)
  const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true }); map.addControl(geo, "top-right");
  let RK = null, CT = []; const opRel = () => Number(localStorage.getItem("petaOpRel") || 0.65), opCt = () => Number(localStorage.getItem("petaOpCitra") || 1);
  const eks = () => Number($("#pmX").value), LBL = { iup: [], lubang: [] }, vis = JSON.parse(localStorage.getItem("petaVis") || "{}");
  const tampil = (k, def = true) => vis[k] ?? def, setVis = (k, on) => { vis[k] = on; localStorage.setItem("petaVis", JSON.stringify(vis)); };
  // Label HTML (tanpa font dari server → tetap tampil offline)
  const label = (ll, teks, gaya) => { const el = document.createElement("div"); el.textContent = teks; el.style.cssText = `font:600 11px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:0 4px;border-radius:4px;pointer-events:none;white-space:nowrap;${gaya}`; return new maplibregl.Marker({ element: el, anchor: "bottom-left", offset: [6, -4], opacityWhenCovered: "1" }).setLngLat(ll); };
  const pasangLabel = (k, on) => LBL[k].forEach((mk) => (on ? mk.addTo(map) : mk.remove()));
  let L = [], LAY = [];
  const muatLubang = async () => {
    if (!online()) { L = JSON.parse(localStorage.getItem("petaLubang") || "[]"); return; }
    const [{ data, error }, RDR] = await Promise.all([ambilLubangPeta(), petaRedrill().catch(() => ({}))]); if (error) { L = JSON.parse(localStorage.getItem("petaLubang") || "[]"); return; }
    L = (data ?? []).map((r) => { const ll = r.x != null ? UTM.dari(r.x, r.y) : [r.lon, r.lat];
      return { type: "Feature", properties: { redrill: asalRedrill(r.bhid) ? bakuBH(asalRedrill(r.bhid)) : null, diganti: RDR[r.bhid] ?? null, bhid: r.bhid, status: r.status, dalam: r.di_dalam_iup !== false, kd: r.kedalaman, rk: r.rencana_kedalaman, rig: r.rig ?? "", pos: r.sumber_posisi, dip: r.dip, az: r.azimuth, warna: WARNA_STATUS[r.status] ?? "#999" }, geometry: { type: "Point", coordinates: ll } }; })
      .filter((f) => f.geometry.coordinates.every(Number.isFinite));
    localStorage.setItem("petaLubang", JSON.stringify(L));
  };
  const muatLapisan = async () => {
    let srv = JSON.parse(localStorage.getItem("petaLayerSrv") || "[]");
    if (online()) { const { data } = await sb.from("peta_layer").select("id,nama,warna,geojson,aktif").eq("aktif", true).order("created_at"); if (data) { srv = data; try { localStorage.setItem("petaLayerSrv", JSON.stringify(data)); } catch {} } }
    LAY = [...srv.map((x) => ({ ...x, server: true })), ...lapisanLokal().map((x) => ({ ...x, server: false }))];
  };
  const gambarLapisan = () => {
    for (const ly of LAY) { const id = "ly_" + ly.id; if (map.getSource(id)) continue;
      map.addSource(id, { type: "geojson", data: ly.geojson }); const on = tampil(id) ? "visible" : "none", c = ly.warna || "#00b7ff";
      map.addLayer({ id: id + "_f", type: "fill", source: id, filter: ["==", "$type", "Polygon"], layout: { visibility: on }, paint: { "fill-color": c, "fill-opacity": 0.15 } }, "trk");
      map.addLayer({ id: id + "_l", type: "line", source: id, filter: ["in", "$type", "Polygon", "LineString"], layout: { visibility: on }, paint: { "line-color": c, "line-width": 2 } }, "trk");
      map.addLayer({ id: id + "_p", type: "circle", source: id, filter: ["==", "$type", "Point"], layout: { visibility: on }, paint: { "circle-radius": 4.5, "circle-color": c, "circle-stroke-color": "#111", "circle-stroke-width": 1 } }, "trk"); }
  };
  // Zoom ke lapisan: kumpulkan semua koordinat lalu fitBounds (titik tunggal → zoom 16)
  const zoomKe = (coords, pesan) => { const bb = new maplibregl.LngLatBounds(); const tiap = (c) => (typeof c[0] === "number" ? (Number.isFinite(c[0]) && bb.extend([c[0], c[1]])) : c.forEach(tiap)); tiap(coords);
    if (bb.isEmpty()) return ($("#pmInfo").textContent = `${pesan}: tidak ada data untuk di-zoom.`);
    const sw = bb.getSouthWest(), ne = bb.getNorthEast(); if (sw.lng === ne.lng && sw.lat === ne.lat) map.flyTo({ center: sw, zoom: 16 }); else map.fitBounds(bb, { padding: 50, maxZoom: 17, duration: 800 });
    $("#pmInfo").textContent = `Zoom ke ${pesan}`; };
  const zoomLapisan = (k) => {
    if (k === "iup") return zoomKe(W.map((w) => w.titik.map((t) => [t.lon, t.lat])), "batas IUP");
    if (k === "track") return zoomKe(trk?.pts ?? [], "jejak yang sedang direkam");
    if (k.startsWith("st_")) { const st = k.slice(3); setVis(k, true); terapkanVis(); panel(); return zoomKe(L.filter((f) => f.properties.status === st).map((f) => f.geometry.coordinates), `lubang ${LABEL_STATUS[st]}`); }
    if (k.startsWith("ct_")) { const c = CT.find((x) => "ct_" + x.id === k); if (!c) return; setVis(k, true); terapkanVis(); panel(); return zoomKe([[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[3]]], c.nama); }
    if (k === "lbl") return zoomKe(L.map((f) => f.geometry.coordinates), "semua lubang");
    if (k.startsWith("ly_")) { const ly = LAY.find((x) => "ly_" + x.id === k); if (!ly) return; setVis(k, true); terapkanVis(); panel(); return zoomKe(ly.geojson.features.filter((f) => f.geometry).map((f) => f.geometry.coordinates), ly.nama); }
    if (k.startsWith("tr_")) { const t = JSON.parse(localStorage.getItem("trackList") || "[]")[Number(k.slice(3))]; if (!t) return;
      map.getSource("trkSimpan")?.setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: t.pts.map((p) => [p[0], p[1]]) } }] });
      return zoomKe(t.pts.map((p) => [p[0], p[1]]), `jejak “${t.nama}” (${(t.km ?? 0).toFixed(2)} km)`); }
  };
  const tz = (k) => `<a href="#" data-zm="${k}" title="Zoom ke lapisan ini" style="text-decoration:none;margin-left:2px">⌖</a>`;
  const panel = () => {
    const ck = (k, t, def = true, extra = "", zoom = true) => `<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" data-vk="${k}" ${tampil(k, def) ? "checked" : ""} style="width:auto">${t}${zoom ? tz(k) : ""}${extra}</label>`;
    const legElev = RK ? `<div style="margin:2px 0 0 22px;font-size:11px"><div style="height:9px;width:150px;border-radius:3px;background:linear-gradient(90deg,${RK.elev_stops.map((x) => `rgb(${x[1].join(",")}) ${(x[0] / 1100) * 100}%`).join(",")})"></div><div style="display:flex;justify-content:space-between;width:150px"><span>0</span><span>300</span><span>600</span><span>1.100 m</span></div></div>` : "";
    const KL = ["0–2 % datar", "2–7 % landai", "7–15 % agak miring", "15–30 % miring", "30–70 % agak curam", "70–140 % curam", "> 140 % sangat curam"];
    const legLer = RK ? `<div style="margin:2px 0 0 22px;font-size:11px">${RK.lereng_kelas.map((x, i) => `<div><span style="display:inline-block;width:10px;height:10px;background:rgb(${x[1].join(",")});border-radius:2px"></span> ${KL[i]}</div>`).join("")}<div class="muted">Kelas Van Zuidam (1985)</div></div>` : "";
    const relief = RK ? `<div><b>Relief DEMNAS</b>${ck("kontur", `Kontur (${RK.kontur_interval} m, tebal tiap ${RK.kontur_indeks} m)`, false, "", false)}${ck("elev", "Warna elevasi", false, legElev, false)}${ck("lereng", "Kemiringan lereng", false, legLer, false)}
      <label style="font-size:12px;margin-top:4px">Kepekatan warna <input type="range" id="pmOp" min="0.2" max="1" step="0.05" value="${opRel()}" style="width:110px;vertical-align:middle"></label></div>` : "";
    $("#pmPanel").innerHTML = `<div class="row" style="flex-wrap:wrap;gap:18px;align-items:flex-start"><div><b>Dasar</b>${ck("hs", "Bayangan relief", true, "", false)}${ck("iup", "Batas IUP")}${ck("iupno", "Nomor titik IUP", true, "", false)}${ck("track", "Jejak GPS (lacak)")}</div>${relief}
      ${CT.length ? `<div><b>Citra / peta drone</b>${CT.map((c) => ck("ct_" + c.id, esc(c.nama), c.tampil !== false, `<div class="muted" style="font-size:11px;max-width:230px;margin-left:22px">${esc(c.catatan ?? "")}</div>`)).join("")}
      <label style="font-size:12px;margin-top:4px">Kepekatan citra <input type="range" id="pmOpC" min="0.2" max="1" step="0.05" value="${opCt()}" style="width:110px;vertical-align:middle"></label></div>` : ""}
      <div><b>Lubang bor</b>${Object.keys(LABEL_STATUS).filter((k) => k !== "SELESAI").map((k) => ck("st_" + k, LABEL_STATUS[k])).join("")}${ck("lbl", "Nama lubang")}</div>
      <div><b>Lapisan tambahan</b>${LAY.map((ly) => ck("ly_" + ly.id, `<span style="display:inline-block;width:12px;height:12px;background:${esc(ly.warna)};border-radius:3px"></span> ${esc(ly.nama)} <span class="muted">${ly.server ? "(server)" : "(HP ini)"}</span>`, true,
        (ly.server ? bisaTulis : true) ? ` <a href="#" data-del="${ly.id}" data-srv="${ly.server ? 1 : 0}" style="color:#c00">hapus</a>` : "")).join("") || `<span class="muted">Belum ada. Pakai “Impor file”.</span>`}</div>
      <div><b>Jejak tersimpan</b>${(JSON.parse(localStorage.getItem("trackList") || "[]")).map((t, i) => `<div>${esc(t.nama)} ${tz("tr_" + i)} <span class="muted">${(t.km ?? 0).toFixed(2)} km</span> <a href="#" data-gpx="${i}">GPX</a> · <a href="#" data-kml="${i}">KML</a> · <a href="#" data-tdel="${i}" style="color:#c00">hapus</a></div>`).join("") || `<span class="muted">Belum ada.</span>`}</div></div>`;
    $("#pmPanel").querySelectorAll("[data-vk]").forEach((c) => (c.onchange = () => { setVis(c.dataset.vk, c.checked);
      // warna elevasi dan lereng saling menggantikan agar tidak bertumpuk
      if (c.checked && (c.dataset.vk === "elev" || c.dataset.vk === "lereng")) { const lain = c.dataset.vk === "elev" ? "lereng" : "elev"; setVis(lain, false); const o = $("#pmPanel").querySelector(`[data-vk="${lain}"]`); if (o) o.checked = false; }
      terapkanVis(); }));
    const op = $("#pmOp"); if (op) op.oninput = () => { localStorage.setItem("petaOpRel", op.value); ["elev", "lereng"].forEach((id) => map.getLayer(id) && map.setPaintProperty(id, "raster-opacity", Number(op.value))); };
    const opc = $("#pmOpC"); if (opc) opc.oninput = () => { localStorage.setItem("petaOpCitra", opc.value); CT.forEach((c) => map.getLayer("ct_" + c.id) && map.setPaintProperty("ct_" + c.id, "raster-opacity", Number(opc.value))); };
    $("#pmPanel").querySelectorAll("[data-zm]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); zoomLapisan(a.dataset.zm); }));
    $("#pmPanel").querySelectorAll("[data-del]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); if (!confirm("Hapus lapisan ini?")) return;
      if (a.dataset.srv === "1") { const { error } = await sb.from("peta_layer").update({ aktif: false }).eq("id", a.dataset.del); if (error) return alert(error.message); }
      else localStorage.setItem("petaLokal", JSON.stringify(lapisanLokal().filter((x) => x.id !== a.dataset.del)));
      const id = "ly_" + a.dataset.del; ["_f", "_l", "_p"].forEach((s2) => map.getLayer(id + s2) && map.removeLayer(id + s2)); map.getSource(id) && map.removeSource(id); LAY = LAY.filter((x) => x.id !== a.dataset.del); panel(); }));
    const T = JSON.parse(localStorage.getItem("trackList") || "[]"), unduh = (nama, isi, tipe) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click(); };
    $("#pmPanel").querySelectorAll("[data-gpx]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const t = T[a.dataset.gpx];
      unduh(`${t.nama.replace(/[^\w-]+/g, "_")}.gpx`, `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="TGEP"><trk><name>${esc(t.nama)}</name><trkseg>${t.pts.map((p) => `<trkpt lat="${p[1]}" lon="${p[0]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join("")}</trkseg></trk></gpx>`, "application/gpx+xml"); }));
    $("#pmPanel").querySelectorAll("[data-kml]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const t = T[a.dataset.kml];
      unduh(`${t.nama.replace(/[^\w-]+/g, "_")}.kml`, `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>${esc(t.nama)}</name><LineString><coordinates>${t.pts.map((p) => `${p[0]},${p[1]}`).join(" ")}</coordinates></LineString></Placemark></kml>`, "application/vnd.google-earth.kml+xml"); }));
    $("#pmPanel").querySelectorAll("[data-tdel]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); if (!confirm("Hapus jejak ini?")) return; T.splice(Number(a.dataset.tdel), 1); localStorage.setItem("trackList", JSON.stringify(T)); panel(); }));
  };
  const terapkanVis = () => {
    const sv = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    sv("hs", tampil("hs")); sv("kontur", tampil("kontur", false)); sv("elev", tampil("elev", false)); sv("lereng", tampil("lereng", false)); sv("iup-isi", tampil("iup")); sv("iup-garis", tampil("iup")); sv("trk", tampil("track"));
    CT.forEach((c) => sv("ct_" + c.id, tampil("ct_" + c.id, c.tampil !== false)));
    pasangLabel("iup", tampil("iupno"));
    const stOn = new Set(Object.keys(LABEL_STATUS).filter((k) => tampil("st_" + k)));
    LBL.lubang.forEach((mk) => { if (stOn.has(mk._st)) mk.addTo(map); else mk.remove(); const nm = mk.getElement().querySelector("[data-nm]"); if (nm) nm.style.display = tampil("lbl") ? "" : "none"; });
    for (const ly of LAY) ["_f", "_l", "_p"].forEach((s2) => sv("ly_" + ly.id + s2, tampil("ly_" + ly.id)));
  };
  // ---- pelacakan (tracking) GPS: tetap jalan tanpa sinyal selama layar menyala & aplikasi terbuka
  let watch = null, trk = JSON.parse(localStorage.getItem("trackAktif") || "null");
  const jarak = (a, b) => { const R = 6371000, r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r, x = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const panjang = (P) => P.reduce((s2, p, i) => (i ? s2 + jarak(P[i - 1], p) : 0), 0) / 1000;
  const gambarTrack = () => { const d = { type: "FeatureCollection", features: trk?.pts.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trk.pts.map((p) => [p[0], p[1]]) } }] : [] }; map.getSource("trk")?.setData(d); };
  const mulaiLacak = () => { $("#pmT").textContent = "■ Berhenti lacak"; $("#pmT").style.background = "#C8281F"; $("#pmT").style.color = "#fff";
    watch = navigator.geolocation.watchPosition((p) => { const pt = [p.coords.longitude, p.coords.latitude, Date.now(), Math.round(p.coords.accuracy)]; if (pt[3] > 50) return;
      const last = trk.pts[trk.pts.length - 1]; if (!last || jarak(last, pt) >= 5) { trk.pts.push(pt); localStorage.setItem("trackAktif", JSON.stringify(trk)); gambarTrack(); }
      $("#pmInfo").textContent = `Melacak · ${trk.pts.length} titik · ${panjang(trk.pts).toFixed(2)} km · akurasi ±${pt[3]} m`; }, () => { if (!trk?.pts.length) $("#pmInfo").textContent = "Menunggu sinyal GPS… (aktifkan Lokasi, coba di tempat terbuka)"; }, { enableHighAccuracy: true, maximumAge: 0 }); };
  $("#pmT").onclick = () => {
    if (watch !== null) { navigator.geolocation.clearWatch(watch); watch = null; $("#pmT").textContent = "● Lacak"; $("#pmT").style.background = ""; $("#pmT").style.color = "";
      if (trk?.pts.length > 1) { const nama = prompt("Nama jejak:", `Jejak ${new Date().toLocaleString("id-ID")}`) || "Jejak"; const T = JSON.parse(localStorage.getItem("trackList") || "[]"); T.unshift({ nama, pts: trk.pts, km: panjang(trk.pts) }); localStorage.setItem("trackList", JSON.stringify(T.slice(0, 30))); }
      trk = null; localStorage.removeItem("trackAktif"); gambarTrack(); panel(); return; }
    if (!navigator.geolocation) return alert("HP tidak mendukung GPS di browser.");
    trk = trk ?? { mulai: Date.now(), pts: [] }; localStorage.setItem("trackAktif", JSON.stringify(trk)); mulaiLacak(); };
  // ---- impor file
  $("#pmF").onclick = () => $("#pmFi").click();
  $("#pmFi").onchange = async (e) => {
    const files = e.target.files; if (!files.length) return; $("#pmInfo").textContent = "Membaca file…";
    let hasil; try { hasil = await bacaFilePeta(files); pastikanWGS84(hasil.data); } catch (er) { e.target.value = ""; return ($("#pmInfo").innerHTML = `<span class="err">${esc(er.message)}</span>`); }
    e.target.value = ""; const fc = hasil.data, n = fc.features.length, titik = fc.features.filter((f) => f.geometry.type === "Point"), props = [...new Set(titik.flatMap((f) => Object.keys(f.properties ?? {})))];
    if (!n) return ($("#pmInfo").textContent = "File tidak berisi fitur.");
    const ukuran = JSON.stringify(fc).length;
    const m = modal(`<h3>Impor ${esc(hasil.nama)}</h3><p class="muted">${n} fitur (${titik.length} titik). Ukuran ±${(ukuran / 1e6).toFixed(2)} MB.</p>
      <label>Simpan sebagai</label><select id="ijs"><option value="layer">Lapisan peta (titik/garis/poligon)</option>${bisaTulis && titik.length ? `<option value="rencana">Rencana titik bor</option>` : ""}</select>
      <div id="ilay"><label>Nama lapisan</label><input id="inm" value="${esc(hasil.nama.replace(/\.[^.]+$/, ""))}"><label>Warna</label><input id="iwr" type="color" value="#00b7ff" style="height:38px">
        <label>Tempat simpan</label><select id="itp">${bisaTulis ? `<option value="server">Server — terlihat semua pengguna</option>` : ""}<option value="lokal">HP ini saja</option></select></div>
      <div id="iren" style="display:none"><label>Kolom nama titik (Hole ID)</label><select id="ibh">${(() => { const pilih = [/^hole[_ -]?id$/i, /^bh[_ -]?id$/i, /^hole$/i, /^(name|nama|titik)$/i, /^id$/i].map((r) => props.find((p) => r.test(p))).find(Boolean);
          return props.map((p) => `<option ${p === pilih ? "selected" : ""}>${esc(p)}</option>`).join(""); })()}</select>
        <label>Kolom rencana kedalaman (opsional)</label><select id="ikd"><option value="">—</option>${props.map((p) => `<option ${/depth|kedalaman|target|eoh/i.test(p) ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        <p class="muted">Titik dengan Hole ID yang sudah ada akan diperbarui posisinya. Begitu ada foto Mulai bor dengan Hole ID yang sama, warnanya otomatis berubah dari Rencana → Progres → EOH/STB.</p></div>
      <div class="row" style="margin-top:10px"><button id="iok">Impor</button><button class="sec" id="icx">Batal</button></div><div id="ime" class="err"></div>`);
    m.querySelector("#ijs").onchange = (x) => { m.querySelector("#ilay").style.display = x.target.value === "layer" ? "" : "none"; m.querySelector("#iren").style.display = x.target.value === "rencana" ? "" : "none"; };
    m.querySelector("#icx").onclick = () => m.remove();
    m.querySelector("#iok").onclick = async () => {
      const jenis = m.querySelector("#ijs").value; m.querySelector("#iok").disabled = true;
      if (jenis === "rencana") {
        const kb = m.querySelector("#ibh").value, kk = m.querySelector("#ikd").value, proj = myTugas?.project ?? JSON.parse(localStorage.getItem("projects") || "[]")[0]?.code ?? null;
        const rows = titik.map((f) => ({ project: proj, bhid: String(f.properties?.[kb] ?? "").trim().toUpperCase(), lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
          rencana_kedalaman: kk ? Number(String(f.properties?.[kk] ?? "").replace(",", ".")) || null : null, sumber_file: hasil.nama })).filter((r) => r.bhid);
        const dup = rows.map((r) => r.bhid).filter((b2, i, a) => a.indexOf(b2) !== i); if (dup.length) { m.querySelector("#iok").disabled = false; return (m.querySelector("#ime").textContent = "Hole ID ganda di file: " + [...new Set(dup)].slice(0, 10).join(", ")); }
        const { error } = await sb.from("rencana_lubang").upsert(rows, { onConflict: "project,bhid" }); if (error) { m.querySelector("#iok").disabled = false; return (m.querySelector("#ime").textContent = error.message); }
        m.remove(); await muatLubang(); gambarLubang(); gambarKolom3D(); $("#pmInfo").textContent = `${rows.length} rencana titik bor diimpor.`; return;
      }
      const ly = { id: crypto.randomUUID(), nama: m.querySelector("#inm").value.trim() || hasil.nama, warna: m.querySelector("#iwr").value, geojson: fc };
      if (m.querySelector("#itp").value === "server") {
        if (ukuran > 6e6) { m.querySelector("#iok").disabled = false; return (m.querySelector("#ime").textContent = "File terlalu besar untuk server (>6 MB). Sederhanakan/potong ke area IUP dulu."); }
        const { data, error } = await sb.from("peta_layer").insert({ project: myTugas?.project ?? JSON.parse(localStorage.getItem("projects") || "[]")[0]?.code ?? null, nama: ly.nama, warna: ly.warna, geojson: fc, jumlah_fitur: n, sumber_file: hasil.nama }).select("id").single();
        if (error) { m.querySelector("#iok").disabled = false; return (m.querySelector("#ime").textContent = error.message); } ly.id = data.id; ly.server = true;
      } else { try { localStorage.setItem("petaLokal", JSON.stringify([...lapisanLokal(), ly])); } catch { m.querySelector("#iok").disabled = false; return (m.querySelector("#ime").textContent = "Penyimpanan HP penuh — file terlalu besar untuk disimpan lokal."); } ly.server = false; }
      m.remove(); LAY.push(ly); gambarLapisan(); terapkanVis(); panel();
      const bb = new maplibregl.LngLatBounds(); const tiap = (c) => (typeof c[0] === "number" ? bb.extend(c) : c.forEach(tiap)); fc.features.forEach((f) => tiap(f.geometry.coordinates)); if (!bb.isEmpty()) map.fitBounds(bb, { padding: 40, maxZoom: 16 });
      $("#pmInfo").textContent = `Lapisan “${ly.nama}” ditambahkan (${n} fitur).`;
    };
  };
  const popLubang = (f) => { const p = f.properties, c = f.geometry.coordinates, u = UTM.ke(c[0], c[1]);
    const pop = new maplibregl.Popup({ offset: 10 }).setLngLat(c).setHTML(`<b>${esc(p.bhid)}</b> · ${esc(LABEL_STATUS[p.status] ?? p.status)}<br>${p.kd != null ? `Kedalaman ${esc(p.kd)} m` : ""}${p.rk != null ? ` · rencana ${esc(p.rk)} m` : ""}${p.rig ? `<br>${esc(p.rig)}` : ""}${p.dip != null ? `<br>Dip ${esc(p.dip)}° · azimuth ${esc(p.az)}°` : ""}<br>E ${u[0].toFixed(1)} N ${u[1].toFixed(1)} <span class="muted">(${esc(p.pos)})</span>${p.dalam ? "" : `<br><b style="color:#c00">DI LUAR IUP</b>`}${isClient() ? "" : `<br><button class="sec" data-pakai="${esc(p.bhid)}" style="width:auto;padding:3px 10px;margin-top:6px">Pakai Hole ID ini di Progres bor</button>`}`).addTo(map);
    pop.getElement().insertAdjacentHTML("beforeend", `<button class="sec" data-prof style="margin-top:4px;width:auto;padding:6px 10px">📊 Profil bor</button>`);
    pop.getElement().querySelector("[data-prof]").addEventListener("click", () => profilModal(p.bhid));
    // v.34: koreksi salah ploting langsung dari peta (staf): ubah koordinat lubang, edit / hapus pembacaan marking yang salah
    if (isStaff()) { pop.getElement().insertAdjacentHTML("beforeend", `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"><button class="sec" data-kor style="width:auto;padding:6px 10px">🧭 Edit koordinat</button><button class="sec" data-mkl style="width:auto;padding:6px 10px">📍 Marking (edit / hapus)</button></div>`);
      pop.getElement().querySelector("[data-kor]").addEventListener("click", () => { pop.remove(); koordinatLubang(p.bhid, () => render()); });
      pop.getElement().querySelector("[data-mkl]").addEventListener("click", () => { pop.remove(); daftarMarking(p.bhid); }); }
    pop.getElement().querySelector("[data-pakai]")?.addEventListener("click", (e) => { localStorage.setItem("bhid", e.target.dataset.pakai); document.body.style.overflow = ""; tab = "prog"; localStorage.setItem("tab", tab); render(); }); };
  // ---- 3D: kolom log tiap lubang (warna layer) + topografi diredupkan agar lubang terlihat ----
  let PRF = JSON.parse(localStorage.getItem("petaProfil") || "[]");
  const muatProfil = async () => { if (!online() || !L.length) return; const { data } = await sb.from("v_profil_bor").select("bhid,dari_m,sampai_m,zona,nama_zona,warna").in("bhid", L.map((f) => f.properties.bhid)).order("bhid").order("dari_m");
    if (data) { PRF = data; try { localStorage.setItem("petaProfil", JSON.stringify(data)); } catch {} } };
  let HE3 = 1, N3 = 0;
  const gambarKolom3D = () => {
    const fs = [], dalam = (b, f) => Math.max(+f.properties.kd || 0, ...PRF.filter((r) => r.bhid === b).map((r) => +r.sampai_m));
    const maxD = Math.max(5, ...L.map((f) => dalam(f.properties.bhid, f)));
    // ukuran kolom mengikuti sebaran titik bor agar terlihat dari tampilan menyeluruh; panjang dapat diatur
    const cs = L.map((f) => f.geometry.coordinates), la = cs.length ? cs.reduce((t, c) => t + c[1], 0) / cs.length : 0, kx = 111320 * Math.cos((la * Math.PI) / 180);
    const span = cs.length > 1 ? Math.max((Math.max(...cs.map((c) => c[0])) - Math.min(...cs.map((c) => c[0]))) * kx, (Math.max(...cs.map((c) => c[1])) - Math.min(...cs.map((c) => c[1]))) * 110574) : 500;
    const kali = Number(localStorage.getItem("kolom3d") || 1), hw = Math.max(8, Math.min(60, span * 0.006));
    HE3 = Math.max(1, Math.round((Math.max(150, span * 0.09) * kali) / maxD));
    for (const f of L) { const b = f.properties.bhid, [lon, lat] = f.geometry.coordinates, D = dalam(b, f); if (!(D > 0)) continue;
      const dx = hw / (111320 * Math.cos((lat * Math.PI) / 180)), dy = hw / 110574, kotak = [[[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]]];
      const R = PRF.filter((r) => r.bhid === b), iv = R.length ? R.map((r) => [+r.dari_m, +r.sampai_m, r.warna, r.nama_zona]) : [[0, D, f.properties.warna, LABEL_STATUS[f.properties.status] ?? ""]];
      for (const [a0, b0, w, nm] of iv) fs.push({ type: "Feature", properties: { bhid: b, nm, base: (D - b0) * HE3, top: (D - a0) * HE3, warna: w || "#999" }, geometry: { type: "Polygon", coordinates: kotak } }); }
    const fc = { type: "FeatureCollection", features: fs }; N3 = new Set(fs.map((x) => x.properties.bhid)).size;
    if (map.getSource("lb3d")) map.getSource("lb3d").setData(fc);
    else { map.addSource("lb3d", { type: "geojson", data: fc });
      map.addLayer({ id: "lb3d", type: "fill-extrusion", source: "lb3d", layout: { visibility: map.getPitch() > 5 ? "visible" : "none" },
        paint: { "fill-extrusion-color": ["get", "warna"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": false } }); }
  };
  const TOPO3 = { redup: { sat: -0.75, kon: -0.45, bmin: 0.38, op: 0.75, hs: 0.12 }, sedang: { sat: -0.4, kon: -0.2, bmin: 0.18, op: 0.9, hs: 0.25 }, asli: { sat: 0, kon: 0, bmin: 0, op: 1, hs: 0.35 } };
  const terapkanTopo = () => { const is3 = map.getPitch() > 5, t = TOPO3[is3 ? localStorage.getItem("topo3d") || "redup" : "asli"] ?? TOPO3.redup;
    for (const id of ["sat", "osm"]) if (map.getLayer(id)) { map.setPaintProperty(id, "raster-saturation", t.sat); map.setPaintProperty(id, "raster-contrast", t.kon); map.setPaintProperty(id, "raster-brightness-min", t.bmin); map.setPaintProperty(id, "raster-opacity", t.op); }
    if (map.getLayer("hs")) map.setPaintProperty("hs", "hillshade-exaggeration", t.hs);
    if (map.getLayer("lb3d")) map.setLayoutProperty("lb3d", "visibility", is3 ? "visible" : "none");
    $("#pmTopo").style.display = is3 ? "" : "none"; $("#pmKl").style.display = is3 ? "" : "none";
    const n3 = N3;
    $("#pm3info").textContent = is3 ? `3D: ${n3} kolom lubang bor berdiri di atas collar, panjang diperbesar ${HE3}× · urutan seperti log (atas kolom = permukaan, dasar kolom = akhir lubang) · warna = layer dari Form Logging (lubang tanpa logging = warna status).` : ""; };
  const gambarLubang = () => {
    LBL.lubang.forEach((mk) => mk.remove());
    LBL.lubang = L.map((f) => { const p = f.properties, el = document.createElement("div"), r = p.status === "RENCANA" ? 11 : 15;
      el.style.cssText = "display:flex;align-items:center;gap:3px;cursor:pointer";
      // Redrill (v.15): lubang redrill bertanda 🔁 + bingkai ungu; lubang lama yang sudah diganti redrill tampil pudar & dicoret
      if (p.diganti) el.style.opacity = "0.5";
      el.innerHTML = `<span style="width:${r}px;height:${r}px;border-radius:50%;background:${p.warna};border:${p.redrill ? "3px solid #8E5BB5" : p.dalam ? "1.5px solid #111" : "3.5px solid #e00"};box-sizing:border-box;box-shadow:0 0 2px #fff"></span><span data-nm style="font:600 11px system-ui;color:#fff;background:${p.redrill ? "rgba(110,60,150,.85)" : "rgba(0,0,0,.55)"};padding:0 4px;border-radius:4px;white-space:nowrap${p.diganti ? ";text-decoration:line-through" : ""}" title="${p.redrill ? `Redrill dari ${esc(p.redrill)}` : p.diganti ? `Diganti redrill ${esc(p.diganti)}` : ""}">${p.redrill ? "🔁 " : ""}${esc(p.bhid)}${p.diganti ? ` → ${esc(p.diganti)}` : ""}</span>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); popLubang(f); });
      const mk = new maplibregl.Marker({ element: el, anchor: "left", offset: [-r / 2, 0], opacityWhenCovered: "1" }).setLngLat(f.geometry.coordinates); mk._st = p.status; return mk; });
    terapkanVis();
  };
  map.once("style.load", async () => {
    map.setTerrain({ source: "dem", exaggeration: eks() });
    // Relief dari DEMNAS (dibuat sekali di kantor, ikut tersimpan offline): warna elevasi, kemiringan lereng, kontur
    try { RK = await (await fetch("peta/kontur/index.json")).json();
      const kor = (b) => [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
      map.addSource("elev", { type: "image", url: "peta/kontur/elevasi.png", coordinates: kor(RK.elevasi.bbox) });
      map.addSource("lereng", { type: "image", url: "peta/kontur/lereng.png", coordinates: kor(RK.lereng.bbox) });
      map.addLayer({ id: "elev", type: "raster", source: "elev", layout: { visibility: "none" }, paint: { "raster-opacity": opRel(), "raster-fade-duration": 0 } });
      map.addLayer({ id: "lereng", type: "raster", source: "lereng", layout: { visibility: "none" }, paint: { "raster-opacity": opRel(), "raster-fade-duration": 0 } });
      map.addSource("kontur", { type: "geojson", data: "peta/kontur/kontur.geojson" });
      map.addLayer({ id: "kontur", type: "line", source: "kontur", layout: { visibility: "none", "line-join": "round" },
        paint: { "line-color": ["case", ["==", ["get", "i"], 1], "#5a2d0c", "#8a5a2b"], "line-width": ["case", ["==", ["get", "i"], 1], 1.6, 0.7], "line-opacity": 0.85 } });
    } catch (er) { console.warn("relief DEMNAS tidak dimuat", er); }
    // Citra/peta bergeoreferensi (mis. mosaik drone) per proyek — file statis di peta/citra, ikut tersimpan offline
    try { const pj = myTugas?.project; CT = (await (await fetch("peta/citra/index.json")).json()).filter((c) => !c.project || !pj || c.project === pj);
      const kor = (b) => [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
      for (const c of CT) { if (c.tiles) map.addSource("ct_" + c.id, { type: "raster", tiles: [new URL(c.tiles.split("{z}")[0], location.href).href + "{z}" + c.tiles.split("{z}")[1]], tileSize: 256, minzoom: c.minzoom ?? 13, maxzoom: c.maxzoom ?? 18, bounds: c.bbox });
        else map.addSource("ct_" + c.id, { type: "image", url: c.file, coordinates: kor(c.bbox) });
        map.addLayer({ id: "ct_" + c.id, type: "raster", source: "ct_" + c.id, layout: { visibility: "none" }, paint: { "raster-opacity": opCt(), "raster-fade-duration": 0 } }, map.getLayer("elev") ? "elev" : undefined); }
    } catch (er) { console.warn("citra overlay tidak dimuat", er); }
    const fc = { type: "FeatureCollection", features: W.map((w) => ({ type: "Feature", properties: { nama: w.nama }, geometry: { type: "Polygon", coordinates: [[...w.titik.map((t) => [t.lon, t.lat]), [w.titik[0].lon, w.titik[0].lat]]] } })) };
    map.addSource("iup", { type: "geojson", data: fc });
    map.addLayer({ id: "iup-isi", type: "fill", source: "iup", paint: { "fill-color": "#ff2d2d", "fill-opacity": 0.06 } });
    map.addLayer({ id: "iup-garis", type: "line", source: "iup", paint: { "line-color": "#ff2d2d", "line-width": 2.5 } });
    LBL.iup = W.flatMap((w) => w.titik.map((t, k) => label([t.lon, t.lat], String(t.no ?? k + 1), "background:rgba(190,0,0,.75)")));
    map.addSource("trk", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource("trkSimpan", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "trkSimpan", type: "line", source: "trkSimpan", paint: { "line-color": "#ff00d4", "line-width": 3 } });
    map.addLayer({ id: "trk", type: "line", source: "trk", paint: { "line-color": "#00e5ff", "line-width": 3.5, "line-dasharray": [2, 1] } });

    await Promise.all([muatLubang(), muatLapisan()]); await muatProfil().catch(() => {}); gambarLubang(); gambarKolom3D(); terapkanTopo(); gambarLapisan(); gambarTrack(); terapkanVis(); panel();
    if (trk) mulaiLacak();
    const hit = (st) => L.filter((f) => f.properties.status === st).length;
    $("#pmInfo").textContent = `${L.length} lubang (rencana ${hit("RENCANA")}, progres ${hit("PROGRES")}, EOH ${hit("EOH")}, STB ${hit("STB")}) · ${LAY.length} lapisan tambahan · ketuk peta untuk koordinat & elevasi${online() ? "" : " · OFFLINE: data terakhir yang tersimpan"}`;
  });
  const info = async (ll) => { const zu = zonaUTMDari(ll.lng, ll.lat), u = buatUTM(zu.zona, zu.selatan).ke(ll.lng, ll.lat), h = await tinggiDi(ll.lng, ll.lat), i = W.length ? (W.some((w) => diDalam(ll.lng, ll.lat, w.titik)) ? "di dalam IUP" : "di luar IUP") : "";
    const lr = await lerengDi(ll.lng, ll.lat);
    $("#pmInfo").textContent = `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)} · UTM ${zu.zona}${zu.selatan ? "S" : "N"} E ${u[0].toFixed(1)} N ${u[1].toFixed(1)}${h != null ? ` · elevasi DEM ±${h.toFixed(1)} m` : ""}${lr != null ? ` · lereng ±${Math.round(lr)} % (${(Math.atan(lr / 100) * 180 / Math.PI).toFixed(0)}°)` : ""}${i ? " · " + i : ""}`; };
  // lereng di titik ketuk: dari 4 tetangga ±10 m di DEM
  const lerengDi = async (lon, lat) => { const d = 10 / 111320, dx = d / Math.cos((lat * Math.PI) / 180);
    const [e, w, n, s2] = await Promise.all([tinggiDi(lon + dx, lat), tinggiDi(lon - dx, lat), tinggiDi(lon, lat + d), tinggiDi(lon, lat - d)]);
    if ([e, w, n, s2].some((x) => x == null)) return null; return Math.hypot((e - w) / 20, (n - s2) / 20) * 100; };
  map.on("click", (e) => info(e.lngLat));
  geo.on("geolocate", (p) => { if (watch === null) info({ lng: p.coords.longitude, lat: p.coords.latitude }); });
  $("#pmB").onchange = (e) => { ["sat", "osm"].forEach((k) => map.setLayoutProperty(k, "visibility", e.target.value === k ? "visible" : "none")); };
  $("#pm3").onclick = () => { const p = map.getPitch() > 5 ? 0 : 65, cs = L.filter((f) => +f.properties.kd > 0 || PRF.some((r) => r.bhid === f.properties.bhid)).map((f) => f.geometry.coordinates);
    if (p && cs.length) { const bb = new maplibregl.LngLatBounds(); cs.forEach((c) => bb.extend(c)); map.fitBounds(bb, { pitch: p, bearing: -20, padding: { top: 140, bottom: 60, left: 60, right: 60 }, maxZoom: 16.5, duration: 1000 }); }
    else map.easeTo({ pitch: p, bearing: p ? -20 : 0, duration: 800 }); $("#pm3").textContent = p ? "2D" : "3D"; };
  // keadaan peta di layar saat ini → ekspor PDF mengikuti tampilan (latar, lapisan tercentang, status lubang, nama, cakupan)
  const tampilanPeta = () => { const b = map.getBounds(); return { basemap: $("#pmB").value,
    vis: { hs: tampil("hs", true), iup: tampil("iup"), iupno: tampil("iupno", true), kontur: tampil("kontur", false), elev: tampil("elev", false), lereng: tampil("lereng", false), lbl: tampil("lbl"),
      st: Object.fromEntries(Object.keys(LABEL_STATUS).map((k) => [k, tampil("st_" + k)])) },
    citra: CT.filter((c) => tampil("ct_" + c.id, c.tampil !== false)).map((c) => String(c.id)), lapisan: LAY.filter((ly) => tampil("ly_" + ly.id)).map((ly) => String(ly.id)),
    opRel: opRel(), opCt: opCt(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] }; };
  $("#pmA3").onclick = () => petaA3Dialog(L.map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], kedalaman: f.properties.kedalaman ?? f.properties.kd, rencana_kedalaman: f.properties.rencana_kedalaman ?? f.properties.rk })), { tampilan: tampilanPeta(), peta: map });
  $("#pmBP").onclick = () => bawahPermukaan3D(L.map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })), PRF);
  $("#pmK").oninput = (e) => { localStorage.setItem("kolom3d", e.target.value); gambarKolom3D(); terapkanTopo(); };
  map.on("pitchend", () => { $("#pm3").textContent = map.getPitch() > 5 ? "2D" : "3D"; terapkanTopo(); });
  $("#pmTopo").onchange = (e) => { localStorage.setItem("topo3d", e.target.value); terapkanTopo(); };
  $("#pmX").oninput = () => { $("#pmXv").textContent = String(eks()).replace(".", ",") + "×"; if (map.getTerrain()) map.setTerrain({ source: "dem", exaggeration: eks() }); };
  $("#pmL").onclick = () => { const p = $("#pmPanel"); p.style.display = p.style.display === "none" ? "" : "none"; };
  // Layar penuh: tombol ⛶ di dalam peta (pojok kanan atas, seperti aplikasi peta lain). Saat penuh, hanya peta yang tampil;
  // tombol ☰ membuka panel lapisan di atas peta, info koordinat tampil di bawah. Android menyembunyikan bilah browser; iPhone cukup penuh halaman.
  const kartu = $("#pmCard"), pm = $("#pmap"), simpanGaya = new Map();
  const gaya = (el, css) => { if (!el) return; if (!simpanGaya.has(el)) simpanGaya.set(el, el.getAttribute("style") ?? ""); el.setAttribute("style", css); };
  const aturPenuh = (on) => {
    kartu.dataset.penuh = on ? "1" : "";
    if (on) {
      gaya(kartu, "position:fixed;inset:0;z-index:60;margin:0;border-radius:0;padding:0;overflow:hidden;background:#000");
      gaya(kartu.firstElementChild, "display:none");
      gaya(pm, "height:100dvh;margin:0;border-radius:0;overflow:hidden;background:#dfe5df");
      gaya($("#pmPanel"), `position:absolute;top:8px;left:8px;right:52px;z-index:6;max-height:72dvh;overflow:auto;margin:0;padding:8px;background:rgba(246,247,242,.97);display:${$("#pmPanel").style.display === "none" ? "none" : ""}`);
      gaya($("#pmInfo"), "position:absolute;left:8px;right:52px;bottom:30px;z-index:5;margin:0;padding:3px 8px;border-radius:8px;background:rgba(255,255,255,.88);font-size:12px;min-height:0");
      gaya(kartu.lastElementChild, "display:none");
    } else { for (const [el, css] of simpanGaya) { const tampilPanel = el.id === "pmPanel" ? el.style.display : null; el.setAttribute("style", css); if (tampilPanel !== null) el.style.display = tampilPanel; } simpanGaya.clear(); }
    document.body.style.overflow = on ? "hidden" : "";
    const b = kartu.querySelector("[data-penuh]"); if (b) { b.textContent = on ? "✕" : "⛶"; b.title = on ? "Keluar layar penuh" : "Layar penuh"; }
    setTimeout(() => map.resize(), 60);
  };
  const togglePenuh = async () => {
    const on = !kartu.dataset.penuh; aturPenuh(on);
    try { if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
          else if (!on && document.fullscreenElement) await document.exitFullscreen(); } catch { /* iPhone: cukup tampilan penuh halaman */ }
  };
  map.addControl({ onAdd: () => { const d = document.createElement("div"); d.className = "maplibregl-ctrl maplibregl-ctrl-group";
      d.innerHTML = `<button type="button" data-penuh title="Layar penuh" style="font-size:17px;line-height:1">⛶</button><button type="button" data-lapis title="Lapisan" style="font-size:16px;line-height:1">☰</button>`;
      d.querySelector("[data-penuh]").onclick = togglePenuh; d.querySelector("[data-lapis]").onclick = () => $("#pmL").click(); return d; },
    onRemove: () => {} }, "top-right");
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && kartu.isConnected && kartu.dataset.penuh) aturPenuh(false); });
  $("#pmI").onclick = () => map.fitBounds([[121.7387, -1.726], [121.7784, -1.6327]], { padding: 30, duration: 800 });
  // Simpan relief + pustaka peta ke HP agar peta bisa dibuka tanpa sinyal (citra satelit tidak ikut — perlu sinyal)
  $("#pmO").onclick = async () => {
    if (!online()) return alert("Perlu sinyal untuk menyimpan.");
    try { const idx = await (await fetch("peta/dem/index.json", { cache: "no-cache" })).json(), c = await caches.open("tgep-peta"),
        ci = await (await fetch("peta/citra/index.json", { cache: "no-cache" })).json().catch(() => []),
        U = ["vendor/maplibre-gl.js", "vendor/maplibre-gl.css", "vendor/three.module.min.js", "vendor/OrbitControls.js", "vendor/shp.min.js", "vendor/togeojson.umd.js", "vendor/jszip.min.js", "peta/dem/index.json", "peta/kontur/index.json", "peta/kontur/kontur.geojson", "peta/kontur/elevasi.png", "peta/kontur/lereng.png", "peta/citra/index.json", ...ci.filter((x) => x.file).map((x) => x.file), ...idx.tiles];
      for (const x of ci.filter((x) => x.daftar)) { U.push(x.daftar); try { U.push(...(await (await fetch(x.daftar, { cache: "no-cache" })).json())); } catch {} }
      let i = 0; for (const u of U) { await c.add(u); if (++i % 10 === 0) $("#pmInfo").textContent = `Menyimpan peta offline… ${i}/${U.length}`; }
      $("#pmInfo").textContent = `Peta offline tersimpan (${U.length} file). Relief, citra drone, GPS, batas IUP, lubang & lapisan tetap bisa dibuka tanpa sinyal; citra satelit tersimpan otomatis untuk area yang pernah ditampilkan.`;
    } catch (er) { $("#pmInfo").textContent = "Gagal menyimpan offline: " + er.message; }
  };
}
async function dbView(v) {
  const keys = dsAllowed() ?? Object.keys(DATASETS).filter((k) => !DATASETS[k].admin || me?.role === "admin");
  const st = JSON.parse(sessionStorage.getItem("dbst") || '{"ds":"collar","bh":"","bad":false,"page":0}');
  if (!keys.includes(st.ds)) st.ds = keys[0];
  v.innerHTML = `<div class="card"><h2>Database TGEP</h2>
   <p class="muted">Data yang sama dengan aplikasi lapangan, dalam format data bor standar (Collar · Survey · Geology · Density · Assay). Unduhan bisa dibuka di Excel, Leapfrog, Micromine, Surpac, Datamine, QGIS.</p>
   <div class="row" style="flex-wrap:wrap;align-items:flex-end">
    <div><label>Tabel</label><select id="ds">${keys.map((k) => `<option value="${k}" ${st.ds === k ? "selected" : ""}>${DATASETS[k].t}</option>`).join("")}</select></div>
    ${proyekSelect()}
    <div><label>Hole ID (sebagian)</label><input id="fb" value="${esc(st.bh)}" placeholder="mis. TGE00"></div>
    <div style="flex:0 0 120px"><label>Unit rig</label><select id="frig"><option value="">Semua rig</option>${[...new Set([...(myTugas?.rigs ?? []), ...JSON.parse(localStorage.getItem("daftarRig") || "[]")])].sort(urutBH).map((r) => `<option ${st.rig === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
    <div><label>Lubang</label><select id="flub"><option value="aktif" ${(st.lub ?? "aktif") === "aktif" ? "selected" : ""}>Aktif (pakai redrill)</option><option value="arsip" ${st.lub === "arsip" ? "selected" : ""}>Arsip lubang lama (sudah di-redrill)</option><option value="semua" ${st.lub === "semua" ? "selected" : ""}>Semua lubang</option></select></div>
    <div style="flex:0;white-space:nowrap"><label><input type="checkbox" id="fbad" ${st.bad ? "checked" : ""} style="width:auto"> hanya yang bermasalah</label></div>
    <button id="go" style="flex:0">Tampilkan</button>
    <button class="sec" id="xl" style="flex:0">Unduh Excel (semua tabel)</button>
    <button class="sec" id="csv" style="flex:0">Unduh CSV tabel ini</button>
    ${isClient() ? "" : `<button id="acc" style="flex:0;white-space:nowrap">Unduh database FIX (Access)</button><button class="sec" id="accm" style="flex:0;white-space:nowrap">Macro impor Access</button>`}
   </div><div id="info" class="muted" style="margin-top:8px"></div></div>
   <div id="ed"></div><div class="card"><div id="tb"></div><div class="row" style="margin-top:8px"><button class="sec" id="pv" style="flex:0">← Sebelumnya</button><button class="sec" id="nx" style="flex:0">Berikutnya →</button></div></div>`;
  $("#acc")?.addEventListener("click", () => unduhFix($("#info")));
  $("#accm")?.addEventListener("click", unduhMacroAccess);
  let projF = null, RD = {};
  const read = () => ({ ds: $("#ds").value, bh: $("#fb").value.trim().toUpperCase(), bad: $("#fbad").checked, page: st.page, proj: projF, lub: $("#flub").value, rd: RD, rig: $("#frig").value, rigBH: RIGBH[$("#frig").value] ?? [] });
  // v.33: filter Unit rig — sheet yang punya kolom rig difilter langsung; sheet per lubang/conto difilter dengan Hole ID yang dibor rig itu (DDR, progres bor, data lubang)
  let RIGBH = {};
  if (online()) { const [{ data: a }, { data: b2 }, { data: c }] = await Promise.all([sb.from("v_ddr_baris").select("rig,bhid").limit(5000), sb.from("drill_event").select("rig,bhid").not("bhid", "is", null).limit(5000), sb.from("borehole").select("rigmc_id,bhid")]);
    const M = {}; for (const x of [...(a ?? []), ...(b2 ?? []), ...(c ?? []).map((y) => ({ rig: y.rigmc_id, bhid: y.bhid }))]) { const r = String(x.rig ?? "").trim().toUpperCase().replace(/\s+/g, " "); if (!r || !x.bhid) continue; (M[r] ??= new Set()).add(x.bhid); }
    RIGBH = Object.fromEntries(Object.entries(M).map(([r, s]) => [r, [...s]]));
    const lama = $("#frig").value, rigs = [...new Set([...Object.keys(RIGBH), ...(myTugas?.rigs ?? [])])].sort(urutBH); try { localStorage.setItem("daftarRig", JSON.stringify(rigs)); } catch {}
    $("#frig").innerHTML = `<option value="">Semua rig</option>${rigs.map((r) => `<option ${r === (lama || st.rig) ? "selected" : ""}>${esc(r)}</option>`).join("")}`; }
  $("#frig").onchange = () => $("#go").click();
  RD = await petaRedrill().catch(() => ({}));
  $("#flub").onchange = () => $("#go").click();
  $("#fproj").onchange = async () => { sessionStorage.setItem("filterProyek", $("#fproj").value); projF = await proyekFilter(); };
  projF = await proyekFilter();
  const show = async (page = 0) => {
    const f = read(); f.page = page; sessionStorage.setItem("dbst", JSON.stringify({ ...f, proj: undefined, rd: undefined, rigBH: undefined })); st.page = page;
    const d = DATASETS[f.ds]; $("#tb").innerHTML = `<p class="muted">Memuat…</p>`;
    const { data: data0, count, error } = await dbQuery(d, f).range(page * 200, page * 200 + 199), data = tanpaBBM(data0);
    if (error) return ($("#tb").innerHTML = `<p class="err">${esc(error.message)}</p>`);
    const nRd = Object.keys(RD).length, geo = GEO_V.has(d.v);
    $("#info").innerHTML = `${count ?? 0} baris · halaman ${page + 1} dari ${Math.max(1, Math.ceil((count ?? 0) / 200))}${nRd && geo ? ` · <span title="${esc(Object.entries(RD).map(([a, b]) => `${a} → ${b}`).join(", "))}">${f.lub === "arsip" ? "🗄 menampilkan ARSIP lubang lama yang sudah di-redrill" : f.lub === "semua" ? "semua lubang termasuk lubang lama yang sudah di-redrill" : `${nRd} lubang lama yang sudah di-redrill disembunyikan (${esc(Object.entries(RD).map(([a, b]) => `${a} → ${b}`).join(", "))}) — lihat pilihan Lubang: Arsip`}</span>` : ""}`;
    $("#pv").disabled = page === 0; $("#nx").disabled = (page + 1) * 200 >= (count ?? 0);
    if (!data?.length) return ($("#tb").innerHTML = `<p class="muted">Tidak ada data.</p>`);
    const cols = Object.keys(data[0]).filter((c) => !["data", "related"].includes(c));
    const canDel = me?.role === "admin" && d.del, canRes = me?.role === "admin" && f.ds === "arsip", canPr = f.ds === "ddr";
    const verDb = isStaff(), canEd = (verDb && ["geology", "density"].includes(f.ds) && cols.includes("sample_no")) || (isStaff() && f.ds === "collar"), canEdD = verDb && f.ds === "ddr";
    const fc = FILE_COL[f.ds] ?? {}, DV = await petaDrive(data, fc);
    const cell = (c, x) => { if (fc[c] && x) { const dv = DV[fc[c] + ":" + x]; return `<td style="padding:4px 7px;white-space:nowrap"><button class="sec" data-fb="${fc[c]}" data-fp="${esc(x)}" style="padding:2px 10px">Buka</button> ${dv ? `<a href="${esc(dv)}" target="_blank" rel="noopener" class="pill" style="background:#C8EBD4;color:#12251E;text-decoration:none" title="Buka salinan di Google Drive">Drive</a> ` : `<span class="muted" title="Belum tersalin ke Google Drive (disalin otomatis tiap 10 menit)">·</span> `}<a href="#" data-fl="${esc(dv || linkFile(fc[c], x))}" title="Salin link permanen${dv ? " (Google Drive)" : ""}" style="text-decoration:none">🔗</a></td>`; }
      const s = x !== null && typeof x === "object" ? JSON.stringify(x) : x; const bad = c.startsWith("chk_") && x && !OKV.has(x); return `<td style="padding:4px 7px;white-space:nowrap;${bad ? "background:#F6C9C3" : ""}">${esc(s)}</td>`; };
    $("#tb").innerHTML = `<div class="tw"><table><tr>${canPr ? "<th></th>" : ""}${canDel ? "<th></th>" : ""}${canRes ? "<th></th>" : ""}${canEd ? "<th></th>" : ""}${cols.map((c) => `<th style="padding:4px 7px">${esc(c)}</th>`).join("")}</tr>
      ${data.map((r) => `<tr>${canPr ? `<td style="white-space:nowrap"><button class="sec" data-pr="${esc(r.id)}" style="padding:2px 8px;white-space:nowrap">Lihat / cetak</button>${canEdD ? `${r.status !== "SIGNED" ? ` <button data-edd="${esc(r.id)}" style="padding:2px 8px;width:auto">✏️ Edit DDR</button>` : ""}` : ""}</td>` : ""}${canEd ? `<td>${f.ds === "collar" ? `<button class="sec" data-ko="${esc(r.holeid)}" style="padding:2px 8px;width:auto;white-space:nowrap">🧭 Koordinat</button>` : `<button class="sec" data-es="${esc(r.sample_no)}" style="padding:2px 8px;width:auto;white-space:nowrap">✏️ Edit</button>`}</td>` : ""}${canDel ? `<td><button class="danger" data-k="${esc(r[d.del[1]])}" style="padding:2px 8px">Hapus</button></td>` : ""}${canRes ? `<td>${r.restored_at ? "dipulihkan" : `<button class="sec" data-r="${r.id}" style="padding:2px 8px">Pulihkan</button>`}</td>` : ""}${cols.map((c) => cell(c, r[c])).join("")}</tr>`).join("")}</table></div>`;
    $("#tb").querySelectorAll("[data-k]").forEach((b) => (b.onclick = async () => { if (await adminDelete(d.del[0], b.dataset.k, "conto")) show(page); }));
    $("#tb").querySelectorAll("[data-fb]").forEach((b) => (b.onclick = () => bukaFile(b.dataset.fb, b.dataset.fp)));
    $("#tb").querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.pr)));
    $("#tb").querySelectorAll("[data-es]").forEach((b) => (b.onclick = () => editSample(b.dataset.es, () => show(page))));
    $("#tb").querySelectorAll("[data-ko]").forEach((b) => (b.onclick = () => koordinatLubang(b.dataset.ko, () => show(page))));
    $("#tb").querySelectorAll("[data-edd]").forEach((b) => (b.onclick = () => editDDR(b.dataset.edd)));
    $("#tb").querySelectorAll("[data-edr]").forEach((b) => (b.onclick = () => editRunDDR(b.dataset.edr)));
    $("#tb").querySelectorAll("[data-fl]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(a.dataset.fl); a.textContent = "✓"; setTimeout(() => (a.textContent = "🔗"), 1200); } catch { prompt("Salin link ini:", a.dataset.fl); } }));
    $("#tb").querySelectorAll("[data-r]").forEach((b) => (b.onclick = async () => { const { error } = await sb.rpc("admin_restore", { p_id: Number(b.dataset.r) }); if (error) alert(error.message); else show(page); }));
    pasangEditTabel($("#tb"), f.ds, data, () => show(page)); // v.20: bilah ✏️ Edit di atas tabel + klik kanan / tekan lama
  };
  $("#go").onclick = () => show(0); $("#pv").onclick = () => show(st.page - 1); $("#nx").onclick = () => show(st.page + 1);
  $("#ds").onchange = () => show(0);
  const tag = () => { const f = read(); return `${f.rig ? f.rig.replace(/\s+/g, "") + "_" : ""}${f.bh ? f.bh + "_" : ""}${new Date().toISOString().slice(0, 10)}`; };
  $("#csv").onclick = async () => {
    const f = read(), d = DATASETS[f.ds]; $("#info").textContent = "Menyiapkan CSV…";
    try { const rows = await tambahLink(f.ds, await fetchAll(d, f)); if (!rows.length) return ($("#info").textContent = "Tidak ada data.");
      const cols = Object.keys(rows[0]).filter((c) => !["data", "related"].includes(c));
      const q = (x) => { if (x === null || x === undefined) return ""; const s = typeof x === "object" ? JSON.stringify(x) : String(x); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const csv = "\ufeff" + [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `TGEP_${f.ds}_${tag()}.csv` }); a.click();
      $("#info").textContent = `CSV ${rows.length} baris diunduh (pemisah koma, desimal titik — format standar untuk software).`;
    } catch (e) { $("#info").textContent = e.message; }
  };
  $("#xl").onclick = async () => {
    const f = read(); $("#info").textContent = "Menyiapkan Excel…";
    try {
      const X = await import("./vendor/xlsx.js"); const wb = X.utils.book_new();
      const got = {};
      for (const k of dsAllowed() ?? ["collar", "survey", "geology", "density", "assay", "qaqc", "foto", "progres", "aktivitas", "p2h", "ddr", "rekapddr", "ddrlubang", "jam", "bbm", "lubang", "kinerja", "logging", "kepatuhan", "profil", "marking", "corefile", "scanfile", "arsipfoto"]) {
        const rows = (await tambahLink(k, await fetchAll(DATASETS[k], { ...f, bad: false }))).map((r) => { const o = { ...r }; delete o.data; delete o.related; for (const c in o) if (Array.isArray(o[c])) o[c] = o[c].join("; "); return o; }); got[k] = rows;
        X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), DATASETS[k].t.slice(0, 31).replace(/[\\/?*\[\]:]/g, " "));
      }
      // lubang lama yang sudah di-redrill: disimpan di sheet arsip tersendiri (tidak tercampur dengan data lubang aktif)
      if ((f.lub ?? "aktif") === "aktif" && Object.keys(RD).length) for (const k of ["collar", "geology", "density", "lubang"].filter((k) => (dsAllowed() ?? Object.keys(DATASETS)).includes(k))) {
        const rows = (await fetchAll(DATASETS[k], { ...f, bad: false, lub: "arsip" })).map((r) => { const o = { ...r }; delete o.data; delete o.related; for (const c in o) if (Array.isArray(o[c])) o[c] = o[c].join("; "); return o; });
        if (rows.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), `Arsip redrill ${k}`.slice(0, 31)); }
      const { data: tmx } = await sb.from("v_dash_time").select("*");
      got.lubang ??= []; const K = computeKPI(got.kinerja, tmx ?? [], got.bbm ?? [], got.lubang.filter((h) => h.jumlah_conto > 0)).filter(([l]) => !isClient() || (l !== "Foto core lengkap" && !/BBM|Oli/i.test(l) && (clientGeo() || !GEO_KPI.includes(l))));
      const aoa = [["DASHBOARD RINGKASAN — TGEP", "", `dibuat ${new Date().toLocaleString("id-ID")}`], [], ["Indikator", "Nilai"], ...K.map(([a, b]) => [a, b]), [], isClient() ? ["Meter per rig", "Meter", "", "", "Jam bor", "m/jam"] : ["Meter & BBM per rig", "Meter", "BBM (L)", "L/m", "Jam bor", "m/jam"]];
      const rg = {}; for (const d of got.kinerja) { const r = (rg[d.rig] ??= { m: 0, b: 0, j: 0 }); r.m += +d.meter_bor || 0; r.b += +d.bbm_liter || 0; r.j += +d.jam_kerja_bor || 0; }
      for (const [r, x] of Object.entries(rg)) aoa.push([r, +x.m.toFixed(2), isClient() ? "" : +x.b.toFixed(1), isClient() ? "" : x.m ? +(x.b / x.m).toFixed(2) : "", +x.j.toFixed(2), x.j ? +(x.m / x.j).toFixed(2) : ""]);
      aoa.push([], ["Tebal zona per lubang", "Limonit (m)", "Saprolit (m)", "Conto", "Recovery %"]);
      for (const h of got.lubang.filter((h) => h.jumlah_conto > 0)) aoa.push([h.bhid, h.tebal_limonit, h.tebal_saprolit, h.jumlah_conto, h.recovery_pct]);
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), "Dashboard");
      X.writeFile(wb, `TGEP_Database_${tag()}.xlsx`); $("#info").textContent = isClient() ? "Excel diunduh (sheet terakhir = Dashboard)." : "Excel diunduh (semua tabel termasuk Marking koordinat, Rekap operator & Status Form Logging; sheet terakhir = Dashboard). Salinan Excel otomatis tiap malam 20.47 WIB ada di Google Drive: TGEP Drill Log / 03 Ekspor Database Harian; file foto & scan di 04 File Database.";
    } catch (e) { $("#info").textContent = e.message; }
  };
  show(st.page || 0);
}

// ---------- koreksi data tersimpan ----------
const EDITABLE = [...SHEET.filter(([k]) => k !== "seq" && k !== "geolithcode_prc_2"), ["geolithcode_prc_2", "%2"], ["d_wtr_volume_ml", "Vol1 ml"], ["recheck_weight_kg", "Timbang ulang kg (crosscheck)"]];
async function editSample(no, done) {
  const ed = $("#ed"); ed.innerHTML = `<p class="muted">Memuat ${esc(no)}…</p>`;
  const [{ data: s }, { data: log }] = await Promise.all([
    sb.from("sample").select("*").eq("sample_no", no).single(),
    sb.from("sample_edit_log").select("field,old_value,new_value,reason,edited_at").eq("sample_no", no).order("edited_at", { ascending: false }),
  ]);
  ed.innerHTML = `<div class="card"><h3>Koreksi ${esc(no)}</h3><div class="tw"><table><tr>${EDITABLE.map(([, t]) => `<th>${t}</th>`).join("")}</tr>
    <tr>${EDITABLE.map(([k]) => `<td><input data-k="${k}" value="${esc(s?.[k] ?? "")}" inputmode="${NUMERIC.has(k) || k === "d_wtr_volume_ml" || k === "geolithcode_prc_2" ? "decimal" : "text"}"></td>`).join("")}</tr></table></div>
    <label>Alasan koreksi (wajib)</label><input id="rs" placeholder="mis. salah koma, dicek ulang di foto">
    <div class="row" style="margin-top:8px"><button id="sv">Simpan koreksi</button><button class="sec" id="cx">Batal</button></div><div id="ee" class="err"></div>
    <h3>Riwayat koreksi</h3><ul class="list">${(log ?? []).map((l) => `<li><span>${esc(l.field)}: ${esc(l.old_value)} → <b>${esc(l.new_value)}</b> · ${esc(l.reason)} <span class="muted">${new Date(l.edited_at).toLocaleString("id-ID")}</span></span></li>`).join("") || `<li class="muted">Belum pernah dikoreksi.</li>`}</ul></div>`;
  ed.scrollIntoView({ behavior: "smooth" });
  $("#cx").onclick = () => (ed.innerHTML = "");
  $("#sv").onclick = async () => {
    const ch = {};
    ed.querySelectorAll("input[data-k]").forEach((i) => {
      const k = i.dataset.k, raw = i.value.trim(), num = NUMERIC.has(k) || ["d_wtr_volume_ml", "geolithcode_prc_2"].includes(k);
      const val = raw === "" ? null : num ? Number(raw.replace(",", ".")) : raw;
      if (num && val !== null && !isFinite(val)) { $("#ee").textContent = `${k} bukan angka`; throw new Error("x"); }
      const old = s?.[k] ?? null;
      if (String(old ?? "") !== String(val ?? "") && !(num && old !== null && val !== null && Number(old) === val)) ch[k] = val;
    });
    if (!Object.keys(ch).length) return ($("#ee").textContent = "Tidak ada perubahan.");
    const { data: r, error } = await sb.rpc("correct_sample", { p_sample_no: no, p_changes: ch, p_reason: $("#rs").value });
    if (error) return ($("#ee").textContent = error.message);
    ed.innerHTML = `<p class="muted">${r.fields_changed} kolom dikoreksi. Hasil cek dihitung ulang.</p>`; done();
  };
}

// ---------- sesi ----------
async function loadMe() {
  if (!session) { me = null; return; }
  if (session.offline) { me = JSON.parse(localStorage.getItem("me") || "null"); return; }
  const { data, error } = await sb.from("app_user").select("full_name,role,wajib_ganti_pw,dihapus_at,is_owner").eq("user_id", session.user.id).maybeSingle();
  if (error) { me = JSON.parse(localStorage.getItem("me") || "null"); return; }   // gangguan jaringan: pakai identitas terakhir
  if (!data || data.role === "nonaktif") {
    // Tutup akses total HANYA bila server autentikasi memastikan akun dihapus/diblokir, atau peran tertulis "nonaktif".
    // Data akun yang sesaat tidak terbaca TIDAK dianggap dihapus (pakai identitas terakhir).
    if (data?.role === "nonaktif") return aksesDicabut(data.dihapus_at ? "dihapus" : "dinonaktifkan");
    if (localStorage.getItem("me")) {
      const { data: u, error: ue } = await sb.auth.getUser();
      if (ue && /not.?found|does not exist|banned|user_not_found|user_banned/i.test(ue.message + " " + (ue.code ?? ""))) return aksesDicabut(/banned/i.test(ue.message + (ue.code ?? "")) ? "dinonaktifkan" : "dihapus");
      if (ue || !u?.user) { me = JSON.parse(localStorage.getItem("me") || "null"); return; }
      const { data: d2 } = await sb.from("app_user").select("full_name,role").eq("user_id", session.user.id).maybeSingle();
      if (d2 && d2.role !== "nonaktif") { me = d2; localStorage.setItem("me", JSON.stringify(d2)); return; }
      if (d2?.role === "nonaktif") return aksesDicabut("dinonaktifkan");
    }
    me = null; return;   // pendaftar baru: menunggu persetujuan
  }
  me = data; localStorage.setItem("me", JSON.stringify(data));
  if (data.wajib_ganti_pw) setTimeout(() => buatSandiBaru("Anda masuk dengan kata sandi sementara dari admin. Buat kata sandi baru Anda sendiri sebelum melanjutkan."), 300);
}
async function aksesDicabut(jenis) {
  me = null; session = null;
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  localStorage.setItem("aksesDicabut", jenis); localStorage.setItem("manualLogout", "1");
  try { await sb.auth.signOut({ scope: "local" }); } catch {}
}
// Mode offline: bila token tidak bisa diperbarui karena tidak ada sinyal, pakai identitas terakhir
// supaya tetap bisa memotret. Antrean baru dikirim setelah login sah saat online.
function offlineSession() {
  const u = JSON.parse(localStorage.getItem("lastUser") || "null");
  return !navigator.onLine && u ? { user: u, offline: true } : null;
}
sb.auth.onAuthStateChange(async (e, s) => {
  if (s) localStorage.setItem("lastUser", JSON.stringify({ id: s.user.id, email: s.user.email }));
  if (!s && e === "SIGNED_OUT" && navigator.onLine) { localStorage.removeItem("lastUser"); localStorage.removeItem("me"); } // sesi ditolak server saat online (akun dihapus/diblokir): mode offline ikut ditutup
  session = s ?? (e === "SIGNED_OUT" && !localStorage.getItem("manualLogout") ? offlineSession() : null);
  localStorage.removeItem("manualLogout");
  await loadMe(); render(); if (s) sync();
  if (e === "PASSWORD_RECOVERY") setTimeout(() => buatSandiBaru("Anda membuka link reset kata sandi dari email. Buat kata sandi baru untuk akun ini."), 300);
});
addEventListener("online", async () => { const { data } = await sb.auth.getSession(); if (data.session) { session = data.session; render(); sync(); } else if (session?.offline) { session = null; render(); } });
const { data: s0 } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
session = s0?.session ?? offlineSession(); await loadMe(); render(); sync();

// =====================================================================================================
// ---------- ADMIN LAPANGAN: keuangan lapangan (nota, bukti transfer/pembayaran) + absensi tim berangkat/pulang ----------
// Data ini internal perusahaan: hanya admin_lapangan (proyeknya sendiri) dan admin (Jakarta). Tidak masuk Dashboard,
// tidak terlihat client/verifier (dijaga RLS di server), dan salinan Drive masuk folder "Keuangan (internal)".
// =====================================================================================================
const KEU_KAT = { KELUAR: ["BBM", "Konsumsi / makan", "Akomodasi / sewa mes", "Transportasi & ojek", "Upah harian / tenaga lokal", "Sewa alat / kendaraan", "Material & consumable bor",
  "Suku cadang & perbaikan", "Air & logistik", "ATK & cetak", "Kesehatan & K3", "Komunikasi / pulsa", "Retribusi & izin lokal", "Kasbon / uang muka", "Lain-lain"],
  MASUK: ["Dana operasional dari kantor", "Pengembalian kasbon", "Lain-lain"] };
const KEU_JENIS = { NOTA: "Nota / kuitansi", TRANSFER: "Bukti transfer", PEMBAYARAN: "Bukti pembayaran", LAINNYA: "Lainnya" };
const KEU_STATUS = { DIAJUKAN: ["Diajukan", "#dfe7f5", "#1d3a7a"], DISETUJUI: ["Disetujui", "#DCEFE4", "#0F4F35"], PERLU_PERBAIKAN: ["Perlu perbaikan", "#F6C9C3", "#8A1C12"] };
const fmtRp = (n) => "Rp " + Math.round(+n || 0).toLocaleString("id-ID");
const isKeu = () => ["admin", "admin_lapangan"].includes(me?.role);
const proyekKeu = () => (me?.role === "admin" ? sessionStorage.getItem("keuProyek") || myTugas?.project || JSON.parse(localStorage.getItem("projects") || "[]")[0]?.code || "" : myTugas?.project || "");
const pilihProyekKeu = (id = "kp") => { if (me?.role !== "admin") return ""; const pj = JSON.parse(localStorage.getItem("projects") || "[]"), cur = proyekKeu();
  return `<div><label>Proyek</label><select id="${id}">${pj.map((p) => `<option value="${esc(p.code)}" ${cur === p.code ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select></div>`; };
const awalBulan = () => todayWIB().slice(0, 8) + "01";

// ---------- potong nota otomatis: deteksi kertas → 4 sudut (bisa digeser) → luruskan perspektif → perjelas ----------
function deteksiSudut(img) {
  const S = 420, k = Math.min(1, S / Math.max(img.width, img.height)), w = Math.max(8, Math.round(img.width * k)), h = Math.max(8, Math.round(img.height * k));
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h }), g = c.getContext("2d", { willReadFrequently: true });
  g.filter = "blur(2px)"; g.drawImage(img, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data;
  // skor "kertas": terang dan tidak berwarna
  const sk = new Float32Array(w * h), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const v = Math.max(0, Math.min(255, 0.299 * r + 0.587 * gg + 0.114 * b - 0.6 * (mx - mn))); sk[j] = v; hist[v | 0]++; }
  let sum = 0, sumB = 0, wB = 0, best = 0, th = 160; for (let t = 0; t < 256; t++) sum += t * hist[t];
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF, bt = wB * wF * (mB - mF) ** 2; if (bt > best) { best = bt; th = t; } }
  const m = new Uint8Array(w * h); for (let j = 0; j < m.length; j++) m[j] = sk[j] > th ? 1 : 0;
  // komponen terang terbesar
  const lab = new Int32Array(w * h).fill(-1), st = []; let bestId = -1, bestN = 0;
  for (let j = 0; j < m.length; j++) { if (!m[j] || lab[j] >= 0) continue; const id = st.length, Q = [j]; lab[j] = id; let n = 0, tepi = 0;
    while (Q.length) { const p = Q.pop(); n++; const x = p % w, y = (p / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) tepi++;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && m[q] && lab[q] < 0) { lab[q] = id; Q.push(q); } }
    st.push(n); if (n > bestN) { bestN = n; bestId = id; } }
  const luas = bestN / (w * h);
  const def = [[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]].map(([a, b]) => [a * img.width, b * img.height]);
  if (bestId < 0 || luas < 0.08 || luas > 0.985) return { sudut: def, yakin: false };
  // sudut = titik ekstrem komponen pada arah diagonal
  let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity];
  for (let p = 0; p < lab.length; p++) { if (lab[p] !== bestId) continue; const x = p % w, y = (p / w) | 0;
    if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x, y, x + y]; if (x - y > tr[2]) tr = [x, y, x - y]; if (x - y < bl[2]) bl = [x, y, x - y]; }
  return { sudut: [tl, tr, br, bl].map(([x, y]) => [(x + 0.5) / k, (y + 0.5) / k]), yakin: true };
}
function homografi(src, dst) { // matriks 3x3 yang memetakan dst → src (untuk sampling)
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [x, y] = dst[i], [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let i = 0; i < 8; i++) { let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = 0; r < 8; r++) { if (r === i) continue; const f = A[r][i] / A[i][i]; for (let c2 = i; c2 < 8; c2++) A[r][c2] -= f * A[i][c2]; b[r] -= f * b[i]; } }
  const hh = b.map((v, i) => v / A[i][i]); return [...hh, 1];
}
function luruskan(img, sudut, perjelas = true, maks = 2200) {
  const jr = (a, b2) => Math.hypot(a[0] - b2[0], a[1] - b2[1]), [tl, tr, br, bl] = sudut;
  let W = Math.max(jr(tl, tr), jr(bl, br)), H = Math.max(jr(tl, bl), jr(tr, br)); const k = Math.min(1, maks / Math.max(W, H)); W = Math.max(50, Math.round(W * k)); H = Math.max(50, Math.round(H * k));
  const sc = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height }), sg = sc.getContext("2d", { willReadFrequently: true }); sg.drawImage(img, 0, 0);
  const S = sg.getImageData(0, 0, img.width, img.height).data, sw = img.width, shh = img.height;
  const Hm = homografi(sudut, [[0, 0], [W, 0], [W, H], [0, H]]);
  const out = Object.assign(document.createElement("canvas"), { width: W, height: H }), og = out.getContext("2d"), O = og.createImageData(W, H), D = O.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const X = x + 0.5, Y = y + 0.5, z = Hm[6] * X + Hm[7] * Y + 1, u = (Hm[0] * X + Hm[1] * Y + Hm[2]) / z - 0.5, v = (Hm[3] * X + Hm[4] * Y + Hm[5]) / z - 0.5;
    const x0 = Math.max(0, Math.min(sw - 2, Math.floor(u))), y0 = Math.max(0, Math.min(shh - 2, Math.floor(v))), fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0)), o = (y * W + x) * 4;
    for (let ch = 0; ch < 3; ch++) { const a = S[(y0 * sw + x0) * 4 + ch], b2 = S[(y0 * sw + x0 + 1) * 4 + ch], c3 = S[((y0 + 1) * sw + x0) * 4 + ch], d2 = S[((y0 + 1) * sw + x0 + 1) * 4 + ch];
      D[o + ch] = (a * (1 - fx) + b2 * fx) * (1 - fy) + (c3 * (1 - fx) + d2 * fx) * fy; } D[o + 3] = 255; }
  if (perjelas) perjelasGambar(D, W, H);
  og.putImageData(O, 0, 0); return out;
}
function perjelasGambar(D, W, H) { // regang kecerahan 1–99% lalu pertajam ringan; warna tetap
  const hist = new Uint32Array(256); for (let i = 0; i < D.length; i += 4) hist[(0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]) | 0]++;
  const n = W * H; let a = 0, lo = 0, hi = 255; for (let t = 0; t < 256; t++) { a += hist[t]; if (a > n * 0.01) { lo = t; break; } }
  a = 0; for (let t = 255; t >= 0; t--) { a += hist[t]; if (a > n * 0.01) { hi = t; break; } }
  const sk = 255 / Math.max(30, hi - lo); for (let i = 0; i < D.length; i += 4) for (let c = 0; c < 3; c++) D[i + c] = Math.max(0, Math.min(255, (D[i + c] - lo) * sk));
  const C = new Uint8ClampedArray(D); const amt = 0.55;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const o = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) { const bl = (C[o - 4 + c] + C[o + 4 + c] + C[o - W * 4 + c] + C[o + W * 4 + c]) / 4; D[o + c] = C[o + c] + amt * (C[o + c] - bl); } }
}
const bukaGambar = async (b) => { try { return await createImageBitmap(b); } catch {}
  const u = URL.createObjectURL(b); try { const im = new Image(); im.src = u; await im.decode(); return im; }
  catch { throw new Error(`Foto "${b.name ?? "galeri"}" tidak bisa dibuka${/heic|heif/i.test((b.type || "") + (b.name || "")) ? " (format HEIC)" : ""}. Ubah ke JPG (mis. buka di Galeri → Bagikan/Simpan sebagai JPG, atau ambil screenshot) lalu coba lagi.`); }
  finally { setTimeout(() => URL.revokeObjectURL(u), 5000); } };
const keKanvas = async (blobOrFile, maks = 3200) => { const bmp = await bukaGambar(blobOrFile), k = Math.min(1, maks / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) }); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return c; };
const putar90 = (c) => { const o = Object.assign(document.createElement("canvas"), { width: c.height, height: c.width }), g = o.getContext("2d"); g.translate(o.width, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0); return o; };
const kanvasBlob = (c, q = 0.85) => new Promise((r) => c.toBlob(r, "image/jpeg", q));
const kecilkan = (c, maks) => { const k = Math.min(1, maks / Math.max(c.width, c.height)); if (k === 1) return c; const o = Object.assign(document.createElement("canvas"), { width: Math.round(c.width * k), height: Math.round(c.height * k) }); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return o; };
// Editor potong: hasil { potong, asli, thumb } (Blob JPEG) atau null bila batal
function potongNota(file, judul = "Potong nota") {
  return new Promise(async (res) => {
    let img; try { img = await keKanvas(file); } catch (e) { alert(e.message); return res(null); }
    let det = deteksiSudut(img), S = det.sudut.map((p) => [...p]), tanpa = false;
    const m = modal(`<h3>${esc(judul)}</h3><p class="muted" style="margin:0 0 6px">${det.yakin ? "Tepi nota terdeteksi otomatis. Geser titik bulat bila kurang pas." : "Tepi nota tidak terbaca jelas — geser keempat titik ke sudut nota."}</p>
      <div id="pnW" style="position:relative;user-select:none;background:#111;border-radius:10px;overflow:hidden;padding:4px 0"><canvas id="pnC" style="touch-action:none;display:block;margin:auto;max-width:100%;max-height:48vh;width:auto;height:auto"></canvas></div>
      <p class="muted" style="margin:4px 0 0;font-size:12px">Geser layar di luar area foto (bagian gelap / teks) untuk menggulir ke bawah.</p>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0 0"><input type="checkbox" id="pnJ" checked style="width:auto"> Perjelas tulisan (kontras & ketajaman)</label>
      <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="sec" id="pnR" style="flex:0;white-space:nowrap">⟳ Putar</button><button class="sec" id="pnA" style="flex:0;white-space:nowrap">Deteksi ulang</button><button class="sec" id="pnT" style="flex:0;white-space:nowrap">Tanpa potong (screenshot)</button></div>
      <div id="pnP" style="margin-top:8px"></div>
      <div class="row" style="margin-top:8px;position:sticky;bottom:0;background:inherit;padding:8px 0;z-index:2"><button id="pnOk">✓ Pakai hasil ini</button><button class="sec" id="pnX">Batal</button></div>`);
    const cv = m.querySelector("#pnC"), g = cv.getContext("2d"), W = cv;
    const gambar = () => { cv.width = img.width; cv.height = img.height; g.drawImage(img, 0, 0); if (tanpa) return;
      const r = Math.max(10, img.width / 45); g.lineWidth = Math.max(3, img.width / 260); g.strokeStyle = "#22c55e"; g.fillStyle = "rgba(34,197,94,.18)";
      g.beginPath(); S.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill(); g.stroke();
      S.forEach((p) => { g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = "#16a34a"; g.stroke(); }); };
    let pratTimer = null; const prat = () => { clearTimeout(pratTimer); pratTimer = setTimeout(() => { const o = tanpa ? kecilkan(img, 700) : luruskan(img, S, m.querySelector("#pnJ").checked, 700); o.style.cssText = "max-width:100%;max-height:26vh;border:1px solid #ccc;border-radius:8px;display:block;margin:auto";
      const P = m.querySelector("#pnP"); P.innerHTML = `<div class="muted" style="margin-bottom:4px">Pratinjau hasil:</div>`; P.appendChild(o); }, 120); };
    gambar(); prat();
    let aktif = -1; const titik = (e) => { const b = cv.getBoundingClientRect(), t = e.touches?.[0] ?? e; return [((t.clientX - b.left) / b.width) * img.width, ((t.clientY - b.top) / b.height) * img.height]; };
    const turun = (e) => { if (tanpa) return; const p = titik(e); let dmin = Infinity; S.forEach((q, i) => { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < dmin) { dmin = dd; aktif = i; } }); if (dmin > Math.max(img.width, img.height) / 6) aktif = -1; if (aktif >= 0) { e.preventDefault(); cv.setPointerCapture?.(e.pointerId); } };
    const gerak = (e) => { if (aktif < 0) return; const p = titik(e); S[aktif] = [Math.max(0, Math.min(img.width, p[0])), Math.max(0, Math.min(img.height, p[1]))]; gambar(); e.preventDefault(); };
    const naik = () => { if (aktif >= 0) prat(); aktif = -1; };
    W.addEventListener("pointerdown", turun); W.addEventListener("pointermove", gerak); addEventListener("pointerup", naik);
    m.querySelector("#pnJ").onchange = prat;
    m.querySelector("#pnR").onclick = () => { img = putar90(img); det = deteksiSudut(img); S = det.sudut.map((p) => [...p]); gambar(); prat(); };
    m.querySelector("#pnA").onclick = () => { tanpa = false; det = deteksiSudut(img); S = det.sudut.map((p) => [...p]); gambar(); prat(); };
    m.querySelector("#pnT").onclick = () => { tanpa = !tanpa; m.querySelector("#pnT").textContent = tanpa ? "Potong lagi" : "Tanpa potong (screenshot)"; gambar(); prat(); };
    const selesai = (v) => { removeEventListener("pointerup", naik); m.remove(); res(v); };
    m.querySelector("#pnX").onclick = () => selesai(null);
    m.querySelector("#pnOk").onclick = async () => { m.querySelector("#pnOk").disabled = true; m.querySelector("#pnOk").textContent = "Memproses…";
      await new Promise((r) => setTimeout(r, 30));
      const hasil = tanpa ? (m.querySelector("#pnJ").checked ? (() => { const c = kecilkan(img, 2200), x = c.getContext("2d"), D = x.getImageData(0, 0, c.width, c.height); perjelasGambar(D.data, c.width, c.height); x.putImageData(D, 0, 0); return c; })() : kecilkan(img, 2200)) : luruskan(img, S, m.querySelector("#pnJ").checked, 2200);
      selesai({ potong: await kanvasBlob(hasil, 0.86), asli: await kanvasBlob(kecilkan(img, 2400), 0.82), thumb: await kanvasBlob(kecilkan(hasil, 1400), 0.74), w: hasil.width, h: hasil.height }); };
  });
}
// pilih foto: kamera atau galeri (screenshot m-banking)
// Input file dipasang di halaman (bukan elemen lepas): di sebagian HP Android input lepas dibuang saat galeri terbuka sehingga foto dari galeri tidak masuk.
const pilihFile = (kamera = true) => new Promise((res) => { const i = Object.assign(document.createElement("input"), { type: "file", accept: kamera ? "image/*" : "image/*,.heic,.heif" }); if (kamera) i.capture = "environment";
  i.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0"; document.body.appendChild(i);
  let sudah = false; const akhir = (f) => { if (sudah) return; sudah = true; setTimeout(() => i.remove(), 1000); res(f); };
  i.onchange = () => akhir(i.files?.[0] ?? null); i.addEventListener("cancel", () => akhir(null)); i.click(); });

// ---------- satu foto → potong otomatis → baca otomatis → form terisi → periksa & simpan ----------
const blobB64 = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); });
async function bacaNota(blob) {
  const c = kecilkan(await keKanvas(blob, 2000), 2000), b = await kanvasBlob(c, 0.85);
  const { data, error } = await sb.functions.invoke("baca-nota", { body: { image_b64: await blobB64(b), mime: "image/jpeg", rekening: localStorage.getItem("rekKas") || "" } });
  if (error) { let m = error.message; try { const j = await error.context?.json(); m = j?.error ?? m;
    if (j?.info?.pesan) m += ` [Rincian: ${j.info.secret ?? ""} HTTP ${j.info.status} — ${String(j.info.pesan).replace(/[{}"]/g, " ").slice(0, 160)}]`; } catch {} throw new Error(m); }
  if (!data?.ok) throw new Error(data?.error ?? "gagal membaca");
  return { ...data.hasil, peringatan: data.peringatan ?? [], model: data.model };
}
async function mulaiNota(kamera, selesai) {
  const proj = proyekKeu(); if (!proj) return alert("Akun ini belum punya proyek. Minta admin menetapkan proyek.");
  const f = await pilihFile(kamera); if (!f) return;
  const h = await potongNota(f, "Potong nota / bukti"); if (!h) return;
  let ai = null, galat = "";
  if (online()) { const t = modal(`<h3>Membaca nota…</h3><p class="muted">Mengenali jenis bukti, uang masuk/keluar, tanggal, jumlah, toko/penerima dan kategori. Biasanya 5–20 detik.</p><img src="${URL.createObjectURL(h.thumb)}" style="max-height:40vh;max-width:100%;display:block;margin:auto;border-radius:8px">`);
    try { ai = await bacaNota(h.potong); } catch (e) { galat = e.message; } finally { t.remove(); } }
  else galat = "Tidak ada sinyal — nota tidak dibaca otomatis. Isi manual; foto tetap tersimpan.";
  keuForm(null, selesai, { foto: h, ai, galat });
}
// Tutorial singkat keuangan lapangan (dipakai di halaman Keuangan dan di form transaksi)
const KEU_TUTORIAL = `<ol style="margin:6px 0 0 18px;padding:0;font-size:13px;line-height:1.5">
  <li><b>Foto</b> nota / bukti transfer (📷) atau ambil screenshot m-banking dari galeri (🖼). Satu foto = satu transaksi.</li>
  <li><b>Potong</b>: geser keempat sudut sampai pas di tepi nota, lalu Lanjut. Aplikasi membaca isinya otomatis (5–20 detik).</li>
  <li><b>Periksa</b> isian bertanda kuning <i>periksa</i>: uang Masuk/Keluar, tanggal, <b>jumlah</b>, kategori, toko/penerima.</li>
  <li><b>Nota tidak terbaca</b> (buram, tulisan tangan, sobek, tanpa sinyal)? Tetap simpan: <b>ketik total biaya</b> yang benar-benar dibayar dan <b>tulis keterangan</b> (beli apa, di mana, untuk apa). Foto tetap ikut sebagai bukti dan ditandai ⚠ untuk diperiksa admin.</li>
  <li><b>Uraian</b> = apa yang dibeli/dibayar, singkat. <b>Keterangan</b> = konteks tambahan: berita transfer, siapa yang meminta, untuk rig/kegiatan apa.</li>
  <li><b>Simpan</b>. Tanpa sinyal, data disimpan di HP dan terkirim otomatis saat ada sinyal.</li>
  <li><b>Salah isi?</b> Tekan <b>Ubah</b> di daftar transaksi untuk mengoreksi total, keterangan atau isian lain (selama belum disetujui admin). Transaksi yang dikembalikan admin (↩) diperbaiki dengan cara yang sama.</li>
  <li><b>Rekap</b>: pilih periode → ⬇ Unduh Excel (lembar Laporan + lembar foto Bukti) atau ☁ simpan ke Google Drive.</li></ol>`;
const tutorKeu = (buka = false) => `<details ${buka ? "open" : ""} style="margin:6px 0"><summary style="cursor:pointer;font-weight:600">❓ Cara mengisi (tutorial)</summary>${KEU_TUTORIAL}</details>`;

async function keuForm(trx = null, selesai = () => {}, pre = null) {
  const proj = trx?.project ?? proyekKeu(); if (!proj) return alert("Akun ini belum punya proyek. Minta admin menetapkan proyek.");
  const ai = pre?.ai ?? null, y = ai?.keyakinan ?? {};
  const v0 = { arah: trx?.arah ?? ai?.arah ?? "KELUAR", tanggal: trx?.tanggal ?? (ai?.tanggal || todayWIB()), jumlah: trx?.jumlah ?? (ai?.jumlah || ""), kategori: trx?.kategori ?? ai?.kategori,
    uraian: trx?.uraian ?? ai?.uraian ?? "", pihak: trx?.pihak ?? ai?.pihak ?? "", metode: trx?.metode ?? ai?.metode ?? "TUNAI", no_ref: trx?.no_ref ?? ai?.no_ref ?? "", rig: trx?.rig ?? "", keterangan: trx?.keterangan ?? ai?.keterangan ?? "" };
  const rigs = (JSON.parse(localStorage.getItem("projects") || "[]").find((p) => p.code === proj)?.rigs) ?? myTugas?.rigs ?? [];
  let foto = pre?.foto ?? null, jenis = ai?.jenis_dokumen && KEU_JENIS[ai.jenis_dokumen] ? ai.jenis_dokumen : "NOTA";
  const bolehFoto = !trx || !(trx.bukti ?? []).length;
  const tanda = (k) => (ai && (y[k] === "rendah" || y[k] === "sedang") ? ` <span style="background:#FFE58A;color:#6E3A08;border-radius:6px;padding:0 6px;font-size:11px">periksa${y[k] === "rendah" ? "!" : ""}</span>` : "");
  const gaya = (k) => (ai && y[k] === "rendah" ? "background:#FFF4C2" : "");
  // nota tidak terbaca / ragu: tetap diterima, pengguna diminta mengetik total & keterangan sendiri
  const tidakTerbaca = trx ? !!trx.baca_ai?.tidak_terbaca
    : !!foto && (!ai || !(Number(ai.jumlah) > 0) || y.jumlah === "rendah" || ai.jenis_dokumen === "LAINNYA");
  const kuning = "background:#FFF4C2;border:2px solid #E0A800";
  const m = modal(`<h3>${trx ? "Perbaiki transaksi" : "Periksa & simpan transaksi"} · ${esc(proj)}</h3>
    ${tutorKeu()}
    ${trx?.catatan_admin ? `<div class="card" style="background:#F6C9C3;margin:0 0 8px"><b>Catatan admin:</b> ${esc(trx.catatan_admin)}</div>` : ""}
    <div id="kFt"></div>
    ${ai ? `<div class="card" style="background:#DCEFE4;margin:6px 0"><b>Dibaca otomatis:</b> ${esc(KEU_JENIS[ai.jenis_dokumen] ?? ai.jenis_dokumen)} · <b>${ai.arah === "MASUK" ? "uang MASUK" : "uang KELUAR"}</b>${ai.alasan_arah ? ` <small class="muted">(${esc(ai.alasan_arah)})</small>` : ""}<br><small>Periksa isian bertanda kuning. Semua isian boleh diubah bila aplikasi salah membaca.</small>
      ${(ai.peringatan ?? []).length ? `<ul style="margin:4px 0 0 18px;color:#8A1C12;font-size:13px">${ai.peringatan.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${ai.catatan ? `<div class="muted" style="font-size:12px;margin-top:4px">Catatan baca: ${esc(ai.catatan)}</div>` : ""}
      ${(ai.barang ?? []).length ? `<details style="margin-top:4px"><summary style="font-size:13px">Rincian barang terbaca (${ai.barang.length})</summary><table style="font-size:12px;margin-top:4px">${ai.barang.map((x) => `<tr><td style="padding:2px 6px;border:0">${esc(x.nama)}</td><td style="padding:2px 6px;border:0">${esc(x.qty ?? "")}</td><td style="padding:2px 6px;border:0;text-align:right">${x.subtotal ? fmtRp(x.subtotal) : ""}</td></tr>`).join("")}</table></details>` : ""}</div>`
      : pre?.galat ? `<div class="card" style="background:#FBE6D0;margin:6px 0">${esc(pre.galat)}${pre.foto ? `<br><button class="sec" id="kUlang" style="width:auto;padding:6px 12px;margin-top:6px">🔄 Baca ulang foto ini</button>` : ""}</div>` : ""}
    ${tidakTerbaca ? `<div class="card" style="background:#FFF4C2;border:1px solid #E0A800;margin:6px 0"><b>⚠ ${trx ? "Nota ini tercatat tidak terbaca" : "Nota tidak terbaca jelas"} — tetap bisa disimpan.</b><br><small>Lihat foto (ketuk untuk memperbesar), lalu <b>ketik TOTAL BIAYA</b> yang benar-benar dibayar dan <b>tulis KETERANGAN</b> (beli apa, di mana, untuk apa). Foto tetap ikut sebagai bukti dan ditandai untuk diperiksa admin.</small></div>` : ""}
    <label>Uang${tanda("arah")}</label><div class="row"><label style="flex:1;margin:0"><input type="radio" name="kArah" value="KELUAR" ${v0.arah === "KELUAR" ? "checked" : ""} style="width:auto"> Keluar (beli / bayar / transfer ke orang lain)</label><label style="flex:1;margin:0"><input type="radio" name="kArah" value="MASUK" ${v0.arah === "MASUK" ? "checked" : ""} style="width:auto"> Masuk (dana diterima)</label></div>
    <div class="row"><div><label>Tanggal${tanda("tanggal")}</label><input id="kTg" type="date" value="${esc(v0.tanggal)}" style="${gaya("tanggal")}"></div><div><label>Jumlah (Rp)${tanda("jumlah")}</label><input id="kJm" inputmode="numeric" placeholder="mis. 250.000" value="${v0.jumlah ? Math.round(v0.jumlah).toLocaleString("id-ID") : ""}" style="font-weight:700;${tidakTerbaca ? kuning : gaya("jumlah")}"></div></div>
    <label>Jenis bukti${tanda("jenis_dokumen")}</label><select id="kJn">${Object.entries(KEU_JENIS).map(([k, t]) => `<option value="${k}" ${jenis === k ? "selected" : ""}>${t}</option>`).join("")}</select>
    <label>Kategori${tanda("kategori")}</label><select id="kKt" style="${gaya("kategori")}"></select>
    <label>Uraian</label><input id="kUr" placeholder="mis. Solar 40 L untuk rig 1" value="${esc(v0.uraian)}">
    <label>Keterangan ${tidakTerbaca ? `<b style="color:#8A1C12">(wajib — nota tidak terbaca)</b>` : "(opsional)"}</label><textarea id="kKet" rows="${tidakTerbaca ? 3 : 2}" maxlength="500" placeholder="${tidakTerbaca ? "mis. Beli solar 40 L di kios Pak Udin, nota tulisan tangan buram, untuk rig 1" : "mis. berita transfer, untuk keperluan apa, siapa yang meminta, catatan lain"}" style="${tidakTerbaca ? kuning : ""}">${esc(v0.keterangan)}</textarea>
    <div class="row"><div><label id="kPhL">Toko / penerima${tanda("pihak")}</label><input id="kPh" value="${esc(v0.pihak)}" style="${gaya("pihak")}"></div><div><label>Cara bayar</label><select id="kMt">${["TUNAI", "TRANSFER", "QRIS", "LAINNYA"].map((x) => `<option ${v0.metode === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
    <div class="row"><div><label>No. nota / ref. transfer</label><input id="kRf" value="${esc(v0.no_ref)}"></div><div><label>Rig (opsional)</label><select id="kRg"><option value="">—</option>${rigs.map((r) => `<option ${v0.rig === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div></div>
    <div id="kE" class="err"></div><div class="row" style="margin-top:10px;position:sticky;bottom:0;background:inherit;padding:8px 0;z-index:2"><button id="kOk">Simpan</button><button class="sec" id="kX">Batal</button></div>`);
  const isiKat = () => { const a = m.querySelector('[name="kArah"]:checked').value, L = KEU_KAT[a], cur = m.querySelector("#kKt").value || v0.kategori;
    m.querySelector("#kKt").innerHTML = L.map((x) => `<option ${cur === x ? "selected" : ""}>${esc(x)}</option>`).join(""); m.querySelector("#kPhL").childNodes[0].textContent = a === "MASUK" ? "Dari (pengirim)" : "Toko / penerima"; };
  m.querySelectorAll('[name="kArah"]').forEach((r) => (r.onchange = isiKat)); isiKat();
  const jm = m.querySelector("#kJm"); if (tidakTerbaca && !trx) setTimeout(() => (jm.value ? m.querySelector("#kKet") : jm).focus(), 150); jm.oninput = () => { const n = jm.value.replace(/\D/g, ""); jm.value = n ? Number(n).toLocaleString("id-ID") : ""; };
  const tampilFoto = () => { const F = m.querySelector("#kFt");
    if (foto) { const u = URL.createObjectURL(foto.thumb); F.innerHTML = `<div style="text-align:center"><a href="#" id="kZm"><img src="${u}" style="max-height:24vh;max-width:100%;border-radius:8px;border:1px solid #ccc"></a><br>${bolehFoto ? `<button class="sec" id="kGf" style="width:auto;padding:4px 10px;margin-top:4px">Ganti foto</button>` : ""}</div>`;
      F.querySelector("#kZm").onclick = (e) => { e.preventDefault(); lihatZoom(foto.potong); }; }
    else if (bolehFoto) F.innerHTML = `<div class="row"><button class="sec" id="kGf" style="flex:1">📷 Foto nota / bukti</button><button class="sec" id="kGg" style="flex:1">🖼 Dari galeri</button></div>`;
    else F.innerHTML = `<p class="muted">Bukti sudah ada (${trx.bukti.length}).</p>`;
    const ganti = async (kamera) => { const f = await pilihFile(kamera); if (!f) return; const h = await potongNota(f, "Potong nota / bukti"); if (h) { foto = h; tampilFoto(); } };
    F.querySelector("#kGf") && (F.querySelector("#kGf").onclick = () => ganti(true)); F.querySelector("#kGg") && (F.querySelector("#kGg").onclick = () => ganti(false)); };
  tampilFoto();
  m.querySelector("#kUlang")?.addEventListener("click", async (ev) => { const b = ev.target; b.disabled = true; b.textContent = "Membaca…";
    try { const hasil = await bacaNota(foto.potong); m.remove(); keuForm(null, selesai, { foto, ai: hasil }); } catch (e) { b.disabled = false; b.textContent = "🔄 Baca ulang foto ini"; alert(e.message); } });
  m.querySelector("#kX").onclick = () => m.remove();
  m.querySelector("#kOk").onclick = async () => {
    const arah = m.querySelector('[name="kArah"]:checked').value, jumlah = Number(jm.value.replace(/\D/g, "")), e = m.querySelector("#kE"), ket = m.querySelector("#kKet").value.trim();
    let uraian = m.querySelector("#kUr").value.trim();
    if (!jumlah) { jm.focus(); return (e.textContent = tidakTerbaca ? "Ketik total biaya sesuai nota / yang benar-benar dibayar." : "Isi jumlah uang."); }
    if (tidakTerbaca && !ket) { m.querySelector("#kKet").focus(); return (e.textContent = "Nota tidak terbaca: tulis keterangan (beli apa, di mana, untuk apa)."); }
    if (!uraian) { if (!ket) return (e.textContent = "Isi uraian singkat (untuk apa uangnya)."); uraian = ket.slice(0, 80); m.querySelector("#kUr").value = uraian; }
    if (tidakTerbaca && !trx && !confirm(`Simpan transaksi ${arah === "MASUK" ? "MASUK" : "KELUAR"} dengan total ${fmtRp(jumlah)}?\n\nKeterangan: ${ket}\n\nNota ditandai "tidak terbaca" agar diperiksa admin. Bila total salah, tekan Batal lalu koreksi.`)) return;
    if (!trx && !foto && arah === "KELUAR" && !confirm("Pengeluaran tanpa foto bukti. Tetap simpan? (foto bisa ditambahkan nanti lewat Ubah)")) return;
    const row = { project: proj, tanggal: m.querySelector("#kTg").value || todayWIB(), arah, kategori: m.querySelector("#kKt").value, uraian, pihak: m.querySelector("#kPh").value.trim() || null, jumlah,
      metode: m.querySelector("#kMt").value, no_ref: m.querySelector("#kRf").value.trim() || null, rig: m.querySelector("#kRg").value || null, keterangan: ket || null };
    jenis = m.querySelector("#kJn").value;
    if (ai && !trx) { const banding = { arah: ai.arah, tanggal: ai.tanggal, jumlah: ai.jumlah, kategori: ai.kategori, pihak: ai.pihak ?? null, jenis: ai.jenis_dokumen };
      row.diubah_dari_ai = Object.keys(banding).filter((k) => String((k === "jenis" ? jenis : row[k]) ?? "") !== String(banding[k] ?? ""));
      row.baca_ai = { jenis_dokumen: ai.jenis_dokumen, arah: ai.arah, alasan_arah: ai.alasan_arah, tanggal: ai.tanggal, jumlah: ai.jumlah, biaya_admin: ai.biaya_admin, pihak: ai.pihak, no_ref: ai.no_ref,
        metode: ai.metode, kategori: ai.kategori, uraian: ai.uraian, keterangan: ai.keterangan, barang: ai.barang, keyakinan: ai.keyakinan, peringatan: ai.peringatan, catatan: ai.catatan, model: ai.model }; }
    if (tidakTerbaca && !trx) row.baca_ai = { ...(row.baca_ai ?? {}), tidak_terbaca: true, ...(pre?.galat ? { galat: String(pre.galat).slice(0, 300) } : {}) };
    m.querySelector("#kOk").disabled = true;
    const pos = trx ? null : await Promise.race([getPos(), new Promise((r) => setTimeout(() => r(null), 4000))]);
    const B = foto ? [{ client_uuid: crypto.randomUUID(), jenis, potong: foto.potong, asli: foto.asli, thumb: foto.thumb, urutan: 1, captured_at: new Date().toISOString() }] : [];
    if (trx) { if (!online()) { m.querySelector("#kOk").disabled = false; return (e.textContent = "Perbaikan transaksi perlu sinyal internet."); }
      const { error } = await sb.from("keu_transaksi").update(row).eq("id", trx.id); if (error) { m.querySelector("#kOk").disabled = false; return (e.textContent = error.message); }
      if (B.length) await qPut({ client_uuid: crypto.randomUUID(), kind: "keubukti", transaksi_id: trx.id, project: proj, tanggal: row.tanggal, bukti: B });
      else if (trx.bukti?.[0] && trx.bukti[0].jenis !== jenis) await sb.from("keu_bukti").update({ jenis }).eq("id", trx.bukti[0].id).then(() => {}, () => {}); }
    else await qPut({ client_uuid: crypto.randomUUID(), kind: "keu", row: { ...row, lat: pos?.lat ?? null, lon: pos?.lon ?? null, captured_at: new Date().toISOString() }, bukti: B });
    m.remove(); toast(online() ? "Tersimpan — mengirim…" : "Tersimpan di HP — terkirim otomatis saat ada sinyal"); await sync(); selesai();
  };
}
async function unggahBuktiKeu(proj, tanggal, trxKey, B) {
  const base = `${session.user.id}/${proj}/${String(tanggal).slice(0, 7)}`;
  for (const b of B) { b.path = `${base}/${trxKey}_${b.urutan}_${b.jenis.toLowerCase()}_potong.jpg`; b.path_asli = `${base}/${trxKey}_${b.urutan}_${b.jenis.toLowerCase()}_asli.jpg`; b.thumb_path = `${base}/rekap/${trxKey}_${b.urutan}.jpg`;
    for (const [p, bl] of [[b.path, b.potong], [b.path_asli, b.asli], [b.thumb_path, b.thumb]]) { if (!bl) continue;
      const up = await sb.storage.from("keuangan").upload(p, bl, { contentType: "image/jpeg", upsert: false }); if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw new Error(up.error.message); } }
}
async function syncKeu(it) {
  try {
    const row = { ...it.row, client_uuid: it.client_uuid };
    const ins = await sb.from("keu_transaksi").upsert(row, { onConflict: "client_uuid", ignoreDuplicates: true }); if (ins.error) throw new Error(ins.error.message);
    const { data: t, error } = await sb.from("keu_transaksi").select("id").eq("client_uuid", it.client_uuid).single(); if (error) throw new Error(error.message);
    await unggahBuktiKeu(it.row.project, it.row.tanggal, it.client_uuid.slice(0, 8), it.bukti ?? []);
    if ((it.bukti ?? []).length) { const r = await sb.from("keu_bukti").upsert(it.bukti.map((b) => ({ client_uuid: b.client_uuid, transaksi_id: t.id, jenis: b.jenis, path: b.path, path_asli: b.path_asli, thumb_path: b.thumb_path, urutan: b.urutan, captured_at: b.captured_at })),
      { onConflict: "client_uuid", ignoreDuplicates: true }); if (r.error) throw new Error(r.error.message); }
    await qDel(it.client_uuid);
  } catch (e) { it.error = e.message; await qPut(it); }
}
async function syncKeuBukti(it) {
  try { await unggahBuktiKeu(it.project, it.tanggal, it.transaksi_id.slice(0, 8), it.bukti);
    const r = await sb.from("keu_bukti").upsert(it.bukti.map((b) => ({ client_uuid: b.client_uuid, transaksi_id: it.transaksi_id, jenis: b.jenis, path: b.path, path_asli: b.path_asli, thumb_path: b.thumb_path, urutan: b.urutan, captured_at: b.captured_at })),
      { onConflict: "client_uuid", ignoreDuplicates: true }); if (r.error) throw new Error(r.error.message); await qDel(it.client_uuid);
  } catch (e) { it.error = e.message; await qPut(it); }
}
// buka foto bukti: file di server (bila masih ada) atau salinan Google Drive
async function bukaBuktiKeu(b) {
  const L = [[b.path, b.drive_url], [b.path_asli, b.drive_url_asli]]; let html = "";
  for (const [p, dv, nm] of L.map((x, i) => [...x, i ? "Foto asli (sebelum dipotong)" : "Hasil potong"])) { if (!p) continue;
    const { data } = await sb.storage.from("keuangan").createSignedUrl(p, 3600);
    html += `<h4 style="margin:8px 0 4px">${nm}</h4>${data?.signedUrl ? `<img src="${data.signedUrl}" style="max-width:100%;border-radius:8px">` : ""}
      <p>${data?.signedUrl ? `<a href="${data.signedUrl}" target="_blank" rel="noopener">Unduh</a>` : `<span class="muted">File di server sudah dipindah ke Drive.</span>`}${dv ? ` · <a href="${esc(dv)}" target="_blank" rel="noopener">Buka di Google Drive</a>` : ""}</p>`; }
  if (!/img/.test(html) && b.thumb_path) { const { data } = await sb.storage.from("keuangan").createSignedUrl(b.thumb_path, 3600); if (data?.signedUrl) html = `<img src="${data.signedUrl}" style="max-width:100%;border-radius:8px">` + html; }
  const m = modal(`<h3>${esc(KEU_JENIS[b.jenis] ?? b.jenis)}</h3>${html}<button class="sec" id="bkX" style="margin-top:8px">Tutup</button>`); m.querySelector("#bkX").onclick = () => m.remove();
}

// ---------- halaman Keuangan ----------
async function keuView(v) {
  const dari = sessionStorage.getItem("keuDari") || awalBulan(), sampai = sessionStorage.getItem("keuSampai") || todayWIB(), adm = me?.role === "admin";
  const antre = (await qAll()).filter((x) => x.kind === "keu" || x.kind === "keubukti");
  v.innerHTML = `<div class="card"><h2>Keuangan lapangan</h2><p class="muted">Catat setiap uang keluar/masuk dengan foto nota, bukti transfer atau bukti pembayaran. Nota dipotong & dirapikan otomatis. Data ini hanya terlihat oleh admin lapangan dan admin kantor — tidak masuk Dashboard dan tidak terlihat client/verifier.</p>
    <div class="row" style="flex-wrap:wrap"><button id="kFoto" style="flex:1;min-width:150px;padding:14px">📷 Foto nota / bukti</button><button id="kGal" style="flex:1;min-width:150px;padding:14px">🖼 Unggah dari galeri</button></div>
    <p class="muted" style="margin:6px 0 0">Satu foto per transaksi. Setelah difoto, nota dipotong dan dibaca otomatis (jenis bukti, uang masuk/keluar, tanggal, jumlah, toko/penerima, kategori). Periksa hasilnya; angka yang salah baca bisa diubah sebelum disimpan. Nota yang tidak terbaca tetap diterima — cukup ketik total biaya dan keterangannya.
      <a href="#" id="kMan">Isi manual tanpa foto</a> · <a href="#" id="kRek">Rekening kas lapangan${localStorage.getItem("rekKas") ? `: ${esc(localStorage.getItem("rekKas"))}` : " (belum diisi)"}</a></p>${antre.length ? `<p class="muted" style="margin-top:8px">⏳ ${antre.length} transaksi/bukti menunggu sinyal untuk dikirim.${antre.some((x) => x.error) ? ` Galat: ${esc(antre.find((x) => x.error).error)}` : ""}</p>` : ""}${tutorKeu(!localStorage.getItem("keuTutorDilihat"))}</div>
    <div class="card"><div class="row" style="align-items:flex-end;flex-wrap:wrap">${pilihProyekKeu()}<div><label>Dari</label><input id="kD" type="date" value="${dari}"></div><div><label>Sampai</label><input id="kS" type="date" value="${sampai}"></div>
      <div><label>Status</label><select id="kSt"><option value="">Semua</option>${Object.entries(KEU_STATUS).map(([k, [t]]) => `<option value="${k}" ${sessionStorage.getItem("keuSt") === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <button id="kGo" style="flex:0">Tampilkan</button></div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="sec" id="kXl" style="flex:0;white-space:nowrap">⬇ Unduh Excel (laporan + nota)</button><button class="sec" id="kDr" style="flex:0;white-space:nowrap">☁ Simpan rekap ke Google Drive</button></div>
      <div id="kR" style="margin-top:10px">Memuat…</div></div>`;
  try { localStorage.setItem("keuTutorDilihat", "1"); } catch {}
  $("#kFoto").onclick = () => mulaiNota(true, () => keuView(v)); $("#kGal").onclick = () => mulaiNota(false, () => keuView(v));
  $("#kMan").onclick = (e) => { e.preventDefault(); keuForm(null, () => keuView(v)); };
  $("#kRek").onclick = (e) => { e.preventDefault(); const r = prompt("Nama pemilik / nomor rekening kas lapangan (dipakai untuk membedakan transfer MASUK dan KELUAR):", localStorage.getItem("rekKas") || ""); if (r !== null) { localStorage.setItem("rekKas", r.trim()); keuView(v); } };
  $("#kGo").onclick = () => { sessionStorage.setItem("keuDari", $("#kD").value); sessionStorage.setItem("keuSampai", $("#kS").value); sessionStorage.setItem("keuSt", $("#kSt").value); if ($("#kp")) sessionStorage.setItem("keuProyek", $("#kp").value); keuView(v); };
  if (!online()) return ($("#kR").innerHTML = `<p class="muted">Rekap perlu sinyal internet. Transaksi baru tetap bisa dicatat dan dikirim otomatis nanti.</p>`);
  const proj = proyekKeu(), st = sessionStorage.getItem("keuSt") || "";
  let q = sb.from("v_keu_transaksi").select("*").eq("project", proj).gte("tanggal", dari).lte("tanggal", sampai).order("tanggal").order("created_at"); if (st) q = q.eq("status", st);
  const [{ data: R, error }, { data: pre }, { data: kini }] = await Promise.all([q, sb.from("v_keu_transaksi").select("saldo").eq("project", proj).lt("tanggal", dari).order("tanggal", { ascending: false }).order("created_at", { ascending: false }).limit(1),
    sb.from("v_keu_transaksi").select("saldo").eq("project", proj).order("tanggal", { ascending: false }).order("created_at", { ascending: false }).limit(1)]);
  if (error) return ($("#kR").innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const saldoAwal = +(pre?.[0]?.saldo ?? 0), rows = R ?? [];
  const masuk = rows.filter((r) => r.arah === "MASUK").reduce((s, r) => s + +r.jumlah, 0), keluar = rows.filter((r) => r.arah === "KELUAR").reduce((s, r) => s + +r.jumlah, 0);
  const perKat = {}; rows.filter((r) => r.arah === "KELUAR").forEach((r) => (perKat[r.kategori] = (perKat[r.kategori] ?? 0) + +r.jumlah));
  const tanpaBukti = rows.filter((r) => r.arah === "KELUAR" && !r.bukti.length).length;
  $("#kR").innerHTML = `<div class="row" style="flex-wrap:wrap;gap:8px">${[["Saldo awal periode", saldoAwal, "#12251E"], ["Pemasukan", masuk, "#0F4F35"], ["Pengeluaran", keluar, "#8A1C12"], ["Saldo akhir periode", saldoAwal + masuk - keluar, "#12251E"]].map(([t, n, w]) => `<div class="card" style="margin:0;flex:1;min-width:140px;padding:10px"><div class="muted">${t}</div><b style="font-size:17px;color:${w}">${fmtRp(n)}</b></div>`).join("")}</div>
    <p class="muted" style="margin:6px 0 0">Saldo kas lapangan saat ini (semua periode): <b style="color:${+(kini?.[0]?.saldo ?? 0) < 0 ? "#8A1C12" : "#0F4F35"}">${fmtRp(kini?.[0]?.saldo ?? 0)}</b>${st ? " · filter status aktif: angka di atas hanya transaksi berstatus itu" : ""}</p>
    ${tanpaBukti ? `<p class="err">${tanpaBukti} pengeluaran belum ada foto buktinya.</p>` : ""}
    <div class="tw" style="margin-top:8px"><table style="width:100%"><thead><tr><th>Tanggal</th><th>Uraian</th><th>Kategori</th><th>Masuk</th><th>Keluar</th><th>Saldo</th><th>Bukti</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map((r) => { const [stT, stB, stF] = KEU_STATUS[r.status] ?? [r.status, "#eee", "#333"], saya = r.created_by === session.user.id, bisaUbah = adm || (saya && r.status !== "DISETUJUI");
      return `<tr><td style="padding:4px 6px;white-space:nowrap">${esc(r.tanggal)}</td><td style="padding:4px 6px">${esc(r.uraian)}${r.pihak ? `<br><small class="muted">${esc(r.pihak)}${r.no_ref ? " · " + esc(r.no_ref) : ""}</small>` : ""}${r.keterangan ? `<br><small>Ket: ${esc(r.keterangan)}</small>` : ""}${r.catatan_admin ? `<br><small style="color:#8A1C12">Admin: ${esc(r.catatan_admin)}</small>` : ""}${r.baca_ai?.tidak_terbaca ? `<br><small style="color:#8A5A00;font-weight:600">⚠ nota tidak terbaca — total diisi manual</small>` : r.baca_ai ? `<br><small class="muted" title="Dibaca otomatis dari foto">🤖${(r.diubah_dari_ai ?? []).length ? ` diubah: ${esc(r.diubah_dari_ai.join(", "))}` : " sesuai bacaan"}</small>` : ""}</td>
        <td style="padding:4px 6px">${esc(r.kategori)}${r.rig ? `<br><small class="muted">${esc(r.rig)}</small>` : ""}</td><td style="padding:4px 6px;text-align:right;white-space:nowrap">${r.arah === "MASUK" ? fmtRp(r.jumlah) : ""}</td>
        <td style="padding:4px 6px;text-align:right;white-space:nowrap">${r.arah === "KELUAR" ? fmtRp(r.jumlah) : ""}</td><td style="padding:4px 6px;text-align:right;white-space:nowrap">${fmtRp(r.saldo)}</td>
        <td style="padding:4px 6px;white-space:nowrap">${r.bukti.map((b, i) => `<a href="#" data-bk="${r.id}|${i}">${b.jenis === "NOTA" ? "🧾" : b.jenis === "TRANSFER" ? "🏦" : "💳"}</a>`).join(" ") || `<span style="color:var(--red)">—</span>`}</td>
        <td style="padding:4px 6px"><span class="pill" style="background:${stB};color:${stF}">${stT}</span>${r.diperiksa_oleh ? `<br><small class="muted">${esc(r.diperiksa_oleh)}</small>` : ""}</td>
        <td style="padding:4px 6px;white-space:nowrap">${adm ? `<button class="sec" data-ok="${r.id}" style="padding:4px 8px">✓</button> <button class="sec" data-fix="${r.id}" style="padding:4px 8px">↩</button> ` : ""}${bisaUbah ? `<button class="sec" data-ed="${r.id}" style="padding:4px 8px">Ubah</button> <button class="sec" data-del="${r.id}" style="padding:4px 8px">✕</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="9" style="padding:8px" class="muted">Belum ada transaksi pada periode ini.</td></tr>`}
    </tbody></table></div>
    ${Object.keys(perKat).length ? `<h3 style="margin-top:12px">Pengeluaran per kategori</h3><table>${Object.entries(perKat).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td style="padding:4px 8px">${esc(k)}</td><td style="padding:4px 8px;text-align:right">${fmtRp(n)}</td><td style="padding:4px 8px" class="muted">${((n / keluar) * 100).toFixed(0)}%</td></tr>`).join("")}</table>` : ""}
    <p class="muted" style="margin-top:8px">🧾 nota · 🏦 bukti transfer · 💳 bukti pembayaran. ${adm ? "✓ = setujui, ↩ = minta perbaikan (dengan catatan)." : "Transaksi yang sudah disetujui admin tidak bisa diubah."}</p>`;
  const cari = (id) => rows.find((r) => r.id === id);
  $("#kR").querySelectorAll("[data-bk]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const [id, i] = a.dataset.bk.split("|"); bukaBuktiKeu(cari(id).bukti[+i]); }));
  $("#kR").querySelectorAll("[data-ed]").forEach((b) => (b.onclick = () => keuForm(cari(b.dataset.ed), () => keuView(v))));
  $("#kR").querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (!confirm("Hapus transaksi ini dari laporan? (tetap tersimpan di arsip server)")) return;
    const { error } = await sb.from("keu_transaksi").update({ dihapus_at: new Date().toISOString() }).eq("id", b.dataset.del); if (error) alert(error.message); keuView(v); }));
  $("#kR").querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("keu_transaksi").update({ status: "DISETUJUI", catatan_admin: null, diperiksa_by: session.user.id, diperiksa_at: new Date().toISOString() }).eq("id", b.dataset.ok); if (error) alert(error.message); keuView(v); }));
  $("#kR").querySelectorAll("[data-fix]").forEach((b) => (b.onclick = async () => { const c = prompt("Apa yang perlu diperbaiki admin lapangan?"); if (!c) return;
    const { error } = await sb.from("keu_transaksi").update({ status: "PERLU_PERBAIKAN", catatan_admin: c, diperiksa_by: session.user.id, diperiksa_at: new Date().toISOString() }).eq("id", b.dataset.fix); if (error) alert(error.message); keuView(v); }));
  const buat = async (keDrive) => { const btn = keDrive ? $("#kDr") : $("#kXl"), t0 = btn.textContent; btn.disabled = true;
    try { const { blob, nama } = await keuExcel(rows, { proj, dari, sampai, saldoAwal, onProg: (s) => (btn.textContent = s) });
      if (keDrive) { const path = `${session.user.id}/${proj}/rekap_excel/${nama}`;
        const up = await sb.storage.from("keuangan").upload(path, blob, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false }); if (up.error) throw new Error(up.error.message);
        const { error } = await sb.from("keu_rekap_file").insert({ project: proj, dari, sampai, path, nama }); if (error) throw new Error(error.message);
        toast("Rekap dikirim — tersalin ke Google Drive (folder Keuangan (internal)) dalam ±10 menit"); }
      else { const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: nama }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    } catch (e) { alert("Gagal membuat Excel: " + e.message); } finally { btn.disabled = false; btn.textContent = t0; } };
  $("#kXl").onclick = () => buat(false); $("#kDr").onclick = () => buat(true);
}
// ---------- Excel: lembar 1 = laporan penggunaan uang (dengan link ke bukti), lembar 2 = foto nota/bukti tertempel ----------
async function keuExcel(rows, o) {
  await muatJS("vendor/exceljs.min.js", () => window.ExcelJS); const EJ = window.ExcelJS, wb = new EJ.Workbook(); wb.creator = "X-Terra"; wb.created = new Date();
  const pjNama = JSON.parse(localStorage.getItem("projects") || "[]").find((p) => p.code === o.proj)?.nama ?? o.proj;
  const L = wb.addWorksheet("Laporan", { views: [{ state: "frozen", ySplit: 6 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  const Bk = wb.addWorksheet("Bukti");
  // tautan antar-lembar lewat rumus HYPERLINK (terbaca di Excel, Excel HP dan LibreOffice)
  const lnkDalam = (sh, sel, teks) => { const t = String(teks).replace(/"/g, "'").slice(0, 250); return { formula: `HYPERLINK("#'${sh}'!${sel}","${t}")`, result: t }; };
  const hijau = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12251E" } }, garis = { top: { style: "thin", color: { argb: "FFBFC8C2" } }, left: { style: "thin", color: { argb: "FFBFC8C2" } }, bottom: { style: "thin", color: { argb: "FFBFC8C2" } }, right: { style: "thin", color: { argb: "FFBFC8C2" } } };
  L.columns = [6, 12, 40, 32, 24, 24, 11, 18, 9, 16, 16, 17, 15, 16, 22].map((w) => ({ width: w }));
  L.mergeCells("A1:O1"); L.getCell("A1").value = "LAPORAN PENGGUNAAN UANG LAPANGAN"; L.getCell("A1").font = { bold: true, size: 14 };
  L.getCell("A2").value = `Proyek: ${pjNama}`; L.getCell("A3").value = `Periode: ${o.dari} s.d. ${o.sampai}`; L.getCell("A4").value = `Dibuat: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} oleh ${me?.full_name ?? ""} (X-Terra)`;
  const H = ["No", "Tanggal", "Uraian", "Keterangan", "Kategori", "Toko / penerima / pengirim", "Cara bayar", "No. nota / ref", "Rig", "Masuk (Rp)", "Keluar (Rp)", "Saldo (Rp)", "Status", "Bukti (lembar Bukti)", "File asli (Google Drive)"];
  const hr = L.getRow(6); H.forEach((t, i) => { const c = hr.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = hijau; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; c.border = garis; }); hr.height = 30;
  const r0 = 7; L.getRow(r0).values = ["", "", "Saldo awal periode", "", "", "", "", "", "", "", "", o.saldoAwal]; L.getRow(r0).font = { italic: true };
  // lembar Bukti: susun foto per transaksi, kembalikan baris tujuan untuk hyperlink
  Bk.columns = Array.from({ length: 16 }, () => ({ width: 11 })); Bk.getCell("A1").value = "FOTO NOTA & BUKTI TRANSAKSI"; Bk.getCell("A1").font = { bold: true, size: 14 };
  Bk.getCell("A2").value = `Proyek: ${pjNama} · Periode ${o.dari} s.d. ${o.sampai} · klik judul untuk kembali ke Laporan`;
  let br = 4; const tujuan = {}, ambil = async (p) => { if (!p) return null; const { data } = await sb.storage.from("keuangan").download(p); if (!data) return null;
    const bmp = await createImageBitmap(data).catch(() => null); const b64 = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(data); }); return bmp ? { b64, w: bmp.width, h: bmp.height } : null; };
  const adaB = rows.filter((r) => r.bukti.length); let nB = 0;
  for (const [i, r] of rows.entries()) {
    const rr = r0 + 1 + i, row = L.getRow(rr), driveUrl = r.bukti.find((b) => b.drive_url)?.drive_url ?? r.bukti.find((b) => b.drive_url_asli)?.drive_url_asli;
    const [ty, tm, td] = r.tanggal.split("-").map(Number);
    row.values = [i + 1, new Date(Date.UTC(ty, tm - 1, td)), r.uraian, (r.baca_ai?.tidak_terbaca ? "[Nota tidak terbaca — total diisi manual] " : "") + (r.keterangan ?? ""), r.kategori, r.pihak ?? "", r.metode, r.no_ref ?? "", r.rig ?? "", r.arah === "MASUK" ? +r.jumlah : null, r.arah === "KELUAR" ? +r.jumlah : null,
      { formula: `L${rr - 1}+N(J${rr})-N(K${rr})` }, KEU_STATUS[r.status]?.[0] ?? r.status];
    row.getCell(2).numFmt = "dd/mm/yyyy"; row.getCell(3).alignment = { wrapText: true, vertical: "top" }; row.getCell(4).alignment = { wrapText: true, vertical: "top" };
    if (r.bukti.length) { tujuan[r.id] = br;
      row.getCell(14).value = lnkDalam("Bukti", `A${br}`, `Lihat ${r.bukti.length} bukti →`); row.getCell(14).font = { color: { argb: "FF1D4ED8" }, underline: true };
      // judul blok bukti + tautan balik
      Bk.mergeCells(`A${br}:P${br}`); const jc = Bk.getCell(`A${br}`);
      jc.value = lnkDalam("Laporan", `A${rr}`, `No. ${i + 1} · ${r.tanggal} · ${r.uraian} · ${r.arah === "MASUK" ? "Masuk" : "Keluar"} ${fmtRp(r.jumlah)} · ${r.kategori}  (← kembali ke Laporan)`);
      jc.font = { bold: true, color: { argb: "FF12251E" } }; jc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEFE4" } };
      let tinggiMaks = 0, kol = 0; const ket = br + 1;
      for (const b of r.bukti) { o.onProg?.(`Menempel bukti ${++nB}…`);
        const g = (await ambil(b.thumb_path)) ?? (await ambil(b.path)); const Wd = 330;
        Bk.getCell(ket, kol + 1).value = b.drive_url || b.drive_url_asli ? { text: `${KEU_JENIS[b.jenis] ?? b.jenis} — buka di Drive`, hyperlink: b.drive_url || b.drive_url_asli } : KEU_JENIS[b.jenis] ?? b.jenis;
        if (b.drive_url || b.drive_url_asli) Bk.getCell(ket, kol + 1).font = { color: { argb: "FF1D4ED8" }, underline: true };
        if (g) { const hgt = Math.round((Wd * g.h) / g.w), id = wb.addImage({ base64: g.b64, extension: "jpeg" });
          Bk.addImage(id, { tl: { col: kol, row: ket }, ext: { width: Wd, height: hgt }, editAs: "oneCell" }); tinggiMaks = Math.max(tinggiMaks, hgt); }
        else { Bk.getCell(ket + 1, kol + 1).value = "(foto tidak tersedia di server; buka di Drive)"; tinggiMaks = Math.max(tinggiMaks, 40); }
        kol += 5; }
      br = ket + 1 + Math.ceil(tinggiMaks / 20) + 2; }
    else if (r.arah === "KELUAR") { row.getCell(14).value = "BELUM ADA BUKTI"; row.getCell(14).font = { color: { argb: "FFB91C1C" }, bold: true }; }
    if (driveUrl) { row.getCell(15).value = { text: "Buka di Drive", hyperlink: driveUrl }; row.getCell(15).font = { color: { argb: "FF1D4ED8" }, underline: true }; }
    else if (r.bukti.length) row.getCell(15).value = "menunggu salinan Drive (±10 menit)";
  }
  const rt = r0 + rows.length + 1; L.getRow(rt).values = ["", "", "TOTAL PERIODE", "", "", "", "", "", "", { formula: `SUM(J${r0 + 1}:J${rt - 1})` }, { formula: `SUM(K${r0 + 1}:K${rt - 1})` }, { formula: `L${rt - 1}` }];
  L.getRow(rt).font = { bold: true }; L.getRow(rt).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF3F0" } };
  for (let r = 6; r <= rt; r++) for (let c = 1; c <= 15; c++) { const cell = L.getRow(r).getCell(c); cell.border = garis; if (c >= 10 && c <= 12 && r > 6) cell.numFmt = '#,##0;[Red]-#,##0'; }
  // ringkasan per kategori (rumus, ikut berubah bila angka disunting)
  let rk = rt + 2; L.getCell(`C${rk}`).value = "Pengeluaran per kategori"; L.getCell(`C${rk}`).font = { bold: true };
  const kats = [...new Set(rows.filter((r) => r.arah === "KELUAR").map((r) => r.kategori))];
  for (const k of kats) { rk++; L.getCell(`C${rk}`).value = k; L.getCell(`K${rk}`).value = { formula: `SUMIF(E${r0 + 1}:E${rt - 1},C${rk},K${r0 + 1}:K${rt - 1})` }; L.getCell(`K${rk}`).numFmt = "#,##0"; }
  L.autoFilter = { from: "A6", to: `O${rt - 1}` };
  o.onProg?.("Menyimpan Excel…");
  const buf = await wb.xlsx.writeBuffer(), stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).replace(/[-: ]/g, "").slice(0, 12);
  return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nama: `Rekap_Keuangan_${o.proj}_${o.dari}_sd_${o.sampai}_${stamp}.xlsx`, adaBukti: adaB.length };
}

// ---------- Absensi tim lapangan (foto berangkat & pulang + nama), diuji silang dengan DDR dan Progres bor ----------
const kunciAbsl = (proj, tgl, sh, rig) => `absl|${proj}|${tgl}|${sh}|${rig}`;
async function syncAbsl(it) {
  try { const base = `${session.user.id}/${it.row.project}/absensi/${it.row.tanggal.slice(0, 7)}`, row = { ...it.row, client_uuid: it.client_uuid };
    for (const k of ["berangkat", "pulang"]) if (it[k]) { const p = `${base}/${it.row.tanggal}_${it.row.shift}_${it.row.rig}_${k}_${it.client_uuid.slice(0, 8)}.jpg`.replace(/\s+/g, "");
      const up = await sb.storage.from("keuangan").upload(p, it[k], { contentType: "image/jpeg", upsert: false }); if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw new Error(up.error.message); row[`foto_${k}`] = p; }
    const r = await sb.from("absensi_lapangan").upsert(row, { onConflict: "project,tanggal,shift,rig" }); if (r.error) throw new Error(r.error.message); await qDel(it.client_uuid);
  } catch (e) { it.error = e.message; await qPut(it); }
}
async function abslView(v) {
  const proj = proyekKeu(), pj = JSON.parse(localStorage.getItem("projects") || "[]").find((p) => p.code === proj), rigs = pj?.rigs?.length ? pj.rigs : myTugas?.rigs ?? [];
  const sNow = shiftDari(new Date()), dari = sessionStorage.getItem("abslDari") || new Date(Date.parse(todayWIB()) - 6 * 864e5).toISOString().slice(0, 10), sampai = sessionStorage.getItem("abslSampai") || todayWIB();
  v.innerHTML = `<div class="card"><h2>Absensi tim lapangan</h2><p class="muted">Foto bersama tim <b>sebelum berangkat</b> dan <b>setelah pulang</b>, lalu isi nama-namanya (sama seperti foto crew di DDR). Jam dan GPS tercetak di foto. Daftar ini diuji silang dengan crew DDR dan Masuk/Keluar shift di Progres bor. Hanya untuk internal perusahaan.</p>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end">${pilihProyekKeu("ap")}<div><label>Tanggal shift</label><input id="aTg" type="date" value="${sNow.tanggal}"></div><div><label>Shift</label><select id="aSh"><option ${sNow.shift === "PAGI" ? "selected" : ""}>PAGI</option><option ${sNow.shift === "MALAM" ? "selected" : ""}>MALAM</option></select></div>
      <div><label>Rig</label><select id="aRg">${rigs.map((r) => `<option ${localStorage.getItem("abslRig") === r ? "selected" : ""}>${esc(r)}</option>`).join("") || `<option value="">(proyek tanpa rig)</option>`}</select></div></div>
    <div id="aSt" class="muted" style="margin-top:8px"></div>
    <div class="row" style="margin-top:8px"><button id="aB">📷 Foto tim BERANGKAT</button><button id="aP">📷 Foto tim PULANG</button></div>
    <div id="aFt" style="margin-top:8px"></div><h3 style="margin:10px 0 4px">Nama tim</h3><div id="aNm"></div>
    <div class="row" style="margin-top:10px"><button id="aOk">Simpan absensi</button></div><div id="aE" class="err"></div></div>
    <div class="card"><h3>Uji silang dengan DDR & Progres bor</h3><div class="row" style="align-items:flex-end;flex-wrap:wrap"><div><label>Dari</label><input id="aD" type="date" value="${dari}"></div><div><label>Sampai</label><input id="aS" type="date" value="${sampai}"></div><button id="aGo" style="flex:0">Tampilkan</button><button class="sec" id="aXl" style="flex:0;white-space:nowrap">⬇ Excel</button></div><div id="aU" style="margin-top:8px">Memuat…</div></div>`;
  if ($("#ap")) $("#ap").onchange = () => { sessionStorage.setItem("keuProyek", $("#ap").value); abslView(v); };
  let foto = { berangkat: null, pulang: null }, ada = null;
  const kunci = () => kunciAbsl(proyekKeu(), $("#aTg").value, $("#aSh").value, $("#aRg").value);
  const muat = async () => { localStorage.setItem("abslRig", $("#aRg").value); foto = { berangkat: null, pulang: null }; $("#aFt").innerHTML = "";
    ada = JSON.parse(localStorage.getItem(kunci()) || "null");
    if (online()) { const { data } = await sb.from("absensi_lapangan").select("*").eq("project", proyekKeu()).eq("tanggal", $("#aTg").value).eq("shift", $("#aSh").value).eq("rig", $("#aRg").value).maybeSingle(); if (data) ada = { ...ada, ...data }; }
    $("#aSt").innerHTML = ada ? `Sudah tercatat: berangkat ${ada.foto_berangkat_at ? "✓ " + fmtT(ada.foto_berangkat_at) : "—"} · pulang ${ada.foto_pulang_at ? "✓ " + fmtT(ada.foto_pulang_at) : "—"} · ${(ada.personil ?? []).length} nama` : "Belum ada absensi untuk rig/tanggal/shift ini.";
    localStorage.setItem("rig", $("#aRg").value);
    personilEditor($("#aNm"), (ada?.personil?.length ? ada.personil : resmiDi($("#aRg").value).map((p) => ({ nama: p.nama, jabatan: p.jabatan }))).map((x) => ({ ...x }))); };
  ["#aTg", "#aSh", "#aRg"].forEach((s) => ($(s).onchange = muat)); await muat();
  const ambil = async (k) => { const f = await pilihFile(true); if (!f) return; const pos = await Promise.race([getPos(), new Promise((r) => setTimeout(() => r(null), 8000))]), t = new Date();
    const blob = await stampPhoto(f, [`${pj?.nama ?? proyekKeu()} · ${$("#aRg").value} · ${$("#aTg").value} ${$("#aSh").value}`, `TIM ${k.toUpperCase()} · ${fmtT(t)} WIB`,
      pos ? `GPS ${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)} (±${pos.acc} m)` : "GPS tidak tersedia", `Admin lapangan: ${me?.full_name ?? ""}`]);
    foto[k] = { blob, t: t.toISOString(), pos }; $("#aFt").innerHTML = Object.entries(foto).filter(([, x]) => x).map(([kk, x]) => `<div style="display:inline-block;margin:4px;text-align:center"><img src="${URL.createObjectURL(x.blob)}" style="height:110px;border-radius:8px"><br><small>${kk} ${fmtT(x.t)}</small></div>`).join(""); };
  $("#aB").onclick = () => ambil("berangkat"); $("#aP").onclick = () => ambil("pulang");
  $("#aOk").onclick = async () => { const L = ambilPersonil($("#aNm")), e = $("#aE"); e.textContent = "";
    if (!$("#aRg").value) return (e.textContent = "Pilih rig."); if (!L.length) return (e.textContent = "Isi minimal satu nama.");
    if (!foto.berangkat && !foto.pulang && !ada) return (e.textContent = "Ambil foto tim berangkat dulu.");
    const row = { project: proyekKeu(), tanggal: $("#aTg").value, shift: $("#aSh").value, rig: $("#aRg").value, personil: L };
    if (foto.berangkat) Object.assign(row, { foto_berangkat_at: foto.berangkat.t, lat_berangkat: foto.berangkat.pos?.lat ?? null, lon_berangkat: foto.berangkat.pos?.lon ?? null });
    if (foto.pulang) Object.assign(row, { foto_pulang_at: foto.pulang.t, lat_pulang: foto.pulang.pos?.lat ?? null, lon_pulang: foto.pulang.pos?.lon ?? null });
    await qPut({ client_uuid: crypto.randomUUID(), kind: "absl", row, berangkat: foto.berangkat?.blob ?? null, pulang: foto.pulang?.blob ?? null });
    localStorage.setItem(kunci(), JSON.stringify({ ...(ada ?? {}), ...row, foto_berangkat_at: row.foto_berangkat_at ?? ada?.foto_berangkat_at, foto_pulang_at: row.foto_pulang_at ?? ada?.foto_pulang_at }));
    simpanPersonilLokal($("#aRg").value, new Date(), "X", L);
    toast(online() ? "Absensi tersimpan — mengirim…" : "Absensi tersimpan di HP — terkirim saat ada sinyal"); await sync(); abslView(v); };
  $("#aGo").onclick = () => { sessionStorage.setItem("abslDari", $("#aD").value); sessionStorage.setItem("abslSampai", $("#aS").value); abslView(v); };
  if (!online()) return ($("#aU").innerHTML = `<p class="muted">Uji silang perlu sinyal internet.</p>`);
  const { data: U, error } = await sb.from("v_absensi_lapangan_cek").select("*").eq("project", proj).gte("tanggal", dari).lte("tanggal", sampai).order("tanggal", { ascending: false }).order("shift").order("rig").order("nama");
  if (error) return ($("#aU").innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const grup = {}; (U ?? []).forEach((r) => (grup[`${r.tanggal}|${r.shift}|${r.rig}`] ??= []).push(r));
  const warna = { COCOK: "#0F4F35", "TIDAK ADA DI ABSENSI ADMIN": "#8A1C12", "TIDAK ADA DI DDR / PROGRES BOR": "#B26B00", "ABSENSI ADMIN BELUM DIISI": "#6b7280" };
  const jam = (t) => (t ? String(t).slice(11, 16) : "—"), cek = (b) => (b ? "✓" : "—");
  $("#aU").innerHTML = Object.entries(grup).map(([k, L]) => { const [t, sh, rg] = k.split("|"), x = L[0], beda = L.filter((r) => r.status !== "COCOK").length;
    return `<div style="border:1px solid #dde3dc;border-radius:10px;padding:8px;margin:6px 0"><b>${esc(t)} · ${sh === "PAGI" ? "Day" : "Night"} · ${esc(rg)}</b> <span class="muted">· berangkat ${jam(x.jam_berangkat)} / pulang ${jam(x.jam_pulang)} · DDR datang ${jam(x.ddr_jam_datang)} / pulang ${jam(x.ddr_jam_pulang)}</span>
      ${beda ? `<span class="pill" style="background:#F6C9C3;color:#8A1C12;margin-left:6px">${beda} tidak cocok</span>` : `<span class="pill" style="background:#DCEFE4;color:#0F4F35;margin-left:6px">cocok semua</span>`}
      <table style="width:100%;margin-top:4px"><tr><th>Nama</th><th>Jabatan</th><th>Absensi admin</th><th>DDR</th><th>Progres bor</th><th>Status</th></tr>${L.map((r) => `<tr><td style="padding:3px 6px">${esc(r.nama)}</td><td style="padding:3px 6px">${esc(r.jabatan ?? "")}</td><td style="padding:3px 6px;text-align:center">${cek(r.di_absensi_admin)}</td><td style="padding:3px 6px;text-align:center">${cek(r.di_ddr)}</td><td style="padding:3px 6px;text-align:center">${cek(r.di_progres)}</td><td style="padding:3px 6px;color:${warna[r.status] ?? "#333"};font-weight:600">${esc(r.status)}</td></tr>`).join("")}</table></div>`; }).join("") || `<p class="muted">Belum ada data pada periode ini.</p>`;
  $("#aXl").onclick = async () => { const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
    const { data: A } = await sb.from("absensi_lapangan").select("*").eq("project", proj).gte("tanggal", dari).lte("tanggal", sampai).order("tanggal");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet((U ?? []).map((r) => ({ Tanggal: r.tanggal, Shift: r.shift, Rig: r.rig, Nama: r.nama, Jabatan: r.jabatan, "Absensi admin": r.di_absensi_admin ? "Ya" : "Tidak", DDR: r.di_ddr ? "Ya" : "Tidak",
      "Progres bor": r.di_progres ? "Ya" : "Tidak", Status: r.status, "Jam berangkat": jam(r.jam_berangkat), "Jam pulang": jam(r.jam_pulang), "DDR jam datang": jam(r.ddr_jam_datang), "DDR jam pulang": jam(r.ddr_jam_pulang) }))), "Uji silang");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet((A ?? []).flatMap((a) => (a.personil ?? []).map((p, i) => ({ Tanggal: a.tanggal, Shift: a.shift, Rig: a.rig, No: i + 1, Nama: p.nama, Jabatan: p.jabatan,
      "Foto berangkat": a.foto_berangkat_at ? fmtT(a.foto_berangkat_at) : "", "Foto pulang": a.foto_pulang_at ? fmtT(a.foto_pulang_at) : "" })))), "Absensi admin");
    X.writeFile(wb, `Absensi_Tim_Lapangan_${proj}_${dari}_sd_${sampai}.xlsx`); };
}

// ---------- Kirim sample ke preparasi (dari data logging bor) ----------
// Daftar sample = conto hasil logging (tabel sample) yang belum pernah dikirim. Isi berat & no. kantong langsung di layar,
// atau unduh templat Excel → isi di laptop → unggah balik. Simpan = satu form pengiriman (kirim_preparasi + item) lewat RPC simpan_kirim_preparasi.
async function sampelView(v) {
  if (!online()) { v.innerHTML = `<div class="card"><h2>Kirim sample ke preparasi</h2><p class="muted">Perlu sinyal internet.</p></div>`; return; }
  const hariIni = todayWIB();
  v.innerHTML = `<div class="card"><h2>Kirim sample ke preparasi</h2>
    <p class="muted" style="margin-top:0">Daftar diambil dari <b>data logging bor</b> yang sudah masuk database dan belum pernah dikirim. Centang sample yang dikirim, isi berat (kg) dan no. kantong, lalu simpan. Bisa juga lewat templat Excel.</p>
    <div class="row" style="flex-wrap:wrap"><div style="flex:1 1 160px"><label>Titik bor</label><select id="kpB"><option value="">Semua titik</option></select></div>
      <div style="flex:1 1 130px"><label>Tanggal kirim</label><input type="date" id="kpT" value="${hariIni}"></div>
      <div style="flex:1 1 150px"><label>Tujuan</label><input id="kpJ" value="PREPARASI" placeholder="mis. Preparasi lapangan / nama lab"></div></div>
    <div class="row" style="flex-wrap:wrap"><div style="flex:1 1 150px"><label>Pengirim</label><input id="kpP" value="${esc(me?.full_name ?? "")}"></div>
      <div style="flex:1 1 150px"><label>Penerima</label><input id="kpR"></div>
      <div style="flex:0 1 110px"><label>Jumlah karung</label><input id="kpK" inputmode="numeric"></div>
      <div style="flex:1 1 130px"><label>No. segel</label><input id="kpS"></div></div>
    <label>Catatan</label><input id="kpC">
    <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="sec" id="kpTpl" style="flex:0;white-space:nowrap">⬇ Templat Excel</button><button class="sec" id="kpUp" style="flex:0;white-space:nowrap">⬆ Unggah Excel terisi</button><button class="sec" id="kpAll" style="flex:0;white-space:nowrap">Centang semua</button>
      <input type="file" id="kpF" accept=".xlsx" class="hide"></div>
    <div id="kpW"></div><div id="kpI" class="muted" style="margin:6px 0"></div><div class="tw"><table id="kpTb"></table></div>
    <div class="row" style="margin-top:8px"><button id="kpOk">Simpan form pengiriman</button></div><div id="kpE" class="err"></div></div>
    <div class="card"><h3>Pengiriman tersimpan</h3><ul class="list" id="kpL"><li class="muted">Memuat…</li></ul></div>`;
  let S = [];
  const muat = async () => {
    const b = $("#kpB").value; let q = sb.from("v_sample_belum_kirim").select("*").order("bhid").order("depth_from").limit(2000); if (b) q = q.eq("bhid", b);
    const { data, error } = await q; if (error) { $("#kpI").innerHTML = `<span class="err">${esc(error.message)}</span>`; return; }
    S = data ?? []; $("#kpI").textContent = S.length ? `${S.length} sample belum dikirim${b ? ` di ${b}` : ""}.` : "Semua sample hasil logging sudah dikirim (atau logging belum masuk).";
    $("#kpTb").innerHTML = S.length ? `<tr><th>✓</th><th>Titik</th><th>No. sample</th><th>ID</th><th>From</th><th>To</th><th>Zona</th><th>Berat (kg)</th><th>No. kantong</th><th>Catatan</th></tr>` + S.map((s, i) => `<tr data-i="${i}"><td><input type="checkbox" data-c style="width:auto"></td><td>${esc(s.bhid)}</td><td>${esc(s.sample_no)}</td><td>${esc(s.sample_id ?? "")}</td><td>${fmtD(s.depth_from)}</td><td>${fmtD(s.depth_to)}</td><td>${esc(s.geozone_id ?? "")}</td>
      <td><input data-w inputmode="decimal" value="${s.berat_kg_logging ?? ""}" style="max-width:80px"></td><td><input data-k value="${esc(s.sample_no)}" style="max-width:130px"></td><td><input data-n style="min-width:120px"></td></tr>`).join("") : "";
  };
  const ambilBaris = () => [...$("#kpTb").querySelectorAll("tr[data-i]")].filter((tr) => tr.querySelector("[data-c]").checked).map((tr) => ({ sample_no: S[+tr.dataset.i].sample_no,
    berat_kg: tr.querySelector("[data-w]").value.trim(), no_kantong: tr.querySelector("[data-k]").value.trim(), catatan: tr.querySelector("[data-n]").value.trim() }));
  const daftar = async () => {
    const { data } = await sb.from("kirim_preparasi").select("id,no_kirim,tanggal,tujuan,status,pengirim,penerima,jumlah_karung,no_segel,kirim_preparasi_item(count)").order("created_at", { ascending: false }).limit(50);
    $("#kpL").innerHTML = (data ?? []).map((k) => `<li style="flex-wrap:wrap"><span class="pill ${k.status === "DITERIMA" ? "APPROVED" : k.status === "DIKIRIM" ? "NEEDS_REVIEW" : "ANTRE"}">${esc(k.status)}</span><span style="flex:1;min-width:180px"><b>${esc(k.no_kirim)}</b> · ${esc(k.tanggal)} · ${esc(k.tujuan)}<br><span class="muted">${k.kirim_preparasi_item?.[0]?.count ?? 0} sample${k.jumlah_karung ? ` · ${k.jumlah_karung} karung` : ""}${k.no_segel ? ` · segel ${esc(k.no_segel)}` : ""}${k.pengirim ? ` · ${esc(k.pengirim)}` : ""}${k.penerima ? ` → ${esc(k.penerima)}` : ""}</span></span>
      <button class="sec" data-edk="${k.id}" style="flex:0;white-space:nowrap">✏️ Edit</button><button data-pdf="${k.id}" style="flex:0;white-space:nowrap">📄 PDF</button><button class="sec" data-x="${k.id}" style="flex:0">⬇ Excel</button>${k.status !== "DITERIMA" ? `<button class="sec" data-st="${k.id}" data-v="${k.status === "DRAFT" ? "DIKIRIM" : "DITERIMA"}" style="flex:0">Tandai ${k.status === "DRAFT" ? "dikirim" : "diterima"}</button>` : ""}</li>`).join("") || `<li class="muted">Belum ada.</li>`;
    $("#kpL").querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => excelKirim(b.dataset.x)));
    $("#kpL").querySelectorAll("[data-pdf]").forEach((b) => (b.onclick = () => cetakKirim(b.dataset.pdf)));
    $("#kpL").querySelectorAll("[data-edk]").forEach((b) => (b.onclick = () => editKirim(b.dataset.edk, () => { daftar(); muat(); })));
    $("#kpL").querySelectorAll("[data-st]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("kirim_preparasi").update({ status: b.dataset.v }).eq("id", b.dataset.st); if (error) return alert(error.message); toast("Status diperbarui"); daftar(); }));
  };
  const excelKirim = async (id) => {
    const [{ data: k }, { data: it }] = await Promise.all([sb.from("kirim_preparasi").select("*").eq("id", id).single(), sb.from("v_kirim_preparasi").select("*").eq("kirim_id", id).order("urut")]);
    const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
    const aoa = [["FORM PENGIRIMAN SAMPLE KE PREPARASI"], ["No. kirim", k.no_kirim, "", "Tanggal", k.tanggal], ["Tujuan", k.tujuan, "", "Status", k.status], ["Pengirim", k.pengirim ?? "", "", "Penerima", k.penerima ?? ""], ["Jumlah karung", k.jumlah_karung ?? "", "", "No. segel", k.no_segel ?? ""], ["Catatan", k.catatan ?? ""], [],
      ["No", "Titik", "No. sample", "ID", "From (m)", "To (m)", "Zona", "Core (m)", "Berat (kg)", "No. kantong", "Catatan"], ...(it ?? []).map((r) => [r.urut, r.bhid, r.sample_no, r.sample_id, r.depth_from, r.depth_to, r.geozone_id, r.core_length, r.berat_kg, r.no_kantong, r.catatan]),
      [], ["", "", `Total ${it?.length ?? 0} sample`, "", "", "", "", "", (it ?? []).reduce((s, r) => s + (+r.berat_kg || 0), 0)], [], ["Pengirim,", "", "", "", "Penerima,"], [], [], [k.pengirim ?? "(.................)", "", "", "", k.penerima ?? "(.................)"]];
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), "Form Kirim"); X.writeFile(wb, `Kirim_Sample_${k.no_kirim}.xlsx`);
  };
  const { data: H } = await sb.from("v_sample_belum_kirim").select("bhid").limit(5000);
  $("#kpB").innerHTML = `<option value="">Semua titik</option>` + [...new Set((H ?? []).map((x) => x.bhid))].sort((a, b) => a.localeCompare(b, "id", { numeric: true })).map((b) => `<option>${esc(b)}</option>`).join("");
  $("#kpB").onchange = muat;
  $("#kpAll").onclick = () => { const cb = [...$("#kpTb").querySelectorAll("[data-c]")], semua = cb.every((c) => c.checked); cb.forEach((c) => (c.checked = !semua)); };
  $("#kpTpl").onclick = async () => { if (!S.length) return alert("Tidak ada sample yang belum dikirim.");
    const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
    const aoa = [["TEMPLAT KIRIM SAMPLE KE PREPARASI — isi kolom KIRIM (Y), BERAT dan KANTONG; jangan ubah kolom NO_SAMPLE"], ["KIRIM (Y/kosong)", "NO_SAMPLE", "TITIK", "FROM", "TO", "ZONA", "BERAT_KG", "NO_KANTONG", "CATATAN"],
      ...S.map((s) => ["", s.sample_no, s.bhid, s.depth_from, s.depth_to, s.geozone_id ?? "", s.berat_kg_logging ?? "", s.sample_no, ""])];
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), "Kirim"); X.writeFile(wb, `Templat_Kirim_Sample_${$("#kpB").value || "semua"}_${hariIni}.xlsx`); };
  $("#kpUp").onclick = () => $("#kpF").click();
  $("#kpF").onchange = async (ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (!f) return;
    try { const X = await import("./vendor/xlsx.js"), wb = X.read(await f.arrayBuffer()), rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const h = rows.findIndex((r) => r.map(String).includes("NO_SAMPLE")); if (h < 0) throw new Error("bukan templat Kirim Sample (kolom NO_SAMPLE tidak ada) — unduh lewat ⬇ Templat Excel");
      const K = rows[h].map(String), ix = (n) => K.indexOf(n); let cocok = 0, tidak = [];
      for (const r of rows.slice(h + 1)) { const no = String(r[ix("NO_SAMPLE")] ?? "").trim(); if (!no) continue;
        const tr = [...$("#kpTb").querySelectorAll("tr[data-i]")].find((t) => S[+t.dataset.i].sample_no === no); if (!tr) { tidak.push(no); continue; }
        const ya = /^(y|ya|yes|1|x|v|✓)$/i.test(String(r[ix("KIRIM (Y/kosong)")] ?? r[0] ?? "").trim()); tr.querySelector("[data-c]").checked = ya;
        if (ya) { cocok++; tr.querySelector("[data-w]").value = String(r[ix("BERAT_KG")] ?? "").replace(".", ","); tr.querySelector("[data-k]").value = String(r[ix("NO_KANTONG")] ?? ""); tr.querySelector("[data-n]").value = String(r[ix("CATATAN")] ?? ""); } }
      $("#kpI").textContent = `Excel terbaca: ${cocok} sample dicentang.${tidak.length ? ` ${tidak.length} no. sample tidak ada di daftar (sudah dikirim / salah tulis): ${tidak.slice(0, 8).join(", ")}${tidak.length > 8 ? "…" : ""}` : ""} Periksa lalu tekan Simpan.`;
    } catch (e) { $("#kpE").textContent = "Excel tidak bisa dibaca: " + e.message; } };
  $("#kpOk").onclick = async () => { const items = ambilBaris(); $("#kpE").textContent = "";
    if (!items.length) return ($("#kpE").textContent = "Centang minimal satu sample.");
    const salah = items.find((x) => x.berat_kg && !(Number(x.berat_kg.replace(",", ".")) >= 0)); if (salah) return ($("#kpE").textContent = `Berat ${salah.sample_no} bukan angka.`);
    if (!confirm(`Simpan form pengiriman ${items.length} sample ke ${$("#kpJ").value || "PREPARASI"}?`)) return;
    $("#kpOk").disabled = true;
    const { data, error } = await sb.rpc("simpan_kirim_preparasi", { p: { tanggal: $("#kpT").value, tujuan: $("#kpJ").value, pengirim: $("#kpP").value, penerima: $("#kpR").value, jumlah_karung: $("#kpK").value, no_segel: $("#kpS").value, catatan: $("#kpC").value, items } });
    $("#kpOk").disabled = false; if (error) return ($("#kpE").textContent = "Gagal: " + error.message);
    toast(`Tersimpan ${data.no_kirim} · ${data.jumlah} sample`); await muat(); daftar(); cetakKirim(data.id); };
  // v.39: Form Logging yang sudah dikirim tetapi belum ✅ Terima & simpan — sample-nya belum ada di database, jadi belum bisa dikirim ke preparasi
  const { data: tunggu } = await sb.from("scan_job").select("id,bhid_hint,page_no,status,draft_at,merged").in("status", ["NEEDS_REVIEW", "MANUAL", "ERROR", "UPLOADED"]).in("form_type", ["SHEET", "LOG"]).order("bhid_hint");
  if ((tunggu ?? []).length) { const ver = ["verifier", "admin"].includes(me?.role);
    $("#kpW").innerHTML = `<div style="background:#FFF4D6;border-radius:8px;padding:8px 10px;margin:6px 0"><b>⏳ Form Logging belum disetujui</b> — sample-nya belum masuk database, jadi belum muncul di daftar ini:<ul class="list" style="margin:4px 0 0">${tunggu.map((j) => `<li><span style="flex:1"><b>${esc(j.bhid_hint ?? "")}</b> hal. ${esc(j.page_no ?? "?")} · ${(j.merged?.rows ?? []).length} baris · ${esc(j.status)}${j.draft_at ? " · 💾 editan tersimpan" : ""}</span>${ver ? `<button data-pt="${j.id}" style="flex:0;white-space:nowrap">✅ Periksa & terima</button>` : ""}</li>`).join("")}</ul>${ver ? "" : `<p class="muted" style="margin:4px 0 0">Minta verifier/admin memeriksa & menyetujui.</p>`}</div>`;
    $("#kpW").querySelectorAll("[data-pt]").forEach((b) => (b.onclick = () => { scrollTo(0, 0); reviewDetail(v, b.dataset.pt, "foto"); })); }
  await muat(); daftar();
}

// v.41: ✏️ Edit form pengiriman sample (kepala + isi per sample), juga setelah PDF dibuat; tiap perubahan tercatat (data_edit_log). PDF dibuat ulang dari data terbaru.
async function editKirim(id, selesai) {
  const [{ data: k, error }, { data: it }] = await Promise.all([sb.from("kirim_preparasi").select("*").eq("id", id).single(), sb.from("kirim_preparasi_item").select("id,urut,sample_no,no_kantong,berat_kg,catatan").eq("kirim_id", id).order("urut")]);
  if (error || !k) return alert(error?.message ?? "Form tidak ditemukan.");
  const H = [["no_kirim", "No. kirim"], ["tanggal", "Tanggal kirim", "date"], ["tujuan", "Tujuan"], ["pengirim", "Pengirim"], ["penerima", "Penerima"], ["jumlah_karung", "Jumlah karung"], ["no_segel", "No. segel"], ["catatan", "Catatan"]];
  const I = it ?? [], n2 = (x) => (x == null ? "" : String(x).replace(".", ","));
  const m = modal(`<h3 style="margin-top:0">✏️ Edit form kirim ${esc(k.no_kirim)}</h3><p class="muted" style="margin-top:0">Ubah yang salah lalu tulis alasannya. Setelah disimpan, unduh ulang 📄 PDF — isinya mengikuti data terbaru.</p>
    <div class="row" style="flex-wrap:wrap">${H.map(([c, l, t]) => `<div style="flex:1 1 140px"><label>${l}</label><input data-h="${c}" type="${t ?? "text"}" value="${esc(k[c] ?? "")}"></div>`).join("")}
      <div style="flex:1 1 140px"><label>Status</label><select data-h="status">${["DRAFT", "DIKIRIM", "DITERIMA"].map((x) => `<option ${x === k.status ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
    <div class="tw" style="margin-top:8px"><table><tr><th>No</th><th>No. sample</th><th>Berat (kg)</th><th>No. kantong</th><th>Catatan</th></tr>${I.map((r, i) => `<tr><td><input data-i="${i}" data-c="urut" inputmode="numeric" value="${esc(r.urut ?? "")}" style="max-width:52px"></td><td>${esc(r.sample_no)}</td><td><input data-i="${i}" data-c="berat_kg" inputmode="decimal" value="${esc(n2(r.berat_kg))}" style="max-width:80px"></td><td><input data-i="${i}" data-c="no_kantong" value="${esc(r.no_kantong ?? "")}" style="max-width:130px"></td><td><input data-i="${i}" data-c="catatan" value="${esc(r.catatan ?? "")}"></td></tr>`).join("")}</table></div>
    <label>Alasan perubahan *</label><input id="ekA" placeholder="mis. salah tulis berat / no. kantong / penerima">
    <div class="row" style="margin-top:10px"><button id="ekOk">Simpan perubahan</button><button class="sec" id="ekX" style="flex:0">Batal</button></div><div id="ekE" class="err"></div>`);
  const q = (x) => m.querySelector(x), E = (t) => (q("#ekE").textContent = t); q("#ekX").onclick = () => m.remove();
  q("#ekOk").onclick = async () => { const al = q("#ekA").value.trim(); if (!al) { q("#ekA").focus(); return E("Tulis alasan perubahan."); }
    const hd = {}; m.querySelectorAll("[data-h]").forEach((x) => { const c = x.dataset.h, v0 = String(k[c] ?? ""), v = x.value.trim(); if (v !== v0) hd[c] = v === "" ? null : c === "jumlah_karung" ? Number(v) : v; });
    if ("jumlah_karung" in hd && hd.jumlah_karung !== null && !Number.isFinite(hd.jumlah_karung)) return E("Jumlah karung bukan angka.");
    const items = I.map((r, i) => { const d = {}; m.querySelectorAll(`[data-i="${i}"]`).forEach((x) => { const c = x.dataset.c, raw = x.value.trim(), v0 = c === "berat_kg" ? n2(r[c]) : String(r[c] ?? ""); if (raw === v0) return;
      d[c] = raw === "" ? null : c === "berat_kg" || c === "urut" ? Number(raw.replace(",", ".")) : raw; }); return [r.id, d]; }).filter(([, d]) => Object.keys(d).length);
    const bad = items.find(([, d]) => ["berat_kg", "urut"].some((c) => c in d && d[c] !== null && !Number.isFinite(d[c]))); if (bad) return E("Berat / No harus angka.");
    if (!Object.keys(hd).length && !items.length) return E("Belum ada yang diubah.");
    q("#ekOk").disabled = true; E("Menyimpan…"); let n = 0;
    try { if (Object.keys(hd).length) { const { data, error: e } = await sb.rpc("admin_ubah_data", { p_tabel: "kirim_preparasi", p_id: id, p_data: hd, p_alasan: al }); if (e) throw e; n += data?.changed ?? 0; }
      for (const [iid, d] of items) { const { data, error: e } = await sb.rpc("admin_ubah_data", { p_tabel: "kirim_preparasi_item", p_id: iid, p_data: d, p_alasan: al }); if (e) throw e; n += data?.changed ?? 0; }
    } catch (e) { q("#ekOk").disabled = false; return E(e.message); }
    m.remove(); toast(`✓ ${n} isian diperbarui — unduh ulang PDF bila perlu`); selesai?.(); };
}
// v.40: Form pengiriman sample ke preparasi — PDF A4 dengan kop surat PT Terra Grapindo Eco Prima (sama dengan Berita Acara)
async function cetakKirim(id) {
  const [{ data: k }, { data: it }] = await Promise.all([sb.from("kirim_preparasi").select("*").eq("id", id).single(), sb.from("v_kirim_preparasi").select("*").eq("kirim_id", id).order("urut")]);
  if (!k) return alert("Form pengiriman tidak ditemukan.");
  const w = jendelaDok(`Form kirim sample ${k.no_kirim}`, "A4"), I = it ?? [];
  const tglPanjang = (t) => { try { return new Date(t + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { return t ?? ""; } };
  const n2 = (x) => (x == null || x === "" ? "" : fmtD(x)), tot = I.reduce((s, r) => s + (+r.berat_kg || 0), 0);
  const perTitik = Object.entries(I.reduce((m, r) => ((m[r.bhid] ??= []).push(r), m), {})).map(([b, xs]) => `${esc(b)} (${xs.length})`).join(", ");
  const baris = (l, v) => `<tr><td style="width:30%">${l}</td><td>${esc(v ?? "") || "-"}</td></tr>`;
  w.document.open(); w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Form Kirim Sample ${esc(k.no_kirim)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Caladea:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>@page{size:A4 portrait;margin:0} html{background:#eee} body{font-family:Cambria,Caladea,"Times New Roman",serif;font-size:12px;color:#111;box-sizing:border-box;width:210mm;max-width:100%;margin:12px auto;padding:0;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25)} @media print{html{background:#fff} body{width:210mm;margin:0;box-shadow:none}}
  table.lay,table.lay>*>tr>td{border:0;padding:0;margin:0;width:100%} .kopA{display:block;width:210mm;max-width:100%} table.lay>tbody>tr>td.isi{padding:2mm 16mm 4mm} .kakiSp{height:28mm} .kaki{width:210mm;max-width:100%} .kaki img{display:block;width:100%}
  h1{text-align:center;font-size:15px;margin:12px 0 2px;text-decoration:underline} .no{text-align:center;margin-bottom:10px} table{border-collapse:collapse;width:100%;margin:6px 0} td,th{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top} th{background:#e6efe9}
  table.d td,table.d th{font-size:10.5px} table.d td.r{text-align:right} tr{break-inside:avoid} .blok{break-inside:avoid;page-break-inside:avoid} .ttd{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px;text-align:center} .ttd div{min-height:110px} .sp{height:62px} .nm{font-weight:bold;text-decoration:underline} .m{color:#666}
  @media print{button{display:none} .kaki{position:fixed;bottom:0;left:0}}</style></head><body>
  <table class="lay"><thead><tr><td><img class="kopA" src="${KOP_HEADER}"></td></tr></thead><tfoot><tr><td><div class="kakiSp"></div></td></tr></tfoot><tbody><tr><td class="isi">
  <h1>FORM PENGIRIMAN SAMPLE KE PREPARASI</h1><div class="no">Nomor: ${esc(k.no_kirim)}${k.status === "DRAFT" ? ' <span class="m">(DRAF)</span>' : ""}</div>
  <table>${baris("Tanggal kirim", tglPanjang(k.tanggal))}${baris("Tujuan", k.tujuan)}${baris("Proyek", k.project)}${baris("Titik bor (jumlah sample)", perTitik)}${baris("Jumlah sample", I.length)}${baris("Total berat (kg)", n2(tot))}${baris("Jumlah karung", k.jumlah_karung)}${baris("No. segel", k.no_segel)}${baris("Status", k.status)}${k.catatan ? baris("Catatan", k.catatan) : ""}</table>
  <table class="d"><tr><th style="width:24px">No</th><th>Titik</th><th>No. sample</th><th>ID</th><th>From (m)</th><th>To (m)</th><th>Zona</th><th>Core (m)</th><th>Berat (kg)</th><th>No. kantong</th><th>Catatan</th></tr>
  ${I.map((r) => `<tr><td>${esc(r.urut)}</td><td>${esc(r.bhid ?? "")}</td><td>${esc(r.sample_no ?? "")}</td><td>${esc(r.sample_id ?? "")}</td><td class="r">${n2(r.depth_from)}</td><td class="r">${n2(r.depth_to)}</td><td>${esc(r.geozone_id ?? "")}</td><td class="r">${n2(r.core_length)}</td><td class="r">${n2(r.berat_kg)}</td><td>${esc(r.no_kantong ?? "")}</td><td>${esc(r.catatan ?? "")}</td></tr>`).join("")}
  <tr><th colspan="8" style="text-align:right">Total ${I.length} sample</th><th style="text-align:right">${n2(tot)}</th><th colspan="2"></th></tr></table>
  <div class="blok"><p>Luwuk, ${esc(tglPanjang(k.tanggal))}</p>
  <div class="ttd"><div>Pengirim,<br><b>${KOP.pt}</b><div class="sp"></div><span class="nm">${esc(k.pengirim || "(......................)")}</span></div>
    <div>Penerima,<br><b>${esc(k.tujuan || "PREPARASI")}</b><div class="sp"></div><span class="nm">${esc(k.penerima || "(......................)")}</span></div></div></div>
  </td></tr></tbody></table>
  <div class="kaki"><img src="${KOP_FOOTER}"></div>
  </body></html>`); w.document.close();
}
// ---------- Berita Acara: BA stop bor (per titik) & BASTP (per periode) ----------
// Isi diambil otomatis dari data aplikasi (data lubang, DDR, logging, foto drill pad & patok), bisa diedit, disimpan di tabel berita_acara.
// Cetak A4 dengan kop surat PT Terra Grapindo Eco Prima. TTD BA stop bor: Wellsite Geologist TGEP + perwakilan lapangan PT Nusa Prima Gemilang.
// TTD BASTP: Pihak Pertama Direktur TGEP (menyerahkan) + Pihak Kedua PT Nusa Prima Gemilang (menerima), sesuai SOW butir 12 (kriteria penerimaan).
// Kop surat = salinan persis kop Word "Kop_surat_TerraGrapindo.docx" (header & footer dirender apa adanya, termasuk ejaan aslinya)
const KOP_HEADER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABnYAAACMCAMAAAB2xWcfAAABIFBMVEX////+/v79/f38/Pz7+/v4+Pjy8vLs6+vk5OPf397X09LFzMjAwLxnvJsivIIcu34avH4aun8aun4aunwVvn4XvH0UvH4Xu34Yu3sVu34YuoAZun4Yun4ZunsXun8WunvxoCLJqoj5nAj6mgX7nAD+mgD7mgCxsKm0pYWlpaW1oIeYraNzqZH9mAX9mAH/mQD8mQD+lgL4mATXmDPEjE2Ki4l+bGwquIIfuH4duH4buIEbuX4cuH4buHwauYAauX4ZuX0auHoXuH4UuHwxtIIitX4dtX4YtXxRq4cwrX9UgnFZWVnGBgbIAwPKAgLMAQHIAQLPAALNAAHMAALKAAKfQUGjGBmzDg68BwlMR0czNDQfHh4MCgsAAwAAAAEAAAD7MLH6AAAdzElEQVR42u3dCVfi2NYG4CTMST5QVMIkeJ1SCM4SwpgACUMzq8x2+f//xbdDleUsVrXlvb3qfbqrHBqou2j7vmufs88+DAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8OlYhqPfWLwRAADwO9PGRoHDcoThWJblmMXf9BUAAMDvKXJYsTVt8e4bmZmJjCfBOCh06Lt4cwAA4MPihmVtVkmTmIkcl54lWjee24T9Zu6Rp0x6Pm2JVPlwLIoeAAD4oCpHaKUZG9OazRh7YuZUbil2XPOZkmgxrSmbuHGwnMBzNhQ9AADwz3BWnZOYt9JzkWPm7plil29aiuC6TXhm7lmrxUzTNlpuE6jmmclWkwGSBwAAfj11GEERWfmW5+cehr+Z3dzKwpzh7BQ7woxRbhVmzjO2G3drxnGJWzfVO6wdi20AAPCLqeOethTF4b6ZteYyp8xkXmk5FcZuc6R5aidwtxJOKoSmU6p57A7hVrCzTFp2IHcAAID5pT0dZcYw8tw1bTHp28Q0Qe3STl74zwH5jyzyHqudmk+nnfQ4jkn/TdWO6+ZmxmOlDQAAfrp5bRE7Uzbd+jshzxiHLB98uTg/P9+6R19dXHz5j8y73Mp0OqNUsrdmzkTLaeNwlhQAAH6GY3EaJ/FV4MS/RYdTuDjf2t47PDra3Tk5Pt7bOz45OTzcPjs7Oj3epvy5kJ0O1s7aha+zW+p5ExNO5A4AALy/2EnMFTeVLK7WfNYSxQPKnLOzk72Tk9PDkxPr497e3v7e/v7e0dHh4dHZzjYlzwFvZ5Qbj5BglHlrlkbuAADA+0YR0OybxHQ+9yxOiTq+UOZsHx4e7u3v7u5SyFDoWFlD8XN8fHRE39w7Pj4+PTvb2rpgPdObhJ2/oU2fuZvF8AIAAFgeO5yDVsiEKT+/UWwumRbXznb3dw939vf3d/cpaqyQOTo8PTpe2Nuzqp+9o+OTPQqec5kRFSExZRxsgl9MbQMAAHizlYATbuYuxn1zK/Jp8WJr5/SEipw969fx6akVNFbanH7LnN0966u9RcVzerize7Yl8wLjmjs4B7VSz1sOlDsAAPBm7DjTU3ma4Gy0SMZfbG1tH1plzdG32ub09Ohkj0qffQtFzv7OrhVHe7TmRih/zrbPxUZDTMxmc7cyT9NoA+QOAAC8jnPINPZmnnYzM/vB1tneGcUJRc7R6d6irjk9PLTi5ptFDp1+r3Z2dg4PT+nj9pekkUkxLof7a4LlaFQo1tkAAODV1HHyjvR8lm7NReGCUufkaO/0+MSqdY6soKHPjk6o9LkLnbsy6IRa2vYodk539nfP3UbdbCYdrq+ynaPzPogdAAB4dQKbdeqmNXdyrHy+fXJ8un1E8XKy862DzdrBsVLGamb7trBGH61VtsPFCtzODhVDx8dbfMMs1Y0GLdbRELcWvaYNyQMAAC/hZ2mlxVhrbNRKYJ0EpaaBo6NTihcKl/0TK2ispunjoxP6yzq4Q59bXdXWAdKjnf1Fe8HWl1RGC+nehpCezVvUg80KaCwAAIDn6AKDlmt+MxXdAjVNHx1u71DwnFIPwS4lD53LOaNTodvUUbBnfUpZc7RYbTs+Wuz+0Bqb1eNGkwsukuZ6Va2bhryonzjPzRRDqQEA4Bm3XbyZpRNKmhbYjqzpA/sUKdZxnTNr/I01fe27CzrLY50gtaKISp89Wok7tBLnkPZ4FrETqJqmrjdTLjt1FdwoioJzowAAwDzd1+FpM4YubTugQTi7tE9jzb85W0TOxRcPDWnzCHIymaTB0y6O8Xy5WMwE3T6zToxa7QRWvUObQCe0yGaGNrLl6rq3mWJsAt3Qw8xdHHIHAAAeYN3TNN2gk/hbpL7pHSt1do6sMoeGfIpiMpVqGEbGSzL00TQaqaQoCPLBouzZ2dmhWW1H9Jyds92zc75R0yObGwGpkss0PK20ezqdO90sRrQBAMD9QBymNXPRODWPw6p19vdo5CetoG1d0LAbK3BM06wVdC3qz6vlcjxejeVqGaPRSHrsi7JnmzZ3zrZpqe3o+OxCyFQrkYjfH42GNbNBN5E6ZLeHLonDuwwAAHccHnlOM6en6YOtw9PtXRqzRgPWvshJqnK89WA8vhkMBnVN00qRqLS5uVmJxWLVuM9rNK26R16suFH20CDqC7Gh6tpqPluIhmJS1Wx4OI5N37QwrwAAAH6wyzcOx2w+VWiF7ZBa1/asAHEnmz61WFZ9viAFT2AjVsqVwrFATMtns1ltdaMaiHnLcV+NltwEp2glz/mFyDRqdVXNa2rWvyFVpVK9wThaN18FDw6OAgDAd6xrxnOcZ9qSt+jynLPT0+2tL8mUtbZWLpZyuVw4EJAiq9ZnFDz0IasW1aL1VU3NlomasXZ7ZFEQk81MXTdrlZBW0GJaQQ+FzYYwoyFt6TliBwAAvk+dnn2du+02h7i1bc34PN0+l1OGWa7rvpVQoLrhy9dy+WJe868txOO04rZCaeMLh2L0aXxjpew1zQx1G9CTquGIqq8H/Plo1DS9kWqYJrTZ07NpgnHinQYAgMVVolOhNU84nBfbh3sndHPOudww1GLcVyjovvh6PF6s5TRdX9P1TSt2aJ9Hikn62mY5GJakjXgsputltRKKl/OleDwejmmaJOU3g5uqqWZX4nkj6ZynWY8yQzMbAABYsWOz25j0rXyxdWxdX7B79kVupFLUS+D1rZXXArFYTg1F/W8rlfK0ACdJweCmFC6pvrXN+Ga5rBfLwQ3dkFs8XRonIHYAAODbKhvD2USZmtGs2DnePz+wDoUmG2Y8UKisFLK17Kb+dupQ6VOkPoNSVCtQvwFVSatSVFf9G6FYuFSqNTzpG8XlTicwrQAAAJnDfvudOz/b3tnd3t872t22BhCcf2FSmWouJ6lmrlRcezt2dNrw2SyqapYqHj3v84XJohchXNJKoXpDFBhxfjNH7AAA/Omhwzjsi9SxNnase9po2MAuzQCl46Jb1FjgzYXXy4VwqFh8O3YoWwKBaNFUC1KAVteKRb1aqVRWN+LlcrBcyGVSjumcrhvFjBwAgD8dl05T9tiZ/2zRTaHWBQc01POE7jCg6w52zl1GLlwNSoHA0thZdFlHqNyJblArgdXUZrFasONl06wbQpKZKixG5AAA/Omp47kRbJxz6jqnqw4O6aAotRQsrm47O9vft2InthmkQoa6p9+OHa9a0FYrUa1e8y4mtvEet8eaHfp/RiZXzZtmg6dyZzprYZkNAID5o9fY0rctuobNdbG1t3dKsXN6emK1s+2dbVN/AcVOdc0sl8LhJR0F/rV42etbCQTqhpHy0JKd3eXxuOmSUpZ1iI1MnQ75pGazdPpm7sB7DgDwJ8eOY5qY3ii8TPe67e/t04VuR7unh3R6Z3vnZIfuMFDX49RREC4Vl8UOHR+tl1QjJbvdcno4HH0zHB6ILoeQMlZihkdszdIevOUAAH90seOmpmZ+lrg4O7Surt6h7Z29Q5pUsL+9vX3+JWnUVzbqFDv5ZXs7a3Uf3SeacjGe4Wg8aXcvB4PLXq/b6XXGI8XJuBo0Pqc1ddkcdEIIAAD+3NwRZboB1HmwRfdW06bOKZ0VpeW1b1e7yalMXS0HArlwiHrTXtnT8Wt5GkwdiYZrBg0ElYfjSaff7132+p32hLTp9/FYEZ009yCZkOnuHh5vOgDAH8smfv2qsDbP+Zl1TpTuB93/fpuo4KZ7dsobYc0fk0rh6NrLx3Z0fzavmrW6b6VaaghU6VDM9Aa9Xq/THtMKGx06lQ8UKn/Go6HNkUpN/769/RtndwAA/mAtOU2j0g62To6OTnZ2zxZFjry4TDRjFsubS3Z0YiEtq0t1b51KHY9LGU0Gg07n+moyHqZlj4Ojm3asX27xYDga0oVxHv6rSL1sAADwx5q7lLSduTg83f22m+OiIifjzVViEvUImMsaCQIBvRhfX6nWjCQjjNqDdv+qQ4tqQ55h7XZuUdaw1sQ3luGHI4Wzca2buQv3HwAA/LHcrZtFGxu1E+xQ6NB1B5Q5dI1OkeZH++iTJbETChWD64EKzb5xHlDqdPudfnukCFTjsE/uzGY5UVGcrunMjdQBAPiTOdI30/Ptk93j7XOe7tiprcTj1s0GcfoY9/uWxM5q3iwHJbrIjVHGncGgP7iejHjWxr7QMcfaGHkq/O2xY2sHAODPZZUhroMta1fnCx3rrMSC8dIq3V2gh0tRusMgvix2CqYaCjcE93DcpszptscHtKPzyp9F15fyPDIHAOCPnz99sHVGqSMbvrqXJkbncsHg4vrqMF0cuuyQaN30VjIyM5z0+51ul0odjnu1mmEZG5U8yB0AgD/9xChdeHAuJ42adVdBOBAsW9XOasm6uqC0JHay5VjIm3Ipk561rTMZiZgwDQAAS2LHvXVK2zqmr0zdAeG14GbWNNViuby5ueSKHVL0VsMN5mDc6Q0G1+2Rk0UxAwAAS2JH3qLZa+ZKXVXj66Gsqq3mskWrq4AmE+SXxM5mMJcRXcN2t3s1aKPWAQCAd+ztCBdiyrdRVanICQZzZikgSaFQSIr5i9mXY4e+G/1+bqeaSdHGTq9P/QRj8XNbo50ej8eFf38AAP+6EdTJZCqTq5eLuXC5GA5rUigaWfDTrLUXUydbiEixqObL5+OS4RbH7W5v0J0cvP8Kt3TrTcsTR1bmt99NMdQaAODfxM7TdThmfcWb8VboEE48WF62spbP5iPRqF/zaf6K1yp2qNShJbafmD7Qun3TkmcLT58+T9vx7xEAgPm3DAOlUThmI60oSsOKHbqRelnuUBFk1UL+iF7JiPyIzon2JuOfOZHzT2KHn73wjHkCwQMA8C+R9Oa8zeRo0h6lm6VoqLQ8dqyKx9rfiUq5hmM4uRrQEpvCsOxnxE76ledMsc0DAMD8K07tpGraZmM6pjmew5S3FAqHY5G3IycSi9D2Dl2xI0mZJD+midN0lxv/M/0Evxw79umrT5ojdwAA/h2xo9bURpqm20yGcsYsr8WkJbETlaIUO/mIVFlt2g/G1pGdyZBlPyF23kgd5A4AwL8Cx6SqpbrZTB+MJ4qYKZdVPbQ8dgqLZja/uuieHgwGI/enxM6T583nj5bZsL0DAPBviJ3GerhaMVLKeCSmvLGCuhZcGjv+gkqxU6mbSWbU7l12B0Pmp87suDw//Niruf+W5z37OkrC46ROaj7RQuoAAPy7YidjmsZfw/FItje8uXBp6VCcaMxfyNLxHt2kPrZJ7/K6PZF/+aRo4p1d08R5Hzoz/kGGLYLnRw+1J/GN03oGHRCaJ348nzKqZRVIrVbiSbR9f471XVe6NV08BGt2AAC/Z5EtlUooo/GIt7uNcjgcLJf1JbETpdiJboR8puE5sGJnMnLbPiF2lB+p8+ScjkzfefaCHob/thP0LXbswuN9odaj4Pn+zcTdc77VTwJ+PAAAmA9vKaCKYDgaHjg5m5gJShJNYlsSO1ohqhekeFyqWe3TvcvBTzYU/GLsuO5T5+k/EtLPX9CT+JElVjLNn+0gPQyeu4cmnnRlO/EDAgDw4Wxu3slYl7MlVWktGNSXTimoSdHiRnBzw5tyjNqXl1cT8TNi58fOzsz+nhf8UbYkXjvt86D17e47zx7C48cDAOCDqx2bdVuBnbOW28x4MRhcet1BPrsRzQfX8r5M0jVqDy77YyfzCbHzYzqB530v+DB2PC8fMX0aO+jKBgD4lBnU7PddHlMv6HTF27Lc0QLRrF4u+jICT41sV+2f7GP7tdhxvbrE9o7YebAv9OwfvRk7aJADAGB+X0+bmc9qy2+y9scodvxqVjWcIl3wdkWDcT4hdoS7Bwq/Ejvfu+BmrUSi9aBrwPlS7MxbDxfb0vjJAAD4TcttRq6UpZk3m/5lw3FCWt6fL9UajDzp9rrjg39wu9u7YyfxvjW2R7EzVxKC4LnbGZrdBZZn9rTcefAc2VpWcz1oQUC5AwDwe2LHZYSj2XxeX7a5Ew3SJNCSVsnSddb9Xr8zFu2fGTvMu2PnYZ+1c/agSrLfhUrrWezcPcr1I3dk/GgAAPyW2OG91XBeyy+9yToaLBS0WCVQSDFKl2Jn5LExvz927nZnZswrl8aln8YO/44Vu6exc59NP3Jnhh8NAIDfwSN6q6v5Ur6wPHbUQlSKBdQkM+x1e52R4+MX2Z4PaXs9dlqPKpcfL6gw7+hPePLHKb92kBUAAH5+ZycheCt6Php5+SbrZ7ETjWes2On0qJHtM2In8epeyyux8/yop91zNzkn8UrsPFxQ8zzcTLoFAHg3RArzrj42Rcjo2XxMii5rZIvG1YIUWysaomvU6wzaF9ynxo7nfbEzf/IoZ3r6+g/H3ZcPT+nYETsAgNj5ndWOwmcKRT0XCy27bycSLsQDWtln8PK4272cHHDMJ8QO/+oW/8ux01rSV/1i7Dx6yvTBH4j/jAAAsfPBbEO+WVgL5nLSxpLYKeVy8XWtphnu4aQ/uByL7GfEzo/50633xU76XXdhI3YAALHzX+IauY36RjBnZpfHTrYcjKm1hnPUvqbY4T8ldn6kwLPzoi/HTuIdtc77F9kAAOCDF9ncI75R04OaaUpLY6eoZkMlb4ofd64HPbpZlPmEBur7gmVu/+nYuYuseTrx7Sa5d7QU8IgdAIDfGjsHqUytnFcLpaWzQMuqGgplZHkysGLnH90O8P7Yub/lTfnZ2HE+64J7RwN1GuUyAMBvjZ1h0qgVi/F4aVkHtV5Wc7GY4VTag96gO3J8Tuw82J9pOX8udoRn+z3Lj4t6ns+pBgCAj+McjWSjEvetB/JLYye4mSvlGsyoc3lJ1c5nxY79fk7a/EGo3E1YeyN2lKdzC9KvxQ6G4wAAfJbRJNFYX6/76r6lsROP+2q1lDjuX39mtWNdXv3DjHZp7HaPfH8a543YkZ80wQm3r8bObdrayvEkMAoUAID5ved2hu2hkKnmyr7Ksq2dfCCwWTPk4eT6unf5drXDchzLsezrB0p/agRN+q2OxTdi58csHNlanXMK8zdix3qlW1x8AADA/O4pBcPu2JXK1Wpr4SWdbPlCaL1sNoRR56rbe6OlgGU4G/3m5Kl+sHEfETtM69di5/5m0tuZMnujgfoW17wBAHzalILOZCgbZm49EIlE/Jqfxq7p9xeNavm8n75NvyJaNhwvZ1IHk86Aqp3LVxuoOc4uJBvNptlspmQn9xGxY3+j3lHeiJ30O8/t3OJSawCAz0IxMpZTmWpgvSSF/CqtpAWKxfsSx1TDAbp5NB4IhdW67m0yw0G3P7jq9sce9sUYszFCo5kxa3pUN02j8cqY6p+d8yy/lg8J5o3YsT+dxzZ/X+zMcWYHAOA3sfGjTmfoahTCFTMSChaymqSr97Gj0dfSWrGo04jqulqqpfjRoHd99XrssHyqaRailUjEp+ta3dvwcB8RO4zrxYU2xcm8FTtP65104uXY4eeP1+2wwgYA8Luw7JDKHUU0aqZZjAc31ZpqZu972iKhDamoqmqW7uMJFnIGP6T7rK8odnovxg7L8Q1Tza9Goz6/rvvq3mImxXAfETvWLOknmTOTnc9fMPF6mUSV0Suxw7iUB6Ej4KcCAOA3xg4/brfHiaRhpU6waGajodL9wIJIILSZLepSLBYLBXKZpDju9PuDwVXvxeE4LJds1nxSKEbbQ7Q/pPv1erXx4rU8P27A+an/sXy69b0uaaUF54sv+Gx5zC4orekt3ULKP3jU89OjTllpzWatdMKJnwkAAOb39rJNrtsje8qsaNpGKLsWCIQfzMkJbhbXgoFALBwLBGoNarfu9Sh2er2XOtkodQzTWy/GJeuZPqp2fN5K88P/f/zjXhBzcAAA/gvljjjuUjeb0DBruVK4WAw+jB2tWCxv0hVwBW9htWYIB+Ner9u/XMSO7dkLWbVOIavqK1YnnP7tN7X5P1w+IHYAAP4bwaNMBt3JkGlkcpWct1zWK6sPWgqKQclfV2u1LKWOSHNxrmn89GXvqjt8tmfDCs36aqmQ31jL31dLWoNB7AAAwMMqxTnsDq7GCtU7sZwW2cyGYw9iRw+FCqq2Uc0aspuW2K4pdi6pl63zLHY4vqmGAiEpWigUFrljlTsxqcFwDGIHAAAebMnIk6vrq4nCNLylarxcXH1Y7UQDsWx9pUrjCdyjyfWgf02HRXv9q7byuFWA5ZiGuRFY34jRUZ9C/lu9sxrVvSmGZRA7AADwIDIc1BZ93Z4MxWQjo67FK9qj2AnV1HqmIQjUaU2ra4PBoN/pd9oHT17EnsqYxfVASKObe2i2gUavEYlGs4bIYZENAACeVCoUKZ3OZKQ4xEam7i2UKDf8UWooyGcrgYppGEkmMZoMBpd9K3Y6nX57LD4+U2kTG2bZLAejhWw4EKJqR8tHJd1vvjamALEDAPAnB484Gg9Hk8lklBbFFA23oek2BW0tq9bKZsZoJD3ikE73XFOhQ64ue93JyM092h9yNNS8ltdoqptG49u0KMVPKLBaawosYgcAAJ7ihJEojtqD9piufWNcyUbDMDLEoMxxMfJo3L4cUKVz2VussvV67eHjOOFSxoOLEwrZQNTvz0qSSTMKEDsAAPCsm43lnaw1+WZwRckzTB+IgvhNIj2k0OkOFqMJLgeWq8urMf8odljRqIQiD67mkUJaoVSlnuv/5WKH8XyHHwAAgE+/AMFOfzuH4+7VdaffpeyhsoeMx5N2u9MbXF5TC1ufDooOqOftetB+1D5tdbHVAxv3sSNJeap4QiEjxeGtBQCA13sLDqiy6Xfprw6lTf+6M7G+oo5pWly7pIaC/jWVPP1OZyw+LnaSmYdnTP2BQN7MhmJmiv2fLnYAAOC/njusMu5cXlGyUP8ATZq+pN2ca2oj6FrJM7jq9AfWcJzJ450du2Coulq7b7uWNujyhBW14bLhLQUAgDdzx2E1rQ16/X6vS+XOgHLn6vqakqfb7V5d9a8vB9ft9tD5MHZYZ8Nb1IvqfewUvdJKxXzlqh0AAIAHzQV2alyb0M3VfToV+n197cpKHit0KH8Gg8mIf3hmh7U1zKq37oveL7KpdanqbdKjsMQGAABLg4dzH1DFQ4dC+1bgdGmNbdE2Pbi2goiGVfPco0enjNVo3Ft/0FJQ8BZ9TQG1DgAAvKurzcaxtNTWWUwluFyg+w5oe+f6atAdD50PqhiWoTt2fPVs1rcavq92/HW/IdpQ6wAAwLsrHgd/QAd2Jp1FnXPZs0qebnsyHsrcwwOgNEa0WQroxawe0bVILBCjG7DpNlK1meQQOgAA8BPJY6eJNyIlDx3d+YaO8gx5xvaoc5oTmqa0sZrVopF8Ni8FQj6vWfTVaIYbWqcBAOBnu6k5zuER5YO0oijpA1lwcdyjDRuO7hM1vfpqMZuPxiJZVS1EA4FAtm4k7QgdAAD4leix2e+SxmZ/XOlQ4ZM06t563Wtt50Sia8WsGg2HqipddoBaBwAA/snItuc5wnLOlFFal3z5UCikZQvReFAvFEoFupoH+zoAAPDR3W4s38xE/VJFjQbWAwU1Gw2u5fOFgvGXG+d1AADgg9feOE+q6a1l41qW7h8NrJqmJlE/Wy3XTDmwwAYAAB9Z6HA21p5sGmZ9Y2UlX8j7o9ma6Q1VKzSaoMFT0wFiBwAAfr6esTweNG11GFjdbUKqYdD1o76qXshHqHO6ZqrFULXkbaY8KHUAAOCfnd+5Y7PqGNbOp5qGVo1WfZVqVvXmY1FNVYuVlQJdfu1hMZoAAAB+JWz4hiWVSiZlUbCIoiwnU6lG08yYhUpBLeqSFItVIlEpqlWlitlsyHZ0sAEAwC9u4CQbmUrFazySyZhmVo/69XLRtxnciJONjY1qtWIafwmMDbs6AADwy3s7vFXZ1CqViraaz2uF1dKavrag6/licS0uSdS7Vqyv1qnQSQl2DgOnAQDgH5Q7NN9GbhreQt2r1mqqqtd9ef2Oz7ciSVU9q5qm0WyINpbmF6DSAQCAf9jMZheSjWYz412NVkq+bEGPVCQp6te0cEUr1MxMhuoc2WPnsKcDAAAfckKHSh5WSP3VNDJU86ilcCwUo9a1UsybMZp/pUQHs3gIAADAh42hZm12t2B1saUad1JJWXA7OGtENd4iAAD44KKHgsf+5OAo9+Q7AAAAHzyFmruHxAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIA/2/8DRTUxajWMwv0AAAAASUVORK5CYII=";
const KOP_FOOTER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABnYAAADNCAMAAACywb7WAAABgFBMVEX///////78//6s/9gk/44E/3oC/30D/3kC/3gC/3cA/38A/3oA/3f//v7+/v/+/v7//v39/v///f39/f3//Pz8/Pz7+/v4+/36+vr5+fn1+Pr39vb09PT17+zu8/Tv7+/r6+vo6Ojn5+ft5Nzk6evj4+Ph4eDZ6/LD6eTp2tTZ2dnQ2N3R0dHox7zKysrGxsbDw8O+2u6v0uvAwMCux9i9vb28u7m7u7vOtaqzs7Ourq6oqKj/jRj/gwPfl26jo6Ne86ML+nsA/HcAzJmZxuaGvN5vrdlepdaenp6YmJhOnNOUlJSRkZGMjIyKiomGhoZzh5Yvi8z/fwT/gAD/fwD5fByGfXx4eHdvb29ubm5paWmSYF9gYGBbW1tXV1f0JST+BAT+AwL/AQH/AAD8AAASesQFc8EuYINPTk5LS0tGRkZAQEA7Ozs0NDQuLi4rKysoKCgjIyMfHx8bGxsWFhYTExMREREPDw8MDAwJCQkGBgYEBAQCAQEAcMAAAwIAAADpviJrAAA1P0lEQVR42u2di1caydru6wt4AUzYE6IRMYJme2PhfRkDJoA5ueD9mMyIchA1JlkGRUVARfDrf/1UVV/obroRiJlJxue39ha6uvutqu5JPdRbb1URAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAf4/8AAABoGKgHZAcAACA7kB0AAIDsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/CVdXVxf9cPpIJxk/Pst/7128Ii+u5pyhJOmfG+LXdHZ14kEBAAC4A5z8b5dz+TJIyIwQDJRX5ktkXjglm3kSEU5P1pxOF7vOiWcFAADghxSns5OKiX9tJ0I7Okf5i35noDQfEmJUdtbOL2PrJyRx7g2W15xkPDaBxwUAAOCH4H4zdzqXSgrjxHcVOP5OhkrZo3Vn5JpspUOXR98JTSKpDNkWMtm0l/V3OtHnAQAA0BQu4o3M97tO0iSY9zvnhOSJECIC9bT9J1b+T+qYHAlbpLBCyElqSIgRz1mK6pSTuePw6AAAADShOvO5zGWMrBYzwnE3iRfioURpKDtPT00ekvVNErhc7y2ngsvCDA0xcJPlopOqzqwPTw4AAEAzquMvh2h/JzAkzPtz2cHjONObgcHnz5+PPn/2zON2k15C5hPHp2skVKZic5ilHraB8kW8v/noAveATL9bSfQNVHPbWXdVWpfWvMckW49huXR5GuCdi6yuLb7or99olU3DyivpLuVrV+WUh1+tu3vA5zYv48r8jOeWR69+YspTfhFbXY3N9DZn0ag+Zm/BsJ5SbjTR2+B7AQD8JhHTzFdG1vNk/OT6kFwmiG97YnzsZTj86tWrjx//pHz8+NerV+FweOz5M3ZHKruWECK0yxPPB1LZoU7iai6eek6ocHm2PcdbnnOhmhnlFuOzc1VpAZ3565PkC5dBtup0mRf8TNxcLRePS9LtJ6ue+oxW2zSsvJI+oHxNVm6Z59dW3S1cHMcnTMtYTIectR995YmJ4raSKYtJpXSwOYvV9TF7C5V6bup1+pImpht5LwAA8jtFE3TRNm3I7Y+X/2d1tXt07NWrT68Zn2Rei3z6SNVn7Flk53CednZ6L4qrnX43G+Jx/ajsMLLBnyY73PysSbaz2mKlxaaz16TUkZz65lykLqPVNg0rb9AcC6u3yg4XwKA6u3nNczqdaUB2Ynl1atrfrEVtfczeQqWexSGtvR1BLzu3vBcAAPld5umMb/aSLpezN5uLbeVmyfMwk5xPtIfzkXV1Pv0p/v+jCNefj1R5aAfpP+uXk+lT4jvMHU02pTvVbd/az5QdobxinK2ULhGQUleMuzoJ/d3bztuNGtg0rLyR7JRe1CM7gpBS2uOuLd2p0lq9suNJ6pKvJpu2uFbzaVfV87vG3ERZLzu13wsA4HdxsDm7yKGQn2MdHn/qaHti7NWfrE/DXWtGfJK058/wGCHHF+NkoPOoOL96+YJ03oXs0OC5nyg7zHyNdAm54T03qpEzVX1z7HajBjZrl07VHAsX/rpkR8h4dbmpWK9PdgyqdzXQrMXaT7u6nur+misj6GWn5nsBAPwu80MJ6SbJw/XSVhfzlNGODhUUc81R4MrzatS5nD0e9Av013gi5+pqfBKP2NzMz8zMzIbioqDk3JNzHN7I5MXvc5WRZeOzoqHJ8QoeE/O10kX6r420SCYuudY2Jwd9/hh3+2w5yW1GjWwaVt6wORbOvCayM/+CMr+ycyV5xMQXsCZ5s9bG+wcmNkWfWTlk9Oj1T0yu3vn6+ED/+HqWdWsiDVk0q4/ZW1DX81wVcrAo6GWn9nsBAPwm0WtkgP5L38zMF8pZn3uMOtc+1aE5Uq+HOtvGiDvmnxWoeA3Mq1bWaVB2BsQDz6GmTVnnDZHZnbqzoqHeOs3XylZqebmeHFfn6xdH1bfkcKq5nPyrv6ZRI5t1lE7pKHx3GcuOdDfpjYtBAMvsYKgoDr13S+fEXkKu1+DZ9BpXT77VvVkuBhuzWP/TNqhnJVrAV6iSnZrvBQDwm4zq9O6UMv3O+VJmfHD55SvmXPuzAWiPZ6zP8oDk4h5/F5nI5JLeBnVH23Z6WeiSkPhJsqMyXytb4mENXtF3xhKrVwBK6f1Lg5E66mJos47SVfxT8dqyQ2hQO+//eeSxeGFN751ar0N2UvpbYzOkMYv1P22Del7L3kQiD6BVZKf2ewEA/BZ9HVcgkxwv+clMuZ88C9NAgYZEh+nO64/PrVbLUCYvzA9cZ2KpM29jU3h0bed3dUNz57Ijmj+skV7x7iTJKh+k12fbyx09R/XW5bCWTbPKG8qOELlFdiT3GO109hb1ZXRz19bZ7bJjUr1GLNasj9lbUOopv/xAuUp2ar4XAMDvAN274PiS/ite9PpPvGMfGxcdrjthi90RHQ5MuuMX1O+U2SJdPyA7KXXrdveyo5ivla2T/5weJ17W1JZ0Mb0kxO+cbbAuxjbrKJ1Kdorjt8iOryhN8jEo4zJP8t8qOybVa8Ri/U/bsJ6iW9J5rNehW94LAOA3WffTf3V6nCxejD8PN+heU3j910hLi33BQt0uR3QVg2SmsXg2XYuUUf+SbUJ2zjIyyZrma2Ub5CFhsh9pixgEFFx0NlgXY5t1lE78KsYu5wZqyw7hoyYnhmUcrHSYaj4xk+o1YrH+p62v51VZGS+K8AemkZ3a7wUA8OtDZ4dmE/Sfd5D0z4y9et2c6LDuzpi1paXDHu3z/+8MnVixyVYGdTYpO7OaAYMmZEcVSlzTfK1sj+SIaD5L5Eq7OIvY5mUarYuxzTpKJ351fxfr5KktO1yd8sZlvNROOzV7YibVa8Ri/U9bX890Qh7E8rJQuVxI49mr/V4AAOTXj2FbzcepjyRZHiJsVMcgUk35c4uXLdra1t5mt44EC6dCppfvAOdqRna6Ixcax80dy45kvuyvkS43ahc8kPdYN4yu9CjUc0kSBco4qWnUxKZZ5atkp8vLHUzCTm3Z4UHOVwZlJNJsp/itsmN0K2nMYs36mL0FUXZ8TG3oWKMooKE5tezc8l4AAL863a71Uu9gaXnItxVgM3X0k3LYjFB5URxxrYIagzutbR0dbQ6HpX814qY+Ns/Rct0DPGLLc5KmZKSpJyly17KT+U45vhSkprtGOpFitkQXDvf05Lpq/+7n10/WNmpi06zy1bJD/GIjvtZ0b+fqzns7ZhbN6mP2FlSyQ2LiB4/iThON7NzyXgAAv/58ndXy+slxoRx6pnWwyavf8EmjTG+kldlYei3Z6bC126Pcsjt9WYjUO8JTPYE96/sB2VmMyLwwMS/OuzRLp9OPriudFHdeCg1Tscl7FG5z2TEwambTrPIGskPm+Hya8k4t2fkuiYNYxm51sYeEqqoYPrGq6qlrXZ9Fs/qYvQW17IiRBPNpsdOjlp3b3gsAgPzi0QShF7Td3iLecRbBpl164PWnv9hin2yzg2fP6K4HY2N0Ieo/WbpRrJsiOx22Nnu0hzxwHwtDQ1f+zs7mZCczSMhdR7KpOOqvma5M0q/qNxH1wLZ6lnwN2ZGNmtk0q7yR7JAV1erOxrIzUJImxASrFpoRo46FoVsj2QxuNUk2tWhWH7O3oJYdEiip5inNqmTntvcCAPjF+zqTJToasVWeJ2OflAg2vurAp1dUcHzDFks0GrVyolGLZbjv+Vj41Ufe79FJjzi208FpsVt7XCeFw8NxNvTrbEJ2The7yM+UnRVX7XTSe1FrOTiKh0cpZ7rqkB3ZqKlNs8obyo5qUTQT2UnI2uDhHq6MaoCND9GzILfbZEeqnn5srhGLZvUxewsa2SHygqMsoE0lO7e+FwDArz1L1J+bGTrykMPNscqwDhOVV+HRYSo41rZWEYdD/GyzRi0jw0x6/hKVR5GeT6//HLO22ToU3enbGqcTM057A4N1xRWILU86SUnEY/5awtK87OxsbW2lNONGZunSbBQth6RqmEPYNpWdaqOmNs0qbyw77uPasiOuYXberQhQZbi/89Bg4WbjJyZWTxWevD5PGrNoVh+zt6CVnV5pT4l5opGd298LAOCXdrGlrwK5FbJOKqrzke9lMGKJLlCVae9ob2PYKPxLB5OfFqo9liHqcfvrtbxC9Ud6G/WxtXfI2OzWB2ybUtqMZJz1rAtaPUDxE2RnQBmHFpeKNk93ZQ2at7JGDQfF1cl2fNJxTic7VUbNbZpV3lh2SH+uhuwMJFVrGfSLA/oJ6XEMiNvUZN11yI5UvaQ01OVNCuXlxizWrI/ZW1BkR5qZysVmRvlWx3sBAPzKOx0M+k/p79nDQ0V1PrKOjt8SperSThXH1qHHJmvPAvW5DSkON0q4b0F9PQ2k7nE+oAMRW+lkPWEFdyw7oWCFgM48/6V9OVSVrTpdbPP8XoW8ZrU2UhnUEC4TofHAzJrYBZmsYdTcZoOyQ8aL1bKzEqOsxNMlTRigtHpzPh4MBEIJ8bbSnFEu+icmV+9ii94a3C7Ic2zqt1izPmZvoSI7RIon0MhOPe8FAEB+2Wmiq0fEd3y+c6yozqfXf4VHLNbW1o42W3uHGe22dnqaS4/FMkrDDP6ioQdjw1aHRqVYf6c3JeSDpDDp7Py7ZUdNUmeeTwoRjlykRvqROpRaaYSLPk3Oieof3pM1jJrbbFR2xFk7tfbbSXvUsdRaFm8NIkyabNWTH2jEYm3ZMXkLKtnxF2VvXkV26novAIBfNZzAf+knTs9RYVSKnP74+lM4QJ1r7Qa9HAPtaWtj0sMcbv7B4ZFoi0N3V4s96s2+CAjx0mods3f+RtmRwrHWiHn6uKBf3ZgvAKZbaLkzXtbn5Tc3WsNmw7IjxXOZyU55Wwlxdq7ryliMkDplp1MfNJbzN2SxtuyYvAWV7JD5rXhvRXaO634vAIBfErqGwLGQ8JCHnkF5vs7rV2NUdGxt7R11wtxwNOjAsbBAB4I6qrSqhc3fmbnMpHtdzl9KdsRuynXAPH2nOjorqWxWpiJ4ps7oMu4xqItstIbNxmXHeVhDdtKa3QBmTzQhywFSr+zQ6qlHUsrJgcYs3iI7xm9hzmh1hElZdup9LwAA8iuGE2wdBUtZ+o8+LPd1Xo1b7W0tbR0NQTs9tvb2DkOxarFbyBFtLfzZlc6uX0l2enlzeuI2Sx8sVbuOAtUrXrI+4/yhNA3/Ih3rNayLZHSohs3GZYf0nhrJTuny7HC1aoA9mJKijvM7s3XN1E0q/5VEvkvVKyTHG7V4m+wYvoWaslP/ewEA/Iobu80OkqHj8rg8sPP69Wi0xbrAYgk6GqTd5BZbW8twKkJXCMsEGt1s9DeiK/AiMj/n/6Ur2BmYi8zPNlVGN61eJFh16w9YBACQexxUQNYDiovtddj/X0JGrK02W8cdYXNY+/xpNi48h6cNAADkfq/FRgdcXP+RXWxceD6+ohFpXsuC4850hy6TEzofJ5MZOuuvE08dAADIvXWxsT+dj+maOK//VC9PwObtsA5P00JDI9zojB+bHH/dRod3fCnhWNjsxELBAABwf/Hz4e//6dWsOs1Wl37NlxtoTnZYZJvDYac4HB1iGHZ728LwWXY2gy3vAQDgHvd1nP3nfpfTF1K72Cq7U7NtQpvQHVtbB9WbBbZmKF081Ea/sxC3drvV35lKd/qDboLxZwAAIPczlCBOV0/snM+oXWwa2Wm4u9PebnPYF6yWkadiFg/oSqJWh72DbTdq2fzfTPacBhbAzQYAAPdzYKf3opwc0rvY1LLTZmvQu9Zhb7Naegh5SHfleflybOw5y4iuJ2rvaGm1xnZWVzKlhNOFZw8AAPeys5M4jF0ICd/Ya6Pd2hof22nvsC9EhwkZC+/ufvl8wNjb3Q2PEdJHhYcuVuBcu8zMEhecbAAAQO7lytN0IrtntTD/Sutik7axZhsYNDJj1GajotNHRsO7XHH29/co+/Tbl93wcyo8DsdCLIdZ5AAAQO6vk22QrR3mUsUTSIrz+k+6v1vU3tFIZ6fN4aCiM7b7hSrO3j4TnYMKe1R4LFZ7dHBwaMjnxaMHAIB7SVw4H/pP17OPytZuTHL+pLsXhMcsdNsDW3sj4Wt2q4WM0o7O570vB5/3xV7Obpiyu8ukaC/8kETt/1f432Ixh10gAQDgPhLIh3LLyhKgbDSHdnLG2I6iNPisQQdbhz36gIT3DpjefGaas/vXy1F5r5dndLDny8HuGI0tCHzfmbw4xbMHAIB7SDJBMnOdz/56LfV0/mKdnKi1xd7aSjcysDW05loL6+pQ99oB///e7tgzlsPjJ4yH7OtoeO9zmH5OHB9mfXj2AABwDzm/TtN+x0ve2fn4+iPdxJp2cqjiGO5iXTOCzbEwQl7uHex95l2dvfAotf7kyeOHUkYPufQ8C+/tulyd+eshPHoAALiPDK2dC2chPmeHLsE2allgnZw2W3sT60sPk7DS1dkdZd2ch7rMHj+hwrO7+yReDmC6KAAA3FdeHP6/19IcHWt9m1gbqc4CUx0aSXBwQHs8L2lH57FRXg+p8LwMR+ahOgAAcD9xsfafBhRQB9uYhXrX2ptc97NlhOwe8HDpPdbVMRYdSXiePSRYowAAAO4r/+l8/vET3cV6NNr8nm5sS4OK6njIk1oZPiFQHQAAuL88IXRdnNevnkdbW5reV8ceZR42UXXCpLbqECw+DQAA91t2wiyYwNra1vR21a0LPaNfWAgb6+uQx4/xUAEAAJjxP04ax0ZVp6X5TUS5i02MYdt1Q3UAAADUkh0SfjX2Ax42OrBjlVxs+593nxGoDgAAAFJjoKWHLkvAlyRoa9bHZvHs8gXY9r+M3TauAwAA4H7zgFjsjlbbmza73W77wc4ODSeA6gAAAKgtO7Sr02azW6PRaGNLf8ojO62W7l228id1sfU+fognCgAAgNRyslkdbbbWKN2aYDfSamtifQLrg/BnsbPz8q47O66B7mZv7f17svllqFUH9bPwDOC/eQDAP6s6T62OFqo6dHuc/d1o41HUbXTOjtjZOdh13k04wWSQ4affBoVJ9YkZlj4bqGeyqf96yzC9eyYSm9PvMafLpi68wUHp2+w4LRkrLf8jlVRe6tQT9FXf6wtK8HP9odikS1/L4MSg/H1cc6+SycTsLXXonYvFZtz6ZzEv4D96AAD5R31sfQtMOuiGBV/29qL2N40HFAyPivEEB3cVT5AuUMrr1W3pqUBPFIX8uv6Hvb+qbfelDbfOns8XT08ur3e8tZtsv+/23sVRxi2aLFFdOGUN+2mldT8998mmX1TfO1vgCMIE1f148eq8dDahquVllnIhZKiuHNOrtBviyZksFudq1sG7XSydn5cuN7u1zwKyAwD4p2VnuL2jvX0hFqbBaLsjjjeN+9gI97HRzo7rLmOnC0ayw5pc58D61Y7u4txqfUbnypvU4eSaSblry0499gYL2+xj6HKNGMiOkO40lx1JGc8T9O92MeIi/amrgF5Y/N+vecfmu6HsxK6DNXtsQ9ncItVW73JB1+uD7AAA/mnZGXGwAR2H9cXe3l8jLbZmfGwH+3c/smMqO5SgIHYOel1VMuHWd4Q0Cakj7UnJgJxNZ2+VvU71uIhbo1bBcoiQrkzaaSQ7mVJcJzv6knWmj6m58fI87zsdH1fV0nO9aSo7keuQtgq6R9V1ciaN4QypOnaeTpXs9LqMa+bB4uAAgJ8cP93a0v7GRt1sn/eeWxoe26FxbM/2Dj4ffDnYe0Ye/k2yQ/L0pCeeE0pHM0xMSoJQKtE2umstWy6fLjMd6CyxdlmVwDlKqaxVDPBs3CuZslBI+FT2KklksBRYPiuXT0IqA9sXgySe7ydGsrO1LMyrZEdfEEo8z0ZvEmdSP0zwV9UyFzeTnVApoquC7lEtlgKqjlCJnXJvngul4xlRdtQ3qmvmiZ8L5cy8v+THPw0AwM+bttPWSsOnd9kuOVF7g7LT3tHSM8YCCvbues5OTdnJxokncxYaCmyxX/0DfiHhp8Mx3en8sj+wepmirXuXQE+oE8SmvlgZn1cZ4Nms51YC/vnzE5diT5VEL/l+Mh+YTQkq35Y7cxwszRJj2SFJ7jcTZaeqIEw5eKN/ti3ZKi7razkjzJnITvB6UV8F3aM6+q73v3mOeREudoSqGys16z3JLwf8sfMdAbIDAPh5smOlU3bCfJechzSWuomhnQM+tDPm/Ntkx1eKkfg59x6tXHoVp9jmBY8fCxQXJdlRJ4iOpeNyellqUVUGeDa93J02LsxWnGyqpEHhgh8cZVTl8QtCnJjJjieT9cqyU1UQ0i8I60wCr1YrSirfexSiLCauxJRq2XkhbFdVQfeo+ICTRnbiUhEEoerGSs22eQ+M+ATIDgDgZ/H44RidsENFJ9xNnvS1dLQ3PLTjZBvt7LNddpx/k+z0pgpekhd7B525mCITuU3xsmRGkh11gogrmCoI55vMMaYyoMrGyZVBE1LAkwYF8fLFcqfKTScIEVPZIYP57y5JdqoL4osnM0LCScqyEJ1sV8IRTinUI7bpMZSd2aJwJg7YqJ+B9lGVlvWyk5eKkBeqblRq5pTVKg7ZAQD8NB6S5y/D4THawnVSf1t7U/u77d+9j81Ydi6Wl5fXE/n8BP1BfpLg8P4Glwmv7ACLFZ1cdjQJFRUJbObzfo0BMZvAZjKVSvFGWJadStKgMCtFM/gqppLnicshU9khs3R8iMuOcUFIRIiJ1VRrpmLGOZs7NJKdTDHuz6e7eKdE9Qy0jyof18mOTy5CQqi6UalZvzBXNdIEAAB3rzucJ84HjQ/tdLS1Wp6wiIK7X6GgsGY0byeTyRynlr2s5dxZFJk0kB2ilx2tbV8uqTHAs5m/Ti5GIhG17KiS5JK8UMnOfGmi6zjTbSo7ZLUc0suOphzH30lGigX3lSNVI1gh3vjrZYd52CaKCaJ7BtpHlcrUlh2DG2nNPIIUMRGD7AAAfqbuPKE85KuzNdrbae+w9T3/ckB1Z+/53e544Cqt1AgpYMqwVjXPpg4nm8TOscYAz+ZMNF5QyY4qyUB2/Je0pzJ0sWUuO2TnctbEycY5TJP1ghihHSv5qmoZEGYMZOeEK1J5RfcMtI9qRoyjM3CyZQWTG1nNMlKk3wlkBwBA/p7V2WyNRhQsPGKBbGxhnDuLno75+Dj+XG3Z2cxz95abt49nm/WFFCyKbXz3WUJjQGyX18T4gWXFnjqpWnbcmSMXF4Cguez0nlwZhRRMitHNgxdx0n/JrxzIJapruSYMmk4XXS0Ftc9A96iSRal3E5kwCCkwupHVLFheZ17AZYQUAAD+rtXZbM1tenCXQzvOTDY0NHd21iU3ieljI9npPqIBwUOhTFocZBkfDLGkRb9/5fJQCaBWJTC6MvnNicGh4FFhSGOAZ5PIz3b3zmevlxV76qRq2dkqiIuyJdinieyQoaIYQF0pCKvNVikZCowvZnP9LJA6NRuIZU8qszpPk35K4EWitK2M7VQ/gwSNz1Y/A92jcieFw/lAYP57eVkKoM7wIlwkBd3D09QsVszuJM/OIpAdAMDP5xFpKpDtzmWHeBNXQvnIrziATrNOA9nhMzCF/JZXXIGtVD5yk+71c0HIrrBOCJcddYLYGC8f06mglztDWgNiu5y4LJeOAufLFXuqpCrZCZal7oTn5KjTVHbIizKfLlopCK9NKF0UhKsdcbXPo7Jwue1Vj94wyoWjmFORnYsr/TPo/H7er34GukdFc/5O87hMBeSysxmi5cyLoKB7eNqa+Za34vPuF0I//kEAAH42LrpMTntTS+Ps3eEyoGKTOqBekqbbbXadu9JYuz3iZ6/02S2PjssJiloN+JxGBlg/y9ult6dO+kGkgki16eyvFMPtu/Xm5cM6noH+UanzEIvgNrtRx9qFE/8gAAA/28f2h9vSeCCbGD999xEFP4xfGP83vZ2dyN+SzWCc6/1AIYF/EACAn81jMtb4tB2bY4TFT9OIAjf5hfYVjcSXM6ed/yrZ8f0t2YznCsm11cTFiRf/IAAAP50HYUvj8dMtPaP7bNbO7q+kOmRi52gbgxPN4Ikk00epmBtPAgBAfnocW++uxd54/DR5+ZlFFOze9XbWAAAAyL/bx/Z819Jw/LTj7uOnAQAA3A/ZGd0bb7U1t8cbZAcAAEBjPCFjB2PWNlujgWx8RTbIDgAAgIZl5/NYtKWt0a1FR/f5Hm9jkB0AAACNyc5+ONrontZtfeHP4h5vkB0AAAANys6upTHZoVuLPt1lO1pDdgAAADTuZNsLtNga87FF2awdyA4AAADSeCTbPh3caai7Q/d4C+/v/Vay4xroVh31Nnfb71dRAAAgv94eo8/29sKW1kbWKWhvG+Y+tltlx/lApN7CzMjL7k/M1nW9ZzYWm6tLQzS70vivt6qvmAwy/DVuq58ZZmo24GrynfDbg+M+48eiHN1licVMpeXs+kOxSZc6KSjSrzkLAABNyo5n9/PeqLUBN1tbq3X0C/Ox3SI7LkVuHtXZTMmL+y8W5+q42rtVLJ1nr6+3vQ3Kji9tsMBmukAprzfUiPt9JvUQqK2ikF+vr+ehN3NapLdf0E0ggkaPRdlb4S5LTDfaLhQEvty1M168Oi+dTVSSPAKrT6EwpzkLAACkSS8bnfgZbiSoQPGx1ZQd1yNC+kYs0WjUMsI2zm5AdmLXwXo6MGf5RSo4nvnsYYOyY06hsUZc2gPbuB7OgfWrnbqqrTcjPgbPRLKccFY/Fs3mQ3dVYqLs8EO2ixEX6U9dBZQkv2rzN81ZAAAgzcQU0FjovefWunWnvX2hT/Sx0Xk7L01kx0l1xhJdcNgZb6yW+nRHbFEj1yF5DEbVS3Lr9885ORuQej3ibp+dGm+bx6UZxuGtcfUGPm4T2ensNWrENTm41Y24Nm9FGYJCda9A2fumco+x7LD7S5vVj8VYdhotsb7IisaMl+f5r4bjYyVpRlD6k9qzAADQ5DIFe/vh4ZaW9no7O9Gxfa465qsUUJEZsTrsDlsbo93uiNalO7xFDZVEFxjbFbN0NCO2katnZfVuoczjVFL/4HavZMpCIcFdSIOlwOq5cJ0OkMBhUSjE3WJrHMqUy2erLn7BJL9qJZs3kh2VLakRj1xFNKnirSm6YWmJCoM6b51u5NfJeIlvaUpWz/kGqhd0s9G4T32PbMbgdrJ+3a9/LEay02iJDYqsaEziTDyY410cnhS5Ui7RngUAANLc4A7VnbF63Wy8s3OL7Dwgnugbu63tjaxUbFu4B/XJTvB6UVSdzFloKLDFf+J3pwsrAf/KRVJ17dF39Z3rOXrB/PkJVxUhnQkFgpmL0OXWxPh6McnTdvKL/sDa1aFTapoHhdT58qSR7KhsiY346vW8LpXfOuAXEn46WKLOW6cM2TiZECTZydE/x6fBoUAk7VXfI5sxkh3v1arusRjKTqMlNiiyIjtn25KQF5flpLUz5RLtWQAAaNLLRmVnt9taXzQbXQb0+Z6oOmZOtk7yX6u9XW3N1rrQ53TWIzsvBKlhi59zz87KJf3YvOC/rQPqjUMv1zSuK+4yGhdmucTkmUPOWxBWuIXyIEsTW/9x1npLsnPpNR7bUdniV8b5mIomVbpVdFmp89Yqg68U08jOoHKN5h5TJxshmaTusRjKTqMlNiiyIjtXqxXJlJK2hOxZJrXorjoLAACk2Zk7e5/DPQv1LAhqa1t4II3smMlOJxlZsLfo+ki0u9NZh+zMFoUzsYHMiz+nO3Mx2lhuVl9bUn5uB5UW2Vlc5LIjnkpd8WGUASHI0qS4g2RGkZ01UiukgNuiV3YmBVVYnZS6Vj0oI+atUYbeVMGrkR1vKa7pX0j31JCd9KHusdQIKWi0xJoiK7JTltNOtuWkyVgstrZTzA7qzwIAQJPdHeplo262kdY6hndapFVAD0wj2R4w1bEZbJVwu5ftNFOM+/PpLtZREE4SHCFOvIJBZFte+bm9zkZNApvJVCrFBUfuU2ydiOfLMZYmjYwsXimyEzSTnYqtQWHuUJAG1NWpQU0jrspbqsfF8vLyeiKfpxEFGifbcimbXPbr76khO6fb2sdiIjuNlri6yIrsKDrGtf57JUpw8DylPwsAAM11dx6O7u3v02g2S2vLrZ0dttPO51qy84D8d8He1tGc7DBX0kQxwWVnZ1Fkkn43UIjUiVp25q+Ti5FIRJIdcchmKyP1i7jszFfJjkGkcYF1ClS2BoXS+UyOjQdpUyfVjbg6b7kemUzmOLXs5Z6sIWn0iXe9lpOnZTq2o7nHXHb85Yj2sVTLTjMlNiiyIjsZKejbx7NWyQ5Zv9SfBQCA5kd3aA9mtztqb7lNdei2oorqHBx8GaU+OqKNnO61VqtOR30xBadcSkJlNiaTU/nAjH5az8j9Fy47Z2JbXDCXnZ0qJ1u17LhKLGeVLTokNEgmrjf1qZpGXJ13tTL4pYt3cnJKIBfX3mMuO6m8W/dYdLLTXIkNiqzIznpBjKyOlXw62Vkt6s8CAEBzPHzcS2PT9j/vEqo7ttqq0zP2Ze+zJDp0n7dnNBJO19mJ2m1G22DXJTtia7haor2bzTzvJbiZS2rzYqgqpIAki9L0nkOButzWxDFyc9mpDinQyE7Mx+9ngyIqW6JzKlYO6lKlW8+4HKrzrpad7gs+CjIk5JRZROmk9p6zTWPZcSdKc/rHUjn7AyU2KLIiO/2X3P5ALiEn9YvPuTuT1p8FAICmuzsvaXjAHtedjjazAZ72Fqo61B/35UDxse26qlxsFqMek82x0EecdS+Ok6CT4LuP8sv+oRBr68Tv/mUWQJ1W5im6k8L3+UAglGQNeiI/2907n702l51kLub3r159d2llR7LnzGRDQ3NnZ2z8RGVLuihx6TdIpcp3Pj4Y0uRt4AdbK29N+GO5I1rKF7n18QH/GpUPzT2imUrNTlMTExOTofh5IVj1WJSjHymx+lQlW6lrEyqlZgOx7IlXTgqV0rHxQOj4elx/FgAAfiSqYJ/pzjPLQmuHcURbe4c9+nRs76DiYts72NUN7bjIyBuj/lJ9QztK+9r5/byfdK1ly0J+i7dv9DudZrlKY+FOsxX1mvteFIRimv0Y9yQuy6WjwLm57ATmT6mJtU6ilZ2LK9GeN3FFF0Hjo/0qW9JF3cenvdWpbHG3UvnIrc7baPhlmZb9NLRIZce9elIWyifz2vJKZuSSsLEcSjl/vOozeCzK0Q+UWH1DJVvZozZzVBYupYXueFJgp0CnmaYDVWcBAIA0HVVA5+KwMOrdsb7oQqujrd2mj5vusC9YyEu16lTPFnU+cNMJOx3N+tiqcKtaN4/ooNIucOPq75fDsp3ertvMeQwWq15WBi86B5TTxraMUsUle27Lu7eysE+3z21gjZlZPmz08fxAiSunjLJ1+/Qp3oGuGmcBAKBJNxv93/7u2LDF2trK17Wx2drbbfRPm83R2hbt84Q/q1WnOpCNDewYrXVga7V2P3L+khXfidzzkuwgJA0A8I9Fs+2GD2iHhwqPzxK1trVSHO3t7exLizXa5w5TR9xnjersujUDNg/I8IJhSEK7vanOzt/S6vrueUl+nQcAALhfOOnwzi5zou19psITHusfpnsWWK0LC1arlW5d4B0N72q7OgfVPrYHxNjF1m63dj1w4hkDAABQ6Q4hz+hq1GxZ0P3PdPYolZ7R0edDQ0OjY2Phv3ZpP6cSwib1dr5ofWwsis0wCq7FMfKrdnYAAACQf24taqoio9STtv9ljynP/ucvexTx6+c9negwH5tmrqjzQd9Cq81kZQOoDgAAAEPdcYe/UEfbwZd9qjcS9Ov+QRX6gAIWT2DiYuuDiw0AAAAxXo+aOdqkURxRdQ4M0Y/sUBfbG+MotoVhdHYAAAAQ09gCd3jvwKh/o3OxPXus8rE9eGTsYnvTuoCBHQAAAKRWLDUb4aHC87mW6uxpXGxOExebrcVhgeoAAAC4pcPDPW0He2Zdnj2d6phOFG2h4QSdeKIAAABq8pgP8dBlC1hggV5zPrNNErSq00ksjhYT1UFfBwAAwK08oWFtdIood6jRRaeVvQ5ohBvdZif8TNfXMV4BlKvODwaxuQa68TY4j56anenp+12r87QP7xUAoAgP7fG4x8K74nwdtv2oFEe9R7s6etUxDCeg2/O4G1CduaDMjCrVcBdQhf5QbFLefKFrMhabZQttzlATfGse90wsNlNZw3Ig6FWdlPLq15zV29QcaE6o7/h7+PBt2OzM0j/030jf1PTbqeEfqM7br/iHBgCo8Jhpi3P0ZXh3V54r+mV3NzzKVqzWqY7DsK9j7SV/1J/dWaFQuBQu6N/jOmXHGS9enZfOJvhBKHeVyVwW6C4Hx4WCQNdVdq5dXGdz5XP5fk+G7fUsnSQeQSgw5jRndTbVB5oT6jvUzfDwT3wdb5d6TM5svPsn/vN4+nbj69L790tfN942XZ1/TDABAORXDS4QezW9dIWcl+GXL8dGe2U5qk91Gh3YmRT8upRasrNdjLhIf4rvfhYoJWjZPJt8u02+T0zsapGmDB1d+sSrd868qn1l/Lqc5LNqm5oDzQmNPdUv+I1/4i313Ez/A7lObSwNK9+eNmlk4z3+kQEA9Mrz+MmTh5ou0GPtFjvEYqQ6Njqu42k8nEAlO70unexot9qhjJfn2YfrmPWO4nmx65HZUZSFb2NNt5OO8c+VK796O7MZQSMa8lmNTfWB5oTWnkEr+kjTMXmq/tCcetTzqOpC7b2kp6rD2ONS3c+a/RtphKRiTGOjkqzJTWP4qfkFrqfEwOz01ynl+x8f3htWp6YBnuu3aaNi3lYMAMC/n4dUezga7xphIWx0cQIj1aH7iTob8bDpZMcTzwmloxllK9BSIJQpl89WNZtoJ87Ezzl207Z0kE6pNsrkwljiW3jOlEJELTuRK7Up5azGpvpAc0JrTxGdm5ubb9+ox2lq6dvN1/e8hZ36Nvz+64b8IZ769qFPHNPgB0vDU996lAs1F/A0esWUZIn/+cBSxH6GdO07yVjl0kr+qmT1BTrDctnUaSyfDz2P3m58u9mYVmfHizb8lRah7+2HpffD5N1UDzvSV6e2AbE6N7JXUlP62sUAANxjHvxB+uh8nTcGu4m+sTQVwybJjidzFhoKbF2HlB2oE/llf2C9qBlNOdsWP91FKixzZS4DE8WITnYCvLs0mI8Tjeysnak9ecpZjU31geaE1p7M8PTN9PDwU/Lu27vh4emNDfbz/O3XjQ/Tw/IHeXfzYWp4amljiY1piAcfvr7fqFyoueDtzQY/+jZFpNH3t9++vp8anv769SnRGXv7TblUkz9P/kCTVRfoDYtl01zA83n7bWlp4y1Nu5nSZ8fGc6a+brx79+HrFL3j3Tt9dW4zIFZHjiioFPPWYgAA7q/3zUU7Mxarvc1m0NWxNqc6suzEz7kHbOXSK8uOwD1mE6WY6uKrVelLlknAcjF/cpK73iRa2XGlM06mY2naUdpSndwSsmeZ1KJbVDnlrMam+kCbmcaewtuvf/Cf6Lx17PnKRto/3PDxduljSvwgSzfvKgfvbz4oV2gukO96tLQhh6t9EIdxplgDbGhsaUOT/9Q3Mfltj+oCvWFd2TYq+by72WB9pqdf3+uym954RIa/Sffd9JDpparq1DYgVUeKKKgU89ZiAADureawYZuRqMPRZtDVsUf/2+QsUUl28suiCy8Xk2VnRzy/k1FdXF6UvpzQnohzvSQw4m6N7LiSeSZYyayPpSYrskOjrWNrO8XsoPasxqb6QHNCa49oIwqWPkhH7HNDbFi1H7S3MV05mOLNsHikuYDc3MhHT6VxI+l8n/p+fu2SdDB906POf0mJFFNdoDe8VH2BlPZW6l9sfNBn97ZSzxvaZRneMKyOuQGpOu+1haujGACAf7O0PBD5Q9NtcfJk+qXLEn1jt1U52Gzt9gULaXZtAlF2fMJJgiPEZdmJiOcX1SMyhXXpS472OuJXPIRtPL+jlh1XssAiz1aKPP5MLTuSd+08pT2rsak+0JzQ2iOaiIKem68fON8+sDFz/ttd+lBCzt7SIADlYJg1quIVmgvI05t3lSaYj75Ldugtw+prVQd0tESVfyXGTXVBn97w2+oLpHzefRWH576+0xbtER3L6fkmubxu+IiUUXXMDcjVmdaH4t1WDADAPeGBghRi5BmJWh32jnYD/5qDdXWaXZpAlp2dRZHJWrKTkbpAvnKEuIqSwytW9lWUpXMnH+DB0qU0QxDS6XGN7JD1S+1ZtU1NBurvOntEE5c1fPP+rciUMmYufQzLI+gfbqTmWfRK9chXaC6oDLizmAF+IKe8/ebSGxuWB0nU+SvJ6guMDJtc8EHuXE1ps+vj10hRaUzD3r43qo65AW11KsW8tRgAgH/zJtd90WjUYhkZ+W+vOt3dN2KJRq0ddoetSnTa2+xsVOcHlmGTnGy5Ne28nUEhJR4l1U629YJYsljJR3qlMGkyyy2IytKVynNzQ3ER6oKL+7Wys1rUnlXb1GSg/q6zp20yh9WNozRmLn0op1gHoUcaxOi5qQyuay5QfEuPmHNJMwTPRu011yoHGx/U+Ve+qy4wMqy/4KtmHirreWizY341KWybi8HStFF1zA1oq6Mq8m3FAAD8m11sPVa73e5wvFlYsEZlrFbrwhsHTW6viiR409Zud1gtThbf9qOys8kHZIjbr8iOMMhdaNeLqov7L7fYx0AuQf9mJS1JXHhk2ek+zGmn1qQrTrZ+Mfy5O5PWntXYVB9oTmjtyUyzkRLyx1dxBGJY9Ttd+pBPveNOriUeddy3JA7BL1Vf8OFGOmKxxpoheObN01yrHHwbVucvf5/uUV1gZFhjQUmTPV6sU6TJro8m9IgeMNcGkxQaNWdQHXMD2upUinlrMQAA/+ruDp0Iane0tDmozFRwODra2gw0hwYSvLFa6Dwe149kKslO9xGNlx4KMU2Qezu5mN+/evWdWk8ra+eESqnZQCx7wsLegqXDmX7fRLIck5XFnRYiE5yuatkJldKx8UDo+HpcJyJqm5oDzQn1HUp5aBBW3/RTqj40Anj4HZ9OKY2Zy0Pn02KM8QZvR/s2vi19WPr2jo9YSFdoLtj48FWMJX6rG4J38RTNtdIBc/Op85eTp9QXGBjWWpDT5O4FH+ZXZ/fHtz6mAm+He2g89M3wMJtRY1QdUwOV6rz/2qcu5q3FAAD8m3lE/WxsBKelpU2m3WaripdutzHNsS9ERwj50W0O5OmiXWvZspDf8iqyMxk6KQvZNbZ3z2lWGTmaOSoLl9uiEIx/LwrCdXpWUZZZQcZXLTsksFMQ6BBNoKrvorapOdCcUN1xcSWV59EHOqWRDVlssGmT05VZ+E+VyfjTdEopnYoijlk8nX7/ns6wEYfgp6suoGnDfALmFNENwUsDIBpjU+xgSfoq5y8mi7NLKxdUGyZEf4GmeyEO5auz+0BTHr39enOz8fbp0s3XaZPqmBqoVGeJyY6qmLcWAwDwb4ZqiMcSXaBdHKosNoPNQ1kvp63DYXcsRC209Xj0o7scqHF7dQuzeXoNFslx+yrfXb7+hraU8w50GefsMznQnFBYrgwVPZVG2V19pn2+p/r1PN9v/GF8AW+fXX21XJYaY67KgTp/V98j3QWmhl09tR9YJbsp7lEjPU+rlrLRV6d25WnH6am+mLcWAwDwrx7goX/+S5WHDefQ8RwqPm+k3k77Gxt1tTH/2xsr1xzy4Odt6FZ794N/mJ1IU7dNiT/lp7+Zrd/80zYFuAvD7zamGqwOAADUO3mH/u0bodEECx1cfOjgDoON+NBwAyo5wy6uOc6fWIpfW3Z8zTXcNxvv371fujGdef/TNgW4E8PTX5foVjtTb2X5ubU6AABQL3+I3Rj3sIVFTlsXFt4wWHibZUQc633Q6fy5RfAd+v99z3X4HV2e7L35Dj3vf1a/4W4M90x/YOWf+qPO6gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADuB/8fkregZ5kib9cAAAAASUVORK5CYII=";
const KOP = { pt: "PT TERRA GRAPINDO ECO PRIMA", alamat: ["Jl. Petojo Selatan XII No.30 B1, Kel. Cideng", "Kec. Gambir, Jakarta Pusat, DKI Jakarta, 10150"], kontak: "Telp. 081241540004, terragrapindoecoprima@gmail.com",
  direktur: "Ir. Samsul L, S.T., IPP, CPI, MAuSIMM", jabatanDir: "Direktur", pemberi: "PT NUSA PRIMA GEMILANG" };
const BASTP_SERAH = ["Drilling Daily Report (DDR)", "Data koordinat aktual setiap titik bor", "Data kedalaman aktual dan progres pemboran", "Drilling log setiap lubang", "Core recovery report", "Dokumentasi foto core box",
  "Core box yang telah disusun dan diberi identitas", "Daftar interval dan nomor sampel", "Rekapitulasi total meter pemboran", "Database pemboran digital (Excel) dan akses aplikasi X-Terra"];
const terbilang = (n) => { const a = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"]; n = Math.floor(+n || 0);
  if (n < 12) return a[n]; if (n < 20) return terbilang(n - 10) + " belas"; if (n < 100) return (terbilang(Math.floor(n / 10)) + " puluh " + terbilang(n % 10)).trim();
  if (n < 200) return ("seratus " + terbilang(n - 100)).trim(); if (n < 1000) return (terbilang(Math.floor(n / 100)) + " ratus " + terbilang(n % 100)).trim();
  if (n < 2000) return ("seribu " + terbilang(n - 1000)).trim(); return (terbilang(Math.floor(n / 1000)) + " ribu " + terbilang(n % 1000)).trim(); };
const tglTerbilang = (t) => { try { const d = new Date(t + "T12:00:00"); return `hari ${d.toLocaleDateString("id-ID", { weekday: "long" })} tanggal ${terbilang(d.getDate())} bulan ${d.toLocaleDateString("id-ID", { month: "long" })} tahun ${terbilang(d.getFullYear())} (${d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })})`; } catch { return t; } };
const BASTP_CEK = ["Seluruh titik dalam daftar telah dikerjakan (atau perubahan disetujui tertulis)", "Kedalaman aktual telah diverifikasi", "Seluruh core dan sampel telah diserahkan", "Data pemboran dan dokumentasi (DDR, drilling log, foto core) telah lengkap"];
const BULAN_ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
async function baView(v) {
  if (!online()) { v.innerHTML = `<div class="card"><h2>Berita Acara</h2><p class="muted">Perlu sinyal internet.</p></div>`; return; }
  v.innerHTML = `<div class="card"><h2>Berita Acara</h2><p class="muted" style="margin-top:0"><b>BA stop bor</b> dibuat per titik yang sudah EOH/STB. <b>BASTP</b> (serah terima pekerjaan) dibuat per periode berisi titik yang selesai. Isi terisi otomatis dari data aplikasi dan bisa diedit sebelum dicetak.</p>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end"><div style="flex:1 1 170px"><label>BA stop bor untuk titik</label><select id="baB"><option value="">Memuat…</option></select></div><button id="baBuat" style="flex:0;white-space:nowrap">+ BA stop bor</button></div>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end;margin-top:6px"><div style="flex:1 1 130px"><label>BASTP dari</label><input type="date" id="baF"></div><div style="flex:1 1 130px"><label>sampai</label><input type="date" id="baT" value="${todayWIB()}"></div><button id="baBuat2" style="flex:0;white-space:nowrap">+ BASTP</button></div><div id="baE" class="err"></div></div>
    <div class="card"><h3>Berita acara tersimpan</h3><ul class="list" id="baL"><li class="muted">Memuat…</li></ul></div><div id="baEd"></div>`;
  const [{ data: H }, { data: LG }, { data: EV }] = await Promise.all([sb.from("v_dash_hole").select("*"), sb.from("v_logging_lubang").select("bhid,rig,kedalaman_bor,mulai,terakhir_bor"), sb.from("drill_event").select("bhid,status_akhir,depth_to,reason,captured_at").eq("event_type", "SELESAI_BOR").not("status_akhir", "is", null)]);
  const ddrB = (await sb.from("v_ddr_baris").select("tanggal,rig,bhid,jenis,dari_m,sampai_m,meter,core_m").limit(5000)).data ?? [];
  const bhs = [...new Set([...(H ?? []).map((h) => h.bhid), ...(LG ?? []).map((g) => g.bhid), ...ddrB.map((x) => x.bhid)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
  const akhir = (b) => (EV ?? []).filter((e) => e.bhid === b).sort((x, y) => String(y.captured_at).localeCompare(String(x.captured_at)))[0];
  const selesai = (b) => !!akhir(b) || !!(H ?? []).find((h) => h.bhid === b && h.stop_date);
  $("#baB").innerHTML = bhs.map((b) => `<option value="${esc(b)}">${esc(b)}${selesai(b) ? " — selesai" : " — belum tercatat selesai"}</option>`).join("") || `<option value="">Belum ada titik</option>`;
  const d0 = new Date(Date.now() - 6 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); $("#baF").value = d0;
  const ringkas = (b) => { const xs = ddrB.filter((x) => x.bhid === b), h = (H ?? []).find((y) => y.bhid === b) ?? {}, g = (LG ?? []).find((y) => y.bhid === b) ?? {}, e = akhir(b);
    const cor = xs.filter((x) => x.jenis === "CORING"), mC = cor.reduce((s, x) => s + +x.meter, 0), mO = xs.filter((x) => x.jenis !== "CORING").reduce((s, x) => s + +x.meter, 0), cc = cor.filter((x) => x.core_m != null);
    const dalam = Math.max(0, ...xs.map((x) => +x.sampai_m), +(e?.depth_to ?? 0), +(h.eoh ?? 0));
    return { bhid: b, rig: [...new Set(xs.map((x) => x.rig))].join("/") || g.rig || "", mulai: (h.start_date ?? g.mulai ?? xs[0]?.tanggal ?? "").slice(0, 10), stop: (h.stop_date ?? e?.captured_at ?? xs.at(-1)?.tanggal ?? "").slice(0, 10),
      kedalaman: dalam, status: e?.status_akhir ?? (h.stop_date ? "STB" : ""), alasan: e?.reason ?? "", east: h.east ?? "", north: h.north ?? "", rl: h.rl ?? "", sistem: h.coord_source ?? "UTM WGS84 Zona 51S",
      coring: +mC.toFixed(2), open: +mO.toFixed(2), recovery: cc.length ? +((100 * cc.reduce((s, x) => s + +x.core_m, 0)) / cc.reduce((s, x) => s + +x.meter, 0)).toFixed(1) : (h.recovery_pct ?? ""),
      conto: h.jumlah_conto ?? "", limonit: h.tebal_limonit ?? "", saprolit: h.tebal_saprolit ?? "", redrill: asalRedrill(b) ? `Redrill dari ${asalRedrill(b)}` : "" }; };
  const nomor = (jenis, b) => { const d = new Date(); return `${jenis === "BASTP" ? "BASTP" : "BA-STOP"}/TGEP/${b ? b.replace(/\s+/g, "") + "/" : ""}${BULAN_ROMAWI[d.getMonth()]}/${d.getFullYear()}`; };
  const daftar = async () => { const { data } = await sb.from("berita_acara").select("id,jenis,nomor,bhid,dari,sampai,status,created_at").order("created_at", { ascending: false }).limit(100);
    $("#baL").innerHTML = (data ?? []).map((r) => `<li style="flex-wrap:wrap"><span class="pill ${r.status === "FINAL" ? "APPROVED" : "ANTRE"}">${esc(r.status)}</span><span style="flex:1;min-width:170px"><b>${r.jenis === "BASTP" ? "BASTP" : "BA stop bor"}</b> · ${esc(r.bhid ?? `${r.dari} s/d ${r.sampai}`)}<br><span class="muted">${esc(r.nomor ?? "")}</span></span>
      <button class="sec" data-v="${r.id}" style="flex:0">👁 Lihat</button><button class="sec" data-e="${r.id}" style="flex:0">✏️ Edit</button><button class="sec" data-p="${r.id}" style="flex:0">🖨 Cetak</button></li>`).join("") || `<li class="muted">Belum ada.</li>`;
    $("#baL").querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => cetakBA(b.dataset.v, { lihat: true })));
    $("#baL").querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => edit(b.dataset.e)));
    $("#baL").querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => cetakBA(b.dataset.p))); };
  const prof = (await sb.from("signature_profile").select("full_name,title").eq("user_id", session.user.id).maybeSingle()).data;
  const ttdAwal = (jenis) => jenis === "BASTP"
    ? { direktur: KOP.direktur, direktur_jabatan: KOP.jabatanDir, penerima: "", penerima_jabatan: "Perwakilan Pemberi Kerja", penerima_pt: KOP.pemberi, tempat: "Luwuk", tanggal: todayWIB() }
    : { geologist: prof?.full_name ?? me?.full_name ?? "", geologist_jabatan: "Wellsite Geologist", penerima: "", penerima_jabatan: "Pengawas Lapangan", penerima_pt: KOP.pemberi, tempat: "Luwuk", tanggal: todayWIB() };
  $("#baBuat").onclick = async () => { const b = $("#baB").value; if (!b) return;
    const isi = { ...ringkas(b), ...ttdAwal("BA_STOP"), catatan: "", pernyataan: "Pada hari ini telah dilakukan pemberhentian pemboran (stop bor) pada titik tersebut di atas dengan rincian sebagai berikut. Berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya." };
    const { data, error } = await sb.from("berita_acara").insert({ jenis: "BA_STOP", nomor: nomor("BA_STOP", b), bhid: b, isi }).select("id").single(); if (error) return ($("#baE").textContent = error.message);
    await daftar(); edit(data.id); };
  $("#baBuat2").onclick = async () => { const f = $("#baF").value, t = $("#baT").value, t0 = t; if (!f || !t || f > t) return ($("#baE").textContent = "Isi periode dengan benar.");
    const titik = bhs.filter((b) => { const r = ringkas(b); return selesai(b) && r.stop >= f && r.stop <= t; }).map((b) => { const r = ringkas(b); return { bhid: b, rig: r.rig, mulai: r.mulai, stop: r.stop, kedalaman: r.kedalaman, status: r.status, coring: r.coring, open: r.open, recovery: r.recovery, conto: r.conto, ket: r.redrill }; });
    const isi = { ...ttdAwal("BASTP"), titik, pekerjaan: "Jasa pemboran eksplorasi — site PT Luwuk Gas Sejati", rencana: "14", cek: BASTP_CEK.map((t) => ({ t, ya: "Ya" })), catatan: "",
      serah: BASTP_SERAH.map((t) => ({ t, ya: "Ya", ket: /Database/.test(t) ? `File Excel ekspor database s/d ${t0 ?? ""} (semua sheet) + akses baca aplikasi` : "" })),
      penutup: "Dengan ditandatanganinya Berita Acara ini, PIHAK KEDUA menyatakan telah menerima hasil pekerjaan beserta data dan dokumen tersebut di atas dari PIHAK PERTAMA. Berita Acara ini dibuat dalam rangkap 2 (dua), masing-masing mempunyai kekuatan hukum yang sama, untuk dipergunakan sebagaimana mestinya.", pernyataan: `PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menerima dari PIHAK PERTAMA, hasil pekerjaan pemboran eksplorasi periode ${f} s/d ${t} beserta seluruh data, dokumen dan database pemboran dengan rincian sebagai berikut.` };
    const { data, error } = await sb.from("berita_acara").insert({ jenis: "BASTP", nomor: nomor("BASTP"), dari: f, sampai: t, isi }).select("id").single(); if (error) return ($("#baE").textContent = error.message);
    await daftar(); edit(data.id); };
  // ----- menu edit -----
  const edit = async (id) => { const { data: r, error } = await sb.from("berita_acara").select("*").eq("id", id).single(); if (error) return alert(error.message);
    const I = r.isi ?? {}, inp = (k, l, w = "1 1 150px") => `<div style="flex:${w}"><label>${l}</label><input data-k="${k}" value="${esc(I[k] ?? "")}"></div>`, kunci = r.status === "FINAL" && me?.role !== "admin";
    const kolomT = [["bhid", "Titik"], ["rig", "Rig"], ["mulai", "Mulai"], ["stop", "Stop"], ["kedalaman", "Kedalaman (m)"], ["status", "EOH/STB"], ["coring", "Coring (m)"], ["open", "Open hole (m)"], ["recovery", "Recovery (%)"], ["conto", "Sample"], ["ket", "Ket."]];
    $("#baEd").innerHTML = `<div class="card"><h3>✏️ Edit ${r.jenis === "BASTP" ? "BASTP" : "BA stop bor " + esc(r.bhid)}</h3>${kunci ? `<p class="err">Sudah FINAL — hanya admin yang bisa mengubah.</p>` : ""}
      <div class="row" style="flex-wrap:wrap"><div style="flex:2 1 220px"><label>Nomor</label><input id="eaN" value="${esc(r.nomor ?? "")}"></div>${inp("tempat", "Tempat")}${inp("tanggal", "Tanggal")}</div>
      ${r.jenis === "BA_STOP" ? `<div class="row" style="flex-wrap:wrap">${inp("bhid", "Hole ID")}${inp("rig", "Rig")}${inp("mulai", "Tgl mulai")}${inp("stop", "Tgl stop")}${inp("status", "Status (EOH/STB)")}${inp("kedalaman", "Kedalaman akhir (m)")}</div>
        <div class="row" style="flex-wrap:wrap">${inp("alasan", "Alasan stop", "2 1 240px")}${inp("redrill", "Redrill")}</div>
        <div class="row" style="flex-wrap:wrap">${inp("east", "East / X")}${inp("north", "North / Y")}${inp("rl", "Elevasi / Z")}${inp("sistem", "Sistem koordinat")}</div>
        <div class="row" style="flex-wrap:wrap">${inp("coring", "Coring (m)")}${inp("open", "Open hole (m)")}${inp("recovery", "Recovery (%)")}${inp("conto", "Jumlah sample")}${inp("limonit", "Tebal limonit (m)")}${inp("saprolit", "Tebal saprolit (m)")}</div>`
      : `<div class="row">${inp("pekerjaan", "Pekerjaan", "1 1 100%")}</div><div class="tw"><table id="eaT"><tr>${kolomT.map(([, l]) => `<th>${l}</th>`).join("")}<th></th></tr>${(I.titik ?? []).map((t) => `<tr>${kolomT.map(([k]) => `<td><input data-t="${k}" value="${esc(t[k] ?? "")}" style="min-width:70px"></td>`).join("")}<td><button class="sec" data-x style="flex:0">✕</button></td></tr>`).join("")}</table></div><button class="sec" id="eaAdd" style="flex:0;margin-top:4px">+ baris titik</button>`}
      <label>Pernyataan</label><textarea data-k="pernyataan" rows="3">${esc(I.pernyataan ?? "")}</textarea><label>Catatan</label><textarea data-k="catatan" rows="2">${esc(I.catatan ?? "")}</textarea>
      ${r.jenis === "BASTP" ? `<div class="row">${inp("rencana", "Jumlah titik rencana (SOW)", "0 1 180px")}</div><h3>Kriteria penerimaan (SOW butir 12)</h3>${(I.cek ?? BASTP_CEK.map((t) => ({ t, ya: "Ya" }))).map((c, i) => `<div class="row" style="align-items:center"><select data-cek="${i}" style="flex:0 0 100px"><option ${c.ya === "Ya" ? "selected" : ""}>Ya</option><option ${c.ya === "Tidak" ? "selected" : ""}>Tidak</option><option ${c.ya === "Sebagian" ? "selected" : ""}>Sebagian</option></select><input data-cekt="${i}" value="${esc(c.t)}"></div>`).join("")}
        <h3>Data & dokumen yang diserahkan (SOW butir 8)</h3><div id="eaSr">${(I.serah ?? BASTP_SERAH.map((t) => ({ t, ya: "Ya", ket: "" }))).map((c) => `<div class="row" data-sr style="align-items:center;flex-wrap:wrap"><select style="flex:0 0 100px"><option ${c.ya === "Ya" ? "selected" : ""}>Ya</option><option ${c.ya === "Tidak" ? "selected" : ""}>Tidak</option><option ${c.ya === "Sebagian" ? "selected" : ""}>Sebagian</option></select><input value="${esc(c.t)}" style="flex:2 1 200px"><input value="${esc(c.ket ?? "")}" placeholder="keterangan / nama file" style="flex:2 1 200px"></div>`).join("")}</div>
        <button class="sec" id="eaSrAdd" style="flex:0;margin-top:4px">+ item serahan</button>
        <label>Penutup</label><textarea data-k="penutup" rows="3">${esc(I.penutup ?? "")}</textarea>
        <h3>Tanda tangan</h3><div class="row" style="flex-wrap:wrap">${inp("direktur", "Pihak Pertama — Direktur TGEP")}${inp("direktur_jabatan", "Jabatan")}</div><div class="row" style="flex-wrap:wrap">${inp("penerima", "Pihak Kedua — nama")}${inp("penerima_jabatan", "Jabatan")}${inp("penerima_pt", "Perusahaan")}</div><div class="row">${inp("penerima_alamat", "Alamat Pihak Kedua (opsional)", "1 1 100%")}</div>`
      : `<h3>Tanda tangan</h3><div class="row" style="flex-wrap:wrap">${inp("geologist", "Wellsite Geologist TGEP")}${inp("geologist_jabatan", "Jabatan")}</div><div class="row" style="flex-wrap:wrap">${inp("penerima", "Perwakilan lapangan — nama")}${inp("penerima_jabatan", "Jabatan")}${inp("penerima_pt", "Perusahaan")}</div>`}
      <div class="row" style="margin-top:8px;flex-wrap:wrap"><button id="eaS">Simpan</button><button class="sec" id="eaV">👁 Lihat surat</button><button class="sec" id="eaP">🖨 Simpan & cetak</button>${r.status !== "FINAL" ? `<button class="sec" id="eaF">Tandai FINAL</button>` : ""}${r.status !== "FINAL" || me?.role === "admin" ? `<button class="danger" id="eaH" style="flex:0">Hapus</button>` : ""}<button class="sec" id="eaX" style="flex:0">Tutup</button></div><div id="eaE" class="err"></div></div>`;
    const E = $("#baEd"); E.scrollIntoView({ behavior: "smooth" }); if (kunci) E.querySelectorAll("input,textarea").forEach((x) => (x.disabled = true));
    const pasangX = () => E.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => b.closest("tr").remove())); pasangX();
    E.querySelector("#eaSrAdd")?.addEventListener("click", () => E.querySelector("#eaSr").insertAdjacentHTML("beforeend", `<div class="row" data-sr style="align-items:center;flex-wrap:wrap"><select style="flex:0 0 100px"><option>Ya</option><option>Tidak</option><option>Sebagian</option></select><input style="flex:2 1 200px"><input placeholder="keterangan / nama file" style="flex:2 1 200px"></div>`));
    E.querySelector("#eaAdd")?.addEventListener("click", () => { E.querySelector("#eaT").insertAdjacentHTML("beforeend", `<tr>${kolomT.map(([k]) => `<td><input data-t="${k}" style="min-width:70px"></td>`).join("")}<td><button class="sec" data-x style="flex:0">✕</button></td></tr>`); pasangX(); });
    const kumpul = () => { const o = { ...I }; E.querySelectorAll("[data-k]").forEach((x) => (o[x.dataset.k] = x.value.trim()));
      if (r.jenis === "BASTP") o.serah = [...E.querySelectorAll("[data-sr]")].map((x) => { const [a, b, c] = x.querySelectorAll("select,input"); return { ya: a.value, t: b.value.trim(), ket: c.value.trim() }; }).filter((x) => x.t);
      if (r.jenis === "BASTP") o.cek = [...E.querySelectorAll("[data-cekt]")].map((x) => ({ t: x.value.trim(), ya: E.querySelector(`[data-cek="${x.dataset.cekt}"]`).value }));
      if (r.jenis === "BASTP") o.titik = [...E.querySelectorAll("#eaT tr")].slice(1).map((tr) => Object.fromEntries([...tr.querySelectorAll("[data-t]")].map((x) => [x.dataset.t, x.value.trim()]))).filter((t) => t.bhid); return o; };
    const simpan = async (extra = {}) => { const { error } = await sb.from("berita_acara").update({ nomor: E.querySelector("#eaN").value.trim(), isi: kumpul(), updated_at: new Date().toISOString(), ...extra }).eq("id", id);
      if (error) { E.querySelector("#eaE").textContent = error.message; return false; } toast("Tersimpan"); daftar(); return true; };
    E.querySelector("#eaS").onclick = () => simpan();
    // Lihat isi surat persis seperti hasil cetak, memakai isian di layar (belum perlu disimpan)
    E.querySelector("#eaV").onclick = () => cetakBA(id, { lihat: true, r: { ...r, nomor: E.querySelector("#eaN").value.trim(), isi: kumpul() } });
    E.querySelector("#eaP").onclick = async () => { if (kunci || (await simpan())) cetakBA(id); };
    E.querySelector("#eaF")?.addEventListener("click", async () => { if (confirm("Tandai FINAL? Setelah final hanya admin yang bisa mengubah.") && (await simpan({ status: "FINAL" }))) edit(id); });
    E.querySelector("#eaH")?.addEventListener("click", async () => { if (!confirm("Hapus berita acara ini?")) return; const { error } = await sb.from("berita_acara").delete().eq("id", id); if (error) return alert(error.message); E.innerHTML = ""; daftar(); });
    E.querySelector("#eaX").onclick = () => (E.innerHTML = ""); };
  daftar();
}
// Sebelum cetak: tanyakan nama & jabatan penanda tangan pihak PT Nusa Prima Gemilang (bisa pilih nama yang pernah dipakai); disimpan ke BA.
async function tanyaPenandatangan(r) {
  const I = r.isi ?? {}, bast = r.jenis === "BASTP";
  const { data: lama } = await sb.from("berita_acara").select("isi").limit(200);
  const nama = [...new Set((lama ?? []).map((x) => x.isi?.penerima).filter(Boolean))], jab = [...new Set((lama ?? []).map((x) => x.isi?.penerima_jabatan).filter(Boolean))];
  return new Promise((res) => {
    const m = modal(`<h3 style="margin-top:0">Penanda tangan ${bast ? "Pihak Kedua" : "pihak pemberi kerja"}</h3>
      <p class="muted" style="margin-top:0">${bast ? "BASTP" : "BA stop bor " + esc(r.bhid ?? "")} · siapa yang tanda tangan dari ${esc(I.penerima_pt || KOP.pemberi)}?</p>
      <label>Nama</label><input id="tpN" list="tpNL" value="${esc(I.penerima ?? "")}" placeholder="nama lengkap"><datalist id="tpNL">${nama.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <label>Jabatan</label><input id="tpJ" list="tpJL" value="${esc(I.penerima_jabatan ?? (bast ? "Perwakilan Pemberi Kerja" : "Pengawas Lapangan"))}"><datalist id="tpJL">${jab.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <label>Perusahaan</label><input id="tpP" value="${esc(I.penerima_pt || KOP.pemberi)}">
      <div class="row" style="margin-top:10px;flex-wrap:wrap"><button id="tpOk">Simpan & cetak</button><button class="sec" id="tpKosong">Cetak tanpa nama (diisi tangan)</button><button class="sec" id="tpX" style="flex:0">Batal</button></div><div id="tpE" class="err"></div>`);
    const q = (x) => m.querySelector(x);
    q("#tpX").onclick = () => { m.remove(); res(null); };
    q("#tpKosong").onclick = () => { m.remove(); res(r); };
    q("#tpOk").onclick = async () => { const n = q("#tpN").value.trim(); if (!n) return (q("#tpE").textContent = "Isi nama, atau pilih Cetak tanpa nama.");
      const isi = { ...I, penerima: n, penerima_jabatan: q("#tpJ").value.trim(), penerima_pt: q("#tpP").value.trim() || KOP.pemberi };
      if (r.status !== "FINAL" || me?.role === "admin") { const { error } = await sb.from("berita_acara").update({ isi, updated_at: new Date().toISOString() }).eq("id", r.id); if (error) return (q("#tpE").textContent = error.message); }
      m.remove(); res({ ...r, isi }); };
  });
}
// opsi.lihat = tampilkan isi surat saja (tanpa tanya penanda tangan); opsi.r = isian dari form edit yang belum disimpan
async function cetakBA(id, opsi = {}) {
  const r0 = opsi.r ?? (await sb.from("berita_acara").select("*").eq("id", id).single()).data; if (!r0) return alert("Berita acara tidak ditemukan");
  const r = opsi.lihat ? r0 : await tanyaPenandatangan(r0); if (!r) return; const I = r.isi ?? {}, bast = r.jenis === "BASTP";
  const w = jendelaDok(bast ? "BASTP" : `BA stop bor ${r.bhid}`, "A4");
  let foto = "";
  if (!bast) { const { data: ev } = await sb.from("drill_event").select("event_type,photo_path,captured_at,reason").eq("bhid", r.bhid).in("event_type", ["FOTO_DRILL_PAD", "FOTO_PATOK"]).order("captured_at");
    const u = await signedUrls("progress-photos", (ev ?? []).map((e) => e.photo_path).filter(Boolean));
    foto = (ev ?? []).length ? `<h3>Lampiran foto</h3><div class="fg">${ev.map((e) => `<figure><img src="${u[e.photo_path] ?? ""}"><figcaption>${e.event_type === "FOTO_PATOK" ? "Foto patok" : "Foto drill pad"} · ${esc(fmtT(new Date(e.captured_at)))}${e.reason ? " · " + esc(e.reason) : ""}</figcaption></figure>`).join("")}</div>` : `<p class="m">Foto drill pad & patok belum ada di aplikasi.</p>`; }
  const tglPanjang = (t) => { try { return new Date(t + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { return t; } };
  const baris = (l, v) => `<tr><td style="width:38%">${l}</td><td>${esc(v ?? "") || "-"}</td></tr>`;
  const isi = bast ? `<table>${baris("Pekerjaan", I.pekerjaan)}${baris("Periode", `${r.dari} s/d ${r.sampai}`)}${baris("Jumlah titik diserahkan", `${(I.titik ?? []).length}${I.rencana ? ` dari ${I.rencana} titik rencana` : ""}`)}${baris("Total kedalaman (m)", (I.titik ?? []).reduce((s, t) => s + (+String(t.kedalaman).replace(",", ".") || 0), 0).toFixed(2))}</table>
      <table class="d"><tr><th>No</th><th>Titik</th><th>Rig</th><th>Mulai</th><th>Stop</th><th>Kedalaman (m)</th><th>EOH/STB</th><th>Coring (m)</th><th>Open hole (m)</th><th>Recovery (%)</th><th>Sample</th><th>Ket.</th></tr>${(I.titik ?? []).map((t, i) => `<tr><td>${i + 1}</td>${["bhid", "rig", "mulai", "stop", "kedalaman", "status", "coring", "open", "recovery", "conto", "ket"].map((k) => `<td>${esc(t[k] ?? "")}</td>`).join("")}</tr>`).join("")}</table>
      <h3>2. Kriteria penerimaan pekerjaan</h3><table>${(I.cek ?? []).map((c) => `<tr><td>${esc(c.t)}</td><td style="width:90px;text-align:center"><b>${esc(c.ya)}</b></td></tr>`).join("")}</table>`
    : `<table>${baris("Hole ID", I.bhid)}${I.redrill ? baris("Keterangan", I.redrill) : ""}${baris("Rig", I.rig)}${baris("Tanggal mulai bor", I.mulai)}${baris("Tanggal stop bor", I.stop)}${baris("Status akhir", I.status)}${baris("Kedalaman akhir (m)", I.kedalaman)}${baris("Alasan stop", I.alasan)}
      ${baris("Koordinat East / X", I.east)}${baris("Koordinat North / Y", I.north)}${baris("Elevasi / Z", I.rl)}${baris("Sistem koordinat", I.sistem)}${baris("Panjang coring (m)", I.coring)}${baris("Panjang open hole (m)", I.open)}${baris("Recovery core (%)", I.recovery)}${baris("Jumlah sample", I.conto)}${baris("Tebal limonit (m)", I.limonit)}${baris("Tebal saprolit (m)", I.saprolit)}</table>`;
  w.document.open(); w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(r.nomor ?? "Berita Acara")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Caladea:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>@page{size:A4 portrait;margin:0} html{background:#eee} body{font-family:Cambria,Caladea,"Times New Roman",serif;font-size:12.5px;color:#111;box-sizing:border-box;width:210mm;max-width:100%;margin:12px auto;padding:0;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25)} @media print{html{background:#fff} body{width:210mm;margin:0;box-shadow:none}}
  table.lay,table.lay>*>tr>td{border:0;padding:0;margin:0;width:100%} .kopA{display:block;width:210mm;max-width:100%} table.lay>tbody>tr>td.isi{padding:2mm 20mm 4mm} .kakiSp{height:28mm} .kaki{width:210mm;max-width:100%} .kaki img{display:block;width:100%}
  h1{text-align:center;font-size:15px;margin:14px 0 2px;text-decoration:underline} .no{text-align:center;margin-bottom:12px} table{border-collapse:collapse;width:100%;margin:6px 0} td,th{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top} th{background:#e6efe9} table.d td,table.d th{font-size:10px;padding:3px}
  .blok{break-inside:avoid;page-break-inside:avoid} .ttd{break-inside:avoid;display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px;text-align:center} .ttd div{min-height:120px} .sp{height:70px} .nm{font-weight:bold;text-decoration:underline} .m{color:#666} table.p td{border:0;padding:1px 4px} .fg{display:grid;grid-template-columns:1fr 1fr;gap:8px} .fg img{width:100%;border:1px solid #ccc} figure{margin:0} figcaption{font-size:9.5px;color:#444}

  @media print{button{display:none} .kaki{position:fixed;bottom:0;left:0}}</style></head><body>
  <button onclick="print()">Cetak / simpan PDF</button>
  <table class="lay"><thead><tr><td><img class="kopA" src="${KOP_HEADER}"></td></tr></thead><tfoot><tr><td><div class="kakiSp"></div></td></tr></tfoot><tbody><tr><td class="isi">
  <h1>${bast ? "BERITA ACARA SERAH TERIMA PEKERJAAN (BASTP)" : "BERITA ACARA STOP BOR"}</h1><div class="no">Nomor: ${esc(r.nomor ?? "")}${r.status !== "FINAL" ? " <span class=m>(DRAF)</span>" : ""}</div>
  ${bast ? `<p>Pada ${esc(tglTerbilang(I.tanggal ?? ""))}, bertempat di ${esc(I.tempat ?? "")}, kami yang bertanda tangan di bawah ini:</p>
  <table class="p"><tr><td style="width:24px">1.</td><td style="width:120px">Nama</td><td>: <b>${esc(I.direktur || KOP.direktur)}</b></td></tr><tr><td></td><td>Jabatan</td><td>: ${esc(I.direktur_jabatan || KOP.jabatanDir)}</td></tr><tr><td></td><td>Perusahaan</td><td>: ${KOP.pt}</td></tr><tr><td></td><td>Alamat</td><td>: ${esc(KOP.alamat.join(", "))}</td></tr>
    <tr><td></td><td colspan="2">Dalam hal ini bertindak untuk dan atas nama ${KOP.pt} selaku pelaksana pekerjaan, selanjutnya disebut <b>PIHAK PERTAMA</b>.</td></tr>
    <tr><td>2.</td><td>Nama</td><td>: <b>${esc(I.penerima || "......................................")}</b></td></tr><tr><td></td><td>Jabatan</td><td>: ${esc(I.penerima_jabatan || "......................................")}</td></tr><tr><td></td><td>Perusahaan</td><td>: ${esc(I.penerima_pt || KOP.pemberi)}</td></tr>${I.penerima_alamat ? `<tr><td></td><td>Alamat</td><td>: ${esc(I.penerima_alamat)}</td></tr>` : ""}
    <tr><td></td><td colspan="2">Dalam hal ini bertindak untuk dan atas nama ${esc(I.penerima_pt || KOP.pemberi)} selaku pemberi kerja, selanjutnya disebut <b>PIHAK KEDUA</b>.</td></tr></table>
  <p>${esc(I.pernyataan ?? "")}</p><h3>1. Hasil pekerjaan pemboran</h3>`
  : `<p>Pada ${esc(tglTerbilang(I.tanggal ?? ""))}, bertempat di lokasi pemboran ${esc(I.bhid ?? "")}, kami yang bertanda tangan di bawah ini, ${esc(I.geologist || "Wellsite Geologist")} (${esc(I.geologist_jabatan ?? "Wellsite Geologist")}, ${KOP.pt}) dan ${esc(I.penerima || "perwakilan lapangan")} (${esc(I.penerima_jabatan ?? "Pengawas Lapangan")}, ${esc(I.penerima_pt || KOP.pemberi)}), menyatakan bahwa:</p><p>${esc(I.pernyataan ?? "")}</p>`}
  ${isi}
  ${bast ? `<h3>3. Data, dokumen dan database yang diserahkan</h3><table class="d"><tr><th style="width:24px">No</th><th>Item</th><th style="width:70px">Diserahkan</th><th>Keterangan</th></tr>${(I.serah ?? []).map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.t)}</td><td style="text-align:center"><b>${esc(c.ya)}</b></td><td>${esc(c.ket ?? "")}</td></tr>`).join("")}</table>` : ""}
  ${I.catatan ? `<p><b>Catatan:</b> ${esc(I.catatan)}</p>` : ""}${bast && I.penutup ? `<p>${esc(I.penutup)}</p>` : ""}
  <div class="blok"><p>${esc(I.tempat ?? "")}, ${esc(tglPanjang(I.tanggal ?? ""))}</p>
  ${bast ? `<div class="ttd"><div>PIHAK PERTAMA<br>Yang menyerahkan,<br><b>${KOP.pt}</b><div class="sp"></div><span class="nm">${esc(I.direktur || KOP.direktur)}</span><br>${esc(I.direktur_jabatan || KOP.jabatanDir)}</div>
    <div>PIHAK KEDUA<br>Yang menerima,<br><b>${esc(I.penerima_pt || KOP.pemberi)}</b><div class="sp"></div><span class="nm">${esc(I.penerima || "(......................)")}</span><br>${esc(I.penerima_jabatan ?? "")}</div></div>`
  : `<div class="ttd"><div>Dibuat oleh,<br><b>${KOP.pt}</b><br>${esc(I.geologist_jabatan ?? "Wellsite Geologist")}<div class="sp"></div><span class="nm">${esc(I.geologist || "(......................)")}</span></div>
    <div>Disaksikan oleh,<br><b>${esc(I.penerima_pt || KOP.pemberi)}</b><br>${esc(I.penerima_jabatan ?? "Pengawas Lapangan")}<div class="sp"></div><span class="nm">${esc(I.penerima || "(......................)")}</span></div></div>`}</div>
  ${foto}
  </td></tr></tbody></table>
  <div class="kaki"><img src="${KOP_FOOTER}"></div>
  </body></html>`); w.document.close();
}

// ---------- Koneksi DDR ↔ logging harian (Data & cek) ----------
// Setiap interval yang dibor menurut DDR (v_ddr_baris) harus tertutup interval conto logging (tabel sample).
// Interval DDR yang belum tertutup logging = BELUM LOGGING; bila tanggal DDR sudah lewat 1 hari = TERLAMBAT.
async function panelDdrLogging(el, pilih) {
  el.innerHTML = `<p class="muted">Memeriksa DDR vs logging…</p>`;
  const [{ data: B, error: e1 }, { data: S, error: e2 }] = await Promise.all([
    sb.from("v_ddr_baris").select("tanggal,rig,bhid,dari_m,sampai_m,meter").limit(10000),
    sb.from("sample").select("bhid,depth_from,depth_to").limit(20000)]);
  if (e1 || e2) return (el.innerHTML = `<p class="err">${esc((e1 ?? e2).message)}</p>`);
  const hari = todayWIB(), kemarin = new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const logBH = {}; for (const s of S ?? []) (logBH[s.bhid] ??= []).push([+s.depth_from, +s.depth_to]);
  for (const k in logBH) { const xs = logBH[k].sort((a, b) => a[0] - b[0]), m = []; for (const x of xs) { const t = m.at(-1); if (t && x[0] <= t[1] + 0.05) t[1] = Math.max(t[1], x[1]); else m.push([...x]); } logBH[k] = m; }
  const tertutup = (b, f, t) => { let n = 0; for (const [a, z] of logBH[b] ?? []) n += Math.max(0, Math.min(t, z) - Math.max(f, a)); return n; };
  const baris = (B ?? []).map((x) => { const f = +x.dari_m, t = +x.sampai_m, log = tertutup(x.bhid, f, t); return { ...x, f, t, m: t - f, log, kurang: Math.max(0, t - f - log) }; }).filter((x) => x.m > 0);
  const per = {}; for (const x of baris) { const p = (per[x.bhid] ??= { bhid: x.bhid, rig: new Set(), ddr: 0, kurang: 0, tgl: new Set(), tglTua: null }); p.rig.add(x.rig); p.ddr = Math.max(p.ddr, x.t);
    if (x.kurang > 0.05) { p.kurang += x.kurang; p.tgl.add(x.tanggal); if (!p.tglTua || x.tanggal < p.tglTua) p.tglTua = x.tanggal; } }
  for (const b in logBH) per[b] ??= { bhid: b, rig: new Set(), ddr: 0, kurang: 0, tgl: new Set(), tglTua: null };
  const L = Object.values(per).sort((a, b) => a.bhid.localeCompare(b.bhid, "id", { numeric: true }));
  const st = (p) => (!p.ddr ? ["ANTRE", "BELUM ADA DDR"] : p.kurang <= 0.05 ? ["APPROVED", "LENGKAP"] : p.tglTua < kemarin || (p.tglTua === kemarin && hari !== kemarin) ? ["REJECTED", "TERLAMBAT"] : ["NEEDS_REVIEW", "MENUNGGU LOGGING"]);
  const telat = L.filter((p) => st(p)[1] === "TERLAMBAT"), tunggu = L.filter((p) => st(p)[1] === "MENUNGGU LOGGING");
  const logMax = (b) => Math.max(0, ...(logBH[b] ?? []).map((x) => x[1]));
  const buka = el.querySelector("details")?.open ?? false;
  el.style.padding = "6px 10px";
  el.innerHTML = `<details ${buka ? "open" : ""}><summary style="cursor:pointer;font-size:12px;line-height:1.4">DDR ↔ logging:
      ${telat.length ? `<span style="background:#F6C9C3;border-radius:6px;padding:1px 6px">⚠ ${telat.length} terlambat (${telat.map((p) => esc(p.bhid)).join(", ")})</span>` : ""}
      ${tunggu.length ? `<span style="background:#FFE58A;border-radius:6px;padding:1px 6px">⏳ ${tunggu.length} menunggu</span>` : ""}
      ${!telat.length && !tunggu.length ? `<span style="background:#D7F0E1;border-radius:6px;padding:1px 6px">✓ lengkap</span>` : ""} <span class="muted">· ketuk untuk rincian</span></summary>
    <p class="muted" style="font-size:11px;margin:4px 0">Setiap meter DDR wajib punya logging conto (Form Logging disetujui) pada interval yang sama. Terlambat = DDR sudah lewat 1 hari tetapi intervalnya belum ter-logging.${telat.length ? ` Belum masuk: ${telat.map((p) => `${esc(p.bhid)} ${fmtD(p.kurang)} m sejak ${esc(p.tglTua)}`).join("; ")}.` : ""}</p>
    <div style="font-size:12px">
    <div class="tw"><table><tr><th>Titik</th><th>Rig</th><th>DDR s/d (m)</th><th>Logging s/d (m)</th><th>Belum logging (m)</th><th>Tanggal DDR belum ter-logging</th><th>Status</th></tr>
    ${L.map((p) => { const [k, t] = st(p); return `<tr data-pb="${esc(p.bhid)}" style="cursor:pointer${p.bhid === pilih ? ";outline:2px solid #1E9E69" : ""}"><td><b>${esc(p.bhid)}</b></td><td>${esc([...p.rig].join("/"))}</td><td>${fmtD(p.ddr)}</td><td>${fmtD(logMax(p.bhid))}</td><td>${p.kurang > 0.05 ? fmtD(p.kurang) : "–"}</td><td>${esc([...p.tgl].sort().join(", ")) || "–"}</td><td><span class="pill ${k}">${t}</span></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">Belum ada DDR.</td></tr>`}</table></div>
    ${pilih && baris.some((x) => x.bhid === pilih) ? `<h4 style="margin:10px 0 4px">Rincian per tanggal · ${esc(pilih)}</h4><div class="tw"><table><tr><th>Tanggal</th><th>Rig</th><th>DDR dari–sampai (m)</th><th>Meter DDR</th><th>Sudah ter-logging (m)</th><th>Status</th></tr>
      ${Object.values(baris.filter((x) => x.bhid === pilih).reduce((a, x) => { const k = x.tanggal + x.rig, o = (a[k] ??= { tanggal: x.tanggal, rig: x.rig, f: x.f, t: x.t, m: 0, log: 0 }); o.f = Math.min(o.f, x.f); o.t = Math.max(o.t, x.t); o.m += x.m; o.log += x.log; return a; }, {}))
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((o) => { const ok = o.m - o.log <= 0.05, tel = !ok && o.tanggal < kemarin;
          return `<tr><td>${esc(o.tanggal)}</td><td>${esc(o.rig)}</td><td>${fmtD(o.f)} – ${fmtD(o.t)}</td><td>${fmtD(o.m)}</td><td>${fmtD(o.log)}</td><td><span class="pill ${ok ? "APPROVED" : tel ? "REJECTED" : "NEEDS_REVIEW"}">${ok ? "LENGKAP" : tel ? `TERLAMBAT ${fmtD(o.m - o.log)} m` : `BELUM ${fmtD(o.m - o.log)} m`}</span></td></tr>`; }).join("")}</table></div>` : ""}</div></details>`;
  el.querySelectorAll("[data-pb]").forEach((tr) => (tr.onclick = () => { const s = $("#bh"); if (s && [...s.options].some((o) => o.value === tr.dataset.pb)) { s.value = tr.dataset.pb; s.onchange?.(); } else panelDdrLogging(el, tr.dataset.pb); }));
}
