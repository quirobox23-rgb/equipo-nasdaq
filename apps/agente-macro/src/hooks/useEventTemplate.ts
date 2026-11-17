'use client'

import { useMemo } from 'react'

export interface EventTemplate {
  name: string
  aliases?: string[]
  description?: string
  narrative?: string
  scenarioPositive?: string
  scenarioNegative?: string
  scenarioNeutral?: string
  affectedAssets?: string[]
  assetsBeat?: Record<string, string>
  assetsInline?: Record<string, string>
  assetsMiss?: Record<string, string>
  importance?: string
  dependencies?: string
  comments?: string
  specialRules?: string[]
  notes?: string
  // Campos del rediseño de Eventos (opcionales, aditivos — ver
  // docs/plan-rediseno-eventos.md). Si faltan, se usan defaults.
  /** Importancia 1–5 según el criterio del analista (default: desde el impacto). */
  stars?: number
  /** Qué lado del dato es "mejor": "lower" en Jobless Claims, desempleo… (default "higher"). */
  betterWhen?: 'higher' | 'lower'
  /** Frecuencia de publicación, ej. "Mensual · primer viernes". */
  frequency?: string
  /** Una línea por escenario para la matriz (si faltan, se usan los scenarioX largos). */
  scenarioShortBetter?: string
  scenarioShortInline?: string
  scenarioShortWorse?: string
  /** Fichas de empresas (earnings): ticker y "Cómo afecta al NQ". */
  ticker?: string
  nqImpact?: string
}

const TEMPLATES: Record<string, EventTemplate> = {
  'jobless-claims': require('@/data/knowledge/jobless-claims.json'),
  'nfp': require('@/data/knowledge/nfp.json'),
  'cpi': require('@/data/knowledge/cpi.json'),
  'core-pce': require('@/data/knowledge/core-pce.json'),
  'ism-manufacturing': require('@/data/knowledge/ism-manufacturing.json'),
  'ism-services': require('@/data/knowledge/ism-services.json'),
  'ppi': require('@/data/knowledge/ppi.json'),
  'unemployment-rate': require('@/data/knowledge/unemployment-rate.json'),
  'average-hourly-earnings': require('@/data/knowledge/average-hourly-earnings.json'),
  'adp-employment': require('@/data/knowledge/adp-employment.json'),
  'fomc-rate-decision': require('@/data/knowledge/fomc-rate-decision.json'),
  'retail-sales': require('@/data/knowledge/retail-sales.json'),
  'jolts-job-openings': require('@/data/knowledge/jolts-job-openings.json'),
  'gdp-growth': require('@/data/knowledge/gdp-growth.json'),
  'durable-goods': require('@/data/knowledge/durable-goods.json'),
  'consumer-confidence': require('@/data/knowledge/consumer-confidence.json'),
  'industrial-production': require('@/data/knowledge/industrial-production.json'),
  'fomc-dot-plot': require('@/data/knowledge/fomc-dot-plot.json'),
  'existing-home-sales': require('@/data/knowledge/existing-home-sales.json'),
  'import-prices': require('@/data/knowledge/import-prices.json'),
  'core-retail-sales': require('@/data/knowledge/core-retail-sales.json'),
  'empire-state-manufacturing': require('@/data/knowledge/empire-state-manufacturing.json'),
  'philadelphia-fed-manufacturing': require('@/data/knowledge/philadelphia-fed-manufacturing.json'),
  'fomc': require('@/data/knowledge/fomc.json'),
  'fomc-press-conference': require('@/data/knowledge/fomc-press-conference.json'),
  '10-year-note-auction': require('@/data/knowledge/10-year-note-auction.json'),
  '30-year-bond-auction': require('@/data/knowledge/30-year-bond-auction.json'),
  'crude-oil-inventories': require('@/data/knowledge/crude-oil-inventories.json'),
  'earnings': require('@/data/knowledge/earnings.json'),
  'speech': require('@/data/knowledge/speech.json'),
  'other': require('@/data/knowledge/other.json'),
  'kevin-warsh-speaks': require('@/data/knowledge/kevin-warsh-speaks.json'),
  'fomc-member-speaks': require('@/data/knowledge/fomc-member-speaks.json'),
  'sp-global-pmi': require('@/data/knowledge/sp-global-pmi.json'),
  'michigan-consumer-sentiment': require('@/data/knowledge/michigan-consumer-sentiment.json'),
  'michigan-inflation-expectations': require('@/data/knowledge/michigan-inflation-expectations.json'),
  'fomc-minutes': require('@/data/knowledge/fomc-minutes.json'),
  'beige-book': require('@/data/knowledge/beige-book.json'),
  'employment-cost-index': require('@/data/knowledge/employment-cost-index.json'),
  'personal-income-spending': require('@/data/knowledge/personal-income-spending.json'),
  'chicago-pmi': require('@/data/knowledge/chicago-pmi.json'),
  'richmond-manufacturing': require('@/data/knowledge/richmond-manufacturing.json'),
  'housing-starts': require('@/data/knowledge/housing-starts.json'),
  'new-home-sales': require('@/data/knowledge/new-home-sales.json'),
  'pending-home-sales': require('@/data/knowledge/pending-home-sales.json'),
  'house-price-index': require('@/data/knowledge/house-price-index.json'),
  'nahb-housing-market-index': require('@/data/knowledge/nahb-housing-market-index.json'),
  'trade-balance': require('@/data/knowledge/trade-balance.json'),
  'inventories': require('@/data/knowledge/inventories.json'),
  'factory-orders': require('@/data/knowledge/factory-orders.json'),
  'construction-spending': require('@/data/knowledge/construction-spending.json'),
  'challenger-job-cuts': require('@/data/knowledge/challenger-job-cuts.json'),
  'productivity-unit-labor-costs': require('@/data/knowledge/productivity-unit-labor-costs.json'),
  'api-crude-inventories': require('@/data/knowledge/api-crude-inventories.json'),
  'natural-gas-storage': require('@/data/knowledge/natural-gas-storage.json'),
  'federal-budget-balance': require('@/data/knowledge/federal-budget-balance.json'),
  'treasury-currency-report': require('@/data/knowledge/treasury-currency-report.json'),
  'bank-holiday': require('@/data/knowledge/bank-holiday.json'),
}

// Fichas por empresa para los earnings del calendario (Fase 3). Los eventos
// de earnings se llaman "Apple (AAPL)" (desde Finnhub) o "Apple Earnings"
// (cargados a mano en el JSON de la semana): se reconocen por ticker o por nombre.
const COMPANY_TEMPLATES: Record<string, EventTemplate> = {
  AAPL: require('@/data/knowledge/companies/AAPL.json'),
  MSFT: require('@/data/knowledge/companies/MSFT.json'),
  GOOGL: require('@/data/knowledge/companies/GOOGL.json'),
  AMZN: require('@/data/knowledge/companies/AMZN.json'),
  NVDA: require('@/data/knowledge/companies/NVDA.json'),
  META: require('@/data/knowledge/companies/META.json'),
  TSLA: require('@/data/knowledge/companies/TSLA.json'),
  AVGO: require('@/data/knowledge/companies/AVGO.json'),
  AMD: require('@/data/knowledge/companies/AMD.json'),
  MU: require('@/data/knowledge/companies/MU.json'),
  TSM: require('@/data/knowledge/companies/TSM.json'),
  ASML: require('@/data/knowledge/companies/ASML.json'),
  QCOM: require('@/data/knowledge/companies/QCOM.json'),
}

function findCompanyTemplate(eventName: string): EventTemplate | null {
  const ticker = eventName.match(/\(([A-Z]{1,5})\)/)?.[1]
  if (ticker && COMPANY_TEMPLATES[ticker]) return COMPANY_TEMPLATES[ticker]
  const n = eventName.toLowerCase()
  if (!/earnings|resultados/.test(n) || n.includes('hourly')) return null
  for (const t of Object.values(COMPANY_TEMPLATES)) {
    if ((t.aliases ?? []).some(a => new RegExp(`\\b${a.toLowerCase()}\\b`).test(n))) return t
  }
  return null
}

const EVENT_MAPPINGS: Record<string, string> = {
  'jobless claims': 'jobless-claims',
  'initial jobless': 'jobless-claims',
  'non-farm payroll': 'nfp',
  'nfp': 'nfp',
  'employment': 'nfp',
  'cpi': 'cpi',
  'consumer price': 'cpi',
  'ipc': 'cpi',
  'core pce': 'core-pce',
  'pce': 'core-pce',
  // S&P Global va ANTES que los genéricos "manufacturing pmi"/"services pmi"
  // de abajo — si no, "S&P Global Manufacturing PMI" caería en ISM por error,
  // porque también contiene la frase "manufacturing pmi".
  's&p global': 'sp-global-pmi',
  // Forex Factory llama "Flash/Final Manufacturing PMI" al PMI de S&P Global.
  'flash manufacturing': 'sp-global-pmi',
  'flash services': 'sp-global-pmi',
  'final manufacturing': 'sp-global-pmi',
  'final services': 'sp-global-pmi',
  'chicago pmi': 'chicago-pmi',
  'ism services': 'ism-services',
  'ism manufacturing': 'ism-manufacturing',
  'manufacturing pmi': 'ism-manufacturing',
  'services pmi': 'ism-services',
  'ppi': 'ppi',
  'producer price': 'ppi',
  // Forex Factory llama "Unemployment Claims" a las Jobless Claims: va antes
  // que 'unemployment' (misma posición, gana la más larga).
  'unemployment claims': 'jobless-claims',
  'unemployment': 'unemployment-rate',
  // 'hourly earnings' (salarios) antes era 'earnings' a secas, y por eso los
  // earnings de empresas ("Apple Earnings") caían en la ficha de salarios.
  'hourly earnings': 'average-hourly-earnings',
  'earnings': 'earnings',
  'adp': 'adp-employment',
  'fed rate': 'fomc-rate-decision',
  'federal funds rate': 'fomc-rate-decision',
  'fomc statement': 'fomc-rate-decision',
  'fomc meeting minutes': 'fomc-minutes',
  'fomc minutes': 'fomc-minutes',
  'beige book': 'beige-book',
  'press conference': 'fomc-press-conference',
  'interest rate': 'fomc-rate-decision',
  'retail': 'retail-sales',
  'gdp': 'gdp-growth',
  'durables': 'durable-goods',
  'durable goods': 'durable-goods',
  'consumer confidence': 'consumer-confidence',
  'industrial': 'industrial-production',
  'capacity utilization': 'industrial-production',
  'employment cost': 'employment-cost-index',
  'personal income': 'personal-income-spending',
  'personal spending': 'personal-income-spending',
  'richmond': 'richmond-manufacturing',
  'housing starts': 'housing-starts',
  'building permits': 'housing-starts',
  'new home sales': 'new-home-sales',
  'pending home sales': 'pending-home-sales',
  'hpi': 'house-price-index',
  'house price': 'house-price-index',
  'nahb': 'nahb-housing-market-index',
  'trade balance': 'trade-balance',
  'inventories': 'inventories',
  'factory orders': 'factory-orders',
  'construction spending': 'construction-spending',
  'challenger': 'challenger-job-cuts',
  'productivity': 'productivity-unit-labor-costs',
  'unit labor costs': 'productivity-unit-labor-costs',
  'api weekly': 'api-crude-inventories',
  'crude oil': 'crude-oil-inventories',
  'natural gas': 'natural-gas-storage',
  'budget balance': 'federal-budget-balance',
  'currency report': 'treasury-currency-report',
  'bank holiday': 'bank-holiday',
  'holiday': 'bank-holiday',
  'labor day': 'bank-holiday',
  '10-y bond': '10-year-note-auction',
  '10-year': '10-year-note-auction',
  '30-y bond': '30-year-bond-auction',
  '30-year': '30-year-bond-auction',
  'dot plot': 'fomc-dot-plot',
  'home sales': 'existing-home-sales',
  'import': 'import-prices',
  'core retail': 'core-retail-sales',
  'empire state': 'empire-state-manufacturing',
  'philadelphia': 'philadelphia-fed-manufacturing',
  // Michigan
  'michigan consumer': 'michigan-consumer-sentiment',
  'uom consumer': 'michigan-consumer-sentiment',
  'uom inflation': 'michigan-inflation-expectations',
  'inflation expectations': 'michigan-inflation-expectations',
  // Warsh va ANTES que los genéricos de Fed de abajo — si no, "Kevin Warsh
  // Speaks" caería en la ficha genérica porque también contiene "speaks".
  'warsh': 'kevin-warsh-speaks',
  'fed chair': 'kevin-warsh-speaks',
  'fomc member': 'fomc-member-speaks',
  'fed vice chair': 'fomc-member-speaks',
  'speaks': 'fomc-member-speaks',
}

// Versión sin hook, para buscar fichas de muchos eventos a la vez (calendario
// Semana / Tabla). useEventTemplate usa esta misma búsqueda.
export function findEventTemplate(eventName: string | null): EventTemplate | null {
  {
    if (!eventName) return null

    // 0. Earnings de una empresa con ficha propia
    const company = findCompanyTemplate(eventName)
    if (company) return company

    // Normalizar nombre
    const normalized = eventName.toLowerCase().trim()

    // 1. Búsqueda directa en mappings
    if (EVENT_MAPPINGS[normalized]) {
      const templateKey = EVENT_MAPPINGS[normalized]
      return TEMPLATES[templateKey] || null
    }

    // 2. Búsqueda parcial en mappings. Gana la palabra clave que aparece
    //    PRIMERO en el nombre (y, si empatan, la más larga): así
    //    "Unemployment Rate" va a desempleo y "ADP Nonfarm Employment" a ADP,
    //    en vez de caer en el NFP por contener "employment".
    let best: { pos: number; len: number; templateKey: string } | null = null
    for (const [key, templateKey] of Object.entries(EVENT_MAPPINGS)) {
      const pos = normalized.indexOf(key)
      if (pos === -1) continue
      if (!best || pos < best.pos || (pos === best.pos && key.length > best.len)) best = { pos, len: key.length, templateKey }
    }
    if (best) return TEMPLATES[best.templateKey] || null
    for (const [key, templateKey] of Object.entries(EVENT_MAPPINGS)) {
      if (key.includes(normalized)) return TEMPLATES[templateKey] || null
    }

    // 3. Búsqueda en templates directamente (por aliases)
    for (const [, template] of Object.entries(TEMPLATES)) {
      if (template.aliases && template.aliases.some(alias => 
        normalized.includes(alias.toLowerCase()) || 
        alias.toLowerCase().includes(normalized)
      )) {
        return template
      }
    }

    // 4. Búsqueda por nombre exacto del template
    for (const [, template] of Object.entries(TEMPLATES)) {
      if (template.name.toLowerCase() === normalized) {
        return template
      }
    }

    // 5. Búsqueda parcial por nombre
    for (const [, template] of Object.entries(TEMPLATES)) {
      if (template.name.toLowerCase().includes(normalized) || 
          normalized.includes(template.name.toLowerCase())) {
        return template
      }
    }

    return null
  }
}

export function useEventTemplate(eventName: string | null): EventTemplate | null {
  return useMemo(() => findEventTemplate(eventName), [eventName])
}
