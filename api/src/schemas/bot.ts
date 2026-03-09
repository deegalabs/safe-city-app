import { z } from 'zod'

export const BotInputSchema = z.object({
  sessionId: z.string().min(10),
  text: z.string().max(500).optional(),
  optionKey: z.string().optional(),
  optionData: z.record(z.string(), z.unknown()).optional(),
})

export type BotInput = z.infer<typeof BotInputSchema>

/** Body for POST /api/bot/audio: sessionId + audio in base64 (data URL or raw). Groq limit 25MB. */
const MAX_AUDIO_B64_LENGTH = 34_000_000 // ~25MB decoded
export const BotAudioInputSchema = z.object({
  sessionId: z.string().min(10),
  audio: z.string().min(1).max(MAX_AUDIO_B64_LENGTH),
  mimeType: z.string().optional(),
})
export type BotAudioInput = z.infer<typeof BotAudioInputSchema>
