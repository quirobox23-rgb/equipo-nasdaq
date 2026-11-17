// Daily Trading Readiness: dos notas separadas, una del mercado y otra tuya,
// y un veredicto (Ready / Caution / Not Ready) que siempre explica por qué.
// No es una predicción de rentabilidad ni un diagnóstico: es una ayuda para
// decidir si hoy conviene operar, y con cuánto cuidado.
import { aptitud, type CheckIn } from './personal/coach.ts'
import type { AgenteId, Hallazgo } from './tipos.ts'

export type Veredicto = 'ready' | 'caution' | 'not-ready'

export interface Nota { nota: number; motivos: string[] }

const MERCADO: AgenteId[] = ['macro', 'fed', 'earnings', 'volatilidad', 'volumen', 'grafico', 'noticias', 'estructura']

/** Contexto de mercado, 0-100. Parte de 100 y resta por cada aviso de riesgo del día (los de tu estrategia no cuentan). */
export function marketReadiness(h: Hallazgo[]): Nota {
  let nota = 100
  const motivos: string[] = []
  for (const x of h) {
    if (x.estrategia || !MERCADO.includes(x.agente) || x.nivel === 'info') continue
    nota -= x.nivel === 'alerta' ? 15 : 6
    if (motivos.length < 3) motivos.push(resumir(x.titulo))
  }
  return { nota: Math.max(0, nota), motivos }
}

/** Preparación personal, 0-100: tu aptitud del check-in y el estado de tus cuentas. */
export function traderReadiness(c: CheckIn | undefined, cuentas: Hallazgo[]): Nota | null {
  if (!c) return null
  const a = aptitud(c)
  let nota = a.nota
  const motivos = [...a.motivos]
  for (const x of cuentas) {
    if (x.agente !== 'cuentas' || x.nivel === 'info') continue
    nota -= x.nivel === 'alerta' ? 25 : 10
    motivos.push(resumir(x.titulo))
  }
  return { nota: Math.max(0, nota), motivos }
}

export function veredicto(mercado: Nota, trader: Nota | null): Veredicto {
  const peor = Math.min(mercado.nota, trader?.nota ?? 100)
  return peor >= 75 ? 'ready' : peor >= 50 ? 'caution' : 'not-ready'
}

const ETIQUETA: Record<Veredicto, string> = { ready: '🟢 Ready', caution: '🟠 Caution', 'not-ready': '🔴 Not Ready' }
const EXPLICA: Record<Veredicto, string> = {
  ready: 'Condiciones normales. Opera tu plan; no hay obligación de operar.',
  caution: 'Opera con cuidado: menos tamaño, menos operaciones y espera confirmaciones.',
  'not-ready': 'Hoy mejor no operar, o solo con tamaño mínimo. Mañana habrá más oportunidades.',
}

function resumir(t: string): string {
  const corto = t.split(/[.:]/)[0].trim()
  return corto.length > 70 ? `${corto.slice(0, 67)}…` : corto
}

/** Bloque de texto para el mensaje. Sin check-in, el veredicto es solo del mercado y lo dice. */
export function describirReadiness(mercado: Nota, trader: Nota | null): string[] {
  const v = veredicto(mercado, trader)
  const lineas = [
    `🧭 *Daily Trading Readiness: ${ETIQUETA[v]}*`,
    `Mercado ${mercado.nota}/100${mercado.motivos.length ? ` (${mercado.motivos.join('; ')})` : ''}`,
    trader
      ? `Tú ${trader.nota}/100${trader.motivos.length ? ` (${trader.motivos.join(', ')})` : ''}`
      : 'Tú: pendiente de tu check-in, contéstame y te doy el veredicto completo.',
    EXPLICA[v],
  ]
  return lineas
}
