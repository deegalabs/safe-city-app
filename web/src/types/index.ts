export type ReportTipo     = 'furto' | 'violencia' | 'assedio' | 'suspeito' | 'infra'
export type ReportUrgencia = 'alta' | 'media' | 'baixa'
export type ReportStatus   = 'ativo' | 'confirmado' | 'critico' | 'expirado' | 'removido'

export interface Retrato {
  genero?: string | null; idade?: string | null; altura?: string | null
  porte?: string | null; pele?: string | null; cabelo?: string | null
  bone_cor?: string | null; roupa?: string | null; cor_roupa?: string | null
  detalhe?: string | null; fuga?: string | null; direcao?: string | null
}

export interface Report {
  id: string; hash: string; tipo: ReportTipo; urgencia: ReportUrgencia
  status: ReportStatus; local: string; zone_id: string; retrato: Retrato | null
  extra: string | null; confirmacoes: number; channel: 'pwa' | 'whatsapp'
  created_at: string; expires_at: string
}

export interface Zone {
  id: string; slug: string; nome: string; lat: number; lng: number
  risco: number; active_alerts: number
}

export interface Partner {
  id: string; nome: string; status: 'seguro' | 'atencao' | 'fechado'
  lat: number; lng: number; checkins_hoje: number
  type?: 'bar' | 'pharmacy' | 'store' | 'other'
  open_time?: string | null; close_time?: string | null; open_days?: string[]
}

export interface PublicStats {
  total_semana: number; por_tipo: Record<string, number>
  horario_pico: string; zona_critica: string; media_diaria: number
}

// Bot types (mirrors API)
export interface BotOption { label: string; key: string; data?: Record<string, unknown> }

export interface BotOutput {
  text: string; options?: BotOption[]; input?: boolean; inputPlaceholder?: string
  inputMode?: 'location' | 'text'
  type?: 'text' | 'confirm' | 'navigate'; navigateTo?: string
  confirmData?: { hash: string; retrato: string }
}

export interface ApiOk<T>  { data: T; error: null }
export interface ApiErr    { data: null; error: { message: string; code: string } }
export type ApiResult<T>   = ApiOk<T> | ApiErr
