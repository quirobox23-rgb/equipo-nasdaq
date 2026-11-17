'use client'

import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  DollarSign, CalendarDays, ShoppingCart, Landmark,
  Star, Flame, Users, Laptop, AlertTriangle, TrendingUp,
} from 'lucide-react'
import type { MacroEvent } from '@/types/macro'
import { Callout } from '@/components/ui'

interface VisualCalendarProps {
  events: MacroEvent[]
  onEventClick?: (event: MacroEvent) => void
}

const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']

type EventCategory = 'inflation' | 'employment' | 'growth' | 'fed' | 'earnings' | 'tech' | 'neutral'

const TYPE_ICON: Record<EventCategory, LucideIcon> = {
  inflation: Flame,
  employment: Users,
  growth: TrendingUp,
  fed: Landmark,
  earnings: DollarSign,
  tech: Laptop,
  neutral: CalendarDays,
}

const TYPE_LABEL: Record<EventCategory, string> = {
  inflation: 'INFLACIÓN',
  employment: 'EMPLEO',
  growth: 'CRECIMIENTO',
  fed: 'FED',
  earnings: 'RESULTADOS',
  tech: 'TECNOLOGÍA',
  neutral: 'NEUTRAL',
}

// El campo MacroEvent.type es demasiado genérico en los datos reales (siempre
// "macro") para elegir ícono/label — categorizamos por palabras clave del
// nombre del evento, alineado con los mismos 5 temas de WEEK_THEMES.
function categorizeEvent(name: string): EventCategory {
  const n = name.toUpperCase()
  if (/CPI|PPI|PCE|INFLA/.test(n)) return 'inflation'
  if (/PAYROLL|NFP|EMPLEO|JOBLESS|UNEMPLOYMENT|ADP|JOLTS|HOURLY EARNINGS/.test(n)) return 'employment'
  if (/GDP|RETAIL SALES|ISM|DURABLE GOODS|FACTORY ORDERS|CONSUMER CONFIDENCE|INDUSTRIAL PRODUCTION/.test(n)) return 'growth'
  if (/FOMC|FED|POWELL|WARSH|RATE DECISION|DOT PLOT|JACKSON HOLE/.test(n)) return 'fed'
  if (/EARNINGS|EPS|REVENUE/.test(n)) return 'earnings'
  if (/TECH|AI\b|NASDAQ 100/.test(n)) return 'tech'
  return 'neutral'
}

const WEEK_THEMES = [
  { Icon: Flame, label: 'INFLACIÓN', desc: '(IPC y PPI)' },
  { Icon: Users, label: 'EMPLEO', desc: '(Datos laborales)' },
  { Icon: TrendingUp, label: 'CRECIMIENTO', desc: '(Consumo, ventas)' },
  { Icon: ShoppingCart, label: 'RESULTADOS', desc: '(Earnings)' },
  { Icon: Laptop, label: 'TECNOLOGÍA', desc: '(Tech, IA)' },
]

// PARSEADOR DE FECHAS - SIMPLE, SIN UTC
function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`)
}

export function VisualCalendar({ events, onEventClick }: VisualCalendarProps) {
  const weekDates = useMemo(() => {
    const dates: string[] = []
    if (events.length === 0) return dates

    const firstEvent = events[0].date ? parseLocalDate(events[0].date) : new Date()
    const dayOfWeek = firstEvent.getUTCDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(firstEvent)
    monday.setUTCDate(firstEvent.getUTCDate() + daysToMonday)

    let current = new Date(monday)
    for (let i = 0; i < 5; i++) {
      dates.push(current.toISOString().split('T')[0])
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return dates
  }, [events])

  const weekRange = useMemo(() => {
    if (weekDates.length === 0) return ''
    const from = new Date(weekDates[0]).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase()
    const to = new Date(weekDates[weekDates.length - 1]).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase()
    const year = new Date(weekDates[0]).getUTCFullYear()
    return `SEMANA DEL ${from} AL ${to} DE ${year}`
  }, [weekDates])

  const eventsByDay = useMemo(() => {
    const grouped: Record<number, MacroEvent[]> = {}
    events.forEach(event => {
      const date = event.date ? parseLocalDate(event.date) : new Date()
      const dayOfWeek = date.getUTCDay()
      const indexFromMonday = dayOfWeek === 0 ? 4 : dayOfWeek - 1
      if (indexFromMonday >= 0 && indexFromMonday < 5) {
        if (!grouped[indexFromMonday]) grouped[indexFromMonday] = []
        grouped[indexFromMonday].push(event)
      }
    })
    return grouped
  }, [events])

  return (
    <div className="space-y-4">
      {/* GRID DE 5 DIAS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS_OF_WEEK.map((dayName, dayIdx) => {
          const dayEvents = eventsByDay[dayIdx] || []
          const dateStr = weekDates[dayIdx]
          const dateObj = dateStr ? new Date(dateStr) : new Date()
          const dayOfMonth = dateObj.getUTCDate()

          const macroEvents = dayEvents.filter(e => e.type && e.type !== 'other')
          const mainEvent = macroEvents.length > 0 ? macroEvents.reduce((a, b) => {
            const aImpact = a.impact === 'high' ? 3 : a.impact === 'med' ? 2 : 1
            const bImpact = b.impact === 'high' ? 3 : b.impact === 'med' ? 2 : 1
            return bImpact > aImpact ? b : a
          }) : null

          const isKeyDay = mainEvent?.impact === 'high'

          return (
            <div
              key={dayIdx}
              className={
                isKeyDay
                  ? 'flex flex-col border-2 border-brand rounded-lg overflow-hidden bg-gradient-to-b from-accent/10 to-base-bg transition-colors'
                  : 'flex flex-col border border-base-muted/30 rounded-lg overflow-hidden bg-gradient-to-b from-accent/10 to-base-bg hover:border-brand transition-colors'
              }
            >
              {/* Header del dia */}
              <div className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] px-2 py-2 text-center">
                <p className="text-lg md:text-xl font-black text-base-bg uppercase tracking-tighter">
                  {dayName} {dayOfMonth}
                </p>
              </div>

              {/* Eventos del dia */}
              <div className="flex-1 p-4 min-h-[260px] md:min-h-[320px] flex flex-col">
                {dayEvents.length > 0 && mainEvent ? (
                  <>
                    {/* EVENTO PRINCIPAL - CLICKEABLE */}
                    <div 
                      className="flex-1 flex flex-col items-center justify-start cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onEventClick?.(mainEvent)}
                    >
                      {(() => {
                        const category = categorizeEvent(mainEvent.name)
                        const MainIcon = TYPE_ICON[category]
                        return (
                          <>
                            <div className="flex gap-1 justify-center mb-3">
                              {[...Array(5)].map((_, i) => {
                                const impactLevel = mainEvent.impact === 'high' ? 5 : mainEvent.impact === 'med' ? 3 : 1
                                return (
                                  <Star
                                    key={i}
                                    size={16}
                                    className={i < impactLevel ? 'text-accent' : 'text-base-muted'}
                                    fill={i < impactLevel ? 'currentColor' : 'none'}
                                  />
                                )
                              })}
                            </div>
                            <div className="w-14 h-14 rounded-full border-[3px] border-brand flex items-center justify-center mx-auto mb-3">
                              <MainIcon className="w-6 h-6 text-brand" strokeWidth={2.5} />
                            </div>
                          </>
                        )
                      })()}

                      <div className="text-center w-full px-[10px]">
                        <p className="text-[18px] font-bold text-base-text group-hover:text-accent transition-colors leading-snug">
                          {mainEvent.name}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider mt-1 text-base-muted">
                          ({TYPE_LABEL[categorizeEvent(mainEvent.name)]})
                        </p>
                      </div>
                    </div>

                    {/* "+ X EVENTOS MAS" - DROPDOWN */}
                    {dayEvents.length > 1 && (
                      <div className="mt-4 text-center">
                        <select 
                          className="text-[11px] bg-base-panel border border-base-muted/30 rounded px-2 py-1 text-base-muted cursor-pointer hover:text-brand w-full"
                          onChange={(e) => {
                            if (e.target.value) {
                              const event = dayEvents.find(ev => ev.name === e.target.value)
                              if (event) onEventClick?.(event)
                            }
                            e.target.value = ''
                          }}
                          defaultValue=""
                        >
                          <option value="">+ {dayEvents.length - 1} evento(s) mas</option>
                          {dayEvents.map(ev => (
                            <option key={ev.name} value={ev.name}>
                              {ev.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-base-muted text-center py-12">
                    Sin eventos programados
                  </p>
                )}
              </div>

              {isKeyDay && (
                <div className="flex items-center justify-center gap-1.5 py-2 bg-brand-deep">
                  <Star size={12} className="text-white shrink-0" fill="currentColor" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-white">
                    Dia clave de la semana
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ENFOQUE DE LA SEMANA */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand whitespace-nowrap">
            Enfoque de la semana
          </h3>
          <div className="flex-1 h-px bg-base-line" />
        </div>

        <p className="text-xs text-base-muted mb-4">
          <span className="font-semibold text-base-text">Foco de la semana:</span> Los eventos que pueden definir el próximo ciclo semanal del NASDAQ.
        </p>

        <div className="rounded-lg p-[3px] bg-gradient-to-br from-[#1E40AF] to-[#3B82F6]">
          <div className="flex divide-x divide-base-muted/30 bg-base-bg rounded-[7px] overflow-x-auto">
            {WEEK_THEMES.map(theme => (
              <div key={theme.label} className="flex-1 min-w-[150px] flex items-center gap-3 p-6">
                <theme.Icon className="w-9 h-9 text-brand shrink-0" strokeWidth={2} />
                <div className="min-w-0">
                  <p className="font-bold uppercase text-xs md:text-sm text-base-text">
                    {theme.label}
                  </p>
                  <p className="text-[16px] font-bold text-brand">
                    {theme.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER INFO */}
      <Callout color="amber" icon={<AlertTriangle size={18} />} label="Advertencia">
        <span className="font-bold">Los eventos pueden generar alta volatilidad.</span>{' '}
        <span className="text-base-muted">Planifica tu operativa, gestiona tu riesgo y sigue el contexto macro.</span>
      </Callout>
    </div>
  )
}