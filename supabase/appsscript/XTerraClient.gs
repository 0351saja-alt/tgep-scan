/**
 * X-Terra — SINKRON FOLDER CLIENT (tambahan v4, 28/11/2026)
 * Tempel sebagai FILE BARU di proyek Apps Script "X-Terra Sinkron Drive" (yang sudah ada), lalu jalankan pasangClient() sekali.
 * Fungsinya: file yang sudah DIRILIS ke client disalin ke Google Drive per client, disusun PER JENIS DATA lalu per titik:
 *   Client/<nama (email)>/01 DDR bertanda tangan/DH-NPG 08R/...  · 02 Form Logging · 05 Foto core · 06 Foto aktivitas bor · 07 Arsip formulir
 * Folder Client/<nama (email)> otomatis dibagikan (akses LIHAT) ke email client tsb, dan link foldernya dikirim ke aplikasi
 * sehingga tombol "Google Drive ↗" di menu Database utama client langsung membuka folder yang benar.
 * Folder Keuangan / Driller / Wellsite TIDAK dibagikan ke client.
 */
var XC = {
  URL: 'https://ytrvezripgkzuwyjvmnb.supabase.co/functions/v1/drive-sync',
  // Kunci sinkron diambil dari skrip lama (KONFIG.KUNCI). Bila skrip lama tidak memakai nama itu, tempel kuncinya di sini.
  KUNCI: (typeof KONFIG !== 'undefined' && KONFIG && KONFIG.KUNCI) ? KONFIG.KUNCI : 'TEMPEL_KUNCI_SINKRON_DI_SINI',
  INDUK_ID: '1xrju7UhiRtat--3csBpqwqfUnYmZLtJa',   // folder induk yang berisi "Driller" dan "Wellsite (Geologi)"
  BATAS: 40
};
var XC_JENIS = { '01 DDR bertanda tangan': 'DDR', '02 Form Logging': 'LOGGING', '05 Foto core': 'CORE', '06 Foto aktivitas bor': 'AKTIVITAS', '07 Arsip formulir': 'ARSIP' };

function xcPanggil_(metode, q, body) {
  var o = { method: metode, headers: { 'x-sync-key': XC.KUNCI }, muteHttpExceptions: true, contentType: 'application/json' };
  if (body) o.payload = JSON.stringify(body);
  var r = UrlFetchApp.fetch(XC.URL + (q || ''), o);
  if (r.getResponseCode() >= 300) throw new Error('drive-sync ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText());
}
function xcFolder_(path) {
  var f = DriveApp.getFolderById(XC.INDUK_ID);
  path.split('/').filter(String).forEach(function (n) { var it = f.getFoldersByName(n); f = it.hasNext() ? it.next() : f.createFolder(n); });
  return f;
}
function xcEmail_(namaClient) { var m = /\(([^()]+@[^()]+)\)\s*$/.exec(namaClient || ''); return m ? m[1].trim().toLowerCase() : null; }

function sinkronClient() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var d = xcPanggil_('get', '?mode=client&limit=' + XC.BATAS), catat = [], tarik = [], lapor = {}, dibagi = {};
    (d.tambah || []).forEach(function (t) {
      try {
        var f = xcFolder_(t.folder), src = DriveApp.getFileById(t.sumber_id), c = src.makeCopy(t.nama || src.getName(), f);
        catat.push({ user_id: t.user_id, bucket: t.bucket, path: t.path, drive_id: c.getId(), folder: t.folder });
        var seg = t.folder.split('/'), akar = seg.slice(0, 2).join('/'), jp = seg.slice(0, 3).join('/'), kj = XC_JENIS[seg[2]];
        if (!lapor[t.user_id + '|ROOT']) {
          var fa = xcFolder_(akar); lapor[t.user_id + '|ROOT'] = { kunci: 'ROOT', user_id: t.user_id, path: akar, url: fa.getUrl() };
          var em = xcEmail_(seg[1]); if (em && !dibagi[em]) { try { fa.addViewer(em); } catch (e) { Logger.log('bagi ' + em + ': ' + e); } dibagi[em] = 1; }
        }
        if (kj && !lapor[t.user_id + '|' + kj]) lapor[t.user_id + '|' + kj] = { kunci: kj, user_id: t.user_id, path: jp, url: xcFolder_(jp).getUrl() };
      } catch (e) { Logger.log('salin ' + t.path + ': ' + e); }
    });
    (d.tarik || []).forEach(function (t) { try { DriveApp.getFileById(t.drive_id).setTrashed(true); } catch (e) {} tarik.push({ user_id: t.user_id, bucket: t.bucket, path: t.path }); });
    if (catat.length) xcPanggil_('post', '', { client_catat: catat });
    if (tarik.length) xcPanggil_('post', '', { client_tarik: tarik });
    var fl = Object.keys(lapor).map(function (k) { return lapor[k]; });
    if (fl.length) xcPanggil_('post', '', { folder_catat: fl });
    Logger.log('Client: salin ' + catat.length + ' · tarik ' + tarik.length + ' · link folder ' + fl.length);
  } finally { lock.releaseLock(); }
}
/** Jalankan SEKALI: memasang pemicu tiap 15 menit lalu langsung sinkron. */
function pasangClient() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sinkronClient') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sinkronClient').timeBased().everyMinutes(15).create();
  sinkronClient();
}
