// ─────────────────────────────────────────────
//  EDGELOG · TradeLocker Importer
//
//  Formato esperado (export de historial de TradeLocker):
//    Id/Order Id, Open Time, Close Time, Symbol, Side,
//    Volume, Open Price, Close Price, Profit, Swap, Commission
//
//  Cada fila ya es un trade cerrado (no hay fills que agrupar).
//  Detección: por columnas, vía formatSignatures.js — este archivo
//  NO exporta ningún isXCSV, solo el parser.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function parseTradeLocker(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    openTime:   idx('opentime', 'entrytime', 'time'),
    closeTime:  idx('closetime', 'exittime'),
    symbol:     idx('symbol', 'instrument'),
    side:       idx('side', 'direction', 'type'),
    volume:     idx('volume', 'qty', 'quantity', 'lots'),
    openPrice:  idx('openprice', 'entryprice', 'price'),
    closePrice: idx('closeprice', 'exitprice'),
    profit:     idx('profit', 'pnl', 'netprofit'),
    swap:       idx('swap'),
    commission: idx('commission', 'fees', 'fee'),
  }
  if (I.openTime < 0 || I.symbol < 0 || I.side < 0) return []

  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 3) continue

    const openTime  = cleanCell(cols[I.openTime])
    const closeTime = I.closeTime >= 0 ? cleanCell(cols[I.closeTime]) : ''
    if (!openTime) continue
    // Sin hora de cierre → posición todavía abierta: se ignora, pero
    // se contabiliza para poder informarlo en la vista previa.
    if (!closeTime) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const symbol  = normaliseSymbol(cleanCell(cols[I.symbol]))
    const rawSide = cleanCell(cols[I.side]).toLowerCase()
    const side    = rawSide.includes('sell') || rawSide.includes('short') ? 'short' : 'long'

    const volume     = I.volume     >= 0 ? Math.abs(parseFloat(cleanCell(cols[I.volume])))     || 1 : 1
    const openPrice  = I.openPrice  >= 0 ? parseFloat(cleanCell(cols[I.openPrice]))  || 0 : 0
    const closePrice = I.closePrice >= 0 ? parseFloat(cleanCell(cols[I.closePrice])) || 0 : 0
    const profit     = I.profit     >= 0 ? parseFloat(cleanCell(cols[I.profit]).replace(/[^0-9.\-]/g, '')) || 0 : 0
    const swap       = I.swap       >= 0 ? parseFloat(cleanCell(cols[I.swap]))       || 0 : 0
    const commission = I.commission >= 0 ? parseFloat(cleanCell(cols[I.commission])) || 0 : 0

    const date    = toISODate(openTime)
    const tradeId = `tl_${symbol}_${side}_${date}_${openPrice}_${profit}_${i}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'tradelocker',
      symbol,
      side,
      quantity:   volume,
      entryTime:  openTime,
      exitTime:   closeTime,
      entryPrice: openPrice,
      exitPrice:  closePrice,
      pnl:        parseFloat((profit + swap - Math.abs(commission)).toFixed(2)),
      fees:       (commission || swap) ? parseFloat((Math.abs(commission) + Math.abs(swap)).toFixed(2)) : undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
