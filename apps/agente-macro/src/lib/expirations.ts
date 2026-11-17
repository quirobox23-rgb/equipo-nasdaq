// Vencimientos de opciones y contratos de futuros que afectan al NQ.
// Se calculan con el calendario (sin fuente externa) y se pintan en
// Eventos Económicos junto al calendario macro y los earnings.
//
// - OPEX mensual: tercer viernes del mes (16:00 ET).
// - OPEX semanal: el resto de viernes.
// - Vencimiento trimestral (marzo, junio, septiembre, diciembre): el tercer
//   viernes vencen también los futuros ES/NQ (cuádruple vencimiento).
// - Roll de futuros ES/NQ: el jueves de la semana anterior al vencimiento
//   trimestral (8 días antes), cuando el volumen pasa al contrato siguiente.
// - VIX/VX: miércoles 30 días antes del tercer viernes del mes siguiente.
// No se ajustan festivos.

import type { MacroEvent } from '@/types/macro'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Tercer viernes del mes (month 0-11, puede desbordar al año siguiente). */
export function thirdFriday(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month, 1))
  const firstFriday = 1 + ((5 - d.getUTCDay() + 7) % 7)
  return new Date(Date.UTC(year, month, firstFriday + 14))
}

function vixExpiration(year: number, month: number): Date {
  const d = thirdFriday(year, month + 1)
  d.setUTCDate(d.getUTCDate() - 30)
  return d
}

/** Eventos de vencimiento que caen en las fechas dadas (YYYY-MM-DD). */
export function expirationEvents(dates: string[]): MacroEvent[] {
  if (dates.length === 0) return []
  const set = new Set(dates)
  const first = new Date(`${dates[0]}T00:00:00Z`)
  const events: MacroEvent[] = []
  const monthly = new Set<string>()

  for (const offset of [-1, 0, 1]) {
    const y = first.getUTCFullYear()
    const m = first.getUTCMonth() + offset
    const tf = thirdFriday(y, m)
    const quarterly = tf.getUTCMonth() % 3 === 2
    monthly.add(ymd(tf))

    if (set.has(ymd(tf))) {
      events.push(quarterly
        ? { name: 'Cuádruple vencimiento: opciones y futuros ES/NQ', date: ymd(tf), time: '16:00', type: 'other', impact: 'high', stars: 4, affects: ['NQ', 'VIX'] }
        : { name: 'Vencimiento mensual de opciones (OPEX)', date: ymd(tf), time: '16:00', type: 'other', impact: 'med', stars: 3, affects: ['NQ', 'VIX'] })
    }
    if (quarterly) {
      const roll = new Date(tf)
      roll.setUTCDate(roll.getUTCDate() - 8)
      if (set.has(ymd(roll))) {
        events.push({ name: 'Roll de futuros ES/NQ (cambio al contrato siguiente)', date: ymd(roll), type: 'other', impact: 'med', stars: 3, affects: ['NQ'] })
      }
    }
    const vix = vixExpiration(y, m)
    if (set.has(ymd(vix))) {
      events.push({ name: 'Vencimiento de opciones y futuros del VIX (VX)', date: ymd(vix), time: '09:30', type: 'other', impact: 'med', stars: 3, affects: ['VIX', 'NQ'] })
    }
  }

  for (const day of dates) {
    const d = new Date(`${day}T00:00:00Z`)
    if (d.getUTCDay() === 5 && !monthly.has(day)) {
      events.push({ name: 'Vencimiento semanal de opciones', date: day, time: '16:00', type: 'other', impact: 'low', stars: 1, affects: ['NQ'] })
    }
  }
  return events
}
