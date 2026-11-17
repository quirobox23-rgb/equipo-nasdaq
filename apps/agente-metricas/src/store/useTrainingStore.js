import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─────────────────────────────────────────────
//  TRAINING STORE — persistencia (Sprint 19)
//
//  Misma estrategia que useBlueprintsStore.js (Sprint 18.1): zustand
//  + middleware `persist` → localStorage, independiente del store
//  principal (store/useStore.js) y de useBlueprintsStore.js.
//
//  Guarda únicamente el estado de cada entrenamiento individual
//  (src/data/trainingItems.js):
//    'pending' | 'in_progress' | 'completed'
// ─────────────────────────────────────────────

export const useTrainingStore = create(
  persist(
    (set, get) => ({
      trainingStatus: {}, // { [trainingItemId]: 'pending' | 'in_progress' | 'completed' }

      startTraining: (id) =>
        set((state) => ({ trainingStatus: { ...state.trainingStatus, [id]: 'in_progress' } })),

      completeTraining: (id) =>
        set((state) => ({ trainingStatus: { ...state.trainingStatus, [id]: 'completed' } })),

      /** "Volver a realizar": reinicia un entrenamiento ya completado. */
      resetTraining: (id) =>
        set((state) => ({ trainingStatus: { ...state.trainingStatus, [id]: 'pending' } })),
    }),
    {
      name: 'agente-metricas-training',
      partialize: (state) => ({ trainingStatus: state.trainingStatus }),
    }
  )
)

export const useTrainingStatusMap = () => useTrainingStore(s => s.trainingStatus)
