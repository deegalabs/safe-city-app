import type { FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma'
import { supabase } from '../lib/supabase'

export interface AdminUser {
  id: string
  role: string
  partner_id: string | null
  email: string
  nome: string
  active: boolean
}

export interface RequestWithAdmin extends FastifyRequest {
  admin: AdminUser
}

export async function requireAdmin(req: FastifyRequest): Promise<void> {
  if (!supabase) throw { statusCode: 503, message: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env' }
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) throw { statusCode: 401, message: 'Token required' }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw { statusCode: 401, message: 'Invalid token' }

  const admin = await prisma.admin.findUnique({ where: { email: user.email ?? '' } })
  if (!admin || !admin.active) throw { statusCode: 403, message: 'Access denied' }

  ;(req as RequestWithAdmin).admin = admin as AdminUser
}

export async function requireSuperAdmin(req: FastifyRequest): Promise<void> {
  await requireAdmin(req)
  const admin = (req as RequestWithAdmin).admin
  if (admin.role !== 'superadmin') throw { statusCode: 403, message: 'Superadmins only' }
}

export function getAdmin(req: FastifyRequest): AdminUser {
  return (req as RequestWithAdmin).admin
}
