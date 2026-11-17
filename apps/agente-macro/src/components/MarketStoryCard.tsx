import type { MarketStoryResult } from '@/lib/engines/macroNarrativeEngine'

interface Props { story: MarketStoryResult }

export function MarketStoryCard({ story }: Props) {
  const confColor = story.confidence.score >= 75 ? 'text-pos' : story.confidence.score >= 50 ? 'text-neutral' : 'text-neg'

  return (
    <div className="card p-6 mb-5 border-base-line/60">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-base-text/90">¿Qué historia está descontando el mercado?</p>
        <div className="text-right">
          <p className="text-[9px] text-base-muted uppercase tracking-widest leading-none mb-1">Market Confidence</p>
          <p className={`text-sm font-bold tabular leading-none ${confColor}`}>{story.confidence.score}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {story.story.map((line, i) => (
          <p key={i} className="text-[15px] text-base-text/90 leading-relaxed">{line}</p>
        ))}
      </div>

      <p className={`text-[11px] mb-4 ${confColor}`}>{story.confidence.label}</p>

      {story.invalidators.length > 0 && (
        <div className="pt-4 border-t border-base-line/60">
          <p className="card-title">La narrativa actual falla si:</p>
          <ul className="space-y-1">
            {story.invalidators.map((inv, i) => (
              <li key={i} className="text-xs text-base-muted flex gap-2"><span className="text-neg">·</span>{inv}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
