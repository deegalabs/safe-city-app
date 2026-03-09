import { useEffect, useRef } from 'react'
import { Shield, Mic, Square } from 'lucide-react'
import type { useBot } from '@/hooks/useBot'
import type { ViewId } from '@/App'

interface Props { onViewSwitch: (v: ViewId) => void; bot: ReturnType<typeof useBot> }

const S = {
  bubble: (own: boolean): React.CSSProperties => ({
    alignSelf: own ? 'flex-end' : 'flex-start',
    maxWidth: '88%',
    background: own ? 'linear-gradient(135deg,#ff6b35cc,#ef4444aa)' : 'var(--bg2)',
    borderRadius: own ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
    padding: '10px 14px', fontSize: 13, lineHeight: 1.65,
    color: own ? '#fff' : 'var(--text)', whiteSpace: 'pre-wrap',
  }),
  option: (): React.CSSProperties => ({
    background: '#ff6b3511', border: '1px solid #ff6b3533', borderRadius: 10,
    padding: '9px 14px', color: 'var(--text)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'var(--sans)',
  }),
  input: (): React.CSSProperties => ({
    flex: 1, background: 'var(--bg2)', border: '1px solid var(--border-hi)',
    borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13,
    outline: 'none', fontFamily: 'var(--sans)',
  }),
}

export default function Chat({ onViewSwitch, bot }: Props) {
  const { messages, isTyping, inputActive, isRecording, startRecording, stopRecording, pickOption, sendText, handleLocationSearch } = bot
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const lastBotWithInput = [...messages].reverse().find((m) => m.from === 'bot' && m.output?.input)
  const isLocationInput = lastBotWithInput?.output?.inputMode === 'location'

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])
  useEffect(() => { if (inputActive) setTimeout(() => inputRef.current?.focus(), 100) }, [inputActive])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: 'var(--bg1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#ff6b3544,#ef444444)', border: '1px solid #ff6b3533', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)' }}><Shield size={20} strokeWidth={2} /></div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--bright)' }}>Safe City Bot</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--dim)' }}>
            <span className="dot dot-pulse" style={{ background: 'var(--green)', width: 6, height: 6 }} />
            online · anônimo · sem rastreamento
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="scroll-area" style={{ padding: '14px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => {
            if (msg.from === 'user') {
              return <div key={msg.id} className="slide-in" style={S.bubble(true)}>{msg.text}</div>
            }
            const out = msg.output
            if (!out) return null

            if (out.type === 'confirm' && out.confirmData) {
              return (
                <div key={msg.id} className="fade-up" style={{ background: 'var(--bg2)', border: '1px solid #22c55e44', borderLeft: '3px solid var(--green)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--bright)' }}>Alerta enviado</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>{out.confirmData.hash}</div>
                    </div>
                  </div>
                  {out.confirmData.retrato && (
                    <div style={{ background: 'var(--bg1)', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7 }}>
                      <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '2px', marginBottom: 4 }}>RETRATO FALADO</div>
                      {out.confirmData.retrato}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {[['var(--green)', 'Anônimo'], ['var(--teal)', 'Some em 45min'], ['var(--dim)', 'Sem foto']].map(([c, l]) => (
                      <span key={l} className="tag" style={{ background: `${c}18`, border: `1px solid ${c}44`, color: c }}>{l}</span>
                    ))}
                  </div>
                  {out.options && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {out.options.map((o) => (
                        <button key={o.key} onClick={() => {
                          if (o.key.startsWith('nav:')) { onViewSwitch(o.key.replace('nav:','') as ViewId); return }
                          void pickOption(o)
                        }} style={{ ...S.option(), flex: 1, fontSize: 12 }}>{o.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={msg.id} className="fade-up" style={{ alignSelf: 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 6, animationDelay: `${i * 0.04}s` }}>
                {out.text && <div style={S.bubble(false)}>{out.text}</div>}
                {out.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {out.options.map((o) => (
                      <button key={o.key} onClick={() => {
                        if (o.key.startsWith('nav:')) { onViewSwitch(o.key.replace('nav:','') as ViewId); return }
                        void pickOption(o)
                      }} style={S.option()}>{o.label}</button>
                    ))}
                  </div>
                )}
                {out.input && inputActive && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input ref={inputRef} placeholder={out.inputPlaceholder ?? 'Digite aqui...'} style={S.input()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = e.currentTarget.value.trim()
                          if (isLocationInput && v) {
                            void handleLocationSearch(v)
                            e.currentTarget.value = ''
                          } else if (v) {
                            void sendText(v)
                            e.currentTarget.value = ''
                          }
                        }
                      }} />
                    {!isLocationInput && (
                      <button
                        type="button"
                        onClick={() => (isRecording ? stopRecording() : void startRecording())}
                        title={isRecording ? 'Parar gravação' : 'Enviar áudio'}
                        style={{
                          background: isRecording ? 'var(--red)' : 'var(--teal)',
                          border: 'none',
                          borderRadius: 10,
                          padding: '9px 12px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!inputRef.current) return
                        const v = inputRef.current.value.trim()
                        if (isLocationInput && v) {
                          void handleLocationSearch(v)
                          inputRef.current.value = ''
                        } else if (v) {
                          void sendText(v)
                          inputRef.current.value = ''
                        }
                      }}
                      style={{ background: 'var(--orange)', border: 'none', borderRadius: 10, padding: '9px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {isLocationInput ? 'Buscar 🔍' : '→'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {isTyping && (
            <div className="fade-up" style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--bg2)', borderRadius: '4px 14px 14px 14px', width: 56 }}>
              {[0,.2,.4].map((d,i) => <span key={i} style={{ width:6,height:6,borderRadius:'50%',background:'var(--dim)',display:'block',animation:`typing 1s ${d}s ease-in-out infinite` }} />)}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
