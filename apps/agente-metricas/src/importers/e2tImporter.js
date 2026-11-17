// ─────────────────────────────────────────────
//  EDGELOG · E2T / Excel-export Importer
//
//  Formato: CSV exportado desde Excel con columnas:
//    SYMBOL, QTY, BUY PRICE, BUY TIME, DURATION,
//    SELL TIME, SELL PRICE, P&L
//
//  Cada fila ya es un trade completo (no hay fills).
//  Fechas: MM/DD/YYYY HH:MM:SS
//  Sin BOM, sin decimales europeos.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { normaliseSymbol, toISODate } from './tradeNormalizer.js'

// ── Detección ─────────────────────────────────
export function isE2TCSV(text) {
  const first = text.slice(0, 200).toUpperCase()
  return (
    first.includes('BUY PRICE') &&
    first.includes('SELL PRICE') &&
    first.includes('BUY TIME') &&
    first.includes('SELL TIME') &&
    (first.includes('P&L') || first.includes('P/L'))
  )
}

// ── Parsear fecha MM/DD/YYYY HH:MM:SS → ISO ───
function parseMDY(s) {
  if (!s) return ''
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/)
  if (!m) return s
  return `${m[3]}-${m[1]}-${m[2]}T${m[4]}`
}

function toDateStr(s) {
  const iso = parseMDY(s)
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
}

function toTimeStr(s) {
  const iso = parseMDY(s)
  return iso ? iso.slice(11, 16) : '09:00'
}

// ── Parser principal ───────────────────────────
export function parseE2T(text, options = {}) {
  const lines = text.replace(/\r/g, '').split('\n')
    .map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toUpperCase())
  const idx = (name) => headers.findIndex(h => h === name || h.includes(name))

  const I = {
    symbol:    idx('SYMBOL'),
    qty:       idx('QTY'),
    buyPrice:  idx('BUY PRICE'),
    buyTime:   idx('BUY TIME'),
    sellTime:  idx('SELL TIME'),
    sellPrice: idx('SELL PRICE'),
    pnl:       idx('P&L') >= 0 ? idx('P&L') : idx('P/L'),
  }

  // Fallback por posición fija si fallan los nombres
  if (I.symbol   < 0) I.symbol   = 0
  if (I.qty      < 0) I.qty      = 1
  if (I.buyPrice < 0) I.buyPrice = 2
  if (I.buyTime  < 0) I.buyTime  = 3
  if (I.sellTime < 0) I.sellTime = 5
  if (I.sellPrice< 0) I.sellPrice= 6
  if (I.pnl      < 0) I.pnl      = 7

  const trades = []
  const seen   = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    if (cols.length < 6) continue

    const symbol    = normaliseSymbol(cols[I.symbol])
    const qty       = parseFloat(cols[I.qty])   || 1
    const buyPrice  = parseFloat(cols[I.buyPrice])
    const sellPrice = parseFloat(cols[I.sellPrice])
    const pnl       = parseFloat(cols[I.pnl])

    if (isNaN(buyPrice) || isNaN(sellPrice)) continue

    const buyTime  = cols[I.buyTime]
    const sellTime = cols[I.sellTime]

    // Dirección: si P&L > 0 con buy < sell → long; sino short
    // Más fiable: comparar precios
    const side      = buyPrice <= sellPrice ? 'long' : 'short'
    const entryTime = parseMDY(side === 'long' ? buyTime : sellTime)
    const exitTime  = parseMDY(side === 'long' ? sellTime : buyTime)
    const date      = toDateStr(side === 'long' ? buyTime : sellTime)
    const time      = toTimeStr(side === 'long' ? buyTime : sellTime)

    const tradeId = `e2t_${symbol}_${side}_${date.replace(/-/g,'')}_${time.replace(':','')}_${pnl}`
      .replace(/[^a-zA-Z0-9]/g, '_')

    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'e2t',
      symbol,
      side,
      quantity:   qty,
      entryTime,
      exitTime,
      entryPrice: buyPrice,
      exitPrice:  sellPrice,
      pnl:        isNaN(pnl) ? 0 : pnl,
      setup:      'CSV Import',
    })
  }

  return trades
}
