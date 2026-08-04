const CACHE = 'risen-assets-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !new URL(req.url).pathname.includes('/assets/')) return;
  e.respondWith(caches.open(CACHE).then(cache =>
    cache.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      if (hit) { refresh.catch(() => {}); return hit; }
      return refresh;
    })
  ));
});
