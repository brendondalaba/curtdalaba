// Service worker: makes the site installable and opens quickly.
// It caches only public, versioned files (built JS/CSS, fonts, icons).
// Pages and audio always come from the network, so nothing private is stored
// on the device and access stays tied to being signed in.

const CACHE = "curtdalaba-v1";
const PRECACHE = [
  "/offline.html",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build output never changes: serve from cache, fill on first use.
  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ??
          fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Pages: always the network; show a friendly page when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
  }
  // Everything else (audio, API) goes straight to the network.
});
