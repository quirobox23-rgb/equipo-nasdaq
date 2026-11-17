// Analista de gráfico: niveles de referencia, volumen relativo y volatilidad.
// Solo describe el contexto; no dice por dónde entrar.
import { config } from '../config.ts'
import type { Vela } from '../sources/yahoo.ts'
import type { Hallazgo } from '../tipos.ts'
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

const f = (n: number) => Math.round(n).toLocaleString('es-ES')

export function analizarGrafico(nq: Vela[], vix: Vela[], ahora: Date): { niveles: Niveles | null; hallazgos: Hallazgo[] } {
  const niveles = calcularNiveles(nq, ahora)
  const hallazgos: Hallazgo[] = []
  const hoy = claveDia(ahora, tz())

  const vx = cambioVix(vix, ahora)
  if (vx) {
    if (vx.cambioReciente !== null && vx.cambioReciente >= 5) {
      hallazgos.push({ agente: 'grafico', nivel: 'alerta', titulo: `La volatilidad se dispara: VIX +${vx.cambioReciente.toFixed(1)}% en 30 min (${vx.ultimo.toFixed(1)}).`, clave: `vix-salto:${hoy}:${Math.floor(vx.ultimo)}` })
    } else if (vx.cambioDia !== null && vx.cambioDia >= 8) {
      hallazgos.push({ agente: 'grafico', nivel: 'atencion', titulo: `Volatilidad subiendo: VIX ${vx.ultimo.toFixed(1)} (+${vx.cambioDia.toFixed(1)}% en el día).`, clave: `vix-dia:${hoy}` })
    }
    if (vx.ultimo >= 25) {
      hallazgos.push({ agente: 'grafico', nivel: 'atencion', titulo: `VIX en ${vx.ultimo.toFixed(1)}: mercado nervioso, los movimientos serán más bruscos.`, clave: `vix-alto:${hoy}` })
    }
  }

  const vr = volumenRelativo(nq, ahora)
  if (vr !== null && vr >= 1.8) {
    hallazgos.push({ agente: 'grafico', nivel: vr >= 2.5 ? 'alerta' : 'atencion', titulo: `Entra mucho volumen: ${vr.toFixed(1)} veces lo normal a esta hora.`, clave: `vol:${hoy}:${minutosDelDia(ahora, tz()) - (minutosDelDia(ahora, tz()) % 30)}` })
  }

  if (niveles) {
    const cerca = niveles.ultimo * 0.0015
    const refs: [string, number | undefined][] = [
      ['máximo de ayer', niveles.maxAyer], ['mínimo de ayer', niveles.minAyer],
      ['máximo de la noche', niveles.maxNoche], ['mínimo de la noche', niveles.minNoche],
    ]
    for (const [nombre, valor] of refs) {
      if (valor !== undefined && Math.abs(niveles.ultimo - valor) <= cerca) {
        hallazgos.push({ agente: 'grafico', nivel: 'atencion', titulo: `El precio está en el ${nombre} (${f(valor)}). Zona de decisión: puede haber movimientos rápidos.`, clave: `nivel:${hoy}:${nombre}` })
      }
    }
    if (niveles.rangoMedio && niveles.maxHoy !== undefined && niveles.minHoy !== undefined) {
      const rangoHoy = niveles.maxHoy - niveles.minHoy
      if (rangoHoy >= niveles.rangoMedio * 1.2) {
        hallazgos.push({ agente: 'grafico', nivel: 'atencion', titulo: `Hoy ya recorrió ${f(rangoHoy)} puntos, más de lo habitual (${f(niveles.rangoMedio)}).`, clave: `rango:${hoy}` })
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
