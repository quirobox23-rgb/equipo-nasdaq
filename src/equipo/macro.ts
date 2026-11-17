// Experto en macro: qué datos y qué discursos hay hoy y cuándo no conviene operar.
import { config } from '../config.ts'
import type { EventoMacro } from '../sources/calendario.ts'
import type { Hallazgo } from '../tipos.ts'
import { claveDia, hora } from '../tiempo.ts'

/** Eventos que mueven de verdad el Nasdaq: margen más amplio alrededor. */
const MUY_SENSIBLES = /(CPI|Core PCE|PCE Price|Non-Farm|Nonfarm|NFP|FOMC|Federal Funds Rate|Fed Chair|Warsh|Powell|GDP)/i
const DISCURSO = /(Speaks|Testifies|Press Conference|Speech)/i

export interface VentanaRiesgo { inicio: Date; fin: Date; motivo: string; evento: EventoMacro }

/** Margen en minutos antes y después de cada evento en el que es mejor no abrir posiciones. */
export function margenes(e: EventoMacro): { antes: number; despues: number } {
  if (/FOMC Statement|Federal Funds Rate|Rate Decision/i.test(e.titulo)) return { antes: 30, despues: 45 }
  if (DISCURSO.test(e.titulo) && MUY_SENSIBLES.test(e.titulo)) return { antes: 15, despues: 60 }
  if (DISCURSO.test(e.titulo)) return { antes: 10, despues: 30 }
  if (MUY_SENSIBLES.test(e.titulo)) return { antes: 15, despues: 20 }
  return e.impacto === 'alto' ? { antes: 10, despues: 15 } : { antes: 5, despues: 5 }
}

export function ventanasDeRiesgo(eventos: EventoMacro[]): VentanaRiesgo[] {
  return eventos
    .filter(e => !e.sinHora && e.impacto !== 'festivo' && (e.impacto === 'alto' || MUY_SENSIBLES.test(e.titulo)))
    .map(e => {
      const m = margenes(e)
      return {
        evento: e,
        inicio: new Date(e.fecha.getTime() - m.antes * 60_000),
        fin: new Date(e.fecha.getTime() + m.despues * 60_000),
        motivo: e.titulo,
      }
    })
}

export function eventosDelDia(eventos: EventoMacro[], ahora: Date): EventoMacro[] {
  const hoy = claveDia(ahora, config.tzMercado)
  return eventos.filter(e => claveDia(e.fecha, config.tzMercado) === hoy)
}

function describir(e: EventoMacro): string {
  const h = e.sinHora ? 'todo el día' : `${hora(e.fecha, config.tzUsuaria)}`
  const extra = [e.prevision && `previsión ${e.prevision}`, e.anterior && `anterior ${e.anterior}`].filter(Boolean).join(', ')
  return `${h} ${e.titulo}${extra ? ` (${extra})` : ''}`
}

/** Para la guía de la mañana: la agenda del día. */
export function agendaDelDia(eventos: EventoMacro[], ahora: Date): Hallazgo[] {
  const hoy = eventosDelDia(eventos, ahora)
  const out: Hallazgo[] = []
  const festivo = hoy.find(e => e.impacto === 'festivo')
  if (festivo) {
    out.push({ agente: 'macro', nivel: 'atencion', titulo: `Festivo en EE. UU. (${festivo.titulo}): mercado cerrado o con poca liquidez.` })
  }
  const relevantes = hoy.filter(e => e.impacto !== 'festivo')
  if (relevantes.length === 0) {
    out.push({ agente: 'macro', nivel: 'info', titulo: 'Sin datos macro importantes hoy en EE. UU.' })
    return out
  }
  for (const e of relevantes) {
    const sensible = MUY_SENSIBLES.test(e.titulo)
    const m = margenes(e)
    out.push({
      agente: 'macro',
      nivel: sensible ? 'alerta' : e.impacto === 'alto' ? 'atencion' : 'info',
      titulo: describir(e),
      detalle: e.sinHora ? undefined : `Evita abrir posiciones desde ${m.antes} min antes hasta ${m.despues} min después.`,
      clave: `macro:${e.titulo}:${e.fecha.toISOString()}`,
    })
  }
  return out
}

/** Para la vigilancia: ¿estamos dentro o a punto de entrar en una ventana de riesgo? */
export function vigilarMacro(eventos: EventoMacro[], ahora: Date, avisoPrevioMin = 20): Hallazgo[] {
  const out: Hallazgo[] = []
  for (const v of ventanasDeRiesgo(eventos)) {
    const t = ahora.getTime()
    if (t >= v.inicio.getTime() && t <= v.fin.getTime()) {
      out.push({
        agente: 'macro', nivel: 'alerta',
        titulo: `No operes ahora: ${v.motivo} (${hora(v.evento.fecha, config.tzUsuaria)}).`,
        detalle: `Espera hasta las ${hora(v.fin, config.tzUsuaria)}.`,
        clave: `ventana:${v.motivo}:${v.evento.fecha.toISOString()}`,
      })
    } else if (v.inicio.getTime() > t && v.inicio.getTime() - t <= avisoPrevioMin * 60_000) {
      out.push({
        agente: 'macro', nivel: 'atencion',
        titulo: `En unos minutos: ${v.motivo} a las ${hora(v.evento.fecha, config.tzUsuaria)}.`,
        detalle: `Desde las ${hora(v.inicio, config.tzUsuaria)} mejor no abrir nada nuevo.`,
        clave: `previo:${v.motivo}:${v.evento.fecha.toISOString()}`,
      })
    }
  }
  return out
}
