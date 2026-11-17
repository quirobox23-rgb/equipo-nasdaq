'use client'

import type { MacroEvent } from '@/types/macro'
import type { CalendarDay, CalendarEvent } from '@/lib/weekCalendar'
import { RELEVANT_STARS } from '@/lib/weekCalendar'
import { DayStars, KeyDayBadge, NqRange, OutcomeBadge, StarMark, TodayTag, dayName } from './parts'

// Vista Semana del calendario de Eventos: 5 columnas (una por día).
// Diseño: mockup-eventos-v2 / docs/plan-rediseno-eventos.md.
//   - Encabezado del día (gris claro, centrado): nombre, estrellas, HOY y el
//     rango real del NQ si el día ya cerró.
//   - Día clave: borde verde 2px + badge "DÍA CLAVE" montado sobre el borde.
//   - Eventos sobre fondo negro, tarjetas en gris. ★4/★5 solo en 4–5; 1–2 en gris.
//   - Earnings al pie de cada día (una línea si no hay).

interface Props {
  days: CalendarDay[]
  keyDay: string | null
  today: string
  onlyRelevant: boolean
  /** Rango del NQ por fecha (solo días cerrados) y su media diaria. */
  nqRanges: Record<string, number>
  nqAvg: number | null
  selected: MacroEvent | null
  onSelect: (event: MacroEvent) => void
}

function EventCard({ item, selected, onSelect }: { item: CalendarEvent; selected: boolean; onSelect: () => void }) {
  const { event, stars, published, outcome } = item
  const low = stars <= 2
  const high = stars >= 4
  const pending = [event.forecast != null ? `pron. ${event.forecast}` : null, event.prev != null ? `ant. ${event.prev}` : null].filter(Boolean)
  return (
    <button
      onClick={onSelect}
      className={`block w-full rounded-lg border bg-base-panel2 px-2.5 py-2 text-left transition-colors ${
        selected ? 'border-base-text' : 'border-base-line hover:border-base-faint'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5 text-[11px] text-base-muted">
        <span>{event.time}</span>
        {high && <StarMark n={stars} />}
      </div>
      <p className={`mt-0.5 text-[12.5px] leading-snug ${low ? 'text-base-muted' : 'text-base-text'} ${high ? 'font-bold' : low ? 'font-normal' : 'font-medium'}`}>
        {event.name}
      </p>
      {published ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className="font-mono font-bold text-base-text">{event.actual}</span>
          {event.forecast != null && <span className="font-mono text-[11px] text-base-faint">pron. {event.forecast}</span>}
          {outcome && <span className="ml-auto"><OutcomeBadge outcome={outcome} /></span>}
        </div>
      ) : pending.length > 0 ? (
        <p className="mt-1.5 font-mono text-[11px] text-base-faint">{pending.join(' · ')}</p>
      ) : null}
    </button>
  )
}

export function WeekCalendar({ days, keyDay, today, onlyRelevant, nqRanges, nqAvg, selected, onSelect }: Props) {
  const isSelected = (e: MacroEvent) =>
    !!selected && selected.name === e.name && selected.date === e.date && selected.time === e.time

  return (
    <div className="mt-6 grid grid-cols-1 gap-2.5 md:grid-cols-5">
      {days.map(day => {
        const isKey = day.date === keyDay
        const isToday = day.date === today
        const visible = day.events.filter(e => !onlyRelevant || e.stars >= RELEVANT_STARS)
        const macro = visible.filter(e => e.category !== 'Earnings')
        const earnings = visible.filter(e => e.category === 'Earnings')
        const range = day.date < today ? nqRanges[day.date] : undefined

        return (
          <section
            key={day.date}
            className={`relative flex min-w-0 flex-col rounded-[10px] bg-base-panel ${
              isKey
                ? '-m-px rounded-[11px] border-2 border-brand shadow-[0_10px_30px_-12px_rgba(59,130,246,0.18)]'
                : 'border border-base-line'
            }`}
          >
            {isKey && <KeyDayBadge className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2" />}
            <div className={`relative border-b border-base-line px-3 pb-3 pt-3.5 text-center ${
              isKey
                ? 'rounded-t-[9px] bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(59,130,246,0.02))] bg-base-panel2'
                : 'rounded-t-[9px] bg-base-panel2'
            }`}>
              {isToday && <TodayTag className="absolute right-2.5 top-2.5" />}
              <h3 className="font-display text-sm font-semibold text-base-text">{dayName(day.date)}</h3>
              <div className="mt-1.5 flex justify-center"><DayStars n={day.stars} bright={isKey} /></div>
              {range !== undefined && <div className="mt-1.5"><NqRange pts={range} avg={nqAvg} /></div>}
            </div>

            <div className="flex flex-1 flex-col gap-1.5 bg-base-bg p-2">
              {macro.length > 0
                ? macro.map(item => (
                    <EventCard key={`${item.event.time}-${item.event.name}`} item={item} selected={isSelected(item.event)} onSelect={() => onSelect(item.event)} />
                  ))
                : <p className="py-2.5 text-center text-xs text-base-faint">{onlyRelevant ? 'Sin eventos relevantes' : 'Sin eventos'}</p>}
            </div>

            {earnings.length > 0 ? (
              <div className="rounded-b-[9px] border-t border-dashed border-base-line p-2">
                <p className="mb-1.5 ml-0.5 text-[10.5px] uppercase tracking-widest text-base-faint">Earnings</p>
                <div className="flex flex-col gap-1.5">
                  {earnings.map(item => (
                    <EventCard key={`${item.event.time}-${item.event.name}`} item={item} selected={isSelected(item.event)} onSelect={() => onSelect(item.event)} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-b-[9px] border-t border-dashed border-base-line px-2.5 py-2 text-[11px] uppercase tracking-wider text-base-faint">Earnings · —</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
