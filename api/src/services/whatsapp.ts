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
import { botService } from './bot'
import { transcribeAudio } from './ai'
import type { BotOutput } from '../types'

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
    message?: { conversation?: string; buttonsResponseMessage?: { selectedDisplayText?: string; selectedButtonId?: string } }
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
  if (payload.data.key.fromMe) return
  const VALID_EVENTS = ['messages.upsert', 'MESSAGES_UPSERT', 'messages.update']
  if (!VALID_EVENTS.includes(payload.event)) return

  const jid     = payload.data.key.remoteJid
  const msgType = payload.data.messageType

  // Extract text or button response
  let text: string | undefined
  let optionKey: string | undefined
  let optionData: Record<string, unknown> | undefined

  if (msgType === 'conversation') {
    text = payload.data.message?.conversation?.trim()
  } else if (msgType === 'buttonsResponseMessage') {
    const btn = payload.data.message?.buttonsResponseMessage
    optionKey  = btn?.selectedButtonId
    text       = btn?.selectedDisplayText
  } else if (msgType === 'audioMessage') {
    const audio = await getAudioBase64(payload.data.key)
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

  // Hash phone number — never store plain
  const sessionId = hashFingerprint(jid)

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

async function sendOutput(jid: string, output: BotOutput): Promise<void> {
  if (output.options && output.options.length > 0 && output.options.length <= 3) {
    // Use WhatsApp button message (max 3 buttons)
    await sendButtons(jid, output.text, output.options.map((o) => ({
      buttonId: o.key,
      buttonText: { displayText: o.label },
      type: 1,
    })))
  } else if (output.options && output.options.length > 3) {
    // Use list message for many options
    await sendList(jid, output.text, output.options)
  } else {
    // Plain text
    await sendText(jid, formatText(output))
  }
}

async function sendText(jid: string, text: string): Promise<void> {
  await evolutionFetch('/message/sendText/' + EVOLUTION_INST, {
    number: jid,
    options: { delay: 300, presence: 'composing' },
    textMessage: { text },
  })
}

async function sendButtons(jid: string, text: string, buttons: unknown[]): Promise<void> {
  await evolutionFetch('/message/sendButtons/' + EVOLUTION_INST, {
    number: jid,
    options: { delay: 300, presence: 'composing' },
    buttonMessage: { title: 'Safe City', description: text, footer: 'Centro · Floripa', buttons },
  })
}

async function sendList(jid: string, text: string, options: BotOutput['options']): Promise<void> {
  await evolutionFetch('/message/sendList/' + EVOLUTION_INST, {
    number: jid,
    options: { delay: 300, presence: 'composing' },
    listMessage: {
      title: 'Safe City',
      description: text,
      footer: 'Centro · Floripa',
      buttonText: 'Ver opções',
      sections: [{
        title: 'Escolha uma opção',
        rows: (options ?? []).map((o) => ({ title: o.label, rowId: o.key })),
      }],
    },
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
