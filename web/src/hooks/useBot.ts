import { useCallback, useEffect, useRef, useState } from 'react'
import { botMessage, getZones } from '@/lib/api'
import { getAnonymousFingerprint } from '@/lib/fingerprint'
import { getGPSCoord, reverseGeocode, searchLocation } from '@/lib/location'
import type { BotOption, BotOutput } from '@/types'

function closestZoneId(lat: number, lng: number, zones: { id: string; lat: number; lng: number }[]): string {
  if (zones.length === 0) return 'outro'
  let best = zones[0]!
  let d = (lat - best.lat) ** 2 + (lng - best.lng) ** 2
  for (const z of zones) {
    const d2 = (lat - z.lat) ** 2 + (lng - z.lng) ** 2
    if (d2 < d) { d = d2; best = z }
  }
  return best.id
}

export interface ChatMessage {
  id: string
  from: 'bot' | 'user'
  output?: BotOutput
  text?: string
  loading?: boolean
}

export function useBot() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputActive, setInputActive] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const sessionId = useRef<string>('')
  const zonesCache = useRef<{ id: string; lat: number; lng: number }[] | null>(null)

  const getZonesCached = useCallback(async () => {
    if (zonesCache.current) return zonesCache.current
    const res = await getZones()
    if (res.data?.length) zonesCache.current = res.data
    return zonesCache.current ?? []
  }, [])

  useEffect(() => {
    let cancelled = false
    getAnonymousFingerprint().then((fp) => {
      if (cancelled) return
      sessionId.current = fp
      if (fp.length >= 10) void send({})
    })
    return () => { cancelled = true }
  }, [])

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessages((p) => [...p, { ...msg, id: `${Date.now()}-${Math.random()}` }])
  }, [])

  const send = useCallback(async (body: { text?: string; optionKey?: string; optionData?: Record<string, unknown> }) => {
    setIsTyping(true)
    setInputActive(false)
    const res = await botMessage(sessionId.current, body)
    setIsTyping(false)
    if (!res.data) {
      addMsg({ from: 'bot', output: { text: '❌ Erro de conexão. Tente novamente.' } })
      return
    }
    addMsg({ from: 'bot', output: res.data })
    if (res.data.input) setInputActive(true)
    return res.data
  }, [addMsg])

  const handleGPS = useCallback(async () => {
    addMsg({ from: 'bot', output: { text: '📍 Detectando localização...' } })
    const coord = await getGPSCoord()
    if (!coord) {
      await send({ optionKey: 'goto:report_local_texto' })
      return
    }
    const resolved = await reverseGeocode(coord)
    if (!resolved) {
      await send({ optionKey: 'goto:report_local_texto' })
      return
    }
    const zones = await getZonesCached()
    const zone_id = zones.length ? closestZoneId(coord.lat, coord.lng, zones) : null
    await send({
      optionKey: 'goto:report_local_confirmar',
      optionData: {
        local: resolved.short,
        local_display: resolved.display,
        local_lat: resolved.lat,
        local_lng: resolved.lng,
        zone_id,
      },
    })
  }, [addMsg, send, getZonesCached])

  const handleLocationSearch = useCallback(async (text: string) => {
    addMsg({ from: 'bot', output: { text: '🔍 Buscando...' } })
    const [results, zones] = await Promise.all([searchLocation(text), getZonesCached()])
    if (results.length === 0) {
      await send({
        optionKey: 'goto:report_local_confirmar',
        optionData: { local: text.trim(), zone_id: null },
      })
      return
    }
    if (results.length === 1) {
      const r = results[0]
      if (r) {
        const zone_id = zones.length ? closestZoneId(r.lat, r.lng, zones) : null
        await send({
          optionKey: 'goto:report_local_confirmar',
          optionData: {
            local: r.short,
            local_display: r.display,
            local_lat: r.lat,
            local_lng: r.lng,
            zone_id,
          },
        })
      }
      return
    }
    addMsg({
      from: 'bot',
      output: {
        text: 'Qual destes locais?',
        options: results.map((r, i) => ({
          label: r.display,
          key: `ACTION:select_location_${i}`,
          data: {
            local: r.short,
            local_display: r.display,
            local_lat: r.lat,
            local_lng: r.lng,
            zone_id: zones.length ? closestZoneId(r.lat, r.lng, zones) : null,
          },
        })),
      },
    })
  }, [addMsg, send, getZonesCached])

  const handleSelectLocation = useCallback(async (opt: BotOption) => {
    const data = opt.data
    if (!data) return
    await send({ optionKey: 'goto:report_local_confirmar', optionData: data })
  }, [send])

  const handleSosGps = useCallback(async () => {
    addMsg({ from: 'bot', output: { text: '📍 Obtendo localização...' } })
    const coord = await getGPSCoord(5000)
    if (!coord) {
      addMsg({ from: 'bot', output: { text: '❌ Não foi possível obter a localização. Ative o GPS e tente novamente.' } })
      return
    }
    const [resolved, zones] = await Promise.all([reverseGeocode(coord), getZonesCached()])
    const local = resolved?.short ?? resolved?.display ?? 'Emergência'
    const zone_id = zones.length ? closestZoneId(coord.lat, coord.lng, zones) : null
    await send({ optionKey: 'ACTION:sos_submit', optionData: { local, zone_id } })
  }, [addMsg, send, getZonesCached])

  const pickOption = useCallback(async (opt: BotOption) => {
    addMsg({ from: 'user', text: opt.label })

    if (opt.key === 'ACTION:gps') {
      await handleGPS()
      return
    }
    if (opt.key === 'ACTION:gps_sos') {
      await handleSosGps()
      return
    }
    if (opt.key.startsWith('ACTION:select_location_')) {
      await handleSelectLocation(opt)
      return
    }

    await send(opt.data != null ? { optionKey: opt.key, optionData: opt.data } : { optionKey: opt.key })
  }, [addMsg, send, handleGPS, handleSosGps, handleSelectLocation])

  const sendText = useCallback(async (text: string) => {
    addMsg({ from: 'user', text })
    await send({ text })
  }, [addMsg, send])

  const reset = useCallback(async () => {
    setMessages([])
    await send({ optionKey: 'goto:start' })
  }, [send])

  return {
    messages,
    isTyping,
    inputActive,
    pickOption,
    sendText,
    handleLocationSearch,
    reset,
  }
}
