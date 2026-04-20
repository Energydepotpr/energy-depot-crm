const CACHE = 'fatp-crm-v4';
const PRECACHE = ['/dashboard', '/leads', '/inbox', '/contacts', '/logo.webp'];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;
  if (url.includes('/backend/') || url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push: show notification ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Energy Depot PR CRM';

  // Use unique tag per push so Android always sounds (renotify only works with same tag)
  const tag = data.tag ? `${data.tag}-${Date.now()}` : `crm-${Date.now()}`;

  const options = {
    body:    data.body || 'Tienes una nueva notificación',
    icon:    '/icon-192.png',   // PNG required for iOS notifications
    badge:   '/icon-192.png',
    data:    { url: data.url || '/inbox' },
    vibrate: [300, 100, 300, 100, 300],
    tag,
    renotify: true,             // Force sound even if notification already visible
    requireInteraction: false,
    silent: false,              // Explicit: never silent
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open/focus inbox ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/inbox';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
