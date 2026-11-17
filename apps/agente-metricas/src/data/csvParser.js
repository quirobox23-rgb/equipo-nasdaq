// ─────────────────────────────────────────────
//  EDGELOG · CSV Parser (fachada pública)
//
//  API IDÉNTICO AL ANTERIOR para los formatos que ya funcionaban —
//  ningún componente existente necesita cambiarse ni se comporta
//  distinto para E2T / Tradovate / Rithmic / Bulenox / genérico.
//
//  Flujo (motor de importación — Sprint "motor de importación v2"):
//
//    1. DETECCIÓN
//       a) Cascada legacy (idéntica a como era antes, mismo orden,
//          mismas funciones isXCSV) → e2t/tradovate/rithmic/bulenox
//       b) Si nada de lo anterior reconoce el archivo: detección por
//          FIRMA DE COLUMNAS (formatSignatures.js) → tradelocker/
//          ninjatrader/mt5, y cualquier formato que se añada ahí en
//          el futuro sin tocar este archivo.
//       c) Si tampoco hay firma con confianza suficiente: el CSV se
//          considera "no reconocido" (analyzeCSV().confident = false)
//          y es el LLAMADOR (AccountImportCsvModal) quien decide
//          mostrar el asistente de mapeo manual en vez de forzar un
//          parseo genérico a ciegas.
//
//    2. NORMALIZACIÓN — todos los caminos (legacy, por firma, o
//       mapeo manual) producen NormalizedTrade[] y pasan por el
//       MISMO toAppTrade() de siempre. El modelo de datos de la app
//       no se toca ni se duplica.
//
//  Añadir un formato nuevo (a partir de este Sprint):
//    1. Crea src/importers/miFormatoImporter.js con
//       parseMiFormato(text, options) → NormalizedTrade[]
//    2. Registra su firma de columnas en formatSignatures.js
//    ← NO toques este archivo, ni el modal, ni el dashboard/store
// ─────────────────────────────────────────────

import { parseTradovate, isTradovateCSV } from '../importers/tradovateImporter.js'
import { parseRithmic,   isRithmicCSV   } from '../importers/rithmicImporter.js'
import { parseBulenox,   isBulenoxCSV   } from '../importers/bulenoxImporter.js'
import { parseE2T,       isE2TCSV       } from '../importers/e2tImporter.js'
import { parseInteractiveBrokers, isInteractiveBrokersCSV } from '../importers/ibImporter.js'
import { parseBacktestJournal, isBacktestJournalCSV } from '../importers/backtestJournalImporter.js'
import { parseTopstep,      isTopstepCSV     } from '../importers/topstepImporter.js'
import { parseCTrader,      isCTraderHTML    } from '../importers/ctraderImporter.js'
import { parseMT5Spanish,   isMT5SpanishCSV  } from '../importers/mt5SpanishImporter.js'
import { parseMT5HTML,      isMT5HTML        } from '../importers/mt5HtmlImporter.js'
import { parseQuantowerTrades, isQuantowerTradesCSV } from '../importers/quantowerImporter.js'
import { parseGeneric                   } from '../importers/genericImporter.js'
import { detectFormatBySignature }        from '../importers/formatSignatures.js'
import { parseWithMapping }               from '../importers/mappingEngine.js'
import {
  parseLine,
  detectDelimiter,
  toAppTrade,
  deduplicateAgainstExisting,
  newWithdrawals,
  DEFAULT_RISK_CONSTANT,
  calcR,
  normaliseSymbol,
  detectSession,
  detectDayFirst,
  normalizeDateTime,
} from '../importers/tradeNormalizer.js'

export { DEFAULT_RISK_CONSTANT, calcR, normaliseSymbol, detectSession }

export const FORMAT_LABELS = {
  e2t:         'E2T / Excel Export',
  tradovate:   'Tradovate',
  rithmic:     'Rithmic / Topstep',
  bulenox:     'Bulenox',
  tradelocker: 'TradeLocker',
  ninjatrader: 'NinjaTrader',
  mt5:         'MetaTrader 5',
  mt4:         'MetaTrader 4',
  ftmo:        'FTMO (MetriX)',
  exness:      'Exness',
  interactive_brokers: 'Interactive Brokers',
  backtest_journal: 'Backtesting (Trade History)',
  topstep:      'Topstep',
  ctrader:      'cTrader',
  mt5_es:       'MetaTrader 5 (español, CSV)',
  mt5_html:     'MetaTrader 5 (reporte HTML)',
  quantower_trades: 'Quantower (Trades)',
  tradingview: 'TradingView (Strategy Tester)',
  generic:     'CSV genérico',
  'manual-mapping': 'Mapeo manual',
}

// ── Cascada legacy — mismo orden de siempre. IB y el journal de
//    backtesting se detectan aquí (no por firma de columnas) porque
//    en ambos formatos la cabecera real NO está en la línea 1 del
//    archivo — el sistema de firmas solo puede leer la línea 1.
function detectFormatLegacy(text) {
  if (isE2TCSV(text))       return 'e2t'
  if (isTradovateCSV(text)) return 'tradovate'
  if (isRithmicCSV(text))   return 'rithmic'
  if (isBulenoxCSV(text))   return 'bulenox'
  if (isInteractiveBrokersCSV(text)) return 'interactive_brokers'
  if (isBacktestJournalCSV(text))    return 'backtest_journal'
  if (isTopstepCSV(text))            return 'topstep'
  if (isMT5SpanishCSV(text))         return 'mt5_es'
  if (isMT5HTML(text))               return 'mt5_html'
  if (isCTraderHTML(text))           return 'ctrader'
  if (isQuantowerTradesCSV(text))    return 'quantower_trades'
  return null
}

const PARSERS = {
  e2t:         parseE2T,
  tradovate:   parseTradovate,
  rithmic:     parseRithmic,
  bulenox:     parseBulenox,
  interactive_brokers: parseInteractiveBrokers,
  backtest_journal:    parseBacktestJournal,
  topstep:             parseTopstep,
  mt5_es:              parseMT5Spanish,
  mt5_html:            parseMT5HTML,
  quantower_trades:    parseQuantowerTrades,
  ctrader:             parseCTrader,
}

/** Extrae y parsea solo la primera línea (cabecera) del CSV. */
export function getCSVHeaders(text, delimiter = ',') {
  const firstLine = (text || '').replace(/^\uFEFF/, '').split(/\r?\n/).find(l => l.trim()) || ''
  return parseLine(firstLine, delimiter)
}

/**
 * Analiza un CSV SIN importar nada — decide si el reconocimiento del
 * formato es seguro (cascada legacy o firma con confianza suficiente)
 * o si hace falta el asistente de mapeo manual.
 */
export function analyzeCSV(text) {
  const headers = getCSVHeaders(text)

  const legacy = detectFormatLegacy(text)
  if (legacy) return { format: legacy, label: FORMAT_LABELS[legacy], confident: true, confidence: 100, headers }

  const bySignature = detectFormatBySignature(headers)
  if (bySignature) return {
    format: bySignature.id, label: bySignature.label, confident: true,
    confidence: Math.round(bySignature.score * 100), headers,
  }

  // No reconocido → asistente de mapeo. Si el CSV usa ';' o tabulador
  // (p. ej. re-guardado con Excel en español), las columnas que ve el
  // asistente se separan con ese delimitador.
  const delimiter = detectDelimiter(getCSVHeaders(text).join(','))
  const wizardHeaders = delimiter === ',' ? headers : getCSVHeaders(text, delimiter)
  return { format: null, label: null, confident: false, confidence: 0, headers: wizardHeaders }
}

// ── Paso común a los 3 caminos (legacy / firma / mapeo manual) ───
//
//  toAppTrade() se llama fila a fila con try/catch: una fila con un
//  dato corrupto (fecha ilegible, número no numérico, columna que
//  faltaba) ya NO tira todo el import — se descarta esa fila, se
//  registra en rowErrors, y el resto se importa igual. Antes, un
//  .map() sin protección hacía que un solo error de una fila abortara
//  el archivo completo sin dar ninguna pista de cuál ni por qué.
function finalizeImport(normalized, format, options, stats, confidence = 100) {
  const rowErrors = []
  const appTrades = []
  // Fechas DD/MM/YYYY (MetaTrader, TradeLocker en Europa/LatAm): fila a
  // fila solo se reconocen cuando el día es > 12, y el resto (08/10 →
  // 8 de octubre) se leía como MM/DD, desordenando la curva de capital.
  // Se decide una vez para todo el archivo mirando todas las fechas.
  if (detectDayFirst(normalized.flatMap(t => [t.entryTime, t.exitTime]))) {
    const fix = (v) => (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(String(v || '').trim()) ? normalizeDateTime(v, true) : v)
    normalized = normalized.map(t => ({ ...t, entryTime: fix(t.entryTime), exitTime: fix(t.exitTime) }))
  }
  // Comisión por contrato configurada en la cuenta: muchos exports
  // (p. ej. el Performance de Tradovate) traen el PnL BRUTO, sin
  // comisiones, y el balance real de la firma sí las descuenta. Solo
  // se aplica si el bróker no informó ya las comisiones del trade.
  // Si el archivo ya informa comisiones en alguna fila (FTMO, MT5…),
  // el bróker las está declarando: una fila con 0 es que no tuvo, no
  // que falte — no se añade la de la cuenta a ninguna.
  const fileHasFees = normalized.some(t => t.fees > 0)
  const commissionPerContract = fileHasFees ? 0 : (parseFloat(options.commissionPerContract) || 0)
  const round2 = (v) => Math.round(v * 100) / 100
  normalized.forEach((raw, i) => {
    try {
      let n = raw
      if (commissionPerContract > 0 && !(raw.fees > 0)) {
        const fee = round2(commissionPerContract * (Math.abs(raw.quantity) || 1))
        n = { ...raw, grossPnl: raw.pnl, pnl: round2((Number(raw.pnl) || 0) - fee), fees: fee }
      }
      const t = toAppTrade(n, options)
      if (n.grossPnl !== undefined) t.grossPnl = n.grossPnl
      // El id del trade es la clave primaria en Supabase (global, no
      // por usuario): se prefija con la cuenta para que el mismo CSV
      // importado en otra cuenta, o por otro usuario, no choque con la
      // fila ya existente y se descarte en silencio al sincronizar.
      if (options.accountId && t.id && !String(t.id).startsWith(`${options.accountId}__`)) {
        t.sourceId = t.id
        t.id = `${options.accountId}__${t.id}`
      }
      appTrades.push(t)
    } catch (err) {
      rowErrors.push({ row: i + 1, message: err?.message || 'Fila no reconocida', raw })
    }
  })

  // Solo cuentan como duplicados los trades de la MISMA cuenta
  const existing   = (options.existingTrades ?? []).filter(t =>
    !options.accountId || t.accountId === options.accountId
  )
  const deduped    = deduplicateAgainstExisting(appTrades, existing)
  const duplicates = appTrades.length - deduped.length
  // Trades ya importados antes de guardar la fecha y hora completas
  // (entryAt/exitAt): al reimportar el mismo archivo se completan, sin
  // duplicar nada, para poder agrupar sus parciales en operaciones.
  const backfill = completeExistingTimes(appTrades, deduped, existing)
  // Retiros que trae el archivo (reporte HTML de MT5) y la cuenta aún
  // no tiene registrados
  const withdrawals = newWithdrawals(stats.withdrawals, options.existingWithdrawals)

  const riskAmount = options.mode === 'account' && options.balance > 0
    ? options.balance * (options.riskPct / 100)
    : (parseFloat(options.riskConstant) || DEFAULT_RISK_CONSTANT)

  if (appTrades.length > 0) {
    const s = deduped[0] ?? appTrades[0]
    console.log('[AgenteMetricas] CSV Import:', {
      format,
      total:      appTrades.length,
      imported:   deduped.length,
      duplicates,
      openIgnored: stats.openIgnored || 0,
      riskAmount: `$${riskAmount}`,
      sample: s ? {
        pair: s.pair, dollarPnl: s.dollarPnl, rPnl: s.rPnl,
        formula: `$${s.dollarPnl} ÷ $${riskAmount} = ${s.rPnl}R`,
      } : null,
    })
  }

  if (rowErrors.length > 0) {
    console.warn(`[AgenteMetricas] CSV Import: ${rowErrors.length} fila(s) descartada(s) por error de parseo`, rowErrors)
  }

  return {
    trades: deduped,
    format,
    confidence,
    label: FORMAT_LABELS[format] || format,
    count: deduped.length,
    duplicates,
    openIgnored: stats.openIgnored || 0,
    rowErrors,
    withdrawals,
    backfill,
  }
}

function completeExistingTimes(appTrades, deduped, existing) {
  const fresh = new Set(deduped)
  const byId  = new Map(existing.map(t => [t.id, t]))
  const byKey = new Map(existing.map(t => [`${t.date}|${t.time}|${t.pair}|${t.entryPrice}|${t.dollarPnl}`, t]))
  const out = []
  const seen = new Set()
  for (const t of appTrades) {
    if (fresh.has(t) || !t.entryAt || !t.exitAt) continue
    const old = byId.get(t.id) || (t.sourceId && byId.get(t.sourceId))
      || byKey.get(`${t.date}|${t.time}|${t.pair}|${t.entryPrice}|${t.dollarPnl}`)
    if (!old || seen.has(old.id) || (old.entryAt && old.exitAt)) continue
    seen.add(old.id)
    out.push({ id: old.id, patch: { entryAt: t.entryAt, exitAt: t.exitAt } })
  }
  return out
}

/**
 * Punto de entrada de siempre. Comportamiento IDÉNTICO al anterior
 * para los 4 formatos legacy (mismo orden de detección, mismos
 * parsers). Si ninguno de esos reconoce el archivo, intenta ahora
 * las firmas por columnas (tradelocker/ninjatrader/mt5); si tampoco
 * hay match, cae al parser genérico — igual que se comportaba antes
 * cuando no reconocía nada (comportamiento de red de seguridad, no
 * es el camino recomendado: el modal debería haber usado analyzeCSV()
 * y, de no ser 'confident', ofrecer el asistente de mapeo en vez de
 * llamar aquí directamente).
 */
export function parseCSV(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('El archivo está vacío.')
  }

  const stats = options.stats || {}
  const opts  = { ...options, stats }

  let format = detectFormatLegacy(text)
  let parser = format ? PARSERS[format] : null
  let confidence = format ? 100 : 0

  if (!parser) {
    const bySignature = detectFormatBySignature(getCSVHeaders(text))
    if (bySignature) { format = bySignature.id; parser = bySignature.parser; confidence = Math.round(bySignature.score * 100) }
  }

  if (!parser) { format = 'generic'; parser = parseGeneric; confidence = 0 }

  let normalized
  try {
    normalized = parser(text, opts)
  } catch (err) {
    // Fallo estructural del parser (no fila a fila): columnas que no
    // encajan con el formato detectado, separador inesperado, etc.
    // Antes esto reventaba sin contexto útil para el usuario.
    throw new Error(
      `No se pudo interpretar el archivo como ${FORMAT_LABELS[format] || format}. ` +
      `Verificá que el CSV corresponde a ese bróker/plataforma, o usá el mapeo manual. (${err?.message || 'error desconocido'})`
    )
  }

  if (!Array.isArray(normalized) || normalized.length === 0) {
    throw new Error(`No se encontraron operaciones válidas en el archivo (formato detectado: ${FORMAT_LABELS[format] || format}).`)
  }

  return finalizeImport(normalized, format, opts, stats, confidence)
}

/**
 * Camino del asistente de mapeo manual / formato aprendido. Mismo
 * resultado final que parseCSV() ({ trades, format, count,
 * duplicates, openIgnored }), pero construyendo NormalizedTrade[] a
 * partir de un mapeo columna→campo en vez de un importer específico.
 */
export function parseCSVWithMapping(text, mapping, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('El archivo está vacío.')
  }

  const stats = options.stats || {}
  const opts  = { ...options, stats }

  let normalized
  try {
    normalized = parseWithMapping(text, mapping, opts)
  } catch (err) {
    throw new Error(`No se pudo aplicar el mapeo de columnas al archivo. (${err?.message || 'error desconocido'})`)
  }

  if (!Array.isArray(normalized) || normalized.length === 0) {
    throw new Error('No se encontraron operaciones válidas con el mapeo de columnas indicado.')
  }

  return finalizeImport(normalized, 'manual-mapping', opts, stats)
}