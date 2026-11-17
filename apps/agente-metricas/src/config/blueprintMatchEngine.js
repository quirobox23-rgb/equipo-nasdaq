// ─────────────────────────────────────────────
//  BLUEPRINT MATCH ENGINE — Plantilla v2
//
//  Motor de comparación CUENTA ↔ MAPA. No usa IA. Todas las métricas
//  se calculan a partir de los trades reales de la cuenta (nunca se
//  cargan a mano) — ver "Plantilla de Mapas v2", bloque 7.
//
//  Sprint 26.1: el Drawdown se delega por completo al Trailing
//  Drawdown Engine (config/drawdownEngine.js), única fuente de
//  verdad para toda la app.
//
//  Cambio de plantilla (v2): los Mapas ahora definen sus objetivos
//  en 3 niveles (mínimo/objetivo/óptimo) para Win Rate, RR realizado
//  y Profit Factor — no un único valor como antes. Pérdida promedio
//  y Drawdown siguen siendo un techo (cuanto menos, mejor), con un
//  nivel "objetivo" opcional debajo del máximo.
// ─────────────────────────────────────────────

import { computeDrawdown } from './drawdownEngine'
import { tradeDollar } from '@/lib/tradeDollar'
import { groupIntoOperations } from '@/lib/operations'

function dollarOf(t, riskPerTrade) {
  return tradeDollar(t, riskPerTrade)
}

// ── Racha máxima (win o loss), ordenada por fecha+hora ──────────
function maxStreak(trades, resultType) {
  const sorted = [...trades].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  let max = 0, cur = 0
  sorted.forEach(t => {
    if (t.result === resultType) { cur++; max = Math.max(max, cur) }
    else cur = 0
  })
  return max
}

// ── 1. Métricas de cuenta a partir de sus propios trades ──────
// account es necesario para el Drawdown (capital inicial, % permitido
// y tipo de cuenta viven en el objeto cuenta, no en los trades) y
// para riskPerTrade (fallback cuando un trade no tiene dollarPnl).
export function computeAccountMetrics(trades, account = null) {
  if (!trades || trades.length === 0) return null

  const riskPerTrade = account?.riskPerTrade || 100
  // Win rate, medias y rachas por operación completa (parciales de una
  // misma posición = una operación); el drawdown sigue con cada fila.
  const ops    = groupIntoOperations(trades, riskPerTrade)
  const wins   = ops.filter(t => t.result === 'win')
  const losses = ops.filter(t => t.result === 'loss')
  const decisive = wins.length + losses.length

  const winRate = decisive > 0 ? parseFloat((wins.length / decisive * 100).toFixed(1)) : 0

  // ── Average Win / Average Loss reales, en $ (bloque 7 de la
  // plantilla v2) — antes solo existían en R, ahora son la base de
  // RR realizado, Expectancy y Recovery Trades. ──
  const avgWinDollar  = wins.length   ? parseFloat((wins.reduce((s, t) => s + dollarOf(t, riskPerTrade), 0) / wins.length).toFixed(2)) : 0
  const avgLossDollar = losses.length ? parseFloat(Math.abs(losses.reduce((s, t) => s + dollarOf(t, riskPerTrade), 0) / losses.length).toFixed(2)) : 0

  const profitFactor = losses.length && avgLossDollar !== 0
    ? parseFloat(((avgWinDollar * wins.length) / (avgLossDollar * losses.length)).toFixed(2))
    : 0

  // RR realizado real = Avg Win / Avg Loss (bloque 7) — sustituye al
  // antiguo "avgRR" (que venía del campo rrActual por trade).
  const rrRealized = avgLossDollar > 0 ? parseFloat((avgWinDollar / avgLossDollar).toFixed(2)) : 0

  // Expectancy — nunca se carga a mano, siempre calculada.
  const winRateDec = winRate / 100
  const expectancy = parseFloat((winRateDec * avgWinDollar - (1 - winRateDec) * avgLossDollar).toFixed(2))

  // Recovery Trades — cuántas ganadoras promedio hacen falta para
  // recuperar UNA pérdida promedio.
  const recoveryTrades = avgWinDollar > 0 ? parseFloat((avgLossDollar / avgWinDollar).toFixed(2)) : null

  // Rachas win/loss (bloque 7).
  const maxWinStreak  = maxStreak(ops, 'win')
  const maxLossStreak = maxStreak(ops, 'loss')

  // ── Drawdown: Trailing Drawdown Engine, única fuente de verdad ──
  const drawdown = account ? computeDrawdown(account, trades) : null
  // drawdownConsumedPct ya viene en % del capital inicial; para
  // comparar contra el Drawdown disponible del Mapa (en $) hace
  // falta el equivalente en $.
  const maxDrawdownPct    = drawdown ? drawdown.drawdownConsumedPct : 0
  const maxDrawdownDollar = account ? parseFloat((maxDrawdownPct / 100 * account.size).toFixed(2)) : 0

  const uniqueDays = [...new Set(trades.map(t => t.date))]
  const daysTraded = uniqueDays.length

  return {
    winRate, profitFactor, rrRealized, avgWinDollar, avgLossDollar,
    expectancy, recoveryTrades, maxWinStreak, maxLossStreak,
    maxDrawdownPct, maxDrawdownDollar, daysTraded,
    drawdown, // detalle completo del Trailing Drawdown Engine
  }
}

// color: token del semáforo — se renderiza como dot real (ver
// components/ui BlueprintMatchResults), nunca como emoji.
export const MATCH_STATUS_META = {
  optimal:  { color: 'var(--pos)',     label: 'Óptimo' },
  ok:       { color: 'var(--pos)',     label: 'Correcto' },
  near:     { color: 'var(--neutral)', label: 'Mejorable' },
  priority: { color: 'var(--neg)',     label: 'Prioridad' },
  unset:    { color: 'var(--text3)',   label: 'Sin dato' },
}

// ── Estado para métricas de 3 niveles (mínimo/objetivo/óptimo),
// "cuanto más, mejor" (Win Rate, RR realizado, Profit Factor). ──
function status3TierHigher(current, min, target, optimal) {
  const c = parseFloat(current)
  if (isNaN(c)) return 'unset'
  if (optimal !== null && optimal !== undefined && c >= parseFloat(optimal)) return 'optimal'
  if (target  !== null && target  !== undefined && c >= parseFloat(target))  return 'ok'
  if (min     !== null && min     !== undefined && c >= parseFloat(min))     return 'near'
  return 'priority'
}

// ── Estado para métricas techo (cuanto menos, mejor), con un nivel
// "objetivo" opcional por debajo del máximo permitido — Pérdida
// promedio, Drawdown. ──
function statusCeiling(current, max, target) {
  const c = parseFloat(current)
  const m = parseFloat(max)
  if (isNaN(c) || isNaN(m) || m === 0) return 'unset'
  if (c > m) return 'priority'
  if (target !== null && target !== undefined && !isNaN(parseFloat(target))) {
    return c <= parseFloat(target) ? 'ok' : 'near'
  }
  // Sin nivel "objetivo" explícito (ej. Drawdown disponible, que solo
  // define un techo) — zona de aviso del 15% bajo el techo, misma
  // tolerancia que ya usa el resto de la app, en vez de marcar como
  // "mejorable" cualquier valor por debajo (aunque esté muy lejos).
  return c <= m * 0.85 ? 'ok' : 'near'
}

// ── 2. Definición de las métricas comparables ──────────────────
// Cada una sabe leer sus propios niveles desde blueprint.parameters
// / blueprint.accountRules — la forma de la plantilla v2.
const MATCH_METRICS = [
  {
    key: 'winRate', label: 'Win Rate', unit: '%',
    getCurrent: (m) => m.winRate,
    getStatus:  (m, bp) => status3TierHigher(m.winRate, bp.parameters?.winRateMin, bp.parameters?.winRateTarget, bp.parameters?.winRateOptimal),
    getTarget:  (bp) => bp.parameters?.winRateTarget,
  },
  {
    key: 'rrRealized', label: 'RR realizado', unit: '',
    getCurrent: (m) => m.rrRealized,
    getStatus:  (m, bp) => status3TierHigher(m.rrRealized, bp.parameters?.rrRealizedMin, bp.parameters?.rrRealizedTarget, bp.parameters?.rrRealizedOptimal),
    getTarget:  (bp) => bp.parameters?.rrRealizedTarget,
  },
  {
    key: 'profitFactor', label: 'Profit Factor', unit: '',
    getCurrent: (m) => m.profitFactor,
    getStatus:  (m, bp) => status3TierHigher(m.profitFactor, bp.parameters?.pfMin, bp.parameters?.pfTarget, bp.parameters?.pfOptimal),
    getTarget:  (bp) => bp.parameters?.pfTarget,
  },
  {
    key: 'avgLossDollar', label: 'Pérdida promedio', unit: '$',
    getCurrent: (m) => m.avgLossDollar,
    getStatus:  (m, bp) => statusCeiling(m.avgLossDollar, bp.parameters?.avgLossMax, bp.parameters?.avgLossTarget),
    getTarget:  (bp) => bp.parameters?.avgLossTarget ?? bp.parameters?.avgLossMax,
  },
  {
    key: 'maxDrawdownDollar', label: 'Drawdown consumido', unit: '$',
    getCurrent: (m) => m.maxDrawdownDollar,
    getStatus:  (m, bp) => statusCeiling(m.maxDrawdownDollar, bp.accountRules?.drawdownAvailable, null),
    getTarget:  (bp) => bp.accountRules?.drawdownAvailable,
  },
  // ── Informativas: la plantilla v2 no define un benchmark para
  // estas (bloque 7), se muestran para diagnóstico pero no puntúan
  // la compatibilidad. ──
  { key: 'expectancy',     label: 'Expectativa',      unit: '$',  getCurrent: (m) => m.expectancy,     getStatus: () => 'unset', getTarget: () => null },
  { key: 'recoveryTrades', label: 'Recovery Trades',  unit: '',   getCurrent: (m) => m.recoveryTrades, getStatus: () => 'unset', getTarget: () => null },
  { key: 'maxLossStreak',  label: 'Racha de pérdidas',unit: '',   getCurrent: (m) => m.maxLossStreak,  getStatus: () => 'unset', getTarget: () => null },
]

// ── 3. matchBlueprintToAccount — función principal del motor ───
export function matchBlueprintToAccount(blueprint, accountMetrics) {
  if (!blueprint || !accountMetrics) {
    return { metrics: [], compatibility: 0, strengths: [], priorities: { priority_1: null, priority_2: null, priority_3: null, list: [] } }
  }

  const metrics = MATCH_METRICS.map(def => ({
    key: def.key,
    label: def.label,
    unit: def.unit,
    current: def.getCurrent(accountMetrics),
    target: def.getTarget(blueprint),
    status: def.getStatus(accountMetrics, blueprint),
  }))

  // ── Compatibilidad: información SECUNDARIA, solo sobre las
  // métricas que SÍ puntúan (se excluyen las informativas). ──
  const scored = metrics.filter(m => m.status !== 'unset')
  const compatibility = scored.length
    ? Math.round((scored.filter(m => m.status === 'ok' || m.status === 'optimal').length / scored.length) * 100)
    : 0

  const strengths = metrics.filter(m => m.status === 'ok' || m.status === 'optimal').map(m => m.label)

  // ── Prioridades: las 3 diferencias de mayor impacto ──
  const impactScore = (m) => {
    if (m.status === 'unset' || m.status === 'ok' || m.status === 'optimal') return -1
    const base = m.status === 'priority' ? 2 : 1 // 'near'
    if (m.target === null || m.target === undefined || parseFloat(m.target) === 0) return base
    const t = parseFloat(m.target), c = parseFloat(m.current)
    const distance = Math.abs(c - t) / Math.abs(t)
    return base + distance
  }

  const priorityMetrics = [...metrics]
    .filter(m => m.status === 'priority' || m.status === 'near')
    .sort((a, b) => impactScore(b) - impactScore(a))
    .slice(0, 3)

  const priorities = {
    priority_1: priorityMetrics[0] || null,
    priority_2: priorityMetrics[1] || null,
    priority_3: priorityMetrics[2] || null,
    list: priorityMetrics,
  }

  return { metrics, compatibility, strengths, priorities }
}