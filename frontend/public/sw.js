const CACHE_NAME = 'mandal-vargani-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico'
];

// Install Service Worker and cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch events: Network first, fallback to Cache for API / Network resources; Cache first for static assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip caching API calls - they must be real-time
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'You are currently offline. Please check your internet connection.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Caching strategy for static app shell resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          event.request.method === 'GET' &&
          (requestUrl.origin === self.location.origin)
        ) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to app shell if page navigation fails
        if (event.request.mode === 'navigate') {
          return caches.match('./') || caches.match('./index.html');
        }
      });
    })
  );
});
