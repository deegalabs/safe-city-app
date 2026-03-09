import { describe, it, expect } from 'vitest'
import {
  ReportStatusSchema,
  PartnerCreateSchema,
  PartnerPatchSchema,
  AdminCreateSchema,
  AdminPatchSchema,
  ReportsQuerySchema,
  AuditQuerySchema,
} from './admin'

describe('schemas/admin', () => {
  describe('ReportStatusSchema', () => {
    it('accepts all valid statuses', () => {
      const statuses = ['ativo', 'confirmado', 'critico', 'expirado', 'removido'] as const
      for (const status of statuses) {
        const result = ReportStatusSchema.safeParse({ status })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.status).toBe(status)
      }
    })

    it('rejects invalid status', () => {
      const result = ReportStatusSchema.safeParse({ status: 'pendente' })
      expect(result.success).toBe(false)
    })
  })

  describe('PartnerCreateSchema', () => {
    const valid = {
      nome: 'Parceiro A',
      slug: 'parceiro-a',
      lat: -27.6,
      lng: -48.5,
      zone_id: 'centro',
    }

    it('accepts minimum required body', () => {
      const result = PartnerCreateSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.status).toBe('seguro')
    })

    it('accepts optional fields and default status', () => {
      const result = PartnerCreateSchema.safeParse({
        ...valid,
        endereco: 'Rua X',
        status: 'atencao',
      })
      expect(result.success).toBe(true)
    })

    it('rejects nome with fewer than 2 characters', () => {
      const result = PartnerCreateSchema.safeParse({ ...valid, nome: 'A' })
      expect(result.success).toBe(false)
    })

    it('accepts type bar', () => {
      const r = PartnerCreateSchema.safeParse({ ...valid, type: 'bar' })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.type).toBe('bar')
    })

    it('rejects invalid type', () => {
      const r = PartnerCreateSchema.safeParse({ ...valid, type: 'hotel' })
      expect(r.success).toBe(false)
    })

    it('accepts open_time HH:MM', () => {
      const r = PartnerCreateSchema.safeParse({ ...valid, open_time: '18:00' })
      expect(r.success).toBe(true)
    })

    it('rejects open_time not HH:MM', () => {
      const r = PartnerCreateSchema.safeParse({ ...valid, open_time: '6pm' })
      expect(r.success).toBe(false)
    })

    it('accepts open_days valid array', () => {
      const r = PartnerCreateSchema.safeParse({ ...valid, open_days: ['mon', 'fri', 'sat'] })
      expect(r.success).toBe(true)
    })

    it('rejects open_days with invalid day', () => {
      const r = PartnerCreateSchema.safeParse({ ...valid, open_days: ['monday'] })
      expect(r.success).toBe(false)
    })
  })

  describe('PartnerPatchSchema', () => {
    it('accepts all optional fields', () => {
      const result = PartnerPatchSchema.safeParse({
        nome: 'New Name',
        status: 'fechado',
        active: false,
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty object', () => {
      const result = PartnerPatchSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('AdminCreateSchema', () => {
    it('accepts email, nome and default role', () => {
      const result = AdminCreateSchema.safeParse({
        email: 'admin@test.com',
        nome: 'Admin Test',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.role).toBe('parceiro')
    })

    it('rejects invalid email', () => {
      const result = AdminCreateSchema.safeParse({
        email: 'invalid',
        nome: 'Admin',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AdminPatchSchema', () => {
    it('accepts nullable partner_id', () => {
      const result = AdminPatchSchema.safeParse({ partner_id: null })
      expect(result.success).toBe(true)
    })
  })

  describe('ReportsQuerySchema', () => {
    it('applies default page and limit', () => {
      const result = ReportsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe('1')
        expect(result.data.limit).toBe('20')
      }
    })

    it('accepts status and zone', () => {
      const result = ReportsQuerySchema.safeParse({ status: 'ativo', zone: 'centro' })
      expect(result.success).toBe(true)
    })
  })

  describe('AuditQuerySchema', () => {
    it('applies default page and limit', () => {
      const result = AuditQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe('1')
        expect(result.data.limit).toBe('50')
      }
    })

    it('accepts admin_id', () => {
      const result = AuditQuerySchema.safeParse({ admin_id: 'admin-1' })
      expect(result.success).toBe(true)
    })
  })
})
