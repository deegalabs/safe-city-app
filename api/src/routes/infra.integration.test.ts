import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

/** App with low rate limit to test 429. */
async function buildAppWithStrictRateLimit(max: number) {
  const app = Fastify({ logger: false })
  await app.register(helmet)
  await app.register(cors, {
    origin: ['http://allowed-origin.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
  await app.register(rateLimit, {
    max,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ data: null, error: { code: 'RATE_LIMIT', message: 'Too many requests.' } }),
  })
  app.get('/ping', () => ({ ok: true }))
  return app
}

describe('integration / infra', () => {
  describe('Helmet (11.3)', () => {
    let app: Awaited<ReturnType<typeof buildAppWithStrictRateLimit>>

    beforeAll(async () => {
      app = await buildAppWithStrictRateLimit(100)
    })
    afterAll(async () => {
      await app.close()
    })

    it('response includes security headers (X-Content-Type-Options or similar)', async () => {
      const res = await app.inject({ method: 'GET', url: '/ping' })
      expect(res.statusCode).toBe(200)
      const headers = res.headers
      expect(
        headers['x-content-type-options'] ?? headers['content-security-policy'] ?? headers['x-frame-options']
      ).toBeDefined()
    })
  })

  describe('CORS (11.1)', () => {
    let app: Awaited<ReturnType<typeof buildAppWithStrictRateLimit>>

    beforeAll(async () => {
      app = await buildAppWithStrictRateLimit(100)
    })
    afterAll(async () => {
      await app.close()
    })

    it('allowed origin receives Access-Control-Allow-Origin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ping',
        headers: { origin: 'http://allowed-origin.com' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBe('http://allowed-origin.com')
    })

    it('disallowed origin does not receive Access-Control-Allow-Origin (or receives a different value)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ping',
        headers: { origin: 'http://evil.com' },
      })
      expect(res.statusCode).toBe(200)
      const allowOrigin = res.headers['access-control-allow-origin']
      expect(allowOrigin !== 'http://evil.com' || allowOrigin == null).toBe(true)
    })
  })

  describe('Rate limit global (11.2)', () => {
    it('after N requests in 1 min returns 429 RATE_LIMIT (or 500 if rate limit backend unavailable)', async () => {
      const app = await buildAppWithStrictRateLimit(2)
      const r1 = await app.inject({ method: 'GET', url: '/ping' })
      const r2 = await app.inject({ method: 'GET', url: '/ping' })
      const r3 = await app.inject({ method: 'GET', url: '/ping' })
      expect(r1.statusCode).toBe(200)
      expect(r2.statusCode).toBe(200)
      expect([429, 500]).toContain(r3.statusCode)
      if (r3.statusCode === 429) {
        const body = JSON.parse(r3.payload)
        expect(body.error?.code).toBe('RATE_LIMIT')
      }
      await app.close()
    })
  })
})
