// ─────────────────────────────────────────────
//  EDGELOG · Backtest Journal Importer
//
//  Formato de export de la herramienta de backtesting que usan los
//  alumnos (columnas magicNumber/openedByEA/ea/confidenceLevel/
//  checklist son características de este export en concreto).
//
//  Particularidad de este formato — por qué NO va por firma de
//  columnas (formatSignatures.js) como los formatos "normales":
//  el archivo trae 2 líneas de preámbulo ANTES de la cabecera real:
//    línea 1: sep=,
//    línea 2: Trade History
//    línea 3: id,symbol,type,... (la cabecera real)
//  El sistema de firmas lee la línea 1 para detectar — aquí la
//  línea 1 es literalmente "sep=,", así que nunca podría coincidir.
//  Mismo caso ya resuelto antes con Interactive Brokers: se detecta
//  por texto completo (whole-text), no por cabecera de línea 1.
//
//  También filtra filas que NO son operaciones:
//    - type = "DEPOSIT"/"WITHDRAWAL" (movimientos de cuenta, no trades)
//    - orderStatus distinto de "Filled" (posiciones sin cerrar)
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol } from './tradeNormalizer.js'

const TRADE_TYPES = new Set(['BUY', 'SELL'])

export function isBacktestJournalCSV(text) {
  return text.includes('magicNumber') && text.includes('openedByEA') && text.includes('confidenceLevel')
}

export function parseBacktestJournal(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 4) return []

  // Línea 1 = "sep=,", línea 2 = "Trade History", línea 3 = cabecera real.
  const headerLineIdx = lines.findIndex(l => normaliseHeader(l).includes('magicnumber'))
  if (headerLineIdx < 0) return []

  const rawHeaders = parseLine(lines[headerLineIdx])
  const headers = rawHeaders.map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    id:         idx('id'),
    symbol:     idx('symbol'),
    type:       idx('type'),
    lots:       idx('lots'),
    openTime:   idx('opentime'),
    openPrice:  idx('openprice'),
    swap:       idx('swap'),
    commission: idx('commision', 'commission'), // el export trae "commision" (con una sola "s")
    profit:     idx('profit'),
    closePrice: idx('closeprice'),
    closeTime:  idx('closetime'),
    orderStatus: idx('orderstatus'),
  }
  if (I.symbol < 0 || I.type < 0 || I.profit < 0 || I.openTime < 0) return []

  const trades = []
  const seen = new Set()

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < headers.length - 2) continue

    const type = cleanCell(cols[I.type]).toUpperCase()
    // Filas de DEPOSIT/WITHDRAWAL (movimientos de cuenta) no son trades.
    if (!TRADE_TYPES.has(type)) continue

    const status = I.orderStatus >= 0 ? cleanCell(cols[I.orderStatus]) : 'Filled'
    const closeTime = I.closeTime >= 0 ? cleanCell(cols[I.closeTime]) : ''
    // Posiciones sin cerrar (no "Filled" o sin hora de cierre) → se
    // cuentan pero no se importan, igual que en el resto de importers.
    if (status !== 'Filled' || !closeTime) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const symbol   = normaliseSymbol(cleanCell(cols[I.symbol]))
    const side     = type === 'SELL' ? 'short' : 'long'
    const quantity = parseFloat(cleanCell(cols[I.lots])) || 1
    const openTime = cleanCell(cols[I.openTime])
    const openPrice  = I.openPrice  >= 0 ? parseFloat(cleanCell(cols[I.openPrice]))  || 0 : 0
    const closePrice = I.closePrice >= 0 ? parseFloat(cleanCell(cols[I.closePrice])) || 0 : 0
    const profit   = parseFloat(cleanCell(cols[I.profit])) || 0
    const swap     = I.swap       >= 0 ? parseFloat(cleanCell(cols[I.swap]))       || 0 : 0
    const commission = I.commission >= 0 ? parseFloat(cleanCell(cols[I.commission])) || 0 : 0
    const rowId    = I.id >= 0 ? cleanCell(cols[I.id]) : `${symbol}_${openTime}`

    const tradeId = `backtest_${options.accountId || 'acc'}_${rowId}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    const fees = (swap || commission)
      ? parseFloat((Math.abs(swap) + Math.abs(commission)).toFixed(2))
      : undefined

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'backtest_journal',
      symbol,
      side,
      quantity,
      entryTime:  openTime,
      exitTime:   closeTime,
      entryPrice: openPrice,
      exitPrice:  closePrice,
      pnl:        profit, // el export ya trae el $ neto por operación
      fees,
      setup:      'CSV Import',
    })
  }

  return trades
}