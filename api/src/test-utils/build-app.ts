import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import reportsRoutes from '../routes/reports'
import botRoutes from '../routes/bot'
import whatsappRoutes from '../routes/whatsapp'
import adminRoutes from '../routes/admin'
import { zonesRoutes, partnersRoutes, subscribeRoutes, statsRoutes } from '../routes/public'

/**
 * Builds Fastify instance with all routes for integration tests.
 * Does not connect Redis or start the expiry job.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(helmet)
  await app.register(cors, {
    origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret'],
  })
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ data: null, error: { code: 'RATE_LIMIT', message: 'Muitas requisições.' } }),
  })

  await app.register(reportsRoutes, { prefix: '/api/reports' })
  await app.register(botRoutes, { prefix: '/api/bot' })
  await app.register(whatsappRoutes, { prefix: '/api/whatsapp' })
  await app.register(zonesRoutes, { prefix: '/api/zones' })
  await app.register(partnersRoutes, { prefix: '/api/partners' })
  await app.register(subscribeRoutes, { prefix: '/api/subscribe' })
  await app.register(statsRoutes, { prefix: '/api/stats' })
  await app.register(adminRoutes, { prefix: '/api/admin' })

  app.get('/health', () => ({ status: 'ok', ts: new Date().toISOString() }))

  return app
}
