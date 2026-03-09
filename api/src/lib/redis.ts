import Redis from 'ioredis'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis error:', err.message)
})

// ── Session helpers ───────────────────────────────────────────

const SESSION_TTL = 60 * 30 // 30 minutes

export async function getSession<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export async function setSession<T>(key: string, value: T): Promise<void> {
  await redis.setex(key, SESSION_TTL, JSON.stringify(value))
}

export async function deleteSession(key: string): Promise<void> {
  await redis.del(key)
}

export function sessionKey(channel: string, sessionId: string): string {
  return `session:${channel}:${sessionId}`
}
