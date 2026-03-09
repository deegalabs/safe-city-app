import { useEffect, useState } from 'react'
import { getPublicStats } from '@/lib/api'
import type { PublicStats } from '@/types'

const MOCK: PublicStats = { total_semana:47, por_tipo:{ furto:19, violencia:8, assedio:7, suspeito:11, infra:2 }, horario_pico:'22h–00h', zona_critica:'Praça XV', media_diaria:6.7 }
const TIPO_LABEL: Record<string,string> = { furto:'Furto/Roubo', violencia:'Violência', assedio:'Assédio', suspeito:'Suspeito', infra:'Infraestrutura' }
const TIPO_COLOR: Record<string,string> = { furto:'#ef4444', violencia:'#ef4444', assedio:'#f59e0b', suspeito:'#ff6b35', infra:'#64748b' }

export default function Bairro() {
  const [stats, setStats] = useState<PublicStats>(MOCK)
  useEffect(() => { void getPublicStats().then((r) => { if (r.data) setStats(r.data) }) }, [])
  const max = Math.max(...Object.values(stats.por_tipo))

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 8px', flexShrink:0 }}>
        <div className="section-label">ESTATÍSTICAS PÚBLICAS</div>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--bright)' }}>Centro · esta semana</div>
        <div style={{ fontSize:12, color:'var(--dim)', marginTop:4 }}>Dados agregados · sem identificação pessoal</div>
      </div>
      <div className="scroll-area" style={{ padding:'0 12px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, paddingTop:4 }}>
          {[{ label:'Reportes na semana', value:stats.total_semana, color:'var(--orange)' },{ label:'Média por dia', value:stats.media_diaria.toFixed(1), color:'var(--teal)' },{ label:'Horário de pico', value:stats.horario_pico, color:'var(--amber)', small:true },{ label:'Zona mais crítica', value:stats.zona_critica, color:'var(--red)', small:true }].map((c) => (
            <div key={c.label} className="fade-up" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'var(--dim)', marginBottom:6, fontFamily:'var(--mono)', letterSpacing:'1px' }}>{c.label.toUpperCase()}</div>
              <div style={{ fontSize:c.small?13:22, fontWeight:700, color:c.color, lineHeight:1.2 }}>{c.value}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
          <div className="section-label" style={{ marginBottom:10 }}>REPORTES POR TIPO</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(stats.por_tipo).sort(([,a],[,b])=>b-a).map(([tipo,count]) => {
              const cor = TIPO_COLOR[tipo] ?? '#64748b'
              return (
                <div key={tipo}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12 }}>{TIPO_LABEL[tipo]}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:cor }}>{count}</span>
                  </div>
                  <div style={{ height:6, background:'var(--bg1)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round(count/max*100)}%`, background:cor, borderRadius:3, transition:'width .5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ marginTop:10, padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, fontSize:11, color:'var(--dim)', lineHeight:1.6 }}>
          🔒 Dados completamente anônimos. Nenhum report individual acessível aqui.
        </div>
      </div>
    </div>
  )
}
