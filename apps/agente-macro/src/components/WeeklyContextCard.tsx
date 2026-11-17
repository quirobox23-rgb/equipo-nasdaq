import type { WeeklyNarrative } from '@/lib/engines/narrativeEngine'

interface Props {
  narrative: WeeklyNarrative
}

const STATE_STYLES: Record<string, { badge: string }> = {
  bullish: { badge: 'bg-pos-dim/40 border-pos/50 text-pos' },
  bearish: { badge: 'bg-neg-dim/40 border-neg/50 text-neg' },
  neutral: { badge: 'bg-neutral-dim/30 border-neutral/40 text-neutral' },
}

const ROLE_STARS: Record<string, string> = {
  principal:  '★★★★★',
  secundario: '★★★★',
  riesgo:     '★★★',
}

const ROLE_LABEL: Record<string, string> = {
  principal:  'Evento principal',
  secundario: 'Catalizador secundario',
  riesgo:     'Riesgo adicional',
}

export function WeeklyContextCard({ narrative }: Props) {
  const styles = STATE_STYLES[narrative.state] ?? STATE_STYLES.neutral

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="card-title">Contexto Macro Semanal</p>

        <div className="flex items-center gap-3 shrink-0">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-semibold ${styles.badge}`}>
            <span>{narrative.stateEmoji}</span>
            {narrative.stateLabel}
          </div>
          <div className="text-right">
            <p className="text-[9px] text-base-muted uppercase tracking-widest leading-none mb-1">Confianza</p>
            <p className="text-xs font-semibold text-base-text/85 tabular leading-none">{narrative.confidence}%</p>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="progress-bar h-2.5 mb-4">
        <div className="progress-fill bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]" style={{ width: `${narrative.confidence}%` }} />
      </div>

      {/* Narrative */}
      <div className="space-y-1.5 mb-4">
        {narrative.narrative.map((line, i) => (
          <p key={i} className="text-sm text-base-text/85 leading-relaxed">{line}</p>
        ))}
      </div>

      {/* Key events */}
      {narrative.keyEvents.length > 0 && (
        <div className="pt-3 border-t border-base-line/60 flex flex-wrap gap-x-6 gap-y-2">
          {narrative.keyEvents.map(k => (
            <div key={k.event.id} className="flex items-center gap-2 min-w-0">
              <span className="text-brand text-[11px] tracking-tight shrink-0">{ROLE_STARS[k.role]}</span>
              <div className="min-w-0">
                <p className="text-[9px] text-base-muted uppercase tracking-widest leading-none mb-0.5">{ROLE_LABEL[k.role]}</p>
                <p className="text-xs text-base-text/85 font-medium truncate">{k.event.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
