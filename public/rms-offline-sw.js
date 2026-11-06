/*
 * Service worker for the offline result processor on rms.pln.ng.
 * Registered only on rms.* hosts (see micro-services-rms/frontend/src/offline/ui/serviceWorker.ts).
 *
 * - Pages: network first, falling back to the saved copy, so the app reopens offline.
 * - Build assets (/_next/static, fonts, images): cache first; file names are content-hashed.
 * - /api/*: never cached; signing in and syncing need the network.
 * The page sends a "precache" message with the assets it loaded, so everything needed to
 * reopen is saved on the first online visit.
 */
const CACHE = "paralearn-results-offline-v2";
const APP_SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(APP_SHELL, { cache: "reload" })))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("paralearn-results-offline-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "precache" || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => typeof u === "string" && isCacheable(new URL(u, self.location.origin)));
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const results = await Promise.allSettled(
        urls.map(async (u) => {
          if (await cache.match(u)) return;
          const res = await fetch(u, { cache: "no-cache" });
          if (res.ok) await cache.put(u, res);
        })
      );
      event.source?.postMessage({ type: "precached", count: results.filter((r) => r.status === "fulfilled").length });
    })
  );
});

/*
 * Serve a cached file as a fresh Response. Returning the stored Response itself also hands
 * back its URL, and Turbopack's Web Workers share one bootstrap file that reads its config
 * from the URL fragment (#params=...): the second worker would boot with the first one's code.
 */
function fromCache(hit) {
  return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers: hit.headers });
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|ico|webp)$/.test(url.pathname);
}

function isCacheable(url) {
  return url.origin === self.location.origin && !url.pathname.startsWith("/api/") && !url.searchParams.has("_rsc");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!isCacheable(url) || req.headers.get("RSC")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => {
          const hit = (await caches.match(url.pathname)) || (await caches.match(APP_SHELL));
          return hit ? fromCache(hit) : Response.error();
        })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          (hit && fromCache(hit)) ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
