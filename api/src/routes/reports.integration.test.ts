import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../test-utils/build-app'

const hasDb = Boolean(process.env['DATABASE_URL'])

describe('integration / api/reports', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it.runIf(hasDb)('GET /api/reports/active returns 200 and data array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/reports/active' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body).toHaveProperty('data')
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it.runIf(hasDb)('GET /api/reports/active?zone=centro returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/reports/active?zone=centro' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('POST /api/reports/ with invalid body (missing fingerprint) returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/',
      payload: {
        tipo: 'furto',
        urgencia: 'alta',
        local: 'Centro',
        zone_id: 'centro',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/reports/ with invalid tipo returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/',
      payload: {
        tipo: 'invalido',
        urgencia: 'alta',
        local: 'Centro',
        zone_id: 'centro',
        fingerprint: '0123456789ab',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/reports/ with invalid urgencia returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/',
      payload: {
        tipo: 'furto',
        urgencia: 'critica',
        local: 'Centro',
        zone_id: 'centro',
        fingerprint: '0123456789ab',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/reports/ with empty zone_id returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/',
      payload: {
        tipo: 'furto',
        urgencia: 'alta',
        local: 'Centro',
        zone_id: '',
        fingerprint: '0123456789ab',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/reports/ with fingerprint < 10 chars returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/',
      payload: {
        tipo: 'furto',
        urgencia: 'alta',
        local: 'Centro',
        zone_id: 'centro',
        fingerprint: '123456789',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('POST /api/reports/:id/confirm without fingerprint returns 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports/00000000-0000-0000-0000-000000000000/confirm',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error?.code).toBe('VALIDATION')
  })
})
