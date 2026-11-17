import type { PlaybookScenario } from '@/lib/engines/macroNarrativeEngine'

interface Props { scenarios: PlaybookScenario[] }
const LETTERS = ['A', 'B', 'C', 'D']

export function PlaybookCard({ scenarios }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Playbook IA</p>
      <div className="space-y-3">
        {scenarios.map((s, i) => (
          <div key={i} className="rounded-md border border-base-line bg-base-panel/60 p-3">
            <p className="text-[11px] text-base-muted mb-1.5">{s.condition}</p>
            <p className="text-xs text-base-text/90"><span className="font-bold text-base-muted">Escenario {LETTERS[i] ?? i + 1} — </span>{s.scenario.replace(/^Escenario [A-Z] — /, '')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
