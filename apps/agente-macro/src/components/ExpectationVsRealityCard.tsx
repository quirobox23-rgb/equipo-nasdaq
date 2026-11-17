import type { ExpectationRealityRow } from '@/lib/engines/macroNarrativeEngine'

interface Props { rows: ExpectationRealityRow[] }

export function ExpectationVsRealityCard({ rows }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Expectation vs Reality</p>
      {rows.length === 0 ? (
        <p className="text-xs text-base-muted">Todavía no hay resultados publicados esta semana.</p>
      ) : (
        <div className="space-y-4">
          {rows.map(r => (
            <div key={r.event.id} className="pb-4 border-b border-base-line/60 last:border-0 last:pb-0">
              <p className="text-xs font-semibold text-base-text/90 mb-2">{r.event.name}</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div><p className="text-[9px] text-base-muted uppercase tracking-widest">Esperado</p><p className="text-xs text-base-muted">{r.expected}</p></div>
                <div><p className="text-[9px] text-base-muted uppercase tracking-widest">Real</p><p className="text-xs text-base-text/90 font-medium">{r.reality}</p></div>
              </div>
              <p className="text-[11px] text-base-muted leading-relaxed mb-1">→ {r.logicalReaction}</p>
              <p className="text-[11px] text-base-muted leading-relaxed mb-1">→ {r.historicalReaction}</p>
              <p className="text-[11px] text-base-muted leading-relaxed">→ {r.probableReaction}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
