// ─────────────────────────────────────────────
//  BLUEPRINT COMPARISON — lógica desacoplada (Sprint 18)
//
//  Módulo independiente: no importa nada de Blueprints.jsx ni de
//  ningún componente de UI. Recibe datos planos y devuelve datos
//  planos, para poder reutilizarse mañana desde Training (Sprint 19,
//  recomendaciones automáticas) sin duplicar esta lógica.
//
//  compareBlueprintToTrader(blueprint, traderMetrics) recibe:
//    - blueprint.objectives  → los objetivos ya definidos en
//      blueprintsData.js (Sprint 13)
//    - traderMetrics         → las métricas actuales del trader
//      (por ahora MOCK_TRADER_METRICS; en el futuro vendrán de
//      Metrix/Trader Score sin cambiar esta función)
//
//  Y devuelve:
//    - metrics   → [{ key, label, current, target, unit, status, higherIsBetter }]
//    - percentage → % de Blueprint completado (0-100)
//    - strengths  → métricas en estado "Cumplido"
//    - weaknesses → métricas en estado "Necesita mejorar"
//
//  No usa IA. No hace cálculos avanzados: solo comparaciones simples
//  con margen de tolerancia, sobre datos mock.
// ─────────────────────────────────────────────

// ── Métricas actuales del trader (mock) ─────────
// Preparadas para sustituirse en el futuro por datos reales de
// Metrix/Trader Score, sin tocar compareBlueprintToTrader ni la UI.
export const MOCK_TRADER_METRICS = {
  winRate: '52',
  profitFactor: '1.4',
  expectancy: '0.18',
  riskPerTrade: '1.5',
  maxDrawdown: '11',
  tradesPerDay: '3',
  avgRR: '1.2',
}

// ── Definición de las 7 métricas comparables ────
// `higherIsBetter: false` para las métricas donde un valor más bajo
// es mejor (riesgo, drawdown, operaciones/día — sobreoperar es malo).
export const COMPARISON_METRICS = [
  { key: 'winRate',       label: 'Win Rate',            unit: '%', higherIsBetter: true  },
  { key: 'profitFactor',  label: 'Profit Factor',       unit: '',  higherIsBetter: true  },
  { key: 'expectancy',    label: 'Expectancy',          unit: 'R', higherIsBetter: true  },
  { key: 'riskPerTrade',  label: 'Riesgo por operación',unit: '%', higherIsBetter: false },
  { key: 'maxDrawdown',   label: 'Drawdown máximo',     unit: '%', higherIsBetter: false },
  { key: 'tradesPerDay',  label: 'Operaciones por día', unit: '',  higherIsBetter: false },
  { key: 'avgRR',         label: 'RR medio',            unit: 'R', higherIsBetter: true  },
]

// Margen de tolerancia para considerar una métrica "cerca del objetivo"
// (comparación simple, sin cálculos avanzados).
const NEAR_TOLERANCE = 0.15 // 15% de diferencia respecto al objetivo

/**
 * Estado de una métrica: 'met' | 'near' | 'behind'
 */
function getMetricStatus(current, target, higherIsBetter) {
  if (target === null || target === undefined || target === '') return 'unset'
  const c = parseFloat(current)
  const t = parseFloat(target)
  if (isNaN(c) || isNaN(t) || t === 0) return 'unset'

  const met = higherIsBetter ? c >= t : c <= t
  if (met) return 'met'

  const diff = Math.abs(c - t) / Math.abs(t)
  if (diff <= NEAR_TOLERANCE) return 'near'

  return 'behind'
}

export const STATUS_META = {
  met:    { label: 'Cumplido',            color: 'var(--pos)' },
  near:   { label: 'Cerca del objetivo',   color: 'var(--neutral)' },
  behind: { label: 'Necesita mejorar',     color: 'var(--neg)' },
  unset:  { label: 'Sin objetivo definido', color: 'var(--text3)' },
}

/**
 * compareBlueprintToTrader — función principal del módulo.
 */
export function compareBlueprintToTrader(blueprint, traderMetrics = MOCK_TRADER_METRICS) {
  const objectives = blueprint?.objectives || {}

  const metrics = COMPARISON_METRICS.map(def => {
    const current = traderMetrics[def.key]
    const target = objectives[def.key]
    const status = getMetricStatus(current, target, def.higherIsBetter)
    return { ...def, current, target, status }
  })

  const withTarget = metrics.filter(m => m.status !== 'unset')
  const metCount = withTarget.filter(m => m.status === 'met').length
  const percentage = withTarget.length
    ? Math.round((metCount / withTarget.length) * 100)
    : 0

  const strengths = metrics.filter(m => m.status === 'met').map(m => m.label)
  const weaknesses = metrics.filter(m => m.status === 'behind').map(m => m.label)

  return { metrics, percentage, strengths, weaknesses }
}
