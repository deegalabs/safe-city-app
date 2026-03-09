import { z } from 'zod'

export const ReportStatusSchema = z.object({
  status: z.enum(['ativo', 'confirmado', 'critico', 'expirado', 'removido']),
})

const timeRegex = /^\d{2}:\d{2}$/
const dayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

export const PartnerCreateSchema = z.object({
  nome: z.string().min(2),
  slug: z.string().min(2),
  lat: z.number(),
  lng: z.number(),
  zone_id: z.string(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
  responsavel: z.string().optional(),
  status: z.enum(['seguro', 'atencao', 'fechado']).default('seguro'),
  type: z.enum(['bar', 'pharmacy', 'store', 'other']).default('other'),
  open_time: z.string().regex(timeRegex).optional(),
  close_time: z.string().regex(timeRegex).optional(),
  open_days: z.array(dayEnum).optional(),
})

export const PartnerPatchSchema = z.object({
  nome: z.string().optional(),
  status: z.enum(['seguro', 'atencao', 'fechado']).optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
  responsavel: z.string().optional(),
  active: z.boolean().optional(),
  type: z.enum(['bar', 'pharmacy', 'store', 'other']).optional(),
  open_time: z.string().regex(timeRegex).optional(),
  close_time: z.string().regex(timeRegex).optional(),
  open_days: z.array(dayEnum).optional(),
})

export const AdminCreateSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(['superadmin', 'parceiro']).default('parceiro'),
  partner_id: z.string().optional(),
})

export const AdminPatchSchema = z.object({
  nome: z.string().optional(),
  role: z.enum(['superadmin', 'parceiro']).optional(),
  partner_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
})

export const ReportsQuerySchema = z.object({
  status: z.string().optional(),
  zone: z.string().optional(),
  page: z.string().default('1'),
  limit: z.string().default('20'),
})

export const AuditQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('50'),
  admin_id: z.string().optional(),
})

export type ReportStatusInput = z.infer<typeof ReportStatusSchema>
export type PartnerCreateInput = z.infer<typeof PartnerCreateSchema>
export type PartnerPatchInput = z.infer<typeof PartnerPatchSchema>
export type AdminCreateInput = z.infer<typeof AdminCreateSchema>
export type AdminPatchInput = z.infer<typeof AdminPatchSchema>
export type ReportsQuery = z.infer<typeof ReportsQuerySchema>
export type AuditQuery = z.infer<typeof AuditQuerySchema>
