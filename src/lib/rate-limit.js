import { AppError } from '@/utils/response.js';

const buckets = new Map();

/**
 * Tiny in-memory sliding-window limiter (per process). Fine for a local prototype;
 * it is NOT shared across processes and trusts x-forwarded-for, so do not rely on it in production.
 */
export function rateLimit(request, { key = 'default', limit = 20, windowMs = 60_000 } = {}) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(bucketKey) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
  }
  hits.push(now);
  buckets.set(bucketKey, hits);

  if (buckets.size > 1000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
}

export function resetRateLimits() {
  buckets.clear();
}
