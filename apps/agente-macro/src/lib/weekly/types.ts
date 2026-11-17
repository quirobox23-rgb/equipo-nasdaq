// Tipos del Análisis Semanal de NQ (mismo esquema que el PDF semanal).

export interface Level {
  zona: string     // "29.600–29.800"
  lectura: string  // "Primera resistencia de rebote; observar rechazo o aceptación."
}

/** Gráfico del analista: link de una captura (o idea) de TradingView. */
export interface Chart {
  activo?: string        // "MNQ" (botones o a mano)
  temporalidad?: string  // "15 min"
  titulo: string         // qué muestra, opcional: "Zonas del miércoles"
  link: string           // https://www.tradingview.com/x/T9m9ZLHB/
  nota: string
}

export interface WeeklyAnalysis {
  semana: string                // "19–23 de octubre de 2026"
  monday: string                // YYYY-MM-DD
  idea_central: string
  catalizadores: { catalizador: string; significado: string }[]
  calendario: { dia: string; eventos: string; pregunta: string }[]
  earnings: { empresa: string; observar: string; importancia: string }[]
  earnings_ejemplo: string
  opex_vix: string
  macro: string
  niveles: Level[]
  graficos?: Chart[]            // los análisis viejos no lo tienen
  ejemplos: { titulo: string; texto: string }[]
  escenarios: { escenario: string; condicion: string; referencias: string }[]
  lectura_por_dia: string
  checklist: string[]
  conclusion: string
  generadoEn: string            // ISO
  publicadoEn?: string          // ISO
  /** Apartado → cuándo el analista lo cambió avisando a los alumnos (ISO). Se vacía al publicar. */
  novedades?: Record<string, string>
}

/** Datos reales de la semana con los que se escribe el análisis. */
export interface WeeklyData {
  monday: string
  semana: string
  events: { date: string; time?: string; name: string; impact?: string }[]
  earnings: { symbol: string; date: string; hour: string }[]
  opex: { mensual: string | null; semanal: string; vix: string | null }
  macro: { serie: string; nombre: string; ultimo: number | null; cambioSemana: number | null; fecha: string | null }[]
  nq: {
    precio: number | null
    fecha: string | null
    semanaAnterior: { alto: number; bajo: number; cierre: number } | null
    rangoMedioSemanal: number | null
  }
  nivelesPropuestos: Level[]
  avisos: string[]              // qué fuente no respondió
}
