'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type {
  WeeklyMacroContext, CyclePhaseDay, VolatilityBar, ThermometerReading, CorrelationNode,
  AssetImpact, HistoricalProbability,
} from '@/lib/engines/weeklyMacroEngine'
import { WeeklyCycleCard }        from './WeeklyCycleCard'
import { VolatilityHeatmap }      from './VolatilityHeatmap'
import { MacroThermometer }       from './MacroThermometer'
import { CorrelationFlow }        from './CorrelationFlow'
import { ExpectedImpactCard }     from './ExpectedImpactCard'
import { HistoricalProbabilityCard } from './HistoricalProbabilityCard'

// Sprint 6 — el Dashboard queda reservado a información PERMANENTE
// (Fear&Greed/VIX/DXY vía `children`, ciclo semanal, volatilidad,
// termómetro/liquidez, correlaciones, estadísticas). Todo lo que
// antes vivía en la pestaña "Análisis avanzado" (narrativa por
// evento/semana) se movió al EventAccordion del calendario, que es
// donde pertenece según el Sprint 6. Los componentes de esa pestaña
// (RegimeCard, MarketPhaseCard, MarketStoryCard, SecondOrderEffectsCard,
// ExpectationVsRealityCard, ConvictionMatrixCard, MacroSemaphoreCard,
// TimelineCard, NarrativeMatrix, WeeklyOutlookCard, WeeklyContextCard,
// ExecutiveSummaryCard, MacroContextDashboard) no se han borrado, solo
// dejaron de montarse aquí — MacroContextCard/EventAccordion ya cubren
// esa información sin duplicarla.

interface Props {
  context:  WeeklyMacroContext
  cycle:    CyclePhaseDay[]
  volatility: VolatilityBar[]
  thermometer: ThermometerReading[]
  correlation: CorrelationNode[]
  assetImpact: AssetImpact[]
  historicalProb: HistoricalProbability
  children?: ReactNode // Fear & Greed / VIX / DXY (SentimentPanel)
  /** Contenido de la pestaña "La semana" (V3, WeekTab). Si falta, se usan las cards anteriores. */
  weekTab?: ReactNode
}

type Tab = 'mercado' | 'ciclo'

export function TerminalDashboard({
  context, cycle, volatility, thermometer, correlation, assetImpact, historicalProb, children, weekTab,
}: Props) {
  const [tab, setTab] = useState<Tab>('mercado')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'mercado', label: 'Sentimiento' },
    { id: 'ciclo',   label: 'La semana' },
  ]

  const sectionTitle = tab === 'mercado' ? 'Sentimiento del mercado' : 'Ciclo y volatilidad'

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2.5 mb-4">
        <h2 className="section-title">{sectionTitle}</h2>
        <div className="section-title-line" />
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'mercado' && (
        <div className="space-y-4">
          {children}
        </div>
      )}

      {tab === 'ciclo' && weekTab}

      {tab === 'ciclo' && !weekTab && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <WeeklyCycleCard cycle={cycle} />
            <VolatilityHeatmap volatility={volatility} />
            <MacroThermometer readings={thermometer} />
            <CorrelationFlow flow={correlation} />
            <ExpectedImpactCard assets={assetImpact} />
            <HistoricalProbabilityCard probability={historicalProb} catalyst={context.dominantCatalyst} />
          </div>
        </div>
      )}
    </div>
  )
}
