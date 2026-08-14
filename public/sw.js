// NOTE: cache name renamed from "historiamap-*" to "altay-*" to match the project name.
// The activate handler below already deletes any cache whose name doesn't match CACHE_NAME,
// so old "historiamap-*" caches will be cleaned up automatically on next activation.
const CACHE_NAME = 'altay-v1.2';
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
  const url = event.request.url;

  // Bypass SW for tile layers & external API calls
  if (
    url.includes('tile.openstreetmap.org') ||
    url.includes('arcgisonline.com') ||
    url.includes('cartocdn.com') ||
    url.includes('opentopomap.org') ||
    url.includes('overpass-api.de') ||
    url.includes('nominatim.openstreetmap.org') ||
    url.includes('wikipedia.org')
  ) {
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
