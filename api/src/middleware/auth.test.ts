import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma'
import { supabase } from '../lib/supabase'
import { requireAdmin, requireSuperAdmin, getAdmin } from './auth'

vi.mock('../lib/prisma', () => ({
  prisma: {
    admin: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

const mockPrisma = vi.mocked(prisma)
const mockSupabase = vi.mocked(supabase)

const fakeAdmin = {
  id: 'admin-1',
  role: 'superadmin',
  partner_id: null,
  email: 'admin@test.com',
  nome: 'Admin',
  active: true,
  created_at: new Date(),
}

function createRequest(overrides: Partial<{ headers: { authorization?: string } }> = {}) {
  return {
    headers: { authorization: 'Bearer fake-token', ...overrides?.headers },
    ...overrides,
  } as unknown as Parameters<typeof requireAdmin>[0]
}

describe('middleware/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'admin@test.com' } },
      error: null,
    } as never)
    mockPrisma.admin.findUnique.mockResolvedValue(fakeAdmin as never)
  })

  describe('requireAdmin', () => {
    it('throws 401 when Authorization header is missing', async () => {
      const req = createRequest({ headers: {} })

      await expect(requireAdmin(req)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Token required',
      })
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled()
    })

    it('throws 401 when token is invalid', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid') } as never)
      const req = createRequest()

      await expect(requireAdmin(req)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid token',
      })
    })

    it('throws 403 when user is not an admin or is inactive', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null)
      const req = createRequest()

      await expect(requireAdmin(req)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied',
      })
    })

    it('attaches admin to request when token and admin are valid', async () => {
      const req = createRequest()

      await requireAdmin(req)

      expect((req as { admin?: typeof fakeAdmin }).admin).toEqual(fakeAdmin)
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('fake-token')
      expect(mockPrisma.admin.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@test.com' } })
    })
  })

  describe('requireSuperAdmin', () => {
    it('throws 403 when admin is not a superadmin', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({ ...fakeAdmin, role: 'parceiro' } as never)
      const req = createRequest()

      await expect(requireSuperAdmin(req)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Superadmins only',
      })
    })

    it('does not throw when admin is a superadmin', async () => {
      const req = createRequest()
      await requireAdmin(req)
      await expect(requireSuperAdmin(req)).resolves.toBeUndefined()
    })
  })

  describe('getAdmin', () => {
    it('returns admin attached to request', () => {
      const req = createRequest()
      ;(req as { admin?: typeof fakeAdmin }).admin = fakeAdmin

      expect(getAdmin(req)).toBe(fakeAdmin)
    })
  })
})
