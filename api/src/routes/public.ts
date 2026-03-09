import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { hashFingerprint } from '../lib/fingerprint'
import { CheckinSchema, SubscribeSchema } from '../schemas/public'
import { ok, err } from '../types'

export async function zonesRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => {
    const zones = await prisma.zone.findMany({
      include: { _count: { select: { reports: { where: { status: { in: ['ativo', 'confirmado', 'critico'] }, expires_at: { gt: new Date() } } } } } },
      orderBy: { risco: 'desc' },
    })
    return reply.send(ok(zones.map((z) => ({ ...z, active_alerts: z._count.reports }))))
  })
}

export async function partnersRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => {
    return reply.send(ok(await prisma.partner.findMany({ where: { active: true }, orderBy: { checkins_hoje: 'desc' } })))
  })

  app.post('/checkin', async (req, reply) => {
    const body = CheckinSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))
    const partner = await prisma.partner.findUnique({ where: { id: body.data.partner_id } })
    if (!partner) return reply.code(404).send(err('NOT_FOUND', 'Partner not found'))
    await prisma.checkin.create({ data: { partner_id: body.data.partner_id, fingerprint: hashFingerprint(body.data.fingerprint) } })
    await prisma.partner.update({ where: { id: body.data.partner_id }, data: { checkins_hoje: { increment: 1 } } })
    return reply.code(201).send(ok({ message: 'Check-in recorded' }))
  })
}

export async function subscribeRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const body = SubscribeSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.data.endpoint },
      create: { endpoint: body.data.endpoint, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth, zones: body.data.zones },
      update: { zones: body.data.zones },
    })
    return reply.code(201).send(ok({ message: 'Subscription registered' }))
  })
}

export async function statsRoutes(app: FastifyInstance) {
  app.get('/public', async (_req, reply) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [reports, topZone] = await Promise.all([
      prisma.report.findMany({ where: { created_at: { gte: since } }, select: { tipo: true, created_at: true, zone_id: true } }),
      prisma.report.groupBy({ by: ['zone_id'], where: { created_at: { gte: since } }, _count: { _all: true }, orderBy: { _count: { zone_id: 'desc' } }, take: 1 }),
    ])
    const por_tipo = { furto: 0, violencia: 0, assedio: 0, suspeito: 0, infra: 0 } as Record<string, number>
    reports.forEach((r) => { if (por_tipo[r.tipo] !== undefined) por_tipo[r.tipo]++ })
    const hours = reports.map((r) => new Date(r.created_at).getHours())
    const peak = hours.length ? hours.reduce((acc, h) => { acc[h] = (acc[h] ?? 0) + 1; return acc }, {} as Record<number, number>) : {}
    const peakHour = Object.keys(peak).length ? Number(Object.entries(peak).sort(([, a], [, b]) => b - a)[0]![0]) : 22
    let zona_critica = 'Centro'
    if (topZone[0]) {
      const z = await prisma.zone.findUnique({ where: { id: topZone[0].zone_id } })
      if (z) zona_critica = z.nome
    }
    return reply.send(ok({ total_semana: reports.length, por_tipo, horario_pico: `${peakHour}h–${peakHour + 2}h`, zona_critica, media_diaria: Math.round((reports.length / 7) * 10) / 10 }))
  })
}
