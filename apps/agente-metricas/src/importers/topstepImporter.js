// ─────────────────────────────────────────────
//  EDGELOG · Topstep Importer
//
//  Formato real (export de la plataforma propia de Topstep):
//    Id, ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice,
//    Fees, PnL, Size, Type
//
//  Particularidad: el PnL que exporta Topstep es BRUTO — las
//  comisiones vienen en su propia columna "Fees" y hay que restarlas
//  para obtener el resultado neto real de la operación.
//
//  Cada fila ya es una posición cerrada (no hay fills que agrupar).
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol, toISODate } from './tradeNormalizer.js'

export function isTopstepCSV(text) {
  const t = text.slice(0, 400)
  return t.includes('ContractName') && (t.includes('ExitedAt') || t.includes('EnteredAt'))
}

export function parseTopstep(text, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = parseLine(lines[0]).map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    contract:   idx('contractname'),
    enteredAt:  idx('enteredat'),
    exitedAt:   idx('exitedat'),
    entryPrice: idx('entryprice'),
    exitPrice:  idx('exitprice'),
    fees:       idx('fees'),
    pnl:        idx('pnl'),
    size:       idx('size', 'qty', 'quantity'),
    type:       idx('type'),
  }
  if (I.contract < 0 || I.exitedAt < 0 || I.pnl < 0) return []

  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 5) continue

    const rawSymbol = cleanCell(cols[I.contract])
    // Quita el sufijo de mes/año del contrato de futuros: MGCJ6 → MGC
    const symbol = normaliseSymbol(rawSymbol.replace(/[FGHJKMNQUVXZ]\d+$/, '').trim() || rawSymbol)

    const exitedAt = cleanCell(cols[I.exitedAt])
    if (!exitedAt) continue
    const enteredAt = I.enteredAt >= 0 ? cleanCell(cols[I.enteredAt]) : exitedAt

    const entryPrice = I.entryPrice >= 0 ? parseFloat(cleanCell(cols[I.entryPrice])) || 0 : 0
    const exitPrice  = I.exitPrice  >= 0 ? parseFloat(cleanCell(cols[I.exitPrice]))  || 0 : 0
    const qty        = I.size >= 0 ? Math.abs(parseFloat(cleanCell(cols[I.size]))) || 1 : 1

    const rawType = I.type >= 0 ? cleanCell(cols[I.type]).toLowerCase() : ''
    const side    = (rawType.includes('short') || rawType.includes('sell')) ? 'short' : 'long'

    const pnlGross = parseFloat(cleanCell(cols[I.pnl])) || 0
    const fees     = I.fees >= 0 ? Math.abs(parseFloat(cleanCell(cols[I.fees])) || 0) : 0
    const pnl      = parseFloat((pnlGross - fees).toFixed(2))

    const date    = toISODate(exitedAt)
    const tradeId = `topstep_${symbol}_${side}_${date}_${entryPrice}_${pnl}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'topstep',
      symbol,
      side,
      quantity:   qty,
      entryTime:  enteredAt,
      exitTime:   exitedAt,
      entryPrice,
      exitPrice,
      pnl,
      fees:       fees || undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
