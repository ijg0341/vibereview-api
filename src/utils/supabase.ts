import { createClient } from '@supabase/supabase-js'
import type { Env } from '../types/env.js'
import type { Database } from '../types/database.js'

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null

export function initSupabase(env: Env) {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  return supabaseClient
}

export function getSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.')
  }
  return supabaseClient
}