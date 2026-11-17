// Las tareas programadas de la oficina. Cada una reúne a los agentes que le
// tocan, pasa los hallazgos al jefe y envía el mensaje.
import { config } from './config.ts'
import { leer, guardar } from './almacen.ts'
import { cargarCalendario, type EventoMacro } from './sources/calendario.ts'
import { cargarVelas, type Vela } from './sources/yahoo.ts'
import { cargarTitulares } from './sources/rss.ts'
import { briefingSemanal } from './sources/factorMacro.ts'
import { agendaDelDia, vigilarMacro } from './equipo/macro.ts'
import { analizarGrafico, calcularNiveles, describirNiveles } from './equipo/grafico.ts'
import { analizarEstructura, cargarEstrategia, describirNivelesEstrategia, type Estrategia } from './equipo/estructura.ts'
import { equiposActivos, type DefinicionEquipo } from './equipo/definiciones.ts'
import { analizarNoticias } from './equipo/noticias.ts'
import { evaluarBienestar, aptitud, PREGUNTA_CHECKIN, type CheckIn } from './personal/coach.ts'
import { cargarReglas, evaluarCuentas, proveedorManual } from './personal/gestor.ts'
import { redactar } from './coordinador.ts'
import { mensajero } from './mensajeria/index.ts'
import type { Hallazgo } from './tipos.ts'
import { claveDia, hora, minutosDelDia } from './tiempo.ts'

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

interface InformeEquipo {
  eq: DefinicionEquipo
  estrategia: Estrategia
  velas: Vela[] | null
  hallazgos: Hallazgo[]
  contexto: string[]
}

/** Reúne a los especialistas de mercado de un equipo (gráfico, volumen, volatilidad, estructura). */
async function equipoMercado(eq: DefinicionEquipo, ahora: Date): Promise<InformeEquipo> {
  const estrategia = await cargarEstrategia(eq.id)
  const [velas, vol] = await Promise.all([
    intentar(`${eq.id}:precio`, () => cargarVelas(eq.simbolo, '5m', '5d')),
    intentar(`${eq.id}:volatilidad`, () => cargarVelas(eq.simboloVolatilidad, '5m', '5d')),
  ])
  if (!velas) return { eq, estrategia, velas: null, hallazgos: [sinDatos('grafico', `el gráfico de ${eq.nombre}`)], contexto: [] }
  const g = analizarGrafico(velas, vol ?? [], ahora, eq)
  const contexto = [
    g.niveles ? `Niveles ${eq.nombre}: ${describirNiveles(g.niveles)}` : '',
    describirNivelesEstrategia(velas, ahora, estrategia),
  ].filter(Boolean)
  return { eq, estrategia, velas, hallazgos: [...g.hallazgos, ...analizarEstructura(velas, ahora, estrategia, eq)], contexto }
}

async function equipos(ahora: Date): Promise<InformeEquipo[]> {
  return Promise.all(equiposActivos().map(eq => equipoMercado(eq, ahora)))
}

/** Con más de un equipo, cada aviso lleva el nombre de su activo. */
function etiquetar(informes: InformeEquipo[]): Hallazgo[] {
  const varios = informes.length > 1
  return informes.flatMap(i => i.hallazgos.map(h => (varios && h.agente !== 'estructura' ? { ...h, titulo: `${i.eq.nombre}: ${h.titulo}` } : h)))
}

const nombreEquipos = (informes: InformeEquipo[]) => informes.map(i => i.eq.nombre).join(' + ')

async function noticiasEquipos(informes: InformeEquipo[], ahora: Date, ventanaMin: number): Promise<Hallazgo[]> {
  const titulares = await intentar('noticias', () => cargarTitulares(config.noticiasFeeds))
  if (!titulares) return []
  const vistos = await noticiasVistas()
  const out: Hallazgo[] = []
  const revisados: string[] = []
  for (const i of informes) {
    const n = await analizarNoticias(titulares, ahora, vistos.set, ventanaMin, i.eq)
    out.push(...(informes.length > 1 ? n.hallazgos.map(h => ({ ...h, titulo: `${i.eq.nombre}: ${h.titulo}` })) : n.hallazgos))
    revisados.push(...n.revisados)
  }
  await marcarVistas(vistos, revisados)
  return out
}

/** 08:30 hora de lola: agenda, niveles, cuentas y pregunta de bienestar. */
export async function guiaDiaria(ahora = new Date()): Promise<string> {
  const cal = await intentar('calendario', () => cargarCalendario())
  const inf = await equipos(ahora)
  const h: Hallazgo[] = [
    ...(cal ? agendaDelDia(cal, ahora) : [sinDatos('macro', 'el calendario económico')]),
    ...etiquetar(inf),
    ...(await cuentas()),
  ]
  const contexto = [...inf.flatMap(i => i.contexto), `💬 ${PREGUNTA_CHECKIN}`]
  return enviar(await redactar('guia', h, contexto, ['Termina con la pregunta de bienestar (💬) tal cual.'], nombreEquipos(inf)))
}

/** 15:00 en España (09:00 Nueva York): qué ha cambiado y cómo llegas. */
export async function preApertura(ahora = new Date()): Promise<string> {
  const cal = await intentar('calendario', () => cargarCalendario())
  const inf = await equipos(ahora)
  const noticias = await noticiasEquipos(inf, ahora, 16 * 60)
  const restantes = cal ? agendaDelDia(cal, ahora).filter(x => x.nivel !== 'info' || x.titulo.startsWith('Sin datos')) : []
  const h: Hallazgo[] = [
    ...restantes,
    ...(cal ? vigilarMacro(cal, ahora, 45) : []),
    ...etiquetar(inf),
    ...noticias.slice(0, 4),
    ...evaluarBienestar(await checkinDeHoy(ahora)),
    ...(await cuentas()),
  ]
  await registrarClaves(h)
  return enviar(await redactar('apertura', h, inf.flatMap(i => i.contexto), [], nombreEquipos(inf)))
}

/**
 * Cada 5 minutos dentro de la ventana de vigilancia (la de tus estrategias,
 * y como mínimo la primera parte de la sesión de Nueva York). Solo escribe si
 * hay algo nuevo; los avisos de riesgo tienen un tope por hora, los de tu
 * estrategia no.
 */
export async function vigilancia(ahora = new Date()): Promise<string | null> {
  const estrategias = await Promise.all(equiposActivos().map(eq => cargarEstrategia(eq.id)))
  const aMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
  const desde = Math.min(9 * 60 + 25, ...estrategias.map(e => aMin(e.ventana.inicio)))
  const hasta = Math.max(11 * 60 + 30, ...estrategias.map(e => aMin(e.ventana.fin)))
  const m = minutosDelDia(ahora, config.tzMercado)
  if (m < desde || m > hasta) return null

  const cal = await intentar('calendario', () => cargarCalendario())
  const inf = await equipos(ahora)
  const candidatos = [
    ...(cal ? vigilarMacro(cal, ahora) : []),
    ...etiquetar(inf),
    ...(await noticiasEquipos(inf, ahora, 30)),
    ...(await cuentas()),
  ].filter(x => x.nivel !== 'info')

  const nuevos = await filtrarNuevos(candidatos, ahora)
  if (nuevos.length === 0) return null
  await registrarClaves(nuevos, ahora)
  return enviar(await redactar('aviso', nuevos, [], [], nombreEquipos(inf)))
}

/** 16:15 Nueva York: cómo fue el día. */
export async function cierre(ahora = new Date()): Promise<string> {
  const inf = await equipos(ahora)
  const c = await checkinDeHoy(ahora)
  const h: Hallazgo[] = [...(await cuentas())]
  const contexto = [
    ...inf.map(i => {
      const n = i.velas ? calcularNiveles(i.velas, ahora) : null
      return n?.maxHoy !== undefined ? `Rango de hoy en ${i.eq.nombre}: ${Math.round(n.minHoy!)} a ${Math.round(n.maxHoy)} (medio ${Math.round(n.rangoMedio ?? 0)}).` : ''
    }),
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
  // Al llegar al tope por hora, solo pasan las alertas y los avisos de tu estrategia.
  if (ultimaHora.length >= config.maxAvisosPorHora) return nuevos.filter(x => x.nivel === 'alerta' || x.estrategia)
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

