/**
 * cbtKvAdapter.ts
 *
 * KV layer used by cbtServerStore.
 * - When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, every read and write goes to
 *   Upstash. Failures throw (callers return a retryable 503) — there is deliberately no memory
 *   fallback, because on serverless each instance has its own memory and data written there is
 *   invisible to other instances and lost on the next cold start.
 * - Without Upstash configured (local development), a process-level in-memory store is used.
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type KvValue = string | number | boolean | object | null;

// ── Detect Upstash environment ────────────────────────────────────────────────
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const hasUpstash = Boolean(redisUrl && redisToken);

// ── Lazy Upstash client (uses installed @upstash/redis) ────────────────────────
let _upstash: import("@upstash/redis").Redis | null = null;

async function getUpstash() {
  if (_upstash) return _upstash;
  const { Redis } = await import("@upstash/redis");
  _upstash = new Redis({
    url: redisUrl,
    token: redisToken,
    // Fail fast and let the client retry (default is 5 retries with backoff)
    retry: { retries: 1, backoff: () => 200 },
  });
  return _upstash;
}

// ── Circuit breaker ───────────────────────────────────────────────────────────
// After a failure, calls fail immediately for a short cooldown instead of each one
// waiting out its own timeout while Upstash is unreachable.
const UPSTASH_TIMEOUT_MS = 8000;
const UPSTASH_COOLDOWN_MS = 5000;
let upstashDownUntil = 0;

async function callUpstash<T>(
  op: string,
  fn: (r: import("@upstash/redis").Redis) => Promise<T>
): Promise<T> {
  if (Date.now() < upstashDownUntil) {
    throw new Error(`CBT store temporarily unavailable (${op}). Please retry.`);
  }
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
    console.warn(`[CBT KV] Upstash ${op} failed:`, err?.message || err);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── In-memory store (local development without Upstash) ───────────────────────
const g = globalThis as unknown as {
  __cbtKvMap?: Map<string, string>;
  __cbtKvHashes?: Map<string, Record<string, unknown>>;
};
function getMemStore(): Map<string, string> {
  if (!g.__cbtKvMap) g.__cbtKvMap = new Map();
  return g.__cbtKvMap;
}
function getMemHashes(): Map<string, Record<string, unknown>> {
  if (!g.__cbtKvHashes) g.__cbtKvHashes = new Map();
  return g.__cbtKvHashes;
}
function memGet<T>(key: string): T | null {
  const raw = getMemStore().get(key);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

async function get<T = KvValue>(key: string): Promise<T | null> {
  if (!hasUpstash) return memGet<T>(key);
  const val = await callUpstash("get", (r) => r.get<T>(key));
  return val ?? null;
}

async function set(key: string, value: KvValue, exSeconds?: number): Promise<void> {
  if (!hasUpstash) {
    getMemStore().set(key, JSON.stringify(value));
    return;
  }
  const opts = exSeconds ? { ex: exSeconds } : undefined;
  await callUpstash("set", (r) => r.set(key, value, opts));
}

async function del(key: string): Promise<void> {
  if (!hasUpstash) {
    getMemStore().delete(key);
    getMemHashes().delete(key);
    return;
  }
  await callUpstash("del", (r) => r.del(key));
}

async function keys(pattern: string): Promise<string[]> {
  if (!hasUpstash) {
    const prefix = pattern.replace(/\*$/, "");
    return [...getMemStore().keys()].filter((k) => k.startsWith(prefix));
  }
  return (await callUpstash("keys", (r) => r.keys(pattern))) || [];
}

async function hset(ns: string, id: string, value: object): Promise<void> {
  await set(`${ns}:${id}`, value);
}

async function hget<T>(ns: string, id: string): Promise<T | null> {
  return get<T>(`${ns}:${id}`);
}

/** Fetch several keys in one round trip; missing keys come back as null */
async function mget<T>(keyList: string[]): Promise<Array<T | null>> {
  if (!keyList.length) return [];
  if (!hasUpstash) return keyList.map((k) => memGet<T>(k));
  const items = await callUpstash("mget", (r) => r.mget<T[]>(...keyList));
  return (items || []).map((item) => (item === undefined ? null : item));
}

async function hlist<T>(ns: string): Promise<T[]> {
  const ks = await keys(`${ns}:*`);
  // Exclude index subkeys such as :code:, :email:, :apikey:
  const itemKeys = ks.filter(
    (k) =>
      !k.includes(":code:") &&
      !k.includes(":email:") &&
      !k.includes(":apikey:")
  );
  const items = await mget<T>(itemKeys);
  return items.filter(
    (item): item is T =>
      item !== null && item !== undefined && typeof item === "object"
  );
}

// ── Redis hashes: one field per entry, so concurrent writers never overwrite each other ──
/** Set one field; resolves true when the field did not exist before */
async function hashSet(key: string, field: string, value: unknown): Promise<boolean> {
  if (!hasUpstash) {
    const mem = getMemHashes().get(key) || {};
    const isNew = !(field in mem);
    mem[field] = value;
    getMemHashes().set(key, mem);
    return isNew;
  }
  const added = await callUpstash("hset", (r) => r.hset(key, { [field]: value }));
  return added > 0;
}

async function hashGetAll<T = unknown>(key: string): Promise<Record<string, T>> {
  if (!hasUpstash) {
    return { ...((getMemHashes().get(key) as Record<string, T>) || {}) };
  }
  const all = await callUpstash("hgetall", (r) => r.hgetall<Record<string, T>>(key));
  return all || {};
}

async function hashDel(key: string, field: string): Promise<void> {
  if (!hasUpstash) {
    const mem = getMemHashes().get(key);
    if (mem) delete mem[field];
    return;
  }
  await callUpstash("hdel", (r) => r.hdel(key, field));
}

async function hashIncrBy(key: string, field: string, by: number): Promise<void> {
  if (!hasUpstash) {
    const mem = getMemHashes().get(key) || {};
    mem[field] = (Number(mem[field]) || 0) + by;
    getMemHashes().set(key, mem);
    return;
  }
  await callUpstash("hincrby", (r) => r.hincrby(key, field, by));
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
  mget,
  hashSet,
  hashGetAll,
  hashDel,
  hashIncrBy,
  isKvEnabled,
};
