// ─────────────────────────────────────────────
//  BUSINESS ROI — datos y helpers (Sprint 17 → conectado en Sprint 17.5)
//
//  Este módulo es independiente de Metrix, Dashboard y Portfolio en
//  cuanto a UI: no comparte pantallas ni componentes de negocio con
//  ellos. Pero en DATOS, se conecta directamente a `accounts` (el
//  mismo store que usa Portfolio) para no duplicar información.
//
//  Toda la información financiera (coste de cuenta, coste de
//  activación, fechas, retiros) se introduce ÚNICAMENTE desde el
//  formulario de Nueva Cuenta / Editar Cuenta en Portfolio.jsx.
//  Business ROI es solo un panel de consulta: no escribe nada.
//
//  No analiza operaciones ni métricas de trading en ningún punto.
// ─────────────────────────────────────────────

// ── Periodos de evolución (Bloque 4) ───────────
// Independientes de PERIODS (dashboardHelpers.jsx), que es compartido
// con Metrix y usa otra granularidad. Business ROI define los suyos.
export const BUSINESS_PERIODS = [
  { value: '1W',  label: 'Semana' },
  { value: '1M',  label: 'Mes' },
  { value: '3M',  label: 'Trimestre' },
  { value: '6M',  label: 'Semestre' },
  { value: '1Y',  label: 'Año' },
  { value: 'ALL', label: 'Todo' },
]

const PERIOD_DAYS = { '1W': 7, '1M': 30, '3M': 90, '6M': 182, '1Y': 365 }

/** true si una fecha ISO ('YYYY-MM-DD') cae dentro del periodo seleccionado. */
function isWithinPeriod(dateStr, period) {
  if (!dateStr) return false
  if (period === 'ALL') return true
  const days = PERIOD_DAYS[period]
  if (!days) return true
  const from = new Date()
  from.setDate(from.getDate() - days)
  return new Date(dateStr) >= from
}

// ── Mock: único dato que todavía no existe en el modelo real ───
// Bankroll total disponible del trader (capital propio destinado al
// negocio). No se introduce todavía desde ningún formulario: es un
// valor mock a la espera de que el usuario pueda configurarlo.
export const MOCK_BANKROLL_TOTAL = 15000

/**
 * computeBusinessStats — deriva TODOS los indicadores de Business ROI
 * a partir de `accounts` (Portfolio): coste de compra, coste de
 * activación, fechas y retiros de cada cuenta. Ningún dato se duplica:
 * se lee siempre en tiempo real desde el mismo store que usa Portfolio.
 */
export function computeBusinessStats(accounts, period = 'ALL') {
  // ── Bloque 1: Inversión ──
  let totalInvested = 0
  let activationFees = 0

  accounts.forEach(a => {
    const accountCost    = Number(a.accountCost)    || 0
    const activationCost = Number(a.activationCost) || 0

    if (accountCost && isWithinPeriod(a.purchaseDate, period)) {
      totalInvested += accountCost
    }
    if (activationCost && isWithinPeriod(a.activationDate || a.purchaseDate, period)) {
      totalInvested += activationCost
      activationFees += activationCost
    }
  })

  const accountsBought = accounts.length
  const bankrollCommittedPct = MOCK_BANKROLL_TOTAL > 0
    ? Math.min(100, Math.round((totalInvested / MOCK_BANKROLL_TOTAL) * 100))
    : 0

  // ── Bloque 2: Estado del negocio (estado actual, no depende del periodo) ──
  const challenges = accounts.filter(a => a.type === 'Challenge')
  const funded     = accounts.filter(a => a.type === 'Funded')
  const business = {
    challengesActive:   challenges.filter(a => a.status === 'active').length,
    challengesApproved: challenges.filter(a => a.status === 'approved').length,
    challengesLost:     challenges.filter(a => a.status === 'lost').length,
    fundedActive:       funded.filter(a => a.status === 'active' || a.status === 'approved').length,
    fundedLost:         funded.filter(a => a.status === 'lost').length,
    fundedHistoric:     funded.length,
  }

  // ── Bloque 3: Retornos — de los retiros reales de cada cuenta ──
  const allWithdrawals = accounts.flatMap(a =>
    (a.withdrawals || []).map(w => ({ ...w, firm: a.firm }))
  )
  const periodWithdrawals = allWithdrawals.filter(w => isWithinPeriod(w.date, period))

  const totalWithdrawn = periodWithdrawals.reduce((s, w) => s + (Number(w.amount) || 0), 0)
  const payoutsCount = periodWithdrawals.length
  const avgPayout = payoutsCount ? Math.round(totalWithdrawn / payoutsCount) : 0
  const bestPayout = payoutsCount ? Math.max(...periodWithdrawals.map(w => Number(w.amount) || 0)) : 0
  const netProfit = totalWithdrawn - totalInvested
  const roi = totalInvested > 0 ? parseFloat(((netProfit / totalInvested) * 100).toFixed(1)) : 0

  // Retiros por cuenta/firma — agrupación real, ya no por coincidencia de texto
  const byFirm = [...new Set(accounts.map(a => a.firm))]
    .map(firm => {
      const firmWithdrawals = periodWithdrawals.filter(w => w.firm === firm)
      return {
        firm,
        total: firmWithdrawals.reduce((s, w) => s + (Number(w.amount) || 0), 0),
        count: firmWithdrawals.length,
      }
    })
    .filter(f => f.count > 0)

  // ── Evolución (para las gráficas) ──
  const events = []
  accounts.forEach(a => {
    if (a.accountCost && a.purchaseDate) {
      events.push({ label: a.purchaseDate, invested: Number(a.accountCost) || 0, recovered: 0 })
    }
    if (a.activationCost && (a.activationDate || a.purchaseDate)) {
      events.push({ label: a.activationDate || a.purchaseDate, invested: Number(a.activationCost) || 0, recovered: 0 })
    }
  })
  periodWithdrawals.forEach(w => {
    events.push({ label: w.date, invested: 0, recovered: Number(w.amount) || 0 })
  })
  const evolution = events
    .filter(e => isWithinPeriod(e.label, period))
    .sort((x, y) => x.label.localeCompare(y.label))

  return {
    period,
    investment: {
      totalInvested, activationFees, accountsBought,
      bankrollTotal: MOCK_BANKROLL_TOTAL, bankrollCommittedPct,
    },
    business,
    returns: {
      totalWithdrawn, payoutsCount, avgPayout, bestPayout, netProfit, roi, byFirm,
    },
    evolution,
  }
}
