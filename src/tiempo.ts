// Utilidades de fecha en una zona horaria concreta, sin librerías.

export interface PartesFecha {
  anio: number; mes: number; dia: number; hora: number; minuto: number
  /** 0 = domingo … 6 = sábado */
  diaSemana: number
}

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function partes(fecha: Date, tz: string): PartesFecha {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  })
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(fecha)) p[x.type] = x.value
  return {
    anio: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    hora: Number(p.hour), minuto: Number(p.minute), diaSemana: DIAS[p.weekday] ?? 0,
  }
}

/** YYYY-MM-DD en la zona indicada. */
export function claveDia(fecha: Date, tz: string): string {
  const p = partes(fecha, tz)
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/** Minutos desde medianoche en la zona indicada. */
export function minutosDelDia(fecha: Date, tz: string): number {
  const p = partes(fecha, tz)
  return p.hora * 60 + p.minuto
}

/** "15:30" en la zona indicada. */
export function hora(fecha: Date, tz: string): string {
  const p = partes(fecha, tz)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

export const APERTURA_ET = 9 * 60 + 30
export const CIERRE_ET = 16 * 60
