// ─────────────────────────────────────────────
//  AUTH STORE — sesión de Supabase + perfil server-side
//
//  Sustituye a la parte de licenseSlice de useStore.js que vivía
//  100% en el cliente (tier, csvImportedCount, testerCode). Ahora
//  esos datos viven en la tabla `profiles` de Supabase y este store
//  es solo un espejo en memoria de lo que dice el servidor — nunca
//  la fuente de verdad.
//
//  `status`: 'loading' | 'signed-out' | 'signed-in'
// ─────────────────────────────────────────────

import { create } from 'zustand'
import { supabase, isSupabaseConfigured, isRecoveryLink } from '@/lib/supabaseClient'

export const useAuthStore = create((set, get) => ({
  status: 'loading',
  session: null,
  user: null,
  profile: null,     // { id, email, tier, csv_imported_count, tester_code, ... }
  authError: null,
  // true cuando se entra desde el enlace de "recuperar contraseña" del
  // email: AuthGate muestra entonces la pantalla de nueva contraseña.
  recovering: false,

  // Llamar una vez al montar App(). Se suscribe a cambios de sesión
  // (login/logout en otra pestaña, expiración de token, etc.).
  initAuth: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'signed-out' })
      return
    }

    if (isRecoveryLink) set({ recovering: true })

    const { data: { session } } = await supabase.auth.getSession()
    await get()._applySession(session)

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') set({ recovering: true })
      get()._applySession(session)
    })
  },

  _applySession: async (session) => {
    if (!session) {
      set({ status: 'signed-out', session: null, user: null, profile: null })
      return
    }
    set({ session, user: session.user })
    await get().refreshProfile()
    set({ status: 'signed-in' })
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (error) {
      console.error('[Auth] Error cargando perfil:', error.message)
      return
    }
    set({ profile: data })
  },

  signUp: async (email, password) => {
    set({ authError: null })
    const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: import.meta.env.VITE_SITE_URL ?? window.location.origin
  }
})
    if (error) { set({ authError: error.message }); return false }
    return true
  },

  signIn: async (email, password) => {
    set({ authError: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { set({ authError: error.message }); return false }
    return true
  },

  // Manda el email de "recuperar contraseña". El enlace vuelve a esta
  // misma web (develop o main), que tiene que estar en Supabase →
  // Authentication → URL Configuration → Redirect URLs.
  sendPasswordReset: async (email) => {
    set({ authError: null })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    })
    if (error) { set({ authError: error.message }); return false }
    return true
  },

  updatePassword: async (password) => {
    set({ authError: null })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { set({ authError: error.message }); return false }
    set({ recovering: false })
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    return true
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ status: 'signed-out', session: null, user: null, profile: null })
  },

  // Reemplaza a la vieja activateTester() de features.js: el código
  // se valida DENTRO de la función SQL activate_tester_code(), nunca
  // en el cliente, así que ya no hay lista de códigos en el bundle.
  activateTesterCode: async (code) => {
    const { data, error } = await supabase.rpc('activate_tester_code', { input_code: code })
    if (error || !data) return false
    await get().refreshProfile()
    return true
  },

  incrementCsvImport: async (amount) => {
    const { error } = await supabase.rpc('increment_csv_import', { amount })
    if (error) { console.error('[Auth] Error actualizando contador CSV:', error.message); return }
    await get().refreshProfile()
  },
}))

// ── Selector hooks (mismo patrón que useStore.js) ──
export const useAuthStatus  = () => useAuthStore((s) => s.status)
export const useAuthUser    = () => useAuthStore((s) => s.user)
export const useProfile     = () => useAuthStore((s) => s.profile)
export const useTier        = () => useAuthStore((s) => s.profile?.tier ?? 'free')
export const useCsvImportedCount = () => useAuthStore((s) => s.profile?.csv_imported_count ?? 0)
export const useIsTester    = () => useAuthStore((s) => (s.profile?.tier ?? '').startsWith('tester-'))
