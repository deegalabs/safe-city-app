/**
 * WhatsApp channel via Evolution API (self-hosted, open source).
 * Evolution API runs on Railway as a separate service.
 * Docs: https://doc.evolution-api.com
 *
 * Flow:
 *   WhatsApp message → webhook POST /api/whatsapp/webhook/:token
 *   → WhatsAppService.handleIncoming()
 *   → BotService.process() (same logic as PWA)
 *   → WhatsAppService.send() → Evolution API → WhatsApp
 *
 * Audio: messageType === 'audioMessage' → getBase64FromMediaMessage → transcribe → bot.process
 */

import { hashFingerprint } from '../lib/fingerprint'
import { redis } from '../lib/redis'
import { botService } from './bot'
import { transcribeAudio } from './ai'
import type { BotOutput } from '../types'

/** Listas/botões foram descontinuados pelo WhatsApp (mai/2024). Usamos só texto e opções numeradas. */
const WA_OPTS_TTL = 60
const WA_OPTS_PREFIX = 'wa:opts:'

const EVOLUTION_URL    = process.env['EVOLUTION_API_URL']    ?? 'http://localhost:8080'
const EVOLUTION_KEY    = process.env['EVOLUTION_API_KEY']    ?? ''
const EVOLUTION_INST   = process.env['EVOLUTION_INSTANCE']   ?? 'safe-city-floripa'
const WEBHOOK_SECRET   = process.env['WHATSAPP_WEBHOOK_SECRET'] ?? ''

// ── Incoming handler ──────────────────────────────────────────

export interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    key: { remoteJid: string; fromMe: boolean; id: string }
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
      buttonsResponseMessage?: { selectedDisplayText?: string; selectedButtonId?: string }
    }
    messageType: string
  }
}

export function verifyWebhookSecret(secret: string): boolean {
  return !WEBHOOK_SECRET || secret === WEBHOOK_SECRET
}

/** Fetch audio as base64 from Evolution API (message key from webhook). */
async function getAudioBase64(messageKey: { id: string }): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INST}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { base64?: string; mimetype?: string; mimeType?: string }
    const b64 = data.base64
    if (!b64 || typeof b64 !== 'string') return null
    const base64Clean = b64.replace(/^data:[\w/+-]+;base64,/, '')
    const buffer = Buffer.from(base64Clean, 'base64')
    const mimeType = data.mimetype ?? data.mimeType ?? 'audio/ogg'
    return { buffer, mimeType }
  } catch {
    return null
  }
}

export async function handleIncoming(payload: EvolutionWebhookPayload): Promise<void> {
  const data = payload?.data
  const key = data?.key
  if (!data || !key) return // eventos sem mensagem (ex.: CONNECTION_UPDATE) ou payload malformado
  if (key.fromMe) return
  const VALID_EVENTS = ['messages.upsert', 'MESSAGES_UPSERT', 'messages.update']
  if (!VALID_EVENTS.includes(payload.event)) return

  const jid     = key.remoteJid
  const msgType = data.messageType

  // Extract text or button response
  let text: string | undefined
  let optionKey: string | undefined
  let optionData: Record<string, unknown> | undefined

  if (msgType === 'conversation') {
    text = data.message?.conversation?.trim()
  } else if (msgType === 'extendedTextMessage') {
    text = data.message?.extendedTextMessage?.text?.trim()
  } else if (msgType === 'buttonsResponseMessage') {
    const btn = data.message?.buttonsResponseMessage
    optionKey  = btn?.selectedButtonId
    text       = btn?.selectedDisplayText
  } else if (msgType === 'audioMessage') {
    const audio = await getAudioBase64(key)
    if (audio) {
      const transcript = await transcribeAudio(audio.buffer, audio.mimeType)
      if (transcript.trim()) text = transcript.trim()
    }
    if (!text) {
      await sendText(jid, '❌ Não consegui entender o áudio. Envie em texto ou tente novamente.')
      return
    }
  }

  if (!text && !optionKey) return

  const sessionId = hashFingerprint(jid)
  // Resolver "1", "2" etc. para optionKey quando temos opções guardadas (menu em texto)
  const optsKey = WA_OPTS_PREFIX + sessionId
  const storedOpts = await redis.get(optsKey)
  if (storedOpts && text && /^\s*\d+\s*$/.test(text)) {
    try {
      const keys = JSON.parse(storedOpts) as string[]
      const n = Math.floor(Number(text))
      if (n >= 1 && n <= keys.length) {
        optionKey = keys[n - 1]
        text = undefined
        await redis.del(optsKey)
      }
    } catch { /* ignore */ }
  }

  const output = await botService.process({
    channel: 'whatsapp',
    sessionId,
    text,
    optionKey,
    optionData,
  })

  await sendOutput(jid, output)
}

// ── Outgoing ──────────────────────────────────────────────────
// Listas/botões nativos foram descontinuados pelo WhatsApp; usamos só sendText com menu numerado.

async function sendOutput(jid: string, output: BotOutput): Promise<void> {
  let text = formatText(output)
  const options = output.options
  if (options && options.length > 0) {
    text += '\n\n' + options.map((o, i) => `${i + 1}. ${o.label}`).join('\n') + '\n\n_Digite o número da opção (ex: 1)_'
    const sessionId = hashFingerprint(jid)
    await redis.setex(WA_OPTS_PREFIX + sessionId, WA_OPTS_TTL, JSON.stringify(options.map((o) => o.key)))
  }
  await sendText(jid, text)
}

async function sendText(jid: string, text: string): Promise<void> {
  await evolutionFetch('/message/sendText/' + EVOLUTION_INST, {
    number: jid,
    options: { delay: 300, presence: 'composing' },
    textMessage: { text },
  })
}

function formatText(output: BotOutput): string {
  if (output.type === 'confirm' && output.confirmData) {
    return `✅ *Alerta enviado!*\nID: \`${output.confirmData.hash}\`\n\n${output.confirmData.retrato ? `👤 *Retrato:* ${output.confirmData.retrato}` : ''}\n\n_Some em 45min · Anônimo · Sem rastreamento_`
  }
  return output.text
}

async function evolutionFetch(path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(`${EVOLUTION_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error('Evolution API error:', res.status, await res.text())
  } catch (err) {
    console.error('Evolution API fetch error:', err)
  }
}
