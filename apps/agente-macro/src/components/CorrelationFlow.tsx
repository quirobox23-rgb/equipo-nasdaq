import type { CorrelationNode } from '@/lib/engines/weeklyMacroEngine'

interface Props { flow: CorrelationNode[] }

const DIR_ARROW: Record<string, { symbol: string; color: string }> = {
  up:   { symbol: '↑', color: 'text-pos' },
  down: { symbol: '↓', color: 'text-neg' },
  neut: { symbol: '→', color: 'text-base-muted' },
}

export function CorrelationFlow({ flow }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Correlaciones</p>
      <div className="flex flex-col items-start">
        {flow.map((node, i) => {
          const d = DIR_ARROW[node.direction]
          return (
            <div key={`${node.label}-${i}`} className="flex flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-base-text">{node.label}</span>
                <span className={`text-lg font-bold ${d.color}`}>{d.symbol}</span>
              </div>
              {i < flow.length - 1 && <span className="text-base-line text-sm pl-1 py-0.5">│</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
