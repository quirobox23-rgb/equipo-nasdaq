import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useStore } from '@/store/useStore'

// ─────────────────────────────────────────────
//  ACCOUNT ↔ BLUEPRINT — asignación (Sprint 22)
//
//  Qué Blueprint tiene asignado cada cuenta de Portfolio. Vive en su
//  propio store (mismo patrón zustand + persist que el resto de
//  Atlas), independiente de Portfolio y de Blueprints: no modifica
//  ni el store de cuentas ni el de Blueprints.
//
//  El usuario SIEMPRE decide qué Blueprint usar (vía el ranking de
//  compatibilidad de trainingRecommendations.js). Nada se asigna
//  automáticamente.
//
//  Formato: { [accountId]: blueprintId }
//
//  Nube: el Mapa se guarda también en la propia cuenta
//  (account.blueprintId), que se sincroniza con Supabase como el resto
//  de la cuenta. Así se ve desde cualquier dispositivo. Este store es
//  la copia en memoria que leen las pantallas: se rehace cada vez que
//  cambian las cuentas. Las asignaciones antiguas que solo estaban en
//  el navegador se suben a la cuenta la primera vez que se cargan.
// ─────────────────────────────────────────────

export const useAccountBlueprintStore = create(
  persist(
    (set) => ({
      assignments: {},

      /** El usuario elige explícitamente qué Blueprint usar para una cuenta. */
      assignBlueprint: (accountId, blueprintId) => {
        set((state) => ({
          assignments: { ...state.assignments, [accountId]: blueprintId },
        }))
        useStore.getState().updateAccount(accountId, { blueprintId })
      },

      /** Quita el Blueprint asignado a una cuenta (por si el usuario quiere cambiarlo). */
      clearBlueprint: (accountId) => {
        set((state) => {
          const next = { ...state.assignments }
          delete next[accountId]
          return { assignments: next }
        })
        useStore.getState().updateAccount(accountId, { blueprintId: null })
      },
    }),
    {
      name: 'agente-metricas-account-blueprint',
      partialize: (state) => ({ assignments: state.assignments }),
    }
  )
)

export const useAccountBlueprintAssignments = () => useAccountBlueprintStore(s => s.assignments)

// ── Cuentas → asignaciones ──
// account.blueprintId manda (null = sin Mapa). Una cuenta que nunca lo
// tuvo (undefined) y tiene una asignación vieja del navegador la sube.
function syncFromAccounts(accounts) {
  const local = useAccountBlueprintStore.getState().assignments
  const ids = new Set(accounts.map(a => a.id))
  const next = Object.fromEntries(Object.entries(local).filter(([id]) => !ids.has(id)))
  const toUpload = []
  for (const a of accounts) {
    if (a.blueprintId !== undefined) {
      if (a.blueprintId) next[a.id] = a.blueprintId
    } else if (local[a.id]) {
      next[a.id] = local[a.id]
      toUpload.push([a.id, local[a.id]])
    }
  }
  const same = Object.keys(next).length === Object.keys(local).length &&
    Object.entries(next).every(([id, bp]) => local[id] === bp)
  if (!same) useAccountBlueprintStore.setState({ assignments: next })
  for (const [id, bp] of toUpload) useStore.getState().updateAccount(id, { blueprintId: bp })
}

let lastAccounts = null
function onStoreChange(state) {
  if (state.accounts === lastAccounts) return
  lastAccounts = state.accounts
  // Sin esto, las cuentas del demo local (o de otro usuario) podrían
  // pisar asignaciones antes de hidratar el store persistido
  if (!useAccountBlueprintStore.persist?.hasHydrated?.()) return
  syncFromAccounts(state.accounts || [])
}
useStore.subscribe(onStoreChange)
useAccountBlueprintStore.persist?.onFinishHydration?.(() => { lastAccounts = null; onStoreChange(useStore.getState()) })
onStoreChange(useStore.getState())
