import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getZones, getPartners } from '@/lib/api'
import type { Report, Zone, Partner } from '@/types'

const LOCAL_ZONAS: Array<{ id: string; nome: string; lat: number; lng: number; risco: number; active_alerts?: number }> = [
  { id: 'praca-xv',         nome: 'Praça XV de Novembro', lat: -27.5965, lng: -48.5484, risco: 88 },
  { id: 'paulo-fontes',     nome: 'Av. Paulo Fontes',     lat: -27.5942, lng: -48.5510, risco: 71 },
  { id: 'victor-meirelles', nome: 'Rua Victor Meirelles', lat: -27.5972, lng: -48.5452, risco: 62 },
  { id: 'ticen',            nome: 'Terminal TICEN',       lat: -27.5932, lng: -48.5520, risco: 75 },
  { id: 'bocaiuva',         nome: 'Rua Bocaiúva',         lat: -27.5960, lng: -48.5467, risco: 45 },
  { id: 'rio-branco',       nome: 'Av. Rio Branco',       lat: -27.5957, lng: -48.5492, risco: 55 },
  { id: 'felipe-schmidt',   nome: 'Rua Felipe Schmidt',   lat: -27.5948, lng: -48.5445, risco: 38 },
  { id: 'alfandega',        nome: 'Largo da Alfândega',   lat: -27.5976, lng: -48.5498, risco: 70 },
]

const color = (r: number) => r >= 75 ? '#ef4444' : r >= 50 ? '#f59e0b' : '#2dd4bf'

export default function Mapa({ alerts }: { alerts: Report[] }) {
  const mapRef = useRef<ReturnType<typeof L.map> | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const elRef = useRef<HTMLDivElement>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getZones().then((r) => { if (r.data) setZones(r.data) })
    void getPartners().then((r) => { if (r.data) setPartners(r.data) })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { center: [-27.5955, -48.548], zoom: 16, zoomControl: true, attributionControl: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    const layerGroup = L.layerGroup().addTo(map)
    layersRef.current = layerGroup
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layersRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const group = layersRef.current
    if (!map || !group) return

    group.clearLayers()
    const zonasToUse = zones.length ? zones : LOCAL_ZONAS
    const partnersToUse = partners.length ? partners : []

    zonasToUse.forEach((z) => {
      const c = color(z.risco)
      const activeAlerts = 'active_alerts' in z ? (z.active_alerts ?? 0) : 0
      const hasAlert = activeAlerts > 0 || alerts.some((a) => a.zone_id === z.id)
      L.circle([z.lat, z.lng], {
        radius: 52,
        color: c,
        weight: hasAlert ? 2 : 1,
        opacity: hasAlert ? 0.9 : 0.45,
        fillColor: c,
        fillOpacity: hasAlert ? 0.4 : 0.13,
      })
        .addTo(group)
        .bindPopup(
          `<div style="padding:10px;font-family:DM Sans,sans-serif"><b>${z.nome}</b><br><small>Risco <b style="color:${c}">${z.risco}/100</b></small>${hasAlert ? '<br><small>⚠️ Alerta ativo</small>' : '<br><small style="color:#64748b">✓ Sem alertas</small>'}</div>`
        )
    })

    partnersToUse.forEach((p) => {
      const c = p.status === 'seguro' ? '#22c55e' : p.status === 'atencao' ? '#f59e0b' : '#64748b'
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${c}22;border:2px solid ${c};display:flex;align-items:center;justify-content:center;font-size:14px">🍺</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
        .addTo(group)
        .bindPopup(
          `<div style="padding:6px;font-family:DM Sans,sans-serif"><b>${p.nome}</b><br><small style="color:${c}">${p.status === 'seguro' ? '✓ Seguro' : p.status === 'atencao' ? '⚠ Atenção' : 'Fechado'}</small>${p.open_time && p.close_time ? `<br><small style="color:#64748b">${p.open_time} – ${p.close_time}</small>` : ''}<br><small style="color:#64748b">${p.checkins_hoje} check-ins hoje</small></div>`
        )
    })
  }, [zones, partners, alerts])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 7 }}>
          Mapa de Calor — Centro
        </div>
        {loading && zones.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>Carregando zonas...</div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[['#ef4444', 'Crítico ≥75'], ['#f59e0b', 'Médio 50–74'], ['#2dd4bf', 'Baixo <50'], ['#22c55e', 'Safe spot']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--dim)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} />
              {l}
            </div>
          ))}
        </div>
      </div>
      <div ref={elRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
