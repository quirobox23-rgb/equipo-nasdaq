import { NextResponse } from 'next/server'

// /api/market-data — datos reales para la pantalla Volatilidad (/mercado).
//
// Fuentes:
//   VIX → Yahoo Finance (^VIX, casi en vivo, ~15 min de retraso); si Yahoo
//     falla, FRED (VIXCLS, cierre del día anterior)
//   Fear & Greed → índice de CNN (fuente no oficial, sin key; si falla o CNN
//     la bloquea, viene con `available: false`, nunca un número inventado)
//   Curva de tipos → FRED
//   DXY, ATR, rangos diario/semanal/mensual (NQ) → Yahoo Finance (histórico
//     OHLC público, sin key)
//
// v3: lo que antes era "ATM diario/semanal" (que necesitaría opciones en
// vivo, no disponible gratis) se sustituyó por RANGOS HISTÓRICOS reales:
// cuánto se movió NQ el último día/semana/mes completos (máximo - mínimo),
// más la media de esos rangos en los últimos periodos — así se puede decir
// "con este histórico, un movimiento de X puntos sería habitual", que es
// justo lo que se pidió. Se calcula sobre el mismo histórico OHLC que ya
// se usa para el ATR, sin ninguna fuente nueva.
//
// Nada se inventa: si Yahoo falla, cada bloque viene con `available: false`.

const FRED_URL = 'https://api.stlouisfed.org/fred/series/observations'
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

interface SeriesResult {
  available: boolean
  history: number[]
  dates: string[]
  last: number | null
}

async function fetchFredSeries(seriesId: string, limit = 30): Promise<SeriesResult> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return { available: false, history: [], dates: [], last: null }
  const url = `${FRED_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { available: false, history: [], dates: [], last: null }
    const data = await res.json()
    const observations: Array<{ date: string; value: string }> = data.observations ?? []
    const valid = observations.filter(o => o.value !== '.')
    if (valid.length === 0) return { available: false, history: [], dates: [], last: null }
    const chronological = [...valid].reverse()
    return {
      available: true,
      history: chronological.map(o => parseFloat(o.value)),
      dates: chronological.map(o => o.date),
      last: parseFloat(valid[0].value),
    }
  } catch {
    return { available: false, history: [], dates: [], last: null }
  }
}

async function fetchYahooCloses(ticker: string, days = 30): Promise<SeriesResult> {
  try {
    const res = await fetch(`${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?range=3mo&interval=1d`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return { available: false, history: [], dates: [], last: null }
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const timestamps: number[] = result?.timestamp ?? []
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? []
    if (timestamps.length === 0 || closes.length === 0) return { available: false, history: [], dates: [], last: null }
    const pairs = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] }))
      .filter(p => p.close != null) as Array<{ date: string; close: number }>
    const lastN = pairs.slice(-days)
    if (lastN.length === 0) return { available: false, history: [], dates: [], last: null }
    return {
      available: true,
      history: lastN.map(p => Math.round(p.close * 100) / 100),
      dates: lastN.map(p => p.date),
      last: Math.round(lastN[lastN.length - 1].close * 100) / 100,
    }
  } catch {
    return { available: false, history: [], dates: [], last: null }
  }
}

// Igual que fetchYahooCloses, pero también devuelve la hora del último
// precio (regularMarketTime): durante la sesión la última vela diaria es la
// de hoy y su "cierre" es el precio actual.
async function fetchYahooLive(ticker: string, days = 30): Promise<SeriesResult & { updatedAt: string | null }> {
  try {
    const res = await fetch(`${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?range=3mo&interval=1d`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return { available: false, history: [], dates: [], last: null, updatedAt: null }
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const timestamps: number[] = result?.timestamp ?? []
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? []
    const pairs = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] }))
      .filter(p => p.close != null) as Array<{ date: string; close: number }>
    // Si el precio en vivo es más nuevo que la última vela, se usa ese.
    const livePrice: number | undefined = result?.meta?.regularMarketPrice
    const liveTime: number | undefined = result?.meta?.regularMarketTime
    if (livePrice != null && liveTime != null && pairs.length > 0) {
      const liveDate = new Date(liveTime * 1000).toISOString().slice(0, 10)
      const lastPair = pairs[pairs.length - 1]
      if (lastPair.date === liveDate) lastPair.close = livePrice
      else if (liveDate > lastPair.date) pairs.push({ date: liveDate, close: livePrice })
    }
    const lastN = pairs.slice(-days)
    if (lastN.length === 0) return { available: false, history: [], dates: [], last: null, updatedAt: null }
    return {
      available: true,
      history: lastN.map(p => Math.round(p.close * 100) / 100),
      dates: lastN.map(p => p.date),
      last: Math.round(lastN[lastN.length - 1].close * 100) / 100,
      updatedAt: liveTime != null ? new Date(liveTime * 1000).toISOString() : null,
    }
  } catch {
    return { available: false, history: [], dates: [], last: null, updatedAt: null }
  }
}

// Fear & Greed de CNN. Endpoint público pero no oficial: responde 418 si la
// petición no parece de un navegador, por eso las cabeceras.
const CNN_FG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'

interface FearGreedResult extends SeriesResult { rating: string | null; updatedAt: string | null }

async function fetchFearGreed(days = 30): Promise<FearGreedResult> {
  const empty: FearGreedResult = { available: false, history: [], dates: [], last: null, rating: null, updatedAt: null }
  try {
    const res = await fetch(CNN_FG_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://edition.cnn.com/',
        'Origin': 'https://edition.cnn.com',
      },
    })
    if (!res.ok) return empty
    const data = await res.json()
    const current = data?.fear_and_greed
    const points: Array<{ x: number; y: number }> = data?.fear_and_greed_historical?.data ?? []
    // Un valor por día (el último de cada día).
    const byDate = new Map<string, number>()
    for (const p of points) {
      if (typeof p?.x !== 'number' || typeof p?.y !== 'number') continue
      byDate.set(new Date(p.x).toISOString().slice(0, 10), p.y)
    }
    const score = typeof current?.score === 'number' ? current.score : null
    const updatedAt = current?.timestamp ? new Date(current.timestamp).toISOString() : null
    if (score != null) byDate.set((updatedAt ?? new Date().toISOString()).slice(0, 10), score)
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-days)
    if (sorted.length === 0) return empty
    return {
      available: true,
      history: sorted.map(([, v]) => Math.round(v)),
      dates: sorted.map(([d]) => d),
      last: Math.round(sorted[sorted.length - 1][1]),
      rating: typeof current?.rating === 'string' ? current.rating : null,
      updatedAt,
    }
  } catch {
    return empty
  }
}

interface DailyBar { date: string; high: number; low: number; close: number }

async function fetchNQDailyBars(range: string): Promise<DailyBar[] | null> {
  try {
    const res = await fetch(`${YAHOO_CHART_URL}/NQ=F?range=${range}&interval=1d`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const timestamps: number[] = result?.timestamp ?? []
    const quote = result?.indicators?.quote?.[0]
    if (!quote?.high || !quote?.low || !quote?.close || timestamps.length === 0) return null

    const bars: DailyBar[] = []
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.high[i] == null || quote.low[i] == null || quote.close[i] == null) continue
      bars.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
      })
    }
    return bars.length > 0 ? bars : null
  } catch {
    return null
  }
}

/** ATR(14) sobre velas diarias. */
function computeAtr(bars: DailyBar[], period = 14): number | null {
  if (bars.length < period + 1) return null
  const trueRanges: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    )
    trueRanges.push(tr)
  }
  const lastPeriod = trueRanges.slice(-period)
  return Math.round((lastPeriod.reduce((a, b) => a + b, 0) / lastPeriod.length) * 100) / 100
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7 // lunes=0
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM
}

interface RangeStat { available: boolean; lastRangePts: number | null; lastRangePct: number | null; avgRangePts: number | null; periodLabel: string | null }

/** Agrupa velas diarias por semana o por mes y calcula el rango (máximo-mínimo) de cada grupo. */
function computeGroupedRanges(bars: DailyBar[], keyFn: (date: string) => string): { key: string; high: number; low: number }[] {
  const groups = new Map<string, { high: number; low: number }>()
  for (const bar of bars) {
    const key = keyFn(bar.date)
    const g = groups.get(key)
    if (!g) groups.set(key, { high: bar.high, low: bar.low })
    else { g.high = Math.max(g.high, bar.high); g.low = Math.min(g.low, bar.low) }
  }
  return [...groups.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key))
}

function buildRangeStat(bars: DailyBar[], keyFn: (d: string) => string, avgCount: number): RangeStat {
  const grouped = computeGroupedRanges(bars, keyFn)
  if (grouped.length < 2) return { available: false, lastRangePts: null, lastRangePct: null, avgRangePts: null, periodLabel: null }

  // El último grupo está en curso si la próxima sesión (o la actual) cae en
  // la misma semana/mes; si no, ya terminó y es el último periodo completo.
  // Antes se descartaba siempre, y el fin de semana "Semanal" mostraba la
  // semana anterior a la que acababa de cerrar.
  const inProgress = grouped[grouped.length - 1].key === keyFn(nextSessionDate())
  const completed = inProgress ? grouped.slice(0, -1) : grouped
  const last = completed[completed.length - 1]
  const lastRange = Math.round((last.high - last.low) * 100) / 100
  const refPrice = last.low // referencia para el %, aproximada pero razonable

  const avgWindow = completed.slice(-avgCount)
  const avgRange = avgWindow.length > 0
    ? Math.round((avgWindow.reduce((sum, g) => sum + (g.high - g.low), 0) / avgWindow.length) * 100) / 100
    : null

  return {
    available: true,
    lastRangePts: lastRange,
    lastRangePct: refPrice ? Math.round((lastRange / refPrice) * 10000) / 100 : null,
    avgRangePts: avgRange,
    periodLabel: last.key,
  }
}

/** Fecha (YYYY-MM-DD) de la sesión de CME en curso, o null si el mercado está
 *  cerrado. La sesión de un día va de 18:00 ET del día anterior a 17:00 ET
 *  (la del lunes arranca el domingo a las 18:00), con pausa de 17 a 18. */
function sessionInProgress(now = new Date()): string | null {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const h = et.getHours()
  if (h === 17) return null
  if (h >= 18) et.setDate(et.getDate() + 1)
  const dow = et.getDay()
  if (dow === 0 || dow === 6) return null
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, '0')}-${String(et.getDate()).padStart(2, '0')}`
}

/** Fecha de la sesión en curso o, con el mercado cerrado, de la próxima
 *  (no contempla feriados). */
function nextSessionDate(now = new Date()): string {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  if (et.getHours() >= 17) et.setDate(et.getDate() + 1)
  while (et.getDay() === 0 || et.getDay() === 6) et.setDate(et.getDate() + 1)
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, '0')}-${String(et.getDate()).padStart(2, '0')}`
}

function buildDailyRangeStat(bars: DailyBar[], avgCount: number): RangeStat {
  if (bars.length < 2) return { available: false, lastRangePts: null, lastRangePct: null, avgRangePts: null, periodLabel: null }
  // La última vela se descarta solo si es la sesión en curso. Antes se
  // descartaba siempre, y con el mercado cerrado (fin de semana, después de
  // las 17 ET) "ayer" mostraba el día anterior al último cerrado.
  const inProgress = bars[bars.length - 1].date === sessionInProgress()
  const completed = inProgress ? bars.slice(0, -1) : bars
  const last = completed[completed.length - 1]
  const lastRange = Math.round((last.high - last.low) * 100) / 100
  const avgWindow = completed.slice(-avgCount)
  const avgRange = avgWindow.length > 0
    ? Math.round((avgWindow.reduce((s, b) => s + (b.high - b.low), 0) / avgWindow.length) * 100) / 100
    : null
  return {
    available: true,
    lastRangePts: lastRange,
    lastRangePct: last.low ? Math.round((lastRange / last.low) * 10000) / 100 : null,
    avgRangePts: avgRange,
    periodLabel: last.date,
  }
}

export async function GET() {
  const [vixLive, vixFred, fearGreed, dxy, dgs10, dgs2, spread, bars6mo] = await Promise.all([
    fetchYahooLive('^VIX', 30),
    fetchFredSeries('VIXCLS', 30),
    fetchFearGreed(30),
    fetchYahooCloses('DX-Y.NYB', 30),
    fetchFredSeries('DGS10', 5),
    fetchFredSeries('DGS2', 5),
    fetchFredSeries('T10Y2Y', 5),
    fetchNQDailyBars('6mo'),
  ])

  // VIX casi en vivo de Yahoo; si falla, el cierre de ayer de FRED.
  const vix = vixLive.available && vixLive.history.length >= 2
    ? { ...vixLive, source: 'yahoo' as const }
    : { ...vixFred, updatedAt: null, source: 'fred' as const }

  const atr = bars6mo ? { available: true, value: computeAtr(bars6mo, 14), period: 14 } : { available: false, value: null, period: 14 }

  const daily = bars6mo ? buildDailyRangeStat(bars6mo, 20) : { available: false, lastRangePts: null, lastRangePct: null, avgRangePts: null, periodLabel: null }
  const weekly = bars6mo ? buildRangeStat(bars6mo, isoWeekKey, 8) : { available: false, lastRangePts: null, lastRangePct: null, avgRangePts: null, periodLabel: null }
  const monthly = bars6mo ? buildRangeStat(bars6mo, monthKey, 6) : { available: false, lastRangePts: null, lastRangePct: null, avgRangePts: null, periodLabel: null }

  return NextResponse.json({
    vix,
    fear_greed: fearGreed,
    dxy,
    yield_curve: {
      available: dgs10.available && dgs2.available,
      dgs10: dgs10.last,
      dgs2: dgs2.last,
      spread: spread.available ? spread.last : (dgs10.last != null && dgs2.last != null ? Math.round((dgs10.last - dgs2.last) * 100) / 100 : null),
    },
    atr_nq: atr,
    // Rangos históricos reales de NQ — sustituyen al antiguo "ATM" (que
    // necesitaría opciones en vivo). "Último periodo completo" + media de
    // los últimos N periodos, para poder decir "un movimiento de X pts
    // sería habitual" basado en el histórico, no en una expectativa de opciones.
    ranges_nq: { daily, weekly, monthly },
    // Rango (máximo − mínimo) de cada día de las últimas ~6 semanas, para el
    // calendario de Eventos ("Rango NQ 622 pts · 1.4× la media"). La media es
    // la misma del bloque diario. El calendario solo lo muestra en días ya
    // cerrados (la vela de hoy puede estar en curso).
    // Semana en curso (lunes a hoy; si ya terminó, la semana completa):
    // máximo − mínimo de sus velas diarias, contra la media semanal.
    current_week_nq: (() => {
      if (!bars6mo?.length) return { available: false, rangePts: null, rangePct: null, avgRangePts: null, from: null, to: null, days: 0 }
      const key = isoWeekKey(bars6mo[bars6mo.length - 1].date)
      const week = bars6mo.filter(b => isoWeekKey(b.date) === key)
      const high = Math.max(...week.map(b => b.high)), low = Math.min(...week.map(b => b.low))
      return {
        available: true,
        rangePts: Math.round((high - low) * 100) / 100,
        rangePct: low ? Math.round(((high - low) / low) * 10000) / 100 : null, // mismo criterio que lastRangePct
        avgRangePts: weekly.avgRangePts,
        from: week[0].date,
        to: week[week.length - 1].date,
        days: week.length,
      }
    })(),
    daily_ranges_nq: {
      available: !!bars6mo,
      avgRangePts: daily.avgRangePts,
      days: (bars6mo ?? []).slice(-30).map(b => ({ date: b.date, rangePts: Math.round((b.high - b.low) * 100) / 100 })),
    },
  })
}
