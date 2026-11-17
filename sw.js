const CACHE = "tgep-scan-v31";
const SHELL = ["./", "index.html", "daftar.html", "daftar.js", "vendor/fonts/great-vibes-latin-400-normal.woff2", "vendor/fonts/dancing-script-latin-400-normal.woff2", "vendor/fonts/sacramento-latin-400-normal.woff2", "vendor/fonts/allura-latin-400-normal.woff2", "app.js", "config.js", "vendor/supabase.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && !k.startsWith("tgep-dokumen")).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // panggilan Supabase tidak di-cache
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
