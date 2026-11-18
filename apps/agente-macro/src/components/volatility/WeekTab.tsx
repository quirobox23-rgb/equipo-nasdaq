'use client'
import { conBase } from '@/lib/base'

import { useEffect, useMemo, useState } from 'react'
import type { MacroEvent } from '@/types/macro'
import type { HistoricalProbability, ThermometerReading } from '@/lib/engines/weeklyMacroEngine'
import { buildDays, keyDayOf, weekAssetImpact } from '@/lib/weekCalendar'
import { formatDate } from '@/lib/earnings'
import { Badge, PanelHeader } from '@/components/ui'
import { KeyDayBadge, dayName } from '@/components/calendar/parts'
import { AssetImpact } from './AssetImpact'

// Pestaña "La semana" de Volatilidad (V3, docs/plan-rediseno-eventos.md).
// Usa el mismo día clave y el mismo rango del NQ que el calendario de
// Eventos (lib/weekCalendar + /api/market-data), así las dos pantallas no se
// contradicen. Reemplaza a WeeklyCycleCard, VolatilityHeatmap,
// MacroThermometer, CorrelationFlow, ExpectedImpactCard y
// HistoricalProbabilityCard en esta pestaña (los componentes quedan en el repo).

interface Props {
  events: MacroEvent[]
  /** Fechas lunes–viernes de la semana (YYYY-MM-DD). */
  dates: string[]
  thermometer: ThermometerReading[]
  historicalProb: HistoricalProbability
  catalyst: string
}

const EXPECTED = ['', 'Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta']

// Fase del ciclo según la posición respecto del día clave (misma idea que
// computeWeeklyCycle, pero anclada al día clave del calendario).
function phaseFor(i: number, keyIdx: number): string {
  if (keyIdx < 0) return '—'
  if (i === keyIdx) return 'Confirmación'
  if (i === keyIdx - 1) return 'Reajuste'
  if (i < keyIdx) return 'Posicionamiento'
  if (i === keyIdx + 1) return 'Continuación'
  return 'Distribución'
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function WeekTab({ events, dates, thermometer, historicalProb, catalyst }: Props) {
  // undefined = cargando (Yahoo tarda unos segundos); null = sin datos.
  const [nq, setNq] = useState<{ avg: number | null; ranges: Record<string, number> } | null | undefined>(undefined)

  useEffect(() => {
    fetch(conBase('/api/market-data'))
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const r = d?.daily_ranges_nq
        if (!r?.available) return setNq(null)
        setNq({ avg: r.avgRangePts, ranges: Object.fromEntries(r.days.map((x: { date: string; rangePts: number }) => [x.date, x.rangePts])) })
      })
      .catch(() => setNq(null))
  }, [])

  const days = useMemo(() => buildDays(events, dates), [events, dates])
  const keyDay = useMemo(() => keyDayOf(days), [days])
  const keyIdx = days.findIndex(d => d.date === keyDay)
  const today = formatDate(new Date())

  const themes = thermometer.filter(t => t.intensity > 0).sort((a, b) => b.intensity - a.intensity)
  const emptyThemes = thermometer.filter(t => t.intensity === 0).map(t => t.label)
  // Impacto desde las fichas (misma lógica que el drawer).
  const withData = days.flatMap(d => d.events).filter(e => e.event.type !== 'earnings' && e.event.forecast != null)
  const withResult = withData.filter(e => e.outcome)
  const assets = useMemo(() => weekAssetImpact(days), [days])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        {/* Ciclo de la semana: fase + volatilidad esperada + rango real del NQ */}
        <section className="card">
          <PanelHeader title="Ciclo de la semana" aside={dates.length ? `${dayName(dates[0])} – ${dayName(dates[dates.length - 1])}` : undefined} />
          <div className="p-4">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="[&>th]:px-2.5 [&>th]:pb-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-base-faint">
                  <th>Día</th><th>Fase</th><th>Volatilidad esperada</th><th>Rango real NQ</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => {
                  const isKey = d.date === keyDay
                  const range = nq?.ranges[d.date]
                  const real =
                    d.date > today ? <span className="font-medium text-base-faint">Pendiente</span>
                    : d.date === today ? <span className="font-medium text-base-faint">En curso</span>
                    : nq === undefined ? <span className="font-medium text-base-faint">Cargando…</span>
                    : range !== undefined ? <>{Math.round(range)} pts{nq?.avg ? <span className="ml-1.5 font-medium text-base-muted">{(range / nq.avg).toFixed(1)}×</span> : null}</>
                    : <span className="font-medium text-base-faint">—</span>
                  return (
                    <tr key={d.date} className={`[&>td]:border-t [&>td]:border-base-line [&>td]:px-2.5 [&>td]:py-2.5 [&>td]:text-[13px] ${
                      isKey ? '[&>td]:bg-[linear-gradient(90deg,rgba(59,130,246,0.08),rgba(59,130,246,0)_70%)]' : ''
                    }`}>
                      <td className={`whitespace-nowrap font-display font-semibold text-base-text ${isKey ? 'shadow-[inset_3px_0_0_#3B82F6]' : ''}`}>
                        {dayName(d.date)}{isKey && <KeyDayBadge className="ml-2 align-[2px]" />}
                      </td>
                      <td className="text-base-muted">{phaseFor(i, keyIdx)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="min-w-[60px] flex-1"><Bar pct={d.stars * 20} /></div>
                          <span className="w-[68px] whitespace-nowrap font-mono text-xs text-base-muted">{EXPECTED[d.stars] || '—'}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap font-mono font-bold text-base-text">{real}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-base-faint">
              <b className="font-medium text-base-muted">Esperada:</b> según los eventos y estrellas del calendario.{' '}
              <b className="font-medium text-base-muted">Real:</b> rango del NQ ese día y comparación con la media diaria
              {nq?.avg ? ` (${Math.round(nq.avg)} pts)` : ''}.
            </p>
          </div>
        </section>

        {/* Temas de la semana (ex Termómetro macro) */}
        <section className="card">
          <PanelHeader title="Temas de la semana" aside="Peso en el calendario" />
          <div className="space-y-3.5 p-4">
            {themes.length > 0 ? themes.map(t => (
              <div key={t.label}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-base-text">{t.label}</span>
                  <span className="font-mono text-base-muted">{t.intensity}%</span>
                </div>
                <Bar pct={t.intensity} />
              </div>
            )) : <p className="text-xs text-base-faint">Sin eventos esta semana.</p>}
            {emptyThemes.length > 0 && themes.length > 0 && (
              <p className="pt-1 text-xs text-base-faint">Sin eventos esta semana: {emptyThemes.join(', ')}.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Impacto esperado en activos (incluye la cadena de Correlaciones) */}
        <section className="card">
          <PanelHeader title="Impacto esperado en activos" aside={`${withResult.length} de ${withData.length} datos publicados`} />
          <div className="p-4">
            <AssetImpact assets={assets} theme={themes[0]?.label ?? catalyst} />
          </div>
        </section>

        {/* Probabilidad histórica — todavía valores de referencia */}
        <section className="card">
          <PanelHeader
            title={`Probabilidad histórica · ${catalyst}`}
            aside={historicalProb.source === 'static' ? <Badge variant="neutral">Datos de referencia</Badge> : undefined}
          />
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Movimiento medio', historicalProb.avgMove],
                ['Movimiento máximo', historicalProb.maxMove],
                ['Tiempo al primer impulso', historicalProb.avgTimeToImpulse],
                ['Continuación / Reversión', `${historicalProb.continuationPct}% / ${historicalProb.reversionPct}%`],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-base-muted">{l}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-base-text">{v}</p>
                </div>
              ))}
            </div>
            {historicalProb.source === 'static' && (
              <p className="mt-3.5 text-xs text-base-faint">Valores de referencia por tipo de catalizador, todavía no calculados con historial real.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
