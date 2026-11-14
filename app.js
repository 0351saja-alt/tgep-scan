// TGEP Scan Drill Log — aplikasi web untuk HP (bisa dipasang & dipakai offline)
import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const app = $("#app");
let session = null, me = null, tab = localStorage.getItem("tab") || "prog";

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
  if (syncing || !navigator.onLine || !session || session.offline) return;
  syncing = true;
  try {
    for (const it of await qAll()) {
      if (it.kind === "core") { await syncCore(it); continue; }
      if (it.kind === "event" || it.kind === "p2h") { await syncProg(it); continue; }
      if (it.kind === "ddr") { await syncDDR(it); continue; }
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
  } finally { syncing = false; if (["foto", "core", "prog", "ddr"].includes(tab)) render(); }
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
  if (!me) {
    app.innerHTML = `<div class="card"><h2>Menunggu persetujuan admin</h2><p>Akun <b>${esc(session.user.email)}</b> sudah terdaftar, tetapi belum disetujui admin TGEP. Coba masuk lagi setelah admin menyetujui.</p><p id="rq" class="muted"></p><button class="sec" id="out">Keluar</button></div>`;
    $("#out").onclick = () => { localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); sb.auth.signOut(); };
    sb.from("registration_request").select("status,decision_note,created_at").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
      if (data) $("#rq").textContent = data.status === "REJECTED" ? `Pendaftaran ditolak${data.decision_note ? ": " + data.decision_note : ""}.` : `Status: ${data.status === "PENDING" ? "menunggu" : data.status} · didaftarkan ${new Date(data.created_at).toLocaleString("id-ID")}`;
    });
    return;
  }
  const R = me?.role, staff = ["geologist", "verifier", "admin"].includes(R), ver = ["verifier", "admin"].includes(R);
  const navs = [["prog", "Progres bor"], ["ddr", "DDR"], ...(staff ? [["foto", "Foto formulir"], ["core", "Foto core"]] : []),
    ...(ver ? [["review", "Periksa scan"], ["data", "Data & cek"], ["db", "Database"], ["dash", "Dashboard"]] : []), ...(R === "admin" ? [["users", "Pengguna"]] : []), ["ttd", "TTD saya"]];
  if (!navs.some(([k]) => k === tab)) tab = "prog";
  const banner = session.offline ? `<div class="card" style="background:#FBE6D0">Mode offline — foto disimpan di HP dan dikirim otomatis saat ada sinyal.</div>` : "";
  app.innerHTML = banner + `<nav>${navs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}<button class="sec" id="out" style="flex:0">Keluar</button></nav><div id="v"></div>`;
  app.querySelectorAll("nav [data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; localStorage.setItem("tab", tab); render(); }));
  $("#out").onclick = async () => { if (!confirm("Keluar dari akun? Foto di antrean tetap tersimpan di HP.")) return; localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); session = null; await sb.auth.signOut().catch(() => {}); render(); };
  if (me?.role === "admin" && navigator.onLine && !session.offline) sb.from("registration_request").select("user_id", { count: "exact", head: true }).eq("status", "PENDING")
    .then(({ count }) => { const b = app.querySelector('nav [data-t="users"]'); if (b && count) b.textContent = `Pengguna (${count} baru)`; });
  document.querySelector("main").style.maxWidth = tab === "db" || tab === "dash" ? "none" : "";
  if (tab === "foto") return fotoView($("#v"));
  if (tab === "review") return reviewList($("#v"));
  if (tab === "data") return dataView($("#v"));
  if (tab === "core") return coreView($("#v"));
  if (tab === "db") return dbView($("#v"));
  if (tab === "prog") return progView($("#v"));
  if (tab === "users") return usersView($("#v"));
  if (tab === "ddr") return ddrView($("#v"));
  if (tab === "ttd") return ttdView($("#v"));
  if (tab === "dash") return dashView($("#v"));
}

function loginView() {
  const qp = new URLSearchParams(location.search);
  const after = qp.get("daftar") === "ok" ? `<div class="card" style="background:#DCEFE4"><b>Pendaftaran terkirim.</b> Akun Anda menunggu persetujuan admin TGEP. Setelah disetujui, masuk dengan email dan kata sandi yang Anda buat.</div>` : "";
  app.innerHTML = after + `<div class="card"><h2>Masuk</h2><p class="muted">Akun dibuat oleh admin. Setelah sekali masuk, aplikasi tetap bisa memotret saat offline.</p>
  <label>Email</label><input id="em" type="email" autocomplete="username"><label>Kata sandi</label><input id="pw" type="password" autocomplete="current-password">
  <div style="margin-top:12px"><button id="go">Masuk</button></div><div id="e" class="err"></div>
  <p class="muted" style="margin-top:12px">Belum punya akun? <a href="daftar.html">Daftar di sini</a> — akun aktif setelah disetujui admin.</p></div>`;
  if (qp.get("email")) $("#em").value = qp.get("email");
  $("#go").onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) $("#e").textContent = error.message;
  };
}

async function fotoView(v) {
  const lastB = localStorage.getItem("bhid") || "";
  const queue = (await qAll()).filter((x) => !x.kind);
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
  v.innerHTML = `<div class="card"><h2>Data tersimpan & hasil cek</h2><div class="row"><input id="bh" placeholder="BHID" value="${esc(localStorage.getItem("bhid") || "")}"><button id="go" style="flex:0">Tampilkan</button></div><div id="dout"></div></div>`;
  $("#go").onclick = async () => {
    const bh = $("#bh").value.trim().toUpperCase();
    const { data, error } = await sb.from("v_sample_qc").select("sample_no,sample_id,depth_from,depth_to,core_length,core_recovery,geozone_id,geolithcode_id_1,d_wet_density,d_wet_arch,d_dry_density,d_dry_arch,d_arch_diff_pct,d_moisture_pct,d_wet_weight,chk_interval,chk_recovery,chk_lith,chk_code,chk_zone,chk_density,chk_arch,chk_weight").eq("bhid", bh).order("depth_from");
    if (error) return ($("#dout").innerHTML = `<p class="err">${esc(error.message)}</p>`);
    const cols = data?.length ? Object.keys(data[0]) : [];
    const bad = (k, x) => k.startsWith("chk_") && x && !["OK", "OK-SW", "BELUM OVEN"].includes(x);
    $("#dout").innerHTML = data?.length ? `<p class="muted">Ketuk satu baris untuk mengoreksi atau menambah data (mis. berat kering oven). Setiap koreksi wajib alasan dan tercatat.</p><div class="tw" style="margin-top:10px"><table><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${data.map((r) => `<tr data-s="${esc(r.sample_no)}" style="cursor:pointer">${cols.map((c) => `<td style="padding:5px 7px;${bad(c, r[c]) ? "background:#F6C9C3" : ""}">${esc(r[c])}</td>`).join("")}</tr>`).join("")}</table></div><div id="ed"></div>` : `<p class="muted">Belum ada data untuk ${esc(bh)}.</p>`;
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

// ---------- progres pemboran (foto bergeotag) & P2H ----------
const EV = { MASUK: "Masuk shift", MULAI_BOR: "Mulai bor", RUN: "Angkat run (core)", GANTI_MATA_BOR: "Ganti mata bor", TAMBAH_STANG: "Tambah stang",
  STANDBY: "Standby", PERBAIKAN: "Perbaikan / kerusakan", SELESAI_BOR: "Selesai bor", PINDAH_TITIK: "Pindah titik", KELUAR: "Keluar shift", LAINNYA: "Lainnya" };
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
function modal(html) {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:flex;align-items:flex-end;justify-content:center";
  m.innerHTML = `<div class="card" style="width:min(560px,100%);max-height:92vh;overflow:auto;margin:0;border-radius:16px 16px 0 0">${html}</div>`;
  document.body.appendChild(m); return m;
}
async function progView(v) {
  const rig = localStorage.getItem("rig") || "", bh = localStorage.getItem("bhid") || "", shift = localStorage.getItem("shift") || "PAGI";
  const q = (await qAll()).filter((x) => x.kind === "event" || x.kind === "p2h");
  v.innerHTML = `<div class="card"><h2>Progres pemboran</h2>
   <div class="row"><div><label>Rig</label><input id="rg" value="${esc(rig)}" placeholder="mis. RIG-03" autocapitalize="characters"></div>
   <div><label>BHID</label><input id="pb" value="${esc(bh)}" autocapitalize="characters"></div>
   <div style="flex:0.7"><label>Shift</label><select id="sh"><option ${shift === "PAGI" ? "selected" : ""}>PAGI</option><option ${shift === "MALAM" ? "selected" : ""}>MALAM</option></select></div></div>
   <p class="muted">Setiap tombol membuka kamera. Koordinat GPS dan jam dicatat otomatis dan dicetak di foto. GPS tetap jalan tanpa sinyal internet.</p>
   <div class="big">
    <button data-ev="MASUK">Masuk shift<small>foto kru di lokasi</small></button>
    <button data-p2h="1" class="sec">P2H rig<small>wajib sebelum mulai bor</small></button>
    <button data-ev="MULAI_BOR">Mulai bor<small>foto rig di titik bor</small></button>
    <button data-ev="ACT">Foto aktivitas<small>angkat run · ganti mata bor · tambah stang · standby · lainnya</small></button>
    <button data-ev="SELESAI_BOR">Selesai bor / stop<small>foto akhir</small></button>
    <button data-ev="KELUAR" class="sec">Keluar shift</button>
   </div>
   <input id="pf" type="file" accept="image/*" capture="environment" class="hide"><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean progres di HP (${q.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${q.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.kind === "p2h" ? "P2H " + (x.row.layak_operasi ? "LAYAK" : "TIDAK LAYAK") : EV[x.row.event_type])} · ${esc(x.row.rig)} ${esc(x.row.bhid ?? "")}<br><span class="muted">${fmtT(x.row.captured_at)}${x.row.lat ? "" : " · tanpa GPS"}${x.error ? " · gagal: " + esc(x.error) : ""}</span></span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
   <div class="card"><h3>Hari ini (terkirim)</h3><div id="today" class="muted">${navigator.onLine && !session.offline ? "Memuat…" : "Offline — tampil saat ada sinyal."}</div></div>`;
  const keep = () => { localStorage.setItem("rig", $("#rg").value.trim().toUpperCase()); localStorage.setItem("bhid", $("#pb").value.trim().toUpperCase()); localStorage.setItem("shift", $("#sh").value); };
  let pending = null;
  v.querySelectorAll("[data-ev]").forEach((b) => (b.onclick = () => {
    keep(); if (!localStorage.getItem("rig")) return ($("#e").textContent = "Isi nama rig dulu.");
    if (b.dataset.ev !== "MASUK" && b.dataset.ev !== "KELUAR" && !localStorage.getItem("bhid")) return ($("#e").textContent = "Isi BHID dulu.");
    $("#e").textContent = ""; pending = b.dataset.ev; $("#pf").click();
  }));
  v.querySelector("[data-p2h]").onclick = () => { keep(); if (!localStorage.getItem("rig")) return ($("#e").textContent = "Isi nama rig dulu."); p2hForm(); };
  $("#pf").onchange = async (ev) => {
    const file = ev.target.files[0]; ev.target.value = ""; if (!file) return;
    const capturedAt = new Date(), age = Math.round((Date.now() - file.lastModified) / 1000);
    const posP = getPos();
    const r = { rig: localStorage.getItem("rig"), bhid: localStorage.getItem("bhid") || null };
    let lastTo = Number(localStorage.getItem(`lastTo_${r.bhid}`) || 0);
    const m = modal(`<h3>Konfirmasi foto</h3><p class="muted">${fmtT(capturedAt)} · ${esc(r.rig)} · ${esc(r.bhid ?? "")}</p>
      ${age > 300 ? `<p class="err">Foto ini dibuat ${Math.round(age / 60)} menit lalu — kemungkinan dari galeri, akan ditandai.</p>` : ""}
      <label>Foto ini untuk:</label>
      <div class="list" id="types">${(pending === "ACT" ? ["RUN", "GANTI_MATA_BOR", "TAMBAH_STANG", "STANDBY", "PERBAIKAN", "PINDAH_TITIK", "LAINNYA"] : [pending]).map((k, i) =>
        `<label style="display:flex;gap:8px;align-items:center;padding:8px 0"><input type="radio" name="et" value="${k}" ${i === 0 ? "checked" : ""} style="width:auto">${EV[k]}</label>`).join("")}</div>
      <div id="runf" class="row"><div><label>FROM (m)</label><input id="rf" inputmode="decimal" value="${fmtD(lastTo)}"></div><div><label>TO (m)</label><input id="rt" inputmode="decimal"></div><div><label>Core (m)</label><input id="rc" inputmode="decimal"></div></div>
      <div id="rsn"><label>Alasan / keterangan</label><input id="rn" placeholder="mis. mata bor aus, pompa rusak, hujan"></div>
      <p id="gps" class="muted">Mengambil GPS…</p>
      <div class="row" style="margin-top:10px"><button id="ok">Ya, simpan</button><button class="sec" id="cx">Batal</button></div><div id="me" class="err"></div>`);
    const tp = () => m.querySelector('input[name="et"]:checked').value;
    const upd = () => { const t = tp(); m.querySelector("#runf").style.display = t === "RUN" ? "" : "none"; m.querySelector("#ok").textContent = `Ya, simpan sebagai ${EV[t]}`; };
    m.querySelectorAll('input[name="et"]').forEach((x) => (x.onchange = upd)); upd();
    let pos = null; posP.then((p) => { pos = p; m.querySelector("#gps").textContent = p ? `GPS: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} (±${p.acc} m)` : "GPS tidak didapat — aktifkan Lokasi di HP. Foto tetap disimpan dan ditandai."; });
    m.querySelector("#cx").onclick = () => m.remove();
    m.querySelector("#ok").onclick = async () => {
      const t = tp(), num = (s) => (String(s).trim() === "" ? null : Number(String(s).replace(",", ".")));
      const row = { ...r, event_type: t, reason: m.querySelector("#rn").value || null, captured_at: capturedAt.toISOString(), photo_age_s: age };
      if (t === "RUN") {
        Object.assign(row, { depth_from: num(m.querySelector("#rf").value), depth_to: num(m.querySelector("#rt").value), core_length: num(m.querySelector("#rc").value) });
        if (!(row.depth_to > row.depth_from)) return (m.querySelector("#me").textContent = "Isi FROM dan TO run (TO > FROM).");
        if (row.core_length === null) return (m.querySelector("#me").textContent = "Isi panjang core yang terambil.");
      }
      m.querySelector("#ok").disabled = true;
      if (!pos) pos = await Promise.race([posP, new Promise((r2) => setTimeout(() => r2(null), 4000))]);
      if (pos) Object.assign(row, { lat: pos.lat, lon: pos.lon, gps_accuracy_m: pos.acc, gps_time: pos.t });
      const line2 = t === "RUN" ? `RUN ${fmtD(row.depth_from)}–${fmtD(row.depth_to)} m · core ${fmtD(row.core_length)} m` : EV[t] + (row.reason ? ` · ${row.reason}` : "");
      const blob = await stampPhoto(file, [`TGEP · ${r.rig} · ${r.bhid ?? "-"} · ${me?.full_name ?? ""}`, line2,
        `${fmtT(capturedAt)} WIB · ${pos ? `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)} ±${pos.acc} m` : "TANPA GPS"}`]);
      await qPut({ kind: "event", client_uuid: crypto.randomUUID(), row, blob });
      if (t === "RUN") localStorage.setItem(`lastTo_${r.bhid}`, row.depth_to);
      m.remove(); render(); sync();
    };
  };
  $("#sy").onclick = sync;
  if (navigator.onLine && !session.offline) {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const [{ data: evs }, { data: sum }] = await Promise.all([
      sb.from("v_drill_event_qc").select("event_type,bhid,depth_from,depth_to,core_length,captured_at,flags,photo_path,reason").eq("rig", localStorage.getItem("rig") || "-").eq("tanggal", day).order("captured_at"),
      sb.from("v_drill_progress_daily").select("bhid,meter_bor,jumlah_run,recovery_pct,standby_menit,jam_p2h,chk_harian").eq("rig", localStorage.getItem("rig") || "-").eq("tanggal", day),
    ]);
    $("#today").innerHTML = `${(sum ?? []).map((s) => `<p><b>${esc(s.bhid)}</b>: ${s.meter_bor} m · ${s.jumlah_run} run · recovery ${s.recovery_pct ?? "-"}% · standby ${s.standby_menit} mnt · P2H ${s.jam_p2h ? fmtT(s.jam_p2h).slice(-8) : "BELUM"}${s.chk_harian ? `<br><span class="err">${esc(s.chk_harian)}</span>` : ""}</p>`).join("")}
      <ul class="list">${(evs ?? []).map((x) => `<li><span style="flex:1">${fmtT(x.captured_at).slice(-8)} · <b>${esc(EV[x.event_type])}</b>${x.event_type === "RUN" ? ` ${fmtD(x.depth_from)}–${fmtD(x.depth_to)} m (core ${fmtD(x.core_length)})` : ""}${x.reason ? " · " + esc(x.reason) : ""}${x.flags ? `<br><span class="err">${esc(x.flags)}</span>` : ""}</span>${x.photo_path ? `<button class="sec" data-ph="${esc(x.photo_path)}" style="flex:0">Foto</button>` : ""}</li>`).join("") || `<li class="muted">Belum ada aktivitas terkirim hari ini untuk rig ini.</li>`}</ul><div id="phv"></div>`;
    $("#today").querySelectorAll("[data-ph]").forEach((b) => (b.onclick = async () => { const { data } = await sb.storage.from("progress-photos").createSignedUrl(b.dataset.ph, 600); $("#phv").innerHTML = `<img src="${data?.signedUrl ?? ""}" alt="Foto aktivitas bor" style="width:100%;border-radius:8px">`; }));
  }
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
    const file = ev.target.files[0]; if (!file) return;
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
async function usersView(v) {
  const { data: rq, error } = await sb.from("registration_request").select("*").order("created_at", { ascending: false });
  if (error) return (v.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const { data: au } = await sb.from("app_user").select("user_id,role");
  const roleOf = Object.fromEntries((au ?? []).map((x) => [x.user_id, x.role]));
  const pend = rq.filter((r) => r.status === "PENDING"), rest = rq.filter((r) => r.status !== "PENDING");
  const link = new URL("daftar.html", location.href).href;
  const opt = (sel) => ["driller", "geologist", "verifier", "admin"].map((r) => `<option ${r === sel ? "selected" : ""}>${r}</option>`).join("");
  const row = (r, pending) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(r.full_name)}</b> · ${esc(r.email)}<br><span class="muted">${esc(r.position ?? "")} · ${esc(r.company ?? "")} · ${esc(r.phone ?? "")}${r.reason ? " · " + esc(r.reason) : ""}<br>
      ${pending ? `minta: ${esc(r.requested_role)} · daftar ${new Date(r.created_at).toLocaleString("id-ID")}` : `status: ${roleOf[r.user_id] ? "AKTIF (" + roleOf[r.user_id] + ")" : r.status === "REJECTED" ? "DITOLAK/NONAKTIF" : r.status}${r.decision_note ? " · " + esc(r.decision_note) : ""}`}</span></span>
      <select data-role="${r.user_id}" style="flex:0;width:auto">${opt(roleOf[r.user_id] ?? r.requested_role)}</select>
      <button data-ok="${r.user_id}" style="flex:0">${pending ? "Setujui" : roleOf[r.user_id] ? "Ubah peran" : "Aktifkan"}</button>
      ${pending || roleOf[r.user_id] ? `<button class="danger" data-no="${r.user_id}" style="flex:0">${pending ? "Tolak" : "Nonaktifkan"}</button>` : ""}</li>`;
  v.innerHTML = `<div class="card"><h2>Pengguna</h2>
    <p>Link pendaftaran untuk dibagikan: <b>${esc(link)}</b> <button class="sec" id="cp" style="padding:4px 10px">Salin</button></p>
    <p class="muted">Pendaftar tidak bisa melihat atau mengirim data sampai disetujui. Periksa nama, perusahaan dan nomor HP sebelum menyetujui — email belum diverifikasi otomatis.</p></div>
    <div class="card"><h3>Menunggu persetujuan (${pend.length})</h3><ul class="list">${pend.map((r) => row(r, true)).join("") || `<li class="muted">Tidak ada.</li>`}</ul></div>
    <div class="card"><h3>Semua pengguna</h3><ul class="list">${rest.map((r) => row(r, false)).join("") || `<li class="muted">-</li>`}</ul></div>`;
  $("#cp").onclick = async () => { await navigator.clipboard?.writeText(link); $("#cp").textContent = "Tersalin"; };
  const act = async (uid, role) => {
    const note = role ? prompt("Catatan (opsional), mis. 'kru RIG-03':") ?? "" : prompt("Alasan menolak / menonaktifkan (wajib):");
    if (!role && !note) return;
    const { error } = await sb.rpc("admin_set_user", { p_user: uid, p_role: role, p_note: note || null });
    if (error) alert(error.message); else usersView(v);
  };
  v.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = () => act(b.dataset.ok, v.querySelector(`[data-role="${b.dataset.ok}"]`).value)));
  v.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => act(b.dataset.no, null)));
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
    <label>Gambar tanda tangan di kotak ini</label>
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
async function signDialog(slot) {
  const signers = await cached("signers", async () => (await sb.from("signature_profile").select("user_id,full_name,title")).data);
  return new Promise((resolve) => {
    const m = modal(`<h3>Tanda tangan ${SLOT_LABEL[slot]}${slot === "CLIENT" ? " (boleh menyusul)" : ""}</h3>
      <label>Nama</label><select id="sg"><option value="">— pilih —</option>${signers.map((s) => `<option value="${s.user_id}">${esc(s.full_name)}${s.title ? " · " + esc(s.title) : ""}</option>`).join("")}</select>
      <label>PIN 6 angka</label><input id="pin" type="password" inputmode="numeric" maxlength="6">
      <div class="row" style="margin-top:10px"><button id="okp">Tanda tangan dengan PIN</button></div>
      <p class="muted" style="margin:10px 0 4px">atau</p><div class="row"><button class="sec" id="qr">Scan kartu QR</button></div>
      <div id="cam"></div><div class="row" style="margin-top:10px"><button class="sec" id="skip">Nanti saja</button></div><div id="me" class="err"></div>
      ${signers.length ? "" : `<p class="err">Belum ada TTD terdaftar${online() ? "" : " di HP ini (buka menu DDR sekali saat online)"}.</p>`}`);
    let stream = null; const done = (r) => { stream?.getTracks().forEach((t) => t.stop()); m.remove(); resolve(r); };
    m.querySelector("#skip").onclick = () => done(null);
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

// ---------- DDR (Daily Drilling Report) ----------
const HOUR_CAT = [["DRILLING SYSTEM", ["CORING DRILLING", "OPEN HOLE DRILLING"]],
  ["WORKING", ["RIG SET UP/DOWN/PREPARATION", "HOLE CONDITION/CEMENTING", "REAMING, CASING, INSTALLING", "RUNNING/PULL UP/STUCK ROD", "HANDLING HOLE"]],
  ["ACTIVE/STANDBY", ["TRAVELLING CREW", "P2H+P5M", "DRILL SITE PREPARATION", "WEATHER/UNSAVE CONDITION", "WAITING WATER", "WAITING ACCESS", "SERVICE/MAINTENANCE", "GEOSERVICES/LOGGING"]]];
const SLOT_LABEL = { DRILLER: "Driller", WELLSITE: "Well site", CLIENT: "Client representative" };
const hm2min = (s) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s).trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const durMin = (a, b) => { const x = hm2min(a), y = hm2min(b); return x === null || y === null ? null : (y - x + 1440) % 1440; };
async function ddrView(v) {
  const items = await cached("ddrItems2", async () => (await sb.from("consumable_item").select("item,unit,kategori").eq("active", true).order("sort")).data);
  cached("signers", async () => (await sb.from("signature_profile").select("user_id,full_name,title")).data);
  const q = (await qAll()).filter((x) => x.kind === "ddr");
  const rig = localStorage.getItem("rig") || "", shift = localStorage.getItem("shift") || "PAGI", last = JSON.parse(localStorage.getItem("ddrLast") || "{}");
  const cats = [...new Set(items.map((i) => i.kategori))];
  v.innerHTML = `<div class="card"><h2>DAILY DRILLING REPORT</h2>
    <p class="muted">Urutan sama dengan formulir DDR kontraktor. Kolom * wajib. Pemakaian barang wajib diisi semua (0 bila tidak dipakai).</p>
    <div class="row"><div><label>PROJECT</label><input id="pj" value="${esc(last.project ?? "")}"></div><div><label>LOCATION</label><input id="lc" value="${esc(last.location ?? "")}"></div></div>
    <div class="row"><div><label>HOLE ID *</label><input id="bh" value="${esc(localStorage.getItem("bhid") || "")}" autocapitalize="characters"></div><div><label>RIG NO *</label><input id="rg" value="${esc(rig)}" autocapitalize="characters"></div><div><label>RIG TYPE</label><input id="rt" value="${esc(last.rig_type ?? "")}"></div></div>
    <div class="row"><div><label>DATE *</label><input id="dt" type="date" value="${todayWIB()}"></div><div><label>TIME *</label><select id="sh"><option value="PAGI" ${shift === "PAGI" ? "selected" : ""}>Day (06–18)</option><option value="MALAM" ${shift === "MALAM" ? "selected" : ""}>Night (18–06)</option></select></div><div><label>Kontraktor *</label><input id="ct" value="${esc(last.contractor ?? "")}"></div></div>
    <div class="row"><div><label>DRILLER *</label><input id="dn" value="${esc(last.driller_name ?? "")}"></div><div><label>ASSISTANT</label><input id="hp" value="${esc(last.helpers ?? "")}"></div><div style="flex:.5"><label>CREW *</label><input id="cc" inputmode="numeric" value="${esc(last.crew_count ?? "")}"></div></div>

    <h3>1. DRILLING</h3>
    <b>OPEN HOLE (m)</b><div id="oh"></div><button class="sec" id="ohAdd" style="width:auto">+ baris open hole</button>
    <p style="margin:10px 0 0"><b>CORING (m)</b> <span class="muted">Interval = To − From; Recovery = Core / Interval (dihitung otomatis)</span></p>
    <div id="cr"></div><div class="row"><button class="sec" id="crAdd" style="flex:0;white-space:nowrap">+ baris coring</button><button class="sec" id="crFoto" style="flex:0;white-space:nowrap">Isi dari foto RUN</button></div>

    <h3>2. HOURLY DISTRIBUTION</h3>
    <div id="hr"></div><button class="sec" id="hrAdd" style="width:auto">+ baris jam</button><div id="hrSum" class="muted" style="margin-top:6px"></div>

    <h3>3. ACCESSORIES AND CONSUMABLES</h3>
    <div class="tw"><table><tr><th>Barang</th><th>QTY</th><th>UNIT</th><th>Catatan</th></tr>${cats.map((k) => `<tr><th colspan="4" style="text-align:left">${esc(k)}</th></tr>` + items.map((it, i) => (it.kategori !== k ? "" : `<tr><td style="padding:4px 6px">${esc(it.item)}</td><td><input data-q="${i}" inputmode="decimal" style="width:80px"></td><td style="padding:4px 6px">${esc(it.unit)}</td><td><input data-n="${i}"></td></tr>`)).join("")).join("")}</table></div>
    <div class="row"><div><label>Jenis lubang</label><select id="ht"><option value="VERTICAL/HORIZONTAL">VERTICAL/HORIZONTAL</option><option value="INCLINE">INCLINE</option></select></div><div><label>ROD (m)</label><input id="rd" inputmode="decimal"></div></div>
    <div class="row"><div><label>TARGET (m)</label><input id="tg" inputmode="decimal" value="${esc(last.target_m ?? "")}"></div><div><label>TOTAL DEPTH (m)</label><input id="td" inputmode="decimal"></div></div>
    <div class="row"><div><label>HM awal</label><input id="h1" inputmode="decimal"></div><div><label>HM akhir</label><input id="h2" inputmode="decimal"></div><div><label>Cuaca</label><select id="wx"><option>Cerah</option><option>Berawan</option><option>Hujan</option><option>Hujan lebat</option></select></div></div>

    <h3>4. COMMENTS</h3><textarea id="nt" rows="2"></textarea>
    <h3>5. SIGNATURE</h3><p class="muted">Setelah disimpan: Driller → Well site → Client representative (boleh menyusul). DDR LENGKAP bila Driller dan Well site sudah sah.</p>
    <div style="margin-top:10px"><button id="sv">Simpan DDR & tanda tangan</button></div><div id="e" class="err"></div></div>
    <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean DDR di HP (${q.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
    <ul class="list">${q.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.row.rig)} · ${esc(x.row.report_date)} · ${esc(x.row.shift)} · TTD ${x.signs.length}${x.error ? `<br><span class="err">${esc(x.error)}</span>` : ""}</span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
    <div class="card"><h3>DDR terkirim</h3><div id="lst" class="muted">${online() ? "Memuat…" : "Offline."}</div></div>`;
  const num = (s) => (String(s ?? "").trim() === "" ? null : Number(String(s).replace(",", ".")));
  const addRow = (box, html) => { const d = document.createElement("div"); d.className = "row"; d.style.alignItems = "center"; d.innerHTML = html + `<button class="sec" style="flex:0" title="hapus">✕</button>`; d.lastChild.onclick = () => { d.remove(); hrSum(); }; $(box).appendChild(d); return d; };
  const ohRow = (o = {}) => addRow("#oh", `<input placeholder="From" inputmode="decimal" value="${o.from ?? ""}"><input placeholder="To" inputmode="decimal" value="${o.to ?? ""}">`);
  const crRow = (o = {}) => addRow("#cr", `<input placeholder="From" inputmode="decimal" value="${o.from ?? ""}"><input placeholder="To" inputmode="decimal" value="${o.to ?? ""}"><input placeholder="Core (m)" inputmode="decimal" value="${o.core ?? ""}"><input placeholder="Remark" value="${esc(o.remark ?? "")}">`);
  const hrRow = (o = {}) => { const d = addRow("#hr", `<input placeholder="Mulai 06:00" inputmode="numeric" value="${o.mulai ?? ""}" style="max-width:90px"><input placeholder="Selesai" inputmode="numeric" value="${o.selesai ?? ""}" style="max-width:90px"><select>${HOUR_CAT.map(([g, xs]) => `<optgroup label="${g}">${xs.map((c) => `<option ${c === o.kategori ? "selected" : ""}>${c}</option>`).join("")}</optgroup>`).join("")}</select><input placeholder="Description">`); d.querySelectorAll("input,select").forEach((el) => (el.oninput = hrSum)); return d; };
  const hrSum = () => { let t = 0, bad = 0; $("#hr").querySelectorAll(".row").forEach((r) => { const [a, b] = r.querySelectorAll("input"); const m = durMin(a.value, b.value); if (m === null) bad++; else t += m; }); $("#hrSum").innerHTML = `TOTAL HOURS: <b>${(t / 60).toFixed(2)} jam</b>${t > 720 ? ` <span class="err">— lebih dari 12 jam satu shift</span>` : ""}${bad ? ` <span class="err">— ${bad} baris jam belum benar (format 06:30)</span>` : ""}`; };
  $("#ohAdd").onclick = () => ohRow(); $("#crAdd").onclick = () => crRow(); $("#hrAdd").onclick = () => hrRow();
  ohRow(); crRow(); hrRow({ mulai: shift === "PAGI" ? "06:00" : "18:00", kategori: "P2H+P5M" }); hrSum();
  $("#crFoto").onclick = async () => {
    const r = $("#rg").value.trim().toUpperCase(), [a, b] = shiftWindow($("#dt").value, $("#sh").value);
    let ev = (await qAll()).filter((x) => x.kind === "event" && x.row?.event_type === "RUN" && x.row.rig === r && x.row.captured_at >= a && x.row.captured_at < b).map((x) => x.row);
    if (online()) { const { data } = await sb.from("v_drill_event_qc").select("depth_from,depth_to,core_length,captured_at").eq("rig", r).eq("event_type", "RUN").gte("captured_at", a).lt("captured_at", b); ev = ev.concat(data ?? []); }
    ev = [...new Map(ev.map((e) => [`${e.depth_from}|${e.depth_to}`, e])).values()].sort((x, y) => x.depth_from - y.depth_from);
    if (!ev.length) return alert("Belum ada foto RUN untuk rig dan shift ini.");
    $("#cr").innerHTML = ""; ev.forEach((e) => crRow({ from: e.depth_from, to: e.depth_to, core: e.core_length }));
  };
  $("#sv").onclick = async () => {
    const val = (id) => $(id).value.trim();
    const rows = (box) => [...$(box).querySelectorAll(".row")].map((r) => [...r.querySelectorAll("input,select")].map((x) => x.value.trim()));
    const open_hole = rows("#oh").filter((x) => x[0] || x[1]).map(([f, t]) => ({ from: num(f), to: num(t) }));
    const coring = rows("#cr").filter((x) => x[0] || x[1]).map(([f, t, c, rm]) => ({ from: num(f), to: num(t), core: num(c), remark: rm || null }));
    const hours = rows("#hr").filter((x) => x[0] || x[1]).map(([m, s, k, d]) => ({ mulai: m.replace(".", ":"), selesai: s.replace(".", ":"), kategori: k, ket: d || null }));
    const row = { project: val("#pj") || null, location: val("#lc") || null, rig: val("#rg").toUpperCase(), rig_type: val("#rt") || null, report_date: val("#dt"), shift: $("#sh").value,
      bhid: val("#bh").toUpperCase() || null, contractor: val("#ct"), driller_name: val("#dn"), helpers: val("#hp") || null, crew_count: num(val("#cc")),
      hm_start: num(val("#h1")), hm_end: num(val("#h2")), weather: $("#wx").value, notes: val("#nt") || null, hole_type: $("#ht").value, rod_m: num(val("#rd")),
      target_m: num(val("#tg")), total_depth_m: num(val("#td")), open_hole, coring, hours, captured_at: new Date().toISOString() };
    const miss = ["bhid", "rig", "report_date", "contractor", "driller_name", "crew_count"].filter((k) => row[k] === null || row[k] === "");
    if (miss.length) return ($("#e").textContent = "Lengkapi kolom bertanda * (" + miss.join(", ") + ").");
    if ([...open_hole, ...coring].some((x) => !(x.to > x.from))) return ($("#e").textContent = "Setiap baris open hole/coring harus To > From.");
    if (coring.some((x) => x.core === null || x.core < 0 || x.core > (x.to - x.from) * 1.05)) return ($("#e").textContent = "Core length kosong atau lebih panjang dari interval run.");
    if (hours.some((h) => durMin(h.mulai, h.selesai) === null)) return ($("#e").textContent = "Format jam di distribusi jam harus 06:30.");
    if (!hours.length) return ($("#e").textContent = "Isi minimal satu baris HOURLY DISTRIBUTION.");
    if (row.hm_start !== null && row.hm_end !== null && row.hm_end < row.hm_start) return ($("#e").textContent = "HM akhir lebih kecil dari HM awal.");
    const cons = items.map((it, i) => ({ ...it, qty: num(v.querySelector(`[data-q="${i}"]`).value), note: v.querySelector(`[data-n="${i}"]`).value.trim() || null }));
    const kosong = cons.filter((c) => c.qty === null || !isFinite(c.qty));
    if (kosong.length) return ($("#e").textContent = `Isi QTY (0 bila tidak dipakai): ${kosong.map((c) => c.item).join(", ")}`);
    row.consumables = cons;
    const tot = hours.reduce((s, h) => s + durMin(h.mulai, h.selesai), 0);
    if (tot > 720 && !confirm(`Total jam ${(tot / 60).toFixed(1)} > 12 jam. Tetap simpan?`)) return;
    localStorage.setItem("ddrLast", JSON.stringify({ contractor: row.contractor, driller_name: row.driller_name, crew_count: row.crew_count, helpers: row.helpers, project: row.project, location: row.location, rig_type: row.rig_type, target_m: row.target_m }));
    localStorage.setItem("rig", row.rig); localStorage.setItem("shift", row.shift); localStorage.setItem("bhid", row.bhid);
    const signs = [];
    for (const slot of ["DRILLER", "WELLSITE", "CLIENT"]) { const s = await signDialog(slot); if (s) signs.push(s); }
    await qPut({ kind: "ddr", client_uuid: crypto.randomUUID(), row, signs });
    alert(`DDR disimpan dengan ${signs.length} tanda tangan.${signs.length < 2 ? " Yang kurang bisa dilengkapi dari daftar DDR setelah terkirim." : ""}`);
    render(); sync();
  };
  $("#sy").onclick = sync;
  if (online()) {
    const { data } = await sb.from("v_ddr_list").select("id,report_date,shift,rig,bhid,status,meter_bor,coring_ddr_m,selisih_ddr_vs_foto_m,bbm_liter,bbm_per_meter,ttd").order("report_date", { ascending: false }).limit(30);
    $("#lst").innerHTML = `<ul class="list">${(data ?? []).map((d) => `<li style="flex-wrap:wrap"><span class="pill ${d.status === "SIGNED" ? "APPROVED" : "NEEDS_REVIEW"}">${d.status === "SIGNED" ? "LENGKAP" : "DRAF"}</span>
      <span style="flex:1">${esc(d.report_date)} · ${d.shift === "PAGI" ? "Day" : "Night"} · <b>${esc(d.rig)}</b> ${esc(d.bhid ?? "")}<br><span class="muted">Coring DDR ${d.coring_ddr_m ?? 0} m · foto RUN ${d.meter_bor ?? 0} m${Math.abs(d.selisih_ddr_vs_foto_m ?? 0) > 0.1 ? ` <span class="err">(selisih ${d.selisih_ddr_vs_foto_m} m)</span>` : ""} · Diesel ${d.bbm_liter} L${d.bbm_per_meter ? ` (${d.bbm_per_meter} L/m)` : ""}<br>${esc(d.ttd ?? "belum ada TTD")}</span></span>
      ${!/CLIENT/.test(d.ttd ?? "") ? `<button class="sec" data-sg="${d.id}" style="flex:0">Tanda tangani</button>` : ""}<button class="sec" data-pr="${d.id}" style="flex:0">Lihat / cetak</button></li>`).join("") || `<li class="muted">Belum ada.</li>`}</ul>`;
    $("#lst").querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.pr)));
    $("#lst").querySelectorAll("[data-sg]").forEach((b) => (b.onclick = async () => {
      const { data: sg } = await sb.from("ddr_signature").select("slot").eq("ddr_id", b.dataset.sg);
      const have = new Set((sg ?? []).map((x) => x.slot));
      for (const slot of ["DRILLER", "WELLSITE", "CLIENT"].filter((s) => !have.has(s))) {
        const s = await signDialog(slot); if (!s) continue;
        const { error } = await sb.rpc("sign_ddr", { p_ddr: b.dataset.sg, p_slot: slot, p_signer: s.signer_id, p_method: s.method, p_proof: s.proof, p_signed_at: s.signed_at });
        if (error) alert(`${SLOT_LABEL[slot]}: ${error.message}`);
      }
      render();
    }));
  }
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
    const { error } = await sb.rpc("sign_ddr", { p_ddr: d.id, p_slot: s.slot, p_signer: s.signer_id, p_method: s.method, p_proof: s.proof, p_signed_at: s.signed_at });
    if (error && !/sudah ditandatangani|sudah lengkap/.test(error.message)) errs.push(`${s.slot} (${s.name}): ${error.message}`);
  }
  await qDel(it.client_uuid);
  if (errs.length) alert(`DDR ${it.row.rig} ${it.row.report_date} ${it.row.shift} terkirim, tetapi tanda tangan gagal:\n${errs.join("\n")}\nUlangi dari daftar DDR → Tanda tangani.`);
}
async function printDDR(id) {
  const w = window.open("", "_blank"); if (!w) return alert("Izinkan pop-up untuk mencetak.");
  w.document.write("<p>Memuat DDR…</p>");
  const { data: d } = await sb.from("ddr").select("*").eq("id", id).single();
  const { data: sg } = await sb.from("ddr_signature").select("*").eq("ddr_id", id);
  const [a, b] = shiftWindow(d.report_date, d.shift);
  const { data: ev } = await sb.from("v_drill_event_qc").select("*").eq("rig", d.rig).gte("captured_at", a).lt("captured_at", b).order("captured_at");
  const ph = await signedUrls("progress-photos", (ev ?? []).map((e) => e.photo_path)), tt = await signedUrls("signatures", (sg ?? []).map((s) => s.signature_path));
  const S = d.summary ?? {}, T = (x) => (x ? fmtT(x) : "-"), f2 = (x) => (x == null ? "" : Number(x).toFixed(2));
  const sigBox = (k) => { const s = (sg ?? []).find((x) => x.slot === k); return `<td style="width:33%;vertical-align:top;height:120px"><b>${k === "WELLSITE" ? "WELL SITE" : k === "CLIENT" ? "CLIENT REPRESENTATIVE" : "DRILLER"}</b><br>${s ? `<img src="${tt[s.signature_path] ?? ""}" style="height:60px"><br>${esc(s.signer_name)}<br><small>${T(s.signed_at)} WIB · ${s.method} · verifikasi server ${T(s.verified_at)}</small>` : "<br><br><i>belum ditandatangani</i>"}</td>`; };
  const cor = d.coring ?? [], oh = d.open_hole ?? [], hrs = d.hours ?? [];
  const sumI = (xs) => xs.reduce((s, x) => s + (x.to - x.from), 0), sumC = cor.reduce((s, x) => s + (Number(x.core) || 0), 0);
  const totMin = hrs.reduce((s, h) => s + (durMin(h.mulai, h.selesai) ?? 0), 0);
  const cons = d.consumables ?? [], cats = [...new Set(cons.map((c) => c.kategori))];
  w.document.open(); w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>DDR ${esc(d.rig)} ${esc(d.report_date)} ${d.shift === "PAGI" ? "Day" : "Night"}</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#111} h1{font-size:17px;margin:0} h3{margin:10px 0 2px;font-size:12px} table{border-collapse:collapse;width:100%;margin:4px 0} td,th{border:1px solid #888;padding:3px 5px;text-align:left} th{background:#e6efe9}
  .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px} .g img{width:100%;border:1px solid #ccc} .two{display:grid;grid-template-columns:1fr 1fr;gap:10px} @media print{button{display:none}}</style></head><body>
  <button onclick="print()">Cetak / simpan PDF</button>
  <h1>DAILY DRILLING REPORT</h1><div>${esc(d.contractor ?? "")} · status: <b>${d.status === "SIGNED" ? "LENGKAP DITANDATANGANI" : "DRAF"}</b></div>
  <table><tr><th>PROJECT</th><td>${esc(d.project ?? "")}</td><th>DATE</th><td>${esc(d.report_date)}</td><th>DRILLER</th><td>${esc(d.driller_name ?? "")}</td></tr>
  <tr><th>LOCATION</th><td>${esc(d.location ?? "")}</td><th>TIME</th><td>${d.shift === "PAGI" ? "Day" : "Night"}</td><th>ASSISTANT</th><td>${esc(d.helpers ?? "")}</td></tr>
  <tr><th>HOLE ID</th><td>${esc(d.bhid ?? "")}</td><th>RIG NO</th><td>${esc(d.rig)}</td><th>CREW</th><td>${d.crew_count ?? ""}</td></tr>
  <tr><th>RIG TYPE</th><td>${esc(d.rig_type ?? "")}</td><th>HM</th><td>${d.hm_start ?? ""} – ${d.hm_end ?? ""}</td><th>Cuaca</th><td>${esc(d.weather ?? "")}</td></tr></table>
  <h3>1. DRILLING</h3><div class="two"><table><tr><th colspan="3">OPEN HOLE (m)</th></tr><tr><th>From</th><th>To</th><th>Interval</th></tr>${oh.map((x) => `<tr><td>${f2(x.from)}</td><td>${f2(x.to)}</td><td>${f2(x.to - x.from)}</td></tr>`).join("")}<tr><th colspan="2">Total</th><th>${f2(sumI(oh))}</th></tr></table>
  <table><tr><th colspan="6">CORING (m) / CORE RESULT</th></tr><tr><th>From</th><th>To</th><th>Interval</th><th>Length</th><th>Recovery</th><th>REMARK</th></tr>${cor.map((x) => `<tr><td>${f2(x.from)}</td><td>${f2(x.to)}</td><td>${f2(x.to - x.from)}</td><td>${f2(x.core)}</td><td>${x.to > x.from ? Math.round((100 * x.core) / (x.to - x.from)) + "%" : ""}</td><td>${esc(x.remark ?? "")}</td></tr>`).join("")}
  <tr><th colspan="2">Total</th><th>${f2(sumI(cor))}</th><th>${f2(sumC)}</th><th>${sumI(cor) ? Math.round((100 * sumC) / sumI(cor)) + "%" : ""}</th><th></th></tr></table></div>
  <p>Cek silang foto RUN aplikasi: ${S.jumlah_run ?? 0} run · ${S.meter_bor ?? 0} m · core ${S.core_m ?? 0} m${Math.abs(sumI(cor) - (S.meter_bor ?? 0)) > 0.1 ? ` — <b style="color:#b00">selisih ${f2(sumI(cor) - (S.meter_bor ?? 0))} m dengan tulisan DDR</b>` : " — sesuai"}</p>
  <h3>2. HOURLY DISTRIBUTION</h3><table><tr><th>Kelompok</th><th>Kegiatan</th><th>TIME</th><th>DESCRIPTION</th><th>TOTAL (jam)</th></tr>${HOUR_CAT.map(([g, xs]) => xs.map((c) => { const r = hrs.filter((h) => h.kategori === c); const m = r.reduce((s, h) => s + (durMin(h.mulai, h.selesai) ?? 0), 0); return `<tr><td>${g}</td><td>${c}</td><td>${r.map((h) => `${h.mulai}–${h.selesai}`).join(", ")}</td><td>${esc(r.map((h) => h.ket).filter(Boolean).join("; "))}</td><td>${m ? (m / 60).toFixed(2) : ""}</td></tr>`; }).join("")).join("")}<tr><th colspan="4">TOTAL HOURS</th><th>${(totMin / 60).toFixed(2)}</th></tr></table>
  <h3>3. ACCESSORIES AND CONSUMABLES</h3><table><tr><th>Item</th><th>QTY</th><th>UNIT</th><th>Catatan</th></tr>${cats.map((k) => `<tr><th colspan="4">${esc(k)}</th></tr>` + cons.filter((c) => c.kategori === k).map((c) => `<tr><td>${esc(c.item)}</td><td>${c.qty}</td><td>${esc(c.unit)}</td><td>${esc(c.note ?? "")}</td></tr>`).join("")).join("")}</table>
  <table><tr><th>${esc(d.hole_type ?? "")}</th><th>ROD</th><td>${d.rod_m ?? ""} m</td><th>TARGET</th><td>${d.target_m ?? ""} m</td><th>TOTAL DEPTH</th><td>${d.total_depth_m ?? ""} m</td><th>TOTAL HOURS</th><td>${(totMin / 60).toFixed(2)} hours</td></tr></table>
  <h3>4. COMMENTS</h3><p>${esc(d.notes ?? "-")}</p>
  <h3>5. SIGNATURE</h3><table><tr>${sigBox("DRILLER")}${sigBox("WELLSITE")}${sigBox("CLIENT")}</tr></table>
  <h3>Lampiran: foto aktivitas bergeotag</h3><table><tr><th>Jam</th><th>Kegiatan</th><th>Kedalaman</th><th>Koordinat</th><th>Catatan cek</th></tr>${(ev ?? []).map((e) => `<tr><td>${T(e.captured_at).slice(-8)}</td><td>${esc(EV[e.event_type])}${e.reason ? " · " + esc(e.reason) : ""}</td><td>${e.event_type === "RUN" ? `${e.depth_from}–${e.depth_to} (core ${e.core_length})` : ""}</td><td>${e.lat ? `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)} ±${e.gps_accuracy_m}m` : "-"}</td><td>${esc(e.flags ?? "")}</td></tr>`).join("")}</table>
  <div class="g">${(ev ?? []).filter((e) => e.photo_path).map((e) => `<div><img src="${ph[e.photo_path] ?? ""}"><br><small>${T(e.captured_at).slice(-8)} · ${esc(EV[e.event_type])}</small></div>`).join("")}</div>
  <small>Dokumen elektronik database TGEP · ID ${d.id} · dibuat ${T(d.created_at)} WIB.</small></body></html>`);
  w.document.close();
}

// ---------- Dashboard ----------
async function dashView(v) {
  const to = todayWIB(), from = new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const st = JSON.parse(sessionStorage.getItem("dash") || "null") ?? { from, to, rig: "" };
  v.innerHTML = `<div class="card"><h2>Dashboard progres & evaluasi</h2>
    <div class="row" style="flex-wrap:wrap;align-items:flex-end"><div><label>Dari</label><input id="f" type="date" value="${st.from}"></div><div><label>Sampai</label><input id="t" type="date" value="${st.to}"></div>
    <div><label>Rig</label><input id="r" value="${esc(st.rig)}" placeholder="semua"></div><button id="go" style="flex:0">Tampilkan</button><button class="sec" id="pr" style="flex:0">Cetak / PDF</button></div></div>
    <div id="kpi" class="card"></div><div id="ch" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px"></div>`;
  $("#pr").onclick = () => print();
  $("#go").onclick = () => { sessionStorage.setItem("dash", JSON.stringify({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase() })); dashView(v); };
  if (!online()) return ($("#kpi").textContent = "Dashboard perlu sinyal internet.");
  const R = (q) => (st.rig ? q.eq("rig", st.rig) : q);
  const [{ data: rd }, { data: tm }, { data: cu }, { data: hl }] = await Promise.all([
    R(sb.from("v_dash_rig_day").select("*").gte("tanggal", st.from).lte("tanggal", st.to)).order("tanggal"),
    R(sb.from("v_dash_time").select("*").gte("tanggal", st.from).lte("tanggal", st.to)),
    R(sb.from("v_consumable_use").select("*").gte("report_date", st.from).lte("report_date", st.to)),
    sb.from("v_dash_hole").select("*"),
  ]);
  const days = rd ?? [], holes = (hl ?? []).filter((h) => h.jumlah_conto > 0), K = computeKPI(days, tm ?? [], cu ?? [], holes);
  $("#kpi").innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">${K.map(([l, val, note]) => `<div style="background:#fff;border-radius:10px;padding:10px;border-left:5px solid ${note === "!" ? "#C8281F" : "#1E9E69"}"><div class="muted" style="font-size:12px">${esc(l)}</div><div style="font-size:22px;font-weight:700">${esc(val)}</div></div>`).join("")}</div>
    <p class="muted" style="margin-top:8px">Periode ${st.from} s/d ${st.to}${st.rig ? " · rig " + esc(st.rig) : " · semua rig"}. Data geologi (tebal zona, conto) mencakup semua lubang yang sudah disetujui.</p>`;
  const { Chart } = await import("./vendor/chart.js");
  const box = (id, title) => { const d = document.createElement("div"); d.className = "card"; d.innerHTML = `<h3 style="margin:0 0 6px">${title}</h3><canvas id="${id}" height="230"></canvas>`; $("#ch").appendChild(d); return d.querySelector("canvas"); };
  const pal = ["#1E9E69", "#E8892B", "#2F6FB0", "#C8281F", "#8E5BB5", "#7A8B83", "#D4B12A", "#12251E", "#57B8C9", "#B5651D"];
  const by = (xs, kf, vf) => xs.reduce((m, x) => ((m[kf(x)] = (m[kf(x)] ?? 0) + (Number(vf(x)) || 0)), m), {});
  const hist = (vals, edges) => edges.slice(0, -1).map((e, i) => vals.filter((x) => x >= e && (i === edges.length - 2 ? x <= edges[i + 1] : x < edges[i + 1])).length);
  const rigs = [...new Set(days.map((d) => d.rig))], dates = [...new Set(days.map((d) => d.tanggal))];
  let cum = 0; const cumv = dates.map((t) => (cum += days.filter((d) => d.tanggal === t).reduce((s, d) => s + Number(d.meter_bor), 0)));
  new Chart(box("c1", "Meter bor per hari (per rig) & kumulatif"), { data: { labels: dates, datasets: [...rigs.map((r, i) => ({ type: "bar", label: r, stack: "m", data: dates.map((t) => days.filter((d) => d.tanggal === t && d.rig === r).reduce((s, d) => s + Number(d.meter_bor), 0)), backgroundColor: pal[i % 10] })),
    { type: "line", label: "Kumulatif", data: cumv, yAxisID: "y2", borderColor: "#12251E", pointRadius: 0 }] }, options: { scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "m/hari" } }, y2: { position: "right", grid: { display: false }, title: { display: true, text: "kumulatif m" } } } } });
  const mr = by(days, (d) => d.rig, (d) => d.meter_bor), jr = by(days, (d) => d.rig, (d) => d.jam_kerja_bor);
  new Chart(box("c2", "Meter per rig & produktivitas (m/jam)"), { data: { labels: Object.keys(mr), datasets: [{ type: "bar", label: "Meter", data: Object.values(mr), backgroundColor: "#1E9E69" }, { type: "line", label: "m/jam", data: Object.keys(mr).map((r) => (jr[r] ? +(mr[r] / jr[r]).toFixed(2) : null)), yAxisID: "y2", borderColor: "#E8892B" }] }, options: { scales: { y2: { position: "right", grid: { display: false } } } } });
  const tk = by(tm ?? [], (x) => x.kegiatan, (x) => x.menit);
  new Chart(box("c3", "Pembagian waktu kerja (menit)"), { type: "pie", data: { labels: Object.keys(tk), datasets: [{ data: Object.values(tk), backgroundColor: pal }] } });
  const sb2 = by((tm ?? []).filter((x) => ["Standby", "Perbaikan"].includes(x.kegiatan)), (x) => `${x.kegiatan}: ${x.alasan}`, (x) => x.menit);
  new Chart(box("c4", "Penyebab standby & perbaikan (menit)"), { type: "pie", data: { labels: Object.keys(sb2).length ? Object.keys(sb2) : ["(tidak ada)"], datasets: [{ data: Object.keys(sb2).length ? Object.values(sb2) : [1], backgroundColor: pal }] } });
  const br = by(days, (d) => d.rig, (d) => d.bbm_liter);
  new Chart(box("c5", "BBM per rig: total (L) & per meter (L/m)"), { data: { labels: Object.keys(br), datasets: [{ type: "bar", label: "BBM (L)", data: Object.values(br), backgroundColor: "#2F6FB0" }, { type: "line", label: "L/m", data: Object.keys(br).map((r) => (mr[r] ? +(br[r] / mr[r]).toFixed(2) : null)), yAxisID: "y2", borderColor: "#C8281F" }] }, options: { scales: { y2: { position: "right", grid: { display: false } } } } });
  const lq = by((cu ?? []).filter((c) => c.unit === "liter"), (c) => c.item, (c) => c.qty);
  new Chart(box("c6", "Pemakaian cairan (liter) per jenis"), { type: "pie", data: { labels: Object.keys(lq).length ? Object.keys(lq) : ["(belum ada DDR)"], datasets: [{ data: Object.keys(lq).length ? Object.values(lq) : [1], backgroundColor: pal }] } });
  const { data: dh } = await R(sb.from("v_ddr_hours").select("kategori,kelompok,menit").gte("tanggal", st.from).lte("tanggal", st.to));
  const hk = by(dh ?? [], (x) => x.kategori, (x) => x.menit), hg = by(dh ?? [], (x) => x.kelompok, (x) => x.menit);
  new Chart(box("c11", "Distribusi jam DDR per kegiatan (jam)"), { type: "bar", data: { labels: Object.keys(hk).length ? Object.keys(hk) : ["(belum ada DDR)"], datasets: [{ label: "jam", data: Object.values(hk).map((m) => +(m / 60).toFixed(2)), backgroundColor: "#2F6FB0" }] }, options: { indexAxis: "y" } });
  new Chart(box("c12", "Drilling / Working / Standby (DDR)"), { type: "pie", data: { labels: Object.keys(hg).length ? Object.keys(hg) : ["(belum ada DDR)"], datasets: [{ data: Object.keys(hg).length ? Object.values(hg) : [1], backgroundColor: ["#1E9E69", "#E8892B", "#C8281F"] }] } });
  const ed = [0, 2, 4, 6, 8, 10, 12, 15, 20, 30], lab = ed.slice(0, -1).map((e, i) => `${e}–${ed[i + 1]} m`);
  new Chart(box("c7", "Histogram tebal zona per lubang"), { type: "bar", data: { labels: lab, datasets: [{ label: "Limonit", data: hist(holes.map((h) => Number(h.tebal_limonit)), ed), backgroundColor: "#E8892B" }, { label: "Saprolit", data: hist(holes.map((h) => Number(h.tebal_saprolit)), ed), backgroundColor: "#1E9E69" }] }, options: { scales: { y: { title: { display: true, text: "jumlah lubang" } } } } });
  const nl = holes.reduce((s, h) => s + h.conto_limonit, 0), ns = holes.reduce((s, h) => s + h.conto_saprolit, 0), nt = holes.reduce((s, h) => s + h.jumlah_conto, 0);
  new Chart(box("c8", "Jumlah conto per zona"), { type: "pie", data: { labels: ["Limonit", "Saprolit", "TP / batuan dasar"], datasets: [{ data: [nl, ns, nt - nl - ns], backgroundColor: ["#E8892B", "#1E9E69", "#7A8B83"] }] } });
  const re = [0, 50, 70, 80, 90, 95, 100.01];
  new Chart(box("c9", "Histogram recovery per lubang (%)"), { type: "bar", data: { labels: ["<50", "50–70", "70–80", "80–90", "90–95", "95–100"], datasets: [{ label: "lubang", data: hist(holes.map((h) => Number(h.recovery_pct)).filter(isFinite), re), backgroundColor: ["#C8281F", "#C8281F", "#E8892B", "#D4B12A", "#1E9E69", "#1E9E69"] }] } });
  const avg = (k) => { const xs = holes.map((h) => Number(h[k])).filter((x) => isFinite(x) && x > 0); return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null; };
  new Chart(box("c10", "Rata-rata density kering per zona (t/m³)"), { type: "bar", data: { labels: ["Limonit", "Saprolit"], datasets: [{ label: "dry density", data: [avg("dry_density_limonit"), avg("dry_density_saprolit")], backgroundColor: ["#E8892B", "#1E9E69"] }] } });
}
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
  jam: { t: "Distribusi jam DDR", v: "v_ddr_hours", order: ["tanggal", "rig"], bh: "bhid" },
  bbm: { t: "Pemakaian BBM, oli & barang", v: "v_consumable_use", order: ["report_date", "rig"], bh: "bhid" },
  lubang: { t: "Ringkasan per lubang", v: "v_dash_hole", order: ["bhid"], bh: "bhid" },
  kinerja: { t: "Kinerja rig harian", v: "v_dash_rig_day", order: ["tanggal", "rig"], bh: null },
  koreksi: { t: "Riwayat koreksi", v: "sample_edit_log", order: ["edited_at"], bh: null },
  arsip: { t: "Arsip terhapus (admin)", v: "deleted_record", order: ["deleted_at"], bh: "bhid", admin: true },
};
const OKV = new Set(["OK", "OK-SW", "BELUM OVEN", "MENUNGGU CEK"]);
function dbQuery(d, f) {
  let q = sb.from(d.v).select("*", { count: "exact" });
  if (f.bh && d.bh) q = q.ilike(d.bh, `%${f.bh}%`);
  if (f.bad && d.bad && ["chk_harian", "flags"].includes(d.bad[0])) q = q.neq(d.bad[0], "");
  else if (f.bad && d.bad) q = q.or(d.bad.map((c) => `and(${c}.not.is.null,${c}.not.in.(${[...OKV].map((x) => `"${x}"`).join(",")}))`).join(","));
  const desc = ["deleted_record", "sample_edit_log", "v_drill_progress_daily", "v_drill_event_qc", "p2h_check", "v_ddr_list", "v_ddr_hours", "v_consumable_use", "v_dash_rig_day"].includes(d.v);
  for (const o of d.order) q = q.order(o, { ascending: !desc });
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
      const got = {};
      for (const k of ["collar", "survey", "geology", "density", "assay", "qaqc", "foto", "progres", "aktivitas", "p2h", "ddr", "jam", "bbm", "lubang", "kinerja"]) {
        const rows = (await fetchAll(DATASETS[k], { ...f, bad: false })).map((r) => { const o = { ...r }; delete o.data; delete o.related; return o; }); got[k] = rows;
        X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), DATASETS[k].t.slice(0, 31).replace(/[\\/?*\[\]:]/g, " "));
      }
      const { data: tmx } = await sb.from("v_dash_time").select("*");
      const K = computeKPI(got.kinerja, tmx ?? [], got.bbm, got.lubang.filter((h) => h.jumlah_conto > 0));
      const aoa = [["DASHBOARD RINGKASAN — TGEP", "", `dibuat ${new Date().toLocaleString("id-ID")}`], [], ["Indikator", "Nilai"], ...K.map(([a, b]) => [a, b]), [], ["Meter & BBM per rig", "Meter", "BBM (L)", "L/m", "Jam bor", "m/jam"]];
      const rg = {}; for (const d of got.kinerja) { const r = (rg[d.rig] ??= { m: 0, b: 0, j: 0 }); r.m += +d.meter_bor || 0; r.b += +d.bbm_liter || 0; r.j += +d.jam_kerja_bor || 0; }
      for (const [r, x] of Object.entries(rg)) aoa.push([r, +x.m.toFixed(2), +x.b.toFixed(1), x.m ? +(x.b / x.m).toFixed(2) : "", +x.j.toFixed(2), x.j ? +(x.m / x.j).toFixed(2) : ""]);
      aoa.push([], ["Tebal zona per lubang", "Limonit (m)", "Saprolit (m)", "Conto", "Recovery %"]);
      for (const h of got.lubang.filter((h) => h.jumlah_conto > 0)) aoa.push([h.bhid, h.tebal_limonit, h.tebal_saprolit, h.jumlah_conto, h.recovery_pct]);
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), "Dashboard");
      X.writeFile(wb, `TGEP_Database_${tag()}.xlsx`); $("#info").textContent = "Excel diunduh (16 sheet, sheet terakhir = Dashboard). Grafik lengkap ada di menu Dashboard dan di ekspor harian Google Drive.";
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
// Mode offline: bila token tidak bisa diperbarui karena tidak ada sinyal, pakai identitas terakhir
// supaya tetap bisa memotret. Antrean baru dikirim setelah login sah saat online.
function offlineSession() {
  const u = JSON.parse(localStorage.getItem("lastUser") || "null");
  return !navigator.onLine && u ? { user: u, offline: true } : null;
}
sb.auth.onAuthStateChange(async (e, s) => {
  if (s) localStorage.setItem("lastUser", JSON.stringify({ id: s.user.id, email: s.user.email }));
  session = s ?? (e === "SIGNED_OUT" && !localStorage.getItem("manualLogout") ? offlineSession() : null);
  localStorage.removeItem("manualLogout");
  await loadMe(); render(); if (s) sync();
});
addEventListener("online", async () => { const { data } = await sb.auth.getSession(); if (data.session) { session = data.session; render(); sync(); } else if (session?.offline) { session = null; render(); } });
const { data: s0 } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
session = s0?.session ?? offlineSession(); await loadMe(); render(); sync();
