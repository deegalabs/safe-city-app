import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../test-utils/build-app'

const hasDb = Boolean(process.env['DATABASE_URL'])

describe('integration / api/subscribe', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/subscribe with invalid body (endpoint not a URL) returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: {
        endpoint: 'not-a-url',
        keys: { p256dh: 'k', auth: 'a' },
        zones: ['centro'],
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/subscribe with empty zones returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: {
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'k', auth: 'a' },
        zones: [],
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it.runIf(hasDb)('POST /api/subscribe with valid endpoint, keys and zones returns 201 (7.1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: {
        endpoint: 'https://fcm.googleapis.com/fake-endpoint-id',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        zones: ['centro'],
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(body.data?.message).toBeDefined()
  })
})

describe('integration / api/zones', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it.runIf(hasDb)('GET /api/zones returns 200 and list with active_alerts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/zones' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data)).toBe(true)
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty('active_alerts')
    }
  })
})

describe('integration / api/partners', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it.runIf(hasDb)('GET /api/partners returns 200 and array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/partners' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it.runIf(hasDb)('GET /api/partners includes type, open_time, open_days in returned objects', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/partners' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    if (body.data?.length > 0) {
      expect(body.data[0]).toHaveProperty('type')
      expect(body.data[0]).toHaveProperty('open_time')
      expect(body.data[0]).toHaveProperty('open_days')
    }
  })

  it('POST /api/partners/checkin without fingerprint returns 400 VALIDATION (6.4)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/partners/checkin',
      payload: { partner_id: 'any-id' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it.runIf(hasDb)('POST /api/partners/checkin with valid partner_id and fingerprint returns 201 (6.2)', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/partners' })
    const listBody = JSON.parse(list.payload)
    const partners = listBody.data ?? []
    if (partners.length === 0) return
    const partnerId = partners[0].id
    const res = await app.inject({
      method: 'POST',
      url: '/api/partners/checkin',
      payload: { partner_id: partnerId, fingerprint: '0123456789abcdef' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
  })

  it.runIf(hasDb)('POST /api/partners/checkin with non-existent partner_id returns 404 NOT_FOUND (6.3)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/partners/checkin',
      payload: {
        partner_id: '00000000-0000-0000-0000-000000000000',
        fingerprint: '0123456789abcdef',
      },
    })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('integration / api/stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it.runIf(hasDb)('GET /api/stats/public returns 200 and total_semana, por_tipo, etc.', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stats/public' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(body.data).toHaveProperty('total_semana')
    expect(body.data).toHaveProperty('por_tipo')
    expect(body.data).toHaveProperty('horario_pico')
    expect(body.data).toHaveProperty('zona_critica')
    expect(body.data).toHaveProperty('media_diaria')
  })
})
