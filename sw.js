// Service worker: caches every app file on install so the app works offline.
// The deploy workflow replaces 'dev' on the next line with the commit SHA.
const VERSION = 'dev';
const CACHE_PREFIX = 'habit-tracker-';
const CACHE_NAME = `habit-tracker-${VERSION}`;

// Every deployable file. tests/sw-files.test.js fails if this list and the
// files on disk differ. All URLs are relative so the app works under a subpath.
const APP_FILES = [
  './',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/backup.js',
  './src/calendar.js',
  './src/clock.js',
  './src/dates.js',
  './src/store.js',
  './src/streaks.js',
  './src/views/confirm.js',
  './src/views/data-problem.js',
  './src/views/dom.js',
  './src/views/download.js',
  './src/views/edit-habit.js',
  './src/views/format.js',
  './src/views/habit-form.js',
  './src/views/habit.js',
  './src/views/new-habit.js',
  './src/views/settings.js',
  './src/views/today.js',
  './styles.css',
];

// Resolve against the worker's scope so the paths work under any subpath.
const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // 'reload' skips the HTTP cache, so a new version never stores old files.
      .then((cache) => cache.addAll(APP_FILES.map((path) => new Request(scopeUrl(path), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Cache first, then network. Nothing is added to the cache after install.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        if (request.mode === 'navigate') return caches.match(scopeUrl('./index.html'));
        return Response.error();
      });
    }),
  );
});
