// Fechas de la semana del análisis: qué lunes toca, OPEX y vencimiento del VIX.

import { thirdFriday } from '@/lib/expirations'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return ymd(d)
}

/** Lunes de la semana a analizar: la actual de lunes a viernes, la siguiente en fin de semana. */
export function targetMonday(now = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dow = d.getUTCDay()
  const shift = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow
  d.setUTCDate(d.getUTCDate() + shift)
  return ymd(d)
}

/** "19–23 de octubre de 2026" (o "28 de septiembre – 2 de octubre de 2026"). */
export function weekLabel(monday: string): string {
  const a = new Date(`${monday}T00:00:00Z`)
  const b = new Date(`${addDays(monday, 4)}T00:00:00Z`)
  const ma = MESES[a.getUTCMonth()]
  const mb = MESES[b.getUTCMonth()]
  return ma === mb
    ? `${a.getUTCDate()}–${b.getUTCDate()} de ${mb} de ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} de ${ma} – ${b.getUTCDate()} de ${mb} de ${b.getUTCFullYear()}`
}

/**
 * OPEX mensual y vencimiento VIX que caen en la semana (o null) y el
 * viernes de la semana (vencimiento semanal). VIX: miércoles 30 días antes
 * del tercer viernes del mes siguiente (sin ajustar festivos).
 */
export function expirations(monday: string): { mensual: string | null; semanal: string; vix: string | null } {
  const friday = addDays(monday, 4)
  const inWeek = (day: string) => day >= monday && day <= friday
  const m = new Date(`${monday}T00:00:00Z`)
  let mensual: string | null = null
  let vix: string | null = null
  for (const offset of [-1, 0, 1]) {
    const y = m.getUTCFullYear()
    const mo = m.getUTCMonth() + offset
    const tf = ymd(thirdFriday(y, mo))
    if (inWeek(tf)) mensual = tf
    const next = thirdFriday(y, mo + 1)
    next.setUTCDate(next.getUTCDate() - 30)
    if (inWeek(ymd(next))) vix = ymd(next)
  }
  return { mensual, semanal: friday, vix }
}
