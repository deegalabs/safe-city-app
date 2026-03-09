import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { hashFingerprint } from '../lib/fingerprint'
import { moderateNewReport, canConfirm, buildExpiryDate, updateReportStatus } from './alerts'
import { notifyZoneSubscribers } from './push'
import type { CreateReportInput, ConfirmReportInput } from '../schemas/reports'

export type CreateReportResult =
  | { ok: true; report: Awaited<ReturnType<typeof prisma.report.create>> }
  | { ok: false; code: string; message?: string }

export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  const mod = await moderateNewReport({
    fingerprint: input.fingerprint,
    zone_id: input.zone_id,
    tipo: input.tipo,
  })
  if (!mod.allowed) {
    return { ok: false, code: mod.reason ?? 'BLOCKED', message: 'Report não permitido agora.' }
  }

  const report = await prisma.report.create({
    data: {
      tipo: input.tipo,
      urgencia: input.urgencia,
      local: input.local,
      zone_id: input.zone_id,
      retrato: (input.retrato ?? null) as Prisma.InputJsonValue,
      extra: input.extra ?? null,
      fingerprint: hashFingerprint(input.fingerprint),
      channel: input.channel,
      expires_at: buildExpiryDate(),
    },
  })
  void notifyZoneSubscribers(input.zone_id, {
    title: `⚠️ ${input.local}`,
    body: 'Novo alerta na sua região',
    zone_id: input.zone_id,
    report_id: report.id,
  })
  return { ok: true, report }
}

export async function listActiveReports(zone?: string) {
  return prisma.report.findMany({
    where: {
      status: { in: ['ativo', 'confirmado', 'critico'] },
      expires_at: { gt: new Date() },
      ...(zone ? { zone_id: zone } : {}),
    },
    orderBy: [{ urgencia: 'asc' }, { created_at: 'desc' }],
    take: 50,
  })
}

export type ConfirmReportResult =
  | { ok: true; report: NonNullable<Awaited<ReturnType<typeof prisma.report.findUnique>>> }
  | { ok: false; code: string; message: string }

export async function confirmReport(reportId: string, input: ConfirmReportInput): Promise<ConfirmReportResult> {
  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return { ok: false, code: 'NOT_FOUND', message: 'Report não encontrado' }
  if (report.status === 'expirado' || report.status === 'removido') {
    return { ok: false, code: 'EXPIRED', message: 'Alerta expirado' }
  }
  const allowed = await canConfirm(reportId, input.fingerprint)
  if (!allowed) return { ok: false, code: 'ALREADY_CONFIRMED', message: 'Você já confirmou este alerta' }

  await prisma.confirmation.create({
    data: { report_id: reportId, fingerprint: hashFingerprint(input.fingerprint) },
  })
  await updateReportStatus(reportId)
  const updated = await prisma.report.findUnique({ where: { id: reportId } })
  return { ok: true, report: updated! }
}
