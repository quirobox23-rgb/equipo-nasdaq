// ─────────────────────────────────────────────
//  Ciclos creados desde "Gestionar ciclos" que todavía no tienen
//  ninguna cuenta. El ciclo de cada cuenta vive en account.cycle (en
//  la nube); esta lista solo guarda los nombres vacíos para que se
//  puedan elegir antes de asignarles cuentas.
// ─────────────────────────────────────────────
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAccounts } from './useStore'
import { cycleNames } from '@/lib/accountGroups'

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const useCyclesStore = create(
  persist(
    (set) => ({
      names: [],
      addCycle:    (name) => set(s => (s.names.some(n => same(n, name)) ? s : { names: [...s.names, name.trim()] })),
      removeCycle: (name) => set(s => ({ names: s.names.filter(n => !same(n, name)) })),
      renameCycle: (from, to) => set(s => ({ names: s.names.map(n => (same(n, from) ? to.trim() : n)) })),
    }),
    { name: 'fm-cycles' },
  ),
)

export const useEmptyCycleNames = () => useCyclesStore(s => s.names)

/** Ciclos con cuentas + ciclos creados aún vacíos, sin repetir. */
export function useAllCycleNames() {
  const accounts = useAccounts()
  const empty = useEmptyCycleNames()
  const used = cycleNames(accounts)
  const extra = empty.filter(n => !used.some(u => same(u, n)))
  return [...used, ...extra].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
}

