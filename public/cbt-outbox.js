/*
 * ParaLearn CBT offline outbox.
 *
 * Candidates' answers, tab-switch reports and final submissions are written
 * here first (IndexedDB), then sent to /api/cbt in the order they happened.
 * The exam pages and the service worker (cbt-sw.js) load this same file, so a
 * queue left behind when the tab closed is still sent when the device next
 * gets a connection (Background Sync, where the browser supports it).
 *
 * Plain JavaScript on purpose: it runs both in pages and in the worker.
 */
(function (scope) {
  if (scope.CbtOutbox) return;

  var DB_NAME = "paralearn-cbt";
  var DB_VERSION = 1;
  var OPS = "outbox";
  var RESULTS = "results";
  var API = "/api/cbt";
  var LOCK = "paralearn-cbt-outbox";
  var REQUEST_TIMEOUT_MS = 20000;

  var dbPromise = null;
  var seq = 0;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = scope.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: "key" });
          if (!db.objectStoreNames.contains(RESULTS)) db.createObjectStore(RESULTS, { keyPath: "attemptId" });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { dbPromise = null; reject(req.error); };
      });
    }
    return dbPromise;
  }

  function run(storeName, mode, action) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var req = action(tx.objectStore(storeName));
        tx.oncomplete = function () { resolve(req ? req.result : undefined); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  var getAll = function (store) { return run(store, "readonly", function (s) { return s.getAll(); }); };
  var put = function (store, value) { return run(store, "readwrite", function (s) { return s.put(value); }); };
  var del = function (store, key) { return run(store, "readwrite", function (s) { return s.delete(key); }); };

  /** Keys sort in the order operations were queued */
  function nextKey() {
    seq = (seq + 1) % 1000000;
    return String(Date.now()).padStart(15, "0") + "-" + String(seq).padStart(6, "0") +
      "-" + Math.random().toString(36).slice(2, 8);
  }

  function byKey(a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; }

  /**
   * Queues an operation: { kind: "answer" | "telemetry" | "submit", attemptId,
   * payload, meta }. A newer answer to the same question replaces an unsent one.
   */
  function enqueue(op) {
    var record = {
      key: nextKey(),
      kind: op.kind,
      attemptId: op.attemptId,
      payload: op.payload || {},
      meta: op.meta || {},
      createdAt: new Date().toISOString(),
    };
    if (op.kind !== "answer") return put(OPS, record);
    return getAll(OPS).then(function (ops) {
      var stale = ops.filter(function (o) {
        return o.kind === "answer" && o.attemptId === op.attemptId &&
          o.payload.questionId === record.payload.questionId;
      });
      return Promise.all(stale.map(function (o) { return del(OPS, o.key); }));
    }).then(function () { return put(OPS, record); });
  }

  var PATHS = { answer: "answer", telemetry: "telemetry", submit: "submit" };

  function send(op) {
    var init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op.payload),
      credentials: "same-origin",
      cache: "no-store",
    };
    if (scope.AbortSignal && scope.AbortSignal.timeout) {
      init.signal = scope.AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    }
    return fetch(API + "/attempts/" + encodeURIComponent(op.attemptId) + "/" + PATHS[op.kind], init);
  }

  /** Errors worth retrying later; anything else will never succeed */
  function isRetryable(status) {
    return status === 408 || status === 429 || status >= 500;
  }

  function drain() {
    return getAll(OPS).then(function (ops) {
      ops.sort(byKey);
      var sent = 0;
      var step = function (i) {
        if (i >= ops.length) return Promise.resolve({ sent: sent, remaining: 0 });
        var op = ops[i];
        return send(op).then(function (res) {
          if (isRetryable(res.status)) {
            return { sent: sent, remaining: ops.length - i, retryable: true };
          }
          var record = op.kind !== "submit"
            ? Promise.resolve()
            : res.json().catch(function () { return {}; }).then(function (body) {
                return put(RESULTS, {
                  attemptId: op.attemptId,
                  ok: res.ok,
                  status: res.status,
                  body: body,
                  meta: op.meta,
                  at: new Date().toISOString(),
                });
              });
          return record
            .then(function () { return del(OPS, op.key); })
            .then(function () { sent++; return step(i + 1); });
        }, function () {
          // Offline or the request never completed: keep everything for later
          return { sent: sent, remaining: ops.length - i, offline: true };
        });
      };
      return step(0);
    });
  }

  /** Sends queued operations in order. Only one page or worker flushes at a time. */
  function flush() {
    var locks = scope.navigator && scope.navigator.locks;
    if (!locks) return drain();
    return locks.request(LOCK, { ifAvailable: true }, function (lock) {
      return lock ? drain() : { sent: 0, remaining: -1, busy: true };
    });
  }

  function pending(attemptId) {
    return getAll(OPS).then(function (ops) {
      return attemptId ? ops.filter(function (o) { return o.attemptId === attemptId; }) : ops;
    });
  }

  /** Submission outcomes recorded by flush(); each is returned once */
  function takeResults() {
    return getAll(RESULTS).then(function (results) {
      return Promise.all(results.map(function (r) { return del(RESULTS, r.attemptId); }))
        .then(function () { return results; });
    });
  }

  scope.CbtOutbox = {
    PAGES_CACHE: "cbt-pages-v1",
    STATIC_CACHE: "cbt-static-v1",
    SYNC_TAG: "cbt-outbox",
    enqueue: enqueue,
    flush: flush,
    pending: pending,
    takeResults: takeResults,
  };
})(typeof self !== "undefined" ? self : window);
