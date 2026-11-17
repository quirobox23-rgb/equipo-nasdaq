/**
 * mentorEngine.ts — Motor de análisis institucional con IA.
 * v2 — soporte para análisis multi-evento correlacionado.
 * v3 — usa la Knowledge Base (conocimiento permanente por tipo de evento)
 *      como contexto obligatorio, en vez de reglas sueltas por evento.
 */
import type { KnowledgeEntry } from '@/lib/dataProvider/KnowledgeBase'

export interface CatalogEvent {
  name:          string
  category:      string
  affects:       string[]
  defaultImpact: 'high' | 'med' | 'low'
}

export const EVENT_CATALOG: CatalogEvent[] = [
  { name: 'CPI m/m',                     category: 'Inflación',              affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'CPI y/y',                     category: 'Inflación',              affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Core CPI m/m',                category: 'Inflación',              affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Core CPI y/y',                category: 'Inflación',              affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'PPI m/m',                     category: 'Inflación',              affects: ['USD','NQ','GOLD'],       defaultImpact: 'med'  },
  { name: 'Core PPI m/m',                category: 'Inflación',              affects: ['USD','NQ','GOLD'],       defaultImpact: 'med'  },
  { name: 'PCE Price Index m/m',         category: 'Inflación',              affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Core PCE Price Index m/m',    category: 'Inflación',              affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Non Farm Payrolls (NFP)',      category: 'Empleo',                 affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Unemployment Rate',           category: 'Empleo',                 affects: ['USD','NQ','GOLD'],       defaultImpact: 'high' },
  { name: 'Average Hourly Earnings m/m', category: 'Empleo',                 affects: ['USD','NQ','GOLD'],       defaultImpact: 'high' },
  { name: 'Initial Jobless Claims',      category: 'Empleo',                 affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'ADP Employment Change',       category: 'Empleo',                 affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'JOLTS Job Openings',          category: 'Empleo',                 affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'GDP QoQ',                     category: 'Crecimiento',            affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'GDP Advance',                 category: 'Crecimiento',            affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Retail Sales m/m',            category: 'Crecimiento',            affects: ['USD','NQ'],              defaultImpact: 'high' },
  { name: 'Durable Goods Orders m/m',    category: 'Crecimiento',            affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'Factory Orders m/m',          category: 'Crecimiento',            affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'Consumer Confidence',         category: 'Crecimiento',            affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'ISM Manufacturing PMI',       category: 'Crecimiento',            affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'ISM Services PMI',            category: 'Crecimiento',            affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'Existing Home Sales',         category: 'Vivienda',               affects: ['USD','NQ'],              defaultImpact: 'low'  },
  { name: 'New Home Sales',              category: 'Vivienda',               affects: ['USD','NQ'],              defaultImpact: 'low'  },
  { name: 'Housing Starts',              category: 'Vivienda',               affects: ['USD','NQ'],              defaultImpact: 'low'  },
  { name: 'Building Permits',            category: 'Vivienda',               affects: ['USD','NQ'],              defaultImpact: 'low'  },
  { name: 'FOMC Interest Rate Decision', category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'FOMC Statement',              category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'FOMC Minutes',                category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Warsh Speech',               category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Fed Speech',                  category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD'],       defaultImpact: 'med'  },
  { name: 'Jackson Hole Symposium',      category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'SEP / Dot Plot',              category: 'Fed / Política monetaria',affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Treasury Auction 2Y',         category: 'Tesoro / Deuda',         affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'Treasury Auction 5Y',         category: 'Tesoro / Deuda',         affects: ['USD','NQ'],              defaultImpact: 'med'  },
  { name: 'Treasury Auction 10Y',        category: 'Tesoro / Deuda',         affects: ['USD','NQ','GOLD'],       defaultImpact: 'high' },
  { name: 'Treasury Auction 30Y',        category: 'Tesoro / Deuda',         affects: ['USD','NQ','GOLD'],       defaultImpact: 'high' },
  { name: 'US Debt Ceiling',             category: 'Tesoro / Deuda',         affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Trump Speech',                category: 'Político / Geopolítico', affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Presidential Press Conference',category:'Político / Geopolítico', affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
  { name: 'Evento geopolítico relevante',category: 'Político / Geopolítico', affects: ['USD','NQ','GOLD','VIX'], defaultImpact: 'high' },
]

export const EVENT_CATEGORIES = [...new Set(EVENT_CATALOG.map(e => e.category))]

export interface AssetImpact {
  bias:       'alcista' | 'bajista' | 'neutral'
  reasoning:  string
  intensity:  'alta' | 'moderada' | 'baja'
  confidence: 'alta' | 'moderada' | 'baja'
}

export interface ScenarioAnalysis {
  type:             'beat' | 'inline' | 'miss'
  label:            string
  probability_pct:  number
  economic_chain:   string
  nq:   AssetImpact
  usd:  AssetImpact
  gold: AssetImpact
  vix:  AssetImpact
  when_logic_fails: string
}

export interface MentorAnalysis {
  mentor: {
    what_it_measures:       string
    why_it_matters:         string
    what_fed_watches:       string
    why_moves_markets:      string
    institutional_behavior: string
  }
  market_pricing: {
    current_consensus:      string
    rate_expectations:      string
    priced_scenario:        string
    surprise_risk:          'ALTO' | 'MEDIO' | 'BAJO'
    surprise_risk_reason:   string
    what_breaks_narrative:  string
  }
  // Multi-event only
  combined?: {
    main_driver:      string
    market_mover:     string
    macro_bias:       'HAWKISH' | 'NEUTRAL' | 'DOVISH'
    correlation:      string
    contradictions:   string
  }
  scenarios: ScenarioAnalysis[]
}

// ── Prompt para evento único ──────────────────────────────────

function renderKnowledgeBlock(knowledge?: KnowledgeEntry | null): string {
  if (!knowledge) return ''
  const lines = [
    knowledge.description       ? `Descripción: ${knowledge.description}`               : '',
    knowledge.narrative         ? `Narrativa habitual: ${knowledge.narrative}`           : '',
    knowledge.scenarioPositive  ? `Escenario positivo: ${knowledge.scenarioPositive}`    : '',
    knowledge.scenarioNegative  ? `Escenario negativo: ${knowledge.scenarioNegative}`    : '',
    knowledge.scenarioNeutral   ? `Escenario neutral: ${knowledge.scenarioNeutral}`      : '',
    knowledge.dependencies      ? `Dependencias: ${knowledge.dependencies}`              : '',
    knowledge.comments          ? `Comentarios: ${knowledge.comments}`                   : '',
  ].filter(Boolean).join('\n')
  const rules = (knowledge.specialRules ?? []).length
    ? `\nREGLAS ESPECIALES (instrucciones obligatorias, aplícalas literalmente):\n${(knowledge.specialRules ?? []).map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : ''
  if (!lines && !rules) return ''
  return `\n\nCONOCIMIENTO PERMANENTE DE NOVA SOBRE ESTE TIPO DE EVENTO:\n${lines}${rules}`
}

export function buildAnalysisPrompt(event: {
  name:     string
  prev?:    string | null
  forecast?:string | null
  actual?:  string | null
  notes?:   string | null
  impact?:  string
  knowledge?: KnowledgeEntry | null
}): string {
  const lines = [
    `EVENTO: ${event.name}`,
    event.prev     ? `DATO ANTERIOR: ${event.prev}`        : '',
    event.forecast ? `CONSENSO/FORECAST: ${event.forecast}`: '',
    event.actual   ? `DATO REAL: ${event.actual}`          : '',
    event.notes    ? `OBSERVACIONES: ${event.notes}`       : '',
  ].filter(Boolean).join('\n')

  const knowledgeBlock = renderKnowledgeBlock(event.knowledge)

  return `Eres el economista jefe de Bloomberg Intelligence y analista macro senior de Goldman Sachs. Análisis de calidad institucional con razonamiento económico completo y cadenas causales claras.

Analiza este evento macroeconómico:

${lines}${knowledgeBlock}

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown, sin bloques de código):

{
  "mentor": {
    "what_it_measures": "Qué mide exactamente, cómo se calcula, componentes, frecuencia",
    "why_it_matters": "Por qué es clave para mercados y política monetaria",
    "what_fed_watches": "Qué observa la Fed exactamente en este indicador",
    "why_moves_markets": "Mecanismo de transmisión: dato → expectativas → tipos → divisa → renta variable",
    "institutional_behavior": "Cómo se posicionan antes y después Goldman, JPMorgan, hedge funds macro"
  },
  "market_pricing": {
    "current_consensus": "Qué espera el mercado ahora y qué narrativa domina",
    "rate_expectations": "Implicaciones para Fed Funds en los próximos 12 meses",
    "priced_scenario": "Qué escenario tienen descontado los precios actuales",
    "surprise_risk": "ALTO o MEDIO o BAJO",
    "surprise_risk_reason": "Por qué el riesgo de sorpresa es ese nivel",
    "what_breaks_narrative": "Qué dato concreto rompería la narrativa actual"
  },
  "scenarios": [
    {
      "type": "beat",
      "label": "Superior al esperado",
      "probability_pct": 30,
      "economic_chain": "Cadena causal completa: dato → inflación → FED → tipos → USD → NQ → Oro → VIX",
      "nq":   { "bias": "bajista", "reasoning": "Mecanismo exacto para NQ", "intensity": "alta", "confidence": "alta" },
      "usd":  { "bias": "alcista", "reasoning": "Mecanismo exacto para USD", "intensity": "alta", "confidence": "alta" },
      "gold": { "bias": "bajista", "reasoning": "Mecanismo exacto para Oro", "intensity": "moderada", "confidence": "moderada" },
      "vix":  { "bias": "alcista", "reasoning": "Mecanismo exacto para VIX", "intensity": "moderada", "confidence": "moderada" },
      "when_logic_fails": "Casos concretos en que esta lógica falla"
    },
    {
      "type": "inline",
      "label": "En línea con lo esperado",
      "probability_pct": 45,
      "economic_chain": "Qué pasa cuando el mercado obtiene exactamente lo esperado",
      "nq":   { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "alta" },
      "usd":  { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "alta" },
      "gold": { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "alta" },
      "vix":  { "bias": "bajista", "reasoning": "...", "intensity": "baja", "confidence": "alta" },
      "when_logic_fails": "Casos en que en-línea genera movimiento inesperado"
    },
    {
      "type": "miss",
      "label": "Inferior al esperado",
      "probability_pct": 25,
      "economic_chain": "Cadena causal completa para dato inferior",
      "nq":   { "bias": "alcista", "reasoning": "...", "intensity": "moderada", "confidence": "moderada" },
      "usd":  { "bias": "bajista", "reasoning": "...", "intensity": "moderada", "confidence": "moderada" },
      "gold": { "bias": "alcista", "reasoning": "...", "intensity": "moderada", "confidence": "moderada" },
      "vix":  { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "moderada" },
      "when_logic_fails": "Casos en que la lógica falla"
    }
  ]
}`
}

// ── Prompt para análisis multi-evento combinado ───────────────

export function buildCombinedAnalysisPrompt(events: Array<{
  name:     string
  prev?:    string | null
  forecast?:string | null
  actual?:  string | null
  impact?:  string
  notes?:   string | null
  knowledge?: KnowledgeEntry | null
}>): string {
  const eventLines = events.map((e, i) => {
    const parts = [
      `EVENTO ${i + 1}: ${e.name} (Impacto: ${e.impact?.toUpperCase() ?? 'DESCONOCIDO'})`,
      e.prev     ? `  Anterior: ${e.prev}`      : '',
      e.forecast ? `  Forecast: ${e.forecast}`  : '',
      e.actual   ? `  Real: ${e.actual}`        : '',
      e.notes    ? `  Notas: ${e.notes}`        : '',
      renderKnowledgeBlock(e.knowledge).replace(/\n/g, '\n  '),
    ].filter(Boolean).join('\n')
    return parts
  }).join('\n\n')

  return `Eres el economista jefe de Bloomberg Intelligence y jefe de estrategia macro global de Goldman Sachs. Debes analizar CONJUNTAMENTE estos eventos como lo haría un comité macro institucional. No analices cada evento por separado — analiza sus interacciones, contradicciones y el sesgo macro resultante.

EVENTOS DEL DÍA:

${eventLines}

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown, sin bloques de código):

{
  "mentor": {
    "what_it_measures": "Qué mide el conjunto de estos eventos como bloque de datos macro",
    "why_it_matters": "Por qué este bloque de datos importa en el contexto macro actual",
    "what_fed_watches": "Cuál de estos datos prioriza la Fed y por qué en este momento del ciclo",
    "why_moves_markets": "Cómo interactúan estas publicaciones entre sí y cuál domina el movimiento",
    "institutional_behavior": "Cómo se posicionan los institucionales ante este bloque de datos simultáneo"
  },
  "market_pricing": {
    "current_consensus": "Qué espera el mercado del conjunto de estos datos",
    "rate_expectations": "Cómo afecta este bloque de datos a las expectativas de Fed Funds",
    "priced_scenario": "Qué escenario combinado tienen descontado los precios actuales",
    "surprise_risk": "ALTO o MEDIO o BAJO",
    "surprise_risk_reason": "Por qué el riesgo de sorpresa combinada es ese nivel",
    "what_breaks_narrative": "Qué combinación concreta de resultados rompería la narrativa actual"
  },
  "combined": {
    "main_driver": "Nombre exacto del evento con mayor impacto estructural en este bloque",
    "market_mover": "Nombre exacto del evento que MÁS moverá el mercado intradía y por qué",
    "macro_bias": "HAWKISH o NEUTRAL o DOVISH — sesgo macro resultante del conjunto",
    "correlation": "Cómo se correlacionan estos eventos: se refuerzan, se contradicen o son independientes. Análisis económico detallado.",
    "contradictions": "Si hay contradicciones entre los eventos, explica cuál prevalece y por qué el mercado resolverá en esa dirección"
  },
  "scenarios": [
    {
      "type": "beat",
      "label": "Todos / mayoría superan expectativas",
      "probability_pct": 25,
      "economic_chain": "Cadena causal si el bloque de datos sale fuerte: cómo interactúan y cuál es el impacto neto",
      "nq":   { "bias": "bajista", "reasoning": "Impacto neto en NQ del conjunto de datos fuertes", "intensity": "alta", "confidence": "alta" },
      "usd":  { "bias": "alcista", "reasoning": "Impacto neto en USD", "intensity": "alta", "confidence": "alta" },
      "gold": { "bias": "bajista", "reasoning": "Impacto neto en Oro", "intensity": "moderada", "confidence": "moderada" },
      "vix":  { "bias": "alcista", "reasoning": "Impacto neto en VIX", "intensity": "moderada", "confidence": "moderada" },
      "when_logic_fails": "Cuándo esta lógica falla en un contexto multi-evento"
    },
    {
      "type": "inline",
      "label": "Datos mixtos / en línea con lo esperado",
      "probability_pct": 45,
      "economic_chain": "Qué pasa cuando hay datos mixtos — algunos superan, otros decepcionan",
      "nq":   { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "moderada" },
      "usd":  { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "moderada" },
      "gold": { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "moderada" },
      "vix":  { "bias": "bajista", "reasoning": "...", "intensity": "baja", "confidence": "moderada" },
      "when_logic_fails": "Cuándo los datos mixtos generan movimientos inesperados"
    },
    {
      "type": "miss",
      "label": "Todos / mayoría decepcionan",
      "probability_pct": 30,
      "economic_chain": "Cadena causal si el bloque sale débil: interacciones y impacto neto",
      "nq":   { "bias": "alcista", "reasoning": "...", "intensity": "moderada", "confidence": "moderada" },
      "usd":  { "bias": "bajista", "reasoning": "...", "intensity": "moderada", "confidence": "moderada" },
      "gold": { "bias": "alcista", "reasoning": "...", "intensity": "moderada", "confidence": "moderada" },
      "vix":  { "bias": "neutral", "reasoning": "...", "intensity": "baja", "confidence": "moderada" },
      "when_logic_fails": "..."
    }
  ]
}`
}
