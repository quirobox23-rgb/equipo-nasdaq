import type { MacroEvent } from '@/types/macro'

interface Props {
  weekEventsByDay: MacroEvent[][]
  dayLabels: string[]
}

const IMPACT_DOT: Record<string, string> = { high: 'bg-neg', med: 'bg-neutral', low: 'bg-base-muted' }

export function WeeklyEventsMap({ weekEventsByDay, dayLabels }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Mapa Semanal de Eventos</p>
      <div className="grid grid-cols-5 gap-2">
        {dayLabels.map((label, i) => {
          const events = weekEventsByDay[i] ?? []
          return (
            <div key={label} className="rounded-md border border-base-line bg-base-panel/60 p-2 min-h-[110px]">
              <p className="text-[10px] font-semibold text-base-muted mb-2">{label}</p>
              <div className="space-y-1.5">
                {events.length === 0 && <p className="text-[10px] text-base-line">Sin eventos</p>}
                {events.slice(0, 4).map(e => (
                  <div key={e.id} className="flex items-start gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${IMPACT_DOT[e.impact ?? 'low']}`} />
                    <span className="text-[10px] text-base-muted leading-tight line-clamp-2">{e.name}</span>
                  </div>
                ))}
                {events.length > 4 && <p className="text-[9px] text-base-muted">+{events.length - 4} más</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
