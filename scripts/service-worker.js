/* global self, caches, fetch, URL, Request */
// Build replaces this manifest with only public static assets, never activity data.
const manifest = /* OFFLINE_MANIFEST */ { version: "development", files: [] };
const scope = self.registration.scope;
const prefix = `event-seating-static:${scope}:`;
const cacheName = `${prefix}${manifest.version}`;
const urls = manifest.files.map((file) => new URL(file, scope).href);
const allowed = new Set(urls);
const indexUrl = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(cacheName);
        await cache.addAll(
          urls.map((url) => new Request(url, { cache: "reload" })),
        );
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Keep the previous release available to already-open tabs. Never clear IDB.
      const names = (await caches.keys()).filter((name) =>
        name.startsWith(prefix),
      );
      const previous = names.filter((name) => name !== cacheName).at(-1);
      await Promise.all(
        names
          .filter((name) => name !== cacheName && name !== previous)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const base = new URL(scope);
  const navigation =
    request.mode === "navigate" &&
    url.origin === base.origin &&
    (url.pathname === base.pathname || url.href.split(/[?#]/)[0] === indexUrl);
  const previousAsset =
    url.origin === base.origin &&
    url.pathname.startsWith(new URL("assets/", scope).pathname) &&
    !url.search &&
    !url.hash;
  if (!navigation && !allowed.has(url.href) && !previousAsset) return;
  event.respondWith(
    (async () => {
      const key = navigation ? indexUrl : request.url;
      const cache = await caches.open(cacheName);
      const cached = await cache.match(key);
      if (cached) return cached;
      // An older tab may still reference the previous release's hashed chunks.
      for (const name of (await caches.keys()).filter((name) =>
        name.startsWith(prefix),
      )) {
        const previous = await (await caches.open(name)).match(key);
        if (previous) return previous;
      }
      return fetch(request);
    })(),
  );
});
