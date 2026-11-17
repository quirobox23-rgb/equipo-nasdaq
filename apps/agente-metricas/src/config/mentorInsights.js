// ─────────────────────────────────────────────
//  MENTOR INSIGHTS — Sprint 32
//
//  Interpreta datos ya existentes (trades, accountMetrics, Blueprint)
//  y devuelve texto cualitativo. Reglas simples, sin IA generativa,
//  sin recalcular ninguna métrica: todo se apoya en
//  computeAccountMetrics() (blueprintMatchEngine.js) y en los propios
//  trades. Módulo puro, sin React.
// ─────────────────────────────────────────────

import { tradeDollar } from '@/lib/tradeDollar'

const PROFIT_FACTOR_GOOD = 1.5
const WIN_RATE_HIGH = 55
const AVG_RR_LOW = 1.2
const RISK_HIGH = 1.8
const DRAWDOWN_HIGH = 12
const TRADES_PER_DAY_HIGH = 3
const MIN_SAMPLE_RELIABLE = 30

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Día de la semana a partir de una fecha 'YYYY-MM-DD', sin desfase de
// zona horaria (new Date('YYYY-MM-DD') se interpreta en UTC; usar
// .getDay() directamente puede desplazar el día según el huso local).
function weekdayOf(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number)
  if (!y || !m || !d) return '—'
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function groupSum(trades, keyFn) {
  const map = {}
  trades.forEach(t => {
    const k = keyFn(t)
    if (!map[k]) map[k] = { sum: 0, count: 0, wins: 0 }
    map[k].sum += t.rPnl
    map[k].count += 1
    if (t.result === 'win') map[k].wins += 1
  })
  return map
}

// ── 1. Resumen Ejecutivo ────────────────────────
// Máximo 4 frases, sin números, visión general.
export function generateExecutiveSummary({ accountMetrics }) {
  if (!accountMetrics) return []
  const { winRate, profitFactor, avgRR, maxDrawdown, avgRisk } = accountMetrics
  const lines = []

  if (profitFactor >= PROFIT_FACTOR_GOOD) {
    lines.push('Tu operativa muestra una ventaja estadística estable.')
  } else if (profitFactor >= 1) {
    lines.push('Tu operativa tiene una ventaja estadística todavía frágil.')
  } else {
    lines.push('Tu operativa no muestra todavía una ventaja estadística clara.')
  }

  if (winRate >= WIN_RATE_HIGH && avgRR < AVG_RR_LOW) {
    lines.push('El principal problema actualmente no son las entradas, sino la gestión de las salidas.')
  } else if (avgRR >= AVG_RR_LOW && winRate < WIN_RATE_HIGH) {
    lines.push('Tus salidas funcionan bien; el margen de mejora está en la selección de entradas.')
  }

  if (avgRisk <= RISK_HIGH && maxDrawdown <= DRAWDOWN_HIGH) {
    lines.push('Existe consistencia suficiente para empezar a optimizar el rendimiento en vez de corregir errores básicos.')
  } else {
    lines.push('Antes de optimizar rendimiento, conviene estabilizar la gestión del riesgo.')
  }

  if (maxDrawdown > DRAWDOWN_HIGH) {
    lines.push('El drawdown reciente es más alto de lo necesario para el nivel de ventaja que muestra el sistema.')
  }

  return lines.slice(0, 4)
}

// ── 2. Diagnóstico: Fortalezas / Áreas de mejora ──
// Interpretación, no la métrica en crudo.
export function generateDiagnosis({ accountMetrics }) {
  if (!accountMetrics) return { strengths: [], weaknesses: [] }
  const { winRate, profitFactor, avgRR, avgRisk, maxDrawdown, tradesPerDay } = accountMetrics
  const strengths = []
  const weaknesses = []

  if (avgRisk <= RISK_HIGH) strengths.push('Disciplina en el riesgo.')
  else weaknesses.push('Riesgo por operación inconsistente.')

  if (profitFactor >= PROFIT_FACTOR_GOOD) strengths.push('Buena consistencia en el resultado.')
  else weaknesses.push('Consistencia insuficiente entre operaciones.')

  if (maxDrawdown <= DRAWDOWN_HIGH) strengths.push('Baja variabilidad en el capital.')
  else weaknesses.push('Drawdown innecesario para el nivel de ventaja actual.')

  if (avgRR >= AVG_RR_LOW) strengths.push('Buena relación riesgo/beneficio por operación.')
  else weaknesses.push('RR insuficiente: las ganancias no compensan bien las pérdidas.')

  if (tradesPerDay <= TRADES_PER_DAY_HIGH) strengths.push('Frecuencia operativa controlada.')
  else weaknesses.push('Exceso de operaciones por sesión.')

  if (winRate >= WIN_RATE_HIGH) strengths.push('Buena precisión en la selección de entradas.')

  return { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4) }
}

// ── 3. Perfil del Trader ────────────────────────
// Solo a partir de estadísticas disponibles, sin inventar nada.
export function generateTraderProfile({ accountMetrics, trades }) {
  if (!accountMetrics || !trades?.length) return []
  const { winRate, tradesPerDay, avgRisk, avgRR } = accountMetrics
  const tags = []

  tags.push(winRate >= WIN_RATE_HIGH ? 'Alta precisión en las entradas.' : 'Precisión de entrada mejorable.')
  tags.push(tradesPerDay <= 2 ? 'Baja frecuencia operativa.' : tradesPerDay <= TRADES_PER_DAY_HIGH ? 'Frecuencia operativa moderada.' : 'Alta frecuencia operativa.')
  tags.push(avgRisk <= 1 ? 'Muy conservador con el riesgo.' : avgRisk <= RISK_HIGH ? 'Conservador con el riesgo.' : 'Agresivo con el riesgo.')
  if (avgRR < AVG_RR_LOW) tags.push('Tendencia a cerrar beneficios demasiado pronto.')

  const byPair = groupSum(trades, t => t.pair || '—')
  const mainPair = Object.entries(byPair).sort((a, b) => b[1].count - a[1].count)[0]
  if (mainPair) tags.push(`Mercado principal: ${mainPair[0]}.`)

  return tags
}

// ── 4. Contexto Operativo ───────────────────────
// El valor diferencial: interpreta patrones reales, no repite métricas.
export function analyzeOperationalContext(trades) {
  if (!trades || trades.length < 5) return []
  const insights = []
  const totalPositive = trades.reduce((s, t) => s + Math.max(0, t.rPnl), 0)

  // Mercado que aporta más beneficio
  const byPair = groupSum(trades, t => t.pair || '—')
  const pairEntries = Object.entries(byPair)
  if (pairEntries.length > 1 && totalPositive > 0) {
    const [bestPair, bestData] = pairEntries.sort((a, b) => b[1].sum - a[1].sum)[0]
    const pairPositive = trades.filter(t => t.pair === bestPair && t.rPnl > 0).reduce((s, t) => s + t.rPnl, 0)
    const pct = Math.round((pairPositive / totalPositive) * 100)
    if (pct >= 40) insights.push(`El ${pct}% de tu beneficio proviene de ${bestPair}.`)

    const [worstPair, worstData] = pairEntries.sort((a, b) => (a[1].sum / a[1].count) - (b[1].sum / b[1].count))[0]
    if (worstData.count >= 4 && (worstData.sum / worstData.count) < 0 && worstPair !== bestPair) {
      insights.push(`Tus resultados disminuyen al operar ${worstPair}.`)
    }
  }

  // Mejor sesión
  const bySession = groupSum(trades, t => t.session || '—')
  const sessionEntries = Object.entries(bySession).filter(([, v]) => v.count >= 3)
  if (sessionEntries.length > 1) {
    const [bestSession] = sessionEntries.sort((a, b) => (b[1].wins / b[1].count) - (a[1].wins / a[1].count))[0]
    insights.push(`Tus mejores sesiones se producen durante ${bestSession}.`)
  }

  // Caída de rendimiento a partir de cierta hora
  const afterHour = trades.filter(t => t.time && parseInt(t.time.split(':')[0], 10) >= 17)
  const beforeHour = trades.filter(t => t.time && parseInt(t.time.split(':')[0], 10) < 17)
  if (afterHour.length >= 4 && beforeHour.length >= 4) {
    const pfOf = (list) => {
      const w = list.filter(t => t.rPnl > 0).reduce((s, t) => s + t.rPnl, 0)
      const l = Math.abs(list.filter(t => t.rPnl < 0).reduce((s, t) => s + t.rPnl, 0))
      return l > 0 ? w / l : w > 0 ? Infinity : 0
    }
    if (pfOf(afterHour) < pfOf(beforeHour) * 0.7) {
      insights.push('Después de las 17:00 tu Profit Factor cae de forma notable.')
    }
  }

  // Mejores días de la semana
  const byWeekday = groupSum(trades, t => weekdayOf(t.date))
  const weekdayEntries = Object.entries(byWeekday).filter(([, v]) => v.count >= 3)
  if (weekdayEntries.length >= 3) {
    const sorted = [...weekdayEntries].sort((a, b) => (b[1].sum / b[1].count) - (a[1].sum / a[1].count))
    const topDays = sorted.slice(0, 2).map(([d]) => d)
    insights.push(`Tus mejores días son ${topDays.join(' y ')}.`)
  }

  // Operativa impulsiva los viernes (más operaciones de lo habitual)
  const friday = byWeekday['Viernes']
  const avgTradesPerDay = trades.length / new Set(trades.map(t => t.date)).size
  if (friday && friday.count / (weekdayEntries.find(([d]) => d === 'Viernes')?.[1]?.count || 1) && avgTradesPerDay > 0) {
    const fridayDays = new Set(trades.filter(t => weekdayOf(t.date) === 'Viernes').map(t => t.date)).size
    if (fridayDays > 0 && friday.count / fridayDays > avgTradesPerDay * 1.3) {
      insights.push('Los viernes aumenta el número de operaciones, señal de posible impulsividad.')
    }
  }

  // Rendimiento según nº de operaciones por día
  const byDay = groupSum(trades, t => t.date)
  const lowVolumeDays = Object.values(byDay).filter(d => d.count <= 2)
  const highVolumeDays = Object.values(byDay).filter(d => d.count > 2)
  if (lowVolumeDays.length >= 3 && highVolumeDays.length >= 3) {
    const avgLow = lowVolumeDays.reduce((s, d) => s + d.sum, 0) / lowVolumeDays.length
    const avgHigh = highVolumeDays.reduce((s, d) => s + d.sum, 0) / highVolumeDays.length
    if (avgLow > avgHigh) {
      insights.push('Tu operativa funciona mejor cuando realizas dos operaciones o menos por sesión.')
    }
  }

  return insights.slice(0, 5)
}

// ── 5. Contexto Estadístico ─────────────────────
export function analyzeStatisticalReliability(trades) {
  const n = trades?.length || 0
  if (n === 0) return 'Todavía no hay operaciones registradas para este periodo.'
  if (n < MIN_SAMPLE_RELIABLE) {
    return `Todavía existen pocas operaciones (${n}) para modificar el sistema con confianza.`
  }
  return `La muestra actual (${n} operaciones) es suficientemente grande para sacar conclusiones fiables.`
}

// ── 6. Recomendaciones Prioritarias ─────────────
// Exactamente 3, acciones concretas — no repite el plan de Training.
export function generateRecommendations({ diagnosis, contextInsights, accountMetrics }) {
  const recs = []

  const afterHourIssue = contextInsights.some(i => i.includes('17:00'))
  if (afterHourIssue) recs.push('Reducir la operativa después de las 17:00.')

  const overtradingIssue = diagnosis.weaknesses.some(w => w.includes('Exceso de operaciones'))
    || contextInsights.some(i => i.includes('dos operaciones o menos'))
  if (overtradingIssue) recs.push('Limitar la sesión a un máximo de dos operaciones.')

  const riskIssue = diagnosis.weaknesses.some(w => w.includes('Riesgo por operación'))
  if (riskIssue) recs.push('Mantener el riesgo constante durante toda la semana.')

  const rrIssue = diagnosis.weaknesses.some(w => w.includes('RR insuficiente'))
  if (rrIssue && recs.length < 3) recs.push('Dejar correr más las operaciones ganadoras antes de cerrar.')

  const ddIssue = diagnosis.weaknesses.some(w => w.includes('Drawdown'))
  if (ddIssue && recs.length < 3) recs.push('Reducir el tamaño de posición hasta estabilizar el drawdown.')

  if (recs.length < 3) recs.push('Mantener el registro sistemático de todas las operaciones.')
  if (recs.length < 3) recs.push('Revisar semanalmente el cumplimiento del plan de trading.')
  if (recs.length < 3) recs.push('Consolidar el playbook actual antes de añadir nuevos setups.')

  return [...new Set(recs)].slice(0, 3)
}

// ── BLOQUE 2: ELITE PERFORMANCE ─────────────────

// Contexto profesional del Mapa — a partir de sus PROPIOS campos ya
// definidos en la plantilla v2 (parameters, accountRules). No se
// inventa nada nuevo; si el campo no está relleno, se omite la frase.
export function generateBlueprintProfessionalContext(blueprint) {
  if (!blueprint) return []
  const lines = []
  const p = blueprint.parameters || {}
  const r = blueprint.accountRules || {}
  if (p.maxRisk) lines.push(`Este Mapa opera con un riesgo máximo de $${p.maxRisk} por operación.`)
  if (p.winRateTarget) lines.push(`El Win Rate objetivo es del ${p.winRateTarget}%.`)
  if (p.avgLossMax) lines.push(`La pérdida promedio no debería superar los $${p.avgLossMax} por operación.`)
  if (r.minDaysRequired) lines.push(`Requiere cumplir un mínimo de ${r.minDaysRequired} días operados.`)
  return lines
}

// Compara el comportamiento real del usuario con los parámetros del
// Mapa (no repite la tabla métrica a métrica del Match Engine, que
// ya cubre esto con más detalle — esto es un resumen breve).
export function compareUserToBlueprint(blueprint, trades) {
  if (!blueprint || !trades?.length) return { comparisons: [], weeklyObjective: null }
  const comparisons = []
  const p = blueprint.parameters || {}

  const losses = trades.filter(t => t.result === 'loss')
  const avgLossReal = losses.length
    ? Math.abs(losses.reduce((s, t) => s + tradeDollar(t), 0) / losses.length)
    : 0

  if (p.avgLossMax && avgLossReal > 0) {
    if (avgLossReal > p.avgLossMax) {
      comparisons.push(`Tu pérdida promedio real ($${Math.round(avgLossReal)}) supera el máximo de este Mapa ($${p.avgLossMax}).`)
    } else {
      comparisons.push(`Tu pérdida promedio real ($${Math.round(avgLossReal)}) está dentro del límite del Mapa ($${p.avgLossMax}).`)
    }
  }

  const uniqueDays = new Set(trades.map(t => t.date)).size
  const minDays = blueprint.accountRules?.minDaysRequired
  if (minDays) {
    comparisons.push(uniqueDays >= minDays
      ? `Ya llevas ${uniqueDays} días operados, por encima del mínimo de ${minDays} de este Mapa.`
      : `Llevas ${uniqueDays} de los ${minDays} días mínimos que exige este Mapa.`)
  }

  // Objetivo de la semana: prioriza la pérdida promedio (es lo que
  // más rompe la matemática del modelo según el propio diagnóstico
  // de la plantilla v2) y si eso ya está OK, cae a los días mínimos.
  let weeklyObjective = null
  if (p.avgLossMax && avgLossReal > p.avgLossMax) {
    weeklyObjective = 'Reducir la pérdida promedio antes de tocar cualquier otra cosa del sistema.'
  } else if (minDays && uniqueDays < minDays) {
    weeklyObjective = `Completar los ${minDays - uniqueDays} días que faltan para cumplir el mínimo del Mapa.`
  } else {
    weeklyObjective = 'Mantener el riesgo constante durante toda la semana.'
  }

  return { comparisons: comparisons.slice(0, 3), weeklyObjective }
}
