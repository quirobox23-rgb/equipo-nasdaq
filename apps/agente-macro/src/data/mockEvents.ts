/**
 * mockEvents.ts — Eventos macro de referencia (semana actual).
 * Las fechas se calculan en el cliente (page.tsx) para evitar
 * el desfase de zona horaria en el servidor.
 */
import type { MacroEvent } from '@/types/macro'

export const MOCK_EVENTS: MacroEvent[] = [
  // LUNES
  {
    id: 1,
    name: 'ISM Manufacturing PMI',
    time: '10:00',
    impact: 'med',
    affects: ['USD', 'NQ'],
    forecast: '49.8',
    prev: '48.7',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  // MARTES
  {
    id: 2,
    name: 'JOLTS Job Openings',
    time: '10:00',
    impact: 'med',
    affects: ['USD', 'NQ'],
    forecast: '7.45M',
    prev: '7.19M',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  // MIÉRCOLES
  {
    id: 3,
    name: 'ADP Employment Change',
    time: '08:15',
    impact: 'med',
    affects: ['USD', 'NQ'],
    forecast: '128K',
    prev: '145K',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  {
    id: 4,
    name: 'ISM Services PMI',
    time: '10:00',
    impact: 'med',
    affects: ['USD', 'NQ'],
    forecast: '53.5',
    prev: '53.8',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  {
    id: 5,
    name: 'FOMC Minutes',
    time: '14:00',
    impact: 'high',
    affects: ['USD', 'NQ', 'GOLD'],
    forecast: null,
    prev: null,
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  // JUEVES
  {
    id: 6,
    name: 'Initial Claims',
    time: '08:30',
    impact: 'med',
    affects: ['USD', 'NQ'],
    forecast: '225K',
    prev: '219K',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  // VIERNES
  {
    id: 7,
    name: 'NFP',
    time: '08:30',
    impact: 'high',
    affects: ['USD', 'NQ', 'GOLD'],
    forecast: '175K',
    prev: '151K',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  {
    id: 8,
    name: 'Unemployment Rate',
    time: '08:30',
    impact: 'high',
    affects: ['USD', 'NQ'],
    forecast: '4.1%',
    prev: '4.2%',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  {
    id: 9,
    name: 'Average Hourly Earnings m/m',
    time: '08:30',
    impact: 'high',
    affects: ['USD', 'NQ', 'GOLD'],
    forecast: '0.3%',
    prev: '0.3%',
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
  {
    id: 10,
    name: 'Fed Speech (Warsh)',
    time: '13:30',
    impact: 'high',
    affects: ['USD', 'NQ', 'GOLD'],
    forecast: null,
    prev: null,
    actual: null,
    direction: 'pending',
    currency: 'USD',
  },
]

// Mapa día → IDs de eventos (0=lun … 4=vie)
const DAY_MAP: Record<number, number[]> = {
  0: [1],
  1: [2],
  2: [3, 4, 5],
  3: [6],
  4: [7, 8, 9, 10],
}

export function getEventsForDay(dayIndex: number): MacroEvent[] {
  const ids = DAY_MAP[dayIndex] ?? []
  return MOCK_EVENTS.filter((e) => ids.includes(Number(e.id)))
}

// Nombres de eventos conocidos por el motor de interpretación
export const KNOWN_EVENT_NAMES = [
  'CPI m/m',
  'Core CPI y/y',
  'NFP',
  'Initial Claims',
  'FOMC Rate Decision',
  'FOMC Statement',
  'FOMC Minutes',
  'Fed Speech (Warsh)',
  'Core PCE Price Index m/m',
  'PCE Price Index m/m',
  'Retail Sales m/m',
  'GDP q/q',
  'PPI m/m',
  'Core PPI m/m',
  'ISM Manufacturing PMI',
  'ISM Services PMI',
  'ADP Employment Change',
  'JOLTS Job Openings',
  'Unemployment Rate',
  'Average Hourly Earnings m/m',
]
