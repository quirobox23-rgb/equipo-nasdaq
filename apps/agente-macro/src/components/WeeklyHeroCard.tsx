import type { MacroEvent } from '@/types/macro'
import type { WeeklyMacroContext } from '@/lib/engines/weeklyMacroEngine'
import type { MacroRegime, ExecutiveSummary } from '@/lib/engines/macroNarrativeEngine'

interface Props {
  weekLabel:    string
  context:      WeeklyMacroContext
  regime:       MacroRegime
  summary:      ExecutiveSummary
  topEvents:    MacroEvent[]
  dayOfEvent:   (e: MacroEvent) => string
  onJumpToEvent: (e: MacroEvent) => void
}

const REGIME_DOT: Record<string, string> = {
  'risk-on': 'bg-pos', 'risk-off': 'bg-neg', 'neutral': 'bg-neutral',
}
const VOL_STYLE: Record<string, string> = {
  'Baja': 'text-base-muted', 'Media': 'text-neutral', 'Alta': 'text-neg', 'Muy Alta': 'text-neg',
}
const IMPACT_DOT: Record<string, string> = { high: 'bg-neg', med: 'bg-neutral', low: 'bg-base-muted' }
const IMPACT_LABEL: Record<string, string> = { high: 'Muy alto', med: 'Alto', low: 'Bajo' }

export function WeeklyHeroCard({ weekLabel, context, regime, summary, topEvents, dayOfEvent, onJumpToEvent }: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-base-line bg-gradient-to-br from-base-panel via-base-panel to-base-bg p-6 mb-6">
      {/* faint corner glow — visual identity only */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        {/* Top row: week + regime */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-base-muted uppercase tracking-widest mb-1">Resumen semanal</p>
            <h1 className="text-2xl font-semibold text-base-text">{weekLabel}</h1>
          </div>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold
            ${context.regime === 'risk-on' ? 'bg-pos-dim/40 border-pos/50 text-pos'
              : context.regime === 'risk-off' ? 'bg-neg-dim/40 border-neg/50 text-neg'
              : 'bg-neutral-dim/30 border-neutral/40 text-neutral'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${REGIME_DOT[context.regime]}`} />
            {context.regimeLabel} · {regime.name}
          </span>
        </div>

        {/* Summary line */}
        <p className="text-sm text-base-muted leading-relaxed max-w-3xl">
          Catalizador dominante <span className="text-base-text/90 font-medium">{context.dominantCatalyst}</span>, con{' '}
          <span className="text-base-text/90 font-medium">{summary.keyEvent}</span> como evento clave. Activo favorecido:{' '}
          <span className="text-base-text/90 font-medium">{summary.favoredAsset}</span>. Riesgo principal: {summary.biggestRisk.toLowerCase()}.
        </p>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 border-t border-base-line/70">
          <Stat label="Riesgo esperado">
            <span className={`metric-value text-lg ${VOL_STYLE[context.volatilityLevel]}`}>{context.volatilityLevel}</span>
            <span className="text-[10px] text-base-muted ml-1.5">{context.expansionProbability}% prob. expansión</span>
          </Stat>
          <Stat label="Nivel de importancia">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${IMPACT_DOT[context.mainEvent?.impact ?? 'low']}`} />
              <span className="metric-value text-lg">{IMPACT_LABEL[context.mainEvent?.impact ?? 'low']}</span>
            </span>
          </Stat>
          <Stat label="Convicción IA">
            <span className="metric-value text-lg">{context.conviction}%</span>
          </Stat>
          <Stat label="Earnings destacados">
            <span className="text-xs text-base-muted italic">Sin fuente conectada aún</span>
          </Stat>
        </div>

        {/* Top events row */}
        {topEvents.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-bold text-base-text uppercase tracking-wide mb-2">Eventos principales de la semana</p>
            <div className="flex flex-wrap gap-2">
              {topEvents.map(e => (
                <button
                  key={e.id}
                  onClick={() => onJumpToEvent(e)}
                  className="flex items-center gap-2 bg-base-panel2/60 hover:bg-base-panel2 border border-base-line/60 rounded-lg px-3 py-1.5 text-left transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[e.impact ?? 'low']}`} />
                  <span className="text-xs text-base-text/85 font-medium">{e.name}</span>
                  <span className="text-[10px] text-base-muted">{dayOfEvent(e)}{e.time ? ` · ${e.time}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="metric-label text-xs">{label}</p>
      {children}
    </div>
  )
}
