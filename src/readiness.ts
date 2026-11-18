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

/** Cuántas cuentas activas tienes de cada tipo. */
export interface Fases { fondeada: number; challenge: number; personal: number }

/**
 * Consejo de riesgo por tipo de cuenta: las fondeadas son las que más cuesta
 * perder, así que en días flojos se protegen primero. Nunca dice qué operar.
 */
export function consejoCuentas(v: Veredicto, f: Fases | undefined): string | null {
  if (!f || v === 'ready') return null
  const { fondeada: fu, challenge: ch } = f
  const funded = `${fu} funded`
  if (v === 'not-ready') {
    if (fu > 0) return `💼 Con ${funded}, hoy mejor no tocarlas. Si operas, que sea solo en ${ch ? 'las challenge' : 'la cuenta que menos te juegues'} y con tamaño mínimo.`
    return '💼 Hoy mejor no operar ninguna cuenta, o solo con tamaño mínimo.'
  }
  if (fu > 0) return `💼 Tienes ${funded}${ch ? ` y ${ch} en challenge` : ''}: quizá hoy mejor no operar las funded, o con la mitad de tamaño.${ch ? ' En las challenge, espera confirmación.' : ''}`
  return ch ? '💼 En las challenge, menos tamaño y espera confirmación antes de entrar.' : null
}

/** Bloque de texto para el mensaje. Sin check-in, el veredicto es solo del mercado y lo dice. */
export function describirReadiness(mercado: Nota, trader: Nota | null, fases?: Fases): string[] {
  const v = veredicto(mercado, trader)
  const lineas = [
    `🧭 *Daily Trading Readiness: ${ETIQUETA[v]}*`,
    `Mercado ${mercado.nota}/100${mercado.motivos.length ? ` (${mercado.motivos.join('; ')})` : ''}`,
    trader
      ? `Tú ${trader.nota}/100${trader.motivos.length ? ` (${trader.motivos.join(', ')})` : ''}`
      : 'Tú: pendiente de tu check-in, contéstame y te doy el veredicto completo.',
    EXPLICA[v],
  ]
  const consejo = consejoCuentas(v, fases)
  if (consejo) lineas.push(consejo)
  return lineas
}
