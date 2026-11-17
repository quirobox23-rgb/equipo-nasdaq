import type { CyclePhaseDay } from '@/lib/engines/weeklyMacroEngine'

interface Props { cycle: CyclePhaseDay[] }

export function WeeklyCycleCard({ cycle }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">ATM del Ciclo Semanal</p>
      <div className="space-y-2">
        {cycle.map(d => {
          const isPeak = d.phase === 'Confirmación'
          return (
            <div
              key={d.label}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border ${
                isPeak
                  ? 'bg-brand/10 border-brand'
                  : d.hasEvents
                    ? 'bg-base-panel2/60 border-base-line'
                    : 'bg-base-panel border-base-line/60'
              }`}
            >
              <span className={`text-sm font-bold ${isPeak ? 'text-brand' : 'text-base-text'}`}>{d.label}</span>
              <span className={`text-sm font-semibold ${isPeak ? 'text-brand' : d.hasEvents ? 'text-base-text/90' : 'text-base-muted'}`}>
                {d.phase}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
