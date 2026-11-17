// Especialista de estructura: vigila los niveles que TU estrategia dice que
// importan (mínimo/máximo de Asia, Londres, ayer, noche) y avisa cuando el
// precio se acerca, los barre, los recupera o se queda al otro lado.
// Describe lo que pasa respecto a tu plan; la decisión es siempre tuya.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '../config.ts'
import type { Vela } from '../sources/yahoo.ts'
import type { Hallazgo } from '../tipos.ts'
import { claveDia, diaAnterior, hora, instante, minutosDelDia } from '../tiempo.ts'
import { calcularNiveles, f, volumenRelativo, vwapSesion } from './grafico.ts'
import type { DefinicionEquipo } from './definiciones.ts'

export interface Sesion { nombre: string; inicio: string; fin: string }

export type NivelEstrategia = 'asia' | 'londres' | 'ayer' | 'noche'

export interface Estrategia {
  equipo: string
  nombre: string
  descripcion?: string
  niveles: NivelEstrategia[]
  vigilar: { aproximacion: boolean; barrido: boolean; recuperacion: boolean; aceptacion: boolean }
  vwap: boolean
  /** Puntos que cuentan como "se acerca". */
  distanciaAproximacion?: number
  /** Minutos seguidos cerrando al otro lado del nivel para darlo por roto (no barrido). */
  minutosAceptacion: number
  /** Horas de Nueva York en las que vigilar la estructura. */
  ventana: { inicio: string; fin: string }
  /** Horas de Nueva York de cada sesión. Asia cruza la medianoche. */
  sesiones: { asia: Sesion; londres: Sesion }
}

export const ESTRATEGIA_POR_DEFECTO: Estrategia = {
  equipo: 'nasdaq',
  nombre: 'Barrido de liquidez de Asia',
  descripcion: 'Espero que el precio barra el mínimo (o el máximo) de Asia, saque liquidez y se vaya en contra.',
  niveles: ['asia', 'londres', 'ayer'],
  vigilar: { aproximacion: true, barrido: true, recuperacion: true, aceptacion: true },
  vwap: true,
  minutosAceptacion: 20,
  ventana: { inicio: '02:00', fin: '11:30' },
  sesiones: {
    asia: { nombre: 'Asia', inicio: '20:00', fin: '00:00' },
    londres: { nombre: 'Londres', inicio: '02:00', fin: '05:00' },
  },
}

export async function cargarEstrategia(equipo: string): Promise<Estrategia> {
  const archivo = path.join('config', 'estrategias', `${equipo}.json`)
  try {
    const e = JSON.parse(await fs.readFile(archivo, 'utf-8')) as Partial<Estrategia>
    return { ...ESTRATEGIA_POR_DEFECTO, ...e, equipo, vigilar: { ...ESTRATEGIA_POR_DEFECTO.vigilar, ...e.vigilar }, sesiones: { ...ESTRATEGIA_POR_DEFECTO.sesiones, ...e.sesiones } }
  } catch {
    return { ...ESTRATEGIA_POR_DEFECTO, equipo }
  }
}

export interface NivelClave {
  id: string
  nombre: string           // "mínimo de Asia"
  tipo: 'max' | 'min'
  valor: number
  /** Desde cuándo el nivel está formado y se vigila. */
  desde: Date
}

const tz = () => config.tzMercado
const ET = (dia: string, hhmm: string) => instante(dia, hhmm, tz())

function rangoSesion(velas: Vela[], inicio: Date, fin: Date): { max: number; min: number } | null {
  const dentro = velas.filter(v => v.t >= inicio && v.t < fin)
  if (dentro.length === 0) return null
  return { max: Math.max(...dentro.map(v => v.h)), min: Math.min(...dentro.map(v => v.l)) }
}

/** Niveles del día de trading en curso (día de Nueva York). */
export function nivelesClave(velas: Vela[], ahora: Date, e: Estrategia): NivelClave[] {
  const hoy = claveDia(ahora, tz())
  const out: NivelClave[] = []
  const anadir = (id: string, etiqueta: string, r: { max: number; min: number } | null, desde: Date) => {
    if (!r || desde > ahora) return
    out.push({ id: `${id}-max`, nombre: `máximo de ${etiqueta}`, tipo: 'max', valor: r.max, desde })
    out.push({ id: `${id}-min`, nombre: `mínimo de ${etiqueta}`, tipo: 'min', valor: r.min, desde })
  }
  for (const n of e.niveles) {
    if (n === 'asia' || n === 'londres') {
      const s = e.sesiones[n]
      const cruza = s.inicio > s.fin
      const inicio = ET(cruza ? diaAnterior(hoy) : hoy, s.inicio)
      const fin = ET(hoy, s.fin === '00:00' ? '00:00' : s.fin)
      anadir(n, s.nombre, rangoSesion(velas, inicio, fin), fin)
    } else {
      const base = calcularNiveles(velas, ahora)
      if (!base) continue
      if (n === 'ayer') anadir('ayer', 'ayer', { max: base.maxAyer, min: base.minAyer }, ET(hoy, '00:00'))
      if (n === 'noche' && base.maxNoche !== undefined && base.minNoche !== undefined) {
        anadir('noche', 'la noche', { max: base.maxNoche, min: base.minNoche }, ET(hoy, '09:30'))
      }
    }
  }
  return out
}

export type EstadoNivel =
  | { estado: 'intacto'; distancia: number }
  | { estado: 'barrido'; cuando: Date; extremo: number }
  | { estado: 'recuperado'; cuando: Date; barridoEn: Date; extremo: number }
  | { estado: 'aceptado'; cuando: Date }

/**
 * Recorre las velas desde que el nivel se formó y devuelve en qué punto
 * está ahora: intacto, barrido (lo pasó pero aún no volvió), recuperado
 * (volvió a cerrar del lado de dentro) o aceptado (lleva un rato cerrando
 * al otro lado: ya no parece un barrido sino una ruptura).
 */
export function estadoNivel(n: NivelClave, velas: Vela[], ahora: Date, minutosAceptacion: number): EstadoNivel {
  const fuera = (precio: number) => (n.tipo === 'min' ? precio < n.valor : precio > n.valor)
  const pasa = (v: Vela) => (n.tipo === 'min' ? v.l < n.valor : v.h > n.valor)
  const tras = velas.filter(v => v.t >= n.desde && v.t <= ahora)
  let st: EstadoNivel = { estado: 'intacto', distancia: Infinity }
  let inicioFuera: Date | null = null
  for (const v of tras) {
    if (st.estado === 'aceptado') break
    if (st.estado === 'intacto') {
      if (pasa(v)) {
        st = { estado: 'barrido', cuando: v.t, extremo: n.tipo === 'min' ? v.l : v.h }
        // Mecha que barre y cierra dentro en la misma vela: barrido y recuperación a la vez.
        if (!fuera(v.c)) st = { estado: 'recuperado', cuando: v.t, barridoEn: v.t, extremo: st.extremo }
      }
    } else if (st.estado === 'barrido') {
      st.extremo = n.tipo === 'min' ? Math.min(st.extremo, v.l) : Math.max(st.extremo, v.h)
      if (!fuera(v.c)) st = { estado: 'recuperado', cuando: v.t, barridoEn: st.cuando, extremo: st.extremo }
    }
    // Aceptación: cierres seguidos al otro lado durante X minutos.
    if (st.estado !== 'intacto') {
      if (fuera(v.c)) {
        inicioFuera ??= v.t
        if (v.t.getTime() + 5 * 60_000 - inicioFuera.getTime() >= minutosAceptacion * 60_000) st = { estado: 'aceptado', cuando: v.t }
      } else {
        inicioFuera = null
      }
    }
  }
  if (st.estado === 'intacto' && tras.length) st = { estado: 'intacto', distancia: Math.abs(tras[tras.length - 1].c - n.valor) }
  return st
}

const CIERRE = 'Tu estrategia contempla esta situación. La decisión es tuya.'

export function analizarEstructura(velas: Vela[], ahora: Date, e: Estrategia, eq: DefinicionEquipo): Hallazgo[] {
  const m = minutosDelDia(ahora, tz())
  const [hi, mi] = e.ventana.inicio.split(':').map(Number)
  const [hf, mf] = e.ventana.fin.split(':').map(Number)
  if (m < hi * 60 + mi || m > hf * 60 + mf) return []

  const hoy = claveDia(ahora, tz())
  const distancia = e.distanciaAproximacion ?? eq.distanciaCerca
  const vr = volumenRelativo(velas, ahora)
  const vwap = e.vwap ? vwapSesion(velas, ahora) : null
  const ultimo = velas.filter(v => v.t <= ahora).at(-1)?.c
  const extras = [
    vr !== null ? `Volumen ${vr.toFixed(1)}x lo normal a esta hora.` : '',
    vwap !== null && ultimo !== undefined ? `Precio ${ultimo >= vwap ? 'por encima' : 'por debajo'} del VWAP (${f(vwap)}).` : '',
  ].filter(Boolean).join(' ')

  const out: Hallazgo[] = []
  for (const n of nivelesClave(velas, ahora, e)) {
    const st = estadoNivel(n, velas, ahora, e.minutosAceptacion)
    const nombre = `${n.nombre} (${f(n.valor)})`
    const base = { agente: 'estructura' as const, estrategia: true }
    const clave = (s: string) => `${eq.id}:estructura:${hoy}:${n.id}:${s}`
    const lado = n.tipo === 'min' ? 'por debajo' : 'por encima'
    const dentro = n.tipo === 'min' ? 'por encima' : 'por debajo'
    if (st.estado === 'intacto' && e.vigilar.aproximacion && st.distancia <= distancia) {
      out.push({ ...base, nivel: 'atencion', titulo: `${eq.nombre} se acerca al ${nombre}: está a ${f(st.distancia)} puntos. Aún no lo ha barrido.`, detalle: extras, clave: clave('cerca') })
    } else if (st.estado === 'barrido' && e.vigilar.barrido) {
      out.push({ ...base, nivel: 'alerta', titulo: `Ha barrido el ${nombre} a las ${hora(st.cuando, config.tzUsuaria)} (llegó a ${f(st.extremo)}). Todavía no ha recuperado el nivel.`, detalle: `${extras} ${CIERRE}`.trim(), clave: clave('barrido') })
    } else if (st.estado === 'recuperado' && e.vigilar.recuperacion) {
      out.push({ ...base, nivel: 'alerta', titulo: `Tras barrer el ${nombre}, ha vuelto a cerrar ${dentro} del nivel (${hora(st.cuando, config.tzUsuaria)}). Falta ver si hay desplazamiento y volumen.`, detalle: `${extras} ${CIERRE}`.trim(), clave: clave('recuperado') })
    } else if (st.estado === 'aceptado' && e.vigilar.aceptacion) {
      out.push({ ...base, nivel: 'alerta', titulo: `El precio lleva ${e.minutosAceptacion} min cerrando ${lado} del ${nombre}: ya no parece un barrido, parece una ruptura en contra de tu escenario.`, detalle: `${extras} La decisión es tuya.`.trim(), clave: clave('aceptado') })
    }
  }
  return out
}

/** Resumen de niveles para la guía de la mañana. */
export function describirNivelesEstrategia(velas: Vela[], ahora: Date, e: Estrategia): string {
  const n = nivelesClave(velas, ahora, e)
  if (n.length === 0) return ''
  return `Niveles de tu estrategia (${e.nombre}): ` + n.map(x => `${x.nombre} ${f(x.valor)}`).join(', ')
}
