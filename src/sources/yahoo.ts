// Velas de Yahoo Finance (sin clave, ~15 min de retraso en algunos símbolos).
// NQ=F = futuro del Nasdaq 100, ^VIX = volatilidad del S&P, ^VXN = del Nasdaq.
import { getJson } from './http.ts'

export interface Vela { t: Date; o: number; h: number; l: number; c: number; v: number }

interface YahooChart {
  chart: { result?: Array<{
    timestamp?: number[]
    indicators: { quote: Array<{ open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }> }
  }>; error?: unknown }
}

export function parsearYahoo(json: YahooChart): Vela[] {
  const r = json.chart.result?.[0]
  if (!r?.timestamp) return []
  const q = r.indicators.quote[0]
  const velas: Vela[] = []
  r.timestamp.forEach((ts, i) => {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i]
    if (o == null || h == null || l == null || c == null) return
    velas.push({ t: new Date(ts * 1000), o, h, l, c, v: q.volume[i] ?? 0 })
  })
  return velas
}

export async function cargarVelas(simbolo: string, intervalo = '5m', rango = '5d'): Promise<Vela[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?interval=${intervalo}&range=${rango}&includePrePost=true`
  return parsearYahoo(await getJson<YahooChart>(url))
}
