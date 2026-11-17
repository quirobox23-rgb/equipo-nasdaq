import type { SVGProps } from 'react'
import type { NarrativeMatrixResult } from '@/lib/engines/weeklyMacroEngine'

interface Props { matrix: NarrativeMatrixResult }

const ARROW_COLOR = (arrow: string) => (arrow.includes('↑') ? 'text-pos' : arrow.includes('↓') ? 'text-neg' : 'text-neutral')

// Ícono propio (sin librería, sin emoji) — apunta a la derecha por defecto
// (lateral) y rota según el sentido; ↑↑/↓↓ (señal fuerte) usan doble chevron.
function DirectionIcon({ arrow, ...p }: { arrow: string } & SVGProps<SVGSVGElement>) {
  const rotate = arrow.includes('↑') ? -90 : arrow.includes('↓') ? 90 : 0
  const strong = arrow.length > 1
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)` }} {...p}>
      {strong ? (
        <>
          <path d="M2.5 5.5l5 4.5-5 4.5" />
          <path d="M10.5 5.5l5 4.5-5 4.5" />
        </>
      ) : (
        <path d="M3.5 10h11M10.5 5l5 5-5 5" />
      )}
    </svg>
  )
}

export function NarrativeMatrix({ matrix }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Matriz de Narrativas Combinadas</p>

      {matrix.inputs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {matrix.inputs.map(({ event, direction }) => (
            <span key={event.id} className="text-[10px] px-2 py-1 rounded border border-base-line bg-base-panel/60 text-base-muted">
              {event.name} <span className="text-base-muted">·</span> {direction}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1.5 mb-4">
        {matrix.narrative.map((line, i) => (
          <p key={i} className="text-sm text-base-text/85 leading-relaxed">{line}</p>
        ))}
      </div>

      <div className="pt-3 border-t border-base-line/60 grid grid-cols-3 sm:grid-cols-5 gap-3">
        {matrix.assets.map(a => (
          <div key={a.asset} className="text-center">
            <p className="text-xs font-bold text-base-text uppercase tracking-wide mb-1.5 truncate">{a.label}</p>
            <DirectionIcon arrow={a.arrow} className={`w-5 h-5 mx-auto ${ARROW_COLOR(a.arrow)}`} />
          </div>
        ))}
        <div className="text-center">
          <p className="text-xs font-bold text-base-text uppercase tracking-wide mb-1.5">Probabilidad</p>
          <p className="text-sm font-bold text-base-text/90 tabular">{matrix.probability}%</p>
        </div>
      </div>
    </div>
  )
}
