// Lo que la oficina toma de Factor Macro (la app de macro de lola).
import { config } from '../config.ts'
import { getJson } from './http.ts'

export interface DatosMercadoFM {
  vix?: { available: boolean; last: number | null; history: number[] }
  atr_nq?: { available: boolean; value: number | null }
  ranges_nq?: { daily?: { available: boolean; lastRangePts: number | null; avgRangePts: number | null } }
}

export async function datosMercado(): Promise<DatosMercadoFM | null> {
  try {
    return await getJson<DatosMercadoFM>(`${config.factorMacro.url}/api/market-data`)
  } catch {
    return null
  }
}

/** Último briefing semanal de Nova (Mentor IA). Necesita la clave de equipo. */
export async function briefingSemanal(): Promise<Record<string, unknown> | null> {
  if (!config.factorMacro.clave) return null
  try {
    const r = await getJson<Record<string, unknown>>(`${config.factorMacro.url}/api/nova/latest`, {
      headers: { 'x-admin-password': config.factorMacro.clave },
    })
    return r.available ? r : null
  } catch {
    return null
  }
}
