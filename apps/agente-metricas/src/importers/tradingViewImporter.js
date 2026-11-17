// ─────────────────────────────────────────────
//  EDGELOG · TradingView Importer (Strategy Tester → List of Trades)
//
//  Formato real (export "List of Trades" del Strategy Tester):
//    Trade number, Type, Date and time, Signal, Price USD,
//    Size (qty), Size (value), Net PnL USD, Return %, ...
//
//  Particularidad: NO es una fila = un trade. Cada operación viene
//  partida en DOS filas que comparten "Trade number":
//    · "Entry long"/"Entry short" → apertura
//    · "Exit long"/"Exit short"   → cierre
//  Hay que emparejarlas — por eso NO se puede resolver con el
//  asistente de mapeo genérico (que asume una fila = un trade).
//
//  Otra particularidad: TradingView no incluye el símbolo en este
//  CSV (el export es por gráfico/estrategia, el símbolo es implícito).
//  Se usa options.defaultSymbol si el usuario lo indicó al importar;
//  si no, 'UNKNOWN'.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function parseTradingView(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const headers = parseLine(lines[0]).map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    tradeNumber: idx('tradenumber', 'nmerodeoperacin'),
    type:        idx('type', 'tipo'),
    dateTime:    idx('dateandtime', 'date', 'fechayhora'),
    price:       idx('priceusd', 'price', 'preciousd'),
    qty:         idx('sizeqty', 'qty', 'quantity', 'tamaocant'),
    pnl:         idx('netpnlusd', 'netpnl', 'pnl', 'pygnetasusd'),
    // MFE/MAE — TradingView los calcula de verdad con el camino de
    // precio completo de su propio backtester, no es una estimación.
    // "Desviación favorable" = MFE, "Desviación adversa" = MAE.
    mfeUsd:      idx('favorableexcursionusd', 'desviacinfavorableusd'),
    maeUsd:      idx('adverseexcursionusd', 'desviacinadversausd'),
  }
  if (I.tradeNumber < 0 || I.type < 0 || I.dateTime < 0 || I.pnl < 0) return []

  const fallbackSymbol = normaliseSymbol(options.defaultSymbol || 'UNKNOWN')

  // 1) Agrupar filas por "Trade number"
  const rowsByTrade = new Map()
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 4) continue
    const tn = cleanCell(cols[I.tradeNumber])
    if (!tn) continue
    if (!rowsByTrade.has(tn)) rowsByTrade.set(tn, [])
    rowsByTrade.get(tn).push(cols)
  }

  // 2) Emparejar Entry + Exit de cada grupo
  const trades = []
  const seen = new Set()

  for (const [tn, rows] of rowsByTrade) {
    const entryRow = rows.find(c => {
      const t = cleanCell(c[I.type]).toLowerCase()
      return t.startsWith('entry') || t.startsWith('entrada')
    })
    const exitRow  = rows.find(c => {
      const t = cleanCell(c[I.type]).toLowerCase()
      return t.startsWith('exit') || t.startsWith('salida')
    })
    if (!entryRow) continue

    if (!exitRow) {
      // Trade sin fila de cierre → posición todavía abierta en el
      // momento del export. Se ignora, pero se contabiliza.
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const typeRaw = cleanCell(entryRow[I.type]).toLowerCase()
    const side    = (typeRaw.includes('short') || typeRaw.includes('corto')) ? 'short' : 'long'

    const entryTime  = cleanCell(entryRow[I.dateTime])
    const exitTime   = cleanCell(exitRow[I.dateTime])
    const entryPrice = I.price >= 0 ? parseFloat(cleanCell(entryRow[I.price])) || 0 : 0
    const exitPrice  = I.price >= 0 ? parseFloat(cleanCell(exitRow[I.price]))  || 0 : 0
    const qty        = I.qty  >= 0 ? Math.abs(parseFloat(cleanCell(entryRow[I.qty]))) || 1 : 1
    const pnl        = parseFloat(cleanCell(exitRow[I.pnl])) || 0
    // MFE/MAE vienen en la fila de SALIDA (misma fila que trae el PnL
    // final) — TradingView repite el mismo valor en ambas filas del
    // trade, pero se lee de exitRow por coherencia con pnl.
    const mfeUsd = I.mfeUsd >= 0 ? parseFloat(cleanCell(exitRow[I.mfeUsd])) || null : null
    const maeUsd = I.maeUsd >= 0 ? parseFloat(cleanCell(exitRow[I.maeUsd])) || null : null

    const date    = toISODate(entryTime)
    const tradeId = `tv_${tn}_${side}_${date}_${entryPrice}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'tradingview',
      symbol:     fallbackSymbol,
      side,
      quantity:   qty,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice,
      pnl,
      mfeDollar:  mfeUsd,
      maeDollar:  maeUsd,
      setup:      'CSV Import',
    })
  }

  return trades
}
