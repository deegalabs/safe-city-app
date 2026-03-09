import type { Report } from '@/types'

const TIPO_LABEL: Record<string,string> = { furto:'Furto/Roubo', violencia:'Violência', assedio:'Assédio', suspeito:'Suspeito', infra:'Infraestrutura' }
const TIPO_COLOR: Record<string,string> = { furto:'#ef4444', violencia:'#ef4444', assedio:'#f59e0b', suspeito:'#ff6b35', infra:'#64748b' }
const URG_COLOR:  Record<string,string> = { alta:'#ef4444', media:'#f59e0b', baixa:'#2dd4bf' }

function minsAgo(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 60000) }

interface Props { alerts: Report[] }

export default function Alertas({ alerts }: Props) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 8px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div className="section-label">ALERTAS ATIVOS</div>
          <div style={{ fontSize:17, fontWeight:700, color:'var(--bright)' }}>Centro · agora</div>
        </div>
        <span className="tag" style={{ background:'#ff6b3518', border:'1px solid #ff6b3544', color:'var(--orange)' }}>
          <span className="dot dot-pulse" style={{ background:'var(--orange)', width:6, height:6 }} />
          {alerts.length} {alerts.length===1?'ativo':'ativos'}
        </span>
      </div>

      <div className="scroll-area" style={{ padding:'0 12px 12px' }}>
        {alerts.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:15, fontWeight:600 }}>Nenhum alerta ativo</div>
            <div style={{ fontSize:12, marginTop:4, color:'var(--dim)' }}>A região está tranquila agora.</div>
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:10, paddingTop:4 }}>
          {alerts.map((a,i) => {
            const tc = TIPO_COLOR[a.tipo] ?? '#64748b'
            const uc = URG_COLOR[a.urgencia] ?? '#64748b'
            const min = minsAgo(a.created_at)
            return (
              <div key={a.id} className="fade-up" style={{ background:'var(--bg2)', borderRadius:10, padding:'12px 14px', border:`1px solid ${tc}22`, borderLeft:`3px solid ${uc}`, animationDelay:`${i*.08}s` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <span className="tag" style={{ background:`${tc}18`, border:`1px solid ${tc}44`, color:tc }}>{TIPO_LABEL[a.tipo]}</span>
                    {a.urgencia === 'alta' && <span className="tag" style={{ background:'#ef444418', border:'1px solid #ef444444', color:'var(--red)' }}>AGORA</span>}
                    <span className="tag" style={{ background:'#64748b18', border:'1px solid #64748b33', color:'var(--dim)' }}>{a.channel === 'whatsapp' ? '📱 WA' : '🌐 PWA'}</span>
                  </div>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)' }}>{min}min atrás</span>
                </div>
                <div style={{ display:'flex', gap:5, alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:11 }}>📍</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{a.local}</span>
                </div>
                {a.retrato && (
                  <div style={{ background:'var(--bg1)', borderRadius:6, padding:'8px 10px', fontFamily:'var(--mono)', fontSize:11, lineHeight:1.65 }}>
                    {Object.values(a.retrato).filter(Boolean).join(', ')}.
                  </div>
                )}
                <div style={{ marginTop:8, display:'flex', gap:8, fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)' }}>
                  <span>{a.confirmacoes} confirmação{a.confirmacoes!==1?'ões':''}</span>
                  <span>·</span>
                  <span>some em {Math.max(0,45-min)}min</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
