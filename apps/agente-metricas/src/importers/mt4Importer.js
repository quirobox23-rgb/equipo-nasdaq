// ─────────────────────────────────────────────
//  EDGELOG · MetaTrader 4 Importer
//
//  Formato esperado (export del historial de MT4, pestaña "Account
//  History" → "Save as Report" o "Save as Detailed Report"):
//    Ticket, Open Time, Type, Size, Item, Price, S/L, T/P,
//    Close Time, Price, Commission, Taxes, Swap, Profit
//
//  Distinto de MT5: usa "Ticket"/"Item" en vez de "Position"/
//  "Symbol", y añade una columna "Taxes" que MT5 no tiene. Al igual
//  que en MT5, "Time" y "Price" aparecen DOS VECES (apertura/cierre)
//  con el mismo nombre literal — se resuelven por orden de aparición.
//
//  Cada fila ya es una posición cerrada (no hay fills que agrupar).
//  Detección: por columnas, vía formatSignatures.js — este archivo
//  NO exporta ningún isXCSV, solo el parser.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function parseMT4(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map(normaliseHeader)

  // "price" aparece DUPLICADO en el export real de MT4 (apertura/cierre)
  // → se resuelve por índice de aparición. "Open Time"/"Close Time" SÍ
  // son nombres de columna distintos en MT4 (a diferencia de MT5, que
  // repite literalmente "Time" dos veces).
  const priceIdxs = headers.reduce((acc, h, i) => (h === 'price' ? [...acc, i] : acc), [])
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    ticket:     idx('ticket'),
    symbol:     idx('item', 'symbol'),
    type:       idx('type'),
    size:       idx('size', 'volume', 'lots'),
    openTime:   idx('opentime'),
    closeTime:  idx('closetime'),
    openPrice:  priceIdxs[0] ?? -1,
    closePrice: priceIdxs[1] ?? -1,
    commission: idx('commission'),
    taxes:      idx('taxes'),
    swap:       idx('swap'),
    profit:     idx('profit'),
  }
  if (I.ticket < 0 || I.symbol < 0 || I.type < 0 || I.size < 0) return []

  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 5) continue

    const typeRaw = cleanCell(cols[I.type]).toLowerCase()
    // MT4 mezcla en la misma tabla depósitos/retiros/balance junto a
    // las operaciones — solo nos interesan buy/sell.
    if (!typeRaw.includes('buy') && !typeRaw.includes('sell')) continue

    const openTime  = I.openTime  >= 0 ? cleanCell(cols[I.openTime])  : ''
    const closeTime = I.closeTime >= 0 ? cleanCell(cols[I.closeTime]) : ''
    if (!openTime) continue
    // Sin segunda columna "Time" → posición todavía abierta: se
    // ignora, pero se contabiliza para informarlo en la vista previa.
    if (!closeTime) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const symbol  = normaliseSymbol(cleanCell(cols[I.symbol]))
    const side    = typeRaw.includes('sell') ? 'short' : 'long'

    const volume     = parseFloat(cleanCell(cols[I.size])) || 1
    const openPrice  = I.openPrice  >= 0 ? parseFloat(cleanCell(cols[I.openPrice]))  || 0 : 0
    const closePrice = I.closePrice >= 0 ? parseFloat(cleanCell(cols[I.closePrice])) || 0 : 0
    const commission = I.commission >= 0 ? parseFloat(cleanCell(cols[I.commission])) || 0 : 0
    const taxes       = I.taxes       >= 0 ? parseFloat(cleanCell(cols[I.taxes]))       || 0 : 0
    const swap          = I.swap       >= 0 ? parseFloat(cleanCell(cols[I.swap]))       || 0 : 0
    const profit          = I.profit     >= 0 ? parseFloat(cleanCell(cols[I.profit]))     || 0 : 0
    const ticket             = cleanCell(cols[I.ticket])

    const date    = toISODate(openTime)
    const tradeId = `mt4_${ticket || `${symbol}_${side}_${date}_${openPrice}`}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    const fees = commission || taxes || swap
      ? parseFloat((Math.abs(commission) + Math.abs(taxes) + Math.abs(swap)).toFixed(2))
      : undefined

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'mt4',
      symbol,
      side,
      quantity:   volume,
      entryTime:  openTime,
      exitTime:   closeTime,
      entryPrice: openPrice,
      exitPrice:  closePrice,
      pnl:        parseFloat((profit + swap - Math.abs(commission) - Math.abs(taxes)).toFixed(2)),
      fees,
      setup:      'CSV Import',
    })
  }

  return trades
}
