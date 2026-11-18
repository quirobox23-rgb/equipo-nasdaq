import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import '@/styles/responsive.css'
import AppShell     from '@/components/layout/AppShell'
import { useStore } from '@/store/useStore'
import { useAuthStore, useAuthStatus } from '@/store/useAuthStore'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import AuthGate from '@/components/auth/AuthGate'
import { useSessionReview } from '@/hooks/useSessionReview'
import SessionReviewModal from '@/components/sessionReview/SessionReviewModal'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import Hero         from '@/pages/Hero'
import Home         from '@/pages/Home'
import Dashboard    from '@/pages/Dashboard'
import MetrixBasic  from '@/pages/MetrixBasic'
import MetrixAnalytics from '@/pages/MetrixAnalytics'
import MetrixLab    from '@/pages/MetrixLab'
import Training     from '@/pages/Training'
import Blueprints   from '@/pages/Blueprints'
import Portfolio    from '@/pages/Portfolio'
import Historial    from '@/pages/Historial'
import Approach     from '@/pages/Approach'
import Calendar     from '@/pages/Calendar'
import MonteCarlo   from '@/pages/MonteCarlo'
import Kelly        from '@/pages/Kelly'
import Rentabilidad from '@/pages/Rentabilidad'
import IaMentor     from '@/pages/IaMentor'
import Consistency  from '@/pages/Consistency'
import Setups       from '@/pages/Setups'
import TraderScore  from '@/pages/TraderScore'
import BusinessROI  from '@/pages/BusinessROI'
import DailyRoutine from '@/pages/DailyRoutine'
import TuHoy from '@/pages/tu/TuHoy'

// Todas las rutas de la aplicación (idénticas a como estaban, mismo
// orden, mismos componentes) viven ahora dentro de AppShell. Es el
// mismo bloque de siempre, solo movido a su propio componente para
// poder tener el Hero como pantalla de entrada sin sidebar.
function AppRoutes() {
  return (
    <AuthGate>
      <AppShell>
      <Routes>
        <Route path="/home"         element={<Home />} />
        <Route path="/inicio"    element={<Dashboard />} />
        <Route path="/tu-hoy"    element={<TuHoy />} />
        <Route path="/metricas-basico" element={<MetrixBasic />} />
        <Route path="/metricas-intermedio" element={<MetrixAnalytics />} />
        <Route path="/metricas-pro" element={<MetrixLab />} />
        <Route path="/entrenamiento"     element={<Training />} />
        <Route path="/mapas"   element={<Blueprints />} />
        <Route path="/portafolio"    element={<Portfolio />} />
        <Route path="/historial"    element={<Historial />} />
        <Route path="/approach"     element={<Approach />} />
        <Route path="/calendar"     element={<Calendar />} />
        <Route path="/montecarlo"   element={<MonteCarlo />} />
        <Route path="/kelly"        element={<Kelly />} />
        <Route path="/rentabilidad" element={<Rentabilidad />} />
        <Route path="/mentor-ia"           element={<IaMentor />} />
        <Route path="/consistencia"  element={<Consistency />} />
        <Route path="/setups"       element={<Setups />} />
        <Route path="/puntaje-trader" element={<TraderScore />} />
        <Route path="/roi" element={<BusinessROI />} />
        <Route path="/rutina-diaria" element={<DailyRoutine />} />
        <Route path="*"             element={<Navigate to="/inicio" replace />} />
      </Routes>
      </AppShell>
    </AuthGate>
  )
}

export default function App() {
  const theme    = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  // Auth — arranca la sesión de Supabase una sola vez al montar.
  const initAuth = useAuthStore((s) => s.initAuth)
  const authStatus = useAuthStatus()
  const loadUserDataFromServer = useStore((s) => s.loadUserDataFromServer)
  const resetToLocalDemo = useStore((s) => s.resetToLocalDemo)

  useEffect(() => {
    if (isSupabaseConfigured) initAuth()
  }, [])

  // En cuanto hay sesión, sustituye los datos demo (mockTrades /
  // mockAccounts) por los reales del usuario desde Supabase. Al
  // cerrar sesión, vuelve al demo local (para que el Hero público
  // siga teniendo algo que mostrar).
  useEffect(() => {
    if (authStatus === 'signed-in') loadUserDataFromServer()
    if (authStatus === 'signed-out') resetToLocalDemo()
  }, [authStatus])

  // Inicializar tema: localStorage → 'dark' (no depende de la
  // preferencia del sistema — la app arranca siempre en oscuro salvo
  // que el usuario ya haya elegido un tema).
  useEffect(() => {
    const saved = localStorage.getItem('agente-metricas-theme')
    setTheme(saved || 'dark')
  }, [])

  // Sincronizar data-theme en el DOM cuando cambia
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Session Review Agent — resumen automático de sesión, sin
  // necesidad de navegar a /ia (ver hooks/useSessionReview.js)
  const { shouldShow, todayTrades, metrics, dismiss } = useSessionReview()

  // Onboarding — detección de primera visita (se ejecuta una sola
  // vez al montar la app). No se muestra si ya se completó, si se
  // saltó hace menos de 7 días, o si el usuario ya tiene trades.
  const startOnboarding = useOnboardingStore(s => s.start)
  useEffect(() => {
    const completed = localStorage.getItem('nova-onboarding-completed')
    if (completed) return

    const skippedAt = localStorage.getItem('nova-onboarding-skipped-at')
    if (skippedAt) {
      const daysSince = (Date.now() - new Date(skippedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) return
    }

    if (useStore.getState().trades.length === 0) startOnboarding()
  }, [])

  return (
    <>
      <Routes>
        {/* Hero desactivado (2026-10-07): la landing pública vive en
            la web de venta y la entrada a la app es la
            pantalla de acceso de AuthGate. "/" manda a /inicio: sin sesión
            muestra el login, con sesión entra directo al Dashboard.
            No se borra por si hace falta volver:
        <Route path="/" element={<Hero />} /> */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
      {shouldShow && (
        <SessionReviewModal todayTrades={todayTrades} metrics={metrics} onClose={dismiss} />
      )}
      <OnboardingModal />
      <InstallPrompt />
    </>
  )
}
