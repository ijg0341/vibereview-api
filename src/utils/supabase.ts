import { createClient } from '@supabase/supabase-js'
import type { Env } from '../types/env.js'
import type { Database } from '../types/database.js'

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null
let supabaseAuthClient: ReturnType<typeof createClient<Database>> | null = null

export function initSupabase(env: Env) {
  if (!supabaseClient) {
    // 서버 작업용 (데이터베이스 CRUD)
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
    
    // 인증 전용 (로그인/회원가입)
    supabaseAuthClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
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

export function getSupabaseAuth() {
  if (!supabaseAuthClient) {
    throw new Error('Supabase auth client not initialized. Call initSupabase() first.')
  }
  return supabaseAuthClient
}