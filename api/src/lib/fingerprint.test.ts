import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redis } from './redis'
import { hashFingerprint, checkRateLimit } from './fingerprint'

vi.mock('./redis', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
  },
}))

const mockRedis = vi.mocked(redis)

describe('hashFingerprint', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const out = hashFingerprint('abc123')
    expect(out).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic: same input produces same hash', () => {
    const a = hashFingerprint('same-input')
    const b = hashFingerprint('same-input')
    expect(a).toBe(b)
  })

  it('different inputs produce different hashes', () => {
    const a = hashFingerprint('fp-one')
    const b = hashFingerprint('fp-two')
    expect(a).not.toBe(b)
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedis.expire.mockResolvedValue('OK' as never)
  })

  it('returns true on first call (within limit)', async () => {
    mockRedis.incr.mockResolvedValue(1 as never)
    const result = await checkRateLimit('fp1234567890')
    expect(result).toBe(true)
    expect(mockRedis.incr).toHaveBeenCalled()
    expect(mockRedis.expire).toHaveBeenCalled()
  })

  it('returns true up to max calls (e.g. max=3)', async () => {
    mockRedis.incr
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(2 as never)
      .mockResolvedValueOnce(3 as never)
    expect(await checkRateLimit('fp-a', 3)).toBe(true)
    expect(await checkRateLimit('fp-a', 3)).toBe(true)
    expect(await checkRateLimit('fp-a', 3)).toBe(true)
  })

  it('returns false after exceeding max (e.g. 4th call with max=3)', async () => {
    mockRedis.incr
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(2 as never)
      .mockResolvedValueOnce(3 as never)
      .mockResolvedValueOnce(4 as never)
    await checkRateLimit('fp-b', 3)
    await checkRateLimit('fp-b', 3)
    await checkRateLimit('fp-b', 3)
    const fourth = await checkRateLimit('fp-b', 3)
    expect(fourth).toBe(false)
  })
})
