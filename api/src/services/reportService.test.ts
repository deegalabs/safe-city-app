import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma'
import { moderateNewReport, canConfirm, updateReportStatus } from './alerts'
import { createReport, listActiveReports, confirmReport } from './reportService'

vi.mock('../lib/prisma', () => ({
  prisma: {
    report: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    confirmation: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../lib/fingerprint', () => ({
  hashFingerprint: vi.fn((s: string) => `hashed-${s}`),
}))

vi.mock('./alerts', () => ({
  moderateNewReport: vi.fn(),
  canConfirm: vi.fn(),
  buildExpiryDate: vi.fn(() => new Date(Date.now() + 45 * 60 * 1000)),
  updateReportStatus: vi.fn(),
}))

vi.mock('./push', () => ({
  notifyZoneSubscribers: vi.fn(),
}))

const mockPrisma = vi.mocked(prisma)
const mockModerate = vi.mocked(moderateNewReport)
const mockCanConfirm = vi.mocked(canConfirm)
const mockUpdateStatus = vi.mocked(updateReportStatus)

const validCreateInput = {
  tipo: 'furto' as const,
  urgencia: 'alta' as const,
  local: 'Centro',
  zone_id: 'centro',
  fingerprint: 'fp1234567890',
  channel: 'pwa' as const,
}

describe('reportService', () => {
  beforeEach(() => {
    vi.mocked(mockPrisma.report.create).mockClear()
    vi.mocked(mockPrisma.report.findMany).mockClear()
    vi.mocked(mockPrisma.report.findUnique).mockClear()
    vi.mocked(mockPrisma.confirmation.create).mockClear()
    mockModerate.mockClear()
    mockCanConfirm.mockClear()
    mockUpdateStatus.mockClear()
    mockPrisma.report.findMany.mockResolvedValue([])
  })

  describe('createReport', () => {
    it('returns ok and report when moderation allows', async () => {
      mockModerate.mockResolvedValue({ allowed: true })
      const fakeReport = {
        id: 'r1',
        tipo: 'furto',
        urgencia: 'alta',
        local: 'Centro',
        zone_id: 'centro',
        status: 'ativo',
        fingerprint: 'hashed-fp',
        channel: 'pwa',
        retrato: null,
        extra: null,
        confirmacoes: 0,
        created_at: new Date(),
        expires_at: new Date(),
      }
      mockPrisma.report.create.mockResolvedValue(fakeReport as never)

      const result = await createReport(validCreateInput)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.report.id).toBe('r1')
        expect(result.report.local).toBe('Centro')
      }
      expect(mockModerate).toHaveBeenCalledWith({
        fingerprint: validCreateInput.fingerprint,
        zone_id: validCreateInput.zone_id,
        tipo: validCreateInput.tipo,
      })
      expect(mockPrisma.report.create).toHaveBeenCalled()
      const createCall = mockPrisma.report.create.mock.calls[0]
      expect(createCall?.[0]?.data?.fingerprint).toBe('hashed-fp1234567890')
      expect(createCall?.[0]?.data?.fingerprint).not.toBe(validCreateInput.fingerprint)
    })

    it('persists hashed fingerprint, never plain text (2.9)', async () => {
      mockModerate.mockResolvedValue({ allowed: true })
      mockPrisma.report.create.mockResolvedValue({ id: 'r1' } as never)
      await createReport({ ...validCreateInput, fingerprint: 'raw-fp-12345' })
      const createCall = mockPrisma.report.create.mock.calls[0]
      expect(createCall?.[0]?.data?.fingerprint).toBe('hashed-raw-fp-12345')
      expect(createCall?.[0]?.data?.fingerprint).not.toBe('raw-fp-12345')
    })

    it('returns ok false with code when moderation blocks (DUPLICATE)', async () => {
      mockModerate.mockResolvedValue({ allowed: false, reason: 'DUPLICATE' })

      const result = await createReport(validCreateInput)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('DUPLICATE')
        expect(result.message).toBeDefined()
      }
      expect(mockPrisma.report.create).not.toHaveBeenCalled()
    })

    it('returns ok false with code RATE_LIMIT when moderation blocks', async () => {
      mockModerate.mockResolvedValue({ allowed: false, reason: 'RATE_LIMIT' })

      const result = await createReport(validCreateInput)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('RATE_LIMIT')
    })
  })

  describe('listActiveReports', () => {
    it('calls findMany with where without zone when zone is not provided', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])

      await listActiveReports()

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['ativo', 'confirmado', 'critico'] },
            expires_at: { gt: expect.any(Date) },
          }),
          take: 50,
        })
      )
    })

    it('includes zone_id in where when zone is provided', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])

      await listActiveReports('centro')

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ zone_id: 'centro' }),
        })
      )
    })
  })

  describe('confirmReport', () => {
    it('returns NOT_FOUND when report does not exist', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)

      const result = await confirmReport('inexistente', { fingerprint: 'fp1234567890' })

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('NOT_FOUND')
      expect(mockPrisma.confirmation.create).not.toHaveBeenCalled()
    })

    it('returns EXPIRED when report is expired', async () => {
      mockPrisma.report.findUnique
        .mockResolvedValueOnce({ id: 'r1', status: 'expirado', zone_id: 'c', tipo: 'furto', urgencia: 'alta', local: 'L', fingerprint: 'h', channel: 'pwa', retrato: null, extra: null, confirmacoes: 0, created_at: new Date(), expires_at: new Date() } as never)
        .mockResolvedValueOnce(null)

      const result = await confirmReport('r1', { fingerprint: 'fp1234567890' })

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('EXPIRED')
    })

    it('returns ALREADY_CONFIRMED when fingerprint has already confirmed', async () => {
      const report = {
        id: 'r1',
        status: 'ativo' as const,
        zone_id: 'c',
        tipo: 'furto' as const,
        urgencia: 'alta' as const,
        local: 'L',
        fingerprint: 'h',
        channel: 'pwa' as const,
        retrato: null,
        extra: null,
        confirmacoes: 0,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      }
      mockPrisma.report.findUnique.mockReset()
      mockPrisma.report.findUnique.mockResolvedValue(report as never)
      mockCanConfirm.mockResolvedValue(false)

      const result = await confirmReport('r1', { fingerprint: 'fp1234567890' })

      expect(mockPrisma.report.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ALREADY_CONFIRMED')
      expect(mockPrisma.confirmation.create).not.toHaveBeenCalled()
    })

    it('returns ok and report when confirmation is allowed', async () => {
      const report = {
        id: 'r1',
        status: 'confirmado',
        zone_id: 'c',
        tipo: 'furto',
        urgencia: 'alta',
        local: 'L',
        fingerprint: 'h',
        channel: 'pwa',
        retrato: null,
        extra: null,
        confirmacoes: 2,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      }
      mockPrisma.report.findUnique
        .mockResolvedValueOnce(report as never)
        .mockResolvedValueOnce(report as never)
      mockCanConfirm.mockResolvedValue(true)
      mockPrisma.confirmation.create.mockResolvedValue({} as never)

      const result = await confirmReport('r1', { fingerprint: 'fp1234567890' })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.report.id).toBe('r1')
      expect(mockPrisma.confirmation.create).toHaveBeenCalled()
      expect(mockUpdateStatus).toHaveBeenCalledWith('r1')
    })
  })
})
