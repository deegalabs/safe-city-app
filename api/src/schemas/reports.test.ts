import { describe, it, expect } from 'vitest'
import { CreateReportSchema, ConfirmReportSchema } from './reports'

const validCreate = {
  tipo: 'furto' as const,
  urgencia: 'alta' as const,
  local: 'Centro',
  zone_id: 'centro',
  fingerprint: '0123456789abcdef',
  channel: 'pwa' as const,
}

describe('schemas/reports', () => {
  describe('CreateReportSchema', () => {
    it('accepts valid body with required fields', () => {
      const result = CreateReportSchema.safeParse(validCreate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tipo).toBe('furto')
        expect(result.data.urgencia).toBe('alta')
        expect(result.data.channel).toBe('pwa')
      }
    })

    it('accepts optional retrato and extra', () => {
      const result = CreateReportSchema.safeParse({
        ...validCreate,
        retrato: { roupa: 'azul' },
        extra: 'Additional observation',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.retrato).toEqual({ roupa: 'azul' })
        expect(result.data.extra).toBe('Additional observation')
      }
    })

    it('default channel is pwa', () => {
      const { fingerprint, ...rest } = validCreate
      const result = CreateReportSchema.safeParse({ ...rest, fingerprint })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.channel).toBe('pwa')
    })

    it('rejects invalid tipo', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, tipo: 'invalido' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid urgencia', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, urgencia: 'critica' })
      expect(result.success).toBe(false)
    })

    it('rejects local with fewer than 2 characters', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, local: 'A' })
      expect(result.success).toBe(false)
    })

    it('rejects local with more than 100 characters', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, local: 'x'.repeat(101) })
      expect(result.success).toBe(false)
    })

    it('rejects empty zone_id', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, zone_id: '' })
      expect(result.success).toBe(false)
    })

    it('rejects fingerprint with fewer than 10 characters', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, fingerprint: '123456789' })
      expect(result.success).toBe(false)
    })

    it('rejects extra with more than 500 characters', () => {
      const result = CreateReportSchema.safeParse({ ...validCreate, extra: 'x'.repeat(501) })
      expect(result.success).toBe(false)
    })
  })

  describe('ConfirmReportSchema', () => {
    it('accepts body with valid fingerprint', () => {
      const result = ConfirmReportSchema.safeParse({ fingerprint: '0123456789abcdef' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.fingerprint).toBe('0123456789abcdef')
    })

    it('rejects body without fingerprint', () => {
      const result = ConfirmReportSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects fingerprint with fewer than 10 characters', () => {
      const result = ConfirmReportSchema.safeParse({ fingerprint: 'short' })
      expect(result.success).toBe(false)
    })
  })
})
