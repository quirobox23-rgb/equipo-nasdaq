// ─────────────────────────────────────────────
//  EDGELOG · Quantower Importer
//
//  Quantower (la plataforma, no un bróker — la usan prop firms como
//  Alpha Futures vía "Trades" export) exporta un reporte de trades
//  ya emparejados, sin cabecera, separado por ';'. Cada fila YA es
//  un trade completo (round-trip), con precio de entrada y salida.
//  Números en formato US: "$29,143.75", PnL "+$112.00"/"-$9.00".
//  Fechas MM/DD/YYYY hh:mm:ss.ms AM/PM.
//
//  Ej: XCME_Eq MNQ (M26);LONG;2.00;<id>;BUY;SELL;"$29,143.75";
//      "$29,171.75";+$112.00;$2.64;10/06/2026 04:23:38.83 PM;
//      10/06/2026 04:24:05.22 PM
//
//  Nota: el reporte alternativo de Quantower/dxFeed con cabecera
//  "Account,Date/Time,Symbol,Side,...,Gross P/L,Fee,Net P/L,..."
//  (fills sueltos, sin emparejar) es en realidad el mismo formato
//  que ya cubre bulenoxImporter.js — no necesita un importer propio.
// ─────────────────────────────────────────────

import { normaliseSymbol, cleanCell } from './tradeNormalizer.js'

// ═══════════════════════════════════════════════
//  Trades ya emparejados (sin cabecera, ';')
// ═══════════════════════════════════════════════

export function isQuantowerTradesCSV(text) {
  const firstLine = (text || '').split(/\r?\n/).find(l => l.trim()) || ''
  if (!firstLine.includes(';')) return false
  const cols = firstLine.split(';')
  if (cols.length < 10) return false
  return (
    (firstLine.includes('LONG') || firstLine.includes('SHORT')) &&
    firstLine.includes('BUY') && firstLine.includes('SELL') &&
    /\$[\d,]+\.\d{2}/.test(firstLine)
  )
}

// "$29,143.75" → 29143.75 · "+$112.00" → 112 · "-$9.00" → -9
function parseUsdAmount(v) {
  const s = cleanCell(v)
  if (!s) return 0
  const negative = s.includes('-')
  const clean = s.replace(/[$+\-,\s]/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : (negative ? -num : num)
}

// "10/06/2026 04:23:38.83 PM" (MM/DD/YYYY, 12h) → ISO-ish "2026-10-06 16:23:38"
function parseUsTimestamp(str) {
  if (!str) return ''
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(AM|PM)?/i)
  if (!m) return str
  let [, mo, d, y, h, mi, s, ampm] = m
  h = parseInt(h, 10)
  if (ampm) {
    const upper = ampm.toUpperCase()
    if (upper === 'PM' && h !== 12) h += 12
    if (upper === 'AM' && h === 12) h = 0
  }
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')} ${String(h).padStart(2, '0')}:${mi}:${s}`
}

export function parseQuantowerTrades(text, options = {}) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  const trades = []

  lines.forEach((line, i) => {
    const cols = line.split(';').map(c => cleanCell(c))
    if (cols.length < 12) return

    const [symbolRaw, direction, qtyRaw, tradeId, , , entryPriceRaw, exitPriceRaw, pnlRaw, feeRaw, entryTsRaw, exitTsRaw] = cols

    const side = direction.trim().toUpperCase() === 'SHORT' ? 'short' : 'long'
    const qty = parseFloat(qtyRaw) || 1
    const entryPrice = parseUsdAmount(entryPriceRaw)
    const exitPrice = parseUsdAmount(exitPriceRaw)
    const pnl = parseUsdAmount(pnlRaw)
    const fee = parseUsdAmount(feeRaw)
    const entryTime = parseUsTimestamp(entryTsRaw)
    const exitTime = parseUsTimestamp(exitTsRaw)

    trades.push({
      tradeId: `qt_${tradeId || i}`,
      account: options.accountId || 'acc-1',
      source: 'quantower',
      symbol: normaliseSymbol(symbolRaw.replace(/^[A-Z]+_[A-Za-z]+\s*/, '')), // "XCME_Eq MNQ (M26)" → "MNQ (M26)" → normaliseSymbol limpia el resto
      side,
      quantity: qty,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice,
      pnl: parseFloat((pnl - fee).toFixed(2)), // Fee ya restado — el pnl que trae la fila es bruto
      fees: fee || undefined,
      setup: 'CSV Import',
    })
  })

  return trades
}

