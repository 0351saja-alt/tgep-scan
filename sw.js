const CACHE = "tgep-scan-v206";
const SHELL = ["./", "index.html", "daftar.html", "daftar.js", "vendor/fonts/great-vibes-latin-400-normal.woff2", "vendor/fonts/dancing-script-latin-400-normal.woff2", "vendor/fonts/sacramento-latin-400-normal.woff2", "vendor/fonts/allura-latin-400-normal.woff2", "app.js", "config.js", "vendor/supabase.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && !k.startsWith("tgep-dokumen") && k !== "tgep-peta" && k !== "tgep-peta-luar").map((k) => caches.delete(k))))); self.clients.claim(); });
// Peta & pustaka: disimpan di cache tetap "tgep-peta" (tidak terhapus saat aplikasi diperbarui) begitu pernah tampil,
// sehingga saat offline otomatis tersedia. Ubin luar (citra satelit Esri, OSM) disimpan di "tgep-peta-luar" (dibatasi jumlahnya).
const LUAR = /(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org)$/;
const MAKS_LUAR = 6000;
async function rapikanLuar() { const c = await caches.open("tgep-peta-luar"), k = await c.keys(); if (k.length > MAKS_LUAR) for (const r of k.slice(0, k.length - MAKS_LUAR)) await c.delete(r); }
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin !== location.origin) {
    if (!LUAR.test(u.hostname)) return; // panggilan Supabase dll. tidak di-cache
    e.respondWith(caches.open("tgep-peta-luar").then(async (c) => { const ada = await c.match(e.request); if (ada) return ada;
      const r = await fetch(e.request); if (r.ok || r.type === "opaque") { c.put(e.request, r.clone()); if (Math.random() < 0.02) rapikanLuar(); } return r; }));
    return;
  }
  if (/\/(peta|vendor)\//.test(u.pathname)) { // stale-while-revalidate ke cache tetap
    e.respondWith(caches.open("tgep-peta").then(async (c) => { const ada = await c.match(e.request);
      const baru = fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
      return ada ?? (await baru) ?? caches.match(e.request).then((x) => x || new Response("", { status: 504 })); }));
    return;
  }
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
