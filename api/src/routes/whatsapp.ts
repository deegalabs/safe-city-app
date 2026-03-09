import type { FastifyInstance } from 'fastify'
import { handleIncoming, verifyWebhookSecret, type EvolutionWebhookPayload } from '../services/whatsapp'
import { ok, err } from '../types'

export default async function whatsappRoutes(app: FastifyInstance) {
  /**
   * POST /api/whatsapp/webhook
   * Called by Evolution API on every incoming WhatsApp message.
   * Configure this URL in Evolution API dashboard under "Webhooks".
   */
  app.post('/webhook', async (req, reply) => {
    if (process.env['NODE_ENV'] === 'production' && !process.env['WHATSAPP_WEBHOOK_SECRET']) {
      return reply.code(500).send(err('CONFIG_ERROR', 'WHATSAPP_WEBHOOK_SECRET not set'))
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
      const res = await fetch(`${url}/instance/fetchInstances?instanceName=${encodeURIComponent(inst)}`, {
        headers: { apikey: key },
      })
      const body = await res.json() as { response?: unknown[] | Record<string, unknown>; status?: number } | unknown[]
      const raw = Array.isArray(body) ? body : (body as { response?: unknown[] | Record<string, unknown> }).response
      const list = Array.isArray(raw) ? raw : raw != null && typeof raw === 'object' ? [raw] : []
      const instance = list.find((i: unknown) => {
        const name = (i as { instance?: { instanceName?: string }; instanceName?: string }).instance?.instanceName ?? (i as { instanceName?: string }).instanceName
        return name === inst
      }) as { instance?: { status?: string }; status?: string } | undefined
      const status = instance?.instance?.status ?? instance?.status
      const connected = !!instance && (status === 'open' || status === 'CONNECTED')
      return reply.send(ok({ connected, instance: inst, state: status ?? null }))
    } catch {
      return reply.send(ok({ connected: false, instance: inst, error: 'Evolution API unreachable' }))
    }
  })
}
