/**
 * interpretationEngine.ts — Motor de interpretación macroeconómica.
 * Migrado desde macro-intelligence/src/features/macro/interpretationEngine.js
 * v2 — añadidas reglas para: NFP pending, Unemployment Rate, AHE, ISM, ADP, JOLTS
 * v3 — si no hay regla hardcodeada, consulta la Knowledge Base (conocimiento
 *      permanente por evento) antes de mostrar "sin regla configurada".
 */
import type {
  EventDirection,
  Interpretation,
  InterpretationRules,
  MacroEvent,
  MacroSignal,
  VerdictClass,
  MarketContextRegime,
} from '@/types/macro'
import { knowledgeStore, type KnowledgeEntry } from '@/lib/dataProvider/KnowledgeBase'

export const RULES: InterpretationRules = {
  // ── INFLACIÓN ───────────────────────────────────────────────
  'CPI m/m': {
    beat: {
      verdict: 'NO OPERAR — Riesgo elevado',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'CPI sobre forecast → inflación persistente',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Inflación alta → expectativas hawkish → USD bullish', strength: 'strong' },
        { asset: 'NQ',  dir: 'down', reason: 'Tasas altas sostenidas → múltiplos comprimidos → bajista', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Inflación vs tasas reales: fuerzas opuestas, monitorear DXY', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'CPI sobre estimado es la señal más bajista para NQ. No compres el primer movimiento. Espera al menos 30min para ver si el mercado absorbe el dato o acelera la caída.',
    },
    miss: {
      verdict: 'OPORTUNIDAD — Entorno favorable',
      verdictClass: 'trade',
      verdictIcon: '◉',
      verdictSub: 'CPI bajo forecast → presión desinflacionaria',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Menor inflación → menos presión de subida → USD bajista', strength: 'strong' },
        { asset: 'NQ',  dir: 'up',   reason: 'Expectativas de pausa/recorte → risk-ON → alcista', strength: 'strong' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + tasas reales bajas → oro positivo', strength: 'moderate' },
      ],
      context: 'risk-on',
      note: 'Entorno desinflacionario: el mercado puede hacer un gap alcista. Busca largos en NQ en el primer retroceso tras la apertura.',
    },
    pending: {
      verdict: 'ESPERAR — CPI pendiente de publicación',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Dato de inflación: evitar posiciones antes de la publicación',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Beat → USD sube / Miss → USD cae. Resultado binario.', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Beat → NQ cae / Miss → NQ sube. ±1% en primeros 5min.', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción inversa al USD post-dato', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'El CPI es el dato más movido del mes. Regla: no operar 30min antes. Espera absorción del dato antes de entrar.',
    },
  },

  'Core CPI y/y': {
    beat: {
      verdict: 'NO OPERAR — Alta volatilidad',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Core CPI sobre estimado → Fed no cortará pronto',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Core alto = retrasos en recortes → USD fuerte', strength: 'strong' },
        { asset: 'NQ',  dir: 'down', reason: 'Valuaciones bajo presión por tasas prolongadas', strength: 'strong' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte presiona precio del oro', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'Core CPI persistente es el peor escenario para riesgo. Evita toda operativa larga. Si quieres operar, únicamente cortos en rebotes.',
    },
    miss: {
      verdict: 'MONITOREAR — Señal positiva',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Core bajo forecast → desinflación en curso',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Desinflación del núcleo → recortes más probables', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Alivio en expectativas de tasas → rebote probable', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'Tasas reales a la baja → flujo a metales', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Señal positiva pero no operes ciegamente. Espera confirmación técnica: cierre por encima de resistencia clave antes de entrar largo.',
    },
    pending: {
      verdict: 'ESPERAR — Core CPI pendiente',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Inflación subyacente: el dato más vigilado por la Fed',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Dirección depende del resultado vs consenso', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Alta sensibilidad: mide inflación sin energía ni alimentos', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción vía tasas reales post-dato', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'El Core CPI es el indicador que más sigue la Fed. No operar antes de la publicación.',
    },
  },

  // ── EMPLEO ──────────────────────────────────────────────────
  NFP: {
    beat: {
      verdict: 'ESPERAR — Dato ambiguo',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Empleo fuerte → Fed sin excusa para recortar',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Mercado laboral robusto → hawkish implícito', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Empleo fuerte puede ser bueno (crecimiento) o malo (tasas)', strength: 'moderate' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte presiona metales', strength: 'moderate' },
      ],
      context: 'neutral',
      note: 'NFP fuerte es un dato binario: el mercado debe decidir si es "buenas noticias" (crecimiento) o "malas noticias" (Fed hawkish). Espera la primera media hora.',
    },
    miss: {
      verdict: 'POSIBLE OPORTUNIDAD — Sesgo dovish',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Empleo débil → Fed tiene más margen para recortar',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Debilidad laboral → dovish → USD bajista', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Recortes más probables → múltiplos se expanden', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + expectativa dovish → oro alcista', strength: 'strong' },
      ],
      context: 'risk-on',
      note: 'NFP bajo expectativas es generalmente positivo para riesgo si no hay recesión implícita. Busca largos en NQ en soporte.',
    },
    pending: {
      verdict: 'ESPERAR — NFP: evento de máximo impacto',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Non Farm Payrolls pendiente: no operar antes del dato',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Fuerte → USD sube / Débil → USD baja. Binario.', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: '±1.5% en primeros 5min. Dirección incierta hasta absorción.', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Depende de USD y de si el dato activa risk-on o risk-off', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'El NFP es el dato más importante del mes. No operar 30min antes. Lee también AHE y Unemployment Rate que salen simultáneamente. Espera 15min post-dato para ver la absorción.',
    },
  },

  'Unemployment Rate': {
    beat: {
      verdict: 'MONITOREAR — Desempleo sobre expectativas',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Desempleo más alto de lo esperado → mercado laboral se enfría',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Más desempleo → presión dovish → USD bajista', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Mercado laboral más flojo → Fed recorta antes → NQ alcista', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + recortes más probables → oro positivo', strength: 'moderate' },
      ],
      context: 'neutral',
      note: 'Dato se publica junto al NFP. Si ambos apuntan a debilidad laboral, el impacto dovish se amplifica. Espera siempre la absorción completa del NFP primero.',
    },
    miss: {
      verdict: 'NEUTRAL — Empleo más fuerte de lo esperado',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Desempleo por debajo del consenso → mercado laboral robusto',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Empleo fuerte → menos urgencia para la Fed de recortar', strength: 'moderate' },
        { asset: 'NQ',  dir: 'neut', reason: 'Empleo fuerte puede ser positivo (economía) o negativo (tasas)', strength: 'moderate' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte ejerce presión bajista en metales', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Leer junto al NFP y AHE. Un desempleo bajo con AHE alto es la combinación más hawkish posible: economía fuerte + presiones salariales.',
    },
    pending: {
      verdict: 'ESPERAR — Se publica junto al NFP',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Tasa de desempleo: dato clave del mercado laboral',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Subida → dovish → USD baja / Bajada → hawkish → USD sube', strength: 'moderate' },
        { asset: 'NQ',  dir: 'neut', reason: 'Leer junto a NFP y AHE para el impacto total', strength: 'moderate' },
        { asset: 'GOLD',dir: 'neut', reason: 'Impacto vía USD post-combinación de datos', strength: 'weak' },
      ],
      context: 'risk-off',
      note: 'No operar antes del dato. Se publica simultáneamente con NFP y Average Hourly Earnings. El mercado procesa los tres juntos.',
    },
  },

  'Average Hourly Earnings m/m': {
    beat: {
      verdict: 'NO OPERAR — Presión salarial inflacionaria',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Salarios sobre forecast → riesgo de espiral inflacionaria',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Salarios altos → inflación de servicios → Fed hawkish → USD fuerte', strength: 'strong' },
        { asset: 'NQ',  dir: 'down', reason: 'Presión salarial = inflación persistente = tasas altas más tiempo', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Inflación vs USD fuerte: fuerzas opuestas en el oro', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'AHE alto es la señal más hawkish dentro del informe de empleo. Si NFP también supera, el impacto se multiplica. No operar hasta absorción clara.',
    },
    miss: {
      verdict: 'OPORTUNIDAD — Presión salarial moderada',
      verdictClass: 'trade',
      verdictIcon: '◉',
      verdictSub: 'Salarios bajo forecast → inflación de servicios controlada',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Presión salarial menor → desinflación → recortes más probables', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Tasas reales bajarán → múltiplos se expanden → NQ alcista', strength: 'strong' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + expectativas dovish → oro positivo', strength: 'moderate' },
      ],
      context: 'risk-on',
      note: 'AHE bajo es la mejor noticia posible para NQ: economía que crece sin presión inflacionaria. Busca entrada larga en el primer retroceso.',
    },
    pending: {
      verdict: 'ESPERAR — Dato salarial pendiente',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Average Hourly Earnings: indicador clave de inflación laboral',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Alto → hawkish → USD sube / Bajo → dovish → USD baja', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Más sensible a AHE que al propio NFP en entorno inflacionario', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción vía USD y expectativas de tasas', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'Se publica junto a NFP. En entorno inflacionario, AHE puede mover el mercado más que el propio número de empleo. No operar antes.',
    },
  },

  'ISM Manufacturing PMI': {
    beat: {
      verdict: 'MONITOREAR — Manufactura en expansión',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'PMI Manufactura sobre estimado → sector en expansión (>50)',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Economía más fuerte → tasas altas por más tiempo → USD positivo', strength: 'moderate' },
        { asset: 'NQ',  dir: 'neut', reason: 'Manufactura fuerte: bueno para economía, malo si eleva tasas', strength: 'weak' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte ejerce presión en metales', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'ISM Manufacturing es un indicador adelantado. Por encima de 50 indica expansión. Presta atención a los sub-índices de New Orders y Prices Paid.',
    },
    miss: {
      verdict: 'MONITOREAR — Manufactura en contracción',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'PMI Manufactura bajo estimado → posible contracción sectorial',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Economía más débil → recortes más probables → USD bajista', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Dato débil → expectativas dovish → rebote posible', strength: 'weak' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + riesgo de desaceleración → oro como refugio', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'ISM por debajo de 50 señala contracción. Si persiste varios meses puede indicar recesión manufacturera. Dato de segundo nivel salvo sorpresa grande.',
    },
    pending: {
      verdict: 'MONITOREAR — ISM Manufacturing pendiente',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Indicador adelantado del sector manufacturero',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Impacto moderado: no es el dato estrella del mes', strength: 'weak' },
        { asset: 'NQ',  dir: 'neut', reason: 'Relevante para sectores industriales, menos para tech', strength: 'weak' },
        { asset: 'GOLD',dir: 'neut', reason: 'Impacto indirecto vía USD', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Dato relevante pero no de primer nivel. Fíjate especialmente en New Orders (demanda futura) y Prices Paid (presión inflacionaria).',
    },
  },

  'ISM Services PMI': {
    beat: {
      verdict: 'MONITOREAR — Servicios en expansión',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'PMI Servicios sobre estimado → sector dominante de la economía USA fuerte',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Servicios fuertes → economía resiliente → Fed sin prisa para recortar', strength: 'moderate' },
        { asset: 'NQ',  dir: 'neut', reason: 'Ambiguo: economía fuerte vs tasas altas', strength: 'moderate' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte presiona oro', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Los servicios representan el 80% del PIB de EE.UU. ISM Services es más relevante que el manufacturero. Revisa el sub-índice de empleo para anticipar el NFP.',
    },
    miss: {
      verdict: 'MONITOREAR — Servicios se desaceleran',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'PMI Servicios bajo estimado → señal de enfriamiento económico',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Servicios débiles → economía enfriándose → recortes más probables', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Expectativas dovish crecientes → rally posible', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'Refugio + USD débil = oro positivo', strength: 'moderate' },
      ],
      context: 'neutral',
      note: 'Servicios por debajo de expectativas es señal importante de desaceleración. Si ocurre junto a ISM Manufacturing débil, el impacto se amplifica.',
    },
    pending: {
      verdict: 'MONITOREAR — ISM Services pendiente',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Indicador clave del sector servicios: el mayor de la economía USA',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Relevante: servicios = 80% del PIB estadounidense', strength: 'moderate' },
        { asset: 'NQ',  dir: 'neut', reason: 'Impacto moderado, más relevante si supera ±2 puntos', strength: 'moderate' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción indirecta vía USD', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Más importante que el manufacturero. Revisa también el sub-índice Employment Component como anticipo del NFP.',
    },
  },

  'ADP Employment Change': {
    beat: {
      verdict: 'MONITOREAR — Empleo privado fuerte',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'ADP sobre forecast → empleo privado mejor de lo esperado',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Empleo privado fuerte → anticipa NFP sólido → USD alcista', strength: 'moderate' },
        { asset: 'NQ',  dir: 'neut', reason: 'Positivo para economía, negativo si retrasa recortes Fed', strength: 'weak' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte ejerce presión bajista', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'ADP es el "preludio" del NFP pero la correlación no siempre es alta. Úsalo como contexto, no como predictor exacto. El mercado puede reaccionar al revés el viernes.',
    },
    miss: {
      verdict: 'MONITOREAR — Empleo privado débil',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'ADP bajo forecast → señal de debilidad en el mercado laboral privado',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Señal de debilidad laboral → posibles recortes más próximos', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Expectativas dovish → rebote posible en growth', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + expectativas dovish → oro positivo', strength: 'moderate' },
      ],
      context: 'neutral',
      note: 'Dato de preludio al NFP. La correlación ADP-NFP puede desviarse significativamente. No sobre-reacciones: espera al viernes para confirmar.',
    },
    pending: {
      verdict: 'MONITOREAR — ADP pendiente',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Empleo privado: indicador anticipado del NFP del viernes',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Dato de segundo nivel: anticipo del NFP', strength: 'weak' },
        { asset: 'NQ',  dir: 'neut', reason: 'Impacto moderado, mayor si la sorpresa es grande', strength: 'weak' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción indirecta vía USD', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'ADP mide empleo del sector privado. Se publica el miércoles antes del NFP del viernes. Dato orientativo, no determinante.',
    },
  },

  'JOLTS Job Openings': {
    beat: {
      verdict: 'NEUTRAL — Demanda laboral alta',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Ofertas de empleo sobre estimado → mercado laboral tensionado',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Demanda laboral alta → presión salarial → Fed más hawkish', strength: 'moderate' },
        { asset: 'NQ',  dir: 'down', reason: 'Mercado laboral tenso retrasa recortes de tipos', strength: 'weak' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte presiona oro', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'La Fed vigila el ratio JOLTS/Unemployed. Un ratio alto indica exceso de demanda laboral → presión salarial → inflación de servicios. Dato de segundo nivel.',
    },
    miss: {
      verdict: 'NEUTRAL — Demanda laboral enfriándose',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Ofertas de empleo bajo estimado → mercado laboral se equilibra',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Menor demanda laboral → presión salarial reducida → dovish', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Equilibrio laboral → menor inflación → recortes más probables', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + expectativas dovish → oro positivo', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'JOLTS bajo es positivo para la narrativa desinflacionaria. La Fed ve un enfriamiento del mercado laboral como progreso hacia el mandato de precios.',
    },
    pending: {
      verdict: 'MONITOREAR — JOLTS pendiente',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Ofertas de empleo: la Fed lo usa para medir tensión laboral',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Dato de segundo nivel: impacto moderado', strength: 'weak' },
        { asset: 'NQ',  dir: 'neut', reason: 'Relevante para la narrativa de inflación laboral', strength: 'weak' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción indirecta y limitada', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'La Fed usa JOLTS para calibrar el exceso de demanda laboral. Dato orientativo, no de primer nivel. Reacción de mercado moderada salvo sorpresa grande.',
    },
  },

  // ── POLÍTICA MONETARIA ──────────────────────────────────────
  'FOMC Rate Decision': {
    hawkish: {
      verdict: 'NO OPERAR — Shock hawkish',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Subida de tipos o tono agresivo → presión máxima',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Subida de tipos → USD directamente alcista', strength: 'strong' },
        { asset: 'NQ',  dir: 'down', reason: 'Tasas más altas = coste de capital mayor → NQ bajista', strength: 'strong' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte + tasas reales altas = presión bajista en oro', strength: 'strong' },
      ],
      context: 'risk-off',
      note: 'FOMC hawkish es el evento más bajista posible. No entres hasta que el mercado establezca un rango claro post-decisión (al menos 1 hora).',
    },
    dovish: {
      verdict: 'OPORTUNIDAD — Rally potencial',
      verdictClass: 'trade',
      verdictIcon: '◉',
      verdictSub: 'Recorte de tipos o tono suave → euforia de riesgo',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Recorte de tipos → USD bajista directo', strength: 'strong' },
        { asset: 'NQ',  dir: 'up',   reason: 'Tipos bajos = expansión de múltiplos → rally alcista', strength: 'strong' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + tasas reales bajas → oro fuertemente alcista', strength: 'strong' },
      ],
      context: 'risk-on',
      note: 'FOMC dovish puede generar el mayor movimiento del año. Busca entrar en el primer retroceso tras el anuncio, no en el pico inicial.',
    },
    pending: {
      verdict: 'ESPERAR — Evento de máximo impacto',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Decisión de tipos: no operar antes ni durante',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Resultado binario: hawkish/dovish → dirección opuesta', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Volatilidad extrema: ±2-3% en primeros 5 minutos', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Alta reactividad: mueve en ambas direcciones', strength: 'strong' },
      ],
      context: 'risk-off',
      note: 'Regla absoluta: NO operar 60min antes ni durante el FOMC. Espera al menos 15-30min post-anuncio para operar el afterflow con dirección establecida.',
    },
  },

  'FOMC Minutes': {
    hawkish: {
      verdict: 'NO OPERAR — Minutes con tono hawkish',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Minutes revelan debate interno hawkish → recortes más lejanos',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Tono duro en Minutes → tipos altos por más tiempo → USD fuerte', strength: 'moderate' },
        { asset: 'NQ',  dir: 'down', reason: 'Recortes se alejan → presión en múltiplos de growth', strength: 'moderate' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte + tasas reales altas presionan el oro', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'Busca palabras clave hawkish: "inflation not yet convinced", "further progress needed", "higher for longer". Son las que mueven el mercado.',
    },
    dovish: {
      verdict: 'OPORTUNIDAD — Minutes con tono dovish',
      verdictClass: 'trade',
      verdictIcon: '◉',
      verdictSub: 'Minutes revelan debate hacia recortes → mercado se anima',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Debate dovish en el seno de la Fed → USD se debilita', strength: 'moderate' },
        { asset: 'NQ',  dir: 'up',   reason: 'Recortes más próximos → rally en growth y tech', strength: 'moderate' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + expectativas dovish → oro al alza', strength: 'moderate' },
      ],
      context: 'risk-on',
      note: 'Busca frases dovish: "gaining confidence", "appropriate to begin reducing", "balanced risks". Son el catalizador del movimiento alcista.',
    },
    pending: {
      verdict: 'ESPERAR — Evento de alto impacto',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Minutes en breve: no tomar posiciones',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Hawkish → USD sube / Dovish → USD cae', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Alta sensibilidad al tono de política monetaria', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Dependerá del tono sobre tasas reales', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'Los Minutes revelan el debate interno del FOMC. Busca palabras clave: "inflation persistent", "data dependent", "restrictive". Operar el afterflow.',
    },
  },

  'Fed Speech (Warsh)': {
    hawkish: {
      verdict: 'NO OPERAR — Warsh hawkish',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Warsh con tono duro → mercado repricia tasas al alza',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Tono hawkish de Warsh → tipos altos sostenidos → USD fuerte', strength: 'strong' },
        { asset: 'NQ',  dir: 'down', reason: 'Recortes se alejan → múltiplos de growth bajo presión', strength: 'strong' },
        { asset: 'GOLD',dir: 'down', reason: 'USD fuerte + tasas reales altas = presión bajista', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'Cuando Warsh es hawkish, el mercado lo toma muy en serio. No intentes contra-operar. Espera hasta que el movimiento se agote y busca el afterflow.',
    },
    dovish: {
      verdict: 'OPORTUNIDAD — Warsh dovish',
      verdictClass: 'trade',
      verdictIcon: '◉',
      verdictSub: 'Warsh con tono suave → mercado repricia recortes más pronto',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Tono dovish → recortes más próximos → USD bajista', strength: 'strong' },
        { asset: 'NQ',  dir: 'up',   reason: 'Tipos a la baja → expansión de múltiplos → rally en tech/growth', strength: 'strong' },
        { asset: 'GOLD',dir: 'up',   reason: 'USD débil + tasas reales bajas = oro alcista', strength: 'strong' },
      ],
      context: 'risk-on',
      note: 'Warsh dovish es uno de los mayores catalizadores alcistas para NQ. Busca entrada larga 15min después de establecida la dirección.',
    },
    pending: {
      verdict: 'ESPERAR — Discurso de máximo impacto',
      verdictClass: 'no-trade',
      verdictIcon: '⊗',
      verdictSub: 'Warsh puede mover mercado ±2% en cualquier dirección',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Hawkish → USD arriba / Dovish → USD abajo', strength: 'strong' },
        { asset: 'NQ',  dir: 'neut', reason: 'Máxima sensibilidad a cualquier cambio de tono', strength: 'strong' },
        { asset: 'GOLD',dir: 'neut', reason: 'Reacción inversa al DXY post-discurso', strength: 'moderate' },
      ],
      context: 'risk-off',
      note: 'No operar durante el discurso. Busca entrada 15min después de que se establezca la dirección. Monitorea las titulares en tiempo real.',
    },
  },

  'Initial Claims': {
    beat: {
      verdict: 'NEUTRAL — Dato secundario',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Claims sobre forecast → leve deterioro laboral',
      signals: [
        { asset: 'USD', dir: 'down', reason: 'Debilidad laboral → opciones de recorte aumentan', strength: 'weak' },
        { asset: 'NQ',  dir: 'up',   reason: 'Leve soporte en expectativas de corte', strength: 'weak' },
        { asset: 'GOLD',dir: 'neut', reason: 'Sin impacto relevante por sí solo', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Dato semanal de segundo nivel. Solo relevante si es sorpresa grande (+50K vs forecast). En contexto de datos mayores esta semana, subordinado.',
    },
    miss: {
      verdict: 'NEUTRAL — Mercado laboral robusto',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Claims bajo forecast → empleo sigue fuerte',
      signals: [
        { asset: 'USD', dir: 'up',   reason: 'Empleo fuerte = Fed sin excusa para recortar', strength: 'weak' },
        { asset: 'NQ',  dir: 'neut', reason: 'Impacto menor, subordinado a otros datos', strength: 'weak' },
        { asset: 'GOLD',dir: 'neut', reason: 'Sin impacto directo significativo', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'No cambies tu sesgo macro por este dato. Útil para confirmar tendencia pero no para definirla.',
    },
    pending: {
      verdict: 'MONITOREAR — Claims pendiente',
      verdictClass: 'caution',
      verdictIcon: '◈',
      verdictSub: 'Solicitudes de desempleo: termómetro semanal del mercado laboral',
      signals: [
        { asset: 'USD', dir: 'neut', reason: 'Impacto limitado salvo sorpresa significativa', strength: 'weak' },
        { asset: 'NQ',  dir: 'neut', reason: 'Dato de segundo nivel, orientativo', strength: 'weak' },
        { asset: 'GOLD',dir: 'neut', reason: 'Sin impacto directo relevante', strength: 'weak' },
      ],
      context: 'neutral',
      note: 'Dato semanal orientativo. Relevante en tendencia (varias semanas al alza/baja) más que en lecturas individuales.',
    },
  },
}

// ── Puente con la Knowledge Base ────────────────────────────────
// Si no hay una regla hardcodeada en RULES, pero SÍ hay una ficha guardada
// en la Knowledge Base (conocimiento permanente por evento), se usa esa
// ficha para construir una interpretación real en vez del mensaje genérico.

function hasUsableKnowledge(kb: KnowledgeEntry): boolean {
  return !!(kb.narrative || kb.description || kb.scenarioPositive || kb.scenarioNegative || kb.scenarioNeutral)
}

function interpretationFromKnowledge(event: MacroEvent, kb: KnowledgeEntry): Interpretation {
  const direction = event.direction ?? 'pending'
  const pending = !event.direction || direction === 'pending'

  let verdict: string
  let verdictClass: VerdictClass = 'caution'
  let context: MarketContextRegime = 'neutral'
  let note: string
  let signalDir: MacroSignal['dir'] = 'neut'

  if (pending) {
    verdict = 'Pendiente de publicación'
    note = kb.narrative || kb.description || 'Sin narrativa registrada todavía en la Knowledge Base.'
  } else if (direction === 'beat' || direction === 'dovish') {
    verdict = 'Sesgo positivo — Knowledge Base'
    verdictClass = 'trade'; context = 'risk-on'; signalDir = 'up'
    note = kb.scenarioPositive || kb.narrative || kb.description || ''
  } else if (direction === 'miss' || direction === 'hawkish') {
    verdict = 'Sesgo negativo — Knowledge Base'
    verdictClass = 'trade'; context = 'risk-off'; signalDir = 'down'
    note = kb.scenarioNegative || kb.narrative || kb.description || ''
  } else {
    verdict = 'Dato en línea — Knowledge Base'
    note = kb.scenarioNeutral || kb.narrative || kb.description || ''
  }

  const strength: MacroSignal['strength'] = kb.importance === 'high' ? 'strong' : kb.importance === 'low' ? 'weak' : 'moderate'
  const signals: MacroSignal[] = (kb.affectedAssets ?? []).map(asset => ({
    asset, dir: pending ? 'neut' : signalDir,
    reason: kb.description ? kb.description.slice(0, 90) : 'Según la Knowledge Base',
    strength,
  }))

  return {
    verdict,
    verdictClass,
    verdictIcon: pending ? '⏳' : '📚',
    verdictSub: `${event.name} — desde Knowledge Base`,
    signals,
    context,
    note,
  }
}

// ── Fallback ──────────────────────────────────────────────────

function fallbackInterpretation(event: MacroEvent, reason: 'no-rule' | 'no-direction'): Interpretation {
  if (reason === 'no-rule') {
    return {
      verdict: 'Sin regla configurada',
      verdictClass: 'caution',
      verdictIcon: '?',
      verdictSub: `No hay reglas para "${event.name}"`,
      signals: [],
      context: 'neutral',
      note: 'Añade una regla en interpretationEngine.ts para este evento. Usa el Mentor macro (IA) para el análisis institucional completo.',
    }
  }
  // Pending sin regla específica → mensaje útil en vez de error
  if (!event.direction || event.direction === 'pending') {
    return {
      verdict: 'Pendiente de publicación',
      verdictClass: 'caution',
      verdictIcon: '⏳',
      verdictSub: `${event.name} — dato aún no publicado`,
      signals: [],
      context: 'neutral',
      note: 'Cuando se publique el dato, introduce el resultado con "Introducir resultado" para ver el análisis completo. Usa Mentor macro (IA) para preparación previa.',
    }
  }
  return {
    verdict: 'Dirección no configurada',
    verdictClass: 'caution',
    verdictIcon: '?',
    verdictSub: `No hay regla para dirección "${event.direction}"`,
    signals: [],
    context: 'neutral',
    note: 'Amplía las reglas en interpretationEngine.ts.',
  }
}

export function interpretEvent(event: MacroEvent | null | undefined): Interpretation | null {
  if (!event) return null
  const rule = RULES[event.name]
  if (!rule) {
    const kb = knowledgeStore.get(event.name)
    if (kb && hasUsableKnowledge(kb)) return interpretationFromKnowledge(event, kb)
    return fallbackInterpretation(event, 'no-rule')
  }
  const direction: EventDirection = event.direction ?? 'pending'
  const interp = rule[direction] ?? rule.pending
  if (!interp) return fallbackInterpretation(event, 'no-direction')
  return interp
}
