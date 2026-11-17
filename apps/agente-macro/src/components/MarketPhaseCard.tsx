interface Props { phase: string; explanation: string }

const PHASE_COLOR: Record<string, string> = {
  'Acumulación': 'text-pos', 'Markup': 'text-pos',
  'Distribución': 'text-neutral', 'Markdown': 'text-neg',
  'Late Trend': 'text-neutral', 'Reversal': 'text-neutral', 'Range': 'text-base-muted',
}

export function MarketPhaseCard({ phase, explanation }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Market Phase</p>
      <p className={`text-xl font-bold mb-2 ${PHASE_COLOR[phase] ?? 'text-base-text/85'}`}>{phase}</p>
      <p className="text-xs text-base-muted leading-relaxed">{explanation}</p>
    </div>
  )
}
