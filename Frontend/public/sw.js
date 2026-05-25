const CACHE_NAME = "almacen-decorativo-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
];

// Instalar el Service Worker y pre-cachear los recursos esenciales
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Cacheando recursos estáticos");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activar el Service Worker y limpiar cachés antiguas si es necesario
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Limpiando caché obsoleta:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones para servir desde caché de forma offline-first
self.addEventListener("fetch", (event) => {
  // Solo interceptar peticiones GET locales
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Guardar respuestas válidas de vuelta en caché
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla internet y no está en caché, servir la raíz index.html para SPAs
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
    })
  );
});
