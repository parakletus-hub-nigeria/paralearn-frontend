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
const DEFAULT_UPSTASH_URL = "https://probable-pika-192064.upstash.io";
const DEFAULT_UPSTASH_TOKEN = "gQAAAAAAAu5AAQIgcDE1MTQyNzFjYTNjNGI0NDRiOWUyMTJjNGI4NmE1MzA4Mw";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || DEFAULT_UPSTASH_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_UPSTASH_TOKEN;

const hasUpstash = Boolean(redisUrl && redisToken);

// ── Lazy Upstash client ───────────────────────────────────────────────────────
let _upstash: import("@upstash/redis").Redis | null = null;

async function getUpstash() {
  if (_upstash) return _upstash;
  const { Redis } = await import("@upstash/redis");
  _upstash = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  return _upstash;
}

// ── In-memory fallback store ──────────────────────────────────────────────────
const g = globalThis as unknown as { __cbtKvMap?: Map<string, string> };
function getMemStore(): Map<string, string> {
  if (!g.__cbtKvMap) g.__cbtKvMap = new Map();
  return g.__cbtKvMap;
}

async function get<T = KvValue>(key: string): Promise<T | null> {
  if (hasUpstash) {
    try {
      const r = await getUpstash();
      const val = await r.get<T>(key);
      if (val !== null && val !== undefined) return val;
    } catch (err: any) {
      console.warn("[CBT KV] Upstash get failed, reading from memory cache:", err?.message || err);
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
  if (hasUpstash) {
    try {
      const r = await getUpstash();
      const opts = exSeconds ? { ex: exSeconds } : undefined;
      await r.set(key, value, opts);
    } catch (err: any) {
      console.warn("[CBT KV] Upstash set failed, persisted in memory cache only:", err?.message || err);
    }
  }
}

async function del(key: string): Promise<void> {
  getMemStore().delete(key);
  if (hasUpstash) {
    try {
      const r = await getUpstash();
      await r.del(key);
    } catch (err: any) {
      console.warn("[CBT KV] Upstash del failed, removed from memory cache only:", err?.message || err);
    }
  }
}

async function keys(pattern: string): Promise<string[]> {
  if (hasUpstash) {
    try {
      const r = await getUpstash();
      const upstashKeys = await r.keys(pattern);
      if (upstashKeys && upstashKeys.length > 0) return upstashKeys;
    } catch (err: any) {
      console.warn("[CBT KV] Upstash keys failed, reading from memory cache:", err?.message || err);
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
  const results = await Promise.all(ks.map((k) => get<T>(k)));
  const list: T[] = [];
  for (const item of results) {
    if (item !== null && item !== undefined) {
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
