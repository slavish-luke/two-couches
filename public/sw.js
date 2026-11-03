// Shows push notifications (see sendPush() in src/lib/push.ts), opens the right page when one is tapped,
// and keeps the list readable offline: the last copy of each list page ("/" and its filters), the
// files those pages need, and posters. Other pages show /offline when there's no connection.
// Registered by registerServiceWorker() in src/components/pwa.tsx; "?dev" turns caching off for next dev.

const PAGES = "pages-v1";
const STATIC = "static-v1";
const IMAGES = "images-v1";
const CACHES = [PAGES, STATIC, IMAGES];
const LIMITS = { [PAGES]: 8, [STATIC]: 400, [IMAGES]: 300 };
const OFFLINE_URL = "/offline";
const CACHING = !new URL(self.location.href).searchParams.has("dev");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (CACHING) await (await caches.open(STATIC)).add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !CACHES.includes(name) || !CACHING).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Drops the oldest entries (caches keep insertion order) beyond the cache's limit. */
async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - LIMITS[name])).map((key) => cache.delete(key)));
}

async function remember(name, request, response) {
  const cache = await caches.open(name);
  await cache.put(request, response);
  await trim(name);
}

/** Network first. The list page is kept for offline use; signing out (a redirect to /login) forgets it. */
async function navigate(event) {
  const url = new URL(event.request.url);
  const isList = url.pathname === "/";
  try {
    const response = await fetch(event.request);
    if (isList && response.ok && !response.redirected) {
      event.waitUntil(remember(PAGES, event.request, response.clone()));
    } else if (response.type === "opaqueredirect" || response.redirected) {
      event.waitUntil(caches.delete(PAGES));
    }
    return response;
  } catch (error) {
    // Next.js varies pages on its router headers, which a stored navigation never has; don't compare them.
    const options = { ignoreVary: true };
    const cached =
      (await caches.match(event.request, { ...options, cacheName: PAGES })) ??
      (isList ? await caches.match("/", { ...options, cacheName: PAGES }) : undefined) ??
      (await caches.match(OFFLINE_URL, { ...options, cacheName: STATIC }));
    if (cached) return cached;
    throw error;
  }
}

/** Cache first, for files whose URL changes whenever their content does. */
async function cacheFirst(event, name, fetchRequest) {
  const cached = await caches.match(event.request, { cacheName: name });
  if (cached) return cached;
  const response = await fetch(fetchRequest);
  if (response.ok) event.waitUntil(remember(name, event.request, response.clone()));
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!CACHING || request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(navigate(event));
  } else if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(cacheFirst(event, STATIC, request));
  } else if (url.origin === "https://image.tmdb.org") {
    // <img> asks without CORS, which would store an opaque copy; TMDB allows CORS, so ask that way instead.
    event.respondWith(cacheFirst(event, IMAGES, new Request(url, { mode: "cors", credentials: "omit" })));
  }
});

self.addEventListener("message", (event) => {
  // Sent on sign-out, so the next person on this device can't read the list offline.
  if (event.data === "forget") event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(IMAGES)]));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const message = event.data.json();
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
