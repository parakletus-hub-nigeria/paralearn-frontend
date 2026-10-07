/**
 * cbtKvAdapter.ts
 *
 * Resilient KV layer used by cbtServerStore.
 * - In production (Upstash env vars present): writes to & reads from @upstash/redis
 * - Automatically falls back to in-memory store if network fails or times out
 * - Guarantees zero crashing during offline or local development
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type KvValue = string | number | boolean | object | null;

// ── Detect Upstash environment ────────────────────────────────────────────────
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ||
  "https://probable-pika-192064.upstash.io";
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "gQAAAAAAAu5AAQIgcDE1MTQyNzFjYTNjNGI0NDRiOWUyMTJjNGI4NmE1MzA4Mw";

const hasUpstash = Boolean(redisUrl && redisToken);

// ── Lazy Upstash client (uses installed @upstash/redis) ────────────────────────
let _upstash: import("@upstash/redis").Redis | null = null;

async function getUpstash() {
  if (_upstash) return _upstash;
  const { Redis } = await import("@upstash/redis");
  _upstash = new Redis({
    url: redisUrl,
    token: redisToken,
    // Fail fast — the in-memory fallback handles outages (default is 5 retries with backoff)
    retry: { retries: 1, backoff: () => 100 },
  });
  return _upstash;
}

// ── Circuit breaker ───────────────────────────────────────────────────────────
// When Upstash is unreachable, every call would otherwise wait out its own timeout.
// After one failure we skip Upstash for UPSTASH_COOLDOWN_MS and serve from memory.
const UPSTASH_TIMEOUT_MS = 3000;
const UPSTASH_COOLDOWN_MS = 60_000;
let upstashDownUntil = 0;

function upstashAvailable(): boolean {
  return hasUpstash && Date.now() >= upstashDownUntil;
}

async function callUpstash<T>(
  op: string,
  fn: (r: import("@upstash/redis").Redis) => Promise<T>
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const r = await getUpstash();
    return await Promise.race([
      fn(r),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${UPSTASH_TIMEOUT_MS}ms`)),
          UPSTASH_TIMEOUT_MS
        );
      }),
    ]);
  } catch (err: any) {
    upstashDownUntil = Date.now() + UPSTASH_COOLDOWN_MS;
    console.warn(
      `[CBT KV] Upstash ${op} failed, using memory cache for ${UPSTASH_COOLDOWN_MS / 1000}s:`,
      err?.message || err
    );
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── In-memory fallback store ──────────────────────────────────────────────────
const g = globalThis as unknown as { __cbtKvMap?: Map<string, string> };
function getMemStore(): Map<string, string> {
  if (!g.__cbtKvMap) g.__cbtKvMap = new Map();
  return g.__cbtKvMap;
}

async function get<T = KvValue>(key: string): Promise<T | null> {
  if (upstashAvailable()) {
    try {
      const val = await callUpstash("get", (r) => r.get<T>(key));
      if (val !== null && val !== undefined) return val;
    } catch {
      // logged in callUpstash; fall through to memory cache
    }
  }
  const raw = getMemStore().get(key);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

async function set(key: string, value: KvValue, exSeconds?: number): Promise<void> {
  getMemStore().set(key, JSON.stringify(value));
  if (upstashAvailable()) {
    try {
      const opts = exSeconds ? { ex: exSeconds } : undefined;
      await callUpstash("set", (r) => r.set(key, value, opts));
    } catch {
      // logged in callUpstash; value is persisted in memory cache only
    }
  }
}

async function del(key: string): Promise<void> {
  getMemStore().delete(key);
  if (upstashAvailable()) {
    try {
      await callUpstash("del", (r) => r.del(key));
    } catch {
      // logged in callUpstash; removed from memory cache only
    }
  }
}

async function keys(pattern: string): Promise<string[]> {
  if (upstashAvailable()) {
    try {
      const upstashKeys = await callUpstash("keys", (r) => r.keys(pattern));
      if (upstashKeys && upstashKeys.length > 0) return upstashKeys;
    } catch {
      // logged in callUpstash; fall through to memory cache
    }
  }
  const prefix = pattern.replace(/\*$/, "");
  return [...getMemStore().keys()].filter((k) => k.startsWith(prefix));
}

async function hset(ns: string, id: string, value: object): Promise<void> {
  await set(`${ns}:${id}`, value);
}

async function hget<T>(ns: string, id: string): Promise<T | null> {
  return get<T>(`${ns}:${id}`);
}

async function hlist<T>(ns: string): Promise<T[]> {
  const ks = await keys(`${ns}:*`);
  if (!ks.length) return [];
  // Exclude index subkeys such as :code:, :email:, :apikey:
  const itemKeys = ks.filter(
    (k) =>
      !k.includes(":code:") &&
      !k.includes(":email:") &&
      !k.includes(":apikey:")
  );
  if (!itemKeys.length) return [];
  if (upstashAvailable()) {
    try {
      const items = await callUpstash("mget", (r) => r.mget<T[]>(...itemKeys));
      return (items || []).filter(
        (item): item is T =>
          item !== null && item !== undefined && typeof item === "object"
      );
    } catch {
      // logged in callUpstash; circuit is now open, so per-item gets below read memory
    }
  }
  const results = await Promise.all(itemKeys.map((k) => get<T>(k)));
  const list: T[] = [];
  for (const item of results) {
    if (item !== null && item !== undefined && typeof item === "object") {
      list.push(item);
    }
  }
  return list;
}

function isKvEnabled(): boolean {
  return hasUpstash;
}

// ── Public adapter ────────────────────────────────────────────────────────────
export const kvAdapter = {
  get,
  set,
  del,
  keys,
  hset,
  hget,
  hlist,
  isKvEnabled,
};
