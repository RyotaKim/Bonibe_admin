import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Check .env.local.')
  }

  return supabase
}

export function createIsolatedSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured. Check .env.local.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function getSupabaseStatus() {
  return supabase
    ? { configured: true, label: 'Supabase ready' }
    : { configured: false, label: 'Supabase missing' }
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}
