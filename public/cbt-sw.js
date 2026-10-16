/*
 * ParaLearn CBT service worker (registered with scope /take).
 *
 * - Exam pages: network first, falling back to the last copy, so a reload
 *   works offline once the candidate has opened the exam online.
 * - Built app files (/_next/static, content-hashed): cache first.
 * - Background Sync: sends the candidate's queued answers and submission when
 *   the device reconnects, even if the exam tab was closed.
 * API calls are never cached.
 */
importScripts("/cbt-outbox.js");

var PAGES_CACHE = self.CbtOutbox.PAGES_CACHE;
var STATIC_CACHE = self.CbtOutbox.STATIC_CACHE;
var OUTBOX_SCRIPT = "/cbt-outbox.js";

var OFFLINE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  "<title>Offline</title></head>" +
  '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;text-align:center">' +
  "<h1>You're offline</h1>" +
  "<p>This exam page hasn't been saved on this device yet. Connect to the internet and open it again.</p>" +
  "<p>Answers you already gave are kept on this device and will be sent when you're back online.</p>" +
  "</body></html>";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function (cache) { return cache.add(OUTBOX_SCRIPT); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf("cbt-") === 0 && k !== PAGES_CACHE && k !== STATIC_CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isExamPath(url) {
  return url.pathname === "/take" || url.pathname.indexOf("/take/") === 0;
}

/** Pages are cached by path alone, so any query string finds the saved copy */
function pageKey(url) {
  return new Request(url.origin + url.pathname);
}

function examPage(request) {
  var url = new URL(request.url);
  return fetch(request).then(function (response) {
    var type = response.headers.get("content-type") || "";
    if (response.ok && type.indexOf("text/html") !== -1) {
      var copy = response.clone();
      caches.open(PAGES_CACHE).then(function (cache) { return cache.put(pageKey(url), copy); });
    }
    return response;
  }).catch(function () {
    return caches.open(PAGES_CACHE)
      .then(function (cache) { return cache.match(pageKey(url), { ignoreVary: true }); })
      .then(function (cached) {
        return cached || new Response(OFFLINE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      });
  });
}

function staticFile(request) {
  return caches.open(STATIC_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

/** The outbox script changes between releases, so prefer the network copy */
function outboxScript(request) {
  return fetch(request).then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      caches.open(STATIC_CACHE).then(function (cache) { return cache.put(OUTBOX_SCRIPT, copy); });
    }
    return response;
  }).catch(function () {
    return caches.open(STATIC_CACHE).then(function (cache) { return cache.match(OUTBOX_SCRIPT); });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf("/api/") === 0) return;

  if (url.pathname.indexOf("/_next/static/") === 0) {
    event.respondWith(staticFile(request));
  } else if (url.pathname === OUTBOX_SCRIPT) {
    event.respondWith(outboxScript(request));
  } else if (request.mode === "navigate" && isExamPath(url)) {
    event.respondWith(examPage(request));
  }
});

function flushOutbox() {
  return self.CbtOutbox.flush().then(function (result) {
    // Throwing asks the browser to retry the sync later
    if (result && result.remaining > 0) throw new Error("CBT outbox not fully sent");
  });
}

self.addEventListener("sync", function (event) {
  if (event.tag === self.CbtOutbox.SYNC_TAG) event.waitUntil(flushOutbox());
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "cbt-flush") {
    event.waitUntil(flushOutbox().catch(function () {}));
  }
});
