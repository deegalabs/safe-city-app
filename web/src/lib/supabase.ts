import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined
const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined

/** Só existe quando as variáveis estão configuradas no .env (Realtime opcional em dev). */
export const supabase: SupabaseClient | null =
  url && key && url.length > 0 && key.length > 0
    ? createClient(url, key)
    : null
