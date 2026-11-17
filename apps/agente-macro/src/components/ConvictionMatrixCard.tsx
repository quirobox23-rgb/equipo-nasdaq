import type { ConvictionRow } from '@/lib/engines/macroNarrativeEngine'

interface Props { rows: ConvictionRow[] }
const ARROW_COLOR = (arrow: string) => (arrow.includes('↑') ? 'text-pos' : arrow.includes('↓') ? 'text-neg' : 'text-base-muted')

export function ConvictionMatrixCard({ rows }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Conviction Matrix</p>
      <div className="grid grid-cols-5 gap-2 text-[9px] text-base-muted uppercase tracking-widest mb-2 px-1">
        <span>Activo</span><span>Dirección</span><span>Convicción</span><span>Catalizador</span><span>Confianza IA</span>
      </div>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.asset} className="grid grid-cols-5 gap-2 items-center px-1 py-1.5 rounded hover:bg-base-panel2/40">
            <span className="text-xs font-semibold text-base-text/90">{r.label}</span>
            <span className={`text-sm font-bold ${ARROW_COLOR(r.arrow)}`}>{r.arrow}</span>
            <span className="text-[11px] text-base-muted">{r.impact}</span>
            <span className="text-[10px] text-base-muted truncate">{r.catalyst}</span>
            <span className="text-[11px] text-base-muted tabular">{r.aiConfidence}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
