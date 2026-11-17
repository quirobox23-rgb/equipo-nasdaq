// ─────────────────────────────────────────────
//  TRAILING DRAWDOWN ENGINE — Sprint 26.1
//
//  Única fuente de verdad del Drawdown para TODA la aplicación.
//  Modela el comportamiento real de una cuenta de fondeo con
//  Trailing Drawdown End Of Day (el límite de pérdida solo se mueve
//  al cierre del día, nunca baja, siempre acompaña el mayor balance
//  de cierre alcanzado).
//
//  Ningún otro módulo debe volver a calcular el Drawdown por su
//  cuenta: todos deben leer el resultado de computeDrawdown()
//  (directamente, o a través de accountMetrics.maxDrawdown en
//  config/blueprintMatchEngine.js).
//
//  Preparado para el futuro: la cuenta indica qué tipo de Drawdown
//  usa (`account.drawdownType`); el resto de la app solo lee el
//  resultado, sin conocer la implementación interna de cada tipo.
// ─────────────────────────────────────────────

import { tradeDollar } from '@/lib/tradeDollar'

export const DRAWDOWN_TYPES = {
  STATIC:        'static',        // límite fijo sobre el capital inicial, nunca se mueve
  TRAILING_EOD:  'trailing_eod',  // el modelo de DELTA: el límite acompaña el mayor balance de CIERRE de día
  TRAILING_LIVE: 'trailing_live', // reservado para cuando haya balance intradía en tiempo real
}

/**
 * Convierte el resultado de un trade a € / $, igual que ya hace el
 * resto de la app cuando no hay `dollarPnl` explícito (Portfolio,
 * Dashboard): usa el riesgo por operación configurado en la cuenta.
 */
function dollarOf(trade, riskPerTrade) {
  return tradeDollar(trade, riskPerTrade)
}

/**
 * Balance de cierre por día: suma acumulada de resultados en €/$
 * sobre el capital inicial, quedándose con el último valor de cada
 * día (los trades se ordenan cronológicamente antes de acumular).
 */
function buildDailyClosingBalances(trades, initialCapital, riskPerTrade) {
  const sorted = [...trades].sort((a, b) => {
    const ka = `${a.date || ''}T${a.time || ''}`
    const kb = `${b.date || ''}T${b.time || ''}`
    return ka.localeCompare(kb)
  })

  let running = initialCapital
  const byDay = new Map()
  sorted.forEach(t => {
    running += dollarOf(t, riskPerTrade)
    byDay.set(t.date, running)
  })

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, balance]) => ({ date, balance }))
}

const round2 = (n) => Math.round(n * 100) / 100
const round1 = (n) => Math.round(n * 10) / 10

/**
 * computeTrailingEodDrawdown — el modelo de DELTA.
 *
 * Ejemplo verificado (capital 50.000€, DD permitido 6%):
 *  día 1 cierre 53.000€ → Highest Closed Balance 53.000€, Floor 50.000€
 *  día 2 cierre 52.000€ → Highest Closed Balance sigue 53.000€, Floor sigue 50.000€
 *                          Drawdown consumido = 53.000 - 52.000 = 1.000€ = 2%
 *                          Drawdown restante = 6% - 2% = 4%
 */
function computeTrailingEodDrawdown(account, trades) {
  const initialCapital     = Number(account.size) || 0
  const drawdownAllowedPct = Number(account.maxDrawdown) || 0
  const buffer             = initialCapital * (drawdownAllowedPct / 100)

  const dailyBalances = buildDailyClosingBalances(trades, initialCapital, account.riskPerTrade)

  // Highest Closed Balance: nunca disminuye, empieza en el capital inicial.
  let highestClosedBalance = initialCapital
  dailyBalances.forEach(d => {
    if (d.balance > highestClosedBalance) highestClosedBalance = d.balance
  })

  // Trailing Floor: acompaña siempre el Highest Closed Balance, nunca baja.
  const trailingFloor = highestClosedBalance - buffer

  const currentBalance = dailyBalances.length
    ? dailyBalances[dailyBalances.length - 1].balance
    : initialCapital

  const drawdownConsumedDollar = Math.max(0, highestClosedBalance - currentBalance)
  const drawdownConsumedPct = initialCapital > 0
    ? round1((drawdownConsumedDollar / initialCapital) * 100)
    : 0
  const drawdownRemainingPct = Math.max(0, round1(drawdownAllowedPct - drawdownConsumedPct))
  const breached = dailyBalances.length > 0 && currentBalance <= trailingFloor

  return {
    type: DRAWDOWN_TYPES.TRAILING_EOD,
    initialCapital,
    drawdownAllowedPct,
    buffer: round2(buffer),
    highestClosedBalance: round2(highestClosedBalance),
    trailingFloor: round2(trailingFloor),
    currentBalance: round2(currentBalance),
    drawdownConsumedDollar: round2(drawdownConsumedDollar),
    drawdownConsumedPct,
    drawdownRemainingPct,
    breached,
  }
}

/**
 * computeStaticDrawdown — límite fijo sobre el capital inicial.
 * No hay Highest Closed Balance ni Trailing Floor: el suelo es
 * siempre el mismo, calculado una única vez.
 */
function computeStaticDrawdown(account, trades) {
  const initialCapital     = Number(account.size) || 0
  const drawdownAllowedPct = Number(account.maxDrawdown) || 0
  const floor               = initialCapital * (1 - drawdownAllowedPct / 100)

  const dailyBalances = buildDailyClosingBalances(trades, initialCapital, account.riskPerTrade)
  const currentBalance = dailyBalances.length
    ? dailyBalances[dailyBalances.length - 1].balance
    : initialCapital

  const drawdownConsumedDollar = Math.max(0, initialCapital - currentBalance)
  const drawdownConsumedPct = initialCapital > 0
    ? round1((drawdownConsumedDollar / initialCapital) * 100)
    : 0
  const drawdownRemainingPct = Math.max(0, round1(drawdownAllowedPct - drawdownConsumedPct))
  const breached = dailyBalances.length > 0 && currentBalance <= floor

  return {
    type: DRAWDOWN_TYPES.STATIC,
    initialCapital,
    drawdownAllowedPct,
    buffer: round2(initialCapital - floor),
    highestClosedBalance: initialCapital, // no aplica; se deja el capital inicial por coherencia de forma
    trailingFloor: round2(floor),
    currentBalance: round2(currentBalance),
    drawdownConsumedDollar: round2(drawdownConsumedDollar),
    drawdownConsumedPct,
    drawdownRemainingPct,
    breached,
  }
}

/**
 * computeDrawdown — punto de entrada único del motor.
 *
 * Recibe la cuenta (con `size`, `maxDrawdown`, `riskPerTrade` y,
 * opcionalmente, `drawdownType`) y sus trades, y devuelve siempre la
 * misma forma de objeto, sea cual sea el tipo de cuenta. El resto de
 * la aplicación NUNCA debe volver a calcular esto por su cuenta:
 * debe leer este resultado (normalmente a través de
 * accountMetrics.maxDrawdown, en blueprintMatchEngine.js).
 */
export function computeDrawdown(account, trades) {
  if (!account) return null
  const type = account.drawdownType || DRAWDOWN_TYPES.TRAILING_EOD

  switch (type) {
    case DRAWDOWN_TYPES.STATIC:
      return computeStaticDrawdown(account, trades || [])
    case DRAWDOWN_TYPES.TRAILING_LIVE:
      // Reservado: requiere balance intradía en tiempo real, que hoy
      // no existe en el modelo de datos. Hasta entonces se aproxima
      // con el mismo cálculo que Trailing EOD (más conservador que
      // no calcular nada), pero queda marcado como su propio tipo
      // para no mezclarlo con TRAILING_EOD el día que se implemente.
      return { ...computeTrailingEodDrawdown(account, trades || []), type: DRAWDOWN_TYPES.TRAILING_LIVE }
    case DRAWDOWN_TYPES.TRAILING_EOD:
    default:
      return computeTrailingEodDrawdown(account, trades || [])
  }
}
