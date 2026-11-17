// ─────────────────────────────────────────────
//  EDGELOG · Sistema de ediciones (Básico / Intermedio / Pro)
// ─────────────────────────────────────────────
//
// Consolidado de 4 tiers a 3 (antes: Free/Basic/Medium/Advance).
// Basic y Medium se fusionan en un único nivel de pago: Intermedio.
// Advance pasa a llamarse Pro (nivel superior).
//
// Nomenclatura unificada (Sprint "unificación de planes"): la
// etiqueta pública del tier gratuito pasa de "Free" a "Básico" —
// mismo valor interno ('free'), solo cambia lo que se muestra. Las
// pestañas de Métricas (Básico/Intermedio/Pro) y los planes de pago
// usan ahora exactamente las mismas 3 palabras en toda la app.
//
// Testers: en vez de un único rol "tester" que ve todo, hay 3
// variantes (tester-free / tester-intermedio / tester-pro) que
// simulan exactamente la experiencia de ESE tier — para poder probar
// cómo se ve cada plan real, no solo "ver todo desbloqueado".
//
// Nada de esto condiciona datos ni lógica de cálculo — solo qué
// partes de la UI están desbloqueadas. El store guarda `tier`.

export const TIERS = {
  FREE:       'free',
  INTERMEDIO: 'intermedio',
  PRO:        'pro',
}

export const TESTER_ROLES = {
  TESTER_FREE:       'tester-free',
  TESTER_INTERMEDIO: 'tester-intermedio',
  TESTER_PRO:        'tester-pro',
}

export const TIER_LABELS = {
  [TIERS.FREE]:       'Básico',
  [TIERS.INTERMEDIO]: 'Intermedio',
  [TIERS.PRO]:        'Pro',
  [TESTER_ROLES.TESTER_FREE]:       'Tester · Básico',
  [TESTER_ROLES.TESTER_INTERMEDIO]: 'Tester · Intermedio',
  [TESTER_ROLES.TESTER_PRO]:        'Tester · Pro',
}

export const TIER_PRICES = {
  [TIERS.FREE]:       0,
  [TIERS.INTERMEDIO]: 22,
  [TIERS.PRO]:        43,
}

export const TIER_ORDER = [TIERS.FREE, TIERS.INTERMEDIO, TIERS.PRO]

// Un tester-X se comporta EXACTAMENTE como el tier X real (mismos
// límites, mismas features) — sirve para probar cada plan tal cual
// lo vería un cliente de pago, no para saltarse todo.
function baseTier(tier) {
  if (tier === TESTER_ROLES.TESTER_FREE)       return TIERS.FREE
  if (tier === TESTER_ROLES.TESTER_INTERMEDIO) return TIERS.INTERMEDIO
  if (tier === TESTER_ROLES.TESTER_PRO)        return TIERS.PRO
  return tier
}
export function isTesterRole(tier) {
  return tier === TESTER_ROLES.TESTER_FREE || tier === TESTER_ROLES.TESTER_INTERMEDIO || tier === TESTER_ROLES.TESTER_PRO
}

// Los códigos de tester YA NO viven aquí (estaban hardcodeados en
// texto plano y visibles en el bundle de producción — cualquiera podía
// abrir devtools y leerlos). Ahora viven en la tabla `tester_codes` de
// Supabase y solo se validan dentro de la función SQL
// activate_tester_code() (SECURITY DEFINER). Ver supabase/schema.sql
// y src/store/useAuthStore.js → activateTesterCode().

// Cada feature declara el tier MÍNIMO que la desbloquea.
// Añadir una feature nueva = añadir una línea aquí, nada más.
export const FEATURE_TIERS = {
  // ── Análisis (Básico) ──
  dashboardBasico:      TIERS.FREE,
  graficosResultados:   TIERS.FREE,
  objetivosBasicos:     TIERS.FREE,
  metrixBasic:          TIERS.FREE, // Métricas "Básico" — siempre accesible
  calendarBasic:        TIERS.FREE,

  // ── Análisis (Intermedio+) ──
  analisisPorSetup:     TIERS.INTERMEDIO,
  distribucionRR:       TIERS.INTERMEDIO,
  habitosAvanzados:     TIERS.INTERMEDIO,
  metrixAnalytics:      TIERS.INTERMEDIO, // "Métricas Intermedio"
  cycles:               TIERS.INTERMEDIO, // Ciclos de cuentas en Portafolio (botón Ciclo, selección en la tabla)
  calendarAdvanced:     TIERS.FREE, // Journal completo ya en Básico

  // ── Análisis (Pro) ──
  analisisCorrelacion:    TIERS.PRO,
  exportacionesAvanzadas: TIERS.PRO,
  metrixLab:              TIERS.PRO, // "Métricas Avanzado"

  // ── Páginas completas gateadas a nivel de sección ──
  consistency:   TIERS.FREE, // Journal completo ya en Básico
  businessRoi:   TIERS.PRO,  // ROI — exclusivo de Avanzado
  setups:        TIERS.INTERMEDIO,
  traderScore:   TIERS.FREE, // Journal completo ya en Básico
  training:      TIERS.INTERMEDIO,
  rentabilidad:  TIERS.INTERMEDIO,
  approach:      TIERS.INTERMEDIO,
  exportData:    TIERS.INTERMEDIO, // Exportar CSV / Backup JSON en Historial
  editDeleteTrades: TIERS.PRO,     // Editar/eliminar un trade ya guardado — mantiene el histórico intacto para el análisis en planes inferiores

  // ── Herramientas ──
  // Kelly Criterion, Risk of Ruin y Monte Carlo avanzado viven
  // físicamente dentro de Métricas Avanzado (metrixLab, PRO). Antes
  // estas dos claves decían INTERMEDIO, lo que hacía que la tarjeta
  // de precios prometiera "Monte Carlo · Kelly" en el plan Intermedio
  // sin que ese plan pudiera acceder de verdad a esas herramientas.
  // Corregido para que coincida con dónde viven realmente.
  kellySizing:          TIERS.PRO,
  monteCarlo:            TIERS.PRO,
  playbook:             TIERS.INTERMEDIO,

  // ── Mentor IA ──
  // Básico: solo el resumen ejecutivo. Intermedio: Mentor IA completo
  // (diagnóstico + chat). Avanzado: + Elite Performance (mentor
  // personalizado para mentoría 1 a 1).
  iaMentorInsights:      TIERS.FREE,       // resumen ejecutivo
  iaMentorDiagnostico:   TIERS.INTERMEDIO, // diagnóstico, perfil, contexto y recomendaciones — "completo"
  iaMentorChat:          TIERS.INTERMEDIO, // chat libre con el mentor
  iaMentorPersonalizado: TIERS.PRO,        // Elite Performance — mentor IA avanzado

  // ── Datos ──
  sinLimiteDatos:      TIERS.INTERMEDIO,
  soportePrioritario:  TIERS.PRO,
}

/**
 * ¿El tier actual del usuario incluye esta feature?
 * Los roles tester-X se resuelven al tier X real (mismas reglas).
 */
export function hasFeature(currentTier, featureKey) {
  const tier = baseTier(currentTier)
  const required = FEATURE_TIERS[featureKey]
  if (!required) return true // feature no mapeada => no restringida
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(required)
}

/** Tier mínimo necesario para desbloquear una feature (para mostrar en el CTA). */
export function requiredTierFor(featureKey) {
  return FEATURE_TIERS[featureKey] ?? TIERS.FREE
}

// ─────────────────────────────────────────────
//  LÍMITES DE CANTIDAD POR TIER
// ─────────────────────────────────────────────
export const TIER_LIMITS = {
  [TIERS.FREE]:       { maxAccounts: 5,        maxBlueprints: 2,        maxCsvTrades: Infinity, maxTotalTrades: Infinity, maxTrainings: 0 },
  [TIERS.INTERMEDIO]: { maxAccounts: Infinity, maxBlueprints: 5,        maxCsvTrades: Infinity, maxTotalTrades: Infinity, maxTrainings: 4 },
  [TIERS.PRO]:        { maxAccounts: Infinity, maxBlueprints: Infinity, maxCsvTrades: Infinity, maxTotalTrades: Infinity, maxTrainings: Infinity },
}

export function accountLimitFor(tier) {
  return TIER_LIMITS[baseTier(tier)]?.maxAccounts ?? 1
}
export function blueprintLimitFor(tier) {
  return TIER_LIMITS[baseTier(tier)]?.maxBlueprints ?? 3
}
/** Mapas concretos que incluye un plan, en vez de "los N primeros":
 *  Básico trae el Mapa 1 y el Mapa 3 (no el 2). Los planes que no
 *  aparecen aquí usan el orden de la lista y maxBlueprints. */
export const TIER_INCLUDED_BLUEPRINTS = {
  [TIERS.FREE]: ['santos-rr-negativo-1', 'mapa-3-hibrido-expansion'],
}
export function isBlueprintUnlocked(tier, blueprintId, index) {
  const included = TIER_INCLUDED_BLUEPRINTS[baseTier(tier)]
  if (included) return included.includes(blueprintId)
  return index < blueprintLimitFor(tier)
}
/** maxTrainings en Básico es 0 porque la página "training" ya está
 *  gateada por completo a Intermedio+ (ver FEATURE_TIERS.training) —
 *  este límite solo entra en juego dentro de Intermedio (3) y Pro
 *  (ilimitado). */
export function trainingLimitFor(tier) {
  return TIER_LIMITS[baseTier(tier)]?.maxTrainings ?? 0
}
export function tradeLimitFor(tier) {
  return TIER_LIMITS[baseTier(tier)]?.maxTotalTrades ?? Infinity
}
export function csvTradesLimitFor(tier) {
  return TIER_LIMITS[baseTier(tier)]?.maxCsvTrades ?? Infinity
}
/** Todos los planes importan CSV sin límite de trades. */
export function canImportCsv(tier) {
  return true
}
/** Básico = sin exportar (Exportar CSV / Backup JSON). Intermedio+ = sí. */
export function canExportData(tier) {
  return baseTier(tier) !== TIERS.FREE
}

// ─────────────────────────────────────────────
//  ETIQUETAS DE FEATURE — para el título del PremiumGate
// ─────────────────────────────────────────────
export const FEATURE_LABELS = {
  iaMentorPersonalizado: 'Mentor Personalizado',
  iaMentorDiagnostico:   'Diagnóstico completo del Mentor IA',
  iaMentorChat:          'Chat con el Mentor IA',
  metrixAnalytics:       'Métricas Intermedio',
  metrixLab:             'Métricas Avanzado',
  monteCarlo:            'Simulación Monte Carlo',
  kellySizing:           'Criterio de Kelly',
  playbook:              'Guía de Estrategias',
  approach:              'Enfoque',
  analisisPorSetup:      'Análisis por Setup',
  distribucionRR:        'Distribución R:R',
  habitosAvanzados:      'Hábitos Avanzados',
  analisisCorrelacion:   'Análisis de Correlación',
  exportacionesAvanzadas: 'Exportaciones Avanzadas',
  sinLimiteDatos:        'Datos sin límite',
  soportePrioritario:    'Soporte Prioritario',
  calendarAdvanced:      'Calendario Avanzado',
  consistency:           'Control de Consistencia',
  businessRoi:           'Inversión y retiros',
  setups:                'Setups',
  traderScore:           'Puntaje del Trader',
  training:              'Entrenamiento',
  rentabilidad:          'Rentabilidad',
  exportData:            'Exportar datos',
  editDeleteTrades:      'Editar/eliminar trades',
}

/** Descripción breve + bullets por feature — copy del CTA de PremiumGate. */
export const FEATURE_UPSELL = {
  iaMentorPersonalizado: {
    description: 'Tu cuenta queda bajo seguimiento cercano: tu mentor dispone de más información y herramientas para acompañarte en tu mentoría 1 a 1.',
    bullets: ['Perfil de trader para tu mentor', 'Comparación de comportamiento', 'Objetivo de la semana'],
  },
  iaMentorDiagnostico: {
    description: 'Diagnóstico completo de tu operativa: fortalezas, áreas de mejora, perfil de trader y recomendaciones priorizadas.',
    bullets: ['Diagnóstico de fortalezas y debilidades', 'Perfil del trader y contexto operativo', 'Recomendaciones prioritarias'],
  },
  metrixAnalytics: {
    description: 'Descubre tus patrones de trading: consistencia, rentabilidad ajustada al riesgo y en qué días/horas/setups rindes mejor o peor.',
    bullets: ['Consistency Score y rachas', 'Sharpe Ratio', 'Patrones por día, hora y setup'],
  },
  metrixLab: {
    description: 'El laboratorio del trader profesional: dimensiona tu riesgo y pon a prueba tu sistema con simulación estadística real.',
    bullets: ['Criterio de Kelly · Risk of Ruin', 'Simulación Monte Carlo avanzada', 'AI Coach Pro · Mapa Match'],
  },
}