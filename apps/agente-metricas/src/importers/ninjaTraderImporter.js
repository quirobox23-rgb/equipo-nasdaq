// ─────────────────────────────────────────────
//  EDGELOG · NinjaTrader Importer
//
//  Formato esperado (export de la pestaña "Trades" de NinjaTrader):
//    Instrument, Account, Strategy, Market pos., Qty,
//    Entry price, Exit price, Entry time, Exit time,
//    Profit, Commission
//
//  Cada fila ya es un trade cerrado (no hay fills que agrupar).
//  Detección: por columnas, vía formatSignatures.js — este archivo
//  NO exporta ningún isXCSV, solo el parser.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function parseNinjaTrader(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const headers = parseLine(lines[0]).map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    instrument: idx('instrument', 'symbol'),
    marketPos:  idx('marketpos', 'side', 'direction'),
    qty:        idx('qty', 'quantity'),
    entryPrice: idx('entryprice'),
    exitPrice:  idx('exitprice'),
    entryTime:  idx('entrytime'),
    exitTime:   idx('exittime'),
    profit:     idx('profit', 'pnl'),
    commission: idx('commission', 'fees', 'fee'),
    strategy:   idx('strategy'),
  }
  if (I.instrument < 0 || I.entryTime < 0 || I.marketPos < 0) return []

  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 4) continue

    const entryTime = cleanCell(cols[I.entryTime])
    const exitTime  = I.exitTime >= 0 ? cleanCell(cols[I.exitTime]) : ''
    if (!entryTime) continue
    // Sin hora de salida → posición todavía abierta: se ignora, pero
    // se contabiliza para poder informarlo en la vista previa.
    if (!exitTime) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const symbol  = normaliseSymbol(cleanCell(cols[I.instrument]))
    const rawSide = cleanCell(cols[I.marketPos]).toLowerCase()
    const side    = rawSide.includes('short') ? 'short' : 'long'

    const qty        = I.qty        >= 0 ? Math.abs(parseFloat(cleanCell(cols[I.qty])))        || 1 : 1
    const entryPrice = I.entryPrice >= 0 ? parseFloat(cleanCell(cols[I.entryPrice]))            || 0 : 0
    const exitPrice  = I.exitPrice  >= 0 ? parseFloat(cleanCell(cols[I.exitPrice]))             || 0 : 0
    const profit     = I.profit     >= 0 ? parseFloat(cleanCell(cols[I.profit]).replace(/[^0-9.\-]/g, '')) || 0 : 0
    const commission = I.commission >= 0 ? parseFloat(cleanCell(cols[I.commission]))            || 0 : 0
    const strategy   = I.strategy   >= 0 ? cleanCell(cols[I.strategy]) : ''

    const date    = toISODate(entryTime)
    const tradeId = `nt_${symbol}_${side}_${date}_${entryPrice}_${profit}_${i}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'ninjatrader',
      symbol,
      side,
      quantity:   qty,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice,
      pnl:        parseFloat((profit - Math.abs(commission)).toFixed(2)),
      fees:       commission || undefined,
      setup:      strategy || 'CSV Import',
    })
  }

  return trades
}
