import { describe, it, expect } from 'vitest'
import { BotInputSchema } from './bot'

describe('schemas/bot', () => {
  describe('BotInputSchema', () => {
    it('accepts body with sessionId of minimum 10 characters', () => {
      const result = BotInputSchema.safeParse({ sessionId: '0123456789' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.sessionId).toBe('0123456789')
    })

    it('accepts optional text, optionKey and optionData', () => {
      const result = BotInputSchema.safeParse({
        sessionId: '0123456789ab',
        text: 'Olá',
        optionKey: 'goto:start',
        optionData: { tipo: 'furto' },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.text).toBe('Olá')
        expect(result.data.optionKey).toBe('goto:start')
        expect(result.data.optionData).toEqual({ tipo: 'furto' })
      }
    })

    it('rejects sessionId with fewer than 10 characters', () => {
      const result = BotInputSchema.safeParse({ sessionId: '123456789' })
      expect(result.success).toBe(false)
    })

    it('rejects text with more than 500 characters', () => {
      const result = BotInputSchema.safeParse({
        sessionId: '0123456789ab',
        text: 'x'.repeat(501),
      })
      expect(result.success).toBe(false)
    })

    it('accepts sessionId only', () => {
      const result = BotInputSchema.safeParse({ sessionId: 'abcdefghij' })
      expect(result.success).toBe(true)
    })
  })
})
