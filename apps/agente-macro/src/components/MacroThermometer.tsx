import type { ThermometerReading } from '@/lib/engines/weeklyMacroEngine'

interface Props { readings: ThermometerReading[] }

export function MacroThermometer({ readings }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Termómetro Macro</p>
      <div className="space-y-4">
        {readings.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-base-text">{r.label}</span>
              <span className="metric-value text-lg">{r.intensity}%</span>
            </div>
            <div className="progress-bar h-2.5">
              <div className="progress-fill bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]" style={{ width: `${r.intensity}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
