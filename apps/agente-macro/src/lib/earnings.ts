// Cliente de earnings — Finnhub (capa gratuita). Nueva pieza, no toca ningún
// motor existente. Los resultados reales ("actual") los introduces tú a mano
// más adelante, tal como se habló; de momento esto solo trae fecha/hora/EPS
// estimado para los tickers configurados.

export const MAGNIFICENT_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']

// Lista secundaria para el calendario de Eventos (Fase 3): semiconductores
// grandes que mueven al NASDAQ. Propuesta inicial, la define el analista
// (docs/eventos-pendientes-santos.md).
export const SECONDARY_TICKERS = ['AVGO', 'AMD', 'MU', 'TSM', 'ASML', 'QCOM']

export interface EarningsItem {
  symbol:       string
  date:         string        // YYYY-MM-DD
  hour:         string        // 'bmo' | 'amc' | 'dmh' | ''
  epsEstimate:  number | null
  // Solo con ?set=extended (calendario de Eventos):
  epsActual?:       number | null
  revenueEstimate?: number | null
  revenueActual?:   number | null
  quarter?:         number | null
  year?:            number | null
}

const HOUR_LABEL: Record<string, string> = {
  bmo: 'Pre-market',
  amc: 'After close',
  dmh: 'En sesión',
}

export function hourLabel(hour: string): string {
  return HOUR_LABEL[hour] ?? ''
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Lunes–viernes de la semana natural actual (usada por la Home / Weekly Briefing). */
export function getThisWeekMonFri(): { from: string; to: string } {
  const now = new Date()
  const dow = now.getDay() // 0=domingo..6=sábado
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return { from: formatDate(monday), to: formatDate(friday) }
}

export async function fetchEarnings(from: string, to: string, extended = false): Promise<EarningsItem[]> {
  try {
    const res = await fetch(`/api/earnings?from=${from}&to=${to}${extended ? '&set=extended' : ''}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.earnings ?? []) as EarningsItem[]
  } catch {
    return []
  }
}
