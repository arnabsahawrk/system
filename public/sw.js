/* System — app-shell service worker.
 *
 * What it does: keeps the *static* parts of the app (the hashed JS/CSS/font
 * files under /_next/static, the icons and one offline page) so the screen can
 * appear at once on a slow or flaky connection, and shows a calm "you're
 * offline" page instead of the browser's error when a page can't be reached.
 *
 * What it deliberately never does: touch /api/*, or cache any page or JSON.
 * Your tasks, weeks and passcode state always come live from the server, so
 * nothing about your data ever sits on the device outside the passcode lock —
 * and a tick can't be queued offline and then rejected by the 06:00 rule
 * when it finally syncs.
 */
const STATIC_CACHE = "system-static-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];
// Each deploy ships new hashed files; keep the cache from growing forever.
const MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("system-static-") && k !== STATIC_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg"
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  const evictable = keys.filter((req) => !PRECACHE.includes(new URL(req.url).pathname));
  const overflow = keys.length - MAX_ENTRIES;
  for (let i = 0; i < overflow && i < evictable.length; i++) await cache.delete(evictable[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache
      .put(request, response.clone())
      .then(() => trim(cache))
      .catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live data: never intercepted

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    // Always the real page when there is a connection; the offline page only when there isn't.
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
    );
  }
});
