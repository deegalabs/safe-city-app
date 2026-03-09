import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../test-utils/build-app'

describe('integration / api/admin', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/admin/dashboard without token returns 401 or 503 (503 if Supabase not configured)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
    })
    expect([401, 503]).toContain(res.statusCode)
  })

  it('GET /api/admin/reports without token returns 401 or 503', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reports',
    })
    expect([401, 503]).toContain(res.statusCode)
  })
})
