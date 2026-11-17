'use client'
import { useEffect, useState } from 'react'
import type { SVGProps } from 'react'
import { FileText } from 'lucide-react'
import type { MacroEvent } from '@/types/macro'
import type { WeeklyMacroContext } from '@/lib/engines/weeklyMacroEngine'
import type { FullMacroNarrative } from '@/lib/engines/macroNarrativeEngine'
import { fetchEarnings, getThisWeekMonFri, hourLabel, type EarningsItem } from '@/lib/earnings'
import { IconCircle } from '@/components/ui'

interface Props {
  context:   WeeklyMacroContext
  narrative: FullMacroNarrative
  topEvents: MacroEvent[]   // mismo criterio (impact high/med, top 5) que ya usa WeeklyHeroCard
}

function IconChevron(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5.5 8l4.5 4.5L14.5 8" />
    </svg>
  )
}

const IMPACT_RANK: Record<string, number> = { Alta: 2, Media: 1, Baja: 0 }
const IMPACT_DOT: Record<string, string> = { high: 'bg-neg', med: 'bg-neutral', low: 'bg-base-muted' }
const ASSET_DISPLAY: Record<string, string> = { NQ: 'NASDAQ', USD: 'USD', GOLD: 'ORO', VIX: 'VIX' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col py-3 border-b border-base-line/70 last:border-0">
      <p className="metric-label text-sm">{label}</p>
      <div className="text-[13px] text-base-text/85 leading-relaxed">{children}</div>
    </div>
  )
}

export function WeeklyBriefingAccordion({ context, narrative, topEvents }: Props) {
  const [open, setOpen] = useState(false)
  const [earnings, setEarnings] = useState<EarningsItem[] | null>(null)

  useEffect(() => {
    if (!open || earnings !== null) return
    const { from, to } = getThisWeekMonFri()
    fetchEarnings(from, to).then(setEarnings)
  }, [open, earnings])

  // Es un detalle de presentación (no un cálculo nuevo): decide la etiqueta según si la
  // semana ya empezó, reutilizando la fecha del sistema como en el resto del terminal.
  const isMonday = new Date().getDay() === 1
  const title = isMonday ? 'Weekly Briefing' : 'Morning Briefing'

  const sensitiveAssets = [...narrative.convictionMatrix]
    .sort((a, b) => (IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact]) || (b.aiConfidence - a.aiConfidence))
    .slice(0, 3)

  return (
    <div className="group relative w-full rounded-xl border border-base-line bg-gradient-to-br from-base-panel to-base-panel2 overflow-hidden transition-all duration-200 hover:border-brand hover:shadow-[0_12px_24px_rgba(59,130,246,0.15)]">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]" />
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-full flex items-center justify-center px-6 py-5 text-left hover:bg-base-panel2/40 transition-colors"
      >
        <span className="flex items-center gap-3 font-display text-base font-black text-base-text uppercase tracking-widest">
          <IconCircle color="primary" size={36}><FileText size={18} /></IconCircle>
          {title}
        </span>
        <span className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-base-panel2 shrink-0">
          <IconChevron className={`w-4 h-4 text-base-text transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">
            <Row label="Resumen ejecutivo">
              {narrative.regime.name} — {narrative.marketStory.story[0]}
            </Row>

            <Row label="Catalizador dominante">
              {context.dominantCatalyst}
            </Row>

            <Row label="Riesgo esperado">
              {context.volatilityLevel} <span className="text-base-muted">· {context.expansionProbability}% prob. expansión</span>
            </Row>

            <Row label="Activos más sensibles">
              <div className="flex flex-wrap gap-1.5">
                {sensitiveAssets.map(a => (
                  <span key={a.asset} className="chain-token">
                    {ASSET_DISPLAY[a.asset] ?? a.label} {a.arrow}
                  </span>
                ))}
              </div>
            </Row>

            <Row label="Eventos más importantes">
              {topEvents.length === 0 ? (
                <span className="text-base-muted">Sin eventos relevantes esta semana.</span>
              ) : (
                <ul className="space-y-1">
                  {topEvents.map(e => (
                    <li key={e.id} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[e.impact ?? 'low']}`} />
                      {e.name}
                    </li>
                  ))}
                </ul>
              )}
            </Row>

            <Row label="Earnings destacados">
              {earnings === null ? (
                <span className="text-base-muted italic">Cargando…</span>
              ) : earnings.length === 0 ? (
                <span className="text-base-muted">Sin earnings de las magníficas esta semana.</span>
              ) : (
                <div className="space-y-2">
                  {[...new Set(earnings.map(e => e.date))].sort().map(date => {
                    const dayEarnings = earnings.filter(e => e.date === date)
                    const weekday = new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long' })
                    return (
                      <div key={date} className="flex items-start gap-2">
                        <span className="text-base-muted capitalize w-16 shrink-0">{weekday}</span>
                        <div className="flex flex-wrap gap-1">
                          {dayEarnings.map(e => (
                            <span key={e.symbol} className="chain-token">
                              {e.symbol}{hourLabel(e.hour) && <span className="text-base-muted"> · {hourLabel(e.hour)}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Row>

            <Row label="Convicción IA">
              <span className="metric-value text-lg">{context.conviction}%</span>
            </Row>

            <Row label="Escenario dominante">
              {narrative.regime.name} <span className="text-base-muted">· {narrative.marketStory.confidence.label}</span>
            </Row>
          </div>
        </div>
      </div>
    </div>
  )
}
