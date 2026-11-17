// Calendario económico de la semana: el mismo feed de Forex Factory que usa
// Factor Macro (src/lib/forexFactory.ts), pero conservando la hora exacta,
// que la oficina necesita para avisar "no operes ahora".
import { getJson } from './http.ts'

export interface EventoMacro {
  fecha: Date
  titulo: string
  impacto: 'alto' | 'medio' | 'festivo'
  prevision?: string
  anterior?: string
  /** El feed marca "All Day" / "Tentative" con hora 00:00. */
  sinHora: boolean
}

interface FFItem {
  title: string; country: string; date: string; impact: string
  forecast?: string; previous?: string
}

export const FEEDS = {
  estaSemana: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  proximaSemana: 'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
}

export function parsearFF(items: FFItem[]): EventoMacro[] {
  const out: EventoMacro[] = []
  for (const it of items) {
    if (it.country !== 'USD') continue
    const impacto = it.impact === 'High' ? 'alto' : it.impact === 'Medium' ? 'medio' : it.impact === 'Holiday' ? 'festivo' : null
    if (!impacto) continue
    const fecha = new Date(it.date)
    if (Number.isNaN(fecha.getTime())) continue
    out.push({
      fecha, titulo: it.title, impacto,
      prevision: it.forecast || undefined, anterior: it.previous || undefined,
      sinHora: /T00:00:00/.test(it.date),
    })
  }
  return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
}

export async function cargarCalendario(semana: keyof typeof FEEDS = 'estaSemana'): Promise<EventoMacro[]> {
  return parsearFF(await getJson<FFItem[]>(FEEDS[semana]))
}
