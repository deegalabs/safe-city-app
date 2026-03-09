import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { handleIncoming, verifyWebhookSecret, type EvolutionWebhookPayload } from '../services/whatsapp'
import { ok, err } from '../types'

const WEBHOOK_PATH_TOKEN = process.env['WHATSAPP_WEBHOOK_PATH_TOKEN'] ?? ''

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export default async function whatsappRoutes(app: FastifyInstance) {
  /**
   * POST /api/whatsapp/webhook/:token
   * Webhook da Evolution API. URL não exposta no Swagger.
   * Configure na Evolution a URL completa com o token (ex.: .../webhook/SEU_TOKEN_LONGO).
   * Gere o token: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  app.post<{ Params: { token: string } }>('/webhook/:token', async (req, reply) => {
    if (!WEBHOOK_PATH_TOKEN || !constantTimeEqual(req.params.token, WEBHOOK_PATH_TOKEN)) {
      return reply.code(404).send(err('NOT_FOUND', 'Not found'))
    }
    const secret = req.headers['x-webhook-secret'] as string ?? ''
    if (!verifyWebhookSecret(secret)) {
      return reply.code(401).send(err('UNAUTHORIZED', 'Invalid webhook secret'))
    }

    const payload = req.body as EvolutionWebhookPayload
    void handleIncoming(payload) // fire and forget — respond immediately
    return reply.send(ok({ received: true }))
  })

  /**
   * GET /api/whatsapp/status
   * Check if Evolution API instance is connected.
   */
  app.get('/status', async (_req, reply) => {
    const url  = process.env['EVOLUTION_API_URL'] ?? ''
    const key  = process.env['EVOLUTION_API_KEY'] ?? ''
    const inst = process.env['EVOLUTION_INSTANCE'] ?? 'safe-city-floripa'
    try {
      const res = await fetch(`${url}/instance/connectionState/${encodeURIComponent(inst)}`, {
        headers: { apikey: key },
      })
      const body = await res.json() as { instance?: { state?: string }; state?: string }
      const state = body?.instance?.state ?? body?.state ?? null
      const connected = res.ok && (state === 'open' || state === 'CONNECTED')
      return reply.send(ok({ connected, instance: inst, state }))
    } catch {
      return reply.send(ok({ connected: false, instance: inst, state: null, error: 'Evolution API unreachable' }))
    }
  })
}
