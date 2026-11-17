// ─────────────────────────────────────────────
//  EDGELOG · MetaTrader 5 Importer
//
//  Formato esperado (export del historial de posiciones de MT5):
//    Time, Position, Symbol, Type, Volume, Price, S/L, T/P,
//    Time, Price, Commission, Swap, Profit
//
//  Particularidad real de MT5: las columnas "Time" y "Price"
//  aparecen DOS VECES en la cabecera (apertura y cierre) con el
//  mismo nombre literal — no se pueden distinguir por nombre, se
//  resuelven por ORDEN de aparición (1ª = apertura, 2ª = cierre).
//
//  Cada fila ya es una posición cerrada (no hay fills que agrupar).
//  Detección: por columnas, vía formatSignatures.js — este archivo
//  NO exporta ningún isXCSV, solo el parser.
//
//  Nota: el layout exacto varía según broker/versión de MT5. Si un
//  export real no encaja con este parser, el asistente de mapeo
//  manual (Sprint de motor de importación) permite asignar las
//  columnas a mano y el sistema lo recuerda para la próxima vez.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function parseMT5(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map(normaliseHeader)

  // "time" y "price" duplicados → se resuelven por índice de aparición
  const timeIdxs  = headers.reduce((acc, h, i) => (h === 'time'  ? [...acc, i] : acc), [])
  const priceIdxs = headers.reduce((acc, h, i) => (h === 'price' ? [...acc, i] : acc), [])
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    position:   idx('position', 'positionid', 'ticket'),
    symbol:     idx('symbol'),
    type:       idx('type'),
    volume:     idx('volume', 'lots'),
    openTime:   timeIdxs[0]  ?? -1,
    closeTime:  timeIdxs[1]  ?? -1,
    openPrice:  priceIdxs[0] ?? -1,
    closePrice: priceIdxs[1] ?? -1,
    commission: idx('commission'),
    swap:       idx('swap'),
    profit:     idx('profit'),
  }
  if (I.position < 0 || I.symbol < 0 || I.type < 0 || I.volume < 0) return []

  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 5) continue

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
    const rawType = cleanCell(cols[I.type]).toLowerCase()
    const side    = rawType.includes('sell') ? 'short' : 'long'

    const volume     = parseFloat(cleanCell(cols[I.volume])) || 1
    const openPrice  = I.openPrice  >= 0 ? parseFloat(cleanCell(cols[I.openPrice]))  || 0 : 0
    const closePrice = I.closePrice >= 0 ? parseFloat(cleanCell(cols[I.closePrice])) || 0 : 0
    const commission = I.commission >= 0 ? parseFloat(cleanCell(cols[I.commission])) || 0 : 0
    const swap        = I.swap       >= 0 ? parseFloat(cleanCell(cols[I.swap]))       || 0 : 0
    const profit        = I.profit     >= 0 ? parseFloat(cleanCell(cols[I.profit]))     || 0 : 0
    const positionId      = cleanCell(cols[I.position])

    const date    = toISODate(openTime)
    const tradeId = `mt5_${positionId || `${symbol}_${side}_${date}_${openPrice}`}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'mt5',
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
