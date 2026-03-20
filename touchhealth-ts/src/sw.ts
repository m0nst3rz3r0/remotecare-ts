// Service Worker (offline-first app shell caching)
// Spec:
// - Cache First for app shell assets
// - Network First for API requests
// - Cache name: 'touchhealth-v1'
// - Pre-cache: index.html, main JS bundle, Google Fonts
//
// Note: this project doesn't yet use a SW build plugin that compiles `src/sw.ts`
// into `/sw.js`, so we also include a hand-written `/public/sw.js`.

const CACHE_NAME = 'touchhealth-v1';

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Karla:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap';

// Best-effort precache list (works in dev; production precaching is handled by a proper SW build plugin later).
const PRECACHE_URLS = ['/', '/index.html', FONT_URL];

// Cast the global `self` to a ServiceWorker-like object for TS.
const sw = self as any;

function isApiRequest(request: Request) {
  const url = new URL(request.url);
  // Heuristic: Supabase calls typically go to `*.supabase.co/rest/v1/*`
  return (
    request.method === 'GET' &&
    url.hostname.includes('supabase') &&
    url.pathname.includes('/rest/v1')
  );
}

function isAppShellRequest(request: Request) {
  const dest = (request as any).destination as string | undefined;
  return (
    request.mode === 'navigate' ||
    dest === 'document' ||
    dest === 'script' ||
    dest === 'style' ||
    dest === 'font' ||
    dest === 'image'
  );
}

sw.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        try {
          await cache.addAll(PRECACHE_URLS);
        } catch {
          // Ignore precache failures (offline/blocked remote fonts, etc.)
        }
      })
      .then(() => sw.skipWaiting?.()),
  );
});

sw.addEventListener('activate', (event: any) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches (best-effort)
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return Promise.resolve(false);
        }),
      );
      await sw.clients?.claim?.();
    })(),
  );
});

sw.addEventListener('fetch', (event: any) => {
  const request: Request = event.request;

  // Only handle GET caching.
  if (request.method !== 'GET') return;

  // Network-first for API, cache-first for app shell.
  if (isApiRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(request);
          // Cache successful responses for retry/offline use.
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
        // Offline: fall back to whatever is cached.
        if (cached) return cached;
        throw new Error('Offline and not cached');
      }
    })(),
  );
});

