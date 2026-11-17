// ─────────────────────────────────────────────
//  EDGELOG · MT5 Importer (reporte HTML del terminal)
//
//  Brokers: FundedNext, Alpha Capital Group, ACG Markets, y
//  cualquier bróker MT4/MT5 cuyo terminal exporte el historial como
//  .html en vez de .csv. El archivo trae 3 tablas (Posiciones,
//  Órdenes, Transacciones) — solo se lee la PRIMERA (Posiciones,
//  los trades ya cerrados), se para al encontrar la segunda cabecera.
//
//  Soporta español ("Fecha/Hora"/"Símbolo") e inglés ("Time"/
//  "Symbol"/"Profit") en el mismo parser — misma estructura HTML,
//  solo cambian las etiquetas.
//
//  Cómo se identifica una fila de trade real (no de orden pendiente,
//  que tiene un layout distinto): las últimas 3 celdas deben verse
//  como números decimales (Comisión, Swap, Beneficio).
//
//  Los retiros (payouts) están en la tabla de Transacciones: los lee
//  parseMT5HTMLWithdrawals y parseMT5HTML los deja en
//  options.stats.withdrawals para que el import los guarde en la cuenta.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { htmlCellText, getHtmlRowCells, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function isMT5HTML(text) {
  // Las cabeceras de la tabla pueden ir después de un bloque <style>
  // largo (reporte "Trade History Report" del terminal MT5): se mira
  // un trozo amplio, no solo el principio.
  const t = text.slice(0, 30000)
  const looksHtml = /<html|<table/i.test(t)
  if (!looksHtml) return false
  const spanish = t.includes('Fecha/Hora') && (t.includes('Símbolo') || t.toLowerCase().includes('mbolo'))
  const english = t.includes('Time') && t.includes('Symbol') && t.includes('Profit')
  return spanish || english
}

// Celdas de una fila sin las ocultas (<td class="hidden" colspan="8">)
// que mete el reporte "Trade History Report" de MT5 y que descuadran
// los índices.
function visibleRowCells(rowHtml) {
  return getHtmlRowCells(rowHtml.replace(/<td[^>]*class="hidden"[^>]*>\s*<\/td>/gi, ''))
}

// MT5 escribe las fechas como 2026.05.27 14:14:12 → 2026-05-27 14:14:12
const isoDots = (v) => String(v || '').replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')

const num = (v) => parseFloat(String(v || '').replace(/\s/g, '').replace(/[^0-9.\-]/g, '')) || 0

// Mapa de columnas a partir de la cabecera. "Time"/"Price" salen dos
// veces: la primera es apertura, la segunda cierre.
function headerMap(cells) {
  const map = {}
  const seen = {}
  cells.forEach((c, i) => {
    const k = c.toLowerCase().replace(/\s+/g, '')
    seen[k] = (seen[k] || 0) + 1
    const key = (k === 'time' || k === 'fecha/hora') ? (seen[k] === 1 ? 'openTime' : 'closeTime')
      : (k === 'price' || k === 'precio') ? (seen[k] === 1 ? 'openPrice' : 'closePrice')
      : (k === 'symbol' || k.includes('mbolo')) ? 'symbol'
      : (k === 'type' || k === 'tipo') ? 'type'
      : (k === 'volume' || k === 'volumen') ? 'volume'
      : (k === 'position' || k === 'posición' || k === 'posicion') ? 'position'
      : (k === 'commission' || k === 'comisión' || k === 'comision') ? 'commission'
      : (k === 'swap') ? 'swap'
      : (k === 'profit' || k === 'beneficio') ? 'profit'
      : null
    if (key && map[key] === undefined) map[key] = i
  })
  const ok = ['openTime', 'closeTime', 'symbol', 'type', 'volume', 'openPrice', 'closePrice', 'profit'].every(k => map[k] !== undefined)
  return ok ? { map, width: cells.length } : null
}

// Operaciones de balance que mueven dinero de la cuenta (no "credit",
// que es crédito del bróker y no cambia el balance).
const BALANCE_OP_TYPES = new Set(['balance', 'charge', 'correction'])

// Retiros de la tabla de Transacciones (Deals): filas sin símbolo, de
// tipo balance/charge/correction y con beneficio negativo. FundedNext
// los marca como "charge" con comentario "Withdraw"/"Direct-Withdraw-acs".
// El depósito inicial (positivo) no se toca: es el tamaño de la cuenta.
// → [{ id, date, amount, note }] con amount en positivo.
export function parseMT5HTMLWithdrawals(text) {
  const out = []
  let cols = null
  for (const row of text.split('</tr>')) {
    const cells = getHtmlRowCells(row)
    if (!cells.length) continue
    const keys = cells.map(c => c.toLowerCase().replace(/\s+/g, ''))
    if (keys.includes('deal') || keys.includes('transacción') || keys.includes('transaccion')) {
      const find = (...names) => keys.findIndex(k => names.includes(k))
      cols = {
        width:   cells.length,
        time:    find('time', 'fecha/hora'),
        deal:    find('deal', 'transacción', 'transaccion'),
        symbol:  find('symbol', 'símbolo', 'simbolo'),
        type:    find('type', 'tipo'),
        profit:  find('profit', 'beneficio'),
        comment: find('comment', 'comentario'),
      }
      if ([cols.time, cols.deal, cols.type, cols.profit].some(i => i < 0)) cols = null
      continue
    }
    if (!cols || cells.length !== cols.width) continue
    if (!/^\d{4}\.\d{2}\.\d{2}/.test(cells[cols.time] || '')) continue
    if (!BALANCE_OP_TYPES.has((cells[cols.type] || '').toLowerCase())) continue
    if (cols.symbol >= 0 && cells[cols.symbol]) continue
    const amount = num(cells[cols.profit])
    if (!(amount < 0)) continue
    const deal = cells[cols.deal]
    const date = isoDots(cells[cols.time]).slice(0, 10)
    out.push({
      id:     /^\d+$/.test(deal) ? `mt5_${deal}` : `mt5_${date}_${-amount}`.replace(/[^a-zA-Z0-9]/g, '_'),
      date,
      amount: Math.round(-amount * 100) / 100,
      note:   (cols.comment >= 0 && cells[cols.comment]) || 'Retiro (MT5)',
    })
  }
  return out
}

export function parseMT5HTML(text, options = {}) {
  if (options.stats) options.stats.withdrawals = parseMT5HTMLWithdrawals(text)
  const trades = []
  const rows = text.split('</tr>')
  let headerFound = false
  let headerCount = 0
  let cols = null

  for (const row of rows) {
    const cells = getHtmlRowCells(row)
    if (!cells.length) continue

    const isSpanishHeader = cells.some(c => c === 'Fecha/Hora' || c === 'Date/Time') &&
      cells.some(c => c === 'Símbolo' || c === 'Symbol' || c.toLowerCase().includes('mbolo'))
    const isEnglishHeader = cells.some(c => c === 'Time') && cells.some(c => c === 'Symbol') && cells.some(c => c === 'Profit')

    if (isSpanishHeader || isEnglishHeader) {
      headerCount++
      // Solo la primera tabla es "Posiciones" (trades cerrados); la
      // segunda es "Órdenes" — ahí se para.
      if (headerCount === 1) { headerFound = true; cols = headerMap(cells); continue }
      else break
    }
    if (!headerFound) continue

    // Layout con cabecera reconocible: se lee cada columna por su
    // posición en la cabecera (símbolo, tipo, volumen, precios,
    // comisión, swap y beneficio reales).
    if (cols) {
      const v = visibleRowCells(row)
      if (v.length === cols.width && /^\d{4}\.\d{2}\.\d{2}/.test(v[cols.map.openTime] || '')) {
        const m = cols.map
        const type = (v[m.type] || '').toLowerCase()
        if (type !== 'buy' && type !== 'sell') continue
        const symbolRaw = v[m.symbol]
        if (!symbolRaw) continue
        const commission = m.commission !== undefined ? num(v[m.commission]) : 0
        const swap = m.swap !== undefined ? num(v[m.swap]) : 0
        const profit = num(v[m.profit])
        const pnl = Math.round((profit + commission + swap) * 100) / 100
        const openDate = isoDots(v[m.openTime])
        const closeDate = isoDots(v[m.closeTime]) || openDate
        const symbol = normaliseSymbol(symbolRaw.replace(/\.(pro|raw|c|ecn|std|plus)$/i, ''))
        const position = m.position !== undefined ? v[m.position] : ''
        const tradeId = position && /^\d+$/.test(position)
          ? `mt5html_${position}`
          : `mt5html_${symbol}_${openDate}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')
        trades.push({
          tradeId,
          account:    options.accountId || 'acc-1',
          source:     'mt5_html',
          symbol,
          side:       type === 'buy' ? 'long' : 'short',
          quantity:   num(v[m.volume]) || 1,
          entryTime:  openDate,
          exitTime:   closeDate,
          entryPrice: num(v[m.openPrice]),
          exitPrice:  num(v[m.closePrice]),
          pnl,
          fees:       Math.round((Math.abs(commission) + Math.abs(swap)) * 100) / 100,
          setup:      'CSV Import',
        })
        continue
      }
    }

    // Fila de trade real: empieza por una fecha (YYYY.MM.DD o un ID
    // numérico) y las últimas 3 celdas son números decimales
    // (Comisión, Swap, Beneficio) — así se descartan las filas de
    // "Órdenes" (que tienen texto tipo "[sl ...]"/"filled").
    if (!cells[0] || !cells[0].match(/^\d{4}\.\d{2}|^\d+$/)) continue
    if (cells.length < 13) continue

    const last  = cells[cells.length - 1]
    const prev1 = cells[cells.length - 2]
    const prev2 = cells[cells.length - 3]
    const looksLikeTradeRow = /^-?\d+\.\d+$/.test(last) && /^-?\d+\.\d+$/.test(prev1) && /^-?\d+\.\d+$/.test(prev2)
    if (!looksLikeTradeRow) continue

    // Símbolo: en el layout de 13 columnas suele ir en el índice 2;
    // en variantes de más columnas, en el 3. Se elige el que primero
    // parezca un ticker real (letras/números, longitud razonable).
    const candidateSymbolIdx = cells.length === 13 ? 2 : 3
    const symbolRaw = cells[candidateSymbolIdx]
    if (!symbolRaw || symbolRaw.length > 20 || /^\d+$/.test(symbolRaw)) continue

    // Fecha de apertura = primera celda con pinta de fecha; fecha de
    // cierre = la SEGUNDA aparición de ese mismo patrón en la fila.
    let openDate = '', closeDate = '', dateCount = 0
    for (const c of cells) {
      if (/^\d{4}\.\d{2}\.\d{2}/.test(c)) {
        dateCount++
        if (dateCount === 1) openDate = c
        else if (dateCount === 2) { closeDate = c; break }
      }
    }
    if (!openDate) openDate = cells[0]
    if (!closeDate) closeDate = openDate

    const pnl = parseFloat(last.replace(/[^0-9.\-]/g, '')) || 0
    const cleanSymbol = symbolRaw.replace(/\.(pro|raw|c|ecn|std|plus)$/i, '')
    const symbol = normaliseSymbol(cleanSymbol)
    const date   = toISODate(openDate)
    const tradeId = `mt5html_${symbol}_${date}_${openDate}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'mt5_html',
      symbol,
      side:       'long', // el layout de reporte HTML no separa Buy/Sell de forma fiable en todas las variantes — ver nota de limitación en cTraderImporter.js, mismo criterio aquí
      quantity:   1,
      entryTime:  isoDots(openDate),
      exitTime:   isoDots(closeDate),
      entryPrice: 0,
      exitPrice:  0,
      pnl,
      setup:      'CSV Import',
    })
  }

  return trades
}
