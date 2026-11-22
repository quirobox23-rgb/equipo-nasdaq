// Tus operaciones de hoy contadas desde Telegram, para que Guía te avise
// en el momento aunque Factor Métricas solo se actualice con el CSV de la
// noche. Al abrir la sesión Guía te manda un botón por cuenta (TP, SL,
// BE, deshacer); al cerrar cada operación pulsas su resultado. También vale
// escribir "op F1 -300" para un importe concreto.
import { config } from '../config.ts'
import { leer, guardar } from '../almacen.ts'
import { claveDia, hora } from '../tiempo.ts'
import type { Operacion, PlanTrading } from './plan.ts'

export type Fase = Operacion['fase']
export interface CuentaVivo { nombre: string; fase?: Fase }
export interface Boton { texto: string; dato: string }

interface RegistroVivo { dia: string; cuentas: CuentaVivo[]; ops: Operacion[] }

/** Lo que vale cada botón según la fase de la cuenta y tu plan. */
export function opcionesCuenta(c: CuentaVivo, plan: PlanTrading): { id: string; etiqueta: string; dolares: number }[] {
  if (c.fase === 'challenge') {
    return [
      ...plan.challenge.ciclos.map(x => ({ id: `tp${x.tp}`, etiqueta: `✅ ${x.tp}`, dolares: x.tp })),
      { id: 'sl', etiqueta: '❌ SL', dolares: -plan.challenge.sl },
    ]
  }
  return [
    { id: 'tp', etiqueta: '✅ TP', dolares: plan.funded.tp },
    { id: 'sl', etiqueta: '❌ SL', dolares: -plan.funded.sl },
    { id: 'be', etiqueta: '➖ BE', dolares: 0 },
  ]
}

/** Teclado: una fila por cuenta, con su nombre en cada botón para no equivocarse. */
export function tecladoCuentas(cuentas: CuentaVivo[], plan: PlanTrading): Boton[][] {
  return cuentas.map(c => [
    ...opcionesCuenta(c, plan).map(o => ({ texto: `${c.nombre} ${o.etiqueta}`, dato: `op|${c.nombre}|${o.id}` })),
    { texto: '↩️', dato: `op|${c.nombre}|deshacer` },
  ])
}

/** "op|F1|sl" (botón) o "op F1 -300" / "op F1 tp" (texto). */
export function interpretarOperacion(texto: string): { cuenta: string; que: string } | null {
  const b = /^op\|([^|]+)\|(\w+)$/.exec(texto.trim())
  if (b) return { cuenta: b[1], que: b[2].toLowerCase() }
  const t = /^op\s+(\S+)\s+(tp\d*|sl|be|deshacer|[-+]?\d+(?:[.,]\d+)?)$/i.exec(texto.trim())
  return t ? { cuenta: t[1], que: t[2].toLowerCase().replace(',', '.') } : null
}

async function registro(ahora: Date): Promise<RegistroVivo> {
  const dia = claveDia(ahora, config.tzUsuaria)
  const r = await leer<RegistroVivo>('operaciones-vivo', { dia, cuentas: [], ops: [] })
  return r.dia === dia ? r : { dia, cuentas: r.cuentas, ops: [] }
}

/** Guarda las cuentas del día (al abrir la sesión) para poder poner fase a cada botón. */
export async function guardarCuentasVivo(cuentas: CuentaVivo[], ahora = new Date()): Promise<void> {
  await guardar('operaciones-vivo', { ...(await registro(ahora)), cuentas })
}

export async function operacionesVivo(ahora = new Date()): Promise<{ cuentas: CuentaVivo[]; ops: Operacion[] }> {
  const r = await registro(ahora)
  return { cuentas: r.cuentas, ops: r.ops }
}

/** Apunta (o deshace) una operación. Devuelve la línea de confirmación. */
export async function apuntarOperacion(cuenta: string, que: string, plan: PlanTrading, ahora = new Date()): Promise<string> {
  const r = await registro(ahora)
  const c = r.cuentas.find(x => x.nombre.toLowerCase() === cuenta.toLowerCase()) ?? { nombre: cuenta }
  if (que === 'deshacer') {
    const i = r.ops.map(o => o.cuenta).lastIndexOf(c.nombre)
    if (i < 0) return `${c.nombre}: no hay nada que deshacer hoy.`
    const [quitada] = r.ops.splice(i, 1)
    await guardar('operaciones-vivo', r)
    return `↩️ ${c.nombre}: quitada la operación de ${quitada.dolares} $ de las ${quitada.hora}.`
  }
  const opcion = opcionesCuenta(c, plan).find(o => o.id === que)
  const dolares = opcion ? opcion.dolares : Number(que)
  if (!Number.isFinite(dolares)) return 'No lo he entendido. Usa los botones o escribe, por ejemplo: op F1 -240'
  const op: Operacion = { cuenta: c.nombre, fase: c.fase, fecha: r.dia, hora: hora(ahora, config.tzUsuaria), dolares }
  r.ops.push(op)
  await guardar('operaciones-vivo', r)
  const total = r.ops.filter(o => o.cuenta === c.nombre).reduce((s, o) => s + o.dolares, 0)
  return `Apuntado: ${c.nombre} ${dolares >= 0 ? '+' : ''}${dolares} $ a las ${op.hora}. Hoy en esta cuenta: ${total >= 0 ? '+' : ''}${total} $.`
}

/**
 * Operaciones de hoy para Guía: en cada cuenta con algo apuntado desde
 * Telegram mandan esas; en el resto, las de Factor Métricas (sin duplicar
 * cuando por la noche entra el CSV).
 */
export function unirOperaciones(vivo: Operacion[], fm: Operacion[]): Operacion[] {
  const conVivo = new Set(vivo.map(o => o.cuenta))
  return [...vivo, ...fm.filter(o => !conVivo.has(o.cuenta))]
}
