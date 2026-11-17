// ─────────────────────────────────────────────
//  EDGELOG · Bulenox Importer
//
//  Formato real Bulenox (via Rithmic):
//    Account, Date/Time, Symbol, Side, Order type,
//    Quantity, Price, Gross P/L, Fee, Net P/L, Connection name
//
//  Características especiales:
//    · BOM UTF-8 (se limpia al inicio)
//    · Decimales europeos: "249,45" → 249.45
//    · CRLF line endings
//    · Fills individuales → agrupar por POSICIÓN ACUMULADA (FIFO),
//      no por ventana de tiempo fija — estas cuentas mantienen
//      posiciones abiertas durante horas, así que una ventana de
//      10 minutos dejaba la entrada y la salida sin emparejar.
//    · Gross P/L = PnL real usado (Net P/L viene siempre a $0 en
//      este export, columna no poblada por la plataforma)
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { normaliseSymbol } from './tradeNormalizer.js'

// ── Detección ─────────────────────────────────
export function isBulenoxCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').slice(0, 300)
  return (
    clean.includes('Date/Time') &&
    clean.includes('Gross P/L') &&
    clean.includes('Net P/L') &&
    (clean.includes('Connection name') || clean.includes('Rithmic') || clean.includes('Order type'))
  )
}

// ── Parsear número europeo ─────────────────────
function euFloat(v) {
  const s = String(v ?? '').replace(/^"|"$/g, '').trim()
  if (!s || s === '0') return 0
  if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  if (s.includes(',')) return parseFloat(s.replace(',', '.'))
  return parseFloat(s) || 0
}

// ── Parsear fecha DD/MM/YYYY HH:MM:SS ─────────
function parseEuDate(s) {
  if (!s) return null
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`)
}

function toISOFromEu(s) {
  const d = parseEuDate(s)
  if (!d) return s || ''
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function toDateStr(s) {
  const d = parseEuDate(s)
  if (!d) return new Date().toISOString().split('T')[0]
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function splitLine(line) {
  const parts = []; let cur = ''; let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { parts.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  parts.push(cur.trim())
  return parts
}

// ── Parser principal ───────────────────────────
//
//  IMPORTANTE: la agrupación NO puede ser por ventana de tiempo fija
//  (versión anterior: símbolo + 10 minutos). Estas cuentas mantienen
//  posiciones abiertas durante horas — con ventana fija, la entrada
//  y la salida quedaban como "trades" sueltos sin emparejar, cada
//  fila individual pasando por un trade completo. El único criterio
//  fiable sin Pair ID/Position ID es seguir la POSICIÓN ACUMULADA
//  real por símbolo y cerrar el trade cuando esa posición vuelve a
//  cero (FIFO simple).
export function parseBulenox(text, options = {}) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r/g, '')
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  // Columnas por NOMBRE, no por posición fija — algunos exports de
  // Bulenox incluyen columnas opcionales extra ("Description",
  // "Symbol type") que desplazan la posición de todo lo demás; con
  // posición fija esos archivos no importaban ningún trade.
  const headerCols = splitLine(lines[0]).map(h => h.trim())
  const idx = (name) => headerCols.findIndex(h => h === name)
  const C = {
    dateTime: idx('Date/Time'),
    symbol:   idx('Symbol'),
    side:     idx('Side'),
    qty:      idx('Quantity'),
    price:    idx('Price'),
    gross:    idx('Gross P/L'),
    fee:      idx('Fee'),
  }

  const fills = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i])
    if (c.length < 5) continue
    const sym  = c[C.symbol]?.trim()
    const side = c[C.side]?.trim()
    const dt   = c[C.dateTime]?.trim()
    if (!sym || !side || !dt) continue
    // Cantidad CON SIGNO — imprescindible para seguir la posición
    // acumulada (Buy suma, Sell resta). La versión anterior usaba
    // Math.abs() y perdía el signo, justo lo que hace falta aquí.
    const qtyRaw    = euFloat(c[C.qty])
    const signedQty = side.toLowerCase() === 'sell' ? -Math.abs(qtyRaw || 1) : Math.abs(qtyRaw || 1)
    const price = euFloat(c[C.price])
    const gross = euFloat(c[C.gross])
    const fee   = euFloat(c[C.fee])
    const dtObj = parseEuDate(dt)
    fills.push({ sym, side, dt, dtObj, qty: signedQty, price, gross, fee })
  }

  if (!fills.length) return []

  // Agrupar por símbolo, orden cronológico
  const bySymbol = new Map()
  for (const f of fills) {
    if (!bySymbol.has(f.sym)) bySymbol.set(f.sym, [])
    bySymbol.get(f.sym).push(f)
  }

  const trades = []
  const seen   = new Set()

  for (const [symRaw, symFills] of bySymbol) {
    symFills.sort((a, b) => (a.dtObj || 0) - (b.dtObj || 0))
    const symbol = normaliseSymbol(symRaw)

    let position = 0
    let openFills = []

    const closeGroup = () => {
      if (!openFills.length) return
      const first = openFills[0]
      const last  = openFills[openFills.length - 1]
      const side  = first.qty < 0 ? 'short' : 'long'

      // Precio medio ponderado: fills con el mismo signo que el
      // primero son "entrada", el resto "salida" — ponderado por qty.
      const entryFills = openFills.filter(f => Math.sign(f.qty) === Math.sign(first.qty))
      const exitFills  = openFills.filter(f => Math.sign(f.qty) !== Math.sign(first.qty))
      const weightedAvg = (list) => {
        const qtySum = list.reduce((s, f) => s + Math.abs(f.qty), 0)
        return qtySum > 0 ? list.reduce((s, f) => s + f.price * Math.abs(f.qty), 0) / qtySum : 0
      }
      const entryPrice = weightedAvg(entryFills)
      const exitPrice  = exitFills.length ? weightedAvg(exitFills) : entryPrice
      const totalQty   = entryFills.reduce((s, f) => s + Math.abs(f.qty), 0) || 1

      // Net P/L viene siempre a $0 en este export de Bulenox (columna
      // no poblada por la plataforma) — el valor real solo aparece en
      // Gross P/L, en la fila que CIERRA la posición. La versión
      // anterior sumaba Net P/L y todos los trades salían en $0.
      const pnl  = parseFloat(openFills.reduce((s, f) => s + f.gross, 0).toFixed(2))
      const fees = parseFloat(openFills.reduce((s, f) => s + f.fee, 0).toFixed(2))

      const entryTime = toISOFromEu(first.dt)
      const exitTime  = toISOFromEu(last.dt)
      const date      = toDateStr(first.dt)

      const tradeId = `bnx_${symbol}_${side}_${date}_${entryTime}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')
      if (!seen.has(tradeId)) {
        seen.add(tradeId)
        trades.push({
          tradeId,
          account:    options.accountId || 'acc-1',
          source:     'bulenox',
          symbol,
          side,
          quantity:   totalQty,
          entryTime,
          exitTime,
          entryPrice: parseFloat(entryPrice.toFixed(5)),
          exitPrice:  parseFloat(exitPrice.toFixed(5)),
          pnl,
          fees,
          setup:      'CSV Import',
          fills:      openFills.length > 1 ? openFills.length : undefined,
        })
      }
      openFills = []
    }

    symFills.forEach(f => {
      position += f.qty
      openFills.push(f)
      if (Math.abs(position) < 0.0001) { closeGroup(); position = 0 }
    })
    // Fills que quedan sin cerrar al final del archivo (posición
    // todavía abierta) no se importan como trade — no hay salida
    // real que reporte P&L, evita un trade con datos parciales.
  }

  return trades
}
