// ─────────────────────────────────────────────
//  EDGELOG · Motor de mapeo manual de columnas
//
//  Se usa SOLO cuando ningún formato conocido (legacy ni por firma)
//  reconoce el CSV. Convierte cualquier CSV a NormalizedTrade[] a
//  partir de un mapeo columna→campo definido por el usuario en el
//  asistente (ColumnMappingWizard). Mismo contrato que el resto de
//  importers — nunca produce AppTrade[] directamente.
// ─────────────────────────────────────────────

import { parseLine, cleanCell, normaliseSymbol, normaliseHeader, toISODate, parseMoney, detectDelimiter } from './tradeNormalizer.js'

// Campos que el asistente ofrece asignar. El usuario elige, para cada
// uno, a qué columna del CSV corresponde (o "no aplica").
export const MAPPABLE_FIELDS = [
  { key: 'openTime',   label: 'Fecha/hora de apertura',    required: true  },
  { key: 'closeTime',  label: 'Fecha/hora de cierre',      required: false },
  { key: 'symbol',     label: 'Activo / símbolo',          required: true  },
  { key: 'side',       label: 'Dirección (compra/venta)',  required: false },
  { key: 'quantity',   label: 'Cantidad / volumen',        required: false },
  { key: 'entryPrice', label: 'Precio de entrada',         required: false },
  { key: 'exitPrice',  label: 'Precio de salida',          required: false },
  { key: 'pnl',        label: 'Resultado (P&L)',           required: true  },
  { key: 'fees',       label: 'Comisiones',                required: false },
]

/**
 * Firma estable de un CSV a partir de sus cabeceras — la clave con la
 * que se recuerda el mapeo manual (useImportFormatsStore) y se
 * reconoce automáticamente la próxima vez que aparezcan las mismas
 * columnas, en cualquier orden.
 */
export function headerSignatureHash(rawHeaders) {
  return rawHeaders.map(normaliseHeader).filter(Boolean).sort().join('|')
}

/**
 * mapping: { [fieldKey]: columnIndex }  — índice de columna del CSV
 * (undefined/-1 = ese campo no está mapeado).
 */
export function parseWithMapping(text, mapping, options = {}) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []
  const delim = detectDelimiter(lines[0])

  const trades = []
  const seen = new Set()

  const colOf = (cols, key) => {
    const i = mapping[key]
    return (i === undefined || i === null || i < 0) ? '' : cleanCell(cols[i])
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delim)
    if (!cols.length) continue

    const openTimeRaw  = colOf(cols, 'openTime')
    const closeTimeRaw = colOf(cols, 'closeTime')
    if (!openTimeRaw) continue
    // Sin cierre mapeado/presente → posición todavía abierta: se
    // ignora, pero se contabiliza para informarlo en la vista previa.
    if (!closeTimeRaw) {
      if (options.stats) options.stats.openIgnored = (options.stats.openIgnored || 0) + 1
      continue
    }

    const symbol   = normaliseSymbol(colOf(cols, 'symbol'))
    const rawSide  = colOf(cols, 'side').toLowerCase()
    const side     = rawSide.includes('sell') || rawSide.includes('short') || rawSide.includes('venta') ? 'short' : 'long'
    const quantity = Math.abs(parseMoney(colOf(cols, 'quantity'))) || 1
    const entryPrice = parseMoney(colOf(cols, 'entryPrice'))
    const exitPrice  = parseMoney(colOf(cols, 'exitPrice'))
    // "$(56.50)" es negativo — antes se quitaban los paréntesis y quedaba +56.50
    const pnl         = parseMoney(colOf(cols, 'pnl'))
    const fees          = Math.abs(parseMoney(colOf(cols, 'fees')))

    const date    = toISODate(openTimeRaw)
    const tradeId = `map_${symbol}_${side}_${date}_${entryPrice}_${pnl}_${i}`.replace(/[^a-zA-Z0-9]/g, '_')
    if (seen.has(tradeId)) continue
    seen.add(tradeId)

    trades.push({
      tradeId,
      account:    options.accountId || 'acc-1',
      source:     'manual-mapping',
      symbol,
      side,
      quantity,
      entryTime:  openTimeRaw,
      exitTime:   closeTimeRaw,
      entryPrice,
      exitPrice,
      pnl,
      fees:       fees || undefined,
      setup:      'CSV Import',
    })
  }

  return trades
}
