import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY!
  )
}
