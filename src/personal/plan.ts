// Tu plan de riesgo (config/plan.json). El mentor te lo recuerda cada mañana
// junto con el resultado de ayer, y el coach marca cuando te sales de él:
// SL alargado, cierre antes de tiempo o break-even, operar con el día
// cerrado y días por encima del tope. Nunca dice qué operar.
import { promises as fs } from 'node:fs'
import { config } from '../config.ts'

export interface PlanTrading {
  funded: { sl: number; tp: number; breakEven: boolean; perdidaCierraDia: boolean; consistencia: number; objetivo: number }
  challenge: { sl: number; perdidaDiariaMax: number; ciclos: { nombre: string; tp: number }[]; consistencia: number }
  /** Tolerancia para no marcar por unos dólares de deslizamiento o comisiones (0,15 = 15 %). */
  margen: number
}

export const PLAN_POR_DEFECTO: PlanTrading = {
  funded: { sl: 240, tp: 440, breakEven: false, perdidaCierraDia: true, consistencia: 0.2, objetivo: 2200 },
  challenge: { sl: 800, perdidaDiariaMax: 1000, ciclos: [{ nombre: 'ratio negativo', tp: 400 }, { nombre: 'ratio positivo', tp: 800 }], consistencia: 0.45 },
  margen: 0.15,
}

export async function cargarPlan(): Promise<PlanTrading> {
  try {
    const p = JSON.parse(await fs.readFile(config.planArchivo, 'utf-8')) as Partial<PlanTrading>
    return {
      funded: { ...PLAN_POR_DEFECTO.funded, ...p.funded },
      challenge: { ...PLAN_POR_DEFECTO.challenge, ...p.challenge },
      margen: p.margen ?? PLAN_POR_DEFECTO.margen,
    }
  } catch {
    return PLAN_POR_DEFECTO
  }
}

/** Una operación cerrada, con su cuenta y su fase. */
export interface Operacion {
  cuenta: string
  fase?: 'challenge' | 'fondeada' | 'personal'
  fecha: string
  hora?: string
  dolares: number
  /** Objetivo de la cuenta (challenge), para el tope de consistencia. */
  objetivoCuenta?: number
}

const usd = (x: number) => `${x < 0 ? '-' : ''}${Math.abs(Math.round(x)).toLocaleString('es-ES')} $`
const BE = 25 // por debajo de esto, a efectos prácticos, es un break-even

/** Lo que el coach ve en un día: una línea por cada vez que te saliste del plan. */
export function revisarDia(ops: Operacion[], plan: PlanTrading): string[] {
  const out: string[] = []
  const porCuenta = new Map<string, Operacion[]>()
  for (const o of ops) porCuenta.set(o.cuenta, [...(porCuenta.get(o.cuenta) ?? []), o])
  for (const [cuenta, lista] of porCuenta) {
    const dia = [...lista].sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
    const fase = dia[0].fase
    const total = dia.reduce((s, o) => s + o.dolares, 0)
    const m = 1 + plan.margen
    if (fase === 'fondeada') {
      const f = plan.funded
      const largas = dia.filter(o => o.dolares < -f.sl * m)
      if (largas.length) out.push(`${cuenta}: perdiste ${usd(-Math.min(...largas.map(o => o.dolares)))} en una operación con SL de ${usd(f.sl)}. Eso es un SL alargado.`)
      const cortas = dia.filter(o => o.dolares > BE && o.dolares < f.tp / m)
      if (cortas.length) out.push(`${cuenta}: cerraste ${cortas.length === 1 ? 'una ganadora' : `${cortas.length} ganadoras`} antes del TP (${cortas.map(o => usd(o.dolares)).join(', ')} de ${usd(f.tp)}). O TP o SL.`)
      const bes = dia.filter(o => Math.abs(o.dolares) <= BE)
      if (!f.breakEven && bes.length) out.push(`${cuenta}: ${bes.length === 1 ? 'una operación cerrada' : `${bes.length} operaciones cerradas`} en break-even. Tu plan es sin BE.`)
      const iPerdida = dia.findIndex(o => o.dolares < -BE)
      if (f.perdidaCierraDia && iPerdida >= 0 && iPerdida < dia.length - 1) out.push(`${cuenta}: seguiste operando después de una pérdida (${dia.length - 1 - iPerdida} más). Con una pérdida, el día estaba cerrado.`)
      const tope = f.consistencia * f.objetivo
      if (total > tope * m) out.push(`${cuenta}: día de ${usd(total)}, por encima de tu tope de ${usd(tope)} (consistencia ${Math.round(f.consistencia * 100)} %).`)
    } else if (fase === 'challenge') {
      const c = plan.challenge
      const largas = dia.filter(o => o.dolares < -c.sl * m)
      if (largas.length) out.push(`${cuenta}: perdiste ${usd(-Math.min(...largas.map(o => o.dolares)))} con SL de ${usd(c.sl)}. Eso es un SL alargado.`)
      if (total < -c.perdidaDiariaMax) out.push(`${cuenta}: día de ${usd(total)}, por encima de tu pérdida diaria máxima de ${usd(c.perdidaDiariaMax)}.`)
      const tpMin = Math.min(...c.ciclos.map(x => x.tp))
      const cortas = dia.filter(o => o.dolares > BE && o.dolares < tpMin / m)
      if (cortas.length) out.push(`${cuenta}: cerraste antes del TP (${cortas.map(o => usd(o.dolares)).join(', ')}; tu TP mínimo es ${usd(tpMin)}).`)
      const objetivo = dia[0].objetivoCuenta
      if (objetivo && total > c.consistencia * objetivo * m) out.push(`${cuenta}: día de ${usd(total)}, por encima del ${Math.round(c.consistencia * 100)} % del objetivo (${usd(c.consistencia * objetivo)}).`)
      const perdidas = dia.filter(o => o.dolares < -BE).length
      if (perdidas >= 2) out.push(`${cuenta}: ${perdidas} pérdidas en el mismo día. Ojo con querer recuperar.`)
    }
  }
  return out
}

/** "Ayer: funded -240 $ (1 operación), challenge +400 $ (1 operación)." */
export function resultadoDelDia(ops: Operacion[]): string | null {
  if (!ops.length) return null
  const partes: string[] = []
  for (const [fase, nombre] of [['fondeada', 'funded'], ['challenge', 'challenge'], ['personal', 'cuenta propia']] as const) {
    const de = ops.filter(o => o.fase === fase)
    if (!de.length) continue
    const total = de.reduce((s, o) => s + o.dolares, 0)
    partes.push(`${nombre} ${total >= 0 ? '+' : ''}${usd(total)} (${de.length} ${de.length === 1 ? 'operación' : 'operaciones'})`)
  }
  return partes.length ? partes.join(', ') : null
}

/** Recordatorio corto del plan, igual todos los días a propósito. */
export function recordatorioPlan(plan: PlanTrading): string {
  const f = plan.funded, c = plan.challenge
  return [
    `Funded: SL ${usd(f.sl)} y TP ${usd(f.tp)}, ${f.breakEven ? '' : 'sin break-even, '}o TP o SL${f.perdidaCierraDia ? '; si la primera es pérdida, día cerrado' : ''}.`,
    `Challenge: SL ${usd(c.sl)}, máximo ${usd(c.perdidaDiariaMax)} de pérdida al día, TP ${c.ciclos.map(x => usd(x.tp)).join(' o ')}.`,
    'No recuperes ni aprietes: el plan de hoy es el mismo que ayer.',
  ].join(' ')
}

/** Bloque 📋 del mensaje de la mañana: ayer, lo que vio el coach y el plan de hoy. */
export function bloqueMentor(opsAyer: Operacion[], plan: PlanTrading): string[] {
  const lineas: string[] = []
  const ayer = resultadoDelDia(opsAyer)
  lineas.push(`📋 *Ayer:* ${ayer ?? 'sin operaciones.'}`)
  const fallos = revisarDia(opsAyer, plan)
  if (fallos.length) lineas.push(`🧑‍🏫 *El coach vio:* ${fallos.join(' ')}`)
  else if (opsAyer.length) lineas.push('🧑‍🏫 *El coach vio:* ayer cumpliste el plan. Así se pasa.')
  lineas.push(`🎯 *Hoy:* ${recordatorioPlan(plan)}`)
  return lineas
}

/** Un aviso de Atractor durante la sesión. La clave evita repetirlo. */
export interface AvisoEnVivo { clave: string; texto: string }

/**
 * Atractor mira tus operaciones de hoy mientras operas y te escribe en el
 * momento del impulso: tras la primera perdedora en una funded, si vuelves a
 * entrar con el día cerrado, si un SL se ha alargado o si una challenge llega
 * a su pérdida diaria. Mensajes cortos y literales, sin pasar por la IA.
 */
export function avisosEnVivo(ops: Operacion[], plan: PlanTrading): AvisoEnVivo[] {
  const out: AvisoEnVivo[] = []
  const porCuenta = new Map<string, Operacion[]>()
  for (const o of ops) porCuenta.set(o.cuenta, [...(porCuenta.get(o.cuenta) ?? []), o])
  const m = 1 + plan.margen
  for (const [cuenta, lista] of porCuenta) {
    const dia = [...lista].sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
    const fase = dia[0].fase
    const sl = fase === 'fondeada' ? plan.funded.sl : fase === 'challenge' ? plan.challenge.sl : undefined
    for (const o of dia) {
      if (sl && o.dolares < -sl * m) {
        out.push({ clave: `sl-largo:${cuenta}:${o.hora ?? ''}:${o.dolares}`, texto: `⚠️ ${cuenta}: esa pérdida es de ${usd(-o.dolares)} y tu SL es ${usd(sl)}. El stop no se mueve.` })
      }
    }
    if (fase === 'fondeada' && plan.funded.perdidaCierraDia) {
      const i = dia.findIndex(o => o.dolares < -BE)
      if (i === 0) out.push({ clave: `cerrado:${cuenta}`, texto: `🛑 ${cuenta}: primera perdedora (${usd(dia[0].dolares)}). Día cerrado en esta cuenta. No hay que recuperar nada hoy; mañana, el mismo plan.` })
      if (i >= 0 && dia.length - 1 > i) {
        const mas = dia.length - 1 - i
        out.push({ clave: `tras-cierre:${cuenta}:${mas}`, texto: `🛑 ${cuenta}: has vuelto a entrar con el día cerrado (${mas === 1 ? '1 operación más' : `${mas} operaciones más`}). Cierra la plataforma; lo que toca hoy ya está hecho.` })
      }
    }
    if (fase === 'challenge') {
      const total = dia.reduce((s, o) => s + o.dolares, 0)
      const max = plan.challenge.perdidaDiariaMax
      if (total <= -max) out.push({ clave: `max-diario:${cuenta}`, texto: `🛑 ${cuenta}: llevas ${usd(total)} hoy, tu pérdida diaria máxima es ${usd(max)}. Día cerrado en esta cuenta.` })
      const perdidas = dia.filter(o => o.dolares < -BE).length
      if (perdidas >= 2 && total > -max) out.push({ clave: `dos-perdidas:${cuenta}`, texto: `✋ ${cuenta}: segunda pérdida de hoy. Es el momento en que se quiere recuperar; para aquí.` })
    }
  }
  return out
}
