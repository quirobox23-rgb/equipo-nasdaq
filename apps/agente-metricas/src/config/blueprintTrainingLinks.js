// ─────────────────────────────────────────────
//  BLUEPRINT ↔ TRAINING — relación centralizada (Sprint 15)
//  Persistencia añadida en Sprint 18.1 vía store/useBlueprintsStore.js
//
//  Este archivo contiene SOLO lógica pura (sin estado propio): recibe
//  el mapa de relaciones actual (`links`) y calcula sobre él. El
//  estado real y su persistencia viven en useBlueprintsStore.js, que
//  reutiliza estas mismas funciones — no se duplica ninguna lógica.
//
//  Formato de `links`: { [blueprintId]: [trainingId, trainingId, ...] }
//  Los IDs referencian los ya existentes en:
//    - src/data/blueprintsData.js  (BLUEPRINTS_DATA, campo `id`)
//    - src/data/trainingBlocks.js  (TRAINING_BLOCKS, campo `id`)
// ─────────────────────────────────────────────

// Relación inicial ("semilla") con la que arranca el store la primera
// vez (antes de que el usuario guarde ningún cambio).
export const BLUEPRINT_TRAINING_LINKS_SEED = {
  'consistent-futures': ['risk-management', 'consistency'],
  'ict-intraday': ['execution', 'psychology'],
  'swing-momentum': ['consistency', 'psychology'],
  'scalper-precision': ['execution', 'risk-management'],
  'trend-follower': ['psychology', 'consistency'],
}

/** IDs de Training asociados a un Blueprint. */
export function getTrainingIdsForBlueprint(links, blueprintId) {
  return links?.[blueprintId] || []
}

/** IDs de Blueprints que tienen asociado un Training concreto (relación inversa). */
export function getBlueprintIdsForTraining(links, trainingId) {
  return Object.entries(links || {})
    .filter(([, trainingIds]) => trainingIds.includes(trainingId))
    .map(([blueprintId]) => blueprintId)
}
