import type { CalendarDay, CalendarEvent, WeekAssetImpact } from '@/lib/weekCalendar'
import { scenarioText, type Outcome } from '@/lib/eventOutcome'

// El Mercado Hoy: régimen y "Lectura del día". Todo sale de las fichas y de
// los datos publicados (mismo cálculo que el drawer, el calendario y
// Volatilidad), para que la Home no se contradiga con el resto de la app.
// Reemplaza a las lecturas del motor viejo (detectMacroRegime,
// buildExecutiveSummary…), que dependían de event.direction.

export type Regime = 'Risk-on' | 'Risk-off' | 'Mixto'

/** Risk-on: NASDAQ ↑ y VIX ↓. Risk-off: NASDAQ ↓ y VIX ↑. Si no, Mixto. */
export function regimeOf(assets: WeekAssetImpact[]): Regime | null {
  const nq = assets.find(a => a.asset === 'NASDAQ')
  if (!nq) return null
  const vix = assets.find(a => a.asset === 'VIX')
  if (nq.dir === 'up' && (!vix || vix.dir !== 'up')) return vix?.dir === 'down' ? 'Risk-on' : 'Mixto'
  if (nq.dir === 'down' && (!vix || vix.dir !== 'down')) return vix?.dir === 'up' ? 'Risk-off' : 'Mixto'
  return 'Mixto'
}

export interface AssetArrow { label: string; dir: string | undefined }

const READING_ASSETS: { key: string; label: string }[] = [
  { key: 'NASDAQ', label: 'NASDAQ' },
  { key: 'USD', label: 'USD' },
  { key: 'GOLD', label: 'oro' },
]

function arrowsFor(e: CalendarEvent, outcome: Outcome): AssetArrow[] {
  const dirs = outcome === 'better' ? e.template?.assetsBeat : outcome === 'worse' ? e.template?.assetsMiss : e.template?.assetsInline
  return READING_ASSETS
    .filter(a => dirs?.[a.key])
    .map(a => ({ label: a.label, dir: dirs![a.key] }))
}

export type Reading =
  | { kind: 'post'; main: CalendarEvent; outcome: Outcome; others: CalendarEvent[]; scenario: string; arrows: AssetArrow[] }
  | { kind: 'pre'; main: CalendarEvent; better: AssetArrow[]; worse: AssetArrow[] }
  | { kind: 'empty' }

const byStars = (a: CalendarEvent, b: CalendarEvent) => b.stars - a.stars

/**
 * Lectura de un día: si ya salió el dato más importante, qué salió y qué
 * implica; si no, qué esperar según salga mejor o peor.
 */
export function dayReading(day: CalendarDay | undefined): Reading {
  if (!day) return { kind: 'empty' }
  const macro = day.events.filter(e => e.category !== 'Earnings' && e.template)
  const published = macro.filter(e => e.outcome).sort(byStars)
  const pending = macro.filter(e => !e.published).sort(byStars)

  // Si lo más importante del día todavía no salió, manda la previa.
  if (pending[0] && (!published[0] || pending[0].stars > published[0].stars)) {
    return { kind: 'pre', main: pending[0], better: arrowsFor(pending[0], 'better'), worse: arrowsFor(pending[0], 'worse') }
  }
  if (published[0]) {
    const main = published[0]
    return {
      kind: 'post', main, outcome: main.outcome!,
      others: published.slice(1, 3),
      scenario: scenarioText(main.template!, main.outcome!),
      arrows: arrowsFor(main, main.outcome!),
    }
  }
  return { kind: 'empty' }
}

// ── El Mercado Hoy: "Lo último" y "Lo que viene" ──────────────────────────

/** Lo último: el resultado más fuerte del día más reciente con datos publicados. */
export function latestResult(days: CalendarDay[]): Reading {
  const withResults = [...days].reverse().find(d => d.events.some(e => e.category !== 'Earnings' && e.template && e.outcome))
  if (!withResults) return { kind: 'empty' }
  const published = withResults.events.filter(e => e.category !== 'Earnings' && e.template && e.outcome).sort(byStars)
  const main = published[0]
  return {
    kind: 'post', main, outcome: main.outcome!,
    others: published.slice(1, 3),
    scenario: scenarioText(main.template!, main.outcome!),
    arrows: arrowsFor(main, main.outcome!),
  }
}

/**
 * Lo que viene: el próximo dato relevante (3+ estrellas) que todavía no salió,
 * en orden cronológico; si hay varios a la misma hora, el de más estrellas.
 * `days` puede incluir la semana siguiente.
 */
export function nextUp(days: CalendarDay[], today: string): Reading {
  // Solo de hoy en adelante: un dato de días anteriores sin "actual" cargado
  // no es "lo que viene", es un dato que falta cargar.
  const pending = days.flatMap(d => d.events)
    .filter(e => e.category !== 'Earnings' && e.template && !e.published && (e.event.date ?? '') >= today)
  const relevant = pending.filter(e => e.stars >= 3)
  const pool = relevant.length ? relevant : pending
  if (!pool.length) return { kind: 'empty' }
  const firstKey = (e: CalendarEvent) => `${e.event.date}${e.event.time ?? ''}`
  const earliest = pool.map(firstKey).sort()[0]
  const main = pool.filter(e => firstKey(e) === earliest).sort(byStars)[0]
  return { kind: 'pre', main, better: arrowsFor(main, 'better'), worse: arrowsFor(main, 'worse') }
}
