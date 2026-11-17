import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import '@/styles/responsive.css'
import AppShell     from '@/components/layout/AppShell'
import { useStore } from '@/store/useStore'
import { useSessionReview } from '@/hooks/useSessionReview'
import SessionReviewModal from '@/components/sessionReview/SessionReviewModal'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import Hero         from '@/pages/Hero'
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

// Todas las rutas de la aplicación (idénticas a como estaban, mismo
// orden, mismos componentes) viven ahora dentro de AppShell. Es el
// mismo bloque de siempre, solo movido a su propio componente para
// poder tener el Hero como pantalla de entrada sin sidebar.
function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/metrix-basic" element={<MetrixBasic />} />
        <Route path="/metrix-medium" element={<MetrixAnalytics />} />
        <Route path="/metrix-advance" element={<MetrixLab />} />
        <Route path="/training"     element={<Training />} />
        <Route path="/blueprints"   element={<Blueprints />} />
        <Route path="/portfolio"    element={<Portfolio />} />
        <Route path="/historial"    element={<Historial />} />
        <Route path="/approach"     element={<Approach />} />
        <Route path="/calendar"     element={<Calendar />} />
        <Route path="/montecarlo"   element={<MonteCarlo />} />
        <Route path="/kelly"        element={<Kelly />} />
        <Route path="/rentabilidad" element={<Rentabilidad />} />
        <Route path="/ia"           element={<IaMentor />} />
        <Route path="/consistency"  element={<Consistency />} />
        <Route path="/setups"       element={<Setups />} />
        <Route path="/trader-score" element={<TraderScore />} />
        <Route path="/business-roi" element={<BusinessROI />} />
        <Route path="/daily-routine" element={<DailyRoutine />} />
        <Route path="*"             element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  const theme    = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  // Inicializar tema: localStorage → preferencia del sistema → 'dark'
  useEffect(() => {
    const saved = localStorage.getItem('agente-metricas-theme')
    if (saved) {
      setTheme(saved)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
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
        <Route path="/" element={<Hero />} />
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
