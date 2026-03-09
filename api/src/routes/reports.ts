import type { FastifyInstance } from 'fastify'
import { CreateReportSchema, ConfirmReportSchema } from '../schemas/reports'
import { createReport, listActiveReports, confirmReport } from '../services/reportService'
import { ok, err } from '../types'

export default async function reportsRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const body = CreateReportSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))

    const result = await createReport(body.data)
    if (!result.ok) return reply.code(429).send(err(result.code, result.message ?? 'Report not allowed at this time.'))
    return reply.code(201).send(ok(result.report))
  })

  app.get('/active', async (req, reply) => {
    const { zone } = req.query as { zone?: string }
    const reports = await listActiveReports(zone)
    return reply.send(ok(reports))
  })

  app.post('/:id/confirm', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = ConfirmReportSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', 'fingerprint required'))

    const result = await confirmReport(id, body.data)
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'EXPIRED' ? 410 : 409
      return reply.code(status).send(err(result.code, result.message))
    }
    return reply.send(ok(result.report))
  })
}
