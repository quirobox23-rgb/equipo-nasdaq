// ─────────────────────────────────────────────
//  TRAINING ITEMS — entrenamientos individuales (Sprint 19)
//  Ficha ampliada (toCorrect/toDo) en Sprint 22.
//  Plantilla de coaching completa (Sprint 30): impact / actionPlan /
//  commonMistakes.
//
//  Más granulares que TRAINING_BLOCKS: cada uno se etiqueta con la(s)
//  métrica(s) del comparador Blueprint↔Trader (Sprint 18) que ayuda a
//  mejorar. Esto es lo que permite recomendarlos automáticamente con
//  reglas simples, sin IA.
//
//  `blockId` referencia TRAINING_BLOCKS (src/data/trainingBlocks.js)
//  para reutilizar su icono/color, sin duplicarlos aquí.
//
//  Campos de la ficha (Sprint 30 — plan de trabajo, no un curso):
//    - objective       → objetivo general del entrenamiento
//    - toCorrect/toDo  → qué corregir / qué hacer (resumen, Sprint 22)
//    - impact          → "¿Qué significa este problema?" (máx. 4 frases,
//                         impacto práctico, sin teoría)
//    - actionPlan      → "Plan de entrenamiento": checklist de acciones
//                         concretas aplicables desde la próxima sesión
//    - commonMistakes  → "Errores frecuentes" relacionados con la métrica
// ─────────────────────────────────────────────

export const TRAINING_ITEMS = [
  {
    id: 'ti-gestion-riesgo',
    name: 'Gestión del Riesgo',
    objective: 'Aplicar el riesgo máximo por operación de forma consistente.',
    toCorrect: 'Tamaños de posición irregulares que disparan el riesgo real por operación.',
    toDo: 'Fijar el % de riesgo antes de entrar y calcular el tamaño de posición en base a él, siempre.',
    impact: [
      'Un riesgo irregular hace que una sola operación mala pueda borrar varias buenas.',
      'Sin un riesgo fijo, tu curva de resultados depende más de la suerte que de tu sistema.',
    ],
    actionPlan: [
      'Definir el % de riesgo antes de abrir la plataforma, no durante la operación.',
      'Calcular el tamaño de posición a partir del stop, nunca al revés.',
      'No aumentar el tamaño de posición aunque la operación "se vea muy clara".',
      'Registrar el riesgo real usado en cada operación, sin excepciones.',
    ],
    commonMistakes: [
      'Aumentar el tamaño de posición en operaciones "con más confianza".',
      'Calcular el riesgo después de decidir la entrada, no antes.',
      'Redondear el tamaño de posición al alza "por poco".',
    ],
    difficulty: 'Intermedio',
    durationMin: 15,
    metricTags: ['riskPerTrade', 'profitFactor'],
    blockId: 'risk-management',
  },
  {
    id: 'ti-gestion-parciales',
    name: 'Gestión de Parciales',
    objective: 'Optimizar la toma de beneficios parciales para mejorar el Profit Factor.',
    toCorrect: 'Cerrar toda la posición demasiado pronto o demasiado tarde.',
    toDo: 'Definir de antemano en qué niveles se toman parciales y mover el stop a breakeven tras el primero.',
    impact: [
      'Cerrar todo demasiado pronto limita el tamaño de tus ganadoras sin reducir el de tus perdedoras.',
      'Sin un plan de salidas, cada operación se decide "sobre la marcha", lo que añade ruido emocional.',
    ],
    actionPlan: [
      'Definir los niveles de parcial antes de entrar, no durante la operación.',
      'Mover el stop a breakeven en cuanto se alcance el primer parcial.',
      'Dejar correr un runner en las operaciones con mejor estructura.',
      'Anotar si la salida fue "por plan" o "por impulso" en cada trade.',
    ],
    commonMistakes: [
      'Cerrar el 100% de la posición al primer signo de duda.',
      'No mover el stop a breakeven tras el primer parcial.',
      'Cambiar el plan de salida a mitad de la operación.',
    ],
    difficulty: 'Intermedio',
    durationMin: 20,
    metricTags: ['profitFactor', 'rrRealized'],
    blockId: 'execution',
  },
  {
    id: 'ti-calidad-cantidad',
    name: 'Calidad frente a Cantidad',
    objective: 'Reducir el número de operaciones de baja calidad.',
    toCorrect: 'Entradas sin setup completo solo por "no quedarse fuera" del mercado.',
    toDo: 'Aplicar un checklist de entrada y descartar cualquier operación que no lo cumpla al 100%.',
    impact: [
      'Cada operación de baja calidad diluye el rendimiento de tus mejores setups.',
      'Operar por operar aumenta comisiones y desgaste emocional sin aumentar el edge real.',
    ],
    actionPlan: [
      'Definir un checklist de entrada con máximo 5 condiciones no negociables.',
      'Descartar cualquier operación que no cumpla el checklist al 100%.',
      'Contar cuántas operaciones descartas al día: si son 0, revisa tu disciplina.',
      'Revisar al cierre del día cuántas operaciones cumplían realmente el checklist.',
    ],
    commonMistakes: [
      'Forzar una entrada por miedo a perderse el movimiento.',
      'Relajar el checklist después de una racha de pérdidas.',
      'Operar varios setups distintos el mismo día sin un criterio claro.',
    ],
    difficulty: 'Básico',
    durationMin: 15,
    metricTags: ['profitFactor', 'tradesPerDay'],
    blockId: 'consistency',
  },
  {
    id: 'ti-control-riesgo',
    name: 'Control del Riesgo',
    objective: 'Limitar el drawdown mediante reglas de exposición máxima.',
    toCorrect: 'Aumentar el riesgo tras una pérdida para "recuperarla" rápido.',
    toDo: 'Establecer un límite de drawdown diario/semanal y detener la operativa al alcanzarlo.',
    impact: [
      'Un drawdown elevado obliga a un rendimiento mucho mayor solo para volver al punto de partida.',
      'Cuanto más profundo el drawdown, más presión psicológica para forzar la recuperación — y más errores.',
    ],
    actionPlan: [
      'Fijar un límite de pérdida diaria y otro semanal antes de operar.',
      'Detener la operativa en cuanto se alcance el límite, sin excepciones.',
      'No aumentar el riesgo por operación tras una racha de pérdidas.',
      'Revisar el drawdown acumulado cada mañana antes de la sesión.',
    ],
    commonMistakes: [
      'Aumentar el riesgo para "recuperar" lo perdido en la misma sesión.',
      'Seguir operando después de alcanzar el límite de pérdida diaria.',
      'Añadir contratos a una operación perdedora en vez de cerrarla.',
    ],
    difficulty: 'Avanzado',
    durationMin: 25,
    metricTags: ['maxDrawdownDollar'],
    blockId: 'risk-management',
  },
  {
    id: 'ti-gestion-emocional',
    name: 'Gestión Emocional',
    objective: 'Evitar decisiones impulsivas tras una racha de pérdidas.',
    toCorrect: 'Revenge trading tras dos o más pérdidas seguidas.',
    toDo: 'Hacer una pausa obligatoria tras 2 pérdidas consecutivas antes de la siguiente operación.',
    impact: [
      'Las decisiones tomadas en caliente suelen romper las reglas que funcionan cuando estás tranquilo.',
      'Una sola operación de "revenge trading" puede deshacer varios días de ganancias controladas.',
    ],
    actionPlan: [
      'Establecer una pausa obligatoria de al menos 30 min tras 2 pérdidas seguidas.',
      'Durante la pausa, alejarse físicamente de la plataforma.',
      'Anotar el estado emocional antes de volver a operar.',
      'No reabrir la plataforma si el estado emocional sigue alterado.',
    ],
    commonMistakes: [
      'Volver a operar inmediatamente después de una pérdida "para recuperarla".',
      'Duplicar el tamaño de posición tras una pérdida.',
      'Ignorar las señales de frustración o ansiedad durante la sesión.',
    ],
    difficulty: 'Intermedio',
    durationMin: 20,
    metricTags: ['maxDrawdownDollar', 'rrRealized'],
    blockId: 'psychology',
  },
  {
    id: 'ti-limites-diarios',
    name: 'Límites diarios',
    objective: 'Establecer y respetar un límite de pérdida diaria.',
    toCorrect: 'Seguir operando después de alcanzar la pérdida máxima planeada del día.',
    toDo: 'Definir el límite de pérdida diaria antes de la sesión y cerrar la plataforma al alcanzarlo.',
    impact: [
      'Sin un límite diario claro, una mala sesión puede convertirse en una mala semana.',
      'Respetar el límite protege tanto el capital como la confianza para la siguiente sesión.',
    ],
    actionPlan: [
      'Escribir el límite de pérdida diaria antes de abrir la plataforma.',
      'Cerrar la plataforma físicamente al alcanzar el límite.',
      'No "solo mirar el gráfico" tras alcanzar el límite.',
      'Registrar cuántos días se respetó el límite esta semana.',
    ],
    commonMistakes: [
      'Ampliar el límite "solo por hoy" tras una mala racha.',
      'Seguir mirando el mercado en modo demo tras alcanzar el límite.',
      'No definir el límite hasta después de empezar a perder.',
    ],
    difficulty: 'Básico',
    durationMin: 10,
    metricTags: ['maxDrawdownDollar'],
    blockId: 'consistency',
  },
  {
    id: 'ti-zona-1',
    name: 'Zona 1',
    objective: 'Reconocer las zonas de entrada de alta probabilidad.',
    toCorrect: 'Entrar en zonas de baja probabilidad solo por impaciencia.',
    toDo: 'Marcar la Zona 1 antes de la sesión y esperar el precio ahí antes de buscar una entrada.',
    impact: [
      'Operar fuera de tu zona de alta probabilidad reduce tu win rate sin que lo notes de inmediato.',
      'Esperar la zona correcta es la diferencia entre operar tu edge y operar el ruido del mercado.',
    ],
    actionPlan: [
      'Marcar la Zona 1 en el gráfico antes de que empiece la sesión.',
      'No buscar entradas mientras el precio esté fuera de la zona marcada.',
      'Esperar la reacción del precio en la zona antes de considerar la entrada.',
      'Anotar cuántas entradas se tomaron dentro vs. fuera de zona cada día.',
    ],
    commonMistakes: [
      'Anticipar la entrada antes de que el precio llegue a la zona.',
      'Mover la zona a posteriori para justificar una entrada ya tomada.',
      'Operar zonas secundarias como si fueran Zona 1.',
    ],
    difficulty: 'Intermedio',
    durationMin: 25,
    metricTags: ['winRate'],
    blockId: 'execution',
  },
  {
    id: 'ti-confirmaciones',
    name: 'Confirmaciones',
    objective: 'Esperar las confirmaciones necesarias antes de entrar.',
    toCorrect: 'Anticipar la entrada antes de que se complete la confirmación.',
    toDo: 'Esperar la vela/señal de confirmación completa antes de ejecutar la operación.',
    impact: [
      'Entrar antes de la confirmación convierte una entrada de alta probabilidad en una apuesta.',
      'La mayoría de entradas anticipadas fallan justo por la parte de la señal que faltaba confirmar.',
    ],
    actionPlan: [
      'Definir por escrito qué cuenta como "confirmación completa" para tu setup.',
      'No ejecutar la orden hasta que la vela/señal haya cerrado.',
      'Practicar con operativa simulada si la ansiedad por entrar es alta.',
      'Revisar cada entrada anticipada y anotar qué faltaba por confirmar.',
    ],
    commonMistakes: [
      'Entrar en cuanto se intuye la dirección, sin esperar el cierre de la señal.',
      'Confundir una señal parcial con una confirmación completa.',
      'Justificar a posteriori una entrada anticipada que salió bien.',
    ],
    difficulty: 'Básico',
    durationMin: 15,
    metricTags: ['winRate'],
    blockId: 'execution',
  },
  {
    id: 'ti-paciencia-operativa',
    name: 'Paciencia Operativa',
    objective: 'Evitar entradas anticipadas sin un setup completo.',
    toCorrect: 'Operar por aburrimiento o para "no perderse" un movimiento.',
    toDo: 'Operar solo cuando el setup esté 100% formado, aunque eso signifique no operar ese día.',
    impact: [
      'No operar es una decisión válida: forzar una operación sin setup reduce tu win rate real.',
      'La sensación de "estar perdiéndose algo" suele costar más que la operación que se pierde.',
    ],
    actionPlan: [
      'Aceptar de antemano que algunos días el resultado correcto es no operar.',
      'Definir una actividad para los momentos de espera (revisar plan, journal, etc.).',
      'No abrir posiciones "para no aburrirse" en sesiones sin setup claro.',
      'Registrar los días sin operar como un acierto, no como una operación perdida.',
    ],
    commonMistakes: [
      'Operar por aburrimiento en sesiones sin setup.',
      'Forzar una entrada porque "llevo mucho tiempo sin operar".',
      'Bajar el estándar del setup al final del día para "cerrar algo".',
    ],
    difficulty: 'Básico',
    durationMin: 15,
    metricTags: ['winRate', 'tradesPerDay'],
    blockId: 'psychology',
  },
]
