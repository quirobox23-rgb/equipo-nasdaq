'use client'

import { Fragment, useState } from 'react'
import { Star } from 'lucide-react'
import type { MacroEvent } from '@/types/macro'
import type { CalendarDay, CalendarEvent } from '@/lib/weekCalendar'
import { RELEVANT_STARS } from '@/lib/weekCalendar'
import { DayStars, KeyDayBadge, NqRange, OutcomeBadge, StarMark, TodayTag, dayName } from './parts'

// Vista Tabla del calendario de Eventos — mismo patrón que la vista Tabla de
// Portafolio en Agente Métricas: cabecera gris, columnas ordenables, filas
// agrupadas por día. Click en una fila → drawer.

interface Props {
  days: CalendarDay[]
  keyDay: string | null
  today: string
  onlyRelevant: boolean
  nqRanges: Record<string, number>
  nqAvg: number | null
  selected: MacroEvent | null
  onSelect: (event: MacroEvent) => void
}

type Sort = 'time' | 'stars'

const Arrow = ({ dir }: { dir?: string }) =>
  dir === 'up' ? <span className="font-bold text-pos">↑</span>
  : dir === 'down' ? <span className="font-bold text-neg">↓</span>
  : <span className="text-base-faint">–</span>

function NqCell({ item }: { item: CalendarEvent }) {
  if (!item.nq) return <span className="text-base-faint">—</span>
  if (item.outcome === 'inline') return <span className="text-base-faint">–</span>
  if (item.outcome) return <span className="text-[15px]"><Arrow dir={item.outcome === 'better' ? item.nq.better : item.nq.worse} /></span>
  // Salió pero no se puede comparar (ej. falta el pronóstico): sin flecha.
  if (item.published) return <span className="text-base-faint">—</span>
  // Antes del dato: los dos escenarios.
  return (
    <span className="text-[11px] text-base-faint" title="Si sale mejor / peor que el pronóstico">
      M <Arrow dir={item.nq.better} /> · P <Arrow dir={item.nq.worse} />
    </span>
  )
}

const COLS: { key: string; label: React.ReactNode; cls?: string; sort?: Sort }[] = [
  { key: 'time', label: 'Hora', sort: 'time' },
  { key: 'name', label: 'Evento' },
  { key: 'stars', label: <Star size={11} strokeWidth={0} fill="currentColor" />, sort: 'stars' },
  { key: 'prev', label: 'Anterior', cls: 'text-right' },
  { key: 'fc', label: 'Pronóstico', cls: 'text-right' },
  { key: 'act', label: 'Actual', cls: 'text-right' },
  { key: 'out', label: 'Resultado' },
  { key: 'nq', label: 'NQ', cls: 'text-center' },
]

export function EventTable({ days, keyDay, today, onlyRelevant, nqRanges, nqAvg, selected, onSelect }: Props) {
  const [sort, setSort] = useState<Sort>('time')
  const isSelected = (e: MacroEvent) =>
    !!selected && selected.name === e.name && selected.date === e.date && selected.time === e.time
  const visible = (d: CalendarDay) => d.events.filter(e => !onlyRelevant || e.stars >= RELEVANT_STARS)
  const dash = <span className="text-base-faint">—</span>

  const row = (item: CalendarEvent, showDay: boolean) => {
    const { event, stars, published, outcome } = item
    return (
      <tr
        key={`${event.date}-${event.time}-${event.name}`}
        onClick={() => onSelect(event)}
        className={`cursor-pointer [&>td]:border-b [&>td]:border-base-line/70 [&>td]:px-3 [&>td]:py-2.5 ${
          isSelected(event) ? '[&>td]:bg-base-panel2' : 'hover:[&>td]:bg-base-panel2/70'
        }`}
      >
        <td className="whitespace-nowrap font-mono text-[13px] text-base-text">{showDay ? `${dayName(event.date!, true)} · ` : ''}{event.time}</td>
        <td className={`text-[13px] ${stars <= 2 ? 'text-base-muted' : 'text-base-text'} ${stars >= 4 ? 'font-bold' : 'font-medium'}`}>{event.name}</td>
        <td><StarMark n={stars} dim={stars < 4} /></td>
        <td className="text-right font-mono text-[13px] text-base-text">{event.prev ?? dash}</td>
        <td className="text-right font-mono text-[13px] text-base-text">{event.forecast ?? dash}</td>
        <td className="text-right font-mono text-[13px] font-bold text-base-text">{published ? event.actual : dash}</td>
        <td>{outcome && <OutcomeBadge outcome={outcome} />}</td>
        <td className="text-center"><NqCell item={item} /></td>
      </tr>
    )
  }

  return (
    <div className="mt-6 overflow-hidden rounded-[10px] border border-base-line bg-base-panel">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {COLS.map(c => (
                <th
                  key={c.key}
                  onClick={c.sort ? () => setSort(c.sort!) : undefined}
                  className={`select-none whitespace-nowrap border-b border-base-line bg-base-panel2 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider ${
                    sort === c.sort ? 'text-base-text' : 'text-base-faint'
                  } ${c.sort ? 'cursor-pointer' : ''} ${c.cls ?? ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}{sort === c.sort && (c.sort === 'stars' ? ' ↓' : ' ↑')}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sort === 'time'
              ? days.map(day => {
                  const items = visible(day)
                  const isKey = day.date === keyDay
                  const range = day.date < today ? nqRanges[day.date] : undefined
                  const hasEarnings = items.some(i => i.category === 'Earnings')
                  return (
                    <Fragment key={day.date}>
                      <tr>
                        <td
                          colSpan={COLS.length}
                          className={`border-b border-base-line bg-base-bg px-3 py-3 ${
                            isKey ? 'shadow-[inset_3px_0_0_#3B82F6] bg-[linear-gradient(90deg,rgba(59,130,246,0.10),rgba(59,130,246,0)_60%)]' : ''
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="font-display text-sm font-semibold text-base-text">{dayName(day.date)}</span>
                            <DayStars n={day.stars} bright={isKey} />
                            {isKey && <KeyDayBadge />}
                            {day.date === today && <TodayTag />}
                            {range !== undefined && <span className="ml-auto"><NqRange pts={range} avg={nqAvg} /></span>}
                          </div>
                        </td>
                      </tr>
                      {items.length > 0
                        ? items.map(i => row(i, false))
                        : <tr><td /><td colSpan={COLS.length - 1} className="border-b border-base-line/70 px-3 py-2.5 text-[13px] text-base-faint">{onlyRelevant ? 'Sin eventos relevantes' : 'Sin eventos'}</td></tr>}
                      {!hasEarnings && (
                        <tr><td /><td colSpan={COLS.length - 1} className="border-b border-base-line/70 px-3 py-2 text-xs text-base-faint">Sin earnings</td></tr>
                      )}
                    </Fragment>
                  )
                })
              : days
                  .flatMap(visible)
                  .sort((a, b) => b.stars - a.stars || `${a.event.date}${a.event.time}`.localeCompare(`${b.event.date}${b.event.time}`))
                  .map(i => row(i, true))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
