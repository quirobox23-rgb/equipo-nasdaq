// Lo que la vista de la oficina (public/oficina.html) enseña: en qué está
// cada agente según los últimos hallazgos.
import { leer, guardar } from './almacen.ts'
import { semaforo } from './coordinador.ts'
import type { AgenteId, Hallazgo, Semaforo } from './tipos.ts'

export type EstadoAgente = 'alerta' | 'trabajando' | 'descanso'
export type IdOficina = AgenteId | 'coordinador'

export interface EstadoOficina {
  actualizado: string
  equipos: string[]
  semaforo: Semaforo
  agentes: Partial<Record<IdOficina, { estado: EstadoAgente; mensaje: string; hora: string }>>
}

/** Volumen y volatilidad salen del mismo módulo que el gráfico; en la oficina cada uno tiene su mesa. */
export function resumirEstado(h: Hallazgo[], equipos: string[], ahora: Date, mensajeEnviado: boolean): EstadoOficina {
  const agentes: EstadoOficina['agentes'] = {}
  const orden = { alerta: 0, atencion: 1, info: 2 } as const
  for (const x of [...h].sort((a, b) => orden[a.nivel] - orden[b.nivel])) {
    if (agentes[x.agente]) continue
    agentes[x.agente] = {
      estado: x.nivel === 'alerta' ? 'alerta' : x.nivel === 'atencion' ? 'trabajando' : 'descanso',
      mensaje: x.titulo,
      hora: ahora.toISOString(),
    }
  }
  agentes.coordinador = {
    estado: mensajeEnviado ? 'trabajando' : 'descanso',
    mensaje: mensajeEnviado ? 'Te acaba de escribir.' : 'Nada nuevo que contarte.',
    hora: ahora.toISOString(),
  }
  return { actualizado: ahora.toISOString(), equipos, semaforo: semaforo(h), agentes }
}

export async function registrarEstado(h: Hallazgo[], equipos: string[], ahora: Date, mensajeEnviado: boolean): Promise<void> {
  const previo = await leer<EstadoOficina | null>('estado-oficina', null)
  const nuevo = resumirEstado(h, equipos, ahora, mensajeEnviado)
  // Los agentes que esta vez no han dicho nada conservan lo último, pero se van a descansar.
  for (const [id, a] of Object.entries(previo?.agentes ?? {}) as [IdOficina, NonNullable<EstadoOficina['agentes'][IdOficina]>][]) {
    if (!nuevo.agentes[id]) nuevo.agentes[id] = { ...a, estado: 'descanso' }
  }
  await guardar('estado-oficina', nuevo)
}

/** Pasada media hora sin noticias de la oficina, todos se van a descansar (lo último que dijeron se conserva). */
export function envejecer(e: EstadoOficina, ahora: Date, minutos = 30): EstadoOficina {
  if (ahora.getTime() - new Date(e.actualizado).getTime() < minutos * 60_000) return e
  const agentes: EstadoOficina['agentes'] = {}
  for (const [id, a] of Object.entries(e.agentes) as [IdOficina, NonNullable<EstadoOficina['agentes'][IdOficina]>][]) agentes[id] = { ...a, estado: 'descanso' }
  return { ...e, semaforo: 'verde', agentes }
}

export async function leerEstado(ahora = new Date()): Promise<EstadoOficina | null> {
  const e = await leer<EstadoOficina | null>('estado-oficina', null)
  return e ? envejecer(e, ahora) : null
}
