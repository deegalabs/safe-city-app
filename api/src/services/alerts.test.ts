import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma'
import { checkRateLimit } from '../lib/fingerprint'
import {
  buildExpiryDate,
  EXPIRY_MINUTES,
  moderateNewReport,
  canConfirm,
  updateReportStatus,
} from './alerts'

vi.mock('../lib/prisma', () => ({
  prisma: {
    report: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    confirmation: { findUnique: vi.fn() },
  },
}))

vi.mock('../lib/fingerprint', () => ({
  hashFingerprint: vi.fn((s: string) => `hashed-${s}`),
  checkRateLimit: vi.fn(),
}))

const mockPrisma = vi.mocked(prisma)
const mockCheckRateLimit = vi.mocked(checkRateLimit)

describe('alerts', () => {
  describe('buildExpiryDate', () => {
    it('returns a date approximately 45 minutes in the future', () => {
      const before = Date.now()
      const expiry = buildExpiryDate()
      const after = Date.now()
      const diff = expiry.getTime() - before
      const expectedMin = (EXPIRY_MINUTES - 1) * 60 * 1000
      const expectedMax = (EXPIRY_MINUTES + 1) * 60 * 1000
      expect(diff).toBeGreaterThanOrEqual(expectedMin)
      expect(diff).toBeLessThanOrEqual(expectedMax)
    })
  })

  describe('moderateNewReport', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockCheckRateLimit.mockResolvedValue(true)
      mockPrisma.report.findFirst.mockResolvedValue(null)
    })

    it('returns allowed true when there is no recent report for same zone/type', async () => {
      const result = await moderateNewReport({
        fingerprint: 'fp123',
        zone_id: 'centro',
        tipo: 'furto',
      })
      expect(result.allowed).toBe(true)
      expect(mockPrisma.report.findFirst).toHaveBeenCalled()
    })

    it('returns allowed false with reason RATE_LIMIT when checkRateLimit returns false', async () => {
      mockCheckRateLimit.mockResolvedValue(false)
      const result = await moderateNewReport({
        fingerprint: 'fp123',
        zone_id: 'centro',
        tipo: 'furto',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('RATE_LIMIT')
      expect(mockPrisma.report.findFirst).not.toHaveBeenCalled()
    })

    it('returns allowed false with reason DUPLICATE when a report exists for same zone_id+tipo in last 2 min', async () => {
      mockPrisma.report.findFirst.mockResolvedValue({ id: 'r1' } as never)
      const result = await moderateNewReport({
        fingerprint: 'fp123',
        zone_id: 'centro',
        tipo: 'furto',
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DUPLICATE')
    })
  })

  describe('canConfirm', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns true when there is no prior confirmation', async () => {
      mockPrisma.confirmation.findUnique.mockResolvedValue(null)
      const result = await canConfirm('report-1', 'fp1234567890')
      expect(result).toBe(true)
      expect(mockPrisma.confirmation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { report_id_fingerprint: { report_id: 'report-1', fingerprint: expect.any(String) } },
        })
      )
    })

    it('returns false when confirmation already exists', async () => {
      mockPrisma.confirmation.findUnique.mockResolvedValue({ id: 'c1' } as never)
      const result = await canConfirm('report-1', 'fp1234567890')
      expect(result).toBe(false)
    })
  })

  describe('updateReportStatus', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('does not update when report does not exist', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await updateReportStatus('inexistente')
      expect(mockPrisma.report.update).not.toHaveBeenCalled()
    })

    it('keeps status with 0–1 confirmations', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'ativo',
        _count: { confirmations: 1 },
      } as never)
      await updateReportStatus('r1')
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'ativo', confirmacoes: 1 },
      })
    })

    it('upgrades to confirmado with 2+ confirmations', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'ativo',
        _count: { confirmations: 2 },
      } as never)
      await updateReportStatus('r1')
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'confirmado', confirmacoes: 2 },
      })
    })

    it('upgrades to critico with 5+ confirmations', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'confirmado',
        _count: { confirmations: 5 },
      } as never)
      await updateReportStatus('r1')
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'critico', confirmacoes: 5 },
      })
    })
  })
})
