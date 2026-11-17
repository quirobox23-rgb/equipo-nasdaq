/**
 * narrativeEngine.ts — Motor de Narrativa Semanal (Sprint 1).
 *
 * Construye el contexto macro general de la semana a partir de los
 * MacroEvent ya existentes (mockEvents / custom events). No usa IA
 * generativa: todo es reglas sobre datos ya presentes en la app
 * (impact, direction, forecast, actual, affects).
 *
 * No modifica ningún engine existente: es una capa de lectura por
 * encima de la información ya calculada en page.tsx.
 */
import type { MacroEvent, EventDirection } from '@/types/macro'

export type WeeklyState = 'bullish' | 'neutral' | 'bearish'

export interface StarEvent {
  event: MacroEvent
  stars: number // 5 · 4 · 3
  role: 'principal' | 'secundario' | 'riesgo'
}

export interface WeeklyNarrative {
  state: WeeklyState
  stateLabel: string
  stateEmoji: string
  confidence: number // 0-100
  narrative: string[] // 3-5 líneas
  keyEvents: StarEvent[]
}

const IMPACT_WEIGHT: Record<string, number> = { high: 3, med: 1, low: 0.3 }

// Direcciones que "cuentan" como señal (positiva o negativa) para el
// sesgo semanal. in-line/pending no aportan sesgo.
const BULLISH_DIRECTIONS: EventDirection[] = ['beat', 'dovish']
const BEARISH_DIRECTIONS: EventDirection[] = ['miss', 'hawkish']

function isResolved(e: MacroEvent): boolean {
  return !!e.direction && e.direction !== 'pending'
}

/**
 * Sesgo semanal ponderado por impacto: eventos "beat"/"dovish" suman,
 * "miss"/"hawkish" restan. Con esto se deriva el estado y, según lo
 * concentrado que esté el resultado, la confianza.
 */
function computeWeeklyBias(events: MacroEvent[]) {
  const resolved = events.filter(isResolved)
  let score = 0
  let maxScore = 0

  resolved.forEach(e => {
    const w = IMPACT_WEIGHT[e.impact ?? 'low'] ?? 0
    maxScore += w
    if (BULLISH_DIRECTIONS.includes(e.direction!)) score += w
    else if (BEARISH_DIRECTIONS.includes(e.direction!)) score -= w
  })

  return { score, maxScore, resolvedCount: resolved.length, totalCount: events.length }
}

function classifyState(score: number, maxScore: number): { state: WeeklyState; label: string; emoji: string } {
  const ratio = maxScore > 0 ? score / maxScore : 0
  if (ratio > 0.2) return { state: 'bullish', label: 'Alcista', emoji: '🟢' }
  if (ratio < -0.2) return { state: 'bearish', label: 'Bajista', emoji: '🔴' }
  return { state: 'neutral', label: 'Neutral', emoji: '🟡' }
}

/**
 * Confianza: combina cuántos eventos ya tienen resultado (más datos
 * resueltos = más confianza) con lo unidireccional que es la señal
 * (todos apuntando al mismo lado = más confianza).
 */
function computeConfidence(bias: ReturnType<typeof computeWeeklyBias>): number {
  const { score, maxScore, resolvedCount, totalCount } = bias
  if (totalCount === 0) return 0

  const completeness = resolvedCount / totalCount // 0-1
  const conviction = maxScore > 0 ? Math.abs(score) / maxScore : 0 // 0-1

  const confidence = 35 + completeness * 30 + conviction * 35
  return Math.round(Math.min(100, Math.max(0, confidence)))
}

/**
 * Selecciona los 3 eventos clave de la semana por impacto:
 * ★★★★★ principal · ★★★★ catalizador secundario · ★★★ riesgo adicional.
 */
function selectKeyEvents(events: MacroEvent[]): StarEvent[] {
  const sorted = [...events].sort((a, b) => (IMPACT_WEIGHT[b.impact ?? 'low'] ?? 0) - (IMPACT_WEIGHT[a.impact ?? 'low'] ?? 0))
  const roles: StarEvent['role'][] = ['principal', 'secundario', 'riesgo']
  const stars = [5, 4, 3]
  return sorted.slice(0, 3).map((event, i) => ({ event, stars: stars[i], role: roles[i] }))
}

/** Activo más mencionado entre los eventos que ya aportaron señal (bullish o bearish). */
function dominantAsset(events: MacroEvent[]): string | null {
  const counts: Record<string, number> = {}
  events.filter(isResolved).forEach(e => {
    if (BULLISH_DIRECTIONS.includes(e.direction!) || BEARISH_DIRECTIONS.includes(e.direction!)) {
      (e.affects ?? []).forEach(a => { counts[a] = (counts[a] ?? 0) + 1 })
    }
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] ?? null
}

/**
 * Narrativa de 3-5 líneas, construida por reglas (sin IA) a partir de
 * lo que ya se sabe de la semana: eventos resueltos (y su sesgo),
 * eventos pendientes de mayor impacto, y el activo dominante.
 */
function buildNarrativeLines(
  bias: ReturnType<typeof computeWeeklyBias>,
  keyEvents: StarEvent[],
  asset: string | null,
): string[] {
  const lines: string[] = []
  const principal = keyEvents.find(k => k.role === 'principal')
  const secundario = keyEvents.find(k => k.role === 'secundario')

  const resolvedBullish = bias.score > 0
  const resolvedBearish = bias.score < 0

  if (bias.resolvedCount === 0) {
    lines.push('Todavía no hay resultados publicados esta semana: el mercado opera a la espera de los próximos catalizadores.')
  } else if (resolvedBullish) {
    lines.push('Los datos publicados esta semana han sorprendido en el lado favorable al riesgo, reforzando el apetito comprador.')
  } else if (resolvedBearish) {
    lines.push('Los datos publicados esta semana han decepcionado, alimentando cautela y demanda de activos refugio.')
  } else {
    lines.push('Los datos publicados esta semana se han mantenido en línea con lo esperado, sin un sesgo claro.')
  }

  if (asset) {
    lines.push(
      resolvedBullish
        ? `El contexto actual sigue favoreciendo a ${asset}.`
        : resolvedBearish
          ? `La presión reciente afecta especialmente a ${asset}.`
          : `${asset} sigue siendo el activo más sensible a las próximas publicaciones.`,
    )
  }

  if (principal) {
    lines.push(`${principal.event.name}${principal.event.time ? ` (${principal.event.time} ET)` : ''} será el principal catalizador de la semana.`)
  }

  if (secundario) {
    lines.push(`${secundario.event.name} actuará como catalizador secundario y podría matizar la lectura del dato principal.`)
  }

  return lines.slice(0, 5)
}

/**
 * generateWeeklyNarrative — punto de entrada del motor.
 * Recibe los eventos de la semana (ya existentes en la app) y
 * devuelve el estado, confianza, narrativa y eventos clave.
 */
export function generateWeeklyNarrative(weekEvents: MacroEvent[]): WeeklyNarrative {
  const bias = computeWeeklyBias(weekEvents)
  const { state, label, emoji } = classifyState(bias.score, bias.maxScore)
  const confidence = computeConfidence(bias)
  const keyEvents = selectKeyEvents(weekEvents)
  const asset = dominantAsset(weekEvents)
  const narrative = buildNarrativeLines(bias, keyEvents, asset)

  return {
    state,
    stateLabel: label,
    stateEmoji: emoji,
    confidence,
    narrative,
    keyEvents,
  }
}
