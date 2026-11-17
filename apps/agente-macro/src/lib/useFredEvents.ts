'use client'

import type { StoredEvent } from '@/lib/dataProvider/EventProvider'

const FRED_API_KEY = process.env.NEXT_PUBLIC_FRED_API_KEY || ''

interface FredRelease {
  id: string
  name: string
  press_release: boolean
  realtime_start: string
  realtime_end: string
  units: string
  frequency: string
  seasonal_adjustment: string
}

interface FredCalendarEvent {
  id: string
  name: string
  date: string
  time?: string
  country?: string
  currency?: string
  impact?: 'high' | 'med' | 'low'
  forecast?: number | null
  previous?: number | null
  actual?: number | null
}

/**
 * INTEGRACIÓN REAL DE FRED API
 * 
 * Para funcionar, necesitas:
 * 1. Registrarte en https://fred.stlouisfed.org/
 * 2. Obtener tu API Key
 * 3. Agregar a .env.local: NEXT_PUBLIC_FRED_API_KEY=tu_key
 * 
 * Esto trae eventos REALES de la Federal Reserve.
 */
export async function getFredEventsForWeek(mondayString: string): Promise<StoredEvent[]> {
  if (!FRED_API_KEY) {
    console.warn('FRED_API_KEY no configurada. Usando eventos simulados.')
    return getFredEventsSimulated(mondayString)
  }

  try {
    const monday = new Date(`${mondayString}T00:00:00`)
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)

    const start = monday.toISOString().split('T')[0]
    const end = sunday.toISOString().split('T')[0]

    // Obtener eventos del calendario de FRED
    const response = await fetch(
      `https://api.stlouisfed.org/fred/calendar?api_key=${FRED_API_KEY}&file_type=json&start_date=${start}&end_date=${end}`,
      { next: { revalidate: 3600 } } // Cache 1 hora
    )

    if (!response.ok) {
      console.warn(`FRED API error: ${response.status}`)
      return getFredEventsSimulated(mondayString)
    }

    const data = await response.json()
    const events = data.events || []

    return events.map((e: any, idx: number): StoredEvent => ({
      id: `fred-${e.id}`,
      name: e.name || e.id,
      date: e.date,
      time: e.time_of_day ? convertFredTime(e.time_of_day) : '08:30',
      country: 'USA',
      currency: 'USD',
      impact: getImpactFromFred(e.importance) as 'high' | 'med' | 'low',
      affects: ['USD', 'NQ', 'GOLD', 'VIX'],
      forecast: e.forecast ? parseFloat(e.forecast) : null,
      actual: e.actual ? parseFloat(e.actual) : null,
      prev: e.previous ? parseFloat(e.previous) : null,
      direction: 'pending' as const,
      type: 'macro',
      order: idx,
      notes: `FRED: ${e.id}`,
    }))
  } catch (error) {
    console.error('Error fetching FRED events:', error)
    return getFredEventsSimulated(mondayString)
  }
}

/**
 * Fallback: eventos simulados realistas si FRED API falla
 */
function getFredEventsSimulated(mondayString: string): Promise<StoredEvent[]> {
  const fredEvents = [
    { name: 'Non-Farm Payroll', type: 'high', release_day: 'Friday' },
    { name: 'Unemployment Rate', type: 'high', release_day: 'Friday' },
    { name: 'CPI (Consumer Price Index)', type: 'high', release_day: 'Tuesday' },
    { name: 'PPI (Producer Price Index)', type: 'med', release_day: 'Wednesday' },
    { name: 'Retail Sales', type: 'med', release_day: 'Thursday' },
    { name: 'Jobless Claims', type: 'med', release_day: 'Thursday' },
    { name: 'Consumer Sentiment', type: 'med', release_day: 'Friday' },
    { name: 'GDP Growth', type: 'high', release_day: 'Thursday' },
  ]

  const dayMapping: Record<string, number> = {
    'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4,
  }

  const monday = new Date(`${mondayString}T00:00:00`)
  const events: StoredEvent[] = []
  let order = 0

  fredEvents.forEach((event) => {
    const dayIdx = dayMapping[event.release_day] ?? -1
    if (dayIdx < 0) return

    const eventDate = new Date(monday)
    eventDate.setDate(eventDate.getDate() + dayIdx)
    const dateStr = eventDate.toISOString().split('T')[0]

    events.push({
      id: `fred-sim-${dateStr}-${order}`,
      name: event.name,
      date: dateStr,
      time: ['08:30', '09:15', '10:00', '14:00', '15:00'][dayIdx % 5],
      country: 'USA',
      currency: 'USD',
      impact: (event.type === 'high' ? 'high' : event.type === 'med' ? 'med' : 'low') as 'high' | 'med' | 'low',
      affects: ['USD', 'NQ', 'GOLD', 'VIX'],
      forecast: null,
      actual: null,
      prev: null,
      direction: 'pending' as const,
      type: 'macro',
      order: order++,
      notes: 'Simulado (FRED API no disponible)',
    })
  })

  return Promise.resolve(events)
}

/**
 * Convierte formato de hora de FRED a HH:MM
 */
function convertFredTime(fredTime: string): string {
  const timeMap: Record<string, string> = {
    'morning': '08:30',
    'afternoon': '14:00',
    'evening': '18:00',
  }
  return timeMap[fredTime.toLowerCase()] || '08:30'
}

/**
 * Mapea el nivel de importancia de FRED a nuestro sistema
 */
function getImpactFromFred(importance: number | string): string {
  const imp = typeof importance === 'string' ? parseInt(importance) : importance
  if (imp >= 3) return 'high'
  if (imp >= 2) return 'med'
  return 'low'
}