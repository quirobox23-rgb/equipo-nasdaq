import type { MarketContext } from '@/lib/engines/marketContextEngine'

interface Props {
  context: MarketContext
}

const REGIME_STYLES: Record<string, { badge: string; dot: string }> = {
  'risk-on':  { badge: 'bg-pos-dim/50 border-pos/40 text-pos',         dot: 'bg-pos'     },
  'risk-off': { badge: 'bg-neg-dim/50 border-neg/40 text-neg',         dot: 'bg-neg'     },
  neutral:    { badge: 'bg-neutral-dim/40 border-neutral/30 text-neutral', dot: 'bg-neutral' },
}

const VOL_CLASS: Record<string, string> = {
  alta:     'text-neg',
  moderada: 'text-neutral',
  baja:     'text-base-muted',
}

export function MarketContextBadge({ context: c }: Props) {
  const styles = REGIME_STYLES[c.regime] ?? REGIME_STYLES.neutral

  return (
    <div className="space-y-2">
      {/* Regime pill */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold ${styles.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
        {c.label}
      </div>

      {/* Flow description */}
      <p className="text-xs text-base-muted leading-relaxed">{c.flow}</p>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-1">
        <div>
          <p className="text-[10px] text-base-muted uppercase tracking-widest">Volatilidad</p>
          <p className={`text-xs font-medium mt-0.5 ${VOL_CLASS[c.volatility]}`}>
            {c.volatility.toUpperCase()}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-base-muted uppercase tracking-widest">Score día</p>
          <p className="text-xs font-medium mt-0.5 text-base-text/80 tabular">{c.dayScore}</p>
        </div>
        {c.pendingHighImpact > 0 && (
          <div>
            <p className="text-[10px] text-base-muted uppercase tracking-widest">Eventos alto impacto</p>
            <p className="text-xs font-medium mt-0.5 text-neutral tabular">{c.pendingHighImpact} pendientes</p>
          </div>
        )}
      </div>

      {/* Session warning */}
      {c.sessionWarning && (
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral bg-neutral-dim/30 border border-neutral/30 rounded px-2.5 py-1.5">
          <span>⚡</span>
          <span>NY Open + alta actividad macro — máxima precaución</span>
        </div>
      )}
    </div>
  )
}
