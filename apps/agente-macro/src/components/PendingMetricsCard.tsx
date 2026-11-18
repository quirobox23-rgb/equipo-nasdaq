'use client'
import { conBase } from '@/lib/base'
import { useEffect, useState } from 'react'
import { Badge, PanelHeader } from '@/components/ui'

// Antes: "ATM diario/semanal" (necesitaría opciones en vivo, no disponible
// gratis). Ahora: rangos históricos REALES de NQ — cuánto se movió el
// último día/semana/mes completos, más la media de esos rangos, para
// poder decir "con este histórico, un movimiento de X pts sería habitual"
// — no es una predicción, es estadística sobre datos reales.
//
// V2 (rediseño Volatilidad, docs/plan-rediseno-eventos.md): el número va
// acompañado de "×la media" y una barra con la media marcada, que es lo que
// dice si el movimiento fue mucho o poco. La curva de tipos va en un bloque
// aparte y sin verde: es macro, no un resultado.

interface RangeStat {
  available: boolean
  lastRangePts: number | null
  lastRangePct: number | null
  avgRangePts: number | null
  periodLabel: string | null
}

interface MarketData {
  yield_curve: { available: boolean; dgs10: number | null; dgs2: number | null; spread: number | null }
  atr_nq: { available: boolean; value: number | null; period: number }
  ranges_nq: { daily: RangeStat; weekly: RangeStat; monthly: RangeStat }
}

const EMPTY: RangeStat = { available: false, lastRangePts: null, lastRangePct: null, avgRangePts: null, periodLabel: null }
const WEEKDAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const MONTH_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// "2026-10-01" → "Jue 1 oct" · "2026-W39" → "21–25 sept" · "2026-09" → "Septiembre"
export function formatPeriod(label: string | null): string | null {
  if (!label) return null
  const week = label.match(/^(\d{4})-W(\d{2})$/)
  if (week) {
    const year = Number(week[1]), w = Number(week[2])
    const jan4 = new Date(Date.UTC(year, 0, 4))
    const monday = new Date(jan4)
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7)
    const friday = new Date(monday)
    friday.setUTCDate(monday.getUTCDate() + 4)
    return monday.getUTCMonth() === friday.getUTCMonth()
      ? `${monday.getUTCDate()}–${friday.getUTCDate()} ${MONTH[friday.getUTCMonth()]}`
      : `${monday.getUTCDate()} ${MONTH[monday.getUTCMonth()]} – ${friday.getUTCDate()} ${MONTH[friday.getUTCMonth()]}`
  }
  if (/^\d{4}-\d{2}$/.test(label)) return MONTH_LONG[Number(label.slice(5, 7)) - 1]
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(`${label}T00:00:00Z`)
    return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`
  }
  return label
}

const fmtPts = (n: number) => Math.round(n).toLocaleString('es-ES')

/** "1.2× la media" — chip del rango contra su media. Borde más marcado desde
 *  1.2×. Se usa acá y en la franja de números de la Home. */
export function RatioChip({ ratio }: { ratio: number }) {
  return (
    <span className={`rounded border bg-base-panel2 px-1.5 py-px font-mono text-[11.5px] font-bold text-base-text ${ratio >= 1.2 ? 'border-base-muted/50' : 'border-base-line'}`}>
      {ratio.toFixed(1)}× la media
    </span>
  )
}

function Unavailable({ loading }: { loading: boolean }) {
  return <p className="mt-2 text-xs italic text-base-faint">{loading ? 'Cargando…' : 'Sin datos disponibles ahora'}</p>
}

function RangeBlock({ label, stat, loading }: { label: string; stat: RangeStat; loading: boolean }) {
  const ok = stat.available && stat.lastRangePts !== null
  const ratio = ok && stat.avgRangePts ? stat.lastRangePts! / stat.avgRangePts : null
  // La barra va de 0 a 2× la media: la media queda siempre en el centro.
  const fill = ratio !== null ? Math.min(100, ratio * 50) : 0
  return (
    <div className="p-4">
      <p className="text-[12.5px] text-base-muted">{label}</p>
      {ok ? (
        <>
          <p className="mt-1.5 font-mono text-[28px] font-bold leading-none tracking-tight text-base-text">
            {fmtPts(stat.lastRangePts!)}<span className="ml-1 font-body text-[13px] font-medium text-base-muted">pts</span>
          </p>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-base-muted">
            {ratio !== null && <RatioChip ratio={ratio} />}
            {stat.lastRangePct !== null && <span>{stat.lastRangePct}%</span>}
          </div>
          {ratio !== null && (
            <div className="relative mt-3" title={`Media ${fmtPts(stat.avgRangePts!)} pts`}>
              <div className="progress-bar">
                <div className="progress-fill bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]" style={{ width: `${fill}%` }} />
              </div>
              <span className="absolute left-1/2 -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-sm bg-base-text" />
            </div>
          )}
          <p className="mt-2 text-[11.5px] text-base-faint">
            {[stat.avgRangePts !== null ? `Media ${fmtPts(stat.avgRangePts)} pts` : null, formatPeriod(stat.periodLabel)].filter(Boolean).join(' · ')}
          </p>
        </>
      ) : <Unavailable loading={loading} />}
    </div>
  )
}

export function PendingMetricsCard() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(conBase('/api/market-data'))
      .then(res => res.ok ? res.json() : null)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const atrValue = data?.atr_nq.available ? data.atr_nq.value : null
  const atrPeriod = data?.atr_nq.period ?? 14
  const curve = data?.yield_curve
  const spread = curve?.available ? curve.spread : null

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_1fr]">
      <section className="card">
        <PanelHeader title="Rango del NQ" aside="Máximo − mínimo · futuro NQ" />
        <div className="grid grid-cols-2 md:grid-cols-4 [&>*]:border-base-line md:[&>*+*]:border-l max-md:[&>*:nth-child(even)]:border-l">
          <RangeBlock label="Diario" stat={data?.ranges_nq.daily ?? EMPTY} loading={loading} />
          <RangeBlock label="Semanal" stat={data?.ranges_nq.weekly ?? EMPTY} loading={loading} />
          <RangeBlock label="Mensual" stat={data?.ranges_nq.monthly ?? EMPTY} loading={loading} />
          <div className="p-4">
            <p className="text-[12.5px] text-base-muted">ATR {atrPeriod} días</p>
            {atrValue !== null ? (
              <>
                <p className="mt-1.5 font-mono text-[28px] font-bold leading-none tracking-tight text-base-text">
                  {fmtPts(atrValue)}<span className="ml-1 font-body text-[13px] font-medium text-base-muted">pts</span>
                </p>
                <p className="mt-2.5 text-xs text-base-muted">Rango diario típico</p>
                <p className="mt-5 text-[11.5px] text-base-faint">Referencia para stops y objetivos</p>
              </>
            ) : <Unavailable loading={loading} />}
          </div>
        </div>
      </section>

      <section className="card flex flex-col">
        <PanelHeader title="Curva de tipos" aside="10Y − 2Y" />
        <div className="flex flex-1 flex-col p-4">
          {spread !== null ? (
            <>
              <p className="font-mono text-[26px] font-bold leading-none tracking-tight text-base-text">
                {spread >= 0 ? '+' : ''}{spread.toFixed(2)}<span className="ml-1 font-body text-[13px] font-medium text-base-muted">pp</span>
              </p>
              <div className="mt-2.5 flex items-center gap-2 text-xs text-base-muted">
                <Badge variant="grey">{spread >= 0 ? 'Positiva' : 'Invertida'}</Badge>
                <span>= {Math.round(spread * 100)} pb</span>
              </div>
              {curve?.dgs10 != null && curve?.dgs2 != null && (
                <p className="mt-auto pt-3.5 text-[11.5px] text-base-faint">
                  10Y <span className="font-mono text-base-text">{curve.dgs10}%</span> · 2Y <span className="font-mono text-base-text">{curve.dgs2}%</span>
                </p>
              )}
            </>
          ) : <Unavailable loading={loading} />}
        </div>
      </section>
    </div>
  )
}
