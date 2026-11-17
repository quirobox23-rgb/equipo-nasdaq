import type { MacroEvent } from '@/types/macro'
import { interpretEvent } from '@/lib/engines/interpretationEngine'
import { buildDayNarrative } from '@/lib/dayNarrative'

interface Props {
  dayLabels: string[]
  dayDates: Date[]
  dayCounts: MacroEvent[][]
}

const STARS: Record<string, string> = { high: '★★★★★', med: '★★★', low: '★' }

function dayImpact(events: MacroEvent[]): 'high' | 'med' | 'low' {
  if (events.some(e => e.impact === 'high')) return 'high'
  if (events.some(e => e.impact === 'med')) return 'med'
  return 'low'
}

function earningsLabel(name: string): string {
  return name.replace(/\s*Earnings\s*$/i, '')
}

export function WeeklyDayCards({ dayLabels, dayDates, dayCounts }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
      {dayLabels.map((label, i) => {
        const events = dayCounts[i]
        const impact = dayImpact(events)
        const mainEvent = [...events].sort((a, b) =>
          ({ high: 2, med: 1, low: 0 }[b.impact ?? 'low'] - { high: 2, med: 1, low: 0 }[a.impact ?? 'low'])
        )[0]
        const earnings = events.filter(e => e.type === 'earnings').map(e => earningsLabel(e.name))
        const comment = buildDayNarrative(events) ??
          (mainEvent ? interpretEvent(mainEvent)?.note ?? null : null)

        return (
          <div key={label} className="card p-4 border-neutral/20 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-base-text/90 uppercase">{label}</p>
              <p className="text-[10px] text-base-muted tabular">{dayDates[i].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
              <p className="text-neutral text-xs mt-1">{STARS[impact]}</p>
            </div>

            {events.length === 0 ? (
              <p className="text-[11px] text-base-line">Sin eventos relevantes</p>
            ) : (
              <>
                {mainEvent && (
                  <div>
                    <p className="text-[12px] font-medium text-base-text/90 leading-snug">{mainEvent.name}</p>
                    {mainEvent.time && <p className="text-[10px] text-base-muted mt-0.5">{mainEvent.time} ET</p>}
                  </div>
                )}

                {earnings.length > 0 && (
                  <div>
                    <p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Earnings destacados</p>
                    <div className="flex flex-wrap gap-1">
                      {earnings.map(name => <span key={name} className="chain-token">{name}</span>)}
                    </div>
                  </div>
                )}

                {comment && (
                  <div className="mt-auto pt-2 border-t border-base-line/60">
                    <p className="text-[9px] text-neutral/80 uppercase tracking-widest mb-1">Comentario Agente Macro</p>
                    <p className="text-[11px] text-base-muted leading-relaxed">{comment}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
