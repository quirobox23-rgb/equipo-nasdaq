// ─────────────────────────────────────────────
//  SUPABASE CLIENT — punto único de conexión al backend
//
//  Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env.
//  Ver .env.example. La anon key es pública por diseño (Supabase):
//  la seguridad real la da Row Level Security en supabase/schema.sql,
//  no el secreto de esta key.
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // No tiramos la app (permite seguir desarrollando la UI sin backend
  // conectado), pero avisamos fuerte en consola — un olvido de .env
  // no debería parecer "no hay trades" silenciosamente.
  console.error(
    '[Supabase] Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env.local y rellena tus credenciales del proyecto Supabase.'
  )
}

// El enlace de "recuperar contraseña" llega con type=recovery en la URL.
// Se lee aquí, antes de crear el cliente, porque el cliente limpia la
// URL al leer la sesión del enlace.
export const isRecoveryLink = typeof window !== 'undefined' &&
  (window.location.hash + window.location.search).includes('type=recovery')

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const isSupabaseConfigured = Boolean(url && anonKey)
