import { create } from 'zustand'

// ─────────────────────────────────────────────
//  ONBOARDING — estado de UI (Sprint "Onboarding 3 pasos")
//
//  Solo coordina SI el modal está abierto y en qué paso — nunca
//  persiste (no tiene sentido recordar "estaba en el paso 2" entre
//  sesiones). Lo que SÍ persiste (completado / saltado) vive en
//  localStorage directamente, gestionado desde App.jsx, tal como
//  pide el criterio de aceptación.
//
//  Store propio y aislado (mismo patrón que el resto de Atlas:
//  useAccountBlueprintStore, useImportFormatsStore...) para que
//  App.jsx (detección de first-visit) y Hero.jsx (CTA manual) puedan
//  controlar el mismo modal sin pasar props entre ellos.
// ─────────────────────────────────────────────

export const useOnboardingStore = create((set) => ({
  open:   false, // ¿modal visible ahora mismo?
  active: false, // ¿flujo en curso? (true aunque open=false, ej. mientras el usuario está en /historial añadiendo un trade a mano)
  step:   1,

  start: () => set({ open: true, active: true, step: 1 }),
  reopenAt: (step) => set({ open: true, step }),
  minimize: () => set({ open: false }), // oculta sin abandonar el flujo
  setStep:  (step) => set({ step }),
  close: () => set({ open: false, active: false }), // saltar/cerrar del todo
}))
