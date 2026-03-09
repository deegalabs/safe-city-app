/**
 * Geocoding no backend (Nominatim) para WhatsApp e fluxos que não têm frontend.
 * Espelha a lógica do web/src/lib/location.ts.
 */

import { prisma } from '../lib/prisma'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const UA = 'SafeCity-Floripa/1.0 (github.com/deegalabs/safe-city-app)'

export interface ResolvedLocation {
  display: string
  short: string
  bairro: string
  cidade: string
  lat: number
  lng: number
  source: 'gps' | 'manual'
}

/** Reverse: coordenada → endereço legível */
export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedLocation | null> {
  const coord = {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
  }
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?lat=${coord.lat}&lon=${coord.lng}&format=json&zoom=17&addressdetails=1`,
      { headers: { 'User-Agent': UA } }
    )
    const data = (await res.json()) as { address?: Record<string, string> } | null
    if (!data?.address) return null
    const addr = data.address
    const road = addr.road ?? addr.pedestrian ?? addr.path ?? addr.neighbourhood ?? ''
    const bairro = addr.suburb ?? addr.neighbourhood ?? addr.city_district ?? 'Centro'
    const cidade = addr.city ?? addr.town ?? addr.municipality ?? 'Florianópolis'
    return {
      display: [road, bairro, cidade].filter(Boolean).join(', '),
      short: road || bairro,
      bairro,
      cidade,
      lat: coord.lat,
      lng: coord.lng,
      source: 'gps',
    }
  } catch {
    return null
  }
}

/** Forward: texto → sugestões (Nominatim, Florianópolis) */
export async function searchLocation(text: string): Promise<ResolvedLocation[]> {
  if (text.trim().length < 3) return []
  try {
    const q = encodeURIComponent(`${text.trim()}, Florianópolis, SC, Brasil`)
    const res = await fetch(
      `${NOMINATIM}/search?q=${q}&format=json&addressdetails=1&limit=5&countrycodes=br`,
      { headers: { 'User-Agent': UA } }
    )
    const data = (await res.json()) as Array<Record<string, unknown>> | null
    if (!Array.isArray(data)) return []
    return data.map((item) => {
      const addr = (item.address ?? {}) as Record<string, string>
      const road = addr.road ?? addr.pedestrian ?? ''
      const bairro = addr.suburb ?? addr.neighbourhood ?? 'Centro'
      const cidade = addr.city ?? addr.town ?? 'Florianópolis'
      return {
        display: String(item.display_name ?? '').split(',').slice(0, 3).join(','),
        short: road || bairro,
        bairro,
        cidade,
        lat: Math.round(Number(item.lat) * 1000) / 1000,
        lng: Math.round(Number(item.lon) * 1000) / 1000,
        source: 'manual' as const,
      }
    })
  } catch {
    return []
  }
}

export function closestZoneId(
  lat: number,
  lng: number,
  zones: { id: string; lat: number; lng: number }[]
): string {
  if (zones.length === 0) return 'outro'
  let best = zones[0]!
  let d = (lat - best.lat) ** 2 + (lng - best.lng) ** 2
  for (const z of zones) {
    const d2 = (lat - z.lat) ** 2 + (lng - z.lng) ** 2
    if (d2 < d) {
      d = d2
      best = z
    }
  }
  return best.id
}

/** Busca zonas do banco (id, lat, lng) para cálculo de zona mais próxima */
export async function getZonesForGeocoding(): Promise<{ id: string; lat: number; lng: number }[]> {
  const rows = await prisma.zone.findMany({ select: { id: true, lat: true, lng: true } })
  return rows
}

/**
 * Resolve texto digitado pelo usuário (ex.: "Rua Capitão Romualdo") em local + zone_id.
 * Usado no WhatsApp quando o usuário descreve o local.
 */
export async function resolveLocationFromText(
  text: string
): Promise<{ local: string; zone_id: string }> {
  const zones = await getZonesForGeocoding()
  const results = await searchLocation(text)
  if (results.length > 0) {
    const first = results[0]!
    const zone_id = zones.length ? closestZoneId(first.lat, first.lng, zones) : 'outro'
    return { local: first.short || first.display, zone_id }
  }
  // Sem resultado Nominatim: usar texto como local e zona genérica
  const zone_id = (await prisma.zone.findFirst({ orderBy: { risco: 'desc' } }))?.id ?? 'outro'
  return { local: text.trim() || 'Local informado', zone_id }
}
