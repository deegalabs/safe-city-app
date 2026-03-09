import { useState, useCallback } from 'react'
import { MessageSquare, TriangleAlert, Map, BarChart2, Settings } from 'lucide-react'
import { useAlerts } from '@/hooks/useAlerts'
import { useBot } from '@/hooks/useBot'
import Chat from '@/views/Chat'
import Alertas from '@/views/Alertas'
import Mapa from '@/views/Mapa'
import Bairro from '@/views/Bairro'
import Sobre from '@/views/Sobre'
import { getGPSCoord, reverseGeocode } from '@/lib/location'
import { getZones, createReport } from '@/lib/api'
import { getAnonymousFingerprint } from '@/lib/fingerprint'

export type ViewId = 'chat' | 'alertas' | 'mapa' | 'bairro' | 'sobre'
const TABS: { id: ViewId; Icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat',    Icon: MessageSquare, label: 'Reportar' },
  { id: 'alertas', Icon: TriangleAlert, label: 'Alertas'  },
  { id: 'mapa',    Icon: Map,           label: 'Mapa'      },
  { id: 'bairro',  Icon: BarChart2,     label: 'Bairro'   },
  { id: 'sobre',   Icon: Settings,      label: 'Config'    },
]

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

export default function App() {
  const [view, setView] = useState<ViewId>('chat')
  const [sosOpen, setSosOpen] = useState(false)
  const [sosSending, setSosSending] = useState(false)
  const [sosError, setSosError] = useState<string | null>(null)
  const { alerts } = useAlerts()
  const bot = useBot()

  const onSosConfirm = useCallback(async () => {
    setSosError(null)
    setSosSending(true)
    try {
      const coord = await getGPSCoord(5000)
      if (!coord) {
        setSosError('Não foi possível obter a localização. Ative o GPS e tente novamente.')
        setSosSending(false)
        return
      }
      const resolved = await reverseGeocode(coord)
      const local = resolved?.short ?? resolved?.display ?? 'Emergência'
      let zone_id = 'outro'
      const zonesRes = await getZones()
      if (zonesRes.data?.length) {
        zone_id = closestZoneId(coord.lat, coord.lng, zonesRes.data)
      }
      const fingerprint = await getAnonymousFingerprint()
      const res = await createReport({
        tipo: 'violencia',
        urgencia: 'alta',
        local,
        zone_id,
        fingerprint,
      })
      if (res.data) {
        setSosOpen(false)
        setView('alertas')
      } else {
        setSosError(res.error?.message ?? 'Falha ao enviar alerta.')
      }
    } catch (e) {
      setSosError(e instanceof Error ? e.message : 'Erro ao enviar.')
    }
    setSosSending(false)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">🛡</span>
          <span className="brand-name">Safe City</span>
          <span className="brand-sub">Centro · Floripa</span>
        </div>
        <div className="top-status">
          {alerts.length > 0 && <span className="dot dot-pulse" style={{ background: 'var(--red)' }} />}
          <span>{alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}</span>
        </div>
      </header>
      <main className="content">
        {view === 'chat'    && <Chat    onViewSwitch={setView} bot={bot} />}
        {view === 'alertas' && <Alertas alerts={alerts} onReport={() => setView('chat')} />}
        {view === 'mapa'    && <Mapa    alerts={alerts} />}
        {view === 'bairro'  && <Bairro  />}
        {view === 'sobre'   && <Sobre   />}
      </main>
      {view !== 'alertas' && (
        <button
          type="button"
          className="sos-fab"
          onClick={() => setSosOpen(true)}
        >
          SOS
        </button>
      )}
      {sosOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => !sosSending && setSosOpen(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 320, width: '90%', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ef444422', border: '2px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>SOS</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 8 }}>Alerta de emergência</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.5 }}>Toque para confirmar e disparar alerta. Sua localização será usada.</div>
            {sosError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{sosError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => !sosSending && setSosOpen(false)} disabled={sosSending} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg1)', color: 'var(--text)', cursor: sosSending ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button type="button" onClick={onSosConfirm} disabled={sosSending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--red)', color: '#fff', fontWeight: 700, cursor: sosSending ? 'not-allowed' : 'pointer' }}>{sosSending ? 'Enviando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
      <nav className="botnav">
        {TABS.map((tab) => (
          <button key={tab.id} className={`nav-btn${view === tab.id ? ' active' : ''}`} onClick={() => setView(tab.id)}>
            <span className="nav-icon"><tab.Icon size={18} strokeWidth={2} /></span>
            <span className="nav-lbl">{tab.label}</span>
            {tab.id === 'alertas' && alerts.length > 0 && <span className="alert-badge">{alerts.length}</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}
