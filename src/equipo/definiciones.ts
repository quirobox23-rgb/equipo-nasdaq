// Plantillas de equipo. Cada activo es una plantilla: mismo tipo de
// especialistas (gráfico, estructura, volumen, volatilidad, noticias, macro),
// distintos datos. Añadir un activo = añadir una entrada aquí.

export interface DefinicionEquipo {
  id: string
  nombre: string
  /** Símbolo de precio en Yahoo Finance. */
  simbolo: string
  /** Índice de volatilidad de referencia en Yahoo Finance. */
  simboloVolatilidad: string
  nombreVolatilidad: string
  /** Palabras clave y peso para filtrar titulares. */
  reglasNoticias: [RegExp, number][]
  /** Puntos que cuentan como "cerca" de un nivel si la estrategia no dice otra cosa. */
  distanciaCerca: number
}

const COMUNES: [RegExp, number][] = [
  [/\b(Warsh|Powell|Fed Chair|FOMC|Federal Reserve|the Fed)\b/i, 3],
  [/\b(rate (cut|hike)|interest rates?|emergency|inter-meeting)\b/i, 2],
  [/\b(China|Taiwan|Iran|Russia|war|missile|attack|invasion)\b/i, 2],
  [/\b(shutdown|default|debt ceiling|downgrade|bank (run|failure)|crash|plunge|sell-?off|halt(ed)?)\b/i, 3],
  [/\b(CPI|inflation|jobs report|payrolls|unemployment|GDP|recession)\b/i, 2],
  [/\b(Trump|White House|Treasury|Bessent)\b/i, 1],
]

export const EQUIPOS: Record<string, DefinicionEquipo> = {
  nasdaq: {
    id: 'nasdaq',
    nombre: 'Nasdaq',
    simbolo: 'NQ=F',
    simboloVolatilidad: '^VIX',
    nombreVolatilidad: 'VIX',
    distanciaCerca: 20,
    reglasNoticias: [
      ...COMUNES,
      [/\b(tariffs?|export (controls|ban)|sanctions?|trade war)\b/i, 3],
      [/\b(Nvidia|NVDA|Apple|Microsoft|Amazon|Alphabet|Google|Meta|Tesla|Broadcom|TSMC|semiconductors?|chips?)\b/i, 2],
      [/\b(Nasdaq|tech stocks|S&P 500|Wall Street|futures)\b/i, 1],
    ],
  },
  gold: {
    id: 'gold',
    nombre: 'Oro',
    simbolo: 'GC=F',
    simboloVolatilidad: '^GVZ',
    nombreVolatilidad: 'GVZ',
    distanciaCerca: 3,
    reglasNoticias: [
      ...COMUNES,
      [/\b(gold|bullion|precious metals?|central bank (buying|purchases))\b/i, 3],
      [/\b(dollar|DXY|Treasury yields?|real yields?)\b/i, 2],
      [/\b(safe[- ]haven|geopolitical)\b/i, 2],
    ],
  },
}

export function equiposActivos(): DefinicionEquipo[] {
  const ids = (process.env.EQUIPOS ?? 'nasdaq').split(',').map(s => s.trim()).filter(Boolean)
  return ids.map(id => {
    const e = EQUIPOS[id]
    if (!e) throw new Error(`Equipo desconocido: ${id}. Disponibles: ${Object.keys(EQUIPOS).join(', ')}`)
    return e
  })
}
