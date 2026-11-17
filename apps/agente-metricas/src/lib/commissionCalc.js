// ─────────────────────────────────────────────
//  Comisión por contrato a partir del balance real de la plataforma
//
//  Cada firma cobra distinto (Apex ~1.04, FundedNext ~1.91 en micros…)
//  y muchos exports traen el PnL BRUTO. Con el cambio real del balance
//  en la plataforma se despeja la comisión:
//
//    comisión/contrato = (PnL sin la comisión de la app − cambio real) ÷ contratos
//
//  "Sin la comisión de la app" = grossPnl si la app ya la restó al
//  importar; si no, dollarPnl tal cual (incluye las comisiones que el
//  bróker ya informó en el archivo, que no se vuelven a contar).
// ─────────────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100

export function commissionBase(trades) {
  let pnl = 0, contracts = 0
  for (const t of trades || []) {
    const p = Number(t.grossPnl ?? t.dollarPnl)
    if (Number.isFinite(p)) pnl += p
    contracts += Math.abs(Number(t.qty)) || 1
  }
  return { pnl: round2(pnl), contracts }
}

/**
 * @returns {{ perContract:number, totalFees:number, pnl:number, contracts:number } | null}
 *          null si faltan datos o el resultado no tiene sentido (negativo o
 *          absurdo: suele ser que el balance de partida no era el correcto).
 */
export function impliedCommission(trades, balanceBefore, balanceAfter) {
  const before = parseFloat(balanceBefore), after = parseFloat(balanceAfter)
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  const { pnl, contracts } = commissionBase(trades)
  if (!contracts) return null
  const totalFees = round2(pnl - (after - before))
  const perContract = round2(totalFees / contracts)
  if (perContract < 0 || perContract > 20) return null
  return { perContract, totalFees, pnl, contracts }
}
