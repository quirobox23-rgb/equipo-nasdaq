import type { MacroRegime } from '@/lib/engines/macroNarrativeEngine'

interface Props { regime: MacroRegime }

const COLOR_STYLE: Record<string, string> = {
  emerald: 'bg-pos-dim/50 border-pos/40 text-pos',
  red:     'bg-neg-dim/50 border-neg/40 text-neg',
  amber:   'bg-neutral-dim/40 border-neutral/30 text-neutral',
  blue:    'bg-neutral-dim/40 border-neutral/30 text-neutral',
  zinc:    'bg-base-panel2 border-base-line text-base-muted',
}

const BAR_COLOR: Record<string, string> = {
  emerald: 'bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]', red: 'bg-neg', amber: 'bg-neutral', blue: 'bg-neutral', zinc: 'bg-base-muted',
}

export function RegimeCard({ regime }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Detector de Régimen Macro</p>
      <div className={`inline-flex items-center px-3 py-1.5 rounded-md border text-sm font-bold mb-3 ${COLOR_STYLE[regime.color]}`}>
        {regime.name}
      </div>
      <p className="text-xs text-base-muted mb-2">{regime.description}</p>
      <p className="text-sm text-base-text/85 leading-relaxed mb-3">{regime.explanation}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-base-muted uppercase tracking-widest">Probabilidad</span>
        <div className="progress-bar flex-1 h-2.5">
          <div className={`progress-fill ${BAR_COLOR[regime.color]}`} style={{ width: `${regime.probability}%` }} />
        </div>
        <span className="text-[10px] text-base-muted tabular">{regime.probability}%</span>
      </div>
    </div>
  )
}
