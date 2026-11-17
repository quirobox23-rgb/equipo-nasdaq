// ─────────────────────────────────────────────
//  EDGELOG · MT5 Importer (informe en español)
//
//  Brokers: cualquier MT5 configurado en español (WSF Markets,
//  ICMarkets ES, RoboForex ES...). NO es el mismo formato que
//  mt5Importer.js (ese es un CSV plano de una sola cabecera, en
//  inglés) — este viene con varias líneas de encabezado narrativo
//  ("Informe del historial de trading") y una sección "Posiciones"
//  con los trades cerrados, seguida de "Resultados"/"Balance"/etc.
//  Por eso necesita su propio detector e importador, no basta con
//  añadir alias de columna al parser en inglés.
//
//  Columnas dentro de "Posiciones" (layout de 22 columnas, el más
//  común; hay brokers con 13):
//    0=Fecha apertura | 2=Símbolo | 12=Volumen | 13=Precio apertura |
//    16=Fecha cierre | 17=Precio cierre | 18=Comisión | 19=Swap |
//    20=Beneficio
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function isMT5SpanishCSV(text) {
  const t = text.slice(0, 2000)
  // El reporte .html del terminal lleva el mismo título en <title>:
  // ese lo lee mt5HtmlImporter, no este parser de CSV.
  if (/<html|<table/i.test(t)) return false
  return t.includes('Informe del historial de trading') || (t.includes('Posiciones') && t.includes('Símbolo'))
}

export function parseMT5Spanish(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const trades = []
  const seen = new Set()

  let inPositions = false
  let headerParsed = false
  let colDate = 16, colSymbol = 2, colOpenPrice = 13, colClosePrice = 17
  let colComision = 18, colSwap = 19, colBeneficio = 20

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim()
    if (!stripped) continue

    if (stripped.startsWith('Posiciones')) { inPositions = true; continue }
    if (inPositions && (
      stripped.startsWith('Resultados') || stripped.startsWith('Balance:') ||
      stripped.startsWith('Patrimonio') || stripped.startsWith('Ganancias') ||
      stripped.startsWith('Órdenes') || stripped.startsWith('Ordenes')
    )) break
    if (!inPositions) continue

    const cols = parseLine(lines[i])

    if (!headerParsed) {
      // Ajusta los índices de columna según el número real de
      // columnas del layout (varía por broker: 22 cols es el más
      // común, algunos exportan solo 13).
      if (cols.length >= 20) {
        colDate = 16; colSymbol = 2; colOpenPrice = 13; colClosePrice = 17
        colComision = 18; colSwap = 19; colBeneficio = 20
      } else if (cols.length >= 13) {
        colDate = 8; colSymbol = 2; colOpenPrice = 6; colClosePrice = 9
        colComision = 10; colSwap = 11; colBeneficio = 12
      }
      // Búsqueda explícita por nombre — sobreescribe la posición por
      // defecto si el broker la puso en otro sitio.
      const hdrs = cols.map(c => c.toLowerCase().replace(/[^a-záéíóúñ/]/gi, ' ').trim())
      hdrs.forEach((h, idx) => {
        if (h.includes('beneficio') || h.includes('profit')) colBeneficio = idx
      })
      headerParsed = true
      continue
    }

    // Saltar filas sin fecha de apertura (subtotales, líneas vacías)
    if (!cols[0] || !cols[0].trim().match(/^\d{4}/)) continue

    const symbol = cleanCell(cols[colSymbol])
    if (!symbol || symbol.length > 12) continue // fila de subtotal, no un trade

    const openTime  = cleanCell(cols[0])
    const closeTime = cleanCell(cols[colDate]) || openTime
    const openPrice  = parseFloat(cleanCell(cols[colOpenPrice]))  || 0
    const closePrice = parseFloat(cleanCell(cols[colClosePrice])) || 0
    const volume      = parseFloat(cleanCell(cols[12])) || 1 // volumen suele estar en col 12 en el layout de 22
    const comision    = parseFloat(cleanCell(cols[colComision])) || 0
    const swap        = parseFloat(cleanCell(cols[colSwap])) || 0
    const beneficio   = parseFloat(cleanCell(cols[colBeneficio])) || 0
    const pnl = parseFloat((beneficio + swap - Math.abs(comision)).toFixed(2))

    const rawType = cleanCell(cols[3] || '').toLowerCase() // "Tipo" suele ir en col 3
    const side    = rawType.includes('venta') || rawType.includes('sell') ? 'short' : 'long'

    const date    = toISODate(openTime)
    const normSymbol = normaliseSymbol(symbol)
    const tradeId = `mt5es_${normSymbol}_${side}_${date}_${openPrice}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'mt5_es',
      symbol:     normSymbol,
      side,
      quantity:   volume,
      entryTime:  openTime,
      exitTime:   closeTime,
      entryPrice: openPrice,
      exitPrice:  closePrice,
      pnl,
      fees:       (comision || swap) ? parseFloat((Math.abs(comision) + Math.abs(swap)).toFixed(2)) : undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
