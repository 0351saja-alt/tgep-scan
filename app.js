// X-Terra (dulu X-Terra) — aplikasi web untuk HP (bisa dipasang & dipakai offline)
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
const HDR = [["bhid","Hole ID"],["area","Area"],["prospect","Prospek"],["grid","Grid"],["start_date","Mulai"],["stop_date","Selesai"],["xgps","X GPS"],["ygps","Y GPS"],["zgps","Z GPS"],
 ["rigmc_id","Rig"],["teamleader","Ketua tim"],["operator","Operator"],["logger","Logger"],["field_geos","Field geos"],["depth_tp","Akhir TP"],["depth_l","Akhir L"],["depth_s","Akhir S"],
 ["total_depth","EOH"],["total_sample","Total sample"],["water_table","Air tanah"],["core_size","Core size"],["core_barrel_type","Barrel"],["samptype_id","Tipe conto"],
 ["drilprpose_id","Tujuan"],["spacing_id","Spasi"],["morphology_id","Morfologi"],["weather_id","Cuaca"],["vgtation_id","Vegetasi"],["brtype_id","Batuan dasar"],["comment","Komentar"]];
const SHEET = [["seq","No"],["depth_from","From"],["depth_to","To"],["core_length","Core L"],["lose_from","Loss dari"],["lose_to","Loss sampai"],["geozone_id","Zona"],
 ["geolithcode_id_1","Lito1"],["geolithcode_prc_1","%1"],["geolithcode_id_2","Lito2"],["geolithcode_prc_2","%2 (hitung)"],["colour","Warna"],["geohrdns_id","Hard"],["geowthrg_id","Wth"],["geosrp_id","Serp"],
 ["total_silica","Sil%"],["total_garnierit","Gar%"],["geomnrlcode_id_1","Min1"],["min_1_prc","%"],["geomnrlcode_id_2","Min2"],["min_2_prc","%"],
 ["d_length_cm","P cm"],["d_diameter_cm","D cm"],["d_weight_gr","Basah g"],["d_volume_measure_ml","Arch Vol2 ml"],["d_wet_weight","Conto kg"],["comment","Komentar"]];
const SHDR = [["bhid","Hole ID"],["date","Tanggal"],["page","Hal."],["logger","Logger"],["rigmc_id","Rig"],["xgps","X GPS"],["ygps","Y GPS"],["zgps","Z GPS"],["total_depth","EOH"],["core_size","Core size"]];
const PHDR = [["bhid","Hole ID"],["page","Halaman"],["date","Tanggal"],["logger","Logger/petugas"]];
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
const qPut = (x) => q("readwrite", (s) => s.put({ antre_at: Date.now(), ...x })); // antre_at: kapan pertama masuk antrean
const qDel = (k) => q("readwrite", (s) => s.delete(k));

// ---------- notifikasi singkat ----------
function toast(t) { const el = Object.assign(document.createElement("div"), { textContent: t }); el.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:70;background:#12251E;color:#fff;padding:9px 14px;border-radius:10px;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.3)"; document.body.appendChild(el); setTimeout(() => el.remove(), 3500); }
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
  if (!el) { el = Object.assign(document.createElement("div"), { id: "antreLama" }); el.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:60;padding:10px 12px;border-radius:12px;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.25);display:flex;gap:8px;align-items:center"; document.body.appendChild(el); }
  const err = L.find((x) => x.error)?.error;
  el.style.background = lama.length ? "#F6C9C3" : "#FFE58A";
  el.innerHTML = `<span style="flex:1">${lama.length ? `⚠ <b>${lama.length}</b> data antre lebih dari 1 jam` : `⏳ <b>${L.length}</b> data menunggu sinyal`} — terkirim otomatis begitu ada sinyal.${err ? `<br><small>Galat terakhir: ${esc(err)}</small>` : ""}${!navigator.onLine ? "<br><small>HP sedang offline.</small>" : ""}</span><button style="flex:0;white-space:nowrap;padding:8px 12px" id="antreKirim">Kirim sekarang</button>`;
  el.querySelector("#antreKirim").onclick = async () => { el.querySelector("#antreKirim").textContent = "Mengirim…"; await sync(); cekAntreLama(); };
}
const APP_VERSION = "2026-11-17.41";
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
  syncing = true; const n0 = (await qAll()).length;
  try {
    for (const it of await qAll()) {
      if (it.kind === "core") { await syncCore(it); continue; }
      if (it.kind === "event" || it.kind === "p2h") { await syncProg(it); continue; }
      if (it.kind === "ddr") { await syncDDR(it); continue; }
      if (it.kind === "arsip") { await syncArsip(it); continue; }
      if (it.kind === "marking") { const r = await sb.from("marking").upsert(it.row, { onConflict: "client_uuid", ignoreDuplicates: true });
        if (r.error) { it.error = r.error.message; await qPut(it); } else await qDel(it.client_uuid); continue; }
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
  } finally { syncing = false; const n1 = (await qAll()).length; if (n0 > n1) toast(`✓ ${n0 - n1} data terkirim${n1 ? ` · ${n1} masih antre` : ""}`); cekAntreLama(); beat(true); loadLanjutan(); jadwalCekTolak(); if (["foto", "core", "prog", "ddr"].includes(tab)) render(); }
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
  if (online() && !sessionStorage.getItem("tugasLoaded")) { sessionStorage.setItem("tugasLoaded", "1"); await loadTugas(); loadLanjutan(); }
  setTimeout(() => cekZonaBaru(), 1500);
  if (!["client", "admin", "verifier"].includes(me?.role) && (!myTugas || myTugas.pilih_rig) && !sessionStorage.getItem("proyekOk")) return pilihProyekView(false);
  const R = me?.role, staff = ["geologist", "verifier", "admin"].includes(R), ver = ["verifier", "admin"].includes(R);
  const navs = R === "client" ? [["dash", "Dashboard"], ["klien", "Laporan rig"], ["db", "Database"], ["fk", "Foto & scan"], ["peta", "Peta"], ["dok", "Dokumen"]] : [["prog", "Progres bor"], ["ddr", "DDR"], ["foto", "Foto formulir"], ...(staff ? [["core", "Foto core"]] : []),
    ...(ver ? [["review", "Periksa scan"], ["data", "Data & cek"], ["db", "Database"], ["dash", "Dashboard"], ["rekap", "Rekap operator"]] : []), ["peta", "Peta"], ...(R === "admin" ? [["users", "Pengguna"]] : []), ["dok", "Dokumen"], ["ttd", "TTD saya"]];
  if (!navs.some(([k]) => k === tab)) tab = navs[0][0];
  // Tombol 📖 Panduan di kepala aplikasi: membuka panduan sesuai peran akun ini (PDF di menu Dokumen juga)
  const PANDUAN = { driller: "driller", geologist: "geologist", verifier: "verifier", admin: "admin", client: "client" };
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
  if (tab === "peta") return petaView($("#v"));
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
  <p class="muted" style="margin-top:12px">Belum punya akun? <a href="daftar.html">Daftar di sini</a> — akun aktif setelah disetujui admin.</p></div>`;
  if (qp.get("email")) $("#em").value = qp.get("email");
  $("#go").onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) $("#e").textContent = /banned/i.test(error.message) ? "Akun ini sudah dinonaktifkan admin. Untuk memakai aplikasi lagi, hubungi admin agar pendaftaran Anda ditinjau ulang." : /invalid login/i.test(error.message) ? "Email atau kata sandi salah. Bila akun Anda sudah dihapus admin, daftar ulang lewat tautan di bawah." : error.message;
    else localStorage.removeItem("aksesDicabut");
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
   <div class="row"><div><label>Hole ID <span id="bhReq">*</span></label><input id="bh" data-bhid value="${esc(localStorage.getItem("bhid") || "")}" placeholder="mis. DH-NPG 01" autocapitalize="characters"></div><div><label>Rig</label>${rigField()}</div></div>
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
    const jenis = $("#jn").value, bhid = bakuBH($("#bh").value), rig = $("#rg").value.trim().toUpperCase();
    if (jenis === "SHEET" && !bhid) { $("#e").textContent = "Isi Hole ID dulu."; return null; }
    if (jenis !== "SHEET" && !bhid && !rig) { $("#e").textContent = "Isi Hole ID atau Rig supaya arsip bisa dicari."; return null; }
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
  box.querySelectorAll("[data-ar]").forEach((b) => (b.onclick = async () => { bukaFile("scan-photos", b.dataset.ar); }));
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
  v.innerHTML = `<div class="card"><h2>Data tersimpan & hasil cek</h2><div class="row"><input id="bh" placeholder="Hole ID" value="${esc(localStorage.getItem("bhid") || "")}"><button id="go" style="flex:0">Tampilkan</button></div><div id="dout"></div></div>`;
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
   <div class="row"><div><label>Hole ID</label><input id="cb" data-bhid value="${esc(bh)}" autocapitalize="characters"></div><div><label>Jenis foto</label><select id="cty"><option value="UTUH" ${lastType === "UTUH" ? "selected" : ""}>Core UTUH</option><option value="BELAH" ${lastType === "BELAH" ? "selected" : ""}>Core BELAH</option></select></div></div>
   <p id="cl" class="muted"></p>
   <div class="row"><div><label>Kotak ke-</label><input id="cx" inputmode="numeric"></div><div><label>FROM (m)</label><input id="cf" inputmode="decimal"></div><div><label>TO (m)</label><input id="ct" inputmode="decimal"></div></div>
   <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="crt" style="width:auto"> Foto ulang kotak yang sudah pernah dikirim (mis. karena ditolak)</label>
   <p class="muted">Template SOP: 1 corebox per foto, teduh, meteran 0–100 cm, papan Hole ID · nomor kotak · kedalaman terbaca, kamera tegak lurus. Kotak dan kedalaman harus melanjutkan kotak sebelumnya.</p>
   <div class="big"><button id="cgo">📷 Ambil foto corebox</button></div>
   <input id="cfile" type="file" accept="image/*" capture="environment" class="hide"><div id="lc"></div><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean foto core (${qd.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${qd.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.file_name)}${x.local_check.warnings.length ? `<br><span class="err">${x.local_check.warnings.map(esc).join(" · ")}</span>` : ""}${x.error ? `<br><span class="err">${esc(x.error)}</span>` : ""}</span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
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
  $("#cgo").onclick = () => {
    const f = num($("#cf").value), to = num($("#ct").value), box = parseInt($("#cx").value), retake = $("#crt").checked;
    if (!$("#cb").value.trim()) return ($("#e").textContent = "Isi Hole ID.");
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
    const bhid = bakuBH($("#cb").value), type = $("#cty").value, f = num($("#cf").value), to = num($("#ct").value), box = parseInt($("#cx").value) || null;
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
  ko.innerHTML = `<p><b>${nBad ? `${nBad} conto belum lengkap / tidak sesuai SOP` : (s?.length ? "Semua conto lengkap dan sesuai SOP" : "Belum ada data logging untuk Hole ID ini")}</b></p>
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
  const rig = localStorage.getItem("rig") || "", bh = localStorage.getItem("bhid") || "", shift = localStorage.getItem("shift") || "PAGI";
  const q = (await qAll()).filter((x) => x.kind === "event" || x.kind === "p2h" || x.kind === "marking");
  v.innerHTML = `<div class="card"><h2>Progres pemboran</h2>
   <div class="row"><div><label>Rig</label>${rigField()}</div>
   <div><label>Hole ID</label><input id="pb" data-bhid value="${esc(bh)}" autocapitalize="characters"></div>
   <div style="flex:0.7"><label>Shift</label><select id="sh"><option ${shift === "PAGI" ? "selected" : ""}>PAGI</option><option ${shift === "MALAM" ? "selected" : ""}>MALAM</option></select></div></div>
   <p class="muted">Setiap tombol membuka kamera. Koordinat GPS dan jam dicatat otomatis dan dicetak di foto. GPS tetap jalan tanpa sinyal internet.</p>
   <div class="big">
    <button data-ev="MASUK">Masuk shift<small>foto kru di lokasi</small></button>
    <button data-p2h="1" class="sec">P2H rig<small>wajib sebelum mulai bor</small></button>
    <button data-ev="MULAI_BOR">Mulai bor<small>foto rig di titik bor</small></button>
    <button data-ev="ACT">Foto aktivitas<small>angkat run · ganti mata bor · tambah stang · standby · lainnya</small></button>
    <button data-ev="SELESAI_BOR">Selesai bor / stop<small>foto akhir</small></button>
    <button data-ev="KELUAR" class="sec">Keluar shift</button>
    ${isStaff() ? `<button data-mk="1" class="sec">📍 Marking titik<small>koordinat GPS + akurasi · boleh berkali-kali</small></button>` : ""}
   </div>
   <input id="pf" type="file" accept="image/*" capture="environment" class="hide"><div id="e" class="err"></div></div>
   <div class="card"><div class="row" style="align-items:center"><h3 style="margin:0">Antrean progres di HP (${q.length})</h3><button class="sec" id="sy" style="flex:0">Kirim sekarang</button></div>
   <ul class="list">${q.map((x) => `<li><span class="pill ANTRE">antre</span><span>${esc(x.kind === "p2h" ? "P2H " + (x.row.layak_operasi ? "LAYAK" : "TIDAK LAYAK") : x.kind === "marking" ? `Marking ±${x.row.akurasi_m} m` : EV[x.row.event_type])} · ${esc(x.row.rig)} ${esc(x.row.bhid ?? "")}<br><span class="muted">${fmtT(x.row.captured_at)}${x.row.lat ? "" : " · tanpa GPS"}${x.error ? " · gagal: " + esc(x.error) : ""}</span></span></li>`).join("") || `<li class="muted">Kosong.</li>`}</ul></div>
   <div class="card"><h3>Hari ini (terkirim)</h3><div id="today" class="muted">${navigator.onLine && !session.offline ? "Memuat…" : "Offline — tampil saat ada sinyal."}</div></div>`;
  const keep = () => { localStorage.setItem("rig", $("#rg").value.trim().toUpperCase()); localStorage.setItem("bhid", bakuBH($("#pb").value)); localStorage.setItem("shift", $("#sh").value); };
  let pending = null;
  v.querySelectorAll("[data-ev]").forEach((b) => (b.onclick = () => {
    keep(); if (!localStorage.getItem("rig")) return ($("#e").textContent = "Isi nama rig dulu.");
    if (b.dataset.ev !== "MASUK" && b.dataset.ev !== "KELUAR" && !localStorage.getItem("bhid")) return ($("#e").textContent = "Isi Hole ID dulu.");
    $("#e").textContent = ""; pending = b.dataset.ev; $("#pf").click();
  }));
  v.querySelector("[data-mk]")?.addEventListener("click", () => { keep(); markingForm(); });
  v.querySelector("[data-p2h]").onclick = () => { keep(); if (!localStorage.getItem("rig")) return ($("#e").textContent = "Isi nama rig dulu."); p2hForm(); };
  $("#pf").onchange = async (ev) => {
    const f0 = ev.target.files[0]; ev.target.value = ""; if (!f0) return;
    const file = await pratinjauFoto(f0, `Foto ${EV[pending] ?? "aktivitas"}`); if (!file) return;
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
      <div id="akhirf" style="display:none"><label>Status akhir lubang *</label><select id="sa"><option value="">— pilih —</option><option value="EOH">EOH — sampai target / bedrock</option><option value="STB">STB — berhenti sebelum target</option></select>
        <label>Kedalaman akhir (m)</label><input id="sad" inputmode="decimal" value="${fmtD(lastTo)}"></div>
      <div id="dipf" style="display:none"><div class="row"><div><label>Kemiringan / dip (°)</label><input id="dip" inputmode="decimal" value="${esc(rencanaLokal().find((z) => z.bhid === r.bhid)?.dip ?? -90)}"></div><div><label>Azimuth (°)</label><input id="az" inputmode="decimal" value="${esc(rencanaLokal().find((z) => z.bhid === r.bhid)?.azimuth ?? 0)}"></div></div>
        <p class="muted" style="margin:2px 0 0">−90 = tegak lurus ke bawah. Ubah hanya bila lubang dibor miring.</p></div>
      <div id="psn" style="display:none"><h3 style="margin:12px 0 2px" id="psnT">Personil hadir</h3><p class="muted" id="psnTip" style="margin:0"></p><div id="psnBox"></div></div>
      <div id="rsn"><label>Alasan / keterangan</label><input id="rn" placeholder="mis. mata bor aus, pompa rusak, hujan"></div>
      <p id="gps" class="muted">Mengambil GPS…</p>
      <div class="row" style="margin-top:10px"><button id="ok">Ya, simpan</button><button class="sec" id="cx">Batal</button></div><div id="me" class="err"></div>`);
    const tp = () => m.querySelector('input[name="et"]:checked').value;
    const upd = () => { const t = tp(); m.querySelector("#runf").style.display = t === "RUN" ? "" : "none"; m.querySelector("#akhirf").style.display = t === "SELESAI_BOR" ? "" : "none"; m.querySelector("#dipf").style.display = t === "MULAI_BOR" ? "" : "none"; m.querySelector("#ok").textContent = `Ya, simpan sebagai ${EV[t]}`;
      const ps = t === "MASUK" || t === "KELUAR"; m.querySelector("#psn").style.display = ps ? "" : "none";
      if (ps && !m.querySelector("#psnBox").dataset.ok) { m.querySelector("#psnBox").dataset.ok = "1"; loadPersonil(); personilEditor(m.querySelector("#psnBox"), personilAwal(r.rig, t, capturedAt));
        m.querySelector("#psnT").textContent = t === "MASUK" ? "Personil hadir (WSG, driller, crew)" : "Personil yang keluar shift";
        m.querySelector("#psnTip").textContent = t === "MASUK" ? "Tulis semua yang ada di foto. Terisi dari shift terakhir rig ini — hapus yang tidak hadir, tambah yang baru." : "Hapus nama yang sudah pulang lebih dulu."; } };
    m.querySelectorAll('input[name="et"]').forEach((x) => (x.onchange = upd)); upd();
    let pos = null; posP.then((p) => { pos = p; m.querySelector("#gps").textContent = p ? `GPS: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} (±${p.acc} m)` : "GPS tidak didapat — aktifkan Lokasi di HP. Foto tetap disimpan dan ditandai.";
      const k = p && cekIUP(p.lon, p.lat); if (k && !k.dalam) m.querySelector("#gps").insertAdjacentHTML("afterend", `<p class="err" style="font-weight:600">⚠ Titik GPS ini berada DI LUAR batas IUP (${esc(k.nama)}). Pastikan lokasi bor benar sebelum mengebor; hubungi WSG/admin.</p>`); });
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
      if (t === "MULAI_BOR") {
        row.dip = num(m.querySelector("#dip").value); row.azimuth = num(m.querySelector("#az").value);
        if (row.dip === null || row.dip < -90 || row.dip > 0) return (m.querySelector("#me").textContent = "Dip antara −90 (tegak) dan 0 (mendatar).");
        if (row.azimuth === null || row.azimuth < 0 || row.azimuth >= 360) return (m.querySelector("#me").textContent = "Azimuth antara 0 dan 359.");
      }
      if (t === "SELESAI_BOR") {
        row.status_akhir = m.querySelector("#sa").value || null; row.depth_to = num(m.querySelector("#sad").value);
        if (!row.status_akhir) return (m.querySelector("#me").textContent = "Pilih status akhir: EOH atau STB.");
        if (row.status_akhir === "STB" && !row.reason) { m.querySelector("#rn").focus(); return (m.querySelector("#me").textContent = "STB: tulis alasan berhenti di kolom Alasan."); }
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
      const line2 = t === "RUN" ? `RUN ${fmtD(row.depth_from)}–${fmtD(row.depth_to)} m · core ${fmtD(row.core_length)} m` : EV[t] + (row.status_akhir ? ` ${row.status_akhir}` : "") + (t === "MULAI_BOR" ? ` · dip ${row.dip}° az ${row.azimuth}°` : "") + (row.personil ? ` · ${row.personil.length} personil` : "") + (row.reason ? ` · ${row.reason}` : "");
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
    $("#today").querySelectorAll("[data-ph]").forEach((b) => (b.onclick = async () => { const { data } = await sb.storage.from("progress-photos").createSignedUrl(b.dataset.ph, 600);
      if (data?.signedUrl) return ($("#phv").innerHTML = `<img src="${data.signedUrl}" alt="Foto aktivitas bor" style="width:100%;border-radius:8px">`);
      const dv = await linkDrive("progress-photos", b.dataset.ph); $("#phv").innerHTML = dv ? `<p>Foto sudah dipindah ke Google Drive. <a href="${esc(dv)}" target="_blank" rel="noopener">Buka di Drive</a></p>` : `<p class="err">Foto tidak ditemukan.</p>`; }));
  }
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
async function usersView(v) {
  const { data: rq, error } = await sb.from("registration_request").select("*").order("created_at", { ascending: false });
  if (error) return (v.innerHTML = `<p class="err">${esc(error.message)}</p>`);
  const { data: au } = await sb.from("app_user").select("user_id,role");
  const roleOf = Object.fromEntries((au ?? []).map((x) => [x.user_id, x.role]));
  const pend = rq.filter((r) => r.status === "PENDING"), rest = rq.filter((r) => r.status !== "PENDING");
  const link = new URL("daftar.html", location.href).href;
  const opt = (sel) => ["driller", "geologist", "verifier", "admin", "client"].map((r) => `<option ${r === sel ? "selected" : ""}>${r}</option>`).join("");
  const row = (r, pending) => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(r.full_name)}</b> · ${esc(r.email)}<br><span class="muted">${esc(r.position ?? "")} · ${esc(r.company ?? "")} · ${esc(r.phone ?? "")}${r.reason ? " · " + esc(r.reason) : ""}<br>
      ${pending ? `minta: ${esc(r.requested_role)} · daftar ${new Date(r.created_at).toLocaleString("id-ID")}` : `status: ${roleOf[r.user_id] === "nonaktif" ? "<b style='color:#C8281F'>NONAKTIF</b>" : roleOf[r.user_id] ? "AKTIF (" + roleOf[r.user_id] + ")" : r.status === "REJECTED" ? "DITOLAK" : r.status}${r.decision_note ? " · " + esc(r.decision_note) : ""}`}</span></span>
      <select data-role="${r.user_id}" style="flex:0;width:auto">${opt(roleOf[r.user_id] && roleOf[r.user_id] !== "nonaktif" ? roleOf[r.user_id] : r.requested_role)}</select>
      <button data-ok="${r.user_id}" style="flex:0">${pending ? "Setujui" : roleOf[r.user_id] && roleOf[r.user_id] !== "nonaktif" ? "Ubah peran" : "Aktifkan"}</button>
      ${pending || (roleOf[r.user_id] && roleOf[r.user_id] !== "nonaktif") ? `<button class="danger" data-no="${r.user_id}" style="flex:0">${pending ? "Tolak" : "Nonaktifkan"}</button>` : ""}
      ${r.user_id === session?.user?.id ? "" : `<button class="danger" data-del="${r.user_id}" data-nm="${esc(r.full_name)}" style="flex:0" title="Hapus permanen (hanya akun yang belum pernah mengirim data)">Hapus</button>`}</li>`;
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
  // Hapus permanen: server menolak bila akun pernah mengirim data (pakai Nonaktifkan agar riwayat utuh)
  v.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    const { error: e1 } = await sb.rpc("admin_hapus_pengguna", { p_user: b.dataset.del, p_konfirmasi: false });
    if (e1) return alert(e1.message);
    if (!confirm(`Hapus PERMANEN akun “${b.dataset.nm}”?\n\nAkun, pendaftaran dan penugasannya dihapus dan tidak bisa dipulihkan. Orang ini harus mendaftar ulang bila ingin masuk lagi.`)) return;
    const { error } = await sb.rpc("admin_hapus_pengguna", { p_user: b.dataset.del, p_konfirmasi: true });
    if (error) alert(error.message); else usersView(v);
  }));
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
    <div class="row"><div><label>HOLE ID *</label><input id="bh" data-bhid value="${esc(localStorage.getItem("bhid") || "")}" autocapitalize="characters"></div><div><label>RIG NO *</label>${rigField()}</div><div><label>RIG TYPE</label><input id="rt" value="${esc(last.rig_type ?? "")}"></div></div>
    <div class="row"><div><label>DATE *</label><input id="dt" type="date" value="${shiftNow.tanggal}"></div><div><label>TIME *</label><select id="sh"><option value="PAGI" ${shift === "PAGI" ? "selected" : ""}>Day (06–18)</option><option value="MALAM" ${shift === "MALAM" ? "selected" : ""}>Night (18–06)</option></select></div><div><label>Client *</label><input id="ct" value="${esc(last.contractor ?? "")}"></div></div>
    <div class="row"><div><label>DRILLER *</label>${me?.role === "driller" ? `<input id="dn" value="${esc(me.full_name ?? "")}" readonly title="Nama akun Anda">` : `<input id="dn" value="${esc(last.driller_name ?? "")}">`}</div><div style="flex:.5"><label>CREW *</label><input id="cc" inputmode="numeric" readonly title="Dihitung otomatis: driller + assistant" value="${esc(last.crew_count ?? "")}"></div></div>
    <label>ASSISTANT / CREW lain * <span class="muted">(minimal ${crewMin()} orang termasuk driller)</span></label>
    <datalist id="dlCrew">${[...new Set(masterPersonil().filter((p) => p.aktif !== false).map((p) => p.nama))].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div id="crw"></div><button class="sec" id="crwAdd" style="width:auto;margin-top:4px">+ crew</button>
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
  isiDaftarCrew((last.crew_list ?? (last.helpers ?? "").split(",").map((n) => ({ nama: n.trim(), jabatan: "Helper" }))).filter((x) => x.nama));
  const isiCrew = async () => {
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
  $("#sv").onclick = async () => {
    const val = (id) => $(id).value.trim();
    const rows = (box) => [...$(box).querySelectorAll(".row")].map((r) => [...r.querySelectorAll("input,select")].map((x) => x.value.trim()));
    const open_hole = rows("#oh").filter((x) => x[0] || x[1]).map(([f, t]) => ({ from: num(f), to: num(t) }));
    const coring = rows("#cr").filter((x) => x[0] || x[1]).map(([f, t, c, rm]) => ({ from: num(f), to: num(t), core: num(c), remark: rm || null }));
    const hours = rows("#hr").filter((x) => x[0] || x[1]).map(([m, s, k, d]) => ({ mulai: m.replace(".", ":"), selesai: s.replace(".", ":"), kategori: k, ket: d || null }));
    const row = { project: val("#pj") || null, location: val("#lc") || null, rig: val("#rg").toUpperCase(), rig_type: val("#rt") || null, report_date: val("#dt"), shift: $("#sh").value,
      bhid: bakuBH(val("#bh")) || null, contractor: val("#ct"), driller_name: val("#dn"), helpers: ambilCrew().map((x) => x.nama).join(", ") || null, crew_count: num(val("#cc")),
      crew: [...(val("#dn") ? [{ nama: val("#dn"), jabatan: "Driller" }] : []), ...ambilCrew(), ...crewDDR.filter((x) => x.jabatan === "WSG")],
      hm_start: num(val("#h1")), hm_end: num(val("#h2")), weather: $("#wx").value, notes: val("#nt") || null, hole_type: $("#ht").value, rod_m: num(val("#rd")),
      target_m: num(val("#tg")), total_depth_m: num(val("#td")), open_hole, coring, hours, captured_at: new Date().toISOString() };
    const miss = ["bhid", "rig", "report_date", "contractor", "driller_name", "crew_count"].filter((k) => row[k] === null || row[k] === "");
    if (miss.length) return ($("#e").textContent = "Lengkapi kolom bertanda * (" + miss.join(", ") + ").");
    if (row.crew_count < crewMin()) return ($("#e").textContent = `Nama crew baru ${row.crew_count} — minimal ${crewMin()} orang (driller + assistant). Tambah dengan "+ crew".`);
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
    localStorage.setItem("ddrLast", JSON.stringify({ v: 2, contractor: row.contractor, driller_name: row.driller_name, crew_count: row.crew_count, helpers: row.helpers, crew_list: ambilCrew(), project: row.project, location: row.location, rig_type: row.rig_type, target_m: row.target_m }));
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
    ${proyekSelect()}<div><label>Rig</label><input id="r" value="${esc(st.rig)}" placeholder="semua"></div><button id="go" style="flex:0">Tampilkan</button><button class="sec" id="pr" style="flex:0;white-space:nowrap">Cetak layar</button><button class="sec" id="dx" style="flex:0;white-space:nowrap">Unduh Excel</button><button id="lap" style="flex:0;white-space:nowrap">Laporan PDF (peta + profil)</button><button id="pres" style="flex:0;white-space:nowrap;background:#12251E">🎞 Presentasi 16:9</button></div></div>
    <div id="kpi" class="card"></div><div id="ch" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px"></div>`;
  $("#pr").onclick = () => print();
  $("#lap").onclick = () => laporanProgres({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase(), proj: $("#fproj").value });
  $("#pres").onclick = () => laporanProgres({ from: $("#f").value, to: $("#t").value, rig: $("#r").value.trim().toUpperCase(), proj: $("#fproj").value, slide: true });
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
const CLIENT_RIG_DS = ["kinerja", "progres", "ddr", "jam", "bbm", "p2h", "aktivitas"], CLIENT_GEO_DS = ["collar", "survey", "geology", "density", "assay", "qaqc", "lubang", "profil"];
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
// ---------- Peta pemboran statis (SVG) untuk laporan/PDF ----------
let _konturCache = null, _elevCache = null;
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
    const kiriL = ada.filter((p) => X(p.ll[0]) < W / 2), kananL = ada.filter((p) => X(p.ll[0]) >= W / 2);
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
  g += `<g transform="translate(${W - 30},34)"><polygon points="0,-20 7,4 0,-2 -7,4" fill="#111"/><text y="18" font-size="12" font-weight="700" text-anchor="middle">U</text></g>`;
  const u0 = UTM.ke(x0, y0), u1 = UTM.ke(x1, y1), gs = [100, 250, 500, 1000, 2000].find((s) => (u1[0] - u0[0]) / s <= 6) ?? 5000;
  for (let e = Math.ceil(u0[0] / gs) * gs; e < u1[0]; e += gs) { const ll = UTM.dari(e, (u0[1] + u1[1]) / 2), x = X(ll[0]); g += `<line x1="${x}" y1="0" x2="${x}" y2="6" stroke="#111"/><text x="${x}" y="16" font-size="8" text-anchor="middle">${e}</text>`; }
  for (let n = Math.ceil(u0[1] / gs) * gs; n < u1[1]; n += gs) { const ll = UTM.dari((u0[0] + u1[0]) / 2, n), y = Y(ll[1]); g += `<line x1="0" y1="${y}" x2="6" y2="${y}" stroke="#111"/><text x="8" y="${y + 3}" font-size="8">${n}</text>`; }
  const leg = [["RENCANA", "Rencana"], ["PROGRES", "Progres"], ["EOH", "EOH / STB (selesai)"]].map(([k, t], i) => `<circle cx="${W - 150}" cy="${H - 64 + i * 15}" r="5" fill="${WARNA_STATUS[k]}" stroke="#111"/><text x="${W - 140}" y="${H - 61 + i * 15}" font-size="10">${t}</text>`).join("");
  g += `<rect x="${W - 160}" y="${H - 78}" width="152" height="70" fill="#fff" opacity=".9" stroke="#999"/>${leg}<line x1="${W - 156}" y1="${H - 16}" x2="${W - 142}" y2="${H - 16}" stroke="#d00" stroke-width="2" stroke-dasharray="5 3"/><text x="${W - 140}" y="${H - 13}" font-size="10">Batas IUP</text>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="border:1px solid #333;background:#f4f1ea;max-width:100%;height:auto;font-family:Arial,sans-serif"><defs><clipPath id="cp"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#cp)">${g}</g></svg>
    <div style="font-size:10px;color:#555">Grid UTM zona 51S (WGS84) · latar elevasi DEMNAS, kontur 25 m (tebal tiap 100 m) · posisi titik: collar/GPS Mulai bor/rencana</div>`;
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
// ---------- Kesimpulan prospek (saringan awal, ambang bisa disesuaikan) ----------
const KRITERIA = { niS: [1.5, 1.2], niL: [1.2, 0.8], tebal: [6, 3], kontinu: [70, 40], ob: [0.5, 1], lereng: [20, 30], nMin: 5 };
function kesimpulanProspek({ A, T, AS, prof, LB }) {
  const K = KRITERIA, f = (x, d = 1) => (x == null || !Number.isFinite(+x) ? "–" : (+x).toFixed(d));
  const bh = [...new Set(prof.map((r) => r.bhid))], tb = (b, ks) => prof.filter((r) => r.bhid === b && ks.includes(r.zona)).reduce((s, r) => s + +r.tebal_m, 0);
  // kadar per layer: tiap interval assay diberi layer dari Form Logging (titik tengah interval)
  const Z = {}; for (const a of AS) { const mid = (+a.from + +a.to) / 2, L = +a.to - +a.from; const r = prof.find((x) => x.bhid === a.holeid && mid >= +x.dari_m && mid < +x.sampai_m); if (!r || !(L > 0)) continue;
    const z = (Z[r.zona] ??= { nama: r.nama_zona, warna: r.warna, L: 0, ni: 0, fe: 0, mgo: 0, sio2: 0, n: 0 }); z.L += L; z.n++; for (const k of ["ni", "fe", "mgo", "sio2"]) if (a[k] != null) z[k] += +a[k] * L; }
  const kad = (k, el) => (Z[k]?.L ? Z[k][el] / Z[k].L : null), niL = kad("L", "ni"), niS = kad("S", "ni");
  const kadarTabel = Object.keys(Z).length ? `<table class="t kc"><tr><th>Layer</th>${["Ni %", "Fe %", "MgO %", "SiO₂/MgO", "Panjang (m)"].map((h) => `<th class="r">${h}</th>`).join("")}</tr>${Object.entries(Z).map(([k, z]) => `<tr><td><span class="sw" style="background:${esc(z.warna)}"></span>${esc(z.nama)}</td><td class="r"><b>${f(z.ni / z.L, 2)}</b></td><td class="r">${f(z.fe / z.L, 1)}</td><td class="r">${f(z.mgo / z.L, 1)}</td><td class="r">${z.mgo ? f(z.sio2 / z.mgo, 2) : "–"}</td><td class="r">${f(z.L)}</td></tr>`).join("")}</table>`
    : `<div class="kosong" style="margin-top:20px;font-size:15px">Belum ada hasil assay laboratorium di database.<br><b>Kesimpulan prospek tidak bisa final tanpa kadar Ni.</b></div>`;
  const nilai = (v, [ok, warn], naik = true) => (v == null || !Number.isFinite(v) ? "na" : naik ? (v >= ok ? "ok" : v >= warn ? "warn" : "bad") : v <= ok ? "ok" : v <= warn ? "warn" : "bad");
  const bijih = bh.map((b) => tb(b, ["L", "S"])), tebalBijih = bijih.length ? bijih.reduce((a, b) => a + b, 0) / bijih.length : null;
  const kontinu = bh.length ? (100 * bijih.filter((x) => x >= 3).length) / bh.length : null, obR = tebalBijih ? T.sOB.mean / tebalBijih : null;
  const ler = Object.values(A.lereng).filter((x) => x != null), lerAvg = ler.length ? ler.reduce((a, b) => a + b, 0) / ler.length : null;
  const baris = [
    { k: "Kadar Ni saprolit (tertimbang)", v: niS != null ? f(niS, 2) + "%" : "–", amb: `≥ ${K.niS[0]}% / ≥ ${K.niS[1]}%`, s: nilai(niS, K.niS), grade: true },
    { k: "Kadar Ni limonit (tertimbang)", v: niL != null ? f(niL, 2) + "%" : "–", amb: `≥ ${K.niL[0]}% / ≥ ${K.niL[1]}%`, s: nilai(niL, K.niL), grade: true },
    { k: "Tebal zona laterit (limonit + saprolit) rata-rata", v: tebalBijih != null ? f(tebalBijih) + " m" : "–", amb: `≥ ${K.tebal[0]} m / ≥ ${K.tebal[1]} m`, s: nilai(tebalBijih, K.tebal) },
    { k: "Kontinuitas: lubang dengan zona laterit ≥ 3 m", v: kontinu != null ? f(kontinu, 0) + "%" : "–", amb: `≥ ${K.kontinu[0]}% / ≥ ${K.kontinu[1]}%`, s: nilai(kontinu, K.kontinu) },
    { k: "Rasio overburden : zona laterit", v: obR != null ? f(obR, 2) : "–", amb: `≤ ${K.ob[0]} / ≤ ${K.ob[1]}`, s: nilai(obR, K.ob, false) },
    { k: "Lereng rata-rata di titik bor", v: lerAvg != null ? f(lerAvg) + "°" : "–", amb: `≤ ${K.lereng[0]}° / ≤ ${K.lereng[1]}°`, s: nilai(lerAvg, K.lereng, false) },
    { k: "Kecukupan data (lubang berdata logging)", v: `${bh.length} lubang`, amb: `≥ ${K.nMin} lubang`, s: bh.length >= K.nMin ? "ok" : bh.length ? "warn" : "na" },
  ];
  const geo = baris.filter((r) => !r.grade && r.k !== "Kecukupan data (lubang berdata logging)"), adaKadar = niL != null || niS != null, cukup = bh.length >= K.nMin;
  const buruk = baris.filter((r) => r.s === "bad").length, baik = baris.filter((r) => r.s === "ok").length, gBad = geo.filter((r) => r.s === "bad").length, gOk = geo.filter((r) => r.s === "ok").length;
  let vonis, warna, alasan;
  if (!bh.length) { vonis = "BELUM ADA DATA"; warna = "#6b7a72"; alasan = "Belum ada Form Logging yang disetujui, jadi ketebalan dan kadar belum bisa dinilai."; }
  else if (!adaKadar || !cukup) { const ind = gBad === 0 && gOk >= 2 ? "positif" : gBad >= 2 ? "negatif" : "netral";
    vonis = "BELUM DAPAT DISIMPULKAN"; warna = "#E0A100"; alasan = `Indikasi awal dari geologi saja: ${ind} (${gOk} kriteria memenuhi, ${gBad} tidak). ${!adaKadar ? "Hasil assay Ni belum ada" : ""}${!adaKadar && !cukup ? " dan " : ""}${!cukup ? `baru ${bh.length} lubang berdata (minimal ${K.nMin})` : ""}.`; }
  else if (baris.filter((r) => r.grade).some((r) => r.s === "bad") || buruk >= 3) { vonis = "KURANG PROSPEK"; warna = "#D62828"; alasan = `${buruk} kriteria tidak terpenuhi, termasuk kadar dan/atau ketebalan.`; }
  else if (baris.every((r) => r.s === "ok" || r.s === "na")) { vonis = "PROSPEK"; warna = "#1E9E69"; alasan = `Semua kriteria saringan terpenuhi (${baik} dari ${baris.length}).`; }
  else { vonis = "PROSPEK BERSYARAT"; warna = "#1E9E69"; alasan = `${baik} kriteria memenuhi, ${baris.filter((r) => r.s === "warn").length} di ambang sedang, ${buruk} tidak.`; }
  const rekom = [];
  if (!adaKadar) rekom.push("Kirim conto ke laboratorium dan masukkan hasil assay (Ni, Fe, MgO, SiO₂, Co) — penentu utama kesimpulan.");
  if (!cukup) rekom.push(`Selesaikan logging minimal ${K.nMin} lubang (sekarang ${bh.length}) agar statistik representatif.`);
  if (kontinu != null && kontinu < K.kontinu[0]) rekom.push("Zona laterit belum menerus: evaluasi spasi bor dan pertimbangkan bor isian di sekitar lubang yang tebal.");
  if (obR != null && obR > K.ob[0]) rekom.push("Overburden relatif tebal terhadap zona laterit — perhitungkan dampak pengupasan.");
  if (lerAvg != null && lerAvg > K.lereng[0]) rekom.push("Lereng curam di titik bor — laterit cenderung tipis/tererosi; prioritaskan punggungan landai.");
  if (T.sRec.n && T.sRec.min < 90) rekom.push("Recovery core < 90% di sebagian lubang — perbaiki teknik bor agar kadar dan tebal tidak bias.");
  if (vonis.startsWith("PROSPEK")) rekom.push("Lanjutkan ke bor isian (infill) untuk estimasi sumber daya sesuai KCMI.");
  if (!rekom.length) rekom.push("Lanjutkan program sesuai rencana.");
  const ringkas = vonis === "BELUM DAPAT DISIMPULKAN" ? alasan.split(".")[0] + "." : alasan;
  return { vonis, warna, alasan, ringkas, baris, rekom, kadarTabel };
}
// ---------- Template presentasi pemboran 16:9 (cetak / simpan PDF) ----------
async function presentasiHTML(D) {
  const { st, PJ, mPer, mCum, nSelesai, HR, K, dayRows, rigRows, sbRows, notes, LB, prof, klien } = D, days = D.days ?? [];
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
  let AS = []; try { const bhs = [...new Set((prof ?? []).map((r) => r.bhid))]; if (bhs.length && typeof sb !== "undefined") { const { data } = await sb.from("v_dh_assay").select("holeid,from,to,ni,fe,mgo,sio2,co").in("holeid", bhs); AS = data ?? []; } } catch {}
  const KS = kesimpulanProspek({ A, T, AS, prof: prof ?? [], LB });
  const petaGraf = await petaSVG(LB.map((x) => ({ ...x, rec: REC[x.bhid] })), { w: 1200, h: 600, grafik: prof ?? [], gh: 74 }).catch(() => "<p>Peta tidak dapat dibuat.</p>");
  const tiga = await blok3D(LB, prof, { w: 900, h: 560 }).catch(() => "");
  const kecil = (s) => (s.n && s.n < 5 ? `<span class="nk">n=${s.n}</span>` : "");
  // ===== 1. Sampul =====
  S.push(`<section class="sl cover"><div class="cv-l"><div class="tag">LAPORAN PROGRES PEMBORAN</div><h1>${esc(nama)}</h1><div class="per">${per}${st.rig ? ` · ${esc(st.rig)}` : ""}</div>
    <div class="cv-k">${card(mPer.toFixed(1) + " m", "meter bor periode", "", "#7CE0B0")}${card(`${nSelesai}/${tgtL}`, "lubang selesai", "", "#7CE0B0")}${card(mCum.toFixed(0) + " m", "kumulatif proyek", tgtM ? `${pct(mCum, tgtM)}% dari target ${tgtM} m` : "", "#7CE0B0")}</div>
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
  // ===== 3. Peta pemboran + grafik per lubang =====
  S.push(slide("Peta pemboran & grafik per lubang", `<div class="peta">${petaGraf}</div>`, `${LB.length} titik · kotak = kolom zona / kedalaman vs rencana · Rec = recovery`));
  // ===== 4. Geologi =====
  S.push(slide("Profil & ketebalan layer", (prof ?? []).length ? `<div class="pf" style="grid-template-columns:1fr 1.15fr"><div>${profilSVG(prof, { h: 300, fit: 400 })}</div>
    <div><div class="grid4" style="gap:8px">${card(f(T.sOB.mean) + " m", "Overburden", `TP + sedimen`, "#8B3A1F")}${card(f(T.sL.mean) + " m", "Limonit", `n=${T.sL.n}`, "#D62828")}${card(f(T.sS.mean) + " m", "Saprolit", `n=${T.sS.n}`, "#6f8a1f")}${card(T.sBR.n ? f(T.sBR.mean) + " m" : "–", "Ke bedrock", "kedalaman", "#1D4ED8")}</div>
    ${kedalamanLayerSVG(A.zona)}
    <table class="t kc"><tr><th>Layer</th>${["n", "Atas", "Bawah", "Min", "Rata-rata", "Median", "Maks", "SD"].map((h) => `<th class="r">${h}</th>`).join("")}</tr>${A.zona.map((z) => { const s2 = stat(z.tebal); return `<tr><td><span class="sw" style="background:${esc(z.warna)}"></span>${esc(z.nama)}</td><td class="r">${s2.n}</td><td class="r">${f(z.atas)}</td><td class="r">${f(z.bawah)}</td><td class="r">${f(s2.min)}</td><td class="r"><b>${f(s2.mean)}</b></td><td class="r">${f(s2.med)}</td><td class="r">${f(s2.max)}</td><td class="r">${f(s2.sd)}</td></tr>`; }).join("")}</table>
    <p class="ket">Tebal (m) per lubang yang menembus layer. Rasio limonit : saprolit = ${T.sS.mean ? f(T.sL.mean / T.sS.mean, 2) : "–"} : 1.</p></div></div>` : `<p class="kosong">Profil tampil setelah Form Logging disetujui verifier.</p>`, `${T.bh.length} lubang berdata logging`));
  // ===== 5. Hubungan & kadar =====
  S.push(slide("Hubungan & kadar", `<div class="dua" style="grid-template-columns:1.35fr 1fr"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${pencarSVG(A.hub.eohL, { judul: "Kedalaman vs tebal limonit", sx: "kedalaman akhir (m)", sy: "limonit (m)", maxH: 190 })}${pencarSVG(A.hub.eohS, { judul: "Kedalaman vs tebal saprolit", sx: "kedalaman akhir (m)", sy: "saprolit (m)", maxH: 190 })}
    ${pencarSVG(A.hub.lerEoh, { judul: "Lereng vs kedalaman", sx: "lereng collar (°)", sy: "kedalaman (m)", maxH: 190 })}${pencarSVG(A.hub.lerL, { judul: "Lereng vs tebal limonit", sx: "lereng collar (°)", sy: "limonit (m)", maxH: 190 })}</div>
    <div><h3 style="margin:0 0 6px">Kadar rata-rata tertimbang per layer</h3>${KS.kadarTabel}
    <p class="ket">r = korelasi Pearson; n &lt; 3 tidak dihitung, n &lt; 5 belum stabil. Lereng dari DEMNAS di collar. Kadar ditimbang panjang interval assay; layer ditentukan dari Form Logging.</p></div></div>`, "kedalaman · ketebalan · lereng · Ni"));
  // ===== 6. Kesimpulan prospek =====
  S.push(slide("Kesimpulan: prospek atau tidak?", `<div class="dua" style="grid-template-columns:1fr 1.5fr;align-items:start">
    <div class="vonis2" style="border-color:${KS.warna}"><div class="vl">STATUS</div><div class="vv" style="color:${KS.warna}">${esc(KS.vonis)}</div><p>${esc(KS.alasan)}</p>
      <h3>Rekomendasi</h3><ul class="tl">${KS.rekom.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><table class="t"><tr><th>Kriteria</th><th class="r">Nilai</th><th>Ambang (✓ / !)</th><th>Status</th></tr>${KS.baris.map((r) => `<tr><td>${esc(r.k)}</td><td class="r"><b>${esc(r.v)}</b></td><td>${esc(r.amb)}</td><td><span class="stt s${r.s}">${{ ok: "✓ memenuhi", warn: "! sedang", bad: "✗ tidak", na: "? belum ada data" }[r.s]}</span></td></tr>`).join("")}</table>
    <p class="ket">Ambang adalah saringan awal eksplorasi nikel laterit (bukan klasifikasi sumber daya KCMI/JORC) dan bisa disesuaikan dengan cut-off proyek. Kesimpulan otomatis ini perlu ditinjau geologis yang berkompeten.</p></div></div>`, "penyaringan awal berbasis data"));
  const css = `@page{size:338.67mm 190.5mm;margin:0}*{box-sizing:border-box}body{margin:0;background:#3a4741;font-family:"Segoe UI",Arial,sans-serif;color:#12251E}
  .bar0{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:center;padding:8px;background:#12251E}.bar0 button{font:600 14px Arial;padding:8px 14px;border:0;border-radius:8px;background:#1E9E69;color:#fff;cursor:pointer}
  .sl{width:338.67mm;height:190.5mm;margin:14px auto;background:#fff;position:relative;overflow:hidden;page-break-after:always;break-after:page;display:flex;flex-direction:column;box-shadow:0 4px 18px rgba(0,0,0,.35)}
  .sl>header{display:flex;align-items:center;gap:14px;padding:16px 34px 10px;border-bottom:3px solid #1E9E69}.sl>header .no{font:700 26px Arial;color:#1E9E69}.sl>header h2{margin:0;font-size:28px;white-space:nowrap}.sl>header .sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.sl>header .sub{color:#6b7a72;font-size:15px}.sl>header .br{margin-left:auto;font:700 13px Arial;color:#12251E;opacity:.55;letter-spacing:.06em}
  .isi{flex:1;padding:16px 34px;overflow:hidden}.sl>footer{display:flex;justify-content:space-between;padding:6px 34px;font-size:12px;color:#6b7a72;border-top:1px solid #e3e8e1}
  .cover{flex-direction:row;background:linear-gradient(135deg,#0d1f18,#12251E 55%,#1b4a37);color:#fff}.cv-l{flex:0 0 42%;padding:46px 40px;display:flex;flex-direction:column}.cv-r{flex:1;padding:22px 22px 22px 0;display:flex;align-items:center}.cv-r svg{width:100%;height:auto;border-radius:10px;border:0!important}.cv-r div{display:none}
  .tag{font:700 14px Arial;letter-spacing:.18em;color:#7CE0B0}.cover h1{font-size:46px;line-height:1.08;margin:14px 0 8px}.per{font-size:19px;opacity:.85}.cv-k{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:34px 0 auto}.cover .kpi{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15)}.cover .kpi .l,.cover .kpi .s{color:#cfe3d9}.by{font-size:13px;opacity:.7;line-height:1.6}
  .kpi{border:1px solid #e3e8e1;border-radius:14px;padding:14px 16px;background:#f7faf8}.grid8{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}.grid8 .kpi{padding:8px 10px;border-radius:10px}.grid8 .kpi .v{font-size:22px}.grid8 .kpi .l{font-size:12px}.grid8 .kpi .s{font-size:10.5px}
  .t.kc{font-size:12px}.t.kc th,.t.kc td{padding:3px 6px}.t.kc td:first-child{white-space:nowrap}.cv-r3{flex:1;padding:18px 18px 18px 0;display:flex;flex-direction:column;justify-content:center}.cv-r3 svg{width:100%;height:auto;border-radius:12px}.cv-r3>div{color:#cfe3d9!important;font-size:10px!important}
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
  let g = walls + quads.map((q) => `<polygon points="${q.pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="${q.col}" stroke="${q.col}" stroke-width=".4"/>`).join("");
  // lubang bor
  const hz = async (p) => fill(await tinggiDi(p.ll[0], p.ll[1]).catch(() => null)), PRF = prof ?? [];
  const lub = []; for (const p of pts) { const mx = (p.ll[0] - x0) * kx, my = (p.ll[1] - y0) * ky, z = await hz(p); lub.push({ p, mx, my, z, d: P3(mx, my, z)[2] }); }
  lub.sort((a, b) => b.d - a.d);
  for (const h of lub) { const top = S(P3(h.mx, h.my, h.z)), R = PRF.filter((r) => r.bhid === h.p.bhid), seg = (a, b) => [S(P3(h.mx, h.my, h.z - a * HE / VE)), S(P3(h.mx, h.my, h.z - b * HE / VE))];
    if (R.length) for (const r of R) { const [a, b] = seg(+r.dari_m, +r.sampai_m); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${esc(r.warna)}" stroke-width="10" stroke-linecap="butt"><title>${esc(h.p.bhid)} ${esc(r.nama_zona)} ${r.dari_m}–${r.sampai_m} m</title></line>`; }
    else if (+h.p.kedalaman) { const [a, b] = seg(0, +h.p.kedalaman); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${WARNA_STATUS[h.p.status] ?? "#999"}" stroke-width="9"/>`; }
    if (+h.p.rencana_kedalaman && h.p.status !== "EOH" && h.p.status !== "STB") { const [a, b] = seg(0, +h.p.rencana_kedalaman); g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#111" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>`; }
    const tiang = S(P3(h.mx, h.my, h.z + ((zMax - zMin) * (0.07 + 0.06 * (lub.indexOf(h) % 3))) / VE));   // tiang label berselang tinggi agar tidak bertumpuk
    g += `<line x1="${top[0]}" y1="${top[1]}" x2="${tiang[0]}" y2="${tiang[1]}" stroke="#111" stroke-width=".8"/><circle cx="${top[0]}" cy="${top[1]}" r="4" fill="${WARNA_STATUS[h.p.status] ?? "#999"}" stroke="#111" stroke-width="1.2"/>
      <text x="${tiang[0]}" y="${tiang[1] - 3}" font-size="10" font-weight="700" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(h.p.bhid)}</text>`; }
  // panah utara (proyeksi arah utara di permukaan)
  const u0 = S(P3(cx, cy, zMin)), u1 = S(P3(cx, cy + 1, zMin)), ang = Math.atan2(u1[1] - u0[1], u1[0] - u0[0]);
  g += `<g transform="translate(${W - 46},48) rotate(${(ang * 180) / Math.PI + 90})"><polygon points="0,-20 7,6 0,0 -7,6" fill="#111"/></g><text x="${W - 46}" y="84" font-size="12" font-weight="700" text-anchor="middle">U</text>`;
  const Zs = [...new Map(PRF.map((r) => [r.zona, r])).values()];
  const leg = `<div style="font-size:11px;color:#333;margin-top:4px">Topografi DEMNAS, tinggi ${zMin.toFixed(0)}–${zMax.toFixed(0)} m, perbesaran vertikal ${VE}× · <b>panjang lubang bor diperbesar ${HE}×</b> agar terlihat · garis putus = kedalaman rencana · dilihat dari arah ${["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"][Math.round((((o.az ?? 62) + 180) % 360) / 45) % 8]} · ${Zs.map((r) => `<span style="display:inline-block;width:12px;height:10px;background:${esc(r.warna)};border:1px solid #222;vertical-align:-1px"></span> ${esc(r.nama_zona)}`).join(" ")}</div>`;
  return `<svg width="${o.fit ? "100%" : W}" viewBox="0 0 ${W} ${H}" style="background:linear-gradient(#eaf2f7,#fff);font-family:Arial,sans-serif;${o.fit ? `max-height:${o.fit}px;` : ""}"><defs><linearGradient id="tanah" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98b62"/><stop offset=".55" stop-color="#8b5e3c"/><stop offset="1" stop-color="#5b4636"/></linearGradient></defs>${g}</svg>${leg}`;
}
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
    const LB = ((await ambilLubangPeta()).data ?? []).filter((x) => !pf || pf.bhids.includes(x.bhid) || x.status === "RENCANA").sort((a, b) => String(a.bhid).localeCompare(String(b.bhid), "id", { numeric: true }));
    await muatZona();
    const { data: prof } = await sb.from("v_profil_bor").select("*").in("bhid", LB.map((x) => x.bhid).length ? LB.map((x) => x.bhid) : ["-"]).order("bhid").order("dari_m");
    const petaGrafik = await petaSVG(LB.map((x) => ({ ...x, rec: HR.find((h) => h.b === x.bhid)?.rec })), { w: 960, h: 600, grafik: prof ?? [] }).catch((e) => `<p>Peta gagal dibuat: ${esc(e.message)}</p>`);
    const gbr3D = await blok3D(LB, prof, { w: 960, h: 500 }).catch((e) => `<p>Tampilan 3D gagal: ${esc(e.message)}</p>`);
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
      lubang: [["Hole ID", "Rig", "Mulai", "Bor terakhir", "Kedalaman (m)", "Target (m)", "Logging (m)", "Conto", "Status logging", "Limonit (m)", "Saprolit (m)", "Recovery %", "Status lubang"],
        ...HR.map((h) => [h.b, h.rig, h.mulai, h.akhir, +f2(h.bor) || 0, h.tgt || "", +f2(h.logm) || 0, h.conto, h.lstat, h.tl == null ? "" : +f1(h.tl), h.ts == null ? "" : +f1(h.ts), h.rec == null ? "" : Math.round(h.rec), h.selesai ? "SELESAI" : "BERJALAN"])],
      standby: [["Penyebab", "Jam"], ...sbRows],
      operator: [["Operator", "Peran", "Rig", "Hari wajib", "Lengkap", "Sebagian", "Belum", "% lengkap", "Kekurangan terbanyak"], ...opRows],
      qc: [["Butir", "Jumlah"], ...qcRows],
      catatan: [["Catatan otomatis"], ...notes.map((x) => [x])],
      titik: [["Hole ID", "Status", "Rig", "Kedalaman (m)", "Rencana (m)", "Dip (°)", "Azimuth (°)", "IUP"], ...titikRows],
      profil: [["Hole ID", "Dari (m)", "Sampai (m)", "Tebal (m)", "Zona", "Nama zona", "Jumlah conto"], ...(prof ?? []).map((r) => [r.bhid, +r.dari_m, +r.sampai_m, +r.tebal_m, r.zona, r.nama_zona, r.jumlah_conto])],
    };
    const X = await import("./vendor/xlsx.js"), wb = X.utils.book_new();
    if (klien) T.lubang = T.lubang.map((r) => (clientGeo() ? [r[0], r[1], r[2], r[3], r[4], r[5], r[7], r[9], r[10], r[11], r[12]] : [r[0], r[1], r[2], r[3], r[4], r[5], r[12]]));
    for (const [k, nm] of [["ringkasan", "Ringkasan"], ["catatan", "Catatan"], ["rig", "Per rig"], ["harian", "Harian"], ["lubang", "Status lubang"], ["standby", "Standby"], ["titik", "Titik bor"], ["profil", "Profil bor"], ...(klien ? [] : [["operator", "Kepatuhan operator"], ["qc", "Data & QC"]])])
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(T[k]), nm);
    const fname = `TGEP_Laporan_Progres_${st.proj || "semua"}_${st.from}_${st.to}.xlsx`;
    window._lapDL = () => X.writeFile(wb, fname);
    const tbl = (a, opt = {}) => `<table>${a.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${esc(String(c))}</th>` : `<td${opt.col && /TERLAMBAT|BELUM\b/.test(String(c)) ? ' style="background:#F6C9C3"' : ""}>${esc(String(c ?? ""))}</td>`)).join("")}</tr>`).join("")}</table>`;
    const mx = Math.max(1, ...dayRows.map((r) => r[2])), bw = dayRows.length ? Math.min(40, Math.max(4, Math.floor(680 / dayRows.length) - 2)) : 10;
    const svg = dayRows.length ? `<svg width="720" height="170" style="border:1px solid #ddd;background:#fff">${dayRows.map((r, i) => { const h = (130 * r[2]) / mx; return `<rect x="${30 + i * (bw + 2)}" y="${145 - h}" width="${bw}" height="${h}" fill="#1E9E69"><title>${r[0]}: ${r[2]} m</title></rect>`; }).join("")}<text x="4" y="14" font-size="10">${mx.toFixed(0)} m</text><text x="30" y="162" font-size="10">${dayRows[0][0]}</text><text x="600" y="162" font-size="10">${dayRows.at(-1)[0]}</text></svg>` : "<p>Tidak ada data bor pada periode ini.</p>";
    if (st.slide) { w.document.open(); w.document.write(await presentasiHTML({ st, PJ, mPer, mCum, nSelesai, HR, K, dayRows, rigRows, sbRows, notes, LB, prof, klien, days })); w.document.close(); return; }
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
    <h2>Profil bor (ketebalan zona)</h2>${(prof ?? []).length ? profilSVG(prof) : "<p>Belum ada data logging yang masuk database untuk lubang-lubang ini.</p>"}
    ${await (async () => { const A = await analisisData(LB, prof, days), T2 = statistikData({ dayRows, HR, LB, prof, st, PJ, mCum }); let AS = [];
      try { const bhs = [...new Set((prof ?? []).map((r) => r.bhid))]; if (bhs.length) AS = (await sb.from("v_dh_assay").select("holeid,from,to,ni,fe,mgo,sio2,co").in("holeid", bhs)).data ?? []; } catch {}
      const KS = kesimpulanProspek({ A, T: T2, AS, prof: prof ?? [], LB });
      return `<h2>Kesimpulan: prospek atau tidak?</h2><div style="border:3px solid ${KS.warna};border-radius:10px;padding:8px 12px;margin:6px 0"><b style="font-size:16px;color:${KS.warna}">${esc(KS.vonis)}</b><br>${esc(KS.alasan)}</div>
        <table><tr><th>Kriteria</th><th>Nilai</th><th>Ambang (✓ / !)</th><th>Status</th></tr>${KS.baris.map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td><td>${esc(r.amb)}</td><td>${{ ok: "✓ memenuhi", warn: "! sedang", bad: "✗ tidak", na: "? belum ada data" }[r.s]}</td></tr>`).join("")}</table>
        <h3 style="font-size:12px;margin:8px 0 2px">Kadar rata-rata tertimbang per layer</h3>${KS.kadarTabel}<p><b>Rekomendasi:</b></p><ul>${KS.rekom.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p><small>Ambang = saringan awal eksplorasi nikel laterit (bukan klasifikasi sumber daya KCMI/JORC) dan perlu ditinjau geologis yang berkompeten.</small></p>`; })()}
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
  dl.innerHTML = rencanaLokal().map((r) => `<option value="${esc(r.bhid)}">`).join("");
  return rencanaLokal();
}
// "DHNPG01", "dh-npg01", "DH NPG 1"? -> ejaan resmi rencana bila hurufnya sama
const bakuBH = (x) => { const t = String(x ?? "").trim().toUpperCase(); if (!t) return ""; const r = rencanaLokal().find((z) => kunciBH(z.bhid) === kunciBH(t)); return r ? r.bhid : t; };
const jarakM = (a, b) => { const R = 6371000, r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
function pasangPilihBH(inp) {
  if (inp.dataset.bhOk) return; inp.dataset.bhOk = "1"; inp.setAttribute("list", "dlBH");
  if (!document.getElementById("dlBH")) { const dl = document.body.appendChild(Object.assign(document.createElement("datalist"), { id: "dlBH" })); dl.innerHTML = rencanaLokal().map((r) => `<option value="${esc(r.bhid)}">`).join(""); }
  const st = document.createElement("div"); st.style.cssText = "font-size:12px;margin-top:3px";
  const btn = Object.assign(document.createElement("button"), { type: "button", className: "sec", textContent: "📍 Pilih titik rencana" }); btn.style.cssText = "width:auto;padding:4px 10px;margin-top:4px;font-size:13px";
  inp.after(st, btn);
  const cek = () => { const t = inp.value.trim(); if (!t) return (st.textContent = ""); const R = rencanaLokal(), r = R.find((z) => kunciBH(z.bhid) === kunciBH(t));
    if (r) { st.innerHTML = `<span style="color:#1b7a3a">✓ Terhubung ke titik rencana <b>${esc(r.bhid)}</b> di peta</span>${r.bhid !== t.toUpperCase() ? ` <span class="muted">(ejaan disamakan saat disimpan)</span>` : ""}`; }
    else st.innerHTML = R.length ? `<span style="color:#a15c00">⚠ Tidak ada di daftar rencana — akan menjadi titik bor BARU di peta. Pastikan bukan salah ketik.</span>` : ""; };
  inp.addEventListener("input", cek); cek();
  btn.onclick = async () => {
    const R = rencanaLokal(); if (!R.length) return alert("Belum ada titik rencana bor (atau belum tersimpan di HP — buka aplikasi sekali saat ada sinyal).");
    const m = modal(`<h3>Pilih titik rencana bor</h3><p class="muted" id="plg">Mencari posisi GPS untuk mengurutkan dari yang terdekat…</p><ul class="list" id="pll"></ul><button class="sec" id="plx">Tutup</button>`);
    m.querySelector("#plx").onclick = () => m.remove();
    const isi = (pos) => { const rows = R.map((r) => ({ ...r, d: pos ? jarakM(pos, [r.lon, r.lat]) : null })).sort((a, b) => (pos ? a.d - b.d : a.bhid.localeCompare(b.bhid)));
      m.querySelector("#plg").textContent = pos ? "Urut dari yang terdekat dengan posisi Anda sekarang." : "GPS tidak tersedia — diurutkan menurut nama.";
      m.querySelector("#pll").innerHTML = rows.map((r) => `<li style="cursor:pointer" data-pl="${esc(r.bhid)}"><span style="flex:1"><b>${esc(r.bhid)}</b>${r.rig ? ` · ${esc(r.rig)}` : ""}${r.rencana_kedalaman ? ` · rencana ${esc(r.rencana_kedalaman)} m` : ""}</span><span class="muted">${r.d != null ? (r.d < 1000 ? Math.round(r.d) + " m" : (r.d / 1000).toFixed(1) + " km") : ""}</span></li>`).join("");
      m.querySelectorAll("[data-pl]").forEach((li) => (li.onclick = () => { inp.value = li.dataset.pl; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); m.remove(); })); };
    isi(null);
    navigator.geolocation?.getCurrentPosition((p) => isi([p.coords.longitude, p.coords.latitude]), () => isi(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  };
}
new MutationObserver(() => document.querySelectorAll("input[data-bhid]:not([data-bh-ok])").forEach(pasangPilihBH)).observe(document.body, { childList: true, subtree: true });
async function loadTugas() {
  if (!online()) return myTugas;
  const [{ data: a, error }, { data: pj }] = await Promise.all([sb.rpc("my_assignment"), sb.from("project").select("*").eq("aktif", true).order("nama")]);
  localStorage.setItem("projects", JSON.stringify(pj ?? []));
  loadPersonil(); muatRencana();
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
// Keluarkan operator dari rekap (admin): hapus akun permanen bila belum pernah mengirim data; bila sudah, nonaktifkan.
function keluarkanOperator(uid, nama) {
  return new Promise(async (selesai) => {
    const { error: cek } = await sb.rpc("admin_hapus_pengguna", { p_user: uid, p_konfirmasi: false });
    const bisaHapus = !cek;
    const m = modal(`<h3 style="color:#B3261E">Keluarkan ${esc(nama || "operator")} dari rekap?</h3>
      ${bisaHapus ? `<p><b>Apakah Anda yakin ingin menghapus akun ini?</b> Akun ini belum pernah mengirim data, jadi bisa <b>dihapus permanen</b>: akun, pendaftaran dan penugasannya hilang dan <b>tidak bisa dipulihkan</b>. Bila orang ini perlu masuk lagi, ia harus mendaftar ulang.</p>`
        : `<p>Akun ini <b>tidak bisa dihapus permanen</b> karena sudah mengirim data:<br><span class="muted">${esc(cek.message)}</span></p><p><b>Apakah Anda yakin ingin menonaktifkannya?</b> Ia tidak bisa masuk lagi dan hilang dari rekap harian, tetapi semua data yang pernah dikirim tetap tersimpan. Bisa diaktifkan kembali di menu <b>Pengguna</b>.</p>`}
      <label>Alasan (wajib)</label><textarea id="kla" rows="2" placeholder="mis. bukan petugas TGEP / akun uji coba / sudah tidak bertugas"></textarea>
      <p class="err" id="kle"></p>
      <div class="row"><button class="sec" id="klb">Batal</button><button id="klo" style="background:#B3261E">${bisaHapus ? "Ya, hapus akun" : "Ya, nonaktifkan"}</button></div>`);
    const tutup = (x) => { m.remove(); selesai(x); };
    m.querySelector("#klb").onclick = () => tutup(false);
    m.querySelector("#klo").onclick = async () => {
      const alasan = m.querySelector("#kla").value.trim();
      if (!alasan) return (m.querySelector("#kle").textContent = "Alasan wajib diisi.");
      m.querySelector("#klo").disabled = true;
      const { error } = bisaHapus ? await sb.rpc("admin_hapus_pengguna", { p_user: uid, p_konfirmasi: true })
        : await sb.rpc("admin_set_user", { p_user: uid, p_role: null, p_note: alasan });
      if (error) { m.querySelector("#kle").textContent = error.message; m.querySelector("#klo").disabled = false; return; }
      tutup(true);
    };
  });
}
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
function dbQuery(d, f) {
  let q = sb.from(d.v).select(d.sel ?? "*", { count: "exact" });
  if (f.bh && d.bh) q = q.ilike(d.bh, `%${f.bh}%`);
  if (f.proj) { if (d.bh) q = q.in(d.bh, f.proj.bhids.length ? f.proj.bhids : ["-"]); else if (["v_dash_rig_day", "p2h_check", "v_kepatuhan_harian"].includes(d.v)) q = q.in("rig", f.proj.rigs.length ? f.proj.rigs : ["-"]); }
  if (f.bad && d.bad && ["chk_harian", "flags"].includes(d.bad[0])) q = q.neq(d.bad[0], "");
  else if (f.bad && d.bad) q = q.or(d.bad.map((c) => `and(${c}.not.is.null,${c}.not.in.(${[...OKV].map((x) => `"${x}"`).join(",")}))`).join(","));
  const desc = ["v_survey_marking", "v_kepatuhan_harian", "deleted_record", "sample_edit_log", "v_drill_progress_daily", "v_drill_event_qc", "p2h_check", "form_photo", "v_ddr_list", "v_ddr_hours", "v_consumable_use", "v_dash_rig_day", "scan_job"].includes(d.v);
  for (const o of d.order) q = q.order(o, { ascending: d.v === "v_survey_marking" ? o !== "tanggal" : !desc }); // marking: tanggal terbaru dulu, pembacaan ke-1,2,3 berurutan
  return q;
}
async function fetchAll(d, f) {
  const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await dbQuery(d, f).range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; }
}
// ---------- Database FIX (hanya data final) untuk Microsoft Access ----------
// Final: sampel VERIFIED/SYNCED, DDR SIGNED, assay/QAQC yang sudah dilaporkan lab. Satu sheet = satu tabel Access.
const FIX = [
  ["collar", "holeid", "", "Collar lubang yang punya data final; status_lubang LENGKAP bila semua sampel final & bor selesai", "holeid,east,north,rl,depth,coord_source,area,prospect,grid,start_date,stop_date,core_size,sample_type,purpose,spacing,depth_tp,depth_l,depth_s,n_sample_final,n_sample_belum,status_lubang"],
  ["survey", "holeid, depth", "holeid → collar", "Survey arah lubang (vertikal)", "holeid,depth,azimuth,dip"],
  ["geology", "sample_no", "holeid → collar", "Logging geologi per interval (sampel VERIFIED/SYNCED)", "holeid,depth_from,depth_to,sample_no,sample_id,zone,lith1,lith1_pct,lith2,lith2_pct,colour,hardness,weathering,serpentinisation,silica_pct,garnierite_pct,min1,min1_pct,min2,min2_pct,core_length,recovery_pct,loss_from,loss_to,sample_wt_kg,comment,status_data,tgl_verifikasi"],
  ["density", "sample_no", "sample_no → geology", "Density (caliper & Archimedes) sampel final", "holeid,depth_from,depth_to,sample_no,zone,len_cm,diam_cm,wet_wt_g,dry_wt_g,vol_caliper_ml,vol_arch_ml,wet_density,dry_density,wet_density_arch,dry_density_arch,moisture_pct,arch_diff_pct"],
  ["assay", "lab_sample_id", "sample_no → geology", "Assay conto primer (hasil lab) dari sampel final", "holeid,depth_from,depth_to,sample_no,lab_sample_id,ni,co,fe,mgo,sio2,al2o3,cr2o3,cao,mno,loi,lab_job_no,method,date_reported"],
  ["qaqc", "lab_sample_id", "", "Hasil QAQC lab (CRM, blank, duplikat)", "dispatch_id,seq_in_batch,lab_sample_id,qc_type,source_sample_no,crm_id,ni_cert_pct,ni_sd_pct,ni,co,fe,crm_z,lab_job_no,date_reported"],
  ["ddr", "ddr_id", "", "DDR bertanda tangan (SIGNED)", "ddr_id,report_date,shift,rig,holeid,project,location,client,driller_name,helpers,crew_count,crew_nama,hm_start,hm_end,weather,hole_type,rod_m,target_m,total_depth_m,rig_type,notes"],
  ["ddr_jam", "", "ddr_id → ddr", "Distribusi jam DDR SIGNED", "ddr_id,tanggal,rig,shift,holeid,kategori,kelompok,mulai,selesai,menit,keterangan"],
  ["ddr_barang", "", "", "Pemakaian barang/consumable DDR SIGNED", "report_date,rig,shift,holeid,kategori,item,unit,qty,note"],
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
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["TGEP — Database FIX (hanya data final)"], [`Diunduh ${new Date().toLocaleString("id-ID")} oleh ${me?.full_name ?? ""}`],
      ["Final = sampel VERIFIED/SYNCED; DDR SIGNED; assay & QAQC yang sudah dilaporkan lab. Data draf/belum diperiksa tidak ikut."],
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
const UTM = (() => { const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), lon0 = (51 * 6 - 183) * Math.PI / 180, N0 = 10000000, E0 = 500000;
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
  return { ke, dari }; })();
// Elevasi DEMNAS di satu titik: baca piksel tile terrain-RGB zoom 14 (sama dengan yang dipakai peta)
const demCache = {};
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
      <button class="sec" id="pm3" style="flex:0">3D</button><label style="flex:0;white-space:nowrap;margin:0">Tinggi <input id="pmX" type="range" min="1" max="4" step="0.5" value="1.5" style="width:80px;vertical-align:middle"> <span id="pmXv">1,5×</span></label>
      <button class="sec" id="pmL" style="flex:0">Lapisan ▾</button><button class="sec" id="pmF" style="flex:0">Impor file</button><input type="file" id="pmFi" multiple accept=".zip,.shp,.dbf,.prj,.shx,.cpg,.kml,.kmz,.geojson,.json,.csv,.txt" style="display:none">
      <button class="sec" id="pmT" style="flex:0">● Lacak</button><button class="sec" id="pmI" style="flex:0">Ke IUP</button><button class="sec" id="pmO" style="flex:0">Simpan offline</button></div>
    <div id="pmPanel" class="card" style="display:none;margin:8px 0 0;padding:8px;background:#f6f7f2"></div>
    <div style="position:relative"><div id="pmap" style="height:70vh;margin-top:8px;border-radius:10px;overflow:hidden;background:#dfe5df"></div>
      <div id="pmLeg" style="position:absolute;left:8px;top:16px;background:rgba(255,255,255,.88);border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.6">${[["RENCANA", "Rencana"], ["PROGRES", "Progres (continue)"], ["EOH", "EOH / STB (selesai bor)"]].map(([k, t]) => `<div><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${WARNA_STATUS[k]};border:1.5px solid #111;vertical-align:-1px"></span> ${t}</div>`).join("")}<div><span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:2.5px solid #e00;vertical-align:-1px"></span> di luar IUP</div></div></div>
    <div class="muted" id="pmInfo" style="margin-top:6px;min-height:1.2em">Memuat peta…</div>
    <p class="muted" style="margin:4px 0 0">Relief: DEMNAS (BIG) ±8 m sampai pantai; di hutan bisa mengikuti puncak pohon. Citra: Esri World Imagery (perlu sinyal). GPS, relief, IUP, lubang & lapisan tetap jalan offline setelah “Simpan offline”.</p></div>`;
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
  let RK = null; const opRel = () => Number(localStorage.getItem("petaOpRel") || 0.65);
  const eks = () => Number($("#pmX").value), LBL = { iup: [], lubang: [] }, vis = JSON.parse(localStorage.getItem("petaVis") || "{}");
  const tampil = (k, def = true) => vis[k] ?? def, setVis = (k, on) => { vis[k] = on; localStorage.setItem("petaVis", JSON.stringify(vis)); };
  // Label HTML (tanpa font dari server → tetap tampil offline)
  const label = (ll, teks, gaya) => { const el = document.createElement("div"); el.textContent = teks; el.style.cssText = `font:600 11px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:0 4px;border-radius:4px;pointer-events:none;white-space:nowrap;${gaya}`; return new maplibregl.Marker({ element: el, anchor: "bottom-left", offset: [6, -4], opacityWhenCovered: "1" }).setLngLat(ll); };
  const pasangLabel = (k, on) => LBL[k].forEach((mk) => (on ? mk.addTo(map) : mk.remove()));
  let L = [], LAY = [];
  const muatLubang = async () => {
    if (!online()) { L = JSON.parse(localStorage.getItem("petaLubang") || "[]"); return; }
    const { data, error } = await ambilLubangPeta(); if (error) { L = JSON.parse(localStorage.getItem("petaLubang") || "[]"); return; }
    L = (data ?? []).map((r) => { const ll = r.x != null ? UTM.dari(r.x, r.y) : [r.lon, r.lat];
      return { type: "Feature", properties: { bhid: r.bhid, status: r.status, dalam: r.di_dalam_iup !== false, kd: r.kedalaman, rk: r.rencana_kedalaman, rig: r.rig ?? "", pos: r.sumber_posisi, dip: r.dip, az: r.azimuth, warna: WARNA_STATUS[r.status] ?? "#999" }, geometry: { type: "Point", coordinates: ll } }; })
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
      <div><b>Lubang bor</b>${Object.keys(LABEL_STATUS).filter((k) => k !== "SELESAI").map((k) => ck("st_" + k, LABEL_STATUS[k])).join("")}${ck("lbl", "Nama lubang")}</div>
      <div><b>Lapisan tambahan</b>${LAY.map((ly) => ck("ly_" + ly.id, `<span style="display:inline-block;width:12px;height:12px;background:${esc(ly.warna)};border-radius:3px"></span> ${esc(ly.nama)} <span class="muted">${ly.server ? "(server)" : "(HP ini)"}</span>`, true,
        (ly.server ? bisaTulis : true) ? ` <a href="#" data-del="${ly.id}" data-srv="${ly.server ? 1 : 0}" style="color:#c00">hapus</a>` : "")).join("") || `<span class="muted">Belum ada. Pakai “Impor file”.</span>`}</div>
      <div><b>Jejak tersimpan</b>${(JSON.parse(localStorage.getItem("trackList") || "[]")).map((t, i) => `<div>${esc(t.nama)} ${tz("tr_" + i)} <span class="muted">${(t.km ?? 0).toFixed(2)} km</span> <a href="#" data-gpx="${i}">GPX</a> · <a href="#" data-kml="${i}">KML</a> · <a href="#" data-tdel="${i}" style="color:#c00">hapus</a></div>`).join("") || `<span class="muted">Belum ada.</span>`}</div></div>`;
    $("#pmPanel").querySelectorAll("[data-vk]").forEach((c) => (c.onchange = () => { setVis(c.dataset.vk, c.checked);
      // warna elevasi dan lereng saling menggantikan agar tidak bertumpuk
      if (c.checked && (c.dataset.vk === "elev" || c.dataset.vk === "lereng")) { const lain = c.dataset.vk === "elev" ? "lereng" : "elev"; setVis(lain, false); const o = $("#pmPanel").querySelector(`[data-vk="${lain}"]`); if (o) o.checked = false; }
      terapkanVis(); }));
    const op = $("#pmOp"); if (op) op.oninput = () => { localStorage.setItem("petaOpRel", op.value); ["elev", "lereng"].forEach((id) => map.getLayer(id) && map.setPaintProperty(id, "raster-opacity", Number(op.value))); };
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
        m.remove(); await muatLubang(); gambarLubang(); $("#pmInfo").textContent = `${rows.length} rencana titik bor diimpor.`; return;
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
    pop.getElement().querySelector("[data-pakai]")?.addEventListener("click", (e) => { localStorage.setItem("bhid", e.target.dataset.pakai); document.body.style.overflow = ""; tab = "prog"; localStorage.setItem("tab", tab); render(); }); };
  const gambarLubang = () => {
    LBL.lubang.forEach((mk) => mk.remove());
    LBL.lubang = L.map((f) => { const p = f.properties, el = document.createElement("div"), r = p.status === "RENCANA" ? 11 : 15;
      el.style.cssText = "display:flex;align-items:center;gap:3px;cursor:pointer";
      el.innerHTML = `<span style="width:${r}px;height:${r}px;border-radius:50%;background:${p.warna};border:${p.dalam ? "1.5px solid #111" : "3.5px solid #e00"};box-sizing:border-box;box-shadow:0 0 2px #fff"></span><span data-nm style="font:600 11px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:0 4px;border-radius:4px;white-space:nowrap">${esc(p.bhid)}</span>`;
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
    const fc = { type: "FeatureCollection", features: W.map((w) => ({ type: "Feature", properties: { nama: w.nama }, geometry: { type: "Polygon", coordinates: [[...w.titik.map((t) => [t.lon, t.lat]), [w.titik[0].lon, w.titik[0].lat]]] } })) };
    map.addSource("iup", { type: "geojson", data: fc });
    map.addLayer({ id: "iup-isi", type: "fill", source: "iup", paint: { "fill-color": "#ff2d2d", "fill-opacity": 0.06 } });
    map.addLayer({ id: "iup-garis", type: "line", source: "iup", paint: { "line-color": "#ff2d2d", "line-width": 2.5 } });
    LBL.iup = W.flatMap((w) => w.titik.map((t) => label([t.lon, t.lat], String(t.no), "background:rgba(190,0,0,.75)")));
    map.addSource("trk", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource("trkSimpan", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "trkSimpan", type: "line", source: "trkSimpan", paint: { "line-color": "#ff00d4", "line-width": 3 } });
    map.addLayer({ id: "trk", type: "line", source: "trk", paint: { "line-color": "#00e5ff", "line-width": 3.5, "line-dasharray": [2, 1] } });

    await Promise.all([muatLubang(), muatLapisan()]); gambarLubang(); gambarLapisan(); gambarTrack(); terapkanVis(); panel();
    if (trk) mulaiLacak();
    const hit = (st) => L.filter((f) => f.properties.status === st).length;
    $("#pmInfo").textContent = `${L.length} lubang (rencana ${hit("RENCANA")}, progres ${hit("PROGRES")}, EOH ${hit("EOH")}, STB ${hit("STB")}) · ${LAY.length} lapisan tambahan · ketuk peta untuk koordinat & elevasi${online() ? "" : " · OFFLINE: data terakhir yang tersimpan"}`;
  });
  const info = async (ll) => { const u = UTM.ke(ll.lng, ll.lat), h = await tinggiDi(ll.lng, ll.lat), i = W.length ? (W.some((w) => diDalam(ll.lng, ll.lat, w.titik)) ? "di dalam IUP" : "di luar IUP") : "";
    const lr = await lerengDi(ll.lng, ll.lat);
    $("#pmInfo").textContent = `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)} · UTM 51S E ${u[0].toFixed(1)} N ${u[1].toFixed(1)}${h != null ? ` · elevasi DEM ±${h.toFixed(1)} m` : ""}${lr != null ? ` · lereng ±${Math.round(lr)} % (${(Math.atan(lr / 100) * 180 / Math.PI).toFixed(0)}°)` : ""}${i ? " · " + i : ""}`; };
  // lereng di titik ketuk: dari 4 tetangga ±10 m di DEM
  const lerengDi = async (lon, lat) => { const d = 10 / 111320, dx = d / Math.cos((lat * Math.PI) / 180);
    const [e, w, n, s2] = await Promise.all([tinggiDi(lon + dx, lat), tinggiDi(lon - dx, lat), tinggiDi(lon, lat + d), tinggiDi(lon, lat - d)]);
    if ([e, w, n, s2].some((x) => x == null)) return null; return Math.hypot((e - w) / 20, (n - s2) / 20) * 100; };
  map.on("click", (e) => info(e.lngLat));
  geo.on("geolocate", (p) => { if (watch === null) info({ lng: p.coords.longitude, lat: p.coords.latitude }); });
  $("#pmB").onchange = (e) => { ["sat", "osm"].forEach((k) => map.setLayoutProperty(k, "visibility", e.target.value === k ? "visible" : "none")); };
  $("#pm3").onclick = () => { const p = map.getPitch() > 5 ? 0 : 65; map.easeTo({ pitch: p, bearing: p ? -20 : 0, duration: 800 }); $("#pm3").textContent = p ? "2D" : "3D"; };
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
        U = ["vendor/maplibre-gl.js", "vendor/maplibre-gl.css", "vendor/shp.min.js", "vendor/togeojson.umd.js", "vendor/jszip.min.js", "peta/dem/index.json", "peta/kontur/index.json", "peta/kontur/kontur.geojson", "peta/kontur/elevasi.png", "peta/kontur/lereng.png", ...idx.tiles];
      let i = 0; for (const u of U) { await c.add(u); if (++i % 10 === 0) $("#pmInfo").textContent = `Menyimpan peta offline… ${i}/${U.length}`; }
      $("#pmInfo").textContent = `Peta offline tersimpan (${U.length} file). Relief, GPS, batas IUP, lubang & lapisan tetap bisa dibuka tanpa sinyal; citra satelit tetap perlu sinyal.`;
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
    <div style="flex:0;white-space:nowrap"><label><input type="checkbox" id="fbad" ${st.bad ? "checked" : ""} style="width:auto"> hanya yang bermasalah</label></div>
    <button id="go" style="flex:0">Tampilkan</button>
    <button class="sec" id="xl" style="flex:0">Unduh Excel (semua tabel)</button>
    <button class="sec" id="csv" style="flex:0">Unduh CSV tabel ini</button>
    ${isClient() ? "" : `<button id="acc" style="flex:0;white-space:nowrap">Unduh database FIX (Access)</button><button class="sec" id="accm" style="flex:0;white-space:nowrap">Macro impor Access</button>`}
   </div><div id="info" class="muted" style="margin-top:8px"></div></div>
   <div class="card"><div id="tb"></div><div class="row" style="margin-top:8px"><button class="sec" id="pv" style="flex:0">← Sebelumnya</button><button class="sec" id="nx" style="flex:0">Berikutnya →</button></div></div>`;
  $("#acc")?.addEventListener("click", () => unduhFix($("#info")));
  $("#accm")?.addEventListener("click", unduhMacroAccess);
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
    const fc = FILE_COL[f.ds] ?? {}, DV = await petaDrive(data, fc);
    const cell = (c, x) => { if (fc[c] && x) { const dv = DV[fc[c] + ":" + x]; return `<td style="padding:4px 7px;white-space:nowrap"><button class="sec" data-fb="${fc[c]}" data-fp="${esc(x)}" style="padding:2px 10px">Buka</button> ${dv ? `<a href="${esc(dv)}" target="_blank" rel="noopener" class="pill" style="background:#C8EBD4;color:#12251E;text-decoration:none" title="Buka salinan di Google Drive">Drive</a> ` : `<span class="muted" title="Belum tersalin ke Google Drive (disalin otomatis tiap 10 menit)">·</span> `}<a href="#" data-fl="${esc(dv || linkFile(fc[c], x))}" title="Salin link permanen${dv ? " (Google Drive)" : ""}" style="text-decoration:none">🔗</a></td>`; }
      const s = x !== null && typeof x === "object" ? JSON.stringify(x) : x; const bad = c.startsWith("chk_") && x && !OKV.has(x); return `<td style="padding:4px 7px;white-space:nowrap;${bad ? "background:#F6C9C3" : ""}">${esc(s)}</td>`; };
    $("#tb").innerHTML = `<div class="tw"><table><tr>${canDel || canRes ? "<th></th>" : ""}${cols.map((c) => `<th style="padding:4px 7px">${esc(c)}</th>`).join("")}</tr>
      ${data.map((r) => `<tr>${canDel ? `<td><button class="danger" data-k="${esc(r[d.del[1]])}" style="padding:2px 8px">Hapus</button></td>` : ""}${canRes ? `<td>${r.restored_at ? "dipulihkan" : `<button class="sec" data-r="${r.id}" style="padding:2px 8px">Pulihkan</button>`}</td>` : ""}${cols.map((c) => cell(c, r[c])).join("")}</tr>`).join("")}</table></div>`;
    $("#tb").querySelectorAll("[data-k]").forEach((b) => (b.onclick = async () => { if (await adminDelete(d.del[0], b.dataset.k, "conto")) show(page); }));
    $("#tb").querySelectorAll("[data-fb]").forEach((b) => (b.onclick = () => bukaFile(b.dataset.fb, b.dataset.fp)));
    $("#tb").querySelectorAll("[data-fl]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(a.dataset.fl); a.textContent = "✓"; setTimeout(() => (a.textContent = "🔗"), 1200); } catch { prompt("Salin link ini:", a.dataset.fl); } }));
    $("#tb").querySelectorAll("[data-r]").forEach((b) => (b.onclick = async () => { const { error } = await sb.rpc("admin_restore", { p_id: Number(b.dataset.r) }); if (error) alert(error.message); else show(page); }));
  };
  $("#go").onclick = () => show(0); $("#pv").onclick = () => show(st.page - 1); $("#nx").onclick = () => show(st.page + 1);
  $("#ds").onchange = () => show(0);
  const tag = () => { const f = read(); return `${f.bh ? f.bh + "_" : ""}${new Date().toISOString().slice(0, 10)}`; };
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
      for (const k of dsAllowed() ?? ["collar", "survey", "geology", "density", "assay", "qaqc", "foto", "progres", "aktivitas", "p2h", "ddr", "jam", "bbm", "lubang", "kinerja", "logging", "kepatuhan", "profil", "marking", "corefile", "scanfile", "arsipfoto"]) {
        const rows = (await tambahLink(k, await fetchAll(DATASETS[k], { ...f, bad: false }))).map((r) => { const o = { ...r }; delete o.data; delete o.related; for (const c in o) if (Array.isArray(o[c])) o[c] = o[c].join("; "); return o; }); got[k] = rows;
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
  const { data, error } = await sb.from("app_user").select("full_name,role").eq("user_id", session.user.id).maybeSingle();
  if (error) { me = JSON.parse(localStorage.getItem("me") || "null"); return; }   // gangguan jaringan: pakai identitas terakhir
  if (!data || data.role === "nonaktif") {
    // akun yang pernah aktif lalu dihapus / dinonaktifkan: tutup akses total, hapus semua data tersimpan di HP
    if (data?.role === "nonaktif" || localStorage.getItem("me")) return aksesDicabut(data?.role === "nonaktif" ? "dinonaktifkan" : "dihapus");
    me = null; return;   // pendaftar baru: menunggu persetujuan
  }
  me = data; localStorage.setItem("me", JSON.stringify(data));
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
});
addEventListener("online", async () => { const { data } = await sb.auth.getSession(); if (data.session) { session = data.session; render(); sync(); } else if (session?.offline) { session = null; render(); } });
const { data: s0 } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
session = s0?.session ?? offlineSession(); await loadMe(); render(); sync();
