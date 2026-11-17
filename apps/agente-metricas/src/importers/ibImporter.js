// ─────────────────────────────────────────────
//  EDGELOG · Interactive Brokers Importer
//
//  Formato esperado (Activity Statement de IB, export CSV):
//  IB NO exporta una tabla limpia — el archivo concatena varias
//  "secciones" de report distintas (Trades, Cash Report, Open
//  Positions, ...), cada una con sus propias columnas, todas dentro
//  del mismo CSV. La fila de cabecera real de cada sección es:
//
//    Trades,Header,DataDiscriminator,Asset Category,...,Symbol,
//    Date/Time,Quantity,T. Price,Proceeds,Comm/Fee,Realized P/L,...
//
//  y sus filas de datos empiezan igual: "Trades,Data,Order,...".
//  Este importer busca esa sección concreta (ignora el resto del
//  archivo) y usa SU cabecera para saber en qué columna está cada
//  campo — no la primera línea del CSV, que pertenece a otra sección.
//
//  Limitación conocida y documentada: el export de IB es por
//  EJECUCIÓN, no por operación cerrada — no incluye el precio de
//  apertura de cada posición en la misma fila. Aquí se importa cada
//  ejecución con "Realized P/L" distinto de cero como un trade
//  (con el precio y hora de esa ejecución como entrada Y salida,
//  ya que es el único precio disponible en esta sección). Es una
//  aproximación razonable para ver PnL y estadísticas agregadas,
//  pero no reconstruye el par exacto de entrada/salida de cada
//  posición. Si se necesita precisión total, mejor usar el asistente
//  de mapeo manual apuntando directamente a un export "Trade
//  Confirmation" con apertura y cierre en la misma fila.
//
//  Detección: por columnas, vía formatSignatures.js — este archivo
//  NO exporta ningún isXCSV, solo el parser.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate, toTime } from './tradeNormalizer.js'

// El export de IB concatena varias secciones de report en un mismo
// CSV; la sección de operaciones siempre trae esta línea de
// cabecera exacta en algún punto del archivo (no necesariamente en
// la línea 1) — mismo enfoque que ya usa Rithmic para sus reports
// multi-sección (ver isRithmicCSV en rithmicImporter.js).
export function isInteractiveBrokersCSV(text) {
  return text.includes('Trades,Header,DataDiscriminator')
}

export function parseInteractiveBrokers(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  // Localizar la fila de cabecera REAL de la sección "Trades"
  // (columna 0 = "Trades", columna 1 = "Header").
  let headerLine = -1
  for (let i = 0; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols[0] === 'Trades' && cols[1] === 'Header') { headerLine = i; break }
  }
  if (headerLine < 0) return []

  const rawHeaders = parseLine(lines[headerLine])
  const headers = rawHeaders.map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    symbol:     idx('symbol'),
    dateTime:   idx('datetime'),
    quantity:   idx('quantity'),
    price:      idx('tprice', 'price'),
    proceeds:   idx('proceeds'),
    commFee:    idx('commfee'),
    realizedPL: idx('realizedpl'),
  }
  if (I.symbol < 0 || I.dateTime < 0 || I.price < 0) return []

  const trades = []
  const seen = new Set()

  // Filas de datos de esa misma sección: columna 0 = "Trades",
  // columna 1 = "Data" (cualquier otra sección/fila se ignora).
  for (let i = headerLine + 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols[0] !== 'Trades' || cols[1] !== 'Data') continue
    if (cols.length < headers.length - 2) continue

    const dateTimeRaw = cleanCell(cols[I.dateTime]).replace('"', '')
    if (!dateTimeRaw) continue
    const [datePart, timePart] = dateTimeRaw.split(',').map(s => s.trim())

    const realizedPL = I.realizedPL >= 0 ? parseFloat(cleanCell(cols[I.realizedPL])) || 0 : 0
    // Realized P/L = 0 → ejecución de apertura, todavía sin cerrar.
    if (!realizedPL) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const symbol   = normaliseSymbol(cleanCell(cols[I.symbol]))
    const quantity = I.quantity >= 0 ? parseFloat(cleanCell(cols[I.quantity])) || 1 : 1
    const side     = quantity < 0 ? 'short' : 'long'
    const price    = I.price >= 0 ? parseFloat(cleanCell(cols[I.price])) || 0 : 0
    const commFee  = I.commFee >= 0 ? parseFloat(cleanCell(cols[I.commFee])) || 0 : 0

    const date    = toISODate(datePart)
    const time    = timePart || toTime(dateTimeRaw)
    const tradeId = `ib_${symbol}_${side}_${date}_${time}_${price}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'interactive_brokers',
      symbol,
      side,
      quantity:   Math.abs(quantity),
      entryTime:  `${date} ${time}`,
      exitTime:   `${date} ${time}`,
      entryPrice: price,
      exitPrice:  price,
      pnl:        parseFloat((realizedPL - Math.abs(commFee)).toFixed(2)),
      fees:       commFee ? Math.abs(commFee) : undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
