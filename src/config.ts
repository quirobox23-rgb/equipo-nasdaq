// Configuración de la oficina. Todo sale de variables de entorno (archivo .env
// en el servidor) para no guardar claves en el repositorio.

function num(v: string | undefined, def: number): number {
  const n = Number(v)
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : def
}

export const config = {
  /** Zona horaria de lola: en ella se escriben las horas de los mensajes. */
  tzUsuaria: process.env.TZ_USUARIA ?? 'Europe/Madrid',
  /** El mercado manda: la vigilancia va en hora de Nueva York (cambios de hora incluidos). */
  tzMercado: 'America/New_York',

  anthropicKey: process.env.ANTHROPIC_API_KEY,
  modeloRedactor: process.env.MODELO_REDACTOR ?? 'claude-sonnet-5-5',
  modeloFiltro: process.env.MODELO_FILTRO ?? 'claude-haiku-5-5',

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    /** Número de lola en formato internacional sin "+", p. ej. 34600111222. */
    destino: process.env.WHATSAPP_DESTINO,
    /** Plantilla aprobada en Meta para escribir fuera de la ventana de 24 h. */
    plantilla: process.env.WHATSAPP_PLANTILLA ?? 'aviso_oficina',
    idiomaPlantilla: process.env.WHATSAPP_PLANTILLA_IDIOMA ?? 'es',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
  },

  factorMacro: {
    url: process.env.FACTOR_MACRO_URL ?? 'https://factormacro.santostrader.com',
    /** Clave de equipo de Factor Macro, para leer el briefing semanal de Nova. Opcional. */
    clave: process.env.FACTOR_MACRO_CLAVE,
  },

  noticiasFeeds: (process.env.NOTICIAS_FEEDS ?? [
    'https://www.federalreserve.gov/feeds/press_all.xml',
    'https://www.federalreserve.gov/feeds/speeches.xml',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://www.cnbc.com/id/20910258/device/rss/rss.html',
    'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  ].join(',')).split(',').map(s => s.trim()).filter(Boolean),

  dataDir: process.env.DATA_DIR ?? './data',
  cuentasArchivo: process.env.CUENTAS_ARCHIVO ?? './config/cuentas.json',
  puerto: num(process.env.PORT, 3000),
  maxAvisosPorHora: num(process.env.MAX_AVISOS_HORA, 4),
  /** Sin WhatsApp configurado, o con DRY_RUN=1, los mensajes salen por consola. */
  dryRun: process.env.DRY_RUN === '1',
}
