// ─────────────────────────────────────────────
//  EDGELOG · cTrader Importer (reporte HTML de posiciones)
//
//  cTrader exporta el historial como una tabla HTML (no CSV plano).
//  Estructura: busca una sección "Historial"/"History", localiza la
//  fila de cabecera (contiene "Símbolo"/"Symbol"), y a partir de ahí
//  lee cada fila de posición cerrada.
//
//  LIMITACIÓN CONOCIDA: solo se verificaron con certeza las columnas
//  de Símbolo (índice 1), Fecha/hora de cierre (índice 3) y PnL
//  (índice 7) — son las que ya se usaban en el prototipo de
//  referencia del que sale este importador. No hay columnas de
//  dirección (largo/corto), precio de entrada/salida ni cantidad
//  verificadas contra un export real de cTrader todavía. Por eso:
//    - symbol y pnl y fecha → fiables
//    - side se deja fijo en 'long' (no se puede inferir del signo
//      del PnL — una corta perdedora también da PnL negativo)
//    - entryPrice/exitPrice quedan en 0 (toAppTrade ya los trata
//      como opcionales)
//  Si alguien tiene un CSV/HTML real de cTrader con más columnas,
//  se puede afinar esto sin tocar el resto del sistema.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { htmlCellText, getHtmlRowCells, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function isCTraderHTML(text) {
  const t = text.slice(0, 2000)
  return /<html|<table/i.test(t) && (t.includes('cTrader') || (t.includes('Historial') && t.includes('Símbolo')) || (t.includes('History') && t.includes('Symbol')))
}

export function parseCTrader(text, options = {}) {
  const trades = []
  const rows = text.split('</tr>')
  let inHistorial = false
  let headerFound = false

  for (const row of rows) {
    const cells = getHtmlRowCells(row)
    if (!cells.length) continue

    if (cells.some(c => c === 'Historial' || c === 'History')) { inHistorial = true; continue }
    if (!inHistorial) continue

    if (cells.some(c => c === 'Símbolo' || c === 'Symbol' || c.toLowerCase().includes('mbolo'))) {
      headerFound = true
      continue
    }
    if (!headerFound) continue
    if (cells[0] === 'Totales' || cells[0] === 'Totals') continue
    if (cells.length < 8) continue

    const symbolRaw = cells[1]
    const dateFull  = cells[3]
    const pnlRaw    = cells[7]
    if (!symbolRaw || symbolRaw.length > 15) continue
    if (!dateFull || !dateFull.match(/\d{2}\/\d{2}\/\d{4}/)) continue

    const dp = dateFull.split(' ')
    const [dd, mm, yyyy] = dp[0].split('/')
    const tp = dp[1] ? dp[1].split('.')[0] : '00:00:00'
    const dateNorm = `${yyyy}-${mm}-${dd} ${tp}`

    const pnl   = parseFloat(String(pnlRaw).replace(/[^0-9.\-]/g, '')) || 0
    const symbol = normaliseSymbol(symbolRaw)
    const date   = toISODate(dateNorm)
    const tradeId = `ctrader_${symbol}_${date}_${dateNorm}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'ctrader',
      symbol,
      side:       'long', // ver limitación documentada arriba
      quantity:   1,
      entryTime:  dateNorm,
      exitTime:   dateNorm,
      entryPrice: 0,
      exitPrice:  0,
      pnl,
      setup:      'CSV Import',
    })
  }

  return trades
}
