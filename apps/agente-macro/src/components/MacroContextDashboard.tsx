import type { WeeklyMacroContext } from '@/lib/engines/weeklyMacroEngine'

interface Props { context: WeeklyMacroContext }

const REGIME_STYLE: Record<string, string> = {
  'risk-on':  'bg-pos-dim/50 border-pos/40 text-pos',
  'risk-off': 'bg-neg-dim/50 border-neg/40 text-neg',
  'neutral':  'bg-neutral-dim/40 border-neutral/30 text-neutral',
}
const VOL_STYLE: Record<string, string> = {
  'Baja': 'text-base-muted', 'Media': 'text-neutral', 'Alta': 'text-neutral', 'Muy Alta': 'text-neg',
}

export function MacroContextDashboard({ context }: Props) {
  return (
    <div className="metric-hero mb-5">
      <p className="card-title">Macro Context Dashboard</p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Stat label="Sesgo semanal">
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${REGIME_STYLE[context.regime]}`}>
            {context.regimeLabel}
          </span>
        </Stat>
        <Stat label="Convicción IA"><span className="metric-value">{context.conviction}%</span></Stat>
        <Stat label="Evento principal"><span className="text-sm font-medium text-base-text truncate block">{context.mainEvent?.name ?? '—'}</span></Stat>
        <Stat label="Catalizador dominante"><span className="text-sm font-medium text-base-text">{context.dominantCatalyst}</span></Stat>
        <Stat label="Volatilidad esperada"><span className={`text-sm font-semibold ${VOL_STYLE[context.volatilityLevel]}`}>{context.volatilityLevel}</span></Stat>
        <Stat label="Prob. expansión"><span className="metric-value">{context.expansionProbability}%</span></Stat>
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] text-base-muted uppercase tracking-widest leading-none mb-1.5">{label}</p>
      {children}
    </div>
  )
}
