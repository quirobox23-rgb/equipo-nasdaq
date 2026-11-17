// ─────────────────────────────────────────────
//  TRAINING RECOMMENDATIONS — lógica desacoplada (Sprint 19)
//
//  Módulo independiente: no importa React ni ningún store. Recibe
//  datos planos y devuelve datos planos, igual que
//  config/blueprintComparison.js (Sprint 18), al que llama para NO
//  duplicar el cálculo de distancia Blueprint↔Trader.
//
//  getTrainingRecommendations({ blueprint, traderMetrics, trainingStatus })
//  recibe:
//    - blueprint       → el Blueprint seleccionado (blueprintsData.js)
//    - traderMetrics   → métricas actuales del trader (mock, mismas
//                         que usa blueprintComparison.js)
//    - trainingStatus  → mapa { [trainingItemId]: estado } persistido
//                         en useTrainingStore.js
//
//  Y devuelve:
//    - recommendedTrainings → entrenamientos sugeridos, con su estado
//    - priorityText         → prioridad de la semana (texto simple)
//    - weeklyPlan            → plan semanal mock (L-V)
//    - motivationalMessage   → mensaje aleatorio
//    - overallProgress       → % de entrenamientos completados (de TODOS)
//
//  Reglas simples, sin IA: se recomiendan los entrenamientos cuyas
//  `metricTags` coinciden con las métricas del Blueprint que están
//  en estado "Cerca del objetivo" o "Necesita mejorar", priorizando
//  estas últimas.
// ─────────────────────────────────────────────

import { compareBlueprintToTrader, MOCK_TRADER_METRICS } from './blueprintComparison'
import { computeAccountMetrics, matchBlueprintToAccount } from './blueprintMatchEngine'
import { matchHibridoExpansionToAccount } from './hibridoExpansionEngine'
import { TRAINING_ITEMS } from '@/data/trainingItems'

const MOTIVATIONAL_MESSAGES = [
  'Cada entrenamiento reduce tu distancia al Mapa.',
  'Hoy estás más cerca de tu mejor versión.',
  'El progreso constante supera al talento.',
]

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const REST_DAY = 'Miércoles'

/**
 * getTrainingRecommendations — función principal del módulo.
 */
export function getTrainingRecommendations({
  blueprint,
  traderMetrics = MOCK_TRADER_METRICS,
  trainingStatus = {},
}) {
  if (!blueprint) {
    return {
      comparisonPercentage: 0,
      recommendedTrainings: [],
      priorityText: 'Selecciona un Mapa para recibir recomendaciones.',
      weeklyPlan: [],
      motivationalMessage: MOTIVATIONAL_MESSAGES[0],
      overallProgress: 0,
    }
  }

  // Reutiliza el comparador del Sprint 18 — no se duplica el cálculo.
  const comparison = compareBlueprintToTrader(blueprint, traderMetrics)

  const behindKeys = comparison.metrics.filter(m => m.status === 'behind').map(m => m.key)
  const nearKeys    = comparison.metrics.filter(m => m.status === 'near').map(m => m.key)
  const pendingKeys = [...behindKeys, ...nearKeys]

  // Regla simple: recomendar entrenamientos cuya etiqueta de métrica
  // coincida con alguna métrica pendiente, priorizando "Necesita mejorar".
  let recommended = TRAINING_ITEMS.filter(t => t.metricTags.some(tag => pendingKeys.includes(tag)))
  recommended = [...recommended].sort((a, b) => {
    const aBehind = a.metricTags.some(t => behindKeys.includes(t)) ? 1 : 0
    const bBehind = b.metricTags.some(t => behindKeys.includes(t)) ? 1 : 0
    return bBehind - aBehind
  })

  // Si ya está todo cumplido, se sugieren igualmente los 3 primeros
  // (mantenimiento), para que la sección nunca quede vacía.
  if (recommended.length === 0) recommended = TRAINING_ITEMS.slice(0, 3)

  // Motivo de la recomendación (Sprint 22): qué métrica pendiente del
  // Blueprint es la que justifica sugerir este entrenamiento.
  const metricByKey = Object.fromEntries(comparison.metrics.map(m => [m.key, m]))
  const buildReason = (item) => {
    const matched = item.metricTags
      .map(tag => metricByKey[tag])
      .filter(m => m && (m.status === 'behind' || m.status === 'near'))
      .sort((a, b) => (a.status === 'behind' ? -1 : 1))
    if (matched.length === 0) return 'Mantenimiento: sigue dentro de objetivo en todas las métricas.'
    const m = matched[0]
    return m.status === 'behind'
      ? `Tu ${m.label} necesita mejorar respecto al objetivo del Mapa.`
      : `Tu ${m.label} está cerca del objetivo del Mapa.`
  }

  const recommendedTrainings = recommended.map(t => ({
    ...t,
    status: trainingStatus[t.id] || 'pending',
    reason: buildReason(t),
    blueprintName: blueprint.name,
    blueprintColor: blueprint.color,
  }))

  // Prioridad de la semana: las 2 métricas peor situadas
  const worstLabels = comparison.metrics.filter(m => m.status === 'behind').map(m => m.label)
  const priorityText = worstLabels.length
    ? `Mejorar ${worstLabels.slice(0, 2).join(' y ')}${worstLabels.length > 2 ? '…' : ''}.`
    : 'Mantener el nivel actual: todas las métricas están dentro de objetivo.'

  // Plan semanal (mock, visual): reparte los recomendados entre L-V,
  // dejando el miércoles como descanso fijo.
  let cursor = 0
  const weeklyPlan = WEEK_DAYS.map(day => {
    if (day === REST_DAY) return { day, activity: 'Descanso', rest: true }
    const item = recommendedTrainings.length ? recommendedTrainings[cursor % recommendedTrainings.length] : null
    cursor += 1
    return { day, activity: item ? item.name : 'Revisión semanal', rest: false }
  })

  const motivationalMessage = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]

  const completedCount = TRAINING_ITEMS.filter(t => trainingStatus[t.id] === 'completed').length
  const overallProgress = Math.round((completedCount / TRAINING_ITEMS.length) * 100)

  return {
    comparisonPercentage: comparison.percentage,
    recommendedTrainings,
    priorityText,
    weeklyPlan,
    motivationalMessage,
    overallProgress,
  }
}

/**
 * rankBlueprintsByCompatibility — Sprint 22
 *
 * Compara las métricas actuales del trader con TODOS los Blueprints
 * disponibles y devuelve un ranking por compatibilidad (%), de mayor
 * a menor. Reutiliza compareBlueprintToTrader (Sprint 18): no se
 * duplica ningún cálculo, solo se repite para cada Blueprint.
 *
 * El usuario decide siempre cuál usar — esta función solo informa,
 * nunca asigna nada por sí sola.
 */
// accountMetrics real (computeAccountMetrics de blueprintMatchEngine.js)
// — cuando se pasa, se usa el motor REAL (matchBlueprintToAccount),
// no el mock. Solo cae a MOCK_TRADER_METRICS/compareBlueprintToTrader
// si de verdad no hay cuenta con datos todavía (ranking genérico,
// sin ninguna cuenta seleccionada de referencia).
// accountMetrics real (computeAccountMetrics de blueprintMatchEngine.js)
// — cuando se pasa, se usa el motor REAL (matchBlueprintToAccount o
// matchHibridoExpansionToAccount, según el templateType de cada Mapa),
// no el mock. Solo cae a MOCK_TRADER_METRICS/compareBlueprintToTrader
// si de verdad no hay cuenta con datos todavía (ranking genérico,
// sin ninguna cuenta seleccionada de referencia).
//
// account y trades son necesarios además de accountMetrics porque
// matchHibridoExpansionToAccount (Modelo 3+) recalcula sus propias
// métricas de Distribución de RR a partir de los trades reales, no
// solo del accountMetrics "plano" que usa rr-fijo.
export function rankBlueprintsByCompatibility(blueprints, accountMetrics = null, account = null, trades = null) {
  return blueprints
    .map(blueprint => {
      let compatibility
      if (!accountMetrics) {
        compatibility = compareBlueprintToTrader(blueprint, MOCK_TRADER_METRICS).percentage
      } else if (blueprint.templateType === 'hibrido-expansion') {
        compatibility = matchHibridoExpansionToAccount(blueprint, account, trades || []).compatibility
      } else {
        compatibility = matchBlueprintToAccount(blueprint, accountMetrics).compatibility
      }
      return { blueprint, compatibility }
    })
    .sort((a, b) => b.compatibility - a.compatibility)
}
