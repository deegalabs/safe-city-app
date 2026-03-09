import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { supabase } from '../lib/supabase'
import { requireAdmin, requireSuperAdmin, getAdmin } from '../middleware/auth'
import {
  ReportStatusSchema,
  PartnerCreateSchema,
  PartnerPatchSchema,
  AdminCreateSchema,
  AdminPatchSchema,
  ReportsQuerySchema,
  AuditQuerySchema,
} from '../schemas/admin'
import { ok, err } from '../types'

export default async function adminRoutes(app: FastifyInstance) {
  app.get('/dashboard', { preHandler: requireAdmin }, async (req, reply) => {
    const admin = getAdmin(req)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [activeAlerts, reportsToday, reportsWeek, pendingModeration, totalPartners] = await Promise.all([
      prisma.report.count({ where: { status: { in: ['ativo', 'confirmado', 'critico'] }, expires_at: { gt: new Date() } } }),
      prisma.report.count({ where: { created_at: { gte: since24h } } }),
      prisma.report.count({ where: { created_at: { gte: since7d } } }),
      prisma.report.count({ where: { status: 'ativo', confirmacoes: { gte: 3 } } }),
      prisma.partner.count({ where: { active: true } }),
    ])

    const reportsByType = await prisma.report.groupBy({
      by: ['tipo'],
      where: { created_at: { gte: since7d } },
      _count: { _all: true },
    })
    const byChannel = await prisma.report.groupBy({
      by: ['channel'],
      where: { created_at: { gte: since7d } },
      _count: { _all: true },
    })

    return reply.send(ok({
      activeAlerts,
      reportsToday,
      reportsWeek,
      pendingModeration,
      totalPartners,
      reportsByType: Object.fromEntries(reportsByType.map((r) => [r.tipo, r._count._all])),
      byChannel: Object.fromEntries(byChannel.map((r) => [r.channel, r._count._all])),
      adminRole: admin.role,
    }))
  })

  app.get('/reports', { preHandler: requireAdmin }, async (req, reply) => {
    const raw = req.query as Record<string, string | undefined>
    const query = ReportsQuerySchema.parse({ status: raw?.status, zone: raw?.zone, page: raw?.page ?? '1', limit: raw?.limit ?? '20' })
    const skip = (Number(query.page) - 1) * Number(query.limit)
    const where = {
      ...(query.status ? { status: query.status as 'ativo' | 'confirmado' | 'critico' | 'expirado' | 'removido' } : {}),
      ...(query.zone ? { zone_id: query.zone } : {}),
    }
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(query.limit),
        include: { zone: { select: { nome: true } } },
      }),
      prisma.report.count({ where }),
    ])
    return reply.send(ok({ reports, total, page: Number(query.page), limit: Number(query.limit) }))
  })

  app.patch('/reports/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const admin = getAdmin(req)
    const body = ReportStatusSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))
    const report = await prisma.report.update({ where: { id }, data: { status: body.data.status } })
    await prisma.auditLog.create({ data: { admin_id: admin.id, action: 'update_report_status', entity: 'report', entity_id: id, meta: { status: body.data.status } } })
    return reply.send(ok(report))
  })

  app.get('/partners', { preHandler: requireAdmin }, async (req, reply) => {
    const admin = getAdmin(req)
    const where = admin.role === 'parceiro' && admin.partner_id ? { id: admin.partner_id } : {}
    return reply.send(ok(await prisma.partner.findMany({ where, include: { zone: { select: { nome: true } } }, orderBy: { nome: 'asc' } })))
  })

  app.post('/partners', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const admin = getAdmin(req)
    const body = PartnerCreateSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))
    const partner = await prisma.partner.create({ data: body.data as Parameters<typeof prisma.partner.create>[0]['data'] })
    await prisma.auditLog.create({ data: { admin_id: admin.id, action: 'create_partner', entity: 'partner', entity_id: partner.id } })
    return reply.code(201).send(ok(partner))
  })

  app.patch('/partners/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const admin = getAdmin(req)
    if (admin.role === 'parceiro' && admin.partner_id !== id) return reply.code(403).send(err('FORBIDDEN', 'Access denied'))
    const body = PartnerPatchSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))
    const partner = await prisma.partner.update({ where: { id }, data: body.data })
    await prisma.auditLog.create({ data: { admin_id: admin.id, action: 'update_partner', entity: 'partner', entity_id: id, meta: body.data as object } })
    return reply.send(ok(partner))
  })

  app.delete('/partners/:id', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const admin = getAdmin(req)
    await prisma.partner.update({ where: { id }, data: { active: false } })
    await prisma.auditLog.create({ data: { admin_id: admin.id, action: 'deactivate_partner', entity: 'partner', entity_id: id } })
    return reply.send(ok({ message: 'Partner deactivated' }))
  })

  app.get('/admins', { preHandler: requireSuperAdmin }, async (_req, reply) => {
    return reply.send(ok(await prisma.admin.findMany({ orderBy: { created_at: 'desc' }, include: { partner: { select: { nome: true } } } })))
  })

  app.post('/admins', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const actor = getAdmin(req)
    const body = AdminCreateSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))

    if (!supabase) return reply.code(503).send(err('CONFIG', 'Supabase not configured'))
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: body.data.email,
      email_confirm: true,
      password: Math.random().toString(36).slice(-12),
    })
    if (authErr) return reply.code(400).send(err('AUTH_ERROR', authErr.message))

    const admin = await prisma.admin.create({
      data: {
        email: body.data.email,
        nome: body.data.nome,
        role: body.data.role,
        partner_id: body.data.partner_id ?? null,
      },
    })
    void supabase.auth.admin.inviteUserByEmail(body.data.email)
    await prisma.auditLog.create({ data: { admin_id: actor.id, action: 'create_admin', entity: 'admin', entity_id: admin.id } })
    return reply.code(201).send(ok({ admin, supabase_id: authUser.user?.id }))
  })

  app.patch('/admins/:id', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const actor = getAdmin(req)
    const body = AdminPatchSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))
    const admin = await prisma.admin.update({
      where: { id },
      data: {
        ...(body.data.nome != null && { nome: body.data.nome }),
        ...(body.data.role != null && { role: body.data.role }),
        ...(body.data.partner_id !== undefined && { partner_id: body.data.partner_id }),
        ...(body.data.active !== undefined && { active: body.data.active }),
      },
    })
    await prisma.auditLog.create({ data: { admin_id: actor.id, action: 'update_admin', entity: 'admin', entity_id: id, meta: body.data as object } })
    return reply.send(ok(admin))
  })

  app.get('/audit', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const raw = req.query as Record<string, string | undefined>
    const query = AuditQuerySchema.parse({ page: raw?.page ?? '1', limit: raw?.limit ?? '50', admin_id: raw?.admin_id })
    const logs = await prisma.auditLog.findMany({
      where: query.admin_id ? { admin_id: query.admin_id } : undefined,
      orderBy: { created_at: 'desc' },
      skip: (Number(query.page) - 1) * Number(query.limit),
      take: Number(query.limit),
      include: { admin: { select: { nome: true, email: true } } },
    })
    return reply.send(ok(logs))
  })

  app.get('/stats', { preHandler: requireAdmin }, async (_req, reply) => {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [totalReports, totalPartners, totalAdmins, byChannel, byZone] = await Promise.all([
      prisma.report.count({ where: { created_at: { gte: since7d } } }),
      prisma.partner.count({ where: { active: true } }),
      prisma.admin.count({ where: { active: true } }),
      prisma.report.groupBy({ by: ['channel'], where: { created_at: { gte: since7d } }, _count: { _all: true } }),
      prisma.report.groupBy({ by: ['zone_id'], where: { created_at: { gte: since7d } }, _count: { _all: true }, orderBy: { _count: { zone_id: 'desc' } }, take: 5 }),
    ])
    return reply.send(ok({ totalReports, totalPartners, totalAdmins, byChannel: Object.fromEntries(byChannel.map((r) => [r.channel, r._count._all])), byZone }))
  })
}
