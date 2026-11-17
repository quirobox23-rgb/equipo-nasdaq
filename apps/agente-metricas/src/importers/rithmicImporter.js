// ─────────────────────────────────────────────
//  EDGELOG · Rithmic Importer (PHI / TopStep)
//
//  Lee la sección "Completed Orders" del CSV de Rithmic
//  y empareja órdenes B/S en trades completos.
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

// ── Detección de cabeceras ────────────────────
export function isRithmicCSV(text) {
  return text.includes('Completed Orders') || (text.includes('Buy/Sell') && text.includes('Avg Fill Price'))
}

// ── Parser principal ──────────────────────────
export function parseRithmic(text, options = {}) {
  const allLines = text.split(/\r?\n/)

  // Buscar sección "Completed Orders"
  const completedStart = allLines.findIndex(l => /completed orders/i.test(l))
  if (completedStart < 0) return []

  const sectionLines = []
  for (let i = completedStart + 1; i < allLines.length; i++) {
    const line = allLines[i]
    const t    = line.trim()
    if (!t) continue
    if (!line.includes(',') && /orders/i.test(t) && !/buy\/sell|status|symbol/i.test(t)) break
    sectionLines.push(line)
  }
  if (sectionLines.length < 2) return []

  // Localizar la cabecera real dentro de la sección
  const headerIdx = sectionLines.findIndex(line => {
    const h = parseLine(line).map(normaliseHeader)
    return h.includes('status') && h.includes('buysell') && h.includes('symbol')
  })
  if (headerIdx < 0) return []

  const lines   = sectionLines.slice(headerIdx)
  const headers = parseLine(lines[0]).map(normaliseHeader)
  const idxAny  = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    status:     idxAny('status'),
    buySell:    idxAny('buysell', 'side'),
    symbol:     idxAny('symbol', 'product', 'contract'),
    avgPrice:   idxAny('avgfillprice', 'fillprice', 'price'),
    createTime: idxAny('createtimerdt', 'createtime', 'updatetimerdt', 'updatetime', 'orderupdatetime'),
    qty:        idxAny('qtyfilled', 'qtytofill', 'qtyworking', 'quantity', 'qty'),
    pl:         idxAny('closedprofitloss', 'profitloss', 'pnl', 'pl'),
    fees:       idxAny('commission', 'fees', 'fee'),
  }

  if (I.status < 0 || I.buySell < 0 || I.symbol < 0 || I.avgPrice < 0) return []

  // Leer órdenes filled
  const orders = []
  for (let i = 1; i < lines.length; i++) {
    const cols   = parseLine(lines[i])
    if (cols.length < 5) continue
    const status = cleanCell(cols[I.status]).toLowerCase()
    if (status !== 'filled') continue
    const price  = parseFloat(cleanCell(cols[I.avgPrice]))
    if (isNaN(price)) continue

    const buySellRaw = cleanCell(cols[I.buySell]).toUpperCase()
    const buySell    = buySellRaw === 'BUY' ? 'B' : buySellRaw === 'SELL' ? 'S' : buySellRaw
    if (buySell !== 'B' && buySell !== 'S') continue

    const qty        = I.qty   >= 0 ? parseFloat(cleanCell(cols[I.qty]))   || 1 : 1
    const pl         = I.pl    >= 0 ? parseFloat(cleanCell(cols[I.pl]))    || 0 : 0
    const fees       = I.fees  >= 0 ? parseFloat(cleanCell(cols[I.fees]))  || 0 : 0
    const createTime = I.createTime >= 0 ? cleanCell(cols[I.createTime])       : ''

    orders.push({ buySell, symbol: cleanCell(cols[I.symbol]), price, createTime, qty, pl, fees })
  }

  orders.sort((a, b) => new Date(a.createTime) - new Date(b.createTime))

  // Emparejar órdenes en trades B+S
  /** @type {import('./tradeNormalizer.js').NormalizedTrade[]} */
  const trades = []
  let i = 0

  while (i < orders.length) {
    const o1 = orders[i]
    let j = i + 1
    // Buscar la orden de cierre del mismo símbolo con dirección opuesta
    while (j < orders.length && (orders[j].symbol !== o1.symbol || orders[j].buySell === o1.buySell)) j++

    if (j >= orders.length) {
      // No se encontró orden de cierre de signo opuesto para este
      // símbolo → posición todavía abierta. Se ignora igual que
      // siempre, pero ahora se contabiliza para poder informarlo.
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      i++; continue
    }
    const o2 = orders[j]

    const side       = o1.buySell === 'B' ? 'long' : 'short'
    const entryPrice = o1.price
    const exitPrice  = o2.price
    const pnl        = o2.pl !== 0 ? o2.pl : o1.pl
    const fees       = (o1.fees || 0) + (o2.fees || 0)
    const qty        = o1.qty
    const symbol     = normaliseSymbol(o1.symbol)
    const entryTime  = o1.createTime
    const exitTime   = o2.createTime

    // tradeId determinista
    const date    = toISODate(entryTime)
    const tradeId = `rth_${symbol}_${side}_${date}_${entryPrice}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'rithmic',
      symbol,
      side,
      quantity:   qty,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice,
      pnl,
      fees:       fees || undefined,
      setup:      'CSV Import',
    })

    orders.splice(j, 1)
    i++
  }

  return trades
}
