import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ROUTINE_ITEMS } from '@/data/dailyRoutineBlocks'

// ─────────────────────────────────────────────
//  DAILY ROUTINE STORE — persistencia (Sprint 20)
//
//  Misma estrategia que useBlueprintsStore.js / useTrainingStore.js:
//  zustand + middleware `persist` → localStorage. Store independiente,
//  no toca ningún otro store existente.
//
//  Guarda, por bloque, la lista de elementos del checklist:
//    { [blockId]: [{ id, text, checked }] }
//
//  Preparado para el futuro: Blueprints, Training, Trader Score y
//  Mentor IA podrán leer `routineItems` (vía useDailyRoutineItems)
//  para conocer el cumplimiento de la rutina diaria, sin que este
//  store tenga que cambiar.
// ─────────────────────────────────────────────

export const useDailyRoutineStore = create(
  persist(
    (set, get) => ({
      routineItems: DEFAULT_ROUTINE_ITEMS,

      addItem: (blockId, text) =>
        set((state) => ({
          routineItems: {
            ...state.routineItems,
            [blockId]: [
              ...(state.routineItems[blockId] || []),
              { id: `item-${Date.now()}`, text, checked: false },
            ],
          },
        })),

      editItem: (blockId, itemId, text) =>
        set((state) => ({
          routineItems: {
            ...state.routineItems,
            [blockId]: (state.routineItems[blockId] || []).map(i =>
              i.id === itemId ? { ...i, text } : i
            ),
          },
        })),

      deleteItem: (blockId, itemId) =>
        set((state) => ({
          routineItems: {
            ...state.routineItems,
            [blockId]: (state.routineItems[blockId] || []).filter(i => i.id !== itemId),
          },
        })),

      toggleItem: (blockId, itemId) =>
        set((state) => ({
          routineItems: {
            ...state.routineItems,
            [blockId]: (state.routineItems[blockId] || []).map(i =>
              i.id === itemId ? { ...i, checked: !i.checked } : i
            ),
          },
        })),
    }),
    {
      name: 'agente-metricas-daily-routine',
      partialize: (state) => ({ routineItems: state.routineItems }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState || {}
        const hasValidItems =
          persisted.routineItems && Object.keys(persisted.routineItems).length > 0
        return {
          ...currentState,
          ...persisted,
          routineItems: hasValidItems ? persisted.routineItems : DEFAULT_ROUTINE_ITEMS,
        }
      },
    }
  )
)

export const useDailyRoutineItems = () => useDailyRoutineStore(s => s.routineItems)
