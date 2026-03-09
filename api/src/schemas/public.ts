import { z } from 'zod'

export const CheckinSchema = z.object({
  partner_id: z.string(),
  fingerprint: z.string().min(10),
})

export const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  zones: z.array(z.string()).min(1).max(10),
})

export type CheckinInput = z.infer<typeof CheckinSchema>
export type SubscribeInput = z.infer<typeof SubscribeSchema>
