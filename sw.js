// Al-Mustanir service worker: keeps the palace available offline.
// Your data never passes through the cache; Supabase requests always go to the network.
const CACHE = 'mustanir-v9';
const SHELL = ['./', './index.html', './manifest.webmanifest', './js/app.js', './js/logic.js', './js/store.js', './js/charts.js', './js/fx.js', './js/palace3d.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
// Third-party files the app needs offline: the 3D library and the fonts.
const RUNTIME = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // newest version when online, cached copy when offline
    // no-cache: always revalidate with the server, so a new deploy shows up on the next open
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req)));
    return;
  }
  if (RUNTIME.includes(url.hostname)) {
    // versioned third-party files: cache first, fill on first use
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
  // everything else (Supabase) goes straight to the network
});

// Reminders from the cabinet.
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Al-Mustanir', {
    body: m.body || '', tag: m.tag, renotify: !!m.tag, icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { url: m.url || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.location.origin)) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
