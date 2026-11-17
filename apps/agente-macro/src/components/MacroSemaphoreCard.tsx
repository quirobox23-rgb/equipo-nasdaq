import type { SemaphoreReading } from '@/lib/engines/macroNarrativeEngine'

interface Props { readings: SemaphoreReading[] }

export function MacroSemaphoreCard({ readings }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Semáforo Macro</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {readings.map(r => (
          <div key={r.label} className="flex items-center gap-2 rounded-md border border-base-line bg-base-panel/60 px-3 py-2">
            <span className="text-sm">{r.emoji}</span>
            <span className="text-[11px] text-base-text/85 font-medium truncate">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
