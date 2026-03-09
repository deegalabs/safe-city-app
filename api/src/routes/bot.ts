import type { FastifyInstance } from 'fastify'
import { BotInputSchema, BotAudioInputSchema } from '../schemas/bot'
import { botService } from '../services/bot'
import { transcribeAudio } from '../services/ai'
import { ok, err } from '../types'

function base64ToBuffer(data: string): Buffer {
  const base64 = data.replace(/^data:[\w/+-]+;base64,/, '')
  return Buffer.from(base64, 'base64')
}

export default async function botRoutes(app: FastifyInstance) {
  app.post('/message', async (req, reply) => {
    const body = BotInputSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))

    const output = await botService.process({
      channel: 'pwa',
      sessionId: body.data.sessionId,
      text: body.data.text,
      optionKey: body.data.optionKey,
      optionData: body.data.optionData,
    })
    return reply.send(ok(output))
  })

  /** Receives base64 audio, transcribes with Whisper, runs bot with transcript and returns bot output. */
  app.post('/audio', async (req, reply) => {
    const body = BotAudioInputSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send(err('VALIDATION', body.error.message))

    const buffer = base64ToBuffer(body.data.audio)
    if (buffer.length === 0) return reply.code(400).send(err('VALIDATION', 'audio vazio'))
    if (buffer.length > 25 * 1024 * 1024) return reply.code(400).send(err('VALIDATION', 'Áudio muito grande. Máximo 25 MB.'))

    const text = await transcribeAudio(buffer, body.data.mimeType)
    if (!text.trim()) return reply.code(422).send(err('TRANSCRIPTION', 'Não foi possível transcrever o áudio. Tente novamente.'))

    const output = await botService.process({
      channel: 'pwa',
      sessionId: body.data.sessionId,
      text: text.trim(),
    })
    return reply.send(ok(output))
  })
}
