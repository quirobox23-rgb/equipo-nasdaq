import type { VolatilityBar } from '@/lib/engines/weeklyMacroEngine'

interface Props { volatility: VolatilityBar[] }

export function VolatilityHeatmap({ volatility }: Props) {
  const max = Math.max(1, ...volatility.map(v => v.bars))
  return (
    <div className="card p-5">
      <p className="card-title">Mapa de Volatilidad Semanal</p>
      <div className="space-y-2">
        {volatility.map(v => (
          <div key={v.label} className="flex items-center gap-3">
            <span className="text-sm font-bold text-base-text w-8 shrink-0">{v.label.slice(0, 2).toUpperCase()}</span>
            <div className="progress-bar flex-1">
              <div
                className="progress-fill bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]"
                style={{ width: `${(v.bars / max) * 100}%` }}
              />
            </div>
            <span className="metric-value text-lg w-10 text-right shrink-0">{v.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
