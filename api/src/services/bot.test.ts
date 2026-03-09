import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSession, setSession, deleteSession, sessionKey } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { moderateNewReport, buildExpiryDate } from './alerts'
import { extractRetratoFromText } from './ai'
import { botService } from './bot'

vi.mock('../lib/redis', () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  deleteSession: vi.fn(),
  sessionKey: vi.fn((ch: string, id: string) => `key:${ch}:${id}`),
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    report: { create: vi.fn() },
  },
}))

vi.mock('../lib/fingerprint', () => ({
  hashFingerprint: vi.fn((s: string) => `hashed-${s}`),
}))

vi.mock('./alerts', () => ({
  moderateNewReport: vi.fn(),
  buildExpiryDate: vi.fn(() => new Date(Date.now() + 45 * 60 * 1000)),
}))

vi.mock('./push', () => ({
  notifyZoneSubscribers: vi.fn(),
}))

vi.mock('./ai', () => ({
  extractRetratoFromText: vi.fn(),
}))

const mockGetSession = vi.mocked(getSession)
const mockSetSession = vi.mocked(setSession)
const mockModerate = vi.mocked(moderateNewReport)
const mockPrismaCreate = vi.mocked(prisma.report.create)

describe('BotService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(null)
    mockModerate.mockResolvedValue({ allowed: true })
    mockPrismaCreate.mockResolvedValue({
      id: 'r1',
      hash: 'h1',
      tipo: 'furto',
      urgencia: 'alta',
      local: 'Centro',
      zone_id: 'outro',
      status: 'ativo',
      fingerprint: 'h',
      channel: 'pwa',
      retrato: null,
      extra: null,
      confirmacoes: 0,
      created_at: new Date(),
      expires_at: new Date(),
    } as never)
  })

  describe('process (new session)', () => {
    it('first message (no session) returns start step with options (3.2)', async () => {
      mockGetSession.mockResolvedValue(null)
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
      })
      expect(out.text).toContain('Safe City')
      expect(out.options).toBeDefined()
      expect(out.options!.length).toBeGreaterThan(0)
      expect(out.options!.some((o) => o.label.includes('Reportar'))).toBe(true)
    })

    it('text "SOS" (uppercase) triggers emergency response without normal flow', async () => {
      mockGetSession.mockResolvedValue(null)
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        text: 'SOS',
      })
      expect(out.text).toBeDefined()
      expect(out.text).toContain('emergência')
      expect(out.options?.some((o) => o.key === 'ACTION:gps_sos')).toBe(true)
    })

    it('text "PANICO" triggers same emergency response', async () => {
      mockGetSession.mockResolvedValue(null)
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        text: 'PANICO',
      })
      expect(out.text).toBeDefined()
      expect(out.options?.some((o) => o.key === 'ACTION:gps_sos')).toBe(true)
    })
  })

  describe('process (goto:report_tipo)', () => {
    it('optionKey goto:report_tipo returns report_tipo step with type options (3.3)', async () => {
      mockGetSession.mockResolvedValue(null)
      await botService.process({ channel: 'pwa', sessionId: '0123456789ab' })
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'goto:report_tipo',
      })
      expect(out.text).toContain('O que você está reportando')
      expect(out.options?.some((o) => o.key === 'goto:report_local_modo' && (o.data as { tipo?: string })?.tipo === 'furto')).toBe(true)
    })
  })

  describe('process (goto:report_local_modo + optionData)', () => {
    it('optionKey goto:report_local_modo with optionData tipo applies tipo to session (3.4)', async () => {
      mockGetSession.mockResolvedValue({
        channel: 'pwa',
        sessionId: '0123456789ab',
        step: 'report_tipo',
        dados: { retrato: {} },
        updatedAt: Date.now(),
      })
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'goto:report_local_modo',
        optionData: { tipo: 'furto' },
      })
      expect(out.text).toContain('local')
      expect(mockSetSession).toHaveBeenCalled()
      const sessionPassed = mockSetSession.mock.calls[0]?.[1]
      expect(sessionPassed?.dados?.tipo).toBe('furto')
    })
  })

  describe('stepToOutput (report_local_confirmar) — 10.10', () => {
    it('step report_local_confirmar with session.dados.local interpolates {local} in text', async () => {
      mockGetSession.mockResolvedValue({
        channel: 'pwa',
        sessionId: '0123456789ab',
        step: 'report_local_confirmar',
        dados: { local: 'Praça XV', retrato: {} },
        updatedAt: Date.now(),
      })
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'goto:report_local_confirmar',
      })
      expect(out.text).toContain('Praça XV')
      expect(out.text).not.toContain('{local}')
    })
  })

  describe('sendReport (10.11)', () => {
    it('sendReport with zone_id gps-resolved normalizes to outro in create', async () => {
      mockGetSession.mockResolvedValue({
        channel: 'pwa',
        sessionId: '0123456789ab',
        step: 'report_extra',
        dados: {
          tipo: 'furto',
          urgencia: 'alta',
          local: 'Centro',
          zone_id: 'gps-resolved',
          retrato: {},
        },
        updatedAt: Date.now(),
      })
      await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'ACTION:send',
      })
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ zone_id: 'outro' }),
        })
      )
    })

    it('sendReport with zone_id osm-resolved normalizes to outro', async () => {
      mockGetSession.mockResolvedValue({
        channel: 'pwa',
        sessionId: '0123456789ab',
        step: 'report_extra',
        dados: {
          tipo: 'furto',
          urgencia: 'alta',
          local: 'Centro',
          zone_id: 'osm-resolved',
          retrato: {},
        },
        updatedAt: Date.now(),
      })
      await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'ACTION:send',
      })
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ zone_id: 'outro' }),
        })
      )
    })
  })

  describe('nav:alertas (3.9)', () => {
    it('optionKey nav:alertas returns type navigate with navigateTo alertas', async () => {
      mockGetSession.mockResolvedValue({
        channel: 'pwa',
        sessionId: '0123456789ab',
        step: 'start',
        dados: { retrato: {} },
        updatedAt: Date.now(),
      })
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'nav:alertas',
      })
      expect(out.type).toBe('navigate')
      expect((out as { navigateTo?: string }).navigateTo).toBe('alertas')
    })
  })

  describe('moderation DUPLICATE (3.11)', () => {
    it('when moderation blocks (DUPLICATE) returns recently-reported message', async () => {
      mockGetSession.mockResolvedValue({
        channel: 'pwa',
        sessionId: '0123456789ab',
        step: 'report_extra',
        dados: {
          tipo: 'furto',
          urgencia: 'alta',
          local: 'Centro',
          zone_id: 'centro',
          retrato: {},
        },
        updatedAt: Date.now(),
      })
      mockModerate.mockResolvedValue({ allowed: false, reason: 'DUPLICATE' })
      const out = await botService.process({
        channel: 'pwa',
        sessionId: '0123456789ab',
        optionKey: 'ACTION:send',
      })
      expect(out.text).toMatch(/recentemente|minutos/)
      expect(mockPrismaCreate).not.toHaveBeenCalled()
    })
  })
})
