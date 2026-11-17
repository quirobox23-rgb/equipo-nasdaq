'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { expirationEvents } from '@/lib/expirations'
import { EventDrawer } from '@/components/EventDrawer'
import { WeekCalendar } from '@/components/calendar/WeekCalendar'
import { EventTable } from '@/components/calendar/EventTable'
import type { MacroEvent } from '@/types/macro'
import { useWeekEvents } from '@/hooks/useWeekEvents'
import { fetchEarnings, formatDate, type EarningsItem } from '@/lib/earnings'
import { buildDays, earningsLabel, earningsToEvents, keyDayOf, weekThemes } from '@/lib/weekCalendar'
import { dayName } from '@/components/calendar/parts'
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'

// Calendario Macro & Earnings — vista Semana / Tabla + drawer de detalle.
// Rediseño (docs/plan-rediseno-eventos.md, Fase 2). VisualCalendar queda en
// el repo sin uso.

type View = 'week' | 'table'

const WEEK_BTN =
  'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-base-line bg-base-panel text-base-muted ' +
  'transition-colors hover:border-base-faint hover:text-base-text'
const SUMMARY_KEY = 'mr-0.5 text-[11px] font-semibold uppercase tracking-wider text-base-faint'
const CHIP = 'inline-flex items-center gap-1.5 rounded border border-base-line bg-base-panel2 px-2 py-0.5 text-xs text-base-text'

/** Nombre corto de la semana que se está viendo, sobre las fechas. */
function weekName(offset: number): string {
  if (offset === 0) return 'Esta semana'
  if (offset === 1) return 'Próxima semana'
  if (offset === -1) return 'Semana pasada'
  return offset > 0 ? `En ${offset} semanas` : `Hace ${-offset} semanas`
}

interface NqDailyRanges {
  available: boolean
  avgRangePts: number | null
  days: { date: string; rangePts: number }[]
}

// Sábado y domingo se abre ya la semana siguiente (la que viene), no la que
// acaba de terminar. "Hoy" vuelve a esa misma semana por defecto.
function defaultWeekOffset(): number {
  const day = new Date().getDay()
  return day === 6 || day === 0 ? 1 : 0
}

export default function EventosEconomicosPage() {
  const [homeOffset] = useState(defaultWeekOffset)
  const [weekOffset, setWeekOffset] = useState(homeOffset)
  const { events: weekEvents } = useWeekEvents(weekOffset)
  const [selectedEvent, setSelectedEvent] = useState<MacroEvent | null>(null)
  const closeDrawer = useCallback(() => setSelectedEvent(null), [])
  const [view, setView] = useState<View>('week')
  const [onlyRelevant, setOnlyRelevant] = useState(false)
  const [nq, setNq] = useState<NqDailyRanges | null>(null)
  const [earningsItems, setEarningsItems] = useState<EarningsItem[]>([])

  // Rango real del NQ por día (velas diarias de /api/market-data).
  useEffect(() => {
    fetch('/api/market-data')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setNq(d?.daily_ranges_nq ?? null))
      .catch(() => setNq(null))
  }, [])

  const weekDates = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + daysToMonday + weekOffset * 7)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 4)

    // "2 – 6 nov 2026"; si cruza de mes, "30 oct – 3 nov 2026".
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    const start = sameMonth
      ? String(weekStart.getDate())
      : weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const end = weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

    const dates = [0, 1, 2, 3, 4].map(i => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return formatDate(d)
    })

    return { label: `${start} – ${end}`.replace(/\./g, ''), dates }
  }, [weekOffset])

  // Earnings de la semana (7 magníficas + semis, Finnhub).
  useEffect(() => {
    const dates = weekDates.dates
    setEarningsItems([])
    fetchEarnings(dates[0], dates[dates.length - 1], true).then(setEarningsItems)
  }, [weekDates.dates])

  const today = formatDate(new Date())
  const allEvents = useMemo(
    () => [...weekEvents, ...earningsToEvents(earningsItems, weekEvents), ...expirationEvents(weekDates.dates)],
    [weekEvents, earningsItems, weekDates.dates],
  )
  const days = useMemo(() => buildDays(allEvents, weekDates.dates), [allEvents, weekDates.dates])
  const keyDay = useMemo(() => keyDayOf(days), [days])
  const themes = useMemo(() => weekThemes(days), [days])
  const earnings = days.flatMap(d => d.events.filter(e => e.category === 'Earnings'))
  const nqRanges = useMemo(
    () => Object.fromEntries((nq?.available ? nq.days : []).map(d => [d.date, d.rangePts])),
    [nq],
  )

  const viewProps = {
    days, keyDay, today, onlyRelevant, nqRanges,
    nqAvg: nq?.avgRangePts ?? null,
    selected: selectedEvent,
    onSelect: (e: MacroEvent) => setSelectedEvent(e),
  }

  return (
    <div>
      {/* Encabezado */}
      <p className="section-label mb-1">Eventos Económicos</p>
      <h1 className="text-xl font-display font-semibold text-base-text">Calendario Macro & Earnings</h1>

      {/* Controles: cómo se ve a la izquierda, qué semana a la derecha. En el
          celular la semana va arriba a todo el ancho. */}
      <div className="mt-5 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-2.5 md:justify-start">
          <span className="tabs">
            <button onClick={() => setView('week')} className={`tab ${view === 'week' ? 'tab-active' : ''}`}>Semana</button>
            <button onClick={() => setView('table')} className={`tab ${view === 'table' ? 'tab-active' : ''}`}>Tabla</button>
          </span>
          <span className="tabs">
            <button onClick={() => setOnlyRelevant(false)} className={`tab ${!onlyRelevant ? 'tab-active' : ''}`}>Todos</button>
            <button onClick={() => setOnlyRelevant(true)} className={`tab ${onlyRelevant ? 'tab-active' : ''}`} title="Eventos de 3 estrellas o más">
              Relevantes <span className="hidden font-mono text-[11px] text-base-faint md:inline">★3+</span>
            </button>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className={WEEK_BTN} title="Semana anterior" aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center md:min-w-[150px] md:flex-none">
            <span className="block text-[10.5px] font-medium uppercase tracking-wider text-base-faint">{weekName(weekOffset)}</span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-base-text">{weekDates.label}</span>
          </div>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className={WEEK_BTN} title="Semana siguiente" aria-label="Semana siguiente">
            <ChevronRight size={16} />
          </button>
          {weekOffset !== homeOffset && (
            <button
              onClick={() => setWeekOffset(homeOffset)}
              className="ml-1 h-[34px] rounded-lg border border-base-line px-3 text-xs font-semibold text-brand hover:border-base-faint"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Resumen de la semana que se está viendo (sirve sobre todo en la vista Tabla) */}
      <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-base-line bg-base-panel px-5 py-4 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={SUMMARY_KEY}>Temas</span>
          {themes.length
            ? themes.map(t => <span key={t} className={CHIP}>{t}</span>)
            : <span className="text-xs text-base-faint">—</span>}
        </div>
        <span className="hidden h-[18px] w-px bg-base-line md:block" />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={SUMMARY_KEY}>Earnings</span>
          {earnings.length
            ? earnings.map(e => {
                const weekday = dayName(e.event.date!, true).split(' ')[0].toLowerCase()
                // Luna = después del cierre, sol = antes de la apertura.
                const SessionIcon = e.event.time === 'Post-cierre' ? Moon : e.event.time === 'Pre-market' ? Sun : null
                return (
                  <span key={`${e.event.date}-${e.event.name}`} className={CHIP} title={earningsLabel(e, weekday)}>
                    {SessionIcon && <SessionIcon size={12} className="text-base-muted" aria-hidden />}
                    {e.template?.ticker ?? e.event.name}
                    <span className="font-mono text-[10.5px] text-base-faint">{weekday}</span>
                  </span>
                )
              })
            : <span className="text-xs text-base-faint">Sin earnings relevantes</span>}
        </div>
      </div>

      {allEvents.length > 0 ? (
        // data-event-drawer-keep: clickear otro evento con el drawer abierto
        // lo cambia de evento en vez de cerrarlo.
        <div data-event-drawer-keep>
          {view === 'week' ? <WeekCalendar {...viewProps} /> : <EventTable {...viewProps} />}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-base-muted text-sm">No hay eventos para esta semana</p>
        </div>
      )}

      <p className="mt-4 text-xs text-base-faint">Los eventos pueden generar alta volatilidad. Planificá tu operativa y gestioná tu riesgo.</p>

      {/* Detalle del evento — panel lateral (EventDetailModal queda en el repo sin uso) */}
      <EventDrawer event={selectedEvent} onClose={closeDrawer} />
    </div>
  )
}
