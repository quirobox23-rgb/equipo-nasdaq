import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─────────────────────────────────────────────
//  FORMATOS DE IMPORTACIÓN APRENDIDOS
//
//  Mismo patrón que useAccountBlueprintStore.js: store propio,
//  aislado por completo del store principal (useStore.js) — no lo
//  toca ni depende de él.
//
//  Cuando el usuario asigna columnas a mano en el asistente de
//  mapeo, ese mapeo se guarda aquí indexado por la "firma" del CSV
//  (conjunto de cabeceras, ver mappingEngine.js → headerSignatureHash).
//  La próxima vez que llegue un CSV con esas mismas columnas —en
//  cualquier orden— se reconoce automáticamente y no se vuelve a
//  preguntar nada.
//
//  Formato: { [headerSignature]: { mapping, label, learnedAt } }
// ─────────────────────────────────────────────

export const useImportFormatsStore = create(
  persist(
    (set, get) => ({
      learnedFormats: {},

      /** Guarda (o sobrescribe) el mapeo aprendido para una firma de columnas. */
      learnFormat: (signature, mapping, label) =>
        set((state) => ({
          learnedFormats: {
            ...state.learnedFormats,
            [signature]: {
              mapping,
              label: label || 'Formato personalizado',
              learnedAt: new Date().toISOString(),
            },
          },
        })),

      /** Olvida un formato aprendido (por si el usuario quiere corregirlo). */
      forgetFormat: (signature) =>
        set((state) => {
          const next = { ...state.learnedFormats }
          delete next[signature]
          return { learnedFormats: next }
        }),

      getLearnedFormat: (signature) => get().learnedFormats[signature] || null,
    }),
    {
      name: 'agente-metricas-import-formats',
      partialize: (state) => ({ learnedFormats: state.learnedFormats }),
    }
  )
)
