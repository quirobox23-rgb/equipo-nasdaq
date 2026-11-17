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

/** El instante en que en `tz` son las `hhmm` del día `dia` (YYYY-MM-DD). */
export function instante(dia: string, hhmm: string, tz: string): Date {
  const [a, m, d] = dia.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  const supuesto = Date.UTC(a, m - 1, d, h, min)
  // Diferencia entre lo que marca el reloj en `tz` y UTC en ese momento.
  const p = partes(new Date(supuesto), tz)
  const visto = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto)
  const ajustado = supuesto - (visto - supuesto)
  // Segunda pasada por si el ajuste cruza un cambio de hora.
  const p2 = partes(new Date(ajustado), tz)
  const visto2 = Date.UTC(p2.anio, p2.mes - 1, p2.dia, p2.hora, p2.minuto)
  return new Date(ajustado - (visto2 - supuesto))
}

/** Día anterior a `dia` (YYYY-MM-DD), por calendario. */
export function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
