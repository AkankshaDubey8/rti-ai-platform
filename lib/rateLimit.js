// In-memory fixed-window rate limiter (per process; use Redis or similar for multi-instance deployments).
const buckets = (globalThis.__rtiRate ||= new Map());
export function rateLimit(key, { max = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { count: 1, reset: now + windowMs }); return { ok: true }; }
  b.count += 1;
  if (b.count > max) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  return { ok: true };
}
// Failure counters (e.g. failed logins per account): check before the attempt, record only failures, clear on success.
export function isLocked(key, { max = 8 } = {}) {
  const b = buckets.get(`f:${key}`);
  return b && Date.now() <= b.reset && b.count >= max ? { locked: true, retryAfter: Math.ceil((b.reset - Date.now()) / 1000) } : { locked: false };
}
export function recordFailure(key, { windowMs = 15 * 60_000 } = {}) {
  const now = Date.now(); const k = `f:${key}`; const b = buckets.get(k);
  if (!b || now > b.reset) buckets.set(k, { count: 1, reset: now + windowMs }); else b.count += 1;
}
export const clearFailures = (key) => buckets.delete(`f:${key}`);
export const resetRateLimits = () => buckets.clear();

// The client IP is only taken from X-Forwarded-For when TRUST_PROXY=1 (i.e. you run behind a proxy that sets it).
// Otherwise the header is attacker-controlled and ignored.
export const clientIp = (req) => (process.env.TRUST_PROXY === '1' ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() : null) || 'direct';
