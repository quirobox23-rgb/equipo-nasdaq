// ─────────────────────────────────────────────
//  EDGELOG · Exness Importer
//
//  Formato esperado (historial de órdenes exportado desde el área
//  personal de Exness):
//    ticket, opening_time_utc, closing_time_utc, type, lots,
//    original_position_size, symbol, opening_price, closing_price,
//    stop_loss, take_profit, commission, swap, profit, equity,
//    margin_level, close_reason
//
//  · "profit" es bruto: el neto es profit + swap + commission (ya
//    vienen con signo).
//  · Los símbolos llevan el sufijo del tipo de cuenta (USTECm,
//    XAUUSDc…): se quita para que el par se vea igual que en MT5.
//  · El archivo no trae depósitos ni retiros, solo operaciones.
//
//  Cada fila es una posición cerrada (cada aumento o parcial es otra
//  fila con su ticket): groupIntoOperations las junta en operaciones.
//  Detección: por columnas, vía formatSignatures.js.
//
//  Devuelve NormalizedTrade[] — nunca AppTrade[].
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseHeader, normaliseSymbol } from './tradeNormalizer.js'

// "2026-10-28T20:18:09" → "2026-10-28 20:18:09"
const toTime = (v) => cleanCell(v).replace('T', ' ').replace(/Z$/, '')
// USTECm / XAUUSDc / EURUSDz → USTEC / XAUUSD / EURUSD
const stripSuffix = (s) => s.replace(/(?<=[A-Z0-9])[a-z]+$/, '')

export function parseExness(text, options = {}) {
  const lines = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []

  const headers = parseLine(lines[0]).map(normaliseHeader)
  const idx = (...names) => headers.findIndex(h => names.includes(h))
  const I = {
    ticket:     idx('ticket'),
    openTime:   idx('openingtimeutc'),
    closeTime:  idx('closingtimeutc'),
    type:       idx('type'),
    lots:       idx('lots'),
    symbol:     idx('symbol'),
    openPrice:  idx('openingprice'),
    closePrice: idx('closingprice'),
    commission: idx('commission'),
    swap:       idx('swap'),
    profit:     idx('profit'),
  }
  if (I.ticket < 0 || I.openTime < 0 || I.type < 0 || I.symbol < 0 || I.profit < 0) return []

  const num = (i, cols) => (i >= 0 ? parseFloat(cleanCell(cols[i])) || 0 : 0)
  const trades = []
  const seen = new Set()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (cols.length < 5) continue

    const rawType = cleanCell(cols[I.type]).toLowerCase()
    if (!rawType.includes('buy') && !rawType.includes('sell')) continue

    const openTime  = toTime(cols[I.openTime])
    const closeTime = I.closeTime >= 0 ? toTime(cols[I.closeTime]) : ''
    if (!openTime) continue
    if (!closeTime) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const tradeId = `exness_${cleanCell(cols[I.ticket])}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    const swap = num(I.swap, cols)
    const commission = num(I.commission, cols)
    const profit = num(I.profit, cols)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'exness',
      symbol:     normaliseSymbol(stripSuffix(cleanCell(cols[I.symbol]))),
      side:       rawType.includes('sell') ? 'short' : 'long',
      quantity:   num(I.lots, cols) || 1,
      entryTime:  openTime,
      exitTime:   closeTime,
      entryPrice: num(I.openPrice, cols),
      exitPrice:  num(I.closePrice, cols),
      pnl:        parseFloat((profit + swap + commission).toFixed(2)),
      fees:       (swap || commission) ? parseFloat((Math.abs(swap) + Math.abs(commission)).toFixed(2)) : undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
