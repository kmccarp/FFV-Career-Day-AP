/* Service worker.
   App code (HTML/JS/CSS/manifest) is served network-first so a new deploy is
   picked up as soon as you're online; images are cached-first for speed/offline.
   Tracker state itself lives in localStorage, so it works with or without this. */
var CACHE = 'ffv-career-day-v2';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Treat navigations and the app's own code as "shell" that should stay fresh.
function isShell(req) {
  if (req.mode === 'navigate') return true;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  return /\.(?:html|js|css|webmanifest)$/.test(url.pathname);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  if (isShell(req)) {
    // network-first: latest code when online, cached copy when offline
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (c) { return c || caches.match('./index.html'); });
      })
    );
    return;
  }

  // everything else (images, icons): cache-first
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      });
    })
  );
});
