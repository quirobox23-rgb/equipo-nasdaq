// ─────────────────────────────────────────────
//  EDGELOG · Tradovate Importer
//
//  Tradovate es la plataforma; la usan varias firmas (Apex, Tradeify,
//  MyFundedFutures, Take Profit Trader…) y cuentas propias. Nada de
//  este importador asume una firma concreta.
//
//  Soporta DOS formatos de exportación de Tradovate:
//
//  Formato A (clásico, cabeceras con espacios):
//    Product, Buy Price, Sell Price, P/L, Paired Qty,
//    Bought Timestamp, Sold Timestamp, Pair ID...
//
//  Formato B ("Performance", cabeceras lowercase):
//    symbol, buyPrice, sellPrice, pnl, qty,
//    boughtTimestamp, soldTimestamp, buyFillId, sellFillId...
//    · PnL con formato "$19.00" / "$(168.00)" / "$(1,000.00)"
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import {
  parseLine, cleanCell, normaliseSymbol, toISODate,
  parseMoney, detectDelimiter, detectDayFirst, normalizeDateTime,
} from './tradeNormalizer.js'

// ── Detección ─────────────────────────────────
export function isTradovateCSV(text) {
  const t = text.slice(0, 400)
  return (
    // Formato A clásico
    (t.includes('Bought Timestamp') && t.includes('Sold Timestamp')) ||
    (t.includes('Buy Price')        && t.includes('Sell Price') && t.includes('P/L')) ||
    // Formato B lowercase
    (t.includes('boughtTimestamp')  && t.includes('soldTimestamp')) ||
    (t.includes('buyPrice')         && t.includes('sellPrice') && t.includes('buyFillId'))
  )
}

// ── Parsear PnL con formato Tradovate ─────────
// "$19.00"       →  19.00
// "$(168.00)"    → -168.00
// "$(1,000.00)"  → -1000.00
// "-168"         → -168
// (parseMoney compartido: también "-56,50 $" de un CSV re-guardado con Excel)
const parsePnl = parseMoney

// Fecha/hora → milisegundos para comparar (NaN si no se puede leer)
function tsValue(isoLike) {
  if (!isoLike) return NaN
  return new Date(isoLike.replace(' ', 'T')).getTime()
}

// ── Parser principal ───────────────────────────
export function parseTradovate(text, options = {}) {
  const lines   = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const delim   = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delim).map(h => cleanCell(h))

  const idx    = (name) => headers.findIndex(h => h.trim() === name)
  const idxAny = (...names) => { for (const n of names) { const i = idx(n); if (i >= 0) return i } return -1 }

  // ── Detectar formato A vs B ───────────────
  const isFormatB = headers.some(h => h.trim() === 'buyPrice' || h.trim() === 'boughtTimestamp')

  const I = isFormatB ? {
    // Formato B — lowercase
    product:   idxAny('symbol', 'contract'),
    buyPrice:  idx('buyPrice'),
    sellPrice: idx('sellPrice'),
    pl:        idxAny('pnl', 'pl'),
    pairedQty: idxAny('qty', 'quantity'),
    boughtTs:  idx('boughtTimestamp'),
    soldTs:    idx('soldTimestamp'),
    tradeDate: idxAny('tradeDate', 'date'),
    fees:      idxAny('commission', 'fees', 'fee'),
    pairId:    idxAny('buyFillId'),
    sellFillId: idxAny('sellFillId'),
    posId:     -1,
  } : {
    // Formato A — clásico con espacios
    product:   idx('Product'),
    contract:  idx('Contract'),
    buyPrice:  idx('Buy Price'),
    sellPrice: idx('Sell Price'),
    pl:        idx('P/L'),
    pairedQty: idx('Paired Qty'),
    boughtTs:  idx('Bought Timestamp'),
    soldTs:    idx('Sold Timestamp'),
    tradeDate: idx('Trade Date'),
    fees:      idxAny('Commission', 'Fees', 'Fee'),
    pairId:    idxAny('Pair ID', 'PairID', 'pair id'),
    posId:     idxAny('Position ID', 'PositionID', 'position id', 'Pos ID'),
    buyFill:   idxAny('Buy Fill ID', 'BuyFillID', 'buy fill id'),
    sellFill:  idxAny('Sell Fill ID', 'SellFillID', 'sell fill id'),
  }
  // Resolver "Contract" como fallback de "Product"
  if (!isFormatB && I.product < 0) I.product = idx('Contract')

  // ── 1. Leer filas ─────────────────────────
  const rawRows = lines.slice(1).map(l => parseLine(l, delim)).filter(cols => cols.length >= 5)

  // DD/MM vs MM/DD: se decide una vez para todo el archivo
  const dayFirst = detectDayFirst(rawRows.flatMap(cols => [
    I.boughtTs >= 0 ? cleanCell(cols[I.boughtTs]) : '',
    I.soldTs   >= 0 ? cleanCell(cols[I.soldTs])   : '',
  ]))

  const rows = []
  for (const cols of rawRows) {
    const buyPrice  = parseMoney(cols[I.buyPrice])
    const sellPrice = parseMoney(cols[I.sellPrice])
    if (!buyPrice || !sellPrice) continue

    // PnL: "$19.00" / "$(168.00)" / "1,234.50" / "-56,50" — en ambos formatos
    const pl        = parsePnl(cols[I.pl])

    const qty       = Math.abs(parseMoney(cols[I.pairedQty])) || 1
    const boughtTs  = I.boughtTs  >= 0 ? normalizeDateTime(cols[I.boughtTs], dayFirst) : ''
    const soldTs    = I.soldTs    >= 0 ? normalizeDateTime(cols[I.soldTs],   dayFirst) : ''
    const pairId    = I.pairId    >= 0 ? cleanCell(cols[I.pairId])    : ''
    const posId     = I.posId     >= 0 ? cleanCell(cols[I.posId])     : ''
    const product   = cleanCell(cols[I.product] ?? '')
    const tradeDate = I.tradeDate >= 0 ? normalizeDateTime(cols[I.tradeDate], dayFirst) : ''
    const fees      = I.fees      >= 0 ? Math.abs(parseMoney(cols[I.fees])) : 0

    // Dirección: la decide el ORDEN de las operaciones, no el precio.
    // Si se vendió antes de comprar, es un corto (aunque haya ganado
    // y el precio de compra sea menor). Solo si faltan las horas se
    // deduce del precio + signo del PnL.
    const tBuy  = tsValue(boughtTs)
    const tSell = tsValue(soldTs)
    let isLong
    if (!isNaN(tBuy) && !isNaN(tSell) && tBuy !== tSell) {
      isLong = tBuy < tSell
    } else {
      const priceUp = sellPrice >= buyPrice
      isLong = pl === 0 ? priceUp : (pl > 0) === priceUp
    }
    const entryTs  = isLong ? boughtTs : soldTs
    const exitTs   = isLong ? soldTs   : boughtTs

    // En formato B cada fila se identifica por su fill de ENTRADA
    // (buyFillId en largos, sellFillId en cortos): varias salidas de
    // la misma entrada se agrupan como un trade con varios fills.
    // En formato A: agrupar por Pair ID / Position ID / (symbol+minuto)
    const buyFillCol  = isFormatB ? I.pairId     : I.buyFill
    const sellFillCol = isFormatB ? I.sellFillId : I.sellFill
    const buyFillId   = buyFillCol  >= 0 ? cleanCell(cols[buyFillCol]  ?? '') : ''
    const sellFillId  = sellFillCol >= 0 ? cleanCell(cols[sellFillCol] ?? '') : ''
    const entryFillId = isLong ? buyFillId  : sellFillId
    const exitFillId  = isLong ? sellFillId : buyFillId
    const groupKey = isFormatB
      ? (entryFillId ? `${isLong ? 'B' : 'S'}${entryFillId}` : `${product}|${entryTs}|${rows.length}`)
      : pairId || posId || `${product}|${entryTs.slice(0, 16)}`

    rows.push({
      buyPrice, sellPrice,
      pl,
      qty, fees,
      boughtTs, soldTs, entryTs, exitTs,
      product, tradeDate, isLong, groupKey,
      entryFillId, exitFillId,
    })
  }

  if (!rows.length) return []

  // ── 1b. Promediar: varias entradas cerradas con la misma salida ──
  // Tradovate empareja compra/venta por FIFO, así que una posición
  // promediada (3 entradas que se cierran con 1 venta) llega como 3
  // filas que comparten el fill de SALIDA. Se unen en una sola
  // posición todas las filas conectadas por un fill de entrada o de
  // salida en común (misma dirección y mismo símbolo). Una fila suelta,
  // o varias salidas de una misma entrada, conservan la clave de
  // siempre: así no cambia el id de los trades ya importados.
  const parent = rows.map((_, i) => i)
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  const byFill = new Map()
  rows.forEach((r, i) => {
    const side = `${r.product}|${r.isLong ? 'L' : 'S'}`
    for (const key of [r.entryFillId && `E|${side}|${r.entryFillId}`, r.exitFillId && `X|${side}|${r.exitFillId}`]) {
      if (!key) continue
      if (byFill.has(key)) parent[find(i)] = find(byFill.get(key))
      else byFill.set(key, i)
    }
  })
  const rootKey = new Map()   // raíz → clave del grupo (la de la primera entrada)
  rows.forEach((r, i) => {
    const root = find(i)
    const cur = rootKey.get(root)
    if (!cur || (tsValue(r.entryTs) || 0) < (tsValue(cur.ts) || 0)) rootKey.set(root, { key: r.groupKey, ts: r.entryTs })
  })
  rows.forEach((r, i) => { r.groupKey = rootKey.get(find(i)).key })

  // ── 2. Agrupar fills ─────────────────────
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.groupKey)) groups.set(row.groupKey, [])
    groups.get(row.groupKey).push(row)
  }

  // ── 3. Construir NormalizedTrade ──────────
  const seen   = new Set()
  const trades = []

  for (const [groupKey, fills] of groups) {
    fills.sort((a, b) => (tsValue(a.entryTs) || 0) - (tsValue(b.entryTs) || 0))

    const first    = fills[0]
    const symbol   = normaliseSymbol(first.product)
    const side     = first.isLong ? 'long' : 'short'
    const totalQty = fills.reduce((s, f) => s + f.qty, 0) || 1

    const entryPrice = fills.reduce((s, f) => s + (first.isLong ? f.buyPrice  : f.sellPrice) * f.qty, 0) / totalQty
    const exitPrice  = fills.reduce((s, f) => s + (first.isLong ? f.sellPrice : f.buyPrice)  * f.qty, 0) / totalQty

    const pnl       = parseFloat(fills.reduce((s, f) => s + f.pl,   0).toFixed(2))
    const fees      = parseFloat(fills.reduce((s, f) => s + f.fees, 0).toFixed(2))
    const entryTime = fills[0].entryTs
    const exitTime  = fills.reduce((latest, f) => (tsValue(f.exitTs) > tsValue(latest) ? f.exitTs : latest), fills[0].exitTs)

    const stableKey = `${groupKey}|${symbol}|${side}|${toISODate(first.tradeDate || entryTime)}|${pnl}`
    const tradeId   = `tv_${stableKey.replace(/[^a-zA-Z0-9]/g, '_')}`

    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'tradovate',
      symbol,
      side,
      quantity:   totalQty,
      entryTime,
      exitTime,
      entryPrice: parseFloat(entryPrice.toFixed(5)),
      exitPrice:  parseFloat(exitPrice.toFixed(5)),
      pnl,
      fees:       fees || undefined,
      setup:      'CSV Import',
      fills:      fills.length > 1 ? fills.length : undefined,
    })
  }

  return trades
}
