// Calendario de resultados empresariales de Finnhub (clave gratuita en finnhub.io).
// Para vender el servicio hay que revisar su licencia comercial.
import { config } from '../config.ts'
import { getJson } from './http.ts'

export interface Resultado {
  simbolo: string
  /** YYYY-MM-DD, día de Nueva York. */
  fecha: string
  /** antes: antes de la apertura. despues: después del cierre. */
  momento: 'antes' | 'despues' | 'durante' | 'sin hora'
  bpaEstimado?: number
  bpaReal?: number
  ventasEstimadas?: number
  ventasReales?: number
}

interface FilaFinnhub {
  symbol: string; date: string; hour?: string
  epsEstimate?: number | null; epsActual?: number | null
  revenueEstimate?: number | null; revenueActual?: number | null
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

export function parsearFinnhub(json: { earningsCalendar?: FilaFinnhub[] }): Resultado[] {
  return (json.earningsCalendar ?? []).map(f => ({
    simbolo: f.symbol,
    fecha: f.date,
    momento: f.hour === 'bmo' ? 'antes' : f.hour === 'amc' ? 'despues' : f.hour === 'dmh' ? 'durante' : 'sin hora',
    bpaEstimado: n(f.epsEstimate), bpaReal: n(f.epsActual),
    ventasEstimadas: n(f.revenueEstimate), ventasReales: n(f.revenueActual),
  }))
}

export async function cargarResultados(desde: string, hasta: string): Promise<Resultado[]> {
  if (!config.finnhubKey) throw new Error('Falta FINNHUB_KEY')
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${desde}&to=${hasta}&token=${config.finnhubKey}`
  return parsearFinnhub(await getJson(url))
}
