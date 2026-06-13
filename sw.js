const CACHE_NAME = "dateyumei-cache-v1";
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./story.html",
  "./outro.html",
  "./style.css",
  "./script.js",
  "./story.json",
  "./manifest.json"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching App Shell");
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Cache First with Dynamic Caching)
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and local/relative resources
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Check if we should intercept (same origin or assets)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache but update in background for HTML/CSS/JS (Stale-while-revalidate for app shell)
          const isAppShell = PRECACHE_ASSETS.some(asset => 
            event.request.url.endsWith(asset.replace("./", ""))
          );

          if (isAppShell) {
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse.status === 200) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse);
                  });
                }
              })
              .catch(() => {
                // Ignore background fetch failures
              });
          }
          return cachedResponse;
        }

        // Fetch from network and cache dynamically (for images, audio, etc.)
        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
              // Return resource directly if it is third-party or errored
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch((err) => {
            // Offline fallback for html pages
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
            return Promise.reject(err);
          });
      })
    );
  }
});
