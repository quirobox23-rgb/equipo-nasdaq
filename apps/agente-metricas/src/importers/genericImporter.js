// ─────────────────────────────────────────────
//  EDGELOG · Generic / Fallback Importer
//
//  Maneja:
//    - CSVs exportados desde el propio Agente Métricas
//    - Formatos desconocidos con columnas estándar
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseSymbol, toISODate, parseMoney, detectDelimiter } from './tradeNormalizer.js'

export function parseGeneric(text, options = {}) {
  const lines   = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const delim   = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delim).map(h => cleanCell(h))

  /** @type {import('./tradeNormalizer.js').NormalizedTrade[]} */
  const trades = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delim)
    const obj    = {}
    headers.forEach((h, j) => { obj[h] = values[j] ?? '' })

    const pnl    = parseMoney(obj.dollarPnl || obj.pnl || obj['P/L'] || obj.profit || 0)
    const symbol = normaliseSymbol(obj.pair || obj.symbol || obj.instrument || '')

    if (symbol === 'UNKNOWN' && pnl === 0) continue

    const entryTime = obj.datetime || obj.date || ''
    const exitTime  = obj.exitTime || entryTime
    const rawDir    = (obj.direction || obj.side || 'long').toLowerCase()
    const side      = rawDir.includes('short') ? 'short' : 'long'
    const date      = toISODate(entryTime)
    const qty       = parseFloat(obj.qty || 1)
    const tradeId   = obj.id || `gen_${symbol}_${side}_${date}_${pnl}_${i}`.replace(/[^a-zA-Z0-9]/g, '_')

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'generic',
      symbol,
      side,
      quantity:   qty,
      entryTime,
      exitTime,
      entryPrice: parseMoney(obj.entryPrice || obj.entry || 0),
      exitPrice:  parseMoney(obj.exitPrice  || obj.exit  || 0),
      pnl,
      setup:      obj.setup || 'CSV Import',
    })
  }

  return trades
}
