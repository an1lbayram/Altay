// NOTE: cache name renamed from "historiamap-*" to "altay-*" to match the project name.
// The activate handler below already deletes any cache whose name doesn't match CACHE_NAME,
// so old "historiamap-*" caches will be cleaned up automatically on next activation.
const CACHE_NAME = 'altay-v1.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('overpass-api.de') || event.request.url.includes('nominatim.openstreetmap.org') || event.request.url.includes('wikipedia.org')) {
    // API calls: Network only (do not cache dynamically shifting API queries)
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache static assets dynamically
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
