/**
 * alertEngine.ts — Motor de alertas operativas.
 * Migrado desde macro-intelligence/src/features/alerts/alertEngine.js
 */
import type { MacroEvent, Interpretation, VerdictClass } from '@/types/macro'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  sub: string
  time: string
  actionable: boolean
}

function now(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

function minutesUntilEvent(event: MacroEvent): number | null {
  if (!event.time) return null
  const [h, m] = event.time.split(':').map(Number)
  const eventDate = new Date()
  eventDate.setHours(h, m, 0, 0)
  const diff = (eventDate.getTime() - Date.now()) / 60000
  return diff > 0 ? Math.round(diff) : null
}

function hasStrongSignal(
  interp: Interpretation,
  asset: string,
  dir: 'up' | 'down' | 'neut',
): boolean {
  return interp.signals.some(
    (s) => s.asset === asset && s.dir === dir && s.strength === 'strong',
  )
}

// Regla 1 — Evento de máximo riesgo activo
function alertMaxRisk(
  event: MacroEvent,
  interp: Interpretation,
): Alert | null {
  if (interp.verdictClass !== 'no-trade') return null
  return {
    id: 'max-risk',
    severity: 'critical',
    title: '⊗ ZONA DE NO OPERAR',
    sub: `${event.name}: ${interp.verdictSub}`,
    time: now(),
    actionable: false,
  }
}

// Regla 2 — NQ bearish fuerte
function alertNQBearish(
  event: MacroEvent,
  interp: Interpretation,
): Alert | null {
  if (!hasStrongSignal(interp, 'NQ', 'down')) return null
  return {
    id: 'nq-bearish',
    severity: 'critical',
    title: '▼ NQ BAJISTA — Señal fuerte',
    sub: `${event.name} presiona NQ a la baja. Evita largos.`,
    time: now(),
    actionable: true,
  }
}

// Regla 3 — USD alcista fuerte
function alertUSDStrong(
  event: MacroEvent,
  interp: Interpretation,
): Alert | null {
  if (!hasStrongSignal(interp, 'USD', 'up')) return null
  return {
    id: 'usd-strong',
    severity: 'warning',
    title: '▲ USD FUERTE — Posible presión en NQ',
    sub: `${event.name} refuerza el dólar. Monitor DXY.`,
    time: now(),
    actionable: true,
  }
}

// Regla 4 — Refugio seguro activado (GOLD alcista fuerte)
function alertSafeHaven(
  event: MacroEvent,
  interp: Interpretation,
): Alert | null {
  if (!hasStrongSignal(interp, 'GOLD', 'up')) return null
  if (interp.context !== 'risk-off') return null
  return {
    id: 'safe-haven',
    severity: 'warning',
    title: '◆ FLUJO A REFUGIO SEGURO',
    sub: 'Oro al alza + risk-off confirmado. Posible reducción de riesgo.',
    time: now(),
    actionable: true,
  }
}

// Regla 5 — Cuenta atrás pre-evento
function alertCountdown(event: MacroEvent): Alert | null {
  if (event.direction && event.direction !== 'pending') return null
  const mins = minutesUntilEvent(event)
  if (mins === null || mins > 60 || mins < 0) return null
  const severity: AlertSeverity = mins <= 15 ? 'critical' : 'warning'
  return {
    id: 'countdown',
    severity,
    title: `⏱ ${event.name} en ${mins} min`,
    sub: mins <= 15
      ? 'Cierra posiciones abiertas o protege con stops.'
      : 'Evita nuevas entradas. Prepara el plan de acción.',
    time: now(),
    actionable: true,
  }
}

// Regla 6 — Oportunidad de trade confirmada
function alertTradeSetup(
  event: MacroEvent,
  interp: Interpretation,
): Alert | null {
  if (interp.verdictClass !== 'trade') return null
  if (event.direction === 'pending') return null
  return {
    id: 'trade-setup',
    severity: 'info',
    title: '◉ SETUP ACTIVO — Condiciones favorables',
    sub: `${event.name}: ${interp.verdictSub}`,
    time: now(),
    actionable: true,
  }
}

// Regla 7 — Sesgo ambiguo (caution)
function alertMonitor(
  event: MacroEvent,
  interp: Interpretation,
): Alert | null {
  if (interp.verdictClass !== 'caution') return null
  if (event.direction === 'pending') return null
  return {
    id: 'monitor',
    severity: 'info',
    title: '◈ MONITOREAR — Confirma antes de entrar',
    sub: `${event.name}: espera confirmación técnica.`,
    time: now(),
    actionable: true,
  }
}

// Regla 8 — Día de eventos múltiples de alto impacto
function alertCombinedDay(allEvents: MacroEvent[]): Alert | null {
  const highToday = allEvents.filter(
    (e) => e.impact === 'high' && e.direction === 'pending',
  )
  if (highToday.length < 2) return null
  const names = highToday
    .slice(0, 2)
    .map((e) => e.name)
    .join(' + ')
  return {
    id: 'combined-day',
    severity: 'warning',
    title: '⚠ DÍA DE EVENTOS MÚLTIPLES',
    sub: `${names} pendientes. Volatilidad elevada. Gestión de riesgo activa.`,
    time: now(),
    actionable: false,
  }
}

// Motor principal
export function generateAlerts(
  event: MacroEvent | null,
  interp: Interpretation | null,
  allEvents: MacroEvent[],
): Alert[] {
  const alerts: Alert[] = []

  // Alerta combinada de día (independiente del evento seleccionado)
  const combined = alertCombinedDay(allEvents)
  if (combined) alerts.push(combined)

  if (!event || !interp) return alerts

  // Alertas dependientes del evento seleccionado
  const rules = [
    alertCountdown(event),
    alertMaxRisk(event, interp),
    alertNQBearish(event, interp),
    alertUSDStrong(event, interp),
    alertSafeHaven(event, interp),
    alertTradeSetup(event, interp),
    alertMonitor(event, interp),
  ]

  for (const a of rules) {
    if (a) alerts.push(a)
  }

  return alerts
}
