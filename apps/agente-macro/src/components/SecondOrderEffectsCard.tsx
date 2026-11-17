import type { EffectChainNode } from '@/lib/engines/macroNarrativeEngine'

interface Props { effects: EffectChainNode[] }

const DIR_STYLE: Record<string, { symbol: string; color: string }> = {
  up:   { symbol: '↑', color: 'text-pos' },
  down: { symbol: '↓', color: 'text-neg' },
  neut: { symbol: '→', color: 'text-base-muted' },
}

export function SecondOrderEffectsCard({ effects }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Second Order Effects</p>
      <div className="flex flex-col">
        {effects.map((e, i) => {
          const d = DIR_STYLE[e.direction]
          return (
            <div key={`${e.label}-${i}`}>
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-base-text/90">{e.label}</span>
                <span className={`text-sm font-bold ${d.color}`}>{d.symbol}</span>
              </div>
              {i < effects.length - 1 && <span className="text-base-line text-xs pl-1">│</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
