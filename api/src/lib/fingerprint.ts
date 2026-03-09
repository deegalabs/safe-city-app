import { createHash } from 'node:crypto'
import { redis } from './redis'

const SALT = process.env['FINGERPRINT_SALT'] ?? 'shield-default-salt-change-in-prod'

export function hashFingerprint(fp: string): string {
  return createHash('sha256').update(`${SALT}:${fp}`).digest('hex')
}

const RATE_LIMIT_PREFIX = 'ratelimit:'

export async function checkRateLimit(fp: string, max = 3, windowMs = 60 * 60 * 1000): Promise<boolean> {
  const hashed = hashFingerprint(fp)
  const key = `${RATE_LIMIT_PREFIX}${hashed}`
  const ttlSec = Math.ceil(windowMs / 1000)
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, ttlSec)
  return n <= max
}
