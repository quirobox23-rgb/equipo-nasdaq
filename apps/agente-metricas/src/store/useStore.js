// ─────────────────────────────────────────────
//  EDGELOG · Global Store (Zustand)
// ─────────────────────────────────────────────

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import {
  mockTrades,
  mockAccounts,
  mockCashflow,
  PRE_TRADE_ITEMS,
  SETUPS,
  migrateAccountType,
  migrateAccountStatus,
  calcTradeFromExits,
} from '@/data/mockData'
import { hasFeature, accountLimitFor, tradeLimitFor, csvTradesLimitFor } from '@/config/features'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useAuthStore } from '@/store/useAuthStore'

// ─────────────────────────────────────────────
//  SUPABASE SYNC HELPERS
//
//  Los objetos Trade/Account que usa el resto de la app (páginas,
//  motores de métricas) tienen forma libre — muchos campos, no todos
//  siempre presentes. En vez de forzar una columna por campo (que
//  obligaría a tocar decenas de páginas), guardamos el objeto
//  completo en la columna jsonb `data` y espejamos en columnas
//  propias solo lo que sirve para RLS/índices/consultas. Al leer,
//  reconstruimos el objeto tal cual lo esperaba la app.
// ─────────────────────────────────────────────
function currentUserId() {
  return useAuthStore.getState().user?.id ?? null
}

function tradeToRow(trade, userId) {
  return {
    id:         trade.id,
    user_id:    userId,
    account_id: trade.accountId ?? null,
    date:       trade.date ?? null,
    time:       trade.time ?? null,
    pair:       trade.pair ?? null,
    direction:  trade.direction ?? null,
    result:     trade.result ?? null,
    r_pnl:      trade.rPnl ?? null,
    dollar_pnl: trade.dollarPnl ?? null,
    setup:      trade.setup ?? null,
    notes:      trade.notes ?? null,
    data:       trade,
  }
}
function rowToTrade(row) {
  return { ...row.data, id: row.id, accountId: row.account_id }
}

function accountToRow(account, userId) {
  return {
    id:               account.id,
    user_id:          userId,
    name:             account.name ?? '',
    broker:           account.broker ?? null,
    type:             account.type ?? null,
    status:           account.status ?? null,
    initial_capital:  account.initialCapital ?? null,
    currency:         account.currency ?? 'USD',
    drawdown_type:    account.drawdownType ?? 'trailing_eod',
    data:             account,
  }
}
function rowToAccount(row) {
  return { ...row.data, id: row.id }
}

// Si falla la escritura la app sigue funcionando con el estado local
// (no queremos que un fallo de red tire la UI), pero el error YA NO es
// silencioso: se guarda en `syncError` y AppShell lo muestra, porque lo
// que el servidor rechaza (límite del plan, permisos…) desaparece al
// recargar y el usuario tiene que saberlo.
const SYNC_LABELS = { trades: 'la operación', accounts: 'la cuenta' }
function reportSyncError(table, action, error) {
  console.error(`[Sync] Error ${action} en ${table}:`, error.message)
  const what = SYNC_LABELS[table] || 'los datos'
  useStore.setState({
    syncError: {
      text: `No se pudo ${action === 'guardando' ? 'guardar' : 'borrar'} ${what} en tu cuenta: ${error.message}. Lo verás ahora, pero no seguirá ahí al recargar.`,
      at: Date.now(),
    },
  })
}
async function syncUpsert(table, row) {
  if (!isSupabaseConfigured || !row.user_id) return
  const { error } = await supabase.from(table).upsert(row)
  if (error) reportSyncError(table, 'guardando', error)
}
async function syncDelete(table, id) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) reportSyncError(table, 'borrando', error)
}

function migrateAccounts(accounts) {
  return accounts.map(a => ({
    ...a,
    type:   migrateAccountType(a.type),
    status: migrateAccountStatus(a.status),
  }))
}

const today = new Date().toISOString().split('T')[0]

// Seed setups from existing SETUPS array
const seedSetups = SETUPS.map((name, i) => ({
  id:          `setup-${i + 1}`,
  name,
  description: '',
  createdAt:   today,
}))

// ─────────────────────────────────────────────
//  TRADES SLICE
// ─────────────────────────────────────────────
const tradesSlice = (set, get) => ({
  trades: mockTrades,

  // Carga los trades reales del usuario desde Supabase (llamar tras
  // login). Si falla o no hay backend configurado, deja el estado
  // como estaba (no pisa con [] por un error de red transitorio).
  loadTradesFromServer: async () => {
    const userId = currentUserId()
    if (!isSupabaseConfigured || !userId) return
    // Supabase devuelve como máximo 1000 filas por consulta: se pide
    // por páginas para no perder trades (y PnL) a partir del 1001.
    const PAGE = 1000
    const rows = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('trades').select('*').eq('user_id', userId)
        .order('id', { ascending: true }).range(from, from + PAGE - 1)
      if (error) { console.error('[Sync] Error cargando trades:', error.message); return }
      rows.push(...data)
      if (data.length < PAGE) break
    }
    set({ trades: rows.map(rowToTrade) })
  },

  addTrade: (trade) => {
    const userId = currentUserId()
    const withId = { ...trade, id: trade.id ?? `trade-${crypto.randomUUID()}` }
    set((s) => ({ trades: [withId, ...s.trades] }))
    syncUpsert('trades', tradeToRow(withId, userId))
  },

  // Añade un trade con múltiples exits calculando rPnl/result automáticamente
  addMultiExitTrade: (tradeBase, exits) => {
    const userId   = currentUserId()
    const id       = `trade-${crypto.randomUUID()}`
    const computed = calcTradeFromExits({ ...tradeBase, id }, exits)
    set((s) => ({ trades: [computed, ...s.trades] }))
    syncUpsert('trades', tradeToRow(computed, userId))
  },

  // Actualiza los exits de un trade existente y recalcula métricas
  updateTradeExits: (id, exits) => {
    const userId = currentUserId()
    let updated = null
    set((s) => ({
      trades: s.trades.map((t) => {
        if (t.id !== id) return t
        updated = calcTradeFromExits(t, exits)
        return updated
      }),
    }))
    if (updated) syncUpsert('trades', tradeToRow(updated, userId))
  },

  updateTrade: (id, patch) => {
    const userId = currentUserId()
    let updated = null
    set((s) => ({
      trades: s.trades.map((t) => {
        if (t.id !== id) return t
        updated = { ...t, ...patch }
        return updated
      }),
    }))
    if (updated) syncUpsert('trades', tradeToRow(updated, userId))
  },

  deleteTrade: (id) => {
    set((s) => ({ trades: s.trades.filter((t) => t.id !== id) }))
    syncDelete('trades', id)
  },

  deleteTradesByAccount: (accountId) => {
    const toDelete = get().trades.filter((t) => t.accountId === accountId)
    set((s) => ({ trades: s.trades.filter((t) => t.accountId !== accountId) }))
    toDelete.forEach((t) => syncDelete('trades', t.id))
  },

  deleteAllTrades: () => {
    const ids = get().trades.map((t) => t.id)
    set({ trades: [] })
    ids.forEach((id) => syncDelete('trades', id))
  },

  getTradesByAccount: (accountId) =>
    get().trades.filter((t) => t.accountId === accountId),

  getTradesByDateRange: (from, to) =>
    get().trades.filter((t) => t.date >= from && t.date <= to),

  getStats: () => {
    const trades = get().trades
    const wins   = trades.filter((t) => t.result === 'win')
    const losses = trades.filter((t) => t.result === 'loss')
    const totalR = trades.reduce((s, t) => s + t.rPnl, 0)
    const avgWin  = wins.length   ? wins.reduce((s,t)=>s+t.rPnl,0)   / wins.length   : 0
    const avgLoss = losses.length ? losses.reduce((s,t)=>s+t.rPnl,0) / losses.length : 0
    const winRate = trades.length ? (wins.length / trades.length) * 100 : 0
    const pf      = Math.abs(avgLoss) > 0 ? Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length) : 0
    const expectancy = trades.length ? (winRate/100) * avgWin + (1 - winRate/100) * avgLoss : 0
    return {
      total: trades.length, wins: wins.length, losses: losses.length,
      winRate: parseFloat(winRate.toFixed(1)),
      totalR:  parseFloat(totalR.toFixed(2)),
      avgWin:  parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      profitFactor: parseFloat(pf.toFixed(2)),
      expectancy:   parseFloat(expectancy.toFixed(2)),
    }
  },
})

// ─────────────────────────────────────────────
//  SETUPS SLICE
// ─────────────────────────────────────────────
const setupsSlice = (set, get) => ({
  setups: seedSetups,

  addSetup: (setup) =>
    set((s) => ({
      setups: [...s.setups, {
        id:          `setup-${Date.now()}`,
        name:        setup.name.trim(),
        description: setup.description ?? '',
        createdAt:   today,
      }],
    })),

  updateSetup: (id, patch) =>
    set((s) => {
      const old = s.setups.find(su => su.id === id)
      const newSetups = s.setups.map(su => su.id === id ? { ...su, ...patch } : su)
      // If name changed, cascade update all trades referencing the old name
      if (patch.name && old && patch.name !== old.name) {
        const updatedTrades = s.trades.map(t =>
          t.setup === old.name ? { ...t, setup: patch.name } : t
        )
        return { setups: newSetups, trades: updatedTrades }
      }
      return { setups: newSetups }
    }),

  deleteSetup: (id) =>
    set((s) => ({ setups: s.setups.filter(su => su.id !== id) })),

  getSetupNames: () => get().setups.map(s => s.name),
})

// ─────────────────────────────────────────────
//  ACCOUNTS SLICE
// ─────────────────────────────────────────────
const accountsSlice = (set, get) => ({
  accounts: migrateAccounts(mockAccounts),
  activeAccountId: mockAccounts[0].id,

  setActiveAccount: (id) => set({ activeAccountId: id }),

  // Carga las cuentas reales del usuario desde Supabase (llamar tras
  // login). Si el usuario es nuevo (sin cuentas todavía) queda con
  // accounts: [] — ya no mockAccounts, que era solo el demo previo al login.
  loadAccountsFromServer: async () => {
    const userId = currentUserId()
    if (!isSupabaseConfigured || !userId) return
    const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId)
    if (error) { console.error('[Sync] Error cargando cuentas:', error.message); return }
    const accounts = data.map(rowToAccount)
    set({ accounts, activeAccountId: accounts[0]?.id ?? null })
  },

  addAccount: (account) => {
    const userId = currentUserId()
    const withId = {
      ...account,
      id:     `acc-${Date.now()}`,
      type:   migrateAccountType(account.type),
      status: migrateAccountStatus(account.status),
    }
    set((s) => ({ accounts: [...s.accounts, withId] }))
    syncUpsert('accounts', accountToRow(withId, userId))
  },

  updateAccount: (id, patch) => {
    const userId = currentUserId()
    let updated = null
    set((s) => ({
      accounts: s.accounts.map((a) => {
        if (a.id !== id) return a
        updated = { ...a, ...patch }
        return updated
      }),
    }))
    if (updated) syncUpsert('accounts', accountToRow(updated, userId))
  },

  deleteAccount: (id) => {
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }))
    syncDelete('accounts', id)
  },
})

// ─────────────────────────────────────────────
//  RITUAL SLICE
// ─────────────────────────────────────────────
const ritualSlice = (set, get) => ({
  ritualByDate: {
    [today]: { checkedIds: ['pt1','pt2','pt3','pt4','pt5'], energy: 'Alto', emotion: 'Enfocado', note: '' },
  },

  getRitualForDate: (date) =>
    get().ritualByDate[date] ?? { checkedIds: [], energy: 'Normal', emotion: 'Neutral', note: '' },

  toggleRitualItem: (date, itemId) =>
    set((s) => {
      const current = s.ritualByDate[date] ?? { checkedIds: [], energy: 'Normal', emotion: 'Neutral', note: '' }
      const checked = current.checkedIds.includes(itemId)
        ? current.checkedIds.filter((id) => id !== itemId)
        : [...current.checkedIds, itemId]
      return { ritualByDate: { ...s.ritualByDate, [date]: { ...current, checkedIds: checked } } }
    }),

  setRitualField: (date, field, value) =>
    set((s) => {
      const current = s.ritualByDate[date] ?? { checkedIds: [], energy: 'Normal', emotion: 'Neutral', note: '' }
      return { ritualByDate: { ...s.ritualByDate, [date]: { ...current, [field]: value } } }
    }),

  getRitualScore: (date) => {
    const ritual = get().getRitualForDate(date)
    return (ritual.checkedIds.length / PRE_TRADE_ITEMS.length) * 100
  },
})

// ─────────────────────────────────────────────
//  CASHFLOW SLICE
// ─────────────────────────────────────────────
const cashflowSlice = (set) => ({
  cashflow: mockCashflow,

  addCashflowEntry: (entry) =>
    set((s) => ({
      cashflow: [...s.cashflow, { ...entry, id: `cf-${Date.now()}` }],
    })),
})

// ─────────────────────────────────────────────
//  LICENSE SLICE — YA NO VIVE AQUÍ
//
//  tier / csvImportedCount / testerCode ahora viven server-side en
//  la tabla `profiles` de Supabase (ver supabase/schema.sql) y se
//  gestionan desde useAuthStore.js — un usuario no puede subirse de
//  plan escribiendo en su propio localStorage. Los hooks useTier(),
//  useActivateTester(), etc. se siguen exportando más abajo desde
//  este mismo archivo para no tener que tocar cada página que ya los
//  importaba de aquí — pero por dentro delegan a useAuthStore.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  UI SLICE
// ─────────────────────────────────────────────
const uiSlice = (set) => ({
  // ── Theme ──
  theme: (typeof localStorage !== 'undefined' && localStorage.getItem('agente-metricas-theme')) || 'dark',
  setTheme: (t) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('agente-metricas-theme', t)
    document.documentElement.setAttribute('data-theme', t)
    set({ theme: t })
  },
  toggleTheme: () => {
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      if (typeof localStorage !== 'undefined') localStorage.setItem('agente-metricas-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    })
  },

  // ── Métrica principal ($/%/R) — Sprint "toggle de métricas" ──
  // Una sola preferencia para TODA la app (Dashboard, Portfolio,
  // Metrix...): cuál de las 3 se muestra grande y cuáles dos abajo
  // en pequeño. Persistida igual que el tema, no depende de Supabase
  // (es una preferencia de visualización, no un dato de negocio).
  primaryMetric: (typeof localStorage !== 'undefined' && localStorage.getItem('agente-metricas-primary-metric')) || 'dollar',
  setPrimaryMetric: (m) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('agente-metricas-primary-metric', m)
    set({ primaryMetric: m })
  },

  // ── Estilo de tarjeta en Portfolio (detallado/simple) — preferencia
  // visual, persistida igual que theme/primaryMetric. ──
  portfolioCardStyle: (typeof localStorage !== 'undefined' && localStorage.getItem('agente-metricas-portfolio-card-style')) || 'simple',
  setPortfolioCardStyle: (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('agente-metricas-portfolio-card-style', v)
    set({ portfolioCardStyle: v })
  },

  dateRange: 'month',
  setDateRange: (range) => set({ dateRange: range }),

  historialFilter: { result: 'all', setup: 'all', pair: 'all', accountId: 'all' },
  setHistorialFilter: (patch) =>
    set((s) => ({ historialFilter: { ...s.historialFilter, ...patch } })),

  ritualDate: today,
  setRitualDate: (date) => set({ ritualDate: date }),

  newTrade: {
    pair: '', direction: 'Long', entryPrice: '', stopLoss: '',
    takeProfit: '', riskPercent: 1, setup: '', timeframe: '15m',
    accountId: mockAccounts[0].id, notes: '',
  },
  setNewTradeField: (field, value) =>
    set((s) => ({ newTrade: { ...s.newTrade, [field]: value } })),
  resetNewTrade: () =>
    set({ newTrade: {
      pair: '', direction: 'Long', entryPrice: '', stopLoss: '',
      takeProfit: '', riskPercent: 1, setup: '', timeframe: '15m',
      accountId: mockAccounts[0].id, notes: '',
    }}),
})

// ─────────────────────────────────────────────
//  COMPOSE STORE
// ─────────────────────────────────────────────
export const useStore = create(
  devtools(
    persist(
      (set, get) => ({
        ...tradesSlice(set, get),
        ...setupsSlice(set, get),
        ...accountsSlice(set, get),
        syncError: null,
        clearSyncError: () => set({ syncError: null }),
        loadUserDataFromServer: async () => {
          await Promise.all([get().loadAccountsFromServer(), get().loadTradesFromServer()])
        },
        resetToLocalDemo: () => set({
          trades: mockTrades,
          accounts: migrateAccounts(mockAccounts),
          activeAccountId: mockAccounts[0].id,
        }),
        ...ritualSlice(set, get),
        ...cashflowSlice(set, get),
        ...uiSlice(set, get),
      }),
      {
        name: 'agente-metricas-store',
        // v2: tier/csvImportedCount/testerCode salen del store local y
        // pasan a Supabase (useAuthStore) — ya no se persisten aquí.
        version: 2,
        partialize: (state) => ({
          trades:       state.trades,
          setups:       state.setups,
          accounts:     state.accounts,
          cashflow:     state.cashflow,
          ritualByDate: state.ritualByDate,
        }),
        migrate: (persistedState, version) => {
          if (version < 2) {
            // Limpiamos campos de licencia antiguos del localStorage — ya
            // no significan nada, el tier real vive en Supabase.
            const { tier, csvImportedCount, testerCode, testerActivatedAt, ...rest } = persistedState
            return rest
          }
          return persistedState
        },
      }
    ),
    { name: 'AgenteMetricas' }
  )
)

// ─────────────────────────────────────────────
//  SELECTOR HOOKS
// ─────────────────────────────────────────────
export const useTrades        = () => useStore((s) => s.trades)
export const useSetups        = () => useStore((s) => s.setups)
export const useAccounts      = () => useStore((s) => s.accounts)
export const useActiveAccount = () => {
  const accounts        = useStore((s) => s.accounts)
  const activeAccountId = useStore((s) => s.activeAccountId)
  return accounts.find((a) => a.id === activeAccountId) ?? accounts[0]
}
export const useCashflow         = () => useStore((s) => s.cashflow)
export const useHistorialFilter  = () => useStore((s) => s.historialFilter)
export const useNewTrade         = () => useStore((s) => s.newTrade)
export const useRitualDate       = () => useStore((s) => s.ritualDate)
export const useTheme            = () => useStore((s) => s.theme)
export const useToggleTheme      = () => useStore((s) => s.toggleTheme)
// Métrica principal ($/%/R) — una sola preferencia global.
export const usePrimaryMetric    = () => useStore((s) => s.primaryMetric)
export const useSetPrimaryMetric = () => useStore((s) => s.setPrimaryMetric)
// Estilo de tarjeta en Portfolio (detallado/simple).
// La vista "Tarjeta Detallada" se quitó: quien la tenía guardada ve la simple
export const usePortfolioCardStyle    = () => useStore((s) => (s.portfolioCardStyle === 'detailed' ? 'simple' : s.portfolioCardStyle))
export const useSetPortfolioCardStyle = () => useStore((s) => s.setPortfolioCardStyle)
// ── Tier / licencia — el dato real vive en useAuthStore (Supabase) ──
export { useTier, useIsTester, useCsvImportedCount } from '@/store/useAuthStore'

export const useHasFeature       = (featureKey) => {
  const tier = useAuthStore((s) => s.profile?.tier ?? 'free')
  return hasFeature(tier, featureKey)
}
export const useCanAddAccount    = () => {
  const tier     = useAuthStore((s) => s.profile?.tier ?? 'free')
  const accounts = useStore((s) => s.accounts)
  return accounts.length < accountLimitFor(tier)
}
export const useAccountLimit     = () => {
  const tier = useAuthStore((s) => s.profile?.tier ?? 'free')
  return accountLimitFor(tier)
}
// Ahora es async (escribe en Supabase vía RPC increment_csv_import) —
// mismo nombre de hook, misma firma de uso en AccountImportCsvModal,
// pero quien la llame debe hacer `await incrementCsvImport(n)`.
export const useIncrementCsvImport = () => useAuthStore((s) => s.incrementCsvImport)
export const useCanImportCsvNow  = () => (count = 0) => {
  const { profile } = useAuthStore.getState()
  const tier = profile?.tier ?? 'free'
  const csvImportedCount = profile?.csv_imported_count ?? 0
  return (csvImportedCount + count) <= csvTradesLimitFor(tier)
}
export const useCanAddTrade      = () => {
  const tier   = useAuthStore((s) => s.profile?.tier ?? 'free')
  const trades = useStore((s) => s.trades)
  return trades.length < tradeLimitFor(tier)
}
// Async ahora (valida el código server-side vía RPC activate_tester_code).
export const useActivateTester   = () => useAuthStore((s) => s.activateTesterCode)
export const useRitualForToday   = () => {
  const date = useStore((s) => s.ritualDate)
  return useStore((s) => s.getRitualForDate(date))
}