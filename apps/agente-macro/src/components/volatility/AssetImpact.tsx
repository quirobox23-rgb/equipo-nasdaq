import { Clock } from 'lucide-react'
import type { WeekAssetImpact } from '@/lib/weekCalendar'

// Impacto esperado en activos: cadena (tema → USD → NASDAQ → ORO) + tabla por
// activo, NASDAQ destacado. Lo usan Volatilidad ("La semana") y El Mercado Hoy.
// Los datos salen de weekAssetImpact (lib/weekCalendar).

const ARROW: Record<string, string> = { up: '↑', down: '↓', neut: '→' }
const ARROW_CLS: Record<string, string> = { up: 'text-pos', down: 'text-neg', neut: 'text-base-faint' }

export function AssetImpact({ assets, theme, compact = false }: { assets: WeekAssetImpact[]; theme: string; compact?: boolean }) {
  if (assets.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-base-line p-3.5 text-[13px] leading-relaxed text-base-muted">
        <Clock size={18} className="mt-0.5 shrink-0 text-base-faint" />
        <div>
          <b className="mb-0.5 block font-medium text-base-text">Se calcula a medida que se publican los datos</b>
          Todavía no salió ningún dato de la semana. Mientras tanto, los escenarios de cada evento están en el calendario.
        </div>
      </div>
    )
  }
  const byKey = Object.fromEntries(assets.map(a => [a.asset, a]))
  const chain = [
    { label: theme, dir: null as string | null },
    ...['USD', 'NASDAQ', 'GOLD'].filter(k => byKey[k]).map(k => ({ label: byKey[k].label, dir: byKey[k].dir as string })),
  ]
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-base-line bg-base-bg px-3 py-2.5 text-[13px]">
        <span className="mr-1 text-xs text-base-faint">Cadena</span>
        {chain.map((n, i) => (
          <span key={n.label} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-base-faint">→</span>}
            <span className="text-base-text">{n.label}{n.dir && <b className={`ml-0.5 ${ARROW_CLS[n.dir]}`}>{ARROW[n.dir]}</b>}</span>
          </span>
        ))}
      </div>
      <table className="mt-3 w-full border-separate border-spacing-0">
        <tbody>
          {assets.map(a => {
            const nqRow = a.asset === 'NASDAQ'
            return (
              <tr key={a.asset} className={`[&>td]:border-t [&>td]:border-base-line ${compact ? '[&>td]:py-2' : '[&>td]:py-2.5'} [&>td]:text-[13px]`}>
                <td className={nqRow ? 'font-bold text-base-text' : 'text-base-muted'}>{a.label}</td>
                <td className={`font-bold ${ARROW_CLS[a.dir]} ${nqRow ? 'text-lg' : ''}`}>{ARROW[a.dir]}</td>
                <td className="text-base-text">{a.impact}</td>
                <td className="text-right font-mono text-base-muted">{a.conviction}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
