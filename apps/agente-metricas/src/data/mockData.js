// ─────────────────────────────────────────────
//  EDGELOG · Mock Data
//  All seed data lives here. Replace with API
//  calls or Supabase queries later.
// ─────────────────────────────────────────────

// ── MULTI-EXIT HELPER ─────────────────────────
// Calcula rPnl, dollarPnl y result a partir de un array de exits
// exits: [{ price, qty, label }]  (label: 'TP1'|'TP2'|'Runner'|'SL'|...)
export function calcTradeFromExits(trade, exits) {
  if (!exits || exits.length === 0) return trade
  const entry   = parseFloat(trade.entryPrice) || 0
  const sl      = parseFloat(trade.stopLoss)   || 0
  const slDist  = sl > 0 ? Math.abs(entry - sl) : 0
  const isLong  = trade.direction !== 'Short'
  const totalQty = exits.reduce((s, e) => s + (parseFloat(e.qty) || 0), 0)

  let totalDollar = 0
  let totalR      = 0

  exits.forEach(ex => {
    const exitPrice = parseFloat(ex.price) || 0
    const qty       = parseFloat(ex.qty)   || 0
    const priceDiff = isLong ? exitPrice - entry : entry - exitPrice
    const dollar    = priceDiff * qty
    totalDollar    += dollar
    if (slDist > 0) totalR += (priceDiff / slDist) * (qty / totalQty)
  })

  const result = totalDollar > 0 ? 'win' : totalDollar < 0 ? 'loss' : 'breakeven'
  return {
    ...trade,
    exits,
    totalQty,
    dollarPnl: parseFloat(totalDollar.toFixed(2)),
    rPnl:      parseFloat(totalR.toFixed(2)),
    rrActual:  parseFloat(Math.abs(totalR).toFixed(2)),
    result,
    multiExit: true,
  }
}

export const SETUPS = [
  'London Breakout',
  'NY Open Reversal',
  'OTE Retracement',
  'Breaker Block',
  'FVG Fill',
  'CHoCH',
  'Order Block',
]

export const PAIRS = ['EURUSD', 'GBPUSD', 'NQ', 'ES', 'USDJPY', 'GBPJPY', 'BTC', 'XAUUSD']
export const SESSIONS = ['London', 'NY', 'Asian', 'London/NY Overlap']
// Tipos de cuenta estandarizados
export const ACCOUNT_TYPES    = ['Challenge', 'Funded', 'Personal']
// Estados de cuenta estandarizados
export const ACCOUNT_STATUSES = ['active', 'approved', 'lost']
// Migración de valores legacy
export function migrateAccountType(type) {
  if (type === 'Live') return 'Funded'
  return type ?? 'Challenge'
}
export function migrateAccountStatus(status) {
  if (status === 'funded')   return 'approved'
  if (status === 'personal') return 'active'
  return status ?? 'active'
}

// ── ACCOUNTS ──────────────────────────────────
export const mockAccounts = [
  {
    id: 'acc-1',
    firm: 'FTMO',
    type: 'Challenge',
    phase: 'Phase 1',
    size: 100_000,
    currency: 'USD',
    profitTarget: 10,
    maxDrawdown: 10,
    maxDailyDD: 5,
    currentProfit: 3.2,
    currentDD: -1.1,
    status: 'active',
    startDate: '2025-04-01',
  },
  {
    id: 'acc-2',
    firm: 'MyFundedFX',
    type: 'Challenge',
    phase: 'Phase 2',
    size: 50_000,
    currency: 'USD',
    profitTarget: 10,
    maxDrawdown: 10,
    maxDailyDD: 5,
    currentProfit: 7.8,
    currentDD: -0.8,
    status: 'active',
    startDate: '2025-03-15',
  },
  {
    id: 'acc-3',
    firm: 'FTMO',
    type: 'Funded',
    phase: 'Funded',
    size: 200_000,
    currency: 'USD',
    profitTarget: null,
    maxDrawdown: 10,
    maxDailyDD: 5,
    currentProfit: 12.4,
    currentDD: -2.3,
    status: 'approved',
    startDate: '2025-01-10',
  },
  {
    id: 'acc-4',
    firm: 'IC Markets',
    type: 'Personal',
    phase: 'Personal',
    size: 5_000,
    currency: 'USD',
    profitTarget: null,
    maxDrawdown: null,
    maxDailyDD: null,
    currentProfit: 8.1,
    currentDD: -4.2,
    status: 'active',
    startDate: '2024-09-01',
  },
]

// ── TRADES ────────────────────────────────────
function makeTrade(id, overrides = {}) {
  const pairs   = PAIRS
  const setups  = SETUPS
  const sessions= SESSIONS
  const pair    = pairs[id % pairs.length]
  const setup   = setups[id % setups.length]
  const session = sessions[id % sessions.length]
  const dir     = id % 3 === 0 ? 'Short' : 'Long'
  const win     = Math.sin(id * 1.7) > -0.2  // deterministic, ~62% win rate
  const r       = win
    ? parseFloat((1 + (id % 5) * 0.4).toFixed(1))
    : parseFloat(-(0.5 + (id % 3) * 0.3).toFixed(1))

  const day   = 1 + (id % 28)
  const month = id < 30 ? '04' : id < 60 ? '03' : '02'
  const date  = `2025-${month}-${String(day).padStart(2, '0')}`
  const hour  = 8 + (id % 8)
  const min   = (id * 7) % 60
  const time  = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`

  const entry = 1.08 + (id % 20) * 0.001
  const slPips = 15 + (id % 20)
  const sl    = dir === 'Long' ? entry - slPips * 0.0001 : entry + slPips * 0.0001
  const rrObj = 1.5 + (id % 5) * 0.3
  const tp    = dir === 'Long' ? entry + slPips * rrObj * 0.0001 : entry - slPips * rrObj * 0.0001

  return {
    id: `trade-${id}`,
    accountId: id % 3 === 0 ? 'acc-3' : id % 2 === 0 ? 'acc-1' : 'acc-2',
    date,
    time,
    datetime: `${date}T${time}`,
    pair,
    direction: dir,
    setup,
    session,
    entryPrice: parseFloat(entry.toFixed(5)),
    stopLoss: parseFloat(sl.toFixed(5)),
    takeProfit: parseFloat(tp.toFixed(5)),
    rrObjective: parseFloat(rrObj.toFixed(1)),
    rrActual: parseFloat(Math.abs(r).toFixed(1)),
    result: win ? 'win' : (id % 15 === 0 ? 'breakeven' : 'loss'),
    rPnl: r,
    dollarPnl: r * 100,       // assume 1R = $100 on this account
    riskPercent: 1,
    notes: '',
    screenshot: null,
    emotions: win ? 'focused' : 'anxious',
    ...overrides,
  }
}

export const mockTrades = [
  ...Array.from({ length: 132 }, (_, i) => makeTrade(i + 1)),
  // ── Ejemplos de multi-exit (scale out) ──────
  calcTradeFromExits({
    id: 'trade-me-1', accountId: 'acc-3',
    date: '2025-04-18', time: '09:15', datetime: '2025-04-18T09:15',
    pair: 'NQ', direction: 'Long', setup: 'London Breakout', session: 'London',
    entryPrice: 19500, stopLoss: 19450, takeProfit: 19620,
    rrObjective: 2.4, riskPercent: 1, notes: 'Scale out en 3 fases — runner dejado correr',
    totalQty: 10, multiExit: true,
  }, [
    { price: 19530, qty: 4, label: 'TP1' },
    { price: 19570, qty: 3, label: 'TP2' },
    { price: 19615, qty: 3, label: 'Runner' },
  ]),
  calcTradeFromExits({
    id: 'trade-me-2', accountId: 'acc-1',
    date: '2025-04-21', time: '14:30', datetime: '2025-04-21T14:30',
    pair: 'EURUSD', direction: 'Short', setup: 'NY Open Reversal', session: 'NY',
    entryPrice: 1.0920, stopLoss: 1.0950, takeProfit: 1.0860,
    rrObjective: 2.0, riskPercent: 1, notes: '2 salidas parciales + runner perdido',
    totalQty: 6, multiExit: true,
  }, [
    { price: 1.0900, qty: 2, label: 'TP1' },
    { price: 1.0880, qty: 2, label: 'TP2' },
    { price: 1.0930, qty: 2, label: 'SL Runner' },
  ]),
  calcTradeFromExits({
    id: 'trade-me-3', accountId: 'acc-2',
    date: '2025-04-22', time: '10:00', datetime: '2025-04-22T10:00',
    pair: 'XAUUSD', direction: 'Long', setup: 'OTE Retracement', session: 'London',
    entryPrice: 2320, stopLoss: 2308, takeProfit: 2356,
    rrObjective: 3.0, riskPercent: 1, notes: 'Solo 1R en TP1, runner a BE',
    totalQty: 4, multiExit: true,
  }, [
    { price: 2332, qty: 2, label: 'TP1' },
    { price: 2320, qty: 2, label: 'BE Runner' },
  ]),
]

// ── WEEKLY SUMMARY ────────────────────────────
export const mockWeekly = {
  weekLabel: '14 — 18 Abril 2025',
  pnlR: 4.8,
  pnlPrev: 2.7,
  consistency: 72,
  daysOutOfPlan: 1,
  outOfPlanDays: ['Jueves'],
  overtrading: 2,
  trades: 14,
  wins: 8,
  losses: 5,
  breakevens: 1,
  disciplineScore: 7.5,
  dailyPnl: [
    { day: 'Lun', r: 2.2 },
    { day: 'Mar', r: -0.8 },
    { day: 'Mié', r: 1.5 },
    { day: 'Jue', r: -1.2 },
    { day: 'Vie', r: 3.1 },
  ],
  checklistItems: [
    { id: 'c1', text: 'Respetaste el max daily loss',           done: true },
    { id: 'c2', text: 'SL definido antes de entrar',            done: true },
    { id: 'c3', text: 'No operaste noticias de alto impacto',   done: false },
    { id: 'c4', text: 'Win rate > 60% objetivo semanal',        done: false },
  ],
  weekTrades: mockTrades.slice(0, 14),
}

// ── DASHBOARD STATS ───────────────────────────
export const mockStats = {
  expectancy: 0.82,
  winRate: 61.4,
  totalTrades: 132,
  profitFactor: 2.14,
  maxDrawdown: -3.8,
  avgWin: 1.8,
  avgLoss: -0.9,
  sharpe: 1.87,
  maxConsecLoss: 3,
  avgHoldingMin: 38,
  bestSession: 'London',
  equityCurve: (() => {
    let eq = 10000
    return Array.from({ length: 60 }, (_, i) => {
      eq += (Math.sin(i * 0.4) * 150 + 80)
      return { i, value: Math.round(eq) }
    })
  })(),
  bySetup: [
    { setup: 'London Breakout', win: 28, loss: 12 },
    { setup: 'NY Open Reversal', win: 22, loss: 8  },
    { setup: 'OTE Retracement', win: 18, loss: 10  },
    { setup: 'FVG Fill',        win: 13, loss: 15  },
    { setup: 'CHoCH',           win: 10, loss: 6   },
  ],
  byWeekday: [
    { day: 'Lun', r: 2.1 },
    { day: 'Mar', r: -0.4 },
    { day: 'Mié', r: 1.8 },
    { day: 'Jue', r: -1.1 },
    { day: 'Vie', r: 2.4 },
  ],
}

// ── CASHFLOW ──────────────────────────────────
export const mockCashflow = [
  { id: 'cf-1', date: 'Sep 2024', type: 'investment', label: 'Challenge FTMO $100K Phase 1',  amount: -550,  accumulated: -550  },
  { id: 'cf-2', date: 'Sep 2024', type: 'investment', label: 'Challenge MyFundedFX $50K',      amount: -300,  accumulated: -850  },
  { id: 'cf-3', date: 'Oct 2024', type: 'payout',     label: 'FTMO Profit Split 80%',          amount: 1200,  accumulated: 350   },
  { id: 'cf-4', date: 'Nov 2024', type: 'investment', label: 'Challenge FTMO $200K',           amount: -1100, accumulated: -750  },
  { id: 'cf-5', date: 'Dic 2024', type: 'payout',     label: 'MyFundedFX Payout',              amount: 850,   accumulated: 100   },
  { id: 'cf-6', date: 'Ene 2025', type: 'payout',     label: 'FTMO Funded Account Payout',     amount: 1600,  accumulated: 1700  },
  { id: 'cf-7', date: 'Feb 2025', type: 'payout',     label: 'FTMO Profit Split',               amount: 1800,  accumulated: 3500  },
  { id: 'cf-8', date: 'Mar 2025', type: 'expense',    label: 'Suscripción TradingView Pro',     amount: -150,  accumulated: 3350  },
  { id: 'cf-9', date: 'Abr 2025', type: 'payout',     label: 'FTMO Funded Payout',              amount: 1400,  accumulated: 4750  },
]

// ── PRE-TRADE CHECKLIST ───────────────────────
export const PRE_TRADE_ITEMS = [
  { id: 'pt1', text: 'Revisé el calendario económico (noticias clave del día)' },
  { id: 'pt2', text: 'Analicé el contexto de los pares a operar (HTF)' },
  { id: 'pt3', text: 'Definí los niveles clave (soporte/resistencia, POI)' },
  { id: 'pt4', text: 'Dormir >7h esta noche' },
  { id: 'pt5', text: 'Desayuné y estoy físicamente bien' },
  { id: 'pt6', text: 'No tengo estrés emocional externo hoy' },
  { id: 'pt7', text: 'Tengo el plan trazado (condición de entrada)' },
  { id: 'pt8', text: 'Acepto que puedo perder este trade' },
]

// ── AI MENTOR ─────────────────────────────────
export const mockAiErrors = [
  { id: 'e1', severity: 'high',   text: 'Sobreoperación en sesión NY (Mar 15 Abr) — 5 trades vs máximo 3' },
  { id: 'e2', severity: 'medium', text: 'Trades tomados en zonas sin confluencia suficiente (4 casos)' },
  { id: 'e3', severity: 'medium', text: 'Moviste el SL a BE demasiado pronto — cortaste 3 winners' },
  { id: 'e4', severity: 'high',   text: 'Operaste 1h después de noticias de alto impacto (NFP)' },
]

export const mockAiPatterns = [
  { id: 'p1', text: 'London Breakout: 78% win rate en 9 trades → tu setup más consistente' },
  { id: 'p2', text: 'Mejor rendimiento entre 08:00-10:00 UTC → zona horaria óptima' },
  { id: 'p3', text: 'Consistencia mejorada semana a semana (+12% vs mes anterior)' },
  { id: 'p4', text: 'Profit factor >2.0 cuando respetas el plan pre-trade' },
]
