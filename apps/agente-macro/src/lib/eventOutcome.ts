import type { MacroEvent } from '@/types/macro'
import type { EventTemplate } from '@/hooks/useEventTemplate'

// Helpers del rediseño de Eventos Económicos (drawer + calendario).
// Ver docs/plan-rediseno-eventos.md.

export type Outcome = 'better' | 'inline' | 'worse'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  better: 'Mejor',
  inline: 'En línea',
  worse: 'Peor',
}

// "7.271M", "199K", "3.6%", "$3.05", "-0.2" → número. Actual y pronóstico
// vienen en la misma unidad, así que alcanza con comparar el valor numérico.
function parseValue(v: string | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Mejor / En línea / Peor que el pronóstico.
 * 1. Si el evento trae `direction` (beat / miss / in-line), manda eso.
 * 2. Si no, compara `actual` contra `forecast`. `betterWhen` de la ficha dice
 *    qué lado es "mejor" (default "higher"; "lower" en Jobless Claims, desempleo).
 * Devuelve null si el dato todavía no salió o no se puede comparar.
 */
export function eventOutcome(event: MacroEvent, template: EventTemplate | null): Outcome | null {
  if (event.direction === 'beat') return 'better'
  if (event.direction === 'miss') return 'worse'
  if (event.direction === 'in-line') return 'inline'

  const actual = parseValue(event.actual)
  const forecast = parseValue(event.forecast)
  if (actual === null || forecast === null) return null
  if (actual === forecast) return 'inline'
  const higherIsBetter = (template?.betterWhen ?? 'higher') === 'higher'
  return (actual > forecast) === higherIsBetter ? 'better' : 'worse'
}

export function isPublished(event: MacroEvent): boolean {
  return event.actual != null && event.actual !== ''
}

const IMPACT_STARS: Record<string, number> = { high: 4, med: 3, low: 1 }

/**
 * Estrellas (1–5), criterio del analista. Orden: ajuste puntual de la semana
 * (`event.stars`) → ficha (`template.stars`) → default desde el impacto,
 * mientras las fichas no tengan estrellas cargadas.
 */
export function eventStars(event: MacroEvent, template: EventTemplate | null): number {
  return event.stars ?? template?.stars ?? IMPACT_STARS[event.impact ?? ''] ?? 1
}

/**
 * Texto corto del escenario (Mejor / En línea / Peor) de una ficha.
 * Usa scenarioShort* si existe; si no, limpia el texto largo:
 * "NFP BEAT (…) → A → B → USD alcista ↑, …" queda en "A → B"
 * (sin la etiqueta del escenario ni la lista de activos).
 */
export function scenarioText(t: EventTemplate, c: Outcome): string {
  const short = c === 'better' ? t.scenarioShortBetter : c === 'inline' ? t.scenarioShortInline : t.scenarioShortWorse
  if (short) return short
  const long = (c === 'better' ? t.scenarioPositive : c === 'inline' ? t.scenarioNeutral : t.scenarioNegative) ?? ''
  const parts = long.split('→').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return long
  const chain = parts.slice(1).filter(p => !/[↑↓]/.test(p))
  return chain.length ? chain.join(' → ').replace(/\.$/, '') : long
}
