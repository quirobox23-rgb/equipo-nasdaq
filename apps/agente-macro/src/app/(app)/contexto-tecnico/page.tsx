'use client'
import { useMemo } from 'react'
import { useWeekEvents } from '@/lib/dataProvider/EventProvider'
import { getThisWeekMonFri } from '@/lib/earnings'
import { computeWeeklyMacroContext } from '@/lib/engines/weeklyMacroEngine'
import { TECHNICAL_ASSETS } from '@/lib/dataProvider/TechnicalContext'
import { AssetContextCard } from '@/components/technical/AssetContextCard'

export default function ContextoTecnicoPage() {
  const mondayKey = useMemo(() => getThisWeekMonFri().from, [])
  const allEvents = useWeekEvents(mondayKey)
  const context   = useMemo(() => computeWeeklyMacroContext(allEvents), [allEvents])
  const mainEventName = context.mainEvent?.name ?? null

  return (
    <div>
      <div className="mb-6">
        {/* En desarrollo: más adelante suma niveles gamma (flip, call/put wall, max pain), estilo zerogex.io/ndx-gamma-levels. */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <p className="section-label">Contexto Técnico</p>
          <span className="badge badge-brand shrink-0" title="Próximamente: niveles gamma del Nasdaq">En desarrollo</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-display font-semibold text-base-text">Niveles reales por activo</h1>
          <span className="text-[10px] text-base-muted">Introducción manual — feed Databento pendiente de conectar</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {TECHNICAL_ASSETS.map(({ asset, display }) => (
          <AssetContextCard key={asset} asset={asset} display={display} mainEventName={mainEventName} />
        ))}
      </div>
    </div>
  )
}
