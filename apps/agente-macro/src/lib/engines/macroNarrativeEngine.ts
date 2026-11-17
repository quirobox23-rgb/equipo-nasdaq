/**
 * macroNarrativeEngine.ts — Macro Narrative Engine (Sprint 4).
 *
 * Esta capa no vuelve a leer los eventos desde cero: consume la
 * salida ya calculada en weeklyMacroEngine.ts (Sprint 3) —
 * termómetro, contexto de régimen, impacto por activo — y razona
 * sobre relaciones de segundo orden, no solo sobre impactos directos.
 *
 * No modifica interpretationEngine.ts, weeklyMacroEngine.ts ni
 * mentorEngine.ts (Mentor IA sigue analizando evento por evento,
 * exactamente igual). Todo aquí es un módulo de lectura adicional.
 */
import type { MacroEvent } from '@/types/macro'
import {
  computeWeeklyMacroContext, computeMacroThermometer, computeExpectedAssetImpact,
  type ThermometerReading, type AssetImpact,
} from './weeklyMacroEngine'

const th = (readings: ThermometerReading[], label: string) => readings.find(r => r.label === label)

// ─────────────────────────────────────────────
// 2. MACRO REGIME DETECTOR
// ─────────────────────────────────────────────
export interface MacroRegime {
  name: string
  description: string
  probability: number // 0-100
  color: 'emerald' | 'red' | 'amber' | 'zinc' | 'blue'
  explanation: string
}

interface RegimeCandidate extends MacroRegime { score: number }

/**
 * Clasifica el régimen macro combinando 4 ejes ya calculados en el
 * Sprint 3 (inflación, empleo→crecimiento, Fed, liquidez) — no
 * introduce ninguna métrica nueva, solo las combina.
 */
export function detectMacroRegime(weekEvents: MacroEvent[]): MacroRegime {
  const thermo = computeMacroThermometer(weekEvents)
  const inflacion = th(thermo, 'Inflación')
  const empleo = th(thermo, 'Empleo')
  const crecimiento = th(thermo, 'Crecimiento')
  const fed = th(thermo, 'Política monetaria')
  const liquidez = th(thermo, 'Liquidez')

  const infDown = (inflacion?.direction ?? 'neut') !== 'down' ? 0 : 1 // down = risk-on friendly (desinflación)
  const infUp = (inflacion?.direction ?? 'neut') === 'up' ? 1 : 0
  const empStrong = (empleo?.direction ?? 'neut') !== 'down' ? 1 : 0
  const growUp = (crecimiento?.direction ?? 'neut') === 'up' ? 1 : 0
  const growDown = (crecimiento?.direction ?? 'neut') === 'down' ? 1 : 0
  const fedHawkish = (fed?.direction ?? 'neut') === 'down' ? 1 : 0 // 'down' en el termómetro = presiona riesgo (hawkish)
  const fedDovish = (fed?.direction ?? 'neut') === 'up' ? 1 : 0
  const liqHigh = (liquidez?.intensity ?? 0) >= 55 ? 1 : 0

  const candidates: RegimeCandidate[] = [
    {
      name: 'Goldilocks', color: 'emerald', score: infDown + empStrong + (growDown ? 0 : 1),
      description: 'Inflación moderándose sin deterioro del empleo.',
      explanation: 'La combinación de menor inflación y mercado laboral resistente es el escenario más favorable para activos de riesgo.',
      probability: 0,
    },
    {
      name: 'Reflation', color: 'amber', score: infUp + growUp,
      description: 'Inflación y crecimiento acelerando a la vez.',
      explanation: 'El repunte conjunto de precios y actividad sugiere un ciclo expansivo con presión inflacionaria creciente.',
      probability: 0,
    },
    {
      name: 'Stagflation', color: 'red', score: infUp + growDown,
      description: 'Inflación al alza con crecimiento débil.',
      explanation: 'El peor combo para el mercado: la Fed no puede bajar tipos por la inflación, pero el crecimiento ya se resiente.',
      probability: 0,
    },
    {
      name: 'Soft Landing', color: 'emerald', score: infDown + (growDown && !empStrong ? 0 : 1),
      description: 'Desaceleración controlada sin recesión.',
      explanation: 'La economía se enfría de forma ordenada, permitiendo a la Fed relajar la política sin señales de ruptura.',
      probability: 0,
    },
    {
      name: 'Hard Landing / Recession Risk', color: 'red', score: growDown + (empStrong ? 0 : 1) + infDown,
      description: 'Deterioro simultáneo de crecimiento y empleo.',
      explanation: 'Cuando el empleo empieza a fallar junto al crecimiento, el riesgo de recesión pasa a dominar la narrativa.',
      probability: 0,
    },
    {
      name: 'Late Cycle / Risk OFF', color: 'red', score: fedHawkish + (liqHigh ? 0 : 1),
      description: 'Fed restrictiva con liquidez ajustándose.',
      explanation: 'Un tono hawkish sostenido junto a menor liquidez suele preceder a fases de mayor cautela en el mercado.',
      probability: 0,
    },
    {
      name: 'Liquidity Driven Rally / Risk ON', color: 'emerald', score: fedDovish + liqHigh,
      description: 'Fed acomodaticia con liquidez abundante.',
      explanation: 'Con la Fed dovish y liquidez amplia, los activos de riesgo tienden a subir independientemente de los fundamentales.',
      probability: 0,
    },
  ]

  const maxScore = Math.max(1, ...candidates.map(c => c.score))
  const totalScore = candidates.reduce((s, c) => s + c.score, 0) || 1
  candidates.forEach(c => { c.probability = Math.round((c.score / totalScore) * 100) })

  const winner = [...candidates].sort((a, b) => b.score - a.score)[0]
  // Si no hay una señal clara (todo empatado a 0), el régimen por defecto es neutral/rango.
  if (maxScore === 0) {
    return { name: 'Range / Sin régimen claro', description: 'Sin catalizadores suficientes para clasificar el ciclo.', probability: 25, color: 'zinc', explanation: 'Los datos disponibles esta semana no son suficientes para inclinar el régimen hacia ningún lado.' }
  }
  return winner
}

// ─────────────────────────────────────────────
// 7. CONFLICT DETECTOR
// ─────────────────────────────────────────────
export interface DataConflict {
  message: string
}

export function detectConflicts(weekEvents: MacroEvent[]): DataConflict[] {
  const thermo = computeMacroThermometer(weekEvents)
  const conflicts: DataConflict[] = []

  const inflacion = th(thermo, 'Inflación')
  const empleo = th(thermo, 'Empleo')
  const crecimiento = th(thermo, 'Crecimiento')
  const fed = th(thermo, 'Política monetaria')

  if (inflacion?.direction === 'down' && empleo?.direction === 'up' && (empleo?.intensity ?? 0) > 50) {
    conflicts.push({ message: 'El mercado recibe señales mixtas: la inflación se modera pero el empleo se muestra extremadamente fuerte. Probablemente aumente la volatilidad hasta que nuevos datos resuelvan el conflicto.' })
  }
  if (crecimiento?.direction === 'up' && fed?.direction === 'down') {
    conflicts.push({ message: 'El crecimiento acelera mientras la Fed mantiene un tono restrictivo: la divergencia entre actividad y política monetaria puede generar reacciones erráticas.' })
  }
  if (inflacion?.direction === 'up' && crecimiento?.direction === 'up' && fed?.direction === 'up') {
    conflicts.push({ message: 'Los datos apuntan simultáneamente a más inflación, más crecimiento y una Fed más dovish: esta combinación es inconsistente y sugiere que el mercado podría estar sobre-reaccionando a un solo dato.' })
  }

  return conflicts
}

// ─────────────────────────────────────────────
// 6. MARKET CONFIDENCE SCORE
// ─────────────────────────────────────────────
export function computeMarketConfidence(weekEvents: MacroEvent[], regime: MacroRegime, conflicts: DataConflict[]): { score: number; label: string } {
  const context = computeWeeklyMacroContext(weekEvents)
  let score = Math.round(regime.probability * 0.5 + context.conviction * 0.5)
  score -= conflicts.length * 15
  score = Math.max(5, Math.min(97, score))
  const label = score >= 75 ? 'Narrativa muy consistente' : score >= 50 ? 'Narrativa razonablemente consistente' : 'Datos contradictorios: mercado probablemente errático'
  return { score, label }
}

// ─────────────────────────────────────────────
// 5. SECOND ORDER EFFECTS
// ─────────────────────────────────────────────
export interface EffectChainNode { label: string; direction: 'up' | 'down' | 'neut' }

/**
 * Cadena de efectos de segundo orden: no se limita al dato → activo
 * directo, encadena catalizador → Fed → yields → USD → materias
 * primas → sectores, usando las mismas direcciones ya calculadas en
 * el termómetro y en computeExpectedAssetImpact (Sprint 3).
 */
export function computeSecondOrderEffects(weekEvents: MacroEvent[]): EffectChainNode[] {
  const thermo = computeMacroThermometer(weekEvents)
  const assets = computeExpectedAssetImpact(weekEvents)
  const byAsset = Object.fromEntries(assets.map(a => [a.asset, a]))
  const inflacion = th(thermo, 'Inflación')
  const fed = th(thermo, 'Política monetaria')

  const fedStance: EffectChainNode = fed?.direction === 'down'
    ? { label: 'Fed mantiene/sube tipos', direction: 'up' }
    : fed?.direction === 'up'
      ? { label: 'Fed recorta/relaja tono', direction: 'down' }
      : { label: 'Fed sin cambios de tono', direction: 'neut' }

  const yieldsDir = fedStance.direction === 'up' ? 'up' : fedStance.direction === 'down' ? 'down' : 'neut'
  const usdDir = byAsset['USD']?.netScore ? (byAsset['USD'].netScore > 0.15 ? 'up' : byAsset['USD'].netScore < -0.15 ? 'down' : 'neut') : yieldsDir
  const goldDir = byAsset['GOLD']?.netScore ? (byAsset['GOLD'].netScore > 0.15 ? 'up' : byAsset['GOLD'].netScore < -0.15 ? 'down' : 'neut') : (usdDir === 'up' ? 'down' : usdDir === 'down' ? 'up' : 'neut')
  const nqDir = byAsset['NQ']?.netScore ? (byAsset['NQ'].netScore > 0.15 ? 'up' : byAsset['NQ'].netScore < -0.15 ? 'down' : 'neut') : 'neut'
  const rotationToValue: EffectChainNode = nqDir === 'down' && usdDir === 'up'
    ? { label: 'Rotación hacia Value', direction: 'up' }
    : { label: 'Tecnología mantiene liderazgo', direction: nqDir }

  return [
    { label: inflacion?.label ?? 'Inflación', direction: inflacion?.direction ?? 'neut' },
    fedStance,
    { label: 'Yields', direction: yieldsDir },
    { label: 'Fortaleza USD', direction: usdDir },
    { label: 'Materias primas / Oro', direction: goldDir },
    { label: 'Tecnología (NASDAQ)', direction: nqDir },
    rotationToValue,
  ]
}

// ─────────────────────────────────────────────
// 4. EXPECTATION VS REALITY
// ─────────────────────────────────────────────
export interface ExpectationRealityRow {
  event: MacroEvent
  expected: string
  reality: string
  logicalReaction: string
  historicalReaction: string
  probableReaction: string
}

export function computeExpectationVsReality(weekEvents: MacroEvent[]): ExpectationRealityRow[] {
  return weekEvents
    .filter(e => e.direction && e.direction !== 'pending' && e.forecast != null)
    .map(e => {
      const beat = e.direction === 'beat'
      const miss = e.direction === 'miss'
      const logicalReaction = beat
        ? 'Sorpresa positiva → reacción alcista inmediata esperable.'
        : miss
          ? 'Sorpresa negativa → reacción bajista inmediata esperable.'
          : 'Dato en línea → sin reacción direccional clara.'

      // El mercado a veces reacciona en contra del dato porque ya
      // estaba descontado o porque cambia la expectativa de Fed —
      // se explica, no se predice al azar.
      const positioningAlreadyPricedIn = e.impact === 'high' && (beat || miss)
      const historicalReaction = positioningAlreadyPricedIn
        ? 'Históricamente, en datos de alto impacto ya anticipados, el movimiento inicial puede revertirse en las horas siguientes si el posicionamiento previo ya reflejaba el resultado.'
        : 'Históricamente, el mercado suele seguir la dirección lógica del dato en la primera hora.'

      const probableReaction = positioningAlreadyPricedIn
        ? 'Reacción probable: impulso inicial en la dirección lógica, con riesgo de reversión parcial si no hay confirmación de otros datos.'
        : `Reacción probable: continuación ${beat ? 'alcista' : miss ? 'bajista' : 'lateral'} mientras no aparezca un catalizador contradictorio.`

      return {
        event: e,
        expected: e.forecast != null ? String(e.forecast) : 'Sin consenso publicado',
        reality: e.actual != null ? String(e.actual) : '—',
        logicalReaction,
        historicalReaction,
        probableReaction,
      }
    })
}

// ─────────────────────────────────────────────
// 8. MARKET PHASE (solo contexto macro, no precio)
// ─────────────────────────────────────────────
export type MarketPhase = 'Acumulación' | 'Markup' | 'Distribución' | 'Markdown' | 'Late Trend' | 'Reversal' | 'Range'

export function detectMarketPhase(weekEvents: MacroEvent[], regime: MacroRegime): { phase: MarketPhase; explanation: string } {
  const context = computeWeeklyMacroContext(weekEvents)
  const conflicts = detectConflicts(weekEvents)

  if (conflicts.length >= 2) return { phase: 'Range', explanation: 'Señales mixtas: el contexto macro no define una dirección predominante todavía.' }
  if (regime.name.includes('Goldilocks') || regime.name.includes('Liquidity Driven')) {
    return context.conviction > 70
      ? { phase: 'Markup', explanation: 'Contexto favorable y consistente: fase de tendencia alcista sostenida por el fondo macro.' }
      : { phase: 'Acumulación', explanation: 'El contexto empieza a ser favorable pero la convicción todavía es moderada.' }
  }
  if (regime.name.includes('Stagflation') || regime.name.includes('Hard Landing')) {
    return context.conviction > 70
      ? { phase: 'Markdown', explanation: 'Contexto claramente adverso y consistente: presión bajista sostenida por el fondo macro.' }
      : { phase: 'Distribución', explanation: 'El contexto empieza a deteriorarse; posible salida gradual de posiciones de riesgo.' }
  }
  if (regime.name.includes('Late Cycle')) return { phase: 'Late Trend', explanation: 'La tendencia previa sigue vigente pero el contexto sugiere que está en su fase final.' }
  if (regime.name.includes('Reflation')) return { phase: 'Reversal', explanation: 'El cambio simultáneo de inflación y crecimiento sugiere un punto de inflexión en la narrativa dominante.' }
  return { phase: 'Range', explanation: 'El contexto macro no marca una fase dominante clara esta semana.' }
}

// ─────────────────────────────────────────────
// 9. PLAYBOOK IA (caminos posibles, no señales)
// ─────────────────────────────────────────────
export interface PlaybookScenario {
  condition: string
  scenario: string
}

export function buildPlaybook(weekEvents: MacroEvent[], regime: MacroRegime): PlaybookScenario[] {
  const context = computeWeeklyMacroContext(weekEvents)
  const mainEvent = context.mainEvent?.name ?? 'el evento principal'

  return [
    { condition: `Si NASDAQ rompe máximos tras ${mainEvent} favorable`, scenario: `Escenario A — continuación de ${regime.name}, con rotación hacia el activo de mayor convicción de la semana.` },
    { condition: 'Si los yields superan el máximo reciente', scenario: 'Escenario B — presión sobre múltiplos de crecimiento; probable rotación defensiva y fortaleza del USD.' },
    { condition: 'Si el VIX rompe al alza de forma sostenida', scenario: 'Escenario C — el mercado empieza a priceear un cambio de régimen; aumenta la probabilidad de un movimiento de aversión al riesgo.' },
  ]
}

// ─────────────────────────────────────────────
// 10. CONVICTION MATRIX (extiende AssetImpact con catalizador)
// ─────────────────────────────────────────────
export interface ConvictionRow extends AssetImpact {
  catalyst: string
  aiConfidence: number
}

export function buildConvictionMatrix(weekEvents: MacroEvent[]): ConvictionRow[] {
  const assets = computeExpectedAssetImpact(weekEvents)
  const context = computeWeeklyMacroContext(weekEvents)
  return assets.map(a => ({
    ...a,
    catalyst: context.dominantCatalyst,
    aiConfidence: Math.round((a.conviction + context.conviction) / 2),
  }))
}

// ─────────────────────────────────────────────
// 11. SEMÁFORO MACRO (reusa el termómetro del Sprint 3)
// ─────────────────────────────────────────────
export interface SemaphoreReading { label: string; emoji: '🟢' | '🟡' | '🔴' }

export function buildMacroSemaphore(weekEvents: MacroEvent[]): SemaphoreReading[] {
  const thermo = computeMacroThermometer(weekEvents)
  return thermo.map(r => ({
    label: r.label,
    emoji: r.direction === 'up' ? '🟢' : r.direction === 'down' ? '🔴' : '🟡',
  }))
}

// ─────────────────────────────────────────────
// 12. TIMELINE ESPERADA (comportamiento habitual, no predicción)
// ─────────────────────────────────────────────
export interface TimelineStep { label: string; description: string }

export function buildExpectedTimeline(weekEvents: MacroEvent[]): TimelineStep[] {
  const context = computeWeeklyMacroContext(weekEvents)
  const volLabel = context.volatilityLevel.toLowerCase()
  return [
    { label: 'Antes del dato', description: 'Posicionamiento previo y rango de consenso ya reflejado en precio.' },
    { label: 'Primer movimiento', description: `Reacción inicial impulsiva, con volatilidad esperada ${volLabel}.` },
    { label: 'Repricing', description: 'El mercado ajusta expectativas de Fed y tipos según la sorpresa del dato.' },
    { label: 'Movimiento principal', description: 'Tendencia direccional dominante una vez confirmado el sesgo del dato.' },
    { label: 'Posible reversión', description: 'Riesgo de reversión parcial si el movimiento inicial ya estaba descontado.' },
    { label: 'Cierre esperado', description: 'Consolidación hacia el sesgo semanal dominante salvo nuevo catalizador.' },
  ]
}

// ─────────────────────────────────────────────
// 3. MARKET STORY + 13. RIESGOS DE LA NARRATIVA
// ─────────────────────────────────────────────
export interface MarketStoryResult {
  story: string[]
  confidence: { score: number; label: string }
  conflicts: DataConflict[]
  invalidators: string[]
}

export function buildMarketStory(weekEvents: MacroEvent[], regime: MacroRegime): MarketStoryResult {
  const context = computeWeeklyMacroContext(weekEvents)
  const conflicts = detectConflicts(weekEvents)
  const confidence = computeMarketConfidence(weekEvents, regime, conflicts)
  const assets = computeExpectedAssetImpact(weekEvents)
  const favored = [...assets].sort((a, b) => b.netScore - a.netScore)[0]

  const story: string[] = []
  story.push(`El mercado continúa descontando un escenario de ${regime.name}: ${regime.description.toLowerCase()}`)
  story.push(regime.explanation)
  if (favored) {
    story.push(`Los inversores mantienen sesgo hacia ${favored.label}, esperando que ${context.dominantCatalyst.toLowerCase()} siga confirmando esta lectura.`)
  }
  if (conflicts.length > 0) {
    story.push(conflicts[0].message)
  }

  const invalidators: string[] = []
  const thermo = computeMacroThermometer(weekEvents)
  const inflacion = th(thermo, 'Inflación')
  const empleo = th(thermo, 'Empleo')
  const fed = th(thermo, 'Política monetaria')
  if (inflacion) invalidators.push(inflacion.direction === 'down' ? 'El Core CPI sorprende al alza.' : 'La inflación se modera de forma más agresiva de lo esperado.')
  if (fed) invalidators.push(fed.direction !== 'down' ? 'Warsh adopta un tono más hawkish de lo descontado.' : 'La Fed sorprende con un giro dovish antes de lo previsto.')
  if (empleo) invalidators.push(empleo.direction === 'down' ? 'El empleo se deteriora más rápido de lo esperado.' : 'El empleo vuelve a acelerarse con fuerza.')

  return { story, confidence, conflicts, invalidators }
}

// ─────────────────────────────────────────────
// 14. RESUMEN EJECUTIVO
// ─────────────────────────────────────────────
export interface ExecutiveSummary {
  dominantNarrative: string
  favoredAsset: string
  biggestRisk: string
  keyEvent: string
  convictionLevel: number
}

export function buildExecutiveSummary(weekEvents: MacroEvent[], regime: MacroRegime): ExecutiveSummary {
  const context = computeWeeklyMacroContext(weekEvents)
  const assets = computeExpectedAssetImpact(weekEvents)
  const favored = [...assets].sort((a, b) => b.netScore - a.netScore)[0]
  const worst = [...assets].sort((a, b) => a.netScore - b.netScore)[0]

  return {
    dominantNarrative: regime.name,
    favoredAsset: favored ? favored.label : '—',
    biggestRisk: worst ? `Reversión en ${worst.label}` : 'Sorpresa en el dato principal',
    keyEvent: context.mainEvent?.name ?? '—',
    convictionLevel: context.conviction,
  }
}

// ─────────────────────────────────────────────
// 1. MACRO NARRATIVE ENGINE — orquestador
// ─────────────────────────────────────────────
export interface FullMacroNarrative {
  regime: MacroRegime
  executiveSummary: ExecutiveSummary
  marketStory: MarketStoryResult
  secondOrderEffects: EffectChainNode[]
  expectationVsReality: ExpectationRealityRow[]
  marketPhase: { phase: MarketPhase; explanation: string }
  playbook: PlaybookScenario[]
  convictionMatrix: ConvictionRow[]
  semaphore: SemaphoreReading[]
  timeline: TimelineStep[]
}

export function generateMacroNarrative(weekEvents: MacroEvent[]): FullMacroNarrative {
  const regime = detectMacroRegime(weekEvents)
  return {
    regime,
    executiveSummary: buildExecutiveSummary(weekEvents, regime),
    marketStory: buildMarketStory(weekEvents, regime),
    secondOrderEffects: computeSecondOrderEffects(weekEvents),
    expectationVsReality: computeExpectationVsReality(weekEvents),
    marketPhase: detectMarketPhase(weekEvents, regime),
    playbook: buildPlaybook(weekEvents, regime),
    convictionMatrix: buildConvictionMatrix(weekEvents),
    semaphore: buildMacroSemaphore(weekEvents),
    timeline: buildExpectedTimeline(weekEvents),
  }
}
