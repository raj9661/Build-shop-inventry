// A basic service worker for caching assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("inventry-cache").then((cache) => {
      return cache.addAll([
        "/",
        // Add other assets you want to cache
      ])
    }),
  )
})

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    }),
  )
})
