// Caches the app shell so the page still opens with no internet (needed for manual scoring).
const CACHE = "archery-shell-v3";
const SHELL = ["./", "index.html", "style.css", "config.js", "rounds.js", "qr.js", "store.js", "app.js", "favicon.svg", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("index.html"))));
});
