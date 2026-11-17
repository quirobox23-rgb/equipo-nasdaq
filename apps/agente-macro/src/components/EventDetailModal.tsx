'use client'

import {
  X, TrendingUp, TrendingDown, Minus, BarChart3,
} from 'lucide-react'
import type { MacroEvent } from '@/types/macro'
import { useEventTemplate } from '@/hooks/useEventTemplate'
import { Button, Callout, Badge, type BadgeVariant } from '@/components/ui'

const IMPORTANCE_VARIANT: Record<string, BadgeVariant> = { high: 'neg', medium: 'neutral', med: 'neutral', low: 'grey' }
const IMPORTANCE_LABEL: Record<string, string> = { high: 'Alto impacto', medium: 'Impacto medio', med: 'Impacto medio', low: 'Bajo impacto' }

interface EventDetailModalProps {
  event: MacroEvent | null
  isOpen: boolean
  onClose: () => void
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-xs font-bold uppercase tracking-wide text-brand whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-base-line" />
    </div>
  )
}

function EventStat({ label, value, className = 'text-base-text' }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-base-muted">{label}</span>
      <span className={`font-mono text-sm font-bold tabular ${className}`}>{value}</span>
    </div>
  )
}

function getAssetDisplay(direction: string | undefined): { arrow: string; label: string; color: string } {
  switch (direction) {
    case 'up':
      return { arrow: '↑', label: 'Alcista', color: 'text-pos' }
    case 'down':
      return { arrow: '↓', label: 'Bajista', color: 'text-neg' }
    case 'neutral':
    default:
      return { arrow: '→', label: 'Neutral', color: 'text-base-muted' }
  }
}

// Bloque compacto de 3 columnas — mismo orden que investing.com:
// Anterior / Pronóstico / Actual. Muestra "—" si falta el dato, para que
// las 3 columnas queden siempre alineadas en vez de saltar de tamaño.
function EventDataRow({ event }: { event: MacroEvent }) {
  if (!event.prev && !event.forecast && !event.actual) return null

  const actualColor =
    event.direction === 'beat' ? 'text-pos' :
    event.direction === 'miss' ? 'text-neg' :
    'text-base-text'

  return (
    <div className="grid grid-cols-3 gap-3 mt-5">
      <div className="rounded-lg border border-base-line/40 bg-base-bg/40 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-base-muted mb-1">Anterior</p>
        <p className="font-mono text-base font-bold text-base-text">{event.prev ?? '—'}</p>
      </div>
      <div className="rounded-lg border border-base-line/40 bg-base-bg/40 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-base-muted mb-1">Pronóstico</p>
        <p className="font-mono text-base font-bold text-base-text">{event.forecast ?? '—'}</p>
      </div>
      <div className="rounded-lg border border-base-line/40 bg-base-bg/40 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-base-muted mb-1">Actual</p>
        <p className={`font-mono text-base font-bold ${actualColor}`}>{event.actual ?? '—'}</p>
      </div>
    </div>
  )
}

export function EventDetailModal({ event, isOpen, onClose }: EventDetailModalProps) {
  const template = useEventTemplate(event?.name ?? null)

  if (!isOpen || !event) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-base-panel rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-base-line">

          {/* HEADER */}
          <div className="relative overflow-hidden sticky top-0 z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-base-panel to-base-panel" />

            <div className="relative px-8 pt-8 pb-4 md:px-10 md:pt-10 md:pb-4">
              <button
                onClick={onClose}
                className="absolute top-6 right-6 text-base-muted hover:text-base-text"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-3">
                {template?.importance && (
                  <Badge variant={IMPORTANCE_VARIANT[template.importance] ?? 'grey'}>
                    {IMPORTANCE_LABEL[template.importance] ?? template.importance.toUpperCase()}
                  </Badge>
                )}
                {event.date && <EventStat label="Fecha" value={event.date} />}
                {event.time && <EventStat label="Hora" value={event.time} />}
              </div>

              <h1 className="text-2xl md:text-3xl font-black uppercase mb-2 text-base-text leading-tight">
                ¿Qué es el <span className="text-brand">{event.name.toUpperCase()}</span>?
              </h1>

              <EventDataRow event={event} />
            </div>
          </div>

          {/* CONTENIDO */}
          <div className="px-8 pt-2 pb-8 md:px-12 md:pt-3 md:pb-12 space-y-8">

            {/* FICHA RÁPIDA */}
            {template?.notes && (
              <Callout color="green" icon={<BarChart3 size={18} />} label="Ficha rápida">
                {template.notes}
              </Callout>
            )}

            {/* DESCRIPCIÓN */}
            {template && (
              <section>
                <SectionHeading>En simple</SectionHeading>

                <p className="text-base-text text-sm leading-relaxed">
                  {template.description}
                </p>
              </section>
            )}

            {/* NARRATIVA */}
            {template && (
              <section>
                <SectionHeading>Por qué importa en los mercados</SectionHeading>

                <div className="space-y-3 text-sm text-base-text leading-relaxed">
                  <p>{template.narrative}</p>
                </div>
              </section>
            )}

            {/* TRES ESCENARIOS */}
            {template && (
              <section>
                <SectionHeading>Tres escenarios posibles</SectionHeading>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* POSITIVO - Verde (pos) */}
                  <div className="scenario-gradient-pos border-2 border-pos/60 rounded-lg p-6 bg-gradient-to-br from-pos-dim/60 to-base-panel">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp size={18} className="text-pos" />
                      <h3 className="text-base font-black text-pos uppercase">
                        Beat / Alcista
                      </h3>
                    </div>

                    <div className="scenario-tint-pos bg-pos-dim/60 rounded-lg p-4 border border-pos/40">
                      <p className="text-sm text-pos">
                        {template.scenarioPositive}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      {(template.affectedAssets ?? []).map((asset) => {
                        const assetsBeat = template.assetsBeat as Record<string, string> | undefined
                        const direction = assetsBeat?.[asset]
                        const { arrow, label, color } = getAssetDisplay(direction)
                        return (
                          <div key={asset} className="flex justify-between">
                            <span className="text-base-muted">{asset}:</span>
                            <span className={`${color} font-bold`}>{arrow} {label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* NEUTRAL - Amarillo (neutral) */}
                  <div className="scenario-gradient-neutral border-2 border-neutral/60 rounded-lg p-6 bg-gradient-to-br from-neutral-dim/60 to-base-panel">
                    <div className="flex items-center gap-2 mb-4">
                      <Minus size={18} className="text-neutral" />
                      <h3 className="text-base font-black text-neutral uppercase">
                        Inline
                      </h3>
                    </div>

                    <div className="scenario-tint-neutral bg-neutral-dim/60 rounded-lg p-4 border border-neutral/40">
                      <p className="text-sm text-neutral">
                        {template.scenarioNeutral}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      {(template.affectedAssets ?? []).map((asset) => {
                        const assetsInline = template.assetsInline as Record<string, string> | undefined
                        const direction = assetsInline?.[asset]
                        const { arrow, label, color } = getAssetDisplay(direction)
                        return (
                          <div key={asset} className="flex justify-between">
                            <span className="text-base-muted">{asset}:</span>
                            <span className={`${color} font-bold`}>{arrow} {label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* NEGATIVO - Rojo (neg) */}
                  <div className="scenario-gradient-neg border-2 border-neg/60 rounded-lg p-6 bg-gradient-to-br from-neg-dim/60 to-base-panel">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown size={18} className="text-neg" />
                      <h3 className="text-base font-black text-neg uppercase">
                        Miss / Bajista
                      </h3>
                    </div>

                    <div className="scenario-tint-neg bg-neg-dim/60 rounded-lg p-4 border border-neg/40">
                      <p className="text-sm text-neg">
                        {template.scenarioNegative}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      {(template.affectedAssets ?? []).map((asset) => {
                        const assetsMiss = template.assetsMiss as Record<string, string> | undefined
                        const direction = assetsMiss?.[asset]
                        const { arrow, label, color } = getAssetDisplay(direction)
                        return (
                          <div key={asset} className="flex justify-between">
                            <span className="text-base-muted">{asset}:</span>
                            <span className={`${color} font-bold`}>{arrow} {label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>
              </section>
            )}

            {/* DEPENDENCIAS — informativo pero discreto, sin caja de color */}
            {template && template.dependencies && (
              <p className="text-xs text-base-muted leading-relaxed border-l-2 border-base-line/50 pl-3">
                <span className="font-bold uppercase tracking-wide text-base-muted/80 mr-1.5">
                  Dependencias:
                </span>
                {template.dependencies}
              </p>
            )}

            {/* REGLAS ESPECIALES */}
            {template && template.specialRules && template.specialRules.length > 0 && (
              <section>
                <SectionHeading>Reglas especiales para Mentor IA</SectionHeading>
                <div className="space-y-3">
                  {template.specialRules.map((rule, idx) => (
                    <div key={idx} className="bg-brand/10 border border-brand/30 rounded-lg p-4">
                      <p className="text-sm text-base-text">{rule}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* FOOTER */}
          <div className="border-t border-base-line/40 px-8 md:px-12 py-6 sticky bottom-0 bg-base-panel/95">
            <Button variant="secondary" onClick={onClose} className="w-full justify-center">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
