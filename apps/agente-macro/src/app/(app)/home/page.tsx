'use client'
import { conBase } from '@/lib/base'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Activity } from 'lucide-react'
import { useWeekEvents } from '@/hooks/useWeekEvents'
import { fetchEarnings, formatDate, type EarningsItem } from '@/lib/earnings'
import { buildDays, earningsToEvents, keyDayOf, weekAssetImpact } from '@/lib/weekCalendar'
import { latestResult, nextUp, regimeOf } from '@/lib/marketReading'
import { findEventTemplate } from '@/hooks/useEventTemplate'
import { dayName } from '@/components/calendar/parts'
import { formatPeriod, RatioChip } from '@/components/PendingMetricsCard'
import { ReadingBlock, MetricsBlock, RegimeValue, ActionCard, EarningsBlock, type HeroMetric } from '@/components/home/HomeBlocks'

// El Mercado Hoy — mismo esquema que el Inicio de Entropia Analytics
// (diseño: mockup-home-v2), en tres franjas:
//   1. Rangos del NQ (ayer y semana en curso), VIX y régimen — el "estado
//      general", como la franja de números del Inicio de Métricas
//   2. Lo último · Lo que viene · Earnings de la semana que viene
//   3. Tarjetas de acción: Calendario económico y Volatilidad
// El detalle vive en cada pantalla. MarketPulseCard / WeeklyBriefingAccordion
// (motor viejo) quedan en el repo sin montar.


interface MarketData {
  vix?: { available: boolean; last: number | null }
  ranges_nq?: { daily: { available: boolean; lastRangePts: number | null; lastRangePct: number | null; avgRangePts: number | null; periodLabel: string | null } }
  current_week_nq?: { available: boolean; rangePts: number | null; rangePct: number | null; avgRangePts: number | null; from: string | null; to: string | null }
}

function greeting(h: number) { return h < 12 ? '¡Buen día!' : h < 20 ? '¡Buenas tardes!' : '¡Buenas noches!' }
const shortDay = (d: string) => dayName(d, true).split(' ')[0].toLowerCase()

function weekDates(now: Date, offset: number): string[] {
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow) + offset * 7)
  return [0, 1, 2, 3, 4].map(i => { const d = new Date(monday); d.setDate(monday.getDate() + i); return formatDate(d) })
}

export default function HomePage() {
  const { events: weekEvents } = useWeekEvents(0)
  const { events: nextWeekEvents } = useWeekEvents(1)
  const [market, setMarket] = useState<MarketData | null>(null)
  const [marketLoading, setMarketLoading] = useState(true)
  const [earnWeek, setEarnWeek] = useState<EarningsItem[]>([])
  const [earnNextWeek, setEarnNextWeek] = useState<EarningsItem[] | null>(null)

  const now = useMemo(() => new Date(), [])
  const today = formatDate(now)
  const dates = useMemo(() => weekDates(now, 0), [now])
  const nextDates = useMemo(() => weekDates(now, 1), [now])

  useEffect(() => {
    fetch(conBase('/api/market-data'))
      .then(r => (r.ok ? r.json() : null)).then(setMarket).catch(() => setMarket(null))
      .finally(() => setMarketLoading(false))
    fetchEarnings(dates[0], dates[4], true).then(setEarnWeek)
    fetchEarnings(nextDates[0], nextDates[4], true).then(setEarnNextWeek)
  }, [dates, nextDates])

  const days = useMemo(
    () => buildDays([...weekEvents, ...earningsToEvents(earnWeek, weekEvents)], dates),
    [weekEvents, earnWeek, dates],
  )
  const nextDays = useMemo(() => buildDays(nextWeekEvents, nextDates), [nextWeekEvents, nextDates])
  const keyDay = useMemo(() => keyDayOf(days), [days])
  const nextKeyDay = useMemo(() => keyDayOf(nextDays), [nextDays])
  const regime = regimeOf(weekAssetImpact(days))

  // ── Franja 1: Lo último · Lo que viene
  const last = latestResult(days)
  const next = nextUp([...days, ...nextDays], today)
  const tomorrow = (() => { const d = new Date(now); d.setDate(now.getDate() + 1); return formatDate(d) })()
  const whenLabel = (date?: string, time?: string) => {
    if (!date) return undefined
    const day = date === today ? 'hoy' : date === tomorrow ? 'mañana' : dayName(date).toLowerCase()
    return [day, time && /^\d/.test(time) ? time : null].filter(Boolean).join(' · ')
  }
  const lastDate = last.kind === 'post' ? last.main.event.date : undefined
  const nextEv = next.kind === 'pre' ? next.main.event : undefined

  // Earnings: los de la semana que viene; durante la semana, también los que
  // quedan de esta.
  const remainingThisWeek = earnWeek.filter(e => e.date >= today && dates.includes(today))
  const earningsRows = [
    ...(remainingThisWeek.length ? [{ label: 'Esta semana', items: remainingThisWeek }] : []),
    { label: 'Próxima semana', items: earnNextWeek ?? [] },
  ].map(r => ({
    label: r.label,
    items: [...r.items].sort((a, b) => a.date.localeCompare(b.date)).map(e => ({
      ticker: e.symbol,
      day: shortDay(e.date),
      hour: e.hour,
      stars: findEventTemplate(`(${e.symbol})`)?.stars ?? 3,
    })),
  }))

  // ── Franja 2: 4 números
  const daily = market?.ranges_nq?.daily
  const week = market?.current_week_nq
  const vix = market?.vix?.available ? market.vix.last : null
  const ratio = (v?: number | null, avg?: number | null) => (v != null && avg ? v / avg : null)
  // Mismo estilo que las cards de rango de Volatilidad: chip "× la media" + %.
  const rangeSub = (r: number | null, pct: number | null | undefined, when: string | null | undefined) => (
    <>
      <span className="flex items-center justify-center gap-2 text-base-muted">
        {r != null && <RatioChip ratio={r} />}
        {pct != null && <span>{pct}%</span>}
      </span>
      {when && <span className="mt-1 block">{when}</span>}
    </>
  )
  const dailyRatio = ratio(daily?.lastRangePts, daily?.avgRangePts)
  const weekRatio = ratio(week?.rangePts, week?.avgRangePts)
  const weekLabel = week?.from && week?.to
    ? `${shortDay(week.from)}–${shortDay(week.to)}${week.to < dates[4] ? ' · en curso' : ''}`
    : null
  const metrics: HeroMetric[] = [
    {
      label: 'Rango NQ ayer',
      value: daily?.available && daily.lastRangePts != null ? Math.round(daily.lastRangePts).toLocaleString('es-ES') : '—',
      unit: daily?.available ? 'pts' : undefined,
      sub: daily?.available ? rangeSub(dailyRatio, daily.lastRangePct, formatPeriod(daily.periodLabel)?.toLowerCase()) : undefined,
    },
    {
      label: 'Rango NQ semana actual',
      value: week?.available && week.rangePts != null ? Math.round(week.rangePts).toLocaleString('es-ES') : '—',
      unit: week?.available ? 'pts' : undefined,
      sub: week?.available ? rangeSub(weekRatio, week.rangePct, weekLabel) : undefined,
    },
    {
      label: 'VIX',
      value: vix != null ? vix.toFixed(1) : '—',
      sub: vix != null ? <span className={vix < 20 ? 'text-pos' : vix < 30 ? 'text-neutral' : 'text-neg'}>
        {vix < 15 ? 'Vol. baja' : vix < 20 ? 'Vol. moderada' : vix < 30 ? 'Vol. elevada' : 'Vol. extrema'}</span> : undefined,
    },
    { label: 'Régimen', value: <RegimeValue regime={regime} />, sub: regime ? 'según la semana' : 'sin datos publicados' },
  ]

  return (
    <div className="max-w-[1240px]">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-base-text">{greeting(now.getHours())}</h1>
      </div>

      {/* 1. Rangos, VIX y régimen */}
      <div>
        <MetricsBlock metrics={metrics} loading={marketLoading} />
      </div>

      {/* 2. Lo último · Lo que viene · Earnings */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_0.75fr]">
        <ReadingBlock
          title="Lo último" when={whenLabel(lastDate, last.kind === 'post' ? last.main.event.time : undefined)}
          reading={last} isKeyDay={!!lastDate && lastDate === keyDay}
          empty="Todavía no salió ningún dato esta semana."
        />
        <ReadingBlock
          title="Lo que viene" when={whenLabel(nextEv?.date, nextEv?.time)}
          reading={next} isKeyDay={!!nextEv?.date && (nextEv.date === keyDay || nextEv.date === nextKeyDay)}
          empty="La semana que viene todavía no está cargada."
        />
        <EarningsBlock rows={earningsRows} loading={earnNextWeek === null} />
      </div>

      {/* 3. Calendario y Volatilidad */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ActionCard
          href="/eventos-economicos" primary icon={CalendarDays}
          title="Calendario económico"
          description="Los datos de la semana, qué esperar y qué significa para el NASDAQ."
          cta="Ir al calendario"
        />
        <ActionCard
          href="/mercado" icon={Activity}
          title="Volatilidad"
          description="Cuánto se mueve el NQ, sentimiento y el ciclo de la semana."
          cta="Ir a volatilidad"
        />
      </div>

      <p className="mt-6 text-xs text-base-faint">Los eventos pueden generar alta volatilidad. Planificá tu operativa y gestioná tu riesgo.</p>
    </div>
  )
}
