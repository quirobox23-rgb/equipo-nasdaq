/** Shared macro domain types (Vite → Next migration). */

export type EventDirection =
  | 'beat'
  | 'miss'
  | 'in-line'
  | 'pending'
  | 'hawkish'
  | 'dovish'

export type EventImpact = 'high' | 'med' | 'low'

export type VerdictClass = 'trade' | 'no-trade' | 'caution'

export type MarketContextRegime = 'risk-on' | 'risk-off' | 'neutral'

export type SignalDirection = 'up' | 'down' | 'neut'

export type SignalStrength = 'strong' | 'moderate' | 'weak'

export interface MacroSignal {
  asset: 'USD' | 'NQ' | 'GOLD' | string
  dir: SignalDirection
  reason: string
  strength: SignalStrength
}

export interface Interpretation {
  verdict: string
  verdictClass: VerdictClass
  verdictIcon: string
  verdictSub: string
  signals: MacroSignal[]
  context: MarketContextRegime
  note: string
}

export interface MacroEvent {
  id?: number | string
  time?: string
  name: string
  impact?: EventImpact
  affects?: string[]
  forecast?: string | number | null
  actual?: string | number | null
  prev?: string | number | null
  direction?: EventDirection
  currency?: string
  // Añadido para el proveedor de datos basado en JSON semanal (opcional,
  // no rompe nada de lo existente — MOCK_EVENTS sigue siendo válido tal cual).
  date?: string      // YYYY-MM-DD
  country?: string
  type?: 'macro' | 'earnings' | 'central-bank' | 'speech' | 'other'
  // Rediseño de Eventos (opcionales): ajuste de estrellas solo para esta
  // semana, y forzar este evento como el del día clave.
  stars?: number
  keyDay?: boolean
  // Earnings (Fase 3, desde Finnhub): facturación estimada / real, ya formateada.
  revenueEstimate?: string | null
  revenueActual?: string | null
}

export type InterpretationRule = Omit<Interpretation, never>

export type EventRuleSet = Partial<Record<EventDirection, InterpretationRule>>

export type InterpretationRules = Record<string, EventRuleSet>
