// Hand-written service worker to satisfy `/sw.js` registration now.
// Once SW build tooling is added, `src/sw.ts` should be the source of truth.

const CACHE_NAME = 'touchhealth-v3';

const PRECACHE_URLS = ['/', '/index.html', '/foods.json', '/rules.json'];

function isApiRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && url.hostname.includes('supabase') && url.pathname.includes('/rest/v1');
}

function isAppShellRequest(request) {
  if (new URL(request.url).origin !== self.location.origin) return false;
  const dest = request.destination;
  return (
    request.mode === 'navigate' ||
    dest === 'document' ||
    dest === 'script' ||
    dest === 'style' ||
    dest === 'font' ||
    dest === 'image'
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch {
        // Ignore precache failures.
      }
    }).then(() => self.skipWaiting && self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return Promise.resolve(false);
        }),
      );
      await self.clients && self.clients.claim && self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (isApiRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('Network unavailable');
        }
      })(),
    );
    return;
  }

  if (!isAppShellRequest(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const fresh = await fetch(request);
        cache.put(request, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        if (cached) return cached;
        return Response.error();
      }
    })(),
  );
});

