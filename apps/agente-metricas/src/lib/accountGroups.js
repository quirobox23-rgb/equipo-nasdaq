// ─────────────────────────────────────────────
//  Agrupar cuentas por ciclo de compra y por Mapa (Portafolio,
//  Métricas, Calendario y Consistencia)
//
//  · Ciclo: el nombre que el usuario le puso a la cuenta ("Black
//    Friday", "Ciclo 1"…). Los crea el propio usuario escribiendo un
//    nombre nuevo en la cuenta; no se agrupa por fechas. Sin nombre =
//    "Sin ciclo".
//  · Mapa: el Mapa asignado a la cuenta (useAccountBlueprintStore,
//    { [accountId]: blueprintId }). Sin Mapa = "Sin mapa".
// ─────────────────────────────────────────────

import { sumTradeDollars, totalWithdrawn } from './tradeDollar.js'

export const NO_CYCLE = 'Sin ciclo'
export const NO_MAP = 'none'

/** Nombre del ciclo de la cuenta ('' si no tiene). */
export function cycleName(account) {
  return (account?.cycle || '').trim()
}

/** { label } del ciclo de una cuenta. */
export function cycleOf(account) {
  return { label: cycleName(account) || NO_CYCLE }
}

/** Nombres de ciclo ya usados en las cuentas, sin repetir, por orden alfabético. */
export function cycleNames(accounts) {
  const seen = new Map()
  for (const a of accounts || []) {
    const n = cycleName(a)
    if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
}

/** Ciclos presentes en las cuentas con cuántas tiene cada uno ("Sin ciclo" al final). */
export function cycleOptions(accounts) {
  const counts = new Map()
  for (const a of accounts || []) {
    const n = cycleName(a)
    const k = n.toLowerCase()
    counts.set(k, { label: counts.get(k)?.label || n || NO_CYCLE, count: (counts.get(k)?.count || 0) + 1 })
  }
  const named = cycleNames(accounts).map(n => counts.get(n.toLowerCase()))
  return counts.has('') ? [...named, counts.get('')] : named
}

/** Mapas asignados a las cuentas, con cuántas tiene cada uno ("Sin mapa" al final). */
export function mapOptions(accounts, assignments = {}, blueprints = []) {
  const counts = new Map()
  let none = 0
  for (const a of accounts || []) {
    const id = assignments[a.id]
    const bp = id && blueprints.find(b => b.id === id)
    if (!bp) { none++; continue }
    counts.set(id, { value: id, label: bp.name || bp.title || id, count: (counts.get(id)?.count || 0) + 1 })
  }
  const list = [...counts.values()].sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))
  return none ? [...list, { value: NO_MAP, label: 'Sin mapa', count: none }] : list
}

/**
 * ¿La cuenta entra en el ciclo y el Mapa elegidos? ('all' = sin filtro)
 * cycle: nombre del ciclo o NO_CYCLE · map: id del Mapa o NO_MAP
 */
export function accountInGroup(account, { cycle = 'all', map = 'all', assignments = {}, blueprints = [] } = {}) {
  if (cycle !== 'all' && cycleOf(account).label.toLowerCase() !== cycle.toLowerCase()) return false
  if (map === 'all') return true
  const id = assignments[account.id]
  const assigned = id && blueprints.some(b => b.id === id) ? id : null
  return map === NO_MAP ? !assigned : assigned === map
}

/**
 * Dinero de un grupo de cuentas: inversión (costo + activación), PnL de
 * sus trades, retiros y resultado (retirado − invertido). Lo usa
 * Inversión y retiros, en total y por ciclo.
 */
export function groupMoneySummary(accounts, trades) {
  let invested = 0, pnl = 0, withdrawn = 0, inProfit = 0, inLoss = 0
  const byStatus = { active: 0, approved: 0, lost: 0 }
  for (const a of accounts || []) {
    const p = sumTradeDollars((trades || []).filter(t => t.accountId === a.id), a.riskPerTrade)
    invested  += (Number(a.accountCost) || 0) + (Number(a.activationCost) || 0)
    withdrawn += totalWithdrawn(a)
    pnl       += p
    if (p > 0) inProfit++
    else if (p < 0) inLoss++
    if (byStatus[a.status] != null) byStatus[a.status]++
  }
  const net = withdrawn - invested
  const roi = invested > 0 ? Math.round((net / invested) * 1000) / 10 : null
  return { count: (accounts || []).length, invested, pnl, withdrawn, net, roi, inProfit, inLoss, byStatus }
}

/** groupMoneySummary de cada ciclo, en el mismo orden que cycleOptions. */
export function cycleMoneySummaries(accounts, trades) {
  return cycleOptions(accounts).map(c => ({
    cycle: c.label,
    ...groupMoneySummary((accounts || []).filter(a => cycleOf(a).label.toLowerCase() === c.label.toLowerCase()), trades),
  }))
}
