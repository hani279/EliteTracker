/* ELITE Tracker service worker — offline-first cache
   index.html loads css/js with a ?v=N query string that must match CACHE
   below. Static hosts (this includes plain `python -m http.server`) often
   send no cache-control headers, so browsers apply their own heuristic
   HTTP caching independent of this service worker — bumping CACHE alone
   isn't enough to bust that, since the SW's own install-time fetch can
   still read a stale browser-cached response for the same URL. Bumping
   the query string forces a genuinely new URL, which forces a real fetch.
   Bump both together on every deploy. */
const CACHE = 'elite-tracker-v45';
const V = '?v=45';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css' + V,
  './js/icons.js' + V,
  './js/supabase-client.js' + V,
  './js/auth.js' + V,
  './js/store.js' + V,
  './js/push.js' + V,
  './js/sync.js' + V,
  './js/data.js' + V,
  './js/intelligence.js' + V,
  './js/ui.js' + V,
  './js/app.js' + V,
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Navigation (index.html) is always network-first, bypassing the browser's
  // own heuristic HTTP cache — it has no ?v= query string to bust, so a
  // stale cached copy here would keep pointing at old, no-longer-served
  // asset versions. Only fall back to the cached shell when truly offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Web Push — delivered by the send-nudge Edge Function, shows even when
// the app isn't open (unlike the in-page Notification calls in app.js,
// which only fire while a tab is running).
self.addEventListener('push', (e) => {
  let data = { title: 'ELITE Tracker', body: 'You have a new nudge.' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch (err) { /* non-JSON payload, use default */ }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
  }));
});

// Local notification support (works while SW is alive / app installed)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./index.html');
  }));
});
