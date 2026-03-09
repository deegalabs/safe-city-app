import { useEffect, useState } from 'react'
import { usePush } from '@/hooks/usePush'

const THEME_KEY = 'safe-city-theme'
type Theme = 'dark' | 'light'

export default function Sobre() {
  const { status, isSupported, requestPermission } = usePush()
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 8px', flexShrink:0 }}>
        <div className="section-label">CONFIG</div>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--bright)' }}>Safe City — Centro Floripa</div>
      </div>
      <div className="scroll-area" style={{ padding:'0 12px 16px' }}>
        <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:10, marginTop:4 }}>
          <div className="section-label">CONFIGURAÇÕES GERAIS</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0' }}>
            <span style={{ fontSize:13, color:'var(--text)' }}>Tema</span>
            <button type="button" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg1)', color:'var(--text)', fontSize:12, cursor:'pointer' }}>{theme === 'dark' ? '🌙 Escuro' : '☀️ Claro'}</button>
          </div>
        </section>

        {isSupported && (
          <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
            <div className="section-label">NOTIFICAÇÕES PUSH</div>
            <div style={{ fontSize:12, color:'var(--dim)', marginBottom:12, lineHeight:1.6 }}>Receba notificações push. Nenhuma informação sua vai ao servidor — só uma chave criptográfica anônima.</div>
            {status === 'granted' ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--green)' }}>✅ Notificações ativadas</div>
            ) : (
              <button onClick={() => requestPermission(['praca-xv','ticen','paulo-fontes','alfandega'])} disabled={status==='loading'}
                style={{ width:'100%', padding:11, borderRadius:10, background:'var(--orange)', border:'none', cursor:'pointer', color:'#fff', fontWeight:700, fontSize:13 }}>
                {status==='loading'?'Ativando...':'🔔 Ativar alertas desta região'}
              </button>
            )}
          </section>
        )}

        <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderLeft:'3px solid var(--teal)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
          <div className="section-label">PRIVACIDADE</div>
          {[['✓','Nunca coletamos','Nome, telefone, e-mail ou documento'],['✓','Nunca armazenamos','IP de origem ou localização GPS'],['✓','Nunca aceitamos','Fotos de pessoas suspeitas'],['✓','Autoridade','Vê o mesmo alerta público que você']].map(([icon,label,desc])=>(
            <div key={label} style={{ display:'flex', gap:8, marginBottom:8, fontSize:12 }}>
              <span style={{ color:'var(--teal)', fontWeight:700, flexShrink:0 }}>{icon}</span>
              <span><b style={{ color:'var(--text)' }}>{label}:</b> <span style={{ color:'var(--dim)' }}>{desc}</span></span>
            </div>
          ))}
        </section>

        <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
          <div className="section-label">CANAIS</div>
          {[['🌐 PWA','Acesse no navegador ou instale como app'],['📱 WhatsApp','Envie mensagem para o número Safe City e use o bot igual ao app']].map(([label,desc])=>(
            <div key={label} style={{ display:'flex', gap:10, marginBottom:10, padding:'10px 12px', background:'var(--bg1)', borderRadius:8 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--teal)', minWidth:90 }}>{label}</span>
              <span style={{ fontSize:12, color:'var(--dim)', lineHeight:1.5 }}>{desc}</span>
            </div>
          ))}
        </section>

        <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
          <div className="section-label">PONTOS SEGUROS</div>
          <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.6, marginBottom:12 }}>Estabelecimentos que exibem QR Code Safe City na entrada. Aparecem no mapa e recebem alertas próximos.</div>
          <a href="mailto:hi@safecity.dev" style={{ display:'block', textAlign:'center', padding:11, borderRadius:10, background:'var(--bg1)', border:'1px solid var(--border)', color:'var(--orange)', fontWeight:600, fontSize:13, textDecoration:'none' }}>
            📍 Quero ser ponto seguro parceiro
          </a>
        </section>

        <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
          <div className="section-label">SOBRE O SAFE CITY</div>
          {[['📢','Você reporta','Via chat no app ou WhatsApp. Sem foto, sem nome, sem login.'],['⚡','Alerta vai para a comunidade','Em segundos, quem está na região recebe o aviso.'],['⏱','Some automaticamente','Sem confirmação em 45min, o alerta desaparece.'],['🔒','Zero rastro','Número, IP e localização nunca armazenados.']].map(([icon,title,desc])=>(
            <div key={title} style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-start' }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--bright)', marginBottom:2 }}>{title}</div>
                <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
