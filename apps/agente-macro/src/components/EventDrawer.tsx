'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Star, ChevronDown, ChevronRight, ChevronUp, Equal } from 'lucide-react'
import type { MacroEvent } from '@/types/macro'
import { useEventTemplate, type EventTemplate } from '@/hooks/useEventTemplate'
import { Badge, type BadgeVariant } from '@/components/ui'
import { eventOutcome, eventStars, isPublished, OUTCOME_LABEL, scenarioText, type Outcome } from '@/lib/eventOutcome'

// Detalle de un evento en panel lateral (bottom sheet en mobile).
// Reemplaza a EventDetailModal en /eventos-economicos — el modal queda en el
// repo sin tocar. Diseño: mockup-eventos-v2 / docs/plan-rediseno-eventos.md.
//
// No es modal en desktop: el calendario sigue clickeable detrás, así se puede
// pasar de un evento a otro sin cerrar. Cierra con X, Esc o click afuera
// (salvo dentro de un área marcada con data-event-drawer-keep, que es donde
// están los eventos).

interface EventDrawerProps {
  event: MacroEvent | null
  onClose: () => void
}

const WEEKDAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const OUTCOME_BADGE: Record<Outcome, BadgeVariant> = { better: 'pos', inline: 'neutral', worse: 'neg' }
const COLUMNS: Outcome[] = ['better', 'inline', 'worse']
const COLUMN_ICON = { better: ChevronUp, inline: Equal, worse: ChevronDown }

function formatDay(date?: string): string | null {
  if (!date) return null
  const d = new Date(`${date}T00:00:00Z`)
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()}`
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={13} fill="currentColor" strokeWidth={0} className={i <= n ? 'text-base-text' : 'text-base-line'} />
      ))}
    </span>
  )
}

function arrowFor(dir: string | undefined) {
  if (dir === 'up') return <span className="text-pos font-bold">↑</span>
  if (dir === 'down') return <span className="text-neg font-bold">↓</span>
  return <span className="text-base-faint">–</span>
}

function ScenarioMatrix({ template, outcome }: { template: EventTemplate; outcome: Outcome | null }) {
  const assets = [...(template.affectedAssets ?? [])].sort((a, b) => Number(b === 'NASDAQ') - Number(a === 'NASDAQ'))
  const dirs: Record<Outcome, Record<string, string> | undefined> = {
    better: template.assetsBeat, inline: template.assetsInline, worse: template.assetsMiss,
  }
  const colCls = (c: Outcome) => (outcome ? (outcome === c ? 'bg-base-panel2' : 'opacity-35') : '')

  if (assets.length === 0) return null
  return (
    <div className="mt-3.5 rounded-[10px] border border-base-line bg-base-bg px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-base-muted mb-2">Si el dato sale…</p>
      <table className="w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="w-[20%]" />
            {COLUMNS.map(c => {
              const Icon = COLUMN_ICON[c]
              const hit = outcome === c
              return (
                <th key={c} className={`px-1 pt-1.5 pb-2.5 align-bottom font-normal rounded-t-lg ${colCls(c)}`}>
                  {hit && <span className="block text-[10px] font-bold uppercase tracking-wider text-base-text mb-1.5">Salió</span>}
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 font-display text-xs font-semibold whitespace-nowrap ${
                    hit ? 'bg-base-text border-base-text text-base-bg' : 'bg-base-panel2 border-base-line text-base-text'
                  }`}>
                    <Icon size={13} strokeWidth={2.4} className={hit ? 'text-base-bg' : 'text-base-muted'} />
                    {OUTCOME_LABEL[c]}
                  </span>
                  <small className="block mt-1.5 text-[11px] text-base-faint">{c === 'inline' ? ' ' : 'que el pronóstico'}</small>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {assets.map(asset => {
            const nq = asset === 'NASDAQ'
            return (
              <tr key={asset}>
                <td className={`py-1.5 border-t border-base-line/60 ${nq ? 'py-2.5 text-[13px] font-bold text-base-text' : 'text-xs text-base-faint'}`}>{asset}</td>
                {COLUMNS.map(c => (
                  <td key={c} className={`text-center border-t border-base-line/60 ${nq ? 'text-lg' : 'text-[13px] opacity-70'} ${colCls(c)}`}>
                    {arrowFor(dirs[c]?.[asset])}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td />
            {COLUMNS.map(c => (
              <td key={c} className={`px-1.5 pt-2.5 pb-2 align-top text-center text-xs leading-snug rounded-b-lg ${
                outcome === c ? 'text-base-text' : 'text-base-muted'
              } ${colCls(c)}`}>
                <span className="line-clamp-4" title={scenarioText(template, c)}>{scenarioText(template, c)}</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DrawerContent({ event, onClose }: { event: MacroEvent; onClose: () => void }) {
  const template = useEventTemplate(event.name)
  const [whatOpen, setWhatOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  const published = isPublished(event)
  const outcome = published ? eventOutcome(event, template) : null
  const stars = eventStars(event, template)
  const day = formatDay(event.date)
  const hasData = event.prev != null || event.forecast != null || event.actual != null
  const isEarnings = event.type === 'earnings'
  // Earnings: EPS estimado / facturación / EPS real. Macro: anterior / pronóstico / actual.
  const cells = isEarnings
    ? [
        { label: 'EPS estimado', value: event.forecast },
        { label: 'Facturación', value: event.revenueActual ?? (event.revenueEstimate ? `${event.revenueEstimate} est.` : null) },
      ]
    : [
        { label: 'Anterior', value: event.prev },
        { label: 'Pronóstico', value: event.forecast },
      ]
  const rules = template?.specialRules ?? []

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* Encabezado */}
        <div className="bg-base-panel2 border-b border-base-line px-6 pt-5 pb-4 max-sm:px-4">
          <div className="flex items-start gap-3">
            <h2 id="event-drawer-title" className="flex-1 font-display text-xl font-semibold leading-tight text-base-text">{event.name}</h2>
            <button onClick={onClose} aria-label="Cerrar" className="-mr-1.5 -mt-0.5 grid h-7 w-7 place-items-center rounded-md text-base-muted hover:bg-base-panel hover:text-base-text">
              <X size={18} />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-base-muted">
            {(day || event.time) && <span>{[day, event.time].filter(Boolean).join(' · ')}</span>}
            <span className="text-base-faint">·</span>
            <Stars n={stars} />
            {template?.frequency && <><span className="text-base-faint">·</span><span>{template.frequency}</span></>}
            {template && (
              <>
                <span className="text-base-faint">·</span>
                <button
                  onClick={() => setWhatOpen(o => !o)}
                  aria-expanded={whatOpen}
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  ¿Qué es?
                  <ChevronDown size={12} strokeWidth={2.2} className={`transition-transform ${whatOpen ? 'rotate-180' : ''}`} />
                </button>
              </>
            )}
          </div>
          {template && whatOpen && (
            <div className="mt-3 rounded-[10px] border border-base-line bg-base-panel px-3.5 py-3 text-[13px] leading-relaxed text-base-text">
              <p>{[template.description, template.narrative].filter(Boolean).join(' ')}</p>
              {template.nqImpact && (
                <p className="mt-2"><b className="font-bold text-brand">Cómo afecta al NQ:</b> {template.nqImpact}</p>
              )}
              {template.dependencies && (
                <p className="mt-2"><b className="font-bold text-brand">Se relaciona con:</b> {template.dependencies}</p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pt-4 pb-6 max-sm:px-4">
          {/* Dato: Actual protagonista */}
          {hasData && (
            <div className="flex rounded-[10px] border border-base-line bg-base-bg">
              {cells.map((c, i) => (
                <div key={c.label} className={`flex-1 px-3 py-2.5 ${i ? 'border-l border-base-line' : ''}`}>
                  <p className="text-[11px] text-base-muted">{c.label}</p>
                  <p className="mt-1 font-mono text-[15px] font-bold text-base-muted">{c.value ?? '—'}</p>
                </div>
              ))}
              <div className="flex-[1.6] border-l border-base-line px-3 py-2.5">
                <p className="text-[11px] text-base-muted">{isEarnings ? 'EPS real' : 'Actual'}</p>
                {published ? (
                  <div className="mt-0.5 flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-bold leading-tight text-base-text">{event.actual}</span>
                    {outcome && <Badge variant={OUTCOME_BADGE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[13px] font-medium text-base-faint">
                    {isEarnings ? (event.time ? `Reporta ${event.time.toLowerCase()}` : 'Pendiente') : event.time ? `Sale ${event.time} hs` : 'Pendiente'}
                  </p>
                )}
              </div>
            </div>
          )}

          {template ? (
            <>
              <ScenarioMatrix template={template} outcome={outcome} />

              {rules.length > 0 && (
                <div className="mt-4 rounded-[10px] border border-base-line bg-base-panel2">
                  <button
                    onClick={() => setRulesOpen(o => !o)}
                    aria-expanded={rulesOpen}
                    className="flex w-full items-center gap-2 rounded-[10px] px-3.5 py-3 text-[13px] font-medium text-base-text hover:bg-white/[.02]"
                  >
                    <ChevronRight size={14} className={`text-base-muted transition-transform ${rulesOpen ? 'rotate-90' : ''}`} />
                    Comentarios del Mentor IA
                    <span className="font-normal text-base-faint">{rules.length}</span>
                  </button>
                  {rulesOpen && (
                    <dl className="px-3.5 pb-3.5 text-[13px] leading-relaxed">
                      {rules.map((rule, i) => {
                        // "REVISIONS: texto…" → término + explicación
                        const m = rule.match(/^([A-Z0-9][A-Z0-9 \-/vs.&]+):\s*(.*)$/)
                        return m ? (
                          <div key={i} className={i ? 'mt-2.5' : ''}>
                            <dt className="font-medium text-base-text">{m[1].charAt(0) + m[1].slice(1).toLowerCase()}</dt>
                            <dd className="mt-0.5 text-base-muted">{m[2]}</dd>
                          </div>
                        ) : (
                          <dd key={i} className={`text-base-muted ${i ? 'mt-2.5' : ''}`}>{rule}</dd>
                        )
                      })}
                    </dl>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="mt-5 rounded-lg border border-dashed border-base-line p-3 text-[13px] leading-relaxed text-base-muted">
              Este evento todavía no tiene ficha: se muestran solo los datos.
            </p>
          )}
        </div>
      </div>

      {/* Sin pie con link al Mentor IA: hoy Mentor IA es el briefing de los agentes,
          solo para administradores (no un chat para el alumno). */}
    </>
  )
}

export function EventDrawer({ event, onClose }: EventDrawerProps) {
  // Se guarda el último evento para que el contenido no desaparezca durante
  // la animación de cierre.
  const [shown, setShown] = useState<MacroEvent | null>(event)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (event) {
      setShown(event)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setShown(null), 220)
    return () => clearTimeout(t)
  }, [event])

  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (panelRef.current?.contains(target)) return
      if (target.closest('[data-event-drawer-keep]')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [event, onClose])

  if (!shown) return null

  return (
    <>
      {/* Fondo: en mobile tapa y cierra al tocar; en desktop solo oscurece
          (pointer-events-none) para que el calendario siga clickeable y se
          pueda pasar de un evento a otro con el panel abierto. */}
      <div
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity duration-200 sm:pointer-events-none sm:bg-black/25 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-labelledby="event-drawer-title"
        className={`fixed z-50 flex flex-col overflow-hidden border-base-line bg-base-panel shadow-2xl transition-transform duration-200 ease-out
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t
          sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:max-h-none sm:w-[520px] sm:rounded-none sm:border-t-0 sm:border-l
          ${visible ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}`}
      >
        <DrawerContent key={`${shown.date}-${shown.time}-${shown.name}`} event={shown} onClose={onClose} />
      </aside>
    </>
  )
}
