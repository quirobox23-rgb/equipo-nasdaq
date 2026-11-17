// ─────────────────────────────────────────────
//  Resultado en $ de un trade — ÚNICA fórmula para toda la app
//
//  Antes cada pantalla lo calculaba distinto (`dollarPnl || R×100`,
//  `dollarPnl ?? R×riesgo`, `dollarPnl ?? 0`…), así que un trade
//  manual con R pero sin $ (dollarPnl = 0) sumaba en la tarjeta de
//  Portafolio pero valía $0 en el balance y el drawdown.
//
//  · dollarPnl informado y ≠ 0 → ese importe (CSV, trades con $)
//  · si no, R × riesgo por trade de la cuenta (por defecto $100)
// ─────────────────────────────────────────────
export function tradeDollar(trade, riskPerTrade) {
  const dollar = Number(trade?.dollarPnl)
  if (Number.isFinite(dollar) && dollar !== 0) return dollar
  const r = Number(trade?.rPnl)
  if (Number.isFinite(r) && r !== 0) return r * (Number(riskPerTrade) || 100)
  return 0
}

/** Suma en $ de una lista de trades, redondeada a céntimos. */
export function sumTradeDollars(trades, riskPerTrade) {
  const total = (trades || []).reduce((s, t) => s + tradeDollar(t, riskPerTrade), 0)
  return Math.round(total * 100) / 100
}

/**
 * Total retirado de una cuenta (payouts registrados en "Retiros").
 * El balance real de la firma ya los descuenta; el PnL no.
 */
export function totalWithdrawn(account) {
  const total = (account?.withdrawals || []).reduce((s, w) => s + (Number(w.amount) || 0), 0)
  return Math.round(total * 100) / 100
}
