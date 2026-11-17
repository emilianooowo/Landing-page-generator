/**
 * In-memory sliding-window limiter.
 *
 * State lives in the Node process, which is enough for the single-instance VPS
 * deployment. With several instances the counters would have to move to a
 * shared store (Redis or PostgreSQL) behind this same interface.
 */
export type LimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number };

export type RateLimiter = {
  hit(key: string, now?: number): LimitResult;
  peek(key: string, now?: number): number;
  reset(key?: string): void;
};

const MAX_KEYS = 10_000;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  function recent(key: string, now: number): number[] {
    const list = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  }

  function prune(now: number) {
    if (hits.size < MAX_KEYS) return;
    for (const key of hits.keys()) recent(key, now);
    // Still full: drop the oldest keys rather than grow without bound.
    for (const key of hits.keys()) {
      if (hits.size < MAX_KEYS) break;
      hits.delete(key);
    }
  }

  return {
    hit(key, now = Date.now()) {
      if (limit <= 0) return { ok: true, remaining: Infinity };
      const list = recent(key, now);
      if (list.length >= limit) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000)) };
      }
      prune(now);
      list.push(now);
      hits.set(key, list);
      return { ok: true, remaining: limit - list.length };
    },
    peek(key, now = Date.now()) {
      return recent(key, now).length;
    },
    reset(key) {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
  };
}
