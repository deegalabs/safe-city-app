import { z } from 'zod'

export const BotInputSchema = z.object({
  sessionId: z.string().min(10),
  text: z.string().max(500).optional(),
  optionKey: z.string().optional(),
  optionData: z.record(z.string(), z.unknown()).optional(),
})

export type BotInput = z.infer<typeof BotInputSchema>
