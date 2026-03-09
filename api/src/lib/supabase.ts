import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env['SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null
