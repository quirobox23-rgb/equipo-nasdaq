/**
 * marketContextEngine.ts — Motor de contexto de mercado.
 * Migrado desde macro-intelligence/src/features/marketContext/marketContextEngine.js
 */
import type { MacroEvent, Interpretation, MarketContextRegime } from '@/types/macro'

export interface RegimeInfo {
  label: string
  flow: string
  volatility: 'alta' | 'moderada' | 'baja'
  color: 'risk-on' | 'risk-off' | 'neutral'
}

export interface MarketContext {
  regime: MarketContextRegime
  label: string
  flow: string
  volatility: 'alta' | 'moderada' | 'baja'
  dayScore: number
  pendingHighImpact: number
  sessionWarning: boolean
}

export const REGIME_MAP: Record<MarketContextRegime, RegimeInfo> = {
  'risk-on': {
    label: 'Risk-ON',
    flow: 'Capital hacia activos de riesgo: NQ, acciones, commodities',
    volatility: 'moderada',
    color: 'risk-on',
  },
  'risk-off': {
    label: 'Risk-OFF',
    flow: 'Capital hacia refugios: USD, Oro, bonos del Tesoro',
    volatility: 'alta',
    color: 'risk-off',
  },
  neutral: {
    label: 'Neutral',
    flow: 'Sin dirección clara. Mercado a la espera de catalizadores.',
    volatility: 'baja',
    color: 'neutral',
  },
}

// Pesos de impacto para el score diario
const IMPACT_WEIGHTS: Record<string, number> = {
  high: 3,
  med: 1,
  low: 0.3,
}

export function computeDayRiskScore(events: MacroEvent[]): number {
  return events.reduce((score, e) => {
    const weight = IMPACT_WEIGHTS[e.impact ?? 'low'] ?? 0
    return score + weight
  }, 0)
}

// Determina régimen final combinando interpretación + score diario
export function computeMarketContext(
  interp: Interpretation | null,
  allEvents: MacroEvent[],
): MarketContext {
  const dayScore = computeDayRiskScore(allEvents)
  const pendingHighImpact = allEvents.filter(
    (e) => e.impact === 'high' && (!e.direction || e.direction === 'pending'),
  ).length

  // Régimen base desde la interpretación actual
  let regime: MarketContextRegime = interp?.context ?? 'neutral'

  // Si el score es muy alto y hay eventos de alto impacto pendientes, elevar a risk-off
  if (pendingHighImpact >= 2 && regime === 'neutral') {
    regime = 'risk-off'
  }

  // Si hay un evento de no-trade activo, forzar risk-off
  if (interp?.verdictClass === 'no-trade') {
    regime = 'risk-off'
  }

  const info = REGIME_MAP[regime]

  // Advertencia de sesión: score alto + mercado NY abierto
  const hour = new Date().toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/New_York',
  })
  const nyHour = parseInt(hour)
  const sessionWarning = nyHour >= 8 && nyHour <= 10 && dayScore >= 3

  return {
    regime,
    label: info.label,
    flow: info.flow,
    volatility: pendingHighImpact >= 2 ? 'alta' : info.volatility,
    dayScore: Math.round(dayScore * 10) / 10,
    pendingHighImpact,
    sessionWarning,
  }
}
