import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../test-utils/build-app'

describe('integration / api/whatsapp', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/whatsapp/status returns 200 and payload with connected and instance', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/whatsapp/status' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(body.data).toHaveProperty('connected')
    expect(body.data).toHaveProperty('instance')
  })

  it('POST /api/whatsapp/webhook/:token with wrong token returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/webhook/token-invalido-123',
      payload: { event: 'MESSAGES_UPSERT', data: {} },
    })
    expect(res.statusCode).toBe(404)
  })
})
