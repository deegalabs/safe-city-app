import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../test-utils/build-app'

const hasDb = Boolean(process.env['DATABASE_URL'])

describe('integration / api/bot', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/bot/message without sessionId returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bot/message',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/bot/message with sessionId < 10 chars returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bot/message',
      payload: { sessionId: '123456789' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it.runIf(hasDb)('POST /api/bot/message with valid sessionId returns 200 and data (requires Redis)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bot/message',
      payload: { sessionId: '0123456789abcdef' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(body.data).toHaveProperty('text')
  })
})
