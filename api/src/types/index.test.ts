import { describe, it, expect } from 'vitest'
import { ok, err } from './index'

describe('types', () => {
  describe('ok', () => {
    it('returns object with data and error null', () => {
      const result = ok({ id: '1' })
      expect(result).toEqual({ data: { id: '1' }, error: null })
    })

    it('preserves generic type of data', () => {
      const result = ok([1, 2, 3])
      expect(result.data).toEqual([1, 2, 3])
      expect(result.error).toBeNull()
    })
  })

  describe('err', () => {
    it('returns object with data null and error with code and message', () => {
      const result = err('VALIDATION', 'Invalid field')
      expect(result).toEqual({
        data: null,
        error: { code: 'VALIDATION', message: 'Invalid field' },
      })
    })

    it('accepts any string as code and message', () => {
      const result = err('NOT_FOUND', 'Resource not found')
      expect(result.data).toBeNull()
      expect(result.error?.code).toBe('NOT_FOUND')
      expect(result.error?.message).toBe('Resource not found')
    })
  })
})
