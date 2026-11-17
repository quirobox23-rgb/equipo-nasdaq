// Niveles NQ propuestos automáticamente a partir de velas diarias (Yahoo).
// Son un punto de partida: El analista los corrige antes de generar el análisis.

import type { Level } from './types'

export interface DailyBar { date: string; high: number; low: number; close: number }

interface Candidate { price: number; label: string }

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES')

/** Zona de ±25 puntos redondeada a múltiplos de 50, o el rango del grupo si hay varios niveles juntos. */
function zoneOf(prices: number[]): string {
  const lo = Math.floor((Math.min(...prices) - 25) / 50) * 50
  const hi = Math.ceil((Math.max(...prices) + 25) / 50) * 50
  return `${fmt(lo)}–${fmt(hi)}`
}

/** Semanas completas (lunes a viernes) anteriores a `monday`, la más reciente primero. */
export function previousWeeks(bars: DailyBar[], monday: string, count: number): DailyBar[][] {
  const weeks: DailyBar[][] = []
  let end = monday
  for (let i = 0; i < count; i++) {
    const start = new Date(`${end}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - 7)
    const s = start.toISOString().slice(0, 10)
    const week = bars.filter(b => b.date >= s && b.date < end)
    if (week.length > 0) weeks.push(week)
    end = s
  }
  return weeks
}

export function proposeLevels(bars: DailyBar[], monday: string): Level[] {
  if (bars.length === 0) return []
  const price = bars[bars.length - 1].close
  const weeks = previousWeeks(bars, monday, 2)
  const last20 = bars.slice(-20)
  const last60 = bars.slice(-60)

  const cands: Candidate[] = []
  const hi = (bs: DailyBar[]) => Math.max(...bs.map(b => b.high))
  const lo = (bs: DailyBar[]) => Math.min(...bs.map(b => b.low))
  if (weeks[0]) {
    cands.push({ price: hi(weeks[0]), label: 'máximo de la semana pasada' })
    cands.push({ price: lo(weeks[0]), label: 'mínimo de la semana pasada' })
  }
  if (weeks[1]) {
    cands.push({ price: hi(weeks[1]), label: 'máximo de hace dos semanas' })
    cands.push({ price: lo(weeks[1]), label: 'mínimo de hace dos semanas' })
  }
  if (last20.length) {
    cands.push({ price: hi(last20), label: 'máximo del último mes' })
    cands.push({ price: lo(last20), label: 'mínimo del último mes' })
  }
  if (last60.length) {
    cands.push({ price: hi(last60), label: 'máximo de los últimos 3 meses' })
    cands.push({ price: lo(last60), label: 'mínimo de los últimos 3 meses' })
  }
  // Umbrales psicológicos: el múltiplo de 1.000 más cercano por arriba y por abajo.
  cands.push({ price: Math.ceil(price / 1000) * 1000, label: 'umbral psicológico' })
  cands.push({ price: Math.floor(price / 1000) * 1000, label: 'umbral psicológico' })

  // Agrupar niveles a menos de 100 puntos entre sí.
  const sorted = cands.filter(c => Number.isFinite(c.price)).sort((a, b) => b.price - a.price)
  const groups: Candidate[][] = []
  for (const c of sorted) {
    const g = groups[groups.length - 1]
    if (g && g[g.length - 1].price - c.price < 100) g.push(c)
    else groups.push([c])
  }

  const levels = groups.map(g => {
    const mid = g.reduce((s, c) => s + c.price, 0) / g.length
    const role = mid > price ? 'Resistencia' : 'Soporte'
    const labels = Array.from(new Set(g.map(c => c.label)))
    return { mid, level: { zona: zoneOf(g.map(c => c.price)), lectura: `${role}: ${labels.join(', ')}.` } }
  })

  // Los 4 más cercanos por arriba y los 4 más cercanos por abajo, de mayor a menor.
  const above = levels.filter(l => l.mid > price).slice(-4)
  const below = levels.filter(l => l.mid <= price).slice(0, 4)
  return [...above, ...below].map(l => l.level)
}
