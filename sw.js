/* Kit Casa Organizada · VidaFlor — Service Worker
   Padrão anti-CDN: caminhos relativos + cache:"reload" no precache +
   versionamento de cache + limpeza no activate. */

const VERSION = 'v1.0.0';
const SHELL_CACHE = `vidaflor-shell-${VERSION}`;
const FONT_CACHE = `vidaflor-fonts-${VERSION}`;

/* App shell — tudo local, sem CDN. Caminhos relativos ao escopo. */
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/app.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // cache:"reload" força buscar do servidor, ignorando cache HTTP do navegador
      await cache.addAll(
        SHELL_ASSETS.map((url) => new Request(url, { cache: 'reload' }))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

const isFont = (url) =>
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Navegação (HTML): network-first com fallback ao shell — garante que
     uma versão online mais nova apareça, mas funciona offline. */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  /* Google Fonts: stale-while-revalidate em cache próprio. */
  if (isFont(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FONT_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(request, res.clone());
            }
            return res;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })()
    );
    return;
  }

  /* App shell e demais assets do mesmo escopo: cache-first. */
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch (e) {
          return Response.error();
        }
      })()
    );
  }
});

/* Permite ao app pedir atualização imediata do SW. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
