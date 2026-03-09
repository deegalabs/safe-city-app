import { describe, it, expect } from 'vitest'
import { CheckinSchema, SubscribeSchema } from './public'

describe('schemas/public', () => {
  describe('CheckinSchema', () => {
    it('accepts valid partner_id and fingerprint', () => {
      const result = CheckinSchema.safeParse({
        partner_id: 'partner-1',
        fingerprint: '0123456789abcdef',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.partner_id).toBe('partner-1')
        expect(result.data.fingerprint).toBe('0123456789abcdef')
      }
    })

    it('rejects fingerprint with fewer than 10 characters', () => {
      const result = CheckinSchema.safeParse({
        partner_id: 'partner-1',
        fingerprint: 'short',
      })
      expect(result.success).toBe(false)
    })

    it('rejects body without partner_id', () => {
      const result = CheckinSchema.safeParse({ fingerprint: '0123456789ab' })
      expect(result.success).toBe(false)
    })
  })

  describe('SubscribeSchema', () => {
    it('accepts endpoint URL, keys and zones (1–10)', () => {
      const result = SubscribeSchema.safeParse({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'key1', auth: 'auth1' },
        zones: ['centro'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.endpoint).toBe('https://example.com/push')
        expect(result.data.zones).toEqual(['centro'])
      }
    })

    it('rejects endpoint that is not a URL', () => {
      const result = SubscribeSchema.safeParse({
        endpoint: 'not-a-url',
        keys: { p256dh: 'k', auth: 'a' },
        zones: ['centro'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty zones array', () => {
      const result = SubscribeSchema.safeParse({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'k', auth: 'a' },
        zones: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than 10 zones', () => {
      const result = SubscribeSchema.safeParse({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'k', auth: 'a' },
        zones: Array(11).fill('z'),
      })
      expect(result.success).toBe(false)
    })
  })
})
