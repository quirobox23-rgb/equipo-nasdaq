// Las tareas programadas de la oficina. Cada una reúne a los agentes que le
// tocan, pasa los hallazgos al jefe y envía el mensaje.
import { config } from './config.ts'
import { leer, guardar } from './almacen.ts'
import { cargarCalendario, type EventoMacro } from './sources/calendario.ts'
import { cargarVelas, type Vela } from './sources/yahoo.ts'
import { cargarTitulares } from './sources/rss.ts'
import { briefingSemanal } from './sources/factorMacro.ts'
import { agendaDelDia, vigilarMacro } from './equipo/macro.ts'
import { agendaFed, cargarMiembros, esFed } from './equipo/fed.ts'
import { agendaResultados } from './equipo/earnings.ts'
import { cargarResultados } from './sources/earnings.ts'
import { analizarGrafico, calcularNiveles, describirNiveles, movimientoDelDia, rangoEsperado } from './equipo/grafico.ts'
import { analizarEstructura, cargarEstrategia, describirNivelesEstrategia, type Estrategia } from './equipo/estructura.ts'
import { equiposActivos, type DefinicionEquipo } from './equipo/definiciones.ts'
import { analizarNoticias } from './equipo/noticias.ts'
import { evaluarBienestar, aptitud, cargarAjustesCoach, preguntaCheckin, type CheckIn } from './personal/coach.ts'
import { cargarReglas, evaluarCuentas, proveedorManual, type ReglasCuenta } from './personal/gestor.ts'
import { bloqueMentor, cargarPlan, revisarDia, type Operacion } from './personal/plan.ts'
import { configurado as configuradoFM, leerFactorMetricas } from './personal/factorMetricas.ts'
import { redactar } from './coordinador.ts'
import { mensajero } from './mensajeria/index.ts'
import type { Hallazgo } from './tipos.ts'
import { registrarEstado } from './estadoOficina.ts'
import { describirReadiness, marketReadiness, traderReadiness, type Nota, type Fases } from './readiness.ts'
import { claveDia, diaAnterior, hora, minutosDelDia } from './tiempo.ts'

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

/** Con Factor Métricas configurado, las cuentas salen de ahí; si no, de config/cuentas.json y tus "pnl …". */
async function cuentasYFases(ahora = new Date()): Promise<{ hallazgos: Hallazgo[]; fases?: Fases; operaciones?: Operacion[] }> {
  if (configuradoFM()) {
    const fm = await intentar('factor-metricas', () => leerFactorMetricas(ahora))
    if (fm) return { hallazgos: evaluarCuentas(fm.reglas, fm.estados), fases: contarFases(fm.reglas), operaciones: fm.operaciones }
    return { hallazgos: [sinDatos('cuentas', 'tus cuentas en Factor Métricas')] }
  }
  const reglas = await cargarReglas()
  return { hallazgos: evaluarCuentas(reglas, await proveedorManual.leer()), fases: reglas.length ? contarFases(reglas) : undefined }
}

async function cuentas(ahora = new Date()): Promise<Hallazgo[]> {
  return (await cuentasYFases(ahora)).hallazgos
}

function contarFases(reglas: ReglasCuenta[]): Fases {
  const n = (f: ReglasCuenta['fase']) => reglas.filter(r => r.fase === f).length
  return { fondeada: n('fondeada'), challenge: n('challenge'), personal: n('personal') }
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

/** Operaciones del último día operado antes de hoy (como mucho 4 días atrás: cubre el fin de semana). */
export function ultimoDiaOperado(ops: Operacion[], hoy: string): Operacion[] {
  const limite = [1, 2, 3, 4].reduce(d => diaAnterior(d), hoy)
  const fechas = ops.map(o => o.fecha).filter(f => f < hoy && f >= limite).sort()
  const ultimo = fechas.at(-1)
  return ultimo ? ops.filter(o => o.fecha === ultimo) : []
}

/** "jueves 20 de noviembre" en tu zona horaria. */
export function fechaLarga(ahora: Date): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: config.tzUsuaria, weekday: 'long', day: 'numeric', month: 'long' }).format(ahora)
}

/** Macro sin la Fed (la Fed tiene su propio agente) y la Fed. */
async function macroYFed(cal: EventoMacro[] | null, ahora: Date): Promise<Hallazgo[]> {
  if (!cal) return [sinDatos('macro', 'el calendario económico')]
  const miembros = await cargarMiembros()
  return [...agendaDelDia(cal.filter(e => !esFed(e, miembros)), ahora), ...agendaFed(cal, ahora, miembros)]
}

/**
 * Para la respuesta al check-in: la nota de mercado de la guía de hoy (si la
 * hubo) y tu nota con el check-in y tus cuentas.
 */
export async function readinessTrasCheckin(c: CheckIn, ahora = new Date()): Promise<string[]> {
  const r = await leer<{ dia: string; mercado: Nota } | null>('readiness', null)
  if (!r || r.dia !== claveDia(ahora, config.tzUsuaria)) return []
  const cu = await cuentasYFases(ahora)
  return describirReadiness(r.mercado, traderReadiness(c, cu.hallazgos), cu.fases)
}

/** Resultados de las grandes del Nasdaq de hoy y de ayer tras el cierre. */
async function resultados(ahora: Date): Promise<Hallazgo[]> {
  if (!config.finnhubKey) return []
  const hoy = claveDia(ahora, config.tzMercado)
  const lista = await intentar('resultados', () => cargarResultados(diaAnterior(hoy), hoy))
  return lista ? agendaResultados(lista, hoy) : [sinDatos('earnings', 'el calendario de resultados')]
}

/** Volatilidad y rango: ATR diario en puntos y el VIX. */
async function rangos(ahora: Date): Promise<Hallazgo[]> {
  const out: Hallazgo[] = []
  for (const eq of equiposActivos()) {
    const [diarias, vol] = await Promise.all([
      intentar(`${eq.id}:diario`, () => cargarVelas(eq.simbolo, '1d', '2mo')),
      intentar(`${eq.id}:volatilidad`, () => cargarVelas(eq.simboloVolatilidad, '5m', '5d')),
    ])
    if (diarias) out.push(...rangoEsperado(diarias, vol ?? [], ahora, eq))
  }
  return out
}

const SIN_PRECIOS = 'No escribas precios ni niveles exactos del activo: describe el contexto con palabras, porcentajes y puntos de movimiento.'

/** 08:30 hora de lola: fecha, macro, Fed, resultados, cuentas, volatilidad y el check-in del coach. */
export async function guiaDiaria(ahora = new Date()): Promise<string> {
  const cal = await intentar('calendario', () => cargarCalendario())
  const inf = await equipos(ahora)
  const h: Hallazgo[] = [
    ...(await macroYFed(cal, ahora)),
    ...(await resultados(ahora)),
    ...(await rangos(ahora)),
    ...etiquetar(inf),
  ]
  const cu = await cuentasYFases(ahora)
  h.push(...cu.hallazgos)
  const { habitos } = await cargarAjustesCoach()
  const mercado = marketReadiness(h)
  await guardar('readiness', { dia: claveDia(ahora, config.tzUsuaria), mercado })
  const plan = await cargarPlan()
  const opsAyer = cu.operaciones ? ultimoDiaOperado(cu.operaciones, claveDia(ahora, config.tzUsuaria)) : []
  const contexto = [
    `📅 Hoy es ${fechaLarga(ahora)}.`,
    ...describirReadiness(mercado, null, cu.fases),
    ...bloqueMentor(opsAyer, plan),
    ...(config.soloTexto ? [] : inf.flatMap(i => i.contexto)),
    `💬 ${preguntaCheckin(habitos)}`,
  ]
  const paraIA = [
    'Empieza diciendo qué día es hoy (📅); justo después pon el bloque de Daily Trading Readiness (🧭) tal cual, luego las líneas de ayer y del plan (📋, 🧑‍🏫, 🎯) tal cual, y después cuenta, en este orden: datos macro y la Fed, resultados de empresas, tus cuentas, y volatilidad y rango esperado.',
    'Si hay datos o discursos importantes, explica en una frase por qué pueden mover el NQ, sin adivinar la dirección.',
    'Termina con la pregunta del coach (💬) tal cual.',
    ...(config.soloTexto ? [SIN_PRECIOS] : []),
  ]
  await registrarEstado(h, inf.map(i => i.eq.nombre), ahora, true)
  return enviar(await redactar('guia', h, contexto, paraIA, nombreEquipos(inf)))
}

/** 15:00 en España (09:00 Nueva York): qué ha cambiado y cómo llegas. */
export async function preApertura(ahora = new Date()): Promise<string> {
  const cal = await intentar('calendario', () => cargarCalendario())
  const inf = await equipos(ahora)
  const noticias = await noticiasEquipos(inf, ahora, 16 * 60)
  const restantes = cal ? agendaDelDia(cal, ahora).filter(x => x.nivel !== 'info' || x.titulo.startsWith('Sin datos')) : []
  const h: Hallazgo[] = [
    ...restantes,
    ...(cal ? agendaFed(cal, ahora, await cargarMiembros()).filter(x => x.nivel === 'alerta') : []),
    ...(cal ? vigilarMacro(cal, ahora, 45) : []),
    ...etiquetar(inf),
    ...noticias.slice(0, 4),
    ...evaluarBienestar(await checkinDeHoy(ahora)),
  ]
  const cu = await cuentasYFases(ahora)
  h.push(...cu.hallazgos)
  await registrarClaves(h)
  await registrarEstado(h, inf.map(i => i.eq.nombre), ahora, true)
  const readiness = describirReadiness(marketReadiness(h), traderReadiness(await checkinDeHoy(ahora), cu.hallazgos), cu.fases)
  const contexto = [...readiness, ...(config.soloTexto ? [] : inf.flatMap(i => i.contexto))]
  const paraIA = ['Pon el bloque de Daily Trading Readiness (🧭) tal cual al principio.', ...(config.soloTexto ? [SIN_PRECIOS] : [])]
  return enviar(await redactar('apertura', h, contexto, paraIA, nombreEquipos(inf)))
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
  await registrarEstado(candidatos, inf.map(i => i.eq.nombre), ahora, nuevos.length > 0)
  if (nuevos.length === 0) return null
  await registrarClaves(nuevos, ahora)
  return enviar(await redactar('aviso', nuevos, [], [], nombreEquipos(inf)))
}

export interface RegistroSesgo { sesgo: NonNullable<CheckIn['sesgo']>; movimiento: number; coincide: boolean }

/** ¿El día le dio la razón a tu sesgo? Alcista/bajista: más de ±0,2 %. Neutral: menos de ±0,5 %. */
export function compararSesgo(sesgo: NonNullable<CheckIn['sesgo']>, movimiento: number): boolean {
  if (sesgo === 'alcista') return movimiento > 0.2
  if (sesgo === 'bajista') return movimiento < -0.2
  return Math.abs(movimiento) <= 0.5
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`

/** 16:15 Nueva York: cómo fue el día y si coincidió con tu sesgo. */
export async function cierre(ahora = new Date()): Promise<string> {
  const inf = await equipos(ahora)
  const c = await checkinDeHoy(ahora)
  const cu = await cuentasYFases(ahora)
  const h: Hallazgo[] = [...cu.hallazgos]
  const hoy = claveDia(ahora, config.tzUsuaria)
  const fallos = cu.operaciones ? revisarDia(cu.operaciones.filter(o => o.fecha === hoy), await cargarPlan()) : []
  const contexto = [
    ...inf.map(i => {
      const n = i.velas ? calcularNiveles(i.velas, ahora) : null
      if (n?.maxHoy === undefined) return ''
      const rango = Math.round(n.maxHoy - n.minHoy!)
      return `Hoy ${i.eq.nombre} se ha movido ${rango} puntos de máximo a mínimo (lo normal son unos ${Math.round(n.rangoMedio ?? 0)}).`
    }),
    c ? `Esta mañana su aptitud era ${aptitud(c).nota}/100.` : '',
    fallos.length ? `🧑‍🏫 Hoy te has salido del plan: ${fallos.join(' ')}` : '',
  ]
  const principal = inf[0]
  const mov = principal?.velas ? movimientoDelDia(principal.velas, ahora) : null
  if (c?.sesgo && mov !== null) {
    const coincide = compararSesgo(c.sesgo, mov)
    contexto.push(`🧭 Tu sesgo de hoy era ${c.sesgo} y ${principal.eq.nombre} ha hecho ${pct(mov)} en la sesión: ${coincide ? 'coincidió' : 'no coincidió'}.`)
    const sesgos = await leer<Record<string, RegistroSesgo>>('sesgos', {})
    sesgos[claveDia(ahora, config.tzUsuaria)] = { sesgo: c.sesgo, movimiento: Math.round(mov * 100) / 100, coincide }
    await guardar('sesgos', sesgos)
  }
  contexto.push('💬 ¿Cómo te has sentido operando hoy? Si quieres, actualiza tus cuentas escribiendo: pnl <cuenta> <resultado>')
  return enviar(await redactar('cierre', h, contexto.filter(Boolean), ['Incluye la línea del sesgo (🧭) si está, sin juzgar.', 'Si está la línea del coach (🧑‍🏫), inclúyela tal cual, con tono de compañero, sin reñir.', 'Termina con la pregunta (💬) tal cual.']))
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
  const sesgos = Object.entries(await leer<Record<string, RegistroSesgo>>('sesgos', {}))
    .filter(([dia]) => ahora.getTime() - new Date(`${dia}T12:00:00Z`).getTime() <= 7 * 86_400_000)
  if (sesgos.length) {
    const aciertos = sesgos.filter(([, r]) => r.coincide).length
    contexto.push(`🧭 Esta semana tu sesgo coincidió con el mercado ${aciertos} de ${sesgos.length} días.`)
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

