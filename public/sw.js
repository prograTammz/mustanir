// Al-Mustanir service worker. The app shell works offline; your data never passes through the cache.
// At build time vite.config.ts fills in BUILD (the release number and a hash of the built files), PRECACHE (every built
// file) and RELEASE (which update this is, its notes, and the lowest release allowed to keep running: see src/lib/update.js).
const BUILD = "__BUILD__";
const PRECACHE = self.__PRECACHE || [];
const RELEASE = self.__RELEASE || null;
const CACHE = "mustanir-2-" + BUILD; // "2": the app asks for the swap itself (see install)
const SHELL = "./index.html";
const RUNTIME = ["fonts.googleapis.com", "fonts.gstatic.com"]; // the Arabic fonts

self.addEventListener("install", (e) => {
  // The shell comes from the server, never the HTTP cache (Pages keeps index.html 10 minutes): an older one would point at
  // assets the last deploy deleted, and the app would open blank. Hashed assets can't be stale, so they may come from cache.
  const fresh = (u) => new Request(u, { cache: "reload" });
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([fresh("./"), fresh(SHELL), ...PRECACHE])).then(async () => {
    // Updates wait for the app to send SKIP_WAITING: main.jsx does when you leave the app or as it opens, and so does the
    // rescue on the stuck screen (index.html). Take over at once on a first install, or over a worker from before the app
    // asked (a cache not named mustanir-2-…): that app would never ask, and it reloads itself when the new one takes over.
    const older = (await caches.keys()).some((k) => k.startsWith("mustanir") && !k.startsWith("mustanir-2-"));
    if (!self.registration.active || older) return self.skipWaiting();
  }));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("mustanir") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// "SKIP_WAITING" from the app (src/lib/update.js) and the boot screen's rescue; VERSION so the app can say what a waiting
// update is ("Update 16 is ready", with its notes) without the network.
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  else if (e.data && e.data.type === "VERSION" && e.ports[0]) e.ports[0].postMessage({ ...(RELEASE || { number: 0 }), build: BUILD });
});

const put = (key, res) => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // What's live, and the worker itself: always the network (Check for updates fetches both past every cache).
  if (url.origin === self.location.origin && /\/(version\.json|sw\.js)$/.test(url.pathname)) return;
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
