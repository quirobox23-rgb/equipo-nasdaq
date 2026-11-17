// Recoge los datos reales de la semana para el Análisis Semanal de NQ.
// Fuentes que ya usa la app: calendario (archivo de semana o Forex Factory),
// earnings (Finnhub), bonos y VIX (FRED) y precio de NQ (Yahoo Finance).
// Nada se inventa: si una fuente no responde, se anota en `avisos`.

import { promises as fs } from 'fs'
import path from 'path'
import { getForexFactoryWeek } from '@/lib/forexFactory'
import { addDays, expirations, weekLabel } from './dates'
import { proposeLevels, previousWeeks, type DailyBar } from './levels'
import type { WeeklyData } from './types'

// Empresas con más peso en el Nasdaq 100 (más que la lista de la Home).
export const NQ_EARNINGS_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'NFLX', 'COST',
  'AMD', 'ADBE', 'PEP', 'QCOM', 'INTC', 'TXN', 'AMAT', 'LRCX', 'MU', 'ASML',
  'TSM', 'CSCO', 'INTU', 'ISRG', 'KLAC', 'PANW', 'IBM', 'ORCL', 'CRM',
]

const FRED_SERIES: { id: string; nombre: string }[] = [
  { id: 'DGS10',   nombre: 'Treasury 10 años (%)' },
  { id: 'DGS2',    nombre: 'Treasury 2 años (%)' },
  { id: 'T10Y2Y',  nombre: 'Curva 10 años - 2 años (pp)' },
  { id: 'VIXCLS',  nombre: 'VIX' },
]

async function readWeekFile(monday: string) {
  try {
    const file = path.join(process.cwd(), 'src', 'data', 'weeks', `week_${monday}.json`)
    const data = JSON.parse(await fs.readFile(file, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function getEvents(monday: string): Promise<WeeklyData['events']> {
  const fromFile = await readWeekFile(monday)
  const raw = fromFile.length > 0 ? fromFile : await getForexFactoryWeek(monday)
  return raw
    .filter((e: { impact?: string }) => e.impact === 'high' || e.impact === 'med')
    .map((e: { date: string; time?: string; name: string; impact?: string }) =>
      ({ date: e.date, time: e.time, name: e.name, impact: e.impact }))
}

async function getEarnings(monday: string): Promise<WeeklyData['earnings'] | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${monday}&to=${addDays(monday, 4)}&token=${key}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    const all: { symbol: string; date: string; hour: string }[] = data.earningsCalendar ?? []
    return all
      .filter(e => NQ_EARNINGS_TICKERS.includes(e.symbol))
      .map(e => ({ symbol: e.symbol, date: e.date, hour: e.hour }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return null
  }
}

async function getFred(id: string): Promise<{ ultimo: number | null; cambioSemana: number | null; fecha: string | null } | null> {
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=15`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    const obs: { date: string; value: string }[] = (data.observations ?? []).filter((o: { value: string }) => o.value !== '.')
    if (obs.length === 0) return null
    const ultimo = parseFloat(obs[0].value)
    const hace5 = obs[5] ? parseFloat(obs[5].value) : null
    return {
      ultimo,
      cambioSemana: hace5 == null ? null : Math.round((ultimo - hace5) * 100) / 100,
      fecha: obs[0].date,
    }
  } catch {
    return null
  }
}

async function getNqBars(): Promise<DailyBar[] | null> {
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?range=6mo&interval=1d', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const ts: number[] = result?.timestamp ?? []
    const q = result?.indicators?.quote?.[0]
    if (!q || ts.length === 0) return null
    const bars: DailyBar[] = []
    ts.forEach((t, i) => {
      if (q.high[i] == null || q.low[i] == null || q.close[i] == null) return
      bars.push({ date: new Date(t * 1000).toISOString().slice(0, 10), high: q.high[i], low: q.low[i], close: q.close[i] })
    })
    return bars.length ? bars : null
  } catch {
    return null
  }
}

export async function getWeeklyData(monday: string): Promise<WeeklyData> {
  const avisos: string[] = []
  const [events, earnings, bars, ...fred] = await Promise.all([
    getEvents(monday),
    getEarnings(monday),
    getNqBars(),
    ...FRED_SERIES.map(s => getFred(s.id)),
  ])

  if (events.length === 0) avisos.push('Calendario macro sin datos (Forex Factory publica la semana nueva el domingo).')
  if (earnings == null) avisos.push('Earnings no disponibles (Finnhub no respondió o falta FINNHUB_API_KEY).')
  if (bars == null) avisos.push('Precio de NQ no disponible (Yahoo Finance no respondió).')
  if (fred.every(f => f == null)) avisos.push('Bonos y VIX no disponibles (FRED no respondió o falta FRED_API_KEY).')

  let nq: WeeklyData['nq'] = { precio: null, fecha: null, semanaAnterior: null, rangoMedioSemanal: null }
  if (bars) {
    const last = bars[bars.length - 1]
    const weeks = previousWeeks(bars, monday, 8)
    const ranges = weeks.map(w => Math.max(...w.map(b => b.high)) - Math.min(...w.map(b => b.low)))
    const prev = weeks[0]
    nq = {
      precio: Math.round(last.close),
      fecha: last.date,
      semanaAnterior: prev
        ? {
            alto: Math.round(Math.max(...prev.map(b => b.high))),
            bajo: Math.round(Math.min(...prev.map(b => b.low))),
            cierre: Math.round(prev[prev.length - 1].close),
          }
        : null,
      rangoMedioSemanal: ranges.length ? Math.round(ranges.reduce((s, r) => s + r, 0) / ranges.length) : null,
    }
  }

  return {
    monday,
    semana: weekLabel(monday),
    events,
    earnings: earnings ?? [],
    opex: expirations(monday),
    macro: FRED_SERIES.map((s, i) => ({
      serie: s.id,
      nombre: s.nombre,
      ultimo: fred[i]?.ultimo ?? null,
      cambioSemana: fred[i]?.cambioSemana ?? null,
      fecha: fred[i]?.fecha ?? null,
    })),
    nq,
    nivelesPropuestos: bars ? proposeLevels(bars, monday) : [],
    avisos,
  }
}
