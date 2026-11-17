import { Compass } from 'lucide-react'

// ─────────────────────────────────────────────
//  BLUEPRINTS_DATA — plantilla v2 (Agente Métricas)
//
//  Rediseño completo según "Plantilla de Mapas v2": cada Mapa se
//  reduce a 4 bloques con utilidad estadística real — se quitaron
//  Nivel, Temporalidad, Sesión, Tipo de trader, Activo/instrumento
//  y los checklists de entrada/salida (no modifican la matemática
//  del modelo, eran solo descriptivos).
//
//  Solo "Santos RR negativo modelo 1" tiene datos 100% reales,
//  verificados y entregados tal cual en la especificación funcional.
//  Los otros 5 NUNCA tuvieron cifras verificadas de Santos (ya lo
//  decía el comentario original: "no son datos de Santos, son un
//  punto de partida editable") — al convertirlos a esta plantilla
//  se derivaron de forma proporcional a partir de sus objetivos
//  anteriores, asumiendo una cuenta de referencia de $50.000. Están
//  marcados con "· estimado" en su descripción para que se sepa de
//  un vistazo cuáles hay que revisar de verdad antes de usarlos con
//  alumnos — no son un dato final, es un punto de partida editable
//  desde el propio editor de Mapas.
// ─────────────────────────────────────────────

export const ENVIRONMENTS = ['Prop Futures', 'Prop CFDs', 'Capital Real']
export const DRAWDOWN_TYPES = ['EOD', 'Trailing', 'Static']

export const BLUEPRINTS_DATA = [
  {
    id: 'santos-rr-negativo-1',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'Mapa 1 - RR 0.30 (Días mínimos)',
    color: 'var(--red)',
    icon: Compass,
    identification: {
      description: 'Mapa enfocado en cumplir días mínimos con RR bajo y alta probabilidad. Diseñado para proteger la cuenta y evitar EOD.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 500,
      tpTarget: 150,
      winRateMin: 78, winRateTarget: 82, winRateOptimal: 85,
      avgLossMax: 500, avgLossTarget: 400,
      rrRealizedMin: 0.30, rrRealizedTarget: 0.40, rrRealizedOptimal: 0.50,
      pfMin: 1.35, pfTarget: 1.50, pfOptimal: 2.00,
    },
    accountRules: {
      drawdownAvailable: 2000,
      drawdownType: 'EOD',
      dailyTargetMin: 150,
      minDaysRequired: 5,
    },
    diagnosis: {
      whatToDo: '- Enfocarse en consistencia y días mínimos.\n- Mantener SL disciplinado.\n- Priorizar setups de alta probabilidad.\n- Cerrar parcial en +100 si es necesario.',
      whatToAvoid: '- Buscar grandes ganancias todos los días.\n- Aumentar riesgo en rachas negativas.\n- Operar fuera de la estrategia.\n- Romper el plan por ansiedad.',
    },
  },
  {
    id: 'modelo-2-capitalizacion-buffer',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'Mapa 2 - Capitalización Buffer',
    color: 'var(--blue)',
    icon: Compass,
    identification: {
      description: 'Mantiene la misma lógica estadística base del Mapa 1 (RR nominal 0.30, Win Rate alto, control de la pérdida promedio), pero usa una mayor proporción del Drawdown disponible para capitalizar más rápido. Su objetivo no es completar días mínimos, sino generar $1.200-$1.250 de profit para trabajar la zona de buffer/retiro — más rápido que el Mapa 1, pero también más sensible a una pérdida promedio elevada. El Hard Stop de ~$833 es el límite, no el objetivo: funciona mejor cuando la pérdida promedio real se mantiene en $450-$500. Recovery Trades objetivo: ≤2 TP.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 833,
      tpTarget: 250,
      winRateMin: 80, winRateTarget: 85, winRateOptimal: 88,
      avgLossMax: 600, avgLossTarget: 450,
      rrRealizedMin: 0.30, rrRealizedTarget: 0.50, rrRealizedOptimal: 0.60,
      pfMin: 1.50, pfTarget: 2.00, pfOptimal: 2.50,
    },
    accountRules: {
      drawdownAvailable: 2000,
      drawdownType: 'EOD',
      // Objetivo mínimo diario confirmado: $250, la misma cifra que
      // el TP por operación (con este sistema, un TP cubre el
      // objetivo del día). Días mínimos sigue sin rellenar — el
      // usuario no dio un número de días, y este modelo persigue un
      // objetivo de capitalización total ($1.200-$1.250, ver
      // descripción), no un conteo de días como el Modelo 1.
      dailyTargetMin: 250,
      minDaysRequired: null,
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
  {
    id: 'mapa-3-hibrido-expansion',
    templateType: 'hibrido-expansion', // plantilla distinta a rr-fijo — riesgo en 3 niveles, distribución de RR por frecuencia y $, sin días mínimos
    name: 'Mapa 3 - Híbrido de Expansión',
    color: 'var(--pos)',
    icon: Compass,
    identification: {
      description: 'Orientado a alcanzar un retiro relevante con mayor velocidad. Combina una mayoría de resultados de RR corto/intermedio con una minoría de operaciones de expansión. Acepta mayor probabilidad de perder alguna cuenta a cambio de mejorar velocidad y retorno esperado del portafolio. Referencia actual: cuenta 50K con $2.000 de DD EOD (conversión a 25K/100K pendiente).',
      environment: 'Prop Futures',
    },
    parameters: {
      // Riesgo en 3 niveles — no un único "riesgo máximo" como en rr-fijo.
      riesgoNormalMin: 500, riesgoNormalMax: 750,
      riesgoAPlusMin: 750, riesgoAPlusMax: 1000,
      hardRiskExcepcional: 1250,
      // "1R nominal / riesgo referencia" — NO es el riesgo configurado en
      // la cuenta. Es la unidad que usa ESTE Mapa para normalizar cada
      // trade en R al calcular la Distribución de RR (ver rrDistribution
      // más abajo). Dos cuentas con distinto riskPerTrade asignadas al
      // mismo Mapa 3 usan igualmente $750 como 1R para esa comparación.
      rNominal: 750,
      winRateMin: 55, winRateTarget: { min: 60, max: 65 }, winRateOptimal: 65,
      avgLossMax: 600, avgLossTarget: { min: 450, max: 550 }, avgLossOptimal: 450,
      // "RR realizado" = "Avg Win / Avg Loss" en el PDF original (misma
      // métrica, dos nombres, mismos números) — un solo campo aquí.
      rrRealizedMin: 1.00, rrRealizedTarget: { min: 1.20, max: 1.40 }, rrRealizedOptimal: 1.50,
      pfMin: 1.50, pfTarget: { min: 1.80, max: 2.20 }, pfOptimal: 2.50,
    },
    accountRules: {
      drawdownAvailable: 2000,
      drawdownType: 'EOD',
      // No aplica en este Mapa (a diferencia del Mapa 1) — null es el
      // estado "No aplica" en toda la plantilla, para no confundirlo
      // con "todavía no se ha rellenado".
      dailyTargetMin: null,
      minDaysRequired: null,
      capitalizationMin: 2000,
      capitalizationOptimal: 3000,
    },
    // Bloque exclusivo de esta plantilla — no existe en rr-fijo. Los 3
    // primeros buckets particionan el 100% de los trades por frecuencia;
    // "Expansión A+" es un SUBGRUPO dentro de "neutroPositivo" (2R+ está
    // contenido en 1.10R+), no un cuarto bucket independiente.
    rrDistribution: {
      buckets: [
        { key: 'negCorto',       label: 'RR negativo corto',        min: 0,    max: 0.50,   benchmarkPct: 45 },
        { key: 'negIntermedio',  label: 'RR negativo / intermedio', min: 0.50, max: 1.10,   benchmarkPct: 30 },
        { key: 'neutroPositivo', label: 'RR neutro / positivo',     min: 1.10, max: null,   benchmarkPct: 25 },
      ],
      expansionAPlus: { min: 2.0, benchmarkPctMin: 5, benchmarkPctMax: 10 },
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
  {
    id: 'santos-rr-negativo-2',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'Mapa 4 - RR negativo (variante agresiva) · estimado',
    color: 'var(--amber)',
    icon: Compass,
    identification: {
      description: 'Segunda versión del mapa de baja tasa de acierto, con un R:R aún mayor y menos operaciones al día. Exige más paciencia por operación y mayor tolerancia psicológica a las rachas perdedoras. Cifras derivadas del modelo anterior a este formato — revisar antes de usar con alumnos.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 500,
      tpTarget: 1500,
      winRateMin: 25, winRateTarget: 30, winRateOptimal: 33,
      avgLossMax: 500, avgLossTarget: 400,
      rrRealizedMin: 2.25, rrRealizedTarget: 3.00, rrRealizedOptimal: 3.75,
      pfMin: 1.35, pfTarget: 1.50, pfOptimal: 1.85,
    },
    accountRules: {
      drawdownAvailable: 7500,
      drawdownType: 'EOD',
      dailyTargetMin: 1500,
      minDaysRequired: 5,
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
  {
    id: 'mapa-5-hibrido-conservador',
    templateType: 'hibrido-expansion', // misma plantilla y motor que el Mapa 3, solo cambian los benchmarks + Avg Loss / 1R
    name: 'Mapa 5 - Híbrido Conservador',
    color: 'var(--brand-deep)',
    icon: Compass,
    identification: {
      description: 'Orientado a alcanzar el objetivo de capitalización priorizando supervivencia, control de la pérdida promedio y estabilidad estadística. Mantiene la lógica híbrida del Mapa 3 (mayoría de resultados cortos/intermedios con una minoría de expansión) pero con menos riesgo monetario habitual: necesita más trades para llegar al objetivo, a cambio de menos probabilidad de quemar la cuenta. Premia especialmente una Avg Loss baja en relación con 1R (objetivo 0.45-0.55R). Referencia actual: cuenta 50K con $2.000 de DD EOD (conversión a 25K/100K pendiente).',
      environment: 'Prop Futures',
    },
    parameters: {
      riesgoNormalMin: 400, riesgoNormalMax: 550,
      riesgoAPlusMin: 600, riesgoAPlusMax: 750,
      hardRiskExcepcional: 1000,
      rNominal: 500,
      winRateMin: 55, winRateTarget: { min: 60, max: 65 }, winRateOptimal: 65,
      avgLossMax: 325, avgLossTarget: { min: 225, max: 275 }, avgLossOptimal: 225,
      rrRealizedMin: 1.00, rrRealizedTarget: { min: 1.20, max: 1.40 }, rrRealizedOptimal: 1.50,
      pfMin: 1.40, pfTarget: { min: 1.80, max: 2.20 }, pfOptimal: 2.50,
      // Avg Loss medida en R del Mapa (Avg Loss / rNominal). Objetivo
      // del PDF: 0.45-0.55R; máx y óptimo salen de los $ de arriba
      // ($325 / $500 = 0.65R, $225 / $500 = 0.45R).
      avgLossRMax: 0.65, avgLossRTarget: { min: 0.45, max: 0.55 }, avgLossROptimal: 0.45,
      // "El Mapa 5 debe premiar especialmente una Avg Loss baja": la
      // Avg Loss ($ y en R) pesa el doble en la compatibilidad.
      avgLossWeight: 2,
    },
    accountRules: {
      drawdownAvailable: 2000,
      drawdownType: 'EOD',
      dailyTargetMin: null,
      minDaysRequired: null,
      // Target mínimo: No aplica en el Mapa 5, solo el objetivo +$3.000.
      capitalizationMin: null,
      capitalizationOptimal: 3000,
    },
    rrDistribution: {
      buckets: [
        { key: 'negCorto',       label: 'RR negativo corto',        min: 0,    max: 0.50,   benchmarkPct: 45 },
        { key: 'negIntermedio',  label: 'RR negativo / intermedio', min: 0.50, max: 1.10,   benchmarkPct: 30 },
        { key: 'neutroPositivo', label: 'RR neutro / positivo',     min: 1.10, max: null,   benchmarkPct: 25 },
      ],
      expansionAPlus: { min: 2.0, benchmarkPctMin: 5, benchmarkPctMax: 10 },
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
]

// ─────────────────────────────────────────────
//  Mapas retirados temporalmente de la página de Mapas: no son de
//  Santos. Se conservan aquí, sin borrar, para volver a añadirlos más
//  adelante (basta con moverlos de nuevo a BLUEPRINTS_DATA). Mientras
//  estén en esta lista, useBlueprintsStore los quita también de lo
//  que cada usuario tenga guardado en su navegador.
// ─────────────────────────────────────────────
export const BLUEPRINTS_ARCHIVED = [
  {
    id: 'ny-open',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'NY Open · estimado',
    color: 'var(--brand)',
    icon: Compass,
    identification: {
      description: 'Sistema centrado en la volatilidad de los primeros minutos/horas de la sesión de Nueva York, aprovechando el rango y el direccionamiento que suele definirse en la apertura. Cifras derivadas del modelo anterior a este formato — revisar antes de usar con alumnos.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 500,
      tpTarget: 750,
      winRateMin: 45, winRateTarget: 50, winRateOptimal: 53,
      avgLossMax: 500, avgLossTarget: 400,
      rrRealizedMin: 1.13, rrRealizedTarget: 1.50, rrRealizedOptimal: 1.88,
      pfMin: 1.55, pfTarget: 1.70, pfOptimal: 2.05,
    },
    accountRules: {
      drawdownAvailable: 4000,
      drawdownType: 'EOD',
      dailyTargetMin: 750,
      minDaysRequired: 5,
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
  {
    id: 'promediar-intradia',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'Promediar Intradía · estimado',
    color: 'var(--brand-deep)',
    icon: Compass,
    identification: {
      description: 'Sistema que promedia (añade tamaño) sobre una posición dentro de la misma sesión, buscando mejorar el precio medio de entrada. Requiere control estricto del tamaño total de riesgo acumulado por posición. Cifras derivadas del modelo anterior a este formato — revisar antes de usar con alumnos.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 250,
      tpTarget: 300,
      winRateMin: 55, winRateTarget: 60, winRateOptimal: 63,
      avgLossMax: 250, avgLossTarget: 200,
      rrRealizedMin: 0.90, rrRealizedTarget: 1.20, rrRealizedOptimal: 1.50,
      pfMin: 1.25, pfTarget: 1.40, pfOptimal: 1.75,
    },
    accountRules: {
      drawdownAvailable: 5000,
      drawdownType: 'EOD',
      dailyTargetMin: 300,
      minDaysRequired: 5,
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
  {
    id: 'swing-mapa',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'Swing Mapa · estimado',
    color: 'var(--brand)',
    icon: Compass,
    identification: {
      description: 'Mapa de swing trading clásico: pocas operaciones, mantenidas durante días, buscando capturar tramos amplios de movimiento con una gestión de riesgo conservadora. Cifras derivadas del modelo anterior a este formato — revisar antes de usar con alumnos.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 500,
      tpTarget: 1000,
      winRateMin: 45, winRateTarget: 50, winRateOptimal: 53,
      avgLossMax: 500, avgLossTarget: 400,
      rrRealizedMin: 1.50, rrRealizedTarget: 2.00, rrRealizedOptimal: 2.50,
      pfMin: 1.65, pfTarget: 1.80, pfOptimal: 2.15,
    },
    accountRules: {
      drawdownAvailable: 6000,
      drawdownType: 'EOD',
      dailyTargetMin: 1000,
      minDaysRequired: 5,
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
  {
    id: 'scalping-trailing',
    templateType: 'rr-fijo', // Mapa 1/2 y los 5 anteriores — plantilla RR fijo (riesgo único, días mínimos u objetivo diario)
    name: 'Scalping Trailing · estimado',
    color: 'var(--amber)',
    icon: Compass,
    identification: {
      description: 'Sistema de scalping que usa un trailing stop para dejar correr la parte que va a favor, en vez de cerrar todo en un objetivo fijo. Busca capturar algo más de recorrido sin perder la esencia del scalping. Cifras derivadas del modelo anterior a este formato — revisar antes de usar con alumnos.',
      environment: 'Prop Futures',
    },
    parameters: {
      maxRisk: 250,
      tpTarget: 275,
      winRateMin: 50, winRateTarget: 55, winRateOptimal: 58,
      avgLossMax: 250, avgLossTarget: 200,
      rrRealizedMin: 0.83, rrRealizedTarget: 1.10, rrRealizedOptimal: 1.38,
      pfMin: 1.35, pfTarget: 1.50, pfOptimal: 1.85,
    },
    accountRules: {
      drawdownAvailable: 3000,
      drawdownType: 'EOD',
      dailyTargetMin: 275,
      minDaysRequired: 5,
    },
    diagnosis: {
      whatToDo: '',
      whatToAvoid: '',
    },
  },
]
