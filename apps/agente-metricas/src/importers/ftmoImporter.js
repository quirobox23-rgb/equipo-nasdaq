// ─────────────────────────────────────────────
//  EDGELOG · FTMO (MetriX) Importer
//
//  Formato esperado (export del "Trading Journal" de FTMO MetriX):
//    Ticket, Open, Type, Volume, Symbol, Price, SL, TP,
//    Close, Price, Swap, Commissions, Profit, Pips,
//    Trade duration in seconds
//
//  "Price" aparece DOS VECES (apertura y cierre) — se resuelve por
//  orden de aparición, igual que en MT5.
//  "Profit" es bruto: el neto es Profit + Swap + Commissions (estos
//  dos ya vienen con signo, normalmente negativos).
//
//  Cada fila es una posición cerrada (los cierres parciales vienen
//  como filas aparte con su propio ticket), así que no hay nada que
//  agrupar. Detección: por columnas, vía formatSignatures.js.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol } from './tradeNormalizer.js'

export function parseFTMO(text, options = {}) {
  const lines = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const headers = parseLine(lines[0]).map(normaliseHeader)
  const priceIdxs = headers.reduce((acc, h, i) => (h === 'price' ? [...acc, i] : acc), [])
  const idx = (...names) => headers.findIndex(h => names.includes(h))

  const I = {
    ticket:      idx('ticket'),
    openTime:    idx('open'),
    closeTime:   idx('close'),
    type:        idx('type'),
    volume:      idx('volume'),
    symbol:      idx('symbol'),
    openPrice:   priceIdxs[0] ?? -1,
    closePrice:  priceIdxs[1] ?? -1,
    swap:        idx('swap'),
    commissions: idx('commissions', 'commission'),
    profit:      idx('profit'),
  }
  if (I.ticket < 0 || I.openTime < 0 || I.type < 0 || I.symbol < 0 || I.profit < 0) return []

  const num = (i, cols) => (i >= 0 ? parseFloat(cleanCell(cols[i])) || 0 : 0)
  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 5) continue

    const rawType = cleanCell(cols[I.type]).toLowerCase()
    // Solo operaciones (buy/sell); depósitos o ajustes de balance no.
    if (!rawType.includes('buy') && !rawType.includes('sell')) continue

    const openTime  = cleanCell(cols[I.openTime])
    const closeTime = I.closeTime >= 0 ? cleanCell(cols[I.closeTime]) : ''
    if (!openTime) continue
    if (!closeTime) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const ticket = cleanCell(cols[I.ticket])
    const tradeId = `ftmo_${ticket}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    const swap = num(I.swap, cols)
    const commissions = num(I.commissions, cols)
    const profit = num(I.profit, cols)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'ftmo',
      symbol:     normaliseSymbol(cleanCell(cols[I.symbol])),
      side:       rawType.includes('sell') ? 'short' : 'long',
      quantity:   num(I.volume, cols) || 1,
      entryTime:  openTime,
      exitTime:   closeTime,
      entryPrice: num(I.openPrice, cols),
      exitPrice:  num(I.closePrice, cols),
      pnl:        parseFloat((profit + swap + commissions).toFixed(2)),
      fees:       (swap || commissions) ? parseFloat((Math.abs(swap) + Math.abs(commissions)).toFixed(2)) : undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
