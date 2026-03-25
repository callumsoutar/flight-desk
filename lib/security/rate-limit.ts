type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number }

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function pruneExpiredBuckets(now: number) {
  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(bucketKey)
    }
  }
}

export function enforceRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  pruneExpiredBuckets(now)

  const { key, limit, windowMs } = options
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  existing.count += 1
  buckets.set(key, existing)
  return { ok: true }
}
