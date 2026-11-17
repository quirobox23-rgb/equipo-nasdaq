// ─────────────────────────────────────────────
//  EDGELOG · Trade Normalizer
//
//  Define el formato interno universal NormalizedTrade.
//  Todos los importers producen este tipo.
//  toAppTrade() lo convierte al formato que usa el dashboard/store.
//
//  Añadir un nuevo broker:
//    1. Crea src/importers/myBrokerImporter.js
//    2. Exporta  parseMyBroker(text, options) → NormalizedTrade[]
//    3. Registra en csvParser.js  (detectFormat + switch)
//    ← no toques nada más
// ─────────────────────────────────────────────

// ── Shared primitives ─────────────────────────
//  Re-exportados para que los importers no dependan de csvParser.js

const SYMBOL_MAP = {
  MNQ: 'MNQ', MNQM6: 'MNQ', MNQH6: 'MNQ', MNQU6: 'MNQ', MNQZ6: 'MNQ',
  MNQM5: 'MNQ', MNQH5: 'MNQ',
  NQ: 'NQ', NQM6: 'NQ', NQH6: 'NQ', NQU6: 'NQ', NQZ6: 'NQ',
  MES: 'MES', MESM6: 'MES', MESH6: 'MES', MESU6: 'MES', MESZ6: 'MES',
  ES: 'ES', ESM6: 'ES', ESH6: 'ES', ESU6: 'ES', ESZ6: 'ES',
  MGC: 'MGC', MGCM6: 'MGC', MGCQ6: 'MGC', MGCZ6: 'MGC',
  GC: 'GC', GCM6: 'GC', GCQ6: 'GC', GCZ6: 'GC',
  MYM: 'MYM', MYMM6: 'MYM', MYMH6: 'MYM',
  YM: 'YM', YMM6: 'YM', YMH6: 'YM',
  M2K: 'M2K', M2KM6: 'M2K',
  RTY: 'RTY', RTYM6: 'RTY',
  MCL: 'MCL', MCLM6: 'MCL',
  CL: 'CL', CLM6: 'CL',
  EURUSD: 'EURUSD', '6E': 'EURUSD', '6EM6': 'EURUSD',
  GBPUSD: 'GBPUSD', '6B': 'GBPUSD', '6BM6': 'GBPUSD',
  USDJPY: 'USDJPY', '6J': 'USDJPY', '6JM6': 'USDJPY',
  AUDUSD: 'AUDUSD', '6A': 'AUDUSD', '6AM6': 'AUDUSD',
  CADUSD: 'CADUSD', '6C': 'CADUSD', '6CM6': 'CADUSD',
  BTC: 'BTC', BTCUSD: 'BTC', BTCUSDT: 'BTC',
  ETH: 'ETH', ETHUSD: 'ETH',
}

export function normaliseSymbol(raw) {
  if (!raw) return 'UNKNOWN'
  const upper = String(raw).trim().toUpperCase()
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper]
  const stripped = upper.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '')
  if (SYMBOL_MAP[stripped]) return SYMBOL_MAP[stripped]
  return upper || 'UNKNOWN'
}

export function detectSession(dateTimeStr) {
  if (!dateTimeStr) return 'NY'
  try {
    let dt
    if (dateTimeStr.includes('/')) {
      const [datePart, timePart] = dateTimeStr.split(' ')
      const [m, d, y] = datePart.split('/')
      dt = new Date(`${y}-${m}-${d}T${timePart}`)
    } else {
      dt = new Date(dateTimeStr.replace(' ', 'T'))
    }
    if (isNaN(dt)) return 'NY'
    const utcH = dt.getUTCHours()
    if (utcH >= 0  && utcH < 7)  return 'Asia'
    if (utcH >= 7  && utcH < 12) return 'London'
    if (utcH >= 12 && utcH < 16) return 'London/NY Overlap'
    return 'NY'
  } catch { return 'NY' }
}

export const DEFAULT_RISK_CONSTANT = 550

export function calcR(dollarPnl, options = {}) {
  const pnl = parseFloat(dollarPnl) || 0
  if (pnl === 0) return 0
  const { mode = 'simple', balance = 0, riskPct = 0.55, riskConstant = DEFAULT_RISK_CONSTANT } = options
  const riskAmount = (mode === 'account' && balance > 0 && riskPct > 0)
    ? balance * (riskPct / 100)
    : (parseFloat(riskConstant) || DEFAULT_RISK_CONSTANT)
  if (!riskAmount) return 0
  return parseFloat((pnl / riskAmount).toFixed(2))
}

export function parseLine(line, delimiter = ',') {
  const values = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === delimiter && !inQ) { values.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  values.push(cur.trim())
  return values
}

// Separador de la cabecera: ',' por defecto, ';' cuando el CSV se
// volvió a guardar con Excel en configuración regional española, o
// tabulador. Se cuenta fuera de comillas.
export function detectDelimiter(headerLine) {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let inQ = false
  for (const ch of String(headerLine || '')) {
    if (ch === '"') inQ = !inQ
    else if (!inQ && ch in counts) counts[ch]++
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';'
  if (counts['\t'] > counts[',']) return '\t'
  return ','
}

// Importe monetario de cualquier export:
//   "$19.00" → 19 · "$(168.00)" → -168 · "$(1,000.00)" → -1000
//   "-56,50 $" → -56.5 · "1.234,50" → 1234.5 · "1,234.50" → 1234.5
export function parseMoney(v) {
  let s = cleanCell(v).replace(/\u00a0/g, ' ').trim()
  if (!s) return 0
  const negative = s.includes('(') || /-\s*[\d$€.,]/.test(s) || /\d\s*-$/.test(s)
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return 0
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    // El separador que va último es el decimal
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // Solo comas: decimal si hay una única coma seguida de 1–2 dígitos
    const parts = s.split(',')
    s = (parts.length === 2 && parts[1].length <= 2) ? `${parts[0]}.${parts[1]}` : parts.join('')
  } else if ((s.match(/\./g) || []).length > 1) {
    // "1.234.567" → miles con punto
    s = s.replace(/\./g, '')
  }
  const num = parseFloat(s)
  if (isNaN(num)) return 0
  return negative ? -Math.abs(num) : num
}

// ¿Las fechas "NN/NN/YYYY" de este archivo vienen como DD/MM? Solo se
// puede saber si alguna tiene el primer número > 12 (p. ej. 25/09).
// Si ninguna lo tiene se mantiene MM/DD, el formato de Tradovate/US.
export function detectDayFirst(dateStrings) {
  for (const raw of dateStrings) {
    const m = String(raw || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}/)
    if (!m) continue
    if (Number(m[1]) > 12) return true
    if (Number(m[2]) > 12) return false
  }
  return false
}

// "MM/DD/YYYY HH:MM[:SS]" (o DD/MM si dayFirst) → "YYYY-MM-DD HH:MM:SS".
// Cualquier otro formato se devuelve tal cual.
export function normalizeDateTime(raw, dayFirst = false) {
  const s = cleanCell(raw)
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/)
  if (!m) return s
  let [, a, b, y, hh, mm, ss, ampm] = m
  const month = dayFirst ? b : a
  const day   = dayFirst ? a : b
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${y}-${pad(month)}-${pad(day)}`
  if (hh === undefined) return date
  let h = Number(hh)
  if (ampm) {
    const pm = ampm.toLowerCase() === 'pm'
    if (pm && h < 12) h += 12
    if (!pm && h === 12) h = 0
  }
  return `${date} ${pad(h)}:${mm}:${ss ?? '00'}`
}

export function cleanCell(v) {
  return String(v ?? '').replace(/^"|"$/g, '').trim()
}

export function normaliseHeader(h) {
  return cleanCell(h).toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ── Ayudantes para reportes exportados como HTML (cTrader, MT4/MT5
// terminal), en vez de CSV plano. Extraídos como función compartida
// porque los dos importadores necesitan lo mismo: limpiar el texto
// de una celda <td> (quitar tags/entidades HTML) y trocear una fila
// <tr>...</tr> en sus celdas. ──
export function htmlCellText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ')
    .replace(/\u00a0/g, ' ').replace(/\xa0/g, ' ')
    .replace(/\s+/g, ' ').trim()
}
export function getHtmlRowCells(rowHtml) {
  const cells = []
  const parts = rowHtml.split('</td>')
  for (const p of parts) {
    const idx = p.lastIndexOf('<td')
    if (idx < 0) continue
    const gt = p.indexOf('>', idx)
    if (gt >= 0) cells.push(htmlCellText(p.slice(gt + 1)))
  }
  return cells
}

export function toISODate(str) {
  if (!str) return new Date().toISOString().split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    let [m, d, y] = str.split(' ')[0].split('/')
    // Sin ambigüedad: si el primer número no puede ser un mes, es DD/MM
    if (Number(m) > 12) [m, d] = [d, m]
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return str.slice(0, 10)
}

// Fecha y hora completas "YYYY-MM-DDTHH:MM:SS" (sin zona) para agrupar
// parciales en operaciones (src/lib/operations.js). Acepta
// "2026-05-27 14:14:12", "2026.05.27 14:14:12", ISO con T y
// "MM/DD/YYYY HH:MM[:SS]" (los DD/MM ya llegan corregidos de
// finalizeImport). undefined si no trae hora.
export function toDateTime(str) {
  let s = cleanCell(str)
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(s)) s = normalizeDateTime(s)
  const m = s.match(/^(\d{4})[-.](\d{2})[-.](\d{2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return undefined
  const [, y, mo, d, hh, mm, ss] = m
  return `${y}-${mo}-${d}T${hh.padStart(2, '0')}:${mm}:${ss ?? '00'}`
}

export function toTime(str) {
  if (!str) return '09:00'
  const match = str.match(/(\d{2}:\d{2})/)
  return match ? match[1] : '09:00'
}

// ─────────────────────────────────────────────
//  NormalizedTrade — formato universal interno
//
//  Todos los importers devuelven NormalizedTrade[].
//  El dashboard NUNCA consume el CSV directamente.
// ─────────────────────────────────────────────

/**
 * @typedef {Object} NormalizedTrade
 * @property {string}  tradeId      - ID determinista único (no usa Date.now)
 * @property {string}  account      - ID de cuenta de la app (options.accountId)
 * @property {string}  source       - 'tradovate' | 'rithmic' | 'bulenox' | 'generic'
 * @property {string}  symbol       - Par normalizado: 'MNQ', 'NQ', 'EURUSD'…
 * @property {'long'|'short'} side  - Dirección de la operación
 * @property {number}  quantity     - Contratos / lotes totales
 * @property {string}  entryTime    - ISO timestamp de entrada
 * @property {string}  exitTime     - ISO timestamp de salida
 * @property {number}  entryPrice   - Precio de entrada (media ponderada si hay fills)
 * @property {number}  exitPrice    - Precio de salida (media ponderada si hay fills)
 * @property {number}  pnl          - PnL en $ (suma de todos los fills)
 * @property {number}  [fees]       - Comisiones en $ (si el broker las reporta)
 * @property {string}  [setup]      - Setup detectado o 'CSV Import'
 * @property {number}  [fills]      - Número de fills agrupados (>1 = scale out)
 */

// ─────────────────────────────────────────────
//  toAppTrade — NormalizedTrade → AppTrade
//
//  Convierte el formato universal al formato que
//  consume el store Zustand y el dashboard.
//  Esta es la ÚNICA función que conoce ambos formatos.
// ─────────────────────────────────────────────
export function toAppTrade(n, options = {}) {
  const date    = toISODate(n.entryTime)
  const time    = toTime(n.entryTime)
  const session = detectSession(n.entryTime)
  const rPnl    = calcR(n.pnl, options)
  const result  = n.pnl > 0 ? 'win' : n.pnl < 0 ? 'loss' : 'breakeven'

  return {
    // ── Identificación ──
    id:          n.tradeId,
    source:      n.source,

    // ── Temporal ──
    date,
    time,
    datetime:    `${date}T${time}`,
    exitTime:    toTime(n.exitTime) || time,
    // Fecha y hora completas de entrada y salida (con segundos y fecha
    // de cierre): las usa groupIntoOperations para juntar parciales.
    entryAt:     toDateTime(n.entryTime),
    exitAt:      toDateTime(n.exitTime),

    // ── Instrumento ──
    pair:        n.symbol,
    direction:   n.side === 'long' ? 'Long' : 'Short',

    // ── Setup / Sesión ──
    setup:       n.setup   ?? 'CSV Import',
    session,

    // ── Precios ──
    entryPrice:  parseFloat((n.entryPrice ?? 0).toFixed(5)),
    exitPrice:   parseFloat((n.exitPrice  ?? 0).toFixed(5)),
    stopLoss:    0,
    takeProfit:  0,

    // ── Métricas ──
    rrObjective: 1,
    rrActual:    Math.abs(rPnl),
    result,
    rPnl,
    dollarPnl:   n.pnl,
    qty:         n.quantity,
    // MFE/MAE reales (Sprint "TradingView trae Desviación favorable/
    // adversa ya calculada por su propio motor de backtesting" — no
    // es una estimación, TradingView SÍ tuvo el camino de precio
    // completo al calcularlo, solo exporta el resumen). Mismo
    // criterio de conversión $→R que ya usa el propio PnL (calcR),
    // para que sea comparable con lo que el usuario rellena a mano.
    // undefined si el importador no trae este dato — Historial.jsx
    // ya trata mfeR/maeR como opcionales.
    mfeR:        n.mfeDollar != null ? Math.abs(calcR(n.mfeDollar, options)) : undefined,
    maeR:        n.maeDollar != null ? Math.abs(calcR(n.maeDollar, options)) : undefined,

    // ── Meta ──
    fills:       n.fills,
    fees:        n.fees,
    riskPercent: options.riskPct || 1,
    rManual:     false,
    accountId:   n.account || options.accountId || 'acc-1',
    notes:       n.setup !== 'CSV Import'
      ? `${n.symbol} ${n.side} ${n.quantity}x | ${n.source}`
      : `${n.symbol} ${n.side} ${n.quantity}x | ${n.source}${n.fills > 1 ? ` (${n.fills} fills)` : ''}`,
    emotions:    '',
  }
}

// ─────────────────────────────────────────────
//  deduplicateAgainstExisting
//
//  Filtra trades ya importados. existingTrades debe venir ya
//  filtrado a la cuenta destino (lo hace finalizeImport): el mismo
//  CSV se puede importar en dos cuentas distintas.
//  Capa 1: por id (con y sin el prefijo de cuenta, para reconocer
//          imports hechos antes de que el id incluyera la cuenta)
//  Capa 2: por clave compuesta date|time|pair|entryPrice|pnl
//  Capa 3: por pair|qty|pnl|{precios} sin importar el orden de
//          entrada/salida (imports antiguos de Tradovate guardaban
//          entrada y salida invertidas en algunos trades)
// ─────────────────────────────────────────────
function priceSetKey(t) {
  const a = Number(t.entryPrice) || 0
  const b = Number(t.exitPrice)  || 0
  return `${t.pair}|${Number(t.qty) || 1}|${Number(t.dollarPnl) || 0}|${Math.min(a, b)}|${Math.max(a, b)}`
}

export function deduplicateAgainstExisting(appTrades, existingTrades = []) {
  const existingIds  = new Set(existingTrades.map(t => t.id))
  const existingKeys = new Set(
    existingTrades.map(t => `${t.date}|${t.time}|${t.pair}|${t.entryPrice}|${t.dollarPnl}`)
  )
  const existingPriceKeys = new Set(
    existingTrades.filter(t => t.entryPrice && t.exitPrice).map(priceSetKey)
  )
  return appTrades.filter(t =>
    !existingIds.has(t.id) &&
    !(t.sourceId && existingIds.has(t.sourceId)) &&
    !existingKeys.has(`${t.date}|${t.time}|${t.pair}|${t.entryPrice}|${t.dollarPnl}`) &&
    !(t.entryPrice && t.exitPrice && existingPriceKeys.has(priceSetKey(t)))
  )
}

// ─────────────────────────────────────────────
//  newWithdrawals
//
//  Retiros leídos del archivo que la cuenta todavía no tiene. Uno ya
//  guardado se reconoce por su id (mismo reporte importado otra vez) o,
//  si se cargó a mano en "Retiros", por la misma fecha e importe.
// ─────────────────────────────────────────────
export function newWithdrawals(found = [], existing = []) {
  const ids  = new Set(existing.map(w => w.id))
  const keys = new Set(existing.map(w => `${w.date}|${Math.round((Number(w.amount) || 0) * 100)}`))
  return found.filter(w => !ids.has(w.id) && !keys.has(`${w.date}|${Math.round(w.amount * 100)}`))
}
