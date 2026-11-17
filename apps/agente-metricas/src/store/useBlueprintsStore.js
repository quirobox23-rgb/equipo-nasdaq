import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Map } from 'lucide-react'
import { BLUEPRINTS_DATA, BLUEPRINTS_ARCHIVED } from '@/data/blueprintsData'
import { BLUEPRINT_TRAINING_LINKS_SEED } from '@/config/blueprintTrainingLinks'

// ─────────────────────────────────────────────
//  BLUEPRINTS STORE — persistencia (Sprint 18.1)
//
//  Reutiliza EXACTAMENTE la misma estrategia de almacenamiento que
//  el resto de Atlas (zustand + middleware `persist` → localStorage,
//  ver store/useStore.js). Es un store independiente: no modifica ni
//  toca `useStore.js`, solo replica su mismo patrón para el dominio
//  de Blueprints.
//
//  Qué persiste:
//    - blueprints     → información general, objetivos, reglas y
//                        checklists de cada Blueprint (todo lo editable
//                        desde el panel del Sprint 13).
//    - trainingLinks   → asociaciones Blueprint ↔ Training (Sprint 15).
//
//  Preparado para el futuro: el día que exista backend, basta con
//  sustituir este store por llamadas a la API sin tocar Blueprints.jsx
//  ni Training.jsx — ambos solo consumen los hooks de abajo.
// ─────────────────────────────────────────────

export const useBlueprintsStore = create(
  persist(
    (set, get) => ({
      blueprints: BLUEPRINTS_DATA,
      trainingLinks: BLUEPRINT_TRAINING_LINKS_SEED,

      /** Guarda los cambios de un Blueprint (información general, objetivos, reglas, checklists). */
      updateBlueprint: (updated) =>
        set((state) => ({
          blueprints: state.blueprints.map(b => (b.id === updated.id ? updated : b)),
        })),

      /** Crea un Mapa nuevo, vacío, listo para editar. Devuelve el id creado. */
      addBlueprint: (partial) => {
        const id = `mapa-${Date.now()}`
        const newBlueprint = { icon: Map, ...partial, id }
        set((state) => ({ blueprints: [...state.blueprints, newBlueprint] }))
        return id
      },

      /** Duplica un Mapa existente (mismo contenido, id y nombre nuevos). Devuelve el id creado. */
      duplicateBlueprint: (blueprintId) => {
        const state = get()
        const source = state.blueprints.find(b => b.id === blueprintId)
        if (!source) return null
        const id = `mapa-${Date.now()}`
        const copy = {
          ...source,
          id,
          name: `${source.name} (copia)`,
        }
        set((s) => ({ blueprints: [...s.blueprints, copy] }))
        return id
      },

      /** Guarda qué entrenamientos quedan asociados a un Blueprint. */
      setTrainingIdsForBlueprint: (blueprintId, trainingIds) =>
        set((state) => ({
          trainingLinks: { ...state.trainingLinks, [blueprintId]: trainingIds },
        })),
    }),
    {
      name: 'agente-metricas-blueprints', // clave propia de localStorage, independiente de 'agente-metricas-store'
      partialize: (state) => ({
        blueprints: state.blueprints,
        trainingLinks: state.trainingLinks,
      }),
      // ── Guarda anti-estado-vacío ──
      // Por defecto, zustand/persist mezcla el estado persistido con
      // un simple {...current, ...persisted}: si localStorage guardó
      // alguna vez `blueprints: []` (p.ej. antes de tener datos, o por
      // un guardado incompleto), ese array vacío pisaría silenciosamente
      // BLUEPRINTS_DATA y la app se quedaría sin Blueprints.
      // `merge` se ejecuta en la rehidratación y evita justo eso: si lo
      // persistido está vacío, se restaura la semilla; si tiene datos
      // reales, esos datos (los válidos) se respetan tal cual.
      merge: (persistedState, currentState) => {
        const persisted = persistedState || {}
        // ── Migración plantilla v2 ──
        // Los Mapas persistidos con el formato ANTERIOR tienen
        // `objectives`/`level`/`market`; los de la plantilla v2 tienen
        // `parameters`/`identification`. Si lo guardado en localStorage
        // es del formato viejo (o de una lista de Mapas que ya no
        // existe), se descarta y se resiembra con BLUEPRINTS_DATA — no
        // tiene sentido intentar migrar campo a campo algo que ya no
        // tiene equivalente (Nivel, Sesión, checklists no existen en v2).
        const isOldFormat = (bp) => bp && (bp.objectives !== undefined || bp.parameters === undefined)
        const hasValidBlueprints =
          Array.isArray(persisted.blueprints) && persisted.blueprints.length > 0 &&
          !persisted.blueprints.some(isOldFormat)
        const hasValidTrainingLinks =
          persisted.trainingLinks && Object.keys(persisted.trainingLinks).length > 0

        // El campo `icon` de cada Blueprint es un componente de React
        // (p.ej. TrendingUp de lucide-react), no un dato serializable:
        // JSON.stringify lo elimina silenciosamente al guardar en
        // localStorage. Como no es un campo editable por el usuario
        // (no forma parte del formulario), se reconstruye siempre
        // desde la semilla (BLUEPRINTS_DATA) buscando por `id`.
        // Mapas retirados (BLUEPRINTS_ARCHIVED) fuera también de lo ya
        // guardado en localStorage; los Mapas creados por el usuario se
        // respetan.
        const archivedIds = new Set(BLUEPRINTS_ARCHIVED.map(b => b.id))
        const restoredBlueprints = hasValidBlueprints
          ? persisted.blueprints.filter(b => !archivedIds.has(b.id)).map(b => {
              const seed = BLUEPRINTS_DATA.find(s => s.id === b.id)
              // Los Mapas base que aún se llamen "Modelo …" en localStorage
              // toman el nombre nuevo de la semilla.
              const name = seed && /^Modelo\b/i.test(b.name || '') ? seed.name : b.name
              return { ...b, name, icon: seed ? seed.icon : (b.icon || Map) }
            })
          : BLUEPRINTS_DATA
        // Mapas base nuevos (p.ej. Mapa 5) que todavía no están en lo
        // guardado: se añaden desde la semilla para que aparezcan sin
        // borrar localStorage. No existe borrar un Mapa, así que un Mapa
        // base ausente siempre es uno que aún no existía al guardarse.
        const restoredIds = new Set(restoredBlueprints.map(b => b.id))
        const missingSeeds = BLUEPRINTS_DATA.filter(s => !restoredIds.has(s.id))

        return {
          ...currentState,
          ...persisted,
          blueprints: [...restoredBlueprints, ...missingSeeds],
          trainingLinks: hasValidTrainingLinks ? persisted.trainingLinks : BLUEPRINT_TRAINING_LINKS_SEED,
        }
      },
    }
  )
)

// ── Selector hooks (mismo patrón que store/useStore.js) ──
export const useBlueprintsList        = () => useBlueprintsStore(s => s.blueprints)
export const useBlueprintTrainingLinks = () => useBlueprintsStore(s => s.trainingLinks)