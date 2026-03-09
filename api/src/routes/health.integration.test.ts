import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../test-utils/build-app'

describe('integration / health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /health returns 200 and { status: "ok", ts: string }', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body).toMatchObject({ status: 'ok' })
    expect(typeof body.ts).toBe('string')
    expect(() => new Date(body.ts).toISOString()).not.toThrow()
  })

  it('response includes ISO timestamp', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    const body = JSON.parse(res.payload)
    const date = new Date(body.ts)
    expect(Number.isNaN(date.getTime())).toBe(false)
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
