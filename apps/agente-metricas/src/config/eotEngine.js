// ─────────────────────────────────────────────
//  EOT ENGINE — Estado Operativo del Trader
//
//  Motor de riesgo diario: dado el estado real de una cuenta (no
//  simulado), decide cuánto puede arriesgar HOY en $ y %, con un
//  estado (NEUTRAL/CONSERVADOR/DEFENSIVO/BLOQUEADO) y las razones.
//
//  No inventa cálculos nuevos donde ya existen: reutiliza
//  computeAccountMetrics()/computeDrawdown() (blueprintMatchEngine.js
//  / drawdownEngine.js), que ya son la única fuente de verdad de
//  drawdown/winRate/profitFactor para el resto de la app. Solo se
//  calculan aquí las piezas que no existían en ningún sitio:
//  DD diario, racha de pérdidas, días fuera de control, tendencia
//  reciente, y el propio veto/scoring del estado operativo.
//
//  Módulo puro: no importa React ni ningún store. Recibe la cuenta
//  y sus trades, devuelve un objeto plano.
// ─────────────────────────────────────────────

import { computeAccountMetrics } from './blueprintMatchEngine'
import { tradeDollar } from '@/lib/tradeDollar'

function dollarOf(t, riskPerTrade) {
  return tradeDollar(t, riskPerTrade)
}

function buildDailyPnlMap(trades, riskPerTrade) {
  const map = {}
  trades.forEach(t => {
    if (!t.date) return
    map[t.date] = (map[t.date] || 0) + dollarOf(t, riskPerTrade)
  })
  return map
}

// ── Racha de pérdidas consecutivas máxima (por trade, no por día) ──
function maxLossStreakOf(trades) {
  const sorted = [...trades].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  let maxStreak = 0, cur = 0
  sorted.forEach(t => {
    if (t.result === 'loss') { cur++; maxStreak = Math.max(maxStreak, cur) }
    else cur = 0
  })
  return maxStreak
}

// ── Días "fuera de control": pérdida del día > 2x la media de días
// perdedores. Son estadísticamente los que revientan una cuenta. ──
function outOfControlDaysOf(dailyPnlMap) {
  const lossDays = Object.values(dailyPnlMap).filter(v => v < 0)
  if (!lossDays.length) return 0
  const avgLossDay = lossDays.reduce((s, v) => s + Math.abs(v), 0) / lossDays.length
  return lossDays.filter(v => Math.abs(v) > avgLossDay * 2).length
}

// ── % del P&L total que representa el mejor día — mismo cálculo que
// ya usa el panel de Consistency Control embebido en Portfolio. ──
function bestDayPctOf(dailyPnlMap) {
  const days = Object.values(dailyPnlMap)
  const totalPositive = days.filter(v => v > 0).reduce((s, v) => s + v, 0)
  if (!days.length || totalPositive <= 0) return 0
  const bestDay = Math.max(...days)
  return bestDay > 0 ? (bestDay / totalPositive) * 100 : 0
}

// ── Tendencia reciente: últimos 20 trades vs el histórico completo.
// Necesita al menos 21 trades para tener con qué comparar. ──
function recentTrendOf(trades, riskPerTrade) {
  const N = 20
  if (trades.length < N + 1) return null
  const sorted = [...trades].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  const recent = sorted.slice(-N)

  const calcExpectancy = (list) => {
    const wins = list.filter(t => t.result === 'win')
    const losses = list.filter(t => t.result === 'loss')
    const wr = list.length ? wins.length / list.length : 0
    const avgWin  = wins.length   ? wins.reduce((s, t)   => s + dollarOf(t, riskPerTrade), 0) / wins.length   : 0
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + dollarOf(t, riskPerTrade), 0) / losses.length) : 0
    return wr * avgWin - (1 - wr) * avgLoss
  }

  const recentExp     = calcExpectancy(recent)
  const historicalExp = calcExpectancy(sorted)
  const expDelta = recentExp - historicalExp
  const direction = expDelta > 5 ? 'improving' : expDelta < -5 ? 'declining' : 'stable'
  return { direction, sampleSize: N, recentExpectancy: recentExp, historicalExpectancy: historicalExp }
}

/**
 * computeEOT — punto de entrada único.
 *
 * @param {object} account - la cuenta (necesita: size, maxDrawdown,
 *   maxDailyDD, profitTarget, currentProfit, riskPerTrade,
 *   consistencyRules opcional)
 * @param {array}  trades  - trades de ESA cuenta (ya filtrados)
 * @returns {object|null} { estado, maxRisk, pctRisk, reasons } o
 *   null si la cuenta no tiene trades todavía (no hay con qué evaluar).
 */
export function computeEOT(account, trades) {
  if (!account || !trades || trades.length === 0) return null

  const riskPerTrade = account.riskPerTrade || 550
  const accountMetrics = computeAccountMetrics(trades, account)
  if (!accountMetrics) return null

  const drawdown = accountMetrics.drawdown // detalle completo del Trailing Drawdown Engine
  const balance  = drawdown ? drawdown.currentBalance : account.size

  // ── DD total, expresado como % DEL LÍMITE permitido (no % del
  // capital) — es lo que importa para decidir cuánto queda de margen. ──
  const maxDrawdownPct = parseFloat(account.maxDrawdown) || 0
  const totalDDUsedPct = maxDrawdownPct > 0
    ? Math.min(100, (accountMetrics.maxDrawdown / maxDrawdownPct) * 100)
    : 0
  const totalDDAvailableDollar = drawdown
    ? Math.max(0, (drawdown.drawdownAllowedPct - drawdown.drawdownConsumedPct) / 100 * account.size)
    : 0

  // ── DD diario: pérdida del día más reciente vs el límite diario
  // configurado en la cuenta (a.maxDailyDD). No existía en ningún
  // sitio de la app todavía — el Trailing Drawdown Engine solo
  // rastrea el DD total/trailing, no el diario. ──
  const dailyPnlMap = buildDailyPnlMap(trades, riskPerTrade)
  const sortedDates  = Object.keys(dailyPnlMap).sort()
  const lastDayPnl   = sortedDates.length ? dailyPnlMap[sortedDates[sortedDates.length - 1]] : 0
  const dailyDDUsedDollar = lastDayPnl < 0 ? Math.abs(lastDayPnl) : 0
  const maxDailyDDDollar  = account.maxDailyDD ? (parseFloat(account.maxDailyDD) / 100) * account.size : 0
  const dailyDDUsedPct    = maxDailyDDDollar > 0 ? (dailyDDUsedDollar / maxDailyDDDollar) * 100 : 0

  // ── Expectativa por trade, en $ ──
  const wins   = trades.filter(t => t.result === 'win')
  const losses = trades.filter(t => t.result === 'loss')
  const winRateDec = trades.length ? wins.length / trades.length : 0
  const avgWinDollar  = wins.length   ? wins.reduce((s, t) => s + dollarOf(t, riskPerTrade), 0) / wins.length : 0
  const avgLossDollar = losses.length ? Math.abs(losses.reduce((s, t) => s + dollarOf(t, riskPerTrade), 0) / losses.length) : 0
  const expectancy = winRateDec * avgWinDollar - (1 - winRateDec) * avgLossDollar

  const maxLossStreak    = maxLossStreakOf(trades)
  const outOfControlDays = outOfControlDaysOf(dailyPnlMap)
  const bestDayPct       = bestDayPctOf(dailyPnlMap)
  const recentTrend      = recentTrendOf(trades, riskPerTrade)
  const tradingDays      = accountMetrics.daysTraded

  // ── Cercanía al objetivo de profit — mismo campo que ya usa el
  // panel de Profit en Portfolio (a.currentProfit / a.profitTarget). ──
  const profitTarget = parseFloat(account.profitTarget) || 0
  const profitDone   = parseFloat(account.currentProfit) || 0
  const profitPct    = profitTarget > 0 ? (profitDone / profitTarget) * 100 : 0
  const nearTarget   = profitPct >= 80 && profitPct < 100

  // ── Riesgo base: el menor entre lo que el DD total aguanta y lo
  // que el DD diario aguanta, con la racha de pérdidas máxima como
  // colchón (conservador: si viene otra racha igual, no debe agotar
  // el DD disponible). ──
  const streakBuffer = Math.max(maxLossStreak, 3)
  const byTotalDD = totalDDAvailableDollar > 0 ? (totalDDAvailableDollar * 0.60) / streakBuffer : 0
  const byDailyDD = maxDailyDDDollar > 0 ? maxDailyDDDollar * 0.50 : 0
  const baseRisk  = Math.min(byTotalDD || Infinity, byDailyDD || Infinity)
  const safeBaseRisk = isFinite(baseRisk) ? baseRisk : (account.size * 0.01) // fallback: 1% si la cuenta no tiene reglas de DD configuradas

  const build = (estado, multiplier, reasons) => {
    const maxRisk = Math.max(0, Math.floor(safeBaseRisk * multiplier))
    const pctRisk = balance > 0 ? parseFloat(((maxRisk / balance) * 100).toFixed(2)) : 0
    return { estado, maxRisk, pctRisk, multiplier, reasons }
  }

  // ══════════════════ VETOS — el primero que aplica gana ══════════════════

  if (totalDDUsedPct >= 100 || dailyDDUsedPct >= 100) {
    return build('BLOQUEADO', 0, [
      'Límite de drawdown violado — cuenta en riesgo inmediato',
      'No operes hasta revisar el estado con la firma',
    ])
  }

  if (expectancy < 0 && tradingDays >= 15) {
    return build('BLOQUEADO', 0, [
      `Expectativa negativa ($${expectancy.toFixed(0)}/trade) con ${tradingDays} días de muestra`,
      'El sistema no es matemáticamente viable — no escales el riesgo',
    ])
  }

  if (totalDDUsedPct > 85) {
    return build('DEFENSIVO', 0.30, [
      `DD total al ${totalDDUsedPct.toFixed(0)}% del límite — margen mínimo`,
      `Solo quedan $${totalDDAvailableDollar.toFixed(0)} disponibles`,
    ])
  }

  // ══════════════════ SCORING ══════════════════
  let score = 0
  const reasons = []

  if (totalDDUsedPct < 25) score += 2
  else if (totalDDUsedPct < 50) score += 1
  else if (totalDDUsedPct < 70) { score -= 1; reasons.push(`DD al ${totalDDUsedPct.toFixed(0)}% — margen reduciéndose`) }
  else { score -= 2; reasons.push(`DD al ${totalDDUsedPct.toFixed(0)}% — zona de peligro`) }

  if (outOfControlDays >= 3) { score -= 2; reasons.push(`${outOfControlDays} días fuera de control — disciplina operativa comprometida`) }
  else if (outOfControlDays >= 1) { score -= 1; reasons.push(`${outOfControlDays} día(s) con pérdida > 2x promedio`) }

  if (expectancy > 0) score += 1
  else { score -= 1; reasons.push('Expectativa por trade negativa o nula') }

  if (recentTrend && tradingDays >= 10) {
    if (recentTrend.direction === 'declining') { score -= 1; reasons.push(`Tendencia reciente negativa (últimos ${recentTrend.sampleSize} trades)`) }
    else if (recentTrend.direction === 'improving') score += 1
  }

  const consistencyLimit = account.consistencyRules?.enabled ? account.consistencyRules.maxDailyPercent : 0
  if (consistencyLimit > 0 && bestDayPct > consistencyLimit * 0.85) {
    score -= 1
    reasons.push(`Mejor día al ${bestDayPct.toFixed(0)}% del P&L — riesgo de violar regla de consistencia`)
  }

  let estado, multiplier
  if (score >= 2) { estado = 'NEUTRAL'; multiplier = 1.00 }
  else if (score === 1) { estado = 'NEUTRAL'; multiplier = 1.00 }
  else if (score === 0) { estado = 'CONSERVADOR'; multiplier = 0.65 }
  else if (score === -1) { estado = 'CONSERVADOR'; multiplier = 0.50 }
  else if (score === -2) { estado = 'DEFENSIVO'; multiplier = 0.35 }
  else { estado = 'DEFENSIVO'; multiplier = 0.25 }

  if (nearTarget && estado === 'NEUTRAL') {
    estado = 'CONSERVADOR'; multiplier = 0.60
    reasons.push(`Profit al ${profitPct.toFixed(0)}% del objetivo — proteger lo acumulado`)
  }

  if (reasons.length === 0) {
    reasons.push(score >= 2 ? 'Métricas sólidas y DD amplio disponible' : 'Sin señales de alerta activas')
  }

  return build(estado, multiplier, reasons)
}