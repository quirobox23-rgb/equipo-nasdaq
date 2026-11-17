// fredCalendar.ts — semanas sin Forex Factory y dato real automático, con FRED.
//
// B. Semanas futuras (y pasadas sin archivo): el calendario oficial de
//    publicaciones de FRED (`fred/releases/dates`) da con meses de antelación
//    las fechas de CPI, NFP, PCE, PIB, etc. No trae previsión ni hora; la hora
//    es la habitual de cada publicación (ET). Cuando llega la semana, Forex
//    Factory la sustituye con hora y previsión. Las reuniones de la Fed no
//    están en FRED: sus fechas oficiales van en FOMC_DECISIONS.
//
// C. Dato real: cuando ya pasó la hora de una publicación y el evento no
//    tiene `actual`, se calcula desde la serie de FRED tal como se conocía ESE
//    día (ALFRED, realtime_start = realtime_end = fecha del evento). Solo se
//    usa si el último dato se publicó justo ese día, así nunca se pone el
//    dato del mes anterior por error. Nunca pisa un `actual` escrito a mano.
//    Ojo: los "m/m" se calculan desde el índice de FRED (3 decimales); en
//    algún caso raro pueden diferir en 0.1 del redondeo oficial.
//
// Nombres de eventos: los mismos de Forex Factory, para que encajen con las
// fichas (useEventTemplate).

import type { WeekEvent } from './forexFactory'

const FRED_BASE = 'https://api.stlouisfed.org/fred'

// ── C. Serie de FRED y cálculo para cada evento ────────────────────────────

type Calc = 'mom' | 'yoy' | 'diff' | 'level'
interface SeriesRule { series: string; calc: Calc; unit: '%' | 'K' | 'M'; digits: number; scale?: number }

const SERIES_BY_NAME: Record<string, SeriesRule> = {
  'CPI m/m': { series: 'CPIAUCSL', calc: 'mom', unit: '%', digits: 1 },
  'Core CPI m/m': { series: 'CPILFESL', calc: 'mom', unit: '%', digits: 1 },
  'CPI y/y': { series: 'CPIAUCSL', calc: 'yoy', unit: '%', digits: 1 },
  'Core CPI y/y': { series: 'CPILFESL', calc: 'yoy', unit: '%', digits: 1 },
  'Non-Farm Employment Change': { series: 'PAYEMS', calc: 'diff', unit: 'K', digits: 0 },
  'Unemployment Rate': { series: 'UNRATE', calc: 'level', unit: '%', digits: 1 },
  'Average Hourly Earnings m/m': { series: 'CES0500000003', calc: 'mom', unit: '%', digits: 1 },
  'Unemployment Claims': { series: 'ICSA', calc: 'level', unit: 'K', digits: 0, scale: 1 / 1000 },
  'PPI m/m': { series: 'PPIFIS', calc: 'mom', unit: '%', digits: 1 },
  'Retail Sales m/m': { series: 'RSAFS', calc: 'mom', unit: '%', digits: 1 },
  'Core Retail Sales m/m': { series: 'RSFSXMV', calc: 'mom', unit: '%', digits: 1 },
  'Core PCE Price Index m/m': { series: 'PCEPILFE', calc: 'mom', unit: '%', digits: 1 },
  'PCE Price Index m/m': { series: 'PCEPI', calc: 'mom', unit: '%', digits: 1 },
  'JOLTS Job Openings': { series: 'JTSJOL', calc: 'level', unit: 'M', digits: 2, scale: 1 / 1000 },
  'GDP q/q': { series: 'A191RL1Q225SBEA', calc: 'level', unit: '%', digits: 1 },
  'Advance GDP q/q': { series: 'A191RL1Q225SBEA', calc: 'level', unit: '%', digits: 1 },
  'Prelim GDP q/q': { series: 'A191RL1Q225SBEA', calc: 'level', unit: '%', digits: 1 },
  'Final GDP q/q': { series: 'A191RL1Q225SBEA', calc: 'level', unit: '%', digits: 1 },
}

export function seriesRuleFor(name: string): SeriesRule | null {
  return SERIES_BY_NAME[name.trim()] ?? null
}

export interface Observation { date: string; value: number; realtimeStart: string }

/**
 * Calcula el dato real a partir de las observaciones (orden cronológico) tal
 * como se conocían el día del evento. null si el último dato no se publicó
 * ese día (todavía no salió, o FRED no lo ha cargado) o faltan datos.
 */
export function computeActual(rule: SeriesRule, obs: Observation[], eventDate: string): string | null {
  if (obs.length === 0) return null
  const last = obs[obs.length - 1]
  if (last.realtimeStart !== eventDate) return null
  let v: number
  if (rule.calc === 'level') v = last.value
  else {
    const back = rule.calc === 'yoy' ? 12 : 1
    const prev = obs[obs.length - 1 - back]
    if (!prev || !prev.value) return null
    v = rule.calc === 'diff' ? last.value - prev.value : (last.value / prev.value - 1) * 100
  }
  v *= rule.scale ?? 1
  const s = v.toFixed(rule.digits)
  const clean = Number(s) === 0 ? (0).toFixed(rule.digits) : s // sin "-0.0"
  return `${clean}${rule.unit}`
}

/** Fecha y hora ET del evento → instante (aprox., ET = UTC-4/-5). */
function eventInstant(e: WeekEvent): number {
  const time = e.time && /^\d{2}:\d{2}$/.test(e.time) ? e.time : '08:30'
  // Probar los dos desfases y quedarse con el que da esa hora en Nueva York.
  for (const off of ['-04:00', '-05:00']) {
    const d = new Date(`${e.date}T${time}:00${off}`)
    const ny = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
    if (ny === time) return d.getTime()
  }
  return new Date(`${e.date}T${time}:00-05:00`).getTime()
}

async function fetchVintage(series: string, date: string, apiKey: string, recent: boolean): Promise<Observation[]> {
  const url = `${FRED_BASE}/series/observations?series_id=${series}&api_key=${apiKey}&file_type=json`
    + `&realtime_start=${date}&realtime_end=${date}&sort_order=desc&limit=15`
  try {
    // Lo de días pasados ya no cambia: se cachea un día. Lo de hoy, 10 min.
    const res = await fetch(url, { next: { revalidate: recent ? 600 : 86400 } } as RequestInit)
    if (!res.ok) return []
    const data = await res.json()
    const rows: Array<{ date: string; value: string; realtime_start: string }> = data.observations ?? []
    return rows
      .filter(r => r.value !== '.')
      .map(r => ({ date: r.date, value: parseFloat(r.value), realtimeStart: r.realtime_start }))
      .reverse()
  } catch {
    return []
  }
}

/**
 * Rellena `actual` en los eventos que ya pasaron y no lo tienen. Devuelve
 * eventos nuevos (no modifica los de entrada) y cuántos se rellenaron.
 */
export async function fillActualsFromFred(events: WeekEvent[], now = Date.now()): Promise<{ events: WeekEvent[]; filled: number }> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return { events, filled: 0 }
  let filled = 0
  const out = await Promise.all(events.map(async e => {
    if (e.actual != null && e.actual !== '') return e
    const rule = seriesRuleFor(e.name)
    if (!rule || !e.date) return e
    const at = eventInstant(e)
    if (now < at + 10 * 60 * 1000) return e // todavía no salió (margen de 10 min)
    const obs = await fetchVintage(rule.series, e.date, apiKey, now - at < 2 * 86400000)
    const actual = computeActual(rule, obs, e.date)
    if (actual == null) return e
    filled++
    return { ...e, actual }
  }))
  return { events: out, filled }
}

// ── B. Calendario de publicaciones ─────────────────────────────────────────

interface ScheduledEvent { name: string; impact: 'high' | 'med'; time: string; affects: string[] }

const CORE = ['USD', 'NQ', 'GOLD', 'VIX']
const BASIC = ['USD', 'NQ', 'GOLD']

// Publicación de FRED (por nombre) → eventos que salen ese día, con su hora habitual (ET).
const RELEASES: Array<{ match: RegExp; events: ScheduledEvent[] }> = [
  { match: /^consumer price index$/i, events: [
    { name: 'CPI m/m', impact: 'high', time: '08:30', affects: CORE },
    { name: 'Core CPI m/m', impact: 'high', time: '08:30', affects: CORE },
    { name: 'CPI y/y', impact: 'high', time: '08:30', affects: CORE },
  ] },
  { match: /^employment situation$/i, events: [
    { name: 'Non-Farm Employment Change', impact: 'high', time: '08:30', affects: CORE },
    { name: 'Unemployment Rate', impact: 'high', time: '08:30', affects: BASIC },
    { name: 'Average Hourly Earnings m/m', impact: 'high', time: '08:30', affects: BASIC },
  ] },
  { match: /^personal income and outlays$/i, events: [
    { name: 'Core PCE Price Index m/m', impact: 'high', time: '08:30', affects: CORE },
  ] },
  { match: /^gross domestic product$/i, events: [
    { name: 'GDP q/q', impact: 'high', time: '08:30', affects: CORE },
  ] },
  { match: /^producer price index$/i, events: [
    { name: 'PPI m/m', impact: 'high', time: '08:30', affects: BASIC },
  ] },
  { match: /advance monthly sales for retail/i, events: [
    { name: 'Retail Sales m/m', impact: 'high', time: '08:30', affects: BASIC },
    { name: 'Core Retail Sales m/m', impact: 'high', time: '08:30', affects: BASIC },
  ] },
  { match: /unemployment insurance weekly claims/i, events: [
    { name: 'Unemployment Claims', impact: 'high', time: '08:30', affects: BASIC },
  ] },
  { match: /job openings and labor turnover/i, events: [
    { name: 'JOLTS Job Openings', impact: 'high', time: '10:00', affects: BASIC },
  ] },
  { match: /^surveys of consumers$/i, events: [
    { name: 'UoM Consumer Sentiment', impact: 'med', time: '10:00', affects: ['USD', 'NQ'] },
  ] },
]

// Decisiones de tipos de la Fed (2.º día de cada reunión), calendario oficial
// publicado por la Fed. Añadir el año siguiente cuando la Fed lo publique.
export const FOMC_DECISIONS = [
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
]

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Convierte las fechas de publicación de FRED (y las de la Fed) en eventos de la semana. */
export function buildScheduledWeek(releaseDates: Array<{ release_name: string; date: string }>, monday: string): WeekEvent[] {
  const friday = addDays(monday, 4)
  const events: WeekEvent[] = []
  const seen = new Set<string>()
  const push = (date: string, ev: ScheduledEvent, type: WeekEvent['type']) => {
    const key = `${date}|${ev.name}`
    if (seen.has(key)) return
    seen.add(key)
    events.push({
      date, time: ev.time, country: 'USA', currency: 'USD', name: ev.name, impact: ev.impact,
      prev: null, forecast: null, actual: null, type, affects: ev.affects,
    })
  }
  for (const r of releaseDates) {
    if (r.date < monday || r.date > friday) continue
    const rel = RELEASES.find(x => x.match.test(r.release_name.trim()))
    rel?.events.forEach(ev => push(r.date, ev, 'macro'))
  }
  for (const d of FOMC_DECISIONS) {
    if (d < monday || d > friday) continue
    push(d, { name: 'Federal Funds Rate', impact: 'high', time: '14:00', affects: CORE }, 'central-bank')
    push(d, { name: 'FOMC Statement', impact: 'high', time: '14:00', affects: CORE }, 'central-bank')
    push(d, { name: 'FOMC Press Conference', impact: 'high', time: '14:30', affects: CORE }, 'central-bank')
  }
  return events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

/** Eventos previstos de la semana según el calendario de FRED + la Fed. */
export async function getFredScheduledWeek(monday: string): Promise<WeekEvent[]> {
  const apiKey = process.env.FRED_API_KEY
  let dates: Array<{ release_name: string; date: string }> = []
  if (apiKey) {
    const url = `${FRED_BASE}/releases/dates?api_key=${apiKey}&file_type=json`
      + `&realtime_start=${monday}&realtime_end=${addDays(monday, 4)}`
      + `&include_release_dates_with_no_data=true&limit=1000`
    try {
      const res = await fetch(url, { next: { revalidate: 21600 } } as RequestInit) // 6 h
      if (res.ok) dates = (await res.json()).release_dates ?? []
    } catch { /* sin FRED: solo la Fed */ }
  }
  return buildScheduledWeek(dates, monday)
}
