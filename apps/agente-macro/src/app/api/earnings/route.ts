import { NextRequest, NextResponse } from 'next/server'
import { MAGNIFICENT_TICKERS, SECONDARY_TICKERS } from '@/lib/earnings'

export async function GET(req: NextRequest) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FINNHUB_API_KEY no está configurada en .env.local' },
      { status: 500 },
    )
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  // ?set=extended (calendario de Eventos): suma la lista secundaria y los
  // resultados reales. Sin el parámetro, igual que antes (Home).
  const extended = searchParams.get('set') === 'extended'
  if (!from || !to) {
    return NextResponse.json({ error: 'Se requieren from y to (YYYY-MM-DD)' }, { status: 400 })
  }

  let finnhubRes: Response
  try {
    finnhubRes = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`,
    )
  } catch (err) {
    return NextResponse.json({ error: `Error conectando con Finnhub: ${String(err)}` }, { status: 502 })
  }

  if (!finnhubRes.ok) {
    const text = await finnhubRes.text()
    return NextResponse.json({ error: `Finnhub error ${finnhubRes.status}: ${text}` }, { status: 502 })
  }

  const data = await finnhubRes.json()
  const all: Array<{
    date: string; symbol: string; hour: string; epsEstimate: number | null
    epsActual?: number | null; revenueEstimate?: number | null; revenueActual?: number | null
    quarter?: number | null; year?: number | null
  }> = data.earningsCalendar ?? []

  const tickers = extended ? [...MAGNIFICENT_TICKERS, ...SECONDARY_TICKERS] : MAGNIFICENT_TICKERS
  const earnings = all
    .filter(e => tickers.includes(e.symbol))
    .map(e => extended
      ? {
          symbol: e.symbol, date: e.date, hour: e.hour, epsEstimate: e.epsEstimate ?? null,
          epsActual: e.epsActual ?? null, revenueEstimate: e.revenueEstimate ?? null,
          revenueActual: e.revenueActual ?? null, quarter: e.quarter ?? null, year: e.year ?? null,
        }
      : { symbol: e.symbol, date: e.date, hour: e.hour, epsEstimate: e.epsEstimate ?? null })

  return NextResponse.json({ earnings })
}
