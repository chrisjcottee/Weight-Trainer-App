/* Weight Trainer service worker.
   Cache name is version-keyed so each deploy invalidates the previous
   wholesale. Network-first for the HTML / JS / CSS shell so code
   updates land on the next reload; cache-first for static assets so
   icons stay fast and offline. skipWaiting + clients.claim plus a
   controllerchange auto-reload in app.js means a new deploy takes
   over without users having to close every tab.

   IMPORTANT: bump VERSION on every release so old caches drop. */
const VERSION = 'v24';
const CACHE = `wt-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './js/constants.js',
  './js/utils.js',
  './js/state.js',
  './js/views.js',
  './js/programs.js',
  './js/views/today.js',
  './js/views/settings.js',
  './js/views/history.js',
  './js/views/workout.js',
  './js/views/celebration.js',
  './js/workouts.js',
  './js/events.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isShellRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const url = new URL(request.url);
  return url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;

  if (isShellRequest(req)) {
    // Network-first: bypass the browser HTTP cache so a deploy is
    // visible on the very next request. Fall back to the SW cache
    // only when offline.
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, etc.)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return response;
      }).catch(() => cached);
    })
  );
});
