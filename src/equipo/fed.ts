// Agente de la Fed: discursos, actas y decisiones de tipos del día, con una
// ficha de quién habla. Las fichas están en config/fed.json para que las
// mantengas al día (cambian los votantes cada año y a veces el tono).
import { promises as fs } from 'node:fs'
import { config } from '../config.ts'
import type { EventoMacro } from '../sources/calendario.ts'
import type { Hallazgo } from '../tipos.ts'
import { hora } from '../tiempo.ts'
import { eventosDelDia } from './macro.ts'

export interface MiembroFed {
  apellido: string
  nombre: string
  cargo: string
  /** halcon: prefiere tipos altos; paloma: prefiere bajarlos; centro. */
  tono?: 'halcon' | 'paloma' | 'centro'
  vota?: boolean
  nota?: string
}

const FED = /(FOMC|Federal Funds Rate|Fed Chair|Fed Vice Chair|Fed Governor|Fed President|Fed Member|Beige Book|Fed Monetary Policy Report|Fed Balance Sheet)/i
const DECISION = /(FOMC Statement|Federal Funds Rate|Rate Decision|FOMC Press Conference|FOMC Economic Projections)/i

export function esFed(e: EventoMacro, miembros: MiembroFed[] = []): boolean {
  return FED.test(e.titulo) || miembros.some(m => new RegExp(`\\b${m.apellido}\\b`, 'i').test(e.titulo))
}

export async function cargarMiembros(archivo = './config/fed.json'): Promise<MiembroFed[]> {
  try {
    return JSON.parse(await fs.readFile(archivo, 'utf-8')) as MiembroFed[]
  } catch {
    return []
  }
}

const TONO = { halcon: 'halcón (prefiere tipos altos)', paloma: 'paloma (prefiere bajar tipos)', centro: 'de centro' } as const

function ficha(m: MiembroFed): string {
  return [m.cargo, m.tono && TONO[m.tono], m.vota === true ? 'vota este año' : m.vota === false ? 'no vota este año' : '', m.nota]
    .filter(Boolean).join(', ')
}

/** Para la guía de la mañana: lo que hace la Fed hoy. */
export function agendaFed(eventos: EventoMacro[], ahora: Date, miembros: MiembroFed[] = []): Hallazgo[] {
  const out: Hallazgo[] = []
  for (const e of eventosDelDia(eventos, ahora).filter(e => esFed(e, miembros))) {
    const h = e.sinHora ? 'Hoy' : `A las ${hora(e.fecha, config.tzUsuaria)}`
    const quien = miembros.find(m => new RegExp(`\\b${m.apellido}\\b`, 'i').test(e.titulo))
    const clave = `fed:${e.titulo}:${e.fecha.toISOString()}`
    if (DECISION.test(e.titulo)) {
      out.push({ agente: 'fed', nivel: 'alerta', titulo: `${h}: ${e.titulo}. Es el momento de más volatilidad del día; el NQ puede moverse con fuerza en los dos sentidos.`, clave })
    } else if (/Minutes/i.test(e.titulo)) {
      out.push({ agente: 'fed', nivel: 'atencion', titulo: `${h} salen las actas de la Fed. Suelen mover el mercado unos minutos.`, clave })
    } else if (quien) {
      const presidente = (/Chair/i.test(e.titulo) || /^presidente de la Fed/i.test(quien.cargo)) && !/Vice/i.test(e.titulo)
      out.push({
        agente: 'fed', nivel: presidente ? 'alerta' : 'atencion',
        titulo: `${h} habla ${quien.nombre} ${quien.apellido} (${ficha(quien)}). Cualquier pista sobre los tipos puede mover el NQ.`,
        clave,
      })
    } else {
      out.push({ agente: 'fed', nivel: /Chair/i.test(e.titulo) ? 'alerta' : 'atencion', titulo: `${h}: ${e.titulo}.`, clave })
    }
  }
  return out
}
