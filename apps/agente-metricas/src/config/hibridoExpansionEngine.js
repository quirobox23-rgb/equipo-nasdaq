// ─────────────────────────────────────────────
//  HÍBRIDO DE EXPANSIÓN — motor de la plantilla del Modelo 3
//
//  Distinta de rr-fijo (blueprintMatchEngine.js): riesgo en 3 niveles,
//  sin días mínimos, y sobre todo, la pieza genuinamente nueva —
//  Distribución de RR por FRECUENCIA (% de trades en cada rango) y
//  por CONTRIBUCIÓN AL P&L ($ que aporta cada rango) — son dos
//  preguntas distintas y el PDF exige conservar ambas por separado.
//
//  Reutiliza computeAccountMetrics() de blueprintMatchEngine.js para
//  Win Rate/Avg Loss/PF/Expectancy/Drawdown/rachas/Recovery Trades —
//  el PDF es explícito: "no hace falta crear nuevas versiones de
//  estas métricas", solo cambian los benchmarks.
// ─────────────────────────────────────────────

import { computeAccountMetrics } from './blueprintMatchEngine'
import { tradeDollar } from '@/lib/tradeDollar'
import { groupIntoOperations } from '@/lib/operations'

function dollarOf(t) {
  return tradeDollar(t)
}

// ── 1. Distribución de RR — frecuencia Y contribución al P&L ──
// Normaliza cada trade con el 1R NOMINAL DEL MAPA (blueprint.
// parameters.rNominal) — NO con el riskPerTrade de la cuenta. Son
// unidades distintas: el Mapa define su propia vara de medir para
// que todas las cuentas asignadas a él sean comparables entre sí.
// Los rangos miden el TAMAÑO del resultado (|R|), ganadoras y
// perdedoras juntas, para que los 3 sumen el 100% de los trades.
// Expansión A+ sí es solo de ganadoras (+2R o más).
export function computeRRDistribution(trades, blueprint) {
  const rNominal = blueprint?.parameters?.rNominal
  const bucketDefs = blueprint?.rrDistribution?.buckets
  if (!rNominal || rNominal <= 0 || !bucketDefs?.length || !trades?.length) return null

  // Una entrada por operación completa (parciales agrupados)
  const normalized = groupIntoOperations(trades).map(t => ({ dollar: dollarOf(t), normR: dollarOf(t) / rNominal, absR: Math.abs(dollarOf(t)) / rNominal }))
  const total = normalized.length
  const totalDollar = normalized.reduce((s, t) => s + t.dollar, 0)

  const inRange = (r, min, max) => (max === null || max === undefined ? r >= min : r >= min && r < max)

  const buckets = bucketDefs.map(b => {
    const inBucket = normalized.filter(t => inRange(t.absR, b.min, b.max))
    const count = inBucket.length
    const dollarSum = inBucket.reduce((s, t) => s + t.dollar, 0)
    return {
      key: b.key, label: b.label, min: b.min, max: b.max, benchmarkPct: b.benchmarkPct,
      count,
      pct: total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0,
      dollarContribution: parseFloat(dollarSum.toFixed(2)),
      // % del P&L TOTAL que aporta este rango — puede superar 100% o
      // ser negativo si otros rangos pierden dinero; es intencional,
      // "de dónde viene realmente el dinero" incluye buckets que restan.
      dollarContributionPct: totalDollar !== 0 ? parseFloat((dollarSum / totalDollar * 100).toFixed(1)) : 0,
    }
  })

  let expansionAPlus = null
  const exp = blueprint.rrDistribution?.expansionAPlus
  if (exp) {
    const inExp = normalized.filter(t => t.normR >= exp.min)
    const count = inExp.length
    const dollarSum = inExp.reduce((s, t) => s + t.dollar, 0)
    expansionAPlus = {
      min: exp.min, benchmarkPctMin: exp.benchmarkPctMin, benchmarkPctMax: exp.benchmarkPctMax,
      count,
      pct: total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0,
      dollarContribution: parseFloat(dollarSum.toFixed(2)),
      dollarContributionPct: totalDollar !== 0 ? parseFloat((dollarSum / totalDollar * 100).toFixed(1)) : 0,
    }
  }

  return { rNominal, total, totalDollar: parseFloat(totalDollar.toFixed(2)), buckets, expansionAPlus }
}

// ── 2. Velocidad al objetivo — cuántos trades hasta capitalizar
// +$2K / +$3K, recorriendo el histórico en orden cronológico.
// Cualquiera de los dos targets puede estar en "No aplica" (null):
// el Mapa 5 solo tiene el objetivo de +$3.000. ──
export function computeSpeedToTarget(trades, blueprint) {
  const rules = blueprint?.accountRules
  if ((!rules?.capitalizationMin && !rules?.capitalizationOptimal) || !trades?.length) return null

  const sorted = [...groupIntoOperations(trades)].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  let cumulative = 0
  let tradesToMin = null
  let tradesToOptimal = null

  sorted.forEach((t, i) => {
    cumulative += dollarOf(t)
    if (tradesToMin === null && rules.capitalizationMin && cumulative >= rules.capitalizationMin) tradesToMin = i + 1
    if (tradesToOptimal === null && rules.capitalizationOptimal && cumulative >= rules.capitalizationOptimal) tradesToOptimal = i + 1
  })

  return {
    capitalizationMin: rules.capitalizationMin || null,
    capitalizationOptimal: rules.capitalizationOptimal || null,
    tradesToMin, tradesToOptimal,
    reachedMin: tradesToMin !== null,
    reachedOptimal: tradesToOptimal !== null,
    currentCumulative: parseFloat(cumulative.toFixed(2)),
  }
}

// ── 3. Estados para tiers de RANGO (target = {min,max}), en vez de
// un único valor como en rr-fijo — así lee el PDF a Modelo 3. ──
function statusRangeHigher(current, min, targetRange, optimal) {
  const c = parseFloat(current)
  if (isNaN(c)) return 'unset'
  if (optimal !== null && optimal !== undefined && c >= optimal) return 'optimal'
  if (targetRange && c >= targetRange.min) return 'ok'
  if (min !== null && min !== undefined && c >= min) return 'near'
  return 'priority'
}

function statusRangeLower(current, max, targetRange, optimal) {
  const c = parseFloat(current)
  if (isNaN(c)) return 'unset'
  if (optimal !== null && optimal !== undefined && c <= optimal) return 'optimal'
  if (targetRange && c <= targetRange.max) return 'ok'
  if (max !== null && max !== undefined && c <= max) return 'near'
  return 'priority'
}

// ── 4. matchHibridoExpansionToAccount — función principal, mismo
// contrato de salida que matchBlueprintToAccount (metrics/
// compatibility/strengths/priorities) para que BlueprintMatchResults
// funcione sin cambios con cualquiera de las 2 plantillas. ──
export function matchHibridoExpansionToAccount(blueprint, account, trades) {
  const accountMetrics = trades?.length ? computeAccountMetrics(trades, account) : null
  const rrDist = trades?.length ? computeRRDistribution(trades, blueprint) : null
  const speed = trades?.length ? computeSpeedToTarget(trades, blueprint) : null

  if (!accountMetrics) {
    return { metrics: [], compatibility: 0, strengths: [], priorities: { priority_1: null, priority_2: null, priority_3: null, list: [] }, rrDistribution: rrDist, speedToTarget: speed }
  }

  const p = blueprint.parameters || {}
  const metrics = [
    {
      key: 'winRate', label: 'Win Rate', unit: '%', current: accountMetrics.winRate, target: p.winRateTarget?.min,
      status: statusRangeHigher(accountMetrics.winRate, p.winRateMin, p.winRateTarget, p.winRateOptimal),
    },
    {
      key: 'rrRealized', label: 'RR realizado (Avg Win/Avg Loss)', unit: '', current: accountMetrics.rrRealized, target: p.rrRealizedTarget?.min,
      status: statusRangeHigher(accountMetrics.rrRealized, p.rrRealizedMin, p.rrRealizedTarget, p.rrRealizedOptimal),
    },
    {
      key: 'profitFactor', label: 'Profit Factor', unit: '', current: accountMetrics.profitFactor, target: p.pfTarget?.min,
      status: statusRangeHigher(accountMetrics.profitFactor, p.pfMin, p.pfTarget, p.pfOptimal),
    },
    {
      key: 'avgLossDollar', label: 'Pérdida promedio', unit: '$', current: accountMetrics.avgLossDollar, target: p.avgLossTarget?.max,
      status: statusRangeLower(accountMetrics.avgLossDollar, p.avgLossMax, p.avgLossTarget, p.avgLossOptimal),
    },
    {
      key: 'maxDrawdownDollar', label: 'Drawdown consumido', unit: '$', current: accountMetrics.maxDrawdownDollar,
      target: blueprint.accountRules?.drawdownAvailable,
      status: (() => {
        const c = accountMetrics.maxDrawdownDollar, m = blueprint.accountRules?.drawdownAvailable
        if (m == null) return 'unset'
        if (c > m) return 'priority'
        return c <= m * 0.85 ? 'ok' : 'near'
      })(),
    },
  ]

  // Avg Loss / 1R — solo en los Mapas que la definen (Mapa 5): mide la
  // eficiencia real del corte con la vara del Mapa, no la de la cuenta.
  const rNominal = p.rNominal
  if (rNominal > 0 && p.avgLossRTarget) {
    const avgLossR = parseFloat((accountMetrics.avgLossDollar / rNominal).toFixed(2))
    metrics.push({
      key: 'avgLossR', label: 'Avg Loss / 1R', unit: 'R', current: avgLossR, target: p.avgLossRTarget.max,
      status: statusRangeLower(avgLossR, p.avgLossRMax, p.avgLossRTarget, p.avgLossROptimal),
    })
  }
  // Consumo medio de DD por pérdida: qué % del drawdown se come cada
  // error. Informativo (es la Avg Loss reescalada, ya puntúa arriba).
  const ddAvailable = blueprint.accountRules?.drawdownAvailable
  if (p.avgLossRTarget && ddAvailable > 0) {
    metrics.push({
      key: 'ddPerLoss', label: 'Consumo medio de DD por pérdida', unit: '%',
      current: parseFloat((accountMetrics.avgLossDollar / ddAvailable * 100).toFixed(1)), target: null, status: 'unset',
    })
  }

  metrics.push(
    { key: 'expectancy', label: 'Expectativa', unit: '$', current: accountMetrics.expectancy, target: null, status: 'unset' },
    { key: 'recoveryTrades', label: 'Recovery Trades', unit: '', current: accountMetrics.recoveryTrades, target: null, status: 'unset' },
    { key: 'maxLossStreak', label: 'Racha de pérdidas', unit: '', current: accountMetrics.maxLossStreak, target: null, status: 'unset' },
  )

  // Distribución de RR: cada bucket puntúa por su cercanía al
  // benchmark de FRECUENCIA (no de contribución al P&L, que es
  // informativa) — dentro del 15% del benchmark cuenta como 'ok'.
  if (rrDist) {
    rrDist.buckets.forEach(b => {
      const distance = b.benchmarkPct > 0 ? Math.abs(b.pct - b.benchmarkPct) / b.benchmarkPct : 0
      metrics.push({
        key: `rrDist_${b.key}`, label: `% trades ${b.label}`, unit: '%', current: b.pct, target: b.benchmarkPct,
        status: distance <= 0.15 ? 'ok' : distance <= 0.35 ? 'near' : 'priority',
      })
    })
  }

  // Compatibilidad ponderada: la Avg Loss ($ y en R) pesa
  // p.avgLossWeight (Mapa 5 = 2) y el resto 1. Sin avgLossWeight
  // (Mapa 3) todo pesa 1 y el resultado es el mismo % de siempre.
  const AVG_LOSS_KEYS = ['avgLossDollar', 'avgLossR']
  const weightOf = (m) => (AVG_LOSS_KEYS.includes(m.key) ? (p.avgLossWeight || 1) : 1)
  const scored = metrics.filter(m => m.status !== 'unset')
  const totalWeight = scored.reduce((s, m) => s + weightOf(m), 0)
  const okWeight = scored.filter(m => m.status === 'ok' || m.status === 'optimal').reduce((s, m) => s + weightOf(m), 0)
  const compatibility = totalWeight ? Math.round((okWeight / totalWeight) * 100) : 0
  const strengths = metrics.filter(m => m.status === 'ok' || m.status === 'optimal').map(m => m.label)

  // Misma prioridad estructural que rr-fijo: la pérdida promedio es
  // la raíz de RR realizado y Profit Factor también aquí.
  const ROOT_CAUSE_BOOST = 0.5
  const impactScore = (m) => {
    if (m.status === 'unset' || m.status === 'ok' || m.status === 'optimal') return -1
    const base = m.status === 'priority' ? 2 : 1
    const boost = AVG_LOSS_KEYS.includes(m.key) ? ROOT_CAUSE_BOOST : 0
    if (m.target === null || m.target === undefined || parseFloat(m.target) === 0) return base + boost
    const t = parseFloat(m.target), c = parseFloat(m.current)
    const distance = Math.abs(c - t) / Math.abs(t)
    return base + boost + distance
  }
  const priorityMetrics = [...metrics]
    .filter(m => m.status === 'priority' || m.status === 'near')
    .sort((a, b) => impactScore(b) - impactScore(a))
    .slice(0, 3)

  return {
    metrics,
    compatibility,
    strengths,
    priorities: { priority_1: priorityMetrics[0] || null, priority_2: priorityMetrics[1] || null, priority_3: priorityMetrics[2] || null, list: priorityMetrics },
    rrDistribution: rrDist,
    speedToTarget: speed,
  }
}
