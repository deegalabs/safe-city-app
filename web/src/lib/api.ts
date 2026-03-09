import type { ApiResult, BotOutput, Partner, PublicStats, Report, Zone } from '@/types'

// Em dev: '' usa o proxy do Vite (localhost:5173/api → 3000). Em prod: URL completa da API (ex.: https://api-production-8437.up.railway.app).
const BASE = (import.meta.env['VITE_API_URL'] as string) ?? ''
if (import.meta.env.PROD && !BASE) {
  console.error('[Safe City] Set VITE_API_URL in Vercel env (e.g. https://api-production-8437.up.railway.app) for the API to work.')
}

async function req<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const url = path.startsWith('http') ? path : `${BASE}${path}`
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
    const json = await res.json().catch(() => ({ data: null, error: { code: 'INVALID_RESPONSE', message: 'Invalid API response' } }))
    if (!res.ok) return { data: null, error: (json as { error?: ApiResult<unknown>['error'] }).error ?? { code: 'HTTP_ERROR', message: `Erro ${res.status}` } }
    return json as ApiResult<T>
  } catch (e) {
    return { data: null, error: { message: String(e), code: 'NETWORK_ERROR' } }
  }
}

const P = (s: string, q?: string) => `${BASE}/api${s}${q ?? ''}`

// Bot — all chat interactions go through the backend BotService
export const botMessage = (sessionId: string, body: {
  text?: string; optionKey?: string; optionData?: Record<string, unknown>
}) => req<BotOutput>(P('/bot/message'), { method: 'POST', body: JSON.stringify({ sessionId, ...body }) })

// Reports
export const getActiveReports  = (zone?: string) => req<Report[]>(P('/reports/active', zone ? `?zone=${zone}` : ''))
export const createReport = (body: {
  tipo: string; urgencia: string; local: string; zone_id: string
  fingerprint: string; channel?: 'pwa' | 'whatsapp'; retrato?: Record<string, unknown>; extra?: string
}) => req<Report>(P('/reports'), { method: 'POST', body: JSON.stringify({ ...body, channel: body.channel ?? 'pwa' }) })
export const confirmReport = (id: string, fingerprint: string) =>
  req<Report>(P(`/reports/${id}/confirm`), { method: 'POST', body: JSON.stringify({ fingerprint }) })

// Zones & Partners
export const getZones    = () => req<Zone[]>(P('/zones'))
export const getPartners = () => req<Partner[]>(P('/partners'))
export const checkin     = (partner_id: string, fingerprint: string) =>
  req<void>(P('/partners/checkin'), { method: 'POST', body: JSON.stringify({ partner_id, fingerprint }) })

// Stats
export const getPublicStats = () => req<PublicStats>(P('/stats/public'))

// Push
export const subscribe = (body: { endpoint: string; keys: { p256dh: string; auth: string }; zones: string[] }) =>
  req<void>(P('/subscribe'), { method: 'POST', body: JSON.stringify(body) })
