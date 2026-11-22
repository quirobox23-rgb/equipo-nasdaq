// Backtesting dentro de la oficina, en /backtesting (sin puertos aparte):
// subir velas (CSV o clave de Databento), pasar el setup, comparar ciclos de
// challenge y el replay de la sala de Entrenamiento. Todo se guarda en data/
// de este ordenador y Atractor lo lee para evaluarte.
import http from 'node:http'
import readline from 'node:readline'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.ts'
import { leer, guardar } from '../almacen.ts'
import { crearLector, deSerie, agrupar, enNY, ZONAS, type SerieVelas, type Vela, type ZonaCsv, type Lectura } from './velas.ts'
import { simular, estadisticas, rangosPrevios, simularCuentas, completarAjustes, detectarSetups, puntos, type Ajustes, type ReglasCuentaSim } from './motor.ts'
import * as databento from './databento.ts'
import { evaluar, type Backtest, type Ciclos, type Replay, type Evaluacion } from '../personal/atractor.ts'
import { veredicto, type Nota } from '../readiness.ts'
import { cargarPlan, type Operacion as OperacionReal } from '../personal/plan.ts'
import { configurado as configuradoFM, leerFactorMetricas } from '../personal/factorMetricas.ts'
import { operacionesVivo, unirOperaciones } from '../personal/enVivo.ts'

const PAGINA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'backtesting.html')
const archivoVelas = () => path.join(config.dataDir, 'backtesting', 'velas.json')

let cache: { serie: SerieVelas; velas: Vela[] } | null = null

async function cargarVelas(): Promise<{ serie: SerieVelas; velas: Vela[] } | null> {
  if (cache) return cache
  try {
    const serie = JSON.parse(await fs.readFile(archivoVelas(), 'utf-8')) as SerieVelas
    cache = { serie, velas: deSerie(serie) }
    return cache
  } catch {
    return null
  }
}

async function guardarVelas(l: Lectura) {
  await fs.mkdir(path.dirname(archivoVelas()), { recursive: true })
  const tmp = `${archivoVelas()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(l.serie))
  await fs.rename(tmp, archivoVelas())
  cache = { serie: l.serie, velas: deSerie(l.serie) }
}

function info(c: { serie: SerieVelas; velas: Vela[] } | null) {
  if (!c || !c.velas.length) return { hay: false }
  const s = c.serie
  return {
    hay: true, simbolo: s.simbolo, origen: s.origen, resolucion: s.resolucion, velas: c.velas.length,
    desde: enNY(c.velas[0].t).dia, hasta: enNY(c.velas[c.velas.length - 1].t).dia,
  }
}

interface ResultadoGuardado extends Backtest { setups: number; sinLlenar: number; saltadosDia: number; puntos: { sl: number; tp: number }; operaciones: ReturnType<typeof simular>['operaciones'] }

const responder = (res: http.ServerResponse, codigo: number, cuerpo: unknown) => {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(cuerpo))
}

async function json<T>(req: http.IncomingMessage): Promise<T> {
  let cuerpo = ''
  for await (const trozo of req) { cuerpo += trozo; if (cuerpo.length > 1_000_000) throw new Error('Petición demasiado grande') }
  return (cuerpo ? JSON.parse(cuerpo) : {}) as T
}

async function ejecutar(ajustes: Partial<Ajustes>): Promise<ResultadoGuardado> {
  const c = await cargarVelas()
  if (!c) throw new Error('Primero sube tus velas (CSV o Databento).')
  const sim = simular(c.velas, ajustes)
  const stats = estadisticas(sim.operaciones, rangosPrevios(c.velas, sim.ajustes))
  const r: ResultadoGuardado = {
    ajustes: sim.ajustes, stats, fecha: new Date().toISOString(),
    setups: sim.setups, sinLlenar: sim.sinLlenar, saltadosDia: sim.saltadosDia, puntos: sim.puntos,
    operaciones: sim.operaciones.slice(-3000),
  }
  await guardar('backtesting-resultado', r)
  return r
}

interface PeticionCiclos { ajustes?: Partial<Ajustes>; a?: { slUsd: number; tpUsd: number }; b?: { slUsd: number; tpUsd: number }; reglas?: Partial<ReglasCuentaSim> }

async function ciclos(p: PeticionCiclos): Promise<Ciclos & { reglas: ReglasCuentaSim }> {
  const c = await cargarVelas()
  if (!c) throw new Error('Primero sube tus velas (CSV o Databento).')
  const plan = await cargarPlan()
  const reglas: ReglasCuentaSim = {
    objetivo: 3000, drawdown: 2000, perdidaDiaria: plan.challenge.perdidaDiariaMax, consistencia: plan.challenge.consistencia, precio: 0,
    ...p.reglas,
  }
  const previos = rangosPrevios(c.velas, completarAjustes(p.ajustes))
  const uno = (x: { slUsd: number; tpUsd: number }) => {
    const sim = simular(c.velas, { ...p.ajustes, slUsd: Number(x.slUsd), tpUsd: Number(x.tpUsd) })
    return { slUsd: sim.ajustes.slUsd, tpUsd: sim.ajustes.tpUsd, stats: estadisticas(sim.operaciones, previos), cuentas: simularCuentas(sim.operaciones, reglas) }
  }
  const r = { a: uno(p.a ?? { slUsd: 1000, tpUsd: 500 }), b: uno(p.b ?? { slUsd: 600, tpUsd: 800 }), reglas }
  await guardar('backtesting-ciclos', r)
  return r
}

/** Velas de un día (y la tarde anterior) para el gráfico de una operación y el replay. */
async function dia(d: string) {
  const c = await cargarVelas()
  if (!c) throw new Error('No hay velas cargadas.')
  const dias = new Set<string>()
  let i0 = -1, i1 = -1
  for (let i = 0; i < c.velas.length; i++) {
    const dd = enNY(c.velas[i].t).dia
    dias.add(dd)
    if (dd === d) { if (i0 < 0) i0 = i; i1 = i }
  }
  if (i0 < 0) throw new Error('Ese día no está en tus velas.')
  const lista = [...dias].sort()
  const previo = lista[lista.indexOf(d) - 1]
  let desde = i0
  if (previo) while (desde > 0 && enNY(c.velas[desde - 1].t).dia === previo) desde--
  const tramo = c.velas.slice(desde, i1 + 1)
  // El replay va en velas de 1 minuto (si son de 1 segundo, se juntan).
  const base = c.serie.resolucion < 60 ? agrupar(tramo, 60).map(({ desde: _d, hasta: _h, ...v }) => v) : tramo
  return { dia: d, previo: previo ?? null, resolucion: Math.max(60, c.serie.resolucion), base }
}

async function diasDisponibles(): Promise<string[]> {
  const c = await cargarVelas()
  if (!c) return []
  const s = new Set<string>()
  for (const v of c.velas) { const n = enNY(v.t); if (n.semana > 0 && n.semana < 6) s.add(n.dia) }
  return [...s].sort()
}

/** Setups que el motor ve en un día (para comparar tus entradas del replay). */
async function setupsDelDia(d: string, ajustes: Partial<Ajustes>) {
  const c = await cargarVelas()
  if (!c) return []
  const a = completarAjustes(ajustes)
  const m15 = agrupar(c.velas, 900)
  return detectarSetups(m15, a).filter(s => enNY(s.t + 900_000).dia === d).map(s => ({ ...s, cierre: s.t + 900_000 }))
}

interface SesionReplay { dia: string; fecha: string; ops: { lado: 'largo' | 'corto'; usd: number; motivo: string; coincide: boolean }[] }

export async function resumenReplay(): Promise<Replay | null> {
  const s = await leer<SesionReplay[]>('backtesting-replay', [])
  if (!s.length) return null
  const ops = s.flatMap(x => x.ops)
  return { sesiones: s.length, operaciones: ops.length, ganadas: ops.filter(o => o.usd > 0).length, usd: Math.round(ops.reduce((a, o) => a + o.usd, 0)), coinciden: ops.filter(o => o.coincide).length }
}

/** Lo que Atractor opina hoy, con lo que haya de cada bloque. */
export async function evaluacionAtractor(real?: OperacionReal[], ahora = new Date()): Promise<Evaluacion> {
  const [bt, cic, replay, readiness, estado] = await Promise.all([
    leer<ResultadoGuardado | null>('backtesting-resultado', null),
    leer<Ciclos | null>('backtesting-ciclos', null),
    resumenReplay(),
    leer<{ dia: string; mercado: Nota } | null>('readiness', null),
    leer<{ agentes?: Record<string, { estado?: string }> } | null>('estado-oficina', null),
  ])
  if (!real) {
    const vivo = (await operacionesVivo(ahora).catch(() => ({ ops: [] as OperacionReal[] }))).ops
    const fm = configuradoFM() ? await leerFactorMetricas(ahora).catch(() => null) : null
    const hace30 = new Date(ahora.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
    // Lo apuntado hoy en Telegram manda sobre lo de hoy en Factor Métricas; los días anteriores, de Factor Métricas.
    const hoy = vivo[0]?.fecha
    const fmOps = fm?.operaciones ?? []
    real = [...fmOps.filter(o => o.fecha !== hoy), ...unirOperaciones(vivo, fmOps.filter(o => o.fecha === hoy))].filter(o => o.fecha >= hace30)
  }
  return evaluar({
    backtest: bt, ciclos: cic, replay, real,
    contexto: {
      veredicto: readiness ? veredicto(readiness.mercado, null) : undefined,
      volatilidadAlta: estado?.agentes?.volatilidad?.estado === 'alerta',
    },
  })
}

/** Para la oficina: qué hace hoy el agente de Backtesting. */
export async function estadoBacktesting(): Promise<{ estado: 'trabajando' | 'descanso'; mensaje: string }> {
  const bt = await leer<ResultadoGuardado | null>('backtesting-resultado', null)
  if (!bt) return { estado: 'descanso', mensaje: 'Esperando tus velas: sube un CSV o pega tu clave de Databento.' }
  const s = bt.stats
  return { estado: 'trabajando', mensaje: `Último backtest: ${s.operaciones} operaciones, acierto ${s.acierto.toLocaleString('es-ES')} %, ${s.esperanza} $ por operación.` }
}

/** Atiende /backtesting y /atractor. Devuelve false si la ruta no es suya. */
export async function atenderBacktesting(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  const p = url.pathname
  if (p === '/atractor' && req.method === 'GET') {
    responder(res, 200, await evaluacionAtractor())
    return true
  }
  if (p !== '/backtesting' && !p.startsWith('/backtesting/')) return false
  try {
    if (req.method === 'GET' && (p === '/backtesting' || p === '/backtesting/')) {
      const cuerpo = await fs.readFile(PAGINA, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      res.end(cuerpo)
      return true
    }
    const api = p.replace(/^\/backtesting\/api\//, '')
    if (req.method === 'GET' && api === 'datos') { responder(res, 200, { ...info(await cargarVelas()), plan: await cargarPlan(), zonas: Object.keys(ZONAS), clavePorEnv: Boolean(process.env.DATABENTO_KEY) }); return true }
    if (req.method === 'GET' && api === 'resultado') { responder(res, 200, await leer('backtesting-resultado', null)); return true }
    if (req.method === 'GET' && api === 'ciclos') { responder(res, 200, await leer('backtesting-ciclos', null)); return true }
    if (req.method === 'GET' && api === 'dias') { responder(res, 200, await diasDisponibles()); return true }
    if (req.method === 'GET' && api === 'dia') { responder(res, 200, await dia(url.searchParams.get('d') ?? '')); return true }
    if (req.method === 'GET' && api === 'replay') { responder(res, 200, await resumenReplay()); return true }
    if (req.method === 'POST' && api === 'csv') {
      // El archivo llega tal cual en el cuerpo y se lee línea a línea (sirve para CSV de ticks enormes).
      const tz = (url.searchParams.get('tz') ?? 'utc') as ZonaCsv
      const lector = crearLector({ tz: tz in ZONAS ? tz : 'utc' })
      const rl = readline.createInterface({ input: req, crlfDelay: Infinity })
      for await (const l of rl) lector.linea(l)
      const l = lector.fin()
      if (!l.serie.t.length) throw new Error('No he encontrado velas en el archivo.')
      l.serie.origen = `${l.formato}${url.searchParams.get('nombre') ? ` · ${url.searchParams.get('nombre')}` : ''}`
      await guardarVelas(l)
      responder(res, 200, { ...info(cache), formato: l.formato, filas: l.filas, avisos: l.avisos })
      return true
    }
    if (req.method === 'POST' && (api === 'databento' || api === 'databento/coste')) {
      const cuerpo = await json<Partial<databento.PeticionDatabento>>(req)
      const pet = databento.validar({ ...cuerpo, clave: cuerpo.clave || process.env.DATABENTO_KEY })
      if (api === 'databento/coste') { responder(res, 200, { usd: await databento.coste(pet) }); return true }
      const l = await databento.descargar(pet)
      if (!l.serie.t.length) throw new Error('Databento no ha devuelto velas para ese rango.')
      await guardarVelas(l)
      responder(res, 200, { ...info(cache), formato: l.formato, filas: l.filas, avisos: l.avisos })
      return true
    }
    if (req.method === 'POST' && api === 'ejecutar') { responder(res, 200, await ejecutar((await json<{ ajustes?: Partial<Ajustes> }>(req)).ajustes ?? {})); return true }
    if (req.method === 'POST' && api === 'ciclos') { responder(res, 200, await ciclos(await json<PeticionCiclos>(req))); return true }
    if (req.method === 'POST' && api === 'setups') {
      const b = await json<{ dia: string; ajustes?: Partial<Ajustes> }>(req)
      const a = completarAjustes(b.ajustes)
      responder(res, 200, { setups: await setupsDelDia(b.dia, a), puntos: puntos(a), ajustes: a })
      return true
    }
    if (req.method === 'POST' && api === 'replay') {
      const b = await json<SesionReplay>(req)
      if (!b.dia || !Array.isArray(b.ops)) throw new Error('Sesión de replay incompleta.')
      const todas = await leer<SesionReplay[]>('backtesting-replay', [])
      todas.push({ dia: b.dia, fecha: new Date().toISOString(), ops: b.ops.slice(0, 50).map(o => ({ lado: o.lado === 'corto' ? 'corto' : 'largo', usd: Number(o.usd) || 0, motivo: String(o.motivo).slice(0, 10), coincide: Boolean(o.coincide) })) })
      await guardar('backtesting-replay', todas.slice(-200))
      responder(res, 200, await resumenReplay())
      return true
    }
    responder(res, 404, { error: 'No existe' })
  } catch (e) {
    responder(res, 400, { error: e instanceof Error ? e.message : String(e) })
  }
  return true
}
