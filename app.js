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
const FORMS = { SHEET: "Form Logging", HEADER: "F01 Header lubang (lama)", LOG: "F02 Logging (lama)", DENSITY: "F03 Density (lama)" };
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
const APP_VERSION = "2026-11-17.3";
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
    b.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:50;background:#12251E;color:#fff;padding:12px 14px;border-radius:12px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.3)";
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
  syncing = true;
  try {
    for (const it of await qAll()) {
      if (it.kind === "core") { await syncCore(it); continue; }
      if (it.kind === "event" || it.kind === "p2h") { await syncProg(it); continue; }
      if (it.kind === "ddr") { await syncDDR(it); continue; }
      if (it.kind === "arsip") { await syncArsip(it); continue; }
      const path = `${session.user.id}/${it.client_uuid}.jpg`;
      const up = await sb.storage.from("scan-photos").upload(path, it.blob, { contentType: "image/jpeg", upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) { it.error = up.error.message; await qPut(it); continue; }
      const ins = await sb.from("scan_job").upsert({ client_uuid: it.client_uuid, form_type: it.form_type, bhid_hint: it.bhid, photo_path: path, captured_at: it.captured_at, sumber: it.sumber ?? null, file_name: it.file_name ?? null },
        { onConflict: "client_uuid", ignoreDuplicates: true });
      if (ins.error) { it.error = ins.error.message; await qPut(it); continue; }
      const { data: job } = await sb.from("scan_job").select("id").eq("client_uuid", it.client_uuid).single();
      if (job) await sb.functions.invoke("process-scan", { body: { job_id: job.id } });
      await qDel(it.client_uuid);
    }
  } finally { syncing = false; beat(true); loadLanjutan(); jadwalCekTolak(); if (["foto", "core", "prog", "ddr"].includes(tab)) render(); }
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
  if (online() && !sessionStorage.getItem("tugasLoaded")) { sessionStorage.setItem("tugasLoaded", "1"); await loadTugas(); loadLanjutan(); }
  if (!["client", "admin", "verifier"].includes(me?.role) && (!myTugas || myTugas.pilih_rig) && !sessionStorage.getItem("proyekOk")) return pilihProyekView(false);
  const R = me?.role, staff = ["geologist", "verifier", "admin"].includes(R), ver = ["verifier", "admin"].includes(R);
  const navs = R === "client" ? [["dash", "Dashboard"], ["klien", "Laporan rig"], ["db", "Database"], ["fk", "Foto & scan"], ["dok", "Dokumen"]] : [["prog", "Progres bor"], ["ddr", "DDR"], ["foto", "Foto formulir"], ...(staff ? [["core", "Foto core"]] : []),
    ...(ver ? [["review", "Periksa scan"], ["data", "Data & cek"], ["db", "Database"], ["dash", "Dashboard"], ["rekap", "Rekap operator"]] : []), ...(R === "admin" ? [["users", "Pengguna"]] : []), ["dok", "Dokumen"], ["ttd", "TTD saya"]];
  if (!navs.some(([k]) => k === tab)) tab = navs[0][0];
  const banner = session.offline ? `<div class="card" style="background:#FBE6D0">Mode offline — foto disimpan di HP dan dikirim otomatis saat ada sinyal.</div>` : "";
  beat();
  app.innerHTML = banner + `<nav>${navs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}<button class="sec" id="out" style="flex:0">Keluar</button></nav><div id="v"></div><p class="muted" style="text-align:center;font-size:12px;margin:18px 0">${myTugas ? `Proyek <b>${esc(myTugas.nama)}</b> · ${esc(myTugas.rig ?? "semua rig")}${me?.role === "client" ? "" : ` · <a href="#" id="gantiP">${myTugas.pilih_rig ? "ganti rig" : "penugasan"}</a>`} · ` : ["client", "admin", "verifier"].includes(me?.role) ? "" : `<a href="#" id="gantiP">belum ada penugasan</a> · `}TGEP Scan Drill Log · versi ${APP_VERSION}</p>`;
  $("#gantiP")?.addEventListener("click", (e) => { e.preventDefault(); pilihProyekView(false); });
  if (!sessionStorage.getItem("tolakCek")) { sessionStorage.setItem("tolakCek", "1"); cekPenolakan(true); }
  app.querySelectorAll("nav [data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; localStorage.setItem("tab", tab); render(); }));
  $("#out").onclick = async () => { if (!confirm("Keluar dari akun? Foto di antrean tetap tersimpan di HP.")) return; localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); session = null; await sb.auth.signOut().catch(() => {}); render(); };
  if (me?.role === "admin" && navigator.onLine && !session.offline) sb.from("registration_request").select("user_id", { count: "exact", head: true }).eq("status", "PENDING")
    .then(({ count }) => { const b = app.querySelector('nav [data-t="users"]'); if (b && count) b.textContent = `Pengguna (${count} baru)`; });
  document.querySelector("main").style.maxWidth = tab === "db" || tab === "dash" || tab === "rekap" || tab === "klien" ? "none" : "";
  if (tab === "foto") return fotoView($("#v"));
  if (tab === "review") return reviewList($("#v"));
  if (tab === "data") return dataView($("#v"));
  if (tab === "core") return coreView($("#v"));
  if (tab === "db") return dbView($("#v"));
  if (tab === "prog") return progView($("#v"));
  if (tab === "users") return usersView($("#v"));
  if (tab === "ddr") return ddrView($("#v"));
  if (tab === "ttd") return ttdView($("#v"));
  if (tab === "dok") return dokView($("#v"));
  if (tab === "rekap") return rekapView($("#v"));
  if (tab === "dash") return dashView($("#v"));
  if (tab === "klien") return klienView($("#v"));
  if (tab === "fk") return fotoKlienView($("#v"));
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
async function fotoView(v) {
  const staff = isStaff(), last = JSON.parse(localStorage.getItem("fotoLast") || "{}");
  const queue = (await qAll()).filter((x) => !x.kind || x.kind === "arsip");
  const jenisOpt = (staff ? `<option value="SHEET">Form Logging — logging geologi + density (dibaca otomatis)</option>` : "") + Object.entries(ARSIP).map(([k, t]) => `<option value="${k}">${t} (arsip foto, tidak dibaca otomatis)</option>`).join("");
  v.innerHTML = `<div class="card"><h2>Foto / unggah formulir</h2>
   <label>Ini formulir apa? *</label><select id="jn">${jenisOpt}</select>
   <div class="row"><div><label>BHID <span id="bhReq">*</span></label><input id="bh" value="${esc(localStorage.getItem("bhid") || "")}" placeholder="mis. RJDH010" autocapitalize="characters"></div><div><label>Rig</label>${rigField()}</div></div>
   <div class="row" id="tglRow"><div><label>Tanggal formulir</label><input id="tg" type="date" value="${todayWIB()}"></div><div><label>Shift</label><select id="sh"><option value="">—</option><option value="PAGI">Day</option><option value="MALAM">Night</option></select></div></div>
   <label>Keterangan</label><input id="kt" placeholder="mis. DDR Rig 04 shift malam, hal. 1–2" value="">
   <p class="muted" id="tip"></p>
   <div class="big"><button id="bCam">📷 Ambil foto<small>kamera HP</small></button><button id="bUp" class="sec">🖼️ Unggah foto / PDF<small>galeri, CamScanner, file scan (bisa banyak)</small></button></div>
   <input id="fCam" type="file" accept="image/*" capture="environment" class="hide"><input id="fUp" type="file" accept="image/*,application/pdf,.pdf" multiple class="hide">
   <div id="pr" class="muted"></div><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean di HP (${queue.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${queue.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.kind === "arsip" ? ARSIP[x.row.jenis] : FORMS[x.form_type])} · ${esc(x.bhid || x.row?.bhid || x.row?.rig || "")}${(x.page_no || x.row?.halaman) ? ` · hal. ${x.page_no || x.row.halaman}` : ""} · ${esc(x.sumber || x.row?.sumber || "")}<br><span class="muted">${new Date(x.captured_at || x.row.captured_at).toLocaleString("id-ID")}${x.error ? " · gagal: " + esc(x.error) : ""}</span></span></li>`).join("") || `<li class="muted">Kosong — semua foto sudah terkirim.</li>`}</ul></div>
   <div class="card"><h3>Kiriman saya</h3><ul class="list" id="mine"><li class="muted">Memuat…</li></ul></div>`;
  if (last.jenis && $("#jn").querySelector(`option[value="${last.jenis}"]`)) $("#jn").value = last.jenis;
  const upd = () => { const j = $("#jn").value, fb = j === "SHEET"; $("#bhReq").style.display = fb ? "" : "none"; $("#tglRow").style.display = fb ? "none" : "";
    $("#tip").textContent = fb ? "Form Logging: letakkan di permukaan datar, cahaya merata, keempat kotak hitam di sudut harus masuk. Hasil CamScanner boleh, asal tidak terpotong dan tidak tertutup tanda air." : "Arsip: foto/scan disimpan apa adanya sebagai bukti; isinya tidak dibaca otomatis. DDR tetap wajib diisi di menu DDR."; };
  $("#jn").onchange = upd; upd();
  const meta = () => {
    const jenis = $("#jn").value, bhid = $("#bh").value.trim().toUpperCase(), rig = $("#rg").value.trim().toUpperCase();
    if (jenis === "SHEET" && !bhid) { $("#e").textContent = "Isi BHID dulu."; return null; }
    if (jenis !== "SHEET" && !bhid && !rig) { $("#e").textContent = "Isi BHID atau Rig supaya arsip bisa dicari."; return null; }
    $("#e").textContent = ""; if (bhid) localStorage.setItem("bhid", bhid); if (rig) localStorage.setItem("rig", rig); localStorage.setItem("fotoLast", JSON.stringify({ jenis }));
    return { jenis, bhid, rig, tanggal: $("#tg").value || null, shift: $("#sh").value || null, keterangan: $("#kt").value.trim() || null };
  };
  const cekLogging = async (blob, nama) => {
    try { const bmp = await createImageBitmap(blob), lc = await localCheck(bmp); const why = [];
      if (lc.sharpness < 25) why.push("terlalu buram"); if (lc.brightness < 45) why.push("terlalu gelap"); if (Math.max(lc.width, lc.height) < 1000) why.push("resolusi terlalu kecil");
      if (why.length) { $("#e").textContent = `Ditolak sebelum dikirim${nama ? " (" + nama + ")" : ""}: ${why.join(", ")}. Foto ulang dengan cahaya merata dan HP tidak bergoyang.`; return false; }
    } catch { /* format tidak dikenali browser: biarkan server yang memeriksa */ }
    return true;
  };
  const put = async (m, blob, sumber, file_name, halaman, jumlah, captured_at) => {
    const client_uuid = crypto.randomUUID();
    if (m.jenis === "SHEET" && !(await cekLogging(blob, file_name))) return false;
    if (m.jenis === "SHEET") return qPut({ client_uuid, form_type: "SHEET", bhid: m.bhid, blob, captured_at, sumber, file_name });
    return qPut({ kind: "arsip", client_uuid, blob, row: { client_uuid, jenis: m.jenis, rig: m.rig || null, bhid: m.bhid || null, tanggal: m.tanggal, shift: m.shift, keterangan: m.keterangan, halaman, jumlah_halaman: jumlah, sumber, file_name, captured_at } });
  };
  $("#bCam").onclick = () => meta() && $("#fCam").click();
  $("#bUp").onclick = () => meta() && $("#fUp").click();
  $("#fCam").onchange = async (ev) => { const f = ev.target.files[0], m = meta(); if (!f || !m) return; const ok = await put(m, await shrink(f), "KAMERA", null, null, null, new Date().toISOString()); ev.target.value = ""; if (ok === false) return; render(); sync(); };
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
  $("#sy").onclick = sync;
  if (online()) {
    const [{ data: a }, { data: b }] = await Promise.all([
      staff ? sb.from("scan_job").select("id,form_type,bhid_hint,status,created_at,n_disagree,n_rule_flags,error,sumber").eq("created_by", session.user.id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
      sb.from("form_photo").select("jenis,rig,bhid,tanggal,halaman,jumlah_halaman,sumber,created_at").eq("created_by", session.user.id).order("created_at", { ascending: false }).limit(30)]);
    const items = [...(a ?? []).map((j) => ({ t: j.created_at, h: `<li><span class="pill ${j.status}">${j.status === "REJECTED" ? "DITOLAK" : j.status}</span><span>${esc(FORMS[j.form_type])} · ${esc(j.bhid_hint)}${j.sumber ? " · " + j.sumber : ""}<br><span class="muted">${new Date(j.created_at).toLocaleString("id-ID")}${j.status === "NEEDS_REVIEW" ? ` · ${j.n_disagree} beda baca, ${j.n_rule_flags} cek aturan` : ""}${j.error ? " · " + esc(j.error) : ""}</span></span></li>` })),
      ...(b ?? []).map((p) => ({ t: p.created_at, h: `<li><span class="pill APPROVED">ARSIP</span><span>${esc(ARSIP[p.jenis])} · ${esc(p.bhid || p.rig || "")}${p.halaman ? ` · hal. ${p.halaman}/${p.jumlah_halaman ?? "?"}` : ""} · ${p.sumber}<br><span class="muted">${p.tanggal ?? ""} · dikirim ${new Date(p.created_at).toLocaleString("id-ID")}</span></span></li>` }))].sort((x, y) => (x.t < y.t ? 1 : -1));
    $("#mine").innerHTML = items.map((x) => x.h).join("") || `<li class="muted">Belum ada.</li>`;
  } else $("#mine").innerHTML = `<li class="muted">Offline — daftar akan tampil saat ada sinyal.</li>`;
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
  box.querySelectorAll("[data-ar]").forEach((b) => (b.onclick = async () => { const { data: u } = await sb.storage.from("scan-photos").createSignedUrl(b.dataset.ar, 3600); if (u?.signedUrl) window.open(u.signedUrl, "_blank"); }));
}

async function reviewList(v) {
  const { data, error } = await sb.from("scan_job").select("id,form_type,bhid_hint,page_no,status,created_at,n_disagree,n_rule_flags,error")
    .in("status", ["NEEDS_REVIEW", "ERROR", "PROCESSING", "UPLOADED"]).order("created_at");
  v.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Scan menunggu pemeriksaan</h2><button class="sec" id="rf" style="flex:0">Muat ulang</button></div>
  ${error ? `<p class="err">${esc(error.message)}</p>` : ""}
  <ul class="list">${(data ?? []).map((j) => `<li><span class="pill ${j.status}">${j.status}</span><span style="flex:1">${esc(FORMS[j.form_type])} · <b>${esc(j.bhid_hint)}</b>${j.page_no ? " hal. " + j.page_no : ""}<br>
   <span class="muted">${new Date(j.created_at).toLocaleString("id-ID")}${j.status === "NEEDS_REVIEW" ? ` · ${j.n_disagree} beda baca · ${j.n_rule_flags} cek aturan` : ""}${j.error ? " · " + esc(j.error) : ""}</span></span>
   <button data-id="${j.id}" style="flex:0">Buka</button>${me?.role === "admin" ? `<button class="danger" data-del="${j.id}" style="flex:0">Hapus</button>` : ""}</li>`).join("") || `<li class="muted">Tidak ada yang perlu diperiksa.</li>`}</ul></div>`;
  const ab = document.createElement("div"); ab.className = "card"; ab.innerHTML = "<p class='muted'>Memuat arsip…</p>"; v.appendChild(ab); arsipList(ab);
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
async function toJpeg(bmp, max, q) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return await new Promise((r) => c.toBlob(r, "image/jpeg", q));
}
const fmtD = (n) => Number(n).toFixed(2).replace(".", ",");
async function coreView(v) {
  const bh = localStorage.getItem("bhid") || "", lastType = localStorage.getItem("coreType") || "UTUH";
  const qd = (await qAll()).filter((x) => x.kind === "core");
  v.innerHTML = `<div class="card"><h2>Foto core</h2>
   <div class="row"><div><label>BHID</label><input id="cb" value="${esc(bh)}" autocapitalize="characters"></div><div><label>Jenis foto</label><select id="cty"><option value="UTUH" ${lastType === "UTUH" ? "selected" : ""}>Core UTUH</option><option value="BELAH" ${lastType === "BELAH" ? "selected" : ""}>Core BELAH</option></select></div></div>
   <p id="cl" class="muted"></p>
   <div class="row"><div><label>Kotak ke-</label><input id="cx" inputmode="numeric"></div><div><label>FROM (m)</label><input id="cf" inputmode="decimal"></div><div><label>TO (m)</label><input id="ct" inputmode="decimal"></div></div>
   <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="crt" style="width:auto"> Foto ulang kotak yang sudah pernah dikirim (mis. karena ditolak)</label>
   <p class="muted">Template SOP: 1 corebox per foto, teduh, meteran 0–100 cm, papan BHID · nomor kotak · kedalaman terbaca, kamera tegak lurus. Kotak dan kedalaman harus melanjutkan kotak sebelumnya.</p>
   <div class="big"><button id="cgo">📷 Ambil foto corebox</button></div>
   <input id="cfile" type="file" accept="image/*" capture="environment" class="hide"><div id="lc"></div><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean foto core (${qd.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${qd.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.file_name)}${x.local_check.warnings.length ? `<br><span class="err">${x.local_check.warnings.map(esc).join(" · ")}</span>` : ""}${x.error ? `<br><span class="err">${esc(x.error)}</span>` : ""}</span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
   <div class="card"><h3>Kelengkapan & kesesuaian SOP</h3><div class="row"><input id="kb" value="${esc(bh)}"><button id="kg" style="flex:0">Cek</button></div><div id="ko"></div></div>`;
  const num = (s) => Number(String(s).replace(",", "."));
  let nx = { lastBox: 0, lastTo: 0, box: 1, from: 0 };
  const isi = async () => {
    const bhid = $("#cb").value.trim().toUpperCase(), type = $("#cty").value; if (!bhid) { $("#cl").textContent = ""; return; }
    nx = await nextCore(bhid, type);
    $("#cl").innerHTML = nx.lastBox ? `Terakhir dikirim: <b>kotak ${nx.lastBox}</b> sampai <b>${fmtD(nx.lastTo)} m</b> (${type}). Lanjut kotak ${nx.box} dari ${fmtD(nx.from)} m.` : `Belum ada foto ${type} untuk ${esc(bhid)} — mulai kotak 1 dari 0,00 m.`;
    if (!$("#crt").checked) { $("#cx").value = nx.box; $("#cf").value = fmtD(nx.from); $("#ct").value = ""; }
  };
  $("#cb").onchange = isi; $("#cty").onchange = () => { localStorage.setItem("coreType", $("#cty").value); isi(); };
  $("#crt").onchange = () => { if (!$("#crt").checked) isi(); else { $("#cx").value = ""; $("#cf").value = ""; $("#ct").value = ""; $("#cx").focus(); } };
  await isi();
  $("#cgo").onclick = () => {
    const f = num($("#cf").value), to = num($("#ct").value), box = parseInt($("#cx").value), retake = $("#crt").checked;
    if (!$("#cb").value.trim()) return ($("#e").textContent = "Isi BHID.");
    if (!(box > 0)) return ($("#e").textContent = "Isi nomor kotak.");
    if (!(isFinite(f) && isFinite(to) && to > f)) return ($("#e").textContent = "Isi FROM dan TO kotak ini (TO > FROM).");
    if (to - f > 1.6) return ($("#e").textContent = "Ditolak: satu foto = satu corebox; rentang lebih dari 1,6 m tidak sesuai template.");
    if (!retake) {
      if (box !== nx.box) return ($("#e").textContent = `Ditolak: kotak ${box} tidak melanjutkan kotak terakhir (${nx.lastBox}). Seharusnya kotak ${nx.box}. Bila ini foto ulang, centang “Foto ulang”.`);
      if (Math.abs(f - nx.from) > 0.02) return ($("#e").textContent = `Ditolak: FROM ${fmtD(f)} m tidak menyambung dengan TO kotak sebelumnya (${fmtD(nx.from)} m).`);
    } else if (box > nx.lastBox) return ($("#e").textContent = `Ditolak: kotak ${box} belum pernah dikirim, jadi bukan foto ulang. Hilangkan centang “Foto ulang”.`);
    $("#e").textContent = ""; $("#cfile").click();
  };
  $("#cfile").onchange = async (ev) => {
    const file = ev.target.files[0]; if (!file) return; ev.target.value = "";
    const bmp = await createImageBitmap(file); const lc = await localCheck(bmp);
    const bhid = $("#cb").value.trim().toUpperCase(), type = $("#cty").value, f = num($("#cf").value), to = num($("#ct").value), box = parseInt($("#cx").value) || null;
    if (lc.sharpness < 25 || lc.brightness < 45) return ($("#e").textContent = `Ditolak sebelum dikirim: ${lc.sharpness < 25 ? "foto terlalu buram" : "foto terlalu gelap"}. Ambil ulang di tempat teduh yang terang dan HP tidak bergoyang.`);
    const save = async () => {
      const fn = `${bhid}_K${box}_${fmtD(f)}-${fmtD(to)}_${type}.jpg`;
      await qPut({ kind: "core", client_uuid: crypto.randomUUID(), bhid, box_no: box, depth_from: f, depth_to: to, photo_type: type, file_name: fn,
        blob: await toJpeg(bmp, 4000, 0.9), preview: await toJpeg(bmp, 1600, 0.85), local_check: lc, captured_at: new Date().toISOString() });
      const H = JSON.parse(localStorage.getItem("coreHist") || "{}"), k = `${type}|${bhid}`;
      H[k] = { box: Math.max(H[k]?.box ?? 0, box ?? 0), to: Math.max(Number(H[k]?.to ?? 0), to) }; localStorage.setItem("coreHist", JSON.stringify(H));
      localStorage.setItem("bhid", bhid); render(); sync();
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
  ko.innerHTML = `<p><b>${nBad ? `${nBad} conto belum lengkap / tidak sesuai SOP` : (s?.length ? "Semua conto lengkap dan sesuai SOP" : "Belum ada data logging untuk BHID ini")}</b></p>
   ${gaps.length ? `<p class="err">${gaps.map(esc).join("<br>")}</p>` : ""}
   ${s?.length ? `<div class="tw"><table><tr><th>Conto</th><th>FROM–TO</th><th>Foto utuh</th><th>Foto belah</th></tr>${s.map((r) => `<tr><td>${r.seq}${esc(r.geozone_id ?? "")}</td><td>${fmtD(r.depth_from)}–${fmtD(r.depth_to)}</td>
     <td style="${bad(r.chk_foto_utuh) ? "background:#F6C9C3" : ""}">${esc(r.chk_foto_utuh)}</td><td style="${bad(r.chk_foto_belah) ? "background:#F6C9C3" : ""}">${esc(r.chk_foto_belah ?? "tidak wajib")}</td></tr>`).join("")}</table></div>` : ""}
   <h3>Foto (${ph?.length ?? 0})</h3><ul class="list">${(ph ?? []).map((p) => { const ok = p.reviewer_override ?? p.sop_ok;
     return `<li><span class="pill ${p.status === "CHECKED" ? (ok ? "APPROVED" : "REJECTED") : p.status}">${p.status === "CHECKED" ? (ok ? "SESUAI SOP" : "TIDAK SESUAI") : p.status}</span><span style="flex:1">${esc(p.file_name)}
       ${p.ditolak && !p.reviewer_override ? `<br><b class="err">DITOLAK: ${esc(p.alasan_tolak ?? "")}</b>` : ""}${(p.sop_issues ?? []).length && !ok ? `<br><span class="err">${p.sop_issues.map(esc).join("<br>")}</span>` : ""}${p.error ? `<br><span class="err">${esc(p.error)}</span>` : ""}${p.review_note ? `<br><span class="muted">Catatan: ${esc(p.review_note)}</span>` : ""}</span>
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
// ---------- Personil hadir per shift (dicatat saat Masuk / Keluar shift di Progres bor) ----------
const JABATAN = ["WSG", "Driller", "Helper", "Mekanik", "Lainnya"];
const shiftDari = (d) => { const w = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })), h = w.getHours();
  const t = new Date(w.getTime() - 6 * 36e5); const tgl = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return { tanggal: tgl, shift: h >= 6 && h < 18 ? "PAGI" : "MALAM" }; };
const kunciPersonil = (rig, tgl, sh) => `personil|${rig}|${tgl}|${sh}`;
const crewMin = () => Number(localStorage.getItem("crewMin")) || 4;   // qc_param CREW_MIN: driller + helper/mekanik, tanpa WSG
const jabatanSaya = () => (me?.role === "geologist" ? "WSG" : me?.role === "driller" ? "Driller" : "Lainnya");
function personilAwal(rig, t, capturedAt) {
  const { tanggal, shift } = shiftDari(capturedAt), hariIni = JSON.parse(localStorage.getItem(kunciPersonil(rig, tanggal, shift)) || "null");
  let L = t === "KELUAR" && hariIni ? hariIni : hariIni ?? JSON.parse(localStorage.getItem(`personilLast|${rig}`) || "[]");
  L = L.map((x) => ({ ...x }));
  if (t === "MASUK" && me?.full_name && !L.some((x) => x.nama.toUpperCase() === me.full_name.toUpperCase())) L.unshift({ nama: me.full_name, jabatan: jabatanSaya() });
  if (!L.some((x) => x.jabatan === "WSG")) L.unshift({ nama: "", jabatan: "WSG" });
  if (!L.some((x) => x.jabatan === "Driller")) L.push({ nama: "", jabatan: "Driller" });
  while (t === "MASUK" && L.filter((x) => x.jabatan !== "WSG").length < crewMin()) L.push({ nama: "", jabatan: "Helper" });
  return L.sort((a, b) => JABATAN.indexOf(a.jabatan) - JABATAN.indexOf(b.jabatan));
}
function personilEditor(box, list) {
  const riwayat = JSON.parse(localStorage.getItem("namaPersonil") || "[]");
  const baris = (x) => `<div class="row" data-ps style="align-items:center;margin-top:4px"><select style="flex:0 0 112px">${JABATAN.map((j) => `<option ${x.jabatan === j ? "selected" : ""}>${j}</option>`).join("")}</select>
    <input value="${esc(x.nama)}" placeholder="Nama" list="dlNama" autocapitalize="words"><button class="sec" data-hp style="flex:0;padding:8px 12px">✕</button></div>`;
  box.innerHTML = `<datalist id="dlNama">${riwayat.map((n) => `<option value="${esc(n)}">`).join("")}</datalist><div data-pl>${list.map(baris).join("")}</div>
    <button class="sec" data-pa style="width:auto;margin-top:6px">+ personil</button><div class="muted" data-pc style="margin-top:4px"></div>`;
  const hitung = () => { const L = ambilPersonil(box), n = (j) => L.filter((x) => x.jabatan === j).length;
    const cr = L.length - n("WSG"), kos = [...box.querySelectorAll("[data-ps] input")].filter((x) => !x.value.trim()).length;
    box.querySelector("[data-pc]").innerHTML = `${L.length} orang · WSG ${n("WSG")} · <b style="color:${cr < crewMin() ? "var(--red)" : "inherit"}">crew ${cr}/${crewMin()}</b> (driller ${n("Driller")})${kos ? ` · <span style="color:var(--red)">${kos} nama kosong</span>` : ""}`; };
  const pasang = () => { box.querySelectorAll("[data-hp]").forEach((b) => (b.onclick = () => { b.closest("[data-ps]").remove(); hitung(); })); box.querySelectorAll("[data-ps] input,[data-ps] select").forEach((x) => (x.oninput = hitung)); };
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
  const rig = localStorage.getItem("rig") || "", bh = localStorage.getItem("bhid") || "", shift = localStorage.getItem("shift") || "PAGI";
  const q = (await qAll()).filter((x) => x.kind === "event" || x.kind === "p2h");
  v.innerHTML = `<div class="card"><h2>Progres pemboran</h2>
   <div class="row"><div><label>Rig</label>${rigField()}</div>
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
    let lastTo = lastRunTo(r.bhid);
    const m = modal(`<h3>Konfirmasi foto</h3><p class="muted">${fmtT(capturedAt)} · ${esc(r.rig)} · ${esc(r.bhid ?? "")}</p>
      ${age > 300 ? `<p class="err">Foto ini dibuat ${Math.round(age / 60)} menit lalu — kemungkinan dari galeri, akan ditandai.</p>` : ""}
      <label>Foto ini untuk:</label>
      <div class="list" id="types">${(pending === "ACT" ? ["RUN", "GANTI_MATA_BOR", "TAMBAH_STANG", "STANDBY", "PERBAIKAN", "PINDAH_TITIK", "LAINNYA"] : [pending]).map((k, i) =>
        `<label style="display:flex;gap:8px;align-items:center;padding:8px 0"><input type="radio" name="et" value="${k}" ${i === 0 ? "checked" : ""} style="width:auto">${EV[k]}</label>`).join("")}</div>
      <div id="runf" class="row"><div><label>FROM (m)</label><input id="rf" inputmode="decimal" value="${fmtD(lastTo)}"></div><div><label>TO (m)</label><input id="rt" inputmode="decimal"></div><div><label>Core (m)</label><input id="rc" inputmode="decimal"></div></div>
      <div id="psn" style="display:none"><h3 style="margin:12px 0 2px" id="psnT">Personil hadir</h3><p class="muted" id="psnTip" style="margin:0"></p><div id="psnBox"></div></div>
      <div id="rsn"><label>Alasan / keterangan</label><input id="rn" placeholder="mis. mata bor aus, pompa rusak, hujan"></div>
      <p id="gps" class="muted">Mengambil GPS…</p>
      <div class="row" style="margin-top:10px"><button id="ok">Ya, simpan</button><button class="sec" id="cx">Batal</button></div><div id="me" class="err"></div>`);
    const tp = () => m.querySelector('input[name="et"]:checked').value;
    const upd = () => { const t = tp(); m.querySelector("#runf").style.display = t === "RUN" ? "" : "none"; m.querySelector("#ok").textContent = `Ya, simpan sebagai ${EV[t]}`;
      const ps = t === "MASUK" || t === "KELUAR"; m.querySelector("#psn").style.display = ps ? "" : "none";
      if (ps && !m.querySelector("#psnBox").dataset.ok) { m.querySelector("#psnBox").dataset.ok = "1"; personilEditor(m.querySelector("#psnBox"), personilAwal(r.rig, t, capturedAt));
        m.querySelector("#psnT").textContent = t === "MASUK" ? "Personil hadir (WSG, driller, crew)" : "Personil yang keluar shift";
        m.querySelector("#psnTip").textContent = t === "MASUK" ? "Tulis semua yang ada di foto. Terisi dari shift terakhir rig ini — hapus yang tidak hadir, tambah yang baru." : "Hapus nama yang sudah pulang lebih dulu."; } };
    m.querySelectorAll('input[name="et"]').forEach((x) => (x.onchange = upd)); upd();
    let pos = null; posP.then((p) => { pos = p; m.querySelector("#gps").textContent = p ? `GPS: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} (±${p.acc} m)` : "GPS tidak didapat — aktifkan Lokasi di HP. Foto tetap disimpan dan ditandai."; });
    m.querySelector("#cx").onclick = () => m.remove();
    m.querySelector("#ok").onclick = async () => {
      const t = tp(), num = (s) => (String(s).trim() === "" ? null : Number(String(s).replace(",", ".")));
      const row = { ...r, event_type: t, reason: m.querySelector("#rn").value || null, captured_at: capturedAt.toISOString(), photo_age_s: age };
      if (t === "RUN") {
        Object.assign(row, { depth_from: num(m.querySelector("#rf").value), depth_to: num(m.querySelector("#rt").value), core_length: num(m.querySelector("#rc").value) });
        if (!(row.depth_to > row.depth_from)) return (m.querySelector("#me").textContent = "Isi FROM dan TO run (TO > FROM).");
        if (Math.abs(row.depth_from - lastTo) > 0.02 && !confirm(`FROM ${fmtD(row.depth_from)} m tidak menyambung dengan TO run terakhir ${fmtD(lastTo)} m. Tetap simpan?`)) return;
        if (row.core_length === null) return (m.querySelector("#me").textContent = "Isi panjang core yang terambil.");
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
      const line2 = t === "RUN" ? `RUN ${fmtD(row.depth_from)}–${fmtD(row.depth_to)} m · core ${fmtD(row.core_length)} m` : EV[t] + (row.personil ? ` · ${row.personil.length} personil` : "") + (row.reason ? ` · ${row.reason}` : "");
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
  const opt = (sel) => ["driller", "geologist", "verifier", "admin", "client"].map((r) => `<option ${r === sel ? "selected" : ""}>${r}</option>`).join("");
  const row = (r, pending) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(r.full_name)}</b> · ${esc(r.email)}<br><span class="muted">${esc(r.position ?? "")} · ${esc(r.company ?? "")} · ${esc(r.phone ?? "")}${r.reason ? " · " + esc(r.reason) : ""}<br>
      ${pending ? `minta: ${esc(r.requested_role)} · daftar ${new Date(r.created_at).toLocaleString("id-ID")}` : `status: ${roleOf[r.user_id] ? "AKTIF (" + roleOf[r.user_id] + ")" : r.status === "REJECTED" ? "DITOLAK/NONAKTIF" : r.status}${r.decision_note ? " · " + esc(r.decision_note) : ""}`}</span></span>
      <select data-role="${r.user_id}" style="flex:0;width:auto">${opt(roleOf[r.user_id] ?? r.requested_role)}</select>
      <button data-ok="${r.user_id}" style="flex:0">${pending ? "Setujui" : roleOf[r.user_id] ? "Ubah peran" : "Aktifkan"}</button>
      ${pending || roleOf[r.user_id] ? `<button class="danger" data-no="${r.user_id}" style="flex:0">${pending ? "Tolak" : "Nonaktifkan"}</button>` : ""}</li>`;
  v.innerHTML = `<div class="card"><h2>Pengguna</h2>
    <p>Link pendaftaran untuk dibagikan: <b>${esc(link)}</b> <button class="sec" id="cp" style="padding:4px 10px">Salin</button></p>
    <p class="muted">Pendaftar tidak bisa melihat atau mengirim data sampai disetujui. Periksa nama, perusahaan dan nomor HP sebelum menyetujui — email belum diverifikasi otomatis.</p></div>
    <div class="card"><h3>Menunggu persetujuan (${pend.length})</h3><ul class="list">${pend.map((r) => row(r, true)).join("") || `<li class="muted">Tidak ada.</li>`}</ul></div>
    <div class="card"><h3>Semua pengguna</h3><ul class="list">${rest.map((r) => row(r, false)).join("") || `<li class="muted">-</li>`}</ul></div>
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
  const shiftNow = shiftDari(new Date()), rig = localStorage.getItem("rig") || "", shift = shiftNow.shift, last = JSON.parse(localStorage.getItem("ddrLast") || "{}"); if (last.v !== 2) delete last.contractor;
  const cats = [...new Set(items.map((i) => i.kategori))];
  v.innerHTML = `<div class="card"><h2>DAILY DRILLING REPORT</h2>
    <p class="muted">Urutan sama dengan formulir DDR lapangan. Kolom * wajib. Kolom <b>Client</b> diisi nama perusahaan client. Pemakaian barang wajib diisi semua (0 bila tidak dipakai).</p>
    <div class="row"><div><label>PROJECT</label>${rigTerkunci() ? `<input id="pj" value="${esc(myTugas.project ?? "")}" readonly title="Diatur admin">` : `<input id="pj" value="${esc(last.project ?? "")}">`}</div><div><label>LOCATION</label><input id="lc" value="${esc(last.location ?? "")}"></div></div>
    <div class="row"><div><label>HOLE ID *</label><input id="bh" value="${esc(localStorage.getItem("bhid") || "")}" autocapitalize="characters"></div><div><label>RIG NO *</label>${rigField()}</div><div><label>RIG TYPE</label><input id="rt" value="${esc(last.rig_type ?? "")}"></div></div>
    <div class="row"><div><label>DATE *</label><input id="dt" type="date" value="${shiftNow.tanggal}"></div><div><label>TIME *</label><select id="sh"><option value="PAGI" ${shift === "PAGI" ? "selected" : ""}>Day (06–18)</option><option value="MALAM" ${shift === "MALAM" ? "selected" : ""}>Night (18–06)</option></select></div><div><label>Client *</label><input id="ct" value="${esc(last.contractor ?? "")}"></div></div>
    <div class="row"><div><label>DRILLER *</label>${me?.role === "driller" ? `<input id="dn" value="${esc(me.full_name ?? "")}" readonly title="Nama akun Anda">` : `<input id="dn" value="${esc(last.driller_name ?? "")}">`}</div><div><label>ASSISTANT</label><input id="hp" value="${esc(last.helpers ?? "")}"></div><div style="flex:.5"><label>CREW *</label><input id="cc" inputmode="numeric" value="${esc(last.crew_count ?? "")}"></div></div>
    <p class="muted" id="crewInfo" style="margin:4px 0 0"></p>

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
  // Crew DDR diambil dari daftar personil Masuk shift (Progres bor) untuk rig + tanggal + shift yang sama
  let crewDDR = [];
  const isiCrew = async () => {
    const rg = $("#rg").value.trim().toUpperCase(), tg = $("#dt").value, sh = $("#sh").value;
    let L = JSON.parse(localStorage.getItem(kunciPersonil(rg, tg, sh)) || "null");
    if (!L && online()) { const { data } = await sb.from("v_personil_shift").select("personil").eq("rig", rg).eq("tanggal", tg).eq("shift", sh).maybeSingle(); L = data?.personil ?? null; }
    crewDDR = L ?? [];
    const info = $("#crewInfo"); if (!info) return;
    if (!crewDDR.length) { info.innerHTML = `<span class="err">Belum ada daftar personil Masuk shift di Progres bor untuk ${esc(rg)} · ${esc(tg)} · ${sh === "PAGI" ? "Day" : "Night"}.</span>`; return; }
    const helper = crewDDR.filter((x) => !["WSG", "Driller"].includes(x.jabatan)).map((x) => x.nama).join(", ");
    $("#hp").value = helper; $("#cc").value = crewDDR.length;
    info.innerHTML = `Dari Progres bor: ${crewDDR.map((x) => `${esc(x.nama)} <span class="muted">(${esc(x.jabatan)})</span>`).join(", ")}`;
  };
  ["#rg", "#dt", "#sh"].forEach((id) => $(id).addEventListener("change", isiCrew)); isiCrew();
  $("#sv").onclick = async () => {
    const val = (id) => $(id).value.trim();
    const rows = (box) => [...$(box).querySelectorAll(".row")].map((r) => [...r.querySelectorAll("input,select")].map((x) => x.value.trim()));
    const open_hole = rows("#oh").filter((x) => x[0] || x[1]).map(([f, t]) => ({ from: num(f), to: num(t) }));
    const coring = rows("#cr").filter((x) => x[0] || x[1]).map(([f, t, c, rm]) => ({ from: num(f), to: num(t), core: num(c), remark: rm || null }));
    const hours = rows("#hr").filter((x) => x[0] || x[1]).map(([m, s, k, d]) => ({ mulai: m.replace(".", ":"), selesai: s.replace(".", ":"), kategori: k, ket: d || null }));
    const row = { project: val("#pj") || null, location: val("#lc") || null, rig: val("#rg").toUpperCase(), rig_type: val("#rt") || null, report_date: val("#dt"), shift: $("#sh").value,
      bhid: val("#bh").toUpperCase() || null, contractor: val("#ct"), driller_name: val("#dn"), helpers: val("#hp") || null, crew_count: num(val("#cc")), crew: crewDDR,
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
    localStorage.setItem("ddrLast", JSON.stringify({ v: 2, contractor: row.contractor, driller_name: row.driller_name, crew_count: row.crew_count, helpers: row.helpers, project: row.project, location: row.location, rig_type: row.rig_type, target_m: row.target_m }));
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
  <h1>DAILY DRILLING REPORT</h1><div>CLIENT: <b>${esc(d.contractor ?? "")}</b> · status: <b>${d.status === "SIGNED" ? "LENGKAP DITANDATANGANI" : "DRAF"}</b></div>
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
    ${proyekSelect()}<div><label>Rig</label><input id="r" value="${esc(st.rig)}" placeholder="semua"></div><button id="go" style="flex:0">Tampilkan</button><button class="sec" id="pr" style="flex:0">Cetak / PDF</button><button class="sec" id="dx" style="flex:0;white-space:nowrap">Unduh Excel</button><button id="lap" style="flex:0;white-space:nowrap">Laporan progres</button></div></div>
    <div id="kpi" class="card"></div><div id="ch" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px"></div>`;
  $("#pr").onclick = () => print();
  $("#lap").onclick = () => laporanProgres({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase(), proj: $("#fproj").value });
  $("#go").onclick = () => { sessionStorage.setItem("filterProyek", $("#fproj").value); sessionStorage.setItem("dash", JSON.stringify({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase() })); dashView(v); };
  if (!online()) return ($("#kpi").textContent = "Dashboard perlu sinyal internet.");
  const pf = await proyekFilter();
  const R = (q) => (st.rig ? q.eq("rig", st.rig) : pf ? q.in("rig", pf.rigs.length ? pf.rigs : ["-"]) : q);
  const [{ data: rd }, { data: tm }, { data: cu }, { data: hl }] = await Promise.all([
    R(sb.from("v_dash_rig_day").select("*").gte("tanggal", st.from).lte("tanggal", st.to)).order("tanggal"),
    R(sb.from("v_dash_time").select("*").gte("tanggal", st.from).lte("tanggal", st.to)),
    R(sb.from("v_consumable_use").select("*").gte("report_date", st.from).lte("report_date", st.to)),
    sb.from("v_dash_hole").select("*"),
  ]);
  const days = rd ?? [], holes = (hl ?? []).filter((h) => h.jumlah_conto > 0 && (!pf || pf.bhids.includes(h.bhid))), K = computeKPI(days, tm ?? [], cu ?? [], holes).filter(([l]) => !isClient() || (l !== "Foto core lengkap" && (clientGeo() || !GEO_KPI.includes(l))));
  $("#dx").onclick = async () => { try { const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new(), sh = (rows, nm) => X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), nm);
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["DASHBOARD TGEP", `${st.from} s/d ${st.to}`, st.rig || "semua rig"], [], ["Indikator", "Nilai"], ...K.map(([a, b]) => [a, b])]), "KPI");
    sh(days, "Kinerja rig harian"); sh(tm ?? [], "Pembagian waktu"); sh(cu ?? [], "Pemakaian barang"); if (!isClient() || clientGeo()) sh(holes, "Ringkasan lubang");
    X.writeFile(wb, `TGEP_Dashboard_${st.from}_${st.to}.xlsx`); } catch (e) { alert(e.message); } };
  $("#kpi").innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">${K.map(([l, val, note]) => `<div style="background:#fff;border-radius:10px;padding:10px;border-left:5px solid ${note === "!" ? "#C8281F" : "#1E9E69"}"><div class="muted" style="font-size:12px">${esc(l)}</div><div style="font-size:22px;font-weight:700">${esc(val)}</div></div>`).join("")}</div>
    <p class="muted" style="margin-top:8px">Periode ${st.from} s/d ${st.to}${st.rig ? " · rig " + esc(st.rig) : " · semua rig"}. ${isClient() ? `Akun client: data rig proyek Anda${clientGeo() ? " termasuk data geologi yang sudah disetujui" : " (meter, jam, standby, BBM, P2H, DDR)"}.` : "Data geologi (tebal zona, conto) mencakup semua lubang yang sudah disetujui."}</p>`;
  const klien = isClient() && !clientGeo();
  const { data: kp } = isClient() ? { data: [] } : await sb.from("v_kepatuhan_harian").select("nama,rig,status,kurang,antrean").eq("tanggal", st.to);
  if (kp?.length) { const c = document.createElement("div"); c.className = "card"; const bel = kp.filter((r) => ["BELUM", "SEBAGIAN"].includes(r.status)), hp = kp.filter((r) => r.antrean > 0);
    c.innerHTML = `<h3 style="margin:0 0 6px">Pengiriman operator ${st.to}</h3><p>Lengkap <b>${kp.filter((r) => r.status === "LENGKAP").length}</b> · sebagian <b>${kp.filter((r) => r.status === "SEBAGIAN").length}</b> · belum <b>${kp.filter((r) => r.status === "BELUM").length}</b> · data tertahan di HP <b>${hp.length}</b> orang</p>${bel.length ? `<p class="err">${bel.map((r) => `${esc(r.nama)} (${esc(r.rig ?? "-")}): ${esc((r.kurang ?? []).join(", "))}`).join(" · ")}</p>` : ""}<button class="sec" id="toRek" style="width:auto">Buka Rekap operator</button>`;
    $("#kpi").after(c); c.querySelector("#toRek").onclick = () => { tab = "rekap"; localStorage.setItem("tab", tab); render(); }; }
  const { Chart } = await import("./vendor/chart.js");
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
  const br = by(days, (d) => d.rig, (d) => d.bbm_liter);
  new Chart(box("c5", "BBM per rig: total (L) & per meter (L/m)"), { type: "bar", data: { labels: Object.keys(br), datasets: [{ type: "bar", label: "BBM (L)", yAxisID: "y", data: Object.values(br), backgroundColor: "#2F6FB0" }, { type: "line", label: "L/m", data: Object.keys(br).map((r) => (mr[r] ? +(br[r] / mr[r]).toFixed(2) : null)), yAxisID: "y2", borderColor: "#C8281F" }] }, options: { scales: { y: { type: "linear", position: "left", beginAtZero: true }, y2: { type: "linear", position: "right", beginAtZero: true, grid: { display: false } } } } });
  const lq = by((cu ?? []).filter((c) => c.unit === "liter"), (c) => c.item, (c) => c.qty);
  new Chart(box("c6", "Pemakaian cairan (liter) per jenis"), { type: "pie", data: { labels: Object.keys(lq).length ? Object.keys(lq) : ["(belum ada DDR)"], datasets: [{ data: Object.keys(lq).length ? Object.values(lq) : [1], backgroundColor: pal }] } });
  const { data: dh } = await R(sb.from("v_ddr_hours").select("kategori,kelompok,menit").gte("tanggal", st.from).lte("tanggal", st.to));
  const hk = by(dh ?? [], (x) => x.kategori, (x) => x.menit), hg = by(dh ?? [], (x) => x.kelompok, (x) => x.menit);
  new Chart(box("c11", "Distribusi jam DDR per kegiatan (jam)"), { type: "bar", data: { labels: Object.keys(hk).length ? Object.keys(hk) : ["(belum ada DDR)"], datasets: [{ label: "jam", data: Object.values(hk).map((m) => +(m / 60).toFixed(2)), backgroundColor: "#2F6FB0" }] }, options: { indexAxis: "y" } });
  new Chart(box("c12", "Drilling / Working / Standby (DDR)"), { type: "pie", data: { labels: Object.keys(hg).length ? Object.keys(hg) : ["(belum ada DDR)"], datasets: [{ data: Object.keys(hg).length ? Object.values(hg) : [1], backgroundColor: ["#1E9E69", "#E8892B", "#C8281F"] }] } });
  if (klien) return;
  const ed = [0, 2, 4, 6, 8, 10, 12, 15, 20, 30], lab = ed.slice(0, -1).map((e, i) => `${e}–${ed[i + 1]} m`);
  new Chart(box("c7", "Histogram tebal zona per lubang"), { type: "bar", data: { labels: lab, datasets: [{ label: "Limonit", data: hist(holes.map((h) => Number(h.tebal_limonit)), ed), backgroundColor: "#E8892B" }, { label: "Saprolit", data: hist(holes.map((h) => Number(h.tebal_saprolit)), ed), backgroundColor: "#1E9E69" }] }, options: { scales: { y: { title: { display: true, text: "jumlah lubang" } } } } });
  const nl = holes.reduce((s, h) => s + h.conto_limonit, 0), ns = holes.reduce((s, h) => s + h.conto_saprolit, 0), nt = holes.reduce((s, h) => s + h.jumlah_conto, 0);
  new Chart(box("c8", "Jumlah conto per zona"), { type: "pie", data: { labels: ["Limonit", "Saprolit", "TP / batuan dasar"], datasets: [{ data: [nl, ns, nt - nl - ns], backgroundColor: ["#E8892B", "#1E9E69", "#7A8B83"] }] } });
  const re = [0, 50, 70, 80, 90, 95, 100.01];
  new Chart(box("c9", "Histogram recovery per lubang (%)"), { type: "bar", data: { labels: ["<50", "50–70", "70–80", "80–90", "90–95", "95–100"], datasets: [{ label: "lubang", data: hist(holes.map((h) => Number(h.recovery_pct)).filter(isFinite), re), backgroundColor: ["#C8281F", "#C8281F", "#E8892B", "#D4B12A", "#1E9E69", "#1E9E69"] }] } });
  const avg = (k) => { const xs = holes.map((h) => Number(h[k])).filter((x) => isFinite(x) && x > 0); return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null; };
  new Chart(box("c10", "Rata-rata density kering per zona (t/m³)"), { type: "bar", data: { labels: ["Limonit", "Saprolit"], datasets: [{ label: "dry density", data: [avg("dry_density_limonit"), avg("dry_density_saprolit")], backgroundColor: ["#E8892B", "#1E9E69"] }] } });
}
const isClient = () => me?.role === "client", clientGeo = () => isClient() && !!myTugas?.akses_geologi;
const CLIENT_RIG_DS = ["kinerja", "progres", "ddr", "jam", "bbm", "p2h", "aktivitas"], CLIENT_GEO_DS = ["collar", "survey", "geology", "density", "assay", "qaqc", "lubang"];
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
async function laporanProgres(st) {
  if (!online()) return alert("Laporan perlu sinyal internet.");
  const w = window.open("", "_blank"); if (!w) return alert("Izinkan pop-up untuk membuat laporan.");
  w.document.write("<p style='font-family:Arial'>Menyusun laporan progres…</p>");
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
    const mPer = sum(days, "meter_bor"), mCum = sum(rdAll ?? [], "meter_bor");
    const klien = isClient();
    const K = computeKPI(days, tm ?? [], [], holes).filter(([l]) => !klien || (l !== "Foto core lengkap" && (clientGeo() || !GEO_KPI.includes(l))));
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
    const T = {
      ringkasan: [["Indikator", "Nilai"], ["Periode", `${st.from} s/d ${st.to}`], ["Proyek", PJ?.nama ?? "Semua proyek"], ["Rig", st.rig || "Semua rig"], ["Meter bor periode", mPer.toFixed(1) + " m"], ["Meter bor kumulatif", mCum.toFixed(1) + " m"],
        ["Target meter proyek", PJ?.target_meter ? `${PJ.target_meter} m (${pct(mCum, PJ.target_meter)}%)` : "belum diisi admin"], ["Lubang selesai / dikerjakan", `${nSelesai} / ${HR.length}`], ["Target lubang proyek", PJ?.target_lubang ? `${PJ.target_lubang} (${pct(nSelesai, PJ.target_lubang)}%)` : "belum diisi admin"],
        ...K.filter(([a]) => a !== "Total meter bor").map(([a, b]) => [a, b])],
      rig: [["Rig", "Hari aktif", "Meter", "Run", "m/jam", "m/hari aktif", "Standby+perbaikan (jam)", "BBM (L)", "BBM (L/m)", "P2H", "DDR ber-TTD"], ...rigRows],
      harian: [["Tanggal", "Rig aktif", "Meter", "Kumulatif proyek"], ...dayRows],
      lubang: [["BHID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Logging (m)", "Conto", "Status logging", "Limonit (m)", "Saprolit (m)", "Recovery %", "Status lubang"],
        ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", +f2(h.logm) || 0, h.conto, h.lstat, h.tl == null ? "" : +f1(h.tl), h.ts == null ? "" : +f1(h.ts), h.rec == null ? "" : Math.round(h.rec), h.selesai ? "SELESAI" : "BERJALAN"])],
      standby: [["Penyebab", "Jam"], ...sbRows],
      operator: [["Operator", "Peran", "Rig", "Hari wajib", "Lengkap", "Sebagian", "Belum", "% lengkap", "Kekurangan terbanyak"], ...opRows],
      qc: [["Butir", "Jumlah"], ...qcRows],
      catatan: [["Catatan otomatis"], ...notes.map((x) => [x])],
    };
    const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
    if (klien) T.lubang = T.lubang.map((r) => (clientGeo() ? [r[0], r[1], r[2], r[3], r[4], r[5], r[7], r[9], r[10], r[11], r[12]] : [r[0], r[1], r[2], r[3], r[4], r[5], r[12]]));
    for (const [k, nm] of [["ringkasan", "Ringkasan"], ["catatan", "Catatan"], ["rig", "Per rig"], ["harian", "Harian"], ["lubang", "Status lubang"], ["standby", "Standby"], ...(klien ? [] : [["operator", "Kepatuhan operator"], ["qc", "Data & QC"]])])
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(T[k]), nm);
    const fname = `TGEP_Laporan_Progres_${st.proj || "semua"}_${st.from}_${st.to}.xlsx`;
    window._lapDL = () => X.writeFile(wb, fname);
    const tbl = (a, opt = {}) => `<table>${a.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${esc(String(c))}</th>` : `<td${opt.col && /TERLAMBAT|BELUM\b/.test(String(c)) ? ' style="background:#F6C9C3"' : ""}>${esc(String(c ?? ""))}</td>`)).join("")}</tr>`).join("")}</table>`;
    const mx = Math.max(1, ...dayRows.map((r) => r[2])), bw = dayRows.length ? Math.min(40, Math.max(4, Math.floor(680 / dayRows.length) - 2)) : 10;
    const svg = dayRows.length ? `<svg width="720" height="170" style="border:1px solid #ddd;background:#fff">${dayRows.map((r, i) => { const h = (130 * r[2]) / mx; return `<rect x="${30 + i * (bw + 2)}" y="${145 - h}" width="${bw}" height="${h}" fill="#1E9E69"><title>${r[0]}: ${r[2]} m</title></rect>`; }).join("")}<text x="4" y="14" font-size="10">${mx.toFixed(0)} m</text><text x="30" y="162" font-size="10">${dayRows[0][0]}</text><text x="600" y="162" font-size="10">${dayRows.at(-1)[0]}</text></svg>` : "<p>Tidak ada data bor pada periode ini.</p>";
    w.document.open(); w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Progres ${esc(PJ?.nama ?? "TGEP")} ${st.from}–${st.to}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:18px;color:#111;max-width:1000px} h1{font-size:18px;margin:0} h2{font-size:13px;margin:14px 0 4px;color:#12251E;border-bottom:2px solid #1E9E69} table{border-collapse:collapse;width:100%;margin:4px 0} td,th{border:1px solid #999;padding:3px 5px;text-align:left} th{background:#e6efe9} ul{margin:4px 0 4px 18px} .bar{display:flex;gap:8px;margin-bottom:10px} .bar a,.bar button{padding:6px 10px;border:1px solid #1E9E69;border-radius:6px;background:#fff;color:#12251E;text-decoration:none;font:inherit;cursor:pointer} @media print{.bar{display:none} h2{break-after:avoid} tr{break-inside:avoid}}</style></head><body>
    <div class="bar"><button onclick="print()">Cetak / simpan PDF</button><button onclick="try{opener._lapDL()}catch(e){alert('Buka ulang laporan dari menu Dashboard untuk mengunduh Excel.')}">Unduh Excel laporan</button></div>
    <h1>LAPORAN PROGRES PEMBORAN & DATA EKSPLORASI</h1><div>PT Terra Grapindo Eco Prima · ${esc(PJ?.nama ?? "Semua proyek")} · periode <b>${st.from} s/d ${st.to}</b>${st.rig ? " · rig " + esc(st.rig) : ""}</div>
    <h2>1. Ringkasan</h2>${tbl(T.ringkasan)}
    <h2>2. Catatan & hal yang perlu ditindaklanjuti</h2><ul>${notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <h2>3. Progres per rig</h2>${tbl(T.rig)}
    <h2>4. Meter bor harian</h2>${svg}${tbl(T.harian)}
    <h2>5. Status lubang</h2>${klien ? tbl(clientGeo() ? [["BHID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Conto", "Limonit (m)", "Saprolit (m)", "Recovery %", "Status lubang"], ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", h.conto, h.tl == null ? "" : +f1(h.tl), h.ts == null ? "" : +f1(h.ts), h.rec == null ? "" : Math.round(h.rec), h.selesai ? "SELESAI" : "BERJALAN"])] : [["BHID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Status lubang"], ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", h.selesai ? "SELESAI" : "BERJALAN"])]) : tbl(T.lubang, { col: 1 })}<p style="color:#555">SELESAI = tanggal selesai terisi atau kedalaman ≥ target/total depth di DDR. Kedalaman dari foto RUN aplikasi${klien ? "" : "; tebal zona dan recovery dari Form Logging yang sudah disetujui"}.</p>
    <h2>6. Penyebab standby & perbaikan</h2>${sbRows.length ? tbl(T.standby) : "<p>Tidak ada standby/perbaikan tercatat.</p>"}
    ${klien ? "" : `<h2>7. Kepatuhan pengiriman operator</h2>${opRows.length ? tbl(T.operator, { col: 1 }) : "<p>Belum ada data operator.</p>"}
    <h2>8. Kelengkapan data & QC</h2>${tbl(T.qc)}`}
    <table style="margin-top:24px"><tr><td style="height:70px;width:50%;vertical-align:top"><b>Disusun oleh</b><br><br><br>Nama / tanggal:</td><td style="vertical-align:top"><b>Diperiksa oleh</b><br><br><br>Nama / tanggal:</td></tr></table>
    <small>Dibuat otomatis dari database aplikasi TGEP Scan Drill Log · ${new Date().toLocaleString("id-ID")} · oleh ${esc(me?.full_name ?? "")}. Angka mengikuti data yang sudah masuk server saat laporan dibuat.</small></body></html>`);
    w.document.close();
  } catch (e) { w.document.body.innerHTML = `<p style="font-family:Arial;color:#b00">Gagal menyusun laporan: ${esc(e.message)}</p>`; }
}
// ---------- Akun client: laporan per rig (baca saja) ----------
async function aksesKlien(box) {
  const [{ data: us }, { data: pn }, { data: pj }] = await Promise.all([sb.from("app_user").select("user_id,full_name,company,email").eq("role", "client").order("full_name"), sb.from("penugasan").select("*"), sb.from("project").select("code,nama,rigs,aktif").order("nama")]);
  const P = Object.fromEntries((pn ?? []).map((p) => [p.user_id, p]));
  box.innerHTML = `<h3>Akses akun client</h3><p class="muted">Client bisa melihat dan mengunduh Dashboard, Laporan rig dan Database data rig (DDR, progres, BBM, P2H, aktivitas) serta Dokumen yang dibuka untuk peran client. Centang “boleh lihat & unduh data geologi” agar client juga mendapat collar, survey, geologi, density, assay dan QAQC <b>yang sudah disetujui</b> untuk lubang proyeknya. Foto core dan scan formulir hanya terbuka setelah Anda merilisnya (kotak di bawah); data operator tidak pernah dibuka untuk client. Pilih proyek: client melihat semua rig proyek itu; centang rig bila hanya rig tertentu.</p>
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
  $("#kr").innerHTML = `<h3>Ringkasan per rig</h3><div class="tw"><table><tr><th>Rig</th><th>Hari aktif</th><th>Meter</th><th>m/jam</th><th>Standby (jam)</th><th>BBM (L)</th><th>L/m</th><th>P2H ada</th><th>DDR ber-TTD</th></tr>
    ${rigs.map((r) => { const xs = days.filter((d) => d.rig === r), a = xs.filter((d) => n(d.meter_bor) > 0), m = xs.reduce((s, d) => s + n(d.meter_bor), 0), j = xs.reduce((s, d) => s + n(d.jam_kerja_bor), 0), b = xs.reduce((s, d) => s + n(d.bbm_liter), 0);
      return `<tr><td><b>${esc(r)}</b></td><td>${a.length}</td><td>${f1(m)}</td><td>${j ? (m / j).toFixed(2) : "-"}</td><td>${f1(xs.reduce((s, d) => s + n(d.standby_menit), 0) / 60)}</td><td>${b.toFixed(0)}</td><td>${m ? (b / m).toFixed(2) : "-"}</td><td>${a.filter((d) => d.ada_p2h).length}/${a.length}</td><td>${a.filter((d) => d.n_ddr_ttd > 0).length}/${a.length}</td></tr>`; }).join("")}</table></div>
    <h3>Rekap harian</h3><div class="tw"><table><tr><th>Tanggal</th><th>Rig</th><th>Meter</th><th>Run</th><th>Recovery %</th><th>Jam bor</th><th>Standby (mnt)</th><th>m/jam</th><th>BBM (L)</th><th>P2H</th><th>DDR (TTD)</th><th>Kejadian</th></tr>
    ${(days ?? []).map((d) => `<tr><td>${d.tanggal}</td><td>${esc(d.rig)}</td><td>${f1(d.meter_bor)}</td><td>${d.jumlah_run ?? ""}</td><td>${d.recovery_pct ?? ""}</td><td>${f1(d.jam_kerja_bor)}</td><td>${d.standby_menit ?? ""}</td><td>${d.meter_per_jam ?? ""}</td><td>${d.bbm_liter ?? ""}</td>
      <td style="${!d.ada_p2h || d.p2h_bermasalah ? "background:#F6C9C3" : ""}">${d.ada_p2h ? (d.p2h_bermasalah ? "ada masalah" : "OK") : "tidak ada"}</td><td>${d.n_ddr ?? 0} (${d.n_ddr_ttd ?? 0})</td><td>${esc(String(d.kejadian_bermasalah ?? ""))}</td></tr>`).join("")}</table></div>`;
  $("#kd").innerHTML = `<h3>DDR (${(dl ?? []).length})</h3><ul class="list">${(dl ?? []).map((d) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(d.report_date)} · ${d.shift === "PAGI" ? "Day" : "Night"} · ${esc(d.rig)}</b> ${esc(d.bhid ?? "")}<br><span class="muted">${d.status === "SIGNED" ? "lengkap ditandatangani" : "draf"} · ${f1(d.coring_ddr_m)} m coring · ${esc(d.ttd ?? "belum ada TTD")}</span></span>
    <button class="sec" data-pr="${d.id}" style="flex:0">Lihat / cetak</button></li>`).join("") || `<li class="muted">Belum ada DDR.</li>`}</ul>`;
  $("#kd").querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.pr)));
  $("#xl").onclick = async () => {
    $("#info").textContent = "Menyiapkan Excel…";
    try {
      const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
      const flat = (rows) => (rows ?? []).map((r) => { const o = { ...r }; delete o.data; delete o.related; for (const c in o) if (o[c] && typeof o[c] === "object") o[c] = Array.isArray(o[c]) && o[c].every((x) => typeof x !== "object") ? o[c].join("; ") : JSON.stringify(o[c]); return o; });
      const src = [["Kinerja rig harian", "v_dash_rig_day", "tanggal"], ["Progres harian bor", "v_drill_progress_daily", "tanggal"], ["DDR", "v_ddr_list", "report_date"], ["Distribusi jam DDR", "v_ddr_hours", "tanggal"], ["BBM oli barang", "v_consumable_use", "report_date"], ["Aktivitas bor", "v_drill_event_qc", "captured_at"], ["P2H", "p2h_check", "captured_at"]];
      for (const [nm, vw, col] of src) {
        const out = []; for (let i = 0; ; i += 1000) { let q = sb.from(vw).select("*"); q = col === "captured_at" ? q.gte(col, `${st.from}T00:00:00+07:00`).lte(col, `${st.to}T23:59:59+07:00`) : q.gte(col, st.from).lte(col, st.to); if (st.rig) q = q.eq("rig", st.rig);
          const { data, error: e } = await q.order(col).range(i, i + 999); if (e) throw e; out.push(...data); if (data.length < 1000) break; }
        X.utils.book_append_sheet(wb, out.length ? X.utils.json_to_sheet(flat(out)) : X.utils.aoa_to_sheet([["(kosong)"]]), nm);
      }
      X.writeFile(wb, `TGEP_Rekap_Rig_${st.rig || "semua"}_${st.from}_${st.to}.xlsx`); $("#info").textContent = "Excel diunduh (7 sheet).";
    } catch (e) { $("#info").textContent = e.message; }
  };
}

// ---------- Rilis foto core / scan ke client (admin) ----------
const RILIS = { FOTO_CORE: "Foto core", SCAN_LOGGING: "Scan Form Logging (disetujui)", FORM_ARSIP: "Foto formulir arsip" };
async function rilisAdmin(box) {
  box.innerHTML = `<h3>Rilis foto & scan ke client</h3><p class="muted">Memuat…</p>`;
  const [{ data: cp }, { data: sj }, { data: fp }, { data: rl }] = await Promise.all([
    sb.from("core_photo").select("bhid,ditolak").limit(20000), sb.from("scan_job").select("bhid_hint,status").eq("status", "APPROVED").limit(20000),
    sb.from("form_photo").select("bhid").not("bhid", "is", null).limit(20000), sb.from("client_release").select("*")]);
  const cnt = {}; const add = (b, j) => { if (!b) return; (cnt[b] ??= { FOTO_CORE: 0, SCAN_LOGGING: 0, FORM_ARSIP: 0 })[j]++; };
  (cp ?? []).filter((c) => !c.ditolak).forEach((c) => add(c.bhid, "FOTO_CORE")); (sj ?? []).forEach((s) => add(s.bhid_hint, "SCAN_LOGGING")); (fp ?? []).forEach((f) => add(f.bhid, "FORM_ARSIP"));
  const R = new Set((rl ?? []).map((r) => `${r.bhid}|${r.jenis}`)), bh = Object.keys(cnt).sort();
  box.innerHTML = `<h3>Rilis foto & scan ke client</h3><p class="muted">Foto core, scan Form Logging dan foto formulir <b>tidak terlihat</b> oleh client sampai Anda merilisnya per lubang. Setelah dicentang, client yang proyeknya mencakup lubang itu langsung bisa melihat & mengunduh di menu “Foto & scan”. Hilangkan centang untuk menarik kembali. Foto core yang ditolak dan scan yang belum disetujui tidak pernah ikut terkirim.</p>
    <div class="row" style="flex-wrap:wrap"><input id="rf" placeholder="cari BHID" style="max-width:180px"></div>
    <div class="tw"><table id="rt"><tr><th>BHID</th>${Object.values(RILIS).map((t) => `<th>${t}</th>`).join("")}</tr>
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
async function loadTugas() {
  if (!online()) return myTugas;
  const [{ data: a, error }, { data: pj }] = await Promise.all([sb.rpc("my_assignment"), sb.from("project").select("*").eq("aktif", true).order("nama")]);
  localStorage.setItem("projects", JSON.stringify(pj ?? []));
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
function rigField() {
  const cur = localStorage.getItem("rig") || "";
  if (!rigTerkunci()) return `<input id="rg" value="${esc(cur)}" placeholder="mis. RIG 1" autocapitalize="characters">`;
  const rs = myTugas.rigs ?? [];
  if (rs.length > 1) return `<select id="rg">${rs.map((r) => `<option ${myTugas.rig === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>`;
  return `<input id="rg" value="${esc(myTugas.rig ?? "")}" placeholder="semua rig proyek" readonly title="Rig diatur admin">`;
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
    <p class="muted">Kewajiban harian — driller: P2H, foto progres, DDR/TTD DDR; geologist: foto core, pada hari rig yang ditugaskan beroperasi. Form Logging dinilai per lubang dengan tenggat (boleh dikirim besoknya). Penugasan rig diatur admin di bagian bawah.</p></div>
    <div id="rs" class="card">Memuat…</div><div id="rl" class="card"></div><div id="rm" class="card"></div>${me?.role === "admin" ? `<div id="rp" class="card"></div><div id="rpj" class="card"></div>` : ""}`;
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
    ${day.map((r) => `<tr><td><b>${esc(r.nama ?? "-")}</b><br><span class="muted">${esc(r.perusahaan ?? "")}</span></td><td>${esc(r.peran)}<br>${esc(r.rig ?? "—")}</td>
      <td style="background:${ST_COL[r.status] ?? "#fff"}">${esc(r.status)}</td><td>${esc((r.kurang ?? []).join(", "))}</td>
      <td>${r.p2h}</td><td>${r.progres}</td><td>${r.ddr_ttd}</td><td>${r.fbor}</td><td>${r.foto_core}</td><td>${r.arsip}</td><td style="${r.peran === "geologist" && r.lubang_logging_terlambat ? "background:#F6C9C3" : ""}">${r.peran === "geologist" ? (r.lubang_logging_terlambat ? r.lubang_logging_terlambat + " lubang" : "0") : "-"}</td><td>${r.terakhir ? fmtT(r.terakhir).slice(-8) : "-"}</td>
      <td style="${r.antrean > 0 ? "background:#F6C9C3" : ""}">${r.antrean ? `<b>${r.antrean} antre</b> sejak ${ago(r.antrean_tertua)}<br>` : ""}online ${ago(r.last_seen)}${r.app_version && r.app_version !== APP_VERSION ? `<br><span class="err">versi lama ${esc(r.app_version)}</span>` : ""}</td>
      <td><button class="sec" data-fd="${r.user_id}" data-nm="${esc(r.nama ?? "")}" style="flex:0">Folder</button></td></tr>`).join("") || `<tr><td colspan="14" class="muted">Belum ada operator (driller/geologist) yang disetujui.</td></tr>`}</table></div>`;
  logLubang($("#rl"));
  const dates = [...Array(14)].map((_, i) => new Date(Date.parse(tgl) - (13 - i) * 864e5).toISOString().slice(0, 10)), ops = [...new Map((all ?? []).map((r) => [r.user_id, r])).values()];
  const sym = { LENGKAP: "✓", SEBAGIAN: "½", BELUM: "✗", "RIG TIDAK BEROPERASI": "–", "TANPA PENUGASAN": "?", "ADA KIRIMAN (TANPA PENUGASAN)": "+", "TIDAK WAJIB": "–" };
  $("#rm").innerHTML = `<h3>14 hari terakhir</h3><p class="muted">✓ lengkap · ½ sebagian · ✗ belum · – rig tidak beroperasi / tidak wajib · ? tanpa penugasan</p><div class="tw"><table><tr><th>Operator</th>${dates.map((d) => `<th>${d.slice(8)}/${d.slice(5, 7)}</th>`).join("")}<th>% lengkap</th></tr>
    ${ops.map((o) => { const rs = dates.map((d) => (all ?? []).find((r) => r.user_id === o.user_id && r.tanggal === d)); const wajib = rs.filter((r) => r && ["LENGKAP", "SEBAGIAN", "BELUM"].includes(r.status)); const ok = wajib.filter((r) => r.status === "LENGKAP").length;
      return `<tr><td>${esc(o.nama ?? "-")} <span class="muted">${esc(o.rig ?? "")}</span></td>${rs.map((r) => `<td style="text-align:center;background:${ST_COL[r?.status] ?? "#fff"}" title="${esc(r?.status ?? "")}${r?.kurang?.length ? " — " + esc(r.kurang.join(", ")) : ""}">${sym[r?.status] ?? ""}</td>`).join("")}<td><b>${wajib.length ? Math.round((100 * ok) / wajib.length) + "%" : "-"}</b></td></tr>`; }).join("")}</table></div>`;
  v.querySelectorAll("[data-fd]").forEach((b) => (b.onclick = () => folderView(v, b.dataset.fd, b.dataset.nm)));
  $("#rcsv").onclick = () => { const cols = ["tanggal", "nama", "perusahaan", "peran", "rig", "status", "kurang", "p2h", "progres", "ddr_ttd", "fbor", "foto_core", "arsip", "lubang_logging_terlambat", "total_kiriman", "terakhir", "antrean", "last_seen", "app_version"];
    const csv = [cols.join(","), ...(all ?? []).map((r) => cols.map((c) => `"${String(Array.isArray(r[c]) ? r[c].join("; ") : r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `TGEP_Rekap_Operator_${from14}_${tgl}.csv`; a.click(); };
  if (me?.role === "admin") {
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
    <div class="tw"><table><tr><th>BHID</th><th>Rig</th><th>Bor (m)</th><th>Logging (m)</th><th>Belum (m)</th><th>Conto</th><th>Scan menunggu</th><th>Belum sejak</th><th>Status</th></tr>
    ${rows.map((l) => `<tr><td><b>${esc(l.bhid)}</b></td><td>${esc(l.rig ?? "")}</td><td>${l.kedalaman_bor ?? ""}</td><td>${l.kedalaman_logging}</td><td>${l.belum_logging_m}</td><td>${l.jumlah_conto}</td><td>${l.scan_menunggu}</td><td>${l.belum_sejak ? `${fmtT(l.belum_sejak).slice(0, 10)} (${l.umur_hari} hr)` : "-"}</td><td style="background:${col[l.status] ?? "#fff"}">${esc(l.status)}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">Belum ada lubang dengan foto RUN.</td></tr>`}</table></div>`;
  box.querySelector("#gs")?.addEventListener("click", async () => { const { error: e } = await sb.from("qc_param").update({ value: Number(box.querySelector("#gd").value) }).eq("name", "LOGGING_GRACE_DAYS"); if (e) return alert(e.message); logLubang(box); });
}
async function folderView(v, uid, nama) {
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
    $("#fl").innerHTML = `<p><b>${(data ?? []).length}</b> kiriman · ${tot.map(([k, n]) => `${esc(k)} ${n}`).join(" · ") || "-"}</p>` + (Object.entries(byDay).map(([d, rs]) => `<h3 style="margin:12px 0 4px">${d} <span class="muted">(${rs.length})</span></h3><ul class="list">${rs.map((r) => `<li style="flex-wrap:wrap"><span style="flex:1">${fmtT(r.waktu).slice(-8)} · <b>${esc(r.jenis)}</b> ${esc(r.rig ?? "")} ${esc(r.bhid ?? "")}${r.status ? ` <span class="pill ${esc(r.status)}">${esc(r.status)}</span>` : ""}<br><span class="muted">${esc(r.ket ?? "")}</span></span>${r.photo_path && r.bucket ? `<button class="sec" data-b="${esc(r.bucket)}" data-p="${esc(r.photo_path)}" style="flex:0">Lihat</button>` : r.jenis === "DDR" || r.jenis === "TTD DDR" ? `<button class="sec" data-ddr="${r.ref_id}" style="flex:0">DDR</button>` : ""}</li>`).join("")}</ul>`).join("") || `<p class="muted">Tidak ada kiriman pada periode ini.</p>`);
    $("#fl").querySelectorAll("[data-p]").forEach((b) => (b.onclick = async () => { const { data: u } = await sb.storage.from(b.dataset.b).createSignedUrl(b.dataset.p, 3600); if (u?.signedUrl) window.open(u.signedUrl, "_blank"); else alert("Foto tidak dapat dibuka."); }));
    $("#fl").querySelectorAll("[data-ddr]").forEach((b) => (b.onclick = () => printDDR(b.dataset.ddr)));
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
      <label>Boleh diunduh oleh</label><div class="row">${["driller", "geologist", "verifier", "admin", "client"].map((r) => `<label style="flex:0;white-space:nowrap"><input type="checkbox" value="${r}" class="ur" ${r !== "driller" ? "checked" : ""}> ${r}</label>`).join("")}</div>
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
  jam: { t: "Distribusi jam DDR", v: "v_ddr_hours", order: ["tanggal", "rig"], bh: "bhid" },
  bbm: { t: "Pemakaian BBM, oli & barang", v: "v_consumable_use", order: ["report_date", "rig"], bh: "bhid" },
  lubang: { t: "Ringkasan per lubang", v: "v_dash_hole", order: ["bhid"], bh: "bhid" },
  kinerja: { t: "Kinerja rig harian", v: "v_dash_rig_day", order: ["tanggal", "rig"], bh: null },
  arsipfoto: { t: "Foto formulir arsip", v: "form_photo", order: ["created_at"], bh: "bhid" },
  kepatuhan: { t: "Rekap operator harian", v: "v_kepatuhan_harian", order: ["tanggal", "nama"], bh: null },
  logging: { t: "Status Form Logging per lubang", v: "v_logging_lubang", order: ["bhid"], bh: "bhid" },
  koreksi: { t: "Riwayat koreksi", v: "sample_edit_log", order: ["edited_at"], bh: null },
  arsip: { t: "Arsip terhapus (admin)", v: "deleted_record", order: ["deleted_at"], bh: "bhid", admin: true },
};
const OKV = new Set(["OK", "OK-SW", "MENUNGGU LAB", "MENUNGGU CEK"]);
function dbQuery(d, f) {
  let q = sb.from(d.v).select("*", { count: "exact" });
  if (f.bh && d.bh) q = q.ilike(d.bh, `%${f.bh}%`);
  if (f.proj) { if (d.bh) q = q.in(d.bh, f.proj.bhids.length ? f.proj.bhids : ["-"]); else if (["v_dash_rig_day", "p2h_check", "v_kepatuhan_harian"].includes(d.v)) q = q.in("rig", f.proj.rigs.length ? f.proj.rigs : ["-"]); }
  if (f.bad && d.bad && ["chk_harian", "flags"].includes(d.bad[0])) q = q.neq(d.bad[0], "");
  else if (f.bad && d.bad) q = q.or(d.bad.map((c) => `and(${c}.not.is.null,${c}.not.in.(${[...OKV].map((x) => `"${x}"`).join(",")}))`).join(","));
  const desc = ["v_kepatuhan_harian", "deleted_record", "sample_edit_log", "v_drill_progress_daily", "v_drill_event_qc", "p2h_check", "form_photo", "v_ddr_list", "v_ddr_hours", "v_consumable_use", "v_dash_rig_day"].includes(d.v);
  for (const o of d.order) q = q.order(o, { ascending: !desc });
  return q;
}
async function fetchAll(d, f) {
  const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await dbQuery(d, f).range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; }
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
    <div><label>BHID (sebagian)</label><input id="fb" value="${esc(st.bh)}" placeholder="mis. TGE00"></div>
    <div style="flex:0;white-space:nowrap"><label><input type="checkbox" id="fbad" ${st.bad ? "checked" : ""} style="width:auto"> hanya yang bermasalah</label></div>
    <button id="go" style="flex:0">Tampilkan</button>
    <button class="sec" id="xl" style="flex:0">Unduh Excel (semua tabel)</button>
    <button class="sec" id="csv" style="flex:0">Unduh CSV tabel ini</button>
   </div><div id="info" class="muted" style="margin-top:8px"></div></div>
   <div class="card"><div id="tb"></div><div class="row" style="margin-top:8px"><button class="sec" id="pv" style="flex:0">← Sebelumnya</button><button class="sec" id="nx" style="flex:0">Berikutnya →</button></div></div>`;
  let projF = null;
  const read = () => ({ ds: $("#ds").value, bh: $("#fb").value.trim().toUpperCase(), bad: $("#fbad").checked, page: st.page, proj: projF });
  $("#fproj").onchange = async () => { sessionStorage.setItem("filterProyek", $("#fproj").value); projF = await proyekFilter(); };
  projF = await proyekFilter();
  const show = async (page = 0) => {
    const f = read(); f.page = page; sessionStorage.setItem("dbst", JSON.stringify({ ...f, proj: undefined })); st.page = page;
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
      for (const k of dsAllowed() ?? ["collar", "survey", "geology", "density", "assay", "qaqc", "foto", "progres", "aktivitas", "p2h", "ddr", "jam", "bbm", "lubang", "kinerja", "logging", "kepatuhan"]) {
        const rows = (await fetchAll(DATASETS[k], { ...f, bad: false })).map((r) => { const o = { ...r }; delete o.data; delete o.related; for (const c in o) if (Array.isArray(o[c])) o[c] = o[c].join("; "); return o; }); got[k] = rows;
        X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), DATASETS[k].t.slice(0, 31).replace(/[\\/?*\[\]:]/g, " "));
      }
      const { data: tmx } = await sb.from("v_dash_time").select("*");
      got.lubang ??= []; const K = computeKPI(got.kinerja, tmx ?? [], got.bbm, got.lubang.filter((h) => h.jumlah_conto > 0)).filter(([l]) => !isClient() || (l !== "Foto core lengkap" && (clientGeo() || !GEO_KPI.includes(l))));
      const aoa = [["DASHBOARD RINGKASAN — TGEP", "", `dibuat ${new Date().toLocaleString("id-ID")}`], [], ["Indikator", "Nilai"], ...K.map(([a, b]) => [a, b]), [], ["Meter & BBM per rig", "Meter", "BBM (L)", "L/m", "Jam bor", "m/jam"]];
      const rg = {}; for (const d of got.kinerja) { const r = (rg[d.rig] ??= { m: 0, b: 0, j: 0 }); r.m += +d.meter_bor || 0; r.b += +d.bbm_liter || 0; r.j += +d.jam_kerja_bor || 0; }
      for (const [r, x] of Object.entries(rg)) aoa.push([r, +x.m.toFixed(2), +x.b.toFixed(1), x.m ? +(x.b / x.m).toFixed(2) : "", +x.j.toFixed(2), x.j ? +(x.m / x.j).toFixed(2) : ""]);
      aoa.push([], ["Tebal zona per lubang", "Limonit (m)", "Saprolit (m)", "Conto", "Recovery %"]);
      for (const h of got.lubang.filter((h) => h.jumlah_conto > 0)) aoa.push([h.bhid, h.tebal_limonit, h.tebal_saprolit, h.jumlah_conto, h.recovery_pct]);
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), "Dashboard");
      X.writeFile(wb, `TGEP_Database_${tag()}.xlsx`); $("#info").textContent = isClient() ? "Excel diunduh (sheet terakhir = Dashboard)." : "Excel diunduh (18 sheet termasuk Rekap operator & Status Form Logging; sheet terakhir = Dashboard). Grafik lengkap ada di menu Dashboard dan di ekspor harian Google Drive.";
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
