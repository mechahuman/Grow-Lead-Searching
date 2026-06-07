// lib/autonomous/supabase-client.ts
// Supabase client for the autonomous leads project (separate from Audit Tool)

import { createClient } from '@supabase/supabase-js'

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL
  if (!url) throw new Error('[Autonomous] NEXT_PUBLIC_AUTONOMOUS_SUPABASE_URL is not set')
  return url
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY
  if (!key) throw new Error('[Autonomous] NEXT_PUBLIC_AUTONOMOUS_SUPABASE_ANON_KEY is not set')
  return key
}

function getSupabaseServiceRoleKey(): string {
  const key = process.env.AUTONOMOUS_SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('[Autonomous] AUTONOMOUS_SUPABASE_SERVICE_ROLE_KEY is not set')
  return key
}

/**
 * Get an admin Supabase client using the service role key.
 * Use this for backend operations (saving leads, updating status, etc.)
 * Service role bypasses RLS, so only use on the server.
 */
export function getAutonomousSupabaseAdmin() {
  return createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Get a regular Supabase client using the anon key.
 * Use this for browser-safe operations (respects RLS).
 */
export function getAutonomousSupabaseClient() {
  return createClient(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  )
}
