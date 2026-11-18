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
import Consistency  from '@/pages/Consistency'
import Setups       from '@/pages/Setups'
import BusinessROI  from '@/pages/BusinessROI'
import DailyRoutine from '@/pages/DailyRoutine'
import TuHoy from '@/pages/tu/TuHoy'
import Pestanas from '@/pages/control/Pestanas'

// Entropia Control: cinco secciones. Las páginas de siempre siguen igual,
// agrupadas con pestañas; las rutas antiguas llevan a su pestaña.
const RENDIMIENTO = [
  { id: 'panel', label: 'Panel', Componente: Dashboard },
  { id: 'basico', label: 'Básico', Componente: MetrixBasic },
  { id: 'intermedio', label: 'Intermedio', Componente: MetrixAnalytics },
  { id: 'pro', label: 'Pro', Componente: MetrixLab },
  { id: 'consistencia', label: 'Consistencia', Componente: Consistency },
]
const DIARIO = [
  { id: 'calendario', label: 'Calendario', Componente: Calendar },
  { id: 'historial', label: 'Historial', Componente: Historial },
  { id: 'setups', label: 'Setups', Componente: Setups },
]
const CUENTAS = [
  { id: 'portafolio', label: 'Portafolio', Componente: Portfolio },
  { id: 'inversion', label: 'Inversión y retiros', Componente: BusinessROI },
]

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
        <Route path="/hoy"         element={<TuHoy />} />
        <Route path="/rendimiento" element={<Pestanas pestanas={RENDIMIENTO} />} />
        <Route path="/diario"      element={<Pestanas pestanas={DIARIO} />} />
        <Route path="/pulso"       element={<DailyRoutine />} />
        <Route path="/cuentas"     element={<Pestanas pestanas={CUENTAS} />} />
        <Route path="/entrenamiento" element={<Training />} />
        {/* Herramientas que siguen abiertas por enlace, fuera del menú */}
        <Route path="/mapas"        element={<Blueprints />} />
        <Route path="/approach"     element={<Approach />} />
        <Route path="/montecarlo"   element={<MonteCarlo />} />
        <Route path="/kelly"        element={<Kelly />} />
        <Route path="/rentabilidad" element={<Rentabilidad />} />
        {/* Rutas antiguas → su sitio nuevo */}
        <Route path="/inicio"   element={<Navigate to="/rendimiento?p=panel" replace />} />
        <Route path="/tu-hoy"   element={<Navigate to="/hoy" replace />} />
        <Route path="/metricas-basico"     element={<Navigate to="/rendimiento?p=basico" replace />} />
        <Route path="/metricas-intermedio" element={<Navigate to="/rendimiento?p=intermedio" replace />} />
        <Route path="/metricas-pro"        element={<Navigate to="/rendimiento?p=pro" replace />} />
        <Route path="/consistencia" element={<Navigate to="/rendimiento?p=consistencia" replace />} />
        <Route path="/calendar"     element={<Navigate to="/diario?p=calendario" replace />} />
        <Route path="/historial"    element={<Navigate to="/diario?p=historial" replace />} />
        <Route path="/setups"       element={<Navigate to="/diario?p=setups" replace />} />
        <Route path="/portafolio"   element={<Navigate to="/cuentas?p=portafolio" replace />} />
        <Route path="/roi"          element={<Navigate to="/cuentas?p=inversion" replace />} />
        <Route path="/rutina-diaria" element={<Navigate to="/pulso" replace />} />
        {/* Mentor IA se funde en Atractor (el coach está en Hoy); el Puntaje usaba datos de ejemplo */}
        <Route path="/mentor-ia"      element={<Navigate to="/hoy" replace />} />
        <Route path="/puntaje-trader" element={<Navigate to="/hoy" replace />} />
        <Route path="*"             element={<Navigate to="/hoy" replace />} />
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
        <Route path="/" element={<Navigate to="/hoy" replace />} />
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
