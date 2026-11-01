// Al-Mustanir service worker. The app shell works offline; your data never passes through the cache.
// At build time vite.config.ts fills in BUILD (a fresh id per deploy) and PRECACHE (every built file).
const BUILD = "__BUILD__";
const PRECACHE = self.__PRECACHE || [];
const CACHE = "mustanir-" + BUILD;
const SHELL = "./index.html";
const RUNTIME = ["fonts.googleapis.com", "fonts.gstatic.com"]; // the Arabic fonts

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", SHELL, ...PRECACHE])).then(async () => {
    // First install, or replacing the pre-redesign worker: take over at once. Later updates wait until you tap "Update".
    const legacy = (await caches.keys()).some((k) => /^mustanir-v\d+$/.test(k));
    if (!self.registration.active || legacy) return self.skipWaiting();
  }));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("mustanir") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

const put = (key, res) => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    // The shell of this version, instantly (it matches its own assets); the network only if it's missing.
    e.respondWith(caches.match(SHELL).then((hit) => hit || fetch(req).then((r) => put(SHELL, r))).catch(() => caches.match("./")));
    return;
  }
  if (url.origin === self.location.origin) {
    // Hashed assets and icons never change within a version: cache first, then fill in from the network.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => put(req, r))));
    return;
  }
  if (RUNTIME.includes(url.hostname)) e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => put(req, r))));
  // Everything else (Supabase) goes straight to the network.
});

// Reminders from the cabinet.
self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || "Al-Mustanir", {
    body: m.body || "", tag: m.tag, renotify: !!m.tag, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", data: { url: m.url || "./#today" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#today", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin)) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
