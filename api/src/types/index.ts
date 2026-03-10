// ── Enums ────────────────────────────────────────────────────

export type ReportTipo     = 'furto' | 'violencia' | 'assedio' | 'suspeito' | 'infra'
export type ReportUrgencia = 'alta' | 'media' | 'baixa'
export type ReportStatus   = 'ativo' | 'confirmado' | 'critico' | 'expirado' | 'removido'
export type AdminRole      = 'superadmin' | 'parceiro'
export type BotChannel     = 'pwa' | 'whatsapp'

// ── Retrato ──────────────────────────────────────────────────

export interface Retrato {
  genero?: string | null
  idade?: string | null
  altura?: string | null
  porte?: string | null
  pele?: string | null
  cabelo?: string | null
  bone_cor?: string | null
  roupa?: string | null
  cor_roupa?: string | null
  detalhe?: string | null
  fuga?: string | null
  direcao?: string | null
}

// ── Bot ──────────────────────────────────────────────────────

export interface BotSession {
  channel: BotChannel
  sessionId: string      // hashed identifier (fingerprint or hashed phone)
  step: string
  dados: {
    tipo?: ReportTipo
    local?: string
    zone_id?: string
    local_texto?: string
    local_lat?: number
    local_lng?: number
    urgencia?: ReportUrgencia
    extra?: string
    retrato: Retrato
  }
  updatedAt: number
}

export interface BotInput {
  channel: BotChannel
  sessionId: string
  text?: string          // free text input
  optionKey?: string     // structured option key from flow
  optionData?: Record<string, unknown>
}

export interface BotOutput {
  text: string
  options?: BotOption[]
  input?: boolean
  inputPlaceholder?: string
  inputKey?: string
  nextOnInput?: string
  inputMode?: 'location' | 'text'
  type?: 'text' | 'confirm' | 'navigate'
  navigateTo?: string
  confirmData?: { hash: string; retrato: string }
}

export interface BotOption {
  label: string
  key: string
  data?: Record<string, unknown>
}

// ── API helpers ───────────────────────────────────────────────

export interface ApiOk<T>  { data: T; error: null }
export interface ApiErr    { data: null; error: { message: string; code: string } }
export type ApiResult<T>   = ApiOk<T> | ApiErr

export function ok<T>(data: T): ApiOk<T>                  { return { data, error: null } }
export function err(code: string, message: string): ApiErr { return { data: null, error: { code, message } } }
