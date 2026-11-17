import type { HistoricalProbability } from '@/lib/engines/weeklyMacroEngine'

interface Props {
  probability: HistoricalProbability
  catalyst: string
}

export function HistoricalProbabilityCard({ probability, catalyst }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="card-title">Probabilidad Histórica · {catalyst}</p>
        {probability.source === 'static' && (
          <span className="text-xs text-base-muted border border-base-line rounded px-1.5 py-0.5">Datos de referencia</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="metric-label text-xs mb-1">Movimiento medio</p><p className="text-base font-bold text-base-text">{probability.avgMove}</p></div>
        <div><p className="metric-label text-xs mb-1">Movimiento máximo</p><p className="text-base font-bold text-base-text">{probability.maxMove}</p></div>
        <div><p className="metric-label text-xs mb-1">Tiempo al primer impulso</p><p className="text-base font-bold text-base-text">{probability.avgTimeToImpulse}</p></div>
        <div>
          <p className="metric-label text-xs mb-1">Continuación / Reversión</p>
          <p className="text-base font-bold"><span className="text-pos">{probability.continuationPct}%</span><span className="text-base-muted"> / </span><span className="text-neg">{probability.reversionPct}%</span></p>
        </div>
      </div>
    </div>
  )
}
