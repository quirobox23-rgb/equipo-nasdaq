import type { MacroEvent } from '@/types/macro'
import { findEventTemplate, type EventTemplate } from '@/hooks/useEventTemplate'
import { eventOutcome, eventStars, isPublished, type Outcome } from '@/lib/eventOutcome'

// Lógica compartida del calendario de Eventos (vista Semana y Tabla) y, más
// adelante, de Volatilidad (V3): estrellas por día, día clave y temas.
// La regla del día clave vive acá para que las dos pantallas no se contradigan.
// Ver docs/plan-rediseno-eventos.md.

export interface CalendarEvent {
  event: MacroEvent
  template: EventTemplate | null
  stars: number
  published: boolean
  outcome: Outcome | null
  /** Dirección del NASDAQ si el dato sale mejor / peor (desde la ficha). */
  nq: { better?: string; worse?: string } | null
  category: Category
}

export interface CalendarDay {
  date: string          // YYYY-MM-DD
  events: CalendarEvent[]
  /** Estrellas del día = las del evento más fuerte. */
  stars: number
}

export type Category = 'Inflación' | 'Empleo' | 'Crecimiento' | 'Fed' | 'Earnings' | 'Vencimientos' | 'Otros'

// Mismas palabras clave que categorizeEvent de VisualCalendar.
export function categorize(event: MacroEvent): Category {
  if (event.type === 'earnings') return 'Earnings'
  const n = event.name.toUpperCase()
  if (/VENCIMIENTO|OPEX|ROLL DE FUTUROS/.test(n)) return 'Vencimientos'
  if (/CPI|PPI|PCE|INFLA/.test(n)) return 'Inflación'
  if (/PAYROLL|NFP|EMPLEO|JOBLESS|UNEMPLOYMENT|ADP|JOLTS|HOURLY EARNINGS/.test(n)) return 'Empleo'
  if (/EARNINGS|EPS|REVENUE/.test(n)) return 'Earnings'
  if (/GDP|RETAIL SALES|ISM|PMI|DURABLE GOODS|FACTORY ORDERS|CONSUMER CONFIDENCE|INDUSTRIAL PRODUCTION|SPENDING/.test(n)) return 'Crecimiento'
  if (/FOMC|FED|POWELL|WARSH|RATE DECISION|DOT PLOT|JACKSON HOLE/.test(n)) return 'Fed'
  return 'Otros'
}

export function toCalendarEvent(event: MacroEvent): CalendarEvent {
  const template = findEventTemplate(event.name)
  const published = isPublished(event)
  const nq = template && (template.assetsBeat?.NASDAQ || template.assetsMiss?.NASDAQ)
    ? { better: template.assetsBeat?.NASDAQ, worse: template.assetsMiss?.NASDAQ }
    : null
  return {
    event,
    template,
    stars: eventStars(event, template),
    published,
    outcome: published ? eventOutcome(event, template) : null,
    nq,
    category: categorize(event),
  }
}

// Earnings traen "Pre-market" / "Post-cierre" en vez de hora: se ordenan
// al principio y al final del día.
function sortTime(time?: string): string {
  if (!time) return '99:99'
  if (/^pre/i.test(time)) return '00:00'
  if (/^post/i.test(time)) return '23:59'
  if (/sesi/i.test(time)) return '12:00'
  return time
}

export function buildDays(events: MacroEvent[], dates: string[]): CalendarDay[] {
  return dates.map(date => {
    const dayEvents = events
      .filter(e => e.date === date)
      .map(toCalendarEvent)
      .sort((a, b) => sortTime(a.event.time).localeCompare(sortTime(b.event.time)))
    return { date, events: dayEvents, stars: Math.max(0, ...dayEvents.map(e => e.stars)) }
  })
}

/**
 * Día clave: uno solo por semana.
 * 1. Si un evento trae `keyDay: true` en el JSON de la semana, ese día manda.
 * 2. Si no, gana el día con el evento de más estrellas. Empate → el que tenga
 *    más eventos del nivel más alto, después del siguiente, etc. Así muchos
 *    eventos de 1 estrella nunca le ganan a uno solo de un nivel más alto.
 */
export function keyDayOf(days: CalendarDay[]): string | null {
  const forced = days.find(d => d.events.some(e => e.event.keyDay))
  if (forced) return forced.date
  // Los vencimientos no deciden el día clave (lo deciden los datos y earnings).
  const counts = (d: CalendarDay) => [5, 4, 3, 2, 1].map(n => d.events.filter(e => e.stars === n && e.category !== 'Vencimientos').length)
  const ranked = days
    .filter(d => d.events.some(e => e.category !== 'Vencimientos'))
    .sort((a, b) => {
      const ca = counts(a), cb = counts(b)
      for (let i = 0; i < ca.length; i++) if (ca[i] !== cb[i]) return cb[i] - ca[i]
      return 0
    })
  return ranked[0]?.date ?? null
}

/** Temas de la semana: categorías de los eventos relevantes (3+ estrellas),
 *  de mayor a menor peso (suma de estrellas). El primero es el tema principal. */
export function weekThemes(days: CalendarDay[]): Category[] {
  const weight = new Map<Category, number>()
  days.forEach(d => d.events.forEach(e => {
    if (e.stars >= 3 && e.category !== 'Otros' && e.category !== 'Earnings' && e.category !== 'Vencimientos') weight.set(e.category, (weight.get(e.category) ?? 0) + e.stars)
  }))
  return [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
}

export const RELEVANT_STARS = 3

// ── Earnings de Finnhub → eventos del calendario ─────────────────────────
interface EarningsLike {
  symbol: string; date: string; hour: string
  epsEstimate: number | null; epsActual?: number | null
  revenueEstimate?: number | null; revenueActual?: number | null
}

const HOUR_LABEL: Record<string, string> = { bmo: 'Pre-market', amc: 'Post-cierre', dmh: 'En sesión' }

function money(n: number | null | undefined, digits = 2): string | null {
  if (n == null) return null
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(digits)}`
}

/**
 * Convierte los earnings de /api/earnings?set=extended en eventos y descarta
 * los que ya estén cargados a mano en el JSON de la semana (misma empresa,
 * mismo día) — el JSON manda.
 */
export function earningsToEvents(items: EarningsLike[], weekEvents: MacroEvent[]): MacroEvent[] {
  return items.flatMap(item => {
    const template = findEventTemplate(`(${item.symbol})`)
    const duplicated = weekEvents.some(e =>
      e.date === item.date && categorize(e) === 'Earnings' && template && findEventTemplate(e.name) === template)
    if (duplicated) return []
    return [{
      name: template?.name ?? item.symbol,
      date: item.date,
      time: HOUR_LABEL[item.hour] ?? undefined,
      type: 'earnings' as const,
      impact: 'high' as const,
      forecast: money(item.epsEstimate),
      actual: money(item.epsActual),
      prev: null,
      revenueEstimate: money(item.revenueEstimate),
      revenueActual: money(item.revenueActual),
      affects: ['NQ'],
    }]
  })
}

/** "MU (mié, post-cierre)" para el resumen de la semana. */
export function earningsLabel(e: CalendarEvent, weekday: string): string {
  const ticker = e.template?.ticker ?? e.event.name
  return `${ticker} (${weekday}${e.event.time && !/^\d/.test(e.event.time) ? `, ${e.event.time.toLowerCase()}` : ''})`
}

// ── Impacto esperado en activos (Volatilidad, pestaña "La semana") ───────
// Se calcula desde las fichas, igual que la matriz del drawer: cada evento
// publicado con resultado aporta, por activo, la dirección que su ficha le
// asigna para ese resultado (assetsBeat / assetsMiss), ponderada por sus
// estrellas. Reemplaza a computeExpectedAssetImpact en esa pestaña: ese motor
// solo reconoce nombres exactos de eventos y, si no, le pone la misma flecha
// a todos los activos.

export interface WeekAssetImpact {
  asset: string
  label: string
  dir: 'up' | 'down' | 'neut'
  impact: 'Alta' | 'Media' | 'Baja'
  /** % del peso de los eventos que empuja en la dirección resultante. */
  conviction: number
  /** Eventos con resultado que afectan a este activo. */
  count: number
}

const IMPACT_ASSETS: { key: string; label: string }[] = [
  { key: 'NASDAQ', label: 'NASDAQ' },
  { key: 'SPX', label: 'S&P 500' },
  { key: 'USD', label: 'USD' },
  { key: 'GOLD', label: 'ORO' },
  { key: 'VIX', label: 'VIX' },
  { key: 'TLT', label: 'Bonos (TLT)' },
]

export function weekAssetImpact(days: CalendarDay[]): WeekAssetImpact[] {
  const items = days.flatMap(d => d.events).filter(e => e.outcome && e.outcome !== 'inline' && e.template)
  return IMPACT_ASSETS.flatMap(({ key, label }) => {
    let up = 0, down = 0, count = 0
    items.forEach(e => {
      const dirs = e.outcome === 'better' ? e.template!.assetsBeat : e.template!.assetsMiss
      const dir = dirs?.[key]
      if (!dir) return
      count++
      if (dir === 'up') up += e.stars
      else if (dir === 'down') down += e.stars
    })
    if (count === 0) return []
    const total = up + down
    const net = total ? (up - down) / total : 0
    const dir = net > 0.15 ? 'up' : net < -0.15 ? 'down' : 'neut'
    const strength = Math.abs(net)
    return [{
      asset: key, label, dir, count,
      impact: strength >= 0.6 ? 'Alta' : strength >= 0.25 ? 'Media' : 'Baja',
      conviction: total ? Math.round((Math.max(up, down) / total) * 100) : 0,
    } as WeekAssetImpact]
  })
}
