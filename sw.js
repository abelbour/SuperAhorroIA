const CACHE_NAME = "smartprice-v3";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn("[SW] Shell cache warning", err);
      });
      try {
        const htmlRes = await fetch("/index.html");
        const html = await htmlRes.text();
        const assetUrls = [];
        const linkRe = /<link[^>]+href="([^"]+\.(?:css|js))"[^>]*>/g;
        const scriptRe = /<script[^>]+src="([^"]+)"[^>]*>/g;
        let m;
        while ((m = linkRe.exec(html)) !== null) assetUrls.push(m[1]);
        while ((m = scriptRe.exec(html)) !== null) assetUrls.push(m[1]);
        if (assetUrls.length > 0) {
          await cache.addAll(assetUrls);
        }
      } catch {}
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  if (event.request.url.includes("googleapis.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});
