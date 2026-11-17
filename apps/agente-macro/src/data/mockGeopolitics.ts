// Datos simulados — sin feed de noticias/geopolítica conectado todavía. Mismo
// criterio que mockTechnicalLevels.ts: placeholder listo para una fuente real,
// sin cambiar la forma del dato cuando llegue.

export type RiskLevel = 'Alto' | 'Medio' | 'Bajo'

export interface GeopoliticalRegion {
  region:  string
  flag:    string
  situacionActual:   string
  riesgo:            RiskLevel
  impactoEsperado:   string
  activosAfectados:  string[]
}

export const MOCK_GEOPOLITICS: GeopoliticalRegion[] = [
  {
    region: 'Estados Unidos', flag: '🇺🇸',
    situacionActual: 'Debate fiscal en el Congreso sobre el techo de gasto, con la Fed manteniendo un tono dependiente de los datos.',
    riesgo: 'Medio',
    impactoEsperado: 'Volatilidad puntual en tramos largos de tasas si se retrasa un acuerdo presupuestario.',
    activosAfectados: ['DXY', 'NQ', 'Bonos 10Y'],
  },
  {
    region: 'Europa', flag: '🇪🇺',
    situacionActual: 'Fragmentación política en varios gobiernos de la eurozona condiciona el margen fiscal conjunto.',
    riesgo: 'Medio',
    impactoEsperado: 'Presión intermitente sobre el euro y el diferencial de deuda periférica.',
    activosAfectados: ['EUR', 'DXY', 'Bonos EU'],
  },
  {
    region: 'China', flag: '🇨🇳',
    situacionActual: 'Estímulos selectivos al sector inmobiliario conviven con fricciones comerciales persistentes con EE. UU.',
    riesgo: 'Alto',
    impactoEsperado: 'Sensibilidad elevada en materias primas industriales y en el sentimiento de mercados emergentes.',
    activosAfectados: ['Oro', 'Cobre', 'AUD'],
  },
  {
    region: 'Japón', flag: '🇯🇵',
    situacionActual: 'El Banco de Japón continúa normalizando su política monetaria de forma gradual.',
    riesgo: 'Bajo',
    impactoEsperado: 'Movimientos acotados en el yen salvo sorpresa en el ritmo de subidas de tasas.',
    activosAfectados: ['JPY', 'Bonos JP'],
  },
  {
    region: 'Oriente Medio', flag: '🛢️',
    situacionActual: 'Tensión geopolítica latente en la región con riesgo de disrupciones puntuales en rutas de suministro energético.',
    riesgo: 'Alto',
    impactoEsperado: 'Repuntes súbitos en el precio del petróleo y flujos hacia activos refugio.',
    activosAfectados: ['Petróleo', 'Oro', 'VIX'],
  },
  {
    region: 'Rusia', flag: '🇷🇺',
    situacionActual: 'Sanciones económicas vigentes mantienen aislado el acceso de Rusia a mercados de capital occidentales.',
    riesgo: 'Medio',
    impactoEsperado: 'Impacto acotado y ya en gran parte descontado por el mercado, salvo escalada.',
    activosAfectados: ['Gas natural', 'Oro'],
  },
]
