import type { WeeklyOutlook } from '@/lib/engines/weeklyMacroEngine'

interface Props { outlook: WeeklyOutlook }

export function WeeklyOutlookCard({ outlook }: Props) {
  return (
    <div className="card p-6 mb-5 border-base-line/60">
      <div className="flex items-center justify-between mb-4">
        <p className="card-title">Outlook Semanal IA</p>
        <div className="text-right">
          <p className="text-[9px] text-base-muted uppercase tracking-widest leading-none mb-1">Convicción IA</p>
          <p className="text-sm font-bold text-base-text/90 tabular leading-none">{outlook.conviction}%</p>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {outlook.summary.map((line, i) => (
          <p key={i} className="text-[15px] text-base-text/90 leading-relaxed">{line}</p>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-base-line/60">
        <div>
          <p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Catalizador principal</p>
          <p className="text-xs font-semibold text-base-text/85">{outlook.mainCatalyst}</p>
        </div>
        <div>
          <p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Mayor riesgo</p>
          <p className="text-xs font-semibold text-neg">{outlook.biggestRisk}</p>
        </div>
        <div>
          <p className="text-[9px] text-base-muted uppercase tracking-widest mb-1">Mayor oportunidad</p>
          <p className="text-xs font-semibold text-pos">{outlook.biggestOpportunity}</p>
        </div>
      </div>
    </div>
  )
}
