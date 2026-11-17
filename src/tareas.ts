// Las tareas programadas de la oficina. Cada una reúne a los agentes que le
// tocan, pasa los hallazgos al jefe y envía el mensaje.
import { config } from './config.ts'
import { leer, guardar } from './almacen.ts'
import { cargarCalendario, type EventoMacro } from './sources/calendario.ts'
import { cargarVelas, type Vela } from './sources/yahoo.ts'
import { cargarTitulares } from './sources/rss.ts'
import { briefingSemanal } from './sources/factorMacro.ts'
import { agendaDelDia, vigilarMacro } from './agentes/macro.ts'
import { analizarGrafico, describirNiveles } from './agentes/grafico.ts'
import { analizarNoticias } from './agentes/noticias.ts'
import { evaluarBienestar, aptitud, PREGUNTA_CHECKIN, type CheckIn } from './agentes/bienestar.ts'
import { cargarReglas, evaluarCuentas, proveedorManual } from './agentes/cuentas.ts'
import { redactar } from './agentes/jefe.ts'
import { mensajero } from './mensajeria/index.ts'
import type { Hallazgo } from './tipos.ts'
import { APERTURA_ET, claveDia, hora, minutosDelDia } from './tiempo.ts'

async function intentar<T>(nombre: string, f: () => Promise<T>): Promise<T | null> {
  try {
    return await f()
  } catch (e) {
    console.error(`[${nombre}]`, e instanceof Error ? e.message : e)
    return null
  }
}

const sinDatos = (agente: Hallazgo['agente'], que: string): Hallazgo => ({ agente, nivel: 'info', titulo: `No he podido leer ${que} ahora mismo.` })

export async function checkinDeHoy(ahora = new Date()): Promise<CheckIn | undefined> {
  const todos = await leer<Record<string, CheckIn>>('checkins', {})
  return todos[claveDia(ahora, config.tzUsuaria)]
}

async function cuentas(): Promise<Hallazgo[]> {
  return evaluarCuentas(await cargarReglas(), await proveedorManual.leer())
}

async function grafico(ahora: Date) {
  const [nq, vix] = await Promise.all([
    intentar('nq', () => cargarVelas('NQ=F', '5m', '5d')),
    intentar('vix', () => cargarVelas('^VIX', '5m', '5d')),
  ])
  if (!nq) return { niveles: null, hallazgos: [sinDatos('grafico', 'el gráfico del NQ')] }
  return analizarGrafico(nq, vix ?? ([] as Vela[]), ahora)
}

/** 08:30 hora de lola: agenda, niveles, cuentas y pregunta de bienestar. */
export async function guiaDiaria(ahora = new Date()): Promise<string> {
  const cal = await intentar('calendario', () => cargarCalendario())
  const g = await grafico(ahora)
  const h: Hallazgo[] = [
    ...(cal ? agendaDelDia(cal, ahora) : [sinDatos('macro', 'el calendario económico')]),
    ...g.hallazgos,
    ...(await cuentas()),
  ]
  const contexto = [
    g.niveles ? `Niveles NQ: ${describirNiveles(g.niveles)}` : '',
    `💬 ${PREGUNTA_CHECKIN}`,
  ].filter(Boolean)
  return enviar(await redactar('guia', h, contexto, ['Termina con la pregunta de bienestar (💬) tal cual.']))
}

/** 15:00 en España (09:00 Nueva York): qué ha cambiado y cómo llegas. */
export async function preApertura(ahora = new Date()): Promise<string> {
  const [cal, titulares] = await Promise.all([
    intentar('calendario', () => cargarCalendario()),
    intentar('noticias', () => cargarTitulares(config.noticiasFeeds)),
  ])
  const g = await grafico(ahora)
  const vistos = await noticiasVistas()
  const n = titulares ? await analizarNoticias(titulares, ahora, vistos.set, 16 * 60) : { hallazgos: [], revisados: [] }
  await marcarVistas(vistos, n.revisados)
  const restantes = cal ? agendaDelDia(cal, ahora).filter(x => x.nivel !== 'info' || x.titulo.startsWith('Sin datos')) : []
  const h: Hallazgo[] = [
    ...restantes,
    ...(cal ? vigilarMacro(cal, ahora, 45) : []),
    ...g.hallazgos,
    ...n.hallazgos.slice(0, 4),
    ...evaluarBienestar(await checkinDeHoy(ahora)),
    ...(await cuentas()),
  ]
  const contexto = g.niveles ? [`Niveles NQ: ${describirNiveles(g.niveles)}`] : []
  await registrarClaves(h)
  return enviar(await redactar('apertura', h, contexto))
}

/**
 * Cada 5 minutos durante la primera parte de la sesión. Solo escribe si hay
 * algo nuevo de nivel atención o alerta, y con un máximo de avisos por hora.
 */
export async function vigilancia(ahora = new Date()): Promise<string | null> {
  const m = minutosDelDia(ahora, config.tzMercado)
  if (m < APERTURA_ET - 5 || m > APERTURA_ET + 120) return null

  const [cal, titulares] = await Promise.all([
    intentar('calendario', () => cargarCalendario()),
    intentar('noticias', () => cargarTitulares(config.noticiasFeeds)),
  ])
  const g = await grafico(ahora)
  const vistos = await noticiasVistas()
  const n = titulares ? await analizarNoticias(titulares, ahora, vistos.set, 30) : { hallazgos: [], revisados: [] }
  await marcarVistas(vistos, n.revisados)

  const candidatos = [
    ...(cal ? vigilarMacro(cal, ahora) : []),
    ...g.hallazgos,
    ...n.hallazgos,
    ...(await cuentas()),
  ].filter(x => x.nivel !== 'info')

  const nuevos = await filtrarNuevos(candidatos, ahora)
  if (nuevos.length === 0) return null
  await registrarClaves(nuevos, ahora)
  return enviar(await redactar('aviso', nuevos))
}

/** 16:15 Nueva York: cómo fue el día. */
export async function cierre(ahora = new Date()): Promise<string> {
  const g = await grafico(ahora)
  const c = await checkinDeHoy(ahora)
  const h: Hallazgo[] = [...(await cuentas())]
  const contexto = [
    g.niveles?.maxHoy !== undefined ? `Rango de hoy en NQ: ${Math.round(g.niveles.minHoy!)} a ${Math.round(g.niveles.maxHoy)} (medio ${Math.round(g.niveles.rangoMedio ?? 0)}).` : '',
    c ? `Esta mañana su aptitud era ${aptitud(c).nota}/100.` : '',
    '💬 ¿Cómo te has sentido operando hoy? Si quieres, actualiza tus cuentas escribiendo: pnl <cuenta> <resultado>',
  ].filter(Boolean)
  return enviar(await redactar('cierre', h, contexto, ['Termina con la pregunta (💬) tal cual.']))
}

/** Domingo por la tarde: la semana que viene, tus cuentas y cómo has estado. */
export async function resumenSemanal(ahora = new Date()): Promise<string> {
  const proxima = await intentar('calendario', () => cargarCalendario('proximaSemana'))
  const clave = (e: EventoMacro) => `${claveDia(e.fecha, config.tzUsuaria)} ${e.sinHora ? '' : hora(e.fecha, config.tzUsuaria)} ${e.titulo}`
  const importantes = (proxima ?? []).filter(e => e.impacto === 'alto' || e.impacto === 'festivo')
  const h: Hallazgo[] = importantes.map(e => ({ agente: 'macro', nivel: e.impacto === 'festivo' ? 'atencion' : 'info', titulo: clave(e) }))
  if (!proxima) h.push(sinDatos('macro', 'el calendario de la semana que viene'))

  const todos = await leer<Record<string, CheckIn>>('checkins', {})
  const semana = Object.values(todos).filter(c => ahora.getTime() - new Date(c.fecha).getTime() <= 7 * 86_400_000)
  const contexto: string[] = []
  const paraIA: string[] = []
  if (semana.length) {
    const media = Math.round(semana.reduce((s, c) => s + aptitud(c).nota, 0) / semana.length)
    contexto.push(`Esta semana respondió ${semana.length} check-ins; aptitud media ${media}/100.`)
  }
  const nova = await briefingSemanal()
  if (nova) paraIA.push(`Briefing semanal de Factor Macro (Nova), resúmelo en 3-4 líneas: ${JSON.stringify(nova).slice(0, 6000)}`)
  h.push(...(await cuentas()))
  return enviar(await redactar('semanal', h, contexto, paraIA))
}

// ── Estado para no repetir avisos ──

interface RegistroAvisos { dia: string; claves: string[]; envios: number[] }

async function filtrarNuevos(h: Hallazgo[], ahora: Date): Promise<Hallazgo[]> {
  const dia = claveDia(ahora, config.tzMercado)
  const r = await leer<RegistroAvisos>('avisos', { dia, claves: [], envios: [] })
  const claves = r.dia === dia ? new Set(r.claves) : new Set<string>()
  const ultimaHora = r.envios.filter(t => ahora.getTime() - t < 3_600_000)
  const nuevos = h.filter(x => !x.clave || !claves.has(x.clave))
  if (nuevos.length === 0) return []
  // Al llegar al tope por hora, solo pasan las alertas.
  if (ultimaHora.length >= config.maxAvisosPorHora) return nuevos.filter(x => x.nivel === 'alerta')
  return nuevos
}

async function registrarClaves(h: Hallazgo[], ahora = new Date()): Promise<void> {
  const dia = claveDia(ahora, config.tzMercado)
  const r = await leer<RegistroAvisos>('avisos', { dia, claves: [], envios: [] })
  const claves = r.dia === dia ? r.claves : []
  await guardar<RegistroAvisos>('avisos', {
    dia,
    claves: [...new Set([...claves, ...h.flatMap(x => (x.clave ? [x.clave] : []))])],
    envios: [...r.envios.filter(t => ahora.getTime() - t < 3_600_000), ahora.getTime()],
  })
}

async function noticiasVistas() {
  const r = await leer<Record<string, number>>('noticias-vistas', {})
  return { mapa: r, set: new Set(Object.keys(r)) }
}

async function marcarVistas(v: { mapa: Record<string, number> }, ids: string[]) {
  const ahora = Date.now()
  const mapa = Object.fromEntries(Object.entries(v.mapa).filter(([, t]) => ahora - t < 3 * 86_400_000))
  for (const id of ids) mapa[id] = ahora
  await guardar('noticias-vistas', mapa)
}

async function enviar(texto: string): Promise<string> {
  await mensajero().enviar(texto)
  return texto
}

