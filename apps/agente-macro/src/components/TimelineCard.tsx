import type { TimelineStep } from '@/lib/engines/macroNarrativeEngine'

interface Props { steps: TimelineStep[] }

export function TimelineCard({ steps }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Timeline Esperada</p>
      <div className="space-y-0">
        {steps.map((s, i) => (
          <div key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full bg-base-muted shrink-0 mt-1" />
              {i < steps.length - 1 && <span className="w-px flex-1 bg-base-panel2 my-0.5" />}
            </div>
            <div className="pb-4">
              <p className="text-xs font-semibold text-base-text/90 mb-0.5">{s.label}</p>
              <p className="text-[11px] text-base-muted leading-relaxed">{s.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
