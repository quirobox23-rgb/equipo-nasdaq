// ─────────────────────────────────────────────
//  EDGELOG · Registro de firmas de formato (por columnas)
//
//  Punto único donde se declaran los formatos que se detectan por
//  ANÁLISIS DE COLUMNAS (no por nombre de archivo, no por texto
//  libre). Cada firma dice qué columnas normalizadas son
//  imprescindibles y cuáles son opcionales (suman confianza).
//
//  Los 4 formatos "legacy" (E2T, Tradovate, Rithmic, Bulenox) NO
//  viven aquí: siguen detectándose exactamente igual que siempre
//  (sus isXCSV originales, en csvParser.js) para no arriesgar nada
//  de lo que ya funciona. Esta es la capa nueva para formatos
//  añadidos a partir de ahora.
//
//  Añadir un formato nuevo desde este Sprint en adelante:
//    1. Crea src/importers/miFormatoImporter.js con
//       parseMiFormato(text, options) → NormalizedTrade[]
//       (mismo contrato que siempre — ver tradeNormalizer.js)
//    2. Añade una entrada aquí con sus columnas requeridas/opcionales
//    ← no toques csvParser.js, ni el modal, ni nada más
// ─────────────────────────────────────────────

import { normaliseHeader } from './tradeNormalizer.js'
import { parseTradeLocker } from './tradeLockerImporter.js'
import { parseNinjaTrader } from './ninjaTraderImporter.js'
import { parseMT5 } from './mt5Importer.js'
import { parseMT4 } from './mt4Importer.js'
import { parseFTMO } from './ftmoImporter.js'
import { parseTradingView } from './tradingViewImporter.js'
import { parseExness } from './exnessImporter.js'

export const FORMAT_SIGNATURES = [
  {
    id: 'exness',
    label: 'Exness',
    required: ['ticket', 'openingtimeutc', 'closingtimeutc', 'type', 'lots', 'symbol', 'profit'],
    optional: ['openingprice', 'closingprice', 'commission', 'swap', 'closereason'],
    parser: parseExness,
  },
  {
    id: 'ftmo',
    label: 'FTMO (MetriX)',
    // "price" aparece DUPLICADO (apertura/cierre) — lo resuelve el importer.
    required: ['ticket', 'open', 'close', 'type', 'volume', 'symbol', 'profit'],
    optional: ['price', 'sl', 'tp', 'swap', 'commissions', 'pips', 'tradedurationinseconds'],
    parser: parseFTMO,
  },
  {
    id: 'mt4',
    label: 'MetaTrader 4',
    // "price" aparece DUPLICADO en el export real de MT4 (apertura/
    // cierre) — no se usa como requerida, se resuelve por orden de
    // aparición en el importer.
    required: ['ticket', 'item', 'type', 'size'],
    optional: ['price', 'opentime', 'closetime', 'commission', 'taxes', 'swap', 'profit'],
    parser: parseMT4,
  },
  {
    id: 'tradingview',
    label: 'TradingView (Strategy Tester)',
    // "Trade number" + "Type" (Entry/Exit) es una combinación muy
    // específica de TradingView — no colisiona con ningún otro formato.
    required: ['tradenumber', 'type', 'dateandtime', 'netpnlusd'],
    optional: ['signal', 'priceusd', 'sizeqty', 'sizevalue', 'return', 'cumulativepnlusd'],
    parser: parseTradingView,
  },
  {
    // Mismo formato, pero con TradingView configurado en español (las
    // cabeceras vienen en español, no en inglés) — mismo parser
    // (parseTradingView ya reconoce ambos idiomas), firma aparte
    // porque el sistema de firmas exige coincidencia exacta por
    // columna, no admite alternativas de idioma dentro de un mismo
    // required[].
    id: 'tradingview',
    label: 'TradingView (Strategy Tester)',
    required: ['nmerodeoperacin', 'tipo', 'fechayhora', 'pygnetasusd'],
    optional: ['seal', 'preciousd', 'tamaocant', 'tamaodelaposicinvalor', 'rentabilidad', 'pygacumuladasusd'],
    parser: parseTradingView,
  },
  {
    id: 'tradelocker',
    label: 'TradeLocker',
    // Columnas normalizadas (minúsculas, sin espacios/acentos) que
    // DEBEN estar todas presentes para siquiera considerar este formato.
    required: ['opentime', 'closetime', 'symbol', 'side'],
    // Columnas que, si además están presentes, suben la confianza.
    optional: ['volume', 'openprice', 'closeprice', 'profit', 'swap', 'commission'],
    parser: parseTradeLocker,
  },
  {
    id: 'ninjatrader',
    label: 'NinjaTrader',
    required: ['instrument', 'entrytime', 'marketpos'],
    optional: ['exittime', 'qty', 'entryprice', 'exitprice', 'profit', 'commission', 'strategy'],
    parser: parseNinjaTrader,
  },
  {
    id: 'mt5',
    label: 'MetaTrader 5',
    // "price" y "time" aparecen DUPLICADOS en el export real de MT5
    // (apertura/cierre) — por eso no se usan como requeridas aquí,
    // el importer los resuelve por orden de aparición.
    required: ['position', 'symbol', 'type', 'volume'],
    optional: ['price', 'time', 'commission', 'swap', 'profit'],
    parser: parseMT5,
  },
]

// Confianza mínima para considerar el reconocimiento "seguro" y no
// mostrar el asistente de mapeo manual.
export const MIN_CONFIDENT_SCORE = 0.6

/**
 * Puntúa una firma contra el conjunto de cabeceras normalizadas de un CSV.
 * 0   → faltan columnas requeridas, formato descartado
 * 0.6 → cumple todas las requeridas, sin ninguna opcional
 * 1.0 → cumple todas las requeridas + todas las opcionales
 */
export function scoreSignature(normalizedHeaderSet, signature) {
  const reqHit = signature.required.filter(c => normalizedHeaderSet.has(c)).length
  if (reqHit < signature.required.length) return 0
  const optHit = signature.optional.filter(c => normalizedHeaderSet.has(c)).length
  const optRatio = signature.optional.length ? optHit / signature.optional.length : 0
  return 0.6 + 0.4 * optRatio
}

/**
 * Recorre el registro y devuelve la firma con mayor puntuación, si
 * supera MIN_CONFIDENT_SCORE. Si ninguna llega al umbral, null
 * (→ el llamador debe ofrecer el asistente de mapeo manual).
 */
export function detectFormatBySignature(rawHeaders) {
  const normalizedSet = new Set(rawHeaders.map(normaliseHeader).filter(Boolean))
  let best = null
  for (const sig of FORMAT_SIGNATURES) {
    const score = scoreSignature(normalizedSet, sig)
    if (score > 0 && (!best || score > best.score)) best = { ...sig, score }
  }
  if (!best || best.score < MIN_CONFIDENT_SCORE) return null
  return best
}