/**
 * weeklyMacroEngine.ts — Macro Context Dashboard (Sprint 3).
 *
 * Toda la capa de contexto macro semanal se apoya en lo que YA existe:
 *  - interpretEvent() (interpretationEngine.ts) para las señales por
 *    activo (NQ/USD/GOLD) y el régimen (risk-on/risk-off/neutral) de
 *    cada evento — no se reimplementa ninguna regla de interpretación.
 *  - KNOWN_EVENT_NAMES (mockEvents.ts) para catalogar catalizadores.
 *
 * No modifica ni importa nada que altere el Mentor IA ni el sistema
 * de escenarios Superior/En línea/Inferior: solo LEE sus resultados
 * para agregarlos a nivel semanal.
 */
import type { MacroEvent, MarketContextRegime, SignalDirection } from '@/types/macro'
import { interpretEvent } from './interpretationEngine'

const IMPACT_WEIGHT: Record<string, number> = { high: 3, med: 1, low: 0.3 }
const impactOf = (e: MacroEvent) => IMPACT_WEIGHT[e.impact ?? 'low'] ?? 0

// ── Catálogo de catalizadores por palabra clave (mismo criterio para
// todo el motor: catalizador dominante, termómetro, correlaciones) ──
const CATALYST_KEYWORDS: Record<string, string[]> = {
  Inflación:  ['CPI', 'PCE', 'PPI'],
  Empleo:     ['NFP', 'Claims', 'Employment', 'JOLTS', 'Unemployment', 'Payroll', 'Earnings m/m'],
  Fed:        ['FOMC', 'Fed', 'Powell', 'Warsh', 'Rate Decision'],
  Consumo:    ['Retail Sales', 'Consumer'],
  Tecnología: ['ISM Services', 'Tech'],
  Liquidez:   ['GDP', 'ISM Manufacturing'],
}

function catalystOf(event: MacroEvent): string {
  const name = event.name ?? ''
  for (const [catalyst, keywords] of Object.entries(CATALYST_KEYWORDS)) {
    if (keywords.some(k => name.toLowerCase().includes(k.toLowerCase()))) return catalyst
  }
  return 'General'
}

// ─────────────────────────────────────────────
// 1. MACRO CONTEXT DASHBOARD (resumen semanal)
// ─────────────────────────────────────────────
export type VolatilityLevel = 'Baja' | 'Media' | 'Alta' | 'Muy Alta'

export interface WeeklyMacroContext {
  regime: MarketContextRegime
  regimeLabel: string
  conviction: number // 0-100
  mainEvent: MacroEvent | null
  dominantCatalyst: string
  volatilityLevel: VolatilityLevel
  expansionProbability: number // 0-100
}

const REGIME_LABEL: Record<MarketContextRegime, string> = {
  'risk-on':  'Risk ON',
  'risk-off': 'Risk OFF',
  'neutral':  'Neutral',
}

export function computeWeeklyMacroContext(weekEvents: MacroEvent[]): WeeklyMacroContext {
  let riskOnScore = 0, riskOffScore = 0, totalWeight = 0

  weekEvents.forEach(e => {
    const interp = interpretEvent(e)
    if (!interp) return
    const w = impactOf(e)
    totalWeight += w
    if (interp.context === 'risk-on') riskOnScore += w
    else if (interp.context === 'risk-off') riskOffScore += w
  })

  const net = riskOnScore - riskOffScore
  const regime: MarketContextRegime = totalWeight === 0
    ? 'neutral'
    : Math.abs(net) / totalWeight < 0.15 ? 'neutral' : net > 0 ? 'risk-on' : 'risk-off'

  const conviction = totalWeight === 0 ? 0 : Math.round(Math.min(100, (Math.abs(net) / totalWeight) * 70 + 30))

  const sorted = [...weekEvents].sort((a, b) => impactOf(b) - impactOf(a))
  const mainEvent = sorted[0] ?? null

  const catalystCounts: Record<string, number> = {}
  weekEvents.forEach(e => { const c = catalystOf(e); catalystCounts[c] = (catalystCounts[c] ?? 0) + impactOf(e) })
  const dominantCatalyst = Object.entries(catalystCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'General'

  const volScore = weekEvents.reduce((s, e) => s + impactOf(e), 0)
  const volatilityLevel: VolatilityLevel =
    volScore >= 9 ? 'Muy Alta' : volScore >= 5 ? 'Alta' : volScore >= 2 ? 'Media' : 'Baja'

  // Probabilidad de expansión del rango semanal: más eventos de alto
  // impacto y mayor divergencia de régimen = mayor probabilidad de
  // que la semana rompa el rango habitual.
  const highImpactCount = weekEvents.filter(e => e.impact === 'high').length
  const expansionProbability = Math.round(Math.min(95, 35 + highImpactCount * 12 + conviction * 0.3))

  return { regime, regimeLabel: REGIME_LABEL[regime], conviction, mainEvent, dominantCatalyst, volatilityLevel, expansionProbability }
}

// ─────────────────────────────────────────────
// 2. ATM DEL CICLO SEMANAL
// ─────────────────────────────────────────────
export interface CyclePhaseDay {
  label: string
  phase: string
  hasEvents: boolean
}

const BASE_PHASES = ['Posicionamiento', 'Reajuste', 'Confirmación', 'Continuación', 'Distribución']

/**
 * La fase depende de qué día concentra el mayor peso de eventos: el
 * día de mayor impacto se etiqueta "Confirmación", el anterior
 * "Reajuste" (el mercado se reposiciona antes del dato) y los
 * posteriores "Continuación"/"Distribución". No está hardcodeado a
 * un día fijo: se recalcula según `weekEventsByDay`.
 */
export function computeWeeklyCycle(weekEventsByDay: MacroEvent[][], dayLabels: string[]): CyclePhaseDay[] {
  const weights = weekEventsByDay.map(day => day.reduce((s, e) => s + impactOf(e), 0))
  const peakIdx = weights.reduce((best, w, i) => (w > weights[best] ? i : best), 0)

  return dayLabels.map((label, i) => {
    let phase: string
    if (weights[i] === 0) {
      phase = i < peakIdx ? 'Posicionamiento' : i === peakIdx ? 'Confirmación' : 'Distribución'
    } else if (i === peakIdx) {
      phase = 'Confirmación'
    } else if (i === peakIdx - 1) {
      phase = 'Reajuste'
    } else if (i < peakIdx) {
      phase = 'Posicionamiento'
    } else if (i === peakIdx + 1) {
      phase = 'Continuación'
    } else {
      phase = 'Distribución'
    }
    return { label, phase, hasEvents: weekEventsByDay[i].length > 0 }
  })
}

// ─────────────────────────────────────────────
// 3. MAPA DE VOLATILIDAD SEMANAL
// ─────────────────────────────────────────────
export interface VolatilityBar {
  label: string
  score: number
  bars: number // 1-10, para renderizar como barra horizontal
}

export function computeVolatilityMap(weekEventsByDay: MacroEvent[][], dayLabels: string[]): VolatilityBar[] {
  const scores = weekEventsByDay.map(day =>
    day.reduce((s, e) => s + impactOf(e) + day.length * 0.15, 0)
  )
  const max = Math.max(1, ...scores)
  return dayLabels.map((label, i) => ({
    label,
    score: Math.round(scores[i] * 10) / 10,
    bars: Math.max(scores[i] > 0 ? 1 : 0, Math.round((scores[i] / max) * 10)),
  }))
}

// ─────────────────────────────────────────────
// 5. IMPACTO ESPERADO EN ACTIVOS
// ─────────────────────────────────────────────
export type AssetArrow = '↑↑' | '↑' | '→' | '↓' | '↓↓'

export interface AssetImpact {
  asset: string
  label: string
  arrow: AssetArrow
  impact: 'Alta' | 'Media' | 'Baja'
  conviction: number
  netScore: number // -1..1, para reutilizar en correlaciones
}

const ASSET_LABEL: Record<string, string> = { NQ: 'NASDAQ', USD: 'USD', GOLD: 'ORO' }
const ASSET_ALIAS: Record<string, string> = { NASDAQ: 'NQ' }
const DIR_SCORE: Record<SignalDirection, number> = { up: 1, down: -1, neut: 0 }
const STRENGTH_WEIGHT: Record<string, number> = { strong: 1, moderate: 0.6, weak: 0.3 }

function arrowFor(netScore: number): AssetArrow {
  if (netScore >= 0.6) return '↑↑'
  if (netScore >= 0.15) return '↑'
  if (netScore <= -0.6) return '↓↓'
  if (netScore <= -0.15) return '↓'
  return '→'
}

export function computeExpectedAssetImpact(weekEvents: MacroEvent[]): AssetImpact[] {
  // Agrega las señales por activo (asset) que ya devuelve interpretEvent
  // — no se inventa ninguna dirección nueva para NQ/USD/GOLD.
  const totals: Record<string, { weighted: number; weight: number; count: number }> = {}

  weekEvents.forEach(e => {
    const interp = interpretEvent(e)
    if (!interp) return
    const w = impactOf(e)
    interp.signals.forEach(s => {
      // Las reglas usan "NQ"; las fichas de knowledge, "NASDAQ". Mismo activo:
      // se unifican para no mostrar dos filas de NASDAQ.
      const asset = ASSET_ALIAS[s.asset] ?? s.asset
      if (!totals[asset]) totals[asset] = { weighted: 0, weight: 0, count: 0 }
      const sw = STRENGTH_WEIGHT[s.strength] ?? 0.5
      totals[asset].weighted += DIR_SCORE[s.dir] * sw * w
      totals[asset].weight += sw * w
      totals[asset].count += 1
    })
  })

  const results: AssetImpact[] = Object.entries(totals).map(([asset, t]) => {
    const net = t.weight > 0 ? t.weighted / t.weight : 0
    return {
      asset,
      label: ASSET_LABEL[asset] ?? asset,
      arrow: arrowFor(net),
      impact: Math.abs(net) >= 0.6 ? 'Alta' : Math.abs(net) >= 0.25 ? 'Media' : 'Baja',
      conviction: Math.round(Math.min(97, 50 + Math.abs(net) * 45 + Math.min(t.count, 4) * 2)),
      netScore: net,
    }
  })

  // VIX y Bonos/Yields: la app no tiene una señal directa para ellos
  // en interpretEvent, así que se derivan del régimen agregado
  // (risk-off ⇒ VIX y yields al alza), no de un dato aleatorio.
  // Si algún evento ya trae señal propia de VIX (las fichas de knowledge
  // pueden incluirlo), no se agrega la derivada: antes salía VIX dos veces.
  const context = computeWeeklyMacroContext(weekEvents)
  const regimeScore = context.regime === 'risk-off' ? 0.5 : context.regime === 'risk-on' ? -0.4 : 0
  if (!totals['VIX']) results.push({
    asset: 'VIX', label: 'VIX', arrow: arrowFor(regimeScore),
    impact: context.regime === 'neutral' ? 'Baja' : 'Media',
    conviction: context.conviction, netScore: regimeScore,
  })
  if (!totals['YIELDS']) results.push({
    asset: 'YIELDS', label: 'BONOS (Yields)', arrow: arrowFor(regimeScore * 0.8),
    impact: context.regime === 'neutral' ? 'Baja' : 'Media',
    conviction: Math.max(40, context.conviction - 10), netScore: regimeScore * 0.8,
  })

  // Activos fuera de la lista (ej. SPX, que llega desde las fichas) van al
  // final; antes indexOf = -1 los ponía primeros, delante de NASDAQ.
  const order = ['NQ', 'USD', 'GOLD', 'VIX', 'YIELDS']
  const rank = (asset: string) => { const i = order.indexOf(asset); return i === -1 ? order.length : i }
  return results.sort((a, b) => rank(a.asset) - rank(b.asset))
}

// ─────────────────────────────────────────────
// 6. PROBABILIDAD HISTÓRICA (estático, preparado para conectar a BD)
// ─────────────────────────────────────────────
export interface HistoricalProbability {
  avgMove: string
  maxMove: string
  avgTimeToImpulse: string
  continuationPct: number
  reversionPct: number
  source: 'static' | 'historical-db'
}

// Datos estáticos de referencia por tipo de catalizador (no por
// evento exacto): a la espera de conectarse a una base de datos
// histórica real, tal como pide el Sprint.
const HISTORICAL_BY_CATALYST: Record<string, HistoricalProbability> = {
  Inflación: { avgMove: '0.8% NQ', maxMove: '2.4% NQ', avgTimeToImpulse: '4 min', continuationPct: 62, reversionPct: 38, source: 'static' },
  Empleo:    { avgMove: '0.9% NQ', maxMove: '2.7% NQ', avgTimeToImpulse: '3 min', continuationPct: 58, reversionPct: 42, source: 'static' },
  Fed:       { avgMove: '1.3% NQ', maxMove: '3.5% NQ', avgTimeToImpulse: '8 min', continuationPct: 66, reversionPct: 34, source: 'static' },
  Consumo:   { avgMove: '0.5% NQ', maxMove: '1.6% NQ', avgTimeToImpulse: '5 min', continuationPct: 54, reversionPct: 46, source: 'static' },
  General:   { avgMove: '0.4% NQ', maxMove: '1.2% NQ', avgTimeToImpulse: '6 min', continuationPct: 50, reversionPct: 50, source: 'static' },
}

export function computeHistoricalProbability(catalyst: string): HistoricalProbability {
  return HISTORICAL_BY_CATALYST[catalyst] ?? HISTORICAL_BY_CATALYST.General
}

// ─────────────────────────────────────────────
// 7. TERMÓMETRO MACRO
// ─────────────────────────────────────────────
export interface ThermometerReading {
  label: string
  intensity: number // 0-100
  direction: SignalDirection
}

const THERMOMETER_CATALYSTS: Record<string, string> = {
  'Inflación': 'Inflación', 'Empleo': 'Empleo', 'Fed': 'Política monetaria',
  'Consumo': 'Crecimiento', 'Liquidez': 'Liquidez', 'Tecnología': 'Sentimiento',
}
const THERMOMETER_ORDER = ['Inflación', 'Empleo', 'Crecimiento', 'Política monetaria', 'Liquidez', 'Sentimiento']

export function computeMacroThermometer(weekEvents: MacroEvent[]): ThermometerReading[] {
  const byLabel: Record<string, { weight: number; net: number }> = {}
  THERMOMETER_ORDER.forEach(l => { byLabel[l] = { weight: 0, net: 0 } })

  weekEvents.forEach(e => {
    const catalyst = catalystOf(e)
    const label = THERMOMETER_CATALYSTS[catalyst]
    if (!label) return
    const w = impactOf(e)
    byLabel[label].weight += w
    const interp = interpretEvent(e)
    if (interp?.context === 'risk-on') byLabel[label].net += w
    else if (interp?.context === 'risk-off') byLabel[label].net -= w
  })

  const maxWeight = Math.max(1, ...Object.values(byLabel).map(v => v.weight))
  return THERMOMETER_ORDER.map(label => {
    const v = byLabel[label]
    return {
      label,
      intensity: Math.round((v.weight / maxWeight) * 100),
      direction: v.net > 0.3 ? 'up' : v.net < -0.3 ? 'down' : 'neut',
    }
  })
}

// ─────────────────────────────────────────────
// 8. CORRELACIONES (flujo configurable, no hardcodeado a un caso)
// ─────────────────────────────────────────────
export interface CorrelationNode {
  label: string
  direction: SignalDirection
}

export function computeCorrelationFlow(weekEvents: MacroEvent[]): CorrelationNode[] {
  const context = computeWeeklyMacroContext(weekEvents)
  const assets = computeExpectedAssetImpact(weekEvents)
  const byAsset = Object.fromEntries(assets.map(a => [a.asset, a]))

  const dirFromScore = (n: number): SignalDirection => (n > 0.15 ? 'up' : n < -0.15 ? 'down' : 'neut')

  return [
    { label: context.dominantCatalyst, direction: context.regime === 'risk-off' ? 'up' : context.regime === 'risk-on' ? 'down' : 'neut' },
    { label: 'Yields',  direction: dirFromScore(byAsset['YIELDS']?.netScore ?? 0) },
    { label: 'USD',     direction: dirFromScore(byAsset['USD']?.netScore ?? 0) },
    { label: 'NASDAQ',  direction: dirFromScore(byAsset['NQ']?.netScore ?? 0) },
    { label: 'ORO',     direction: dirFromScore(byAsset['GOLD']?.netScore ?? 0) },
  ]
}

// ─────────────────────────────────────────────
// 9. MATRIZ DE NARRATIVAS COMBINADAS
// ─────────────────────────────────────────────
export interface NarrativeMatrixResult {
  inputs: { event: MacroEvent; direction: string }[]
  narrative: string[]
  assets: AssetImpact[]
  probability: number
}

/**
 * Explica la interacción entre los eventos ya resueltos de la semana
 * (no suma impactos sin más): construye una cadena lógica catalizador
 * → activo, igual que hace computeCorrelationFlow, y la narra.
 */
export function buildNarrativeMatrix(weekEvents: MacroEvent[]): NarrativeMatrixResult {
  const resolved = weekEvents.filter(e => e.direction && e.direction !== 'pending')
  const context = computeWeeklyMacroContext(weekEvents)
  const assets = computeExpectedAssetImpact(weekEvents)
  const flow = computeCorrelationFlow(weekEvents)

  const inputs = resolved.map(e => ({ event: e, direction: e.direction as string }))

  const narrative: string[] = []
  if (resolved.length === 0) {
    narrative.push('Todavía no hay suficientes eventos resueltos esta semana para razonar una cadena combinada; el análisis se actualizará según lleguen resultados.')
  } else {
    const names = resolved.map(e => e.name).join(', ')
    narrative.push(`Analizando en conjunto ${names}, el resultado agregado apunta a un sesgo ${context.regimeLabel.toLowerCase()}.`)

    const upstream = flow[0]
    const chain = flow.slice(1).filter(n => n.direction !== 'neut')
    if (chain.length > 0) {
      const chainText = chain.map(n => `${n.label} ${n.direction === 'up' ? 'al alza' : 'a la baja'}`).join(' → ')
      narrative.push(`La cadena de transmisión esperada es: ${upstream.label} → ${chainText}.`)
    }

    const nq = assets.find(a => a.asset === 'NQ')
    if (nq && nq.impact !== 'Baja') {
      narrative.push(`Esto deja a NASDAQ con un sesgo ${nq.arrow.includes('↑') ? 'alcista' : nq.arrow.includes('↓') ? 'bajista' : 'neutral'} de convicción ${nq.impact.toLowerCase()}.`)
    }
  }

  return { inputs, narrative, assets, probability: context.expansionProbability }
}

// ─────────────────────────────────────────────
// 10. OUTLOOK SEMANAL IA (por reglas, sin IA generativa — mismo
//     criterio ya usado en el Sprint 1 para narrativeEngine.ts)
// ─────────────────────────────────────────────
export interface WeeklyOutlook {
  summary: string[]
  conviction: number
  mainCatalyst: string
  biggestRisk: string
  biggestOpportunity: string
}

export function buildWeeklyOutlook(weekEvents: MacroEvent[]): WeeklyOutlook {
  const context = computeWeeklyMacroContext(weekEvents)
  const assets = computeExpectedAssetImpact(weekEvents)
  const matrix = buildNarrativeMatrix(weekEvents)

  const bestAsset = [...assets].sort((a, b) => b.netScore - a.netScore)[0]
  const worstAsset = [...assets].sort((a, b) => a.netScore - b.netScore)[0]

  const summary: string[] = []
  summary.push(`Esta semana estará dominada por ${context.dominantCatalyst.toLowerCase()}, con ${context.mainEvent?.name ?? 'el calendario disponible'} como principal catalizador.`)
  summary.push(
    context.regime === 'risk-on'
      ? 'Si los datos confirman la lectura actual, el mercado podría inclinarse hacia un escenario favorable para activos de riesgo.'
      : context.regime === 'risk-off'
        ? 'Si los datos confirman la lectura actual, el mercado podría inclinarse hacia un escenario de aversión al riesgo y demanda de refugio.'
        : 'El mercado se mantiene sin un sesgo dominante claro a la espera de que los catalizadores de la semana definan la dirección.'
  )
  summary.push(`El principal riesgo continúa siendo una sorpresa en ${worstAsset ? worstAsset.label : context.dominantCatalyst} que invalide la narrativa actual.`)

  return {
    summary,
    conviction: context.conviction,
    mainCatalyst: context.dominantCatalyst,
    biggestRisk: worstAsset ? `Sorpresa bajista en ${worstAsset.label}` : 'Sorpresa en el dato principal',
    biggestOpportunity: bestAsset ? `Continuación de la tendencia en ${bestAsset.label}` : 'Sin oportunidad clara todavía',
  }
}
