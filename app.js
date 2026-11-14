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
  } finally { syncing = false; if (["foto", "core", "prog"].includes(tab)) render(); }
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
  const navs = [["prog", "Progres bor"], ["foto", "Foto formulir"], ["core", "Foto core"], ...(["verifier", "admin"].includes(me?.role) ? [["review", "Periksa scan"], ["data", "Data & cek"], ["db", "Database"], ...(me?.role === "admin" ? [["users", "Pengguna"]] : [])] : [])];
  const banner = session.offline ? `<div class="card" style="background:#FBE6D0">Mode offline — foto disimpan di HP dan dikirim otomatis saat ada sinyal.</div>` : "";
  app.innerHTML = banner + `<nav>${navs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}<button class="sec" id="out" style="flex:0">Keluar</button></nav><div id="v"></div>`;
  app.querySelectorAll("nav [data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; localStorage.setItem("tab", tab); render(); }));
  $("#out").onclick = async () => { if (!confirm("Keluar dari akun? Foto di antrean tetap tersimpan di HP.")) return; localStorage.setItem("manualLogout", "1"); localStorage.removeItem("lastUser"); session = null; await sb.auth.signOut().catch(() => {}); render(); };
  if (me?.role === "admin" && navigator.onLine && !session.offline) sb.from("registration_request").select("user_id", { count: "exact", head: true }).eq("status", "PENDING")
    .then(({ count }) => { const b = app.querySelector('nav [data-t="users"]'); if (b && count) b.textContent = `Pengguna (${count} baru)`; });
  document.querySelector("main").style.maxWidth = tab === "db" ? "none" : "";
  if (tab === "foto") return fotoView($("#v"));
  if (tab === "review") return reviewList($("#v"));
  if (tab === "data") return dataView($("#v"));
  if (tab === "core") return coreView($("#v"));
  if (tab === "db") return dbView($("#v"));
  if (tab === "prog") return progView($("#v"));
  if (tab === "users") return usersView($("#v"));
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
  const opt = (sel) => ["geologist", "verifier", "admin"].map((r) => `<option ${r === sel ? "selected" : ""}>${r}</option>`).join("");
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
  koreksi: { t: "Riwayat koreksi", v: "sample_edit_log", order: ["edited_at"], bh: null },
  arsip: { t: "Arsip terhapus (admin)", v: "deleted_record", order: ["deleted_at"], bh: "bhid", admin: true },
};
const OKV = new Set(["OK", "OK-SW", "BELUM OVEN", "MENUNGGU CEK"]);
function dbQuery(d, f) {
  let q = sb.from(d.v).select("*", { count: "exact" });
  if (f.bh && d.bh) q = q.ilike(d.bh, `%${f.bh}%`);
  if (f.bad && d.bad && ["chk_harian", "flags"].includes(d.bad[0])) q = q.neq(d.bad[0], "");
  else if (f.bad && d.bad) q = q.or(d.bad.map((c) => `and(${c}.not.is.null,${c}.not.in.(${[...OKV].map((x) => `"${x}"`).join(",")}))`).join(","));
  const desc = ["deleted_record", "sample_edit_log", "v_drill_progress_daily", "v_drill_event_qc", "p2h_check"].includes(d.v);
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
      for (const k of ["collar", "survey", "geology", "density", "assay", "qaqc", "foto", "progres", "aktivitas", "p2h"]) {
        const rows = (await fetchAll(DATASETS[k], { ...f, bad: false })).map((r) => { const o = { ...r }; delete o.data; delete o.related; return o; });
        X.utils.book_append_sheet(wb, rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([["(kosong)"]]), DATASETS[k].t.slice(0, 31).replace(/[\\/?*\[\]:]/g, " "));
      }
      X.writeFile(wb, `TGEP_Database_${tag()}.xlsx`); $("#info").textContent = "Excel diunduh (10 sheet).";
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
