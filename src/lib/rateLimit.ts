// Best-effort fixed-window rate limiter keyed by client IP.
// State lives in memory, so limits apply per server instance.

type Bucket = { count: number; resetAt: number };

export function createRateLimiter(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
      }
      return false;
    }
    bucket.count++;
    return bucket.count > max;
  };
}

export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
}
