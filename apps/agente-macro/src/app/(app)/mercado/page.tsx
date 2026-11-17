'use client'

import { useMemo } from 'react'
// Misma fuente que el calendario de Eventos (archivo de la semana en el
// servidor). EventProvider guarda la semana en localStorage y no vuelve a
// consultar el servidor si ya la tiene, así que podía mostrar una semana
// simulada vieja distinta de la del calendario.
import { useWeekEvents } from '@/hooks/useWeekEvents'
import { getThisWeekMonFri, formatDate } from '@/lib/earnings'
import {
  computeWeeklyMacroContext, computeWeeklyCycle, computeVolatilityMap,
  computeExpectedAssetImpact, computeHistoricalProbability, computeMacroThermometer,
  computeCorrelationFlow,
} from '@/lib/engines/weeklyMacroEngine'
import { TerminalDashboard } from '@/components/TerminalDashboard'
import { SentimentPanel } from '@/components/SentimentPanel'
import { PendingMetricsCard } from '@/components/PendingMetricsCard'
import { WeekTab } from '@/components/volatility/WeekTab'

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

// Volatilidad / Panel cuantitativo — separada de Eventos Económicos
// (/eventos-economicos) el 30/8. Ver docs/fix-landing-home-routing.md.
export default function MercadoPage() {
  const monday = useMemo(() => new Date(`${getThisWeekMonFri().from}T00:00:00`), [])
  const { events: allEvents } = useWeekEvents(0)

  const dayCounts = useMemo(() => {
    const buckets: typeof allEvents[number][][] = [[], [], [], [], []]
    allEvents.forEach(e => {
      if (!e.date) return
      const d = new Date(`${e.date}T00:00:00`)
      const idx = Math.round((d.getTime() - monday.getTime()) / 86400000)
      if (idx >= 0 && idx < 5) buckets[idx].push(e)
    })
    return buckets
  }, [allEvents, monday])

  const macroContext = useMemo(() => computeWeeklyMacroContext(allEvents), [allEvents])
  const weeklyCycle = useMemo(() => computeWeeklyCycle(dayCounts, DAY_LABELS), [dayCounts])
  const volatilityMap = useMemo(() => computeVolatilityMap(dayCounts, DAY_LABELS), [dayCounts])
  const assetImpact = useMemo(() => computeExpectedAssetImpact(allEvents), [allEvents])
  const historicalProb = useMemo(() => computeHistoricalProbability(macroContext.dominantCatalyst), [macroContext.dominantCatalyst])
  const macroThermometer = useMemo(() => computeMacroThermometer(allEvents), [allEvents])
  const correlationFlow = useMemo(() => computeCorrelationFlow(allEvents), [allEvents])
  const weekDates = useMemo(() => [0, 1, 2, 3, 4].map(i => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return formatDate(d)
  }), [monday])

  return (
    <div>
      <div className="mb-6">
        <p className="section-label mb-1">Volatilidad</p>
        <h1 className="text-xl font-display font-semibold text-base-text">Panel cuantitativo</h1>
      </div>

      <div className="mb-6">
        <PendingMetricsCard />
      </div>

      <TerminalDashboard
        context={macroContext}
        cycle={weeklyCycle}
        volatility={volatilityMap}
        thermometer={macroThermometer}
        correlation={correlationFlow}
        assetImpact={assetImpact}
        historicalProb={historicalProb}
        weekTab={
          <WeekTab
            events={allEvents}
            dates={weekDates}
            thermometer={macroThermometer}
            historicalProb={historicalProb}
            catalyst={macroContext.dominantCatalyst}
          />
        }
      >
        <SentimentPanel />
      </TerminalDashboard>
    </div>
  )
}
