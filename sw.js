/* ══════════════════════════════════════════
   BCR Contacts — Service Worker
   Cache-first for app shell; network-first
   for API calls so Brevo always gets fresh data.
══════════════════════════════════════════ */

const CACHE   = 'bcr-contacts-v1';
const SHELL   = ['./', './index.html', './manifest.json'];

/* ── Install: pre-cache app shell ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch strategy ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for Brevo API and CDN scripts
  if (url.hostname.includes('brevo.com') || url.hostname.includes('cdnjs.cloudflare.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for everything else (app shell)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful GET responses for same-origin assets
        if (e.request.method === 'GET' && url.origin === self.location.origin && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback — serve cached index.html for navigation requests
      if (e.request.mode === 'navigate') return caches.match('./index.html');
    })
  );
});
