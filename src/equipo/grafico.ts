// Especialistas de gráfico, volumen y volatilidad del equipo de un activo.
// Solo describe el contexto; no dice por dónde entrar.
import { config } from '../config.ts'
import type { Vela } from '../sources/yahoo.ts'
import type { Hallazgo } from '../tipos.ts'
import type { DefinicionEquipo } from './definiciones.ts'
import { APERTURA_ET, CIERRE_ET, claveDia, minutosDelDia } from '../tiempo.ts'

export interface Niveles {
  maxAyer: number; minAyer: number; cierreAyer: number
  maxNoche?: number; minNoche?: number
  maxHoy?: number; minHoy?: number
  rangoMedio?: number
  ultimo: number
}

const tz = () => config.tzMercado

function sesionRegular(v: Vela): boolean {
  const m = minutosDelDia(v.t, tz())
  return m >= APERTURA_ET && m < CIERRE_ET
}

/** Agrupa las velas de sesión regular por día (hora de Nueva York). */
function porDia(velas: Vela[]): Map<string, Vela[]> {
  const dias = new Map<string, Vela[]>()
  for (const v of velas) {
    if (!sesionRegular(v)) continue
    const k = claveDia(v.t, tz())
    const lista = dias.get(k) ?? []
    lista.push(v)
    dias.set(k, lista)
  }
  return dias
}

export function calcularNiveles(velas: Vela[], ahora: Date): Niveles | null {
  if (velas.length === 0) return null
  const hoy = claveDia(ahora, tz())
  const dias = porDia(velas)
  const anteriores = [...dias.keys()].filter(k => k < hoy).sort()
  if (anteriores.length === 0) return null
  const ayer = dias.get(anteriores[anteriores.length - 1])!
  const maxAyer = Math.max(...ayer.map(v => v.h))
  const minAyer = Math.min(...ayer.map(v => v.l))
  const cierreAyer = ayer[ayer.length - 1].c
  const finAyer = ayer[ayer.length - 1].t.getTime()

  const noche = velas.filter(v => v.t.getTime() > finAyer && claveDia(v.t, tz()) <= hoy && !(claveDia(v.t, tz()) === hoy && sesionRegular(v)) && v.t <= ahora)
  const hoyRegular = (dias.get(hoy) ?? []).filter(v => v.t <= ahora)
  const rangos = anteriores.map(k => { const d = dias.get(k)!; return Math.max(...d.map(v => v.h)) - Math.min(...d.map(v => v.l)) })
  const hasta = velas.filter(v => v.t <= ahora)

  return {
    maxAyer, minAyer, cierreAyer,
    maxNoche: noche.length ? Math.max(...noche.map(v => v.h)) : undefined,
    minNoche: noche.length ? Math.min(...noche.map(v => v.l)) : undefined,
    maxHoy: hoyRegular.length ? Math.max(...hoyRegular.map(v => v.h)) : undefined,
    minHoy: hoyRegular.length ? Math.min(...hoyRegular.map(v => v.l)) : undefined,
    rangoMedio: rangos.length ? rangos.reduce((a, b) => a + b, 0) / rangos.length : undefined,
    ultimo: hasta.length ? hasta[hasta.length - 1].c : cierreAyer,
  }
}

/**
 * Volumen de los últimos `ventanaMin` minutos comparado con el de la misma
 * franja horaria en las sesiones anteriores. 2 = el doble de lo normal.
 */
export function volumenRelativo(velas: Vela[], ahora: Date, ventanaMin = 30): number | null {
  const fin = minutosDelDia(ahora, tz())
  const ini = fin - ventanaMin
  const hoy = claveDia(ahora, tz())
  const sumas = new Map<string, number>()
  for (const v of velas) {
    if (v.t > ahora) continue
    const m = minutosDelDia(v.t, tz())
    if (m < ini || m >= fin) continue
    const k = claveDia(v.t, tz())
    sumas.set(k, (sumas.get(k) ?? 0) + v.v)
  }
  const actual = sumas.get(hoy)
  const previas = [...sumas.entries()].filter(([k]) => k < hoy).map(([, s]) => s).filter(s => s > 0)
  if (!actual || previas.length === 0) return null
  const media = previas.reduce((a, b) => a + b, 0) / previas.length
  return media > 0 ? actual / media : null
}

/** Cambio porcentual del VIX en los últimos `min` minutos y respecto al cierre anterior. */
export function cambioVix(vix: Vela[], ahora: Date, min = 30): { ultimo: number; cambioDia: number | null; cambioReciente: number | null } | null {
  const hasta = vix.filter(v => v.t <= ahora)
  if (hasta.length === 0) return null
  const ultimo = hasta[hasta.length - 1].c
  const hoy = claveDia(ahora, tz())
  const previas = hasta.filter(v => claveDia(v.t, tz()) < hoy)
  const cierreAnterior = previas.length ? previas[previas.length - 1].c : null
  const ref = hasta.filter(v => v.t.getTime() <= ahora.getTime() - min * 60_000)
  const hace = ref.length ? ref[ref.length - 1].c : null
  return {
    ultimo,
    cambioDia: cierreAnterior ? ((ultimo - cierreAnterior) / cierreAnterior) * 100 : null,
    cambioReciente: hace ? ((ultimo - hace) / hace) * 100 : null,
  }
}

export const f = (n: number) => (Math.abs(n) >= 1000 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('es-ES')

/** VWAP de la sesión regular de hoy (desde las 9:30 de Nueva York). */
export function vwapSesion(velas: Vela[], ahora: Date): number | null {
  const hoy = claveDia(ahora, tz())
  let pv = 0, v = 0
  for (const x of velas) {
    if (x.t > ahora || claveDia(x.t, tz()) !== hoy || !sesionRegular(x)) continue
    pv += ((x.h + x.l + x.c) / 3) * x.v
    v += x.v
  }
  return v > 0 ? pv / v : null
}

const NASDAQ_POR_DEFECTO = { nombreVolatilidad: 'VIX', id: 'nasdaq' } as Pick<DefinicionEquipo, 'nombreVolatilidad' | 'id'>

export function analizarGrafico(nq: Vela[], vix: Vela[], ahora: Date, eq: Pick<DefinicionEquipo, 'nombreVolatilidad' | 'id'> = NASDAQ_POR_DEFECTO): { niveles: Niveles | null; hallazgos: Hallazgo[] } {
  const niveles = calcularNiveles(nq, ahora)
  const VX = eq.nombreVolatilidad
  const hallazgos: Hallazgo[] = []
  const hoy = claveDia(ahora, tz())

  const vx = cambioVix(vix, ahora)
  if (vx) {
    if (vx.cambioReciente !== null && vx.cambioReciente >= 5) {
      hallazgos.push({ agente: 'volatilidad', nivel: 'alerta', titulo: `La volatilidad se dispara: ${VX} +${vx.cambioReciente.toFixed(1)}% en 30 min (${vx.ultimo.toFixed(1)}).`, clave: `${eq.id}:vix-salto:${hoy}:${Math.floor(vx.ultimo)}` })
    } else if (vx.cambioDia !== null && vx.cambioDia >= 8) {
      hallazgos.push({ agente: 'volatilidad', nivel: 'atencion', titulo: `Volatilidad subiendo: ${VX} ${vx.ultimo.toFixed(1)} (+${vx.cambioDia.toFixed(1)}% en el día).`, clave: `${eq.id}:vix-dia:${hoy}` })
    }
    if (eq.id === 'nasdaq' && vx.ultimo >= 25) {
      hallazgos.push({ agente: 'volatilidad', nivel: 'atencion', titulo: `${VX} en ${vx.ultimo.toFixed(1)}: mercado nervioso, los movimientos serán más bruscos.`, clave: `${eq.id}:vix-alto:${hoy}` })
    }
  }

  const vr = volumenRelativo(nq, ahora)
  if (vr !== null && vr >= 1.8) {
    hallazgos.push({ agente: 'volumen', nivel: vr >= 2.5 ? 'alerta' : 'atencion', titulo: `Entra mucho volumen: ${vr.toFixed(1)} veces lo normal a esta hora.`, clave: `${eq.id}:vol:${hoy}:${minutosDelDia(ahora, tz()) - (minutosDelDia(ahora, tz()) % 30)}` })
  }

  if (niveles) {
    const cerca = niveles.ultimo * 0.0015
    const refs: [string, number | undefined][] = [
      ['máximo de ayer', niveles.maxAyer], ['mínimo de ayer', niveles.minAyer],
      ['máximo de la noche', niveles.maxNoche], ['mínimo de la noche', niveles.minNoche],
    ]
    for (const [nombre, valor] of refs) {
      if (valor !== undefined && Math.abs(niveles.ultimo - valor) <= cerca) {
        hallazgos.push({ agente: 'grafico', nivel: 'atencion', titulo: `El precio está en el ${nombre} (${f(valor)}). Zona de decisión: puede haber movimientos rápidos.`, clave: `${eq.id}:nivel:${hoy}:${nombre}` })
      }
    }
    if (niveles.rangoMedio && niveles.maxHoy !== undefined && niveles.minHoy !== undefined) {
      const rangoHoy = niveles.maxHoy - niveles.minHoy
      if (rangoHoy >= niveles.rangoMedio * 1.2) {
        hallazgos.push({ agente: 'grafico', nivel: 'atencion', titulo: `Hoy ya recorrió ${f(rangoHoy)} puntos, más de lo habitual (${f(niveles.rangoMedio)}).`, clave: `${eq.id}:rango:${hoy}` })
      }
    }
  }
  return { niveles, hallazgos }
}

export function describirNiveles(n: Niveles): string {
  const partes = [`Ayer: máx ${f(n.maxAyer)}, mín ${f(n.minAyer)}, cierre ${f(n.cierreAyer)}`]
  if (n.maxNoche !== undefined && n.minNoche !== undefined) partes.push(`Noche: ${f(n.minNoche)} a ${f(n.maxNoche)}`)
  if (n.rangoMedio) partes.push(`Rango medio diario: ${f(n.rangoMedio)} pts`)
  partes.push(`Último: ${f(n.ultimo)}`)
  return partes.join('. ')
}

/** ATR: rango verdadero medio de las últimas `n` sesiones completas, en puntos. */
export function atr(diarias: Vela[], ahora: Date, n = 14): number | null {
  const hoy = claveDia(ahora, tz())
  const cerradas = diarias.filter(v => claveDia(v.t, tz()) < hoy)
  if (cerradas.length < 2) return null
  const tr: number[] = []
  for (let i = 1; i < cerradas.length; i++) {
    const v = cerradas[i], prev = cerradas[i - 1].c
    tr.push(Math.max(v.h - v.l, Math.abs(v.h - prev), Math.abs(v.l - prev)))
  }
  const ult = tr.slice(-n)
  return ult.reduce((a, b) => a + b, 0) / ult.length
}

/** Movimiento del día en % (de la apertura regular al último precio). Para comparar con tu sesgo. */
export function movimientoDelDia(velas: Vela[], ahora: Date): number | null {
  const hoy = claveDia(ahora, tz())
  const sesion = velas.filter(v => v.t <= ahora && claveDia(v.t, tz()) === hoy && sesionRegular(v))
  if (sesion.length === 0) return null
  return ((sesion[sesion.length - 1].c - sesion[0].o) / sesion[0].o) * 100
}

/**
 * Agente de volatilidad y rango: cuánto se suele mover el activo y cómo está
 * la volatilidad. Habla en puntos de movimiento y porcentajes, no en precios.
 */
export function rangoEsperado(diarias: Vela[], vix: Vela[], ahora: Date, eq: Pick<DefinicionEquipo, 'nombreVolatilidad' | 'id' | 'nombre'>): Hallazgo[] {
  const a = atr(diarias, ahora)
  if (a === null) return []
  const vx = cambioVix(vix, ahora)
  const redondo = a >= 100 ? Math.round(a / 10) * 10 : Math.round(a)
  let titulo = `${eq.nombre} se mueve de media unos ${redondo.toLocaleString('es-ES')} puntos al día (ATR de 14 días): cuenta con movimientos de ese tamaño.`
  let nivel: Hallazgo['nivel'] = 'info'
  if (vx) {
    const sube = vx.cambioDia !== null && vx.cambioDia >= 5
    titulo += ` ${eq.nombreVolatilidad} en ${vx.ultimo.toFixed(1)}${vx.cambioDia !== null ? ` (${vx.cambioDia >= 0 ? '+' : ''}${vx.cambioDia.toFixed(1)}% en el día)` : ''}.`
    if (vx.ultimo >= 22 || sube) {
      nivel = 'atencion'
      titulo += ' Volatilidad alta: hoy pueden ser más.'
    }
  }
  return [{ agente: 'volatilidad', nivel, titulo, clave: `${eq.id}:atr:${claveDia(ahora, tz())}` }]
}
