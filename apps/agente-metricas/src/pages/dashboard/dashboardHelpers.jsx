// ─────────────────────────────────────────────
//  DASHBOARD · Helpers
//  Constantes, cálculo de estadísticas y sub-componentes visuales
//  puros usados por src/pages/Dashboard.jsx.
//  Extraído de Dashboard.jsx para reducir su tamaño — misma lógica,
//  cero cambios de comportamiento.
// ─────────────────────────────────────────────
import { IconCircle, Sparkline } from '@/components/ui'
import { tradeDollar, sumTradeDollars } from '@/lib/tradeDollar'
import { groupIntoOperations } from '@/lib/operations'

// ── Tooltip style ─────────────────────────────
export const TT = {
  background: 'rgba(16,20,30,0.92)',
  border: '1px solid var(--border2)',
  borderRadius: 10,
  fontSize: 11,
  color: 'var(--text)',
  boxShadow: 'var(--shadow)',
  padding: '9px 13px',
  backdropFilter: 'blur(8px)',
}

// ── Filter groups ─────────────────────────────
export const FILTER_GROUPS = [
  { value: 'all',       label: 'Global',    type: 'scope'  },
  { value: 'Challenge', label: 'Challenge', type: 'type'   },
  { value: 'Funded',    label: 'Funded',    type: 'type'   },
  { value: 'Personal',  label: 'Capital real', type: 'type'   },
  { value: 'active',    label: 'Activo',    type: 'status' },
  { value: 'approved',  label: 'Aprobada',  type: 'status' },
  { value: 'lost',      label: 'Perdida',   type: 'status' },
]

// ── Resultados por día ────────────────────────
// Suma el resultado de cada día (fecha del trade) y saca los promedios
// de los días en verde y en rojo. Para quien promedia, un día refleja
// mejor la operativa que cada fila del CSV (decisión de Santos: primera
// unidad útil = Por día). Hoy "día" = fecha calendario del trade; cuando
// exista el trading day de 18:00 ET se usará esa fecha.
// Devuelve "días" con la misma forma mínima que un trade (date, dollarPnl,
// rPnl) para reutilizar los mismos componentes (MiniSquares, MetricDisplay).
export function computeDailyResults(trades) {
  const map = {}
  for (const t of trades || []) {
    if (!t.date) continue
    const d = map[t.date] || (map[t.date] = { date: t.date, dollarPnl: 0, rPnl: 0, count: 0 })
    d.dollarPnl += tradeDollar(t)
    d.rPnl      += Number(t.rPnl) || 0
    d.count++
  }
  const days = Object.values(map)
    .map(d => ({ ...d, dollarPnl: Math.round(d.dollarPnl * 100) / 100, rPnl: Math.round(d.rPnl * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const green = days.filter(d => d.dollarPnl > 0)
  const red   = days.filter(d => d.dollarPnl < 0)
  const avg = (arr, k) => arr.length ? arr.reduce((s, d) => s + d[k], 0) / arr.length : 0
  return {
    days, green, red,
    total: days.length,
    positiveRate: days.length ? green.length / days.length : 0,
    avgWinDollar:  Math.round(avg(green, 'dollarPnl')),
    avgLossDollar: Math.round(avg(red, 'dollarPnl')),
    avgWinR:  parseFloat(avg(green, 'rPnl').toFixed(2)),
    avgLossR: parseFloat(avg(red, 'rPnl').toFixed(2)),
  }
}

// ── ¿Qué hora usa "Resultados por hora"? ──────
// La hora de cada trade es la del archivo de su plataforma, sin
// convertir (cada una exporta en su zona). Esto solo la nombra, para
// que no se confunda con la hora local de quien mira.
const CLOCK_BY_SOURCE = {
  tradovate: 'Nueva York (ET)',
  ftmo:      'servidor de FTMO (ET + 7 h)',
  topstep:   'la del archivo de Topstep',
}
export function hourClockLabel(trades) {
  const sources = [...new Set((trades || []).map(t => t.source || 'manual'))]
  const name = (s) => CLOCK_BY_SOURCE[s] || 'tal como se cargó'
  if (sources.length === 0) return ''
  if (sources.length === 1) return `Hora: ${name(sources[0])}`
  const PLATFORM = { tradovate: 'Tradovate', ftmo: 'FTMO', topstep: 'Topstep', manual: 'manuales' }
  return `Hora de cada plataforma, sin convertir: ${sources.map(s => `${PLATFORM[s] || s} = ${name(s)}`).join(' · ')}`
}

// Corte del "día" en Por día: hoy es la fecha del trade, o sea de 00:00
// a 23:59 en la hora de la plataforma (sin convertir a ET todavía).
export function dayCutLabel(trades) {
  // Dónde corta el día cada plataforma, dicho en hora de Nueva York (ET)
  const DAY_CUT = {
    tradovate: { short: 'Tradovate 00:00 ET', long: 'de 00:00 a 23:59 ET (hora de Nueva York)' },
    ftmo:      { short: 'FTMO 17:00 ET',      long: 'de 17:00 a 16:59 ET (la medianoche del servidor de FTMO son las 17:00 de Nueva York)' },
    topstep:   { short: 'Topstep 00:00 UTC−6', long: 'de 00:00 a 23:59 en la hora del archivo de Topstep (UTC−6)' },
    manual:    { short: 'manuales 00:00 de la hora cargada', long: 'de 00:00 a 23:59 en la hora en que se cargaron los trades' },
  }
  const sources = [...new Set((trades || []).map(t => (DAY_CUT[t.source] ? t.source : 'manual')))]
  if (sources.length === 1) return `El día va ${DAY_CUT[sources[0]].long}.`
  return 'El día va de 00:00 a 23:59 en la hora de cada plataforma, sin convertir a ET.'
}

// ── Period filter ─────────────────────────────
export function filterTradesByPeriod(trades, period) {
  if (period === 'ALL') return trades
  const now  = new Date()
  const from = new Date(now)
  if      (period === '1W') from.setDate(now.getDate() - 7)
  else if (period === '1M') from.setMonth(now.getMonth() - 1)
  else if (period === '3M') from.setMonth(now.getMonth() - 3)
  else if (period === '6M') from.setMonth(now.getMonth() - 6)
  else if (period === '1Y') from.setFullYear(now.getFullYear() - 1)
  const fromStr = from.toISOString().split('T')[0]
  return trades.filter(t => t.date >= fromStr)
}

// Ventana equivalente INMEDIATAMENTE ANTERIOR al periodo seleccionado —
// usada para la comparativa "vs. periodo anterior" de la Fila 1.
// 'ALL' no tiene anterior posible -> devuelve [].
export function filterTradesByPreviousPeriod(trades, period) {
  if (period === 'ALL') return []
  const now  = new Date()
  const from = new Date(now)
  const to   = new Date(now)
  if (period === '1W') {
    from.setDate(now.getDate() - 14); to.setDate(now.getDate() - 7)
  } else if (period === '1M') {
    from.setMonth(now.getMonth() - 2); to.setMonth(now.getMonth() - 1)
  } else if (period === '3M') {
    from.setMonth(now.getMonth() - 6); to.setMonth(now.getMonth() - 3)
  } else if (period === '6M') {
    from.setMonth(now.getMonth() - 12); to.setMonth(now.getMonth() - 6)
  } else if (period === '1Y') {
    from.setFullYear(now.getFullYear() - 2); to.setFullYear(now.getFullYear() - 1)
  }
  const fromStr = from.toISOString().split('T')[0]
  const toStr   = to.toISOString().split('T')[0]
  return trades.filter(t => t.date >= fromStr && t.date < toStr)
}

// ── Filtro por ámbito de cuenta (Sprint 31) ────
// Único punto de verdad para "tipo de cuenta" + "cuenta individual",
// reutilizado por Metrix Basic/Analytics/Lab (mismo criterio que ya
// usa Dashboard para su desplegable "Cuenta"). No calcula ninguna
// métrica: solo decide qué trades entran en el cálculo.
// accountMarket ('futures' | 'cfd'): las cuentas sin mercado cargado solo
// entran en 'all'.
export function filterTradesByAccountScope(trades, accounts, { accountType = 'all', accountStatus = 'all', accountMarket = 'all', accountId = 'all' } = {}) {
  if (accountId && accountId !== 'all') {
    return trades.filter(t => t.accountId === accountId)
  }
  if ((accountType && accountType !== 'all') || (accountStatus && accountStatus !== 'all') || (accountMarket && accountMarket !== 'all')) {
    const ids = accounts
      .filter(a => (accountType === 'all' || a.type === accountType) && (accountStatus === 'all' || a.status === accountStatus) && (accountMarket === 'all' || a.market === accountMarket))
      .map(a => a.id)
    return trades.filter(t => ids.includes(t.accountId))
  }
  return trades
}

// Etiqueta corta y consistente para una cuenta en un desplegable
// (p.ej. "FTMO 100K").
export function accountLabel(account) {
  const size = account.size >= 1000 ? `${Math.round(account.size / 1000)}K` : account.size
  return `${account.firm} ${size}`
}

// % de cambio entre el valor actual y el del periodo anterior.
// Devuelve null cuando no hay base de comparación (evita "Infinity%").
export function pctDelta(curr, prev) {
  if (prev === null || prev === undefined || prev === 0) return null
  return parseFloat((((curr - prev) / Math.abs(prev)) * 100).toFixed(1))
}

// ── Compute stats ─────────────────────────────
// ── Resumen General (Fila 2) ──
// Puntuación compuesta 0-100 a partir de métricas ya calculadas —
// nada inventado, todo derivado de stats real.
export function computeGeneralScore(stats) {
  const clamp = (v) => Math.max(0, Math.min(100, v))
  const rentabilidad = clamp((stats.profitFactor / 2) * 100)
  const consistencia = clamp(stats.consistency)
  const riesgo       = clamp(100 - Math.abs(stats.maxDD) * 3)
  const ejecucion    = clamp(stats.winRateReal)
  const overall = Math.round((rentabilidad + consistencia + riesgo + ejecucion) / 4)
  return {
    overall,
    breakdown: [
      { label: 'Rentabilidad',    value: Math.round(rentabilidad) },
      { label: 'Consistencia',    value: Math.round(consistencia) },
      { label: 'Gestión de Riesgo', value: Math.round(riesgo) },
      { label: 'Ejecución',       value: Math.round(ejecucion) },
    ],
  }
}

export function computeStats(rows, initialCapital = 10000) {
  if (!rows.length) return null
  // Las métricas cuentan operaciones completas: los cierres parciales y
  // los aumentos de una misma posición son una sola operación (ver
  // src/lib/operations.js). El PnL total es el mismo.
  const trades = groupIntoOperations(rows)

  const wins       = trades.filter(t => t.result === 'win')
  const losses     = trades.filter(t => t.result === 'loss')
  const breakevens = trades.filter(t => t.result === 'breakeven')
  const totalR     = parseFloat(trades.reduce((s, t) => s + t.rPnl, 0).toFixed(2))
  const totalDollar = sumTradeDollars(trades)
  const avgWin       = wins.length   ? parseFloat((wins.reduce((s,t)=>s+t.rPnl,0)/wins.length).toFixed(2))   : 0
  const avgLoss      = losses.length ? parseFloat((losses.reduce((s,t)=>s+t.rPnl,0)/losses.length).toFixed(2)): 0
  const avgWinDollar  = wins.length   ? Math.round(wins.reduce((s,t)=>s+tradeDollar(t),0)/wins.length)   : 0
  const avgLossDollar = losses.length ? Math.round(losses.reduce((s,t)=>s+tradeDollar(t),0)/losses.length): 0

  // ── Win Rate variants ──────────────────────
  // Total  : wins / all trades  (BE cuenta en denominador — métrica conservadora)
  const decisive         = wins.length + losses.length
  // Total  : wins / all  (conservador, BE cuenta en denominador)
  const winRate          = parseFloat((wins.length / trades.length * 100).toFixed(1))
  // Real   : wins / (wins+losses)  — excluye BE del denominador
  const winRateReal      = decisive > 0 ? parseFloat((wins.length / decisive * 100).toFixed(1)) : 0
  // BE rate: BE / total
  const beRate           = parseFloat((breakevens.length / trades.length * 100).toFixed(1))
  // Activos: trades que llegaron a TP o SL  (no BE)
  const activeTradesRate = parseFloat((decisive / trades.length * 100).toFixed(1))

  // Profit factor en $ (ganancia bruta / pérdida bruta), sin redondeos intermedios
  const grossWinDollar  = wins.reduce((s,t)=>s+tradeDollar(t),0)
  const grossLossDollar = Math.abs(losses.reduce((s,t)=>s+tradeDollar(t),0))
  const pf      = grossLossDollar > 0
    ? parseFloat((grossWinDollar / grossLossDollar).toFixed(2))
    : 0
  const expectancy = parseFloat(((winRate/100)*avgWin + (1-winRate/100)*avgLoss).toFixed(2))
  const expectancyDollar = trades.length ? totalDollar / trades.length : 0
  const expectancyPctCapital = initialCapital > 0
    ? parseFloat(((expectancyDollar / initialCapital) * 100).toFixed(2))
    : 0

  // Equity curve + drawdown
  const sorted = [...trades].sort((a,b) => a.datetime?.localeCompare(b.datetime) ?? 0)
  let eq = initialCapital, peak = initialCapital, maxDD = 0
  const equityCurve = sorted.map((t, i) => {
    eq += tradeDollar(t)
    if (eq > peak) peak = eq
    const dd = peak > 0 ? ((eq - peak) / peak) * 100 : 0
    if (dd < maxDD) maxDD = dd
    return { i, value: Math.round(eq), dd: parseFloat(dd.toFixed(2)) }
  })

  // Sharpe (simplified: mean return / std dev of returns)
  const returns = sorted.map(t => t.rPnl)
  const meanR   = returns.reduce((s,v) => s+v, 0) / returns.length
  const stdR    = Math.sqrt(returns.reduce((s,v) => s + Math.pow(v - meanR, 2), 0) / returns.length)
  const sharpe  = stdR > 0 ? parseFloat((meanR / stdR * Math.sqrt(252)).toFixed(2)) : 0

  // Risk of ruin (simple Monte Carlo approximation)
  // P(ruin) ≈ ((1-W)/W)^(capital/risk) where W = winRate
  const w = winRate / 100
  const ror = w > 0 && w < 1
    ? parseFloat(Math.min(100, Math.pow((1-w)/w, 20) * 100).toFixed(1))
    : 0

  // Equity smoothness (R² of linear trend vs actual) — con 0 o 1
  // trade no hay curva que analizar, se devuelve consistencia neutra
  // en vez de reventar accediendo a equityCurve[0] sobre un array vacío.
  const n = equityCurve.length
  let consistency = 100
  if (n >= 2) {
    const xMean = (n-1)/2
    const yMean = equityCurve.reduce((s,p)=>s+p.value,0)/n
    const ssRes = equityCurve.reduce((s,p,i)=>{
      const trend = equityCurve[0].value + (equityCurve[n-1].value - equityCurve[0].value) * (i/(n-1))
      return s + Math.pow(p.value - trend, 2)
    }, 0)
    const ssTot = equityCurve.reduce((s,p)=>s+Math.pow(p.value-yMean,2),0)
    consistency = ssTot > 0 ? parseFloat(Math.max(0, (1 - ssRes/ssTot)*100).toFixed(1)) : 100
  }

  // By setup — con R promedio
  const setupMap = {}
  trades.forEach(t => {
    if (!setupMap[t.setup]) setupMap[t.setup] = { win: 0, loss: 0, totalR: 0, count: 0 }
    if (t.result === 'win')  setupMap[t.setup].win++
    if (t.result === 'loss') setupMap[t.setup].loss++
    setupMap[t.setup].totalR += t.rPnl
    setupMap[t.setup].count++
  })
  const bySetup = Object.entries(setupMap)
    .map(([setup, v]) => ({
      setup,
      ...v,
      avgR: parseFloat((v.totalR / v.count).toFixed(2)),
      wr:   v.count ? Math.round(v.win / v.count * 100) : 0,
    }))
    .sort((a,b) => (b.win+b.loss) - (a.win+a.loss))
    .slice(0, 5)

  // Best setup by avg R
  const bestSetup = [...bySetup].sort((a,b) => b.avgR - a.avgR)[0]

  // By instrument (pair) — P&L acumulado en $ para el desglose "por instrumento"
  const instrumentMap = {}
  trades.forEach(t => {
    if (!t.pair) return
    if (!instrumentMap[t.pair]) instrumentMap[t.pair] = { dollarTotal: 0, count: 0 }
    instrumentMap[t.pair].dollarTotal += tradeDollar(t)
    instrumentMap[t.pair].count++
  })
  const byInstrument = Object.entries(instrumentMap)
    .map(([pair, v]) => ({ pair, dollarTotal: parseFloat(v.dollarTotal.toFixed(2)), count: v.count }))
    .sort((a,b) => b.dollarTotal - a.dollarTotal)

  // By weekday
  const dayMap = { Lun:[], Mar:[], 'Mié':[], Jue:[], Vie:[] }
  const dayIdx = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  trades.forEach(t => {
    if (!t.date) return
    // T00:00 = medianoche LOCAL: new Date('2026-09-10') es medianoche UTC
    // y en América (UTC-3…) caía en el día anterior
    const d = dayIdx[new Date(`${t.date}T00:00:00`).getDay()]
    if (dayMap[d]) dayMap[d].push(t)
  })
  const byWeekday = Object.entries(dayMap).map(([day, dayTrades]) => ({
    day,
    r:            dayTrades.length ? parseFloat((dayTrades.reduce((s,t)=>s+t.rPnl,0)/dayTrades.length).toFixed(2)) : 0,
    dollarTotal:  parseFloat(dayTrades.reduce((s,t)=>s+tradeDollar(t),0).toFixed(2)),
    count: dayTrades.length,
  }))
  const bestDay = [...byWeekday].sort((a,b) => b.r - a.r)[0]

  // By session
  const sessionMap = {}
  trades.forEach(t => {
    if (!t.session) return
    if (!sessionMap[t.session]) sessionMap[t.session] = { totalR: 0, dollarTotal: 0, count: 0 }
    sessionMap[t.session].totalR += t.rPnl
    sessionMap[t.session].dollarTotal += tradeDollar(t)
    sessionMap[t.session].count++
  })
  const bySessions = Object.entries(sessionMap)
    .map(([s, v]) => ({
      session: s, avgR: parseFloat((v.totalR/v.count).toFixed(2)),
      dollarTotal: parseFloat(v.dollarTotal.toFixed(2)), count: v.count,
    }))
    .sort((a,b) => b.avgR - a.avgR)
  const bestSession = bySessions[0]

  // Best hour
  const hourMap = {}
  trades.forEach(t => {
    if (!t.time) return
    const h = t.time.split(':')[0]
    if (!hourMap[h]) hourMap[h] = { totalR: 0, dollarTotal: 0, count: 0 }
    hourMap[h].totalR += t.rPnl
    hourMap[h].dollarTotal += tradeDollar(t)
    hourMap[h].count++
  })
  const bestHour = Object.entries(hourMap)
    .map(([h, v]) => ({ hour: `${h}:00`, avgR: parseFloat((v.totalR/v.count).toFixed(2)) }))
    .sort((a,b) => b.avgR - a.avgR)[0]

  // Todas las horas con datos (para el heatmap de la Fila 3, no solo la mejor)
  const byHour = Object.entries(hourMap)
    .map(([h, v]) => ({
      hour: parseInt(h, 10),
      avgR: parseFloat((v.totalR / v.count).toFixed(2)),
      dollarTotal: parseFloat(v.dollarTotal.toFixed(2)),
      count: v.count,
    }))
    .sort((a, b) => a.hour - b.hour)

  // Distribución real por tramos de R (solo trades ganadores, como en la referencia)
  const rrBuckets = (() => {
    const buckets = [
      { label: '0–0.5R', min: 0,   max: 0.5, count: 0 },
      { label: '0.5–1R', min: 0.5, max: 1,   count: 0 },
      { label: '1–2R',   min: 1,   max: 2,   count: 0 },
      { label: '2–3R',   min: 2,   max: 3,   count: 0 },
      { label: '3R+',    min: 3,   max: Infinity, count: 0 },
    ]
    wins.forEach(t => {
      const b = buckets.find(b => t.rPnl >= b.min && t.rPnl < b.max)
      if (b) b.count++
    })
    const total = wins.length || 1
    return buckets.map(b => ({ ...b, pct: parseFloat((b.count / total * 100).toFixed(1)) }))
  })()

  return {
    trades, rows: rows.length,
    total: trades.length, wins: wins.length, losses: losses.length, breakevens: breakevens.length,
    winRate, winRateReal, beRate, activeTradesRate,
    totalR, totalDollar, avgWin, avgLoss, avgWinDollar, avgLossDollar, profitFactor: pf,
    expectancy, expectancyPctCapital, equityCurve, bySetup, byWeekday, bySessions, byHour, byInstrument, rrBuckets,
    sharpe, maxDD: parseFloat(maxDD.toFixed(1)), consistency, ror,
    bestSetup, bestDay, bestSession, bestHour,
    // Lot size consistency
    lotStats: (() => {
      const withQty = trades.filter(t => t.qty && t.qty > 0)
      if (withQty.length < 2) return null
      const qtys = withQty.map(t => t.qty)
      const avg  = parseFloat((qtys.reduce((s,v) => s+v, 0) / qtys.length).toFixed(2))
      const variance = qtys.reduce((s,v) => s + Math.pow(v - avg, 2), 0) / qtys.length
      const std  = parseFloat(Math.sqrt(variance).toFixed(2))
      const cv   = avg > 0 ? parseFloat((std / avg * 100).toFixed(1)) : 0  // coef. variación %
      const min  = Math.min(...qtys), max = Math.max(...qtys)
      // Rendimiento por tramo de lotaje
      const qMed = avg
      const bigLots  = withQty.filter(t => t.qty > qMed)
      const smallLots= withQty.filter(t => t.qty <= qMed)
      const avgRBig  = bigLots.length   ? parseFloat((bigLots.reduce((s,t)=>s+t.rPnl,0)/bigLots.length).toFixed(2))   : null
      const avgRSmall= smallLots.length ? parseFloat((smallLots.reduce((s,t)=>s+t.rPnl,0)/smallLots.length).toFixed(2)): null
      return { count: withQty.length, avg, std, cv, min, max, avgRBig, avgRSmall, bigCount: bigLots.length, smallCount: smallLots.length }
    })(),
    // Trade Efficiency (solo si hay trades con mfeR > 0)
    mfeStats: (() => {
      const withMFE = trades.filter(t => t.mfeR && t.mfeR > 0)
      if (!withMFE.length) return null
      const efficiencies = withMFE.map(t => Math.min(t.rPnl / t.mfeR, 1))
      const avg = parseFloat((efficiencies.reduce((s,v) => s+v, 0) / efficiencies.length).toFixed(3))
      const avgMFE = parseFloat((withMFE.reduce((s,t) => s+t.mfeR, 0) / withMFE.length).toFixed(2))
      const beTrades = trades.filter(t => t.result === 'breakeven')
      const beMFE    = beTrades.filter(t => t.mfeR && t.mfeR > 0)
      return { count: withMFE.length, avg, avgMFE, beMFE: beMFE.length, beTotal: beTrades.length,
               bePct: beTrades.length ? parseFloat((beMFE.length / beTrades.length * 100).toFixed(1)) : 0 }
    })(),
  }
}

// ── Section label ─────────────────────────────
export function SectionLabel({ children, accent = 'var(--text3)' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 12, marginTop: 4,
    }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '1.2px',
        textTransform: 'uppercase', color: 'var(--text3)',
      }}>{children}</span>
    </div>
  )
}

// ── Hero KPI card ─────────────────────────────
export function HeroKPI({ label, primary, secondary, tertiary, accent = 'var(--brand)', badge, badgeColor, icon, iconColor, spark }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid var(--border)`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 'var(--r)',
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(to bottom, ${accent}08, transparent)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          {label}
        </div>
        {icon && <IconCircle icon={icon} color={iconColor ?? 'primary'} size={26} />}
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700,
        color: accent, lineHeight: 1.1, marginTop: 2,
      }}>
        {primary}
      </div>
      {secondary && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          {secondary}
        </div>
      )}
      {tertiary && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
          {tertiary}
        </div>
      )}
      {spark && (
        <div style={{ marginTop: 6 }}>
          <Sparkline data={spark} color={accent} width={90} height={24} />
        </div>
      )}
      {badge && !icon && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          padding: '2px 8px', borderRadius: 12, fontSize: 9,
          fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
          background: `${badgeColor ?? accent}22`,
          color: badgeColor ?? accent,
          border: `1px solid ${badgeColor ?? accent}44`,
        }}>{badge}</div>
      )}
    </div>
  )
}

// ── Small stat tile ───────────────────────────
export function StatTile({ label, value, color, sub }) {
  return (
    <div style={{
      background: 'var(--bg3)',
      border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: color ?? 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Insight card ──────────────────────────────
export function InsightCard({ icon, label, value, sub, accent = 'var(--amber)' }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 'var(--r)',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: accent, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Risk gauge ────────────────────────────────
export function RiskGauge({ label, value, max, color, format = v => v, inverse = false }) {
  const pct = Math.min(100, Math.abs(value) / max * 100)
  const isWarning = inverse ? pct > 60 : pct < 40
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>{label}</span>
        <span style={{
          fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700,
          color: isWarning ? 'var(--red)' : color ?? 'var(--pos)',
        }}>{format(value)}</span>
      </div>
      <div style={{ height: 10, background: 'var(--bg3)', borderRadius: 5, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 5, transition: 'width 0.6s ease',
          width: `${pct}%`,
          background: isWarning
            ? 'var(--red)'
            : `linear-gradient(90deg, ${color ?? 'var(--pos)'}, ${color ?? 'var(--pos)'}cc)`,
        }} />
      </div>
    </div>
  )
}

// ── Custom equity tooltip ─────────────────────
export function EquityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ ...TT, padding: '8px 12px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>
        ${d?.value?.toLocaleString()}
      </div>
      {d?.dd < 0 && (
        <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>
          DD: {d.dd.toFixed(1)}%
        </div>
      )}
    </div>
  )
}