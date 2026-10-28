// KasirHnY — Service Worker
// Strategy:
//   - App shell (HTML/JS/CSS/icon/manifest): cache-first, updated in the background.
//   - CDN vendor scripts (jsDelivr, unpkg): stale-while-revalidate.
//   - Supabase API: network-only (never cached, sync must reflect live state).

const CACHE_VERSION = 'kasirhny-v3';
const APP_SHELL = [
  './',
  './index.html',
  './js/sync.js',
  './js/app.js',
  './js/pos.js',
  './icon.svg',
  './manifest.json'
];

const CDN_ORIGINS = ['cdn.jsdelivr.net', 'unpkg.com'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Best-effort: individual failures shouldn't abort install
      Promise.all(APP_SHELL.map(u => cache.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Supabase or other API calls — sync integrity trumps offline
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // Same-origin app shell → cache-first with background refresh
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // CDN vendor scripts → stale-while-revalidate
  if (CDN_ORIGINS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Everything else: fall through to network
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req, { ignoreSearch: false });
  if (cached) {
    // Refresh in background so next load has latest
    fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    // Offline fallback for navigations → index.html shell
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}
