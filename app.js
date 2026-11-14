// TGEP Scan Drill Log — aplikasi web untuk HP (bisa dipasang & dipakai offline)
import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const app = $("#app");
let session = null, me = null, tab = "foto";

// ---------- kolom formulir (harus sama dengan fungsi process-scan) ----------
const LOG = [["seq","No"],["depth_from","From"],["depth_to","To"],["core_length","Core L"],["lose_from","Lose F"],["lose_to","Lose T"],["geozone_id","Zona"],
 ["geolithcode_id_1","Lito1"],["geolithcode_prc_1","%1"],["geolithcode_gs_1","GS1"],["geolithcode_id_2","Lito2"],["geolithcode_prc_2","%2"],["geolithcode_gs_2","GS2"],
 ["colour","Warna"],["rock_prc","Rock%"],["geosrp_id","Serp"],["geohrdns_id","Hard"],["geowthrg_id","Wth"],["geofrctr_id","Frc"],["total_silica","Sil%"],["total_garnierit","Gar%"],
 ["geomnrlcode_id_1","Min1"],["min_1_prc","%"],["geomnrlcode_id_2","Min2"],["min_2_prc","%"],["geomnrlcode_id_3","Min3"],["min_3_prc","%"],["comment","Komentar"]];
const DEN = [["seq","No"],["len1","P1"],["len2","P2"],["len3","P3"],["dia1","D1"],["dia2","D2"],["dia3","D3"],["d_weight_gr","Berat basah g"],["d_wtr_volume_ml","Vol1 ml"],
 ["d_volume_measure_ml","Arch Vol2 ml"],["d_dry_weight_gr","Berat kering g"],["d_wet_weight","Berat conto kg"],["recheck_weight_kg","Timbang ulang kg"],["comment","Komentar"]];
const HDR = [["bhid","BHID"],["area","Area"],["prospect","Prospek"],["grid","Grid"],["start_date","Mulai"],["stop_date","Selesai"],["xgps","X GPS"],["ygps","Y GPS"],["zgps","Z GPS"],
 ["rigmc_id","Rig"],["teamleader","Ketua tim"],["operator","Operator"],["logger","Logger"],["field_geos","Field geos"],["depth_tp","Akhir TP"],["depth_l","Akhir L"],["depth_s","Akhir S"],
 ["total_depth","EOH"],["total_sample","Total sample"],["water_table","Air tanah"],["core_size","Core size"],["core_barrel_type","Barrel"],["samptype_id","Tipe conto"],
 ["drilprpose_id","Tujuan"],["spacing_id","Spasi"],["morphology_id","Morfologi"],["weather_id","Cuaca"],["vgtation_id","Vegetasi"],["brtype_id","Batuan dasar"],["comment","Komentar"]];
const SHEET = [["seq","No"],["depth_from","From"],["depth_to","To"],["core_length","Core L"],["lose_from","Loss dari"],["lose_to","Loss sampai"],["geozone_id","Zona"],
 ["geolithcode_id_1","Lito1"],["geolithcode_prc_1","%1"],["geolithcode_id_2","Lito2"],["geolithcode_prc_2","%2 (hitung)"],["colour","Warna"],["geohrdns_id","Hard"],["geowthrg_id","Wth"],["geosrp_id","Serp"],
 ["total_silica","Sil%"],["total_garnierit","Gar%"],["geomnrlcode_id_1","Min1"],["min_1_prc","%"],["geomnrlcode_id_2","Min2"],["min_2_prc","%"],
 ["d_length_cm","P cm"],["d_diameter_cm","D cm"],["d_weight_gr","Basah g"],["d_volume_measure_ml","Arch Vol2 ml"],["d_wet_weight","Conto kg"],["comment","Komentar"]];
const SHDR = [["bhid","BHID"],["date","Tanggal"],["page","Hal."],["logger","Logger"],["rigmc_id","Rig"],["xgps","X GPS"],["ygps","Y GPS"],["zgps","Z GPS"],["total_depth","EOH"],["core_size","Core size"]];
const PHDR = [["bhid","BHID"],["page","Halaman"],["date","Tanggal"],["logger","Logger/petugas"]];
const FORMS = { SHEET: "Formulir lapangan 1 lembar (F-BOR)", HEADER: "F01 Header lubang (lama)", LOG: "F02 Logging (lama)", DENSITY: "F03 Density (lama)" };
const NUMERIC = new Set(["seq","depth_from","depth_to","core_length","lose_from","lose_to","geolithcode_prc_1","geolithcode_prc_2","rock_prc","total_silica","total_garnierit",
 "min_1_prc","min_2_prc","min_3_prc","len1","len2","len3","dia1","dia2","dia3","d_weight_gr","d_wtr_volume_ml","d_volume_measure_ml","d_dry_weight_gr","d_wet_weight",
 "recheck_weight_kg","xgps","ygps","zgps","depth_tp","depth_l","depth_s","total_depth","total_sample","water_table"]);

// ---------- antrean offline (IndexedDB) ----------
const db = await new Promise((res, rej) => {
  const r = indexedDB.open("tgep-scan", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("queue", { keyPath: "client_uuid" });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const q = (mode, fn) => new Promise((res, rej) => { const t = db.transaction("queue", mode); const s = t.objectStore("queue"); const r = fn(s); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); });
const qAll = () => q("readonly", (s) => s.getAll());
const qPut = (x) => q("readwrite", (s) => s.put(x));
const qDel = (k) => q("readwrite", (s) => s.delete(k));

// ---------- jaringan ----------
function netBadge() { const n = $("#net"); n.textContent = navigator.onLine ? "online" : "offline"; n.className = navigator.onLine ? "" : "off"; }
addEventListener("online", () => { netBadge(); sync(); }); addEventListener("offline", netBadge); netBadge();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

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
  if (syncing || !navigator.onLine || !session) return;
  syncing = true;
  try {
    for (const it of await qAll()) {
      if (it.kind === "core") { await syncCore(it); continue; }
      const path = `${session.user.id}/${it.client_uuid}.jpg`;
      const up = await sb.storage.from("scan-photos").upload(path, it.blob, { contentType: "image/jpeg", upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) { it.error = up.error.message; await qPut(it); continue; }
      const ins = await sb.from("scan_job").upsert({ client_uuid: it.client_uuid, form_type: it.form_type, bhid_hint: it.bhid, photo_path: path, captured_at: it.captured_at },
        { onConflict: "client_uuid", ignoreDuplicates: true });
      if (ins.error) { it.error = ins.error.message; await qPut(it); continue; }
      const { data: job } = await sb.from("scan_job").select("id").eq("client_uuid", it.client_uuid).single();
      if (job) await sb.functions.invoke("process-scan", { body: { job_id: job.id } });
      await qDel(it.client_uuid);
    }
  } finally { syncing = false; if (tab === "foto" || tab === "core") render(); }
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
async function render() {
  if (!session) return loginView();
  if (!me) { app.innerHTML = `<div class="card"><h2>Akun belum terdaftar</h2><p>Email ${esc(session.user.email)} sudah bisa login, tetapi belum didaftarkan admin TGEP sebagai geologist/verifier/admin. Hubungi admin.</p><button class="sec" id="out">Keluar</button></div>`; $("#out").onclick = () => sb.auth.signOut(); return; }
  const navs = [["foto", "Foto formulir"], ["core", "Foto core"], ...(["verifier", "admin"].includes(me?.role) ? [["review", "Periksa scan"], ["data", "Data & cek"], ["db", "Database"]] : [])];
  app.innerHTML = `<nav>${navs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}<button class="sec" id="out" style="flex:0">Keluar</button></nav><div id="v"></div>`;
  app.querySelectorAll("nav [data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; render(); }));
  $("#out").onclick = async () => { await sb.auth.signOut(); };
  document.querySelector("main").style.maxWidth = tab === "db" ? "none" : "";
  if (tab === "foto") return fotoView($("#v"));
  if (tab === "review") return reviewList($("#v"));
  if (tab === "data") return dataView($("#v"));
  if (tab === "core") return coreView($("#v"));
  if (tab === "db") return dbView($("#v"));
}

function loginView() {
  app.innerHTML = `<div class="card"><h2>Masuk</h2><p class="muted">Akun dibuat oleh admin. Setelah sekali masuk, aplikasi tetap bisa memotret saat offline.</p>
  <label>Email</label><input id="em" type="email" autocomplete="username"><label>Kata sandi</label><input id="pw" type="password" autocomplete="current-password">
  <div style="margin-top:12px"><button id="go">Masuk</button></div><div id="e" class="err"></div></div>`;
  $("#go").onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) $("#e").textContent = error.message;
  };
}

async function fotoView(v) {
  const lastB = localStorage.getItem("bhid") || "";
  const queue = (await qAll()).filter((x) => x.kind !== "core");
  v.innerHTML = `<div class="card"><h2>Foto formulir lapangan</h2>
   <label>BHID lubang bor</label><input id="bh" value="${esc(lastB)}" placeholder="mis. TGE0012" autocapitalize="characters">
   <p class="muted">Letakkan formulir di permukaan datar, cahaya merata, keempat kotak hitam di sudut harus masuk foto.</p>
   <div class="big">${Object.entries({ SHEET: FORMS.SHEET }).map(([k, t]) => `<button data-f="${k}">${t}<small>Ambil foto atau pilih dari galeri</small></button>`).join("")}</div>
   <input id="file" type="file" accept="image/*" capture="environment" class="hide"><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean di HP (${queue.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${queue.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(FORMS[x.form_type])} · ${esc(x.bhid)}<br><span class="muted">${new Date(x.captured_at).toLocaleString("id-ID")}${x.error ? " · gagal: " + esc(x.error) : ""}</span></span></li>`).join("") || `<li class="muted">Kosong — semua foto sudah terkirim.</li>`}</ul></div>
   <div class="card"><h3>Scan saya</h3><ul class="list" id="mine"><li class="muted">Memuat…</li></ul></div>`;
  let form = null;
  v.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => {
    if (!$("#bh").value.trim()) return ($("#e").textContent = "Isi BHID dulu.");
    form = b.dataset.f; $("#file").click();
  }));
  $("#file").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const bhid = $("#bh").value.trim().toUpperCase(); localStorage.setItem("bhid", bhid);
    await qPut({ client_uuid: crypto.randomUUID(), form_type: form, bhid, blob: await shrink(f), captured_at: new Date().toISOString() });
    ev.target.value = ""; render(); sync();
  };
  $("#sy").onclick = sync;
  if (navigator.onLine) {
    const { data } = await sb.from("scan_job").select("id,form_type,bhid_hint,status,created_at,n_disagree,n_rule_flags,error").eq("created_by", session.user.id).order("created_at", { ascending: false }).limit(30);
    $("#mine").innerHTML = (data ?? []).map((j) => `<li><span class="pill ${j.status}">${j.status}</span><span>${esc(FORMS[j.form_type])} · ${esc(j.bhid_hint)}<br><span class="muted">${new Date(j.created_at).toLocaleString("id-ID")}${j.status === "NEEDS_REVIEW" ? ` · ${j.n_disagree} beda baca, ${j.n_rule_flags} cek aturan` : ""}${j.error ? " · " + esc(j.error) : ""}</span></span></li>`).join("") || `<li class="muted">Belum ada.</li>`;
  } else $("#mine").innerHTML = `<li class="muted">Offline — daftar akan tampil saat ada sinyal.</li>`;
}

async function reviewList(v) {
  const { data, error } = await sb.from("scan_job").select("id,form_type,bhid_hint,page_no,status,created_at,n_disagree,n_rule_flags,error")
    .in("status", ["NEEDS_REVIEW", "ERROR", "PROCESSING", "UPLOADED"]).order("created_at");
  v.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Scan menunggu pemeriksaan</h2><button class="sec" id="rf" style="flex:0">Muat ulang</button></div>
  ${error ? `<p class="err">${esc(error.message)}</p>` : ""}
  <ul class="list">${(data ?? []).map((j) => `<li><span class="pill ${j.status}">${j.status}</span><span style="flex:1">${esc(FORMS[j.form_type])} · <b>${esc(j.bhid_hint)}</b>${j.page_no ? " hal. " + j.page_no : ""}<br>
   <span class="muted">${new Date(j.created_at).toLocaleString("id-ID")}${j.status === "NEEDS_REVIEW" ? ` · ${j.n_disagree} beda baca · ${j.n_rule_flags} cek aturan` : ""}${j.error ? " · " + esc(j.error) : ""}</span></span>
   <button data-id="${j.id}" style="flex:0">Buka</button>${me?.role === "admin" ? `<button class="danger" data-del="${j.id}" style="flex:0">Hapus</button>` : ""}</li>`).join("") || `<li class="muted">Tidak ada yang perlu diperiksa.</li>`}</ul></div>`;
  $("#rf").onclick = () => reviewList(v);
  v.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => reviewDetail(v, b.dataset.id)));
  v.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (await adminDelete("scan_job", b.dataset.del, "scan formulir")) reviewList(v); }));
}

async function reviewDetail(v, id) {
  const { data: j, error } = await sb.from("scan_job").select("*").eq("id", id).single();
  if (error) return (v.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const { data: url } = await sb.storage.from("scan-photos").createSignedUrl(j.photo_path, 3600);
  const data = structuredClone(j.merged ?? { header: {}, rows: [] });
  const flags = j.validation ?? [], cf = j.cell_flags ?? {};
  const hdrCols = j.form_type === "HEADER" ? HDR : j.form_type === "SHEET" ? SHDR : PHDR, rowCols = j.form_type === "LOG" ? LOG : j.form_type === "DENSITY" ? DEN : j.form_type === "SHEET" ? SHEET : [];
  const cls = (k) => { const f = cf[k]; if (!f) return ""; return f.some((x) => x.type === "BEDA") ? "f-BEDA" : "f-ATURAN"; };
  const tip = (k) => (cf[k] ?? []).map((x) => x.msg).join(" | ");
  const cell = (val, key, idx, rowNo) => { const fk = `${rowNo ?? "h"}.${key}`; return `<td class="${cls(fk)}" title="${esc(tip(fk))}"><input data-k="${key}" data-r="${idx ?? ""}" value="${esc(val ?? "")}" inputmode="${NUMERIC.has(key) ? "decimal" : "text"}"></td>`; };
  v.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">${esc(FORMS[j.form_type])} · ${esc(j.bhid_hint)}</h2><button class="sec" id="bk" style="flex:0">← Kembali</button></div>
   <p class="muted">Kuning = dua pembacaan berbeda · Merah = melanggar aturan validasi · Hijau = sudah Anda ubah. Bandingkan dengan foto sebelum menyetujui.</p>
   ${j.status === "ERROR" ? `<p class="err">Gagal diproses: ${esc(j.error)}</p>` : ""}</div>
   <div class="rv"><div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Foto</h3><input id="zm" type="range" min="1" max="4" step="0.25" value="1" style="flex:2"></div>
     <div class="photo" id="ph"><img id="im" src="${url?.signedUrl ?? ""}" alt="Foto formulir" style="width:100%"></div></div>
   <div class="card"><h3>Hasil scan (bisa diedit)</h3>
     <div class="tw"><table><tr>${hdrCols.map(([, t]) => `<th>${t}</th>`).join("")}</tr><tr>${hdrCols.map(([k]) => cell(data.header?.[k], k, null, null)).join("")}</tr></table></div>
     ${rowCols.length ? `<div class="tw" style="margin-top:10px"><table><tr><th>Baris</th>${rowCols.map(([, t]) => `<th>${t}</th>`).join("")}</tr>
       ${(data.rows ?? []).map((r, i) => `<tr><td style="padding:4px 6px">${r._row ?? i + 1}</td>${rowCols.map(([k]) => cell(r[k], k, i, r._row)).join("")}</tr>`).join("")}</table></div>` : ""}
   </div></div>
   <div class="card"><h3>Temuan (${flags.length})</h3><ul class="list flags">${flags.map((f) => `<li><span><b>${f.row ? "Baris " + f.row : "Kepala"}</b> · ${esc(f.field)} · ${esc(f.type)} — ${esc(f.msg)}
     ${f.saran !== undefined && f.saran !== null ? `<span class="ab"><button class="sec" data-sar="${esc(f.saran)}" data-f="${esc(f.field)}" data-row="${f.row ?? ""}">Pakai saran: ${esc(f.saran)}</button></span>` : ""}
     ${f.type === "BEDA" && f.field !== "*" ? `<span class="ab"><button class="sec" data-pick="a" data-f="${esc(f.field)}" data-row="${f.row ?? ""}">Pakai A: ${esc(f.a)}</button><button class="sec" data-pick="b" data-f="${esc(f.field)}" data-row="${f.row ?? ""}">Pakai B: ${esc(f.b)}</button></span>` : ""}</span></li>`).join("") || `<li class="muted">Tidak ada temuan.</li>`}</ul></div>
   <div class="card"><label>Catatan pemeriksa</label><textarea id="nt" rows="2"></textarea>
     <div class="row" style="margin-top:10px"><button id="ok">Setujui & simpan ke database</button><button class="warn" id="re">Proses ulang</button><button class="danger" id="no">Tolak</button></div><div id="e" class="err"></div></div>`;
  $("#bk").onclick = () => reviewList(v);
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
  v.querySelectorAll("td input").forEach((inp) => (inp.oninput = () => {
    const k = inp.dataset.k, r = inp.dataset.r, raw = inp.value.trim();
    const val = raw === "" ? null : NUMERIC.has(k) ? Number(raw.replace(",", ".")) : raw;
    if (r === "") data.header[k] = val; else data.rows[Number(r)][k] = val;
    inp.parentElement.className = "edited";
  }));
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
  $("#ok").onclick = async () => {
    for (const r of data.rows ?? []) {
      if (j.form_type === "DENSITY") {
        const av = (xs) => { const n = xs.filter((x) => typeof x === "number" && isFinite(x)); return n.length ? +(n.reduce((a, b) => a + b, 0) / n.length).toFixed(2) : null; };
        r.d_length_cm = av([r.len1, r.len2, r.len3]); r.d_diameter_cm = av([r.dia1, r.dia2, r.dia3]);
      }
      for (const k of Object.keys(r)) if (NUMERIC.has(k) && r[k] !== null && !isFinite(r[k])) return ($("#e").textContent = `Baris ${r._row}: ${k} bukan angka`);
    }
    if (j.form_type === "SHEET") for (const r of data.rows ?? []) { r.geolithcode_prc_2 = r.geolithcode_id_2 && typeof r.geolithcode_prc_1 === "number" ? +(100 - r.geolithcode_prc_1).toFixed(1) : null; r.d_wtr_volume_ml = typeof r.d_volume_measure_ml === "number" ? 1400 : null; }
    $("#ok").disabled = true;
    const { data: res, error } = await sb.rpc("approve_scan", { p_job: id, p_data: data, p_note: $("#nt").value || null });
    $("#ok").disabled = false;
    if (error) return ($("#e").textContent = error.message);
    alert(`Tersimpan: ${res.rows_written} baris untuk ${res.bhid}. Cek hasil hitung di tab "Data & cek".`); reviewList(v);
  };
  $("#re").onclick = async () => { const { error } = await sb.functions.invoke("process-scan", { body: { job_id: id } }); $("#e").textContent = error ? error.message : "Diproses ulang — buka lagi dalam ±1 menit."; };
  $("#no").onclick = async () => {
    if (!$("#nt").value) return ($("#e").textContent = "Tulis alasan penolakan di catatan.");
    const { error } = await sb.from("scan_job").update({ status: "REJECTED", review_note: $("#nt").value, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) $("#e").textContent = error.message; else reviewList(v);
  };
}

async function dataView(v) {
  v.innerHTML = `<div class="card"><h2>Data tersimpan & hasil cek</h2><div class="row"><input id="bh" placeholder="BHID" value="${esc(localStorage.getItem("bhid") || "")}"><button id="go" style="flex:0">Tampilkan</button></div><div id="out"></div></div>`;
  $("#go").onclick = async () => {
    const bh = $("#bh").value.trim().toUpperCase();
    const { data, error } = await sb.from("v_sample_qc").select("sample_no,sample_id,depth_from,depth_to,core_length,core_recovery,geozone_id,geolithcode_id_1,d_wet_density,d_wet_arch,d_dry_density,d_dry_arch,d_arch_diff_pct,d_moisture_pct,d_wet_weight,chk_interval,chk_recovery,chk_lith,chk_code,chk_zone,chk_density,chk_arch,chk_weight").eq("bhid", bh).order("depth_from");
    if (error) return ($("#out").innerHTML = `<p class="err">${esc(error.message)}</p>`);
    const cols = data?.length ? Object.keys(data[0]) : [];
    const bad = (k, x) => k.startsWith("chk_") && x && !["OK", "OK-SW", "BELUM OVEN"].includes(x);
    $("#out").innerHTML = data?.length ? `<p class="muted">Ketuk satu baris untuk mengoreksi atau menambah data (mis. berat kering oven). Setiap koreksi wajib alasan dan tercatat.</p><div class="tw" style="margin-top:10px"><table><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${data.map((r) => `<tr data-s="${esc(r.sample_no)}" style="cursor:pointer">${cols.map((c) => `<td style="padding:5px 7px;${bad(c, r[c]) ? "background:#F6C9C3" : ""}">${esc(r[c])}</td>`).join("")}</tr>`).join("")}</table></div><div id="ed"></div>` : `<p class="muted">Belum ada data untuk ${esc(bh)}.</p>`;
    $("#out").querySelectorAll("tr[data-s]").forEach((tr) => (tr.onclick = () => editSample(tr.dataset.s, () => $("#go").onclick())));
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
async function toJpeg(bmp, max, q) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return await new Promise((r) => c.toBlob(r, "image/jpeg", q));
}
const fmtD = (n) => Number(n).toFixed(2).replace(".", ",");
async function coreView(v) {
  const bh = localStorage.getItem("bhid") || "", last = JSON.parse(localStorage.getItem("coreLast") || "{}");
  const qd = (await qAll()).filter((x) => x.kind === "core");
  v.innerHTML = `<div class="card"><h2>Foto core</h2>
   <div class="row"><div><label>BHID</label><input id="cb" value="${esc(bh)}" autocapitalize="characters"></div><div><label>Kotak ke-</label><input id="cx" inputmode="numeric" value="${esc((last.box ?? 0) + 1)}"></div></div>
   <div class="row"><div><label>FROM (m)</label><input id="cf" inputmode="decimal" value="${esc(last.to ?? "0,00")}"></div><div><label>TO (m)</label><input id="ct" inputmode="decimal"></div></div>
   <label>Jenis foto</label><div class="row"><button data-t="UTUH">Core UTUH</button><button data-t="BELAH" class="sec">Core BELAH</button></div>
   <p class="muted">Standar SOP: teduh, meteran 0–100 cm di tengah, keterangan BHID & kedalaman terbaca, kamera tegak lurus, 1 corebox per foto.</p>
   <input id="cfile" type="file" accept="image/*" capture="environment" class="hide"><div id="lc"></div><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean foto core (${qd.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${qd.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.file_name)}${x.local_check.warnings.length ? `<br><span class="err">${x.local_check.warnings.map(esc).join(" · ")}</span>` : ""}${x.error ? `<br>gagal: ${esc(x.error)}` : ""}</span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
   <div class="card"><h3>Kelengkapan & kesesuaian SOP</h3><div class="row"><input id="kb" value="${esc(bh)}"><button id="kg" style="flex:0">Cek</button></div><div id="ko"></div></div>`;
  let type = "UTUH";
  const num = (s) => Number(String(s).replace(",", "."));
  v.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => {
    type = b.dataset.t; const f = num($("#cf").value), to = num($("#ct").value);
    if (!$("#cb").value.trim()) return ($("#e").textContent = "Isi BHID.");
    if (!(isFinite(f) && isFinite(to) && to > f)) return ($("#e").textContent = "Isi FROM dan TO kotak ini (TO > FROM).");
    if (to - f > 1.6) return ($("#e").textContent = "Satu foto = satu corebox; rentang lebih dari 1,6 m tidak wajar.");
    $("#e").textContent = ""; $("#cfile").click();
  }));
  $("#cfile").onchange = async (ev) => {
    const file = ev.target.files[0]; if (!file) return; ev.target.value = "";
    const bmp = await createImageBitmap(file); const lc = await localCheck(bmp);
    const bhid = $("#cb").value.trim().toUpperCase(), f = num($("#cf").value), to = num($("#ct").value), box = parseInt($("#cx").value) || null;
    const save = async () => {
      const fn = `${bhid}_${fmtD(f)}-${fmtD(to)}_${type}.jpg`;
      await qPut({ kind: "core", client_uuid: crypto.randomUUID(), bhid, box_no: box, depth_from: f, depth_to: to, photo_type: type, file_name: fn,
        blob: await toJpeg(bmp, 4000, 0.9), preview: await toJpeg(bmp, 1600, 0.85), local_check: lc, captured_at: new Date().toISOString() });
      localStorage.setItem("bhid", bhid); localStorage.setItem("coreLast", JSON.stringify({ to: fmtD(to), box }));
      render(); sync();
    };
    if (!lc.warnings.length) return save();
    $("#lc").innerHTML = `<div class="card" style="background:#FBE6D0"><b>Foto mungkin tidak sesuai SOP:</b><ul>${lc.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      <div class="row"><button id="rt">Ambil ulang</button><button class="sec" id="ks">Tetap simpan</button></div></div>`;
    $("#rt").onclick = () => { $("#lc").innerHTML = ""; $("#cfile").click(); };
    $("#ks").onclick = save;
  };
  $("#sy").onclick = sync;
  $("#kg").onclick = () => coverage($("#kb").value.trim().toUpperCase());
  if (bh && navigator.onLine) coverage(bh);
}
async function coverage(bh) {
  const ko = $("#ko"); ko.innerHTML = `<p class="muted">Memuat…</p>`;
  const [{ data: s, error }, { data: ph }] = await Promise.all([
    sb.from("v_sample_photo").select("sample_no,seq,depth_from,depth_to,geozone_id,belah_wajib,chk_foto_utuh,chk_foto_belah").eq("bhid", bh).order("depth_from"),
    sb.from("core_photo").select("id,file_name,photo_type,depth_from,depth_to,status,sop_ok,sop_issues,reviewer_override,review_note,preview_path,error").eq("bhid", bh).order("photo_type").order("depth_from"),
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
  ko.innerHTML = `<p><b>${nBad ? `${nBad} conto belum lengkap / tidak sesuai SOP` : (s?.length ? "Semua conto lengkap dan sesuai SOP" : "Belum ada data logging untuk BHID ini")}</b></p>
   ${gaps.length ? `<p class="err">${gaps.map(esc).join("<br>")}</p>` : ""}
   ${s?.length ? `<div class="tw"><table><tr><th>Conto</th><th>FROM–TO</th><th>Foto utuh</th><th>Foto belah</th></tr>${s.map((r) => `<tr><td>${r.seq}${esc(r.geozone_id ?? "")}</td><td>${fmtD(r.depth_from)}–${fmtD(r.depth_to)}</td>
     <td style="${bad(r.chk_foto_utuh) ? "background:#F6C9C3" : ""}">${esc(r.chk_foto_utuh)}</td><td style="${bad(r.chk_foto_belah) ? "background:#F6C9C3" : ""}">${esc(r.chk_foto_belah ?? "tidak wajib")}</td></tr>`).join("")}</table></div>` : ""}
   <h3>Foto (${ph?.length ?? 0})</h3><ul class="list">${(ph ?? []).map((p) => { const ok = p.reviewer_override ?? p.sop_ok;
     return `<li><span class="pill ${p.status === "CHECKED" ? (ok ? "APPROVED" : "REJECTED") : p.status}">${p.status === "CHECKED" ? (ok ? "SESUAI SOP" : "TIDAK SESUAI") : p.status}</span><span style="flex:1">${esc(p.file_name)}
       ${(p.sop_issues ?? []).length && !ok ? `<br><span class="err">${p.sop_issues.map(esc).join("<br>")}</span>` : ""}${p.error ? `<br><span class="err">${esc(p.error)}</span>` : ""}${p.review_note ? `<br><span class="muted">Catatan: ${esc(p.review_note)}</span>` : ""}</span>
       <button class="sec" data-pv="${esc(p.preview_path)}" style="flex:0">Lihat</button>${isV && p.status === "CHECKED" ? `<button class="sec" data-ov="${p.id}" data-ok="${ok ? 0 : 1}" style="flex:0">${ok ? "Tandai tidak sesuai" : "Nyatakan sesuai"}</button>` : ""}${isV && p.status === "ERROR" ? `<button class="sec" data-re="${p.id}" style="flex:0">Cek ulang</button>` : ""}${me?.role === "admin" ? `<button class="danger" data-delp="${p.id}" style="flex:0">Hapus</button>` : ""}</li>`; }).join("") || `<li class="muted">Belum ada foto core.</li>`}</ul><div id="pvw"></div>`;
  ko.querySelectorAll("[data-pv]").forEach((b) => (b.onclick = async () => {
    const { data } = await sb.storage.from("core-photos").createSignedUrl(b.dataset.pv, 600);
    $("#pvw").innerHTML = `<img src="${data?.signedUrl ?? ""}" alt="Foto core" style="width:100%;border-radius:8px">`; $("#pvw").scrollIntoView({ behavior: "smooth" });
  }));
  ko.querySelectorAll("[data-ov]").forEach((b) => (b.onclick = async () => {
    const note = prompt("Alasan (wajib):"); if (!note) return;
    const { error } = await sb.from("core_photo").update({ reviewer_override: b.dataset.ok === "1", review_note: note, reviewed_by: session.user.id }).eq("id", b.dataset.ov);
    if (error) alert(error.message); else coverage(bh);
  }));
  ko.querySelectorAll("[data-delp]").forEach((b) => (b.onclick = async () => { if (await adminDelete("core_photo", b.dataset.delp, "foto core")) coverage(bh); }));
  ko.querySelectorAll("[data-re]").forEach((b) => (b.onclick = async () => { await sb.functions.invoke("check-core-photo", { body: { photo_id: b.dataset.re } }); coverage(bh); }));
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
  koreksi: { t: "Riwayat koreksi", v: "sample_edit_log", order: ["edited_at"], bh: null },
  arsip: { t: "Arsip terhapus (admin)", v: "deleted_record", order: ["deleted_at"], bh: "bhid", admin: true },
};
const OKV = new Set(["OK", "OK-SW", "BELUM OVEN", "MENUNGGU CEK"]);
function dbQuery(d, f) {
  let q = sb.from(d.v).select("*", { count: "exact" });
  if (f.bh && d.bh) q = q.ilike(d.bh, `%${f.bh}%`);
  if (f.bad && d.bad) q = q.or(d.bad.map((c) => `and(${c}.not.is.null,${c}.not.in.(${[...OKV].map((x) => `"${x}"`).join(",")}))`).join(","));
  for (const o of d.order) q = q.order(o, { ascending: d.v === "deleted_record" || d.v === "sample_edit_log" ? false : true });
  return q;
}
async function fetchAll(d, f) {
  const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await dbQuery(d, f).range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; }
}
async function dbView(v) {
  const keys = Object.keys(DATASETS).filter((k) => !DATASETS[k].admin || me?.role === "admin");
  const st = JSON.parse(sessionStorage.getItem("dbst") || '{"ds":"collar","bh":"","bad":false,"page":0}');
  v.innerHTML = `<div class="card"><h2>Database TGEP</h2>
   <p class="muted">Data yang sama dengan aplikasi lapangan, dalam format data bor standar (Collar · Survey · Geology · Density · Assay). Unduhan bisa dibuka di Excel, Leapfrog, Micromine, Surpac, Datamine, QGIS.</p>
   <div class="row" style="flex-wrap:wrap;align-items:flex-end">
    <div><label>Tabel</label><select id="ds">${keys.map((k) => `<option value="${k}" ${st.ds === k ? "selected" : ""}>${DATASETS[k].t}</option>`).join("")}</select></div>
    <div><label>BHID (sebagian)</label><input id="fb" value="${esc(st.bh)}" placeholder="mis. TGE00"></div>
    <div style="flex:0;white-space:nowrap"><label><input type="checkbox" id="fbad" ${st.bad ? "checked" : ""} style="width:auto"> hanya yang bermasalah</label></div>
    <button id="go" style="flex:0">Tampilkan</button>
    <button class="sec" id="xl" style="flex:0">Unduh Excel (semua tabel)</button>
    <button class="sec" id="csv" style="flex:0">Unduh CSV tabel ini</button>
   </div><div id="info" class="muted" style="margin-top:8px"></div></div>
   <div class="card"><div id="tb"></div><div class="row" style="margin-top:8px"><button class="sec" id="pv" style="flex:0">← Sebelumnya</button><button class="sec" id="nx" style="flex:0">Berikutnya →</button></div></div>`;
  const read = () => ({ ds: $("#ds").value, bh: $("#fb").value.trim().toUpperCase(), bad: $("#fbad").checked, page: st.page });
  const show = async (page = 0) => {
    const f = read(); f.page = page; sessionStorage.setItem("dbst", JSON.stringify(f)); st.page = page;
    const d = DATASETS[f.ds]; $("#tb").innerHTML = `<p class="muted">Memuat…</p>`;
    const { data, count, error } = await dbQuery(d, f).range(page * 200, page * 200 + 199);
    if (error) return ($("#tb").innerHTML = `<p class="err">${esc(error.message)}</p>`);
    $("#info").textContent = `${count ?? 0} baris · halaman ${page + 1} dari ${Math.max(1, Math.ceil((count ?? 0) / 200))}`;
    $("#pv").disabled = page === 0; $("#nx").disabled = (page + 1) * 200 >= (count ?? 0);
    if (!data?.length) return ($("#tb").innerHTML = `<p class="muted">Tidak ada data.</p>`);
    const cols = Object.keys(data[0]).filter((c) => !["data", "related"].includes(c));
    const canDel = me?.role === "admin" && d.del, canRes = me?.role === "admin" && f.ds === "arsip";
    const cell = (c, x) => { const s = x !== null && typeof x === "object" ? JSON.stringify(x) : x; const bad = c.startsWith("chk_") && x && !OKV.has(x); return `<td style="padding:4px 7px;white-space:nowrap;${bad ? "background:#F6C9C3" : ""}">${esc(s)}</td>`; };
    $("#tb").innerHTML = `<div class="tw"><table><tr>${canDel || canRes ? "<th></th>" : ""}${cols.map((c) => `<th style="padding:4px 7px">${esc(c)}</th>`).join("")}</tr>
      ${data.map((r) => `<tr>${canDel ? `<td><button class="danger" data-k="${esc(r[d.del[1]])}" style="padding:2px 8px">Hapus</button></td>` : ""}${canRes ? `<td>${r.restored_at ? "dipulihkan" : `<button class="sec" data-r="${r.id}" style="padding:2px 8px">Pulihkan</button>`}</td>` : ""}${cols.map((c) => cell(c, r[c])).join("")}</tr>`).join("")}</table></div>`;
    $("#tb").querySelectorAll("[data-k]").forEach((b) => (b.onclick = async () => { if (await adminDelete(d.del[0], b.dataset.k, "conto")) show(page); }));
    $("#tb").querySelectorAll("[data-r]").forEach((b) => (b.onclick = async () => { const { error } = await sb.rpc("admin_restore", { p_id: Number(b.dataset.r) }); if (error) alert(error.message); else show(page); }));
  };
  $("#go").onclick = () => show(0); $("#pv").onclick = () => show(st.page - 1); $("#nx").onclick = () => show(st.page + 1);
  $("#ds").onchange = () => show(0);
  const tag = () => { const f = read(); return `${f.bh ? f.bh + "_" : ""}${new Date().toISOString().slice(0, 10)}`; };
  $("#csv").onclick = async () => {
    const f = read(), d = DATASETS[f.ds]; $("#info").textContent = "Menyiapkan CSV…";
    try { const rows = await fetchAll(d, f); if (!rows.length) return ($("#info").textContent = "Tidak ada data.");
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
      for (const k of ["collar", "survey", "geology", "density", "assay", "qaqc", "foto"]) {
        const rows = (await fetchAll(DATASETS[k], { ...f, bad: false })).map((r) => { const o = { ...r }; delete o.data; delete o.related; return o; });
        X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), DATASETS[k].t.slice(0, 31).replace(/[\\/?*\[\]:]/g, " "));
      }
      X.writeFile(wb, `TGEP_Database_${tag()}.xlsx`); $("#info").textContent = "Excel diunduh (7 sheet).";
    } catch (e) { $("#info").textContent = e.message; }
  };
  show(st.page || 0);
}

// ---------- koreksi data tersimpan ----------
const EDITABLE = [...SHEET.filter(([k]) => k !== "seq" && k !== "geolithcode_prc_2"), ["geolithcode_prc_2", "%2"], ["d_wtr_volume_ml", "Vol1 ml"], ["d_dry_weight_gr", "Berat kering oven g"], ["recheck_weight_kg", "Timbang ulang kg"]];
async function editSample(no, done) {
  const ed = $("#ed"); ed.innerHTML = `<p class="muted">Memuat ${esc(no)}…</p>`;
  const [{ data: s }, { data: log }] = await Promise.all([
    sb.from("sample").select("*").eq("sample_no", no).single(),
    sb.from("sample_edit_log").select("field,old_value,new_value,reason,edited_at").eq("sample_no", no).order("edited_at", { ascending: false }),
  ]);
  ed.innerHTML = `<div class="card"><h3>Koreksi ${esc(no)}</h3><div class="tw"><table><tr>${EDITABLE.map(([, t]) => `<th>${t}</th>`).join("")}</tr>
    <tr>${EDITABLE.map(([k]) => `<td><input data-k="${k}" value="${esc(s?.[k] ?? "")}" inputmode="${NUMERIC.has(k) || k === "d_wtr_volume_ml" || k === "geolithcode_prc_2" ? "decimal" : "text"}"></td>`).join("")}</tr></table></div>
    <label>Alasan koreksi (wajib)</label><input id="rs" placeholder="mis. salah koma, dicek ulang di foto / hasil oven">
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
  const { data } = await sb.from("app_user").select("full_name,role").eq("user_id", session.user.id).maybeSingle();
  me = data ?? JSON.parse(localStorage.getItem("me") || "null");
  if (data) localStorage.setItem("me", JSON.stringify(data));
}
sb.auth.onAuthStateChange(async (_e, s) => { session = s; await loadMe(); render(); if (s) sync(); });
const { data: s0 } = await sb.auth.getSession(); session = s0.session; await loadMe(); render(); sync();
