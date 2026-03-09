import { z } from 'zod'

export const CreateReportSchema = z.object({
  tipo: z.enum(['furto', 'violencia', 'assedio', 'suspeito', 'infra']),
  urgencia: z.enum(['alta', 'media', 'baixa']),
  local: z.string().min(2).max(100),
  zone_id: z.string().min(1).max(100),
  retrato: z.record(z.string(), z.unknown()).optional(),
  extra: z.string().max(500).optional(),
  fingerprint: z.string().min(10),
  channel: z.enum(['pwa', 'whatsapp']).default('pwa'),
})

export const ConfirmReportSchema = z.object({
  fingerprint: z.string().min(10),
})

export type CreateReportInput = z.infer<typeof CreateReportSchema>
export type ConfirmReportInput = z.infer<typeof ConfirmReportSchema>
