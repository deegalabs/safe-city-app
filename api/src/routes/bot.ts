import type { FastifyInstance } from 'fastify'
import { BotInputSchema } from '../schemas/bot'
import { botService } from '../services/bot'
import { ok, err } from '../types'

export default async function botRoutes(app: FastifyInstance) {
  app.post('/message', async (req, reply) => {
    const body = BotInputSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))

    const output = await botService.process({
      channel: 'pwa',
      sessionId: body.data.sessionId,
      text: body.data.text,
      optionKey: body.data.optionKey,
      optionData: body.data.optionData,
    })
    return reply.send(ok(output))
  })
}
