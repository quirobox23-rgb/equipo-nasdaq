import { Activity } from 'lucide-react'
import type { WeeklyMacroContext } from '@/lib/engines/weeklyMacroEngine'
import type { ConvictionRow, ExecutiveSummary } from '@/lib/engines/macroNarrativeEngine'
import { IconCircle } from '@/components/ui'

interface Props {
  context: WeeklyMacroContext
  matrix:  ConvictionRow[]
  summary: ExecutiveSummary
}

function riskPill(level: WeeklyMacroContext['volatilityLevel']): { label: string; tone: string } {
  if (level === 'Muy Alta' || level === 'Alta') return { label: 'ALTO', tone: 'text-neg' }
  if (level === 'Media') return { label: 'MEDIO', tone: 'text-neutral' }
  return { label: 'BAJO', tone: 'text-pos' }
}

function assetPill(row: ConvictionRow | undefined, up: string, down: string): { label: string; tone: string } {
  if (!row) return { label: '—', tone: 'text-base-muted' }
  if (row.arrow.includes('↑')) return { label: up,   tone: up===down ? 'text-neg' : 'text-pos' }
  if (row.arrow.includes('↓')) return { label: down,  tone: 'text-neg' }
  return { label: 'NEUTRAL', tone: 'text-neutral' }
}

export function MarketPulseCard({ context, matrix, summary }: Props) {
  const usdRow = matrix.find(r => r.asset === 'USD')
  const nqRow  = matrix.find(r => r.asset === 'NQ')
  const vixRow = matrix.find(r => r.asset === 'VIX')

  const risk   = riskPill(context.volatilityLevel)
  const usd    = assetPill(usdRow, 'FUERTE', 'DÉBIL')
  const nasdaq = assetPill(nqRow, 'ALCISTA', 'BAJISTA')
  // Para el VIX, subir = más riesgo (ALTO), bajar = calma (BAJO) — no fuerte/débil.
  const vix    = vixRow
    ? (vixRow.arrow.includes('↑') ? { label: 'ALTO', tone: 'text-neg' }
      : vixRow.arrow.includes('↓') ? { label: 'BAJO', tone: 'text-pos' }
      : { label: 'NEUTRAL', tone: 'text-neutral' })
    : { label: '—', tone: 'text-base-muted' }

  const rows: { label: string; pill: { label: string; tone: string } }[] = [
    { label: 'RIESGO',  pill: risk },
    { label: 'USD',     pill: usd },
    { label: 'NASDAQ',  pill: nasdaq },
    { label: 'VIX',     pill: vix },
  ]

  return (
    <div className="market-pulse-card w-full max-w-2xl rounded-xl border border-base-line bg-base-bg/80 backdrop-blur-md p-7">
      <div className="flex items-center justify-center gap-3 mb-1">
        <IconCircle color="primary" size={36}><Activity size={18} /></IconCircle>
        <span className="font-display text-base font-black text-base-text uppercase tracking-widest">¿Cómo está el mercado hoy?</span>
      </div>
      <p className="text-[12px] text-base-muted text-center mb-6 leading-relaxed">{summary.dominantNarrative}</p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {rows.map(r => (
          <div key={r.label} className="text-center">
            <p className="metric-label text-sm mb-1.5">{r.label}</p>
            <p className={`metric-value text-3xl ${r.pill.tone}`}>{r.pill.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
