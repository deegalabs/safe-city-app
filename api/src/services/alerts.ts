import { prisma } from '../lib/prisma'
import { hashFingerprint, checkRateLimit } from '../lib/fingerprint'

// ── Alerts ────────────────────────────────────────────────────

export const EXPIRY_MINUTES = 45

export function buildExpiryDate(): Date {
  return new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000)
}

export async function expireOldReports(): Promise<void> {
  await prisma.report.updateMany({
    where: { status: { in: ['ativo', 'confirmado', 'critico'] }, expires_at: { lt: new Date() } },
    data: { status: 'expirado' },
  })
}

export async function updateReportStatus(reportId: string): Promise<void> {
  const r = await prisma.report.findUnique({
    where: { id: reportId },
    include: { _count: { select: { confirmations: true } } },
  })
  if (!r) return
  const count = r._count.confirmations
  const newStatus = count >= 5 ? 'critico' : count >= 2 ? 'confirmado' : r.status
  await prisma.report.update({ where: { id: reportId }, data: { status: newStatus, confirmacoes: count } })
}

let expiryJobLoggedFailure = false

export function startExpiryJob(): void {
  if (!process.env['DATABASE_URL']) return
  const run = (): void => {
    expireOldReports().catch((err) => {
      if (!expiryJobLoggedFailure) {
        expiryJobLoggedFailure = true
        console.error('expireOldReports failed (will retry silently):', err?.message ?? err)
      }
    })
  }
  void run()
  setInterval(run, 5 * 60 * 1000)
}

// ── Moderation ────────────────────────────────────────────────

export interface ModerationResult { allowed: boolean; reason?: string }

export async function moderateNewReport(params: {
  fingerprint: string; zone_id: string; tipo: string
}): Promise<ModerationResult> {
  if (!(await checkRateLimit(params.fingerprint))) return { allowed: false, reason: 'RATE_LIMIT' }

  const hashed = hashFingerprint(params.fingerprint)
  const twoMin = new Date(Date.now() - 2 * 60_000)
  const recent = await prisma.report.findFirst({
    where: { fingerprint: hashed, zone_id: params.zone_id, tipo: params.tipo as never, created_at: { gte: twoMin } },
  })
  if (recent) return { allowed: false, reason: 'DUPLICATE' }
  return { allowed: true }
}

export async function canConfirm(reportId: string, fingerprint: string): Promise<boolean> {
  const hashed = hashFingerprint(fingerprint)
  const ex = await prisma.confirmation.findUnique({
    where: { report_id_fingerprint: { report_id: reportId, fingerprint: hashed } },
  })
  return !ex
}
