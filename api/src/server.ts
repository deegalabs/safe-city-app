import { config } from 'dotenv'
import * as path from 'node:path'

// Load .env da pasta api/
config({ path: path.resolve(process.cwd(), '.env') })

import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { openApiSpec } from './openapi'
import reportsRoutes from './routes/reports'
import botRoutes from './routes/bot'
import whatsappRoutes from './routes/whatsapp'
import adminRoutes from './routes/admin'
import { zonesRoutes, partnersRoutes, subscribeRoutes, statsRoutes } from './routes/public'
import { startExpiryJob } from './services/alerts'
import { redis } from './lib/redis'

const app = Fastify({ logger: { level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info' } })

async function main() {
  await app.register(helmet)
  await app.register(cors, {
    origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:5174').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret'],
  })
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ data: null, error: { code: 'RATE_LIMIT', message: 'Muitas requisições.' } }),
    // Webhook da Evolution não conta: uma ação do usuário gera vários eventos (MESSAGES_UPSERT, etc.)
    allowList: (req: FastifyRequest) => req.url?.startsWith('/api/whatsapp/webhook/') === true,
  })

  await app.register(swagger, { openapi: openApiSpec as object })
  await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'list', displayRequestDuration: true } })

  // Public routes
  await app.register(reportsRoutes,  { prefix: '/api/reports'   })
  await app.register(botRoutes,      { prefix: '/api/bot'       })
  await app.register(whatsappRoutes, { prefix: '/api/whatsapp'  })
  await app.register(zonesRoutes,    { prefix: '/api/zones'     })
  await app.register(partnersRoutes, { prefix: '/api/partners'  })
  await app.register(subscribeRoutes,{ prefix: '/api/subscribe' })
  await app.register(statsRoutes,    { prefix: '/api/stats'     })

  // Admin routes (protected internally per endpoint)
  await app.register(adminRoutes, { prefix: '/api/admin' })

  app.get('/health', () => ({ status: 'ok', ts: new Date().toISOString() }))

  // Railway e outros hosts injetam PORT; localmente use API_PORT ou 3000
  const PORT = Number(process.env['PORT'] ?? process.env['API_PORT'] ?? 3000)

  try {
    await redis.connect()
    console.log('✅ Redis connected')
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('❌ Redis connection failed:', err)
    process.exit(1)
  }
  startExpiryJob()
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`🛡 Safe City API on port ${PORT}`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
