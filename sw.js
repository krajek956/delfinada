/* DELFINADA PWA — service worker
 * Strategia:
 *  - Nawigacje (HTML): network-first → świeża wersja, offline fallback z cache.
 *  - Statyki (css/js/obrazy/czcionki): stale-while-revalidate → szybko z cache, aktualizacja w tle.
 *  - Wersjonowany cache: podbij APP_VERSION, by wymusić odświeżenie u wszystkich.
 */
const APP_VERSION = 'v1.1.0';
const CACHE = `delfinada-${APP_VERSION}`;

// Pliki do wstępnego zapisania (działanie offline od pierwszej wizyty)
const PRECACHE = [
  './',
  './app-login.html',
  './app-postepy.html',
  './app-trener.html',
  './app-admin.html',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './assets/app-icon-maskable.svg',
  './assets/favicon.png',
  './assets/logo-delfinada.png',
  './assets/pwa.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  // Nie czekaj — pozwól nowej wersji przejąć kontrolę po aktywacji (gdy klient na to pozwoli).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Usuń stare cache z poprzednich wersji
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Pozwól stronie wymusić natychmiastową aktywację nowej wersji
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 0) Nigdy nie cache'uj wywołań do Supabase (dane muszą być świeże/żywe)
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return; // niech przeglądarka obsłuży normalnie, bez pośrednictwa SW
  }

  // 1) Nawigacje / dokumenty HTML → network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (isSameOrigin) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match('./app-postepy.html');
        }
      })()
    );
    return;
  }

  // 2) Pozostałe GET → stale-while-revalidate
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const network = fetch(req)
        .then((res) => {
          // Zapisuj tylko sensowne odpowiedzi
          if (res && res.status === 200 && (isSameOrigin || res.type === 'cors')) {
            caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => null);
      return cached || network || fetch(req).catch(() => cached);
    })()
  );
});
