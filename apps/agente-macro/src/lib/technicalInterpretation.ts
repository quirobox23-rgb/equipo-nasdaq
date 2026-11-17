import type { AssetTechnicalContext } from '@/lib/dataProvider/TechnicalContext'

export interface LevelInfo {
  key:   'pdh' | 'pdl' | 'pwh' | 'pwl' | 'pmh' | 'pml'
  label: string
  value: number | null | undefined
}

// Solo estos 6 niveles tienen "distancia" — el resto (Asia/Frankfurt/London/VWAP/Open)
// son contexto de sesión, no niveles de referencia para la distancia.
export function getDistanceLevels(ctx: AssetTechnicalContext): LevelInfo[] {
  return [
    { key: 'pdh', label: 'PDH (máximo de ayer)',        value: ctx.daily.pdh },
    { key: 'pdl', label: 'PDL (mínimo de ayer)',         value: ctx.daily.pdl },
    { key: 'pwh', label: 'Weekly High (PWH)',            value: ctx.weekly.pwh },
    { key: 'pwl', label: 'Weekly Low (PWL)',             value: ctx.weekly.pwl },
    { key: 'pmh', label: 'Monthly High (PMH)',           value: ctx.weekly.pmh },
    { key: 'pml', label: 'Monthly Low (PML)',            value: ctx.weekly.pml },
  ]
}

export interface Distance {
  label: string
  value: number | null      // el nivel en sí
  pct:   number | null      // % de distancia — null si falta el precio actual o el nivel
}

export function computeDistances(ctx: AssetTechnicalContext): Distance[] {
  const price = ctx.daily.currentPrice
  return getDistanceLevels(ctx).map(l => {
    const hasBoth = price != null && l.value != null
    return {
      label: l.label,
      value: l.value ?? null,
      pct: hasBoth ? ((l.value! - price!) / price!) * 100 : null,
    }
  })
}

/**
 * Interpretación en frases — solo con datos realmente introducidos.
 * `mainEventName` es opcional y, si se pasa, viene de datos reales de la
 * semana (nunca se inventa un catalizador).
 */
export function buildInterpretationLines(ctx: AssetTechnicalContext, mainEventName?: string | null): string[] {
  const price = ctx.daily.currentPrice
  if (price == null) {
    return ['Introduce el precio actual para calcular distancias e interpretación.']
  }

  const distances = computeDistances(ctx).filter(d => d.pct != null)
  if (distances.length === 0) {
    return ['Introduce al menos un nivel (PDH, PDL, PWH, PWL, PMH o PML) para generar la interpretación.']
  }

  const lines: string[] = []

  // Frase por cada nivel disponible, la más cercana primero
  const sorted = [...distances].sort((a, b) => Math.abs(a.pct!) - Math.abs(b.pct!))
  for (const d of sorted) {
    // pct > 0 = el nivel está por encima del precio, o sea el precio está por debajo.
    const dir = d.pct! >= 0 ? 'por debajo' : 'por encima'
    lines.push(`El precio cotiza un ${Math.abs(d.pct!).toFixed(2)}% ${dir} del ${d.label}.`)
  }

  // Rango semanal, solo si PWH y PWL están ambos disponibles
  const pwh = ctx.weekly.pwh, pwl = ctx.weekly.pwl
  if (pwh != null && pwl != null) {
    const inRange = price <= pwh && price >= pwl
    lines.push(inRange
      ? 'El mercado permanece dentro del rango semanal.'
      : 'El precio cotiza fuera del rango semanal (PWL–PWH).')
  }

  // Siguiente nivel institucional relevante — el más cercano de todos
  const nearest = sorted[0]
  lines.push(`El siguiente nivel institucional relevante es ${nearest.label}.`)

  // Catalizador real de la semana, si se pasa — nunca inventado
  if (mainEventName) {
    lines.push(`Una sorpresa en ${mainEventName} podría provocar ruptura del ${nearest.label}.`)
  }

  return lines
}
