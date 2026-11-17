import type { AssetImpact } from '@/lib/engines/weeklyMacroEngine'

interface Props { assets: AssetImpact[] }

const IMPACT_COLOR: Record<string, string> = { Alta: 'text-neg', Media: 'text-neutral', Baja: 'text-base-muted' }
const ARROW_COLOR = (arrow: string) => (arrow.includes('↑') ? 'text-pos' : arrow.includes('↓') ? 'text-neg' : 'text-base-muted')

export function ExpectedImpactCard({ assets }: Props) {
  return (
    <div className="card p-5">
      <p className="card-title">Impacto Esperado en Activos</p>
      <div className="space-y-2.5">
        {assets.map(a => (
          <div key={a.asset} className="flex items-center justify-between">
            <span className="text-sm font-bold text-base-text w-24 shrink-0">{a.label}</span>
            <span className={`text-lg font-bold tabular ${ARROW_COLOR(a.arrow)}`}>{a.arrow}</span>
            <span className={`text-xs font-medium w-12 text-center ${IMPACT_COLOR[a.impact]}`}>{a.impact}</span>
            <span className="text-xs text-base-muted tabular w-10 text-right">{a.conviction}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
