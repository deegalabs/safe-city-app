// Coordenada truncada — nunca armazenar ou transmitir coordenada precisa
export interface TruncatedCoord {
  lat: number  // 3 decimal places ≈ 100m precision
  lng: number
}

// Resultado do geocoding — o que o sistema usa de fato
export interface ResolvedLocation {
  display: string   // ex: "Praça XV de Novembro, Centro, Florianópolis"
  short: string    // ex: "Praça XV de Novembro"
  bairro: string   // ex: "Centro"
  cidade: string   // ex: "Florianópolis"
  lat: number      // truncado
  lng: number      // truncado
  source: 'gps' | 'manual'
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const UA = 'SafeCity-Floripa/1.0 (github.com/deegalabs/safe-city-app)'

// Pegar GPS do dispositivo e truncar
export async function getGPSCoord(timeoutMs = 8000): Promise<TruncatedCoord | null> {
  if (!('geolocation' in navigator)) return null
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
        })
      },
      () => { clearTimeout(timer); resolve(null) },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    )
  })
}

// Reverse geocoding: coord → endereço legível
export async function reverseGeocode(coord: TruncatedCoord): Promise<ResolvedLocation | null> {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?lat=${coord.lat}&lon=${coord.lng}&format=json&zoom=17&addressdetails=1`,
      { headers: { 'User-Agent': UA } }
    )
    const data = await res.json()
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

// Forward search: texto livre → sugestões de locais em Florianópolis
export async function searchLocation(text: string): Promise<ResolvedLocation[]> {
  if (text.trim().length < 3) return []
  try {
    const q = encodeURIComponent(`${text}, Florianópolis, SC, Brasil`)
    const res = await fetch(
      `${NOMINATIM}/search?q=${q}&format=json&addressdetails=1&limit=5&countrycodes=br`,
      { headers: { 'User-Agent': UA } }
    )
    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data.map((item: Record<string, unknown>) => {
      const addr = (item.address ?? {}) as Record<string, string>
      const road = addr['road'] ?? addr['pedestrian'] ?? ''
      const bairro = addr['suburb'] ?? addr['neighbourhood'] ?? 'Centro'
      const cidade = addr['city'] ?? addr['town'] ?? 'Florianópolis'
      return {
        display: String(item['display_name'] ?? '').split(',').slice(0, 3).join(','),
        short: road || bairro,
        bairro,
        cidade,
        lat: Math.round(Number(item['lat']) * 1000) / 1000,
        lng: Math.round(Number(item['lon']) * 1000) / 1000,
        source: 'manual' as const,
      }
    })
  } catch {
    return []
  }
}

// Debounce para search — Nominatim: máx 1 req/segundo
let searchTimer: ReturnType<typeof setTimeout> | null = null

export function searchLocationDebounced(
  text: string,
  callback: (results: ResolvedLocation[]) => void
): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const results = await searchLocation(text)
    callback(results)
  }, 1000)
}
